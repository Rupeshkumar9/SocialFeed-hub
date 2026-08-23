const express = require('express');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

// Load environment variables before reading the port for local development.
require('dotenv').config();

const PORT = process.env.PORT || 3000;
const DIST_DIR = path.join(__dirname, 'dist');
const ASTRO_DIST_DIR = path.join(DIST_DIR, 'astro');
const ASTRO_CLIENT_DIR = path.join(ASTRO_DIST_DIR, 'client');
const ASTRO_SERVER_ENTRY = path.join(ASTRO_DIST_DIR, 'server', 'entry.mjs');
const app = express();
let astroHandler = null;

app.disable('x-powered-by');

// Existing imports are CommonJS request handlers. They intentionally remain
// unchanged; Express is only replacing the old HTTP transport wrapper.
const apiStatus = require('./api/status');
const apiLoad = require('./api/load');
const apiSave = require('./api/save');
const apiImportScraped = require('./api/import-scraped');
const apiAuthLogin = require('./api/auth/login');
const apiAuthSignup = require('./api/auth/signup');
const apiAuthLogout = require('./api/auth/logout');
const apiAccountProfile = require('./api/account/profile');
const apiAccountPassword = require('./api/account/password');
const apiAccountDelete = require('./api/account/delete');
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
const apiPublicProfile = require('./api/public-profile');
const apiPublicBookmarks = require('./api/public-bookmarks');
const apiPublicProfileSettings = require('./api/public-profile-settings');
const apiBookmarkVisibility = require('./api/bookmark-visibility');
const { isAuthenticated } = require('./api/lib/auth');

const extensionCorsRoutes = new Set([
  '/api/import-scraped',
  '/api/extension/pair/start',
  '/api/extension/pair/status',
  '/api/extension/pair/check',
  '/api/extension/pair/revoke'
]);

// Import and extension payloads can be larger than ordinary profile JSON.
// Keep one explicit, bounded parser until route-specific parsers are added.
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '25mb' }));

// Preserve the old preflight behavior. Extension handlers still apply their
// own narrow allowlist and response headers for non-preflight requests.
app.use((req, res, next) => {
  if (req.method !== 'OPTIONS') return next();
  if (extensionCorsRoutes.has(req.path) && !setExtensionCors(req, res)) {
    return res.status(403).end();
  }
  return res.status(200).end();
});

function mount(method, route, handler) {
  app[method](route, async (req, res, next) => {
    try {
      await handler(req, res);
    } catch (error) {
      next(error);
    }
  });
}

// Health check stays outside the API namespace for Render.
app.get('/healthz', (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (req.method === 'HEAD') return res.status(200).end();
  return res.status(200).json({ status: 'ok' });
});

// Existing route contract. Keep aliases used by older frontend/extension
// versions during the transport migration.
mount('get', '/api/status', apiStatus);
mount('get', '/api/database/status', apiDatabaseStatus);
mount('get', '/api/auth/session', apiAuthSession);
mount('post', '/api/auth/login', apiAuthLogin);
mount('post', '/api/auth-login', apiAuthLogin);
mount('post', '/api/auth/signup', apiAuthSignup);
mount('post', '/api/auth-signup', apiAuthSignup);
mount('post', '/api/auth/logout', apiAuthLogout);
mount('post', '/api/auth-logout', apiAuthLogout);
mount('patch', '/api/account/profile', apiAccountProfile);
mount('post', '/api/account/password', apiAccountPassword);
mount('post', '/api/account/delete', apiAccountDelete);
mount('get', '/api/load', apiLoad);
mount('post', '/api/save', apiSave);
mount('post', '/api/import-scraped', apiImportScraped);
mount('get', '/api/counts', apiCounts);
mount('post', '/api/categories/rename', apiRenameCategory);
mount('post', '/api/bookmark-preview', apiBookmarkPreview);
mount('get', '/api/extension/devices', apiExtensionDevices);
mount('post', '/api/extension/revoke-all', apiExtensionRevokeAll);
mount('post', '/api/extension/pair/start', apiPairStart);
mount('post', '/api/extension/pair/authorize', apiPairAuthorize);
mount('get', '/api/extension/pair/status', apiPairStatus);
mount('get', '/api/extension/pair/check', apiPairCheck);
mount('post', '/api/extension/pair/revoke', apiPairRevoke);

