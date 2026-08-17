function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toISOStringOrNull(value) {
  const date = parseDate(value);
  return date ? date.toISOString() : null;
}

function detectPlatform(url = '') {
  const lower = String(url).toLowerCase();
  if (lower.includes('instagram.com')) return 'instagram';
  if (lower.includes('x.com') || lower.includes('twitter.com')) return 'x';
  if (lower.includes('threads.net')) return 'threads';
  if (lower.includes('reddit.com') || lower.includes('redd.it')) return 'reddit';
  if (lower.includes('facebook.com') || lower.includes('fb.watch')) return 'facebook';
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
  return 'web';
}

function extractPlatformItemId(url = '', platform = detectPlatform(url)) {
  const value = String(url);
  if (platform === 'instagram') {
    const match = value.match(/\/(?:p|reel|reels)\/([a-zA-Z0-9_-]+)/i);
    return match ? match[1] : null;
  }
  if (platform === 'x') {
    const match = value.match(/\/status\/(\d+)/i);
    return match ? match[1] : null;
  }
  if (platform === 'threads') {
    const match = value.match(/\/(?:@[^/]+\/)?post\/([a-zA-Z0-9_-]+)/i);
    return match ? match[1] : null;
  }
  if (platform === 'reddit') {
    const comments = value.match(/\/comments\/([a-zA-Z0-9]+)/i);
    const short = value.match(/redd\.it\/([a-zA-Z0-9]+)/i);
    return comments ? comments[1] : short ? short[1] : null;
  }
  if (platform === 'facebook') {
    const post = value.match(/\/posts\/([a-zA-Z0-9_.-]+)/i);
    const story = value.match(/[?&]story_fbid=([0-9]+)/i);
    return post ? post[1] : story ? story[1] : null;
  }
  if (platform === 'youtube') {
    try {
      const parsed = new URL(value);
      if (parsed.hostname.toLowerCase().replace(/^www\./, '') === 'youtu.be') {
        return parsed.pathname.split('/').filter(Boolean)[0] || null;
      }
      const queryId = parsed.searchParams.get('v');
      if (queryId) return queryId;
      const pathMatch = parsed.pathname.match(/\/(?:shorts|embed|live)\/([a-zA-Z0-9_-]+)/i);
      return pathMatch ? pathMatch[1] : null;
    } catch (error) {
      return null;
    }
  }
  return null;
}

function canonicalUrl(url = '') {
  try {
    const urlObj = new URL(url);
    let host = urlObj.hostname.toLowerCase().replace(/^mobile\./, '').replace(/^www\./, '');
    if (host === 'x.com') host = 'twitter.com';
    if (host === 'redd.it') host = 'reddit.com';

    const trackingPrefixes = ['utm_', 'fbclid', 'gclid', 'igshid', 'si'];
    for (const key of Array.from(urlObj.searchParams.keys())) {
      if (trackingPrefixes.some(prefix => key === prefix || key.startsWith(prefix))) {
        urlObj.searchParams.delete(key);
      }
    }

    let path = urlObj.pathname.replace(/\/+$/, '');
    if (host.includes('instagram.com')) {
      path = path.replace('/reels/', '/reel/');
    }

    const query = urlObj.searchParams.toString();
    return `${host}${path}${query ? `?${query}` : ''}`.toLowerCase();
  } catch (e) {
    return String(url || '').toLowerCase().trim();
  }
}

