import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, '..');
const dataDir = path.join(workspaceRoot, 'shared-data');
const dataFile = path.join(dataDir, 'store.json');
const usersFile = path.join(dataDir, 'users.json');
const masterFile = path.join(dataDir, 'master.json');
const visualsDir = path.join(dataDir, 'visuals');
const port = 4174;
const SESSION_TTL_MS = 1000 * 60 * 60 * 16;
const sessionStore = new Map();

function hashPassword(value) {
  return createHash('sha256')
    .update(String(value || ''))
    .digest('hex');
}

let masterCache = null;
let lastMasterUpdate = new Date().toISOString();

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
  aisleNames: {},
  lossAudits: [],
  stockChecks: [],
  masterProducts: [],
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

function sendJson(response, statusCode, payload, compress = false) {
  const json = JSON.stringify(payload);
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  };

  if (compress) {
    const compressed = gzipSync(json);
    headers['Content-Encoding'] = 'gzip';
    response.writeHead(statusCode, headers);
    response.end(compressed);
  } else {
    response.writeHead(statusCode, headers);
    response.end(json);
  }
}

function getVisualFilePath(key) {
  return path.join(visualsDir, `${encodeURIComponent(String(key || '').trim())}.json`);
}

function normalizeVisualMeta(input) {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const meta = {
    hasSource: Boolean(input.hasSource || input.src),
  };

  if (typeof input.updatedAt === 'string' && input.updatedAt.trim()) {
    meta.updatedAt = input.updatedAt;
  }

  const width = Number(input.width);
  const height = Number(input.height);
  const cropTop = Number(input.cropTop);
  const version = Number(input.version);

  if (Number.isFinite(width) && width > 0) {
    meta.width = width;
  }

  if (Number.isFinite(height) && height > 0) {
    meta.height = height;
  }

  if (Number.isFinite(cropTop) && cropTop >= 0) {
    meta.cropTop = cropTop;
  }

  if (Number.isFinite(version) && version > 0) {
    meta.version = version;
  }

  return meta;
}

function normalizeVisual(input) {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const src = typeof input.src === 'string' ? input.src.trim() : '';

  if (!src) {
    return null;
  }

  return {
    ...input,
    src,
    updatedAt:
      typeof input.updatedAt === 'string' && input.updatedAt.trim()
        ? input.updatedAt
        : new Date().toISOString(),
  };
}

function buildVisualMeta(visual) {
  const normalizedVisual = normalizeVisual(visual);

  if (!normalizedVisual) {
    return null;
  }

  return normalizeVisualMeta({
    hasSource: true,
    updatedAt: normalizedVisual.updatedAt,
    width: normalizedVisual.width,
    height: normalizedVisual.height,
    cropTop: normalizedVisual.cropTop,
    version: normalizedVisual.version,
  });
}

function normalizeMasterCode(value) {
  let valStr = String(value || '').replace(/\s/g, '').trim();
  // Fix scientific notation for large barcodes (e.g. 8.93E+12, 8E12, 8.9e+12)
  if (/^[0-9](\.[0-9]+)?E\+?[0-9]+$/i.test(valStr)) {
    try {
      const num = Number(valStr);
      if (!Number.isNaN(num) && Number.isFinite(num)) {
        valStr = BigInt(Math.round(num)).toString();
      }
    } catch (e) {
      try { valStr = Number(valStr).toFixed(0); } catch (e2) {}
    }
  }
  return valStr;
}

