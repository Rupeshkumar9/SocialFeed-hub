const { requireSession } = require('../lib/auth');
const { getProfile } = require('../lib/public-profile');
const { getUserById, publicUser } = require('../lib/users');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
  if (!requireSession(req, res)) return;
  try {
    const user = await getUserById(req.auth.userId);
    if (!user) return res.status(401).json({ error: 'Session expired.' });
    const { profile } = await getProfile({ userId: req.auth.userId, user });
    const baseProfile = publicUser(user);
    return res.status(200).json({
      authenticated: true,
      profile: {
        ...baseProfile,
        name: baseProfile.displayName,
        displayName: profile?.displayName || baseProfile.displayName,
        username: profile?.username || baseProfile.username,
        avatarUrl: profile?.avatarUrl || ''
      }
    });
  } catch (error) {
    console.error('Unable to load profile metadata for session:', error);
    return res.status(503).json({ error: 'Unable to load account session.' });
  }
};
