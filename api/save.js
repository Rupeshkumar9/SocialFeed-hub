const { connectToDatabase } = require('./lib/db');
const cloudinary = require('cloudinary').v2;

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
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Verify Admin authorization
  let authorized = false;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (process.env.ADMIN_PASSWORD && token === process.env.ADMIN_PASSWORD) {
      authorized = true;
    }
  }

  if (!authorized) {
    res.status(401).json({ error: 'Unauthorized. Admin access required.' });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  try {
    const bookmarks = req.body;
    if (!Array.isArray(bookmarks)) {
      res.status(400).json({ error: 'Invalid payload format. Must be a JSON array.' });
      return;
    }

    console.log(`Received bulk save request with ${bookmarks.length} items.`);

    // 1. Process Base64 image conversions to Cloudinary
    let cloudinaryConfigured = !!(process.env.CLOUDINARY_URL || (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY));
    let uploadCount = 0;

    if (cloudinaryConfigured) {
      for (const bm of bookmarks) {
        if (bm.thumbnail && bm.thumbnail.startsWith('data:image/')) {
          try {
            console.log(`Uploading Base64 thumbnail to Cloudinary for post: ${bm.id}`);
            const uploadRes = await cloudinary.uploader.upload(bm.thumbnail, {
              folder: 'bookmarks_feed',
              public_id: bm.id,
              overwrite: true,
              resource_type: 'image'
            });
            // Overwrite Base64 with high-performance HTTPS secure URL
            bm.thumbnail = uploadRes.secure_url;
            uploadCount++;
          } catch (err) {
            console.error(`Failed to upload thumbnail to Cloudinary for ${bm.id}:`, err.message);
            // Fallback: keep the Base64 in database so the image isn't lost
          }
        }
      }
    } else {
      console.log('Cloudinary not configured. Skipping Base64 conversion (images will remain as Base64 in MongoDB).');
    }

    // 2. Save bookmarks to MongoDB Atlas
    const db = await connectToDatabase();
    const collection = db.collection('bookmarks');

    // Safe transaction-like bulk overwrite
    await collection.deleteMany({});
    if (bookmarks.length > 0) {
      await collection.insertMany(bookmarks);
    }

    res.status(200).json({ 
      status: 'saved', 
      count: bookmarks.length,
      cloudinaryUploads: uploadCount
    });
  } catch (err) {
    console.error('Failed to save bookmarks to MongoDB Atlas:', err);
    res.status(500).json({ error: 'Failed to write bookmarks to database.', details: err.message });
  }
};
