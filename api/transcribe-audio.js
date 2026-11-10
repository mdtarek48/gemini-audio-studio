/**
 * Vercel Serverless Function for Audio to Text (Transcription)
 * Handles POST /api/transcribe-audio
 */

const cachedModels = new Map();

async function fetchSupportedModels(apiKey) {
  if (cachedModels.has(apiKey)) return cachedModels.get(apiKey);
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const data = await resp.json();
    const list = (data.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(m => (m.name || '').replace('models/', ''));
    if (list.length > 0) cachedModels.set(apiKey, list);
    return list;
  } catch (e) {
    return [];
  }
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
    let { audioBase64, mimeType = 'audio/mp3', fileName = '', apiKey, apiKeys } = req.body || {};

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

    if (!audioBase64) {
      return res.status(400).json({ error: 'কোনো অডিও ডাটা পাওয়া যায়নি।' });
    }

    // Clean base64
    if (audioBase64.includes('base64,')) {
      audioBase64 = audioBase64.split('base64,')[1];
    }
    audioBase64 = audioBase64.replace(/[^A-Za-z0-9+/=]/g, '');

    // Normalize audio MIME type
    const ext = fileName && fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
    const mLower = (mimeType || '').toLowerCase();
    if (ext === 'wav' || mLower.includes('wav')) mimeType = 'audio/wav';
    else if (ext === 'mp3' || mLower.includes('mpeg') || mLower.includes('mp3')) mimeType = 'audio/mp3';
    else if (ext === 'm4a' || mLower.includes('mp4') || mLower.includes('m4a')) mimeType = 'audio/mp4';
    else if (ext === 'ogg' || mLower.includes('ogg')) mimeType = 'audio/ogg';
    else if (ext === 'flac' || mLower.includes('flac')) mimeType = 'audio/flac';
    else if (ext === 'aac' || mLower.includes('aac')) mimeType = 'audio/aac';
    else if (ext === 'webm' || mLower.includes('webm')) mimeType = 'audio/webm';
    else mimeType = 'audio/mp3';

    const payload = {
      contents: [
        {
          parts: [
            {
              text: 'Please transcribe all spoken words in this audio verbatim with accurate spelling and punctuation in its original spoken language (such as Bengali or English). Do not add any conversational commentary, introduction, or timestamps. Return ONLY the transcribed text.'
            },
            {
              inlineData: {
                mimeType: mimeType,
                data: audioBase64
              }
            }
          ]
        }
      ]
    };

    let lastError = null;
    let transcriptionText = '';
    let usedKeyIndex = -1;
    let usedModel = '';

    outerLoop:
    for (let k = 0; k < keysList.length; k++) {
      const activeKey = keysList[k];

      const supported = await fetchSupportedModels(activeKey);
      const flashModels = supported.filter(m => m.toLowerCase().includes('flash') && !m.endsWith('-tts'));
      const otherModels = supported.filter(m => !m.endsWith('-tts') && !flashModels.includes(m));
      const candidateModels = Array.from(new Set([
        ...flashModels,
        ...otherModels,
        'gemini-3.8-flash',
        'gemini-3.8-flash-lite',
        'gemini-2.0-flash',
        'gemini-1.5-flash'
      ]));

      for (const currentModel of candidateModels) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(currentModel)}:generateContent?key=${encodeURIComponent(activeKey)}`;

        try {
          const apiResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
              // Quota exceeded on this key -> switch to next key
              continue outerLoop;
            } else {
              // Model error -> try next candidate model
              continue;
            }
          }

          const candidates = respJson.candidates || [];
          if (!candidates.length) continue;

          const parts = candidates[0]?.content?.parts || [];
          const textParts = parts.filter(p => p.text).map(p => p.text).join(' ');
          if (textParts.trim()) {
            transcriptionText = textParts.trim();
            usedKeyIndex = k;
            usedModel = currentModel;
            break outerLoop;
          }
        } catch (fetchErr) {
          lastError = fetchErr.message;
          continue;
        }
      }
    }

    if (!transcriptionText) {
      return res.status(400).json({
        error: `অডিও ট্রান্সক্রিপশন সম্পন্ন করা যায়নি: ${lastError || 'Gemini কোনো ফলাফল দেয়নি।'}`
      });
    }

    return res.status(200).json({
      success: true,
      transcription: transcriptionText,
      usedKeyIndex: usedKeyIndex + 1,
      totalKeys: keysList.length,
      usedModel: usedModel
    });

  } catch (error) {
    console.error('Transcription API Error:', error);
    return res.status(500).json({ error: 'সার্ভার ত্রুটি: ' + error.message });
  }
}

