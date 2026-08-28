const { ObjectId } = require('mongodb');
const { connectToDatabase } = require('./db');

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{2,29}$/;
const RESERVED_USERNAMES = new Set([
  'api', 'assets', 'auth', 'login', 'logout', 'settings', 'admin',
  'extension-connect', 'healthz', 'favicon', 'index', 'public-profile'
]);

function slugifyUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function userIdVariants(userId) {
  if (!userId) return [];
  const stringId = String(userId);
  const variants = [stringId];
  if (ObjectId.isValid(stringId)) variants.push(new ObjectId(stringId));
  return variants;
}

function isValidUsername(value) {
  const username = slugifyUsername(value);
  return USERNAME_PATTERN.test(username) && !RESERVED_USERNAMES.has(username);
}

function safeUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
    return url.toString();
  } catch {
    return '';
  }
}

function safeAvatarUrl(value) {
  const raw = String(value || '').trim();
  // Local development can keep the small uploaded image in MongoDB when no
  // Cloudinary credentials are configured. Restrict this to the image types
  // accepted by the profile picker and cap it below Mongo's document limit.
  if (/^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(raw) && raw.length <= 3 * 1024 * 1024) return raw;
  return safeUrl(raw);
}

function defaultProfile(userId, overrides = {}) {
  // Profile identity is user-owned data. Environment variables are reserved
  // for deployment configuration, so a missing profile gets only a neutral
  // placeholder until signup/settings supplies its Mongo-backed values.
  const configuredUsername = slugifyUsername(overrides.username || 'socialfeed');
  return {
    _id: overrides._id || new ObjectId(),
    // Session claims and owned bookmark records use the string form of the
    // Mongo user id. Keep profile ownership in that same representation so
    // public counts/bookmarks and settings lookups cannot miss a profile
    // created during signup (which hands us an ObjectId).
    userId: userId ? String(userId) : userId,
    username: isValidUsername(configuredUsername) ? configuredUsername : 'socialfeed',
    usernameLower: isValidUsername(configuredUsername) ? configuredUsername : 'socialfeed',
    displayName: String(overrides.displayName || 'SocialFeed Owner').trim().slice(0, 80),
    bio: '',
    avatarUrl: '',
    published: true,
    defaultTab: 'links',
    socialLinks: [],
    shopLinks: [],
    theme: { accent: '#f43f5e', background: 'default', buttonStyle: 'soft' },
    collectionSettings: []
  };
}

function normalizeSocialLinks(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).map((item, index) => ({
    id: String(item?.id || `social_${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || `social_${index + 1}`,
    platform: String(item?.platform || 'website').trim().toLowerCase().slice(0, 30),
    label: String(item?.label || item?.platform || 'Website').trim().slice(0, 50),
    url: safeUrl(item?.url),
    enabled: item?.enabled !== false,
    sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item.sortOrder) : (index + 1) * 10
  })).filter(item => item.url);
}

function normalizeShopLinks(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 50).map((item, index) => ({
    id: String(item?.id || `shop_${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || `shop_${index + 1}`,
    title: String(item?.title || 'Featured pick').trim().slice(0, 120),
    url: safeUrl(item?.url),
    description: String(item?.description || '').trim().slice(0, 220),
    thumbnail: safeUrl(item?.thumbnail),
    price: String(item?.price || '').trim().slice(0, 40),
    merchant: String(item?.merchant || '').trim().slice(0, 70),
    sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item.sortOrder) : (index + 1) * 10
  })).filter(item => item.url && item.title);
}

function normalizeCollectionSettings(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).map((item, index) => ({
    source: item?.source === 'social' ? 'social' : 'browser',
    key: String(item?.key || '').trim().slice(0, 120),
    publicLabel: String(item?.publicLabel || item?.key || '').trim().slice(0, 120),
    enabled: item?.enabled !== false,
    sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item.sortOrder) : (index + 1) * 10
  })).filter(item => item.key);
}

