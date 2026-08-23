const { requireSession } = require('./lib/auth');
const { ensurePublicProfileIndexes } = require('./lib/db');
const cloudinary = require('cloudinary').v2;
const {
  buildPublicProfile,
  getProfile,
  getPublicCounts,
  sanitizeProfileInput
} = require('./lib/public-profile');
const { getUserById, getUserByUsername } = require('./lib/users');

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
    const current = await getProfile({ userId: req.auth.userId });
    if (req.method === 'GET') {
      const counts = await getPublicCounts(current.db, req.auth.userId);
      return res.status(200).json({ profile: { ...current.profile, counts } });
    }

    const input = { ...(req.body || {}) };
    if (typeof input.avatarUrl === 'string' && input.avatarUrl.startsWith('data:image/')) {
      const cloudinaryConfigured = Boolean(process.env.CLOUDINARY_URL || (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET));
      if (cloudinaryConfigured) {
        const upload = await cloudinary.uploader.upload(input.avatarUrl, {
          folder: 'socialfeed/profile',
          public_id: `avatar-${req.auth.userId}`,
          overwrite: true,
          resource_type: 'image'
        });
        input.avatarUrl = upload.secure_url;
      }
      // Cloudinary is an optional production optimization. During local
      // development keep the data URI in the user's Mongo profile, just as
      // bookmark thumbnails already do when Cloudinary is unavailable.
    }
    const nextProfile = sanitizeProfileInput(input, current.profile);
    const currentUser = await getUserById(req.auth.userId);
    if (!currentUser) return res.status(401).json({ error: 'Session expired.' });
    const nextUsername = nextProfile.usernameLower;
    if (nextUsername !== String(currentUser.usernameLower || '').toLowerCase()) {
      const usernameOwner = await getUserByUsername(nextUsername);
      if (usernameOwner && String(usernameOwner._id) !== String(currentUser._id)) {
        return res.status(409).json({ error: 'That username is already taken.' });
      }
    }
    // Keep the login identity and the public profile identity in sync when a
    // user edits their username or display name in Profile Settings.
    await current.db.collection('users').updateOne(
      { _id: currentUser._id },
      { $set: {
        username: nextProfile.username,
        usernameLower: nextUsername,
        displayName: nextProfile.displayName,
        updatedAt: new Date()
      } }
    );
    const { _id, createdAt, ...mutableProfile } = nextProfile;
    // Normalize profiles created by the earlier ObjectId-based migration.
    // This prevents a duplicate profile and makes subsequent lookups stable.
    mutableProfile.userId = req.auth.userId;
    const profileFilter = current.found ? { _id: current.profile._id } : { userId: req.auth.userId };
    await current.db.collection('public_profiles').updateOne(
      profileFilter,
      // `userId` is already included in `$set` above so legacy profiles are
      // normalized to the session's string id. Repeating it in `$setOnInsert`
      // makes MongoDB reject the update as a conflicting path.
      { $set: mutableProfile, $setOnInsert: { _id: _id, createdAt: createdAt || new Date().toISOString() } },
      { upsert: true }
    );
    const counts = await getPublicCounts(current.db, req.auth.userId);
    return res.status(200).json({ profile: { ...nextProfile, counts } });
  } catch (error) {
    const status = Number.isInteger(error.statusCode) ? error.statusCode : 500;
    if (status >= 500) console.error('Failed to update public profile settings:', error);
    return res.status(status).json({ error: status === 500 ? 'Unable to update public profile settings.' : error.message });
  }
};
