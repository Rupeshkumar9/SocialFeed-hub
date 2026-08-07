# SocialFeed Hub server and UI major fixes plan

Audit date: 2026-08-05  
Scope: fix the database-dependent login blocker, make failure states recoverable, correct high-impact server/security/data issues, and improve the dashboard's UI reliability and accessibility.

## 1. Executive finding

The login is not actually failing at password verification. It gets stuck **after** the server has accepted the password because the client treats database health as proof of authentication.

Current failure chain:

```text
POST /api/auth/login
  -> password is valid
  -> HttpOnly session cookie is created
  -> client calls GET /api/status
  -> /api/status requires the valid session
  -> /api/status also connects to MongoDB and runs ping
  -> MongoDB unavailable: /api/status returns 500
  -> client calls showPrivateLogin(...)
  -> body keeps auth-pending
  -> dashboard stays hidden despite the valid session
```

This behavior occurs in more than one startup path:

- the later `checkServerConnection()` in `client/js/app.js` converts every non-401 status error into the login gate;
- `privateCheckServerConnection()` does the same;
- `client/js/private-bootstrap.js` adds `auth-pending` again when `/api/status` is not OK.

Authentication, API availability, and database availability must become three separate states.

## 2. Required product behavior

### State model

| Authentication | API | Database | Required screen |
|---|---|---|---|
| unknown | unknown | unknown | Login/startup shell with a bounded “Checking session…” state. |
| unauthenticated | reachable | any | Login form. A database problem must not be presented as a bad password. |
| authenticated | reachable | connected | Normal dashboard with data and write actions. |
| authenticated | reachable | disconnected | Dashboard shell opens; persistent database-connectivity banner, empty/stale feed state, Retry action, and database-dependent writes disabled. |
| authenticated | unreachable | unknown | Dashboard may show previously loaded in-memory data during the session; persistent API-offline banner and Retry. On a fresh page with no confirmed session, show a distinct service-unavailable state, not “invalid password.” |
| session expired | reachable | any | Clear sensitive in-memory state and return to login with “Session expired; sign in again.” |

### Required database-down copy

Use a persistent banner rather than a short toast:

> **Database not connected**  
> You are signed in, but bookmarks could not be loaded. Check the database connection and try again.

Actions: `Retry connection` and optionally `View diagnostics`. Do not show raw MongoDB or environment-variable errors to the browser.

The feed empty state must say “Bookmarks are unavailable” rather than “No bookmarks found.” These are different conditions.

## 3. P0 fixes: implement before the Vite/module migration

### P0.1 Separate session validation from database health

Create routes whose names match their Vercel paths:

```text
api/
└── auth/
    ├── login.js       POST /api/auth/login
    ├── logout.js      POST /api/auth/logout
    └── session.js     GET  /api/auth/session
```

`GET /api/auth/session` must call only `isAuthenticated(req)`/`requireSession(req, res)`. It must not import `db.js`, MongoDB, or Cloudinary.

Successful response example:

```json
{
  "authenticated": true,
  "profile": {
    "name": "SocialFeed Owner",
    "email": "Private account",
    "memberSince": "Private account"
  }
}
```

Unauthenticated requests return 401 with the standard error envelope described below. Login should continue to establish the HttpOnly, `SameSite=Strict`, secure-in-production cookie and return immediately after password verification.

The current files are named `api/auth-login.js` and `api/auth-logout.js`, while the client requests `/api/auth/login` and `/api/auth/logout`. The local `server.js` manually bridges that difference, but Vercel's filesystem routes do not. Move the functions into the nested route structure above (or add exact wrappers) so local and deployed routing agree.

### P0.2 Make system/database status diagnostic, not an auth gate

Use one of these clear contracts:

- `GET /api/health`: public or minimally detailed liveness only (`{status:'ok'}`), with no secrets;
- `GET /api/database/status`: session-protected database readiness, or keep `/api/status` for this purpose after removing all authentication semantics from the client.

For a signed-in diagnostic request, a database failure can return 503 with code `DATABASE_UNAVAILABLE`. It must never make the client conclude the user is unauthenticated. Monitoring can use the HTTP 503; the application uses the error code to enter degraded mode.

### P0.3 Replace all competing client bootstraps

