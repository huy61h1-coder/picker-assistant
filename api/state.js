import { handleOptions, parseRequestBody, requireAuth, sendJson } from './_lib/http.js';
import { readSharedState, writeSharedState } from './_lib/state-store.js';

function hasModulePermission(user, intent) {
  if (user?.role === 'admin') {
    return true;
  }

  const permissions = user?.permissions || {};

  if (intent === 'loss') {
    return permissions.loss !== false;
  }

  if (intent === 'stock') {
    return permissions.stock !== false;
  }

  return permissions.pog !== false;
}

export default async function handler(request, response) {
  if (handleOptions(request, response)) {
    return;
  }

  if (request.method === 'GET') {
    try {
      // Load only POG/Stock/Loss state, EXCLUDING the heavy master list
      const state = await readSharedState(false); 
      sendJson(response, 200, state);
    } catch (error) {
      sendJson(response, 500, {
        error: error?.message || 'Failed to read shared state.',
      });
    }
    return;
  }

  if (request.method === 'PUT') {
    const auth = await requireAuth(request, response);

    if (!auth) {
      return;
    }

    try {
      const body = await parseRequestBody(request);

      if (!hasModulePermission(auth.user, String(body?.intent || 'pog'))) {
        sendJson(response, 403, { error: 'Forbidden.' });
        return;
      }

      const saved = await writeSharedState(body);
      sendJson(response, 200, saved);
    } catch (error) {
      sendJson(response, 500, {
        error: error?.message || 'Failed to save shared state.',
      });
    }
    return;
  }

  sendJson(response, 405, { error: 'Method not allowed.' });
}
