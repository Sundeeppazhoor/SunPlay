window.SunPlay = window.SunPlay || {};

/**
 * SunPlay Utility Functions
 */
SunPlay.Utils = {
  /**
   * Validate if a string is a valid HTTP/HTTPS URL
   * @param {string} url 
   * @returns {boolean}
   */
  validateUrl: function(url) {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch (e) {
      return false;
    }
  },

  /**
   * Extract file extension from URL
   * @param {string} url 
   * @returns {string}
   */
  getFileExtension: function(url) {
    if (!url) return '';
    try {
      const pathname = new URL(url, 'http://dummy.com').pathname;
      const match = pathname.match(/\.([a-z0-9]+)$/i);
      return match ? match[1].toLowerCase() : '';
    } catch (e) {
      return '';
    }
  },

  /**
   * Map file extension to MIME type
   * @param {string} url 
   * @returns {string}
   */
  getContentType: function(url) {
    const ext = this.getFileExtension(url);
    const map = {
      'mkv': 'video/x-matroska',
      'mp4': 'video/mp4',
      'avi': 'video/x-msvideo',
      'ts': 'video/mp2t',
      'webm': 'video/webm',
      'm3u8': 'application/x-mpegURL',
      'mp3': 'audio/mpeg',
      'aac': 'audio/aac',
      'wav': 'audio/wav',
      'flac': 'audio/flac'
    };
    return map[ext] || 'video/mp4';
  },

  /**
   * Format seconds to HH:MM:SS
   * @param {number} seconds 
   * @returns {string}
   */
  formatTime: function(seconds) {
    if (isNaN(seconds) || seconds < 0) return '00:00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [
      h.toString().padStart(2, '0'),
      m.toString().padStart(2, '0'),
      s.toString().padStart(2, '0')
    ].join(':');
  },

  /**
   * Format bytes to KB/MB/GB
   * @param {number} bytes 
   * @returns {string}
   */
  formatBytes: function(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  /**
   * Format bits per second to Kbps/Mbps
   * @param {number} bps 
   * @returns {string}
   */
  formatBitrate: function(bps) {
    if (bps === 0) return '0 bps';
    const k = 1000;
    const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps'];
    const i = Math.floor(Math.log(bps) / Math.log(k));
    return parseFloat((bps / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  /**
   * Extract a human-readable title from a URL.
   * Handles CDN tokens, Google Drive/Googleusercontent URLs, encoded filenames, etc.
   * @param {string} url
   * @returns {string}
   */
  extractFilename: function(url) {
    return this.extractTitle(url);
  },

  /**
   * Core title extraction logic — tries multiple strategies in order.
   * @param {string} url
   * @returns {string}
   */
  extractTitle: function(url) {
    if (!url) return 'Video Stream';
    try {
      var str = url.trim();
      var parsed = null;
      try { parsed = new URL(str); } catch (e) {}

      if (parsed) {
        // 1. response-content-disposition header baked into URL (e.g., GCS signed URLs)
        var disp = parsed.searchParams.get('response-content-disposition') ||
                   parsed.searchParams.get('content-disposition');
        if (disp) {
          var dm = disp.match(/filename\*?=['"]?(?:UTF-\d['"]*)?([^;\r\n"']+)['"]?/i);
          if (dm && dm[1]) {
            return this._cleanTitle(decodeURIComponent(dm[1].trim().replace(/^['"]|['"]$/g, '')));
          }
        }

        // 2. Explicit query params: title, filename, file, name, fn
        var qpTitle = parsed.searchParams.get('title') ||
                      parsed.searchParams.get('filename') ||
                      parsed.searchParams.get('file') ||
                      parsed.searchParams.get('name') ||
                      parsed.searchParams.get('fn');
        if (qpTitle) {
          return this._cleanTitle(decodeURIComponent(qpTitle.trim()));
        }

        // 3. Scan ALL path segments for something that looks like a real filename
        //    (has a known video extension or contains dots + non-hex chars)
        var parts = parsed.pathname.split('/').filter(Boolean);
        var mediaExts = /\.(mkv|mp4|avi|ts|webm|m3u8|mpd|mov|flv|wmv|m4v|3gp|hevc|265|264)$/i;
        var hasMediaExt = parts.filter(function(p) { return mediaExts.test(p); });
        if (hasMediaExt.length > 0) {
          return this._cleanTitle(decodeURIComponent(hasMediaExt[hasMediaExt.length - 1]));
        }

        // 4. Look for a path segment that has a dot + non-hex chars (likely a real name vs token)
        var meaningfulSegment = null;
        for (var i = parts.length - 1; i >= 0; i--) {
          var seg = parts[i];
          var decoded = '';
          try { decoded = decodeURIComponent(seg); } catch(e) { decoded = seg; }
          // Skip if: all hex chars (CDN token), purely numeric, or a generic keyword
          var isOpaqueToken = /^[0-9a-f]{20,}$/i.test(decoded);
          var isGenericWord = /^(download|play|stream|view|watch|index|video|file|media|get|serve|proxy|content)$/i.test(decoded);
          var isNumericId = /^\d+$/.test(decoded);
          var hasDotAndText = /\..+/.test(decoded) && !/^[0-9a-f.]+$/i.test(decoded);

          if (!isOpaqueToken && !isGenericWord && !isNumericId && decoded.length > 3) {
            // Prefer segments with dots (filename-like) or spaces (title-like)
            if (hasDotAndText || decoded.indexOf(' ') !== -1 || decoded.indexOf('%20') !== -1) {
              meaningfulSegment = decoded;
              break;
            }
            if (!meaningfulSegment) meaningfulSegment = decoded; // keep as fallback
          }
        }
        if (meaningfulSegment) {
          return this._cleanTitle(meaningfulSegment);
        }

        // 5. Fall back to hostname (e.g., "Video from drive.google.com")
        var host = parsed.hostname.replace(/^www\./, '');
        return 'Video from ' + host;
      }

      // Non-URL: just take last path segment
      var raw = str.split('?')[0].split('/').pop();
      return this._cleanTitle(decodeURIComponent(raw)) || 'Video Stream';
    } catch (e) {
      return 'Video Stream';
    }
  },

  /**
   * Clean up a raw filename/title: remove codec tags, extra dots, URL noise.
   * @param {string} raw
   * @returns {string}
   */
  _cleanTitle: function(raw) {
    if (!raw) return 'Video Stream';
    try {
      var t = decodeURIComponent(raw).trim();
      // Remove common codec/quality tags from end of filename
      t = t.replace(/\.(mkv|mp4|avi|ts|webm|m4v|mov|flv|wmv|3gp)$/i, '');
      // Replace dots/underscores used as spaces (but not in the middle of abbreviations)
      // Only replace if they look like word separators (surrounded by word chars)
      t = t.replace(/\.(?=[^\s])/g, ' '); // dots → spaces
      t = t.replace(/_/g, ' ');
      // Remove bracketed codec/quality info: [Hindi DDP 5.1], (2025), IMAX, UHD, BluRay, REMUX, x265, HEVC etc.
      t = t.replace(/\s*[\(\[][^\)\]]{1,60}[\)\]]\s*/g, ' ');
      t = t.replace(/\s+(IMAX|UHD|HDR|SDR|BluRay|Blu-Ray|REMUX|HDTV|WEBRip|WEB-DL|DVDRip|BRRip|x264|x265|HEVC|AVC|FLAC|DTS|AAC|DDP|Atmos|10bit|4K|1080p|720p|480p|2160p|DV|HDR10|CHD|YTS|YIFY)\S*/gi, ' ');
      // Collapse multiple spaces
      t = t.replace(/\s{2,}/g, ' ').trim();
      return t || 'Video Stream';
    } catch(e) {
      return raw || 'Video Stream';
    }
  },

  /**
   * Generate unique ID
   * @returns {string}
   */
  generateId: function() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  },

  /**
   * Debounce function
   * @param {Function} fn 
   * @param {number} delay 
   * @returns {Function}
   */
  debounce: function(fn, delay) {
    let timeoutId;
    return function(...args) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        fn.apply(this, args);
      }, delay);
    };
  },

  storage: {
    /**
     * Get value from localStorage
     * @param {string} key 
     * @returns {any}
     */
    get: function(key) {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
      } catch (e) {
        console.error('Error reading from localStorage', e);
        return null;
      }
    },

    /**
     * Set value in localStorage
     * @param {string} key 
     * @param {any} value 
     */
    set: function(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        console.error('Error writing to localStorage', e);
      }
    },

    /**
     * Get playback history
     * @returns {Array}
     */
    getHistory: function() {
      return this.get('sunplay_history') || [];
    },

    /**
     * Add item to playback history
     * @param {Object} item {url, title, timestamp, position}
     */
    addToHistory: function(item) {
      let history = this.getHistory();
      // Remove existing entry for same URL
      history = history.filter(h => h.url !== item.url);
      
      item.timestamp = item.timestamp || Date.now();
      history.unshift(item); // Add to beginning
      
      // Keep only max 50 items
      if (history.length > 50) {
        history = history.slice(0, 50);
      }
      
      this.set('sunplay_history', history);
    }
  }
};
