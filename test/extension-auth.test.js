const assert = require('node:assert/strict');
const test = require('node:test');

const {
  isBrowserExtensionOrigin,
  normalizeExtensionOrigin,
  setExtensionCors
} = require('../api/lib/extension-auth');

test('recognizes extension origins used by current browser families', () => {
  assert.equal(isBrowserExtensionOrigin('chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef'), true);
  assert.equal(isBrowserExtensionOrigin('moz-extension://98f7c2b1-43d2-4d68-b572-123456789abc'), true);
  assert.equal(isBrowserExtensionOrigin('safari-web-extension://com.example.socialfeed'), true);
});

test('rejects web pages and malformed extension-like origins', () => {
  assert.equal(isBrowserExtensionOrigin('https://socialfeed.example'), false);
  assert.equal(isBrowserExtensionOrigin('null'), false);
  assert.equal(isBrowserExtensionOrigin('chrome-extension://'), false);
  assert.equal(isBrowserExtensionOrigin('chrome-extension://valid-id/extra'), false);
  assert.equal(isBrowserExtensionOrigin('chrome-extension://valid-id.example.com:443'), false);
  assert.equal(isBrowserExtensionOrigin('chrome-extens\u0000ion://valid-id'), false);
});

test('normalizes harmless casing, whitespace, and a trailing slash', () => {
  assert.equal(
    normalizeExtensionOrigin('  CHROME-EXTENSION://AbCdEf/  '),
    'chrome-extension://abcdef'
  );
});

test('sets CORS headers for a valid extension without an ID allowlist', () => {
  const headers = {};
  const req = { headers: { origin: 'moz-extension://98f7c2b1-43d2-4d68-b572-123456789abc' } };
  const res = { setHeader(name, value) { headers[name] = value; } };

  process.env.EXTENSION_ALLOWED_ORIGINS = 'chrome-extension://some-other-browser-id';
  try {
    assert.equal(setExtensionCors(req, res), true);
    assert.equal(headers['Access-Control-Allow-Origin'], req.headers.origin);
    assert.match(headers['Access-Control-Allow-Headers'], /Authorization/);
  } finally {
    delete process.env.EXTENSION_ALLOWED_ORIGINS;
  }
});

test('does not emit CORS headers for an ordinary website', () => {
  const headers = {};
  const req = { headers: { origin: 'https://evil.example' } };
  const res = { setHeader(name, value) { headers[name] = value; } };

  assert.equal(setExtensionCors(req, res), false);
  assert.deepEqual(headers, {});
});
