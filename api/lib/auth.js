const crypto = require('crypto');

const SESSION_COOKIE = 'socialfeed_session';
const DEFAULT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function sessionMaxAgeSeconds() {
  const configured = Number.parseInt(process.env.SESSION_MAX_AGE_SECONDS || '', 10);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_SESSION_MAX_AGE_SECONDS;
}

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

function createSessionToken(userId) {
  if (!sessionSecret()) throw new Error('SESSION_SECRET must be configured.');
  if (!userId) throw new Error('A user ID is required to create a session.');
  const payload = Buffer.from(JSON.stringify({ v: 2, userId: String(userId), exp: Date.now() + sessionMaxAgeSeconds() * 1000 })).toString('base64url');
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
    return data && data.v === 2 && data.userId && Number(data.exp) > Date.now() ? data : false;
  } catch (error) {
    return false;
  }
}

function getSession(req) {
  const session = verifySessionToken(parseCookies(req)[SESSION_COOKIE]);
  return session && session.v === 2 && session.userId ? session : null;
}

function isAuthenticated(req) {
  return Boolean(getSession(req));
}

function requireSession(req, res) {
  const session = getSession(req);
  if (session) {
    req.auth = { userId: session.userId, session };
    return true;
  }
  res.status(401).json({ error: 'Authentication required.' });
  return false;
}

function sessionCookie(token) {
  const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL ? '; Secure' : '';
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${sessionMaxAgeSeconds()}${secure}`;
}

function clearSessionCookie() {
  const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL ? '; Secure' : '';
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

module.exports = { clearSessionCookie, createSessionToken, getSession, isAuthenticated, requireSession, sessionCookie, sessionMaxAgeSeconds, verifySessionToken };
