const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = process.env.PORT || 3000;
const DIST_DIR = path.join(__dirname, 'dist');

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

// Load environment variables from .env file into process.env
require('dotenv').config();

// Import serverless functions
const apiStatus = require('./api/status');
const apiLoad = require('./api/load');
const apiSave = require('./api/save');
const apiImportScraped = require('./api/import-scraped');
const apiAuthLogin = require('./api/auth/login');
const apiAuthLogout = require('./api/auth/logout');
const apiBookmarkPreview = require('./api/bookmark-preview');
const apiCounts = require('./api/counts');
const apiRenameCategory = require('./api/categories/rename');
const { setExtensionCors } = require('./api/lib/extension-auth');

const apiAuthSession = require('./api/auth/session');
const apiDatabaseStatus = require('./api/database/status');
const apiPairStart = require('./api/extension/pair/start');
const apiPairAuthorize = require('./api/extension/pair/authorize');
const apiPairStatus = require('./api/extension/pair/status');
const apiPairCheck = require('./api/extension/pair/check');
const apiPairRevoke = require('./api/extension/pair/revoke');
const apiExtensionDevices = require('./api/extension/devices');
const apiExtensionRevokeAll = require('./api/extension/revoke-all');

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

function sendStaticFile(res, filePath, requestPath, method = 'GET') {
  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const headers = {
      'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
      'Cache-Control': requestPath.startsWith('/assets/')
        ? 'public, max-age=31536000, immutable'
        : 'no-cache'
    };
    res.writeHead(200, headers);
    if (method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(filePath).on('error', () => {
      if (!res.writableEnded) res.end();
    }).pipe(res);
  });
}

function serveFrontend(req, res) {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed.' }));
    return;
  }

  let requestPath;
  try {
    requestPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Invalid URL');
    return;
  }

  const relativePath = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  const candidate = path.resolve(DIST_DIR, relativePath);
  const distRoot = path.resolve(DIST_DIR) + path.sep;
  const isInsideDist = candidate === path.resolve(DIST_DIR) || candidate.startsWith(distRoot);
  if (!isInsideDist) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Invalid path');
    return;
  }

  fs.stat(candidate, (error, stats) => {
    if (!error && stats.isFile()) {
      sendStaticFile(res, candidate, requestPath, req.method);
      return;
    }

    // Hash-based frontend routes still benefit from a normal SPA fallback.
    sendStaticFile(res, path.join(DIST_DIR, 'index.html'), '/', req.method);
  });
}

// Start the server
const server = http.createServer((req, res) => {
  const url = req.url;
  const method = req.method;
  const cleanUrl = url.split('?')[0];

  if (method === 'OPTIONS') {
    if (['/api/import-scraped', '/api/extension/pair/start', '/api/extension/pair/status', '/api/extension/pair/check', '/api/extension/pair/revoke'].includes(cleanUrl)) {
      if (!setExtensionCors(req, res)) { res.writeHead(403); res.end(); return; }
    }
    res.writeHead(200);
    res.end();
    return;
  }

  console.log(`[${new Date().toLocaleTimeString()}] ${method} ${url}`);

  if (cleanUrl === '/healthz' && (method === 'GET' || method === 'HEAD')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    if (method === 'HEAD') res.end();
    else res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  // Route API requests to Serverless functions
  if (cleanUrl === '/api/status') {
    handleServerless(apiStatus, req, res);
    return;
  }
  if (cleanUrl === '/api/database/status') {
    handleServerless(apiDatabaseStatus, req, res);
    return;
  }
  if (cleanUrl === '/api/auth/session') {
    handleServerless(apiAuthSession, req, res);
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
  if (cleanUrl === '/api/extension/pair/start') {
    handleServerless(apiPairStart, req, res);
    return;
  }
  if (cleanUrl === '/api/extension/pair/authorize') {
    handleServerless(apiPairAuthorize, req, res);
    return;
  }
  if (cleanUrl === '/api/extension/pair/status') {
    handleServerless(apiPairStatus, req, res);
    return;
  }
  if (cleanUrl === '/api/extension/pair/check') {
    handleServerless(apiPairCheck, req, res);
    return;
  }
  if (cleanUrl === '/api/extension/pair/revoke') {
    handleServerless(apiPairRevoke, req, res);
    return;
  }
  if (cleanUrl === '/api/extension/devices') {
    handleServerless(apiExtensionDevices, req, res);
    return;
  }
  if (cleanUrl === '/api/extension/revoke-all') {
    handleServerless(apiExtensionRevokeAll, req, res);
    return;
  }
  if (cleanUrl === '/api/counts') {
    handleServerless(apiCounts, req, res);
    return;
  }
  if (cleanUrl === '/api/categories/rename') {
    handleServerless(apiRenameCategory, req, res);
    return;
  }
  if (cleanUrl === '/api/bookmark-preview') {
    handleServerless(apiBookmarkPreview, req, res);
    return;
  }

  if (cleanUrl === '/api' || cleanUrl.startsWith('/api/')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'API endpoint not found.' }));
    return;
  }

  serveFrontend(req, res);
});

server.listen(PORT, '0.0.0.0', () => {
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
