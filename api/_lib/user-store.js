import { createHash } from 'node:crypto';
import { getUsers } from './defaults.js';

const USERS_KEY = 'picker_assistant_users_v1';

function hashPassword(value) {
  return createHash('sha256')
    .update(String(value || ''))
    .digest('hex');
}

function normalizePermissions(input) {
  const permissions = input && typeof input === 'object' ? input : {};
  return {
    pog: permissions.pog !== false,
    loss: permissions.loss !== false,
    stock: permissions.stock !== false,
    adminUsers: permissions.adminUsers === true,
  };
}

function normalizeUser(input) {
  const user = input && typeof input === 'object' ? input : {};
  const role = user.role === 'admin' ? 'admin' : 'picker';
  const isAdmin = role === 'admin';

  return {
    id: String(user.id || '').trim(),
    username: String(user.username || '').trim().toLowerCase(),
    displayName: String(user.displayName || user.username || '').trim(),
    role,
    enabled: user.enabled !== false,
    permissions: {
      ...normalizePermissions(user.permissions),
      adminUsers: isAdmin ? true : normalizePermissions(user.permissions).adminUsers,
    },
    passwordHash: String(user.passwordHash || ''),
    createdAt: user.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function sanitizeUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
    role: user.role,
    enabled: Boolean(user.enabled),
    permissions: normalizePermissions(user.permissions),
    updatedAt: user.updatedAt,
  };
}

function getKvConfig() {
  const url = String(process.env.KV_REST_API_URL || '').trim();
  const token = String(process.env.KV_REST_API_TOKEN || '').trim();

  if (!url || !token) {
    throw new Error('Missing Upstash KV environment variables.');
  }

  return { url, token };
}

async function runKvCommand(command) {
  const { url, token } = getKvConfig();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Upstash KV request failed (${response.status}).`);
    }

    return response.json();
  } catch (error) {
    const message =
      error?.name === 'AbortError'
        ? 'Upstash KV request timed out.'
        : error?.message || 'Upstash KV request failed.';
    throw new Error(message);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function seedUsersIfMissing() {
  const seeded = (getUsers() || []).map((user) =>
    normalizeUser({
      ...user,
      enabled: true,
      permissions: {
        pog: true,
        loss: true,
        stock: true,
        adminUsers: user.role === 'admin',
      },
      createdAt: new Date().toISOString(),
    }),
  );

  const withIds = seeded
    .filter((user) => user.username && user.passwordHash)
    .map((user) => ({
      ...user,
      id: user.id || `u-${user.username}`,
    }));

  await runKvCommand(['SET', USERS_KEY, JSON.stringify(withIds)]);
  return withIds;
}

export async function readUsers() {
  const result = await runKvCommand(['GET', USERS_KEY]);
  const raw = result?.result;

  if (!raw) {
    return seedUsersIfMissing();
  }

  try {
    const parsed = JSON.parse(String(raw));
    const users = Array.isArray(parsed) ? parsed.map(normalizeUser) : [];
    const valid = users.filter((user) => user.username && user.passwordHash);
    return valid.length > 0 ? valid : seedUsersIfMissing();
  } catch {
    return seedUsersIfMissing();
  }
}

export async function writeUsers(nextUsers) {
  const normalized = (Array.isArray(nextUsers) ? nextUsers : []).map(normalizeUser);
  await runKvCommand(['SET', USERS_KEY, JSON.stringify(normalized)]);
  return normalized;
}

export async function getSanitizedUsers() {
  const users = await readUsers();
  return users.map(sanitizeUser);
}

export async function verifyCredentials(username, password) {
  const safeUsername = String(username || '').trim().toLowerCase();
  const users = await readUsers();
  const user = users.find((item) => item.username === safeUsername);

  if (!user) {
    return null;
  }

  if (user.enabled === false) {
    return { error: 'Tai khoan da bi khoa.' };
  }

  const passwordHash = hashPassword(password);
  if (user.passwordHash !== passwordHash) {
    return null;
  }

  return { user: sanitizeUser(user) };
}

export async function getUserById(userId) {
  const users = await readUsers();
  const user = users.find((item) => item.id === userId);
  return user ? sanitizeUser(user) : null;
}

export async function createUser(payload) {
  const username = String(payload?.username || '').trim().toLowerCase();
  const password = String(payload?.password || '');
  const displayName = String(payload?.displayName || username).trim();
  const role = payload?.role === 'admin' ? 'admin' : 'picker';

  if (!username || username.length < 3) {
    throw new Error('Username khong hop le (toi thieu 3 ky tu).');
  }

  if (!password || password.length < 4) {
    throw new Error('Mat khau khong hop le (toi thieu 4 ky tu).');
  }

  const users = await readUsers();
  const exists = users.some((item) => item.username === username);
  if (exists) {
    throw new Error('Username da ton tai.');
  }

  const nowIso = new Date().toISOString();
  const newUser = normalizeUser({
    id: `u-${username}-${Math.random().toString(16).slice(2, 8)}`,
    username,
    displayName,
    role,
    enabled: payload?.enabled !== false,
    permissions: normalizePermissions(payload?.permissions),
    passwordHash: hashPassword(password),
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  const nextUsers = [newUser, ...users.map(normalizeUser)];
  await writeUsers(nextUsers);

  return sanitizeUser(newUser);
}

export async function updateUser(userId, patch) {
  const users = await readUsers();
  const index = users.findIndex((item) => item.id === userId);
  if (index < 0) {
    throw new Error('Khong tim thay tai khoan.');
  }

  const current = normalizeUser(users[index]);
  const next = normalizeUser({
    ...current,
    enabled: typeof patch?.enabled === 'boolean' ? patch.enabled : current.enabled,
    permissions: patch?.permissions ? normalizePermissions(patch.permissions) : current.permissions,
    displayName: typeof patch?.displayName === 'string' ? patch.displayName : current.displayName,
    role: patch?.role === 'admin' ? 'admin' : patch?.role === 'picker' ? 'picker' : current.role,
    updatedAt: new Date().toISOString(),
  });

  if (patch?.password && String(patch.password).length >= 4) {
    next.passwordHash = hashPassword(patch.password);
  }

  if (next.role === 'admin') {
    next.permissions.pog = true;
    next.permissions.loss = true;
    next.permissions.stock = true;
    next.permissions.adminUsers = true;
  }

  const nextUsers = users.slice();
  nextUsers[index] = next;
  await writeUsers(nextUsers);

  return sanitizeUser(next);
}

