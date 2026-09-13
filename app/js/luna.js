window.SunPlay = window.SunPlay || {};

/**
 * Luna Service wrapper for webOS
 */
SunPlay.Luna = {
  /**
   * Detect if running on webOS
   * @returns {boolean}
   */
  isWebOS: function() {
    return window.webOS !== undefined && window.webOSSystem !== undefined;
  },

  /**
   * Log using webOS PmLogString if available
   * @param {string} msg 
   */
  log: function(msg) {
    if (this.isWebOS() && window.webOSSystem.PmLogString) {
      window.webOSSystem.PmLogString(6, "SUNPLAY", msg, "{}");
    } else {
      console.log("[SunPlay.Luna]", msg);
    }
  },

  /**
   * Generic Luna service call wrapper
   * @param {string} uri 
   * @param {Object} params 
   * @returns {Promise<any>}
   */
  call: function(uri, params = {}) {
    return new Promise((resolve, reject) => {
      if (!this.isWebOS()) {
        this.log(`Mocking Luna call: ${uri}`);
        resolve({ returnValue: true, mocked: true });
        return;
      }

      if (window.webOS && window.webOS.service && window.webOS.service.request) {
        window.webOS.service.request(uri, {
          method: '',
          parameters: params,
          onSuccess: function (inResponse) {
            resolve(inResponse);
          },
          onFailure: function (inError) {
            reject(inError);
          }
        });
      } else {
        // weboslib pattern fallback
        reject(new Error("webOS service request API not found"));
      }
    });
  },

  /**
   * Get network info (IP address)
   * @returns {Promise<Object>}
   */
  getNetworkInfo: function() {
    return new Promise((resolve, reject) => {
      if (!this.isWebOS()) {
        resolve({
          wired: { state: "disconnected", ipAddress: "" },
          wifi: { state: "connected", ipAddress: "192.168.1.100" }
        });
        return;
      }

      this.call("luna://com.palm.connectionmanager/getStatus", {})
        .then(response => {
          resolve({
            wired: response.wired || {},
            wifi: response.wifi || {}
          });
        })
        .catch(err => {
          this.log("Failed to get network info: " + err);
          reject(err);
        });
    });
  },

  /**
   * Show a toast message on TV
   * @param {string} message 
   */
  showToast: function(message) {
    if (this.isWebOS()) {
      this.call("luna://com.webos.notification/createToast", { message: message })
        .catch(err => {
          this.log("Toast failed: " + err);
          this.fallbackToast(message);
        });
    } else {
      this.fallbackToast(message);
    }
  },

  /**
   * Fallback for toast message when Luna is not available
   * @param {string} message 
   */
  fallbackToast: function(message) {
    let toast = document.createElement('div');
    toast.style.position = 'absolute';
    toast.style.bottom = '50px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    toast.style.color = '#fff';
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = '5px';
    toast.style.zIndex = '9999';
    toast.style.fontSize = '24px';
    toast.innerText = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 3000);
  },

  /**
   * Get system information (model, SDK version)
   * @returns {Promise<Object>}
   */
  getDeviceInfo: function() {
    return new Promise((resolve, reject) => {
      if (!this.isWebOS()) {
        resolve({ modelName: "Mock TV", sdkVersion: "1.0.0", firmwareVersion: "00.00.00" });
        return;
      }
      this.call("luna://com.webos.service.tv.systemproperty/getSystemInfo", {
        keys: ["modelName", "firmwareVersion", "sdkVersion"]
      })
      .then(res => resolve(res))
      .catch(err => reject(err));
    });
  },

  /**
   * Get specific system settings
   * @param {string} category 
   * @param {Array<string>} keys 
   * @returns {Promise<Object>}
   */
  getSystemSettings: function(category, keys) {
    return this.call("luna://com.webos.settingsservice/getSystemSettings", {
      category: category,
      keys: keys
    });
  },

  /**
   * Configure HDR mode
   * @param {boolean} enabled 
   * @returns {Promise<Object>}
   */
  setHDRMode: function(enabled) {
    // Note: Actual HDR mode switching may require specific hidden APIs or hardware support
    // This is a placeholder for the concept via picture settings
    return this.call("luna://com.webos.settingsservice/setSystemSettings", {
      category: "picture",
      settings: {
        hdr: enabled ? "on" : "off"
      }
    });
  },

  /**
   * Launch an application
   * @param {string} appId 
   * @param {Object} params 
   * @returns {Promise<Object>}
   */
  launchApp: function(appId, params = {}) {
    return this.call("luna://com.webos.applicationManager/launch", {
      id: appId,
      params: params
    });
  }
};
