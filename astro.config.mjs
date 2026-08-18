import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';
import { fileURLToPath } from 'node:url';

const site = process.env.PUBLIC_SITE_URL || 'http://localhost:3000';
const pricingIndexable = process.env.PUBLIC_PRICING_INDEXABLE === 'true';
const blogIndexable = process.env.PUBLIC_BLOG_INDEXABLE === 'true';

function isIndexablePage(page) {
  if (/\/(?:dashboard|login|signup)(?:\/|$)/.test(page)) return false;
  if (!pricingIndexable && /\/pricing\/?$/.test(page)) return false;
  if (!blogIndexable && /\/blog(?:\/|$)/.test(page)) return false;
  return true;
}

export default defineConfig({
  site,
  srcDir: fileURLToPath(new URL('./client/src/', import.meta.url)),
  publicDir: fileURLToPath(new URL('./client/public/', import.meta.url)),
  output: 'server',
  outDir: fileURLToPath(new URL('./dist/astro/', import.meta.url)),
  adapter: node({ mode: 'middleware' }),
  integrations: [sitemap({ filter: isIndexablePage })],
  vite: {
    server: {
      port: 4321,
      host: true,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true
        }
      }
    }
  }
});
