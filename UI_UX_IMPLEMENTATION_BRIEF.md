# SocialFeed Hub UI/UX and Public Profile Implementation Brief

## Purpose

This document is the implementation brief for the next AI/model working on SocialFeed Hub. It is based on:

- the requirements in `tasks.md`;
- a live desktop and mobile audit of `https://socialfeed-hub.onrender.com/` on 17 August 2026; and
- inspection of the current repository and data/API flow.

Deployment note: the active production application is a Render Web Service running the persistent Node.js process from `server.js` (`npm start`). `vercel.json` and the Vercel-oriented wording still present elsewhere in the repository are legacy artifacts and are not production requirements for this work.

The requested outcome has two connected parts:

1. Replace the browser-bookmark experience with a much denser quick-access UI, while retaining the Pinterest/masonry cards for social-platform posts.
2. Add an optional public profile at `/{username}` where anonymous visitors can see only the profile, social links, browser links, and platform posts the owner explicitly published.

This is an implementation specification, not a request to redesign the whole product.

---

## Product decision

Treat browser bookmarks and social-platform saves as two related but independent products inside one account.

| Area | Primary job | Recommended default UI |
| --- | --- | --- |
| Browser bookmarks | Open many websites quickly; scan titles/domains; organize useful links | Dense grouped link rows/tiles |
| Platform bookmarks | Rediscover visual/content-heavy saved posts | Existing masonry/Pinterest feed |
| Public browser links | Share curated resources and destinations | Featured links plus compact collections |
| Public platform posts | Share a curated visual/content feed | Read-only masonry cards |

Do not force one renderer, one layout preference, or one set of controls onto both sources.

---

## Live-site audit summary

### What already works

- The left navigation clearly separates `Browser Bookmarks` from `All Platforms`, Instagram, X, Threads, Reddit, Facebook, and YouTube.
- The data request already sends a distinct `source=browser` or `source=social` value.
- Browser bookmarks are grouped by folder/category, which is the correct information architecture.
- Social posts have useful visual identity: author, platform, content, image/fallback, category, notes, and actions.
- The social masonry feed works well on desktop and remains understandable on mobile.
- Search, sorting, selection, add/import, analytics, settings, pagination, empty states, and responsive navigation already exist.
- The profile/settings screen is a natural place to add public-profile controls.

### Problems confirmed in the live UI

- Browser bookmarks reuse the social post card renderer. A typical link contains a large header, quote icon, description, a large empty `Saved Link` media block, and a full-width `Add Note` action.
- On a 390 x 844 mobile viewport, one browser bookmark consumes most of the visible screen. This prevents quick scanning.
- Current `Compact View` still consists of cards with headers, descriptions, action bars, and generous spacing. It is denser, but not a true quick-link interface.
- Current `List View` is a centered, large social card layout. It is not a conventional compact list.
- Browser categories become a single column on mobile, but each child remains an oversized card.
- Layout is stored globally in `AppState.activeLayout` and local storage key `bookmarks_layout`. Changing the browser layout also changes the selected social layout. This conflicts with the requirement that the two experiences remain independent.
- The Add Link form starts with a platform selector and mixes browser-link and social-post fields. It works, but does not adapt its labels/fields strongly enough to the active source.
- Settings currently describes the account as entirely private and has no username, public-profile state, social-link editor, visibility defaults, preview, or copy-profile-link action.
- `/api/load` and `/api/counts` require a private session. There is no safe anonymous read path.
- The current bookmark object includes private `notes`. A public API must never expose the full stored object by accident.

### Scale observed during the audit

The live account had 71 browser bookmarks and 363 social saves (Instagram, X, and Threads populated; Reddit, Facebook, and YouTube empty). This validates designing for hundreds or thousands of items rather than a small Linktree-style set of giant buttons.

---

## Part A: Private browser-bookmark redesign

### Recommended concept: a grouped quick-link workspace

Keep the existing category grouping, but render each browser bookmark with a dedicated `BrowserLinkRow` component instead of `buildCardElement()`.

