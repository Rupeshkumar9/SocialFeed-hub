const { MongoClient } = require('mongodb');

let cachedDb = null;
let indexesPromise = null;
let extensionIndexesPromise = null;
let publicProfileIndexesPromise = null;

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
    indexesPromise = connectToDatabase().then(db => db.collection('bookmarks').createIndexes([
      { key: { identityKey: 1 }, name: 'bookmark_identity_unique', unique: true, partialFilterExpression: { identityKey: { $exists: true } } },
      { key: { source: 1, firstSavedAt: -1, _id: -1 }, name: 'bookmark_source_feed' },
      { key: { platform: 1, firstSavedAt: -1, _id: -1 }, name: 'bookmark_platform_feed' }
    ])).catch(error => {
      indexesPromise = null;
      throw error;
    });
  }
  return indexesPromise;
}

async function ensureExtensionIndexes() {
  if (!extensionIndexesPromise) {
    extensionIndexesPromise = connectToDatabase().then(db => Promise.all([
      db.collection('extension_devices').createIndexes([
        { key: { tokenHash: 1 }, name: 'extension_device_token_unique', unique: true },
        { key: { status: 1, lastUsedAt: -1 }, name: 'extension_device_status' }
      ]),
      db.collection('extension_pairing_requests').createIndexes([
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
      db.collection('public_profiles').createIndexes([
        { key: { usernameLower: 1 }, name: 'public_profile_username_unique', unique: true }
      ]),
      db.collection('bookmarks').createIndexes([
        { key: { visibility: 1, source: 1, firstSavedAt: -1, _id: -1 }, name: 'public_source_feed' },
        { key: { visibility: 1, platform: 1, firstSavedAt: -1, _id: -1 }, name: 'public_platform_feed' }
      ])
    ])).catch(error => {
      publicProfileIndexesPromise = null;
      throw error;
    });
  }
  return publicProfileIndexesPromise;
}

module.exports = { connectToDatabase, ensureBookmarkIndexes, ensureExtensionIndexes, ensurePublicProfileIndexes };
