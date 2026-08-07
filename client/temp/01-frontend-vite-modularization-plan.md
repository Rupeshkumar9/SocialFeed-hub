# SocialFeed Hub frontend modularization and Vite plan

Audit date: 2026-08-05  
Scope: keep the frontend in vanilla JavaScript, split it into maintainable ES modules and CSS files, add a Vite production build, and deploy the generated `dist/` site together with the existing Vercel Functions.

## 1. Current baseline

The current frontend works as a collection of global scripts rather than as one application with an explicit entry point.

| File | Current size | Main concern |
|---|---:|---|
| `client/js/app.js` | 3,163 lines / 121,520 bytes | State, API calls, routing, rendering, dialogs, imports, edits, analytics, and bootstrap are mixed together. |
| `client/css/styles.css` | 3,143 lines / 66,940 bytes | Tokens, layout, components, feature styles, overrides, and responsive rules are mixed together. Later “round” overrides make cascade ownership unclear. |
| `client/index.html` | 568 lines / 31,496 bytes | Large application shell, 63 inline `style` attributes, all dialogs, and three classic scripts. |
| `client/js/importer.js` | 381 lines / 12,997 bytes | Import parsers and merge rules are global. |
| `client/js/private-bootstrap.js` | 41 lines / 2,150 bytes | A third, competing application bootstrap. |

Additional evidence from the audit:

- `app.js` declares `checkServerConnection`, `loadData`, `updateFeedHeaders`, `renderInfiniteScrollSentinel`, and `initInfiniteScrollObserver` twice.
- There are two `DOMContentLoaded` controllers in `app.js`, plus the initial load in `private-bootstrap.js`.
- Some newer functions override older declarations through JavaScript hoisting, leaving unreachable code in the same file.
- Modules communicate through globals such as `AppState`, `DOM`, `BookmarksImporter`, and globally callable image-error handlers.
- The package has no build, lint, unit-test, or frontend test scripts. `npm run dev` currently starts only `node server.js`.
- Vite is not a framework migration. The finished application remains vanilla HTML, CSS, and JavaScript.

## 2. Target directory structure

Use `client/` as Vite's root so the current HTML can be migrated without moving it to the repository root. Keep backend code CommonJS and use `vite.config.mjs`; do **not** add `"type": "module"` to `package.json`, because that would change how the existing `server.js` and `api/*.js` files are interpreted.

```text
SocialFeed-hub/
├── api/                              # Vercel Functions; remains server code
├── client/                           # Vite root
│   ├── index.html                    # Thin app shell and semantic dialogs
│   ├── public/                       # Unprocessed static assets only
│   │   └── favicon.svg
│   └── src/
│       ├── main.js                   # The only browser entry point
│       ├── app/
│       │   ├── bootstrap.js          # Ordered application startup
│       │   ├── state.js              # State creation, selectors, subscriptions
│       │   ├── dom.js                # Required/optional DOM lookup helpers
│       │   ├── routes.js             # Hash parsing and navigation
│       │   └── constants.js
│       ├── api/
│       │   ├── http.js               # fetchJSON, timeout, abort, error mapping
│       │   ├── auth-api.js
│       │   ├── bookmarks-api.js
│       │   └── system-api.js          # Database/health/status calls
│       ├── components/
│       │   ├── database-banner.js
│       │   ├── dropdown.js
│       │   ├── modal.js
│       │   ├── toast.js
│       │   └── loading-state.js
│       ├── features/
│       │   ├── auth/
│       │   │   └── auth-controller.js
│       │   ├── feed/
│       │   │   ├── feed-controller.js
│       │   │   ├── feed-filters.js
│       │   │   ├── feed-renderer.js
│       │   │   ├── bookmark-card.js
│       │   │   └── infinite-scroll.js
│       │   ├── bookmarks/
│       │   │   ├── bookmark-editor.js
│       │   │   ├── bookmark-preview.js
│       │   │   ├── bookmark-save.js
│       │   │   └── selection-controller.js
│       │   ├── library/
│       │   │   ├── sidebar-controller.js
│       │   │   ├── categories.js
│       │   │   └── tags.js
│       │   ├── analytics/
│       │   │   └── analytics-controller.js
│       │   ├── import/
│       │   │   ├── import-controller.js
│       │   │   └── parsers/
│       │   │       ├── instagram.js
│       │   │       ├── twitter.js
│       │   │       ├── generic-json.js
│       │   │       └── raw-links.js
│       │   └── settings/
│       │       └── settings-controller.js
│       ├── utils/
│       │   ├── dates.js
│       │   ├── escape.js
│       │   ├── files.js
│       │   └── urls.js
│       └── styles/
│           ├── main.css               # CSS import manifest
│           ├── tokens.css
│           ├── reset.css
│           ├── base.css
│           ├── utilities.css
│           ├── layout/
│           │   ├── app-shell.css
│           │   ├── header.css
│           │   └── sidebar.css
│           ├── components/
│           │   ├── buttons.css
│           │   ├── cards.css
│           │   ├── dropdowns.css
│           │   ├── forms.css
│           │   ├── modals.css
│           │   ├── status.css
│           │   └── toasts.css
│           ├── features/
│           │   ├── auth.css
│           │   ├── feed.css
│           │   ├── analytics.css
│           │   ├── import.css
│           │   └── settings.css
│           └── responsive.css
├── dist/                             # Generated; never hand-edit
├── server.js                         # Local API and production dist server
├── vite.config.mjs
├── vercel.json
└── package.json
```