function normalizeMasterName(value) {
  return String(value || '')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildMasterKeys(product) {
  return Array.from(
    new Set(
      [
        normalizeMasterCode(product?.sku),
        normalizeMasterCode(product?.barcode),
        normalizeMasterCode(product?.productId),
      ].filter(Boolean),
    ),
  );
}

function normalizeMasterProduct(product) {
  const sku = normalizeMasterCode(product?.sku);
  const barcode = normalizeMasterCode(product?.barcode);
  const productId = normalizeMasterCode(product?.productId);
  const primaryCode = sku || barcode || productId;
  const name = normalizeMasterName(product?.name);

  // Preserve division and department fields
  const division = String(product?.division || '').trim();
  const divisionName = String(product?.divisionName || '').trim();
  const department = String(product?.department || '').trim();
  const departmentName = String(product?.departmentName || '').trim();

  if (!primaryCode) {
    return null;
  }

  return {
    sku: sku || primaryCode,
    barcode: barcode || productId || '',
    productId: productId || barcode || '',
    name,
    division,
    divisionName,
    department,
    departmentName,
  };
}

function pickPreferredMasterCode(currentValue, nextValue) {
  const currentCode = normalizeMasterCode(currentValue);
  const nextCode = normalizeMasterCode(nextValue);

  // Lấy theo giá trị mới nếu có, ngược lại giữ cũ
  return nextCode || currentCode;
}

function pickPreferredMasterName(currentValue, nextValue) {
  const currentName = normalizeMasterName(currentValue);
  const nextName = normalizeMasterName(nextValue);

  // Ưu tiên hoàn toàn giá trị mới từ file vừa upload
  return nextName || currentName;
}

function mergeMasterProducts(products) {
  if (!Array.isArray(products) || products.length === 0) return [];

  const mergedProducts = [];
  const keyToIndex = new Map();

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const normalizedProduct = normalizeMasterProduct(product);

    if (!normalizedProduct) {
      continue;
    }

    const keys = buildMasterKeys(normalizedProduct);
    let matchedIndex = -1;
    
    for (let k = 0; k < keys.length; k++) {
      if (keyToIndex.has(keys[k])) {
        matchedIndex = keyToIndex.get(keys[k]);
        break;
      }
    }

    if (matchedIndex !== -1) {
      const currentProduct = mergedProducts[matchedIndex];
      const merged = {
        ...normalizedProduct,
        sku: normalizedProduct.sku || currentProduct.sku,
        barcode: normalizedProduct.barcode || currentProduct.barcode,
        productId: normalizedProduct.productId || currentProduct.productId,
        name: normalizedProduct.name || currentProduct.name,
      };
      mergedProducts[matchedIndex] = merged;
      for (let k = 0; k < keys.length; k++) {
        keyToIndex.set(keys[k], matchedIndex);
      }
    } else {
      const nextIndex = mergedProducts.length;
      mergedProducts.push(normalizedProduct);
      for (let k = 0; k < keys.length; k++) {
        keyToIndex.set(keys[k], nextIndex);
      }
    }
  }

  // To optimize sorting of 10k+ items, we avoid repetitive normalization and string creation
  const sortItems = mergedProducts.map(p => {
    const code = p.sku || p.barcode || p.productId || '';
    return {
      p,
      sortKey: `${p.name || ''}|${code}`.toLowerCase()
    };
  });

  sortItems.sort((a, b) => {
    if (a.sortKey < b.sortKey) return -1;
    if (a.sortKey > b.sortKey) return 1;
    return 0;
  });

  return sortItems.map(item => item.p);
}

function normalizeStatePayload(input) {
  const rawVisuals = input?.aisleVisuals && typeof input.aisleVisuals === 'object' ? input.aisleVisuals : {};
  const aisleVisuals = {};

  Object.entries(rawVisuals).forEach(([key, value]) => {
    const meta = normalizeVisualMeta(value);

    if (meta) {
      aisleVisuals[key] = meta;
    }
  });

  return {
    aisleProducts:
      input?.aisleProducts && typeof input.aisleProducts === 'object' ? input.aisleProducts : {},
    aisleVisuals,
    aisleNames:
      input?.aisleNames && typeof input.aisleNames === 'object' ? input.aisleNames : {},
    lossAudits: Array.isArray(input?.lossAudits) ? input.lossAudits : [],
    stockChecks: Array.isArray(input?.stockChecks) ? input.stockChecks : [],
    masterProducts: [], // Always return empty here, managed via readMaster
    updatedAt: input?.updatedAt || new Date().toISOString(),
  };
}

async function readMaster() {
  if (masterCache) {
    return masterCache;
  }

  try {
    const raw = await fs.readFile(masterFile, 'utf8');
    masterCache = JSON.parse(raw);
    return masterCache;
  } catch {
    masterCache = [];
    return masterCache;
  }
}

async function writeMaster(products) {
  const normalized = mergeMasterProducts(products);
  masterCache = normalized;
  lastMasterUpdate = new Date().toISOString();
  await fs.writeFile(masterFile, JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
}

async function ensureMasterFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(masterFile);
    await readMaster();
  } catch {
    try {
      const raw = await fs.readFile(dataFile, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.masterProducts) && parsed.masterProducts.length > 0) {
        console.log(`Migrating ${parsed.masterProducts.length} master products to master.json...`);
        await writeMaster(parsed.masterProducts);
      } else {
        await fs.writeFile(masterFile, JSON.stringify([], null, 2), 'utf8');
        masterCache = [];
      }
    } catch {
      await fs.writeFile(masterFile, JSON.stringify([], null, 2), 'utf8');
      masterCache = [];
    }
  }
}

