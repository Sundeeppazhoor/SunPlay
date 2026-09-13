/**
 * SunPlay — Main Application Controller
 * Handles screen management, navigation, history, and app lifecycle
 */
window.SunPlay = window.SunPlay || {};

SunPlay.App = (function () {
    'use strict';

    var currentScreen = 'home';
    var focusableElements = [];
    var currentFocusIndex = 0;
    var isPlayerActive = false;

    /** Settings defaults */
    var settings = {
        autoResume: true,
        lowMemoryMode: true,
        serverPort: 3000
    };

    /* ============ INITIALIZATION ============ */

    /**
     * Initialize the entire application
     */
    function init() {
        console.log('[SunPlay] Initializing...');

        // Load settings
        loadSettings();

        // Init player engine
        var playerContainer = document.getElementById('player-container');
        if (playerContainer && SunPlay.Player) {
            SunPlay.Player.init(playerContainer);
        }

        // Init QR code immediately on startup
        if (SunPlay.QR) {
            var qrContainer = document.getElementById('qr-container');
            SunPlay.QR.init(qrContainer);
        }

        // Init remote server
        if (SunPlay.Remote) {
            SunPlay.Remote.init();
        }

        // Setup navigation
        setupNavigation();

        // Setup home screen events
        setupHomeScreen();

        // Setup settings screen
        setupSettingsScreen();

        // Load history
        renderHistory();

        // Focus initial element (Focus Play button to avoid virtual keyboard auto-pop)
        var playBtn = document.getElementById('play-btn');
        if (playBtn) {
            playBtn.focus();
        }

        // Device info
        loadDeviceInfo();

        // Handle webOS app lifecycle
        setupWebOSLifecycle();

        console.log('[SunPlay] Initialized successfully');
    }

    /* ============ SCREEN MANAGEMENT ============ */

    /**
     * Switch between screens
     * @param {string} screenId - 'home', 'player', or 'settings'
     */
    function showScreen(screenId) {
        var screens = document.querySelectorAll('.screen');
        for (var i = 0; i < screens.length; i++) {
            screens[i].classList.remove('active');
        }

        var target = document.getElementById(screenId + '-screen');
        if (target) {
            target.classList.add('active');
            currentScreen = screenId;
        }

        // Focus management and memory optimization per screen
        var homeScreen = document.getElementById('home-screen');
        if (screenId === 'home') {
            isPlayerActive = false;
            if (homeScreen) homeScreen.style.display = '';
            setTimeout(function () {
                var playBtn = document.getElementById('play-btn');
                if (playBtn) playBtn.focus();
            }, 100);
        } else if (screenId === 'player') {
            isPlayerActive = true;
            if (homeScreen) homeScreen.style.display = 'none';
        } else if (screenId === 'settings') {
            isPlayerActive = false;
            if (homeScreen) homeScreen.style.display = 'none';
            setTimeout(function () {
                var backBtn = document.getElementById('settings-back-btn');
                if (backBtn) backBtn.focus();
            }, 100);
        }
    }

    /**
     * @returns {string} current screen id
     */
    function getCurrentScreen() {
        return currentScreen;
    }

    /* ============ HOME SCREEN ============ */

    function setupHomeScreen() {
        var playBtn = document.getElementById('play-btn');
        if (playBtn) {
            playBtn.addEventListener('click', function () {
                var url = document.getElementById('url-input').value.trim();
                if (url) playUrl(url);
            });
            playBtn.addEventListener('keydown', function(e) {
                if (e.keyCode === 13) e.stopPropagation();
            });
        }

        // Sample button
        var sampleBtn = document.getElementById('sample-btn');
        if (sampleBtn) {
            sampleBtn.addEventListener('click', function () {
                var sampleUrl = "https://worker-yellow-art-05f7.hopomi6485.workers.dev/df51161282fa868d4aa39b5ea9d14b4f12c8d7627bae86339e3b6f33114c3ffefa545b447a3ca3d33dfa01a6bc7c6331f35066947b68b77aec884f1dc05d382af5a428237fc81c6e68147b90b0f9f9ef56ba8346a38f816ec15aa93f0179d95459bd21f7f2437cef81e0f52c3ce520ec731c83d61bbd138c99cd5ae1da471293a8ee7c856a152e6104b2ef479bbd2b95b3b48433a32f4d1b0d3c7d483e0f1b388ce12f90e78b2c8aeaae433616eb4219::1ffa27214a5d162a994650b7bc857511/Avatar%20Fire%20and%20Ash%20(2025)%20IMAX%202160p%20UHD%20BluRay%20REMUX%20DV%20HDR%2010bit%20HEVC%20[Hindi%20DDP%205.1%20%20English%20TrueHD%20Atmos%205.1]%20x265%20(CHD-UHDMovies).mkv";
                document.getElementById('url-input').value = sampleUrl;
                playUrl(sampleUrl);
            });
            sampleBtn.addEventListener('keydown', function(e) {
                if (e.keyCode === 13) e.stopPropagation();
            });
        }


        // Clear Cache Header Button
        var clearCacheBtn = document.getElementById('clear-cache-btn');
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', clearAppCache);
        }

        // Start Server / Cloud Pair button
        var startServerBtn = document.getElementById('start-server-btn');
        if (startServerBtn) {
            startServerBtn.addEventListener('click', function () {
                document.getElementById('start-server-btn').style.display = 'none';
                document.getElementById('qr-container').style.display = 'flex';
                showToast('Cloud Pairing Started');
                
                if (SunPlay.QR) {
                    SunPlay.QR.init(document.getElementById('qr-container'));
                }
                
                // Focus play button instead of urlInput to avoid virtual keyboard
                var playBtn = document.getElementById('play-btn');
                if (playBtn) playBtn.focus();
            });
        }

        // URL input — Enter key
        var urlInput = document.getElementById('url-input');
        if (urlInput) {
            urlInput.addEventListener('keydown', function (e) {
                if (e.keyCode === 13) { // Enter
                    e.preventDefault();
                    e.stopPropagation();
                    var url = urlInput.value.trim();
                    if (url) playUrl(url);
                }
            });
        }

        // Clear history
        var clearBtn = document.getElementById('clear-history-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', function () {
                if (SunPlay.Utils && SunPlay.Utils.storage) {
                    SunPlay.Utils.storage.set('sunplay_history', []);
                    renderHistory();
                    showToast('History cleared');
                }
            });
        }

        // Settings button
        var settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', function () {
                showScreen('settings');
            });
        }
    }

    /* ============ PLAY URL ============ */

    /**
     * Validate and play a URL
     * @param {string} url
     */
    function playUrl(url) {
        if (!url) return;

        // Basic URL validation
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }

        if (SunPlay.Utils && !SunPlay.Utils.validateUrl(url)) {
            showToast('Invalid URL');
            return;
        }

        console.log('[SunPlay] Playing URL:', url.substring(0, 100) + '...');

        // Extract clean display title from URL
        var title = 'Stream';
        if (SunPlay.Player && SunPlay.Player.cleanStreamTitle) {
            title = SunPlay.Player.cleanStreamTitle(url);
        } else if (SunPlay.Utils) {
            title = SunPlay.Utils.extractFilename(url) || 'Stream';
        }

        // Add to history
        addToHistory({
            url: url,
            title: title,
            timestamp: Date.now(),
            position: 0
        });

        launchPlayer(url, title);
    }

    /**
     * Launch playback using the high-performance SunPlay Native Player Engine
     */
    function launchPlayer(url, title, options) {
        showScreen('player');
        if (SunPlay.Player) {
            SunPlay.Player.play(url, Object.assign({ title: title }, options || {}));
        }
    }

    /* ============ HISTORY ============ */

    function getHistory() {
        if (SunPlay.Utils && SunPlay.Utils.storage) {
            var hist = SunPlay.Utils.storage.get('sunplay_history');
            if (hist && Array.isArray(hist)) return hist;
        }
        return [];
    }

    function addToHistory(item) {
        var history = getHistory();
        // Remove duplicate
        history = history.filter(function (h) { return h.url !== item.url; });
        // Add to front
        history.unshift(item);
        // Limit to 50
        if (history.length > 50) history = history.slice(0, 50);

        if (SunPlay.Utils && SunPlay.Utils.storage) {
            SunPlay.Utils.storage.set('sunplay_history', history);
        }
        renderHistory();
    }

    function renderHistory() {
        var list = document.getElementById('history-list');
        var empty = document.getElementById('history-empty');
        if (!list) return;

        var history = getHistory();

        // Clear existing cards
        var cards = list.querySelectorAll('.history-card');
        for (var i = 0; i < cards.length; i++) {
            cards[i].remove();
        }

        if (history.length === 0) {
            if (empty) empty.style.display = 'block';
            return;
        }

        if (empty) empty.style.display = 'none';

        history.forEach(function (item, index) {
            var card = document.createElement('div');
            card.className = 'history-card';
            card.setAttribute('data-focusable', 'true');
            card.setAttribute('tabindex', '0');
            card.setAttribute('data-url', item.url);

            var timeAgo = getTimeAgo(item.timestamp);
            var displayTitle = item.title || 'Unknown';
            if (displayTitle.length > 40) {
                displayTitle = displayTitle.substring(0, 40) + '...';
            }

            card.innerHTML =
                '<div class="history-card-icon">' +
                '  <svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>' +
                '</div>' +
                '<div class="history-card-title">' + escapeHtml(displayTitle) + '</div>' +
                '<div class="history-card-meta">' + timeAgo + '</div>';

            var handleCardSelect = function () {
                var savedPos = 0;
                if (SunPlay.Player && SunPlay.Player.getSavedProgress) {
                    savedPos = SunPlay.Player.getSavedProgress(item.url);
                } else {
                    try {
                        savedPos = parseFloat(localStorage.getItem('sp_resume_' + encodeURIComponent(item.url))) || 0;
                    } catch (e) {}
                }

                if (savedPos > 10) {
                    showHistoryChoiceModal(item, savedPos);
                } else {
                    playUrl(item.url);
                }
            };

            card.addEventListener('click', handleCardSelect);
            card.addEventListener('keydown', function (e) {
                if (e.keyCode === 13) { // Enter
                    e.preventDefault();
                    e.stopPropagation();
                    handleCardSelect();
                }
            });

            list.appendChild(card);
        });
    }

    function showHistoryChoiceModal(item, savedPos) {
        var modal = document.getElementById('sp-history-choice-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'sp-history-choice-modal';
            modal.className = 'sp-modal-overlay';
            document.body.appendChild(modal);
        }

        var formattedTime = formatTime(savedPos);
        modal.innerHTML = `
            <div class="sp-modal-card">
                <div class="sp-modal-title">${escapeHtml(item.title || 'Stream')}</div>
                <div class="sp-modal-desc">Saved playback progress found at <b>${formattedTime}</b>. How would you like to play?</div>
                <div class="sp-modal-actions">
                    <button class="sp-modal-btn primary focused" id="sp-hist-resume">▶ Resume from ${formattedTime}</button>
                    <button class="sp-modal-btn secondary" id="sp-hist-start">↺ Start from Beginning</button>
                    <button class="sp-modal-btn danger" id="sp-hist-delete">🗑 Remove from History</button>
                    <button class="sp-modal-btn text" id="sp-hist-cancel">Cancel</button>
                </div>
            </div>
        `;
        modal.style.display = 'flex';

        var resumeBtn = document.getElementById('sp-hist-resume');
        var startBtn = document.getElementById('sp-hist-start');
        var deleteBtn = document.getElementById('sp-hist-delete');
        var cancelBtn = document.getElementById('sp-hist-cancel');

        function closeModal() {
            if (modal) modal.style.display = 'none';
        }

        resumeBtn.addEventListener('click', function () {
            closeModal();
            launchPlayer(item.url, item.title, { resume: true });
        });

        startBtn.addEventListener('click', function () {
            closeModal();
            try {
                localStorage.removeItem('sp_resume_' + encodeURIComponent(item.url));
            } catch (e) {}
            launchPlayer(item.url, item.title, { resume: false });
        });

        deleteBtn.addEventListener('click', function () {
            closeModal();
            try {
                localStorage.removeItem('sp_resume_' + encodeURIComponent(item.url));
            } catch (e) {}
            var history = getHistory().filter(function (h) { return h.url !== item.url; });
            if (SunPlay.Utils && SunPlay.Utils.storage) {
                SunPlay.Utils.storage.set('sunplay_history', history);
            }
            renderHistory();
            showToast('Removed from history');
        });

        cancelBtn.addEventListener('click', closeModal);

        var buttons = [resumeBtn, startBtn, deleteBtn, cancelBtn];
        var focusIdx = 0;
        resumeBtn.focus();

        modal.onkeydown = function (e) {
            var k = e.keyCode;
            if (k === 38) { // Up
                e.preventDefault();
                focusIdx = Math.max(0, focusIdx - 1);
                buttons[focusIdx].focus();
            } else if (k === 40) { // Down
                e.preventDefault();
                focusIdx = Math.min(buttons.length - 1, focusIdx + 1);
                buttons[focusIdx].focus();
            } else if (k === 461 || k === 27 || k === 8) { // Back
                e.preventDefault();
                e.stopPropagation();
                closeModal();
            }
        };
    }

    function clearAppCache() {
        try {
            var count = 0;
            var keysToRemove = [];
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                if (k && (k.startsWith('sp_resume_') || k.startsWith('sp_cache_'))) {
                    keysToRemove.push(k);
                }
            }
            keysToRemove.forEach(function (k) {
                localStorage.removeItem(k);
                count++;
            });

            if (SunPlay.Player && SunPlay.Player.clearCache) {
                SunPlay.Player.clearCache();
            }

            showToast('Cache & Memory Buffers Cleared!');
        } catch (e) {
            console.error('[SunPlay] Clear cache error:', e);
            showToast('Cache cleared');
        }
    }

    function formatTime(s) {
        if (!s || isNaN(s)) return '00:00';
        var h = Math.floor(s / 3600);
        var m = Math.floor((s % 3600) / 60);
        var sec = Math.floor(s % 60);
        if (h > 0) {
            return (h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m) + ':' + (sec < 10 ? '0' + sec : sec);
        }
        return (m < 10 ? '0' + m : m) + ':' + (sec < 10 ? '0' + sec : sec);
    }

    function getTimeAgo(timestamp) {
        var diff = Date.now() - timestamp;
        var mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return mins + 'm ago';
        var hours = Math.floor(mins / 60);
        if (hours < 24) return hours + 'h ago';
        var days = Math.floor(hours / 24);
        return days + 'd ago';
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    /* ============ NAVIGATION ============ */

    function setupNavigation() {
        document.addEventListener('keydown', function (e) {
            var keyCode = e.keyCode;

            // Intercept navigation if popup is open
            var overlay = document.getElementById('sp-error-overlay');
            if (overlay && overlay.style.display !== 'none') {
                e.preventDefault();
                e.stopPropagation();
                var btn = document.getElementById('sp-err-ok');
                if (btn) {
                    btn.focus();
                    if (keyCode === 13) btn.click();
                }
                // Back key should close the popup
                if (keyCode === 461 || keyCode === 8 || keyCode === 27) {
                    closeErrorPopup();
                }
                return;
            }

            // When in player screen, let sunplay-player.js handle ALL keys
            if (currentScreen === 'player' && SunPlay.Player) {
                return;
            }

            // Back key handling for home/settings screens only
            if (keyCode === 461 || keyCode === 8 || keyCode === 27) {
                e.preventDefault();
                e.stopPropagation();
                handleBack();
                return;
            }

            // Home/Settings screen spatial navigation
            switch (keyCode) {
                case 37: // Left
                    navigateDirection('left');
                    break;
                case 38: // Up
                    navigateDirection('up');
                    break;
                case 39: // Right
                    navigateDirection('right');
                    break;
                case 40: // Down
                    navigateDirection('down');
                    break;
                case 13: // Enter
                    e.preventDefault();
                    e.stopPropagation();
                    activateFocused();
                    break;
            }
        });
    }

    function handleBack() {
        var overlay = document.getElementById('sp-error-overlay');
        if (overlay && overlay.style.display !== 'none') {
            closeErrorPopup();
            return;
        }

        if (currentScreen === 'player') {
            if (SunPlay.Player) SunPlay.Player.stop();
            showScreen('home');
        } else if (currentScreen === 'settings') {
            showScreen('home');
        } else {
            if (window.webOS && webOS.platformBack) {
                webOS.platformBack();
            } else if (window.close) {
                window.close();
            }
        }
    }

    function navigateDirection(direction) {
        var active = document.activeElement;
        if (!active) return;

        // 1. Explicit deterministic grid transitions for Home screen
        if (currentScreen === 'home') {
            if (active.id === 'clear-cache-btn') {
                if (direction === 'down') {
                    var pBtn = document.getElementById('play-btn');
                    if (pBtn) { pBtn.focus(); return; }
                } else if (direction === 'left') {
                    var uInp = document.getElementById('url-input');
                    if (uInp) { uInp.focus(); return; }
                }
                return;
            } else if (active.id === 'url-input') {
                if (direction === 'up') {
                    var cBtn = document.getElementById('clear-cache-btn');
                    if (cBtn) { cBtn.focus(); return; }
                } else if (direction === 'right') {
                    var pBtn = document.getElementById('play-btn');
                    if (pBtn) { pBtn.focus(); return; }
                } else if (direction === 'down') {
                    var firstCard = document.querySelector('.history-card');
                    if (firstCard) { firstCard.focus(); return; }
                    var sBtn = document.getElementById('settings-btn');
                    if (sBtn) { sBtn.focus(); return; }
                }
            } else if (active.id === 'play-btn') {
                if (direction === 'up') {
                    var cBtn = document.getElementById('clear-cache-btn');
                    if (cBtn) { cBtn.focus(); return; }
                } else if (direction === 'left') {
                    var uInp = document.getElementById('url-input');
                    if (uInp) { uInp.focus(); return; }
                } else if (direction === 'down') {
                    var firstCard = document.querySelector('.history-card');
                    if (firstCard) { firstCard.focus(); return; }
                    var sBtn = document.getElementById('settings-btn');
                    if (sBtn) { sBtn.focus(); return; }
                }
            } else if (active.classList.contains('history-card')) {
                if (direction === 'up') {
                    var pBtn = document.getElementById('play-btn');
                    if (pBtn) { pBtn.focus(); return; }
                    var uInp = document.getElementById('url-input');
                    if (uInp) { uInp.focus(); return; }
                } else if (direction === 'down') {
                    var sBtn = document.getElementById('settings-btn');
                    if (sBtn) { sBtn.focus(); return; }
                } else if (direction === 'right') {
                    var next = active.nextElementSibling;
                    if (next && next.classList.contains('history-card')) { next.focus(); return; }
                    var clr = document.getElementById('clear-history-btn');
                    if (clr) { clr.focus(); return; }
                } else if (direction === 'left') {
                    var prev = active.previousElementSibling;
                    if (prev && prev.classList.contains('history-card')) { prev.focus(); return; }
                }
                return;
            } else if (active.id === 'clear-history-btn') {
                if (direction === 'up') {
                    var pBtn = document.getElementById('play-btn');
                    if (pBtn) { pBtn.focus(); return; }
                } else if (direction === 'down') {
                    var sBtn = document.getElementById('settings-btn');
                    if (sBtn) { sBtn.focus(); return; }
                } else if (direction === 'left') {
                    var lastCard = document.querySelector('.history-card:last-child');
                    if (lastCard) { lastCard.focus(); return; }
                }
                return;
            } else if (active.id === 'settings-btn') {
                if (direction === 'up') {
                    var firstCard = document.querySelector('.history-card');
                    if (firstCard) { firstCard.focus(); return; }
                    var pBtn = document.getElementById('play-btn');
                    if (pBtn) { pBtn.focus(); return; }
                    var uInp = document.getElementById('url-input');
                    if (uInp) { uInp.focus(); return; }
                }
                return;
            }
        }

        // 2. Check for data-nav attribute
        var navTarget = active.getAttribute('data-nav-' + direction);
        if (navTarget) {
            var target = document.getElementById(navTarget);
            if (target) {
                target.focus();
                return;
            }
        }

        // 3. Fallback spatial navigation
        var screenEl = document.getElementById(currentScreen + '-screen');
        if (!screenEl) return;

        var focusables = screenEl.querySelectorAll('[data-focusable]');
        if (focusables.length === 0) return;

        var activeRect = active.getBoundingClientRect();
        var bestTarget = null;
        var bestDistance = Infinity;

        for (var i = 0; i < focusables.length; i++) {
            var el = focusables[i];
            if (el === active) continue;

            var rect = el.getBoundingClientRect();
            var dx = rect.left + rect.width / 2 - (activeRect.left + activeRect.width / 2);
            var dy = rect.top + rect.height / 2 - (activeRect.top + activeRect.height / 2);

            var isValid = false;
            switch (direction) {
                case 'up': isValid = dy < -10; break;
                case 'down': isValid = dy > 10; break;
                case 'left': isValid = dx < -10; break;
                case 'right': isValid = dx > 10; break;
            }

            if (isValid) {
                var dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < bestDistance) {
                    bestDistance = dist;
                    bestTarget = el;
                }
            }
        }

        if (bestTarget) {
            bestTarget.focus();
        }
    }

    function activateFocused() {
        var active = document.activeElement;
        if (active && active.click) {
            active.click();
        }
    }

    /* ============ SETTINGS ============ */

    function loadSettings() {
        if (SunPlay.Utils && SunPlay.Utils.storage) {
            var saved = SunPlay.Utils.storage.get('sunplay_settings');
            if (saved) {
                for (var key in saved) {
                    if (settings.hasOwnProperty(key)) {
                        settings[key] = saved[key];
                    }
                }
            }
        }
    }

    function saveSettings() {
        if (SunPlay.Utils && SunPlay.Utils.storage) {
            SunPlay.Utils.storage.set('sunplay_settings', settings);
        }
    }

    function setupSettingsScreen() {
        var backBtn = document.getElementById('settings-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', function () {
                showScreen('home');
            });
        }

        // Toggleable setting items
        var settingItems = document.querySelectorAll('.setting-item[data-setting]');
        for (var i = 0; i < settingItems.length; i++) {
            (function (item) {
                item.addEventListener('click', function () {
                    toggleSetting(item.getAttribute('data-setting'));
                });
                item.addEventListener('keydown', function (e) {
                    if (e.keyCode === 13) {
                        toggleSetting(item.getAttribute('data-setting'));
                    }
                });
            })(settingItems[i]);
        }

        // Clear App Cache item in settings
        var clearCacheItem = document.getElementById('setting-clear-cache-item');
        if (clearCacheItem) {
            clearCacheItem.addEventListener('click', clearAppCache);
            clearCacheItem.addEventListener('keydown', function (e) {
                if (e.keyCode === 13) clearAppCache();
            });
        }

        // Clear History item in settings
        var clearHistoryItem = document.getElementById('setting-clear-history-item');
        if (clearHistoryItem) {
            var doClear = function () {
                if (SunPlay.Utils && SunPlay.Utils.storage) {
                    SunPlay.Utils.storage.set('sunplay_history', []);
                    renderHistory();
                    showToast('Playback history cleared');
                }
            };
            clearHistoryItem.addEventListener('click', doClear);
            clearHistoryItem.addEventListener('keydown', function (e) {
                if (e.keyCode === 13) doClear();
            });
        }

        updateSettingsUI();
    }

    function toggleSetting(key) {
        switch (key) {
            case 'autoResume':
                settings.autoResume = !settings.autoResume;
                break;
            case 'lowMemoryMode':
                settings.lowMemoryMode = !settings.lowMemoryMode;
                break;
        }
        saveSettings();
        updateSettingsUI();
    }

    function updateSettingsUI() {
        var autoEl = document.getElementById('setting-autoResume');
        if (autoEl) autoEl.textContent = settings.autoResume ? 'On' : 'Off';

        var memEl = document.getElementById('setting-lowMemoryMode');
        if (memEl) memEl.textContent = settings.lowMemoryMode ? 'On' : 'Off';
    }

    /* ============ DEVICE INFO ============ */

    function loadDeviceInfo() {
        if (SunPlay.Luna && SunPlay.Luna.isWebOS()) {
            SunPlay.Luna.getDeviceInfo().then(function (info) {
                var el = document.getElementById('setting-deviceInfo');
                if (el && info) {
                    el.textContent = (info.modelName || 'LG TV') + ' (webOS ' + (info.sdkVersion || '?') + ')';
                }
            }).catch(function () {
                var el = document.getElementById('setting-deviceInfo');
                if (el) el.textContent = 'LG TV (webOS)';
            });
        } else {
            var el = document.getElementById('setting-deviceInfo');
            if (el) el.textContent = 'Browser (Dev Mode)';
        }
    }

    /* ============ WEBOS LIFECYCLE ============ */

    function setupWebOSLifecycle() {
        // Handle app visibility
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) {
                // App is hidden — pause player
                if (isPlayerActive && SunPlay.Player) {
                    SunPlay.Player.pause();
                }
            } else {
                // App is visible again
                if (isPlayerActive && SunPlay.Player) {
                    // Don't auto-resume, let user press play
                }
            }
        });

        // Handle webOS relaunch (deep link)
        document.addEventListener('webOSRelaunch', function (e) {
            console.log('[SunPlay] Relaunch event:', e.detail);
            if (e.detail && e.detail.url) {
                playUrl(e.detail.url);
            }
        });

        // If webOS object exists, use it
        if (window.webOS && window.webOS.platformBack) {
            window.webOS.platformBack(function () {
                handleBack();
            });
        }
    }

    /* ============ TOAST ============ */

    function showToast(message) {
        // Try Luna toast first
        if (SunPlay.Luna && SunPlay.Luna.isWebOS()) {
            SunPlay.Luna.showToast(message);
            return;
        }

        // Fallback to custom toast
        var container = document.getElementById('toast-container');
        if (!container) return;

        var toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(function () {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 3000);
    }

    function showErrorPopup(title, message, details) {
        var overlay = document.getElementById('sp-error-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'sp-error-overlay';
            overlay.className = 'sp-popup-overlay'; // Reusing some CSS from controls
            overlay.style.display = 'flex';
            overlay.style.zIndex = '20000';
            
            overlay.innerHTML = `
                <div class="sp-popup-box" style="text-align: center; border-color: #e50914; max-width: 600px;">
                    <div class="sp-popup-title" style="color: #e50914; font-weight: bold; font-size: 28px; border-bottom: none;" id="sp-err-title"></div>
                    <div style="font-size: 22px; color: #fff; margin-bottom: 15px;" id="sp-err-msg"></div>
                    <div style="font-size: 18px; color: #aaa; margin-bottom: 30px;" id="sp-err-det"></div>
                    <button class="sp-btn sp-focused" id="sp-err-ok" style="margin: 0 auto; background: #e50914; border-color: #fff;">OK / Go Back</button>
                </div>
            `;
            document.body.appendChild(overlay);
            
            var btn = document.getElementById('sp-err-ok');
            btn.addEventListener('click', closeErrorPopup);
            btn.addEventListener('keydown', function(e) {
                if (e.keyCode === 13 || e.keyCode === 27 || e.keyCode === 461) {
                    closeErrorPopup();
                    e.preventDefault();
                }
            });
        }
        
        document.getElementById('sp-err-title').innerText = title;
        document.getElementById('sp-err-msg').innerText = message;
        document.getElementById('sp-err-det').innerText = details;
        
        overlay.style.display = 'flex';
        
        setTimeout(function() {
            var btn = document.getElementById('sp-err-ok');
            if (btn) btn.focus();
        }, 100);
    }
    
    function closeErrorPopup() {
        var overlay = document.getElementById('sp-error-overlay');
        if (overlay) overlay.style.display = 'none';
        
        if (SunPlay.Player) SunPlay.Player.stop();
        showScreen('home');
    }

    /* ============ PUBLIC API ============ */

    return {
        init: init,
        showScreen: showScreen,
        getCurrentScreen: getCurrentScreen,
        playUrl: playUrl,
        showToast: showToast,
        settings: settings
    };
})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', function () {
    SunPlay.App.init();
});
