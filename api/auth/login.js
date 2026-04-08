import { issueAuthToken } from '../_lib/auth-token.js';
import { handleOptions, parseRequestBody, sendJson } from '../_lib/http.js';
import { verifyCredentials } from '../_lib/user-store.js';

export default async function handler(request, response) {
  if (handleOptions(request, response)) {
    return;
  }

  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Method not allowed.' });
    return;
  }

  const body = await parseRequestBody(request);
  const username = String(body?.username || '')
    .trim()
    .toLowerCase();
  const password = String(body?.password || '');

  if (!username || !password) {
    sendJson(response, 400, { error: 'Username and password are required.' });
    return;
  }

  const result = await verifyCredentials(username, password);

  if (!result) {
    sendJson(response, 401, { error: 'Sai tai khoan hoac mat khau.' });
    return;
  }

  if (result?.error) {
    sendJson(response, 403, { error: result.error });
    return;
  }

  const session = issueAuthToken(result.user);
  sendJson(response, 200, session);
}
