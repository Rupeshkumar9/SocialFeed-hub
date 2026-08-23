const { createSessionToken, sessionCookie } = require('../lib/auth');
const { connectToDatabase } = require('../lib/db');
const { defaultProfile } = require('../lib/public-profile');
const {
  ensureUserIndexes,
  getUserByEmail,
  getUserByUsername,
  hashPassword,
  isValidEmail,
  isValidUsername,
  normalizeEmail,
  normalizeUsername,
  publicUser
} = require('../lib/users');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  const body = req.body || {};
  const email = normalizeEmail(body.email);
  const username = normalizeUsername(body.username);
  const displayName = String(body.displayName || '').trim().slice(0, 80);
  const password = body.password;
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (!isValidUsername(username)) return res.status(400).json({ error: 'Username must be 3–30 characters using letters, numbers, underscores, or hyphens.' });
  if (!displayName) return res.status(400).json({ error: 'Display name is required.' });
  if (typeof password !== 'string' || password.length < 10 || password.length > 128) return res.status(400).json({ error: 'Password must be between 10 and 128 characters.' });

  try {
    const db = await ensureUserIndexes();
    if (await getUserByEmail(email)) return res.status(409).json({ error: 'An account with that email already exists.' });
    if (await getUserByUsername(username)) return res.status(409).json({ error: 'That username is already taken.' });
    const now = new Date();
    const user = {
      email,
      emailLower: email,
      username,
      usernameLower: username,
      displayName,
      passwordHash: await hashPassword(password),
      status: 'active',
      memberSince: now,
      createdAt: now,
      updatedAt: now
    };
    const result = await db.collection('users').insertOne(user);
    user._id = result.insertedId;
    const profile = defaultProfile(user._id, { username, displayName });
    await db.collection('public_profiles').insertOne(profile);
    res.setHeader('Set-Cookie', sessionCookie(createSessionToken(user._id)));
    return res.status(201).json({ authenticated: true, profile: publicUser(user) });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ error: 'That email or username is already in use.' });
    console.error('Unable to create account:', error);
    return res.status(500).json({ error: 'Unable to create account.' });
  }
};
