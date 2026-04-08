import { verifyAuthToken } from './auth-token.js';

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

export function requireAuth(request, response) {
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

  return payload;
}

export async function parseRequestBody(request) {
  if (!request.body) {
    return {};
  }

  if (typeof request.body === 'object') {
    return request.body;
  }

  if (typeof request.body === 'string') {
    try {
      return JSON.parse(request.body);
    } catch {
      return {};
    }
  }

  try {
    const chunks = [];

    for await (const chunk of request) {
      chunks.push(chunk);
    }

    const raw = Buffer.concat(chunks).toString('utf8');

    if (!raw) {
      return {};
    }

    return JSON.parse(raw);
  } catch {
    return {};
  }
}
