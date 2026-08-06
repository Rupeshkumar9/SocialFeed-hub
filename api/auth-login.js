const { createSessionToken, hasValidPassword, sessionCookie } = require('./_lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  const password = req.body && req.body.password;
  if (!hasValidPassword(password)) return res.status(401).json({ error: 'Invalid password.' });
  res.setHeader('Set-Cookie', sessionCookie(createSessionToken()));
  return res.status(200).json({ status: 'ok' });
};
