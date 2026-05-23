const { contextBridge, ipcRenderer } = require('electron');

/**
 * Expose secure API to renderer process
 */
contextBridge.exposeInMainWorld('stirlingAPI', {
  // Backend lifecycle
  getBackendStatus: () => ipcRenderer.invoke('backend:status'),
  startBackend: () => ipcRenderer.invoke('backend:start'),
  stopBackend: () => ipcRenderer.invoke('backend:stop'),
  restartBackend: () => ipcRenderer.invoke('backend:restart'),
  getBackendUrl: () => ipcRenderer.invoke('backend:url'),

  // Licensing
  getLicenseStatus: () => ipcRenderer.invoke('license:get-status'),
  applyLicense: (key) => ipcRenderer.invoke('license:apply', key),

  // App controls
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url),
  openFullApp: () => ipcRenderer.invoke('app:open-full'),
  minimizeToTray: () => ipcRenderer.invoke('app:minimize-tray'),
  getSettings: () => ipcRenderer.invoke('app:get-settings'),
  setSetting: (key, value) => ipcRenderer.invoke('app:set-setting', key, value),

  // Window controls
  windowMinimize: () => ipcRenderer.send('window:minimize'),
  windowMaximize: () => ipcRenderer.send('window:maximize'),
  windowClose: () => ipcRenderer.send('window:close'),

  // Event listeners
  onBackendStatus: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('backend:status-update', handler);
    return () => ipcRenderer.removeListener('backend:status-update', handler);
  },
  onNavigate: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('app:navigate', handler);
    return () => ipcRenderer.removeListener('app:navigate', handler);
  },

  // File dialogs
  openFile: (options) => ipcRenderer.invoke('dialog:open-file', options),
  saveFile: (options) => ipcRenderer.invoke('dialog:save-file', options),
  writeTextFile: (filePath, content) => ipcRenderer.invoke('fs:write-text', filePath, content),
  writeBinaryFile: (filePath, base64Content) => ipcRenderer.invoke('fs:write-binary', filePath, base64Content),

  // Conversion
  pdfToMarkdown: (pdfPath)                    => ipcRenderer.invoke('convert:pdf-to-md', pdfPath),
  markdownToPdf: (markdownContent, outputPath) => ipcRenderer.invoke('convert:md-to-pdf', markdownContent, outputPath),
}

/**
 * Expose platform info
 */
contextBridge.exposeInMainWorld('platform', {
  os: process.platform,
  arch: process.arch,
  versions: {
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome,
  }
});
