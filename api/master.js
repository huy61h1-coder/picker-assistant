import { handleOptions, requireAuth, sendJson } from './_lib/http.js';
import { readMasterProducts } from './_lib/state-store.js';

export default async function handler(request, response) {
  if (handleOptions(request, response)) return;

  if (request.method !== 'GET') {
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }

  const auth = await requireAuth(request, response);
  if (!auth) return;

  try {
    const products = await readMasterProducts();
    sendJson(response, 200, products);
  } catch (error) {
    sendJson(response, 500, {
      error: error?.message || 'Failed to load master products.',
    });
  }
}
