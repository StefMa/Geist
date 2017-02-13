const settings = require('electron-settings');

const gifQualityKeyPath = "gif.option.quality.high"

const recentUploadsKeyPath = "recent.uploaded.urls"
const MAX_RECENT_UPLOAD_URLS = 5

module.exports = {

  setupDefaults: () => {
    settings.defaults({
      gif: {
        option: {
          quality: {
            high: false
          }
        }
      }
    })
  },

  isGifQulityHigh: () => {
    return settings.getSync(gifQualityKeyPath)
  },

  setGifQualityToHigh: (highQuality) => {
    settings.setSync(gifQualityKeyPath, highQuality)
  },

  getRecentUploadedUrls: () => {
    return settings.getSync(recentUploadsKeyPath)
  },

  setOnRecentUploadedUrlChangedListener: (listener) => {
    return settings.observe(recentUploadsKeyPath, listener)
  },

  addRecentUploadedUrl: (url) => {
    var recentUploadedUrls = module.exports.getRecentUploadedUrls()
    // Create new array if not exist yet
    if (typeof recentUploadedUrls === 'undefined') {
      recentUploadedUrls = new Array()
    }

    // Add new url at index 0
    recentUploadedUrls.splice(0, 0, url)
    if (recentUploadedUrls.length > MAX_RECENT_UPLOAD_URLS) {
      // Remove urls when array is longer than MAX_RECENT_UPLOAD_URLS
      recentUploadedUrls.splice(MAX_RECENT_UPLOAD_URLS, recentUploadedUrls.length)
    }
    settings.setSync(recentUploadsKeyPath, recentUploadedUrls)
  }

}
