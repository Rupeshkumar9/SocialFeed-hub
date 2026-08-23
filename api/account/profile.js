const { ObjectId } = require('mongodb');
const { requireSession } = require('../lib/auth');
const { connectToDatabase } = require('../lib/db');
const {
  getUserByEmail,
  getUserById,
  isValidEmail,
  normalizeEmail,
  publicUser
} = require('../lib/users');

function userIdVariants(userId) {
  const value = String(userId || '');
  const variants = value ? [value] : [];
  if (ObjectId.isValid(value)) variants.push(new ObjectId(value));
  return variants;
}

module.exports = async (req, res) => {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed.' });
  if (!requireSession(req, res)) return;

  const body = req.body || {};
  const displayName = String(body.displayName || '').trim().slice(0, 80);
  const email = normalizeEmail(body.email);
  if (!displayName) return res.status(400).json({ error: 'Name is required.' });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });

  try {
    const db = await connectToDatabase();
    const currentUser = await getUserById(req.auth.userId);
    if (!currentUser) return res.status(401).json({ error: 'Session expired.' });

    if (email !== normalizeEmail(currentUser.email)) {
      const owner = await getUserByEmail(email);
      if (owner && String(owner._id) !== String(currentUser._id)) {
        return res.status(409).json({ error: 'That email address is already in use.' });
      }
    }

    await db.collection('users').updateOne(
      { _id: currentUser._id },
      { $set: { displayName, email, emailLower: email, updatedAt: new Date() } }
    );
    await db.collection('public_profiles').updateMany(
      { userId: { $in: userIdVariants(req.auth.userId) } },
      { $set: { displayName, updatedAt: new Date().toISOString() } }
    );

    return res.status(200).json({
      profile: publicUser({ ...currentUser, displayName, email, emailLower: email })
    });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ error: 'That email address is already in use.' });
    console.error('Unable to update account profile:', error);
    return res.status(500).json({ error: 'Unable to update account profile.' });
  }
};