This is a target ownership map, not a requirement to create dozens of tiny files on day one. Aim for cohesive modules of roughly 100–350 lines. Review a module when it exceeds about 400 lines or owns more than one feature.

## 3. JavaScript ownership rules

### Single startup path

`client/src/main.js` must only import the root stylesheet and call one bootstrap function:

```js
import './styles/main.css';
import { bootstrapApp } from './app/bootstrap.js';

bootstrapApp();
```

`bootstrapApp()` owns the startup sequence. Delete `private-bootstrap.js`, both legacy `DOMContentLoaded` blocks, and all duplicate declarations after their behavior is moved. Initialization must be idempotent so accidentally calling it twice does not bind duplicate listeners.

### State boundaries

Replace direct global mutation with a small store, not a new framework. A practical state shape is:

```js
{
  auth: { status: 'checking', profile: null },
  database: { status: 'checking', message: null, lastCheckedAt: null },
  feed: { items: [], nextCursor: null, hasMore: false, requestId: 0 },
  filters: { source: 'browser', platform: 'all', collection: 'all', tag: 'all', search: '', sort: 'recent-desc' },
  ui: { route: 'bookmarks', layout: 'grid', selectionMode: false, selectedIds: new Set() }
}
```

Only the store module mutates the root state. Feature controllers receive the dependencies they need. Avoid a general event bus until a real cross-feature use case requires one.

### API boundary

All `fetch` calls must go through `api/http.js`. It should provide:

- JSON parsing that safely handles empty or non-JSON error responses.
- a typed `ApiError` containing HTTP status, server `code`, safe message, and `retryable` flag;
- `credentials: 'same-origin'` by default;
- an `AbortController` timeout;
- request cancellation so changing sidebar filters cannot render an older response over the newest route;
- special handling for 401 (`AUTH_REQUIRED`) and 503 (`DATABASE_UNAVAILABLE`).

Do not store passwords or bearer tokens in `localStorage`. The existing HttpOnly session cookie is the only browser credential.

### Rendering boundary

- A feature renderer receives data and returns DOM nodes or updates its owned container.
- Prefer `textContent`, `setAttribute`, and DOM creation for stored/user-controlled values.
- Do not interpolate bookmark IDs, URLs, thumbnails, authors, tags, or notes into executable inline handlers.
- Remove `onerror="handleImageError(...)"`; attach an `error` listener to the created image node.
- Centralize modal open/close, focus trapping, Escape handling, and focus restoration in `components/modal.js`.
- Bind one delegated event listener per stable container where practical instead of listeners on every render.

### Suggested extraction map from the current `app.js`

