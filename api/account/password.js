const { requireSession } = require('../lib/auth');
const { connectToDatabase } = require('../lib/db');
const { getUserById, hashPassword, verifyPassword } = require('../lib/users');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  if (!requireSession(req, res)) return;

  const body = req.body || {};
  const currentPassword = body.currentPassword;
  const newPassword = body.newPassword;
  if (typeof currentPassword !== 'string' || !currentPassword) {
    return res.status(400).json({ error: 'Enter your current password.' });
  }
  if (typeof newPassword !== 'string' || newPassword.length < 10 || newPassword.length > 128) {
    return res.status(400).json({ error: 'New password must be between 10 and 128 characters.' });
  }
  if (currentPassword === newPassword) return res.status(400).json({ error: 'Choose a password different from your current one.' });

  try {
    const user = await getUserById(req.auth.userId);
    if (!user) return res.status(401).json({ error: 'Session expired.' });
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }
    const db = await connectToDatabase();
    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { passwordHash: await hashPassword(newPassword), updatedAt: new Date() } }
    );
    return res.status(200).json({ updated: true });
  } catch (error) {
    console.error('Unable to change account password:', error);
    return res.status(500).json({ error: 'Unable to change account password.' });
  }
};
