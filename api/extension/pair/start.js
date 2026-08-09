const { setExtensionCors } = require('../../lib/extension-auth');
const { createPairingRequest } = require('../../lib/extension-pairing');

module.exports = async (req, res) => {
  const allowed = setExtensionCors(req, res);
  if (req.method === 'OPTIONS') return allowed ? res.status(200).end() : res.status(403).json({ error: 'Extension origin not allowed.' });
  if (!allowed) return res.status(403).json({ error: 'Extension origin not allowed.' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  try {
    return res.status(200).json(await createPairingRequest(req));
  } catch (error) {
    console.error('Unable to start extension pairing:', error);
    return res.status(500).json({ error: 'Unable to start extension pairing.' });
  }
};
