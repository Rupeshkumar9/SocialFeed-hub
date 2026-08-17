const { ObjectId } = require('mongodb');
const { connectToDatabase } = require('./db');

const PROFILE_ID = 'owner';
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{2,29}$/;
const RESERVED_USERNAMES = new Set([
  'api', 'assets', 'auth', 'login', 'logout', 'settings', 'admin',
  'extension-connect', 'healthz', 'favicon', 'index', 'public-profile'
]);

function slugifyUsername(value) {
  return String(value || '').trim().toLowerCase();
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

function defaultProfile() {
  const configuredUsername = slugifyUsername(process.env.PUBLIC_USERNAME || 'socialfeed');
  return {
    _id: PROFILE_ID,
    username: isValidUsername(configuredUsername) ? configuredUsername : 'socialfeed',
    usernameLower: isValidUsername(configuredUsername) ? configuredUsername : 'socialfeed',
    displayName: String(process.env.PROFILE_NAME || 'SocialFeed Owner').trim().slice(0, 80),
    bio: '',
    avatarUrl: '',
    published: true,
    defaultTab: 'links',
    socialLinks: [],
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

function sanitizeProfileInput(input = {}, previous = defaultProfile()) {
  const username = slugifyUsername(input.username ?? previous.username);
  if (!isValidUsername(username)) {
    const error = new Error('Username must be 3–30 characters and use only letters, numbers, underscores, or hyphens.');
    error.statusCode = 400;
    throw error;
  }
  return {
    _id: PROFILE_ID,
    username,
    usernameLower: username,
    displayName: String(input.displayName ?? previous.displayName ?? '').trim().slice(0, 80),
    bio: String(input.bio ?? previous.bio ?? '').trim().slice(0, 280),
    avatarUrl: safeUrl(input.avatarUrl ?? previous.avatarUrl),
    published: input.published === true,
    defaultTab: input.defaultTab === 'posts' ? 'posts' : 'links',
    socialLinks: normalizeSocialLinks(input.socialLinks ?? previous.socialLinks),
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
    theme: profile.theme,
    collectionSettings: (profile.collectionSettings || []).filter(item => item.enabled !== false).sort((a, b) => a.sortOrder - b.sortOrder),
    counts
  };
}

async function getProfile({ publishedOnly = false } = {}) {
  const db = await connectToDatabase();
  const filter = { _id: PROFILE_ID };
  if (publishedOnly) filter.published = true;
  const profile = await db.collection('public_profiles').findOne(filter);
  return { db, profile: profile || (publishedOnly ? null : defaultProfile()) };
}

async function getPublicProfileByUsername(username) {
  const db = await connectToDatabase();
  const profile = await db.collection('public_profiles').findOne({ usernameLower: slugifyUsername(username), published: true });
  return { db, profile };
}

async function getPublicCounts(db) {
  const rows = await db.collection('bookmarks').aggregate([
    { $match: { visibility: 'public' } },
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
  return Buffer.from(JSON.stringify({ date: bookmark.firstSavedAt, id: String(bookmark._id) })).toString('base64url');
}

function decodePublicCursor(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (!parsed.date || !ObjectId.isValid(parsed.id)) return null;
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
  const filter = { visibility: 'public' };
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
  PROFILE_ID,
  buildPublicProfile,
  defaultProfile,
  getProfile,
  getPublicCounts,
  getPublicProfileByUsername,
  isValidUsername,
  loadPublicBookmarks,
  normalizeCollectionSettings,
  normalizeSocialLinks,
  publicBookmarkFields,
  sanitizeProfileInput,
  safeUrl,
  slugifyUsername
};
