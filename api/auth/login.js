const { createSessionToken, hasValidEmail, hasValidPassword, sessionCookie } = require('../_lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  const email = req.body && req.body.email;
  const password = req.body && req.body.password;
  if (!process.env.PROFILE_EMAIL || !process.env.ADMIN_PASSWORD) return res.status(503).json({ error: 'Authentication is not configured.' });
  if (!hasValidEmail(email) || !hasValidPassword(password)) return res.status(401).json({ error: 'Invalid email or password.' });
  res.setHeader('Set-Cookie', sessionCookie(createSessionToken()));
  return res.status(200).json({
    authenticated: true,
    profile: {
      name: process.env.PROFILE_NAME || 'SocialFeed Owner',
      email: process.env.PROFILE_EMAIL || 'Private account',
      memberSince: process.env.MEMBER_SINCE || 'Private account'
    }
  });
};
