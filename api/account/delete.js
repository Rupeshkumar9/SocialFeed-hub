const { ObjectId } = require('mongodb');
const { clearSessionCookie, requireSession } = require('../lib/auth');
const { connectToDatabase } = require('../lib/db');
const { getUserById } = require('../lib/users');

const DELETE_CONFIRMATION = 'DELETE MY ACCOUNT';

function userIdVariants(userId) {
  const value = String(userId || '');
  const variants = value ? [value] : [];
  if (ObjectId.isValid(value)) variants.push(new ObjectId(value));
  return variants;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  if (!requireSession(req, res)) return;
  if (req.body?.confirmation !== DELETE_CONFIRMATION) {
    return res.status(400).json({ error: `Type ${DELETE_CONFIRMATION} to confirm account deletion.` });
  }

  try {
    const user = await getUserById(req.auth.userId);
    if (!user) return res.status(401).json({ error: 'Session expired.' });
    const db = await connectToDatabase();
    const variants = userIdVariants(req.auth.userId);
    const devices = await db.collection('extension_devices')
      .find({ userId: { $in: variants } }, { projection: { _id: 1 } })
      .toArray();
    const deviceIds = devices.map(device => device._id);

    await Promise.all([
      db.collection('bookmarks').deleteMany({ userId: { $in: variants } }),
      db.collection('public_profiles').deleteMany({ userId: { $in: variants } }),
      db.collection('extension_devices').deleteMany({ userId: { $in: variants } }),
      deviceIds.length
        ? db.collection('extension_pairing_requests').deleteMany({ deviceId: { $in: deviceIds } })
        : Promise.resolve()
    ]);
    await db.collection('users').deleteOne({ _id: user._id });
    res.setHeader('Set-Cookie', clearSessionCookie());
    return res.status(200).json({ deleted: true });
  } catch (error) {
    console.error('Unable to delete account:', error);
    return res.status(500).json({ error: 'Unable to delete account.' });
  }
};

module.exports.DELETE_CONFIRMATION = DELETE_CONFIRMATION;