| Current responsibility/functions | New owner |
|---|---|
| `checkServerConnection`, `showPrivateLogin`, login/logout listeners | `features/auth/auth-controller.js` plus `api/auth-api.js` |
| `loadData`, `refreshPlatformCounts`, sync status | `features/feed/feed-controller.js` plus API modules |
| `AppState` | `app/state.js` |
| `DOM` | `app/dom.js` |
| `applyRouteFromHash`, `setRouteHash`, sidebar route setup | `app/routes.js` and `features/library/sidebar-controller.js` |
| filtering, sorting, search | `features/feed/feed-filters.js` |
| `buildCardElement`, platform markup, fallbacks | `features/feed/bookmark-card.js` |
| `renderFeedGrid`, browser grouping | `features/feed/feed-renderer.js` |
| infinite-scroll functions | `features/feed/infinite-scroll.js` |
| add/edit/preview/save/delete/note operations | `features/bookmarks/*` |
| bulk select/edit/delete | `features/bookmarks/selection-controller.js` |
| collections, tags, sidebar counts | `features/library/*` |
| analytics functions | `features/analytics/analytics-controller.js` |
| `BookmarksImporter` | `features/import/parsers/*` |
| date, HTML, URL, debounce helpers | `utils/*` |

## 4. CSS separation rules

`styles/main.css` is an ordered import manifest. Keep cascade order explicit:

```css
@import './tokens.css';
@import './reset.css';
@import './base.css';
@import './layout/app-shell.css';
@import './layout/header.css';
@import './layout/sidebar.css';
@import './components/buttons.css';
/* remaining components and features */
@import './utilities.css';
@import './responsive.css';
```

Rules for the split:

- Move existing rules without changing selectors first. Visual cleanup is a later commit.
- Place each selector in exactly one owning file; eliminate later duplicate overrides after screenshot comparison.
- Convert the 63 HTML inline styles into named component/utility classes.
- Keep colors, spacing, radii, shadows, z-index layers, and breakpoints in `tokens.css`.
- Avoid new `!important`; document and remove existing uses as ownership becomes clear.
- Keep mobile rules next to their component when they are component-specific. Reserve `responsive.css` for page-level composition changes.
- Replace the CSS `@import` for Google Fonts with HTML preconnect/stylesheet tags or self-hosted assets; CSS font imports delay rendering.
- Preserve Vite's generated content-hashed asset names. Remove manual query cachebusters such as `?v=20260730-4`.

## 5. Vite setup

### Dependencies and scripts

Add current compatible versions of Vite and `concurrently` as development dependencies and pin a supported Node version in `package.json`/`.nvmrc` or `.node-version`.

```json
{
  "scripts": {
    "dev": "concurrently -k -n api,web \"npm:dev:api\" \"npm:dev:web\"",
    "dev:api": "node server.js --api-only",
    "dev:web": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "start": "node server.js"
  }
}
```

The `--api-only` switch must be implemented in `server.js`, or the backend can continue listening on port 3000 while the developer opens Vite on 5173. Vite proxies `/api` requests to that backend.

### `vite.config.mjs`

```js
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('./client', import.meta.url)),
  publicDir: 'public',
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:3000'
    }
  },
  build: {
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true,
    sourcemap: true
  }
});
```

Vite's production build already bundles modules, minifies JavaScript/CSS, extracts CSS, and generates hashed asset filenames. Do not add a second minifier until bundle measurements show a reason. Source maps may be changed to `hidden` or disabled for production after error-reporting needs are decided.

The proxy approach follows Vite's official [`server.proxy` documentation](https://vite.dev/config/server-options.html#server-proxy).

### HTML changes

Replace the three legacy script tags with one entry:

```html
<script type="module" src="/src/main.js"></script>
```

Remove the standalone CSS `<link>` because `main.js` imports `styles/main.css`. Keep a minimal no-JavaScript message. Add semantic dialog attributes as described in the second task document.

## 6. Vercel build and routing

Keep `api/` at the repository root; Vercel supports Functions there alongside a Vite frontend. The Vercel project root must be the folder containing this `package.json`.

Recommended project settings:

- Framework preset: Vite
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: `dist`
- Production environment variables: `MONGODB_URI`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `EXTENSION_SYNC_TOKEN`, Cloudinary values, and the explicit extension-origin allowlist

