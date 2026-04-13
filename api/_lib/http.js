import { verifyAuthToken } from './auth-token.js';
import { getUserById } from './user-store.js';
import { gunzipSync, strFromU8 } from 'fflate';

export function applyCors(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.setHeader('Cache-Control', 'no-store');
}

export function sendJson(response, statusCode, payload) {
  applyCors(response);
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
}

export function handleOptions(request, response) {
  if (request.method !== 'OPTIONS') {
    return false;
  }

  applyCors(response);
  response.statusCode = 204;
  response.end();
  return true;
}

export function readBearerToken(request) {
  const authorizationHeader = request.headers?.authorization || '';

  if (typeof authorizationHeader !== 'string' || !authorizationHeader.startsWith('Bearer ')) {
    return '';
  }

  return authorizationHeader.slice('Bearer '.length).trim();
}

export async function requireAuth(request, response) {
  const token = readBearerToken(request);

  if (!token) {
    sendJson(response, 401, { error: 'Unauthorized.' });
    return null;
  }

  const payload = verifyAuthToken(token);

  if (!payload) {
    sendJson(response, 401, { error: 'Session expired.' });
    return null;
  }

  const freshUser = await getUserById(payload.user?.id);

  if (!freshUser || freshUser.enabled === false) {
    sendJson(response, 401, { error: 'Session expired.' });
    return null;
  }

  return {
    ...payload,
    user: freshUser,
  };
}

export async function parseRequestBody(request) {
  let parsed = {};
  
  if (request.body) {
    if (typeof request.body === 'object') {
      parsed = request.body;
    } else if (typeof request.body === 'string') {
      try {
        parsed = JSON.parse(request.body);
      } catch {
        parsed = {};
      }
    }
  } else {
    try {
      const chunks = [];
      for await (const chunk of request) {
        chunks.push(chunk);
      }
      const raw = Buffer.concat(chunks).toString('utf8');
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      parsed = {};
    }
  }

  // Handle compressed payload
  if (parsed?._compressed && typeof parsed.data === 'string') {
    try {
      const buf = Buffer.from(parsed.data, 'base64');
      const decompressed = gunzipSync(new Uint8Array(buf));
      return JSON.parse(strFromU8(decompressed));
    } catch (err) {
      console.error('Failed to decompress body:', err.message);
      return parsed;
    }
  }

  return parsed;
}
