import stateHandler from '../../api/state.js';
import meHandler from '../../api/auth/me.js';
import loginHandler from '../../api/auth/login.js';
import logoutHandler from '../../api/auth/logout.js';
import usersHandler from '../../api/admin/users.js';
import visualHandler from '../../api/visual.js';
import healthHandler from '../../api/health.js';
import masterHandler from '../../api/master.js';

const apiRoutes = {
  'state': stateHandler,
  'auth/me': meHandler,
  'auth/login': loginHandler,
  'auth/logout': logoutHandler,
  'admin/users': usersHandler,
  'visual': visualHandler,
  'health': healthHandler,
  'master': masterHandler,
};

// Use a simple adapter to convert Node.js (req, res) to Netlify's expected response
export const handler = async (event, context) => {
  const pathParts = event.path.split('/api/')[1];
  const route = pathParts ? pathParts.split('?')[0] : '';
  const handlerFunc = apiRoutes[route];

  if (!handlerFunc) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Not found', path: route }) };
  }

  // Mock Request and Response for our existing handlers
  let responseData = {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: '',
  };

  const req = {
    method: event.httpMethod,
    url: event.path,
    headers: event.headers,
    body: event.body,
    query: event.queryStringParameters,
  };

  const res = {
    status(code) {
      responseData.statusCode = code;
      return this;
    },
    setHeader(key, val) {
      responseData.headers[key] = val;
      return this;
    },
    json(obj) {
      responseData.body = JSON.stringify(obj);
      return this;
    },
    send(data) {
      responseData.body = typeof data === 'string' ? data : JSON.stringify(data);
      return this;
    },
    end() {
       return this;
    }
  };

  try {
    await handlerFunc(req, res);
    return responseData;
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error', message: err.message }),
    };
  }
};
