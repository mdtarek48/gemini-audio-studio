// Default Pollinations Key for Unlimited Instant Image Generation (No wait time)
const DEFAULT_POLLINATIONS_KEY = 'sk_fizHkhVWIBfi5lXUwBZv1QzEayM5u49H';

function parsePollinationsKeys(raw) {
  return (raw || '').split(/[\n,;]+/).map(k => k.trim()).filter(Boolean);
}

// State Management
const state = {
  apiKey: localStorage.getItem('gemini_api_key') || '',
  pollinationsKey: localStorage.getItem('pollinations_api_keys') || localStorage.getItem('pollinations_api_key') || DEFAULT_POLLINATIONS_KEY,
  pollinationsKeys: parsePollinationsKeys(localStorage.getItem('pollinations_api_keys') || localStorage.getItem('pollinations_api_key') || DEFAULT_POLLINATIONS_KEY),
  currentPollinationsKeyIndex: 0,
  voice: localStorage.getItem('gemini_voice') || 'Kore',
  voiceTone: localStorage.getItem('gemini_voice_tone') || 'Bright, sunny, welcoming morning greeting with a subtle vocal smile and crisp pacing',
  model: localStorage.getItem('gemini_model') || 'gemini-3.8-flash-tts',
  autoPlay: localStorage.getItem('gemini_autoplay') !== 'false',
  chunks: [],
  isGeneratingAll: false
};

// Video Studio State Management
const videoState = {
  scenes: [],
  aspectRatio: '16:9',
  visualStyle: 'cinematic',
  splitMode: 'sentences',
  unitsPerScene: 2,
  voice: localStorage.getItem('gemini_voice') || 'Kore',
  isGeneratingAll: false,
  lastImageGeneratedTimestamp: 0,
  renderedVideoBlob: null,
  renderedVideoExt: 'mp4',
  isRenderingVideo: false
};

// DOM Elements
const elements = {
  apiKeyInput: document.getElementById('apiKeyInput'),
  saveKeyBtn: document.getElementById('saveKeyBtn'),
  keysCountBadge: document.getElementById('keysCountBadge'),
  apiKeyIndicator: document.getElementById('apiKeyIndicator'),
  apiKeyBtnText: document.getElementById('apiKeyBtnText'),
  toggleSettingsBtn: document.getElementById('toggleSettingsBtn'),
  settingsPanel: document.getElementById('settingsPanel'),
  voiceSelect: document.getElementById('voiceSelect'),
  toneSelect: document.getElementById('toneSelect'),
  customToneInput: document.getElementById('customToneInput'),
  modelInput: document.getElementById('modelInput'),
  resetModelBtn: document.getElementById('resetModelBtn'),
  
  mainTextInput: document.getElementById('mainTextInput'),
  splitModeSelect: document.getElementById('splitModeSelect'),
  unitLabel: document.getElementById('unitLabel'),
  linesPerBoxInput: document.getElementById('linesPerBoxInput'),
  ignoreEmptyLines: document.getElementById('ignoreEmptyLines'),
  autoPlayCheckbox: document.getElementById('autoPlayCheckbox'),
  textStats: document.getElementById('textStats'),
  loadDemoBtn: document.getElementById('loadDemoBtn'),
  clearTextBtn: document.getElementById('clearTextBtn'),
  splitBtn: document.getElementById('splitBtn'),
  generateAllBtn: document.getElementById('generateAllBtn'),
  generateAllText: document.getElementById('generateAllText'),
  stopAllBtn: document.getElementById('stopAllBtn'),
  downloadZipBtn: document.getElementById('downloadZipBtn'),
  
  chunksContainer: document.getElementById('chunksContainer'),
  boxCountDisplay: document.getElementById('boxCountDisplay'),
  toastNotification: document.getElementById('toastNotification'),

  // Tab Elements
  tabBtnAudio: document.getElementById('tabBtnAudio'),
  tabBtnVideo: document.getElementById('tabBtnVideo'),
  tabContentAudio: document.getElementById('tabContentAudio'),
  tabContentVideo: document.getElementById('tabContentVideo'),

  // Video Studio Elements
  videoAspectRatio: document.getElementById('videoAspectRatio'),
  videoVisualStyle: document.getElementById('videoVisualStyle'),
  videoVoiceSelect: document.getElementById('videoVoiceSelect'),
  videoUnitsPerScene: document.getElementById('videoUnitsPerScene'),
  videoSplitMode: document.getElementById('videoSplitMode'),
  videoScriptInput: document.getElementById('videoScriptInput'),
  videoTextStats: document.getElementById('videoTextStats'),
  videoLoadDemoBtn: document.getElementById('videoLoadDemoBtn'),
  videoClearTextBtn: document.getElementById('videoClearTextBtn'),
  videoSplitBtn: document.getElementById('videoSplitBtn'),
  videoGenerateAllBothBtn: document.getElementById('videoGenerateAllBothBtn'),
  videoGenerateAllBothText: document.getElementById('videoGenerateAllBothText'),
  videoGenerateAllImageBtn: document.getElementById('videoGenerateAllImageBtn'),
  videoGenerateAllAudioBtn: document.getElementById('videoGenerateAllAudioBtn'),
  videoStopBtn: document.getElementById('videoStopBtn'),
  videoDownloadZipBtn: document.getElementById('videoDownloadZipBtn'),
  videoRenderFullMp4Btn: document.getElementById('videoRenderFullMp4Btn'),
  videoProgressBanner: document.getElementById('videoProgressBanner'),
  videoProgressText: document.getElementById('videoProgressText'),
  videoProgressPercent: document.getElementById('videoProgressPercent'),
  videoProgressBar: document.getElementById('videoProgressBar'),
  videoScenesContainer: document.getElementById('videoScenesContainer'),
  videoSceneCount: document.getElementById('videoSceneCount'),
  videoImageModal: document.getElementById('videoImageModal'),
  videoModalImage: document.getElementById('videoModalImage'),
  videoModalTitle: document.getElementById('videoModalTitle'),
  videoModalDownloadBtn: document.getElementById('videoModalDownloadBtn'),

  // Video Render Modal Elements (Ken Burns Full MP4 Generator)
  videoRenderModal: document.getElementById('videoRenderModal'),
  videoRenderModalCloseBtn: document.getElementById('videoRenderModalCloseBtn'),
  videoRenderProgressBox: document.getElementById('videoRenderProgressBox'),
  videoRenderStatusText: document.getElementById('videoRenderStatusText'),
  videoRenderPercent: document.getElementById('videoRenderPercent'),
  videoRenderProgressBar: document.getElementById('videoRenderProgressBar'),
  videoRenderCanvasWrapper: document.getElementById('videoRenderCanvasWrapper'),
  videoRenderCanvas: document.getElementById('videoRenderCanvas'),
  videoRenderPlayerWrapper: document.getElementById('videoRenderPlayerWrapper'),
  videoRenderPlayer: document.getElementById('videoRenderPlayer'),
  videoRenderDownloadBtn: document.getElementById('videoRenderDownloadBtn'),
  videoRenderCancelBtn: document.getElementById('videoRenderCancelBtn'),

  // Pollinations API Key Elements (Text to Video Tab)
  tabVideoPollinationsKeysInput: document.getElementById('tabVideoPollinationsKeysInput'),
  tabVideoSavePollinationsKeysBtn: document.getElementById('tabVideoSavePollinationsKeysBtn'),
  tabVideoPollinationsKeyBadge: document.getElementById('tabVideoPollinationsKeyBadge')
};