There must be one startup flow:

```text
bootstrap
  -> GET /api/auth/session
     -> 401: show login
     -> 200: reveal dashboard immediately
          -> render loading state
          -> concurrently request database status, counts, and first feed page
          -> each request settles independently
          -> data failure: show degraded banner and unavailable state
```

After a successful `POST /api/auth/login`, reveal the dashboard based on the login/session response; do not call a database-pinging endpoint before removing `auth-pending`.

Delete `client/js/private-bootstrap.js`, the duplicate server/load functions, and the obsolete localStorage admin-password flow. Do not keep temporary alternate startup paths after the new one works.

Use `Promise.allSettled`, not `Promise.all`, for independent first-page requests. A counts failure must not discard successfully loaded bookmarks, and a bookmark failure must not hide the authenticated shell.

### P0.4 Add a first-class degraded UI

Add these independent UI states:

- session: checking / authenticated / unauthenticated;
- database: checking / connected / disconnected;
- feed: idle / loading / loaded / empty / unavailable;
- write: idle / saving / failed / unsaved.

In database-degraded mode:

- keep header, sidebar, settings, logout, and retry available;
- show zero counts as unavailable (`—`), not factual zeroes;
- disable Add, Import, Edit, Delete, Bulk edit/delete, note/category save, and Sync with a reason in the title/accessible description;
- do not allow optimistic local edits that appear saved and disappear on refresh;
- if stale data is intentionally cached later, label its last successful sync time and keep it read-only until connectivity returns;
- retry with a user action and bounded exponential backoff; stop background retries when the page is hidden or the user logs out.

## 4. Standard API error contract

Every API route should return safe, machine-readable JSON:

```json
{
  "error": {
    "code": "DATABASE_UNAVAILABLE",
    "message": "Bookmarks are temporarily unavailable.",
    "retryable": true,
    "requestId": "generated-correlation-id"
  }
}
```

Recommended status/code mapping:

| HTTP | Code | Meaning |
|---:|---|---|
| 400 | `VALIDATION_ERROR` | Request shape or field is invalid. |
| 401 | `AUTH_REQUIRED` / `INVALID_CREDENTIALS` | No valid session or incorrect password. |
| 403 | `ORIGIN_NOT_ALLOWED` | Extension/browser origin is not allowed. |
| 404 | `NOT_FOUND` | Requested bookmark/resource does not exist. |
| 405 | `METHOD_NOT_ALLOWED` | Wrong method; include an `Allow` header. |
| 409 | `DUPLICATE_BOOKMARK` / `WRITE_CONFLICT` | Unique identity or version conflict. |
| 413 | `PAYLOAD_TOO_LARGE` | Import/image/request exceeds the limit. |
| 429 | `RATE_LIMITED` | Too many login/import requests. |
| 503 | `DATABASE_UNAVAILABLE` | MongoDB is missing, timed out, or disconnected. |
| 500 | `INTERNAL_ERROR` | Unexpected server failure. |

Log full internal errors with the request ID on the server. Remove `details: err.message` from production responses in `save.js` and `import-scraped.js`; connection strings, hosts, driver messages, and Cloudinary details must not reach the UI.

## 5. Server audit and fixes

### P0/P1 reliability

1. **Mongo connection cache can remain stale.** `db.js` caches only the database object. Keep the `MongoClient`, share an in-flight connection promise, configure bounded `serverSelectionTimeoutMS`/`connectTimeoutMS`, and clear the cached client/promise after connectivity errors so Retry can establish a fresh connection.
2. **No request timeout/cancellation in most client calls.** Add `AbortController` timeouts and cancel the old feed request when route/filter state changes.
3. **Stale responses can overwrite the current route.** Associate a monotonically increasing request ID with every feed load and ignore responses that no longer match the active route.
4. **Counts are expensive.** `/api/counts` runs several aggregations/counts, including one per platform. Consolidate with `$facet` where practical, add indexes that match source/platform/folder/tag queries, and cache briefly if freshness requirements allow.
5. **Status ping on every bootstrap adds latency and dependency coupling.** Session validation must be cheap; perform database readiness separately and avoid duplicate pings from multiple bootstraps.
6. **Local request bodies are unbounded.** `server.js` concatenates the full body in memory. Enforce content type and byte limits, reject early with 413, handle aborted requests, and match limits with Vercel/Cloudinary constraints.
7. **Imports do sequential database lookups.** `import-scraped.js` runs `findOne` per item and then bulk-writes. Normalize/deduplicate in memory, query existing identity keys in batches, and cap item count.
8. **Base64 Cloudinary uploads are sequential.** Set file type/size/dimension limits and use bounded concurrency. Do not re-upload unchanged images.
9. **Save conflict behavior is unclear.** `save.js` upserts by `id`, while uniqueness is enforced by `identityKey`. Validate both, return 409 for identity conflicts, and avoid partial success being presented as a complete save.
10. **No graceful local-server shutdown.** Close the HTTP server and Mongo client on `SIGINT`/`SIGTERM`, especially for development and non-Vercel hosts.

