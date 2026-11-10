/**
 * Vercel Serverless Function for YouTube Community & Monetization Policy Scanner
 * Handles POST /api/check-policy
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
    const { text, apiKey, apiKeys } = req.body || {};

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
      return res.status(400).json({ error: 'পলিসি চেক করার জন্য কোনো টেক্সট পাওয়া যায়নি।' });
    }

    const prompt = (
      "You are a professional YouTube Community Guidelines & Advertiser-Friendly Monetization Policy Specialist.\n\n" +
      "Carefully analyze the following script for potential YouTube policy violations or demonetization/yellow-dollar risks " +
      "(e.g., hate speech, severe profanity/vulgarity, violence, harassment, harmful misinformation, sexual content, sensitive/controversial tragedy triggers, advertiser-unfriendly terms).\n\n" +
      "Script to evaluate:\n" +
      `"""${text.trim()}"""\n\n` +
      "Return your evaluation strictly in the following JSON schema:\n" +
      "{\n" +
      '  "safetyScore": 85,\n' +
      '  "status": "clean" | "warning" | "violation",\n' +
      '  "summary": "বাংলায় সামগ্রিক পর্যালোচনার বিবরণ (১-২ বাক্য)",\n' +
      '  "violations": [\n' +
      "    {\n" +
      '      "word": "শব্দ বা বাক্য অংশ",\n' +
      '      "category": "গালিগালাজ / অশ্লীল" | "ঘৃণামূলক বক্তব্য (Hate Speech)" | "হয়রানি (Harassment)" | "সহিংসতা (Violence)" | "মনিটাইজেশন ঝুঁকি (Demonetization)" | "ভ্রান্ত তথ্য (Misinformation)",\n' +
      '      "severity": "high" | "medium" | "low",\n' +
      '      "reason": "বাংলায় সহজভাবে কেন এটি ইউটিউবের পলিসির পরিপন্থী",\n' +
      '      "suggestedWord": "শালীন ও নিরাপদ বিকল্প বাংলা শব্দ"\n' +
      "    }\n" +
      "  ],\n" +
      '  "safeCorrectedText": "সম্পূর্ণ টেক্সটের একটি ১০০% ইউটিউব-সেইফ ও শালীন সংস্করণ যেখানে ঝুঁকিপূর্ণ অংশগুলো নিরাপদ বিকল্প দিয়ে ঠিক করা হয়েছে"\n' +
      "}"
    );

    const payload = {
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json"
      }
    };

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
          let rawJsonStr = parts.map(p => p.text || '').join('').trim();
          if (rawJsonStr) {
            rawJsonStr = rawJsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
            analysisData = JSON.parse(rawJsonStr);
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

    if (!analysisData) {
      return res.status(400).json({
        error: `ইউটিউব পলিসি স্ক্যান করা যায়নি: ${lastError || 'Gemini কোনো ফলাফল দেয়নি।'}`
      });
    }

    return res.status(200).json({
      success: true,
      analysis: analysisData,
      usedKeyIndex: usedKeyIndex + 1,
      totalKeys: keysList.length,
      usedModel: usedModel
    });

  } catch (error) {
    console.error('Policy Check API Error:', error);
    return res.status(500).json({ error: 'সার্ভার ত্রুটি: ' + error.message });
  }
}

