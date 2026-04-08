import { handleOptions, sendJson } from '../_lib/http.js';

export default async function handler(request, response) {
  if (handleOptions(request, response)) {
    return;
  }

  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Method not allowed.' });
    return;
  }

  sendJson(response, 200, { ok: true });
}
