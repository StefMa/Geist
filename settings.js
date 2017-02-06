const settings = require('electron-settings');

const gifQualityKeyPath = "gif.option.quality"

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
    return settings.getSync(gifQualityKeyPath + ".high")
  },

  setGifQualityToHigh: (highQuality) => {
    settings.setSync(gifQualityKeyPath, {
      high: highQuality
    })
  }

}
