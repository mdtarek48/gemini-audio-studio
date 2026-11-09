/**
 * Vercel Serverless Function for Gemini Audio / TTS Generation
 * Handles POST /api/generate-audio
 * Supports Multi-Account API Key Failover & Quota Rotation
 */

function pcmToWavBuffer(pcmBuffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16) {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF Chunk
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // Format Chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // subchunk1 size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // Data Chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Copy raw PCM bytes
  pcmBuffer.copy(buffer, 44);
  return buffer;
}

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { text, apiKey, apiKeys, voice = 'Kore', model = 'gemini-3.8-flash-tts' } = req.body || {};

    // Support multiple API keys from either array or newline/comma separated string
    let keysList = [];
    if (Array.isArray(apiKeys) && apiKeys.length > 0) {
      keysList = apiKeys.map(k => (k || '').trim()).filter(Boolean);
    } else if (typeof apiKey === 'string' && apiKey.trim()) {
      keysList = apiKey.split(/[\n,;]+/).map(k => k.trim()).filter(Boolean);
    }

    if (process.env.GEMINI_API_KEY && !keysList.includes(process.env.GEMINI_API_KEY)) {
      keysList.push(process.env.GEMINI_API_KEY);
    }

    if (keysList.length === 0) {
      return res.status(400).json({
        error: 'Google AI Studio API Key প্রয়োজন! অনুগ্রহ করে সেটিংস-এ আপনার API Key দিন।'
      });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'কোনো টেক্সট পাওয়া যায়নি।' });
    }

    const payload = {
      systemInstruction: {
        parts: [
          {
            text: "You are a verbatim Text-to-Speech (TTS) synthesizer. Your ONLY job is to read the exact user provided text aloud in its original language. DO NOT speak in English unless the text is in English. NEVER add any introduction, preamble, commentary, conversational filler, or greeting (such as 'Sure', 'Okay', 'Here is the reading', 'Alright'). Start speaking the provided text immediately from the very first word."
          }
        ]
      },
      contents: [
        {
          parts: [
            {
              text: text.trim()
            }
          ]
        }
      ],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voice
            }
          }
        }
      }
    };

    // Candidate models to fallback if one hits quota
    const candidateModels = [model, 'gemini-3.8-flash-lite-tts'];
    let lastError = null;
    let successfulAudio = null;
    let usedKeyIndex = -1;
    let usedModel = model;

    // Loop through each API key and candidate model automatically
    outerLoop:
    for (let k = 0; k < keysList.length; k++) {
      const activeKey = keysList[k];

      for (const currentModel of candidateModels) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(currentModel)}:generateContent?key=${encodeURIComponent(activeKey)}`;

        try {
          const apiResponse = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });

          const respJson = await apiResponse.json();

          if (!apiResponse.ok) {
            const errorMsg = respJson?.error?.message || `API Error (${apiResponse.status})`;
            lastError = errorMsg;
            const isQuotaError = apiResponse.status === 429 || 
                                 errorMsg.toLowerCase().includes('quota') || 
                                 errorMsg.toLowerCase().includes('rate limit') ||
                                 errorMsg.toLowerCase().includes('resource_exhausted');

            if (isQuotaError) {
              console.log(`Key #${k + 1} quota exceeded on ${currentModel}. Trying next key/model...`);
              continue; // try next model or next key
            } else {
              // Non-quota error on this key (e.g. invalid key format), move to next key
              continue outerLoop;
            }
          }

          const candidates = respJson.candidates || [];
          if (!candidates.length) {
            lastError = 'Gemini কোনো উত্তর দেয়নি।';
            continue;
          }

          const parts = candidates[0]?.content?.parts || [];
          let audioPart = null;
          for (const part of parts) {
            if (part.inlineData) {
              audioPart = part.inlineData;
              break;
            }
          }

          if (!audioPart) {
            const textParts = parts.filter(p => p.text).map(p => p.text).join(' ');
            lastError = `অডিও জেনারেট হয়নি। ${textParts}`;
            continue;
          }

          // Found working audio!
          successfulAudio = audioPart;
          usedKeyIndex = k;
          usedModel = currentModel;
          break outerLoop;

        } catch (fetchErr) {
          lastError = fetchErr.message;
          continue;
        }
      }
    }

    if (!successfulAudio) {
      return res.status(429).json({
        error: `আপনার সবগুলি API Key-এর কোটা শেষ হয়ে গেছে: ${lastError || 'অনুগ্রহ করে নতুন আরেকটি একাউন্টের API Key যুক্ত করুন।'}`
      });
    }

    const mimeType = successfulAudio.mimeType || '';
    const rawBase64 = successfulAudio.data || '';
    const rawBuffer = Buffer.from(rawBase64, 'base64');

    let outBase64 = rawBase64;
    let outMime = mimeType;

    // Convert raw PCM to standard WAV container
    if (mimeType.toLowerCase().includes('pcm') || !mimeType.startsWith('audio/wav')) {
      let sampleRate = 24000;
      if (mimeType.includes('rate=')) {
        try {
          const rateMatch = mimeType.match(/rate=(\d+)/);
          if (rateMatch) sampleRate = parseInt(rateMatch[1], 10);
        } catch (e) {
          sampleRate = 24000;
        }
      }

      const wavBuffer = pcmToWavBuffer(rawBuffer, sampleRate);
      outBase64 = wavBuffer.toString('base64');
      outMime = 'audio/wav';
    }

    return res.status(200).json({
      success: true,
      mimeType: outMime,
      audioBase64: outBase64,
      sizeBytes: rawBuffer.length,
      usedKeyIndex: usedKeyIndex + 1,
      totalKeys: keysList.length,
      usedModel: usedModel
    });

  } catch (error) {
    console.error('TTS Serverless Function Error:', error);
    return res.status(500).json({ error: 'সার্ভার ত্রুটি: ' + error.message });
  }
}
