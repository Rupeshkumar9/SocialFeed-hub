const http = require('http');
const PORT = process.env.PORT || 3000;

// Load environment variables from .env file into process.env
require('dotenv').config();

// Import serverless functions
const apiStatus = require('./api/status');
const apiLoad = require('./api/load');
const apiSave = require('./api/save');
const apiImportScraped = require('./api/import-scraped');
const apiAuthLogin = require('./api/auth-login');
const apiAuthLogout = require('./api/auth-logout');
const apiBookmarkPreview = require('./api/bookmark-preview');
const apiCounts = require('./api/counts');
const { setExtensionCors } = require('./api/lib/extension-auth');

// Try importing nested route handlers if present
let apiAuthSession, apiDatabaseStatus;
try { apiAuthSession = require('./api/auth/session'); } catch (e) {}
try { apiDatabaseStatus = require('./api/database/status'); } catch (e) {}

// Simple wrapper to run Vercel serverless functions in local HTTP server
async function handleServerless(handler, req, res) {
  res.status = function(code) {
    this.statusCode = code;
    return this;
  };
  
  res.json = function(data) {
    this.setHeader('Content-Type', 'application/json');
    this.end(JSON.stringify(data));
    return this;
  };

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  req.query = Object.fromEntries(parsedUrl.searchParams);

  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    let bodyData = '';
    req.on('data', chunk => {
      bodyData += chunk.toString();
    });
    
    await new Promise((resolve) => {
      req.on('end', () => {
        if (bodyData && req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
          try {
            req.body = JSON.parse(bodyData);
          } catch (e) {
            console.error('Failed to parse body JSON:', e);
            req.body = null;
          }
        } else {
          req.body = bodyData;
        }
        resolve();
      });
    });
  }

  try {
    await handler(req, res);
  } catch (err) {
    console.error('Serverless execution error:', err);
    if (!res.writableEnded) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Server Error', details: err.message }));
    }
  }
}

// Start the server
const server = http.createServer((req, res) => {
  const url = req.url;
  const method = req.method;
  const cleanUrl = url.split('?')[0];

  if (method === 'OPTIONS') {
    if (cleanUrl === '/api/import-scraped') {
      if (!setExtensionCors(req, res)) { res.writeHead(403); res.end(); return; }
    }
    res.writeHead(200);
    res.end();
    return;
  }

  console.log(`[${new Date().toLocaleTimeString()}] ${method} ${url}`);

  // Route API requests to Serverless functions
  if (cleanUrl === '/api/status') {
    handleServerless(apiStatus, req, res);
    return;
  }
  if (cleanUrl === '/api/database/status') {
    handleServerless(apiDatabaseStatus || apiStatus, req, res);
    return;
  }
  if (cleanUrl === '/api/auth/session') {
    if (apiAuthSession) {
      handleServerless(apiAuthSession, req, res);
    } else {
      handleServerless(apiStatus, req, res);
    }
    return;
  }
  if (cleanUrl === '/api/auth/login' || cleanUrl === '/api/auth-login') {
    handleServerless(apiAuthLogin, req, res);
    return;
  }
  if (cleanUrl === '/api/auth/logout' || cleanUrl === '/api/auth-logout') {
    handleServerless(apiAuthLogout, req, res);
    return;
  }
  if (cleanUrl === '/api/load') {
    handleServerless(apiLoad, req, res);
    return;
  }
  if (cleanUrl === '/api/save') {
    handleServerless(apiSave, req, res);
    return;
  }
  if (cleanUrl === '/api/import-scraped') {
    handleServerless(apiImportScraped, req, res);
    return;
  }
  if (cleanUrl === '/api/counts') {
    handleServerless(apiCounts, req, res);
    return;
  }
  if (cleanUrl === '/api/bookmark-preview') {
    handleServerless(apiBookmarkPreview, req, res);
    return;
  }

  // Non-API route fallback
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'API endpoint not found. Use Vite server at http://localhost:5173 for web app UI.' }));
});

server.listen(PORT, () => {
  console.log('\n======================================================');
  console.log('✨  SOCIAL BOOKMARKS FEED - UNIFIED BACKEND RUNNER  ✨');
  console.log('======================================================');
  console.log(`\n🚀 API Dev Server running at: \x1b[36mhttp://localhost:${PORT}\x1b[0m`);
  console.log('⚡ Handling /api/* requests for local dev and Vite proxying.');
  console.log('🔌 Running your deployment APIs locally connected to MongoDB Atlas & Cloudinary!');
  console.log('\n------------------------------------------------------');
  console.log('🔒 Security protection is active locally. Enter the');
  console.log('   ADMIN_PASSWORD defined in your .env to save/edit.');
  console.log('======================================================\n');
});
