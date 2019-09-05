const electron = require('electron')
const app = electron.app
const BrowserWindow = electron.BrowserWindow
const ipc = electron.ipcMain
const Menu = electron.Menu
const Tray = electron.Tray
const dialog = electron.dialog
const clipboard = electron.clipboard
const globalShortcut = electron.globalShortcut
const nativeImage = electron.nativeImage
const path = require('path')
const mime = require('mime');
const fs = require("fs")
const shell = require('shelljs/global');
const timerHandler = require('./timerhandler')
const converter = require('./converter')
const settings = require('./settings')

const FIREBASE_PROJECT_ID = "$YOUR_🔥BASE_PROJECTID"

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let tray
let settingsWin
let loadingWin
let onlineStatusWin
let onlineStatus
let notificationServiceWin

// Cropper window & record stuff
// Will be used for screen recording
let cropperWindow
let recordTray
let recordState
let recordUploadMode

var trayTemplate

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {

  // Set the process environment path.
  // See https://git.io/viaFg, https://git.io/viaF2 and https://git.io/viaFa
  process.env['PATH'] = '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin'

  settings.setupDefaults()

  // Create TrayMenu
  if (tray == null) {
    var iconPath = path.join(__dirname, 'assets/tray/IconTemplate.png')
    tray = new Tray(iconPath)
    trayTemplate = [
      {
        label: 'Upload File...',
        click: function () {
          onUploadFileClicked()
        }
      },
      {
        label: 'Upload gif (from video)',
        click: function() {
          onUploadGifConvertClicked()
        }
      },
      { type: 'separator' },
      {
        label: 'Record Video',
        click: function() {
          recordUploadMode = "video"
          createCropperWindow()
          createRecordTray();
        }
      },
      {
        label: 'Record gif',
        click: function() {
          recordUploadMode = "gif"
          createCropperWindow()
          createRecordTray();
        }
      },
      { type: 'separator' },
      {
        label: 'Recent uploads',
        submenu: [
          {
            label: '',
            visible: false
          },
          {
            label: '',
            visible: false
          },
          {
            label: '',
            visible: false
          },
          {
            label: '',
            visible: false
          },
          {
            label: '',
            visible: false
          },
        ]
      },
      { type: 'separator' },
      {
        label: "gif options",
        submenu: [
          {
            label: "High quality",
            type: "radio",
            checked: settings.isGifQulityHigh(),
            click: () => {
              settings.setGifQualityToHigh(true)
            }
          },
          {
            label: "Low quality",
            type: "radio",
            checked: !settings.isGifQulityHigh(),
            click: () => {
              settings.setGifQualityToHigh(false)
            }
          },
        ]
      },
      { type: 'separator' },
      {
        label: 'Settings',
        click: function() {
          createSettingsWindow()
        }
      },
      { type: 'separator' },
      {
        label: 'Close',
        click: function() {
          app.quit()
        }
      }
    ]
    tray.on('drop-files', function(event, filepath) {
      displayUploadImages()
      uploadFile(filepath[0])
    })
    tray.setToolTip(app.getName())
    recreateTray()

    setupUploadUrlsMenuItem(trayTemplate[6])
  }

  // Register globalShortcut
  const ret = globalShortcut.register('Command+4', () => {
    var tmpdir = exec('echo $TMPDIR', {silent:true, async:true},  function(code, stdout, stderr) {
      var path = stdout.replace(/(\r\n|\n|\r)/gm,"") + "Geist_" + Date.now() + ".png"
      var child = exec('screencapture -i ' + path, {async:true}, function(code, stdout, stderr) {
        if (code === 0) {
          displayUploadImages()
          uploadFile(path)
        }
      })
    })
  })

  // Create loadingWin (always "available" in background "as a service")
  loadingWin = new BrowserWindow({width: 0, height: 0, frame: false, x: 0, y: 0, resizable: false, moveable: false, webPreferences: {nodeIntegration: true}})
  loadingWin.loadURL("https://" + FIREBASE_PROJECT_ID + ".firebaseapp.com/upload")

  // Create online/offline-status-changed window
  onlineStatusWin = new BrowserWindow({width: 0, height: 0, frame: false, x: 0, y: 0, resizable: false, moveable: false, webPreferences: {nodeIntegration: true}})
  onlineStatusWin.loadURL(`file://${__dirname}/online-status.html`)

  // Create notification-service window to post notification from mainRenderer
  notificationServiceWin = new BrowserWindow({width: 0, height: 0, frame: false, x: 0, y: 0, resizable: false, moveable: false, webPreferences: {nodeIntegration: true}})
  notificationServiceWin.loadURL(`file://${__dirname}/notification-service.html`)

  // Enable for debugging screens
  //loadingWin.webContents.openDevTools({mode: "detach"})
  //onlineStatusWin.webContents.openDevTools({mode: "detach"})
  //notificationServiceWin.webContents.openDevTools({mode: "detach"})
})

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    if (appIcon) appIcon.destroy()
    app.quit()
  }
})

