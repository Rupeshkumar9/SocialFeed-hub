const { createSessionToken, sessionCookie } = require('../lib/auth');
const { ensureUserIndexes, getUserByEmail, normalizeEmail, publicUser, verifyPassword } = require('../lib/users');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  const email = req.body && req.body.email;
  const password = req.body && req.body.password;
  await ensureUserIndexes();
  const user = await getUserByEmail(normalizeEmail(email));
  if (!user || !(await verifyPassword(password, user.passwordHash))) return res.status(401).json({ error: 'Invalid email or password.' });
  res.setHeader('Set-Cookie', sessionCookie(createSessionToken(user._id)));
  return res.status(200).json({
    authenticated: true,
    profile: publicUser(user)
  });
};
