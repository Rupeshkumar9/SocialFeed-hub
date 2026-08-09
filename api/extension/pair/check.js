const { setExtensionCors } = require('../../lib/extension-auth');
const { authorizeExtensionDevice } = require('../../lib/extension-pairing');

module.exports = async (req, res) => {
  const allowed = setExtensionCors(req, res);
  if (req.method === 'OPTIONS') return allowed ? res.status(200).end() : res.status(403).json({ error: 'Extension origin not allowed.' });
  if (!allowed) return res.status(403).json({ error: 'Extension origin not allowed.' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
  try {
    const result = await authorizeExtensionDevice(req);
    return res.status(result.authorized ? 200 : 401).json(result.authorized ? { connected: true, legacy: !!result.legacy } : { connected: false, error: 'Extension is not connected.' });
  } catch (error) {
    console.error('Unable to check extension connection:', error);
    return res.status(503).json({ error: 'Unable to check extension connection.' });
  }
};
