const { ObjectId } = require('mongodb');
const { connectToDatabase } = require('./db');
const { normalizeBookmark } = require('./bookmark-utils');

const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 100;

function decodeCursor(value) {
  if (!value) return null;
  try {
    const data = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (!data.date || !ObjectId.isValid(data.id)) return null;
    return { date: data.date, id: new ObjectId(data.id) };
  } catch (error) {
    return null;
  }
}

function encodeCursor(bookmark) {
  return Buffer.from(JSON.stringify({ date: bookmark.firstSavedAt || bookmark.createdAt || bookmark.extensionScrapedAt, id: bookmark._id.toString() })).toString('base64url');
}

async function loadBookmarks(query = {}, userId) {
  const db = await connectToDatabase();
  const filter = { userId };
  const source = query.source || 'browser';
  if (source === 'browser') filter.source = 'browser';
  if (source === 'social') filter.source = { $ne: 'browser' };
  if (query.platform && query.platform !== 'all' && source !== 'browser') filter.platform = query.platform;
  if (query.collection && query.collection !== 'all') filter.folder = query.collection === "uncategorized" ? { $in: ["", null, "Bookmarks bar", "Bookmarks Bar", "bookmarks bar"] } : query.collection;

  const cursor = decodeCursor(query.cursor);
  if (cursor) {
    filter.$or = [
      { firstSavedAt: { $lt: cursor.date } },
      { firstSavedAt: cursor.date, _id: { $lt: cursor.id } }
    ];
  }

  const requestedLimit = Number.parseInt(query.limit, 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), MAX_LIMIT) : DEFAULT_LIMIT;
  const rows = await db.collection('bookmarks').find(filter).sort({ firstSavedAt: -1, _id: -1 }).limit(limit + 1).toArray();
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map(bookmark => normalizeBookmark(bookmark, { preserveCreatedAt: true }));
  const last = rows[Math.min(rows.length, limit) - 1];
  return { bookmarks: items, nextCursor: hasMore && last ? encodeCursor(last) : null, hasMore };
}

module.exports = { loadBookmarks };
