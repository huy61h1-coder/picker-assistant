import { handleOptions, parseRequestBody, requireAuth, sendJson } from '../_lib/http.js';
import { createUser, getSanitizedUsers, updateUser } from '../_lib/user-store.js';

async function requireAdmin(request, response) {
  const auth = await requireAuth(request, response);
  if (!auth) return null;

  const role = auth.user?.role;
  const canManage = role === 'admin' || auth.user?.permissions?.adminUsers === true;

  if (!canManage) {
    sendJson(response, 403, { error: 'Forbidden.' });
    return null;
  }

  return auth;
}

export default async function handler(request, response) {
  if (handleOptions(request, response)) {
    return;
  }

  if (request.method === 'GET') {
    const auth = await requireAdmin(request, response);
    if (!auth) return;

    try {
      const users = await getSanitizedUsers();
      sendJson(response, 200, { users });
    } catch (error) {
      sendJson(response, 500, { error: error?.message || 'Failed to load users.' });
    }
    return;
  }

  if (request.method === 'POST') {
    const auth = await requireAdmin(request, response);
    if (!auth) return;

    try {
      const body = await parseRequestBody(request);
      const user = await createUser(body);
      const users = await getSanitizedUsers();
      sendJson(response, 200, { user, users });
    } catch (error) {
      sendJson(response, 400, { error: error?.message || 'Failed to create user.' });
    }
    return;
  }

  if (request.method === 'PATCH') {
    const auth = await requireAdmin(request, response);
    if (!auth) return;

    try {
      const body = await parseRequestBody(request);
      const userId = String(body?.id || '').trim();
      const patch = body?.patch || {};

      if (!userId) {
        sendJson(response, 400, { error: 'Missing user id.' });
        return;
      }

      const user = await updateUser(userId, patch);
      const users = await getSanitizedUsers();
      sendJson(response, 200, { user, users });
    } catch (error) {
      sendJson(response, 400, { error: error?.message || 'Failed to update user.' });
    }
    return;
  }

  sendJson(response, 405, { error: 'Method not allowed.' });
}
