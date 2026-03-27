import { app, BrowserWindow, clipboard, ipcMain } from 'electron'
import { join } from 'node:path'
import type { BindDeviceInput, EnqueueTaskInput, SettingKey } from '../../shared/contracts'
import { DesktopStore } from './store'

let mainWindow: BrowserWindow | null = null
let store: DesktopStore | null = null

function createWindow() {
  const preloadPath = join(app.getAppPath(), 'out/electron/preload/index.js')

  mainWindow = new BrowserWindow({
    width: 1480,
    height: 960,
    minWidth: 1180,
    minHeight: 780,
    title: 'MyClaw Desktop',
    backgroundColor: '#081226',
    titleBarStyle: process.platform === 'darwin' ? 'hidden' : 'default',
    trafficLightPosition:
      process.platform === 'darwin'
        ? {
            x: 16,
            y: 16,
          }
        : undefined,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (!app.isPackaged) {
    void mainWindow.loadURL('http://127.0.0.1:5180')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    void mainWindow.loadFile(join(app.getAppPath(), 'dist/index.html'))
  }
}

function publishSnapshot() {
  if (!mainWindow || !store) {
    return
  }
  mainWindow.webContents.send('snapshot:updated', store.getSnapshot())
}

app.whenReady().then(async () => {
  store = new DesktopStore(app.getPath('userData'), app.getAppPath())
  await store.start()
  store.subscribe(() => {
    publishSnapshot()
  })

  ipcMain.handle('snapshot:get', () => {
    return store?.getSnapshot()
  })

  ipcMain.handle('task:enqueue', (_event, input: EnqueueTaskInput) => {
    return store?.enqueueTask(input)
  })

  ipcMain.handle('task:stop', (_event, taskId: string) => {
    return store?.stopTask(taskId)
  })

  ipcMain.handle('clipboard:write', (_event, value: string) => {
    clipboard.writeText(String(value || ''))
    return true
  })

  ipcMain.handle('remote:push', (_event, raw: string) => {
    return store?.pushRemoteCommand(raw)
  })

  ipcMain.handle('device:update', (_event, input: BindDeviceInput) => {
    return store?.updateDevice(input)
  })

  ipcMain.handle(
    'device:toggle',
    (_event, key: SettingKey, value: boolean) => store?.toggleSetting(key, value),
  )

  ipcMain.handle('runner:doctor', () => {
    return store?.rerunDoctor()
  })

  ipcMain.handle('history:clear', () => {
    return store?.clearHistory()
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  store?.stop()
})
