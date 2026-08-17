import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

const PUBLIC_PROFILE_PATH = /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,29}$/;
const RESERVED_PROFILE_PATHS = new Set(['api', 'assets', 'auth', 'login', 'logout', 'settings', 'admin', 'extension-connect', 'healthz', 'favicon', 'index', 'public-profile']);

function isPublicProfilePath(pathname) {
  const match = String(pathname || '').match(/^\/([^/]+)$/);
  const username = match?.[1] || '';
  return Boolean(PUBLIC_PROFILE_PATH.test(username) && !RESERVED_PROFILE_PATHS.has(username.toLowerCase()));
}

export default defineConfig({
  root: fileURLToPath(new URL('./client', import.meta.url)),
  plugins: [{
    name: 'public-profile-dev-route',
    configureServer(server) {
      // Keep the same /:username experience in Vite development that the
      // persistent Express server provides in production. Vite still owns
      // HMR and transforms the public-profile entry after this rewrite.
      server.middlewares.use((req, _res, next) => {
        if (req.method === 'GET' && req.url) {
          const [pathname, query] = req.url.split('?');
          if (isPublicProfilePath(pathname)) req.url = '/public-profile.html' + (query ? `?${query}` : '');
        }
        next();
      });
    }
  }],
  build: {
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        dashboard: fileURLToPath(new URL('./client/index.html', import.meta.url)),
        publicProfile: fileURLToPath(new URL('./client/public-profile.html', import.meta.url)),
        extensionConnect: fileURLToPath(new URL('./client/extension-connect.html', import.meta.url))
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
});