// Initialize
function init() {
  // Automatically migrate from deprecated gemini-2.0-flash to gemini-3.8-flash-tts
  if (!state.model || state.model === 'gemini-2.0-flash') {
    state.model = 'gemini-3.8-flash-tts';
    localStorage.setItem('gemini_model', 'gemini-3.8-flash-tts');
  }

  // Load saved values
  if (state.apiKey) {
    elements.apiKeyInput.value = state.apiKey;
    updateApiKeyStatus(true);
  } else {
    updateApiKeyStatus(false);
  }

  // Load saved Pollinations Keys (Supports multiple keys & auto-switching)
  const savedPollKeys = localStorage.getItem('pollinations_api_keys') || localStorage.getItem('pollinations_api_key');
  if (!savedPollKeys || !savedPollKeys.trim()) {
    state.pollinationsKeys = [DEFAULT_POLLINATIONS_KEY];
    state.pollinationsKey = DEFAULT_POLLINATIONS_KEY;
    localStorage.setItem('pollinations_api_keys', DEFAULT_POLLINATIONS_KEY);
    localStorage.setItem('pollinations_api_key', DEFAULT_POLLINATIONS_KEY);
  } else {
    state.pollinationsKeys = parsePollinationsKeys(savedPollKeys);
    state.pollinationsKey = state.pollinationsKeys.join('\n');
  }

  if (elements.pollinationsKeyInput) {
    elements.pollinationsKeyInput.value = state.pollinationsKey;
  }
  if (elements.tabVideoPollinationsKeysInput) {
    elements.tabVideoPollinationsKeysInput.value = state.pollinationsKey;
  }
  updatePollinationsKeyStatus();

  elements.voiceSelect.value = state.voice;
  elements.modelInput.value = state.model;

  if (elements.toneSelect) {
    const knownValues = Array.from(elements.toneSelect.options).map(o => o.value);
    if (knownValues.includes(state.voiceTone)) {
      elements.toneSelect.value = state.voiceTone;
    } else {
      elements.toneSelect.value = 'custom';
    }
  }
  if (elements.customToneInput) {
    elements.customToneInput.value = state.voiceTone;
  }

  // Event Listeners
  setupEventListeners();

  // YouTube Policy Scanner
  setupPolicyScanner();

  if (elements.mainTextInput && elements.mainTextInput.value.trim()) {
    updateTextStats();
    splitText();
  }

  // Initialize Video Studio
  if (videoState.scenes && videoState.scenes.length > 0) {
    videoState.scenes.forEach(s => {
      if (!s.visualPrompt || /[\u0980-\u09FF]/.test(s.visualPrompt) || s.visualPrompt.startsWith('A cinematic shot depicting:')) {
        s.visualPrompt = translateBengaliSceneToEnglish(s.text, videoState.visualStyle, videoState.aspectRatio);
      }
    });
  }
  renderVideoScenes();
  updateVideoTextStats();

  // Re-render Lucide icons
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function parseKeys(raw) {
  return (raw || '').split(/[\n,;]+/).map(k => k.trim()).filter(Boolean);
}

function updateApiKeyStatus(hasKey) {
  const keys = parseKeys(state.apiKey);
  if (keys.length > 0) {
    elements.apiKeyIndicator.className = 'w-2 h-2 rounded-full bg-teal-400 ring-2 ring-teal-400/20';
    elements.apiKeyBtnText.textContent = `${keys.length}টি Key সক্রিয় 🟢`;
    if (elements.keysCountBadge) {
      elements.keysCountBadge.textContent = `${keys.length}টি একাউন্টের Key সক্রিয় (অটো-সুইচিং)`;
    }
  } else {
    elements.apiKeyIndicator.className = 'w-2 h-2 rounded-full bg-rose-400 animate-pulse';
    elements.apiKeyBtnText.textContent = 'API Key সেট করুন';
    if (elements.keysCountBadge) {
      elements.keysCountBadge.textContent = '০টি Key সক্রিয়';
    }
  }
}

function updatePollinationsKeyStatus() {
  const keys = state.pollinationsKeys && state.pollinationsKeys.length > 0 
    ? state.pollinationsKeys 
    : (state.pollinationsKey ? parsePollinationsKeys(state.pollinationsKey) : []);
  
  const hasKeys = keys.length > 0;
  let badgeText = '';
  if (!hasKeys) {
    badgeText = 'ফ্রি টিয়ার (৪৫ সে. কুলডাউন)';
  } else if (keys.length === 1) {
    badgeText = '১টি Key সক্রিয় (আনলিমিটেড স্পিড 🟢)';
  } else {
    badgeText = `${keys.length}টি Key সক্রিয় (অটো-সুইচিং 🟢)`;
  }

  const badgeClass = hasKeys
    ? 'text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20'
    : 'text-[11px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20';

  if (elements.pollinationsKeyBadge) {
    elements.pollinationsKeyBadge.textContent = badgeText;
    elements.pollinationsKeyBadge.className = badgeClass;
  }
  if (elements.tabVideoPollinationsKeyBadge) {
    elements.tabVideoPollinationsKeyBadge.textContent = badgeText;
    elements.tabVideoPollinationsKeyBadge.className = badgeClass;
  }
}

function getActivePollinationsKey() {
  const keys = state.pollinationsKeys && state.pollinationsKeys.length > 0
    ? state.pollinationsKeys
    : [DEFAULT_POLLINATIONS_KEY];

  if (state.currentPollinationsKeyIndex >= keys.length) {
    state.currentPollinationsKeyIndex = 0;
  }
  return keys[state.currentPollinationsKeyIndex] || DEFAULT_POLLINATIONS_KEY;
}

function rotateToNextPollinationsKey() {
  const keys = state.pollinationsKeys && state.pollinationsKeys.length > 0
    ? state.pollinationsKeys
    : [DEFAULT_POLLINATIONS_KEY];

  if (keys.length <= 1) return false;

  const oldIndex = state.currentPollinationsKeyIndex;
  state.currentPollinationsKeyIndex = (state.currentPollinationsKeyIndex + 1) % keys.length;
  console.log(`[Pollinations Key Switch] Switched from Key #${oldIndex + 1} to Key #${state.currentPollinationsKeyIndex + 1} of ${keys.length}`);
  return true;
}

function savePollinationsKeys(rawText) {
  const keys = parsePollinationsKeys(rawText);
  if (keys.length === 0) {
    state.pollinationsKeys = [];
    state.pollinationsKey = '';
    localStorage.removeItem('pollinations_api_keys');
    localStorage.removeItem('pollinations_api_key');
    if (elements.pollinationsKeyInput) elements.pollinationsKeyInput.value = '';
    if (elements.tabVideoPollinationsKeysInput) elements.tabVideoPollinationsKeysInput.value = '';
    updatePollinationsKeyStatus();
    showToast('Pollinations API Key ক্লিয়ার করা হয়েছে (ফ্রি টায়ার চালু)।', 'info');
    return;
  }

  state.pollinationsKeys = keys;
  state.pollinationsKey = keys.join('\n');
  state.currentPollinationsKeyIndex = 0;
  localStorage.setItem('pollinations_api_keys', state.pollinationsKey);
  localStorage.setItem('pollinations_api_key', keys[0]);

  if (elements.pollinationsKeyInput) elements.pollinationsKeyInput.value = state.pollinationsKey;
  if (elements.tabVideoPollinationsKeysInput) elements.tabVideoPollinationsKeysInput.value = state.pollinationsKey;
  updatePollinationsKeyStatus();

  showToast(`${keys.length}টি Pollinations API Key সংরক্ষিত হয়েছে! একটার কোটা শেষ হলে অন্যটি স্বয়ংক্রিয়ভাবে কাজ করবে।`, 'success');
}

function setupEventListeners() {
  // Tab Navigation (Text to Audio vs Text to Video)
  function switchTab(tab) {
    if (tab === 'audio') {
      if (elements.tabBtnAudio) {
        elements.tabBtnAudio.className = 'tab-btn flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 bg-teal-600 text-white shadow-md shadow-teal-600/25';
      }
      if (elements.tabBtnVideo) {
        elements.tabBtnVideo.className = 'tab-btn flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60';
      }
      if (elements.tabContentAudio) elements.tabContentAudio.classList.remove('hidden');
      if (elements.tabContentVideo) elements.tabContentVideo.classList.add('hidden');
    } else if (tab === 'video') {
      if (elements.tabBtnVideo) {
        elements.tabBtnVideo.className = 'tab-btn flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 bg-teal-600 text-white shadow-md shadow-teal-600/25';
      }
      if (elements.tabBtnAudio) {
        elements.tabBtnAudio.className = 'tab-btn flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60';
      }
      if (elements.tabContentVideo) elements.tabContentVideo.classList.remove('hidden');
      if (elements.tabContentAudio) elements.tabContentAudio.classList.add('hidden');
    }
    if (window.lucide) window.lucide.createIcons();
  }

  window.switchTab = switchTab;

  if (elements.tabBtnAudio) {
    elements.tabBtnAudio.addEventListener('click', () => switchTab('audio'));
  }
  if (elements.tabBtnVideo) {
    elements.tabBtnVideo.addEventListener('click', () => switchTab('video'));
  }

  // Setup Video Studio events
  setupVideoStudioEventListeners();

  // Toggle Settings Panel
  elements.toggleSettingsBtn.addEventListener('click', () => {
    elements.settingsPanel.classList.toggle('hidden');
  });

  // Save API Key
  elements.saveKeyBtn.addEventListener('click', () => {
    const rawInput = elements.apiKeyInput.value.trim();
    const keys = parseKeys(rawInput);
    if (keys.length === 0) {
      showToast('অনুগ্রহ করে অন্তত একটি সঠিক Google AI Studio API Key দিন।', 'error');
      return;
    }
    state.apiKey = rawInput;
    localStorage.setItem('gemini_api_key', rawInput);
    updateApiKeyStatus(true);
    showToast(`${keys.length}টি API Key সংরক্ষিত হয়েছে! একটার কোটা শেষ হলে অন্যটা স্বয়ংক্রিয়ভাবে কাজ করবে।`, 'success');
  });

  // Save Pollinations API Keys (Text to Video Tab)
  if (elements.tabVideoSavePollinationsKeysBtn) {
    elements.tabVideoSavePollinationsKeysBtn.addEventListener('click', () => {
      const raw = elements.tabVideoPollinationsKeysInput ? elements.tabVideoPollinationsKeysInput.value.trim() : '';
      savePollinationsKeys(raw);
    });
  }

  if (elements.autoPlayCheckbox) {
    elements.autoPlayCheckbox.checked = state.autoPlay;
    elements.autoPlayCheckbox.addEventListener('change', (e) => {
      state.autoPlay = e.target.checked;
      localStorage.setItem('gemini_autoplay', state.autoPlay);
      showToast(state.autoPlay ? 'অটো-প্লে চালু করা হয়েছে।' : 'অটো-প্লে বন্ধ করা হয়েছে।', 'info');
    });
  }

  if (elements.stopAllBtn) {
    elements.stopAllBtn.addEventListener('click', handleStopAll);
  }

  // Toggle API Key visibility (if element exists)
  if (elements.toggleKeyVisibility) {
    elements.toggleKeyVisibility.addEventListener('click', () => {
      const isPassword = elements.apiKeyInput.type === 'password';
      elements.apiKeyInput.type = isPassword ? 'text' : 'password';
      if (elements.eyeIcon) elements.eyeIcon.setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
      if (window.lucide) window.lucide.createIcons();
    });
  }

  // Voice change
  if (elements.voiceSelect) {
    elements.voiceSelect.addEventListener('change', (e) => {
      state.voice = e.target.value;
      localStorage.setItem('gemini_voice', state.voice);
      showToast(`ভয়েস পরিবর্তন করে "${state.voice}" করা হয়েছে।`, 'info');
    });
  }

  // Voice Tone change (Human Persona)
  if (elements.toneSelect) {
    elements.toneSelect.addEventListener('change', (e) => {
      const selected = e.target.value;
      if (selected === 'custom') {
        if (elements.customToneInput) {
          elements.customToneInput.focus();
        }
      } else {
        state.voiceTone = selected;
        if (elements.customToneInput) {
          elements.customToneInput.value = selected;
        }
        localStorage.setItem('gemini_voice_tone', state.voiceTone);
        showToast('মানুষের মতো প্রাণবন্ত বাচনভঙ্গি ও টোন সেট করা হয়েছে!', 'success');
      }
    });
  }

  if (elements.customToneInput) {
    elements.customToneInput.addEventListener('input', (e) => {
      state.voiceTone = e.target.value.trim() || 'Bright, sunny, welcoming morning greeting with a subtle vocal smile and crisp pacing';
      localStorage.setItem('gemini_voice_tone', state.voiceTone);
    });
  }

  // Model change
  if (elements.modelInput) {
    elements.modelInput.addEventListener('change', (e) => {
      state.model = e.target.value.trim() || 'gemini-3.8-flash-tts';
      localStorage.setItem('gemini_model', state.model);
    });
  }

  if (elements.resetModelBtn) {
    elements.resetModelBtn.addEventListener('click', () => {
      state.model = 'gemini-3.8-flash-tts';
      elements.modelInput.value = 'gemini-3.8-flash-tts';
      localStorage.setItem('gemini_model', 'gemini-3.8-flash-tts');
      showToast('মডেল রিসেট হয়ে gemini-3.8-flash-tts হয়েছে।', 'info');
    });
  }

  // Main text input events (Instant split on input, paste, and change)
  let splitDebounceTimer = null;
  if (elements.mainTextInput) {
    const triggerInstantSplit = () => {
      updateTextStats();
      clearTimeout(splitDebounceTimer);
      splitDebounceTimer = setTimeout(() => {
        splitText();
      }, 200);
    };

    elements.mainTextInput.addEventListener('input', triggerInstantSplit);
    elements.mainTextInput.addEventListener('change', triggerInstantSplit);
    elements.mainTextInput.addEventListener('paste', () => {
      setTimeout(() => {
        updateTextStats();
        splitText();
      }, 50);
    });
  }

  if (elements.linesPerBoxInput) {
    elements.linesPerBoxInput.addEventListener('input', () => splitText());
    elements.linesPerBoxInput.addEventListener('change', () => splitText());
  }

  if (elements.splitModeSelect) {
    elements.splitModeSelect.addEventListener('change', (e) => {
      const mode = e.target.value;
      if (mode === 'sentences') {
        if (elements.unitLabel) elements.unitLabel.textContent = 'প্রতি বক্সে বাক্যের সংখ্যা:';
        elements.linesPerBoxInput.value = 10;
      } else if (mode === 'lines') {
        if (elements.unitLabel) elements.unitLabel.textContent = 'প্রতি বক্সে লাইনের সংখ্যা:';
        elements.linesPerBoxInput.value = 10;
      } else if (mode === 'words') {
        if (elements.unitLabel) elements.unitLabel.textContent = 'প্রতি বক্সে শব্দের সংখ্যা:';
        elements.linesPerBoxInput.value = 100;
      }
      splitText();
    });
  }

  elements.ignoreEmptyLines.addEventListener('change', () => {
    splitText();
  });

  elements.splitBtn.addEventListener('click', () => {
    splitText();
    showToast('টেক্সট সফলভাবে ভাগ করা হয়েছে!', 'info');
  });

  // Load Demo Text
  elements.loadDemoBtn.addEventListener('click', () => {
    elements.mainTextInput.value = getDemoText();
    updateTextStats();
    splitText();
    showToast('ডেমো টেক্সট লোড করা হয়েছে!', 'success');
  });

  // Clear Text
  elements.clearTextBtn.addEventListener('click', () => {
    elements.mainTextInput.value = '';
    updateTextStats();
    state.chunks = [];
    renderChunks();
    showToast('টেক্সট ক্লিয়ার করা হয়েছে।', 'info');
  });

  // Generate All
  elements.generateAllBtn.addEventListener('click', handleGenerateAll);

  // Download All ZIP
  elements.downloadZipBtn.addEventListener('click', handleDownloadZip);
}

function extractSentences(text) {
  if (!text) return [];
  // Regex to split by Bengali Dari (।), ?, !, newlines, or period with space/end
  const rawParts = text.split(/([।?!\n]+|\.(?:\s+|$))/);
  const sentences = [];
  for (let i = 0; i < rawParts.length; i += 2) {
    const sent = (rawParts[i] || '').trim();
    let delim = (rawParts[i + 1] || '').trim();
    if (delim === '.') delim = '.';
    if (sent) {
      sentences.push(sent + (delim ? delim : ''));
    }
  }

  const cleaned = sentences.filter(s => s.trim().length > 0);

  // If no punctuation found, but text is long, fallback to ~15 words per unit
  if (cleaned.length <= 1 && text.length > 80) {
    const rawLines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (rawLines.length > 1) {
      return rawLines;
    }
    const words = text.split(/\s+/).filter(Boolean);
    const wordUnits = [];
    for (let w = 0; w < words.length; w += 12) {
      wordUnits.push(words.slice(w, w + 12).join(' '));
    }
    return wordUnits.length > 0 ? wordUnits : [text];
  }

  return cleaned;
}

function updateTextStats() {
  const text = elements.mainTextInput ? elements.mainTextInput.value : '';
  const charCount = text.length;
  const sentences = extractSentences(text);
  const paragraphs = text.split('\n').filter(l => l.trim().length > 0).length;
  if (elements.textStats) {
    elements.textStats.textContent = `${charCount} অক্ষর | ${sentences.length} বাক্য | ${paragraphs} প্যারাগ্রাফ`;
  }
}

function splitText() {
  const rawText = elements.mainTextInput ? elements.mainTextInput.value : '';
  if (!rawText || !rawText.trim()) {
    state.chunks = [];
    renderChunks();
    return;
  }

  const mode = elements.splitModeSelect ? elements.splitModeSelect.value : 'sentences';
  const countPerBox = Math.max(1, parseInt(elements.linesPerBoxInput ? elements.linesPerBoxInput.value : 10, 10) || 10);
  const ignoreEmpty = elements.ignoreEmptyLines ? elements.ignoreEmptyLines.checked : true;

  let units = [];
  let unitName = 'বাক্য';

  if (mode === 'sentences') {
    units = extractSentences(rawText);
    unitName = 'বাক্য';
  } else if (mode === 'words') {
    units = rawText.split(/\s+/).filter(Boolean);
    unitName = 'শব্দ';
  } else {
    // lines mode
    units = rawText.split('\n');
    if (ignoreEmpty) {
      units = units.map(l => l.trim()).filter(Boolean);
    }
    unitName = 'লাইন';
  }

  // Fallback if units is somehow only 1 huge block
  if (units.length <= 1 && rawText.length > 100) {
    const words = rawText.split(/\s+/).filter(Boolean);
    units = [];
    for (let w = 0; w < words.length; w += 15) {
      units.push(words.slice(w, w + 15).join(' '));
    }
    unitName = 'অংশ';
  }

  const chunks = [];
  let chunkIndex = 1;

  for (let i = 0; i < units.length; i += countPerBox) {
    const chunkUnits = units.slice(i, i + countPerBox);
    const startNum = i + 1;
    const endNum = Math.min(i + countPerBox, units.length);

    let chunkText = '';
    if (mode === 'words') {
      chunkText = chunkUnits.join(' ');
    } else {
      chunkText = chunkUnits.join('\n');
    }

    // Keep existing audio if text hasn't changed
    const existing = state.chunks[chunkIndex - 1];

    if (existing && existing.text === chunkText && existing.audioBlob) {
      chunks.push({
        ...existing,
        id: chunkIndex,
        startLine: startNum,
        endLine: endNum,
        unitName: unitName,
        unitCount: chunkUnits.length
      });
    } else {
      chunks.push({
        id: chunkIndex,
        startLine: startNum,
        endLine: endNum,
        unitName: unitName,
        unitCount: chunkUnits.length,
        text: chunkText,
        status: 'idle',
        audioBlob: null,
        audioUrl: null,
        errorMessage: ''
      });
    }
    chunkIndex++;
  }

  state.chunks = chunks;
  renderChunks();
  updateZipButtonState();
}

function renderChunks() {
  elements.boxCountDisplay.textContent = state.chunks.length;

  if (state.chunks.length === 0) {
    elements.chunksContainer.innerHTML = `
      <div id="emptyState" class="bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl p-12 text-center space-y-3">
        <div class="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
          <i data-lucide="text-quote" class="w-6 h-6"></i>
        </div>
        <h4 class="text-sm font-medium text-slate-300">কোনো টেক্সট ইনপুট করা হয়নি</h4>
        <p class="text-xs text-slate-500 max-w-sm mx-auto">উপরের বক্সে আপনার টেক্সট পেস্ট করুন অথবা "ডেমো টেক্সট দেখুন" বাটনে ক্লিক করে পরীক্ষা করুন।</p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  elements.chunksContainer.innerHTML = state.chunks.map(chunk => `
    <div id="card-${chunk.id}" class="chunk-card bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
      
      <!-- Card Header -->
      <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div class="flex items-center gap-2.5">
          <span class="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center text-xs font-bold font-mono">
            #${chunk.id}
          </span>
          <span class="text-xs font-semibold text-slate-200">
            বক্স ${chunk.id} (${chunk.unitName || 'বাক্য'} ${chunk.startLine} - ${chunk.endLine})
          </span>
          <span class="text-[11px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full">
            ${chunk.unitCount || chunk.text.split('\n').length} ${chunk.unitName || 'বাক্য'} • ${chunk.text.length} অক্ষর
          </span>
        </div>

        <div class="flex items-center gap-2">
          ${renderStatusBadge(chunk.status)}
        </div>
      </div>

      <!-- Content Grid: Text Area on Left, Controls on Right -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        <!-- Editable Text Box (Left) -->
        <div class="lg:col-span-7">
          <label class="block text-[11px] font-medium text-slate-400 mb-1.5 flex items-center justify-between">
            <span>বক্সের টেক্সট (প্রয়োজনে এডিট করতে পারেন):</span>
            <span class="text-slate-500 text-[10px]">${chunk.unitCount || 10} ${chunk.unitName || 'বাক্য'}</span>
          </label>
          <textarea id="chunk-text-${chunk.id}" rows="5" 
            class="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 outline-none transition leading-relaxed resize-y font-normal"
            onchange="handleChunkTextChange(${chunk.id}, this.value)">${escapeHtml(chunk.text)}</textarea>
          ${chunk.errorMessage ? `<p class="text-[11px] text-rose-400 mt-1">${escapeHtml(chunk.errorMessage)}</p>` : ''}
        </div>

        <!-- Action & Audio Controls (Right) -->
        <div class="lg:col-span-5 bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between space-y-4">
          
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <i data-lucide="headphones" class="w-3.5 h-3.5 text-teal-400"></i>
                অডিও প্লেয়ার
              </span>
              ${chunk.status === 'generating' ? `
                <div class="flex items-center gap-1">
                  <span class="wave-bar"></span>
                  <span class="wave-bar"></span>
                  <span class="wave-bar"></span>
                  <span class="wave-bar"></span>
                </div>
              ` : ''}
            </div>

            <!-- HTML5 Audio Element & Controls -->
            ${chunk.audioUrl ? `
              <div class="space-y-2">
                <audio id="audio-player-${chunk.id}" controls class="w-full" src="${chunk.audioUrl}"></audio>
                <div class="flex items-center justify-between gap-1 text-[11px] pt-1">
                  <button onclick="playChunkAudio(${chunk.id})" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-teal-300 rounded flex items-center gap-1 border border-slate-700/60">
                    <i data-lucide="play" class="w-3 h-3 fill-current"></i> প্লে
                  </button>
                  <button onclick="pauseChunkAudio(${chunk.id})" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded flex items-center gap-1 border border-slate-700/60">
                    <i data-lucide="pause" class="w-3 h-3 fill-current"></i> পজ
                  </button>
                  <button onclick="stopChunkAudio(${chunk.id})" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-rose-300 rounded flex items-center gap-1 border border-slate-700/60">
                    <i data-lucide="square" class="w-3 h-3 fill-current"></i> অডিও স্টপ
                  </button>
                </div>
              </div>
            ` : `
              <div class="h-10 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-center text-xs text-slate-500 gap-2">
                <i data-lucide="volume-x" class="w-4 h-4"></i>
                অডিও এখনও তৈরি করা হয়নি
              </div>
            `}
          </div>

          <!-- Buttons -->
          <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/60">
            <!-- Generate or Stop Button -->
            ${chunk.status === 'generating' ? `
              <button onclick="stopSingleChunk(${chunk.id})" 
                class="w-full py-2.5 px-3 bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs rounded-lg transition flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/30 animate-pulse">
                <i data-lucide="square" class="w-3.5 h-3.5 fill-current"></i>
                <span>জেনারেশন স্টপ</span>
              </button>
            ` : `
              <button onclick="generateSingleChunk(${chunk.id})" 
                class="w-full py-2.5 px-3 bg-teal-600 hover:bg-teal-500 text-white font-medium text-xs rounded-lg transition flex items-center justify-center gap-1.5 shadow-md shadow-teal-600/10">
                <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
                <span>${chunk.audioBlob ? 'পুনরায় জেনারেট' : 'অডিও জেনারেট'}</span>
              </button>
            `}

            <!-- Download Button -->
            <button onclick="downloadSingleChunk(${chunk.id})" 
              ${!chunk.audioBlob ? 'disabled' : ''}
              class="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 hover:text-white border border-slate-700 font-medium text-xs rounded-lg transition flex items-center justify-center gap-1.5">
              <i data-lucide="download" class="w-3.5 h-3.5 text-teal-400"></i>
              <span>ডাউনলোড</span>
            </button>
          </div>

        </div>

      </div>

    </div>
  `).join('');

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function renderStatusBadge(status) {
  switch (status) {
    case 'generating':
      return `
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i> অডিও তৈরি হচ্ছে
        </span>
      `;
    case 'ready':
      return `
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <i data-lucide="check-circle-2" class="w-3 h-3"></i> সম্পন্ন
        </span>
      `;
    case 'error':
      return `
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <i data-lucide="alert-circle" class="w-3 h-3"></i> ত্রুটি
        </span>
      `;
    default:
      return `
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
          <i data-lucide="clock" class="w-3 h-3"></i> অপেক্ষারত
        </span>
      `;
  }
}

window.handleChunkTextChange = function(chunkId, newText) {
  const chunk = state.chunks.find(c => c.id === chunkId);
  if (chunk) {
    chunk.text = newText;
    chunk.status = 'idle';
    chunk.audioBlob = null;
    chunk.audioUrl = null;
    renderChunks();
    updateZipButtonState();
  }
};

window.generateSingleChunk = async function(chunkId) {
  if (!state.apiKey) {
    elements.settingsPanel.classList.remove('hidden');
    elements.apiKeyInput.focus();
    showToast('অডিও তৈরি করতে আপনার Google AI Studio API Key প্রদান করুন।', 'error');
    return;
  }

  const chunk = state.chunks.find(c => c.id === chunkId);
  if (!chunk || !chunk.text.trim()) {
    showToast('বক্সের টেক্সট খালি!', 'error');
    return;
  }

  // Create AbortController to allow canceling this generation
  const controller = new AbortController();
  chunk.abortController = controller;
  chunk.status = 'generating';
  chunk.errorMessage = '';
  renderChunks();

  try {
    const isFirebase = window.location.hostname.includes('web.app') || window.location.hostname.includes('firebaseapp.com');
    const apiEndpoint = isFirebase 
      ? 'https://gemini-audio-studio-seven.vercel.app/api/generate-audio' 
      : '/api/generate-audio';

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        apiKey: state.apiKey,
        apiKeys: parseKeys(state.apiKey),
        text: chunk.text,
        voice: state.voice,
        model: state.model,
        tone: state.voiceTone
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'অডিও জেনারেশন ব্যর্থ হয়েছে।');
    }

    // Convert base64 to Blob
    const binaryStr = atob(data.audioBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const blob = new Blob([bytes], { type: data.mimeType || 'audio/wav' });
    chunk.audioBlob = blob;
    chunk.audioUrl = URL.createObjectURL(blob);
    chunk.status = 'ready';

    if (data.usedKeyIndex > 1) {
      showToast(`বক্স #${chunk.id}: ১ম কী-এর কোটা শেষ হওয়ায় #${data.usedKeyIndex} নং একাউন্ট দিয়ে তৈরি হয়েছে!`, 'success');
    } else {
      showToast(`বক্স #${chunk.id}-এর অডিও সফলভাবে তৈরি হয়েছে!`, 'success');
    }

    // Auto-play audio if enabled
    if (state.autoPlay) {
      setTimeout(() => {
        const player = document.getElementById(`audio-player-${chunk.id}`);
        if (player) {
          player.play().catch(e => console.log('Autoplay deferred:', e));
        }
      }, 300);
    }

  } catch (error) {
    if (error.name === 'AbortError') {
      chunk.status = 'idle';
      chunk.errorMessage = 'জেনারেশন থামানো হয়েছে।';
      return;
    }
    console.error('TTS Error:', error);
    chunk.status = 'error';
    chunk.errorMessage = error.message;
    showToast(`বক্স #${chunk.id} ত্রুটি: ${error.message}`, 'error');
  } finally {
    chunk.abortController = null;
    renderChunks();
    updateZipButtonState();
  }
};

