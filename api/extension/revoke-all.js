const { requireSession } = require('../lib/auth');
const { revokeAllExtensionDevices } = require('../lib/extension-pairing');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  if (!requireSession(req, res)) return;
  try {
    return res.status(200).json({ revoked: await revokeAllExtensionDevices(req.auth.userId) });
  } catch (error) {
    console.error('Unable to revoke extension devices:', error);
    return res.status(503).json({ error: 'Unable to disconnect extensions.' });
  }
};