Recommended `vercel.json` after the API route layout is corrected:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/((?!api/).*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

The negative lookahead prevents the SPA fallback from swallowing `/api/*`. Do not retain the current rewrite that sends every non-API path to `/client/$1`; production files will live in `dist/`. Vercel's current documentation confirms the root `api/` convention and SPA fallback pattern: [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite) and [Vercel rewrites](https://vercel.com/docs/project-configuration/vercel-json#rewrites).

For Render/Railway-style deployment, make `server.js` serve `dist/` in production and use `npm run build` before `npm start`. Vercel itself does not use the local static-file server.

## 7. Incremental migration sequence

Each numbered item should be a separately reviewable commit or small pull request.

1. **Create a behavior baseline.** Record desktop/mobile screenshots and smoke-test login, browser/social navigation, add/edit/delete, import/export, filtering, analytics, settings, logout, and session expiry. Add `npm run check` even if it initially contains only syntax checks.
2. **Fix the auth/database startup blocker first.** Implement the independent session endpoint and degraded dashboard state from the second task document before changing the build system.
3. **Remove bootstrap races.** Establish one `DOMContentLoaded`/bootstrap path, remove `private-bootstrap.js`, remove the obsolete localStorage bearer-token flow, and delete duplicate function bodies. Keep the site running as classic JavaScript for this commit.
4. **Remove global-only browser behavior.** Replace inline image error handlers and other assumptions that functions live on `window`. This makes ES-module conversion safe.
5. **Add Vite around the stabilized frontend.** Add `vite.config.mjs`, scripts, `client/src/main.js`, dev proxy, and `dist/` ignore. Initially import a cleaned legacy controller if necessary; verify `npm run dev`, `npm run build`, and `npm run preview` before splitting features.
6. **Introduce shared foundations.** Extract `constants`, DOM lookup, API client, state, route parsing, utilities, and modal/toast components. These are dependencies for later feature modules.
7. **Extract auth and feed loading.** This proves the API/state boundary and adds cancellation of stale feed requests.
8. **Extract read-only rendering.** Move filters, card rendering, grouping, platform UI, and infinite scroll. Use DOM-safe rendering during the move.
9. **Extract write workflows.** Move add/edit/preview/save, notes, category changes, image handling, deletion, and bulk selection. Add rollback or a clearly visible unsaved state for failed writes.
10. **Extract library, analytics, settings, and import parsers.** Remove `BookmarksImporter` and remaining application globals.
11. **Split CSS without visual redesign.** Move rules by ownership, import through `main.css`, remove inline styles, and compare screenshots at each breakpoint.
12. **Apply accessibility and UI corrections.** Use the acceptance criteria in the second task document.
13. **Deploy a Vercel preview.** Validate function routes, cookies, SPA fallback, static assets, environment variables, MongoDB-connected behavior, and intentionally disconnected MongoDB behavior.
14. **Ship production and monitor.** Keep the previous deployment available for rollback and check function errors, login failures, database latency, and frontend console errors.

Do not combine the Vite introduction, full module split, visual redesign, and server behavior rewrite into one release. Small transitions make regressions traceable.

## 8. Testing and quality gates

Add these as the modules are created:

- ESLint for browser ES modules and Node CommonJS files, with separate environments.
- Prettier or an agreed formatter.
- Vitest unit tests for URL normalization, import parsers, filters, route parsing, state transitions, and API error mapping.
- Playwright smoke tests for login success/failure, database-down login, navigation, retry, add/edit/delete, modal keyboard behavior, and mobile layout.
- A build-size report recorded in the pull request. Set budgets after the first clean build rather than guessing them now.
- `npm run check` should run lint, unit tests, and `vite build`; CI should run it for every pull request.

## 9. Definition of done

- One module entry and one idempotent bootstrap initialize the application.
- No duplicate top-level function declarations or legacy private bootstrap remain.
- No admin password/token is stored in Web Storage.
- No production feature depends on writable globals on `window`.
- `app.js` and `styles.css` monoliths are removed after their code is assigned to owned modules.
- No inline `style` attributes or inline executable event handlers remain in `index.html` or generated bookmark markup.
- `npm run dev` starts frontend and API development together; `/api` is proxied successfully.
- `npm run build` creates a clean, minified, content-hashed `dist/` build.
- `npm run preview` serves the production build locally.
- A Vercel preview serves static routes and every API route without the SPA fallback intercepting `/api/*`.
- Login reveals the dashboard even when MongoDB is unavailable, with the degraded-state behavior defined in the second plan.
