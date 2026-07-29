const { MongoClient } = require('mongodb');

let cachedDb = null;
let indexesPromise = null;

async function connectToDatabase() {
  if (cachedDb) {
    return cachedDb;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Please define the MONGODB_URI environment variable inside your Vercel project settings.');
  }

  const client = await MongoClient.connect(uri);

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

module.exports = { connectToDatabase, ensureBookmarkIndexes };
