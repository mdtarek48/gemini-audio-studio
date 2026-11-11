// State Management
const state = {
  apiKey: localStorage.getItem('gemini_api_key') || '',
  voice: localStorage.getItem('gemini_voice') || 'Kore',
  voiceTone: localStorage.getItem('gemini_voice_tone') || 'Bright, sunny, welcoming morning greeting with a subtle vocal smile and crisp pacing',
  model: localStorage.getItem('gemini_model') || 'gemini-3.8-flash-tts',
  autoPlay: localStorage.getItem('gemini_autoplay') !== 'false',
  chunks: [],
  isGeneratingAll: false
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
  toastNotification: document.getElementById('toastNotification')
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

function setupEventListeners() {
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

// Start app on DOM loaded
document.addEventListener('DOMContentLoaded', init);

