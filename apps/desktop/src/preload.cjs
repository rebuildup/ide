const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getStatus: () => ipcRenderer.invoke('server-info'),
  startServer: () => ipcRenderer.invoke('server-start'),
  stopServer: () => ipcRenderer.invoke('server-stop'),
  openUi: () => ipcRenderer.invoke('server-open'),
  setAutoStart: (enabled) => ipcRenderer.invoke('autostart-set', enabled),
  onStatus: (callback) => {
    ipcRenderer.on('server-status', (_, status) => callback(status));
  }
});
