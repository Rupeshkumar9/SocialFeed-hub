const crypto = require('crypto');

function isExtensionAuthorized(req) {
  const expected = process.env.EXTENSION_SYNC_TOKEN || '';
  const token = req.headers['x-extension-token'] || '';
  return !!expected && typeof token === 'string' && token.length === expected.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

function setExtensionCors(req, res) {
  const origin = String(req.headers.origin || '').trim();
  const normalizedOrigin = origin.replace(/\/+$/, '').toLowerCase();
  const configured = (process.env.EXTENSION_ALLOWED_ORIGINS || '')
    .split(',')
    .map(value => value.trim().replace(/\/+$/, '').toLowerCase())
    .filter(Boolean)
    .flatMap(value => {
      // Accept both the documented origin form and a pasted bare extension ID.
      if (value.includes('://')) return [value];
      return [`chrome-extension://${value}`, `moz-extension://${value}`];
    });
  const isBrowserExtension = normalizedOrigin.startsWith('chrome-extension://') || normalizedOrigin.startsWith('moz-extension://');
  const allowed = configured.includes(normalizedOrigin) || (!configured.length && isBrowserExtension);
  if (!allowed) console.warn(`[Extension CORS] denied origin: ${origin || '(missing)'}`);
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Extension-Token');
  }
  return allowed;
}

module.exports = { isExtensionAuthorized, setExtensionCors };
