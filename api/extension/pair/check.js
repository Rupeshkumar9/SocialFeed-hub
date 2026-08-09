const { setExtensionCors } = require('../../lib/extension-auth');
const { authorizeExtensionDevice } = require('../../lib/extension-pairing');

module.exports = async (req, res) => {
  const origin = String(req.headers.origin || '').trim();
  // Some extension GET requests omit Origin. The bearer/device token still
  // authenticates this read-only check, and no CORS header is needed when the
  // request has no browser origin.
  const allowed = setExtensionCors(req, res) || (req.method === 'GET' && !origin);
  if (req.method === 'OPTIONS') return allowed ? res.status(200).end() : res.status(403).json({ error: 'Extension origin not allowed.' });
  if (!allowed) return res.status(403).json({ error: 'Extension origin not allowed.' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
  res.setHeader('Cache-Control', 'no-store');
  try {
    const result = await authorizeExtensionDevice(req);
    return res.status(result.authorized ? 200 : 401).json(result.authorized ? { connected: true, legacy: !!result.legacy } : { connected: false, error: 'Extension is not connected.' });
  } catch (error) {
    console.error('Unable to check extension connection:', error);
    return res.status(503).json({ error: 'Unable to check extension connection.' });
  }
};