window.stopSingleChunk = function(chunkId) {
  const chunk = state.chunks.find(c => c.id === chunkId);
  if (chunk) {
    if (chunk.abortController) {
      chunk.abortController.abort();
      chunk.abortController = null;
    }
    chunk.status = 'idle';
    chunk.errorMessage = 'জেনারেশন থামানো হয়েছে।';
    renderChunks();
    showToast(`বক্স #${chunk.id}-এর অডিও জেনারেশন থামানো হয়েছে।`, 'info');
  }
};

window.playChunkAudio = function(chunkId) {
  const player = document.getElementById(`audio-player-${chunkId}`);
  if (player) player.play();
};

window.pauseChunkAudio = function(chunkId) {
  const player = document.getElementById(`audio-player-${chunkId}`);
  if (player) player.pause();
};

window.stopChunkAudio = function(chunkId) {
  const player = document.getElementById(`audio-player-${chunkId}`);
  if (player) {
    player.pause();
    player.currentTime = 0;
  }
};

window.downloadSingleChunk = function(chunkId) {
  const chunk = state.chunks.find(c => c.id === chunkId);
  if (!chunk || !chunk.audioBlob) return;

  const a = document.createElement('a');
  a.href = chunk.audioUrl;
  a.download = `audio_box_${chunk.id}.wav`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast(`audio_box_${chunk.id}.wav ডাউনলোড শুরু হয়েছে।`, 'info');
};

async function handleGenerateAll() {
  if (state.isGeneratingAll) return;

  if (!state.apiKey) {
    elements.settingsPanel.classList.remove('hidden');
    elements.apiKeyInput.focus();
    showToast('প্রথমে আপনার Google AI Studio API Key দিন।', 'error');
    return;
  }

  if (state.chunks.length === 0) {
    showToast('কোনো বক্স তৈরি নেই!', 'error');
    return;
  }

  state.isGeneratingAll = true;
  elements.generateAllBtn.disabled = true;
  elements.generateAllText.textContent = 'প্রসেসিং হচ্ছে...';
  if (elements.stopAllBtn) elements.stopAllBtn.classList.remove('hidden');

  try {
    for (let i = 0; i < state.chunks.length; i++) {
      if (!state.isGeneratingAll) break;
      const chunk = state.chunks[i];
      if (chunk.status === 'ready' && chunk.audioBlob) {
        continue; // Skip already generated
      }
      elements.generateAllText.textContent = `জেনারেট হচ্ছে (${i + 1}/${state.chunks.length})...`;
      await window.generateSingleChunk(chunk.id);
      
      if (!state.isGeneratingAll) break;

      // Small pause to stay well within Gemini 15 RPM free tier limits
      await new Promise(r => setTimeout(r, 1500));
    }
    if (state.isGeneratingAll) {
      showToast('সবগুলো বক্সের অডিও তৈরি সম্পন্ন হয়েছে!', 'success');
    }
  } catch (err) {
    showToast('জেনারেটের মাঝে কোনো ত্রুটি হয়েছে।', 'error');
  } finally {
    state.isGeneratingAll = false;
    elements.generateAllBtn.disabled = false;
    elements.generateAllText.textContent = 'সবগুলো একসাথে জেনারেট';
    if (elements.stopAllBtn) elements.stopAllBtn.classList.add('hidden');
  }
}

function handleStopAll() {
  state.isGeneratingAll = false;
  state.chunks.forEach(chunk => {
    if (chunk.abortController) {
      chunk.abortController.abort();
      chunk.abortController = null;
    }
    if (chunk.status === 'generating') {
      chunk.status = 'idle';
      chunk.errorMessage = 'জেনারেশন থামানো হয়েছে।';
    }
  });
  if (elements.stopAllBtn) elements.stopAllBtn.classList.add('hidden');
  elements.generateAllBtn.disabled = false;
  elements.generateAllText.textContent = 'সবগুলো একসাথে জেনারেট';
  renderChunks();
  showToast('সবগুলো অডিও জেনারেশন থামানো হয়েছে।', 'info');
}

