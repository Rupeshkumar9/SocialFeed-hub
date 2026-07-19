const { connectToDatabase } = require('./lib/db');
const cloudinary = require('cloudinary').v2;
const { identityFilter, normalizeBookmark } = require('./lib/bookmark-utils');

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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '';
  if (!process.env.ADMIN_PASSWORD || token !== process.env.ADMIN_PASSWORD) {
    res.status(401).json({ error: 'Unauthorized. Admin access required.' });
    return;
  }

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

    const db = await connectToDatabase();
    const collection = db.collection('bookmarks');
    const now = new Date().toISOString();
    const cloudinaryConfigured = !!(process.env.CLOUDINARY_URL || (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY));

    let addedCount = 0;
    let updatedCount = 0;
    let imageUploadedCount = 0;
    const operations = [];

    for (const item of scrapedItems) {
      const bookmark = normalizeBookmark(item, {
        now,
        importSource: item.importSource || 'extension'
      });

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

      const existing = await collection.findOne(identityFilter(bookmark), {
        projection: { _id: 1, tags: 1, createdAt: 1 }
      });

      if (existing) {
        updatedCount++;
        const setFields = {
          platform: bookmark.platform,
          platformItemId: bookmark.platformItemId,
          canonicalUrl: bookmark.canonicalUrl,
          url: bookmark.url,
          authorName: bookmark.authorName,
          authorUsername: bookmark.authorUsername,
          content: bookmark.content,
          timestamp: bookmark.timestamp,
          sourceSavedAt: bookmark.sourceSavedAt,
          updatedAt: now,
          importSource: bookmark.importSource,
          notes: bookmark.notes || ''
        };
        if (bookmark.thumbnail) setFields.thumbnail = bookmark.thumbnail;

        operations.push({
          updateOne: {
            filter: { _id: existing._id },
            update: {
              $set: setFields,
              $setOnInsert: { createdAt: bookmark.createdAt },
              $addToSet: { tags: { $each: bookmark.tags } }
            }
          }
        });
      } else {
        addedCount++;
        operations.push({ insertOne: { document: bookmark } });
      }
    }

    if (operations.length > 0) {
      await collection.bulkWrite(operations, { ordered: false });
    }

    res.status(200).json({
      status: 'ok',
      added: addedCount,
      updated: updatedCount,
      cloudinaryUploads: imageUploadedCount
    });
  } catch (err) {
    console.error('Failed to import scraped payload to MongoDB:', err);
    res.status(500).json({ error: 'Failed to import bookmarks.', details: err.message });
  }
};
