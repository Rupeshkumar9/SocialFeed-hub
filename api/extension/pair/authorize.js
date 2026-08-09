const { requireSession } = require('../../lib/auth');
const { authorizePairing } = require('../../lib/extension-pairing');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  if (!requireSession(req, res)) return;
  try {
    const result = await authorizePairing(req.body, req);
    return res.status(result.status || (result.ok ? 200 : 400)).json(result.ok ? { status: 'authorized' } : { error: result.error });
  } catch (error) {
    console.error('Unable to authorize extension pairing:', error);
    return res.status(500).json({ error: 'Unable to connect the extension.' });
  }
};