async function handleDownloadZip() {
  const generatedChunks = state.chunks.filter(c => c.audioBlob);
  if (generatedChunks.length === 0) {
    showToast('ডাউনলোড করার মতো কোনো অডিও পাওয়া যায়নি।', 'error');
    return;
  }

  if (!window.JSZip) {
    showToast('ZIP লাইব্রেরি লোড হচ্ছে, অনুগ্রহ করে একটু অপেক্ষা করুন...', 'info');
    return;
  }

  showToast('ZIP ফাইল তৈরি করা হচ্ছে...', 'info');
  const zip = new JSZip();

  generatedChunks.forEach(chunk => {
    zip.file(`box_${chunk.id}_lines_${chunk.startLine}-${chunk.endLine}.wav`, chunk.audioBlob);
  });

  const zipContent = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(zipContent);
  a.download = `gemini_audio_boxes_${Date.now()}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('সম্পূর্ণ ZIP ফাইল ডাউনলোড শুরু হয়েছে!', 'success');
}

function updateZipButtonState() {
  const hasAudios = state.chunks.some(c => c.audioBlob);
  elements.downloadZipBtn.disabled = !hasAudios;
}

function showToast(message, type = 'info') {
  const toast = elements.toastNotification;
  toast.classList.remove('hidden', 'bg-emerald-950/80', 'text-emerald-200', 'border-emerald-800', 
    'bg-rose-950/80', 'text-rose-200', 'border-rose-800', 
    'bg-slate-900', 'text-slate-200', 'border-slate-800');

  let iconName = 'info';
  if (type === 'success') {
    toast.classList.add('bg-emerald-950/80', 'text-emerald-200', 'border-emerald-800');
    iconName = 'check-circle-2';
  } else if (type === 'error') {
    toast.classList.add('bg-rose-950/80', 'text-rose-200', 'border-rose-800');
    iconName = 'alert-circle';
  } else {
    toast.classList.add('bg-slate-900', 'text-slate-200', 'border-slate-800');
    iconName = 'info';
  }

  toast.innerHTML = `
    <div class="flex items-center gap-2">
      <i data-lucide="${iconName}" class="w-4 h-4 flex-shrink-0"></i>
      <span>${escapeHtml(message)}</span>
    </div>
    <button onclick="elements.toastNotification.classList.add('hidden')" class="p-1 hover:opacity-80">
      <i data-lucide="x" class="w-3.5 h-3.5"></i>
    </button>
  `;

  if (window.lucide) window.lucide.createIcons();

  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.classList.add('hidden');
  }, 5000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getDemoText() {
  return `একদা এক সুন্দর সকালে এক ছোট্ট নদীর তীরে একটি শান্ত গ্রাম ছিল।
সেই গ্রামের মানুষজন একে অপরকে খুব ভালোবাসতেন এবং মিলেমিশে বসবাস করতেন।
গ্রামের মাঝখানে ছিল বিশাল একটি বটগাছ, যার ছায়ায় ক্লান্ত পথিকরা বিশ্রাম নিতেন।
পাখিদের মিষ্টি কিচিরমিচির শব্দে প্রতিদিন সকালে সবার ঘুম ভাঙত।
গ্রামের কৃষকরা মাঠে সোনার ফসল ফলাতেন আর দিনশেষে ঘরে ফিরতেন।
ছোট্ট শিশুরা নদীর পাড়ে মনের আনন্দে ছোটাছুটি করত আর খেলাধুলা করত।
নদীতে জেলেরা নৌকা নিয়ে মাছ ধরতেন এবং ভাটিয়ালি গান গাইতেন।
সন্ধ্যা নামলেই গ্রামের প্রতিটি ঘরে মাটির প্রদীপ বা কুপি জ্বলে উঠত।
দাদী-নানীরা ছোটদের নিয়ে উঠোনে বসে রূপকথার সুন্দর সব গল্প শোনাতেন।
সেই শান্তির জনপদে কোনো ধরনের অশান্তি বা হিংসা-বিদ্বেষের স্থান ছিল না।
সময়ের আবর্তে সেই গ্রামেও ধীরে ধীরে আধুনিকতার ছোঁয়া লাগতে শুরু করল।
গ্রামের মেঠোপথগুলো পাকা রাস্তায় রূপ নিল এবং বিদ্যুৎ পৌঁছে গেল ঘরে ঘরে।
নতুন বিদ্যালয় প্রতিষ্ঠিত হলো এবং গ্রামের ছেলেমেয়েরা লেখাপড়ায় এগিয়ে গেল।
তবুও গ্রামের মানুষ তাদের শিকড় এবং ঐতিহ্যকে কখনো ভুলে যাননি।
সবাই উৎসব ও আনন্দে আগের মতোই একে অপরের পাশে এসে দাঁড়াতেন।
নবান্নের উৎসবে ঘরে ঘরে পিঠাপুলির সুবাসে চারপাশ মৌ মৌ করত।
বর্ষাকালে যখন বৃষ্টি নামত, কদম ফুলগুলো তাদের মিষ্টি সুবাস ছড়িয়ে দিত।
শীতের সকালে খেজুরের রস আর ধোঁয়া ওঠা ভাপা পিঠার স্বাদ ছিল অতুলনীয়।
প্রকৃতির এমন স্নিগ্ধ রূপ মানুষকে সব ক্লান্তি ভুলিয়ে নতুন করে বাঁচতে শেখায়।
ভালোবাসা ও সম্প্রীতিই হলো মানুষের জীবনের সবচেয়ে বড় শক্তি ও সম্পদ।`;
}

// ==========================================
// YouTube Policy & Monetization Scanner Module
// ==========================================

let scannerPolicyAnalysis = null;
let currentPolicyScannedText = '';

function setupPolicyScanner() {
  const toggleBtn = document.getElementById('toggleAudioScannerBtn');
  const toggleText = document.getElementById('toggleScannerText');
  const chevronIcon = document.getElementById('scannerChevronIcon');
  const content = document.getElementById('audioScannerContent');

  const policyTextInput = document.getElementById('policyTextInput');
  const pullFromMainBtn = document.getElementById('pullFromMainBtn');
  const clearPolicyTextBtn = document.getElementById('clearPolicyTextBtn');
  const startPolicyCheckBtn = document.getElementById('startPolicyCheckBtn');

  const loadingState = document.getElementById('scannerLoadingState');
  const loadingText = document.getElementById('scannerLoadingText');

  const policyResultsSection = document.getElementById('policyResultsSection');
  const applyAutoFixBtn = document.getElementById('applyAutoFixBtn');
  const sendToMainBoxBtn = document.getElementById('sendToMainBoxBtn');
  const copyTranscribedBtn = document.getElementById('copyTranscribedBtn');
  const copySafeBtn = document.getElementById('copySafeBtn');
  const safeTextEditor = document.getElementById('safeTextEditor');
  const checkMainTextPolicyBtn = document.getElementById('checkMainTextPolicyBtn');

  if (!toggleBtn) return;

  // Toggle Collapse
  toggleBtn.addEventListener('click', () => {
    const isHidden = content.classList.toggle('hidden');
    toggleText.textContent = isHidden ? 'প্যানেলটি দেখান' : 'প্যানেলটি লুকান';
    if (chevronIcon) {
      chevronIcon.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
    }
  });

  // Pull Text from Main Box
  if (pullFromMainBtn && policyTextInput) {
    pullFromMainBtn.addEventListener('click', () => {
      const mainText = elements.mainTextInput ? elements.mainTextInput.value.trim() : '';
      if (!mainText) {
        showToast('মূল টেক্সট বক্সে কোনো লেখা নেই! প্রথমে কিছু লিখুন।', 'info');
        if (elements.mainTextInput) elements.mainTextInput.focus();
        return;
      }
      policyTextInput.value = mainText;
      showToast('মূল বক্স থেকে লেখা পলিসি স্ক্যানারে আনা হয়েছে!', 'success');
    });
  }

  // Clear Policy Text
  if (clearPolicyTextBtn && policyTextInput) {
    clearPolicyTextBtn.addEventListener('click', () => {
      policyTextInput.value = '';
      if (policyResultsSection) policyResultsSection.classList.add('hidden');
      scannerPolicyAnalysis = null;
      currentPolicyScannedText = '';
      policyTextInput.focus();
    });
  }

  // Check Main Text Policy Button (placed beside the main text box)
  if (checkMainTextPolicyBtn) {
    checkMainTextPolicyBtn.addEventListener('click', () => {
      const text = elements.mainTextInput ? elements.mainTextInput.value.trim() : '';
      if (!text) {
        showToast('প্রথমে মূল টেক্সট বক্সে কিছু লিখুন বা পেস্ট করুন।', 'error');
        if (elements.mainTextInput) elements.mainTextInput.focus();
        return;
      }
      // Expand panel if hidden
      if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        toggleText.textContent = 'প্যানেলটি লুকান';
        if (chevronIcon) chevronIcon.style.transform = 'rotate(0deg)';
      }
      if (policyTextInput) {
        policyTextInput.value = text;
      }
      const scannerSection = document.getElementById('youtubePolicySection');
      if (scannerSection) {
        scannerSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      executePolicyCheck(text);
    });
  }

  // Start Policy Check Button (inside the scanner panel)
  if (startPolicyCheckBtn) {
    startPolicyCheckBtn.addEventListener('click', () => {
      let text = policyTextInput ? policyTextInput.value.trim() : '';
      // If policy box is empty, check if main box has text
      if (!text && elements.mainTextInput && elements.mainTextInput.value.trim()) {
        text = elements.mainTextInput.value.trim();
        if (policyTextInput) policyTextInput.value = text;
      }

      if (!text) {
        showToast('অনুগ্রহ করে পলিসি চেক করার জন্য কোনো টেক্সট বা স্ক্রিপ্ট লিখুন।', 'error');
        if (policyTextInput) policyTextInput.focus();
        return;
      }

      executePolicyCheck(text);
    });
  }

  async function executePolicyCheck(textToAnalyze) {
    // Auto-capture API key if entered in input box but not saved
    if (!state.apiKey && elements.apiKeyInput && elements.apiKeyInput.value.trim()) {
      state.apiKey = elements.apiKeyInput.value.trim();
      localStorage.setItem('gemini_api_key', state.apiKey);
      updateApiKeyStatus(true);
    }

    if (!state.apiKey) {
      elements.settingsPanel.classList.remove('hidden');
      elements.apiKeyInput.focus();
      showToast('ইউটিউব পলিসি স্ক্যান করতে Google AI Studio API Key দিন।', 'error');
      return;
    }

    if (loadingState) loadingState.classList.remove('hidden');
    if (policyResultsSection) policyResultsSection.classList.add('hidden');
    if (loadingText) loadingText.textContent = 'ইউটিউব কমিউনিটি ও মনিটাইজেশন পলিসি স্ক্যান হচ্ছে...';
    if (startPolicyCheckBtn) startPolicyCheckBtn.disabled = true;

    try {
      const isFirebase = window.location.hostname.includes('web.app') || window.location.hostname.includes('firebaseapp.com');
      const policyUrl = isFirebase 
        ? 'https://gemini-audio-studio-seven.vercel.app/api/check-policy' 
        : (window.location.protocol === 'file:' || window.location.port === '5500' || window.location.port === '5501')
          ? 'http://localhost:5000/api/check-policy'
          : '/api/check-policy';

      const resp = await fetch(policyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToAnalyze,
          apiKey: state.apiKey,
          apiKeys: parseKeys(state.apiKey)
        })
      });

      const textResp = await resp.text();
      let data;
      try {
        data = JSON.parse(textResp);
      } catch (jsonErr) {
        throw new Error(textResp || `সার্ভার ত্রুটি (${resp.status})`);
      }

      if (!resp.ok || !data.success || !data.analysis) {
        throw new Error(data.error || 'ইউটিউব পলিসি স্ক্যান সম্পন্ন করা যায়নি।');
      }

      scannerPolicyAnalysis = data.analysis;
      currentPolicyScannedText = textToAnalyze;
      renderPolicyResults(data.analysis, textToAnalyze);
      showToast('ইউটিউব পলিসি স্ক্যান সম্পন্ন হয়েছে!', 'success');

    } catch (err) {
      console.error('Policy Check Error:', err);
      showToast('পলিসি স্ক্যানে সমস্যা হয়েছে: ' + err.message, 'error');
    } finally {
      if (loadingState) loadingState.classList.add('hidden');
      if (startPolicyCheckBtn) startPolicyCheckBtn.disabled = false;
    }
  }

  function renderPolicyResults(analysis, originalText) {
    if (policyResultsSection) policyResultsSection.classList.remove('hidden');
    const safetyScoreCircle = document.getElementById('safetyScoreCircle');
    const safetyScoreTitle = document.getElementById('safetyScoreTitle');
    const safetyStatusBadge = document.getElementById('safetyStatusBadge');
    const safetyScoreSummary = document.getElementById('safetyScoreSummary');
    const violationsCard = document.getElementById('violationsCard');
    const violationsCount = document.getElementById('violationsCount');
    const violationsListContainer = document.getElementById('violationsListContainer');
    const highlightedTextView = document.getElementById('highlightedTextView');

    const score = typeof analysis.safetyScore === 'number' ? analysis.safetyScore : 100;
    if (safetyScoreCircle) safetyScoreCircle.textContent = score + '%';

    if (safetyScoreCircle && safetyStatusBadge) {
      if (score >= 90) {
        safetyScoreCircle.className = 'w-13 h-13 rounded-xl flex items-center justify-center font-black text-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30';
        safetyStatusBadge.className = 'text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-semibold';
        safetyStatusBadge.textContent = 'নিরাপদ (Clean)';
      } else if (score >= 70) {
        safetyScoreCircle.className = 'w-13 h-13 rounded-xl flex items-center justify-center font-black text-lg bg-amber-500/10 text-amber-400 border border-amber-500/30';
        safetyStatusBadge.className = 'text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-semibold';
        safetyStatusBadge.textContent = 'সতর্কতা (Warning)';
      } else {
        safetyScoreCircle.className = 'w-13 h-13 rounded-xl flex items-center justify-center font-black text-lg bg-rose-500/10 text-rose-400 border border-rose-500/30';
        safetyStatusBadge.className = 'text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-full font-semibold';
        safetyStatusBadge.textContent = 'পলিসি লঙ্ঘন (Violation)';
      }
    }

    if (safetyScoreSummary) safetyScoreSummary.textContent = analysis.summary || 'পলিসি পর্যালোচনা সম্পন্ন হয়েছে।';
    if (safeTextEditor) {
      if (analysis.safeCorrectedText) {
        safeTextEditor.value = analysis.safeCorrectedText;
      } else {
        let safe = originalText;
        violations.forEach(v => {
          const w = (v.word || '').trim();
          const s = (v.suggestedWord || '').trim();
          if (w && s) {
            safe = safe.replaceAll(w, s);
          }
        });
        analysis.safeCorrectedText = safe;
        safeTextEditor.value = safe;
      }
    }

    const violations = Array.isArray(analysis.violations) ? analysis.violations : [];
    if (violationsCount) violationsCount.textContent = violations.length;

    // Highlight offending words in original text
    let highlightedHtml = escapeHtml(originalText);
    violations.forEach(v => {
      const word = (v.word || '').trim();
      if (!word) return;
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escaped})`, 'gi');
      highlightedHtml = highlightedHtml.replace(regex, `<mark class="bg-amber-500/25 text-amber-300 font-medium px-1 py-0.5 rounded border border-amber-500/40 cursor-help" title="${escapeHtml(v.reason || '')}">$1</mark>`);
    });
    if (highlightedTextView) highlightedTextView.innerHTML = highlightedHtml;

    // Render violation cards
    if (violationsCard && violationsListContainer) {
      if (violations.length === 0) {
        violationsCard.classList.remove('hidden');
        violationsListContainer.innerHTML = `
          <div class="md:col-span-2 bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-3 text-center flex items-center justify-center gap-2 text-xs text-emerald-300">
            <i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-400"></i>
            <span>দারুণ! আপনার স্ক্রিপ্টে কোনো ইউটিউব পলিসি-বিরোধী বা ডিমনিটাইজেশনের ঝুঁকিপূর্ণ শব্দ পাওয়া যায়নি।</span>
          </div>
        `;
      } else {
        violationsCard.classList.remove('hidden');
        violationsListContainer.innerHTML = violations.map(v => {
          let badgeColor = 'bg-amber-500/10 text-amber-300 border-amber-500/30';
          if (v.severity === 'high') badgeColor = 'bg-rose-500/10 text-rose-300 border-rose-500/30';

          const safeOld = escapeHtml(v.word || '').replace(/'/g, "\\'");
          const safeNew = escapeHtml(v.suggestedWord || '').replace(/'/g, "\\'");

          return `
            <div class="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2 hover:border-slate-700 transition">
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-bold text-rose-400 font-mono bg-rose-950/40 px-2 py-0.5 rounded border border-rose-900/50">
                  "${escapeHtml(v.word || '')}"
                </span>
                <span class="text-[10px] ${badgeColor} border px-2 py-0.5 rounded-full font-medium">
                  ${escapeHtml(v.category || 'পলিসি ঝুঁকি')}
                </span>
              </div>
              <p class="text-[11px] text-slate-400 leading-snug">
                <strong class="text-slate-300">কারণ:</strong> ${escapeHtml(v.reason || 'ইউটিউব মনিটাইজেশন বা কমিউনিটি গাইডলাইনে ঝুঁকি রয়েছে।')}
              </p>
              ${v.suggestedWord ? `
                <div class="flex items-center justify-between gap-2 pt-1 border-t border-slate-800 text-[11px]">
                  <span class="text-slate-400">নিরাপদ বিকল্প:</span>
                  <button type="button" onclick="replaceWordInSafeEditor('${safeOld}', '${safeNew}')" class="text-emerald-400 hover:text-emerald-300 font-medium underline flex items-center gap-1">
                    <span>"${escapeHtml(v.suggestedWord)}" ব্যবহার করুন</span>
                    <i data-lucide="check" class="w-3 h-3"></i>
                  </button>
                </div>
              ` : ''}
            </div>
          `;
        }).join('');
      }
    }

    if (policyResultsSection) {
      policyResultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    if (window.lucide) window.lucide.createIcons();
  }

  // Auto-Fix Button
  if (applyAutoFixBtn) {
    applyAutoFixBtn.addEventListener('click', () => {
      if (scannerPolicyAnalysis && scannerPolicyAnalysis.safeCorrectedText) {
        if (safeTextEditor) safeTextEditor.value = scannerPolicyAnalysis.safeCorrectedText;
        const highlightedTextView = document.getElementById('highlightedTextView');
        if (highlightedTextView) {
          highlightedTextView.innerHTML = `<span class="text-emerald-400">${escapeHtml(scannerPolicyAnalysis.safeCorrectedText)}</span>`;
        }
        showToast('ইউটিউব-সেইফ ১০০% নিরাপদ সংস্করণ সফলভাবে প্রয়োগ করা হয়েছে!', 'success');
      } else {
        showToast('সবকিছু ইতিমধ্যেই নিরাপদ!', 'info');
      }
    });
  }

  // Send to Main Voice Studio Box
  if (sendToMainBoxBtn) {
    sendToMainBoxBtn.addEventListener('click', () => {
      const textToSend = (safeTextEditor ? safeTextEditor.value.trim() : '') || currentPolicyScannedText.trim();
      if (!textToSend) {
        showToast('পাঠানোর মতো কোনো টেক্সট নেই!', 'error');
        return;
      }
      elements.mainTextInput.value = textToSend;
      updateTextStats();
      splitText();
      elements.mainTextInput.scrollIntoView({ behavior: 'smooth', block: 'start' });
      showToast('টেক্সট সফলভাবে মূল বক্সে যোগ করা হয়েছে এবং প্রতি ১০ বাক্যে/লাইনে ভাগ করা হয়েছে!', 'success');
    });
  }

  // Copy Buttons
  if (copyTranscribedBtn) {
    copyTranscribedBtn.addEventListener('click', () => {
      const highlightedTextView = document.getElementById('highlightedTextView');
      const text = currentPolicyScannedText || (highlightedTextView ? highlightedTextView.innerText : '');
      if (text) {
        navigator.clipboard.writeText(text);
        showToast('মূল টেক্সট ক্লিপবোর্ডে কপি হয়েছে!', 'info');
      }
    });
  }

  if (copySafeBtn) {
    copySafeBtn.addEventListener('click', () => {
      const text = safeTextEditor ? safeTextEditor.value.trim() : '';
      if (text) {
        navigator.clipboard.writeText(text);
        showToast('ইউটিউব-সেইফ টেক্সট ক্লিপবোর্ডে কপি হয়েছে!', 'success');
      }
    });
  }
}

// Global helper for vocal expression insertion (Google AI Studio acoustic tags)
window.insertExpressionTag = function(tag) {
  const textarea = elements.mainTextInput;
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const original = textarea.value;

  if (start !== undefined && end !== undefined) {
    const before = original.substring(0, start);
    const after = original.substring(end);
    const needSpaceBefore = before.length > 0 && !before.endsWith(' ');
    const needSpaceAfter = after.length > 0 && !after.startsWith(' ');
    const insertStr = (needSpaceBefore ? ' ' : '') + tag + (needSpaceAfter ? ' ' : '');
    
    textarea.value = before + insertStr + after;
    textarea.selectionStart = textarea.selectionEnd = start + insertStr.length;
  } else {
    textarea.value = (original ? original + ' ' : '') + tag + ' ';
  }

  textarea.focus();
  updateTextStats();
  splitText();
  showToast(`এক্সপ্রেশন ট্যাগ ${tag} যোগ করা হয়েছে!`, 'info');
};

// Global helper for single-word replacement
window.replaceWordInSafeEditor = function(oldWord, newWord) {
  const safeTextEditor = document.getElementById('safeTextEditor');
  if (safeTextEditor && oldWord && newWord) {
    const regex = new RegExp(oldWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    safeTextEditor.value = safeTextEditor.value.replace(regex, newWord);
    showToast(`"${oldWord}" এর জায়গায় "${newWord}" প্রতিস্থাপন করা হয়েছে!`, 'success');
  }
};

// ==========================================
// Video Studio (YouTube Scene Audio + Image)
// ==========================================

function setupVideoStudioEventListeners() {
  if (elements.videoAspectRatio) {
    elements.videoAspectRatio.addEventListener('change', (e) => {
      videoState.aspectRatio = e.target.value;
      renderVideoScenes();
      showToast(`ভিডিও ফরম্যাট "${videoState.aspectRatio}" সেট করা হয়েছে।`, 'info');
    });
  }

  if (elements.videoVisualStyle) {
    elements.videoVisualStyle.addEventListener('change', (e) => {
      videoState.visualStyle = e.target.value;
      showToast(`আর্ট স্টাইল পরিবর্তন করা হয়েছে। নতুন ছবি তৈরিতে এটি প্রযোজ্য হবে।`, 'info');
    });
  }

  if (elements.videoVoiceSelect) {
    elements.videoVoiceSelect.value = videoState.voice;
    elements.videoVoiceSelect.addEventListener('change', (e) => {
      videoState.voice = e.target.value;
      showToast(`ভিডিও ভয়েস "${videoState.voice}" নির্বাচিত।`, 'info');
    });
  }

  if (elements.videoUnitsPerScene) {
    elements.videoUnitsPerScene.addEventListener('change', (e) => {
      videoState.unitsPerScene = parseInt(e.target.value) || 2;
      splitVideoScript();
    });
  }

  if (elements.videoSplitMode) {
    elements.videoSplitMode.addEventListener('change', (e) => {
      videoState.splitMode = e.target.value;
      splitVideoScript();
    });
  }

  let videoSplitDebounceTimer = null;
  const triggerInstantVideoSplit = () => {
    updateVideoTextStats();
    clearTimeout(videoSplitDebounceTimer);
    videoSplitDebounceTimer = setTimeout(() => {
      splitVideoScript();
    }, 350);
  };

  if (elements.videoScriptInput) {
    elements.videoScriptInput.addEventListener('input', triggerInstantVideoSplit);
    elements.videoScriptInput.addEventListener('change', triggerInstantVideoSplit);
    elements.videoScriptInput.addEventListener('paste', () => setTimeout(triggerInstantVideoSplit, 50));
  }

  if (elements.videoLoadDemoBtn) {
    elements.videoLoadDemoBtn.addEventListener('click', () => {
      if (elements.videoScriptInput) {
        elements.videoScriptInput.value = getVideoDemoText();
        updateVideoTextStats();
        splitVideoScript();
        showToast('ইউটিউব ভিডিও ডেমো স্ক্রিপ্ট লোড করা হয়েছে!', 'success');
      }
    });
  }

  if (elements.videoClearTextBtn) {
    elements.videoClearTextBtn.addEventListener('click', () => {
      if (elements.videoScriptInput) {
        elements.videoScriptInput.value = '';
        videoState.scenes = [];
        updateVideoTextStats();
        renderVideoScenes();
        showToast('স্ক্রিপ্ট ক্লিয়ার করা হয়েছে।', 'info');
      }
    });
  }

  if (elements.videoSplitBtn) {
    elements.videoSplitBtn.addEventListener('click', () => {
      splitVideoScript();
      showToast('পুনরায় দৃশ্য ভাগ করা হয়েছে।', 'info');
    });
  }

  if (elements.videoGenerateAllBothBtn) {
    elements.videoGenerateAllBothBtn.addEventListener('click', () => generateAllVideoScenes('both'));
  }

  if (elements.videoGenerateAllImageBtn) {
    elements.videoGenerateAllImageBtn.addEventListener('click', () => generateAllVideoScenes('image'));
  }

  if (elements.videoGenerateAllAudioBtn) {
    elements.videoGenerateAllAudioBtn.addEventListener('click', () => generateAllVideoScenes('audio'));
  }

  if (elements.videoStopBtn) {
    elements.videoStopBtn.addEventListener('click', handleStopVideoGeneration);
  }

  if (elements.videoDownloadZipBtn) {
    elements.videoDownloadZipBtn.addEventListener('click', downloadVideoZip);
  }

  if (elements.videoRenderFullMp4Btn) {
    elements.videoRenderFullMp4Btn.addEventListener('click', startVideoRendering);
  }

  if (elements.videoRenderModalCloseBtn) {
    elements.videoRenderModalCloseBtn.addEventListener('click', closeVideoRenderModal);
  }

  if (elements.videoRenderCancelBtn) {
    elements.videoRenderCancelBtn.addEventListener('click', closeVideoRenderModal);
  }
}

function getVideoDemoText() {
  return `গভীর রাতে সুন্দরবনের এক শান্ত খাঁড়িতে বৃদ্ধ মাঝির কাঠের নৌকাটি ধীরে ধীরে শান্ত পানির ওপর দিয়ে চলছিল।
চারপাশে ঘন কুয়াশার চাদর আর মাথার ওপরে রুপোলি চাঁদের মায়াবী আলো এক অপার্থিব রূপ তৈরি করেছে।
হঠাৎ নদীর দূরের পাড় থেকে একটি বাঘের গম্ভীর গর্জন ভেসে এলো, যা নিস্তব্ধ বনকে কাঁপিয়ে তুলল।
মাঝি আলতো করে বৈঠা টেনে নৌকার গতি বাড়ালেন, তার চোখে ছিল বহু বছরের অভিজ্ঞতার অটল সাহস।
ধীরে ধীরে ভোরের প্রথম সোনালী সূর্যকিরণ বনের গাছের ফাঁক দিয়ে ছড়িয়ে নদীর জলকে উজ্জ্বল করে তুলল।`;
}

function updateVideoTextStats() {
  if (!elements.videoTextStats || !elements.videoScriptInput) return;
  const text = elements.videoScriptInput.value;
  const chars = text.length;
  const lines = text ? text.split('\n').filter(l => l.trim().length > 0).length : 0;
  const scenes = videoState.scenes.length;
  elements.videoTextStats.textContent = `${chars} অক্ষর | ${lines} লাইন | ${scenes} দৃশ্য`;
}

function splitVideoScript() {
  const rawText = elements.videoScriptInput ? elements.videoScriptInput.value.trim() : '';
  if (!rawText) {
    videoState.scenes = [];
    renderVideoScenes();
    updateVideoTextStats();
    return;
  }

  const mode = videoState.splitMode || 'sentences';
  const unitsPerScene = Math.max(1, videoState.unitsPerScene || 2);
  let units = [];

  if (mode === 'sentences') {
    const rawUnits = rawText.split(/([।?!.।\n]+)/);
    for (let i = 0; i < rawUnits.length; i += 2) {
      const sentence = (rawUnits[i] || '') + (rawUnits[i + 1] || '');
      const trimmed = sentence.trim();
      if (trimmed) units.push(trimmed);
    }
  } else {
    units = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  }

  if (units.length === 0) {
    videoState.scenes = [];
    renderVideoScenes();
    updateVideoTextStats();
    return;
  }

  const grouped = [];
  for (let i = 0; i < units.length; i += unitsPerScene) {
    const slice = units.slice(i, i + unitsPerScene);
    grouped.push(slice.join(' '));
  }

  const oldScenes = videoState.scenes;
  videoState.scenes = grouped.map((text, idx) => {
    const existing = oldScenes.find(o => o.text === text);
    let prompt = existing && existing.visualPrompt ? existing.visualPrompt : '';
    // If prompt contains Bengali characters, old broken placeholder, or is empty:
    if (!prompt || /[\u0980-\u09FF]/.test(prompt) || prompt.startsWith('A cinematic shot depicting:')) {
      prompt = translateBengaliSceneToEnglish(text, videoState.visualStyle, videoState.aspectRatio);
    }
    const ambient = existing && existing.ambientSound ? existing.ambientSound : detectAmbientSound(text);
    return {
      id: idx + 1,
      text: text,
      visualPrompt: prompt,
      ambientSound: ambient,
      imageBlob: existing ? existing.imageBlob : null,
      imageUrl: existing ? existing.imageUrl : '',
      imageStatus: existing ? existing.imageStatus : 'idle',
      imageError: existing ? existing.imageError : '',
      audioBlob: existing ? existing.audioBlob : null,
      audioUrl: existing ? existing.audioUrl : '',
      audioStatus: existing ? existing.audioStatus : 'idle',
      audioError: existing ? existing.audioError : ''
    };
  });

  renderVideoScenes();
  updateVideoTextStats();
}

function renderVideoScenes() {
  if (!elements.videoScenesContainer) return;

  if (elements.videoSceneCount) {
    elements.videoSceneCount.textContent = videoState.scenes.length;
  }

  const hasCompletedWork = videoState.scenes.some(s => s.audioBlob || s.imageBlob || s.imageUrl);
  if (elements.videoDownloadZipBtn) {
    elements.videoDownloadZipBtn.disabled = !hasCompletedWork || videoState.isGeneratingAll;
  }
  if (elements.videoRenderFullMp4Btn) {
    const canRender = videoState.scenes.some(s => (s.audioBlob || s.audioUrl) && (s.imageBlob || s.imageUrl));
    elements.videoRenderFullMp4Btn.disabled = !canRender || videoState.isGeneratingAll;
  }

  if (videoState.scenes.length === 0) {
    elements.videoScenesContainer.innerHTML = `
      <div id="videoEmptyState" class="bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl p-12 text-center space-y-3">
        <div class="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
          <i data-lucide="clapperboard" class="w-6 h-6 text-indigo-400"></i>
        </div>
        <h4 class="text-sm font-medium text-slate-300">কোনো স্ক্রিপ্ট ইনপুট করা হয়নি</h4>
        <p class="text-xs text-slate-500 max-w-sm mx-auto">উপরের বক্সে আপনার পুরো গল্প বা ইউটিউব স্ক্রিপ্ট পেস্ট করুন অথবা "ডেমো গল্প দেখুন" বাটনে ক্লিক করে পরীক্ষা করুন।</p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  const isPortrait = videoState.aspectRatio === '9:16';
  const isSquare = videoState.aspectRatio === '1:1';
  const aspectClass = isPortrait ? 'aspect-[9/16] max-w-[220px]' : (isSquare ? 'aspect-square max-w-[280px]' : 'aspect-video w-full');

  elements.videoScenesContainer.innerHTML = videoState.scenes.map(scene => {
    const pad = String(scene.id).padStart(2, '0');
    return `
      <div id="video-scene-${scene.id}" class="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 shadow-xl space-y-4 transition-all duration-200">
        
        <!-- Scene Header -->
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div class="flex items-center gap-2.5">
            <span class="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-bold text-xs flex items-center justify-center">
              #${pad}
            </span>
            <div>
              <h4 class="text-xs font-bold text-white flex items-center gap-2">
                দৃশ্য ${pad} (Scene ${pad})
              </h4>
            </div>
          </div>

          <!-- Status Badges -->
          <div class="flex flex-wrap items-center gap-2">
            <div class="flex items-center gap-1">
              <span class="text-[10px] text-slate-400">অডিও:</span>
              ${renderVideoSceneBadge(scene.audioStatus, 'audio')}
            </div>
            <div class="flex items-center gap-1">
              <span class="text-[10px] text-slate-400">ছবি:</span>
              ${renderVideoSceneBadge(scene.imageStatus, 'image')}
            </div>
          </div>
        </div>

        <!-- 2-Column Content Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          <!-- Left Column (Script & Visual Prompt) -->
          <div class="lg:col-span-7 space-y-3">
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label class="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <i data-lucide="file-text" class="w-3.5 h-3.5 text-indigo-400"></i>
                  <span>এই দৃশ্যের টেক্সট (বাংলা):</span>
                </label>
                <span class="text-[10px] text-slate-400">${scene.text.length} অক্ষর</span>
              </div>
              <textarea onchange="updateVideoSceneText(${scene.id}, this.value)" rows="3" 
                class="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-xs text-slate-200 rounded-xl p-3 outline-none transition resize-y leading-relaxed">${escapeHtml(scene.text)}</textarea>
            </div>

            <!-- Auto Detected Natural Sound Badge -->
            <div class="flex items-center justify-between bg-slate-950/80 border border-emerald-500/30 rounded-xl px-3 py-2 text-xs shadow-sm">
              <div class="flex items-center gap-2 text-emerald-300">
                <i data-lucide="${(scene.ambientSound && scene.ambientSound.icon) || 'volume-2'}" class="w-3.5 h-3.5 text-emerald-400 shrink-0"></i>
                <span class="text-[11px] font-medium text-slate-400">অটো প্রাকৃতিক সাউন্ড:</span>
                <span class="text-[11px] font-bold text-white">${escapeHtml(scene.ambientSound ? scene.ambientSound.label : '🌿 প্রশান্ত সিনেমাটিক আবহ')}</span>
              </div>
              <div class="flex items-center gap-2">
                <button type="button" onclick="previewAmbientSound('${scene.ambientSound ? scene.ambientSound.id : 'peaceful_nature'}')" class="text-[10px] text-teal-400 hover:text-teal-300 flex items-center gap-1 font-medium hover:underline">
                  <i data-lucide="play" class="w-2.5 h-2.5 fill-current"></i> টেস্ট শুনুন
                </button>
                <span class="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono font-medium">১০০% অটো</span>
              </div>
            </div>

            <!-- Visual Prompt Box (Collapsible / Editable) -->
            <div class="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 space-y-2">
              <div class="flex items-center justify-between">
                <label class="text-[11px] font-semibold text-indigo-300 flex items-center gap-1.5">
                  <i data-lucide="sparkles" class="w-3 h-3 text-indigo-400"></i>
                  <span>সিন প্রম্পট (AI Visual Description):</span>
                </label>
                <button type="button" onclick="regenerateScenePrompt(${scene.id})" class="text-[10px] text-teal-400 hover:text-teal-300 flex items-center gap-1 transition">
                  <i data-lucide="refresh-cw" class="w-3 h-3"></i> প্রম্পট অটো-তৈরি
                </button>
              </div>
              <input type="text" id="prompt-input-${scene.id}" value="${escapeHtml(scene.visualPrompt || '')}" 
                placeholder="Gemini দিয়ে স্বয়ংক্রিয় সিনেমাটিক প্রম্পট তৈরি হবে অথবা নিজে লিখুন..."
                onchange="updateVideoScenePrompt(${scene.id}, this.value)"
                class="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 text-[11px] text-slate-300 rounded-lg px-2.5 py-1.5 outline-none font-sans">
              <p class="text-[10px] text-slate-500">💡 ছবি জেনারেটের সময় এই প্রম্পটটিই ছবির নিখুঁত 8K মান নির্ধারণ করবে।</p>
            </div>

            <!-- Scene Action Buttons -->
            <div class="flex flex-wrap items-center gap-2 pt-1">
              <button type="button" onclick="generateSceneBoth(${scene.id})" class="px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-teal-600 hover:from-indigo-500 hover:to-teal-500 text-white font-medium text-xs rounded-xl transition flex items-center gap-1.5 shadow-md shadow-indigo-600/20">
                <i data-lucide="play" class="w-3.5 h-3.5 fill-current"></i>
                <span>ভিডিও ও অডিও জেনারেট</span>
              </button>
              <button type="button" onclick="generateSceneImage(${scene.id})" class="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white text-xs rounded-xl border border-slate-700/80 transition flex items-center gap-1.5">
                <i data-lucide="image" class="w-3.5 h-3.5 text-indigo-400"></i>
                <span>${scene.imageUrl ? 'পুনরায় ছবি' : 'ছবি জেনারেট'}</span>
              </button>
              <button type="button" onclick="generateSceneAudio(${scene.id})" class="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-teal-300 hover:text-white text-xs rounded-xl border border-slate-700/80 transition flex items-center gap-1.5">
                <i data-lucide="volume-2" class="w-3.5 h-3.5 text-teal-400"></i>
                <span>${scene.audioUrl || scene.audioBlob ? 'পুনরায় অডিও' : 'অডিও জেনারেট'}</span>
              </button>
            </div>
          </div>

          <!-- Right Column (Media: Image & Audio Player) -->
          <div class="lg:col-span-5 space-y-3 flex flex-col justify-between">
            
            <!-- Image Box -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between text-xs">
                <span class="font-medium text-slate-300 flex items-center gap-1.5">
                  <i data-lucide="image" class="w-3.5 h-3.5 text-indigo-400"></i>
                  <span>সিনেমাটিক দৃশ্য ছবি (${videoState.aspectRatio})</span>
                </span>
                ${scene.imageUrl ? `
                  <div class="flex items-center gap-2">
                    <button type="button" onclick="openVideoImageModal('${scene.imageUrl}', 'দৃশ্য #${pad}', 'Scene_${pad}_image.jpg')" class="text-[11px] text-indigo-300 hover:text-indigo-200 flex items-center gap-0.5">
                      <i data-lucide="maximize-2" class="w-3 h-3"></i> বড় করুন
                    </button>
                    <button type="button" onclick="downloadSceneImage(${scene.id})" class="text-[11px] text-teal-400 hover:underline flex items-center gap-0.5">
                      <i data-lucide="download" class="w-3 h-3"></i> ডাউনলোড
                    </button>
                  </div>
                ` : ''}
              </div>

              <!-- Image Display Frame -->
              <div class="${aspectClass} bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex items-center justify-center relative mx-auto group">
                ${scene.imageStatus === 'cooldown' ? `
                  <div class="p-5 text-center space-y-2.5">
                    <div class="relative w-12 h-12 mx-auto flex items-center justify-center">
                      <div class="absolute inset-0 rounded-full border-2 border-amber-500/30 animate-ping"></div>
                      <div class="w-12 h-12 rounded-full border-2 border-amber-500/80 bg-amber-500/10 flex items-center justify-center text-amber-400 font-bold text-sm tracking-wider font-mono" id="cooldown-timer-${scene.id}">
                        ${scene.cooldownSeconds || 45}s
                      </div>
                    </div>
                    <div class="space-y-1">
                      <p class="text-xs text-amber-300 font-semibold flex items-center justify-center gap-1.5">
                        <i data-lucide="timer" class="w-3.5 h-3.5 animate-pulse"></i>
                        <span>ফ্রি লিমিট কুলডাউন চলছে</span>
                      </p>
                      <p class="text-[10px] text-slate-400">৪৫ সেকেন্ড পর স্বয়ংক্রিয়ভাবে ছবি তৈরি হবে</p>
                      <p class="text-[9px] text-slate-500">দেরি না করে সাথে সাথে বানাতে <a href="https://enter.pollinations.ai" target="_blank" class="text-indigo-400 underline font-medium">Free Key</a> দিন</p>
                    </div>
                  </div>
                ` : scene.imageStatus === 'generating' ? `
                  <div class="p-6 text-center space-y-2">
                    <i data-lucide="loader-2" class="w-6 h-6 animate-spin text-indigo-400 mx-auto"></i>
                    <p class="text-xs text-indigo-300 font-medium">এআই ছবি তৈরি করছে...</p>
                    <p class="text-[10px] text-slate-500">সিনেমাটিক লাইটিং ও 8K ডিটেইল যুক্ত হচ্ছে</p>
                  </div>
                ` : scene.imageUrl ? `
                  <img src="${scene.imageUrl}" alt="Scene ${pad}" class="w-full h-full object-cover rounded-xl cursor-pointer hover:scale-105 transition-transform duration-300" 
                    onclick="openVideoImageModal('${scene.imageUrl}', 'দৃশ্য #${pad}', 'Scene_${pad}_image.jpg')">
                ` : scene.imageStatus === 'error' ? `
                  <div class="p-4 text-center space-y-1 text-rose-400">
                    <i data-lucide="alert-circle" class="w-5 h-5 mx-auto"></i>
                    <p class="text-xs font-semibold">ছবি তৈরি ব্যর্থ</p>
                    <p class="text-[10px] text-slate-400">${escapeHtml(scene.imageError || '')}</p>
                    <button type="button" onclick="generateSceneImage(${scene.id})" class="text-[11px] text-indigo-400 underline mt-1">আবার চেষ্টা করুন</button>
                  </div>
                ` : `
                  <div class="p-6 text-center space-y-2 text-slate-600">
                    <i data-lucide="image" class="w-7 h-7 mx-auto stroke-1"></i>
                    <p class="text-[11px] text-slate-400">ছবি এখনো তৈরি করা হয়নি</p>
                    <button type="button" onclick="generateSceneImage(${scene.id})" class="text-[11px] bg-slate-800 hover:bg-slate-700 text-indigo-300 px-3 py-1 rounded-lg border border-slate-700 transition">
                      ছবি জেনারেট
                    </button>
                  </div>
                `}
              </div>
            </div>

            <!-- Audio Player Box -->
            <div class="space-y-1.5 pt-1">
              <div class="flex items-center justify-between text-xs">
                <span class="font-medium text-slate-300 flex items-center gap-1.5">
                  <i data-lucide="headphones" class="w-3.5 h-3.5 text-teal-400"></i>
                  <span>ভয়েসওভার অডিও (Gemini)</span>
                </span>
                ${scene.audioBlob ? `
                  <a href="${scene.audioUrl}" download="Scene_${pad}_audio.wav" class="text-[11px] text-teal-400 hover:underline flex items-center gap-0.5">
                    <i data-lucide="download" class="w-3 h-3"></i> ডাউনলোড
                  </a>
                ` : ''}
              </div>

              <div>
                ${scene.audioStatus === 'generating' ? `
                  <div class="h-10 bg-slate-950 border border-slate-800 rounded-xl px-3 flex items-center justify-center gap-2 text-xs text-teal-400">
                    <i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i>
                    <span>ভয়েস তৈরি হচ্ছে...</span>
                  </div>
                ` : scene.audioBlob ? `
                  <audio controls src="${scene.audioUrl}" class="w-full h-9 rounded-lg"></audio>
                ` : scene.audioStatus === 'error' ? `
                  <div class="h-10 bg-slate-950 border border-rose-500/30 rounded-xl px-3 flex items-center justify-between text-xs text-rose-400">
                    <span class="truncate">${escapeHtml(scene.audioError || 'অডিও ব্যর্থ')}</span>
                    <button type="button" onclick="generateSceneAudio(${scene.id})" class="text-[11px] underline shrink-0 ml-2">পুনরায়</button>
                  </div>
                ` : `
                  <div class="h-10 bg-slate-950 border border-slate-800 rounded-xl px-3 flex items-center justify-between text-xs text-slate-500">
                    <span>অডিও এখনও তৈরি হয়নি</span>
                    <button type="button" onclick="generateSceneAudio(${scene.id})" class="text-[11px] text-teal-400 hover:underline">
                      অডিও বানান
                    </button>
                  </div>
                `}
              </div>
            </div>

          </div>

        </div>

      </div>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();
}

function renderVideoSceneBadge(status) {
  switch (status) {
    case 'cooldown':
      return `
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
          <i data-lucide="timer" class="w-2.5 h-2.5 animate-pulse"></i> কুলডাউন
        </span>
      `;
    case 'generating':
      return `
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
          <i data-lucide="loader-2" class="w-2.5 h-2.5 animate-spin"></i> তৈরি হচ্ছে
        </span>
      `;
    case 'ready':
      return `
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          <i data-lucide="check" class="w-2.5 h-2.5"></i> প্রস্তুত
        </span>
      `;
    case 'error':
      return `
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
          <i data-lucide="alert-circle" class="w-2.5 h-2.5"></i> ত্রুটি
        </span>
      `;
    default:
      return `
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
          <i data-lucide="clock" class="w-2.5 h-2.5"></i> বাকি
        </span>
      `;
  }
}

function translateBengaliSceneToEnglish(text, styleDesc = '', ratioDesc = '') {
  const t = text.toLowerCase();
  const subjects = [];
  const actions = [];
  const env = [];
  const lighting = [];
  const atmosphere = [];

  // Characters
  if (t.includes('মাঝি') || t.includes('জেলে')) {
    if (t.includes('বৃদ্ধ')) subjects.push('an elderly weathered South Asian fisherman with wrinkled face');
    else subjects.push('a traditional South Asian fisherman');
  } else if (t.includes('বাঘ') || t.includes('রয়েল বেঙ্গল') || t.includes('টাইগার')) {
    subjects.push('a magnificent Royal Bengal tiger with glowing amber eyes');
  } else if (t.includes('হরিণ')) {
    subjects.push('an alert spotted chital deer');
  } else if (t.includes('কুমির')) {
    subjects.push('a menacing saltwater crocodile lurking at the water edge');
  } else if (t.includes('শিশু') || t.includes('বাচ্চা') || t.includes('ছেলে') || t.includes('মেয়ে')) {
    subjects.push('an expressive innocent child');
  } else if (t.includes('রাজা') || t.includes('সম্রাট')) {
    subjects.push('a regal Indian emperor dressed in ornate royal silk robes');
  } else if (t.includes('নারী') || t.includes('মহিলা') || t.includes('বধূ')) {
    subjects.push('a graceful South Asian woman in traditional clothing');
  } else if (t.includes('নৌকা') || t.includes('নৌকায়')) {
    subjects.push('a rustic handcrafted wooden boat');
  } else {
    subjects.push('a captivating dramatic scene');
  }

  // Vehicles / Props
  if (t.includes('নৌকা') || t.includes('নৌকায়') || t.includes('ডিঙি')) {
    if (!subjects.some(s => s.includes('boat'))) {
      subjects.push('a rustic wooden boat');
    }
  }
  if (t.includes('লণ্ঠন') || t.includes('হারিকেন') || t.includes('কুপি') || t.includes('আলো')) {
    subjects.push('a warm glowing kerosene lantern on the bow');
  }

  // Actions
  if ((t.includes('মাঝি') || t.includes('বৃদ্ধ')) && (t.includes('নৌকা') || t.includes('নৌকায়') || t.includes('বৈঠা') || t.includes('চলছিল'))) {
    actions.push('slowly rowing a wooden canoe across serene reflective river waters');
  } else if (t.includes('বাঘ') && (t.includes('গর্জন') || t.includes('ডাক') || t.includes('লাফ'))) {
    actions.push('roaring powerfully on the muddy riverbank');
  } else if (t.includes('চলছিল') || t.includes('যাচ্ছিল') || t.includes('ঘুরে')) {
    actions.push('navigating quietly through the secluded waters');
  }

  // Environment
  if (t.includes('সুন্দরবন') || t.includes('বন') || t.includes('জঙ্গল')) {
    env.push('in the mystical Sundarbans mangrove forest with dense exposed roots');
  } else if (t.includes('নদী') || t.includes('পানি') || t.includes('খাঁড়ি') || t.includes('জল')) {
    env.push('along a tranquil winding river creek');
  } else if (t.includes('পাহাড়') || t.includes('পর্বত')) {
    env.push('surrounded by towering emerald green mountains');
  } else if (t.includes('গ্রাম') || t.includes('মাঠ')) {
    env.push('in a picturesque lush rural countryside landscape');
  } else if (t.includes('শহর') || t.includes('নগর')) {
    env.push('in an atmospheric vibrant street scene');
  }

  // Lighting & Time
  if (t.includes('রাত') || t.includes('গভীর রাত')) {
    if (t.includes('চাঁদ') || t.includes('চাঁদের আলো') || t.includes('রুপোলি')) {
      lighting.push('illuminated by a brilliant silver full moon casting shimmering reflections on dark water');
    } else {
      lighting.push('at deep midnight under a dramatic starry celestial sky');
    }
  } else if (t.includes('ভোর') || t.includes('সকাল') || t.includes('সূর্যকিরণ') || t.includes('সূর্য')) {
    lighting.push('basking in early morning golden sunrise rays piercing through misty trees');
  } else if (t.includes('সন্ধ্যা') || t.includes('সূর্যাস্ত') || t.includes('গোধূলি')) {
    lighting.push('under a breathtaking golden orange sunset twilight sky');
  }

  // Atmospheric conditions
  if (t.includes('কুয়াশা') || t.includes('কুয়াশার')) {
    atmosphere.push('shrouded in thick ethereal atmospheric fog and haze hovering above water');
  }
  if (t.includes('বৃষ্টি') || t.includes('ঝড়')) {
    atmosphere.push('with dramatic thunderstorm raindrops and ripples');
  }

  const all = [...subjects, ...actions, ...env, ...lighting, ...atmosphere];
  let promptCore = all.join(', ');
  if (!promptCore) {
    promptCore = 'A dramatic atmospheric cinematic scene';
  }

  return `Cinematic wide shot, ${promptCore}, ${styleDesc || 'cinematic photorealistic 8k, volumetric lighting, shot on 35mm film'}, ${ratioDesc || '16:9 widescreen'}, masterpiece, highly detailed, no text, no watermark`;
}

// ==========================================
// Intelligent Ambient Sound Detection Engine
// Automatically detects natural atmosphere from Bengali text
// ==========================================
function detectAmbientSound(bengaliText) {
  if (!bengaliText) {
    return {
      id: 'peaceful_nature',
      name: 'প্রশান্ত সিনেমাটিক আবহ',
      label: '🌿 প্রশান্ত সিনেমাটিক আবহ',
      icon: 'sparkles'
    };
  }

  const t = bengaliText.toLowerCase();

  // 1. Tiger / Predator / Suspense / Roar (বাঘ, গর্জন, বিপদ, ভয় - ড্রামাটিক মুহূর্ত সবার আগে)
  if (/বাঘ|গর্জন|চিৎকার|হিংস্র|আক্রমণ|শিকার|বিপদ|ভয়|আতঙ্ক|কাঁপিয়ে|শিউরে|থরথর|থমথমে|ভীতিকর/i.test(t)) {
    return {
      id: 'dramatic_suspense',
      name: 'গভীর বনের থমথমে ও রহস্যময় ড্রামাটিক আবহ',
      label: '🐅 গভীর বনের থমথমে ড্রামাটিক আবহ',
      icon: 'alert-triangle'
    };
  }

  // 2. Rain / Storm / Thunder (বৃষ্টি, ঝড়, মেঘ, বিজলি, বজ্রপাত)
  if (/বৃষ্টি|বর্ষা|মেঘ|বিদ্যুৎ|বজ্রপাত|ঝড়|তুফান|ঝোড়ো|ঝুম বৃষ্টি/i.test(t)) {
    return {
      id: 'rain_storm',
      name: 'মৃদু বৃষ্টির রিমঝিম শব্দ ও বাতাস',
      label: '🌧️ মৃদু বৃষ্টির রিমঝিম শব্দ',
      icon: 'cloud-rain'
    };
  }

  // 3. Dawn / Morning / Birds / Sunrise (ভোর, সকাল, আলো, সূর্য, কিচিরমিচির, পাখি)
  if (/ভোর|সকাল|প্রাতঃ|সূর্য|সূর্যকিরণ|সোনালী আলো|প্রথম আলো|পাখি|কিচিরমিচির|কোকিল|ডানা/i.test(t)) {
    return {
      id: 'morning_birds',
      name: 'ভোরের মিষ্টি পাখির কলকাকলি ও হাওয়া',
      label: '🐦 ভোরের পাখির মিষ্টি কলকাকলি',
      icon: 'sun'
    };
  }

  // 4. Water / River / Creek / Boat (নদী, খাঁড়ি, পানি, নৌকা, মাঝি, বৈঠা)
  if (/নদী|খাঁড়ি|পানি|জল|নৌকা|মাঝি|বৈঠা|দাঁড়|স্রোত|ঢেউ|সাগর|সমুদ্র|খাল|বিল|ঘাট|কিনারা|গাঙ|তীর/i.test(t)) {
    if (/রাত|অন্ধকার|নিস্তব্ধ|চাঁদ/i.test(t)) {
      return {
        id: 'river_night',
        name: 'নদীর পানির ছলাৎছলাৎ ও রাতের শান্ত আবহ',
        label: '🌊 নদীর জল ও রাতের বনের আবহ',
        icon: 'waves'
      };
    }
    return {
      id: 'river_water',
      name: 'নদীর শান্ত পানির কলতান ও ঢেউ',
      label: '🌊 নদীর শান্ত পানি ও ঢেউয়ের শব্দ',
      icon: 'waves'
    };
  }

  // 5. Night / Moonlight / Deep Forest (রাত, জ্যোৎস্না, আঁধার, বন, সুন্দরবন)
  if (/রাত|গভীর রাত|অন্ধকার|আঁধার|চাঁদ|রুপোলি চাঁদ|জ্যোৎস্না|কুয়াশা|নিস্তব্ধ|নিঝুম|বন|সুন্দরবন|জঙ্গল|অরণ্য/i.test(t)) {
    return {
      id: 'night_forest',
      name: 'রাতের বনের নিস্তব্ধতা ও ঝিঁঝিঁ পোকার ডাক',
      label: '🌙 রাতের বন ও ঝিঁঝিঁ পোকার ডাক',
      icon: 'moon'
    };
  }

  // 6. Wind / Mountain / Valley (বাতাস, হাওয়া, শীত, পাহাড়)
  if (/বাতাস|হাওয়া|সমীরণ|শীতল|পাহাড়|উপত্যকা|প্রান্তর|গাছপালা|ডালপালা/i.test(t)) {
    return {
      id: 'wind_breeze',
      name: 'প্রশান্ত বনের মিষ্টি বাতাস',
      label: '🍃 প্রশান্ত বনের মিষ্টি বাতাস',
      icon: 'wind'
    };
  }

  // Default: Peaceful nature
  return {
    id: 'peaceful_nature',
    name: 'প্রশান্ত সিনেমাটিক আবহ',
    label: '🌿 প্রশান্ত সিনেমাটিক আবহ',
    icon: 'sparkles'
  };
}

async function generateVisualPromptForScene(sceneText, style, aspectRatio) {
  const styleGuides = {
    'cinematic': 'Cinematic photorealistic 8k, dramatic cinematic lighting, shot on 35mm film, shallow depth of field, hyper-detailed textures, masterpiece',
    'pixar': '3D Pixar and Disney animation style, vibrant vivid colors, expressive whimsical characters, soft volumetric lighting, detailed 3D render',
    'documentary': 'National Geographic documentary photography, natural lighting, authentic textures, highly detailed, realistic atmosphere',
    'fantasy': 'Epic dark fantasy concept art, mystical glowing atmosphere, intricate details, cinematic volumetric light',
    'cyberpunk': 'Futuristic cyberpunk, glowing neon lights, rainy reflections, high-tech dystopian city, cinematic color grading'
  };
  const styleDesc = styleGuides[style] || styleGuides['cinematic'];
  const ratioDesc = aspectRatio === '16:9' ? '16:9 landscape aspect ratio' : (aspectRatio === '9:16' ? '9:16 vertical portrait aspect ratio' : '1:1 square aspect ratio');

  if (state.apiKey) {
    const keys = parseKeys(state.apiKey);
    const activeKey = keys[0];
    const candidateModels = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash'];

    for (const m of candidateModels) {
      try {
        const systemPrompt = `You are an elite Hollywood visual director creating detailed image prompts for YouTube story videos.
Convert this Bengali story excerpt into a vivid, descriptive English image prompt for an image generator (Flux/Stable Diffusion).
Describe: main visual subject, facial expression/pose, setting, lighting, atmosphere, colors, and camera shot.
Keep under 50 words. Must emphasize: ${styleDesc}, ${ratioDesc}, no text, no watermark, no border.
Output ONLY the English prompt text.`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${activeKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemPrompt}\n\nBengali Text: "${sceneText}"` }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 100 }
          })
        });

        if (response.ok) {
          const data = await response.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (text && !/[\u0980-\u09FF]/.test(text)) {
            return text.replace(/^["']|["']$/g, '').trim();
          }
        }
      } catch (err) {
        console.warn(`Model ${m} visual prompt error:`, err);
      }
    }
  }

  // Safe semantic English fallback (Zero Bengali characters)
  return translateBengaliSceneToEnglish(sceneText, styleDesc, ratioDesc);
}

function isRateLimitBanner(img) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 60;
    canvas.height = 60;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, 60, 60);

    const p1 = ctx.getImageData(10, 10, 1, 1).data;
    const p2 = ctx.getImageData(50, 10, 1, 1).data;
    const p3 = ctx.getImageData(30, 50, 1, 1).data;

    // Pollinations yellow rate limit banner background is #FCE043
    // RGB range: R ~ 225-255, G ~ 195-245, B ~ 40-100
    const isYellow = (p) => (p[0] > 220 && p[1] > 190 && p[2] < 100);
    return isYellow(p1) && isYellow(p2) && isYellow(p3);
  } catch (e) {
    // Canvas tainted or unavailable
    return false;
  }
}

async function waitForImageCooldown(scene, isBatch = false) {
  const activeKey = getActivePollinationsKey();

  // If user provided an API key, zero cooldown needed
  if (activeKey && activeKey.trim().length > 0) {
    return;
  }

  const now = Date.now();
  const elapsed = (now - (videoState.lastImageGeneratedTimestamp || 0)) / 1000;
  const COOLDOWN_SECONDS = 46;

  if (videoState.lastImageGeneratedTimestamp > 0 && elapsed < COOLDOWN_SECONDS) {
    let remaining = Math.ceil(COOLDOWN_SECONDS - elapsed);
    if (scene) {
      scene.imageStatus = 'cooldown';
      scene.cooldownSeconds = remaining;
      renderVideoScenes();
    }

    while (remaining > 0) {
      if (isBatch && videoState.isGeneratingAll === false) break;
      await new Promise(r => setTimeout(r, 1000));
      remaining--;
      if (scene) {
        scene.cooldownSeconds = remaining;
        const timerEl = document.getElementById(`cooldown-timer-${scene.id}`);
        if (timerEl) {
          timerEl.textContent = `${remaining}s`;
        }
      }
    }
  }
}

function loadImageWithFallback(url, timeoutMs = 40000) {
  return new Promise((resolve, reject) => {
    let resolved = false;
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      reject(new Error('ইমেজ সার্ভার থেকে সাড়া আসতে বেশি সময় নিয়েছে।'));
    }, timeoutMs);

    // Try with crossOrigin first so canvas can check for rate limit banner
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      if (timedOut || resolved) return;
      resolved = true;
      clearTimeout(timer);
      resolve({ url, img });
    };

    img.onerror = () => {
      // Fallback: load without anonymous CORS
      const imgFallback = new Image();
      imgFallback.onload = () => {
        if (timedOut || resolved) return;
        resolved = true;
        clearTimeout(timer);
        resolve({ url, img: imgFallback });
      };
      imgFallback.onerror = () => {
        if (timedOut || resolved) return;
        resolved = true;
        clearTimeout(timer);
        reject(new Error('ইমেজ সার্ভার সাড়া দেয়নি।'));
      };
      imgFallback.src = url;
    };

    img.src = url;
  });
}

async function fetchImageBlobWithProxy(imageUrl) {
  // 1. Try local or Vercel proxy
  try {
    const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
    const res = await fetch(proxyUrl);
    if (res.ok) {
      return await res.blob();
    }
  } catch (e) {
    // Proxy not available or failed
  }

  // 2. Try direct CORS fetch
  try {
    const res = await fetch(imageUrl, { mode: 'cors' });
    if (res.ok) {
      return await res.blob();
    }
  } catch (e) {
    // Direct fetch CORS blocked
  }

  // 3. Try Canvas drawing
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 1280;
          canvas.height = img.naturalHeight || 720;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          canvas.toBlob(blob => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas blob failed'));
          }, 'image/jpeg', 0.92);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = reject;
      img.src = imageUrl;
    });
  } catch (e) {
    console.warn('Canvas export tainted or failed:', e);
  }

  return null;
}

async function generateSceneImage(sceneId, isBatch = false) {
  const scene = videoState.scenes.find(s => s.id === sceneId);
  if (!scene) return;

  // 1. Enforce cooldown if on free keyless tier (0s wait when API key is active)
  await waitForImageCooldown(scene, isBatch);

  // 2. Ensure 100% pure English visual prompt (Strict validation: never send Bengali text to image generator!)
  if (!scene.visualPrompt || /[\u0980-\u09FF]/.test(scene.visualPrompt) || scene.visualPrompt.startsWith('A cinematic shot depicting:')) {
    scene.visualPrompt = await generateVisualPromptForScene(scene.text, videoState.visualStyle, videoState.aspectRatio);
  }

  scene.imageStatus = 'generating';
  scene.imageError = '';
  renderVideoScenes();

  try {
    let width = 1280, height = 720;
    if (videoState.aspectRatio === '9:16') {
      width = 720;
      height = 1280;
    } else if (videoState.aspectRatio === '1:1') {
      width = 1024;
      height = 1024;
    }

    const seed = Math.floor(Math.random() * 10000000);
    const cleanPrompt = scene.visualPrompt.replace(/[\r\n"']/g, ' ').replace(/\s+/g, ' ').trim();

    const keys = state.pollinationsKeys && state.pollinationsKeys.length > 0
      ? state.pollinationsKeys
      : [DEFAULT_POLLINATIONS_KEY];
    const totalKeys = keys.length;

    let result = null;
    let lastError = null;

    // Multi-Key Loop: Automatically failover to next key if any key runs out of quota!
    for (let attempt = 0; attempt < totalKeys; attempt++) {
      const activeKey = getActivePollinationsKey();
      const keyParam = activeKey ? `&key=${encodeURIComponent(activeKey)}&token=${encodeURIComponent(activeKey)}` : '';
      const ts = Date.now();

      // Modern endpoint: gen.pollinations.ai (Accepts enter.pollinations.ai keys)
      const genUrl = `https://gen.pollinations.ai/image/${encodeURIComponent(cleanPrompt)}?model=flux&width=${width}&height=${height}&seed=${seed}&nologo=true&t=${ts}${keyParam}`;
      const legacyUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt)}?model=flux&width=${width}&height=${height}&seed=${seed}&nologo=true&t=${ts}${keyParam}`;

      try {
        try {
          result = await loadImageWithFallback(genUrl, 28000);
        } catch (errGen) {
          console.warn(`[Key #${state.currentPollinationsKeyIndex + 1}] gen.pollinations.ai error, trying legacy fallback:`, errGen);
          result = await loadImageWithFallback(legacyUrl, 32000);
        }

        // Check if rate-limit yellow banner was returned
        if (result && result.img && isRateLimitBanner(result.img)) {
          console.warn(`[Key #${state.currentPollinationsKeyIndex + 1}] Rate limit yellow banner detected.`);
          throw new Error('POLLINATIONS_RATE_LIMIT');
        }

        // Image successfully loaded!
        break;

      } catch (err) {
        lastError = err;
        console.warn(`[Key #${state.currentPollinationsKeyIndex + 1} Failed]`, err.message);

        // If another key is configured, auto-switch to it seamlessly!
        if (totalKeys > 1 && attempt < totalKeys - 1) {
          const prevKeyNum = state.currentPollinationsKeyIndex + 1;
          rotateToNextPollinationsKey();
          const nextKeyNum = state.currentPollinationsKeyIndex + 1;
          showToast(`কী #${prevKeyNum} এর কোটা শেষ। কোনো অপেক্ষা ছাড়াই কী #${nextKeyNum} দিয়ে ছবি তৈরি হচ্ছে...`, 'info');
          continue; // Instantly attempt with the next key!
        } else {
          break;
        }
      }
    }

    if (!result) {
      // If all keys exhausted their quota and rate-limit was hit:
      if (lastError && (lastError.message === 'POLLINATIONS_RATE_LIMIT' || isRateLimitBanner(result?.img))) {
        videoState.lastImageGeneratedTimestamp = Date.now();
        showToast(`দৃশ্য #${scene.id}: সব কী-এর কোটা সাময়িক শেষ। ৪৫ সেকেন্ড পর স্বয়ংক্রিয়ভাবে তৈরি হবে...`, 'info');
        await waitForImageCooldown(scene, isBatch);

        const retryActiveKey = getActivePollinationsKey();
        const retryKeyParam = retryActiveKey ? `&key=${encodeURIComponent(retryActiveKey)}&token=${encodeURIComponent(retryActiveKey)}` : '';
        const retryTs = Date.now();
        const retrySeed = Math.floor(Math.random() * 10000000);
        const retryUrl = `https://gen.pollinations.ai/image/${encodeURIComponent(cleanPrompt)}?model=flux&width=${width}&height=${height}&seed=${retrySeed}&nologo=true&t=${retryTs}${retryKeyParam}`;
        result = await loadImageWithFallback(retryUrl, 35000);

        if (result && result.img && isRateLimitBanner(result.img)) {
          throw new Error('সব কী-এর ফ্রি লিমিট শেষ হয়েছে। দয়া করে কিছুক্ষণ পর চেষ্টা করুন অথবা নতুন ফ্রি কী দিন।');
        }
      } else {
        throw (lastError || new Error('ছবি তৈরি করা যায়নি। আবার চেষ্টা করুন।'));
      }
    }

    videoState.lastImageGeneratedTimestamp = Date.now();
    scene.imageUrl = result.url;
    scene.imageStatus = 'ready';

    // Pre-cache blob in background for ZIP
    fetchImageBlobWithProxy(result.url).then(blob => {
      if (blob) scene.imageBlob = blob;
    }).catch(e => console.warn('Blob prefetch:', e));

  } catch (err) {
    console.error('Image gen error:', err);
    scene.imageStatus = 'error';
    scene.imageError = err.message || 'ছবি তৈরি করা যায়নি। আবার চেষ্টা করুন।';
  }

  renderVideoScenes();
}

async function generateSceneAudio(sceneId) {
  const scene = videoState.scenes.find(s => s.id === sceneId);
  if (!scene) return;

  scene.audioStatus = 'generating';
  scene.audioError = '';
  renderVideoScenes();

  try {
    const isFirebase = window.location.hostname.includes('web.app') || window.location.hostname.includes('firebaseapp.com');
    const apiEndpoint = isFirebase 
      ? 'https://gemini-audio-studio-seven.vercel.app/api/generate-audio' 
      : '/api/generate-audio';

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: state.apiKey,
        apiKeys: parseKeys(state.apiKey),
        text: scene.text,
        voice: videoState.voice || state.voice,
        model: state.model,
        tone: state.voiceTone
      })
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'অডিও তৈরি ব্যর্থ হয়েছে।');
    }

    const binaryStr = atob(data.audioBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const audioBlob = new Blob([bytes], { type: 'audio/wav' });
    if (scene.audioUrl) URL.revokeObjectURL(scene.audioUrl);
    scene.audioBlob = audioBlob;
    scene.audioUrl = URL.createObjectURL(audioBlob);
    scene.audioStatus = 'ready';
  } catch (err) {
    console.error('Audio gen error:', err);
    scene.audioStatus = 'error';
    scene.audioError = err.message || 'অডিও তৈরি করা যায়নি';
  }

  renderVideoScenes();
}

