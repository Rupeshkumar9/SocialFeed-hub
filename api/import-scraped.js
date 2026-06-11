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

function normalizeUrl(url) {
  try {
    const urlObj = new URL(url);
    urlObj.search = '';
    let host = urlObj.hostname.replace('mobile.', '').replace('www.', '');
    let path = urlObj.pathname;
    if (path.endsWith('/')) path = path.slice(0, -1);
    return `${host}${path}`;
  } catch (e) {
    return url.toLowerCase().trim();
  }
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
    const scrapedItems = req.body;
    if (!Array.isArray(scrapedItems)) {
      res.status(400).json({ error: 'Invalid payload format. Must be a JSON array.' });
      return;
    }

    console.log(`Processing scraping request with ${scrapedItems.length} items.`);

    const db = await connectToDatabase();
    const collection = db.collection('bookmarks');

    // Retrieve current database
    const bookmarks = await collection.find({}).sort({ timestamp: -1 }).toArray();
    const normalizedUrls = new Set(bookmarks.map(x => normalizeUrl(x.url)));
    
    let addedCount = 0;
    let updatedCount = 0;
    let imageUploadedCount = 0;

    let cloudinaryConfigured = !!(process.env.CLOUDINARY_URL || (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY));

    for (const item of scrapedItems) {
      const normUrl = normalizeUrl(item.url);
      const shortcodeMatch = item.url.match(/\/p\/([a-zA-Z0-9_\-]+)/i) || item.url.match(/\/reel\/([a-zA-Z0-9_\-]+)/i);
      const shortcode = shortcodeMatch ? shortcodeMatch[1] : `scraped_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const bookmarkId = `ig_${shortcode}`;

      // Upload remote image to Cloudinary if configured
      let thumbnailUrl = '';
      if (item.imageUrl) {
        if (cloudinaryConfigured) {
          try {
            console.log(`Uploading scraped remote image to Cloudinary: ${item.imageUrl}`);
            const uploadRes = await cloudinary.uploader.upload(item.imageUrl, {
              folder: 'bookmarks_feed',
              public_id: bookmarkId,
              overwrite: true,
              resource_type: 'image'
            });
            thumbnailUrl = uploadRes.secure_url;
            imageUploadedCount++;
          } catch (err) {
            console.error(`Failed to upload remote image to Cloudinary for ${shortcode}:`, err.message);
            // Fallback to original remote image CDN
            thumbnailUrl = item.imageUrl;
          }
        } else {
          // If Cloudinary isn't configured, fall back to keeping original CDN URL
          thumbnailUrl = item.imageUrl;
        }
      }

      // Parse tags
      const cleanCaption = (item.content || '').trim();
      const hashtagRegex = /#(\w+)/g;
      const tags = ['imported'];
      let tagMatch;
      while ((tagMatch = hashtagRegex.exec(cleanCaption)) !== null) {
        const tag = tagMatch[1].toLowerCase();
        if (!tags.includes(tag)) {
          tags.push(tag);
        }
      }

      const isNew = !normalizedUrls.has(normUrl);
      
      if (isNew) {
        // Add new bookmark
        const newBm = {
          id: bookmarkId,
          platform: 'instagram',
          url: item.url,
          authorName: item.authorName || 'Instagram Creator',
          authorUsername: item.authorUsername || 'instagram_user',
          content: cleanCaption || 'Saved Instagram Post',
          timestamp: new Date().toISOString(),
          tags: tags,
          notes: '',
          thumbnail: thumbnailUrl
        };
        bookmarks.unshift(newBm);
        normalizedUrls.add(normUrl);
        addedCount++;
      } else {
        // Update existing bookmark fields
        const idx = bookmarks.findIndex(x => normalizeUrl(x.url) === normUrl);
        if (idx !== -1) {
          const existing = bookmarks[idx];
          existing.authorName = item.authorName || existing.authorName;
          existing.authorUsername = item.authorUsername || existing.authorUsername;
          existing.content = cleanCaption || existing.content;
          if (thumbnailUrl) {
            existing.thumbnail = thumbnailUrl;
          }
          // Merge tags
          existing.tags = Array.from(new Set([...existing.tags, ...tags]));
          updatedCount++;
        }
      }
    }

    // Save changes back to MongoDB
    await collection.deleteMany({});
    if (bookmarks.length > 0) {
      await collection.insertMany(bookmarks);
    }

    console.log(`[Success] Imported scraped items. Added: ${addedCount}, Updated: ${updatedCount}, Images Configured: ${imageUploadedCount}`);
    
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
