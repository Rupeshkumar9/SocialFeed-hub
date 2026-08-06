const { connectToDatabase, ensureBookmarkIndexes } = require('./_lib/db');
const cloudinary = require('cloudinary').v2;
const { normalizeBookmark } = require('./_lib/bookmark-utils');
const { requireSession } = require('./_lib/auth');

// Configure Cloudinary
if (process.env.CLOUDINARY_URL) {
  // Automatically uses CLOUDINARY_URL if present
} else if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

module.exports = async (req, res) => {
  if (!requireSession(req, res)) return;

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  try {
    const payload = req.body;
    const bookmarks = Array.isArray(payload) ? payload : payload && payload.bookmarks;
    const deletedIds = Array.isArray(payload && payload.deletedIds) ? payload.deletedIds : [];
    if (!Array.isArray(bookmarks)) {
      res.status(400).json({ error: 'Invalid payload format. Must include a bookmarks array.' });
      return;
    }

    const now = new Date().toISOString();
    const normalizedBookmarks = bookmarks.map(bm => normalizeBookmark(bm, {
      now,
      preserveCreatedAt: true,
      importSource: bm.importSource || 'manual'
    }));

    const cloudinaryConfigured = !!(process.env.CLOUDINARY_URL || (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY));
    let uploadCount = 0;
    if (cloudinaryConfigured) {
      for (const bm of normalizedBookmarks) {
        if (bm.thumbnail && bm.thumbnail.startsWith('data:image/')) {
          try {
            const uploadRes = await cloudinary.uploader.upload(bm.thumbnail, {
              folder: 'bookmarks_feed',
              public_id: bm.id,
              overwrite: true,
              resource_type: 'image'
            });
            bm.thumbnail = uploadRes.secure_url;
            uploadCount++;
          } catch (err) {
            console.error(`Failed to upload thumbnail to Cloudinary for ${bm.id}:`, err.message);
          }
        }
      }
    }

    await ensureBookmarkIndexes();
    const db = await connectToDatabase();
    const collection = db.collection('bookmarks');
    const operations = normalizedBookmarks.map(bookmark => {
      const { _id, firstSavedAt, createdAt, extensionScrapedAt, sourceSavedAt, timestamp, ...mutableFields } = bookmark;
      return {
        updateOne: {
          filter: { id: bookmark.id },
          update: {
            $set: mutableFields,
            $setOnInsert: {
              firstSavedAt,
              createdAt,
              extensionScrapedAt,
              sourceSavedAt,
              timestamp
            }
          },
          upsert: true
        }
      };
    });

    const upsertedIds = new Set(normalizedBookmarks.map(bookmark => bookmark.id));
    const deletions = [...new Set(deletedIds.filter(id => id && !upsertedIds.has(id)))];
    if (deletions.length > 0) {
      operations.push({ deleteMany: { filter: { id: { $in: deletions } } } });
    }

    if (operations.length > 0) {
      await collection.bulkWrite(operations, { ordered: false });
    }

    res.status(200).json({
      status: 'saved',
      count: normalizedBookmarks.length,
      deleted: deletions.length,
      cloudinaryUploads: uploadCount
    });
  } catch (err) {
    console.error('Failed to save bookmarks to MongoDB Atlas:', err);
    res.status(500).json({ error: 'Failed to write bookmarks to database.', details: err.message });
  }
};
