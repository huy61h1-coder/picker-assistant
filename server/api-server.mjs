import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, '..');
const dataDir = path.join(workspaceRoot, 'shared-data');
const dataFile = path.join(dataDir, 'store.json');
const usersFile = path.join(dataDir, 'users.json');
const port = 4174;
const SESSION_TTL_MS = 1000 * 60 * 60 * 16;
const sessionStore = new Map();

function hashPassword(value) {
  return createHash('sha256')
    .update(String(value || ''))
    .digest('hex');
}

function sanitizeUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
    role: user.role || 'picker',
  };
}

const initialState = {
  aisleProducts: {
    'L17-A': [],
    'L12-A': [
      {
        locId: 1,
        sku: '10531914',
        name: 'HC TAM TRAI LAM MAT ICECOLD 160X200GY',
        verified: true,
      },
      {
        locId: 5,
        sku: '10763049',
        name: 'HC GOI MOCHI PILLOW BE',
        verified: true,
      },
    ],
  },
  aisleVisuals: {},
  lossAudits: [],
  updatedAt: new Date().toISOString(),
};

const initialUsers = [
  {
    id: 'u-admin',
    username: 'admin',
    displayName: 'Quan ly kho',
    role: 'admin',
    passwordHash: hashPassword('123456'),
  },
  {
    id: 'u-picker01',
    username: 'picker01',
    displayName: 'Nhan vien 01',
    role: 'picker',
    passwordHash: hashPassword('123456'),
  },
];

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

async function ensureStoreFile() {
  await fs.mkdir(dataDir, { recursive: true });

  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, JSON.stringify(initialState, null, 2), 'utf8');
  }
}

async function ensureUsersFile() {
  await fs.mkdir(dataDir, { recursive: true });

  try {
    await fs.access(usersFile);
  } catch {
    await fs.writeFile(usersFile, JSON.stringify(initialUsers, null, 2), 'utf8');
  }
}

async function readUsers() {
  await ensureUsersFile();

  try {
    const raw = await fs.readFile(usersFile, 'utf8');
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      throw new Error('Invalid user list.');
    }

    const users = parsed.filter((user) => {
      return (
        user &&
        typeof user === 'object' &&
        typeof user.username === 'string' &&
        typeof user.passwordHash === 'string'
      );
    });

    if (users.length === 0) {
      throw new Error('Empty user list.');
    }

    return users;
  } catch {
    await fs.writeFile(usersFile, JSON.stringify(initialUsers, null, 2), 'utf8');
    return initialUsers;
  }
}

async function readState() {
  await ensureStoreFile();

  try {
    const raw = await fs.readFile(dataFile, 'utf8');
    const parsed = JSON.parse(raw);

    return {
      aisleProducts: parsed?.aisleProducts && typeof parsed.aisleProducts === 'object' ? parsed.aisleProducts : {},
      aisleVisuals: parsed?.aisleVisuals && typeof parsed.aisleVisuals === 'object' ? parsed.aisleVisuals : {},
      lossAudits: Array.isArray(parsed?.lossAudits) ? parsed.lossAudits : [],
      updatedAt: parsed?.updatedAt || new Date().toISOString(),
    };
  } catch {
    await fs.writeFile(dataFile, JSON.stringify(initialState, null, 2), 'utf8');
    return initialState;
  }
}

async function writeState(nextState) {
  const payload = {
    aisleProducts:
      nextState?.aisleProducts && typeof nextState.aisleProducts === 'object' ? nextState.aisleProducts : {},
    aisleVisuals:
      nextState?.aisleVisuals && typeof nextState.aisleVisuals === 'object' ? nextState.aisleVisuals : {},
    lossAudits: Array.isArray(nextState?.lossAudits) ? nextState.lossAudits : [],
    updatedAt: new Date().toISOString(),
  };

  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dataFile, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    request.on('data', (chunk) => {
      chunks.push(chunk);
    });

    request.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });

    request.on('error', reject);
  });
}

function createSession(user) {
  const token = randomBytes(24).toString('hex');
  const now = Date.now();
  const nextSession = {
    user: sanitizeUser(user),
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };

  sessionStore.set(token, nextSession);

  return {
    token,
    user: nextSession.user,
    expiresAt: new Date(nextSession.expiresAt).toISOString(),
  };
}

function resolveBearerToken(request) {
  const header = request.headers.authorization || '';

  if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
    return '';
  }

  return header.slice('Bearer '.length).trim();
}

function requireSession(request, response) {
  const token = resolveBearerToken(request);

  if (!token) {
    sendJson(response, 401, { error: 'Unauthorized.' });
    return null;
  }

  const session = sessionStore.get(token);

  if (!session) {
    sendJson(response, 401, { error: 'Session expired.' });
    return null;
  }

  if (session.expiresAt <= Date.now()) {
    sessionStore.delete(token);
    sendJson(response, 401, { error: 'Session expired.' });
    return null;
  }

  session.expiresAt = Date.now() + SESSION_TTL_MS;

  return {
    token,
    session,
  };
}

const server = createServer(async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.url === '/api/health' && request.method === 'GET') {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.url === '/api/auth/login' && request.method === 'POST') {
    try {
      const body = await readRequestBody(request);
      const username = String(body?.username || '').trim().toLowerCase();
      const password = String(body?.password || '');

      if (!username || !password) {
        sendJson(response, 400, { error: 'Username and password are required.' });
        return;
      }

      const users = await readUsers();
      const user = users.find((item) => String(item.username || '').toLowerCase() === username);

      if (!user || user.passwordHash !== hashPassword(password)) {
        sendJson(response, 401, { error: 'Sai tai khoan hoac mat khau.' });
        return;
      }

      sendJson(response, 200, createSession(user));
    } catch {
      sendJson(response, 400, { error: 'Invalid JSON payload.' });
    }
    return;
  }

  if (request.url === '/api/auth/me' && request.method === 'GET') {
    const auth = requireSession(request, response);

    if (!auth) {
      return;
    }

    sendJson(response, 200, {
      user: auth.session.user,
      expiresAt: new Date(auth.session.expiresAt).toISOString(),
    });
    return;
  }

  if (request.url === '/api/auth/logout' && request.method === 'POST') {
    const token = resolveBearerToken(request);

    if (token) {
      sessionStore.delete(token);
    }

    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.url === '/api/state' && request.method === 'GET') {
    const state = await readState();
    sendJson(response, 200, state);
    return;
  }

  if (request.url === '/api/state' && request.method === 'PUT') {
    const auth = requireSession(request, response);

    if (!auth) {
      return;
    }

    try {
      const body = await readRequestBody(request);
      const nextState = await writeState(body);
      sendJson(response, 200, nextState);
    } catch {
      sendJson(response, 400, { error: 'Invalid JSON payload.' });
    }
    return;
  }

  sendJson(response, 404, { error: 'Not found.' });
});

server.listen(port, '127.0.0.1', async () => {
  await ensureStoreFile();
  await ensureUsersFile();
  console.log(`Shared state API ready on http://127.0.0.1:${port}`);
});
