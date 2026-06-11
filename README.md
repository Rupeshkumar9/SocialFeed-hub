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
├── server.js             # Local Dev Runner (delegates to api/ & serves client/)
├── vercel.json           # Vercel serverless routing and subdirectory rewrites
├── package.json          # Node dependencies (mongodb, cloudinary, dotenv)
├── package-lock.json
│
├── client/               # FRONTEND Website (Served relative to base URL)
│   ├── index.html        # Main dashboard website interface
│   ├── css/
│   │   └── styles.css    # Premium CSS styling
│   └── js/
│       ├── app.js        # Core client controller and state manager
│       └── importer.js   # Client-side JSON file uploader & parser
│
├── api/                  # SERVERLESS BACKEND (Vercel endpoints)
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

# Your Admin Password for unlocking edits
ADMIN_PASSWORD=my_secure_admin_password
```

### Step 3: Start the Dev Server
Run the local unified runner script:
```bash
node server.js
```
The server will start at [**`http://localhost:3000`**](http://localhost:3000) and automatically open the dashboard in your default browser. Enter your `ADMIN_PASSWORD` in the **Admin Login** modal to unlock the editing features locally.

---

## 🚀 Deployment Options

You can deploy this application to any cloud platform of your choice. Ensure you configure your environment variables (`MONGODB_URI`, `CLOUDINARY_URL`, and `ADMIN_PASSWORD`) on your hosting dashboard.

### Option A: Vercel (Serverless - Recommended)
Since the app features a Vercel-ready serverless configuration inside [`vercel.json`](file:///C:/Users/Rupes/Documents/code_hobby/02_Projects/SocialFeed-hub/vercel.json) and `/api`, Vercel will host it for free:
1. Push your codebase to a **GitHub** repository.
2. Import the repository in your [Vercel Dashboard](https://vercel.com).
3. Set your environment variables in the project settings.
4. Click **Deploy**. Vercel will automatically host the static files in `client/` and compile the API functions in `api/`.

### Option B: Render or Railway (Persistent Node.js Server)
If you prefer to run a traditional, persistent Node.js server instead of serverless functions:
1. Connect your GitHub repository to [Render](https://render.com) or [Railway](https://railway.app).
2. Set the build command to:
   ```bash
   npm install
   ```
3. Set the start command to execute [`server.js`](file:///C:/Users/Rupes/Documents/code_hobby/02_Projects/SocialFeed-hub/server.js):
   ```bash
   npm start
   ```
4. Define your environment variables in the platform's service settings. The server will run continuously and handle routing automatically.