Do not simulate a social post. Do not render a large media preview by default.

### Desktop structure

```text
Browser Bookmarks                                      71 links
[Search links........................] [Public/All] [Sort] [Density] [+ Add]

AI Assistant & Agents                         5 links · 2 public   [•••]
┌──────────────────────────────────┐  ┌──────────────────────────────────┐
│ ◎  Indus by Sarvam              │  │ C  Vibe                         │
│    indus.sarvam.ai       ↗  ◉ •••│  │    chat.mistral.ai      ↗  ○ •••│
└──────────────────────────────────┘  └──────────────────────────────────┘

Forums                                         4 links · 1 public   [•••]
...
```

- Each category remains full width.
- Inside a category, use one column below 720 px, two columns from roughly 720–1199 px, and three columns on wide desktop when space allows.
- A row should be approximately 52–60 px tall in dense mode and 68–80 px in comfortable mode.
- The entire primary row opens the URL in a new tab.
- Keep secondary actions visually quiet so title/domain scanning remains dominant.

### Mobile structure

```text
Browser Bookmarks
71 links
[Search links........................]
[All] [Public] [Private]       [Sort] [+]

AI Assistant & Agents              5  [⌄]
◎  Indus by Sarvam                    ↗
   indus.sarvam.ai                 ◉ •••
────────────────────────────────────────
C  Vibe                               ↗
   chat.mistral.ai                 ○ •••
```

- Use one row per link, not a full card.
- Target 56–68 px per row and at least 44 x 44 px touch targets for actions.
- Clamp title and domain to one line each.
- Category headers should be collapsible and optionally sticky while their group is being browsed.
- Put less-used actions in a bottom sheet or kebab menu.
- Do not show thumbnails in the default mobile view.

### Browser link row anatomy

Required:

- favicon or deterministic initial fallback;
- public title, falling back to stored title/author name;
- hostname/domain;
- open-in-new-tab affordance;
- visibility indicator (`Public` globe or `Private` lock) for the owner;
- overflow menu.

Optional in comfortable density:

- one-line description;
- tags;
- a note indicator, but not the full private note;
- `Featured` pin/star.

Overflow menu actions:

- Open
- Edit
- Make public / Make private
- Feature / Unfeature on public profile
- Move to collection
- Add/edit private note
- Delete

Selection mode should add a leading checkbox without changing the rest of the row geometry.

### Category header behavior

Each browser category header should show:

- category name;
- total item count;
- public item count when nonzero;
- collapse/expand;
- rename/reorder/menu actions for the authenticated owner.

Category menu:

- Rename
- Reorder on public profile
- Hide/show the collection on the public profile
- Publish selected links (do not silently publish all children)
- Collapse/expand

If offering “Publish all in this collection,” show the exact number affected and require an explicit confirmation because this changes external visibility.

### Source-specific toolbar

When `activeSource === 'browser'`, show:

- search placeholder: `Search link title, domain, collection, or note…`;
- visibility filter: All / Public / Private;
- collection filter on smaller screens;
- sort: Recently saved, Oldest, Title A–Z, Domain A–Z, Custom public order;
- density: Dense / Comfortable (and optionally Preview as a legacy view);
- Add link;
- Select.

When `activeSource === 'social'`, keep the existing platform/category/filter/layout controls and masonry behavior.

Use independent state and storage keys:

```js
AppState.browserLayout = 'dense';
AppState.socialLayout = 'grid';

localStorage.setItem('browser_bookmarks_layout', 'dense');
localStorage.setItem('social_bookmarks_layout', 'grid');
```

Do not continue using a single `bookmarks_layout` preference for both sources. Migrate the old preference only as an initial social-layout fallback.

### Add/edit form behavior

Open a browser-specific form when the owner is inside Browser Bookmarks:

- URL (required)
- Title
- Collection
- Optional description
- Private note
- Tags
- Visibility (Private by default)
- Feature on public profile (disabled until visibility is Public)
- Optional custom public title/description

