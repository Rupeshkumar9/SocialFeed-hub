const { connectToDatabase } = require('./lib/db');
const { normalizeBookmark, sortBookmarksNewestFirst } = require('./lib/bookmark-utils');

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed. Use GET.' });
    return;
  }

  try {
    const db = await connectToDatabase();
    const collection = db.collection('bookmarks');

    // createdAt is the SocialFeed saved date. timestamp remains a legacy fallback.
    const rawBookmarks = await collection
      .find({})
      .sort({ extensionScrapedAt: -1, createdAt: -1, _id: -1 })
      .toArray();

    const bookmarks = rawBookmarks
      .map(bm => normalizeBookmark(bm, { preserveCreatedAt: true }))
      .sort(sortBookmarksNewestFirst);

    // Existing records receive their immutable first-saved date automatically.
    // The value is derived from their current stored date, so no re-import is needed.
    const backfillOperations = rawBookmarks
      .filter(raw => !raw.firstSavedAt)
      .map(raw => {
        const normalized = normalizeBookmark(raw, { preserveCreatedAt: true });
        return {
          updateOne: {
            filter: { _id: raw._id },
            update: {
              $set: {
                firstSavedAt: normalized.firstSavedAt,
                lastScannedAt: raw.lastScannedAt || normalized.lastScannedAt
              }
            }
          }
        };
      });
    if (backfillOperations.length > 0) {
      await collection.bulkWrite(backfillOperations, { ordered: false });
    }

    res.status(200).json(bookmarks);
  } catch (err) {
    console.error('Failed to load bookmarks from MongoDB:', err);
    res.status(500).json({ error: 'Failed to retrieve bookmarks from database.', details: err.message });
  }
};
