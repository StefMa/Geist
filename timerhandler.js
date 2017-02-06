// An Array which holds all timer ids
var timerIds = []

module.exports = {
  // Create a new timeout and save timeout id to an array
  // Params: timeout, dictionary (which will be added to the function), function
  newTimer: function (timeout, dict, fun) {
    var timerId = setTimeout(function () {
      fun(dict)
    }, timeout)
    timerIds.push(timerId)
  },
  // Clear all timeouts which was added with newTimer()
  clearAllTimer: function() {
    for(i = 0; i < timerIds.length; ++i) {
      var timerId = timerIds[i];
      clearTimeout(timerId)
    }
    timerIds = [];
  }
}