Open the existing social-post form when inside a platform feed. The platform selector can remain for cross-source manual entry, but the UI should switch fields and helper text immediately after source selection.

### What to preserve

- Existing social post cards and masonry feed.
- Existing browser categories/folders.
- Search and filters.
- Selection, editing, import, export, analytics, and infinite loading.
- Dark/light themes and existing design tokens.
- Favicon recovery through `/api/bookmark-preview`.

---

## Part B: Public profile at `/{username}`

### Public profile information architecture

```text
┌─────────────────────────────────────────────────────────────┐
│ avatar  Display Name                         [Share profile] │
│         @username                                           │
│         Short bio                                           │
│         [Instagram] [X] [YouTube] [GitHub] [Website]        │
└─────────────────────────────────────────────────────────────┘

          [ Links 24 ] [ Saved Posts 18 ]

Links tab
  Featured
  [Primary featured link] [Primary featured link]

  Collections
  AI Tools                                      6 links
  [compact public link rows]

Saved Posts tab
  [All] [Instagram] [X] [Threads]  [Category filter]
  [existing read-only masonry post feed]
```

The two content types must be visibly and semantically separate. Do not interleave browser links and social posts in one masonry feed.

### Profile header

Include:

- avatar;
- display name;
- `@username`;
- short bio;
- compact social icon links;
- share/copy profile link;
- optional accent/theme selected by the owner.

Do not show email address, account/security state, member date, private analytics, extension state, import/export actions, or dashboard navigation.

### Public Links tab

- Show up to three featured links first as larger but still restrained call-to-action tiles.
- Show remaining links grouped into public collections.
- Use compact rows/tiles with favicon, title, optional one-line public description, and domain.
- Entire row opens the destination.
- No edit, delete, add-note, checkbox, private-note, or owner-only controls.
- Allow a small `Open` icon and clear keyboard focus state.
- On desktop use up to two columns per collection; on mobile use one column.

This creates the Linktree-like top-level experience without turning a library of hundreds of resources into a long stack of giant buttons.

### Public Saved Posts tab

- Reuse the current social masonry language.
- Remove owner-only controls: selection, add note, edit, delete, move collection, import, and private notes.
- Retain author, platform, content excerpt, media/fallback, hashtags, and open/read action.
- Add platform chips and an optional public-category filter.
- Render useful empty states for a profile with links only or posts only.

### Navigation and responsive behavior

- The profile header is always first.
- Use a sticky two-tab segmented control after the header when both content types exist.
- If only one content type exists, do not show an unnecessary tab switcher.
- Mobile width: one column, 16 px page padding, 44 px touch targets.
- Desktop content maximum: approximately 1040–1120 px centered.
- Respect `prefers-reduced-motion`.
- Provide skip navigation and correct heading order.

### Owner controls in Settings

Add a `Public Profile` card/section to Profile Settings with:

- profile published toggle;
- username editor with availability/format validation;
- public URL preview (`https://host/{username}`);
- display name;
- bio;
- avatar URL/upload path if supported;
- social-link editor (platform, label, URL, enabled, drag/reorder);
- default public tab;
- accent/background/button-style presets;
- `Preview public profile`;
- `Copy public link`;
- counts of public browser links and public social posts.

Visibility must default to Private. Existing data must remain private after deployment until the owner explicitly publishes it.

Add visibility controls in three places:

1. individual bookmark/post edit UI;
2. item overflow menu;
3. bulk selection toolbar.

Use a globe icon plus text for Public and a lock icon plus text for Private; never rely only on color.

---

## Data model

### Current architectural constraint

The current project is a single-owner application. Authentication is based on environment-configured credentials/session state, and bookmarks do not carry a user/account ID. Do not introduce a fake multi-user system as part of this feature.

Implement a safe single-owner public profile now, but choose names that can later accept an `ownerId` migration.

### `public_profiles` collection

Use one document for the current owner, for example:

