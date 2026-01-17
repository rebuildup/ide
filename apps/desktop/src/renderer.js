const statusEl = document.getElementById('status');
const startBtn = document.getElementById('start');
const stopBtn = document.getElementById('stop');
const openBtn = document.getElementById('open');
const autoStartInput = document.getElementById('autostart');
const logsEl = document.getElementById('logs');
const clearBtn = document.getElementById('clear');

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

const refresh = async () => {
  const status = await window.api.getStatus();
  renderStatus(status);
  const logs = await window.api.getLogs();
  logsEl.textContent = logs || '';
  logsEl.scrollTop = logsEl.scrollHeight;
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

window.api.onStatus((status) => {
  renderStatus(status);
});

window.api.onLog((text) => {
  logsEl.textContent += text;
  logsEl.scrollTop = logsEl.scrollHeight;
});

refresh();
