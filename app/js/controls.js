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
                <div class="sp-debug-overlay" id="sp-debug-overlay" style="display:none; position:absolute; right:20px; top:120px; background:rgba(0,0,0,0.8); color:#0f0; padding:15px; font-size:18px; font-family:monospace; border:2px solid #0f0; border-radius:5px; pointer-events:none; z-index:9999;">
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

    function openSubtitlePopup() {
        var tracks = player.getSubtitleTracks();
        var list = [{ id: 'off', label: 'Off' }];
        var activeId = 'off';
        
        tracks.forEach(t => {
            list.push({ id: t.id, label: t.label + (t.language ? ' [' + t.language + ']' : '') });
            if (t.mode === 'showing') activeId = t.id;
        });
        
        if (tracks.length === 0) {
            list.push({ id: 'none', label: '⚠ No subtitles detected' });
            list.push({ id: 'info', label: 'Embedded subs need LG Native Player' });
        }
        
        showPopup('Subtitles', list, activeId, (selected) => {
            if (selected.id === 'off') player.disableSubtitles();
            else if (selected.id === 'none' || selected.id === 'info') { /* do nothing */ }
            else player.setSubtitleTrack(selected.id);
        });
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
