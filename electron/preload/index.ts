import { contextBridge, ipcRenderer } from 'electron'

// Secure bridge exposing only explicitly whitelisted, typed IPC methods to renderer
const ajsonAPI = {
  app: {
    getInfo: () => ipcRenderer.invoke('app:getInfo'),
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  },
  project: {
    openFolder: () => ipcRenderer.invoke('project:openFolder'),
    openPath: (folderPath: string) => ipcRenderer.invoke('project:openPath', folderPath),
    getTree: () => ipcRenderer.invoke('project:getTree'),
    getRoot: () => ipcRenderer.invoke('project:getRoot'),
    search: (query: string, options?: any) => ipcRenderer.invoke('project:search', query, options),
  },
  workspace: {
    getState: () => ipcRenderer.invoke('workspace:getState'),
    saveState: (state: any) => ipcRenderer.invoke('workspace:saveState', state),
    getRecentProjects: () => ipcRenderer.invoke('workspace:getRecentProjects'),
    addRecentProject: (project: { path: string; name?: string }) =>
      ipcRenderer.invoke('workspace:addRecentProject', project),
    removeRecentProject: (projectPath: string) =>
      ipcRenderer.invoke('workspace:removeRecentProject', projectPath),
    clearRecentProjects: () => ipcRenderer.invoke('workspace:clearRecentProjects'),
  },
  fs: {
    openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
    readFile: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
    saveFile: (
      filePath: string,
      content: string,
      options?: { expectedLastModified?: number; forceOverwrite?: boolean }
    ) => ipcRenderer.invoke('file:write', filePath, content, options),
    saveFileAs: (content: string, defaultName?: string, defaultPath?: string) =>
      ipcRenderer.invoke('file:saveAs', content, defaultName, defaultPath),
    checkModified: (filePath: string, expectedMtime: number) =>
      ipcRenderer.invoke('file:checkModified', filePath, expectedMtime),
    createFile: (targetDir: string, fileName: string) => ipcRenderer.invoke('fs:createFile', targetDir, fileName),
    createFolder: (targetDir: string, folderName: string) => ipcRenderer.invoke('fs:createFolder', targetDir, folderName),
    rename: (oldPath: string, newName: string) => ipcRenderer.invoke('fs:rename', oldPath, newName),
    delete: (targetPath: string) => ipcRenderer.invoke('fs:delete', targetPath),
  },
  terminal: {
    run: (req: { id: string; command: string; cwd?: string; timeoutMs?: number }) =>
      ipcRenderer.invoke('terminal:run', req),
    kill: (id: string) => ipcRenderer.invoke('terminal:kill', id),
    onEvent: (cb: (event: unknown) => void) => {
      const listener = (_e: unknown, event: unknown) => cb(event)
      ipcRenderer.on('terminal:event', listener)
      return () => ipcRenderer.removeListener('terminal:event', listener)
    },
  },
  git: {
    status: () => ipcRenderer.invoke('git:status'),
  },
  ai: {
    getConfig: () => ipcRenderer.invoke('ai:getConfig'),
    saveApiKey: (providerId: string, apiKey: string) =>
      ipcRenderer.invoke('ai:saveApiKey', providerId, apiKey),
    clearApiKey: (providerId: string) =>
      ipcRenderer.invoke('ai:clearApiKey', providerId),
    sendMessage: (req: unknown) =>
      ipcRenderer.invoke('ai:sendMessage', req),
    cancelRequest: (requestId: string) =>
      ipcRenderer.invoke('ai:cancelRequest', requestId),
  },
}

contextBridge.exposeInMainWorld('ajsonAPI', ajsonAPI)

export type AjsonAPI = typeof ajsonAPI
