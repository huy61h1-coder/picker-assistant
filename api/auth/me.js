import { handleOptions, requireAuth, sendJson } from '../_lib/http.js';
import { getUserById } from '../_lib/user-store.js';

export default async function handler(request, response) {
  if (handleOptions(request, response)) {
    return;
  }

  if (request.method !== 'GET') {
    sendJson(response, 405, { error: 'Method not allowed.' });
    return;
  }

  const auth = requireAuth(request, response);

  if (!auth) {
    return;
  }

  const freshUser = await getUserById(auth.user?.id);

  if (!freshUser || freshUser.enabled === false) {
    sendJson(response, 401, { error: 'Session expired.' });
    return;
  }

  sendJson(response, 200, {
    user: freshUser,
    expiresAt: new Date(auth.exp).toISOString(),
  });
}
