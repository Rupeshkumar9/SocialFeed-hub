const { ensurePublicProfileIndexes } = require('./lib/db');
const {
  buildPublicProfile,
  getPublicCounts,
  getPublicProfileByUsername
} = require('./lib/public-profile');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
  const username = String(req.query?.username || '').trim();
  if (!username) return res.status(404).json({ error: 'Profile not found.' });

  try {
    await ensurePublicProfileIndexes();
    const { db, profile } = await getPublicProfileByUsername(username);
    if (!profile) return res.status(404).json({ error: 'Profile not found.' });
    const counts = await getPublicCounts(db);
    res.set('Cache-Control', 'no-store');
    return res.status(200).json({ profile: buildPublicProfile(profile, counts) });
  } catch (error) {
    console.error('Failed to load public profile:', error);
    return res.status(500).json({ error: 'Unable to load public profile.' });
  }
};