```json
{
  "_id": "owner",
  "username": "rupesh",
  "usernameLower": "rupesh",
  "displayName": "Rupesh",
  "bio": "A short public introduction.",
  "avatarUrl": "",
  "published": false,
  "defaultTab": "links",
  "socialLinks": [
    {
      "id": "social_1",
      "platform": "instagram",
      "label": "Instagram",
      "url": "https://instagram.com/example",
      "enabled": true,
      "sortOrder": 10
    }
  ],
  "theme": {
    "accent": "#f43f5e",
    "background": "default",
    "buttonStyle": "soft"
  },
  "collectionSettings": [
    {
      "source": "browser",
      "key": "AI Assistant & Agents",
      "publicLabel": "AI Tools",
      "enabled": true,
      "sortOrder": 10
    }
  ],
  "createdAt": "ISO date",
  "updatedAt": "ISO date"
}
```

Username rules:

- normalize to lowercase for uniqueness;
- 3–30 characters;
- letters, digits, underscore, and hyphen only;
- must begin with a letter or digit;
- reserve names including `api`, `assets`, `auth`, `login`, `logout`, `settings`, `extension-connect`, `healthz`, `admin`, `favicon`, and all actual top-level application paths;
- create a unique index on `usernameLower`.

### Bookmark fields

Add sharing fields to bookmark documents:

```json
{
  "visibility": "private",
  "featured": false,
  "publicOrder": null,
  "publicTitle": "",
  "publicDescription": "",
  "visibilityUpdatedAt": "ISO date or null"
}
```

Rules:

- Missing `visibility` is treated as `private`.
- `visibility` only accepts `private` or `public`.
- `notes` remains private and is never returned by public endpoints.
- `publicDescription` is the explicitly shareable text. Do not reuse private `notes` as public copy.
- `featured` has an enforced small limit in the UI (recommended maximum three browser links).
- A hidden/disabled public collection prevents display, but it must not change each child item's stored visibility.

### Important save/import rule

The extension and import process rescans/upserts existing bookmarks. A rescan must not reset or overwrite:

- `visibility`;
- `featured`;
- `publicOrder`;
- `publicTitle`;
- `publicDescription`;
- `visibilityUpdatedAt`.

Update these fields only through an authenticated sharing/settings endpoint. In `api/save.js`, exclude them from normal mutable scan fields unless the request comes from that explicit endpoint. This prevents a later extension sync from accidentally unpublishing or modifying sharing choices.

### Suggested indexes

In `api/lib/db.js`, retain current indexes and add:

```js
{ key: { visibility: 1, source: 1, firstSavedAt: -1, _id: -1 }, name: 'public_source_feed' }
{ key: { visibility: 1, platform: 1, firstSavedAt: -1, _id: -1 }, name: 'public_platform_feed' }
```

Use partial filters for `visibility: 'public'` if supported by the target MongoDB deployment.

---

## API design

The production application is a persistent Node.js server on Render. Add Express as the HTTP routing and middleware framework, while preserving the existing CommonJS handlers, database helpers, authentication logic, bookmark normalization, extension logic, and response formats. Express is a replacement for the manual transport/routing shell in `server.js`, not a rewrite of the backend.

Do not design this feature around Vercel serverless routing or `vercel.json`.

### Express integration strategy

#### Migration boundary

Rewrite only the HTTP composition layer first:

- add `express` to `dependencies` in `package.json` and update `package-lock.json`;
- create the Express application in `server.js` (or a small `server/app.js` imported by `server.js`);
- replace `http.createServer()`, the manual URL switch, `handleServerless()`, manual JSON-body parsing, the MIME table, and manual static-file streaming with Express routing, parsers, and static middleware;
- retain `process.env.PORT` and `app.listen()` for the Render Web Service;
- retain `/healthz` with the same success response used by Render;
- retain the current cache behavior for hashed `/assets/` files and no-cache behavior for HTML;
- register API routes before static/username/SPA fallback routes;
- add a final JSON 404 for unknown `/api/*` routes and a centralized error handler that does not expose stack traces or internal error details in production.

Do not rewrite these working modules merely to make them look more “Express-like”:

