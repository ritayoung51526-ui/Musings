// Story Engine v3: Robust Natural TTS, Dictionary, Written Chinese Translation, and UI Localization

(function() {
  // State variables
  let isDictOn = false;
  let isTransOn = false;
  let currentGroupIdx = 0;
  let paraGroups = [];
  let isPlaying = false;
  let isPaused = false;
  let speechRate = 0.92;
  let currentUtterance = null;
  let isSpeakingLock = false;
  let availableVoices = [];
  let selectedVoice = null;
  let currentLang = localStorage.getItem('site_lang') || 'en';

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    setupLocalization();
    setupTranslationToggle();
    setupDictionary();
    setupTTS();
    setupQuiz();
  }

  /* -------------------------------------------------------------
     1. SITE-WIDE LANGUAGE LOCALIZATION (EN / 繁中)
  ------------------------------------------------------------- */
  function setupLocalization() {
    const langBtn = document.getElementById('langToggleBtn');
    applyLanguage(currentLang);

    if (langBtn) {
      langBtn.addEventListener('click', () => {
        currentLang = currentLang === 'en' ? 'zh' : 'en';
        localStorage.setItem('site_lang', currentLang);
        applyLanguage(currentLang);
      });
    }
  }

  function applyLanguage(lang) {
    const langBtn = document.getElementById('langToggleBtn');
    if (langBtn) {
      langBtn.textContent = lang === 'en' ? '🌐 繁中' : '🌐 English';
    }

    document.querySelectorAll('[data-en]').forEach(elem => {
      if (lang === 'zh' && elem.dataset.zh) {
        elem.textContent = elem.dataset.zh;
      } else if (elem.dataset.en) {
        elem.textContent = elem.dataset.en;
      }
    });

    // Update buttons if present
    const dictToggleBtn = document.getElementById('dictToggleBtn');
    if (dictToggleBtn) {
      if (lang === 'zh') {
        dictToggleBtn.textContent = isDictOn ? '📖 生字註釋: 開' : '📖 生字註釋: 關';
      } else {
        dictToggleBtn.textContent = isDictOn ? '📖 Vocabulary: ON' : '📖 Vocabulary: OFF';
      }
    }

    const transToggleBtn = document.getElementById('transToggleBtn');
    if (transToggleBtn) {
      if (lang === 'zh') {
        transToggleBtn.textContent = isTransOn ? '🌐 中文翻譯: 開' : '🌐 中文翻譯: 關';
      } else {
        transToggleBtn.textContent = isTransOn ? '🌐 Translation: ON' : '🌐 Translation: OFF';
      }
    }

    const listenBtn = document.getElementById('listenBtn');
    if (listenBtn) {
      if (lang === 'zh') {
        listenBtn.textContent = '🎧 語音朗讀';
      } else {
        listenBtn.textContent = '🎧 Listen Audio';
      }
    }
  }

  /* -------------------------------------------------------------
     2. WRITTEN CHINESE TRANSLATION TOGGLE
  ------------------------------------------------------------- */
  function setupTranslationToggle() {
    const transToggleBtn = document.getElementById('transToggleBtn');
    if (!transToggleBtn) return;

    transToggleBtn.addEventListener('click', () => {
      isTransOn = !isTransOn;
      document.body.classList.toggle('trans-mode-on', isTransOn);
      if (currentLang === 'zh') {
        transToggleBtn.textContent = isTransOn ? '🌐 中文翻譯: 開' : '🌐 中文翻譯: 關';
      } else {
        transToggleBtn.textContent = isTransOn ? '🌐 Translation: ON' : '🌐 Translation: OFF';
      }
      transToggleBtn.classList.toggle('active', isTransOn);
    });
  }

  /* -------------------------------------------------------------
     3. DICTIONARY MODE (STANDARD WRITTEN CHINESE)
  ------------------------------------------------------------- */
  function setupDictionary() {
    if (!document.getElementById('dictModal')) {
      const modalHtml = `
        <div id="dictModal" class="dict-modal-backdrop" aria-hidden="true">
          <div class="dict-card">
            <div class="dict-top">
              <div>
                <div class="dict-word-group">
                  <span id="dictWord" class="dict-word">Word</span>
                  <span id="dictPos" class="dict-pos">POS</span>
                  <span id="dictPhonetic" class="dict-phonetic">/phonetic/</span>
                </div>
                <button id="dictSpeakBtn" class="dict-speak-btn" title="Pronounce">🔊 Listen Pronunciation</button>
              </div>
              <button id="dictCloseBtn" class="dict-close" aria-label="Close">&times;</button>
            </div>
            <div id="dictMeaning" class="dict-meaning">Definition</div>
            <div id="dictExample" class="dict-example">Example sentence</div>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    const dictToggleBtn = document.getElementById('dictToggleBtn');
    const modal = document.getElementById('dictModal');
    const closeBtn = document.getElementById('dictCloseBtn');
    const speakBtn = document.getElementById('dictSpeakBtn');

    if (dictToggleBtn) {
      dictToggleBtn.addEventListener('click', () => {
        isDictOn = !isDictOn;
        document.body.classList.toggle('dict-mode-on', isDictOn);
        if (currentLang === 'zh') {
          dictToggleBtn.textContent = isDictOn ? '📖 生字註釋: 開' : '📖 生字註釋: 關';
        } else {
          dictToggleBtn.textContent = isDictOn ? '📖 Vocabulary: ON' : '📖 Vocabulary: OFF';
        }
        dictToggleBtn.classList.toggle('active', isDictOn);
        if (!isDictOn) closeModal();
      });
    }

    document.addEventListener('click', (e) => {
      const vocabElem = e.target.closest('.vocab');
      if (vocabElem && isDictOn) {
        e.preventDefault();
        openModal(vocabElem);
      }
    });

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });

    let currentVocabWord = '';
    function openModal(elem) {
      currentVocabWord = elem.dataset.word || elem.textContent.trim();
      document.getElementById('dictWord').textContent = currentVocabWord;
      document.getElementById('dictPhonetic').textContent = elem.dataset.phonetic || '';
      document.getElementById('dictPos').textContent = elem.dataset.pos || 'VOCAB';
      document.getElementById('dictMeaning').textContent = elem.dataset.meaning || 'No definition provided.';
      document.getElementById('dictExample').textContent = elem.dataset.eg ? `"${elem.dataset.eg}"` : `Context: "${elem.textContent}"`;

      modal.classList.add('show');
      modal.setAttribute('aria-hidden', 'false');
    }

    function closeModal() {
      if (modal) {
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
      }
    }

    if (speakBtn) {
      speakBtn.addEventListener('click', () => {
        if (!currentVocabWord || !window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(currentVocabWord);
        utter.lang = 'en-US';
        utter.rate = 0.88;
        if (selectedVoice) utter.voice = selectedVoice;
        window.speechSynthesis.speak(utter);
      });
    }
  }

  /* -------------------------------------------------------------
     4. ROBUST TTS ENGINE (NO REPEATING / NO DESYNC)
  ------------------------------------------------------------- */
  function setupTTS() {
    const listenBtn = document.getElementById('listenBtn');
    const playerPanel = document.getElementById('audioPlayerPanel');
    const playPauseBtn = document.getElementById('audioPlayPauseBtn');
    const stopBtn = document.getElementById('audioStopBtn');
    const statusText = document.getElementById('audioStatus');
    const speedButtons = document.querySelectorAll('.speed-btn');

    const storyElem = document.querySelector('.story');
    if (!storyElem) return;

    const detectedGroups = storyElem.querySelectorAll('.story-para-group');
    if (detectedGroups.length > 0) {
      paraGroups = Array.from(detectedGroups);
    } else {
      paraGroups = Array.from(storyElem.querySelectorAll('p'));
    }

    if (!('speechSynthesis' in window)) {
      if (listenBtn) {
        listenBtn.addEventListener('click', () => {
          alert('Web Speech Audio is not supported in this browser. Please try Chrome or Safari.');
        });
      }
      return;
    }

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    function loadVoices() {
      const allVoices = window.speechSynthesis.getVoices();
      availableVoices = allVoices.filter(v => v.lang.startsWith('en'));

      let voiceSelect = document.getElementById('voiceSelect');
      if (!voiceSelect && playerPanel) {
        const header = playerPanel.querySelector('.audio-header');
        if (header) {
          const pickerGroup = document.createElement('div');
          pickerGroup.className = 'voice-picker-group';
          pickerGroup.innerHTML = `
            <label for="voiceSelect" style="color:var(--muted); font-size:0.8rem;">Voice:</label>
            <select id="voiceSelect" class="voice-select"></select>
          `;
          header.appendChild(pickerGroup);
          voiceSelect = document.getElementById('voiceSelect');
        }
      }

      if (voiceSelect && availableVoices.length > 0) {
        voiceSelect.innerHTML = '';
        availableVoices.sort((a, b) => {
          const aRank = (a.name.includes('Natural') || a.name.includes('Google') || a.name.includes('Neural') || a.name.includes('Premium') || a.name.includes('Samantha') || a.name.includes('Karen')) ? 1 : 0;
          const bRank = (b.name.includes('Natural') || b.name.includes('Google') || b.name.includes('Neural') || b.name.includes('Premium') || b.name.includes('Samantha') || b.name.includes('Karen')) ? 1 : 0;
          return bRank - aRank;
        });

        availableVoices.forEach((v, i) => {
          const opt = document.createElement('option');
          opt.value = i;
          let label = v.name.replace(/Microsoft |Google |Apple /g, '');
          if (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Neural') || v.name.includes('Samantha')) {
            label = '🌟 ' + label;
          }
          opt.textContent = `${label} (${v.lang})`;
          voiceSelect.appendChild(opt);
        });

        selectedVoice = availableVoices[0];
        voiceSelect.selectedIndex = 0;

        voiceSelect.addEventListener('change', (e) => {
          const idx = parseInt(e.target.value);
          selectedVoice = availableVoices[idx] || availableVoices[0];
          if (isPlaying && !isPaused) {
            safeStartPlay(currentGroupIdx);
          }
        });
      }
    }

    if (listenBtn) {
      listenBtn.addEventListener('click', () => {
        if (playerPanel) {
          playerPanel.classList.toggle('show');
          if (playerPanel.classList.contains('show') && !isPlaying) {
            safeStartPlay(currentGroupIdx);
          }
        }
      });
    }

    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', () => {
        if (!isPlaying) {
          safeStartPlay(currentGroupIdx);
        } else if (isPaused) {
          resumePlay();
        } else {
          pausePlay();
        }
      });
    }

    if (stopBtn) {
      stopBtn.addEventListener('click', stopPlay);
    }

    speedButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        speedButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        speechRate = parseFloat(btn.dataset.speed) || 0.92;
        if (isPlaying && !isPaused) {
          safeStartPlay(currentGroupIdx);
        }
      });
    });

    paraGroups.forEach((group, idx) => {
      group.style.cursor = 'pointer';
      group.title = 'Click to jump playback here';
      group.addEventListener('click', (e) => {
        if (e.target.closest('.vocab') && isDictOn) return;
        currentGroupIdx = idx;
        if (playerPanel && !playerPanel.classList.contains('show')) {
          playerPanel.classList.add('show');
        }
        safeStartPlay(idx);
      });
    });

    function clearActiveUtterance() {
      if (currentUtterance) {
        currentUtterance.onend = null;
        currentUtterance.onerror = null;
        currentUtterance = null;
      }
      window.speechSynthesis.cancel();
    }

    function safeStartPlay(startIdx) {
      if (isSpeakingLock) return;
      isSpeakingLock = true;

      clearActiveUtterance();
      currentGroupIdx = Math.max(0, Math.min(startIdx, paraGroups.length - 1));
      isPlaying = true;
      isPaused = false;
      updatePlayerUI();

      setTimeout(() => {
        isSpeakingLock = false;
        speakParagraph(currentGroupIdx);
      }, 50);
    }

    function speakParagraph(idx) {
      if (!isPlaying || isPaused) return;

      if (idx >= paraGroups.length) {
        stopPlay();
        if (statusText) statusText.textContent = currentLang === 'zh' ? '全文朗讀完畢 ✨' : 'Story completed ✨';
        return;
      }

      currentGroupIdx = idx;
      updateHighlight(idx);
      updateStatus();

      const group = paraGroups[idx];
      const enElem = group.querySelector('.para-en') || group;
      const text = enElem.textContent.replace(/[\n\r]+/g, ' ').trim();

      if (!text) {
        speakParagraph(idx + 1);
        return;
      }

      clearActiveUtterance();

      currentUtterance = new SpeechSynthesisUtterance(text);
      currentUtterance.lang = 'en-US';
      currentUtterance.rate = speechRate;
      currentUtterance.pitch = 1.0;

      if (selectedVoice) {
        currentUtterance.voice = selectedVoice;
      }

      currentUtterance.onend = () => {
        if (isPlaying && !isPaused) {
          speakParagraph(idx + 1);
        }
      };

      currentUtterance.onerror = (err) => {
        // Only advance if not deliberately canceled
        if (err.error !== 'canceled' && isPlaying && !isPaused) {
          speakParagraph(idx + 1);
        }
      };

      window.speechSynthesis.speak(currentUtterance);
    }

    function pausePlay() {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        isPaused = true;
        updatePlayerUI();
      }
    }

    function resumePlay() {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        isPaused = false;
        updatePlayerUI();
      } else {
        safeStartPlay(currentGroupIdx);
      }
    }

    function stopPlay() {
      clearActiveUtterance();
      isPlaying = false;
      isPaused = false;
      currentGroupIdx = 0;
      updateHighlight(-1);
      updatePlayerUI();
      if (statusText) statusText.textContent = currentLang === 'zh' ? '已停止播放' : 'Stopped. Click Play to listen.';
    }

    function updateHighlight(activeIdx) {
      paraGroups.forEach((group, i) => {
        if (i === activeIdx) {
          group.classList.add('reading-active');
          group.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          group.classList.remove('reading-active');
        }
      });
    }

    function updatePlayerUI() {
      if (!playPauseBtn) return;
      if (!isPlaying || isPaused) {
        playPauseBtn.textContent = currentLang === 'zh' ? '▶ 播放' : '▶ Play';
      } else {
        playPauseBtn.textContent = currentLang === 'zh' ? '⏸ 暫停' : '⏸ Pause';
      }
      updateStatus();
    }

    function updateStatus() {
      if (!statusText) return;
      if (isPlaying) {
        const pausedLabel = isPaused ? (currentLang === 'zh' ? ' (已暫停)' : ' (Paused)') : '';
        statusText.textContent = currentLang === 'zh' 
          ? `朗讀中：第 ${currentGroupIdx + 1} / ${paraGroups.length} 段${pausedLabel}`
          : `Reading paragraph ${currentGroupIdx + 1} of ${paraGroups.length}${pausedLabel}`;
      } else {
        statusText.textContent = currentLang === 'zh' ? '語音就緒' : 'Audio ready';
      }
    }
  }

  /* -------------------------------------------------------------
     5. QUICK QUIZ ENGINE (STANDARD WRITTEN CHINESE)
  ------------------------------------------------------------- */
  function setupQuiz() {
    const quizItems = document.querySelectorAll('.quiz-item');
    let answered = 0;
    let score = 0;
    const summaryElem = document.getElementById('quizSummary');

    quizItems.forEach(item => {
      const options = item.querySelectorAll('.quiz-opt');
      const feedback = item.querySelector('.quiz-feedback');

      options.forEach(opt => {
        opt.addEventListener('click', () => {
          options.forEach(o => o.disabled = true);
          answered++;

          const isCorrect = opt.dataset.correct === 'true';
          if (isCorrect) {
            opt.classList.add('correct');
            score++;
            if (feedback) {
              feedback.className = 'quiz-feedback show correct';
              feedback.innerHTML = `<strong>✅ 正確！</strong> ${feedback.dataset.explain || ''}`;
            }
          } else {
            opt.classList.add('wrong');
            const correctOpt = item.querySelector('.quiz-opt[data-correct="true"]');
            if (correctOpt) correctOpt.classList.add('correct');
            if (feedback) {
              feedback.className = 'quiz-feedback show wrong';
              feedback.innerHTML = `<strong>❌ 不完全正確。</strong> ${feedback.dataset.explain || ''}`;
            }
          }

          if (summaryElem && answered === quizItems.length) {
            summaryElem.classList.add('show');
            summaryElem.innerHTML = `🎉 測驗完成！你答對了 <strong>${score}</strong> / <strong>${quizItems.length}</strong> 題！`;
          }
        });
      });
    });
  }
})();
