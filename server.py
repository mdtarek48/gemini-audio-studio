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

class GeminiTTSHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC_DIR, **kwargs)

    def do_POST(self):
        if self.path == "/api/generate-audio":
            self.handle_generate_audio()
        else:
            self.send_error(404, "Endpoint not found")

    def handle_generate_audio(self):
        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length)

        try:
            req_json = json.loads(post_data.decode("utf-8"))
        except Exception as e:
            self.send_json_response(400, {"error": "Invalid JSON: " + str(e)})
            return

        api_key = req_json.get("apiKey", "").strip() or os.environ.get("GEMINI_API_KEY", "").strip()
        text = req_json.get("text", "").strip()
        voice = req_json.get("voice", "Puck").strip()
        model = req_json.get("model", "gemini-2.0-flash").strip()

        if not api_key:
            self.send_json_response(400, {
                "error": "Google AI Studio API Key প্রয়োজন! অনুগ্রহ করে সেটিংস-এ আপনার API Key দিন।"
            })
            return

        if not text:
            self.send_json_response(400, {"error": "কোনো টেক্সট পাওয়া যায়নি।"})
            return

        # Prepare Gemini REST API request
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

        # Prompt instructing Gemini to act strictly as TTS
        prompt_instruction = (
            "Read the following text aloud verbatim with natural expression, steady pacing, and clear pronunciation. "
            "Do NOT add any greetings, explanations, introductions, commentary, or outro. "
            "Only voice the exact text provided below:\n\n" + text
        )

        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": prompt_instruction
                        }
                    ]
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

                # Parse Gemini response
                candidates = resp_json.get("candidates", [])
                if not candidates:
                    self.send_json_response(500, {"error": "Gemini কোনো উত্তর দেয়নি। টেক্সটটি পুনরায় চেষ্টা করুন।"})
                    return

                parts = candidates[0].get("content", {}).get("parts", [])
                audio_part = None
                for part in parts:
                    if "inlineData" in part:
                        audio_part = part["inlineData"]
                        break

                if not audio_part:
                    # Check if there is text explaining refusal
                    text_parts = [p.get("text", "") for p in parts if "text" in p]
                    error_msg = "অডিও জেনারেট হয়নি।"
                    if text_parts:
                        error_msg += " মডেল বার্তা: " + " ".join(text_parts)
                    self.send_json_response(500, {"error": error_msg})
                    return

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
                    "sizeBytes": len(raw_bytes)
                })

        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            err_msg = f"API Error ({e.code}): "
            try:
                err_json = json.loads(err_body)
                err_msg += err_json.get("error", {}).get("message", err_body)
            except Exception:
                err_msg += err_body

            self.send_json_response(e.code, {"error": err_msg})
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

    print(f"==================================================")
    print(f" Gemini AI Audio Studio সার্ভার চালু হয়েছে!")
    print(f" ব্রাউজারে ওপেন করুন: http://localhost:{port}")
    print(f"==================================================")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nসার্ভার বন্ধ করা হচ্ছে...")

if __name__ == "__main__":
    run_server()