### P1 security

1. **Login has no rate limit.** Add per-IP plus global backoff/rate limiting and return 429. Keep the error message identical enough not to reveal configuration state.
2. **Session-secret fallback weakens key separation.** Require `SESSION_SECRET` explicitly in production rather than falling back to `ADMIN_PASSWORD`. Validate required environment variables at cold start without making login depend on MongoDB.
3. **No explicit origin/CSRF validation for cookie-authenticated writes.** `SameSite=Strict` helps, but also validate `Origin`/`Host` for login and mutation endpoints. Never use a wildcard credentialed CORS policy.
4. **Unsafe stored values are inserted into HTML.** Social thumbnails, tags, initials, IDs, and handler arguments are not consistently escaped in card/modal templates. Replace string HTML for stored values with DOM properties. Validate URL schemes to `http:`/`https:` before saving or opening.
5. **`window.open` lacks isolation.** Use an `<a target="_blank" rel="noopener noreferrer">` or call `window.open(url, '_blank', 'noopener,noreferrer')` after URL validation.
6. **Link preview SSRF defense is helpful but not complete.** The route blocks private DNS answers and validates redirects, but DNS is resolved once for validation and again by `fetch`, leaving DNS-rebinding risk. Pin the validated address through an appropriate HTTP client/agent or move previewing to a hardened metadata service. Revalidate every redirect, keep response/time limits, and block non-standard ports if not needed.
7. **Add security headers.** Define CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, and frame protection (`frame-ancestors` in CSP). A nonce/hash strategy or removal of inline styles/scripts is needed for a strong CSP.
8. **External CDN assets need a policy.** Prefer pinned/self-hosted Font Awesome and fonts. If a CDN remains, pin versions, add Subresource Integrity where available, and include only required CSP origins.
9. **Extension authorization needs operational safeguards.** Keep a dedicated token, exact allowed origins, token rotation instructions, import rate limits, payload caps, and audit logs without logging the token.
10. **Cookies should have explicit production policy.** Retain `HttpOnly`, `Secure`, `SameSite=Strict`, and `Path=/`; consider the `__Host-` prefix. Rotate session signing keys through an intentional invalidation plan.

### P1 API/data correctness

1. Validate request bodies with one schema layer for IDs, URLs, platform enum, dates, tags, notes, folder length, image size/type, deletion arrays, and import item count.
2. Normalize `twitter` to `x` before database filtering as well as after aggregation; current per-platform collection counts can disagree with normalized totals.
3. Make cursor validation explicit. Invalid cursors should return 400 instead of silently restarting page one, which can produce duplicates in infinite scroll.
4. Define mutation granularity. Sending the whole currently loaded client array for ordinary edits is wasteful and increases conflicts. Prefer bookmark-level create/update/delete endpoints with server-side validation and optional version fields.
5. Return updated canonical records from writes so the client uses server IDs, normalized timestamps, canonical URLs, and uploaded image URLs.
6. Add structured logs and timing for session, database connection, load, counts, save, import, and preview. Never log passwords, session cookies, extension tokens, raw base64 images, or connection strings.

## 6. UI audit and fixes

### P0/P1 state and feedback

