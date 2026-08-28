const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const { MongoClient } = require('mongodb');
const { EJSON } = require('bson');
const { normalizeBookmark } = require('../api/lib/bookmark-utils');
const { verifyPassword } = require('../api/lib/users');

const scryptAsync = promisify(crypto.scrypt);
const TARGET_DATABASE = 'socialfeed_db';
const MIGRATION_NAME = 'single-user-to-multi-user-v1';

function unquote(value) {
  const trimmed = String(value || '').trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function readCommentedLegacyEnvironment() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return new Map();
  const values = new Map();
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^#\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (match && !values.has(match[1])) values.set(match[1], unquote(match[2]));
  }
  return values;
}

function required(value, name) {
  if (!value) throw new Error(`${name} is required for this migration.`);
  return value;
}

function databaseNameFromUri(uri) {
  try {
    return new URL(uri).pathname.slice(1).split('?')[0];
  } catch {
    return '';
  }
}

function redactEmail(email) {
  const [local, domain] = String(email).split('@');
  return domain ? `${local.slice(0, 2)}***@${domain}` : '[invalid email]';
}

async function hashPassword(password) {
  if (password.length < 10 || password.length > 128) {
    throw new Error('The legacy ADMIN_PASSWORD must be between 10 and 128 characters.');
  }
  const salt = crypto.randomBytes(16);
  const derived = await scryptAsync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString('base64url')}$${Buffer.from(derived).toString('base64url')}`;
}

function migrationConfig() {
  require('dotenv').config();
  const legacy = readCommentedLegacyEnvironment();
  const uri = process.env.MIGRATION_MONGODB_URI || legacy.get('MONGODB_URI') || process.env.MONGODB_URI;
  const email = (process.env.MIGRATION_PROFILE_EMAIL || legacy.get('PROFILE_EMAIL') || process.env.PROFILE_EMAIL || '').trim().toLowerCase();
  const displayName = (process.env.MIGRATION_PROFILE_NAME || legacy.get('PROFILE_NAME') || process.env.PROFILE_NAME || '').trim();
  const password = process.env.MIGRATION_ADMIN_PASSWORD || legacy.get('ADMIN_PASSWORD') || process.env.ADMIN_PASSWORD || '';
  const memberSinceValue = process.env.MIGRATION_MEMBER_SINCE || legacy.get('MEMBER_SINCE') || process.env.MEMBER_SINCE;

  required(uri, 'MIGRATION_MONGODB_URI or the production MONGODB_URI');
  required(email, 'MIGRATION_PROFILE_EMAIL or PROFILE_EMAIL');
  required(displayName, 'MIGRATION_PROFILE_NAME or PROFILE_NAME');
  required(password, 'MIGRATION_ADMIN_PASSWORD or ADMIN_PASSWORD');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('The migration profile email is invalid.');
  if (databaseNameFromUri(uri) !== TARGET_DATABASE) {
    throw new Error(`Refusing to run: the connection URI must explicitly target ${TARGET_DATABASE}.`);
  }
  const memberSince = memberSinceValue ? new Date(memberSinceValue) : new Date();
  if (Number.isNaN(memberSince.getTime())) throw new Error('MEMBER_SINCE is not a valid date.');
  return { uri, email, displayName, password, memberSince };
}

function bookmarkIdentity(bookmark) {
  if (typeof bookmark.identityKey === 'string' && bookmark.identityKey.trim()) return bookmark.identityKey;
  return normalizeBookmark(bookmark, { preserveCreatedAt: true }).identityKey;
}

async function backupDatabase(db) {
  const collections = ['users', 'public_profiles', 'bookmarks', 'extension_devices', 'extension_pairing_requests'];
  const backup = { database: TARGET_DATABASE, createdAt: new Date(), collections: {} };
  for (const name of collections) {
    const collection = db.collection(name);
    backup.collections[name] = {
      documents: await collection.find({}).toArray(),
      indexes: await collection.indexes()
    };
  }
  const directory = path.resolve(process.cwd(), '.migration-backups');
  fs.mkdirSync(directory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(directory, `${TARGET_DATABASE}-${timestamp}.ejson`);
  fs.writeFileSync(file, EJSON.stringify(backup, null, 2), { encoding: 'utf8', flag: 'wx' });
  return file;
}

async function inspect(db) {
  const [users, profiles, bookmarks, devices, pairings] = await Promise.all([
    db.collection('users').countDocuments(),
    db.collection('public_profiles').find({}).project({ username: 1, usernameLower: 1, displayName: 1, userId: 1 }).toArray(),
    db.collection('bookmarks').find({}).project({ _id: 1, id: 1, userId: 1, identityKey: 1, platform: 1, platformItemId: 1, canonicalUrl: 1, url: 1, source: 1, visibility: 1 }).toArray(),
    db.collection('extension_devices').countDocuments(),
    db.collection('extension_pairing_requests').countDocuments()
  ]);

  if (profiles.length !== 1) throw new Error(`Expected exactly one legacy public profile; found ${profiles.length}.`);
  const profile = profiles[0];
  const username = String(profile.usernameLower || profile.username || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{2,29}$/.test(username)) throw new Error('The legacy public profile has no valid username.');

  const finalIdentities = new Set();
  let missingUserId = 0;
  let missingIdentityKey = 0;
  let ownedBookmarks = 0;
  for (const bookmark of bookmarks) {
    if (!bookmark.userId) missingUserId++;
    else ownedBookmarks++;
    const identityKey = bookmarkIdentity(bookmark);
    if (!bookmark.identityKey) missingIdentityKey++;
    if (finalIdentities.has(identityKey)) {
      throw new Error(`Duplicate final bookmark identity detected: ${identityKey}. Resolve duplicates before applying the migration.`);
    }
    finalIdentities.add(identityKey);
  }
  if (ownedBookmarks && missingUserId) {
    throw new Error('Bookmarks contain a mixture of owned and unowned records; refusing an ambiguous migration.');
  }
  return { users, profile, username, bookmarks, devices, pairings, missingUserId, missingIdentityKey };
}

async function ensureIndexes(db) {
  const bookmarks = db.collection('bookmarks');
  try {
    await bookmarks.dropIndex('bookmark_identity_unique');
  } catch (error) {
    if (error.codeName !== 'IndexNotFound') throw error;
  }
  await Promise.all([
    db.collection('users').createIndexes([
      { key: { emailLower: 1 }, name: 'user_email_unique', unique: true },
      { key: { usernameLower: 1 }, name: 'user_username_unique', unique: true }
    ]),
    bookmarks.createIndexes([
      { key: { userId: 1, identityKey: 1 }, name: 'bookmark_user_identity_unique', unique: true, partialFilterExpression: { identityKey: { $type: 'string' }, userId: { $type: 'string' } } },
      { key: { source: 1, firstSavedAt: -1, _id: -1 }, name: 'bookmark_source_feed' },
      { key: { platform: 1, firstSavedAt: -1, _id: -1 }, name: 'bookmark_platform_feed' },
      { key: { userId: 1, source: 1, firstSavedAt: -1, _id: -1 }, name: 'bookmark_user_source_feed' },
      { key: { visibility: 1, source: 1, firstSavedAt: -1, _id: -1 }, name: 'public_source_feed' },
      { key: { visibility: 1, platform: 1, firstSavedAt: -1, _id: -1 }, name: 'public_platform_feed' },
      { key: { userId: 1, visibility: 1, source: 1, firstSavedAt: -1, _id: -1 }, name: 'public_user_source_feed' }
    ]),
    db.collection('public_profiles').createIndex({ usernameLower: 1 }, { name: 'public_profile_username_unique', unique: true }),
    db.collection('extension_devices').createIndexes([
      { key: { tokenHash: 1 }, name: 'extension_device_token_unique', unique: true },
      { key: { userId: 1, status: 1, lastUsedAt: -1 }, name: 'extension_device_user_status' }
    ]),
    db.collection('extension_pairing_requests').createIndexes([
      { key: { pairingId: 1 }, name: 'extension_pairing_id_unique', unique: true },
      { key: { expiresAt: 1 }, name: 'extension_pairing_expiry', expireAfterSeconds: 0 }
    ])
  ]);
}

async function migrate(db, config, state) {
  const now = new Date();
  const existingByEmail = await db.collection('users').findOne({ emailLower: config.email });
  const existingByUsername = await db.collection('users').findOne({ usernameLower: state.username });
  if (existingByEmail && existingByUsername && String(existingByEmail._id) !== String(existingByUsername._id)) {
    throw new Error('The migration email and username belong to different users.');
  }
  let user = existingByEmail || existingByUsername;
  if (!user) {
    if (state.users !== 0) throw new Error('Users already exist but none match the legacy profile; refusing to guess ownership.');
    user = {
      email: config.email,
      emailLower: config.email,
      username: state.username,
      usernameLower: state.username,
      displayName: config.displayName,
      passwordHash: await hashPassword(config.password),
      status: 'active',
      memberSince: config.memberSince,
      createdAt: now,
      updatedAt: now
    };
    const inserted = await db.collection('users').insertOne(user);
    user._id = inserted.insertedId;
  }
  if (!(await verifyPassword(config.password, user.passwordHash))) {
    throw new Error('The stored owner password hash does not match the supplied legacy ADMIN_PASSWORD.');
  }
  const userId = String(user._id);

  const operations = state.bookmarks.map(bookmark => {
    const set = {};
    if (!bookmark.userId) set.userId = userId;
    if (!bookmark.identityKey) set.identityKey = bookmarkIdentity(bookmark);
    if (!bookmark.source) set.source = bookmark.platform && bookmark.platform !== 'web' ? 'social' : 'browser';
    if (!bookmark.visibility) set.visibility = 'private';
    return Object.keys(set).length ? { updateOne: { filter: { _id: bookmark._id }, update: { $set: set } } } : null;
  }).filter(Boolean);
  if (operations.length) await db.collection('bookmarks').bulkWrite(operations, { ordered: true });

  await Promise.all([
    db.collection('public_profiles').updateOne(
      { _id: state.profile._id },
      { $set: { userId, username: state.username, usernameLower: state.username, displayName: config.displayName, updatedAt: now.toISOString() } }
    ),
    db.collection('extension_devices').updateMany(
      { $or: [{ userId: { $exists: false } }, { userId: null }, { userId: '' }] },
      { $set: { userId } }
    )
  ]);
  await ensureIndexes(db);

  const verification = {
    users: await db.collection('users').countDocuments(),
    bookmarksWithoutUserId: await db.collection('bookmarks').countDocuments({ $or: [{ userId: { $exists: false } }, { userId: null }, { userId: '' }] }),
    bookmarksWithoutIdentityKey: await db.collection('bookmarks').countDocuments({ $or: [{ identityKey: { $exists: false } }, { identityKey: null }, { identityKey: '' }] }),
    profilesWithoutUserId: await db.collection('public_profiles').countDocuments({ $or: [{ userId: { $exists: false } }, { userId: null }, { userId: '' }] }),
    devicesWithoutUserId: await db.collection('extension_devices').countDocuments({ $or: [{ userId: { $exists: false } }, { userId: null }, { userId: '' }] })
  };
  if (Object.entries(verification).some(([key, value]) => key !== 'users' && value !== 0)) {
    throw new Error(`Migration verification failed: ${JSON.stringify(verification)}`);
  }
  return { userId, verification };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const config = migrationConfig();
  const client = new MongoClient(config.uri, { serverSelectionTimeoutMS: 15000, connectTimeoutMS: 15000 });
  try {
    await client.connect();
    const db = client.db(TARGET_DATABASE);
    const state = await inspect(db);
    console.log(JSON.stringify({
      migration: MIGRATION_NAME,
      mode: apply ? 'apply' : 'dry-run',
      database: TARGET_DATABASE,
      owner: { email: redactEmail(config.email), username: state.username, displayName: config.displayName },
      current: {
        users: state.users,
        publicProfiles: 1,
        bookmarks: state.bookmarks.length,
        bookmarksWithoutUserId: state.missingUserId,
        bookmarksWithoutIdentityKey: state.missingIdentityKey,
        extensionDevices: state.devices,
        pairingRequests: state.pairings
      }
    }, null, 2));
    if (!apply) {
      console.log('Dry run complete. Re-run with --apply after taking an Atlas backup.');
      return;
    }
    const backupFile = await backupDatabase(db);
    console.log(`Backup written to ${backupFile}`);
    const result = await migrate(db, config, state);
    console.log(JSON.stringify({ migration: MIGRATION_NAME, status: 'complete', ...result }, null, 2));
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(`${MIGRATION_NAME} failed:`, error.message);
    process.exitCode = 1;
  });
}

module.exports = { bookmarkIdentity, databaseNameFromUri, inspect, migrationConfig };
