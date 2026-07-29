const crypto = require('crypto');

const SESSION_COOKIE = 'socialfeed_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

function parseCookies(req) {
  const header = req.headers && req.headers.cookie;
  if (!header) return {};
  return header.split(';').reduce((cookies, item) => {
    const index = item.indexOf('=');
    if (index === -1) return cookies;
    const key = item.slice(0, index).trim();
    const value = item.slice(index + 1).trim();
    cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function sessionSecret() {
  return process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || '';
}

function sign(value) {
  return crypto.createHmac('sha256', sessionSecret()).update(value).digest('base64url');
}

function createSessionToken() {
  if (!sessionSecret()) throw new Error('SESSION_SECRET must be configured.');
  const payload = Buffer.from(JSON.stringify({ v: 1, exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function verifySessionToken(token) {
  if (!token || !sessionSecret()) return false;
  const [payload, signature] = String(token).split('.');
  if (!payload || !signature) return false;
  const expected = sign(payload);
  const valid = signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!valid) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data && data.v === 1 && Number(data.exp) > Date.now();
  } catch (error) {
    return false;
  }
}

function isAuthenticated(req) {
  return verifySessionToken(parseCookies(req)[SESSION_COOKIE]);
}

function requireSession(req, res) {
  if (isAuthenticated(req)) return true;
  res.status(401).json({ error: 'Authentication required.' });
  return false;
}

function sessionCookie(token) {
  const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL ? '; Secure' : '';
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`;
}

function clearSessionCookie() {
  const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL ? '; Secure' : '';
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

function hasValidPassword(value) {
  const expected = process.env.ADMIN_PASSWORD || '';
  if (!expected || typeof value !== 'string' || value.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}

module.exports = { clearSessionCookie, createSessionToken, hasValidPassword, isAuthenticated, requireSession, sessionCookie };
