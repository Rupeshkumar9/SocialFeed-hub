const crypto = require('crypto');
const { connectToDatabase, ensureExtensionIndexes } = require('./db');

const PAIRING_TTL_MS = 10 * 60 * 1000;
const DEVICE_IDLE_DEFAULT_SECONDS = 0;
const DEVICE_MAX_AGE_DEFAULT_SECONDS = 0;

function extensionSecret() {
  return process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || '';
}

function randomToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashToken(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function encryptionKey() {
  const secret = extensionSecret();
  if (!secret) throw new Error('SESSION_SECRET or ADMIN_PASSWORD must be configured.');
  return crypto.createHash('sha256').update(secret).digest();
}

function encryptValue(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString('base64url')).join('.');
}

function decryptValue(value) {
  const [ivValue, tagValue, encryptedValue] = String(value || '').split('.');
  if (!ivValue || !tagValue || !encryptedValue) throw new Error('Invalid encrypted value.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final()
  ]).toString('utf8');
}

function configuredSeconds(name, fallback) {
  const value = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function deviceExpiry(now = Date.now()) {
  const maxAge = configuredSeconds('EXTENSION_DEVICE_MAX_AGE_SECONDS', DEVICE_MAX_AGE_DEFAULT_SECONDS);
  return maxAge ? new Date(now + maxAge * 1000) : null;
}

function publicOrigin(req) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const protocol = forwardedProto || (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  return `${protocol}://${host}`;
}

function normalizePairingInput(body) {
  const pairingId = typeof body?.pairingId === 'string' ? body.pairingId.trim() : '';
  const secret = typeof body?.secret === 'string' ? body.secret.trim() : '';
  return { pairingId, secret };
}

async function createPairingRequest(req) {
  await ensureExtensionIndexes();
  const db = await connectToDatabase();
  const pairingId = randomToken();
  const secret = randomToken();
  const expiresAt = new Date(Date.now() + PAIRING_TTL_MS);
  await db.collection('extension_pairing_requests').insertOne({
    pairingId,
    secretHash: hashToken(secret),
    status: 'pending',
    createdAt: new Date(),
    expiresAt
  });
  const connectUrl = `${publicOrigin(req)}/extension-connect.html?pairingId=${encodeURIComponent(pairingId)}&secret=${encodeURIComponent(secret)}`;
  return { pairingId, secret, expiresAt: expiresAt.toISOString(), connectUrl };
}

async function authorizePairing(body, req) {
  const { pairingId, secret } = normalizePairingInput(body);
  if (!pairingId || !secret) return { ok: false, status: 400, error: 'Pairing request is incomplete.' };
  await ensureExtensionIndexes();
  const db = await connectToDatabase();
  const pairings = db.collection('extension_pairing_requests');
  const request = await pairings.findOne({ pairingId });
  if (!request || request.expiresAt <= new Date() || !safeEqual(request.secretHash, hashToken(secret))) {
    return { ok: false, status: 404, error: 'This pairing request has expired or is invalid.' };
  }

  if (request.status === 'authorized' && request.encryptedToken) {
    return { ok: true, alreadyAuthorized: true };
  }

  const token = randomToken();
  const now = new Date();
  const device = {
    userId: req.auth?.userId || '',
    tokenHash: hashToken(token),
    label: typeof body?.label === 'string' && body.label.trim() ? body.label.trim().slice(0, 100) : 'Browser extension',
    status: 'active',
    createdAt: now,
    lastUsedAt: null,
    expiresAt: deviceExpiry(now.getTime())
  };
  const result = await db.collection('extension_devices').insertOne(device);
  const transition = await pairings.updateOne(
    { _id: request._id, status: 'pending' },
    { $set: { status: 'authorized', deviceId: result.insertedId, encryptedToken: encryptValue(token), authorizedAt: now } }
  );
  if (!transition.modifiedCount) {
    await db.collection('extension_devices').deleteOne({ _id: result.insertedId });
    return { ok: true, alreadyAuthorized: true };
  }
  return { ok: true };
}

async function consumePairingStatus(body) {
  const { pairingId, secret } = normalizePairingInput(body);
  if (!pairingId || !secret) return { ok: false, status: 400, error: 'Pairing request is incomplete.' };
  await ensureExtensionIndexes();
  const db = await connectToDatabase();
  const request = await db.collection('extension_pairing_requests').findOne({ pairingId });
  if (!request || request.expiresAt <= new Date() || !safeEqual(request.secretHash, hashToken(secret))) {
    return { ok: false, status: 404, error: 'This pairing request has expired or is invalid.' };
  }
  if (request.status !== 'authorized' || !request.encryptedToken) return { ok: true, status: 'pending' };
  return {
    ok: true,
    status: 'authorized',
    deviceId: request.deviceId?.toString() || '',
    token: decryptValue(request.encryptedToken)
  };
}

function extractExtensionToken(req) {
  const authorization = req.headers.authorization || '';
  if (typeof authorization === 'string' && /^Bearer\s+/i.test(authorization)) return authorization.replace(/^Bearer\s+/i, '').trim();
  return req.headers['x-extension-token'] || '';
}

async function authorizeExtensionDevice(req) {
  const token = extractExtensionToken(req);
  const legacy = process.env.EXTENSION_SYNC_TOKEN || '';
  if (legacy && typeof token === 'string' && safeEqual(token, legacy)) return { authorized: true, legacy: true, userId: process.env.LEGACY_EXTENSION_USER_ID || '' };
  if (!token || typeof token !== 'string') return { authorized: false };

  await ensureExtensionIndexes();
  const db = await connectToDatabase();
  const device = await db.collection('extension_devices').findOne({ tokenHash: hashToken(token), status: 'active' });
  if (!device) return { authorized: false };
  const now = Date.now();
  const idleSeconds = configuredSeconds('EXTENSION_DEVICE_IDLE_SECONDS', DEVICE_IDLE_DEFAULT_SECONDS);
  if ((device.expiresAt && new Date(device.expiresAt).getTime() <= now) || (idleSeconds && device.lastUsedAt && new Date(device.lastUsedAt).getTime() + idleSeconds * 1000 <= now)) {
    await db.collection('extension_devices').updateOne({ _id: device._id }, { $set: { status: 'revoked', revokedAt: new Date() } });
    return { authorized: false };
  }
  await db.collection('extension_devices').updateOne({ _id: device._id }, { $set: { lastUsedAt: new Date() } });
  return { authorized: true, legacy: false, userId: device.userId?.toString() || '', device };
}

async function revokeExtensionDevice(req) {
  const token = extractExtensionToken(req);
  if (!token || typeof token !== 'string') return false;
  await ensureExtensionIndexes();
  const db = await connectToDatabase();
  const result = await db.collection('extension_devices').updateOne(
    { tokenHash: hashToken(token), userId: req.auth?.userId, status: 'active' },
    { $set: { status: 'revoked', revokedAt: new Date() } }
  );
  return result.modifiedCount > 0;
}

async function listExtensionDevices(userId) {
  await ensureExtensionIndexes();
  const db = await connectToDatabase();
  return db.collection('extension_devices').find({ userId, status: 'active' }, { projection: { tokenHash: 0 } }).sort({ lastUsedAt: -1, createdAt: -1 }).toArray();
}

async function revokeAllExtensionDevices(userId) {
  await ensureExtensionIndexes();
  const db = await connectToDatabase();
  const result = await db.collection('extension_devices').updateMany({ userId, status: 'active' }, { $set: { status: 'revoked', revokedAt: new Date() } });
  return result.modifiedCount;
}

module.exports = {
  authorizeExtensionDevice,
  authorizePairing,
  consumePairingStatus,
  createPairingRequest,
  extractExtensionToken,
  listExtensionDevices,
  revokeAllExtensionDevices,
  revokeExtensionDevice
};
