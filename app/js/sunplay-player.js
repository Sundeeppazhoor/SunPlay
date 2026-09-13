/**
 * SunPlay — High Performance Native Player Engine
 * Optimized for LG webOS TVs:
 * - Direct zero-copy hardware media decoding
 * - Memory-safe buffering (prevents webOS SAM low-memory restarts on 4K Remux files)
 * - Single-click Back key to return to menu
 * - Clean title formatting (strips messy release tags & long hashes)
 * - Beautiful SVG icons for all controls (including ↺10s and ↻10s)
 * - Dual Subtitle Engine (embedded MKV/MP4 text tracks + OpenSubtitles v3 + sidecar probing)
 * - Live Subtitle Customization (Font size, Color, Box/None, Delay Sync)
 * - Multi-audio stream selection
 * - Aspect ratio switcher (Original, 16:9 Stretch, Zoom 1.15x, Fill/Crop)
 * - Auto-resume position tracking
 */

window.SunPlay = window.SunPlay || {};

SunPlay.Player = (function () {
    'use strict';

    var container = null;
    var video = null;
    var osdWrapper = null;
    var subOverlay = null;
    var sheetOverlay = null;
    var infoOverlay = null;

    var isVisible = false;
    var hideTimer = null;
    var HIDE_DELAY = 4000;

    var currentUrl = '';
    var currentRawTitle = '';
    var displayTitle = 'Stream';
    var isPlaying = false;
    var isBuffering = false;

    var aspectModes = [
        { label: 'Original', fit: 'contain', scale: 1 },
        { label: '16:9 Stretch', fit: 'fill', scale: 1 },
        { label: 'Zoom (1.15x)', fit: 'cover', scale: 1.15 },
        { label: 'Fill / Crop', fit: 'cover', scale: 1 }
    ];
    var aspectIndex = 0;

    var audioTracks = [];
    var selectedAudioIndex = 0;

    var subtitleTracks = [];
    var selectedSubtitleIndex = -1; // -1 = Off
    var activeCues = [];

    var subtitleStyle = {
        size: 34, // px
        color: '#FFFFFF',
        bg: 'rgba(0, 0, 0, 0.75)',
        bottom: 50, // px from bottom
        delay: 0 // ms
    };

    var focusButtons = ['btn-play', 'btn-rewind', 'btn-forward', 'btn-sub', 'btn-audio', 'btn-aspect', 'btn-info'];
    var currentFocus = 'btn-play';
    var inSeekBar = false;
    var sheetOpen = null; // 'sub' | 'audio' | 'info' | null
    var sheetFocusCol = 0;
    var sheetFocusRow = 0;

    // Resume tracking interval & fail-safe state
    var resumeTimer = null;
    var isApplyingResume = false;
    var resumeTimeout = null;

    // Debounced seeking state (prevents webOS hardware decoder memory overflow)
    var seekDebounceTimer = null;
    var virtualSeekPos = null;

    /* ================= INITIALIZATION ================= */

    function init(parentContainer) {
        container = parentContainer;
        if (!container) return;
        container.innerHTML = '';

        // 1. Create Video Element with webOS low-memory & hardware overlay attributes
        video = document.createElement('video');
        video.id = 'sp-video-el';
        video.className = 'sp-video';
        video.autoplay = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        // Crucial for LG TV: preload metadata only to avoid massive RAM buffering crashes
        video.setAttribute('preload', 'metadata');
        container.appendChild(video);

        // 2. Create Subtitle Overlay
        subOverlay = document.createElement('div');
        subOverlay.id = 'sp-sub-overlay';
        subOverlay.className = 'sp-sub-overlay';
        container.appendChild(subOverlay);

        // 3. Create OSD Controls with SVG Icons
        createOSD();

        // 4. Create Sheet Overlays
        createSheets();

        // 5. Attach Media Events
        attachMediaEvents();

        // 6. Attach Keyboard / D-Pad Handler
        attachKeyEvents();

        console.log('[SunPlay.Player] Engine initialized');
    }

    function createOSD() {
        osdWrapper = document.createElement('div');
        osdWrapper.id = 'sp-osd-wrapper';
        osdWrapper.className = 'sp-osd-wrapper';
        osdWrapper.innerHTML = `
            <div class="sp-osd-top">
                <div class="sp-osd-title" id="sp-osd-title">Stream</div>
                <div class="sp-osd-badges">
                    <span id="sp-badge-res" class="sp-badge">1080p</span>
                    <span id="sp-badge-hdr" class="sp-badge sp-badge-hdr" style="display:none;">HDR</span>
                    <span id="sp-badge-audio" class="sp-badge">Auto</span>
                </div>
            </div>
            <div class="sp-osd-bottom">
                <div class="sp-seek-row">
                    <div class="sp-time" id="sp-time-curr">00:00</div>
                    <div class="sp-seek-bar" id="sp-seek-bar">
                        <div class="sp-seek-buf" id="sp-seek-buf" style="width:0%"></div>
                        <div class="sp-seek-prog" id="sp-seek-prog" style="width:0%"></div>
                        <div class="sp-seek-head" id="sp-seek-head" style="left:0%"></div>
                    </div>
                    <div class="sp-time" id="sp-time-dur">00:00</div>
                </div>
                <div class="sp-btn-row">
                    <div class="sp-btn-group-left">
                        <button class="sp-btn focused" id="btn-play" title="Play/Pause">
                            <span class="sp-btn-icon" id="btn-play-icon">
                                <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><rect x="5" y="4" width="4" height="16" rx="1"/><rect x="15" y="4" width="4" height="16" rx="1"/></svg>
                            </span>
                        </button>
                        <button class="sp-btn" id="btn-rewind" title="Rewind 10s">
                            <span class="sp-btn-icon">
                                <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
                                    <path d="M12.5 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6.5a6.5 6.5 0 1 1 1.9 4.6l-1.42 1.42A8.5 8.5 0 1 0 12.5 3z"/>
                                    <text x="12.5" y="14.5" font-size="7" font-weight="bold" text-anchor="middle" fill="currentColor">10</text>
                                </svg>
                            </span>
                        </button>
                        <button class="sp-btn" id="btn-forward" title="Forward 10s">
                            <span class="sp-btn-icon">
                                <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
                                    <path d="M11.5 3a9 9 0 0 1 9 9H23l-3.89 3.89-.07.14L15 12h2.5a6.5 6.5 0 1 0-1.9 4.6l1.42 1.42A8.5 8.5 0 1 1 11.5 3z"/>
                                    <text x="11.5" y="14.5" font-size="7" font-weight="bold" text-anchor="middle" fill="currentColor">10</text>
                                </svg>
                            </span>
                        </button>
                        <button class="sp-btn" id="btn-sub" title="Subtitles">
                            <span class="sp-btn-icon">
                                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-9 7H6v-2h5v2zm7 0h-5v-2h5v2zm-7 4H6v-2h5v2zm7 0h-5v-2h5v2z"/></svg>
                            </span>
                            <span class="sp-btn-text" id="btn-sub-label">Subtitles</span>
                        </button>
                        <button class="sp-btn" id="btn-audio" title="Audio">
                            <span class="sp-btn-icon">
                                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                            </span>
                            <span class="sp-btn-text" id="btn-audio-label">Audio</span>
                        </button>
                        <button class="sp-btn" id="btn-aspect" title="Aspect Ratio">
                            <span class="sp-btn-icon">
                                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M19 12h-2v3h-3v2h5v-5zM7 9h3V7H5v5h2V9zm14-6H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16.01H3V4.99h18v14.02z"/></svg>
                            </span>
                            <span class="sp-btn-text" id="btn-aspect-label">Original</span>
                        </button>
                        <button class="sp-btn" id="btn-info" title="Stream Info">
                            <span class="sp-btn-icon">
                                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M11 17h2v-6h-2v6zm1-15C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM11 9h2V7h-2v2z"/></svg>
                            </span>
                        </button>
                    </div>
                </div>
            </div>
            <div class="sp-buffering-spinner" id="sp-spinner" style="display:none;"></div>
        `;
        container.appendChild(osdWrapper);
    }

    function createSheets() {
        sheetOverlay = document.createElement('div');
        sheetOverlay.id = 'sp-sheet-overlay';
        sheetOverlay.className = 'sp-sheet-overlay';
        sheetOverlay.style.display = 'none';
        container.appendChild(sheetOverlay);

        infoOverlay = document.createElement('div');
        infoOverlay.id = 'sp-info-overlay';
        infoOverlay.className = 'sp-info-overlay';
        infoOverlay.style.display = 'none';
        container.appendChild(infoOverlay);
    }

    /* ================= PLAYBACK CONTROL ================= */

    function play(url, options) {
        if (!video) {
            var pCont = document.getElementById('player-container');
            if (pCont) init(pCont);
        }
        if (!video) return;

        currentUrl = url;
        currentRawTitle = (options && options.title) || extractFilename(url) || 'Stream';
        displayTitle = cleanStreamTitle(currentRawTitle);

        aspectIndex = 0;
        applyAspect();

        var titleEl = document.getElementById('sp-osd-title');
        if (titleEl) {
            titleEl.innerText = displayTitle;
            titleEl.setAttribute('title', currentRawTitle);
        }

        var aspectLbl = document.getElementById('btn-aspect-label');
        if (aspectLbl) aspectLbl.innerText = aspectModes[0].label;

        // Reset subtitle & audio state
        audioTracks = [];
        subtitleTracks = [];
        selectedSubtitleIndex = -1;
        activeCues = [];
        if (subOverlay) {
            subOverlay.innerHTML = '';
            subOverlay.style.display = 'none';
        }

        // Memory Conservation: optimize DOM while player is running
        var homeEl = document.getElementById('home-screen');
        if (homeEl) homeEl.style.display = 'none';

        console.log('[SunPlay.Player] Loading stream:', url);
        
        // Auto-detect container hint
        if (url.indexOf('.m3u8') !== -1) {
            video.setAttribute('type', 'application/x-mpegURL');
        } else if (url.indexOf('.mkv') !== -1) {
            video.setAttribute('type', 'video/x-matroska');
        } else {
            video.removeAttribute('type');
        }

        video.src = url;
        video.load();

        var playPromise = video.play();
        if (playPromise && playPromise.catch) {
            playPromise.catch(function (err) {
                console.warn('[SunPlay.Player] Autoplay notice:', err);
            });
        }

        var forceStart = (options && options.resume === false);

        // Auto-resume check
        if (!forceStart) {
            checkAndApplyAutoResume(url);
        } else {
            try {
                localStorage.removeItem('sp_resume_' + encodeURIComponent(url));
            } catch (e) {}
        }

        // Show OSD briefly
        showOSD();

        // 1. Search OpenSubtitles with cleaned title
        fetchOpenSubtitles(displayTitle);

        // 2. Probe for companion sidecar subtitles (.srt, .vtt)
        probeSidecarSubtitles(url);

        // 3. Start auto-resume tracker
        startResumeTracker();
    }

    function stop() {
        if (!video) return;
        
        if (seekDebounceTimer) {
            clearTimeout(seekDebounceTimer);
            seekDebounceTimer = null;
        }
        virtualSeekPos = null;
        isApplyingResume = false;
        if (resumeTimeout) {
            clearTimeout(resumeTimeout);
            resumeTimeout = null;
        }

        // Save current progress before stop
        saveCurrentProgress();
        stopResumeTracker();

        try {
            video.pause();
            video.removeAttribute('src');
            video.load();
        } catch (e) {}

        hideOSD();
        closeSheet();
        closeInfo();
        closeSubSearchModal();
        if (subOverlay) {
            subOverlay.innerHTML = '';
            subOverlay.style.display = 'none';
        }
        isPlaying = false;

        // Restore home screen DOM
        var homeEl = document.getElementById('home-screen');
        if (homeEl) homeEl.style.display = '';

        // Switch screen back to home
        if (SunPlay.App && SunPlay.App.showScreen) {
            SunPlay.App.showScreen('home');
        }
    }

    function togglePlay() {
        if (!video) return;
        if (video.paused) {
            video.play();
            updatePlayBtn(true);
        } else {
            video.pause();
            updatePlayBtn(false);
        }
        showOSD();
    }

    function seekRelative(seconds) {
        if (!video) return;
        var dur = video.duration || 0;
        if (virtualSeekPos === null) {
            virtualSeekPos = video.currentTime || 0;
        }
        virtualSeekPos = dur > 0 ? Math.max(0, Math.min(dur, virtualSeekPos + seconds)) : Math.max(0, virtualSeekPos + seconds);

        // Immediate responsive visual feedback
        var currEl = document.getElementById('sp-time-curr');
        if (currEl) currEl.innerText = formatTime(virtualSeekPos);

        if (dur > 0) {
            var pct = (virtualSeekPos / dur) * 100;
            var progEl = document.getElementById('sp-seek-prog');
            var headEl = document.getElementById('sp-seek-head');
            if (progEl) progEl.style.width = pct + '%';
            if (headEl) headEl.style.left = pct + '%';
        }

        showOSD();

        // 380ms Debounce: Only dispatch hardware seek after user stops pressing navigation
        if (seekDebounceTimer) clearTimeout(seekDebounceTimer);
        seekDebounceTimer = setTimeout(function () {
            if (video && virtualSeekPos !== null) {
                try {
                    video.currentTime = virtualSeekPos;
                } catch (e) {
                    console.warn('[SunPlay.Player] Debounced seek error:', e);
                }
                virtualSeekPos = null;
                seekDebounceTimer = null;
            }
        }, 380);
    }

    function applyAspect() {
        if (!video) return;
        var mode = aspectModes[aspectIndex];
        video.style.objectFit = mode.fit;
        video.style.transform = mode.scale !== 1 ? `scale(${mode.scale})` : 'none';
        var lbl = document.getElementById('btn-aspect-label');
        if (lbl) lbl.innerText = mode.label;
    }

    function cycleAspect() {
        aspectIndex = (aspectIndex + 1) % aspectModes.length;
        applyAspect();
        if (SunPlay.App && SunPlay.App.showToast) {
            SunPlay.App.showToast('Aspect: ' + aspectModes[aspectIndex].label);
        }
        showOSD();
    }

    function updatePlayBtn(playing) {
        var iconEl = document.getElementById('btn-play-icon');
        if (iconEl) {
            iconEl.innerHTML = playing
                ? '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><rect x="5" y="4" width="4" height="16" rx="1"/><rect x="15" y="4" width="4" height="16" rx="1"/></svg>'
                : '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><polygon points="6,4 20,12 6,20"/></svg>';
        }
    }

    /* ================= OSD & VISIBILITY ================= */

    function showOSD() {
        if (!osdWrapper) return;
        osdWrapper.classList.add('visible');
        isVisible = true;

        if (hideTimer) clearTimeout(hideTimer);
        if (video && !video.paused && !sheetOpen) {
            hideTimer = setTimeout(hideOSD, HIDE_DELAY);
        }
    }

    function hideOSD() {
        if (sheetOpen) return; // Never hide while a sheet is open
        if (video && video.paused) return; // Keep visible while paused

        if (osdWrapper) osdWrapper.classList.remove('visible');
        isVisible = false;
        if (hideTimer) clearTimeout(hideTimer);
    }

    function updateFocus() {
        focusButtons.forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.classList.remove('focused');
        });
        var seekBar = document.getElementById('sp-seek-bar');
        if (seekBar) seekBar.classList.remove('focused');

        if (inSeekBar) {
            if (seekBar) seekBar.classList.add('focused');
        } else {
            var el = document.getElementById(currentFocus);
            if (el) el.classList.add('focused');
        }
    }

    /* ================= AUTO-RESUME ENGINE ================= */

    function getSavedProgress(url) {
        try {
            var data = localStorage.getItem('sp_resume_' + encodeURIComponent(url));
            if (data) return parseFloat(data) || 0;
        } catch (e) {}
        return 0;
    }

    function saveCurrentProgress() {
        if (!video || !currentUrl || !video.currentTime) return;
        try {
            var pos = video.currentTime;
            if (pos > 10 && (!video.duration || pos < video.duration - 30)) {
                localStorage.setItem('sp_resume_' + encodeURIComponent(currentUrl), pos.toString());
            } else if (video.duration && pos >= video.duration - 30) {
                localStorage.removeItem('sp_resume_' + encodeURIComponent(currentUrl));
            }
        } catch (e) {}
    }

    function checkAndApplyAutoResume(url) {
        var pos = getSavedProgress(url);
        if (pos > 10) {
            isApplyingResume = true;
            if (resumeTimeout) clearTimeout(resumeTimeout);
            resumeTimeout = setTimeout(function () {
                isApplyingResume = false;
            }, 6000);

            var onLoaded = function () {
                video.removeEventListener('loadedmetadata', onLoaded);
                try {
                    video.currentTime = pos;
                    if (SunPlay.App && SunPlay.App.showToast) {
                        SunPlay.App.showToast('Resuming playback at ' + formatTime(pos));
                    }
                } catch (e) {
                    console.warn('[SunPlay.Player] Auto-resume failed on unseekable stream:', e);
                    isApplyingResume = false;
                }
            };
            video.addEventListener('loadedmetadata', onLoaded);
        }
    }

    function startResumeTracker() {
        stopResumeTracker();
        resumeTimer = setInterval(saveCurrentProgress, 5000);
    }

    function stopResumeTracker() {
        if (resumeTimer) {
            clearInterval(resumeTimer);
            resumeTimer = null;
        }
    }

    /* ================= SUBTITLES & AUDIO ================= */

    function fetchOpenSubtitles(title, callback) {
        if (!title || title === 'Stream') {
            if (callback) callback(0);
            return;
        }
        console.log('[SunPlay.Player] Searching OpenSubtitles via Cinemeta for:', title);

        var searchUrl = 'https://v3-cinemeta.strem.io/catalog/movie/top/search=' + encodeURIComponent(title) + '.json';

        fetch(searchUrl, { method: 'GET' })
            .then(function (res) { return res.json(); })
            .then(function (data) {
                var imdbId = data && data.metas && data.metas[0] ? data.metas[0].imdb_id : null;
                if (!imdbId) {
                    var seriesUrl = 'https://v3-cinemeta.strem.io/catalog/series/top/search=' + encodeURIComponent(title) + '.json';
                    return fetch(seriesUrl, { method: 'GET' })
                        .then(function (res) { return res.json(); })
                        .then(function (sData) {
                            return sData && sData.metas && sData.metas[0] ? sData.metas[0].imdb_id : null;
                        });
                }
                return imdbId;
            })
            .then(function (imdbId) {
                if (!imdbId) {
                    console.log('[SunPlay.Player] No IMDb ID matched for title:', title);
                    if (callback) callback(0);
                    return;
                }
                console.log('[SunPlay.Player] Resolved IMDb ID:', imdbId);
                var subUrl = 'https://opensubtitles-v3.strem.io/subtitles/movie/' + imdbId + '.json';
                return fetch(subUrl, { method: 'GET' })
                    .then(function (res) { return res.json(); })
                    .then(function (data) {
                        var addedCount = 0;
                        if (data && data.subtitles && data.subtitles.length > 0) {
                            console.log('[SunPlay.Player] Found ' + data.subtitles.length + ' OpenSubtitles');
                            data.subtitles.forEach(function (s, idx) {
                                // Prevent duplicate track URLs
                                var exists = subtitleTracks.some(function(t) { return t.url === s.url; });
                                if (!exists) {
                                    var langCode = (s.lang || 'en').toLowerCase();
                                    var langLabel = langCode.toUpperCase();
                                    var fileName = s.subtitleFileName ? (' · ' + s.subtitleFileName.substring(0, 30)) : '';
                                    subtitleTracks.push({
                                        id: 'os_' + (subtitleTracks.length + idx),
                                        type: 'opensubtitles',
                                        label: langLabel + fileName,
                                        language: langCode,
                                        url: s.url,
                                        cues: []
                                    });
                                    addedCount++;
                                }
                            });
                            updateSubtitleBadge();
                            if (sheetOpen === 'sub') {
                                renderSubtitleSheetHTML();
                            }
                        }
                        if (callback) callback(addedCount);
                    });
            })
            .catch(function (e) {
                console.log('[SunPlay.Player] OpenSubtitles query error', e);
                if (callback) callback(0);
            });
    }

    function probeSidecarSubtitles(videoUrl) {
        if (!videoUrl || videoUrl.indexOf('http') !== 0) return;
        var base = videoUrl.replace(/\.[a-zA-Z0-9]{2,4}(\?.*)?$/, '');
        var candidates = [
            { ext: '.srt', lang: 'Embedded SRT' },
            { ext: '.en.srt', lang: 'English SRT' },
            { ext: '.vtt', lang: 'WebVTT' }
        ];

        candidates.forEach(function (cand, idx) {
            var subUrl = base + cand.ext;
            fetch(subUrl, { method: 'HEAD' })
                .then(function (res) {
                    if (res.ok) {
                        subtitleTracks.unshift({
                            id: 'sidecar_' + idx,
                            type: 'opensubtitles',
                            label: 'Sidecar · ' + cand.lang,
                            language: 'en',
                            url: subUrl,
                            cues: []
                        });
                        updateSubtitleBadge();
                        if (sheetOpen === 'sub') {
                            renderSubtitleSheetHTML();
                        }
                    }
                })
                .catch(function () {});
        });
    }

    function addEmbeddedTextTrack(tt) {
        if (!tt) return;
        var trackIdx = -1;
        if (video && video.textTracks) {
            for (var i = 0; i < video.textTracks.length; i++) {
                if (video.textTracks[i] === tt) {
                    trackIdx = i;
                    break;
                }
            }
        }
        if (trackIdx === -1) trackIdx = subtitleTracks.filter(function(s) { return s.type === 'embedded'; }).length;

        var existing = subtitleTracks.find(function (s) {
            return s.trackObject === tt || (s.type === 'embedded' && s.trackIndex === trackIdx);
        });
        if (existing) return;

        var lang = tt.language || 'und';
        var lbl = tt.label || (lang !== 'und' ? lang.toUpperCase() : ('Track ' + (trackIdx + 1)));

        var trackRecord = {
            id: 'emb_' + trackIdx,
            type: 'embedded',
            trackIndex: trackIdx,
            trackObject: tt,
            label: 'Embedded · ' + lbl,
            language: lang
        };

        tt.oncuechange = function () {
            if (selectedSubtitleIndex >= 0 && subtitleTracks[selectedSubtitleIndex] && subtitleTracks[selectedSubtitleIndex].trackObject === tt) {
                if (tt.activeCues && tt.activeCues.length > 0) {
                    var lines = [];
                    for (var c = 0; c < tt.activeCues.length; c++) {
                        if (tt.activeCues[c].text) lines.push(tt.activeCues[c].text);
                    }
                    displayDirectCue(lines.join('\n'));
                } else {
                    displayDirectCue('');
                }
            }
        };

        subtitleTracks.unshift(trackRecord);
        updateSubtitleBadge();
        if (sheetOpen === 'sub') {
            renderSubtitleSheetHTML();
        }
    }

    function parseSrt(text) {
        var cues = [];
        var normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        var blocks = normalized.split('\n\n');

        blocks.forEach(function (block) {
            var lines = block.trim().split('\n');
            var arrowIdx = lines.findIndex(function (l) { return l.indexOf('-->') !== -1; });
            if (arrowIdx === -1) return;

            var timeParts = lines[arrowIdx].split('-->');
            var start = parseTime(timeParts[0].trim());
            var end = parseTime(timeParts[1].trim());

            var textLines = lines.slice(arrowIdx + 1).join('\n');
            textLines = textLines.replace(/<[^>]*>/g, '').trim();

            if (start >= 0 && end > start && textLines) {
                cues.push({ start: start, end: end, text: textLines });
            }
        });
        return cues;
    }

    function parseTime(s) {
        s = s.replace(',', '.');
        var parts = s.split(':');
        if (parts.length === 3) {
            return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
        } else if (parts.length === 2) {
            return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
        }
        return -1;
    }

    function displayDirectCue(text) {
        if (!subOverlay) return;
        if (!text || selectedSubtitleIndex < 0) {
            subOverlay.innerHTML = '';
            subOverlay.style.display = 'none';
            return;
        }
        subOverlay.innerHTML = `
            <div class="sp-sub-text" style="
                font-size:${subtitleStyle.size}px;
                color:${subtitleStyle.color};
                background-color:${subtitleStyle.bg};
                bottom:${subtitleStyle.bottom}px;
            ">${escapeHtml(text).replace(/\n/g, '<br>')}</div>
        `;
        subOverlay.style.display = 'block';
    }

    function selectSubtitle(index) {
        selectedSubtitleIndex = index;
        activeCues = [];
        displayDirectCue('');

        if (index < 0 || index >= subtitleTracks.length) {
            if (video && video.textTracks) {
                for (var k = 0; k < video.textTracks.length; k++) {
                    video.textTracks[k].mode = 'hidden';
                }
            }
            updateSubtitleBadge();
            return;
        }

        var track = subtitleTracks[index];
        console.log('[SunPlay.Player] Selecting subtitle track:', track.label);

        if (track.type === 'opensubtitles') {
            if (video && video.textTracks) {
                for (var j = 0; j < video.textTracks.length; j++) {
                    video.textTracks[j].mode = 'hidden';
                }
            }
            if (track.cues && track.cues.length > 0) {
                activeCues = track.cues;
            } else {
                if (SunPlay.App && SunPlay.App.showToast) {
                    SunPlay.App.showToast('Downloading subtitle...');
                }
                fetch(track.url)
                    .then(function (res) { return res.text(); })
                    .then(function (srtText) {
                        track.cues = parseSrt(srtText);
                        activeCues = track.cues;
                        if (SunPlay.App && SunPlay.App.showToast) {
                            SunPlay.App.showToast('Subtitle loaded (' + track.cues.length + ' lines)');
                        }
                    })
                    .catch(function (err) {
                        console.error('[SunPlay.Player] Subtitle download error:', err);
                        if (SunPlay.App && SunPlay.App.showToast) {
                            SunPlay.App.showToast('Failed to load subtitle file');
                        }
                    });
            }
        } else if (track.type === 'embedded') {
            activeCues = [];
            if (video && video.textTracks) {
                for (var i = 0; i < video.textTracks.length; i++) {
                    var isCurrent = (video.textTracks[i] === track.trackObject || i === track.trackIndex);
                    video.textTracks[i].mode = isCurrent ? 'showing' : 'hidden';
                }
            }
        }
        updateSubtitleBadge();
    }

    function updateSubtitleBadge() {
        var lbl = document.getElementById('btn-sub-label');
        if (lbl) {
            if (selectedSubtitleIndex < 0) {
                lbl.innerText = 'Subtitles (Off)';
            } else {
                var t = subtitleTracks[selectedSubtitleIndex];
                lbl.innerText = (t && t.language ? t.language.toUpperCase() : 'ON');
            }
        }
    }

    function renderSubtitleCues() {
        if (!video || activeCues.length === 0 || selectedSubtitleIndex < 0) return;
        var now = video.currentTime + (subtitleStyle.delay / 1000);

        var currentCue = activeCues.find(function (c) {
            return now >= c.start && now <= c.end;
        });

        if (currentCue) {
            displayDirectCue(currentCue.text);
        } else {
            displayDirectCue('');
        }
    }

    /* ================= SHEETS: SUBTITLES, AUDIO & INFO ================= */

    function openSubtitleSheet() {
        sheetOpen = 'sub';
        sheetFocusCol = 0;
        sheetFocusRow = selectedSubtitleIndex + 1;

        renderSubtitleSheetHTML();
        sheetOverlay.style.display = 'flex';
        showOSD();
    }

    function renderSubtitleSheetHTML() {
        var searchBtn = '<div class="sp-sheet-item sp-search-sub-btn" data-row="-1" style="background: rgba(255, 140, 0, 0.15); border: 1px dashed rgba(255, 140, 0, 0.5); color: #ff8c00; font-weight: 700; margin-bottom: 8px;">🔍 Search OpenSubtitles by Title...</div>';
        var trackItems = searchBtn + '<div class="sp-sheet-item ' + (selectedSubtitleIndex === -1 ? 'active' : '') + '" data-row="0">Off</div>';
        subtitleTracks.forEach(function (t, idx) {
            var activeClass = (selectedSubtitleIndex === idx) ? 'active' : '';
            trackItems += `<div class="sp-sheet-item ${activeClass}" data-row="${idx + 1}">${escapeHtml(t.label)}</div>`;
        });

        sheetOverlay.innerHTML = `
            <div class="sp-sheet-panel">
                <div class="sp-sheet-header">
                    <h2>Subtitles</h2>
                    <span class="sp-sheet-close">✕</span>
                </div>
                <div class="sp-sheet-body">
                    <div class="sp-sheet-col" id="sheet-col-tracks">
                        <h3>Available Tracks (${subtitleTracks.length})</h3>
                        <div class="sp-sheet-list">${trackItems}</div>
                    </div>
                    <div class="sp-sheet-col" id="sheet-col-style">
                        <h3>Subtitle Styling</h3>
                        <div class="sp-setting-row" data-style="size">
                            <span>Font Size</span>
                            <span class="val">${subtitleStyle.size}px</span>
                        </div>
                        <div class="sp-setting-row" data-style="color">
                            <span>Color</span>
                            <span class="val" style="color:${subtitleStyle.color};">■ ${subtitleStyle.color}</span>
                        </div>
                        <div class="sp-setting-row" data-style="bg">
                            <span>Background</span>
                            <span class="val">${subtitleStyle.bg === 'none' ? 'None' : 'Solid Box'}</span>
                        </div>
                        <div class="sp-setting-row" data-style="delay">
                            <span>Delay Sync</span>
                            <span class="val">${subtitleStyle.delay} ms</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        highlightSheetFocus();
    }

    function openAudioSheet() {
        sheetOpen = 'audio';
        sheetFocusCol = 0;
        sheetFocusRow = selectedAudioIndex;

        var items = '';
        if (audioTracks.length === 0) {
            items = '<div class="sp-sheet-item active" data-row="0">Default Stream Audio (Multi-Channel / Passthrough)</div>';
        } else {
            audioTracks.forEach(function (a, idx) {
                var activeClass = (selectedAudioIndex === idx) ? 'active' : '';
                items += `<div class="sp-sheet-item ${activeClass}" data-row="${idx}">${escapeHtml(a.label)}</div>`;
            });
        }

        sheetOverlay.innerHTML = `
            <div class="sp-sheet-panel" style="max-width: 650px;">
                <div class="sp-sheet-header">
                    <h2>Audio Tracks</h2>
                    <span class="sp-sheet-close">✕</span>
                </div>
                <div class="sp-sheet-body">
                    <div class="sp-sheet-col" style="width: 100%;">
                        <div class="sp-sheet-list">${items}</div>
                    </div>
                </div>
            </div>
        `;
        sheetOverlay.style.display = 'flex';
        highlightSheetFocus();
        showOSD();
    }

    function openInfoOverlay() {
        sheetOpen = 'info';
        hideOSD();
        var dur = video && video.duration ? formatTime(video.duration) : '--:--';
        var cur = video && video.currentTime ? formatTime(video.currentTime) : '00:00';
        var bufLen = '0.0s';
        if (video && video.buffered && video.buffered.length > 0) {
            bufLen = (video.buffered.end(video.buffered.length - 1) - video.currentTime).toFixed(1) + 's';
        }

        infoOverlay.innerHTML = `
            <div class="sp-info-card">
                <h3>Stream Diagnostics</h3>
                <div class="sp-info-line"><b style="flex-shrink:0;">Title:</b> <span style="word-break:break-word; flex:1;">${escapeHtml(displayTitle)}</span></div>
                <div class="sp-info-line"><b>Resolution:</b> <span>${video.videoWidth || 1920} x ${video.videoHeight || 1080}</span></div>
                <div class="sp-info-line"><b>Position:</b> <span>${cur} / ${dur}</span></div>
                <div class="sp-info-line"><b>Buffer Ahead:</b> <span>${bufLen}</span></div>
                <div class="sp-info-line"><b>Aspect Mode:</b> <span>${aspectModes[aspectIndex].label}</span></div>
                <div class="sp-info-line"><b>Decoder Pipeline:</b> <span>LG webOS Hardware Acceleration</span></div>
                <div class="sp-info-url"><b>URL:</b> ${escapeHtml(currentUrl)}</div>
                <button class="sp-info-ok-btn" id="sp-info-ok">Close</button>
            </div>
        `;
        infoOverlay.style.display = 'flex';
        var okBtn = document.getElementById('sp-info-ok');
        if (okBtn) {
            okBtn.addEventListener('click', closeInfo);
            okBtn.focus();
        }
    }

    function closeSheet() {
        sheetOpen = null;
        sheetOverlay.style.display = 'none';
        showOSD();
    }

    function closeInfo() {
        sheetOpen = null;
        infoOverlay.style.display = 'none';
        showOSD();
    }

    function highlightSheetFocus() {
        var items = sheetOverlay.querySelectorAll('.sp-sheet-item, .sp-setting-row');
        items.forEach(function (el) { el.classList.remove('focused'); });

        if (sheetOpen === 'sub') {
            if (sheetFocusCol === 0) {
                var target = sheetOverlay.querySelector(`#sheet-col-tracks .sp-sheet-item[data-row="${sheetFocusRow}"]`);
                if (target) target.classList.add('focused');
            } else {
                var rows = sheetOverlay.querySelectorAll('#sheet-col-style .sp-setting-row');
                if (rows[sheetFocusRow]) rows[sheetFocusRow].classList.add('focused');
            }
        } else if (sheetOpen === 'audio') {
            var target = sheetOverlay.querySelector(`.sp-sheet-item[data-row="${sheetFocusRow}"]`);
            if (target) target.classList.add('focused');
        }
    }

    function openSubtitleSearchModal() {
        var modal = document.getElementById('sp-sub-search-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'sp-sub-search-modal';
            modal.className = 'sp-modal-overlay';
            container.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="sp-modal-card" style="max-width: 650px;">
                <div class="sp-modal-title">🔍 Search OpenSubtitles</div>
                <div class="sp-modal-desc">Search subtitles by movie or series name (VLC-style):</div>
                <div style="margin-bottom: 20px;">
                    <input type="text" id="sp-sub-search-input" class="url-input" style="width: 100%; box-sizing: border-box; font-size: 22px; padding: 14px;" value="${escapeHtml(displayTitle)}" placeholder="Enter title e.g. Avatar Fire and Ash">
                </div>
                <div class="sp-modal-actions">
                    <button class="sp-modal-btn primary focused" id="sp-sub-do-search">🔍 Search Subtitles</button>
                    <button class="sp-modal-btn secondary" id="sp-sub-cancel-search">Cancel</button>
                </div>
                <div id="sp-sub-search-status" style="margin-top: 15px; font-size: 18px; color: #ff8c00; min-height: 24px;"></div>
            </div>
        `;
        modal.style.display = 'flex';
        
        var input = document.getElementById('sp-sub-search-input');
        var doBtn = document.getElementById('sp-sub-do-search');
        var cancelBtn = document.getElementById('sp-sub-cancel-search');
        var statusEl = document.getElementById('sp-sub-search-status');

        function executeSearch() {
            var q = input ? input.value.trim() : '';
            if (!q) return;
            if (statusEl) statusEl.innerText = 'Searching OpenSubtitles catalog for "' + q + '"...';
            fetchOpenSubtitles(q, function (count) {
                if (count > 0) {
                    if (statusEl) statusEl.innerText = 'Found ' + count + ' new subtitles! Added to list.';
                    setTimeout(function () {
                        closeSubSearchModal();
                        renderSubtitleSheetHTML();
                    }, 900);
                } else {
                    if (statusEl) statusEl.innerText = 'No subtitles found for "' + q + '". Try searching a different title or year.';
                }
            });
        }

        doBtn.addEventListener('click', executeSearch);
        cancelBtn.addEventListener('click', closeSubSearchModal);
        
        input.addEventListener('keydown', function (e) {
            if (e.keyCode === 13) {
                e.preventDefault();
                executeSearch();
            }
        });

        // Focus search button initially (avoiding virtual keyboard pop)
        doBtn.focus();
    }

    function closeSubSearchModal() {
        var modal = document.getElementById('sp-sub-search-modal');
        if (modal) modal.style.display = 'none';
        if (sheetOpen === 'sub') {
            highlightSheetFocus();
        }
    }

    /* ================= EVENT ATTACHMENTS ================= */

    function attachMediaEvents() {
        video.addEventListener('timeupdate', function () {
            if (!video.duration) return;
            // Prevent UI stutter while user is actively debouncing seek jumps
            if (virtualSeekPos !== null) return;

            var curr = video.currentTime;
            var dur = video.duration;

            var currEl = document.getElementById('sp-time-curr');
            var durEl = document.getElementById('sp-time-dur');
            if (currEl) currEl.innerText = formatTime(curr);
            if (durEl) durEl.innerText = formatTime(dur);

            var pct = (curr / dur) * 100;
            var progEl = document.getElementById('sp-seek-prog');
            var headEl = document.getElementById('sp-seek-head');
            if (progEl) progEl.style.width = pct + '%';
            if (headEl) headEl.style.left = pct + '%';

            if (video.buffered.length > 0) {
                var bufPct = (video.buffered.end(video.buffered.length - 1) / dur) * 100;
                var bufEl = document.getElementById('sp-seek-buf');
                if (bufEl) bufEl.style.width = bufPct + '%';
            }

            renderSubtitleCues();
        });

        video.addEventListener('play', function () {
            isPlaying = true;
            updatePlayBtn(true);
        });

        video.addEventListener('pause', function () {
            isPlaying = false;
            updatePlayBtn(false);
            showOSD();
        });

        video.addEventListener('waiting', function () {
            var sp = document.getElementById('sp-spinner');
            if (sp) sp.style.display = 'block';
        });

        video.addEventListener('playing', function () {
            var sp = document.getElementById('sp-spinner');
            if (sp) sp.style.display = 'none';
        });

        // Listen for asynchronously added text tracks from webOS
        if (video.textTracks) {
            video.textTracks.addEventListener('addtrack', function (e) {
                if (e && e.track) {
                    console.log('[SunPlay.Player] Embedded text track detected:', e.track.label || e.track.language);
                    addEmbeddedTextTrack(e.track);
                }
            });
        }

        video.addEventListener('loadedmetadata', function () {
            console.log('[SunPlay.Player] Metadata: ' + video.videoWidth + 'x' + video.videoHeight);
            var resBadge = document.getElementById('sp-badge-res');
            if (resBadge) {
                if (video.videoWidth >= 3840) resBadge.innerText = '4K UHD';
                else if (video.videoWidth >= 1920) resBadge.innerText = '1080p FHD';
                else if (video.videoWidth >= 1280) resBadge.innerText = '720p HD';
                else resBadge.innerText = 'SD';
            }

            // Extract audio tracks
            if (video.audioTracks && video.audioTracks.length > 0) {
                audioTracks = [];
                for (var i = 0; i < video.audioTracks.length; i++) {
                    var a = video.audioTracks[i];
                    audioTracks.push({
                        id: a.id || i,
                        trackObject: a,
                        label: (a.label || a.language || ('Audio ' + (i + 1))).toUpperCase(),
                        language: a.language || 'und'
                    });
                }
                var audioBadge = document.getElementById('sp-badge-audio');
                if (audioBadge) audioBadge.innerText = audioTracks.length + ' Tracks';
            }

            // Extract existing embedded text tracks
            if (video.textTracks && video.textTracks.length > 0) {
                for (var j = 0; j < video.textTracks.length; j++) {
                    addEmbeddedTextTrack(video.textTracks[j]);
                }
            }
        });

        video.addEventListener('ended', function () {
            if (SunPlay.App && SunPlay.App.showToast) {
                SunPlay.App.showToast('Playback ended');
            }
            setTimeout(stop, 1000);
        });

        video.addEventListener('error', function () {
            var err = video.error;
            var msg = err ? `Error code ${err.code}: ${err.message}` : 'Playback error';
            console.error('[SunPlay.Player] Error:', msg);

            // Unseekable / Range Error Recovery: If error happened during resume seek, restart cleanly from start!
            if (isApplyingResume) {
                isApplyingResume = false;
                console.warn('[SunPlay.Player] Stream failed on resume seek. Recovering from start...');
                try {
                    localStorage.removeItem('sp_resume_' + encodeURIComponent(currentUrl));
                    video.removeAttribute('src');
                    video.load();
                    video.src = currentUrl;
                    video.currentTime = 0;
                    video.play();
                    if (SunPlay.App && SunPlay.App.showToast) {
                        SunPlay.App.showToast('Stream is download-only / non-seekable. Playing from start.');
                    }
                    return;
                } catch (recErr) {
                    console.error('[SunPlay.Player] Fallback error:', recErr);
                }
            }

            if (SunPlay.App && SunPlay.App.showToast) {
                SunPlay.App.showToast('Playback failed. Check URL or stream format.');
            }
        });
    }

    /* ================= KEY / D-PAD HANDLER ================= */

    function attachKeyEvents() {
        document.addEventListener('keydown', function (e) {
            var playerScreen = document.getElementById('player-screen');
            if (!playerScreen || !playerScreen.classList.contains('active')) return;

            var key = e.keyCode;

            // Multimedia keys
            if (key === 19 || key === 415) { // Play/Pause or Play
                e.preventDefault();
                togglePlay();
                return;
            }
            if (key === 413) { // Stop
                e.preventDefault();
                stop();
                return;
            }
            if (key === 412) { // Rewind
                e.preventDefault();
                seekRelative(-10);
                return;
            }
            if (key === 417) { // FastForward
                e.preventDefault();
                seekRelative(10);
                return;
            }

            // Back button handling (461 webOS, 27 Escape, 8 Backspace)
            // Streamlined: 1 click closes any open modal or sheet. If none open, exits cleanly to home!
            if (key === 461 || key === 27 || key === 8) {
                e.preventDefault();
                e.stopPropagation();

                var subSearchModal = document.getElementById('sp-sub-search-modal');
                if (subSearchModal && subSearchModal.style.display !== 'none') {
                    closeSubSearchModal();
                    return;
                }

                if (sheetOpen === 'info') {
                    closeInfo();
                } else if (sheetOpen) {
                    closeSheet();
                } else {
                    // One-click exit directly to home menu!
                    stop();
                }
                return;
            }

            // If a modal or sheet is open, handle navigation
            var subModal = document.getElementById('sp-sub-search-modal');
            if (subModal && subModal.style.display !== 'none') {
                if (key === 27 || key === 461) {
                    closeSubSearchModal();
                }
                return;
            }

            if (sheetOpen === 'info') {
                if (key === 13) closeInfo();
                return;
            }

            if (sheetOpen === 'sub' || sheetOpen === 'audio') {
                handleSheetKey(key, e);
                return;
            }

            // If OSD is hidden, ANY D-pad key immediately shows OSD
            if (!isVisible) {
                e.preventDefault();
                showOSD();
                return;
            }

            // Reset hide timer on any key press
            showOSD();

            // OSD Navigation
            switch (key) {
                case 37: // Left
                    e.preventDefault();
                    if (inSeekBar) {
                        seekRelative(-10);
                    } else {
                        var idx = focusButtons.indexOf(currentFocus);
                        if (idx > 0) currentFocus = focusButtons[idx - 1];
                        updateFocus();
                    }
                    break;
                case 39: // Right
                    e.preventDefault();
                    if (inSeekBar) {
                        seekRelative(10);
                    } else {
                        var idx = focusButtons.indexOf(currentFocus);
                        if (idx < focusButtons.length - 1) currentFocus = focusButtons[idx + 1];
                        updateFocus();
                    }
                    break;
                case 38: // Up
                    e.preventDefault();
                    inSeekBar = true;
                    updateFocus();
                    break;
                case 40: // Down
                    e.preventDefault();
                    inSeekBar = false;
                    updateFocus();
                    break;
                case 13: // Enter / OK
                    e.preventDefault();
                    handleButtonAction(currentFocus);
                    break;
            }
        });
    }

    function handleButtonAction(btnId) {
        switch (btnId) {
            case 'btn-play':
                togglePlay();
                break;
            case 'btn-rewind':
                seekRelative(-10);
                break;
            case 'btn-forward':
                seekRelative(10);
                break;
            case 'btn-sub':
                openSubtitleSheet();
                break;
            case 'btn-audio':
                openAudioSheet();
                break;
            case 'btn-aspect':
                cycleAspect();
                break;
            case 'btn-info':
                openInfoOverlay();
                break;
        }
    }

    function handleSheetKey(key, e) {
        if (key === 38) { // Up
            e.preventDefault();
            var minRow = (sheetOpen === 'sub' && sheetFocusCol === 0) ? -1 : 0;
            sheetFocusRow = Math.max(minRow, sheetFocusRow - 1);
            highlightSheetFocus();
        } else if (key === 40) { // Down
            e.preventDefault();
            var max = (sheetOpen === 'sub' && sheetFocusCol === 0) ? subtitleTracks.length : 3;
            sheetFocusRow = Math.min(max, sheetFocusRow + 1);
            highlightSheetFocus();
        } else if (key === 37) { // Left
            e.preventDefault();
            if (sheetOpen === 'sub') {
                sheetFocusCol = 0;
                highlightSheetFocus();
            }
        } else if (key === 39) { // Right
            e.preventDefault();
            if (sheetOpen === 'sub') {
                sheetFocusCol = 1;
                sheetFocusRow = 0;
                highlightSheetFocus();
            }
        } else if (key === 13) { // Enter
            e.preventDefault();
            if (sheetOpen === 'sub') {
                if (sheetFocusCol === 0) {
                    if (sheetFocusRow === -1) {
                        openSubtitleSearchModal();
                    } else {
                        selectSubtitle(sheetFocusRow - 1);
                        closeSheet();
                    }
                } else {
                    cycleSubtitleStyle(sheetFocusRow);
                    renderSubtitleSheetHTML();
                }
            } else if (sheetOpen === 'audio') {
                selectedAudioIndex = sheetFocusRow;
                if (audioTracks[selectedAudioIndex] && video.audioTracks) {
                    for (var i = 0; i < video.audioTracks.length; i++) {
                        video.audioTracks[i].enabled = (i === selectedAudioIndex);
                    }
                }
                closeSheet();
            }
        }
    }

    function cycleSubtitleStyle(rowIndex) {
        if (rowIndex === 0) { // Size
            var sizes = [26, 34, 44, 54];
            var idx = (sizes.indexOf(subtitleStyle.size) + 1) % sizes.length;
            subtitleStyle.size = sizes[idx];
        } else if (rowIndex === 1) { // Color
            var colors = ['#FFFFFF', '#FFEB3B', '#4CAF50', '#00BCD4'];
            var idx = (colors.indexOf(subtitleStyle.color) + 1) % colors.length;
            subtitleStyle.color = colors[idx];
        } else if (rowIndex === 2) { // Bg
            subtitleStyle.bg = subtitleStyle.bg === 'none' ? 'rgba(0,0,0,0.75)' : 'none';
        } else if (rowIndex === 3) { // Delay
            var delays = [-1000, -500, 0, 500, 1000, 1500, 2000];
            var dIdx = (delays.indexOf(subtitleStyle.delay) + 1) % delays.length;
            subtitleStyle.delay = delays[dIdx];
        }
    }

    /* ================= UTILITIES ================= */

    function cleanStreamTitle(raw) {
        if (!raw) return 'Stream';
        try {
            var str = decodeURIComponent(raw.split('?')[0].split('/').pop());
            // Remove file extension
            str = str.replace(/\.[a-zA-Z0-9]{2,4}$/, '');
            // Remove bracketed info e.g. [Hindi DDP 5.1 English ...]
            str = str.replace(/[\[\(][^\]\)]*[\]\)]/g, ' ');
            // Remove quality, codec and scene tags
            str = str.replace(/\b(2160p|1080p|720p|480p|4k|uhd|bluray|remux|hdr|hdr10|dv|10bit|hevc|x265|x264|h264|h265|ddp|atmos|imax|truehd|web-dl|webrip|proper|repack|aac|dts|chd-uhdmovies)\b/gi, ' ');
            str = str.replace(/[\._\+]/g, ' ');
            str = str.replace(/\s{2,}/g, ' ').trim();
            return str || 'Stream';
        } catch (e) {
            return 'Stream';
        }
    }

    function extractFilename(url) {
        try {
            var parts = url.split('?')[0].split('/');
            return decodeURIComponent(parts[parts.length - 1]);
        } catch (e) {
            return 'Stream';
        }
    }

    function formatTime(s) {
        if (!s || isNaN(s)) return '00:00';
        var h = Math.floor(s / 3600);
        var m = Math.floor((s % 3600) / 60);
        var sec = Math.floor(s % 60);
        if (h > 0) {
            return `${pad(h)}:${pad(m)}:${pad(sec)}`;
        }
        return `${pad(m)}:${pad(sec)}`;
    }

    function pad(n) {
        return n < 10 ? '0' + n : n;
    }

    function escapeHtml(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    return {
        init: init,
        play: play,
        stop: stop,
        togglePlay: togglePlay,
        seekRelative: seekRelative,
        showOSD: showOSD,
        hideOSD: hideOSD,
        cleanStreamTitle: cleanStreamTitle,
        getSavedProgress: getSavedProgress,
        clearCache: function () {
            subtitleTracks = [];
            audioTracks = [];
            activeCues = [];
            if (subOverlay) {
                subOverlay.innerHTML = '';
                subOverlay.style.display = 'none';
            }
        }
    };
})();