- `api/lib/db.js` and MongoDB queries/index helpers;
- `api/lib/auth.js`, session signing, cookies, and credential checks;
- `api/lib/bookmark-utils.js`;
- Cloudinary upload logic;
- import/sync and extension-pairing logic;
- category/count/feed business logic;
- existing client API response contracts.

The existing API modules already accept `(req, res)` and use `req.body`, `req.query`, `res.status()`, `res.json()`, `res.setHeader()`, and `res.end()`. Mount them directly as Express handlers with the appropriate HTTP method. Their internal `req.method` checks can remain initially and be removed later only as a separate cleanup.

#### Existing routes versus new routes

- Existing endpoints: mount the current handler functions without changing their database/business logic.
- New public-profile endpoints: implement them with `express.Router()` and small middleware functions for validation, authentication, pagination, and errors.
- Shared behavior must live in reusable service/helper functions, not inside large route callbacks. Both existing handlers and new routers may call the same `api/lib/*` helpers.
- Keep CommonJS consistently for the backend during this feature; do not combine an Express migration with a CommonJS-to-ESM migration.

Suggested organization:

```text
server.js                              Express app composition and app.listen
server/routes/public-profile.js       Anonymous public profile/feed routes
server/routes/profile-settings.js     Authenticated profile settings routes
server/routes/bookmark-visibility.js  Authenticated sharing routes
server/middleware/                     Express-only validation/error adapters
api/                                   Existing handlers kept and mounted
api/lib/                               Existing and new reusable data/services
```

The exact folders may follow the repository's prevailing convention, but route registration, business logic, and rendering must remain separated.

#### Express parser and middleware rules

- Do not use an arbitrary large global JSON limit. The application can receive bookmark archives and Base64 image data, so select tested route-specific limits for import/save endpoints and a smaller default for ordinary JSON endpoints.
- Confirm that malformed JSON returns a consistent 400 response instead of becoming `req.body = null` and failing later.
- Preserve the extension origin allowlist and all required `OPTIONS` behavior. Do not replace the existing narrow extension CORS policy with permissive global CORS.
- Do not add cookie-session middleware unless intentionally replacing the current signed-cookie implementation. The existing cookie authentication can continue reading `req.headers.cookie`.
- Add authentication middleware as a thin adapter around the existing `isAuthenticated()`/`requireSession()` logic rather than rewriting session cryptography.
- Preserve request abortion/timeouts and external fetch protections in bookmark preview behavior.

#### Why Express is useful for this planned work

Express provides material value for the features in this brief because they introduce several related route groups and cross-cutting policies:

- clean route groups for anonymous public profile data versus authenticated owner settings;
- middleware that guarantees authentication, username validation, pagination limits, and JSON validation consistently;
- simpler dynamic `/{username}` and public-profile HTML routing;
- reliable static asset and SPA fallback ordering;
- centralized 404 and error responses;
- easier route-level request-size controls for normal JSON versus large imports;
- simpler future rate limiting, security headers, logging, and public-response caching;
- less custom HTTP plumbing to maintain in `server.js` while the product grows.

Express is not needed to make the existing MongoDB or bookmark logic work. It is worthwhile here because the new public/private route surface would otherwise significantly expand the manual route switch and duplicate validation/error behavior.

### Anonymous endpoints

`GET /api/public-profile?username={username}`

- No session required.
- Return 404 when profile does not exist or `published !== true`.
- Return only public profile fields, enabled social links, enabled collection labels/order, and aggregate public counts.
- Never return email, member date, security state, internal IDs that are not needed, or private settings.

`GET /api/public-bookmarks?username={username}&source=browser|social&platform={value}&collection={value}&cursor={cursor}&limit={n}`

- No session required.
- Resolve and validate the published username first.
- Always include `{ visibility: 'public' }` in the MongoDB query.
- For `source=browser`, also require `{ source: 'browser' }`.
- For `source=social`, require `{ source: { $ne: 'browser' } }` and optionally filter platform/collection.
- Default limit 30; maximum 60.
- Return a cursor and `hasMore`.
- Whitelist response fields. Do not spread the stored document.

