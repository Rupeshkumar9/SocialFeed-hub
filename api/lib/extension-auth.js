const crypto = require('crypto');

function isExtensionAuthorized(req) {
  const expected = process.env.EXTENSION_SYNC_TOKEN || '';
  const token = req.headers['x-extension-token'] || '';
  return !!expected && typeof token === 'string' && token.length === expected.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

function setExtensionCors(req, res) {
  const origin = String(req.headers.origin || '').trim();
  const normalizedOrigin = origin.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\/+$/, '').toLowerCase();
  const configured = (process.env.EXTENSION_ALLOWED_ORIGINS || '')
    .split(',')
    .map(value => value
      .trim()
      .replace(/^['"]|['"]$/g, '')
      .replace(/^extension_allowed_origins\s*=\s*/i, '')
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .replace(/[\s\u200b\u200c\u200d\ufeff]+/g, '')
      .replace(/\/+$/, '')
      .toLowerCase())
    .filter(Boolean)
    .flatMap(value => {
      // Accept both full origins and pasted bare extension IDs. Always retain
      // the original value, then add canonical forms for either ID format.
      const bareId = value.replace(/^(?:chrome|moz)-extension:\/\//i, '');
      return [value, `chrome-extension://${bareId}`, `moz-extension://${bareId}`];
    });
  const isBrowserExtension = normalizedOrigin.startsWith('chrome-extension://') || normalizedOrigin.startsWith('moz-extension://');
  const allowed = configured.includes(normalizedOrigin) || (!configured.length && isBrowserExtension);
  if (!allowed) console.warn(`[Extension CORS] denied origin: ${origin || '(missing)'}; configured origins: ${configured.join(', ') || '(none)'}`);
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Extension-Token');
  }
  return allowed;
}

module.exports = { isExtensionAuthorized, setExtensionCors };
