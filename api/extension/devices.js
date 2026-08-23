const { requireSession } = require('../lib/auth');
const { listExtensionDevices } = require('../lib/extension-pairing');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
  if (!requireSession(req, res)) return;
  try {
    const devices = await listExtensionDevices(req.auth.userId);
    return res.status(200).json({ devices: devices.map(device => ({
      id: device._id.toString(),
      label: device.label,
      createdAt: device.createdAt,
      lastUsedAt: device.lastUsedAt,
      expiresAt: device.expiresAt || null
    })) });
  } catch (error) {
    console.error('Unable to list extension devices:', error);
    return res.status(503).json({ error: 'Unable to load extension connections.' });
  }
};
