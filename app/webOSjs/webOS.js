/**
 * webOS.js — Stub for webOS TV JavaScript library
 * This stub provides mock objects when testing outside a real webOS TV.
 * On a real TV, this file is replaced by the system-provided webOS library.
 */
(function () {
    'use strict';

    // Only create stubs if we're NOT on a real webOS device
    if (typeof window.webOS !== 'undefined' && typeof window.webOSSystem !== 'undefined') {
        console.log('[webOS.js] Running on real webOS device');
        return;
    }

    console.log('[webOS.js] Running in browser dev mode — creating mock webOS objects');

    // Mock webOS object
    window.webOS = window.webOS || {
        platform: { tv: true },
        platformBack: function (callback) {
            window._webOSBackCallback = callback;
        },
        service: {
            request: function (uri, options) {
                console.log('[webOS.mock] Service request:', uri, options);

                var params = options.parameters || {};

                // Simulate common Luna service responses
                setTimeout(function () {
                    var response = { returnValue: true };

                    if (uri.indexOf('connectionmanager') !== -1) {
                        response.wired = { state: 'connected', ipAddress: '192.168.1.100' };
                        response.wifi = { state: 'connected', ipAddress: '192.168.1.101' };
                    } else if (uri.indexOf('systemproperty') !== -1) {
                        response.modelName = 'DEV_BROWSER';
                        response.firmwareVersion = '0.0.0';
                        response.sdkVersion = 'dev';
                    } else if (uri.indexOf('notification') !== -1) {
                        console.log('[webOS.mock] Toast:', params.message);
                    }

                    if (options.onSuccess) {
                        options.onSuccess(response);
                    }
                }, 50);

                return { cancel: function () {} };
            }
        },
        keyboard: {
            isShowing: function () { return false; }
        },
        fetchAppId: function () { return 'com.sunplay.player'; },
        fetchAppInfo: function (cb) {
            if (cb) cb({ id: 'com.sunplay.player', version: '1.0.0', title: 'SunPlay' });
        }
    };

    // Mock webOSSystem (only in dev)
    window.webOSSystem = window.webOSSystem || {
        PmLogString: function (level, context, msg) {
            var levels = ['', '', '', 'ERR', 'WARN', 'INFO', 'DEBUG'];
            console.log('[PmLog/' + (levels[level] || level) + '/' + context + '] ' + msg);
        },
        close: function () {
            console.log('[webOS.mock] App close requested');
        }
    };

})();