1. Replace the single connected/offline flag with separate API, database, feed, and save states.
2. Use persistent banners for persistent failures. Toasts are suitable only for completed transient actions.
3. Add skeleton/loading states and distinguish loading, true empty results, no filter matches, database unavailable, API offline, and session expired.
4. Add Retry near the failed content and keep it keyboard accessible. Disable repeated retry while a request is active.
5. Show an explicit unsaved/failed indicator for mutations; either rollback optimistic updates or retain a retryable pending operation. “Data is cached in memory” is not durable and should not imply safety.
6. Counts that failed to load must display `—`; a displayed `0` means the server confirmed zero.
7. Search/filter/sort currently operate on the loaded page (normally 40 items) while database counts cover the whole library. Either move them server-side with query parameters and indexed search, or label them “Search loaded bookmarks.” The preferred long-term fix is server-side query/filter/sort pagination.

### P1 accessibility

The audit found six modal-style overlays but zero `role="dialog"` and zero `aria-modal` attributes.

- Give every dialog `role="dialog"`, `aria-modal="true"`, and an accessible name through `aria-labelledby`.
- Trap focus within the active dialog, focus its first meaningful control, restore focus to the trigger, and close with Escape unless a destructive action is underway.
- Add `aria-label` to icon-only close/menu/category buttons and `aria-expanded`/`aria-controls` to dropdown triggers.
- Make bookmark cards keyboard operable. Prefer a real link for opening the saved URL instead of a click handler on a non-focusable `div`.
- Add a visible focus style with adequate contrast and test all actions without a mouse.
- Give status updates suitable live regions without announcing every render.
- Respect `prefers-reduced-motion` for all new animations and avoid focus loss when the feed rerenders.
- Add form error associations (`aria-describedby`), preserve entered values on recoverable failures, and focus the first invalid field.

### P1 maintainability and performance

- Remove 63 inline HTML styles and the accumulated end-of-file CSS override rounds through the ownership split in the frontend plan.
- Replace per-card listener creation with container delegation where it improves clarity and rendering cost.
- Avoid rebuilding the entire bookmark grid for small note/category changes; update the affected card or use a keyed renderer.
- Use responsive image dimensions/aspect ratio to reduce layout shift, and validate/lazy-load remote images.
- Do not hide meaningful sync text permanently with `display: none !important`; expose the state visibly or through accessible text.
- Avoid moving large DOM subtrees between desktop and mobile containers when CSS layout can provide the same result.
- Remove manual query-string cache versions after Vite provides content-hashed assets.

## 7. Proposed client/server startup contract

### `POST /api/auth/login`

- verifies only configured credentials;
- applies rate limit and origin validation;
- sets session cookie;
- returns authenticated profile;
- never connects to MongoDB.

### `GET /api/auth/session`

- validates only the session signature/expiry;
- returns profile;
- never connects to MongoDB.

### `GET /api/database/status`

- requires a session;
- performs a bounded database check;
- returns connected status or 503 `DATABASE_UNAVAILABLE`;
- triggers repair of a stale cached connection on a later retry.

### `GET /api/load` and `/api/counts`

- require a session;
- return data independently;
- return standardized 503 on database failure;
- accept an AbortSignal at the client and ignore stale results;
- eventually share server-side filter/search/sort semantics.

### Bootstrap pseudocode

```js
async function bootstrapApp() {
  renderSessionChecking();

  try {
    const session = await authApi.getSession();
    setAuthenticated(session.profile);
    revealDashboard();
  } catch (error) {
    if (error.code === 'AUTH_REQUIRED') return showLogin();
    return showApiUnavailableLoginState();
  }

  renderFeedLoading();
  const results = await Promise.allSettled([
    systemApi.getDatabaseStatus(),
    bookmarksApi.getCounts(),
    bookmarksApi.getPage(currentQuery())
  ]);

  applyDatabaseResult(results[0]);
  applyCountsResult(results[1]);
  applyFeedResult(results[2]);
}
```

## 8. Tests required for the blocker

### Server tests

1. Correct password + MongoDB disconnected: login returns 200 and sets a cookie.
2. The resulting cookie + MongoDB disconnected: session endpoint returns 200.
3. The resulting cookie + MongoDB disconnected: database status, load, and counts return standardized 503.
4. Wrong password + MongoDB connected or disconnected: login returns 401.
5. Missing/expired/tampered cookie: session returns 401.
6. Database reconnect after an initial failure: status and load recover without restarting the process.
7. Method, origin, rate limit, content type, and body-size rejection paths return the correct safe codes.

