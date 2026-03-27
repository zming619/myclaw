import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppSnapshot,
  BindDeviceInput,
  DesktopBridge,
  EnqueueTaskInput,
  SettingKey,
} from '../../shared/contracts'

const desktopBridge: DesktopBridge = {
  getSnapshot: () => ipcRenderer.invoke('snapshot:get') as Promise<AppSnapshot>,
  subscribe: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, snapshot: AppSnapshot) => {
      listener(snapshot)
    }
    ipcRenderer.on('snapshot:updated', wrapped)
    return () => {
      ipcRenderer.removeListener('snapshot:updated', wrapped)
    }
  },
  enqueueTask: (input: EnqueueTaskInput) =>
    ipcRenderer.invoke('task:enqueue', input) as Promise<AppSnapshot>,
  stopTask: (taskId: string) =>
    ipcRenderer.invoke('task:stop', taskId) as Promise<AppSnapshot>,
  copyText: (value: string) =>
    ipcRenderer.invoke('clipboard:write', value) as Promise<boolean>,
  pushRemoteCommand: (raw: string) =>
    ipcRenderer.invoke('remote:push', raw) as Promise<AppSnapshot>,
  updateDevice: (input: BindDeviceInput) =>
    ipcRenderer.invoke('device:update', input) as Promise<AppSnapshot>,
  toggleSetting: (key: SettingKey, value: boolean) =>
    ipcRenderer.invoke('device:toggle', key, value) as Promise<AppSnapshot>,
  rerunDoctor: () => ipcRenderer.invoke('runner:doctor') as Promise<AppSnapshot>,
  clearHistory: () => ipcRenderer.invoke('history:clear') as Promise<AppSnapshot>,
}

contextBridge.exposeInMainWorld('desktop', desktopBridge)
