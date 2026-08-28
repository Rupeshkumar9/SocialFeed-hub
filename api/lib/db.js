const { MongoClient } = require('mongodb');

let cachedDb = null;
let indexesPromise = null;
let extensionIndexesPromise = null;
let publicProfileIndexesPromise = null;
let userIndexesPromise = null;

function normalizedIndexValue(value) {
  if (Array.isArray(value)) return value.map(normalizedIndexValue);
  if (!value || typeof value !== 'object') return value ?? null;
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = normalizedIndexValue(value[key]);
    return result;
  }, {});
}

function indexMatches(existing, desired) {
  return JSON.stringify(normalizedIndexValue(existing.key)) === JSON.stringify(normalizedIndexValue(desired.key))
    && Boolean(existing.unique) === Boolean(desired.unique)
    && JSON.stringify(normalizedIndexValue(existing.partialFilterExpression)) === JSON.stringify(normalizedIndexValue(desired.partialFilterExpression))
    && (existing.expireAfterSeconds ?? null) === (desired.expireAfterSeconds ?? null);
}

async function ensureIndexes(collection, definitions) {
  const existingIndexes = await collection.listIndexes().toArray();
  const existingByName = new Map(existingIndexes.map(index => [index.name, index]));

  for (const definition of definitions) {
    const existing = existingByName.get(definition.name);
    if (existing && !indexMatches(existing, definition)) {
      await collection.dropIndex(definition.name);
    }
  }

  return collection.createIndexes(definitions);
}

async function connectToDatabase() {
  if (cachedDb) {
    return cachedDb;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Please define the MONGODB_URI environment variable inside your Vercel project settings.');
  }

  const timeoutMs = Number.parseInt(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || '5000', 10);
  const connectOptions = Number.isFinite(timeoutMs) && timeoutMs > 0
    ? { serverSelectionTimeoutMS: timeoutMs, connectTimeoutMS: timeoutMs }
    : undefined;
  const client = await MongoClient.connect(uri, connectOptions);

  // Extract database name from the Atlas connection string path (e.g. cluster0.mongodb.net/dbname)
  let dbName = 'bookmarks_db';
  try {
    const urlObj = new URL(uri);
    const pathDb = urlObj.pathname.substring(1).split('?')[0];
    if (pathDb) {
      dbName = pathDb;
    }
  } catch (e) {
    // Fallback if URL parsing fails
  }

  const db = client.db(dbName);
  cachedDb = db;
  return db;
}

async function ensureBookmarkIndexes() {
  if (!indexesPromise) {
    indexesPromise = connectToDatabase().then(async db => {
      const bookmarks = db.collection('bookmarks');
      try { await bookmarks.dropIndex('bookmark_identity_unique'); } catch (error) { if (error.codeName !== 'IndexNotFound') throw error; }
      return ensureIndexes(bookmarks, [
      { key: { userId: 1, identityKey: 1 }, name: 'bookmark_user_identity_unique', unique: true, partialFilterExpression: { identityKey: { $type: 'string' }, userId: { $type: 'string' } } },
      { key: { source: 1, firstSavedAt: -1, _id: -1 }, name: 'bookmark_source_feed' },
      { key: { platform: 1, firstSavedAt: -1, _id: -1 }, name: 'bookmark_platform_feed' },
      { key: { userId: 1, source: 1, firstSavedAt: -1, _id: -1 }, name: 'bookmark_user_source_feed' }
    ]);
    }).catch(error => {
      indexesPromise = null;
      throw error;
    });
  }
  return indexesPromise;
}

async function ensureUserIndexes() {
  if (!userIndexesPromise) {
    userIndexesPromise = connectToDatabase().then(db => ensureIndexes(db.collection('users'), [
      { key: { emailLower: 1 }, name: 'user_email_unique', unique: true },
      { key: { usernameLower: 1 }, name: 'user_username_unique', unique: true }
    ])).catch(error => { userIndexesPromise = null; throw error; });
  }
  return userIndexesPromise;
}

async function ensureExtensionIndexes() {
  if (!extensionIndexesPromise) {
    extensionIndexesPromise = connectToDatabase().then(db => Promise.all([
      ensureIndexes(db.collection('extension_devices'), [
        { key: { tokenHash: 1 }, name: 'extension_device_token_unique', unique: true },
        { key: { userId: 1, status: 1, lastUsedAt: -1 }, name: 'extension_device_user_status' }
      ]),
      ensureIndexes(db.collection('extension_pairing_requests'), [
        { key: { pairingId: 1 }, name: 'extension_pairing_id_unique', unique: true },
        { key: { expiresAt: 1 }, name: 'extension_pairing_expiry', expireAfterSeconds: 0 }
      ])
    ])).catch(error => {
      extensionIndexesPromise = null;
      throw error;
    });
  }
  return extensionIndexesPromise;
}

async function ensurePublicProfileIndexes() {
  if (!publicProfileIndexesPromise) {
    publicProfileIndexesPromise = connectToDatabase().then(db => Promise.all([
      ensureIndexes(db.collection('public_profiles'), [
        { key: { usernameLower: 1 }, name: 'public_profile_username_unique', unique: true }
      ]),
      ensureIndexes(db.collection('bookmarks'), [
        { key: { visibility: 1, source: 1, firstSavedAt: -1, _id: -1 }, name: 'public_source_feed' },
        { key: { visibility: 1, platform: 1, firstSavedAt: -1, _id: -1 }, name: 'public_platform_feed' },
        { key: { userId: 1, visibility: 1, source: 1, firstSavedAt: -1, _id: -1 }, name: 'public_user_source_feed' }
      ])
    ])).catch(error => {
      publicProfileIndexesPromise = null;
      throw error;
    });
  }
  return publicProfileIndexesPromise;
}

module.exports = { connectToDatabase, ensureBookmarkIndexes, ensureExtensionIndexes, ensurePublicProfileIndexes, ensureUserIndexes };
