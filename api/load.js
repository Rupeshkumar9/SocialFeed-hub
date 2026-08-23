const { requireSession } = require('./lib/auth');
const { loadBookmarks } = require('./lib/load-bookmarks');

module.exports = async (req, res) => {
  if (!requireSession(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  try {
    return res.status(200).json(await loadBookmarks(req.query || {}, req.auth.userId));
  } catch (err) {
    console.error('Failed to load bookmarks:', err);
    return res.status(500).json({ error: 'Failed to retrieve bookmarks.' });
  }
};
