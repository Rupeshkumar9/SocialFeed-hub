const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3000;

// Load environment variables from .env file into process.env
require('dotenv').config();

// Import serverless functions
const apiStatus = require('./api/status');
const apiLoad = require('./api/load');
const apiSave = require('./api/save');
const apiImportScraped = require('./api/import-scraped');

// MIME Types Map
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Simple wrapper to run Vercel serverless functions in local HTTP server
async function handleServerless(handler, req, res) {
  // 1. Add Express-like Vercel helper methods to res
  res.status = function(code) {
    this.statusCode = code;
    return this;
  };
  
  res.json = function(data) {
    this.setHeader('Content-Type', 'application/json');
    this.end(JSON.stringify(data));
    return this;
  };

  // 2. Parse query parameters
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  req.query = Object.fromEntries(parsedUrl.searchParams);

  // 3. Parse JSON request body
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

  // 4. Call the Vercel handler
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

  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  console.log(`[${new Date().toLocaleTimeString()}] ${method} ${url}`);

  const cleanUrl = url.split('?')[0];

  // Route API requests to Serverless functions
  if (cleanUrl === '/api/status') {
    handleServerless(apiStatus, req, res);
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

  // Static File Server Routing
  let filePath = path.join(__dirname, 'client', cleanUrl === '/' ? 'index.html' : cleanUrl);
  
  // Protect directory traversal attacks
  const relative = path.relative(path.join(__dirname, 'client'), filePath);
  if (relative && relative.startsWith('..')) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Access Denied');
    return;
  }

  // Get file extension
  const ext = path.extname(filePath).toLowerCase();
  let contentType = MIME_TYPES[ext] || 'application/octet-stream';

  // Read file and serve
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Page not found, fallback to index.html
        fs.readFile(path.join(__dirname, 'client', 'index.html'), (e, fallbackContent) => {
          if (e) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('File Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(fallbackContent);
          }
        });
      } else {
        // Server error
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// Start listening
server.listen(PORT, () => {
  console.log('\n======================================================');
  console.log('✨  SOCIAL BOOKMARKS FEED - UNIFIED BACKEND RUNNER  ✨');
  console.log('======================================================');
  console.log(`\n🚀 Dev Server running at: \x1b[36mhttp://localhost:${PORT}\x1b[0m`);
  console.log('🔌 Running your deployment APIs locally connected to MongoDB Atlas & Cloudinary!');
  console.log('\n------------------------------------------------------');
  console.log('🔒 Security protection is active locally. Enter the');
  console.log('   ADMIN_PASSWORD defined in your .env to save/edit.');
  console.log('======================================================\n');

  // Auto-launch the web page in the default browser
  const url = `http://localhost:${PORT}`;
  let startCommand = '';
  
  if (process.platform === 'win32') {
    startCommand = `start ${url}`;
  } else if (process.platform === 'darwin') {
    startCommand = `open ${url}`;
  } else {
    startCommand = `xdg-open ${url}`;
  }
  
  exec(startCommand, (err) => {
    if (err) {
      console.log('Please open the URL manually in your preferred browser!');
    } else {
      console.log('👉 Automatically opened Dashboard page in your browser.');
    }
  });
});
