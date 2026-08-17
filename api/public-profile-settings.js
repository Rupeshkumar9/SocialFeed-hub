const { requireSession } = require('./lib/auth');
const { ensurePublicProfileIndexes } = require('./lib/db');
const cloudinary = require('cloudinary').v2;
const {
  buildPublicProfile,
  getProfile,
  getPublicCounts,
  sanitizeProfileInput
} = require('./lib/public-profile');

if (process.env.CLOUDINARY_URL) {
  // Cloudinary reads the connection string automatically.
} else if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

module.exports = async (req, res) => {
  if (!requireSession(req, res)) return;
  if (!['GET', 'PUT'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed.' });

  try {
    await ensurePublicProfileIndexes();
    const current = await getProfile();
    if (req.method === 'GET') {
      const counts = await getPublicCounts(current.db);
      return res.status(200).json({ profile: { ...current.profile, counts } });
    }

    const input = { ...(req.body || {}) };
    if (typeof input.avatarUrl === 'string' && input.avatarUrl.startsWith('data:image/')) {
      const cloudinaryConfigured = Boolean(process.env.CLOUDINARY_URL || (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET));
      if (!cloudinaryConfigured) {
        const error = new Error('Profile picture uploads are not configured on this server.');
        error.statusCode = 503;
        throw error;
      }
      const upload = await cloudinary.uploader.upload(input.avatarUrl, {
        folder: 'socialfeed/profile',
        public_id: 'owner-avatar',
        overwrite: true,
        resource_type: 'image'
      });
      input.avatarUrl = upload.secure_url;
    }
    const nextProfile = sanitizeProfileInput(input, current.profile);
    const { _id, createdAt, ...mutableProfile } = nextProfile;
    await current.db.collection('public_profiles').updateOne(
      { _id: 'owner' },
      { $set: mutableProfile, $setOnInsert: { _id: _id || 'owner', createdAt: createdAt || new Date().toISOString() } },
      { upsert: true }
    );
    const counts = await getPublicCounts(current.db);
    return res.status(200).json({ profile: { ...nextProfile, counts } });
  } catch (error) {
    const status = Number.isInteger(error.statusCode) ? error.statusCode : 500;
    if (status >= 500) console.error('Failed to update public profile settings:', error);
    return res.status(status).json({ error: status === 500 ? 'Unable to update public profile settings.' : error.message });
  }
};
