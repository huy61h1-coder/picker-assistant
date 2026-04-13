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
import masterHandler from '../api/master.js';

const apiRoutes = {
  '/api/state': stateHandler,
  '/api/auth/me': meHandler,
  '/api/auth/login': loginHandler,
  '/api/auth/logout': logoutHandler,
  '/api/admin/users': usersHandler,
  '/api/visual': visualHandler,
  '/api/health': healthHandler,
  '/api/master': masterHandler,
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

import zlib from 'node:zlib';
import { promisify } from 'node:util';

const gzip = promisify(zlib.gzip);

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // Handle API
  const apiHandler = apiRoutes[pathname];
  if (apiHandler) {
    try {
      await apiHandler(req, res);
    } catch (err) {
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
    let content = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const acceptEncoding = req.headers['accept-encoding'] || '';

    res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
    
    // Gzip compression for assets larger than 2KB
    if (acceptEncoding.includes('gzip') && content.length > 2048) {
      content = await gzip(content);
      res.setHeader('Content-Encoding', 'gzip');
    }

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
