import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const prerender = false;

function xmlEscape(value) {
  return String(value).replace(/[<>&'\"]/g, character => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '\"': '&quot;' }[character]));
}

export const GET = async ({ site }) => {
  const origin = new URL(site || 'http://localhost:3000');
  const urls = [];
  try {
    const profileModule = path.resolve(process.cwd(), 'api/lib/public-profile.js');
    const require = createRequire(pathToFileURL(profileModule).href);
    const { getProfile } = require(profileModule);
    const { profile } = await getProfile({ publishedOnly: true });
    if (profile?.username) urls.push(new URL(`/u/${encodeURIComponent(profile.username)}/`, origin).href);
  } catch (error) {
    // A sitemap must never expose a username when the profile lookup fails.
    console.error('Public profile sitemap lookup failed:', error.message);
  }
  const body = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url => `<url><loc>${xmlEscape(url)}</loc></url>`).join('')}</urlset>`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
};
