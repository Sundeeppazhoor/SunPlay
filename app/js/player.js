window.SunPlay = window.SunPlay || {};

SunPlay.Player = (function() {
    var video = null;
    var container = null;
    var events = {};
    var retryCount = 0;
    var maxRetries = 3;
    var currentUrl = null;
    var currentOptions = null;
    var positionSaveInterval = null;
    var lastSavedPosition = 0;
    
    var state = {
        playing: false,
        paused: false,
        buffering: false,
        stopped: true,
        error: false
    };

    var EventEmitter = {
        on: function(event, callback) {
            if (!events[event]) events[event] = [];
            events[event].push(callback);
        },
        off: function(event, callback) {
            if (!events[event]) return;
            events[event] = events[event].filter(cb => cb !== callback);
        },
        emit: function(event, data) {
            if (!events[event]) return;
            events[event].forEach(cb => {
                try { cb(data); } catch (e) { console.error('Error in event handler for ' + event, e); }
            });
        }
    };

    function updateState(newState) {
        for (var key in state) {
            state[key] = (key === newState);
        }
        if (newState === 'playing') state.paused = false;
        if (newState === 'paused') state.playing = false;
    }

    function savePosition() {
        if (!currentUrl || !video || video.currentTime < 1 || video.duration <= 0 || video.currentTime >= video.duration - 5) return;
        try {
            var saveKey = 'sunplay_resume_' + btoa(currentUrl).substring(0, 50);
            localStorage.setItem(saveKey, video.currentTime);
            lastSavedPosition = video.currentTime;
        } catch (e) {
            console.warn('Failed to save position', e);
        }
    }

    function checkResumePosition(url) {
        try {
            var saveKey = 'sunplay_resume_' + btoa(url).substring(0, 50);
            var pos = localStorage.getItem(saveKey);
            return pos ? parseFloat(pos) : 0;
        } catch (e) {
            return 0;
        }
    }

    function clearResumePosition(url) {
        try {
            var saveKey = 'sunplay_resume_' + btoa(url).substring(0, 50);
            localStorage.removeItem(saveKey);
        } catch(e) {}
    }

    /**
     * Auto-enable the first embedded subtitle/caption track if available.
     * Called after loadedmetadata (and again 1.5s later for webOS native pipeline).
     */
    function autoEnableEmbeddedSubs() {
        if (!video || !video.textTracks || video.textTracks.length === 0) return;
        var alreadyShowing = false;
        for (var i = 0; i < video.textTracks.length; i++) {
            if (video.textTracks[i].mode === 'showing') {
                alreadyShowing = true;
                break;
            }
        }
        if (alreadyShowing) return; // user already picked one, don't override

        // Enable the first subtitle or captions track
        for (var j = 0; j < video.textTracks.length; j++) {
            var t = video.textTracks[j];
            if (t.kind === 'subtitles' || t.kind === 'captions') {
                t.mode = 'showing';
                console.log('[SunPlay] Auto-enabled embedded subtitle track:', t.label || ('Track ' + j), t.language);
                EventEmitter.emit('subtitleChanged');
                break;
            }
        }
    }

    function attachEvents() {
        video.addEventListener('play', () => {
            updateState('playing');
            EventEmitter.emit('play');
        });
        video.addEventListener('pause', () => {
            if (!state.stopped) updateState('paused');
            EventEmitter.emit('pause');
        });
        video.addEventListener('timeupdate', () => {
            EventEmitter.emit('timeupdate', { currentTime: video.currentTime, duration: video.duration });
        });
        video.addEventListener('waiting', () => {
            updateState('buffering');
            EventEmitter.emit('buffering', true);
        });
        video.addEventListener('playing', () => {
            if (state.buffering) {
                EventEmitter.emit('buffering', false);
            }
            updateState('playing');
        });
        video.addEventListener('ended', () => {
            updateState('stopped');
            clearResumePosition(currentUrl);
            EventEmitter.emit('ended');
        });
        video.addEventListener('loadedmetadata', () => {
            EventEmitter.emit('loaded', { duration: video.duration, videoWidth: video.videoWidth, videoHeight: video.videoHeight });
            // Auto-detect and enable embedded subtitles
            autoEnableEmbeddedSubs();
            // Second check after short delay — webOS native pipeline may expose tracks late
            setTimeout(autoEnableEmbeddedSubs, 1500);
        });
        video.addEventListener('seeking', () => EventEmitter.emit('seeking', { currentTime: video.currentTime }));
        video.addEventListener('seeked', () => EventEmitter.emit('seeked', { currentTime: video.currentTime }));
        video.addEventListener('ratechange', () => EventEmitter.emit('rateChanged', { rate: video.playbackRate }));
        video.addEventListener('error', handleError);
        
        if (video.audioTracks) {
            video.audioTracks.addEventListener('change', () => EventEmitter.emit('trackChanged'));
        }
        if (video.textTracks) {
            video.textTracks.addEventListener('change', () => EventEmitter.emit('subtitleChanged'));
        }
    }

    function handleError(e) {
        updateState('error');
        var err = video.error;
        var msg = 'Unknown Error';
        var code = err ? err.code : 0;
        switch(code) {
            case 1: msg = 'Media aborted by user'; break;
            case 2: msg = 'Network error during media load'; break;
            case 3: msg = 'Media decoding error'; break;
            case 4: msg = 'Media format not supported'; break;
        }
        
        EventEmitter.emit('error', { code: code, message: msg });
        
        if (code === 2 || code === 3) {
            if (retryCount < maxRetries) {
                var delay = Math.pow(2, retryCount) * 1000;
                retryCount++;
                console.log('Retrying playback in ' + delay + 'ms...');
                setTimeout(() => {
                    if (currentUrl) {
                        var currentTime = video.currentTime > 0 ? video.currentTime : lastSavedPosition;
                        var opts = Object.assign({}, currentOptions || {}, { startPosition: currentTime });
                        Player.play(currentUrl, opts);
                    }
                }, delay);
            }
        }
    }

    function createVideoElement() {
        // Remove only existing video elements, not the controls UI
        var oldVideo = container.querySelector('#sp-video-el');
        if (oldVideo && oldVideo.parentNode) {
            oldVideo.parentNode.removeChild(oldVideo);
        }
        
        video = document.createElement('video');
        video.id = 'sp-video-el';
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.backgroundColor = '#000';
        video.style.position = 'absolute';
        video.style.top = '0';
        video.style.left = '0';
        video.style.zIndex = '1';
        video.setAttribute('playsinline', '');
        video.setAttribute('crossorigin', 'anonymous');
        
        // Always insert as first child so controls overlay stays on top
        container.insertBefore(video, container.firstChild);
        
        attachEvents();
    }

    var Player = {
        init: function(containerEl) {
            container = containerEl;
            createVideoElement();
            
            setInterval(() => {
                if (state.playing && !state.buffering) savePosition();
            }, 5000);
        },
        
        on: EventEmitter.on,
        off: EventEmitter.off,
        
        play: function(url, options) {
            options = options || {};
            currentUrl = url;
            currentOptions = options;
            
            if (options.title) EventEmitter.emit('title', options.title);
            
            var startPos = options.startPosition !== undefined ? options.startPosition : checkResumePosition(url);
            
            var sourceEl = document.createElement('source');
            
            // Apply WebOS media options for ALL files to utilize the TV's native hardware pipeline
            // This enables playback of more formats like MKV, MP4, AVI, etc.
            if (window.webOS) {
                var mediaOption = {
                    htmlMediaOption: {
                        useUMediaPipeline: true
                    }
                };
                sourceEl.setAttribute('type', 'video/mp4;mediaOption=' + encodeURIComponent(JSON.stringify(mediaOption)));
            }
            
            sourceEl.src = url;

            video.innerHTML = ''; // clear previous sources and tracks
            video.appendChild(sourceEl);
            
            if (options.subtitleUrl) {
                this.addExternalSubtitle(options.subtitleUrl, 'Subtitle', 'en');
            }
            
            try {
                video.load();
                if (startPos > 0 && !window.webOS) {
                    video.currentTime = startPos;
                }
                var playPromise = video.play();
                if (playPromise !== undefined) {
                    playPromise.catch(e => {
                        console.error('Play prevented', e);
                        EventEmitter.emit('error', { message: 'Autoplay prevented' });
                    });
                }
                updateState('playing');
                retryCount = 0;
            } catch (e) {
                console.error('Play error', e);
                EventEmitter.emit('error', { code: 0, message: e.message || 'Error starting playback' });
            }
        },
        
        pause: function() {
            if (video) video.pause();
        },
        
        resume: function() {
            if (video) video.play();
        },
        
        togglePlayPause: function() {
            if (!video) return;
            if (video.paused) {
                video.play();
            } else {
                video.pause();
            }
        },
        
        stop: function() {
            if (!video) return;
            video.pause();
            video.removeAttribute('src');
            video.innerHTML = '';
            video.load();
            createVideoElement(); // Recreate to flush memory on WebOS
            currentUrl = null;
            updateState('stopped');
        },
        
        seek: function(timeInSeconds) {
            if (!video) return;
            if (timeInSeconds < 0) timeInSeconds = 0;
            if (timeInSeconds > video.duration) timeInSeconds = video.duration;
            video.currentTime = timeInSeconds;
        },
        
        seekRelative: function(deltaSeconds) {
            if (!video) return;
            this.seek(video.currentTime + deltaSeconds);
        },
        
        setPlaybackRate: function(rate) {
            if (!video) return;
            video.playbackRate = rate;
        },
        
        getState: function() {
            return Object.assign({}, state);
        },
        
        getDuration: function() {
            return video ? video.duration || 0 : 0;
        },
        
        getCurrentTime: function() {
            return video ? video.currentTime || 0 : 0;
        },
        
        getBuffered: function() {
            if (!video || !video.buffered || video.buffered.length === 0) return 0;
            return video.buffered.end(video.buffered.length - 1);
        },
        
        getAudioTracks: function() {
            if (!video || !video.audioTracks) return [];
            var tracks = [];
            for (var i = 0; i < video.audioTracks.length; i++) {
                var t = video.audioTracks[i];
                tracks.push({ id: t.id || i, label: t.label || ('Track ' + (i+1)), language: t.language, enabled: t.enabled });
            }
            return tracks;
        },
        
        setAudioTrack: function(id) {
            if (!video || !video.audioTracks) return;
            for (var i = 0; i < video.audioTracks.length; i++) {
                video.audioTracks[i].enabled = (video.audioTracks[i].id === id || i === parseInt(id));
            }
        },
        
        getSubtitleTracks: function() {
            if (!video || !video.textTracks) return [];
            var tracks = [];
            for (var i = 0; i < video.textTracks.length; i++) {
                var t = video.textTracks[i];
                tracks.push({ id: i, label: t.label || ('Sub ' + (i+1)), language: t.language, mode: t.mode });
            }
            return tracks;
        },
        
        setSubtitleTrack: function(id) {
            if (!video || !video.textTracks) return;
            for (var i = 0; i < video.textTracks.length; i++) {
                video.textTracks[i].mode = (i === parseInt(id)) ? 'showing' : 'hidden';
            }
        },
        
        addExternalSubtitle: function(url, label, language) {
            if (!video) return;
            var track = document.createElement('track');
            track.kind = 'subtitles';
            track.label = label || 'External';
            track.srclang = language || 'en';
            track.src = url;
            video.appendChild(track);
            track.track.mode = 'showing';
        },
        
        disableSubtitles: function() {
            if (!video || !video.textTracks) return;
            for (var i = 0; i < video.textTracks.length; i++) {
                video.textTracks[i].mode = 'hidden';
            }
        },
        
        setSubtitleStyle: function(options) {
            if (!document.getElementById('sp-subtitle-style')) {
                var style = document.createElement('style');
                style.id = 'sp-subtitle-style';
                document.head.appendChild(style);
            }
            var css = '::cue { ';
            if (options.fontSize) css += 'font-size: ' + options.fontSize + '; ';
            if (options.color) css += 'color: ' + options.color + '; ';
            if (options.backgroundColor) css += 'background-color: ' + options.backgroundColor + '; ';
            css += '}';
            document.getElementById('sp-subtitle-style').innerHTML = css;
        },
        
        getVideoInfo: function() {
            return {
                width: video ? video.videoWidth : 0,
                height: video ? video.videoHeight : 0,
                codec: 'Unknown', // HTML5 doesn't easily expose this without MediaInfo
                hdr: false, // Would require Luna service checks on webOS
                bitrate: 0,
                audioCodec: 'Unknown',
                container: 'Unknown'
            };
        }
    };

    return Player;
})();
