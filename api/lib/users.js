const crypto = require('crypto');
const { promisify } = require('util');
const { ObjectId } = require('mongodb');
const { connectToDatabase } = require('./db');

const scryptAsync = promisify(crypto.scrypt);
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{2,29}$/;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidUsername(value) {
  return USERNAME_PATTERN.test(normalizeUsername(value));
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

function assertPassword(value) {
  if (typeof value !== 'string' || value.length < 10 || value.length > 128) {
    const error = new Error('Password must be between 10 and 128 characters.');
    error.statusCode = 400;
    throw error;
  }
}

async function hashPassword(password) {
  assertPassword(password);
  const salt = crypto.randomBytes(16);
  const derived = await scryptAsync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString('base64url')}$${Buffer.from(derived).toString('base64url')}`;
}

async function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || typeof encoded !== 'string') return false;
  const [algorithm, n, r, p, saltValue, hashValue] = encoded.split('$');
  if (algorithm !== 'scrypt' || !saltValue || !hashValue) return false;
  try {
    const derived = await scryptAsync(password, Buffer.from(saltValue, 'base64url'), 64, {
      N: Number(n), r: Number(r), p: Number(p)
    });
    const expected = Buffer.from(hashValue, 'base64url');
    const actual = Buffer.from(derived);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

async function ensureUserIndexes() {
  const db = await connectToDatabase();
  await db.collection('users').createIndexes([
    { key: { emailLower: 1 }, name: 'user_email_unique', unique: true },
    { key: { usernameLower: 1 }, name: 'user_username_unique', unique: true }
  ]);
  return db;
}

async function getUserById(userId) {
  if (!userId) return null;
  const db = await connectToDatabase();
  let id = userId;
  if (ObjectId.isValid(String(userId))) id = new ObjectId(String(userId));
  return db.collection('users').findOne({ _id: id, status: { $ne: 'disabled' } });
}

async function getUserByEmail(email) {
  const db = await connectToDatabase();
  return db.collection('users').findOne({ emailLower: normalizeEmail(email), status: { $ne: 'disabled' } });
}

async function getUserByUsername(username) {
  const db = await connectToDatabase();
  return db.collection('users').findOne({ usernameLower: normalizeUsername(username), status: { $ne: 'disabled' } });
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user._id.toString(),
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    memberSince: user.memberSince || user.createdAt
  };
}

module.exports = {
  assertPassword,
  ensureUserIndexes,
  getUserByEmail,
  getUserById,
  getUserByUsername,
  hashPassword,
  isValidEmail,
  isValidUsername,
  normalizeEmail,
  normalizeUsername,
  publicUser,
  verifyPassword
};