Allowed public bookmark fields:

```text
id, source, platform, platformName, url, authorName, authorUsername,
content, thumbnail, favicon, folder, hashtags, firstSavedAt,
publicTitle, publicDescription, featured, publicOrder
```

Explicitly exclude:

```text
notes, identityKey, canonicalUrl, importSource, lastScannedAt,
extensionScrapedAt, internal MongoDB fields, and future private fields
```

Apply basic cache headers only after correctness is established. Public profile/settings changes should invalidate or bypass stale caches.

### Authenticated endpoints

`GET /api/public-profile-settings`

- Session required.
- Returns the full editable public-profile configuration plus public counts.

`PUT /api/public-profile-settings`

- Session required.
- Validate/sanitize username, bio length, URLs, theme values, social links, and collection settings.
- Accept only known theme presets/tokens; do not accept arbitrary CSS.

`PATCH /api/bookmark-visibility`

Example body:

```json
{
  "ids": ["bookmark_id_1", "bookmark_id_2"],
  "visibility": "public",
  "featured": false
}
```

- Session required.
- Limit number of IDs per request.
- Validate that each ID exists.
- Update sharing fields only.
- Return affected count and current public totals.
- Support a single item and bulk selection.

If updating public title/description/order, either extend this endpoint with a strict patch schema or add `PATCH /api/bookmark-public-metadata`. Do not reuse unrestricted bulk bookmark saving.

### Security requirements

- Public visibility is enforced in the database query, not by fetching private records and hiding them in the browser.
- The public response is a constructed whitelist object.
- Existing/missing visibility is private.
- Validate all outgoing URLs as `http:` or `https:` and reject credentials embedded in URLs.
- Render all text via `textContent` or the project's escaping helper.
- Add `rel="noopener noreferrer"` to external links opened with `_blank`.
- Public pages must work with no authentication cookie and must not call private session/count/load endpoints.
- Return 404 rather than leaking whether an unpublished username exists.
- Rate-limit public endpoints if/when platform infrastructure supports it.

---

## Frontend architecture and file map

### Private dashboard

Create:

- `client/src/features/bookmarks/browser-link-row.js` — dedicated dense browser link renderer and events.
- `client/src/styles/browser-links.css` — category, density, desktop columns, mobile rows, visibility badges.
- `client/src/features/settings/public-profile-settings.js` — profile/social-link/visibility settings controller.

Modify:

- `client/src/features/feed/feed-view.js`
  - route browser items to `buildBrowserLinkRow()`;
  - keep `buildCardElement()` for social items;
  - split layout state and storage;
  - keep browser group ordering and infinite scroll.
- `client/src/features/feed/bookmark-card.js`
  - make it social-focused;
  - do not add more browser-specific branches to this component.
- `client/src/app/state.js`
  - add `browserLayout`, `socialLayout`, visibility filter, profile settings state.
- `client/src/app/events.js`
  - source-specific layout/density/filter events and visibility actions.
- `client/index.html`
  - source-adaptive toolbar controls;
  - Public Profile settings section;
  - visibility fields in edit/bulk edit UI.
- `client/src/styles/main.css`
  - import the new stylesheet in the established order.
- `client/src/features/feed/filters.js`
  - support visibility filtering only for browser/private-owner views.
- `client/src/features/bookmarks/editor.js` and `selection.js`
  - handle visibility and public metadata without disrupting existing write flows.
- `client/src/api/socialfeed-api.js`
  - add authenticated settings/visibility methods.

The current browser grouped renderer is in `feed-view.js` and its category CSS is in `auth-settings.css`. Move or override the browser-specific presentation in the new stylesheet; avoid growing the settings stylesheet with feed UI.

### Public page

Preferred approach: use a separate public entry so anonymous visitors never bootstrap the private dashboard or briefly see the login gate.

Create:

