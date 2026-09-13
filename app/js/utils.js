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
   * Extract filename from URL
   * @param {string} url 
   * @returns {string}
   */
  extractFilename: function(url) {
    try {
      const pathname = new URL(url, 'http://dummy.com').pathname;
      const filename = pathname.split('/').pop();
      return decodeURIComponent(filename) || 'Unknown File';
    } catch (e) {
      return 'Unknown File';
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
