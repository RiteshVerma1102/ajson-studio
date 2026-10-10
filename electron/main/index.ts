import { app, BrowserWindow, shell } from 'electron'
import * as path from 'path'
import { registerIpcHandlers } from '../ipc/handlers'
import { registerAiIpcHandlers } from '../ipc/aiHandlers'

// Set application name
app.name = 'Ajson Studio'

// Disable hardware acceleration issues on specific VMs/environments if needed
// app.disableHardwareAcceleration()

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    title: 'Ajson Studio',
    width: 1360,
    height: 860,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#0b0d13',
    frame: false, // Custom frameless window for sleek modern IDE appearance
    show: true,   // Ensure window appears immediately
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  })

  // Register secure IPC communication handlers
  registerIpcHandlers(mainWindow)

  // Register AI IPC handlers (credentials stay in main process)
  registerAiIpcHandlers()

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })

  // Fallback to guarantee window appears even if ready-to-show event was delayed
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show()
      mainWindow.focus()
    }
  }, 500)

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`Page failed to load: [${errorCode}] ${errorDescription} (${validatedURL})`)
  })

  // Open external links in default browser rather than inside Electron
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Development vs Production loading
  if (process.env.VITE_DEV_SERVER_URL) {
    console.log('Loading from Vite dev server:', process.env.VITE_DEV_SERVER_URL)
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    const prodPath = path.join(__dirname, '../../dist/index.html')
    console.log('Loading from production bundle:', prodPath)
    mainWindow.loadFile(prodPath)
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// Ensure single instance lock
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