function normalizeTheme(value) {
  const allowedAccents = new Set(['#f43f5e', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#3b82f6']);
  const accent = String(value?.accent || '').trim().toLowerCase();
  return {
    accent: allowedAccents.has(accent) ? accent : '#f43f5e',
    background: ['default', 'paper', 'midnight'].includes(value?.background) ? value.background : 'default',
    buttonStyle: ['soft', 'solid', 'outline'].includes(value?.buttonStyle) ? value.buttonStyle : 'soft'
  };
}

function sanitizeProfileInput(input = {}, previous = null) {
  previous = previous || defaultProfile();
  const username = slugifyUsername(input.username ?? previous.username);
  if (!isValidUsername(username)) {
    const error = new Error('Username must be 3–30 characters and use only letters, numbers, underscores, or hyphens.');
    error.statusCode = 400;
    throw error;
  }
  return {
    _id: previous._id || new ObjectId(),
    userId: previous.userId,
    username,
    usernameLower: username,
    displayName: String(input.displayName ?? previous.displayName ?? '').trim().slice(0, 80),
    bio: String(input.bio ?? previous.bio ?? '').trim().slice(0, 280),
    avatarUrl: safeAvatarUrl(input.avatarUrl ?? previous.avatarUrl),
    published: input.published === true,
    defaultTab: ['links', 'posts', 'shop'].includes(input.defaultTab) ? input.defaultTab : 'links',
    socialLinks: normalizeSocialLinks(input.socialLinks ?? previous.socialLinks),
    shopLinks: normalizeShopLinks(input.shopLinks ?? previous.shopLinks),
    theme: normalizeTheme(input.theme ?? previous.theme),
    collectionSettings: normalizeCollectionSettings(input.collectionSettings ?? previous.collectionSettings),
    createdAt: previous.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function publicCollectionEnabled(profile, source, folder) {
  const key = String(folder || '').trim();
  const configured = (profile.collectionSettings || []).find(item => item.source === source && item.key === key);
  return !configured || configured.enabled !== false;
}

function buildPublicProfile(profile, counts = {}) {
  return {
    username: profile.username,
    displayName: profile.displayName,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    defaultTab: profile.defaultTab,
    socialLinks: (profile.socialLinks || []).filter(item => item.enabled !== false).sort((a, b) => a.sortOrder - b.sortOrder),
    shopLinks: (profile.shopLinks || []).sort((a, b) => a.sortOrder - b.sortOrder),
    theme: profile.theme,
    collectionSettings: (profile.collectionSettings || []).filter(item => item.enabled !== false).sort((a, b) => a.sortOrder - b.sortOrder),
    counts
  };
}

async function getProfile({ userId, publishedOnly = false, user } = {}) {
  const db = await connectToDatabase();
  const variants = userIdVariants(userId);
  const filter = variants.length > 1 ? { userId: { $in: variants } } : { userId: variants[0] };
  if (publishedOnly) filter.published = true;
  const profile = await db.collection('public_profiles').findOne(filter);
  return {
    db,
    found: Boolean(profile),
    profile: profile || (publishedOnly ? null : defaultProfile(userId, { displayName: user?.displayName, username: user?.username }))
  };
}

async function getPublicProfileByUsername(username) {
  const db = await connectToDatabase();
  const profile = await db.collection('public_profiles').findOne({ usernameLower: slugifyUsername(username), published: true });
  return { db, profile };
}

async function getPublicCounts(db, userId) {
  const rows = await db.collection('bookmarks').aggregate([
    { $match: { visibility: 'public', userId: { $in: userIdVariants(userId) } } },
    { $group: { _id: { source: '$source', platform: '$platform' }, count: { $sum: 1 } } }
  ]).toArray();
  const counts = { browser: 0, social: 0, platforms: {} };
  rows.forEach(row => {
    const source = row._id?.source === 'browser' ? 'browser' : 'social';
    counts[source] += row.count;
    if (source === 'social') {
      const platform = String(row._id?.platform || 'other');
      counts.platforms[platform] = (counts.platforms[platform] || 0) + row.count;
    }
  });
  return counts;
}

function encodePublicCursor(bookmark) {
  if (!bookmark?._id || !bookmark.firstSavedAt) return null;
  return Buffer.from(JSON.stringify({
    date: bookmark.firstSavedAt,
    id: String(bookmark._id),
    idType: bookmark._id instanceof ObjectId ? 'objectId' : 'string'
  })).toString('base64url');
}

function decodePublicCursor(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (!parsed.date || typeof parsed.id !== 'string' || !parsed.id) return null;
    if (parsed.idType === 'string') return { date: parsed.date, id: parsed.id };
    if (!ObjectId.isValid(parsed.id)) return null;
    return { date: parsed.date, id: new ObjectId(parsed.id) };
  } catch {
    return null;
  }
}

function publicBookmarkFields(bookmark) {
  return {
    id: bookmark.id,
    source: bookmark.source,
    platform: bookmark.platform,
    platformName: bookmark.platformName || '',
    url: bookmark.url,
    authorName: bookmark.authorName || '',
    authorUsername: bookmark.authorUsername || '',
    content: bookmark.content || '',
    thumbnail: bookmark.thumbnail || '',
    favicon: bookmark.favicon || '',
    folder: bookmark.folder || '',
    hashtags: Array.isArray(bookmark.hashtags) ? bookmark.hashtags : [],
    firstSavedAt: bookmark.firstSavedAt || bookmark.createdAt || null,
    publicTitle: bookmark.publicTitle || '',
    publicDescription: bookmark.publicDescription || '',
    featured: bookmark.featured === true,
    publicOrder: Number.isFinite(Number(bookmark.publicOrder)) ? Number(bookmark.publicOrder) : null
  };
}

async function loadPublicBookmarks({ profile, source = 'browser', platform, collection, cursor, limit = 30 }) {
  const db = await connectToDatabase();
  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 30, 1), 60);
  const filter = { visibility: 'public', userId: { $in: userIdVariants(profile.userId) } };
  if (source === 'browser') filter.source = 'browser';
  else filter.source = { $ne: 'browser' };
  if (source === 'social' && platform && platform !== 'all') filter.platform = String(platform).toLowerCase();
  if (collection && collection !== 'all') filter.folder = collection === 'uncategorized' ? { $in: ['', null, 'Bookmarks bar', 'Bookmarks Bar'] } : collection;

  const decoded = decodePublicCursor(cursor);
  if (decoded) {
    filter.$or = [
      { firstSavedAt: { $lt: decoded.date } },
      { firstSavedAt: decoded.date, _id: { $lt: decoded.id } }
    ];
  }

  const rows = await db.collection('bookmarks')
    .find(filter)
    .sort({ firstSavedAt: -1, _id: -1 })
    .limit(safeLimit + 1)
    .toArray();
  const visible = rows.filter(item => publicCollectionEnabled(profile, source, item.folder));
  const hasMore = rows.length > safeLimit;
  const items = visible.slice(0, safeLimit).map(publicBookmarkFields);
  const last = rows[Math.min(rows.length, safeLimit) - 1];
  return { bookmarks: items, nextCursor: hasMore && last ? encodePublicCursor(last) : null, hasMore };
}

module.exports = {
  buildPublicProfile,
  defaultProfile,
  getProfile,
  getPublicCounts,
  getPublicProfileByUsername,
  isValidUsername,
  loadPublicBookmarks,
  normalizeCollectionSettings,
  normalizeShopLinks,
  normalizeSocialLinks,
  publicBookmarkFields,
  sanitizeProfileInput,
  safeUrl,
  safeAvatarUrl,
  slugifyUsername,
  userIdVariants
};