function buildBookmarkId(platform, platformItemId, fallbackId) {
  if (fallbackId) return fallbackId;
  if (platformItemId) {
    const prefix = platform === 'instagram' ? 'ig' : platform === 'facebook' ? 'fb' : platform;
    return `${prefix}_${platformItemId}`;
  }
  return `${platform || 'web'}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeHashtags(hashtags, content = '') {
  const out = new Set();

  // Preserve existing hashtags
  if (Array.isArray(hashtags)) {
    hashtags.forEach(tag => {
      const clean = String(tag || '').toLowerCase().replace(/^#/, '').trim();
      if (clean) out.add(clean);
    });
  }

  // Also extract hashtags from content text
  const hashtagRegex = /#([\w-]+)/g;
  let match;
  while ((match = hashtagRegex.exec(String(content || ''))) !== null) {
    out.add(match[1].toLowerCase());
  }

  // Filter out any system tags that may have leaked in from old data
  const SYSTEM_TAGS = ['imported', 'manual', 'x-archive', 'instagram-archive', 'extracted-link', 'instagram', 'x-post', 'threads', 'reddit', 'facebook', 'youtube'];
  const result = Array.from(out).filter(t => !SYSTEM_TAGS.includes(t));
  return result;
}

function cleanPostContent(content, platform) {
  if (!content) return platform === 'instagram' ? 'Saved Instagram Post' : 'Saved Post';
  const str = String(content).trim();
  return str || (platform === 'instagram' ? 'Saved Instagram Post' : 'Saved Post');
}

function normalizeFolderValue(value) {
  const folder = String(value || "").trim();
  return folder.toLowerCase() === "bookmarks bar" ? "" : folder;
}

function normalizeBookmark(item = {}, options = {}) {
  const now = options.now || new Date().toISOString();
  const rawPlatform = String(item.platform || detectPlatform(item.url)).toLowerCase().trim();
  const platform = (rawPlatform === 'twitter' ? 'x' : rawPlatform)
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'web';
  const platformName = String(item.platformName || '').trim().slice(0, 40);
  const platformItemId = item.platformItemId || extractPlatformItemId(item.url, platform);
  const canonical = item.canonicalUrl || canonicalUrl(item.url);
  
  const postUploadedAt = toISOStringOrNull(item.postUploadedAt) || '';
  // This value is immutable once a bookmark exists. A later scan must not
  // change where the bookmark appears in the feed.
  const firstSavedAt = toISOStringOrNull(item.firstSavedAt) ||
    toISOStringOrNull(item.createdAt) ||
    toISOStringOrNull(item.extensionScrapedAt) ||
    toISOStringOrNull(item.sourceSavedAt || item.timestamp) ||
    now;
  const lastScannedAt = toISOStringOrNull(item.lastScannedAt) ||
    toISOStringOrNull(item.extensionScrapedAt) ||
    firstSavedAt;
  
  const rawContent = item.content || (platform === 'instagram' ? 'Saved Instagram Post' : `Saved ${platform.toUpperCase()} post`);
  const cleanedContent = cleanPostContent(rawContent, platform);
  const publicOrder = Number.isFinite(Number(item.publicOrder)) ? Number(item.publicOrder) : null;

  return {
    ...item,
    id: buildBookmarkId(platform, platformItemId, item.id),
    platform,
    platformName,
    platformItemId,
    canonicalUrl: canonical,
    identityKey: item.identityKey || (platformItemId ? platform + ':' + platformItemId : 'url:' + canonical),
    source: item.source || options.source || 'social',
    authorName: item.authorName || (platform === 'instagram' ? 'Instagram Creator' : platform === 'x' ? 'X User' : platform === 'youtube' ? 'YouTube Creator' : platformName ? `${platformName} Creator` : 'Social Creator'),
    authorUsername: item.authorUsername || (platform === 'instagram' ? 'instagram_user' : platform === 'x' ? 'twitter_user' : 'user'),
    content: cleanedContent,
    postUploadedAt,
    firstSavedAt,
    lastScannedAt,
    extensionScrapedAt: firstSavedAt,
    timestamp: firstSavedAt,
    sourceSavedAt: firstSavedAt,
    createdAt: firstSavedAt,
    updatedAt: now,
    importSource: item.importSource || options.importSource || 'manual',
    hashtags: normalizeHashtags(item.hashtags, cleanedContent),
    notes: item.notes || '',
    thumbnail: item.thumbnail || item.imageUrl || "",
    favicon: item.favicon || '',
    folder: normalizeFolderValue(item.folder),
    // Sharing metadata is private by default. Normal save/import operations
    // preserve existing values in their upsert layer; these defaults are only
    // used when a bookmark is first inserted or explicitly shared.
    visibility: item.visibility === 'public' ? 'public' : 'private',
    featured: item.featured === true,
    publicOrder,
    publicTitle: String(item.publicTitle || '').trim().slice(0, 160),
    publicDescription: String(item.publicDescription || '').trim().slice(0, 280),
    visibilityUpdatedAt: toISOStringOrNull(item.visibilityUpdatedAt)
  };
}

function identityFilter(bookmark) {
  if (bookmark.platform && bookmark.platformItemId) {
    return { platform: bookmark.platform, platformItemId: bookmark.platformItemId };
  }
  return { canonicalUrl: bookmark.canonicalUrl };
}

function sortBookmarksNewestFirst(a, b) {
  const bDate = parseDate(b.firstSavedAt) || parseDate(b.createdAt) || parseDate(b.extensionScrapedAt) || new Date(0);
  const aDate = parseDate(a.firstSavedAt) || parseDate(a.createdAt) || parseDate(a.extensionScrapedAt) || new Date(0);
  const dateDiff = bDate - aDate;
  if (dateDiff !== 0) return dateDiff;
  return String(b._id || b.id || '').localeCompare(String(a._id || a.id || ''));
}

module.exports = {
  canonicalUrl,
  detectPlatform,
  extractPlatformItemId,
  identityFilter,
  normalizeBookmark,
  normalizeHashtags,
  parseDate,
  sortBookmarksNewestFirst,
  toISOStringOrNull
};