async function generateSceneBoth(sceneId) {
  await Promise.all([
    generateSceneAudio(sceneId),
    generateSceneImage(sceneId)
  ]);
}

async function generateAllVideoScenes(mode = 'both') {
  if (videoState.scenes.length === 0) {
    showToast('অনুগ্রহ করে প্রথমে স্ক্রিপ্ট দিয়ে সিন ভাগ করুন।', 'warning');
    return;
  }

  videoState.isGeneratingAll = true;
  updateVideoControlsUI();

  const total = videoState.scenes.length;
  for (let i = 0; i < total; i++) {
    if (!videoState.isGeneratingAll) break;

    const scene = videoState.scenes[i];
    const pct = Math.round(((i + 1) / total) * 100);
    
    if (elements.videoProgressBanner) elements.videoProgressBanner.classList.remove('hidden');
    if (elements.videoProgressPercent) elements.videoProgressPercent.textContent = `${pct}%`;
    if (elements.videoProgressBar) elements.videoProgressBar.style.width = `${pct}%`;
    if (elements.videoProgressText) {
      elements.videoProgressText.innerHTML = `
        <i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i>
        <span>দৃশ্য ${i + 1}/${total} তৈরি হচ্ছে...</span>
      `;
      if (window.lucide) window.lucide.createIcons();
    }

    const tasks = [];
    if (mode === 'both' || mode === 'audio') {
      if (!scene.audioBlob || scene.audioStatus === 'error') {
        tasks.push(generateSceneAudio(scene.id));
      }
    }
    if (mode === 'both' || mode === 'image') {
      if (!scene.imageUrl || scene.imageStatus === 'error') {
        tasks.push(generateSceneImage(scene.id, true));
      }
    }

    if (tasks.length > 0) {
      await Promise.all(tasks);
    }
  }

  videoState.isGeneratingAll = false;
  updateVideoControlsUI();
  if (elements.videoProgressBanner) elements.videoProgressBanner.classList.add('hidden');
  showToast('সবগুলো দৃশ্যের জেনারেশন সম্পন্ন হয়েছে!', 'success');
}

