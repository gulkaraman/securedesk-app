import { contextBridge, ipcRenderer } from 'electron'
import type {
  IpcArgs,
  IpcChannel,
  IpcEventArgs,
  IpcEventChannel,
  IpcResult,
  RendererApi
} from '@shared/ipc'

function invoke<C extends IpcChannel>(channel: C, ...args: IpcArgs<C>): Promise<IpcResult<C>> {
  return ipcRenderer.invoke(channel, ...args) as Promise<IpcResult<C>>
}

function onEvent<C extends IpcEventChannel>(
  channel: C,
  listener: (...args: IpcEventArgs<C>) => void
): () => void {
  const wrapped = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => {
    listener(...(args as IpcEventArgs<C>))
  }
  ipcRenderer.on(channel, wrapped)
  return () => {
    ipcRenderer.removeListener(channel, wrapped)
  }
}

const api: RendererApi = {
  projects: {
    list: async () => await invoke('projects:list'),
    get: async (id) => await invoke('projects:get', id),
    create: async (input) => await invoke('projects:create', input),
    update: async (input) => await invoke('projects:update', input),
    delete: async (id) => await invoke('projects:delete', id)
  },
  users: {
    list: async () => await invoke('users:list'),
    get: async (id) => await invoke('users:get', id),
    create: async (input) => await invoke('users:create', input),
    update: async (input) => await invoke('users:update', input),
    delete: async (id) => await invoke('users:delete', id)
  },
  tasks: {
    listByProject: async (projectId) => await invoke('tasks:listByProject', projectId),
    get: async (id) => await invoke('tasks:get', id),
    create: async (input) => await invoke('tasks:create', input),
    update: async (input) => await invoke('tasks:update', input),
    delete: async (id) => await invoke('tasks:delete', id)
  },
  taskAttachments: {
    listByTask: async (taskId) => await invoke('taskAttachments:listByTask', taskId),
    create: async (input) => await invoke('taskAttachments:create', input),
    delete: async (id) => await invoke('taskAttachments:delete', id),
    pickAndAttach: async (taskId) => await invoke('taskAttachments:pickAndAttach', taskId),
    open: async (attachmentId) => await invoke('taskAttachments:open', attachmentId),
    showInFolder: async (attachmentId) => await invoke('taskAttachments:showInFolder', attachmentId)
  },
  timeEntries: {
    listByTask: async (taskId) => await invoke('timeEntries:listByTask', taskId),
    create: async (input) => await invoke('timeEntries:create', input),
    stop: async (input) => await invoke('timeEntries:stop', input),
    delete: async (id) => await invoke('timeEntries:delete', id)
  },
  timer: {
    getActive: async () => await invoke('timer:getActive'),
    start: async (taskId, userId) => await invoke('timer:start', taskId, userId),
    stop: async (taskId) => await invoke('timer:stop', taskId),
    todayEntries: async () => await invoke('timer:todayEntries'),
    todaySummary: async () => await invoke('timer:todaySummary'),
    taskTotals: async (taskId) => await invoke('timer:taskTotals', taskId)
  },
  reports: {
    getWeekly: async (request) => await invoke('reports:getWeekly', request),
    exportWeeklyPdf: async (request) => await invoke('reports:exportWeeklyPdf', request),
    getWeeklyByUser: async (request) => await invoke('reports:getWeeklyByUser', request),
    exportWeeklyPdfByUser: async (request) => await invoke('reports:exportWeeklyPdfByUser', request)
  },
  activityLogs: {
    list: async (limit) => await invoke('activityLogs:list', limit),
    create: async (input) => await invoke('activityLogs:create', input)
  },
  vault: {
    getStatus: async () => await invoke('vault:getStatus'),
    setMasterKey: async (masterKey) => await invoke('vault:setMasterKey', masterKey),
    unlock: async (masterKey) => await invoke('vault:unlock', masterKey),
    lock: async () => await invoke('vault:lock')
  },
  vaultSecrets: {
    list: async () => await invoke('vaultSecrets:list'),
    get: async (id) => await invoke('vaultSecrets:get', id),
    create: async (input) => await invoke('vaultSecrets:create', input),
    update: async (input) => await invoke('vaultSecrets:update', input),
    delete: async (id) => await invoke('vaultSecrets:delete', id)
  },
  settings: {
    list: async () => await invoke('settings:list'),
    get: async (key) => await invoke('settings:get', key),
    set: async (key, value) => await invoke('settings:set', key, value)
  },
  window: {
    minimize: async () => {
      await invoke('window:minimize')
    },
    close: async () => {
      await invoke('window:close')
    },
    toggleMaximize: async () => await invoke('window:toggleMaximize'),
    isMaximized: async () => await invoke('window:isMaximized'),
    onMaximizedChanged: (listener) =>
      onEvent('window:maximized-changed', (isMaximized) => {
        listener(isMaximized)
      })
  }
}

contextBridge.exposeInMainWorld('api', api)

