const shell = require('shelljs/global');

function findTmpDir(onTmpDirFound) {
   exec('echo $TMPDIR', {silent:true, async:true},  function(code, stdout, stderr) {
     onTmpDirFound(stdout.replace(/(\r\n|\n|\r)/gm,""))
   })
}

function createPalette(tmpDir, videoPath, onSuccess, onError) {
  // Create a palette.png for better gif's
  var palettePath = tmpDir + "palette.png"
  exec('ffmpeg -y -i ' + videoPath + ' -vf palettegen ' + palettePath, {silent:true, async:true},  function(code, stdout, stderr) {
    if (code === 0) {
      onSuccess(palettePath);
    } else {
      onError()
    }
  })
}

function createGif(highQuality, palettePath, videoPath, gifPath, onSuccess, onError) {
  var command = 'ffmpeg -y -i ' + videoPath + ' -r 15 ' + gifPath
  if (highQuality) {
    var command = 'ffmpeg -y -i ' + videoPath + ' -i ' + palettePath + ' -lavfi \"scale=640:-1,paletteuse,fps=15\" ' + gifPath
  }

  // Create the gif
  exec(command, {silent:true, async:true},  function(code, stdout, stderr) {
    if (code === 0) {
      onSuccess(gifPath)
    } else {
      onError()
    }
  })
}

module.exports = {
  // Parameters:
  // highQuality - boolean: Create a higher quality gif. Takes longer and shrink/scale the gif to 640 width
  // videoPath - string: The path to the video
  // onSuccess - callback: Called when we created successfully the gif. Included the path to the gif as parameter
  // onError - callback: Called when something goes wrong while converting to gif
  videoToGif: function videoToGif(highQuality, videoPath, onSuccess, onError) {
    findTmpDir((tmpdir) => {
      // Create gifPath from TMPDIR
      var gifPath = tmpdir + "Geist_" + Date.now() + ".gif"
      if (highQuality) {
        // Create high quality gif
        createPalette(
          tmpdir,
          videoPath,
          (palettePath) => {
            createGif(
              highQuality,
              palettePath,
              videoPath,
              gifPath,
              (gifPath) => { onSuccess(gifPath) },
              () => { onError() }
            )
          },
          () => { onError() }
        )
      } else {
        // Create low quality gif
        createGif(
          highQuality,
          null,
          videoPath,
          gifPath,
          (gifPath) => { onSuccess(gifPath) },
          () => { onError() }
        )
      }
    })
  }
}