function handleStopVideoGeneration() {
  videoState.isGeneratingAll = false;
  updateVideoControlsUI();
  if (elements.videoProgressBanner) elements.videoProgressBanner.classList.add('hidden');
  showToast('জেনারেশন থামানো হয়েছে।', 'info');
}

function updateVideoControlsUI() {
  const isRunning = videoState.isGeneratingAll;
  if (elements.videoStopBtn) {
    elements.videoStopBtn.classList.toggle('hidden', !isRunning);
  }
  if (elements.videoGenerateAllBothBtn) {
    elements.videoGenerateAllBothBtn.disabled = isRunning;
    elements.videoGenerateAllBothBtn.classList.toggle('opacity-50', isRunning);
  }
  if (elements.videoGenerateAllImageBtn) {
    elements.videoGenerateAllImageBtn.disabled = isRunning;
  }
  if (elements.videoGenerateAllAudioBtn) {
    elements.videoGenerateAllAudioBtn.disabled = isRunning;
  }
  if (elements.videoDownloadZipBtn) {
    const hasWork = videoState.scenes.some(s => s.audioBlob || s.imageUrl);
    elements.videoDownloadZipBtn.disabled = !hasWork || isRunning;
  }
  if (elements.videoRenderFullMp4Btn) {
    const canRender = videoState.scenes.some(s => (s.audioBlob || s.audioUrl) && (s.imageBlob || s.imageUrl));
    elements.videoRenderFullMp4Btn.disabled = !canRender || isRunning;
  }
}

