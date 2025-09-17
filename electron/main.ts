import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { ipcMain } from "electron";
import './ipc';
ipcMain.handle("app:getVersion", () => app.getVersion());

console.log('[main] starting. electron:', process.versions.electron, 'devUrl:', process.env.VITE_DEV_SERVER_URL)

function resolveIndexHtml(): string | null {
  const primary = path.join(__dirname, '../out/renderer/index.html')
  const fallback = path.join(__dirname, '../renderer/index.html')
  if (fs.existsSync(primary)) return primary
  if (fs.existsSync(fallback)) return fallback
  return null
}

async function createWindow() {
  const win = new BrowserWindow({
    title: 'DueD8',                   // custom title
    width: 1280,
    height: 800,
    minWidth: 960,                    // prevent resizing too small
    minHeight: 600,
    backgroundColor: '#ffffff',       // avoids white flash
    show: false,                      // only show when ready
    autoHideMenuBar: true,            // cleaner UI (no menu bar until Alt pressed)
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('[electron] did-fail-load:', code, desc, url)
  })

  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[electron] render-process-gone:', details)
  })

  win.webContents.on('did-finish-load', () => {
    console.log('[electron] did-finish-load')
    win.show()
    if (!app.isPackaged) {
      win.webContents.openDevTools({ mode: 'detach' })
    }
    // Probe that preload ran and window.dued8 is exposed
    win.webContents.executeJavaScript(`
      (async () => {
        const t = typeof window.dued8;
        console.log('[renderer probe] typeof window.dued8 =', t);
        if (t === 'object' && window.dued8.ping) {
          const pong = await window.dued8.ping();
          console.log('[renderer probe] ping =>', pong);
        }
      })();
    `);
  })

  const devUrl = process.env.VITE_DEV_SERVER_URL
  try {
    if (devUrl && /^https?:\/\//i.test(devUrl)) {
      console.log('[electron] loading dev URL:', devUrl)
      await win.loadURL(devUrl)
    } else {
      const indexHtml = resolveIndexHtml()
      if (!indexHtml) {
        throw new Error('Could not find built index.html. Run `npm run build` first.')
      }
      console.log('[electron] loading file:', indexHtml)
      await win.loadFile(indexHtml)
    }
  } catch (err) {
    console.error('[electron] initial load threw:', err)
  }
}

// Create window on app ready and handle macOS lifecycle
app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    // On macOS it is common to re-create a window when the dock icon is clicked
    // and there are no other open windows
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})