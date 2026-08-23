const { connectToDatabase, ensureBookmarkIndexes } = require('./lib/db');
const cloudinary = require('cloudinary').v2;
const { identityFilter, normalizeBookmark } = require('./lib/bookmark-utils');
const { setExtensionCors } = require('./lib/extension-auth');
const { authorizeExtensionDevice } = require('./lib/extension-pairing');

if (process.env.CLOUDINARY_URL) {
  // Cloudinary reads CLOUDINARY_URL automatically.
} else if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

module.exports = async (req, res) => {
  const corsAllowed = setExtensionCors(req, res);
  if (req.method === 'OPTIONS') {
    if (!corsAllowed) return res.status(403).json({ error: 'Extension origin not allowed.' });
    return res.status(200).end();
  }
  let extensionAuth;
  try {
    extensionAuth = await authorizeExtensionDevice(req);
  } catch (error) {
    console.error('Extension authorization failed:', error);
    return res.status(503).json({ error: 'Extension authorization is temporarily unavailable.' });
  }
  if (!extensionAuth.authorized || !extensionAuth.userId) return res.status(401).json({ error: 'Reconnect this extension to a signed-in SocialFeed account before syncing.' });

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  try {
    const scrapedItems = req.body;
    if (!Array.isArray(scrapedItems)) {
      res.status(400).json({ error: 'Invalid payload format. Must be a JSON array.' });
      return;
    }

    await ensureBookmarkIndexes();
    const db = await connectToDatabase();
    const collection = db.collection('bookmarks');
    const now = new Date().toISOString();
    const cloudinaryConfigured = !!(process.env.CLOUDINARY_URL || (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY));

    let addedCount = 0;
    let skippedCount = 0;
    let imageUploadedCount = 0;
    const operations = [];
    const seenIdentities = new Set();

    for (const item of scrapedItems) {
      const bookmark = normalizeBookmark(item, {
        now,
        importSource: item.importSource || 'extension'
      });
      bookmark.userId = extensionAuth.userId;
      const identity = bookmark.platformItemId
        ? `${bookmark.platform}:${bookmark.platformItemId}`
        : `url:${bookmark.canonicalUrl}`;

      if (seenIdentities.has(identity)) {
        skippedCount++;
        continue;
      }
      seenIdentities.add(identity);

      const existing = await collection.findOne({
        userId: extensionAuth.userId,
        $or: [{ identityKey: bookmark.identityKey }, identityFilter(bookmark)]
      }, { projection: { _id: 1 } });
      // Repeated scans are deliberately ignored so notes, tags, folders,
      // thumbnails, and the original first-saved timestamp stay unchanged.
      if (existing) {
        skippedCount++;
        continue;
      }

      if (bookmark.thumbnail && bookmark.thumbnail.startsWith('data:image/') && cloudinaryConfigured) {
        try {
          const uploadRes = await cloudinary.uploader.upload(bookmark.thumbnail, {
            folder: 'bookmarks_feed',
            public_id: bookmark.id,
            overwrite: true,
            resource_type: 'image'
          });
          bookmark.thumbnail = uploadRes.secure_url;
          imageUploadedCount++;
        } catch (err) {
          console.error(`Failed to upload scraped image to Cloudinary for ${bookmark.id}:`, err.message);
        }
      }

      operations.push({
        updateOne: {
          filter: { userId: extensionAuth.userId, identityKey: bookmark.identityKey },
          update: { $setOnInsert: bookmark },
          upsert: true
        }
      });
    }

    if (operations.length > 0) {
      const result = await collection.bulkWrite(operations, { ordered: false });
      addedCount = result.upsertedCount || 0;
      skippedCount += operations.length - addedCount;
    }

    res.status(200).json({
      status: 'ok',
      added: addedCount,
      updated: 0,
      skipped: skippedCount,
      cloudinaryUploads: imageUploadedCount
    });
  } catch (err) {
    console.error('Failed to import scraped payload to MongoDB:', err);
    res.status(500).json({ error: 'Failed to import bookmarks.', details: err.message });
  }
};
