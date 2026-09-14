window.SunPlay = window.SunPlay || {};

SunPlay.Controls = (function() {
    var player = null;
    var container = null;
    var controlsWrapper = null;
    var hideTimeout = null;
    var isVisible = false;
    
    var focusableElements = [];
    var currentFocusIndex = -1;
    
    var popupWrapper = null;
    var popupList = [];
    var popupFocusIndex = 0;
    var popupCallback = null;
    
    var els = {};
    
    var speeds = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0, 4.0];

    function createUI() {
        controlsWrapper = document.createElement('div');
        controlsWrapper.className = 'sp-controls-wrapper';
        
        controlsWrapper.innerHTML = `
            <div class="sp-spinner" id="sp-spinner" style="display:none;"></div>
            <div class="sp-top-bar">
                <div class="sp-title" id="sp-title">Video Title</div>
                <div class="sp-video-info">
                    <span id="sp-res">1080p</span>
                    <span id="sp-hdr" class="sp-hdr-badge" style="display:none;">HDR</span>
                </div>
            </div>
            <div class="sp-center-area">
                <div class="sp-big-play" id="sp-big-play">▶</div>
            </div>
            <div class="sp-bottom-bar">
                <div class="sp-seek-container">
                    <div class="sp-time" id="sp-time-curr">00:00</div>
                    <div class="sp-seek-bar sp-focusable" id="sp-seek-bar">
                        <div class="sp-seek-buffer" id="sp-seek-buffer" style="width:0%"></div>
                        <div class="sp-seek-progress" id="sp-seek-progress" style="width:0%"></div>
                        <div class="sp-seek-handle" id="sp-seek-handle" style="left:0%"></div>
                    </div>
                    <div class="sp-time" id="sp-time-dur">00:00</div>
                </div>
                <div class="sp-buttons-row">
                    <button class="sp-btn sp-focusable" id="sp-btn-play">▶ Play</button>
                    <button class="sp-btn sp-focusable" id="sp-btn-restart">⏪ Restart</button>
                    <button class="sp-btn sp-focusable" id="sp-btn-sub">💬 Subtitles</button>
                    <button class="sp-btn sp-focusable" id="sp-btn-aud">🎵 Audio</button>
                    <button class="sp-btn sp-focusable" id="sp-btn-spd">⚡ 1.0x</button>
                    <button class="sp-btn sp-focusable" id="sp-btn-info">ℹ️ Info</button>
                </div>
                <div class="sp-debug-overlay" id="sp-debug-overlay" style="display:none; position:absolute; right:20px; top:80px; background:rgba(0,0,0,0.88); color:#0f0; padding:12px 16px; font-size:16px; font-family:monospace; border:2px solid #0f0; border-radius:8px; pointer-events:none; z-index:9999; max-width:420px; max-height:480px; overflow:hidden; word-break:break-all;">

                    <div style="font-weight:bold; margin-bottom:5px; border-bottom:1px solid #0f0;">DEBUG INFO</div>
                    <div>Video: <span id="dbg-vid">--</span></div>
                    <div>Audio: <span id="dbg-aud">--</span></div>
                    <div>Buffer: <span id="dbg-buf">--</span></div>
                    <div>State: <span id="dbg-state">--</span></div>
                </div>
            </div>
            <div class="sp-popup-overlay" id="sp-popup">
                <div class="sp-popup-box">
                    <div class="sp-popup-title" id="sp-popup-title">Select</div>
                    <div id="sp-popup-list"></div>
                </div>
            </div>
        `;
        
        // Attach custom UI
        container.appendChild(controlsWrapper);
        
        els.title = document.getElementById('sp-title');
        els.bigPlay = document.getElementById('sp-big-play');
        els.timeCurr = document.getElementById('sp-time-curr');
        els.timeDur = document.getElementById('sp-time-dur');
        els.seekProgress = document.getElementById('sp-seek-progress');
        els.seekBuffer = document.getElementById('sp-seek-buffer');
        els.seekHandle = document.getElementById('sp-seek-handle');
        els.btnPlay = document.getElementById('sp-btn-play');
        els.btnRestart = document.getElementById('sp-btn-restart');
        els.btnSpd = document.getElementById('sp-btn-spd');
        els.btnInfo = document.getElementById('sp-btn-info');
        
        els.debugOverlay = document.getElementById('sp-debug-overlay');
        els.dbgVid = document.getElementById('dbg-vid');
        els.dbgAud = document.getElementById('dbg-aud');
        els.dbgBuf = document.getElementById('dbg-buf');
        els.dbgState = document.getElementById('dbg-state');
        
        popupWrapper = document.getElementById('sp-popup');
        
        focusableElements = Array.from(controlsWrapper.querySelectorAll('.sp-focusable'));
        if (focusableElements.length > 0) {
            currentFocusIndex = 0;
            updateFocus();
        }
    }

    function formatTime(sec) {
        if (isNaN(sec)) return "00:00";
        var h = Math.floor(sec / 3600);
        var m = Math.floor((sec % 3600) / 60);
        var s = Math.floor(sec % 60);
        var res = "";
        if (h > 0) res += h + ":";
        res += (m < 10 && h > 0 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
        return res;
    }

    function updateFocus() {
        focusableElements.forEach((el, idx) => {
            if (idx === currentFocusIndex) el.classList.add('sp-focused');
            else el.classList.remove('sp-focused');
        });
    }

    function handleKeyDown(e) {
        if (window.SunPlay && SunPlay.App && SunPlay.App.getCurrentScreen() !== 'player') return;

        resetAutoHide();
        
        if (popupWrapper.classList.contains('sp-show')) {
            handlePopupKeys(e);
            return;
        }
        
        var key = e.keyCode || e.which;
        
        switch(key) {
            case 38: // Up
                if (!isVisible) Controls.show();
                else {
                    if (currentFocusIndex > 0) { // move from buttons to seek bar
                        currentFocusIndex = 0;
                        updateFocus();
                    }
                }
                e.preventDefault();
                break;
            case 40: // Down
                if (!isVisible) Controls.show();
                else {
                    if (currentFocusIndex === 0 && focusableElements.length > 1) { // move from seek bar to buttons
                        currentFocusIndex = 1;
                        updateFocus();
                    }
                }
                e.preventDefault();
                break;
            case 37: // Left
                if (!isVisible) {
                    player.seekRelative(-10);
                    showBigPlay('⏪ -10s');
                } else {
                    if (currentFocusIndex === 0) { // Seek bar
                        player.seekRelative(-10);
                        showBigPlay('⏪ -10s');
                    } else if (currentFocusIndex > 1) {
                        currentFocusIndex--;
                        updateFocus();
                    }
                }
                e.preventDefault();
                break;
            case 39: // Right
                if (!isVisible) {
                    player.seekRelative(10);
                    showBigPlay('⏩ +10s');
                } else {
                    if (currentFocusIndex === 0) { // Seek bar
                        player.seekRelative(10);
                        showBigPlay('⏩ +10s');
                    } else if (currentFocusIndex > 0 && currentFocusIndex < focusableElements.length - 1) {
                        currentFocusIndex++;
                        updateFocus();
                    }
                }
                e.preventDefault();
                break;
            case 13: // Enter
                if (!isVisible) Controls.show();
                else {
                    var el = focusableElements[currentFocusIndex];
                    if (el.id === 'sp-seek-bar') player.togglePlayPause();
                    else if (el.id === 'sp-btn-play') player.togglePlayPause();
                    else if (el.id === 'sp-btn-restart') { player.seek(0); player.resume(); }
                    else if (el.id === 'sp-btn-sub') openSubtitlePopup();
                    else if (el.id === 'sp-btn-aud') openAudioPopup();
                    else if (el.id === 'sp-btn-spd') openSpeedPopup();
                    else if (el.id === 'sp-btn-info') {
                        if (els.debugOverlay) {
                            els.debugOverlay.style.display = els.debugOverlay.style.display === 'none' ? 'block' : 'none';
                        }
                    }
                }
                e.preventDefault();
                break;
            case 415: // Play
                player.resume(); break;
            case 19: // Pause
                player.pause(); break;
            case 413: // Stop
            case 461: // webOS Back
            case 8: // Backspace
            case 27: // Esc
                if (popupWrapper.classList.contains('sp-show')) {
                    closePopup();
                } else if (isVisible) {
                    Controls.hide();
                } else {
                    // Controls already hidden — stop player and go back to home
                    player.stop();
                    if (SunPlay.App && SunPlay.App.showScreen) {
                        SunPlay.App.showScreen('home');
                    }
                }
                e.preventDefault();
                break;
            case 417: // FastForward
                player.seekRelative(30); break;
            case 412: // Rewind
                player.seekRelative(-30); break;
            case 404: // Green - Subtitle
                openSubtitlePopup(); break;
            case 405: // Yellow - Audio
                openAudioPopup(); break;
            case 406: // Blue - Speed
                openSpeedPopup(); break;
            case 457: // Info key
            case 48: // '0' key
                if (els.debugOverlay) {
                    els.debugOverlay.style.display = els.debugOverlay.style.display === 'none' ? 'block' : 'none';
                }
                e.preventDefault();
                break;
        }
    }

    function handlePopupKeys(e) {
        var key = e.keyCode || e.which;
        var items = document.querySelectorAll('.sp-popup-item');
        
        switch(key) {
            case 38: // Up
                if (popupFocusIndex > 0) popupFocusIndex--;
                updatePopupFocus(items);
                e.preventDefault();
                break;
            case 40: // Down
                if (popupFocusIndex < popupList.length - 1) popupFocusIndex++;
                updatePopupFocus(items);
                e.preventDefault();
                break;
            case 13: // Enter
                if (popupCallback) popupCallback(popupList[popupFocusIndex]);
                closePopup();
                e.preventDefault();
                break;
            case 461: // Back
            case 8:
            case 27:
                closePopup();
                e.preventDefault();
                break;
        }
    }

    function updatePopupFocus(items) {
        items.forEach((el, idx) => {
            if (idx === popupFocusIndex) el.classList.add('sp-focused');
            else el.classList.remove('sp-focused');
        });
        if (items[popupFocusIndex]) {
            items[popupFocusIndex].scrollIntoView({ block: 'nearest' });
        }
    }

    function showPopup(title, list, activeId, callback) {
        document.getElementById('sp-popup-title').innerText = title;
        var listContainer = document.getElementById('sp-popup-list');
        listContainer.innerHTML = '';
        
        popupList = list;
        popupCallback = callback;
        popupFocusIndex = 0;
        
        list.forEach((item, idx) => {
            var el = document.createElement('div');
            el.className = 'sp-popup-item';
            if (item.id === activeId || item.value === activeId) {
                el.classList.add('sp-active');
                popupFocusIndex = idx;
            }
            el.innerText = item.label;
            listContainer.appendChild(el);
        });
        
        popupWrapper.classList.add('sp-show');
        updatePopupFocus(document.querySelectorAll('.sp-popup-item'));
    }

    function closePopup() {
        popupWrapper.classList.remove('sp-show');
        resetAutoHide();
    }

    // ============================================================
    // SUBTITLE MODAL — embedded tracks + OpenSubtitles search
    // ============================================================
    var subModal = null;
    var subModalFocusables = [];
    var subModalFocusIdx = 0;
    var subSearchResults = [];
    var currentVideoTitle = '';

    function openSubtitlePopup() {
        currentVideoTitle = (window._spCurrentTitle || '').replace(/\s*(Google Drive|YouTube|Video from\s+\S+)\s*/i, '').trim();
        buildSubModal();
    }

    function buildSubModal() {
        if (!subModal) {
            subModal = document.createElement('div');
            subModal.id = 'sp-sub-modal';
            subModal.style.cssText = [
                'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10000',
                'display:flex;align-items:center;justify-content:center'
            ].join(';');
            document.body.appendChild(subModal);
        }

        var embeddedTracks = player.getSubtitleTracks();
        var embeddedHtml = '';
        if (embeddedTracks.length > 0) {
            embeddedHtml = '<div class="sp-sub-section-label">Embedded Tracks</div>';
            embeddedTracks.forEach(function(t, i) {
                var active = t.mode === 'showing' ? ' sp-sub-active' : '';
                embeddedHtml += '<button class="sp-sub-item sp-sub-embedded' + active + '" data-trackid="' + t.id + '">' +
                    '🎬 ' + (t.label || ('Track ' + (i+1))) + (t.language ? ' [' + t.language + ']' : '') +
                    '</button>';
            });
            embeddedHtml += '<button class="sp-sub-item sp-sub-off" data-trackid="off">🔇 Turn Off Subtitles</button>';
        }

        subModal.innerHTML = '<div class="sp-sub-box">' +
            '<div class="sp-sub-header">' +
                '<span class="sp-sub-title-label">💬 Subtitles</span>' +
                '<span class="sp-sub-close" id="sp-sub-close">✕ Close</span>' +
            '</div>' +
            (embeddedHtml || '<div class="sp-sub-section-label" style="color:#888;">No embedded tracks detected</div>') +
            '<div class="sp-sub-section-label" style="margin-top:16px;">Search OpenSubtitles.org</div>' +
            '<div class="sp-sub-search-row">' +
                '<input id="sp-sub-searchbox" class="sp-sub-input" type="text" placeholder="Movie / show name..." value="' + escapeAttr(currentVideoTitle) + '" />' +
                '<button class="sp-sub-item sp-sub-search-btn" id="sp-sub-search-btn">🔍 Search</button>' +
            '</div>' +
            '<div id="sp-sub-results" class="sp-sub-results"></div>' +
            '<div class="sp-sub-section-label" style="margin-top:12px;">Paste Subtitle URL (.srt / .vtt)</div>' +
            '<div class="sp-sub-search-row">' +
                '<input id="sp-sub-urlbox" class="sp-sub-input" type="text" placeholder="https://..." />' +
                '<button class="sp-sub-item sp-sub-url-btn" id="sp-sub-url-btn">▶ Load</button>' +
            '</div>' +
        '</div>';

        subModal.style.display = 'flex';
        injectSubStyles();
        bindSubModal();
        refreshSubFocusables();
        if (subModalFocusables.length > 0) {
            subModalFocusIdx = 0;
            subModalFocusables[0].focus();
        }
    }

    function escapeAttr(s) {
        return (s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    }

    function refreshSubFocusables() {
        subModalFocusables = Array.from(subModal.querySelectorAll('button, input'));
        subModalFocusIdx = 0;
    }

    function bindSubModal() {
        // Embedded track buttons
        subModal.querySelectorAll('.sp-sub-embedded').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var id = parseInt(btn.getAttribute('data-trackid'));
                player.setSubtitleTrack(id);
                closeSubModal();
            });
        });
        var offBtn = subModal.querySelector('.sp-sub-off');
        if (offBtn) offBtn.addEventListener('click', function() { player.disableSubtitles(); closeSubModal(); });

        // Close
        var closeBtn = document.getElementById('sp-sub-close');
        if (closeBtn) closeBtn.addEventListener('click', closeSubModal);

        // Search
        var searchBtn = document.getElementById('sp-sub-search-btn');
        var searchBox = document.getElementById('sp-sub-searchbox');
        if (searchBtn) searchBtn.addEventListener('click', function() { doSubSearch(searchBox.value.trim()); });
        if (searchBox) {
            searchBox.addEventListener('keydown', function(e) {
                if (e.keyCode === 13) { e.preventDefault(); doSubSearch(searchBox.value.trim()); }
                e.stopPropagation();
            });
        }

        // Paste URL
        var urlBtn = document.getElementById('sp-sub-url-btn');
        var urlBox = document.getElementById('sp-sub-urlbox');
        if (urlBtn) urlBtn.addEventListener('click', function() { loadSubFromUrl(urlBox.value.trim()); });
        if (urlBox) {
            urlBox.addEventListener('keydown', function(e) {
                if (e.keyCode === 13) { e.preventDefault(); loadSubFromUrl(urlBox.value.trim()); }
                e.stopPropagation();
            });
        }

        // Remote nav for the whole modal
        subModal.addEventListener('keydown', handleSubModalKey);
    }

    function handleSubModalKey(e) {
        var key = e.keyCode;
        if (key === 461 || key === 8 || key === 27) { // Back/Esc
            closeSubModal();
            e.preventDefault();
            return;
        }
        if (key === 38 || key === 40) { // Up/Down
            refreshSubFocusables();
            if (key === 38) subModalFocusIdx = Math.max(0, subModalFocusIdx - 1);
            else subModalFocusIdx = Math.min(subModalFocusables.length - 1, subModalFocusIdx + 1);
            subModalFocusables[subModalFocusIdx].focus();
            e.preventDefault();
        }
    }

    function doSubSearch(query) {
        if (!query) return;
        var resultsEl = document.getElementById('sp-sub-results');
        if (!resultsEl) return;
        resultsEl.innerHTML = '<div class="sp-sub-loading">🔍 Searching OpenSubtitles...</div>';

        // OpenSubtitles API — uses a public API key for open-source apps
        var apiUrl = 'https://api.opensubtitles.com/api/v1/subtitles?query=' +
            encodeURIComponent(query) + '&languages=en&type=movie';

        fetch(apiUrl, {
            headers: {
                'Api-Key': 'sJAbxJNrPBGGqfvbEDDjQFaQVWiZhQGx',
                'Content-Type': 'application/json',
                'User-Agent': 'SunPlay v1.0'
            }
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            subSearchResults = (data.data || []).slice(0, 12);
            renderSubResults(subSearchResults);
        })
        .catch(function(err) {
            resultsEl.innerHTML = '<div class="sp-sub-loading" style="color:#f66;">Search failed. Check your internet connection.</div>';
        });
    }

    function renderSubResults(results) {
        var resultsEl = document.getElementById('sp-sub-results');
        if (!resultsEl) return;
        if (!results || results.length === 0) {
            resultsEl.innerHTML = '<div class="sp-sub-loading" style="color:#fa0;">No results. Try a different title.</div>';
            return;
        }
        var html = '';
        results.forEach(function(item, idx) {
            var attrs = item.attributes || {};
            var files = attrs.files || [];
            var fileId = files.length > 0 ? files[0].file_id : null;
            var title = attrs.feature_details ? attrs.feature_details.movie_name : (attrs.release || 'Unknown');
            var lang = attrs.language || 'en';
            var downloads = attrs.download_count || 0;
            var rating = attrs.ratings ? parseFloat(attrs.ratings).toFixed(1) : '';
            if (!fileId) return;
            html += '<button class="sp-sub-item sp-sub-result" data-fileid="' + fileId + '" data-title="' + escapeAttr(title) + '">' +
                '📄 ' + escapeAttr(title.substring(0, 38)) + (title.length > 38 ? '…' : '') +
                ' <span style="opacity:0.6;font-size:0.85em;">[' + lang + ']' + (rating ? ' ★' + rating : '') + ' ↓' + downloads + '</span>' +
                '</button>';
        });
        resultsEl.innerHTML = html || '<div class="sp-sub-loading" style="color:#fa0;">No downloadable results.</div>';

        // Bind result clicks
        resultsEl.querySelectorAll('.sp-sub-result').forEach(function(btn) {
            btn.addEventListener('click', function() {
                downloadAndApplySub(btn.getAttribute('data-fileid'), btn.getAttribute('data-title'));
            });
        });
        refreshSubFocusables();
    }

    function downloadAndApplySub(fileId, title) {
        var resultsEl = document.getElementById('sp-sub-results');
        if (resultsEl) resultsEl.innerHTML = '<div class="sp-sub-loading">⏳ Loading subtitle...</div>';

        fetch('https://api.opensubtitles.com/api/v1/download', {
            method: 'POST',
            headers: {
                'Api-Key': 'sJAbxJNrPBGGqfvbEDDjQFaQVWiZhQGx',
                'Content-Type': 'application/json',
                'User-Agent': 'SunPlay v1.0'
            },
            body: JSON.stringify({ file_id: parseInt(fileId) })
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.link) {
                player.addExternalSubtitle(data.link, title || 'Subtitle', 'en');
                closeSubModal();
                // Show a toast if available
                if (window.SunPlay && SunPlay.App && SunPlay.App.showToast) {
                    SunPlay.App.showToast('Subtitle loaded: ' + (title || '').substring(0, 30));
                }
            } else {
                if (resultsEl) resultsEl.innerHTML = '<div class="sp-sub-loading" style="color:#f66;">Download failed. Daily limit may be reached.</div>';
            }
        })
        .catch(function() {
            if (resultsEl) resultsEl.innerHTML = '<div class="sp-sub-loading" style="color:#f66;">Download failed.</div>';
        });
    }

    function loadSubFromUrl(url) {
        if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) return;
        player.addExternalSubtitle(url, 'External Subtitle', 'en');
        closeSubModal();
    }

    function closeSubModal() {
        if (subModal) subModal.style.display = 'none';
        resetAutoHide();
        // Remove keydown listener to avoid leaks
        if (subModal) subModal.removeEventListener('keydown', handleSubModalKey);
    }

    function injectSubStyles() {
        if (document.getElementById('sp-sub-styles')) return;
        var s = document.createElement('style');
        s.id = 'sp-sub-styles';
        s.textContent = [
            '.sp-sub-box{background:#141428;border:2px solid #333;border-radius:16px;padding:28px 32px;width:700px;max-width:90vw;max-height:80vh;overflow-y:auto;color:#fff;font-family:sans-serif;}',
            '.sp-sub-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;border-bottom:1px solid #333;padding-bottom:12px;}',
            '.sp-sub-title-label{font-size:24px;font-weight:700;color:#FFD700;}',
            '.sp-sub-close{font-size:18px;color:#888;cursor:pointer;padding:4px 10px;border-radius:6px;}',
            '.sp-sub-close:hover,.sp-sub-close:focus{color:#fff;background:#333;outline:none;}',
            '.sp-sub-section-label{font-size:15px;color:#aaa;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.06em;}',
            '.sp-sub-item{display:block;width:100%;text-align:left;background:#1e1e3a;border:1px solid #333;border-radius:8px;color:#ddd;padding:10px 16px;margin-bottom:6px;font-size:18px;cursor:pointer;}',
            '.sp-sub-item:hover,.sp-sub-item:focus{background:#2a2a50;border-color:#FFD700;color:#fff;outline:none;}',
            '.sp-sub-active{border-color:#FFD700!important;color:#FFD700!important;}',
            '.sp-sub-search-row{display:flex;gap:10px;margin-bottom:10px;}',
            '.sp-sub-input{flex:1;background:#0d0d24;border:1px solid #444;border-radius:8px;color:#fff;padding:10px 14px;font-size:18px;}',
            '.sp-sub-input:focus{border-color:#FFD700;outline:none;}',
            '.sp-sub-search-btn,.sp-sub-url-btn{flex-shrink:0;width:auto;padding:10px 18px;}',
            '.sp-sub-results{max-height:200px;overflow-y:auto;margin-top:4px;}',
            '.sp-sub-loading{color:#aaa;padding:10px 4px;font-size:16px;}',
            '.sp-sub-result{font-size:16px;padding:8px 14px;}'
        ].join('');
        document.head.appendChild(s);
    }



    function openAudioPopup() {
        var tracks = player.getAudioTracks();
        var list = [];
        var activeId = null;
        
        tracks.forEach(t => {
            list.push({ id: t.id, label: t.label + (t.language ? ' [' + t.language + ']' : '') });
            if (t.enabled) activeId = t.id;
        });
        
        if (list.length === 0) list.push({ id: 0, label: 'Default Audio' });
        
        showPopup('Audio Tracks', list, activeId, (selected) => {
            player.setAudioTrack(selected.id);
        });
    }

    function openSpeedPopup() {
        var list = speeds.map(s => ({ value: s, label: s.toFixed(2) + 'x' }));
        // Can't easily get current rate synchronously in this generic design if not tracked, assume 1.0
        showPopup('Playback Speed', list, 1.0, (selected) => {
            player.setPlaybackRate(selected.value);
            els.btnSpd.innerText = '⚡ ' + selected.label;
        });
    }

    function showBigPlay(icon) {
        els.bigPlay.innerText = icon;
        els.bigPlay.classList.add('sp-show');
        setTimeout(() => els.bigPlay.classList.remove('sp-show'), 500);
    }

    function bindPlayerEvents() {
        player.on('play', () => {
            els.btnPlay.innerHTML = '⏸ Pause';
            showBigPlay('▶');
            resetAutoHide();
        });
        player.on('pause', () => {
            els.btnPlay.innerHTML = '▶ Play';
            showBigPlay('⏸');
            Controls.show(); // keep visible when paused
        });
        player.on('buffering', (isBuffering) => {
            var spinner = document.getElementById('sp-spinner');
            if (spinner) {
                spinner.style.display = isBuffering ? 'block' : 'none';
            }
        });
        player.on('timeupdate', (data) => {
            els.timeCurr.innerText = formatTime(data.currentTime);
            els.timeDur.innerText = formatTime(data.duration);
            var pct = data.duration > 0 ? (data.currentTime / data.duration) * 100 : 0;
            els.seekProgress.style.width = pct + '%';
            els.seekHandle.style.left = pct + '%';
            
            var buf = player.getBuffered();
            var bufPct = data.duration > 0 ? (buf / data.duration) * 100 : 0;
            els.seekBuffer.style.width = bufPct + '%';
            
            if (els.debugOverlay && els.debugOverlay.style.display !== 'none') {
                els.dbgBuf.innerText = buf.toFixed(1) + 's (' + bufPct.toFixed(1) + '%)';
                els.dbgState.innerText = player.getState().playing ? 'PLAYING' : (player.getState().paused ? 'PAUSED' : 'BUFFERING');
                
                // Try to extract codec info if available on DOM element
                var vidEl = document.getElementById('sp-video-el');
                if (vidEl && vidEl.getVideoPlaybackQuality) {
                    var q = vidEl.getVideoPlaybackQuality();
                    els.dbgVid.innerText = q.totalVideoFrames + ' frames';
                }
            }
        });
        player.on('title', (t) => { els.title.innerText = t; });
        player.on('rateChanged', (data) => { els.btnSpd.innerText = '⚡ ' + data.rate.toFixed(2) + 'x'; });
        player.on('loaded', (data) => {
            if (data && data.videoWidth && data.videoHeight) {
                var resStr = data.videoWidth + 'x' + data.videoHeight;
                var resBadge = document.getElementById('sp-res');
                if (resBadge) resBadge.innerText = resStr;
                els.dbgVid.innerText = resStr + ' (Native API)';
            } else {
                els.dbgVid.innerText = 'Unknown Res';
            }
        });
    }

    function resetAutoHide() {
        clearTimeout(hideTimeout);
        if (isVisible && player.getState().playing && !popupWrapper.classList.contains('sp-show')) {
            hideTimeout = setTimeout(Controls.hide, 5000);
        }
    }

    var Controls = {
        init: function(playerInst, containerEl) {
            player = playerInst;
            container = containerEl;
            
            createUI();
            bindPlayerEvents();
            
            window.addEventListener('keydown', handleKeyDown);
            
            Controls.show();
        },
        
        show: function() {
            isVisible = true;
            controlsWrapper.classList.add('sp-visible');
            
            // Reset focus to Play button if not already focused on something valid
            if (currentFocusIndex === -1 && focusableElements.length > 0) {
                currentFocusIndex = 0;
                updateFocus();
            }
            
            resetAutoHide();
        },
        
        hide: function() {
            if (player.getState().paused) return; // don't hide if paused
            isVisible = false;
            controlsWrapper.classList.remove('sp-visible');
        },
        
        toggle: function() {
            if (isVisible) Controls.hide();
            else Controls.show();
        }
    };

    return Controls;
})();
