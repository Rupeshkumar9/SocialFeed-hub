const dns = require('dns').promises;
const net = require('net');
const { requireSession } = require('./lib/auth');
const { canonicalUrl, detectPlatform } = require('./lib/bookmark-utils');

const MAX_HTML_BYTES = 1024 * 1024;

function isPrivateIp(address) {
  if (net.isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168;
  }
  const value = address.toLowerCase();
  return value === '::1' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe80:');
}

async function validatePublicUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch (error) {
    throw new Error('Enter a valid URL.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Only public http(s) links can be previewed.');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || net.isIP(host) && isPrivateIp(host)) throw new Error('Private or local links cannot be previewed.');
  const addresses = await dns.lookup(host, { all: true });
  if (!addresses.length || addresses.some(item => isPrivateIp(item.address))) throw new Error('Private or local links cannot be previewed.');
  return url;
}

function getMeta(html, names) {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i');
    const reverse = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, 'i');
    const match = html.match(pattern) || html.match(reverse);
    if (match && match[1]) return decodeEntities(match[1].trim());
  }
  return '';
}

function decodeEntities(value) {
  return value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function getTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeEntities(match[1].replace(/\s+/g, ' ').trim()) : '';
}

function getTagAttribute(tag, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = tag.match(new RegExp(`\\b${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match ? decodeEntities((match[1] || match[2] || match[3] || '').trim()) : '';
}

function getFaviconHref(html) {
  const candidates = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    const rel = getTagAttribute(tag, 'rel').toLowerCase();
    const href = getTagAttribute(tag, 'href');
    if (!href || !rel.split(/\s+/).some(token => token === 'icon' || token.endsWith('-icon'))) continue;
    const sizes = getTagAttribute(tag, 'sizes');
    const type = getTagAttribute(tag, 'type').toLowerCase();
    const largestSize = Math.max(0, ...(sizes.match(/\d+/g) || []).map(Number));
    const score = (type.includes('svg') ? 400 : 0) + (rel.includes('apple-touch-icon') ? 300 : 100) + largestSize;
    candidates.push({ href, score });
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] ? candidates[0].href : '';
}

async function getFaviconUrl(html, pageUrl) {
  const declaredHref = getFaviconHref(html);
  for (const candidate of [declaredHref, '/favicon.ico']) {
    if (!candidate) continue;
    try {
      const resolved = new URL(candidate, pageUrl);
      if (!['http:', 'https:'].includes(resolved.protocol) || resolved.username || resolved.password) continue;
      if (resolved.hostname !== pageUrl.hostname) await validatePublicUrl(resolved.toString());
      return resolved.toString();
    } catch {
      // Try the conventional same-origin favicon next.
    }
  }
  return '';
}

module.exports = async (req, res) => {
  if (!requireSession(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  try {
    let url = await validatePublicUrl(req.body && req.body.url);
    let response;
    for (let redirects = 0; redirects < 4; redirects++) {
      response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(7000), headers: { 'User-Agent': 'SocialFeedHub/1.0 link preview' } });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get('location');
      if (!location) throw new Error('The link redirected without a destination.');
      url = await validatePublicUrl(new URL(location, url).toString());
    }
    if (!response || !response.ok) throw new Error('Could not retrieve link metadata.');
    const contentType = response.headers.get('content-type') || '';
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (!contentType.includes('text/html') || contentLength > MAX_HTML_BYTES) throw new Error('This link does not provide a safe HTML preview.');
    const html = (await response.text()).slice(0, MAX_HTML_BYTES);
    const title = getMeta(html, ['og:title', 'twitter:title']) || getTitle(html) || url.hostname;
    const description = getMeta(html, ['og:description', 'twitter:description', 'description']);
    const image = getMeta(html, ['og:image', 'twitter:image']);
    const siteName = getMeta(html, ['og:site_name']) || url.hostname;
    const favicon = await getFaviconUrl(html, url);
    return res.status(200).json({ url: url.toString(), canonicalUrl: canonicalUrl(url.toString()), platform: detectPlatform(url.toString()), title, description, image, favicon, siteName });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Unable to preview that link.' });
  }
};
