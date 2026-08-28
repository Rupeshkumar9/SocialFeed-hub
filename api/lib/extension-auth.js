const crypto = require('crypto');

function isExtensionAuthorized(req) {
  const expected = process.env.EXTENSION_SYNC_TOKEN || '';
  const token = req.headers['x-extension-token'] || '';
  return !!expected && typeof token === 'string' && token.length === expected.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

const BROWSER_EXTENSION_ORIGIN = /^(?:chrome-extension|moz-extension|safari-web-extension):\/\/[a-z0-9](?:[a-z0-9._-]{0,254})$/i;

function normalizeExtensionOrigin(value) {
  const origin = String(value || '').trim();
  if (/[\u0000-\u001f\u007f]/.test(origin)) return '';
  return origin
    .replace(/\/+$/, '')
    .toLowerCase();
}

function isBrowserExtensionOrigin(value) {
  return BROWSER_EXTENSION_ORIGIN.test(normalizeExtensionOrigin(value));
}

function setExtensionCors(req, res) {
  const origin = String(req.headers.origin || '').trim();
  // Browser-assigned extension IDs are different between stores, browsers,
  // profiles, and temporary Firefox installs. CORS therefore validates the
  // extension URL shape, while pairing + the per-device bearer token proves
  // that the caller was approved by a signed-in SocialFeed user.
  const allowed = isBrowserExtensionOrigin(origin);
  if (!allowed) console.warn(`[Extension CORS] denied non-extension origin: ${origin || '(missing)'}`);
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Extension-Token');
  }
  return allowed;
}

module.exports = {
  isBrowserExtensionOrigin,
  isExtensionAuthorized,
  normalizeExtensionOrigin,
  setExtensionCors
};
