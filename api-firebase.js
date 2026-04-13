import { onRequest } from "firebase-functions/v2/https";
import stateHandler from './api/state.js';
import meHandler from './api/auth/me.js';
import loginHandler from './api/auth/login.js';
import logoutHandler from './api/auth/logout.js';
import usersHandler from './api/admin/users.js';
import visualHandler from './api/visual.js';
import healthHandler from './api/health.js';

const apiRoutes = {
  '/api/state': stateHandler,
  '/api/auth/me': meHandler,
  '/api/auth/login': loginHandler,
  '/api/auth/logout': logoutHandler,
  '/api/admin/users': usersHandler,
  '/api/visual': visualHandler,
  '/api/health': healthHandler,
};

export const api = onRequest({ 
  region: "asia-southeast1",
  memory: "1GiB",
  timeoutSeconds: 300,
  cpu: 1
}, async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // Firebase Functions often strip the function name from path or not, 
  // ensure we match regardless of /api prefix
  const handler = apiRoutes[pathname] || apiRoutes[`/api${pathname}`] || apiRoutes[pathname.replace('/api', '')];

  if (handler) {
    try {
      await handler(req, res);
    } catch (err) {
      res.status(500).json({ error: 'Internal Error', message: err.message });
    }
  } else {
    res.status(404).json({ error: 'Route not found', path: pathname });
  }
});
