const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const DEFAULT_PORT = Number(process.env.DECK_IDE_PORT || 8787);
const SERVER_URL_FALLBACK = `http://localhost:${DEFAULT_PORT}`;

let mainWindow = null;
let serverProcess = null;
let serverUrl = SERVER_URL_FALLBACK;
let lastError = '';

const resolveServerEntry = () => {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'server', 'src', 'index.js');
  }
  return path.resolve(__dirname, '..', '..', 'server', 'src', 'index.js');
};

const getNodePath = () => {
  const candidates = [
    path.join(app.getAppPath(), 'node_modules'),
    path.join(process.resourcesPath, 'node_modules')
  ];
  return candidates
    .filter((candidate) => fs.existsSync(candidate))
    .join(path.delimiter);
};

const getServerStatus = () => ({
  running: Boolean(serverProcess),
  url: serverUrl,
  lastError,
  autoStart: app.getLoginItemSettings().openAtLogin
});

const broadcastStatus = () => {
  if (!mainWindow) return;
  mainWindow.webContents.send('server-status', getServerStatus());
};

const parseServerUrl = (text) => {
  const match = text.match(/Deck IDE server listening on (http[^\s]+)/);
  if (match) {
    serverUrl = match[1];
  }
};

const startServer = () => {
  if (serverProcess) {
    return;
  }
  const entry = resolveServerEntry();
  if (!fs.existsSync(entry)) {
    lastError = `Server entry not found: ${entry}`;
    broadcastStatus();
    return;
  }
  lastError = '';
  const env = {
    ...process.env,
    PORT: String(DEFAULT_PORT),
    ELECTRON_RUN_AS_NODE: '1',
    NODE_PATH: getNodePath()
  };
  serverProcess = spawn(process.execPath, [entry], {
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  serverProcess.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    parseServerUrl(text);
    broadcastStatus();
  });
  serverProcess.stderr.on('data', (chunk) => {
    lastError = chunk.toString().trim();
    broadcastStatus();
  });
  serverProcess.on('exit', (code) => {
    serverProcess = null;
    if (code && code !== 0) {
      lastError = `Server exited with code ${code}`;
    }
    broadcastStatus();
  });
  broadcastStatus();
};

const stopServer = () => {
  if (!serverProcess) {
    return;
  }
  serverProcess.kill();
  serverProcess = null;
  broadcastStatus();
};

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 320,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

app.whenReady().then(() => {
  createWindow();
  startServer();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopServer();
    app.quit();
  }
});

ipcMain.handle('server-info', () => getServerStatus());
ipcMain.handle('server-start', () => {
  startServer();
  return getServerStatus();
});
ipcMain.handle('server-stop', () => {
  stopServer();
  return getServerStatus();
});
ipcMain.handle('server-open', () => {
  shell.openExternal(serverUrl);
  return getServerStatus();
});
ipcMain.handle('autostart-set', (_, enabled) => {
  app.setLoginItemSettings({
    openAtLogin: Boolean(enabled),
    openAsHidden: true
  });
  return getServerStatus();
});
