/**
 * SunPlay — Cloud QR Code & Remote Receiver
 * Handles ntfy.sh SSE messages and reconnects when the stream drops.
 */
window.SunPlay = window.SunPlay || {};

SunPlay.QR = (function () {
    'use strict';

    var container = null;
    var remoteUrl = null;
    var pairingCode = null;
    var eventSource = null;
    var reconnectTimer = null;
    var lastMessageId = null;

    function getOrCreatePairingCode() {
        try {
            var saved = localStorage.getItem('sunplay_pair_code');
            if (saved && /^[a-z0-9]{6}$/.test(saved)) return saved;

            var chars = 'abcdefghjkmnpqrstuvwxyz23456789';
            var code = '';
            for (var i = 0; i < 6; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            localStorage.setItem('sunplay_pair_code', code);
            return code;
        } catch (e) {
            return Math.floor(100000 + Math.random() * 900000).toString();
        }
    }

    function init(containerEl, forceNew) {
        container = containerEl;
        if (!container) return;

        if (forceNew) {
            try { localStorage.removeItem('sunplay_pair_code'); } catch (e) {}
        }
        pairingCode = getOrCreatePairingCode();
        generateQR(pairingCode);
        setupListener(pairingCode);
    }

    function generateQR(code) {
        remoteUrl = 'https://sundeeppazhoor.github.io/SunPlay/sender.html?code=' + code;
        if (!container) return;
        container.innerHTML = '';

        try {
            if (typeof qrcode !== 'undefined') {
                var qr = qrcode(0, 'M');
                qr.addData(remoteUrl);
                qr.make();
                container.innerHTML = qr.createSvgTag(4, 2);
                var svgEl = container.querySelector('svg');
                if (svgEl) {
                    svgEl.style.width = '100%';
                    svgEl.style.height = '100%';
                    svgEl.style.display = 'block';
                }
            } else if (typeof QRCode !== 'undefined') {
                new QRCode(container, {
                    text: remoteUrl,
                    width: 140,
                    height: 140,
                    colorDark: '#000000',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.M
                });
            } else {
                showFallback(remoteUrl);
            }
        } catch (e) {
            console.error('[SunPlay.QR] QR generation error:', e);
            showFallback(remoteUrl);
        }

        var urlText = document.getElementById('qr-url-text');
        if (urlText) {
            urlText.innerHTML = 'Open SunPlay Remote on your phone:<br><b>' + remoteUrl + '</b>';
        }
    }

    function showFallback(text) {
        if (container) {
            container.innerHTML = '<div style="color:#333;font-size:12px;text-align:center;padding:10px;word-break:break-all;">' + text + '</div>';
        }
    }

    function extractStreamUrl(rawText) {
        if (!rawText) return '';
        var trimmed = rawText.trim();
        var match = trimmed.match(/https?:\/\/[^\s"'<>]+/i);
        return match ? match[0].replace(/[.,!?;)\]]+$/, '') : trimmed;
    }

    function deliverUrlToApp(rawText) {
        var url = extractStreamUrl(rawText);
        if (!url || !SunPlay.App) return;

        console.log('[SunPlay.QR] Delivering URL to player:', url);
        var input = document.getElementById('url-input');
        if (input) input.value = url;

        if (/^https?:\/\//i.test(url)) {
            SunPlay.App.showToast('Stream URL received! Starting playback...');
            SunPlay.App.playUrl(url);
            return;
        }

        SunPlay.App.showToast('Received: ' + url.substring(0, 50));
        if (SunPlay.App.showScreen) SunPlay.App.showScreen('home');
        var playBtn = document.getElementById('play-btn');
        if (playBtn) playBtn.focus();
    }

    function setupListener(code) {
        if (eventSource) {
            try { eventSource.close(); } catch (e) {}
            eventSource = null;
        }
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }

        var topicUrl = 'https://ntfy.sh/sunplay_' + code + '/sse';
        console.log('[SunPlay.QR] Listening on ' + topicUrl);

        try {
            eventSource = new EventSource(topicUrl);
        } catch (err) {
            console.error('[SunPlay.QR] EventSource creation failed:', err);
            scheduleReconnect(code);
            return;
        }

        var source = eventSource;
        source.onmessage = function (e) {
            if (eventSource !== source) return;
            try {
                var data = JSON.parse(e.data);
                if (data.id && data.id === lastMessageId) return;
                if (data.event !== 'message') return;
                lastMessageId = data.id || null;

                if (data.message && extractStreamUrl(data.message).match(/^https?:\/\//i)) {
                    deliverUrlToApp(data.message);
                } else if (data.attachment && data.attachment.url) {
                    fetch(data.attachment.url)
                        .then(function (response) {
                            if (!response.ok) throw new Error('Attachment request failed: ' + response.status);
                            return response.text();
                        })
                        .then(deliverUrlToApp)
                        .catch(function (err) {
                            console.error('[SunPlay.QR] Attachment fetch failed:', err);
                            if (data.message) deliverUrlToApp(data.message);
                        });
                } else if (data.message) {
                    deliverUrlToApp(data.message);
                }
            } catch (err) {
                console.error('[SunPlay.QR] Error parsing message:', err);
            }
        };

        source.onerror = function () {
            if (eventSource !== source) return;
            console.warn('[SunPlay.QR] SSE disconnected; reconnecting in 4s...');
            try { source.close(); } catch (e) {}
            eventSource = null;
            scheduleReconnect(code);
        };
    }

    function scheduleReconnect(code) {
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(function () {
            reconnectTimer = null;
            setupListener(code);
        }, 4000);
    }

    function refresh() {
        if (container) container.innerHTML = '<div class="qr-placeholder">Refreshing...</div>';
        init(container, true);
        if (SunPlay.App && SunPlay.App.showToast) {
            SunPlay.App.showToast('Generated new QR pairing topic');
        }
    }

    return {
        init: init,
        refresh: refresh,
        getUrl: function () { return remoteUrl; },
        getCode: function () { return pairingCode; }
    };
})();
