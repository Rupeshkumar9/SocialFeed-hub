const { ensurePublicProfileIndexes } = require('./lib/db');
const {
  getPublicProfileByUsername,
  loadPublicBookmarks
} = require('./lib/public-profile');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
  const username = String(req.query?.username || '').trim();
  const source = req.query?.source === 'social' ? 'social' : 'browser';
  if (!username) return res.status(404).json({ error: 'Profile not found.' });

  try {
    await ensurePublicProfileIndexes();
    const { profile } = await getPublicProfileByUsername(username);
    if (!profile) return res.status(404).json({ error: 'Profile not found.' });
    const result = await loadPublicBookmarks({
      profile,
      source,
      platform: req.query?.platform,
      collection: req.query?.collection,
      cursor: req.query?.cursor,
      limit: req.query?.limit
    });
    res.set('Cache-Control', 'no-store');
    return res.status(200).json(result);
  } catch (error) {
    console.error('Failed to load public bookmarks:', error);
    return res.status(500).json({ error: 'Unable to load public bookmarks.' });
  }
};