app.on('will-quit', () => {
  // Unregister all shortcuts.
  globalShortcut.unregisterAll()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

function setupUploadUrlsMenuItem(menuItem) {
  // set uploaded urls on start
  var uploadedUrls = settings.getRecentUploadedUrls()
  if (typeof uploadedUrls !== 'undefined') {
    setUploadedUrlsToMenuItem(menuItem, uploadedUrls)
  }

  // set listener and change tray at runtime
  settings.setOnRecentUploadedUrlChangedListener((evt) => {
    var uploadedUrls = evt.newValue
    setUploadedUrlsToMenuItem(menuItem, uploadedUrls)
  })
}

function setUploadedUrlsToMenuItem(menuItem, uploadedUrls) {
  for (i = 0; i < uploadedUrls.length; i++) {
    var subMenuItem = menuItem.submenu[i]
    subMenuItem.visible = true
    subMenuItem.label = uploadedUrls[i]
    subMenuItem.click = (item) => {
      clipboard.writeText(item.label)
    }
    recreateTray()
  }
}

function recreateTray() {
  tray.setContextMenu(Menu.buildFromTemplate(trayTemplate))
}

// Upload the file to loadingWin
// Param 1: The path of the file
// Param 2: (Optional) a suffix for the basename. Will be added with "_[SUFFIX]"
function uploadFile(filepath, suffix) {
  var base64str = fs.readFileSync(filepath, "base64");
  var mimeType = mime.getType(filepath)
  var parsedFile = path.parse(filepath)
  var baseName = parsedFile['name']
  if (typeof suffix !== 'undefined') {
    baseName += "_" + suffix
  }
  var filename = baseName + parsedFile['ext']

  // Send the object to renderer
  var json = new Object()
  json.base64 = base64str
  json.mime = mimeType
  json.filename = filename
  if (onlineStatus == 'online') {
    loadingWin.webContents.send("onClick", JSON.stringify(json))
  } else {
    clearTimers()
    sendNotification("Error", "You are offline. Go online! ;)")
  }
}

// This will be called when the Tray->UploadFile was clicked
function onUploadFileClicked() {
  // OpenFile Dialog
  dialog.showOpenDialog({width: 0, height: 0, properties: ['openFile']}, function(filenames) {
    if (filenames != undefined) {
      displayUploadImages()
      uploadFile(filenames[0], Date.now().toString())
    }
  })
}

// Will be called when Tray->Upload gif (from movie) was clicked
function onUploadGifConvertClicked() {
  var filter = [{name: 'Movies', extensions: ['mov', 'mp4']}]
  // OpenFile Dialog
  dialog.showOpenDialog({width: 0, height: 0, properties: ['openFile'], filters: filter}, function(filenames) {
    if (filenames != undefined) {
      displayUploadImages()
      convertVidToGif(filenames[0])
    }
  })
}

function convertVidToGif(videoPath) {
  converter.videoToGif(
    settings.isGifQulityHigh(),
    videoPath,
    (gifPath) => {
      uploadFile(gifPath)
    },
    () => {
      sendNotification("Error", "Is ffmpeg installed?")
    }
  )
}

// Will be called when Tray->Settings was clicked
function createSettingsWindow() {
  // Create the browser window.
  settingsWin = new BrowserWindow({width: 800, height: 750})
  settingsWin.loadURL("https://" + FIREBASE_PROJECT_ID + ".firebaseapp.com")
  // win.webContents.openDevTools()

  // Emitted when the window is closed.
  settingsWin.on('closed', () => {
    settingsWin = null
  })
}

// This will update the tray image to indicate a upload
function displayUploadImages() {
  var firstImage = nativeImage.createFromPath(path.join(__dirname, 'assets/tray/upload/IconTemplate.png'))
  var secondImage = nativeImage.createFromPath(path.join(__dirname, 'assets/tray/upload/Icon1Template.png'))
  var thirdImage = nativeImage.createFromPath(path.join(__dirname, 'assets/tray/upload/Icon2Template.png'))
  var fourthImage = nativeImage.createFromPath(path.join(__dirname, 'assets/tray/upload/Icon3Template.png'))
  var fiveImage = nativeImage.createFromPath(path.join(__dirname, 'assets/tray/upload/Icon4Template.png'))
  var sixImage = nativeImage.createFromPath(path.join(__dirname, 'assets/tray/upload/Icon5Template.png'))
  var sevenImage = nativeImage.createFromPath(path.join(__dirname, 'assets/tray/upload/Icon6Template.png'))
  var eightImage = nativeImage.createFromPath(path.join(__dirname, 'assets/tray/upload/Icon7Template.png'))
  var images = [firstImage, secondImage, thirdImage, fourthImage, fiveImage, sixImage, sevenImage, eightImage]

  for (i = 0; i < images.length; i++) {
    timerHandler.newTimer(700*i, {'index' : i, 'image' : images[i]}, (dict) => {
      tray.setImage(dict['image'])
      if(dict['index'] == 7) {
        setTimeout(function () {
          displayUploadImages()
        }, 700);
      }
    })
  }
}

function clearTimers() {
  // Update tray icon to default and clear all running timer
  timerHandler.clearAllTimer()
  var iconPath = path.join(__dirname, 'assets/tray/IconTemplate.png')
  tray.setImage(iconPath)
}

// Will be called when the "Record Video" in tray gets clicked
function createCropperWindow() {
  cropperWindow = new BrowserWindow({
    width: 512,
    height: 512,
    frame: false,
    transparent: true,
    resizable: true,
    shadow: false,
    enableLargerThanScreen: true,
    x: 'center',
    y: 'center',
    webPreferences: {nodeIntegration: true}
  });
  cropperWindow.loadURL(`file://${__dirname}/cropper.html`);
  cropperWindow.setIgnoreMouseEvents(false);
  cropperWindow.setAlwaysOnTop(true, 'screen-saver');
  //cropperWindow.openDevTools({mode: 'detach'});
}

function createRecordTray() {
  var recordTrayIcon = path.join(__dirname, 'assets/tray/IconRecordTemplate.png')
  recordTray = new Tray(recordTrayIcon)
  recordTray.setToolTip('Start recording')
  recordTray.on('click', function(event, bounds) {
    if (recordState === undefined || recordState == "stopped") {
      recordState = "live"

      if (cropperWindow !== undefined) {
        cropperWindow.setResizable(false)
        cropperWindow.setMovable(false)
        cropperWindow.setIgnoreMouseEvents(true);

        cropperWindow.webContents.send("onStartRecording", cropperWindow.getContentBounds())
      }
    } else if (recordState !== undefined && recordState == "live") {
      recordState = "stopped"

      if (cropperWindow !== undefined) {
        cropperWindow.webContents.send("onStopRecording")
      }
    }
  })
}

// Will be called when aperture have started the recording
ipc.on('on-recording-started', (event, args) => {
  var recordLiveIconPath = path.join(__dirname, 'assets/tray/IconRecordLiveTemplate.png')
  var liveIcon = nativeImage.createFromPath(recordLiveIconPath)
  recordTray.setImage(liveIcon)
  recordTray.setToolTip('Stop recording')
})

// Will be called when we stopped the recording
// and renderer sends event with filePath as argument
ipc.on('on-recording-stopped', (event, filePath) => {
  displayUploadImages()
  closeCropperWinDestroyRecordTray()

  if (recordUploadMode == "video") {
    uploadFile(filePath, Date.now().toString())
  } else if (recordUploadMode == "gif") {
    convertVidToGif(filePath)
  }
})

// Listen and response from ipcRenderer
ipc.on('shortUrl', function (event, shortUrl) {
  // Save link to settings
  settings.addRecentUploadedUrl(shortUrl)
  // Save link to file to clipboard
  clipboard.writeText(shortUrl)
  clearTimers()
  sendNotification("Uploaded", "Your file was successfully uploaded...")
})

// Listen for errors from ipcRenderer
// Need to be the following json format: {"message" : "An error message"}
ipc.on('error', function (event, jsonError) {
  clearTimers()
  var error = JSON.parse(jsonError);
  sendNotification("Error", error.message)
})

// Listen for online/offline-changes
ipc.on('online-status-changed', (event, status) => {
  console.log(status)
  onlineStatus = status
  if (onlineStatus == 'online') {
    loadingWin.reload()
  }
})

// Listen when cropperWindow will be closed
ipc.on('close-cropper-window', (event, arg) => {
  closeCropperWinDestroyRecordTray()
})

function closeCropperWinDestroyRecordTray() {
  cropperWindow.close()
  cropperWindow = null

  recordTray.destroy()
  recordTray = null
}

// Send notification to service
function sendNotification(title, body, icon) {
  notificationServiceWin.webContents.send("notificationPosted", title, body, icon)
}
