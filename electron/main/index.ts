/**
 * Electron main process entry: app lifecycle, tray, and window creation.
 * IPC handlers are registered in registerIpcHandlers(); DB and services live in main only.
 */
import path from 'node:path'
import { BrowserWindow, Menu, Tray, app, nativeImage } from 'electron'
import { closeDb } from './db/connection'
import { getAppPaths } from './paths'
import { registerIpcHandlers } from './ipc/handlers'
import { createMainWindow, markAllowClose } from './window'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

// Helps Windows show native notifications reliably (IdleTimerService, export success, etc.).
if (process.platform === 'win32') {
  app.setAppUserModelId('com.local.suite')
}

function createAppTray(): void {
  if (tray) return

  const iconPath = path.join(__dirname, 'icon.png')
  let image = nativeImage.createFromPath(iconPath)
  if (image.isEmpty()) {
    image = nativeImage.createEmpty()
  }
  tray = new Tray(image)
  tray.setToolTip('Yerel Suit')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Uygulamayı Göster',
      click: () => {
        if (!mainWindow) return
        mainWindow.show()
        mainWindow.focus()
      }
    },
    {
      label: 'Gizle',
      click: () => {
        mainWindow?.hide()
      }
    },
    { type: 'separator' },
    {
      label: 'Çıkış',
      click: () => {
        markAllowClose()
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => {
    if (!mainWindow) return
    mainWindow.show()
    mainWindow.focus()
  })
}

function boot(): void {
  getAppPaths()
  registerIpcHandlers()
  mainWindow = createMainWindow()
  createAppTray()
}

app
  .whenReady()
  .then(boot)
  .catch((err: unknown) => {
    console.error(err)
    markAllowClose()
    app.quit()
  })

app.on('window-all-closed', () => {
  // Do not quit when window is closed; keep in tray.
})

app.on('activate', () => {
  if (process.platform === 'darwin') {
    if (BrowserWindow.getAllWindows().length === 0 && mainWindow === null) {
      mainWindow = createMainWindow()
      createAppTray()
    } else {
      mainWindow?.show()
    }
  }
})

app.on('before-quit', () => {
  markAllowClose()
  closeDb()
  tray?.destroy()
  tray = null
})

