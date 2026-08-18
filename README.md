# SocialFeed Hub 🚀
> A premium, elegant, and secure bookmarks feed manager dashboard to curate, search, and view your saved bookmarks from **X (Twitter)** and **Instagram** in one unified feed.

---

## ✨ Features

* **Multi-Platform Support**: Beautifully render curated posts from X/Twitter and Instagram with standard platform branding, author cards, post content, and image previews.
* **Database & Media Cloud Storage**: Backed by **MongoDB Atlas** for bookmarks data and **Cloudinary** for automatic Base64 image compression and standard JPG/PNG hosting.
* **Portfolio-Style Admin Protection**: 
  * **Visitor View**: A clean, read-only feed. Visitors can search, view cards, read your custom notes, and click links, but cannot modify anything.
  * **Admin View**: Locked behind a secure password. Logging in unlocks manual bookmark additions, inline note editing, collection/folder updates, bulk selection actions, and item deletion.
* **Advanced Layout Controls**: Toggle between **Grid**, **List**, and **Compact** card layouts on-the-fly.
* **Granular Filtering & Analytics**: Filter by platform type, custom folder collections, or hashtags. Features a collapsible **Analytics Dashboard** highlighting tag clouds, collection counts, and platform splits.
* **Chrome Scraper Extension**: Includes a custom browser extension to scroll your X Bookmarks timeline or Instagram Saved collection and download them directly into the dashboard.

---

## 📂 Project Directory Structure

```text
SocialFeed-hub/
├── .env                  # Local environment credentials (Git-ignored)
├── .gitignore            # Excludes dependencies, secrets, and caches
├── README.md             # Documentation
├── server.js             # Persistent Express server, API transport, and Astro mount
├── astro.config.mjs      # Astro SSR, Node adapter, sitemap, and internal Vite integration
├── client/               # Astro frontend workspace
│   ├── src/              # Astro pages, layouts, SEO components, dashboard, and blog content
│   └── public/           # Shared favicon and public media assets
├── package.json          # Node dependencies (mongodb, cloudinary, dotenv)
├── package-lock.json
│
├── api/                  # Existing Node.js/Express backend handlers and services
│   ├── status.js         # Backend status, DB check, and token verify
│   ├── load.js           # Reads bookmarks from MongoDB Atlas (public read)
│   ├── save.js           # Writes bookmarks & handles Cloudinary uploads (private write)
│   ├── import-scraped.js # Saves scraper extension uploads to MongoDB (private write)
│   └── lib/
│       └── db.js         # Cached database connection pooling
│
└── extension/            # Browser Scraper Extension
    ├── manifest.json     # Extension configuration
    ├── popup.html        # Scraper popup UI
    ├── popup.js          # Image converter and JSON exporter
    └── content.js        # Timeline scanner script
```

---

## ⚙️ Local Development & Setup

Follow these steps to run the application locally on your computer:

### Step 1: Install Dependencies
Open your terminal inside the project directory and run:
```bash
npm install
```

### Step 2: Configure Environment Variables
Create a file named **`.env`** in the root directory:
```env
# MongoDB Atlas Connection String
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxx.mongodb.net/socialfeed_db?retryWrites=true&w=majority

# Cloudinary Account URL (found on Cloudinary Dashboard)
CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@cloudname

# Password used to sign into your private dashboard
ADMIN_PASSWORD=my_secure_admin_password

# Long random secret used to sign the HttpOnly login session (keep stable between deployments)
SESSION_SECRET=generate_a_long_random_secret

# Optional session lifetime in seconds (default: 30 days)
SESSION_MAX_AGE_SECONDS=2592000

# Optional legacy token used only by older extension installs. New installs pair from the website.
EXTENSION_SYNC_TOKEN=generate_a_different_long_random_token

# Optional extension-device lifetime controls. Zero/unset keeps paired devices valid until revoked.
# EXTENSION_DEVICE_IDLE_SECONDS=7776000
# EXTENSION_DEVICE_MAX_AGE_SECONDS=0

# Optional Settings profile details
PROFILE_NAME=Your Name
PROFILE_EMAIL=you@example.com
MEMBER_SINCE=Jul 2026

# Optional: comma-separated Chrome/Firefox extension origins for production CORS.
# Leave unset to allow browser extension origins during private single-user use.
# EXTENSION_ALLOWED_ORIGINS=chrome-extension://your_chrome_id,moz-extension://your_firefox_id
```

### Step 3: Start the Dev Servers
Run the local unified runner script:
```bash
npm run dev
```

This starts the persistent Express API on `http://localhost:3000` and the Astro development server on `http://localhost:4321`. Astro now owns the landing page, sign-in route, dashboard, public profiles, extension pairing page, and other frontend routes. API calls are proxied to Express and use the same localhost cookies.

For a production-style local check, run `npm run build` and then `npm start`. Express loads the built Astro middleware and continues to serve the existing API routes.

### Connect the browser extension

Load the `extension/` directory as an unpacked extension in Chrome or Firefox. Open the extension popup, expand the settings panel, and choose **Connect using SocialFeed login**. The extension opens the website pairing page; sign in if requested and approve the connection. A unique credential is generated for that browser and stored in extension-local storage. The master `EXTENSION_SYNC_TOKEN` is not exposed to the extension UI.

The credential remains valid until the extension is disconnected, all extension devices are revoked from Profile Settings, or an optional lifetime configured by `EXTENSION_DEVICE_IDLE_SECONDS` / `EXTENSION_DEVICE_MAX_AGE_SECONDS` is reached. Normal website logout does not disconnect a paired extension.

---

## 🚀 Render deployment

The production target is one Render **Web Service** running the persistent Express server. The old `vercel.json` is legacy and is not part of the deployment pipeline.

Configure:

```text
Build command: npm install && npm run build
Start command: npm start
Health check: /healthz
```

Required environment variables include `MONGODB_URI`, `CLOUDINARY_URL`, `ADMIN_PASSWORD`, `SESSION_SECRET`, and `PUBLIC_SITE_URL` (the canonical HTTPS site origin). Optional SEO rollout flags are `PUBLIC_PRICING_INDEXABLE=true` and `PUBLIC_BLOG_INDEXABLE=true`; leave them unset while those pages are only Coming Soon placeholders. `MONGODB_SERVER_SELECTION_TIMEOUT_MS` can be used to bound database connection failures during server-rendered public-profile requests.

Express remains the public HTTP server. It serves `/api/*`, enforces dashboard authentication, serves Astro's generated client assets, and loads `dist/astro/server/entry.mjs` as Astro middleware. Do not configure the service as a Vercel deployment or as a static-only site.