- `client/public-profile.html`
- `client/src/public-profile.js`
- `client/src/features/public-profile/public-profile-view.js`
- `client/src/features/public-profile/public-links.js`
- `client/src/features/public-profile/public-posts.js`
- `client/src/styles/public-profile.css`

Update `vite.config.mjs` to add `public-profile.html` as a build input.

Routing must serve this entry for a valid one-segment username path such as `/rupesh`, while preserving:

- `/` for the dashboard;
- `/api/*`;
- `/extension-connect.html`;
- static assets and favicon paths;
- `/healthz`;
- future reserved application routes.

Update the Express routing/static fallback for Render and local production. The persistent server must choose `public-profile.html` for a valid username path and continue serving `index.html` for the private dashboard routes. Register the username route after API and static asset routes so it cannot capture `/api`, assets, health checks, extension-connect, or real files. No `vercel.json` change is required.

Use a strict username path pattern so a top-level filename with a dot is not mistaken for a username. Read the username from `location.pathname`; the visible URL remains `/{username}`.

If a separate HTML entry complicates the Node fallback, the acceptable alternative is an early route gate in `client/src/main.js` that dynamically imports the public application before any private authentication bootstrap. Do not initialize both applications.

---

## Rendering and interaction rules

### Private browser rows

- Use semantic `<a>` for the primary open action where feasible.
- The kebab button must not trigger link navigation.
- Keyboard: Tab reaches link and actions; Enter opens; Escape closes menu/dialog.
- External destination opens in a new tab and uses `noopener,noreferrer`.
- Favicon failures show an initial without shifting layout.
- Long titles/domains use ellipsis and preserve full text in accessible labeling/title.
- Private/public/featured state changes show a toast and update counts immediately; roll back on API failure.

### Public page

- Server remains the source of truth for visibility.
- Profile loading, not-found/unpublished, links-only, posts-only, and empty-profile states are all required.
- Browser public links and social public posts have separate pagination state.
- Public post filters must request public API data rather than filtering a previously fetched private/global list.
- Share button uses Web Share API when available and falls back to copying the URL.
- Never show edit controls based merely on the presence of an auth cookie. The public route should remain a clean visitor preview even for the signed-in owner; provide an explicit `Edit in dashboard` link only if desired.

---

## Implementation order

### Phase 0 — Express transport migration

1. Add Express and update the lockfile.
2. Convert only `server.js`/HTTP composition to an Express application.
3. Mount every existing API handler without changing its database/business logic.
4. Preserve extension CORS/OPTIONS, cookies, body requirements, static caching, SPA behavior, `/healthz`, and `process.env.PORT`.
5. Add centralized API 404 and error handling.
6. Run regression tests against every existing route before adding public-profile behavior.
7. Remove the old manual HTTP helpers only after parity is verified.

Keep this as a separate commit/change from the public-profile implementation so regressions can be attributed and reverted cleanly.

### Phase 1 — Data safety and API

1. Add profile collection helpers and indexes.
2. Add visibility/public metadata schema handling with missing values treated as private.
3. Protect sharing fields from save/import rescans.
4. Implement authenticated profile settings and visibility endpoints.
5. Implement anonymous profile and public-bookmark endpoints with query-level visibility and response whitelisting.
6. Add endpoint tests before exposing UI controls.

### Phase 2 — Private browser UX

1. Split browser/social layout state and migrate local storage preference safely.
2. Add `BrowserLinkRow` renderer.
3. Replace browser cards inside current category grouping.
4. Add density, visibility filter, and source-adaptive toolbar.
5. Add individual and bulk visibility controls.
6. Validate desktop and 390 px mobile density.

### Phase 3 — Public profile

1. Add public-profile HTML/JS/CSS entry and route.
2. Implement profile header/social links.
3. Implement compact public Links tab.
4. Implement read-only public Saved Posts masonry tab.
5. Add pagination, filters, empty/error states, metadata, and share behavior.

### Phase 4 — Settings and polish

1. Add full Public Profile settings UI.
2. Add preview/copy URL and public counts.
3. Add collection ordering and featured links.
4. Accessibility, keyboard, reduced motion, and light/dark/theme QA.
5. Update README and deployment routing notes.

