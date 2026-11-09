/**
 * Vercel Serverless Function for Gemini Audio / TTS Generation
 * Handles POST /api/generate-audio
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
    const { text, apiKey, voice = 'Puck', model = 'gemini-2.0-flash' } = req.body || {};

    const activeApiKey = (apiKey && apiKey.trim()) || process.env.GEMINI_API_KEY;

    if (!activeApiKey) {
      return res.status(400).json({
        error: 'Google AI Studio API Key প্রয়োজন! অনুগ্রহ করে সেটিংস-এ আপনার API Key দিন।'
      });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'কোনো টেক্সট পাওয়া যায়নি।' });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(activeApiKey)}`;

    const promptInstruction = (
      "Read the following text aloud verbatim with natural expression, steady pacing, and clear pronunciation. " +
      "Do NOT add any greetings, explanations, introductions, commentary, or outro. " +
      "Only voice the exact text provided below:\n\n" + text.trim()
    );

    const payload = {
      contents: [
        {
          parts: [
            {
              text: promptInstruction
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
      return res.status(apiResponse.status).json({ error: errorMsg });
    }

    const candidates = respJson.candidates || [];
    if (!candidates.length) {
      return res.status(500).json({ error: 'Gemini কোনো উত্তর দেয়নি। টেক্সটটি পুনরায় চেষ্টা করুন।' });
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
      return res.status(500).json({
        error: `অডিও জেনারেট হয়নি।${textParts ? ' মডেল বার্তা: ' + textParts : ''}`
      });
    }

    const mimeType = audioPart.mimeType || '';
    const rawBase64 = audioPart.data || '';
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
      sizeBytes: rawBuffer.length
    });

  } catch (error) {
    console.error('TTS Serverless Function Error:', error);
    return res.status(500).json({ error: 'সার্ভার ত্রুটি: ' + error.message });
  }
}
