export const GET = ({ site }) => {
  const origin = (site || new URL('http://localhost:4321')).toString().replace(/\/$/, '');
  const body = `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /dashboard\nDisallow: /login\nDisallow: /signup\nSitemap: ${origin}/sitemap-index.xml\nSitemap: ${origin}/sitemap-profiles.xml\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
};
