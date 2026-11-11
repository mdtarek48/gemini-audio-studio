"""
Gemini AI Studio Audio / TTS Server
Uses Python standard library - No external pip dependencies needed!
"""

import http.server
import socketserver
import json
import urllib.request
import urllib.error
import io
import wave
import base64
import os
import sys
import mimetypes

# Ensure correct MIME types on Windows
mimetypes.init()
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('text/javascript', '.js')
mimetypes.add_type('text/css', '.css')

PORT = 5000
PUBLIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public")

def load_env_file():
    """Simple .env loader without external dependencies."""
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
        except Exception:
            pass

load_env_file()

def pcm_to_wav(pcm_bytes: bytes, sample_rate: int = 24000, channels: int = 1, sample_width: int = 2) -> bytes:
    """Converts raw 16-bit PCM bytes to standard WAV container bytes."""
    wav_io = io.BytesIO()
    with wave.open(wav_io, 'wb') as wav_file:
        wav_file.setnchannels(channels)
        wav_file.setsampwidth(sample_width)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm_bytes)
    return wav_io.getvalue()

CACHED_SUPPORTED_MODELS = {}

def fetch_supported_models(api_key):
    global CACHED_SUPPORTED_MODELS
    if api_key in CACHED_SUPPORTED_MODELS and CACHED_SUPPORTED_MODELS[api_key]:
        return list(CACHED_SUPPORTED_MODELS[api_key])
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
        req = urllib.request.Request(url, headers={"Content-Type": "application/json"}, method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            models = []
            for m in data.get("models", []):
                clean_name = m.get("name", "").replace("models/", "")
                methods = m.get("supportedGenerationMethods", [])
                if "generateContent" in methods:
                    models.append(clean_name)
            if models:
                CACHED_SUPPORTED_MODELS[api_key] = models
                print(f"[ListModels] API Key supports {len(models)} models: {models[:6]}...", flush=True)
            return list(models)
    except Exception as e:
        print(f"[ListModels Note] Could not list models: {e}", flush=True)
        return []

class GeminiTTSHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC_DIR, **kwargs)

    def do_POST(self):
        if self.path == "/api/generate-audio":
            self.handle_generate_audio()
        elif self.path == "/api/check-policy":
            self.handle_check_policy()
        else:
            self.send_error(404, "Endpoint not found")

    def handle_check_policy(self):
        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length)

        try:
            req_json = json.loads(post_data.decode("utf-8"))
        except Exception as e:
            self.send_json_response(400, {"error": "Invalid JSON: " + str(e)})
            return

        api_key_raw = req_json.get("apiKey", "") or req_json.get("apiKeys", "") or os.environ.get("GEMINI_API_KEY", "")
        keys_list = []
        if isinstance(api_key_raw, list):
            keys_list = [str(k).strip() for k in api_key_raw if str(k).strip()]
        elif isinstance(api_key_raw, str):
            import re
            keys_list = [k.strip() for k in re.split(r'[\n,;]+', api_key_raw) if k.strip()]

        text = req_json.get("text", "").strip()

        if not keys_list:
            self.send_json_response(400, {
                "error": "Google AI Studio API Key প্রয়োজন! অনুগ্রহ করে সেটিংস-এ আপনার API Key দিন।"
            })
            return

        if not text:
            self.send_json_response(400, {"error": "পলিসি চেক করার জন্য কোনো টেক্সট পাওয়া যায়নি।"})
            return

        prompt = (
            "You are an ultra-fast YouTube Community Guidelines & Advertiser-Friendly Monetization Policy Evaluator.\n"
            "Analyze the text below for policy violations (hate speech, severe profanity/vulgarity, violence, harassment, harmful misinformation, sexual content, advertiser-unfriendly/demonetization risks).\n\n"
            f'Text to check:\n"""{text}"""\n\n'
            "Return STRICT JSON only matching this schema:\n"
            "{\n"
            '  "safetyScore": 95,\n'
            '  "status": "clean" | "warning" | "violation",\n'
            '  "summary": "বাংলায় ১টি সংক্ষিপ্ত বাক্যে সামগ্রিক মূল্যায়ন",\n'
            '  "violations": [\n'
            "    {\n"
            '      "word": "স্ক্রিপ্টে থাকা মূল ঝুঁকিপূর্ণ শব্দটি",\n'
            '      "category": "গালিগালাজ" | "ঘৃণামূলক বক্তব্য" | "হয়রানি" | "সহিংসতা" | "মনিটাইজেশন ঝুঁকি",\n'
            '      "severity": "high" | "medium" | "low",\n'
            '      "reason": "কেন এটি ইউটিউবের পলিসির পরিপন্থী (খুব সংক্ষেপে)",\n'
            '      "suggestedWord": "নিরাপদ শালীন বিকল্প বাংলা শব্দ"\n'
            "    }\n"
            "  ]\n"
            "}\n"
            "If no violations found, return violations: [], status: 'clean', safetyScore: 100. Do NOT rewrite the full script. Be extremely fast."
        )

        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": prompt
                        }
                    ]
                }
            ],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.1,
                "maxOutputTokens": 1024
            }
        }

        req_bytes = json.dumps(payload).encode("utf-8")
        last_error = ""
        analysis_data = None
        used_key_idx = 0
        used_model = ""

        # Prioritize ultra-fast production models first
        candidate_models = [
            "gemini-2.0-flash",
            "gemini-1.5-flash",
            "gemini-3.8-flash",
            "gemini-2.0-flash-lite",
            "gemini-1.5-flash-8b"
        ]

        # Loop through keys
        for k_idx, current_key in enumerate(keys_list):
            print(f"[Policy Check] Key #{k_idx+1}: checking text...", flush=True)

            for current_model in candidate_models:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{current_model}:generateContent?key={current_key}"
                api_req = urllib.request.Request(
                    url,
                    data=req_bytes,
                    headers={"Content-Type": "application/json"},
                    method="POST"
                )
                try:
                    with urllib.request.urlopen(api_req, timeout=15) as response:
                        resp_data = response.read()
                        resp_json = json.loads(resp_data.decode("utf-8"))
                        candidates = resp_json.get("candidates", [])
                        if not candidates:
                            continue
                        parts = candidates[0].get("content", {}).get("parts", [])
                        raw_json_str = "".join([p.get("text", "") for p in parts if "text" in p]).strip()
                        if raw_json_str:
                            import re
                            clean_str = re.sub(r'^\s*```(?:json)?\s*', '', raw_json_str)
                            clean_str = re.sub(r'\s*```\s*$', '', clean_str).strip()
                            analysis_data = json.loads(clean_str)
                            used_key_idx = k_idx
                            used_model = current_model
                            print(f"[Policy Check SUCCESS] Model: {current_model} completed scan in ultra-fast mode!", flush=True)
                            break
                except urllib.error.HTTPError as e:
                    err_body = e.read().decode("utf-8", errors="replace")
                    try:
                        err_json = json.loads(err_body)
                        last_error = err_json.get("error", {}).get("message", err_body)
                    except Exception:
                        last_error = err_body
                    
                    print(f"[Policy Check Model {current_model} Note] Code: {e.code}, Message: {last_error}", flush=True)
                    is_quota = e.code == 429 or "quota" in last_error.lower() or "resource_exhausted" in last_error.lower() or "rate limit" in last_error.lower()
                    if is_quota:
                        # Quota exceeded on this key -> switch to next key immediately
                        print(f"[Policy Check Quota Exceeded] Switching to next key...", flush=True)
                        break
                    else:
                        continue
                except Exception as e:
                    last_error = str(e)
                    print(f"[Policy Check Exception] {e}", flush=True)
                    continue
            if analysis_data:
                break

        if not analysis_data:
            self.send_json_response(400, {
                "error": f"ইউটিউব পলিসি স্ক্যান করা যায়নি: {last_error or 'Gemini কোনো ফলাফল দেয়নি।'}"
            })
            return

        # Instant safe text generation in-memory
        safe_text = text
        for v in analysis_data.get("violations", []):
            w = (v.get("word") or "").strip()
            s = (v.get("suggestedWord") or "").strip()
            if w and s:
                safe_text = safe_text.replace(w, s)
        analysis_data["safeCorrectedText"] = safe_text

        self.send_json_response(200, {
            "success": True,
            "analysis": analysis_data,
            "usedKeyIndex": used_key_idx + 1,
            "totalKeys": len(keys_list),
            "usedModel": used_model
        })

    def handle_generate_audio(self):
        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length)

        try:
            req_json = json.loads(post_data.decode("utf-8"))
        except Exception as e:
            self.send_json_response(400, {"error": "Invalid JSON: " + str(e)})
            return

        api_key_raw = req_json.get("apiKey", "") or req_json.get("apiKeys", "") or os.environ.get("GEMINI_API_KEY", "")
        keys_list = []
        if isinstance(api_key_raw, list):
            keys_list = [str(k).strip() for k in api_key_raw if str(k).strip()]
        elif isinstance(api_key_raw, str):
            import re
            keys_list = [k.strip() for k in re.split(r'[\n,;]+', api_key_raw) if k.strip()]

        text = req_json.get("text", "").strip()
        voice = req_json.get("voice", "Kore").strip()
        model = req_json.get("model", "gemini-3.8-flash-tts").strip()
        tone = req_json.get("tone", "").strip() or "Bright, sunny, welcoming morning greeting with a subtle vocal smile and crisp pacing"

        if not keys_list:
            self.send_json_response(400, {
                "error": "Google AI Studio API Key প্রয়োজন! অনুগ্রহ করে সেটিংস-এ আপনার API Key দিন।"
            })
            return

        if not text:
            self.send_json_response(400, {"error": "কোনো টেক্সট পাওয়া যায়নি।"})
            return

        text_part = {
            "text": text.strip()
        }
        if tone:
            text_part["speechMetadata"] = {
                "style": tone
            }

        payload = {
            "contents": [
                {
                    "parts": [text_part]
                }
            ],
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {
                    "voiceConfig": {
                        "prebuiltVoiceConfig": {
                            "voiceName": voice
                        }
                    }
                }
            }
        }

        req_bytes = json.dumps(payload).encode("utf-8")
        candidate_models = [model]
        if model != "gemini-3.8-flash-lite-tts":
            candidate_models.append("gemini-3.8-flash-lite-tts")

        last_error = ""
        had_quota_error = False
        audio_part = None
        used_key_idx = 0
        used_model = model

        # Loop through keys and candidate models
        for k_idx, current_key in enumerate(keys_list):
            for current_model in candidate_models:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{current_model}:generateContent?key={current_key}"
                api_req = urllib.request.Request(
                    url,
                    data=req_bytes,
                    headers={"Content-Type": "application/json"},
                    method="POST"
                )
                try:
                    with urllib.request.urlopen(api_req, timeout=60) as response:
                        resp_data = response.read()
                        resp_json = json.loads(resp_data.decode("utf-8"))
                        candidates = resp_json.get("candidates", [])
                        if not candidates:
                            continue
                        parts = candidates[0].get("content", {}).get("parts", [])
                        for part in parts:
                            if "inlineData" in part:
                                audio_part = part["inlineData"]
                                break
                        if audio_part:
                            used_key_idx = k_idx
                            used_model = current_model
                            break
                except urllib.error.HTTPError as e:
                    err_body = e.read().decode("utf-8", errors="replace")
                    try:
                        err_json = json.loads(err_body)
                        last_error = err_json.get("error", {}).get("message", err_body)
                    except Exception:
                        last_error = err_body

                    # If model rejected speechMetadata, retry without it
                    if "speechMetadata" in text_part and (e.code == 400 or "speechmetadata" in last_error.lower()):
                        try:
                            fallback_payload = {
                                "contents": [{"parts": [{"text": text.strip()}]}],
                                "generationConfig": payload["generationConfig"]
                            }
                            fb_req = urllib.request.Request(
                                url,
                                data=json.dumps(fallback_payload).encode("utf-8"),
                                headers={"Content-Type": "application/json"},
                                method="POST"
                            )
                            with urllib.request.urlopen(fb_req, timeout=60) as fb_res:
                                fb_data = json.loads(fb_res.read().decode("utf-8"))
                                fb_candidates = fb_data.get("candidates", [])
                                if fb_candidates:
                                    fb_parts = fb_candidates[0].get("content", {}).get("parts", [])
                                    for part in fb_parts:
                                        if "inlineData" in part:
                                            audio_part = part["inlineData"]
                                            break
                                    if audio_part:
                                        used_key_idx = k_idx
                                        used_model = current_model
                                        break
                        except Exception as fb_err:
                            last_error = str(fb_err)

                    if e.code == 429 or "quota" in last_error.lower() or "resource_exhausted" in last_error.lower():
                        had_quota_error = True
                        continue
                    else:
                        break
                except Exception as e:
                    last_error = str(e)
                    continue
            if audio_part:
                break

        if not audio_part:
            if had_quota_error:
                self.send_json_response(429, {"error": f"আপনার সবগুলি API Key-এর কোটা শেষ হয়ে গেছে: {last_error}"})
            else:
                self.send_json_response(400, {"error": f"API ত্রুটি: {last_error}"})
            return

        try:
            mime_type = audio_part.get("mimeType", "")
            raw_base64 = audio_part.get("data", "")
            raw_bytes = base64.b64decode(raw_base64)

            # Check if it's raw PCM data and needs WAV conversion
            if "pcm" in mime_type.lower() or not mime_type.startswith("audio/wav"):
                # Default Gemini audio is 24000Hz 16-bit mono PCM
                sample_rate = 24000
                if "rate=" in mime_type:
                    try:
                        rate_str = mime_type.split("rate=")[1].split(";")[0].strip()
                        sample_rate = int(rate_str)
                    except Exception:
                        sample_rate = 24000

                wav_bytes = pcm_to_wav(raw_bytes, sample_rate=sample_rate)
                out_base64 = base64.b64encode(wav_bytes).decode("utf-8")
                out_mime = "audio/wav"
            else:
                out_base64 = raw_base64
                out_mime = mime_type

            self.send_json_response(200, {
                "success": True,
                "mimeType": out_mime,
                "audioBase64": out_base64,
                "sizeBytes": len(raw_bytes),
                "usedKeyIndex": used_key_idx + 1,
                "totalKeys": len(keys_list),
                "usedModel": used_model
            })
        except Exception as e:
            self.send_json_response(500, {"error": f"সার্ভার ত্রুটি: {str(e)}"})

    def send_json_response(self, status_code, data):
        resp_bytes = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(resp_bytes)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(resp_bytes)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

def run_server():
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    port = PORT
    httpd = None

    for attempt in range(10):
        try:
            server_address = ("", port)
            httpd = socketserver.TCPServer(server_address, GeminiTTSHandler)
            break
        except OSError as e:
            if attempt < 9:
                port += 1
            else:
                print(f"Error starting server: {e}")
                sys.exit(1)

    print(f"==================================================", flush=True)
    print(f" Gemini AI Audio Studio সার্ভার চালু হয়েছে!", flush=True)
    print(f" ব্রাউজারে ওপেন করুন: http://localhost:{port}", flush=True)
    print(f"==================================================", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nসার্ভার বন্ধ করা হচ্ছে...", flush=True)

if __name__ == "__main__":
    run_server()