async function downloadVideoZip() {
  if (!window.JSZip) {
    showToast('ZIP লাইব্রেরি প্রস্তুত নয়।', 'error');
    return;
  }

  const hasItems = videoState.scenes.some(s => s.audioBlob || s.imageUrl);
  if (!hasItems) {
    showToast('ডাউনলোড করার মত অডিও বা ছবি এখনও নেই।', 'warning');
    return;
  }

  showToast('YouTube অডিও ও ভিডিও প্রজেক্টের ZIP তৈরি হচ্ছে...', 'info');

  try {
    const zip = new JSZip();
    // Create two separate clean subfolders: Images and Audios (No text files)
    const imageFolder = zip.folder('Images');
    const audioFolder = zip.folder('Audios');
    let count = 0;

    for (let idx = 0; idx < videoState.scenes.length; idx++) {
      const scene = videoState.scenes[idx];
      const pad = String(idx + 1).padStart(2, '0');

      // Add voiceover audio to Audios folder
      if (scene.audioBlob) {
        audioFolder.file(`Scene_${pad}.wav`, scene.audioBlob);
        count++;
      }

      // Add cinematic scene image to Images folder
      if (scene.imageBlob) {
        imageFolder.file(`Scene_${pad}.jpg`, scene.imageBlob);
        count++;
      } else if (scene.imageUrl) {
        const blob = await fetchImageBlobWithProxy(scene.imageUrl);
        if (blob) {
          scene.imageBlob = blob;
          imageFolder.file(`Scene_${pad}.jpg`, blob);
          count++;
        }
      }
    }

    // Include full rendered video if it exists
    if (videoState.renderedVideoBlob) {
      const ext = videoState.renderedVideoExt || 'mp4';
      zip.file(`Full_Story_Video.${ext}`, videoState.renderedVideoBlob);
      count++;
    }

    if (count === 0) {
      showToast('ডাউনলোড করার মত অডিও বা ছবি তৈরি হয়নি।', 'warning');
      return;
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `YouTube_Video_Project_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (videoState.renderedVideoBlob) {
      showToast('সম্পূর্ণ ভিডিও, ইমেজ ও অডিও সহ প্রজেক্ট ZIP ডাউনলোড সম্পন্ন হয়েছে!', 'success');
    } else {
      showToast('ইমেজ ও অডিও ফোল্ডার সহ ZIP ডাউনলোড হয়েছে! ফুল মোশন ভিডিওর জন্য "🎬 সম্পূর্ণ MP4 ভিডিও তৈরি" ক্লিক করুন।', 'success');
    }
  } catch (err) {
    showToast('ZIP ডাউনলোড ব্যর্থ হয়েছে: ' + err.message, 'error');
  }
}

// Global helpers for inline HTML event handlers
window.generateSceneBoth = generateSceneBoth;
window.generateSceneImage = generateSceneImage;
window.generateSceneAudio = generateSceneAudio;

window.updateVideoSceneText = function(id, newText) {
  const scene = videoState.scenes.find(s => s.id === id);
  if (scene) {
    scene.text = newText;
    scene.ambientSound = detectAmbientSound(newText);
    renderVideoScenes();
  }
};

window.updateVideoScenePrompt = function(id, newPrompt) {
  const scene = videoState.scenes.find(s => s.id === id);
  if (scene) scene.visualPrompt = newPrompt;
};

window.regenerateScenePrompt = async function(id) {
  const scene = videoState.scenes.find(s => s.id === id);
  if (scene) {
    showToast('নতুন সিনেমাটিক প্রম্পট তৈরি হচ্ছে...', 'info');
    scene.visualPrompt = await generateVisualPromptForScene(scene.text, videoState.visualStyle, videoState.aspectRatio);
    const inputEl = document.getElementById(`prompt-input-${id}`);
    if (inputEl) inputEl.value = scene.visualPrompt;
    showToast('সিনেমাটিক প্রম্পট আপডেট হয়েছে!', 'success');
  }
};

window.downloadSceneImage = async function(sceneId) {
  const scene = videoState.scenes.find(s => s.id === sceneId);
  if (!scene || !scene.imageUrl) return;
  const pad = String(scene.id).padStart(2, '0');
  const filename = `Scene_${pad}_image.jpg`;

  if (scene.imageBlob) {
    const blobUrl = URL.createObjectURL(scene.imageBlob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    return;
  }

  try {
    showToast('ছবি ডাউনলোড প্রস্তুত হচ্ছে...', 'info');
    const blob = await fetchImageBlobWithProxy(scene.imageUrl);
    if (blob) {
      scene.imageBlob = blob;
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      return;
    }
  } catch (e) {
    console.warn('Proxy download error:', e);
  }

  // Fallback: open in new tab
  window.open(scene.imageUrl, '_blank');
};

window.openVideoImageModal = function(imgSrc, title, downloadName) {
  if (elements.videoImageModal && elements.videoModalImage) {
    elements.videoModalImage.src = imgSrc;
    if (elements.videoModalTitle) elements.videoModalTitle.textContent = title + ' (1080p Full Preview)';
    if (elements.videoModalDownloadBtn) {
      elements.videoModalDownloadBtn.onclick = (e) => {
        e.preventDefault();
        const a = document.createElement('a');
        a.href = imgSrc;
        a.target = '_blank';
        a.download = downloadName || 'scene_image.jpg';
        a.click();
      };
    }
    elements.videoImageModal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }
};

// ==========================================
// In-Browser Ken Burns Video Renderer Engine
// 100% Free HTML5 Canvas + Web Audio API + MediaRecorder
// ==========================================
let renderCancelled = false;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = src;
  });
}

function drawImageCover(ctx, img, x, y, w, h) {
  if (!img || !img.width || !img.height) return;
  const imgRatio = img.width / img.height;
  const canvasRatio = w / h;
  let sWidth = img.width;
  let sHeight = img.height;
  let sx = 0;
  let sy = 0;

  if (imgRatio > canvasRatio) {
    sWidth = img.height * canvasRatio;
    sx = (img.width - sWidth) / 2;
  } else {
    sHeight = img.width / canvasRatio;
    sy = (img.height - sHeight) / 2;
  }

  ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, w, h);
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
  if (!text) return;
  const clean = text.replace(/\s+/g, ' ').trim();
  const words = clean.split(' ');
  const lines = [];
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = ctx.measureText(testLine).width;
    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
      if (lines.length >= 2) break;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine && lines.length < 2) {
    lines.push(currentLine);
  }

  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => {
    ctx.fillText(line, x, startY + (index * lineHeight));
  });
}

function cleanupRender(audioCtx) {
  videoState.isRenderingVideo = false;
  if (audioCtx && audioCtx.state !== 'closed') {
    try { audioCtx.close(); } catch (e) {}
  }
}

function closeVideoRenderModal() {
  renderCancelled = true;
  videoState.isRenderingVideo = false;
  if (elements.videoRenderPlayer) {
    try { elements.videoRenderPlayer.pause(); } catch (e) {}
  }
  if (elements.videoRenderModal) {
    elements.videoRenderModal.classList.add('hidden');
  }
}

// ==========================================
// Procedural Nature Sound Synthesizer
// 100% Free Web Audio API Mathematical Nature Ambience
// ==========================================
function generateNatureAmbienceBuffer(audioCtx, soundId, duration) {
  if (!audioCtx || duration <= 0) return null;

  const sampleRate = audioCtx.sampleRate || 44100;
  const totalSamples = Math.ceil(sampleRate * Math.max(1, duration));
  const buffer = audioCtx.createBuffer(2, totalSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  // Stateful Pink Noise Generators for realistic organic sound
  let bL0 = 0, bL1 = 0, bL2 = 0, bL3 = 0, bL4 = 0, bL5 = 0, bL6 = 0;
  let bR0 = 0, bR1 = 0, bR2 = 0, bR3 = 0, bR4 = 0, bR5 = 0, bR6 = 0;
  function pinkL() {
    const w = Math.random() * 2 - 1;
    bL0 = 0.99886 * bL0 + w * 0.0555179;
    bL1 = 0.99332 * bL1 + w * 0.0750759;
    bL2 = 0.96900 * bL2 + w * 0.1538520;
    bL3 = 0.86650 * bL3 + w * 0.3104856;
    bL4 = 0.55000 * bL4 + w * 0.5329522;
    bL5 = -0.7616 * bL5 - w * 0.0168980;
    const p = bL0 + bL1 + bL2 + bL3 + bL4 + bL5 + bL6 + w * 0.5362;
    bL6 = w * 0.115926;
    return p * 0.11;
  }
  function pinkR() {
    const w = Math.random() * 2 - 1;
    bR0 = 0.99886 * bR0 + w * 0.0555179;
    bR1 = 0.99332 * bR1 + w * 0.0750759;
    bR2 = 0.96900 * bR2 + w * 0.1538520;
    bR3 = 0.86650 * bR3 + w * 0.3104856;
    bR4 = 0.55000 * bR4 + w * 0.5329522;
    bR5 = -0.7616 * bR5 - w * 0.0168980;
    const p = bR0 + bR1 + bR2 + bR3 + bR4 + bR5 + bR6 + w * 0.5362;
    bR6 = w * 0.115926;
    return p * 0.11;
  }

  // Lowpass filter states
  let lpL = 0;
  let lpR = 0;

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;

    // Smooth fade in & fade out envelope (0.35s)
    let env = 1.0;
    if (t < 0.35) {
      env = t / 0.35;
    } else if (t > duration - 0.35) {
      env = Math.max(0, (duration - t) / 0.35);
    }

    let sampL = 0;
    let sampR = 0;

    switch (soundId) {
      case 'river_water':
      case 'river_night': {
        // Continuous gentle water flowing (low-passed pink noise)
        lpL = lpL * 0.92 + pinkL() * 0.08;
        lpR = lpR * 0.92 + pinkR() * 0.08;

        // Cyclic gentle wave swell every 3.2s
        const wave = 0.65 + 0.35 * Math.sin((2 * Math.PI * t) / 3.2);
        sampL = lpL * wave * 1.5;
        sampR = lpR * wave * 1.5;

        // If river at night: subtle cricket chirping in distance
        if (soundId === 'river_night') {
          const cricketCycle = (t % 1.5);
          if (cricketCycle < 0.18) {
            const cSine = Math.sin(2 * Math.PI * 4700 * t);
            const cPulse = Math.sin(2 * Math.PI * 25 * cricketCycle) > 0 ? 1 : 0;
            sampL += cSine * cPulse * 0.035;
            sampR += cSine * cPulse * 0.04;
          }
        }
        break;
      }

      case 'night_forest': {
        // Soft quiet night air
        sampL = pinkL() * 0.18;
        sampR = pinkR() * 0.18;

        // Rhythmic forest crickets (3 rapid chirp pulses every 1.25s)
        const cycle = t % 1.25;
        if (cycle < 0.22) {
          const pulse = Math.sin(2 * Math.PI * 24 * cycle) > 0 ? 1 : 0;
          const toneL = Math.sin(2 * Math.PI * 4650 * t);
          const toneR = Math.sin(2 * Math.PI * 4800 * (t + 0.015));
          sampL += toneL * pulse * 0.06;
          sampR += toneR * pulse * 0.065;
        }
        break;
      }

      case 'morning_birds': {
        // Gentle dawn breeze
        lpL = lpL * 0.95 + pinkL() * 0.05;
        lpR = lpR * 0.95 + pinkR() * 0.05;
        sampL = lpL * 0.8;
        sampR = lpR * 0.8;

        // Sweet bird chirps at intervals (at ~0.8s, ~2.2s, ~3.8s, ~5.4s)
        const birdCycle = t % 1.8;
        if (birdCycle > 0.4 && birdCycle < 0.52) {
          const chirpProgress = (birdCycle - 0.4) / 0.12;
          const freq = 3100 - chirpProgress * 800; // 3100 Hz down to 2300 Hz
          const birdTone = Math.sin(2 * Math.PI * freq * t);
          const birdEnv = Math.sin(Math.PI * chirpProgress);
          sampL += birdTone * birdEnv * 0.08;
          sampR += birdTone * birdEnv * 0.06;
        }
        break;
      }

      case 'rain_storm': {
        // Soft rain droplets texture (white + pink noise combo)
        const whiteL = (Math.random() * 2 - 1) * 0.12;
        const whiteR = (Math.random() * 2 - 1) * 0.12;
        sampL = pinkL() * 0.35 + whiteL;
        sampR = pinkR() * 0.35 + whiteR;

        // Distant wind modulation
        const windGust = 0.7 + 0.3 * Math.sin((2 * Math.PI * t) / 4.0);
        sampL *= windGust;
        sampR *= windGust;
        break;
      }

      case 'wind_breeze': {
        // Resonant sweeping wind
        const cutoff = 0.92 + 0.05 * Math.sin((2 * Math.PI * t) / 3.8);
        lpL = lpL * cutoff + pinkL() * (1 - cutoff);
        lpR = lpR * cutoff + pinkR() * (1 - cutoff);
        sampL = lpL * 1.6;
        sampR = lpR * 1.6;
        break;
      }

      case 'dramatic_suspense': {
        // Low ominous sub-bass drone with 1.8 Hz acoustic beat
        const drone = Math.sin(2 * Math.PI * 55 * t) * 0.12 + Math.sin(2 * Math.PI * 56.8 * t) * 0.08;
        lpL = lpL * 0.96 + pinkL() * 0.04;
        lpR = lpR * 0.96 + pinkR() * 0.04;
        sampL = drone + lpL * 0.6;
        sampR = drone + lpR * 0.6;
        break;
      }

      case 'peaceful_nature':
      default: {
        // Calm atmospheric outdoor presence + warm harmonic pad
        lpL = lpL * 0.94 + pinkL() * 0.06;
        lpR = lpR * 0.94 + pinkR() * 0.06;
        const pad = (Math.sin(2 * Math.PI * 220 * t) + Math.sin(2 * Math.PI * 330 * t)) * 0.025;
        sampL = lpL * 0.9 + pad;
        sampR = lpR * 0.9 + pad;
        break;
      }
    }

    left[i] = Math.max(-1, Math.min(1, sampL * env));
    right[i] = Math.max(-1, Math.min(1, sampR * env));
  }

  return buffer;
}

let currentAmbientPreview = null;
window.previewAmbientSound = function(soundId) {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') ctx.resume();

    if (currentAmbientPreview) {
      try { currentAmbientPreview.stop(); } catch (e) {}
    }

    const buf = generateNatureAmbienceBuffer(ctx, soundId, 4.0);
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = 0.35;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
    currentAmbientPreview = src;
    showToast('প্রাকৃতিক আবহ সাউন্ড বাজছে (৪ সেকেন্ড)...', 'info');
  } catch (e) {
    console.warn('Preview sound error:', e);
  }
};

async function startVideoRendering() {
  if (videoState.isRenderingVideo) return;

  const validScenes = videoState.scenes.filter(s => (s.audioBlob || s.audioUrl) && (s.imageBlob || s.imageUrl));
  if (validScenes.length === 0) {
    showToast('ভিডিও বানানোর জন্য অন্তত একটি দৃশ্যের অডিও ও ছবি জেনারেট থাকতে হবে। "🎬 ভিডিও ও অডিও জেনারেট" বাটনে ক্লিক করুন।', 'warning');
    return;
  }

  if (!elements.videoRenderModal) return;
  elements.videoRenderModal.classList.remove('hidden');
  renderCancelled = false;
  videoState.isRenderingVideo = true;

  // Reset UI elements
  if (elements.videoRenderProgressBox) elements.videoRenderProgressBox.classList.remove('hidden');
  if (elements.videoRenderCanvasWrapper) elements.videoRenderCanvasWrapper.classList.remove('hidden');
  if (elements.videoRenderPlayerWrapper) elements.videoRenderPlayerWrapper.classList.add('hidden');
  if (elements.videoRenderProgressBar) elements.videoRenderProgressBar.style.width = '0%';
  if (elements.videoRenderPercent) elements.videoRenderPercent.textContent = '০%';
  if (elements.videoRenderStatusText) {
    elements.videoRenderStatusText.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>মিডিয়া প্রিলোড ও প্রস্তুত হচ্ছে...</span>`;
    if (window.lucide) window.lucide.createIcons();
  }

  const canvas = elements.videoRenderCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Set resolution based on format
  if (videoState.aspectRatio === '9:16') {
    canvas.width = 720;
    canvas.height = 1280;
  } else if (videoState.aspectRatio === '1:1') {
    canvas.width = 720;
    canvas.height = 720;
  } else {
    canvas.width = 1280;
    canvas.height = 720;
  }

  let audioCtx = null;
  let recorder = null;

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }

    // Step 1: Preload and decode all scene assets in advance
    const preloaded = [];
    for (let i = 0; i < validScenes.length; i++) {
      if (renderCancelled) break;
      const scene = validScenes[i];
      if (elements.videoRenderStatusText) {
        elements.videoRenderStatusText.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>মিডিয়া লোড হচ্ছে (${i + 1}/${validScenes.length})...</span>`;
        if (window.lucide) window.lucide.createIcons();
      }

      // Preload Image
      let img = null;
      try {
        let imgBlob = scene.imageBlob;
        if (!imgBlob && scene.imageUrl) {
          imgBlob = await fetchImageBlobWithProxy(scene.imageUrl);
          scene.imageBlob = imgBlob;
        }
        if (imgBlob) {
          const objectUrl = URL.createObjectURL(imgBlob);
          img = await loadImage(objectUrl);
        }
      } catch (err) {
        console.warn(`Scene ${scene.id} image preload warning:`, err);
      }

      // Decode Audio
      let audioBuffer = null;
      let duration = 4.0; // default 4s if audio missing
      if (scene.audioBlob) {
        try {
          const ab = await scene.audioBlob.arrayBuffer();
          audioBuffer = await audioCtx.decodeAudioData(ab);
          duration = audioBuffer.duration;
        } catch (err) {
          console.warn(`Scene ${scene.id} audio decode warning:`, err);
        }
      }

      preloaded.push({ scene, img, audioBuffer, duration });
    }

    if (renderCancelled) {
      cleanupRender(audioCtx);
      return;
    }

    // Step 2: Configure Canvas + Audio Stream Capture
    const audioDest = audioCtx.createMediaStreamDestination();
    const canvasStream = canvas.captureStream(30);
    const audioTracks = audioDest.stream.getAudioTracks();
    const videoTracks = canvasStream.getVideoTracks();
    const combinedStream = new MediaStream([...videoTracks, ...audioTracks]);

    let mimeType = 'video/webm;codecs=vp9,opus';
    if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a.40.2')) {
      mimeType = 'video/mp4;codecs=avc1,mp4a.40.2';
    } else if (MediaRecorder.isTypeSupported('video/mp4')) {
      mimeType = 'video/mp4';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
      mimeType = 'video/webm;codecs=vp9,opus';
    } else if (MediaRecorder.isTypeSupported('video/webm')) {
      mimeType = 'video/webm';
    }

    const recordedChunks = [];
    recorder = new MediaRecorder(combinedStream, {
      mimeType: mimeType,
      videoBitsPerSecond: 3500000 // High-quality 3.5 Mbps HD bitrate
    });

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };

    recorder.start(100);
    const totalScenes = preloaded.length;

    // Step 3: Sequentially render scenes with smooth Ken Burns motion & voiceover
    for (let idx = 0; idx < totalScenes; idx++) {
      if (renderCancelled) break;
      const { scene, img, audioBuffer, duration } = preloaded[idx];
      const sceneNum = idx + 1;

      if (elements.videoRenderStatusText) {
        elements.videoRenderStatusText.innerHTML = `<i data-lucide="video" class="w-4 h-4 text-emerald-400 animate-pulse"></i><span>দৃশ্য ${sceneNum}/${totalScenes} রেন্ডার হচ্ছে...</span>`;
        if (window.lucide) window.lucide.createIcons();
      }

      // Stream the voiceover audio
      if (audioBuffer) {
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioDest);
        source.start();
      }

      // Stream the automatic natural ambient sound for this scene
      if (scene.ambientSound && scene.ambientSound.id) {
        try {
          const ambientBuf = generateNatureAmbienceBuffer(audioCtx, scene.ambientSound.id, duration);
          if (ambientBuf) {
            const ambientSource = audioCtx.createBufferSource();
            ambientSource.buffer = ambientBuf;
            const ambientGain = audioCtx.createGain();
            // Subtle 15% volume so the voiceover is 100% crystal-clear and prominent
            ambientGain.gain.setValueAtTime(0.16, audioCtx.currentTime);
            ambientGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
            ambientSource.connect(ambientGain);
            ambientGain.connect(audioDest);
            ambientSource.start();
          }
        } catch (ambientErr) {
          console.warn('Ambient sound synthesis error:', ambientErr);
        }
      }

      // Frame animation loop
      const fps = 30;
      const totalFrames = Math.max(15, Math.round(duration * fps));
      const frameDurationMs = 1000 / fps;
      const isEven = idx % 2 === 0;

      for (let frame = 0; frame < totalFrames; frame++) {
        if (renderCancelled) break;
        const p = frame / totalFrames; // 0.0 to 1.0

        // Ken Burns effect: subtle scale (1.0 to 1.12) & gentle pan
        const zoom = isEven ? (1.0 + p * 0.12) : (1.12 - p * 0.12);
        const panX = isEven ? ((p - 0.5) * 36) : ((0.5 - p) * 36);
        const panY = isEven ? ((p - 0.5) * 18) : ((0.5 - p) * 18);

        // Draw background and transformed image
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#090d16';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (img) {
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.scale(zoom, zoom);
          ctx.translate(-canvas.width / 2 + panX, -canvas.height / 2 + panY);
          drawImageCover(ctx, img, 0, 0, canvas.width, canvas.height);
        }
        ctx.restore();

        // Cinematic bottom vignette for subtitle readability
        const vignetteH = Math.min(160, canvas.height * 0.28);
        const grad = ctx.createLinearGradient(0, canvas.height - vignetteH, 0, canvas.height);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.85)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, canvas.height - vignetteH, canvas.width, vignetteH);

        // Bengali subtitle caption
        if (scene.text) {
          ctx.fillStyle = '#ffffff';
          const fontSize = canvas.width > 800 ? 24 : 18;
          ctx.font = `600 ${fontSize}px 'Hind Siliguri', 'Noto Sans Bengali', sans-serif`;
          ctx.textAlign = 'center';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
          ctx.shadowBlur = 10;
          drawWrappedText(ctx, scene.text, canvas.width / 2, canvas.height - (fontSize * 1.8), canvas.width - 80, fontSize * 1.35);
          ctx.shadowBlur = 0;
        }

        // Update overall progress bar
        const overallPercent = Math.min(100, Math.round(((idx + p) / totalScenes) * 100));
        if (elements.videoRenderProgressBar) elements.videoRenderProgressBar.style.width = overallPercent + '%';
        if (elements.videoRenderPercent) elements.videoRenderPercent.textContent = overallPercent + '%';

        await new Promise(r => setTimeout(r, frameDurationMs));
      }
    }

    if (renderCancelled) {
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      cleanupRender(audioCtx);
      return;
    }

    // Brief 300ms tail delay to ensure clean end
    await new Promise(r => setTimeout(r, 300));

    // Finish recording and display video
    recorder.onstop = () => {
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
      const blob = new Blob(recordedChunks, { type: mimeType });
      videoState.renderedVideoBlob = blob;
      videoState.renderedVideoExt = ext;
      videoState.isRenderingVideo = false;

      const videoUrl = URL.createObjectURL(blob);
      if (elements.videoRenderPlayer) {
        elements.videoRenderPlayer.src = videoUrl;
        elements.videoRenderPlayer.play().catch(() => {});
      }

      if (elements.videoRenderDownloadBtn) {
        elements.videoRenderDownloadBtn.href = videoUrl;
        elements.videoRenderDownloadBtn.download = `YouTube_Story_Video_${Date.now()}.${ext}`;
      }

      // Update UI to completed state
      if (elements.videoRenderProgressBox) elements.videoRenderProgressBox.classList.add('hidden');
      if (elements.videoRenderCanvasWrapper) elements.videoRenderCanvasWrapper.classList.add('hidden');
      if (elements.videoRenderPlayerWrapper) elements.videoRenderPlayerWrapper.classList.remove('hidden');

      // Auto trigger video download
      const a = document.createElement('a');
      a.href = videoUrl;
      a.download = `YouTube_Story_Video_${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      showToast('সম্পূর্ণ MP4 সিনেমাটিক ভিডিও তৈরি ও ডাউনলোড সম্পন্ন হয়েছে!', 'success');
      cleanupRender(audioCtx);
    };

    recorder.stop();

  } catch (err) {
    console.error('Video render error:', err);
    showToast('ভিডিও রেন্ডারিংয়ে সমস্যা হয়েছে: ' + err.message, 'error');
    cleanupRender(audioCtx);
  }
}

window.startVideoRendering = startVideoRendering;
window.closeVideoRenderModal = closeVideoRenderModal;

// Start app on DOM loaded
document.addEventListener('DOMContentLoaded', init);

