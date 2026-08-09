const { setExtensionCors } = require('../../lib/extension-auth');
const { consumePairingStatus } = require('../../lib/extension-pairing');

module.exports = async (req, res) => {
  // Simple extension GETs may omit Origin. The pairingId + secret still
  // protect this endpoint, and no CORS response header is needed without an
  // Origin header. Enforce the allowlist whenever the browser supplies one.
  const allowed = req.headers.origin ? setExtensionCors(req, res) : true;
  if (req.method === 'OPTIONS') return allowed ? res.status(200).end() : res.status(403).json({ error: 'Extension origin not allowed.' });
  if (!allowed) return res.status(403).json({ error: 'Extension origin not allowed.' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
  try {
    const result = await consumePairingStatus(req.query || {});
    if (!result.ok) return res.status(result.status || 400).json({ error: result.error });
    return res.status(200).json(result);
  } catch (error) {
    console.error('Unable to read extension pairing status:', error);
    return res.status(500).json({ error: 'Unable to read pairing status.' });
  }
};
