const statusEl = document.getElementById('status');
const startBtn = document.getElementById('start');
const stopBtn = document.getElementById('stop');
const openBtn = document.getElementById('open');
const autoStartInput = document.getElementById('autostart');
const logsEl = document.getElementById('logs');
const clearBtn = document.getElementById('clear');

// Settings elements
const portInput = document.getElementById('port');
const killPortBtn = document.getElementById('kill-port');
const basicAuthEnabledInput = document.getElementById('basicauth-enabled');
const basicAuthUsernameInput = document.getElementById('basicauth-username');
const basicAuthPasswordInput = document.getElementById('basicauth-password');
const basicAuthFieldsEl = document.getElementById('basicauth-fields');
const saveConfigBtn = document.getElementById('save-config');

const renderStatus = (status) => {
  if (!status) return;
  statusEl.textContent = status.running
    ? `Running: ${status.url}`
    : 'Stopped';
  if (status.lastError) {
    statusEl.textContent = `${statusEl.textContent} | ${status.lastError}`;
  }
  autoStartInput.checked = Boolean(status.autoStart);
  startBtn.disabled = status.running;
  stopBtn.disabled = !status.running;
};

const loadConfig = async () => {
  const config = await window.api.getConfig();
  portInput.value = config.port;
  basicAuthEnabledInput.checked = config.basicAuth.enabled;
  basicAuthUsernameInput.value = config.basicAuth.username;
  basicAuthPasswordInput.value = config.basicAuth.password;
  basicAuthFieldsEl.style.display = config.basicAuth.enabled ? 'block' : 'none';
};

const refresh = async () => {
  const status = await window.api.getStatus();
  renderStatus(status);
  const logs = await window.api.getLogs();
  logsEl.textContent = logs || '';
  logsEl.scrollTop = logsEl.scrollHeight;
  await loadConfig();
};

startBtn.addEventListener('click', async () => {
  const status = await window.api.startServer();
  renderStatus(status);
});

stopBtn.addEventListener('click', async () => {
  const status = await window.api.stopServer();
  renderStatus(status);
});

openBtn.addEventListener('click', async () => {
  await window.api.openUi();
});

autoStartInput.addEventListener('change', async (event) => {
  const status = await window.api.setAutoStart(event.target.checked);
  renderStatus(status);
});

clearBtn.addEventListener('click', async () => {
  const logs = await window.api.clearLogs();
  logsEl.textContent = logs || '';
});

killPortBtn.addEventListener('click', async () => {
  const port = parseInt(portInput.value, 10);
  if (!port || port < 1024 || port > 65535) {
    alert('Please enter a valid port number (1024-65535)');
    return;
  }

  if (!confirm(`Kill all processes using port ${port}?`)) {
    return;
  }

  killPortBtn.disabled = true;
  killPortBtn.textContent = 'Killing...';

  try {
    const result = await window.api.killPort(port);
    if (result.success) {
      alert(result.message);
    } else {
      alert(`Failed: ${result.message}`);
    }
  } catch (error) {
    alert(`Error: ${error.message}`);
  } finally {
    killPortBtn.disabled = false;
    killPortBtn.textContent = '🗙 Kill Port';
  }
});

basicAuthEnabledInput.addEventListener('change', (event) => {
  basicAuthFieldsEl.style.display = event.target.checked ? 'block' : 'none';
});

saveConfigBtn.addEventListener('click', async () => {
  const config = {
    port: parseInt(portInput.value, 10),
    basicAuth: {
      enabled: basicAuthEnabledInput.checked,
      username: basicAuthUsernameInput.value,
      password: basicAuthPasswordInput.value
    }
  };

  const result = await window.api.saveConfig(config);
  if (result.success) {
    alert('Settings saved successfully! Server is restarting...');
    renderStatus(result.status);
  } else {
    alert('Failed to save settings');
  }
});

window.api.onStatus((status) => {
  renderStatus(status);
});

window.api.onLog((text) => {
  logsEl.textContent += text;
  logsEl.scrollTop = logsEl.scrollHeight;
});

refresh();
