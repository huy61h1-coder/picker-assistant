import stateHandler from '../../api/state.js';
import meHandler from '../../api/auth/me.js';
import loginHandler from '../../api/auth/login.js';
import logoutHandler from '../../api/auth/logout.js';
import usersHandler from '../../api/admin/users.js';
import visualHandler from '../../api/visual.js';
import healthHandler from '../../api/health.js';
import masterHandler from '../../api/master.js';

const apiRoutes = {
  'api/state': stateHandler,
  'api/auth/me': meHandler,
  'api/auth/login': loginHandler,
  'api/auth/logout': logoutHandler,
  'api/admin/users': usersHandler,
  'api/visual': visualHandler,
  'api/health': healthHandler,
  'api/master': masterHandler,
};

export async function onRequest(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/^\/+/, ''); // remove leading slash
  
  const handlerFunc = apiRoutes[pathname];
  if (!handlerFunc) {
     return new Response(JSON.stringify({ error: 'Not found', path: pathname }), { 
       status: 404, 
       headers: { 'Content-Type': 'application/json' } 
     });
  }

  // Bridging: Cloudflare Fetch Request to Node.js-like Request
  // and Mocking Response
  let responseMeta = {
    status: 200,
    headers: new Headers({ 'Content-Type': 'application/json' }),
    body: ''
  };

  // Universal Environment Injection
  if (typeof process === 'undefined' || !process.env) {
    globalThis.process = globalThis.process || {};
    globalThis.process.env = { ...env };
  } else {
    // Merge Cloudflare env into process.env if it exists
    Object.assign(process.env, env);
  }

  const nodeRequest = {
    method: request.method,
    url: url.pathname + url.search,
    headers: Object.fromEntries(request.headers),
    // For body, our handlers assume it's already parsed if JSON or use streams (not handled yet)
    // Most of our handlers expect JSON if it's a POST
    body: request.method === 'POST' ? await request.json().catch(() => ({})) : {},
    query: Object.fromEntries(url.searchParams),
    env: env // inject env for Cloudflare
  };

  const nodeResponse = {
    status(code) {
      responseMeta.status = code;
      return this;
    },
    setHeader(key, val) {
      responseMeta.headers.set(key, val);
      return this;
    },
    json(obj) {
      responseMeta.body = JSON.stringify(obj);
      return this;
    },
    send(data) {
      responseMeta.body = typeof data === 'string' ? data : JSON.stringify(data);
      return this;
    },
    end(data) {
      if (data) this.send(data);
      return this;
    }
  };

  // Override process.env globally (dirty but works for simple apps in Workers)
  // Or better: ensure our _lib logic fallbacks to nodeRequest.env
  // Actually, we'll just rely on the fallback I'll add to state-store.js
  
  try {
    await handlerFunc(nodeRequest, nodeResponse);
    return new Response(responseMeta.body, {
      status: responseMeta.status,
      headers: responseMeta.headers
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Worker Error', message: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
