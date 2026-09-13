/**
 * SunPlay — Cloud QR Code Generator
 * Generates a QR code linking to ntfy.sh for remote URL passing
 */
window.SunPlay = window.SunPlay || {};

SunPlay.QR = (function () {
    'use strict';
    
    var container = null;
    var remoteUrl = null;
    var qrInstance = null;
    var pairingCode = null;
    var eventSource = null;

    function init(containerEl) {
        container = containerEl;
        if (!container) return;
        
        // Generate a 4-digit code
        pairingCode = Math.floor(1000 + Math.random() * 9000).toString();
        generateQR(pairingCode);
        setupListener(pairingCode);
    }
    
    function generateQR(code) {
        remoteUrl = 'https://ntfy.sh/sunplay_' + code;
        if (!container) return;
        container.innerHTML = '';
        
        try {
            if (typeof qrcode !== 'undefined') {
                // High-precision vector SVG QR generation (sharp on any 1080p/4K TV)
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
                qrInstance = new QRCode(container, {
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
            urlText.innerHTML = "Send a stream URL from phone to:<br><b>" + remoteUrl + "</b>";
        }
    }
    
    function showFallback(text) {
        if (container) container.innerHTML = '<div style="color:#333;font-size:12px;text-align:center;padding:10px;word-break:break-all;">' + text + '</div>';
    }
    
    function setupListener(code) {
        if (eventSource) {
            eventSource.close();
        }
        
        var topicUrl = 'https://ntfy.sh/sunplay_' + code + '/sse';
        console.log('[SunPlay.QR] Listening on ' + topicUrl);
        
        eventSource = new EventSource(topicUrl);
        eventSource.onmessage = function(e) {
            try {
                var data = JSON.parse(e.data);
                if (data.event === 'message' && data.message) {
                    var text = data.message.trim();
                    console.log('[SunPlay.QR] Received text from cloud: ', text);
                    if (SunPlay.App) {
                        var input = document.getElementById('url-input');
                        if (input) input.value = text;
                        
                        if (text.startsWith('http')) {
                            SunPlay.App.showToast('Stream URL received! Ready to play.');
                        } else {
                            SunPlay.App.showToast('Received: ' + text.substring(0, 50));
                        }
                        
                        // Focus the play button directly for immediate playback
                        var playBtn = document.getElementById('play-btn');
                        if (playBtn) playBtn.focus();

                        // Make sure we're on the home screen so the user sees the URL
                        if (SunPlay.App.showScreen) {
                            SunPlay.App.showScreen('home');
                        }
                    }
                }
            } catch (err) {
                console.error('[SunPlay.QR] Error parsing message', err);
            }
        };
        
        eventSource.onerror = function(e) {
            console.error('[SunPlay.QR] EventSource error', e);
        };
    }

    function refresh() {
        if (container) container.innerHTML = '<div class="qr-placeholder">Refreshing...</div>';
        init(container);
    }
    
    return {
        init: init,
        refresh: refresh,
        getUrl: function() { return remoteUrl; },
        getCode: function() { return pairingCode; }
    };
})();
