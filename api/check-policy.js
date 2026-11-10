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
      "You are an ultra-fast YouTube Community Guidelines & Advertiser-Friendly Monetization Policy Evaluator.\n" +
      "Analyze the text below for policy violations (hate speech, severe profanity/vulgarity, violence, harassment, harmful misinformation, sexual content, advertiser-unfriendly/demonetization risks).\n\n" +
      `Text to check:\n"""${text.trim()}"""\n\n` +
      "Return STRICT JSON only matching this schema:\n" +
      "{\n" +
      '  "safetyScore": 95,\n' +
      '  "status": "clean" | "warning" | "violation",\n' +
      '  "summary": "বাংলায় ১টি সংক্ষিপ্ত বাক্যে সামগ্রিক মূল্যায়ন",\n' +
      '  "violations": [\n' +
      "    {\n" +
      '      "word": "স্ক্রিপ্টে থাকা মূল ঝুঁকিপূর্ণ শব্দটি",\n' +
      '      "category": "গালিগালাজ" | "ঘৃণামূলক বক্তব্য" | "হয়রানি" | "সহিংসতা" | "মনিটাইজেশন ঝুঁকি",\n' +
      '      "severity": "high" | "medium" | "low",\n' +
      '      "reason": "কেন এটি ইউটিউবের পলিসির পরিপন্থী (খুব সংক্ষেপে)",\n' +
      '      "suggestedWord": "নিরাপদ শালীন বিকল্প বাংলা শব্দ"\n' +
      "    }\n" +
      "  ]\n" +
      "}\n" +
      "If no violations found, return violations: [], status: 'clean', safetyScore: 100. Do NOT rewrite the full script. Be extremely fast."
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
        responseMimeType: "application/json",
        temperature: 0.1,
        maxOutputTokens: 1024
      }
    };

    let lastError = '';
    let analysisData = null;
    let usedKeyIndex = 0;
    let usedModel = '';

    const candidateModels = [
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-3.8-flash',
      'gemini-2.0-flash-lite',
      'gemini-1.5-flash-8b'
    ];

    outerLoop:
    for (let k = 0; k < keysList.length; k++) {
      const activeKey = keysList[k];

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

    // Instant safe text generation in-memory
    let safeText = text;
    for (const v of (analysisData.violations || [])) {
      const w = (v.word || '').trim();
      const s = (v.suggestedWord || '').trim();
      if (w && s) {
        safeText = safeText.replaceAll(w, s);
      }
    }
    analysisData.safeCorrectedText = safeText;

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

