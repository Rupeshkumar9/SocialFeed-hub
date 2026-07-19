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

function normalizeTags(tags, platform, content = '') {
  const out = new Set(['imported']);
  if (platform === 'x') out.add('x-post');
  if (platform && platform !== 'x' && platform !== 'web') out.add(platform);

  if (Array.isArray(tags)) {
    tags.forEach(tag => {
      const clean = String(tag || '').toLowerCase().replace(/^#/, '').trim();
      if (clean) out.add(clean);
    });
  }

  const hashtagRegex = /#([\w-]+)/g;
  let match;
  while ((match = hashtagRegex.exec(String(content || ''))) !== null) {
    out.add(match[1].toLowerCase());
  }

  return Array.from(out);
}

function normalizeBookmark(item = {}, options = {}) {
  const now = options.now || new Date().toISOString();
  const platform = item.platform || detectPlatform(item.url);
  const platformItemId = item.platformItemId || extractPlatformItemId(item.url, platform);
  const canonical = item.canonicalUrl || canonicalUrl(item.url);
  const sourceSavedAt = toISOStringOrNull(item.sourceSavedAt || item.timestamp);
  const createdAt = toISOStringOrNull(item.createdAt) || (options.preserveCreatedAt ? sourceSavedAt : now) || now;

  return {
    ...item,
    id: buildBookmarkId(platform, platformItemId, item.id),
    platform,
    platformItemId,
    canonicalUrl: canonical,
    authorName: item.authorName || (platform === 'instagram' ? 'Instagram Creator' : platform === 'x' ? 'X User' : 'Social Creator'),
    authorUsername: item.authorUsername || (platform === 'instagram' ? 'instagram_user' : platform === 'x' ? 'twitter_user' : 'user'),
    content: item.content || (platform === 'instagram' ? 'Saved Instagram Post' : `Saved ${platform.toUpperCase()} post`),
    timestamp: sourceSavedAt || createdAt,
    sourceSavedAt: sourceSavedAt || createdAt,
    createdAt,
    updatedAt: now,
    importSource: item.importSource || options.importSource || 'manual',
    tags: normalizeTags(item.tags, platform, item.content),
    notes: item.notes || '',
    thumbnail: item.thumbnail || item.imageUrl || ''
  };
}

function identityFilter(bookmark) {
  if (bookmark.platform && bookmark.platformItemId) {
    return { platform: bookmark.platform, platformItemId: bookmark.platformItemId };
  }
  return { canonicalUrl: bookmark.canonicalUrl };
}

function sortBookmarksNewestFirst(a, b) {
  const bDate = parseDate(b.createdAt) || parseDate(b.timestamp) || parseDate(b.sourceSavedAt) || new Date(0);
  const aDate = parseDate(a.createdAt) || parseDate(a.timestamp) || parseDate(a.sourceSavedAt) || new Date(0);
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
  normalizeTags,
  parseDate,
  sortBookmarksNewestFirst,
  toISOStringOrNull
};
