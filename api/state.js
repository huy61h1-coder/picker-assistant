import { handleOptions, parseRequestBody, requireAuth, sendJson } from './_lib/http.js';
import { readSharedState, writeSharedState } from './_lib/state-store.js';

export default async function handler(request, response) {
  if (handleOptions(request, response)) {
    return;
  }

  if (request.method === 'GET') {
    try {
      const state = await readSharedState();
      sendJson(response, 200, state);
    } catch (error) {
      sendJson(response, 500, {
        error: error?.message || 'Failed to read shared state.',
      });
    }
    return;
  }

  if (request.method === 'PUT') {
    const auth = requireAuth(request, response);

    if (!auth) {
      return;
    }

    try {
      const body = await parseRequestBody(request);
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