---

## Acceptance criteria

### Independence

- Browser and social sections use different renderers.
- Selecting Dense/Comfortable for browser links does not alter the social feed layout.
- Selecting Grid/List/Compact for social posts does not alter browser density.
- Browser and social filters/categories remain source-scoped.

### Browser bookmark usability

- At 390 x 844, at least five typical browser links can be scanned in one viewport after the page/category header, rather than roughly one current card.
- At desktop width, a category can show two or three columns of compact links without media placeholders.
- Favicon, title, domain, visibility, open, and actions are understandable.
- Full private notes are not displayed in dense rows.

### Public privacy

- Before migration/configuration, all existing bookmarks are private.
- An anonymous request cannot retrieve a private item by changing query parameters.
- Public endpoints never return `notes` or account email.
- Unpublished/unknown profiles return the same 404-style response.
- Extension/import rescans do not change sharing state.

### Public UX

- `/{username}` opens without sign-in.
- Profile hero and enabled social links render.
- Browser links and saved posts are separate tabs/sections.
- Only explicitly public items render.
- Public browser links use compact rows/tiles; public social posts retain masonry cards.
- Mobile, tablet, desktop, keyboard, and empty states work.

### Regression

- The persistent Render service starts through `npm start` using Express and binds `process.env.PORT`.
- Existing endpoint URLs, methods, status codes, JSON shapes, cookies, and authorization behavior remain compatible with the current frontend and extension.
- Existing API handlers reuse their current database/business logic.
- Malformed JSON, oversized requests, unknown API routes, and unexpected errors return controlled responses.
- Private login/dashboard still works.
- Browser import/export, add/edit/delete, selection, category rename, analytics, and infinite loading still work.
- Instagram/X/Threads rendering and empty platform states still work.
- The Render/Express routing preserves API, static asset, health-check, extension-connect, dashboard, and username-profile routes without route collisions.

---

## Verification checklist for the implementing AI

Run at minimum:

```text
npm run build
npm run dev (or the existing split dev commands)
npm start (exercise the same persistent server entry used by Render)
```

API checks:

- every pre-migration endpoint passes a response-contract regression check through Express;
- extension pairing/sync passes allowed-origin, rejected-origin, and `OPTIONS` checks;
- login/session/logout cookies still behave identically;
- normal JSON, malformed JSON, configured oversized JSON, and large import/save payload behavior are verified;
- unauthenticated private `/api/load` remains 401;
- unpublished public profile returns 404;
- published profile returns only allowed fields;
- public feed excludes private and missing-visibility items;
- bulk publish/unpublish updates counts;
- rescan/upsert preserves sharing fields;
- cursor pagination cannot cross visibility/source filters.

Browser checks:

- desktop dashboard Browser Bookmarks dense and comfortable modes;
- desktop social masonry Grid mode;
- 390 x 844 browser links;
- 390 x 844 social posts;
- public profile with both tabs;
- links-only, posts-only, empty, unknown, and unpublished profiles;
- long title/domain/bio, failed favicon/image, and many social links;
- keyboard menu/dialog behavior and visible focus;
- dark and light themes;
- signed-out public access in a clean browser session.

Do not mark the work complete after only building successfully. Render and visually inspect the private browser library, private social feed, and public profile at desktop and mobile widths.

---

## Non-goals for this iteration

- Full multi-user account architecture.
- Comments, likes, follower counts, or social networking features.
- Arbitrary custom CSS/HTML in public profiles.
- Public exposure of private notes.
- Replacing the successful social masonry UI.
- AI categorization, semantic search, or recommendation systems.
- Reworking the browser extension beyond preserving sharing metadata during sync.

---

## Final design principle

The private browser library should feel like a fast bookmark manager; the private social library should feel like a visual saved-post feed; and the public profile should feel like a curated personal hub that clearly separates useful links from shareable posts. Shared branding is desirable, but shared card geometry is not.
