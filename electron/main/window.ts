/**
 * Main window: single BrowserWindow with security-hardened webPreferences.
 * contextIsolation + nodeIntegration: false so renderer only gets window.api via preload.
 */
import path from 'node:path'
import { app, BrowserWindow } from 'electron'

let allowClose = false

export function markAllowClose(): void {
  allowClose = true
}

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 760,
    minWidth: 980,
    minHeight: 640,
    frame: false,
    backgroundColor: '#0b0f19',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) {
    void win.loadURL(devUrl)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  const sendMaximized = (isMaximized: boolean) => {
    win.webContents.send('window:maximized-changed', isMaximized)
  }

  win.on('maximize', () => {
    sendMaximized(true)
  })
  win.on('unmaximize', () => {
    sendMaximized(false)
  })
  win.on('restore', () => {
    sendMaximized(false)
  })

  win.on('close', (event) => {
    if (!allowClose) {
      event.preventDefault()
      if (process.platform === 'darwin') {
        app.hide()
      } else {
        win.hide()
      }
    }
  })

  return win
}