// Public-profile and sharing routes use the same Express transport while
// keeping their validation/data work in dedicated handler modules.
mount('get', '/api/public-profile', apiPublicProfile);
mount('get', '/api/public-bookmarks', apiPublicBookmarks);
mount('get', '/api/public-profile-settings', apiPublicProfileSettings);
mount('put', '/api/public-profile-settings', apiPublicProfileSettings);
mount('patch', '/api/bookmark-visibility', apiBookmarkVisibility);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

const PRIVATE_PAGE_PATH = /^\/dashboard(?:\/|$)/;
const NOINDEX_PAGE_PATH = /^(?:\/dashboard|\/login|\/signup)(?:\/|$)/;

// Page-level authorization is enforced before Astro renders any private
// dashboard HTML. API authorization remains independently enforced by the
// existing handlers above.
app.use((req, res, next) => {
  if (NOINDEX_PAGE_PATH.test(req.path)) {
    res.set('X-Robots-Tag', 'noindex, nofollow');
  }
  if (!PRIVATE_PAGE_PATH.test(req.path) || !['GET', 'HEAD'].includes(req.method)) return next();
  if (isAuthenticated(req)) return next();
  const returnTo = `${req.path}${req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : ''}`;
  return res.redirect(302, `/login?returnTo=${encodeURIComponent(returnTo)}`);
});

function staticHeaders(res, filePath) {
  if (filePath.includes(`${path.sep}assets${path.sep}`) || filePath.includes(`${path.sep}_astro${path.sep}`)) {
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
  } else {
    res.set('Cache-Control', 'no-cache');
  }
}

// Astro's generated client assets are mounted before the SSR handler so
// hashed scripts, styles, sitemap files, and public assets are cacheable.
if (fs.existsSync(ASTRO_CLIENT_DIR)) {
  app.use(express.static(ASTRO_CLIENT_DIR, { index: false, setHeaders: staticHeaders }));
}

const RESERVED_TOP_LEVEL_PATHS = new Set([
  'api', 'assets', 'auth', 'login', 'logout', 'settings', 'admin',
  'extension-connect', 'healthz', 'favicon', 'index', 'public-profile',
  'pricing', 'blog', 'dashboard', 'signup', 'u'
]);
const USERNAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,29}$/;

function isPublicProfilePath(value) {
  const slug = String(value || '');
  return USERNAME_PATTERN.test(slug) && !RESERVED_TOP_LEVEL_PATHS.has(slug.toLowerCase());
}

// Keep old public-profile links working while giving Astro a collision-safe
// canonical route at /u/:username.
app.get('/:username', (req, res, next) => {
  if (!isPublicProfilePath(req.params.username)) return next();
  return res.redirect(301, `/u/${encodeURIComponent(req.params.username)}`);
});

// Astro is loaded asynchronously before the production listener starts. The
// middleware slot owns all frontend page routes after API and auth guards.
app.use((req, res, next) => {
  if (!astroHandler) return next();
  return Promise.resolve(astroHandler(req, res, next)).catch(next);
});

app.use((req, res) => {
});

// Express catches parser errors and rejected handler promises here. Do not
// expose stack traces or database details to clients in production.
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error?.type === 'entity.parse.failed' || error instanceof SyntaxError) {
    return res.status(400).json({ error: 'Invalid JSON request body.' });
  }
  console.error('Unhandled server error:', error);
  return res.status(500).json({ error: 'Internal Server Error' });
});

async function loadAstroHandler() {
  if (!fs.existsSync(ASTRO_SERVER_ENTRY)) {
    console.warn('Astro build not found; frontend page routes will return 404. Run npm run build before production start.');
    return false;
  }
  try {
    const module = await import(pathToFileURL(ASTRO_SERVER_ENTRY).href);
    astroHandler = module.handler || module.default || null;
    if (typeof astroHandler !== 'function') throw new Error('Astro server entry did not export a handler.');
    console.log('Astro SSR middleware loaded.');
    return true;
  } catch (error) {
    console.error('Unable to load Astro SSR middleware:', error);
    return false;
  }
}

if (require.main === module) {
  loadAstroHandler().finally(() => app.listen(PORT, '0.0.0.0', () => {
    console.log('\n======================================================');
    console.log('✨  SOCIAL BOOKMARKS FEED - EXPRESS SERVER  ✨');
    console.log('======================================================');
    console.log(`\n🚀 Persistent Node server running on port ${PORT}`);
    console.log('⚡ Serving Express API routes and the built frontend.');
    console.log('🔌 Connected API handlers remain backed by MongoDB Atlas & Cloudinary.');
  }));
}

module.exports = app;