### Browser tests

1. With MongoDB connected, login opens the normal dashboard and loads data.
2. With MongoDB disconnected, login opens the dashboard, shows the persistent banner, shows `—` counts, and disables writes.
3. Retry while still disconnected retains the dashboard and updates the message without duplicate toasts/listeners.
4. Retry after reconnection removes degraded state and loads counts/feed.
5. A counts failure with a successful feed still renders bookmarks.
6. A feed failure with successful counts shows unavailable feed state, not an empty library.
7. Session expiry from any API call clears private data and returns to login.
8. Rapid platform/category navigation never renders an older response over the current route.
9. Dialog keyboard behavior, focus restoration, and mobile layout pass smoke tests.

## 9. Master chronological implementation order

This order coordinates this document with `01-frontend-vite-modularization-plan.md`.

1. **Baseline and safety net.** Create a feature branch, document the environment matrix, record screenshots, and add initial server/browser smoke tests. Do not commit `.env`.
2. **Correct Vercel auth route layout.** Move/wrap login and logout under `api/auth/`, add the session endpoint, update `server.js` local routing, and test exact production-style URLs.
3. **Decouple login from MongoDB.** Make login/session database-independent and enforce the error contract. This is the smallest deployable hotfix for the stuck login.
4. **Implement degraded dashboard behavior.** Reveal the shell after authentication, load data independently, add the persistent database banner/Retry, show unavailable counts, and disable writes.
5. **Remove legacy bootstrap/auth paths.** Delete `private-bootstrap.js`, duplicate declarations, the duplicate `DOMContentLoaded` controller, and localStorage password handling. Add stale-request cancellation.
6. **Harden database/API reliability.** Repair connection caching/retry, timeouts, payload limits, validation, safe errors, mutation conflict behavior, and counts/import performance.
7. **Apply security fixes.** Login rate limiting, origin checks, strict secret validation, safe DOM rendering/URL schemes, opener isolation, preview hardening, headers/CSP, and extension limits.
8. **Add Vite without changing product behavior.** Introduce the single ES-module entry, dev API proxy, production `dist/`, minified/hashed build, and corrected Vercel SPA/API routing.
9. **Split JavaScript by feature.** Extract foundations, then auth/feed, read rendering, write workflows, library/analytics/settings, and import parsers in that dependency order.
10. **Split CSS and simplify HTML.** Move selectors by ownership, remove inline styles and override rounds, and verify screenshots across breakpoints.
11. **Finish accessibility and UX correctness.** Dialog semantics/focus, keyboard cards/actions, distinct empty/error/loading states, server-side search/filter/sort semantics, and precise save feedback.
12. **Automate quality gates.** Lint, unit tests, Playwright, build checks, dependency audit, and preview-deployment smoke tests.
13. **Vercel preview validation.** Test connected and intentionally disconnected database cases, cookies, all `/api/*` routes, SPA fallback, extension CORS, caching, and rollback.
14. **Production rollout.** Deploy, monitor function/database/frontend errors, verify recovery after a simulated transient database failure, then remove any temporary compatibility wrappers.

The first production release can safely stop after step 5 if the urgent goal is only to fix the stuck login. Steps 6–14 should follow before treating the broader refactor as complete.

## 10. Definition of done

- A valid password creates a usable session even when MongoDB is unavailable.
- An authenticated user sees the dashboard shell and a clear database-connectivity message rather than the login gate.
- Authentication, API, database, feed, and write status are represented independently.
- Database failures are retryable without reloading the app or restarting the server.
- Writes cannot appear successful while the database is unavailable.
- Local and Vercel API URLs are identical and correspond to the `api/` filesystem layout.
- All API errors use safe codes/messages and server logs retain diagnostics through a request ID.
- No raw driver/cloud error details, passwords, tokens, cookies, or base64 images are exposed or logged.
- Rapid navigation cannot render stale data.
- Search/filter/sort scope is accurate and clearly communicated.
- Dialogs and core dashboard actions work with keyboard and screen-reader semantics.
- Connected, disconnected, reconnect, expired-session, and partial-request-failure cases are automated.
- Vite preview and Vercel preview pass the same smoke-test checklist before production.