async function ensureStoreFile() {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(visualsDir, { recursive: true });

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

async function writeVisualFile(key, visual) {
  await fs.mkdir(visualsDir, { recursive: true });
  await fs.writeFile(getVisualFilePath(key), JSON.stringify(visual), 'utf8');
}

async function readVisualFile(key) {
  try {
    const raw = await fs.readFile(getVisualFilePath(key), 'utf8');
    return normalizeVisual(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function migrateLegacyVisuals(parsedState) {
  const legacyVisuals =
    parsedState?.aisleVisuals && typeof parsedState.aisleVisuals === 'object' ? parsedState.aisleVisuals : {};
  const visualMeta = {};

  for (const [key, value] of Object.entries(legacyVisuals)) {
    const normalizedVisual = normalizeVisual({
      ...value,
      updatedAt: value?.updatedAt || parsedState?.updatedAt || new Date().toISOString(),
    });

    if (!normalizedVisual) {
      continue;
    }

    await writeVisualFile(key, normalizedVisual);
    const meta = buildVisualMeta(normalizedVisual);

    if (meta) {
      visualMeta[key] = meta;
    }
  }

  const slimState = normalizeStatePayload({
    ...parsedState,
    aisleVisuals: visualMeta,
    updatedAt: parsedState?.updatedAt || new Date().toISOString(),
  });

  await fs.writeFile(dataFile, JSON.stringify(slimState, null, 2), 'utf8');
  return slimState;
}

async function readState() {
  await ensureStoreFile();

  try {
    const raw = await fs.readFile(dataFile, 'utf8');
    const parsed = JSON.parse(raw);
    const hasLegacyVisualPayload = Object.values(parsed?.aisleVisuals || {}).some((value) => {
      return value && typeof value === 'object' && typeof value.src === 'string' && value.src.trim();
    });

    if (hasLegacyVisualPayload) {
      return migrateLegacyVisuals(parsed);
    }

    const nextState = normalizeStatePayload(parsed);
    // Include master products from separated file for full state requests
    nextState.masterProducts = await readMaster();
    return nextState;
  } catch {
    const safeInitialState = normalizeStatePayload(initialState);
    await fs.writeFile(dataFile, JSON.stringify(safeInitialState, null, 2), 'utf8');
    return safeInitialState;
  }
}

async function writeState(nextState) {
  const currentState = await readState();
  const mergedVisuals = {
    ...currentState.aisleVisuals,
  };
  const incomingVisuals =
    nextState?.aisleVisuals && typeof nextState.aisleVisuals === 'object' ? nextState.aisleVisuals : {};

  for (const [key, value] of Object.entries(incomingVisuals)) {
    const normalizedVisual = normalizeVisual(value);

    if (normalizedVisual) {
      await writeVisualFile(key, normalizedVisual);
      const meta = buildVisualMeta(normalizedVisual);

      if (meta) {
        mergedVisuals[key] = meta;
      }

      continue;
    }

    const meta = normalizeVisualMeta(value);

    if (meta) {
      mergedVisuals[key] = {
        ...mergedVisuals[key],
        ...meta,
        hasSource: Boolean(mergedVisuals[key]?.hasSource || meta.hasSource),
      };
    }
  }

  if (Array.isArray(nextState?.masterProducts)) {
    await writeMaster(nextState.masterProducts);
  }

  const payload = normalizeStatePayload({
    ...currentState,
    ...nextState,
    aisleVisuals: mergedVisuals,
    updatedAt: new Date().toISOString(),
  });

  await fs.writeFile(dataFile, JSON.stringify(payload, null, 2), 'utf8');

  // Re-attach master products for the returned object so frontend state stays in sync
  payload.masterProducts = await readMaster();
  return payload;
}

async function readVisual(key) {
  const state = await readState();

  if (!state.aisleVisuals?.[key]?.hasSource) {
    return null;
  }

  return readVisualFile(key);
}

async function writeVisual(key, visual) {
  const normalizedVisual = normalizeVisual({
    ...visual,
    updatedAt: new Date().toISOString(),
  });

  if (!normalizedVisual) {
    throw new Error('Invalid visual payload.');
  }

  await writeVisualFile(key, normalizedVisual);

  const currentState = await readState();
  const payload = normalizeStatePayload({
    ...currentState,
    updatedAt: new Date().toISOString(),
    aisleVisuals: {
      ...currentState.aisleVisuals,
      [key]: buildVisualMeta(normalizedVisual),
    },
  });

  await fs.writeFile(dataFile, JSON.stringify(payload, null, 2), 'utf8');
  return normalizedVisual;
}

async function readRequestBody(request) {
  const { gunzipSync, strFromU8 } = await import('fflate');
  
  return new Promise((resolve, reject) => {
    const chunks = [];
    const timeoutId = setTimeout(() => {
      reject(new Error('Request body read timeout'));
    }, 300000); // 5 minutes for heavy excel files

    request.on('data', (chunk) => {
      chunks.push(chunk);
    });

    request.on('end', () => {
      clearTimeout(timeoutId);
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        let parsed = raw ? JSON.parse(raw) : {};

        if (parsed?._compressed && typeof parsed.data === 'string') {
          const buf = Buffer.from(parsed.data, 'base64');
          const decompressed = gunzipSync(new Uint8Array(buf));
          parsed = JSON.parse(strFromU8(decompressed));
        }

        resolve(parsed);
      } catch (error) {
        reject(error);
      }
    });

    request.on('error', (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });
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
  const requestUrl = new URL(request.url, 'http://127.0.0.1');
  const pathname = requestUrl.pathname;

  console.log(`[${new Date().toISOString()}] ${request.method} ${request.url}`);

  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  if (pathname === '/api/health' && request.method === 'GET') {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (pathname === '/api/auth/login' && request.method === 'POST') {
    try {
      console.log('Processing login request...');
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
        console.log(`Login failed for user: ${username}`);
        sendJson(response, 401, { error: 'Sai tai khoan hoac mat khau.' });
        return;
      }

      const session = createSession(user);
      console.log(`Login success: ${username}, token: ${session.token.slice(0, 8)}...`);
      sendJson(response, 200, session);
    } catch (error) {
      console.error('Login error:', error.message);
      sendJson(response, 400, { error: 'Invalid request or timeout.' });
    }
    return;
  }

  if (pathname === '/api/auth/me' && request.method === 'GET') {
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

  if (pathname === '/api/auth/logout' && request.method === 'POST') {
    const token = resolveBearerToken(request);

    if (token) {
      sessionStore.delete(token);
    }

    sendJson(response, 200, { ok: true });
    return;
  }

  if (pathname === '/api/state' && request.method === 'GET') {
    const state = await readState();
    sendJson(response, 200, state);
    return;
  }

  if (pathname === '/api/master' && request.method === 'GET') {
    const products = await readMaster();
    // Use compression for large master data
    sendJson(response, 200, products, true);
    return;
  }

  if (pathname === '/api/master-info' && request.method === 'GET') {
    sendJson(response, 200, { updatedAt: lastMasterUpdate });
    return;
  }

  if (pathname === '/api/state' && request.method === 'PUT') {
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

  if (pathname === '/api/visual' && request.method === 'GET') {
    const key = String(requestUrl.searchParams.get('key') || '').trim();

    if (!key) {
      sendJson(response, 400, { error: 'Visual key is required.' });
      return;
    }

    const visual = await readVisual(key);

    if (!visual) {
      sendJson(response, 404, { error: 'Visual not found.' });
      return;
    }

    sendJson(response, 200, { key, visual });
    return;
  }

  if (pathname === '/api/visual' && request.method === 'PUT') {
    const auth = requireSession(request, response);

    if (!auth) {
      return;
    }

    const key = String(requestUrl.searchParams.get('key') || '').trim();

    if (!key) {
      sendJson(response, 400, { error: 'Visual key is required.' });
      return;
    }

    try {
      const body = await readRequestBody(request);
      const visual = await writeVisual(key, body?.visual || body);
      sendJson(response, 200, { key, visual });
    } catch (error) {
      sendJson(response, 400, { error: error?.message || 'Invalid visual payload.' });
    }
    return;
  }

  sendJson(response, 404, { error: 'Not found.' });
});

server.listen(port, '127.0.0.1', async () => {
  await ensureStoreFile();
  await ensureMasterFile();
  await ensureUsersFile();
  console.log(`Shared state API ready on http://127.0.0.1:${port}`);
});
