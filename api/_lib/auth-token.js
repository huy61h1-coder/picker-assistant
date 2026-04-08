import { createHmac, timingSafeEqual } from 'node:crypto';
import { SESSION_TTL_MS } from './defaults.js';

const DEFAULT_AUTH_SECRET = 'picker-assistant-default-auth-secret-change-me';

function getSecret() {
  return String(process.env.AUTH_SECRET || DEFAULT_AUTH_SECRET);
}

function toBase64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(input) {
  const normalized = String(input || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const remainder = normalized.length % 4;
  const padded = remainder === 0 ? normalized : normalized + '='.repeat(4 - remainder);
  return Buffer.from(padded, 'base64');
}

function createSignature(payloadPart) {
  return toBase64Url(
    createHmac('sha256', getSecret())
      .update(payloadPart)
      .digest(),
  );
}

export function issueAuthToken(user) {
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  const payload = {
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      enabled: user.enabled !== false,
      permissions: user.permissions || {},
    },
    iat: now,
    exp: expiresAt,
  };

  const payloadPart = toBase64Url(JSON.stringify(payload));
  const signaturePart = createSignature(payloadPart);

  return {
    token: `${payloadPart}.${signaturePart}`,
    expiresAt: new Date(expiresAt).toISOString(),
    user: payload.user,
  };
}

export function verifyAuthToken(token) {
  const rawToken = String(token || '');
  const [payloadPart, signaturePart] = rawToken.split('.');

  if (!payloadPart || !signaturePart) {
    return null;
  }

  const expectedSignature = createSignature(payloadPart);

  const actualBuffer = Buffer.from(signaturePart);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (actualBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(payloadPart).toString('utf8'));

    if (!payload?.user || typeof payload.exp !== 'number') {
      return null;
    }

    if (payload.exp <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
