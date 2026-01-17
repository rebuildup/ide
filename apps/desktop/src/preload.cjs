const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getStatus: () => ipcRenderer.invoke('server-info'),
  getLogs: () => ipcRenderer.invoke('server-logs'),
  startServer: () => ipcRenderer.invoke('server-start'),
  stopServer: () => ipcRenderer.invoke('server-stop'),
  openUi: () => ipcRenderer.invoke('server-open'),
  setAutoStart: (enabled) => ipcRenderer.invoke('autostart-set', enabled),
  clearLogs: () => ipcRenderer.invoke('logs-clear'),
  onStatus: (callback) => {
    ipcRenderer.on('server-status', (_, status) => callback(status));
  },
  onLog: (callback) => {
    ipcRenderer.on('server-log', (_, text) => callback(text));
  }
});
