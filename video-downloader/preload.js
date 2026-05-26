const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  checkDependencies: () => ipcRenderer.invoke('check-dependencies'),
  chooseFolder: () => ipcRenderer.invoke('choose-folder'),
  openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),
  defaultDownloadFolder: () => ipcRenderer.invoke('default-download-folder'),
  startDownload: (params) => ipcRenderer.invoke('start-download', params),
  cancelDownload: (id) => ipcRenderer.invoke('cancel-download', { id }),
  onProgress: (cb) => ipcRenderer.on('download-progress', (_e, data) => cb(data)),
  onLog: (cb) => ipcRenderer.on('download-log', (_e, data) => cb(data)),
  onFinished: (cb) => ipcRenderer.on('download-finished', (_e, data) => cb(data))
});
