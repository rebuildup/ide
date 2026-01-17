import crypto from 'node:crypto';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer } from 'ws';
import { spawn } from 'node-pty';
import { DatabaseSync } from 'node:sqlite';

const DEFAULT_ROOT = process.env.DEFAULT_ROOT || process.cwd();
const PORT = Number(process.env.PORT || 8787);

const app = express();
app.use(express.json({ limit: '2mb' }));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', '..', 'web', 'dist');
const hasStatic = fsSync.existsSync(distDir);
const dataDir = path.resolve(__dirname, '..', '..', 'data');
const dbPath = process.env.DB_PATH || path.join(dataDir, 'deck-ide.db');
fsSync.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

const workspaces = new Map();
const workspacePathIndex = new Map();
const decks = new Map();
const terminals = new Map();
const TERMINAL_BUFFER_LIMIT = Number(
  process.env.TERMINAL_BUFFER_LIMIT || 50000
);
const TERMINAL_IDLE_TIMEOUT_MS = Number(
  process.env.TERMINAL_IDLE_TIMEOUT_MS || 30 * 60 * 1000
);

db.exec(`
  CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    normalized_path TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  );
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS decks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    root TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

const insertWorkspace = db.prepare(
  'INSERT INTO workspaces (id, name, path, normalized_path, created_at) VALUES (?, ?, ?, ?, ?)'
);
const insertDeck = db.prepare(
  'INSERT INTO decks (id, name, root, workspace_id, created_at) VALUES (?, ?, ?, ?, ?)'
);

function normalizeWorkspacePath(inputPath = '') {
  return path.resolve(inputPath || DEFAULT_ROOT);
}

function getWorkspaceKey(workspacePath) {
  const normalized = workspacePath.replace(/[\\/]+$/, '');
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function getWorkspaceName(workspacePath, index) {
  const trimmed = workspacePath.replace(/[\\/]+$/, '');
  const base = path.basename(trimmed);
  return base || `Project ${index}`;
}

function createWorkspace(inputPath, name) {
  const resolvedPath = normalizeWorkspacePath(inputPath);
  const key = getWorkspaceKey(resolvedPath);
  if (workspacePathIndex.has(key)) {
    const error = new Error('Workspace path already exists');
    error.status = 409;
    throw error;
  }
  const workspace = {
    id: crypto.randomUUID(),
    name: name || getWorkspaceName(resolvedPath, workspaces.size + 1),
    path: resolvedPath,
    createdAt: new Date().toISOString()
  };
  workspaces.set(workspace.id, workspace);
  workspacePathIndex.set(key, workspace.id);
  insertWorkspace.run(
    workspace.id,
    workspace.name,
    workspace.path,
    key,
    workspace.createdAt
  );
  return workspace;
}

function requireWorkspace(workspaceId) {
  const workspace = workspaces.get(workspaceId);
  if (!workspace) {
    const error = new Error('Workspace not found');
    error.status = 404;
    throw error;
  }
  return workspace;
}

function createDeck(name, workspaceId) {
  const workspace = requireWorkspace(workspaceId);
  const deck = {
    id: crypto.randomUUID(),
    name: name || `Deck ${decks.size + 1}`,
    root: workspace.path,
    workspaceId,
    createdAt: new Date().toISOString()
  };
  decks.set(deck.id, deck);
  insertDeck.run(
    deck.id,
    deck.name,
    deck.root,
    deck.workspaceId,
    deck.createdAt
  );
  return deck;
}

function appendToTerminalBuffer(session, data) {
  session.buffer += data;
  if (session.buffer.length > TERMINAL_BUFFER_LIMIT) {
    session.buffer = session.buffer.slice(
      session.buffer.length - TERMINAL_BUFFER_LIMIT
    );
  }
}

function getNextTerminalIndex(deckId) {
  let count = 0;
  terminals.forEach((session) => {
    if (session.deckId === deckId) {
      count += 1;
    }
  });
  return count + 1;
}

function createTerminalSession(deck, title) {
  const id = crypto.randomUUID();
  const shell =
    process.env.SHELL ||
    (process.platform === 'win32' ? 'powershell.exe' : 'bash');
  const env = {
    ...process.env,
    TERM: process.env.TERM || 'xterm-256color'
  };
  const term = spawn(shell, [], {
    cwd: deck.root,
    cols: 120,
    rows: 32,
    env
  });
  const resolvedTitle = title || `Terminal ${getNextTerminalIndex(deck.id)}`;
  const session = {
    id,
    deckId: deck.id,
    title: resolvedTitle,
    createdAt: new Date().toISOString(),
    term,
    sockets: new Set(),
    buffer: '',
    lastActive: Date.now(),
    dispose: null
  };
  session.dispose = term.onData((data) => {
    appendToTerminalBuffer(session, data);
    session.lastActive = Date.now();
    session.sockets.forEach((socket) => {
      if (socket.readyState === 1) {
        socket.send(data);
      }
    });
  });
  term.onExit(() => {
    session.sockets.forEach((socket) => {
      try {
        socket.close();
      } catch {
        // ignore
      }
    });
    terminals.delete(id);
  });
  terminals.set(id, session);
  return session;
}

function resolveSafePath(workspacePath, inputPath = '') {
  const root = path.resolve(workspacePath);
  const resolved = path.resolve(root, inputPath);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    const error = new Error('Path escapes root');
    error.status = 400;
    throw error;
  }
  return resolved;
}

function handleError(res, error) {
  const status = error.status || 500;
  res.status(status).json({
    error: error.message || 'Unexpected error'
  });
}

function loadPersistedState() {
  const workspaceRows = db
    .prepare(
      'SELECT id, name, path, created_at FROM workspaces ORDER BY created_at ASC'
    )
    .all();
  workspaceRows.forEach((row) => {
    const workspace = {
      id: row.id,
      name: row.name,
      path: row.path,
      createdAt: row.created_at
    };
    workspaces.set(workspace.id, workspace);
    workspacePathIndex.set(getWorkspaceKey(workspace.path), workspace.id);
  });

  const deckRows = db
    .prepare(
      'SELECT id, name, root, workspace_id, created_at FROM decks ORDER BY created_at ASC'
    )
    .all();
  deckRows.forEach((row) => {
    if (!workspaces.has(row.workspace_id)) return;
    const deck = {
      id: row.id,
      name: row.name,
      root: row.root,
      workspaceId: row.workspace_id,
      createdAt: row.created_at
    };
    decks.set(deck.id, deck);
  });
}

loadPersistedState();

app.get('/api/workspaces', (req, res) => {
  res.json(Array.from(workspaces.values()));
});

app.post('/api/workspaces', (req, res) => {
  try {
    if (!req.body?.path) {
      const error = new Error('path is required');
      error.status = 400;
      throw error;
    }
    const workspace = createWorkspace(req.body?.path, req.body?.name);
    res.status(201).json(workspace);
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/config', (req, res) => {
  res.json({ defaultRoot: normalizeWorkspacePath(DEFAULT_ROOT) });
});

app.get('/api/decks', (req, res) => {
  res.json(Array.from(decks.values()));
});

app.post('/api/decks', (req, res) => {
  try {
    const workspaceId = req.body?.workspaceId;
    if (!workspaceId) {
      const error = new Error('workspaceId is required');
      error.status = 400;
      throw error;
    }
    const deck = createDeck(req.body?.name, workspaceId);
    res.status(201).json(deck);
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/terminals', (req, res) => {
  const deckId = req.query.deckId;
  if (!deckId) {
    res.status(400).json({ error: 'deckId is required' });
    return;
  }
  const sessions = [];
  terminals.forEach((session) => {
    if (session.deckId === deckId) {
      sessions.push({
        id: session.id,
        title: session.title,
        createdAt: session.createdAt
      });
    }
  });
  sessions.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  res.json(sessions);
});

app.get('/api/files', async (req, res) => {
  try {
    const workspaceId = req.query.workspaceId;
    if (!workspaceId) {
      const error = new Error('workspaceId is required');
      error.status = 400;
      throw error;
    }
    const workspace = requireWorkspace(workspaceId);
    const requestedPath = req.query.path || '';
    const target = resolveSafePath(workspace.path, requestedPath);
    const stats = await fs.stat(target);
    if (!stats.isDirectory()) {
      const error = new Error('Path is not a directory');
      error.status = 400;
      throw error;
    }
    const entries = await fs.readdir(target, { withFileTypes: true });
    const normalizedBase = requestedPath.replace(/\\/g, '/');
    const mapped = entries.map((entry) => {
      const entryPath = normalizedBase
        ? `${normalizedBase}/${entry.name}`
        : entry.name;
      return {
        name: entry.name,
        path: entryPath,
        type: entry.isDirectory() ? 'dir' : 'file'
      };
    });
    mapped.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'dir' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    res.json(mapped);
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/preview', async (req, res) => {
  try {
    const rootInput = req.query.path || DEFAULT_ROOT;
    const requestedPath = req.query.subpath || '';
    const rootPath = normalizeWorkspacePath(rootInput);
    const target = resolveSafePath(rootPath, requestedPath);
    const stats = await fs.stat(target);
    if (!stats.isDirectory()) {
      const error = new Error('Path is not a directory');
      error.status = 400;
      throw error;
    }
    const entries = await fs.readdir(target, { withFileTypes: true });
    const normalizedBase = String(requestedPath || '').replace(/\\/g, '/');
    const mapped = entries.map((entry) => {
      const entryPath = normalizedBase
        ? `${normalizedBase}/${entry.name}`
        : entry.name;
      return {
        name: entry.name,
        path: entryPath,
        type: entry.isDirectory() ? 'dir' : 'file'
      };
    });
    mapped.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'dir' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    res.json(mapped);
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/file', async (req, res) => {
  try {
    const workspaceId = req.query.workspaceId;
    if (!workspaceId) {
      const error = new Error('workspaceId is required');
      error.status = 400;
      throw error;
    }
    const workspace = requireWorkspace(workspaceId);
    const target = resolveSafePath(workspace.path, req.query.path || '');
    const contents = await fs.readFile(target, 'utf8');
    res.json({ path: req.query.path, contents });
  } catch (error) {
    handleError(res, error);
  }
});

app.put('/api/file', async (req, res) => {
  try {
    const workspaceId = req.body?.workspaceId;
    if (!workspaceId) {
      const error = new Error('workspaceId is required');
      error.status = 400;
      throw error;
    }
    const workspace = requireWorkspace(workspaceId);
    const target = resolveSafePath(workspace.path, req.body?.path || '');
    const contents = req.body?.contents ?? '';
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, contents, 'utf8');
    res.json({ path: req.body?.path, saved: true });
  } catch (error) {
    handleError(res, error);
  }
});

if (hasStatic) {
  app.use(express.static(distDir));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      res.sendStatus(404);
      return;
    }
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.post('/api/terminals', (req, res) => {
  const deckId = req.body?.deckId;
  if (!deckId || !decks.has(deckId)) {
    res.status(400).json({ error: 'deckId is required' });
    return;
  }
  const deck = decks.get(deckId);
  const session = createTerminalSession(deck, req.body?.title);
  res.status(201).json({ id: session.id, title: session.title });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (socket, req) => {
  const url = new URL(req.url || '', `http://localhost:${PORT}`);
  const match = url.pathname.match(/\/api\/terminals\/(.+)/);
  if (!match) {
    socket.close();
    return;
  }
  const id = match[1];
  const session = terminals.get(id);
  if (!session) {
    socket.close();
    return;
  }

  session.sockets.add(socket);
  session.lastActive = Date.now();
  if (session.buffer) {
    socket.send(session.buffer);
  }

  socket.on('message', (data) => {
    session.lastActive = Date.now();
    const message = data.toString();
    if (message.startsWith('\u0000resize:')) {
      const payload = message.slice('\u0000resize:'.length);
      const [colsRaw, rowsRaw] = payload.split(',');
      const cols = Number(colsRaw);
      const rows = Number(rowsRaw);
      if (Number.isFinite(cols) && Number.isFinite(rows)) {
        session.term.resize(cols, rows);
      }
      return;
    }
    session.term.write(message);
  });

  socket.on('close', () => {
    session.sockets.delete(socket);
    session.lastActive = Date.now();
  });
});

setInterval(() => {
  const now = Date.now();
  terminals.forEach((session, id) => {
    if (
      session.sockets.size === 0 &&
      now - session.lastActive > TERMINAL_IDLE_TIMEOUT_MS
    ) {
      if (session.dispose) {
        session.dispose.dispose();
      }
      session.term.kill();
      terminals.delete(id);
    }
  });
}, 60_000).unref();

server.listen(PORT, () => {
  const baseUrl = `http://localhost:${PORT}`;
  console.log(`Deck IDE server listening on ${baseUrl}`);
  console.log(`UI: ${baseUrl}`);
  console.log(`API: ${baseUrl}/api`);
});
