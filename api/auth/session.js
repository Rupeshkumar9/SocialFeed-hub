const { requireSession } = require('../_lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
  if (!requireSession(req, res)) return;
  return res.status(200).json({
    authenticated: true,
    profile: {
      name: process.env.PROFILE_NAME || 'SocialFeed Owner',
      email: process.env.PROFILE_EMAIL || 'Private account',
      memberSince: process.env.MEMBER_SINCE || 'Private account'
    }
  });
};
