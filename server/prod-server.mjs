import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../dist');

// API handlers
import stateHandler from '../api/state.js';
import meHandler from '../api/auth/me.js';
import loginHandler from '../api/auth/login.js';
import logoutHandler from '../api/auth/logout.js';
import usersHandler from '../api/admin/users.js';
import visualHandler from '../api/visual.js';
import healthHandler from '../api/health.js';

const apiRoutes = {
  '/api/state': stateHandler,
  '/api/auth/me': meHandler,
  '/api/auth/login': loginHandler,
  '/api/auth/logout': logoutHandler,
  '/api/admin/users': usersHandler,
  '/api/visual': visualHandler,
  '/api/health': healthHandler,
};

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mjs': 'text/javascript',
  '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  console.log(`[${new Date().toISOString()}] ${req.method} ${pathname}`);

  // Handle API
  // Vercel can also have routes with query params, ensure we match correctly
  const apiHandler = apiRoutes[pathname];
  if (apiHandler) {
    try {
      await apiHandler(req, res);
    } catch (err) {
      console.error('API Error:', err);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Internal Server Error', message: err.message }));
    }
    return;
  }

  // Handle Static
  let filePath = path.join(distDir, pathname === '/' ? 'index.html' : pathname);
  
  try {
    const stats = await fs.stat(filePath);
    if (stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
  } catch {
    // SPA fallback: if it's not an API call and file doesn't exist, serve index.html
    if (!pathname.startsWith('/api/')) {
        filePath = path.join(distDir, 'index.html');
    } else {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Not Found' }));
        return;
    }
  }

  try {
    const content = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
    res.end(content);
  } catch (err) {
    res.statusCode = 404;
    res.end('Not Found');
  }
});

const port = process.env.PORT || 8080;
server.listen(port, '0.0.0.0', () => {
  console.log(`Production server running on http://0.0.0.0:${port}`);
});
