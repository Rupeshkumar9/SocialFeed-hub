const crypto = require('crypto');

function isExtensionAuthorized(req) {
  const expected = process.env.EXTENSION_SYNC_TOKEN || '';
  const token = req.headers['x-extension-token'] || '';
  return !!expected && typeof token === 'string' && token.length === expected.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

function setExtensionCors(req, res) {
  const origin = req.headers.origin || '';
  const configured = (process.env.EXTENSION_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
  const isBrowserExtension = origin.startsWith('chrome-extension://') || origin.startsWith('moz-extension://');
  const allowed = configured.includes(origin) || (!configured.length && isBrowserExtension);
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Extension-Token');
  }
  return allowed;
}

module.exports = { isExtensionAuthorized, setExtensionCors };
