import { handleOptions, parseRequestBody, requireAuth, sendJson } from './_lib/http.js';
import { readSharedVisual, writeSharedVisual } from './_lib/state-store.js';

function getVisualKey(request) {
  try {
    const requestUrl = new URL(request.url, 'http://localhost');
    return String(requestUrl.searchParams.get('key') || '').trim();
  } catch {
    return '';
  }
}

export default async function handler(request, response) {
  if (handleOptions(request, response)) {
    return;
  }

  const key = getVisualKey(request);

  if (!key) {
    sendJson(response, 400, { error: 'Visual key is required.' });
    return;
  }

  if (request.method === 'GET') {
    try {
      const visual = await readSharedVisual(key);

      if (!visual) {
        sendJson(response, 404, { error: 'Visual not found.' });
        return;
      }

      sendJson(response, 200, { key, visual });
    } catch (error) {
      sendJson(response, 500, {
        error: error?.message || 'Failed to read visual.',
      });
    }
    return;
  }

  if (request.method === 'PUT') {
    const auth = await requireAuth(request, response);

    if (!auth) {
      return;
    }

    if (auth.user?.role !== 'admin' && auth.user?.permissions?.pog === false) {
      sendJson(response, 403, { error: 'Forbidden.' });
      return;
    }

    try {
      const body = await parseRequestBody(request);
      const savedVisual = await writeSharedVisual(key, body?.visual || body);
      sendJson(response, 200, { key, visual: savedVisual });
    } catch (error) {
      sendJson(response, 500, {
        error: error?.message || 'Failed to save visual.',
      });
    }
    return;
  }

  sendJson(response, 405, { error: 'Method not allowed.' });
}
