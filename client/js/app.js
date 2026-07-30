/**
 * Main Application Controller
 * Manages UI, state, search filtering, and integration between embeds and importer modules.
 */

// Application State
const POSTS_PER_PAGE = 50;

const AppState = {
  bookmarks: [],
  filteredBookmarks: [],
  tags: new Set(),
  collections: new Set(),
  activePlatform: 'all',
  activeTag: 'all',
  activeCollection: 'all',
  activeLayout: 'grid',
  activeSort: 'recent-desc',
  searchQuery: '',
  activeBookmark: null,
  isServerConnected: false,
  isAdmin: false,
  visibleCount: POSTS_PER_PAGE,
  editingId: null,
  isSelectionMode: false,
  selectedIds: new Set(),
  pendingDeletedIds: new Set(),
  isTagsExpanded: false,
  analyticsOpenPlatform: "instagram",
  isSettingsOpen: false
};

// DOM Cache
const DOM = {
  bookmarksGrid: document.getElementById('bookmarks-grid'),
  searchInput: document.getElementById('search-input'),
  feedTitle: document.getElementById('feed-title'),
  feedSubtitle: document.getElementById('feed-subtitle'),
  filterPlatform: document.getElementById('filter-platform'),
  filterSort: document.getElementById('filter-sort'),
  sidebarPlatformList: document.getElementById('sidebar-platform-list'),
  sidebarCollectionList: document.getElementById('sidebar-collection-list'),
  tagsDropdownBtn: document.getElementById('tags-dropdown-btn'),
  tagsDropdownMenu: document.getElementById('tags-dropdown-menu'),



  // Import Modal Elements
  btnImport: document.getElementById('action-import'),
  importModalOverlay: document.getElementById('import-modal-overlay'),
  closeImportModal: document.getElementById('close-import-modal'),
  dragDropZone: document.getElementById('drag-drop-zone'),
  importFileInput: document.getElementById('import-file-input'),
  btnSelectFile: document.getElementById('btn-select-file'),

  // Add Bookmark Modal Elements
  btnAddBookmark: document.getElementById('btn-add-bookmark'),
  addModalOverlay: document.getElementById('add-modal-overlay'),
  closeAddModal: document.getElementById('close-add-modal'),
  addBookmarkForm: document.getElementById('add-bookmark-form'),
  btnAddCancel: document.getElementById('btn-add-cancel'),
  addUrl: document.getElementById('add-url'),
  addAuthorName: document.getElementById('add-author-name'),
  addContent: document.getElementById('add-content'),
  addTags: document.getElementById('add-tags'),
  addCategory: document.getElementById('add-category'),
  addCategoryNew: document.getElementById('add-category-new'),
  addThumbnail: document.getElementById('add-thumbnail'),
  btnToggleImageField: document.getElementById('btn-toggle-image-field'),
  addImageField: document.getElementById('add-image-field'),
  addImagePreview: document.getElementById('add-image-preview'),
  addImageDropzone: document.getElementById('add-image-dropzone'),
  addImageFile: document.getElementById('add-image-file'),
  addImageSourceControls: document.getElementById('add-image-source-controls'),
  addTagsGroup: document.getElementById('add-tags-group'),
  btnEditCategoryName: document.getElementById('btn-edit-category-name'),

  // Sync Actions
  syncBtn: document.getElementById('sync-btn'),
  syncStatusText: document.getElementById('sync-status-text'),
  syncDot: document.getElementById('sync-dot'),
  btnSyncNow: document.getElementById('btn-sync-now'),
  btnExportJson: document.getElementById('action-export-json'),

  // Post View & Note Modal Elements
  postModalOverlay: document.getElementById('post-modal-overlay'),
  closePostModal: document.getElementById('close-post-modal'),
  modalPostCardContent: document.getElementById('modal-post-card-content'),
  modalNoteTextarea: document.getElementById('modal-note-textarea'),
  modalNoteCharCount: document.getElementById('modal-note-char-count'),

  // Bulk Edit Elements
  bulkEditModalOverlay: document.getElementById('bulk-edit-modal-overlay'),
  closeBulkEditModal: document.getElementById('close-bulk-edit-modal'),
  bulkEditForm: document.getElementById('bulk-edit-form'),
  bulkEditCategory: document.getElementById('bulk-edit-category'),
  bulkEditCategoryNew: document.getElementById('bulk-edit-category-new'),
  bulkEditPlatform: document.getElementById('bulk-edit-platform'),
  bulkEditCountLabel: document.getElementById('bulk-edit-count-label'),
  btnBulkEditCancel: document.getElementById('btn-bulk-edit-cancel'),
  btnBulkEditTrigger: document.getElementById('btn-bulk-edit'),

  // Admin Login Elements
  btnAdminLogin: document.getElementById('btn-admin-login'),
  loginModalOverlay: document.getElementById('login-modal-overlay'),
  closeLoginModal: document.getElementById('close-login-modal'),
  btnLoginCancel: document.getElementById('btn-login-cancel'),
  loginForm: document.getElementById('login-form'),
  loginPassword: document.getElementById('login-password'),

  // Toast container
  toastContainer: document.getElementById('toast-container')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  checkMobileDrawerLayout();
  checkServerConnection()
    .then(loadData)
    .catch(() => {
      // If server check fails, try to load data statically
      loadData();
    });
});

/**
 * Check if the local Node.js helper server is running
 */
function checkServerConnection() {
  return privateCheckServerConnection();
  const token = localStorage.getItem('admin_token');
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  updateSyncStatusUI(false, 'Checking Server');

  return fetch('/api/status', { method: 'GET', headers: headers, cache: 'no-store' })
    .then(res => {
      if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
      return res.json();
    })
    .then(data => {
      if (data && data.status === 'ok') {
        AppState.isServerConnected = true;
        updateSyncStatusUI(true);

        if (data.isAdmin) {
          AppState.isAdmin = true;
          document.body.classList.remove('visitor-mode');
          updateAdminLoginUI(true);
        } else {
          AppState.isAdmin = false;
          document.body.classList.add('visitor-mode');
          updateAdminLoginUI(false);
          if (token) {
            localStorage.removeItem('admin_token');
          }
        }
        return data;
      }
      throw new Error('Server status was not ok');
    })
    .catch(err => {
      console.warn('Server status check failed:', err);
      AppState.isServerConnected = false;
      AppState.isAdmin = false;
      document.body.classList.add('visitor-mode');
      updateAdminLoginUI(false);
      updateSyncStatusUI(false);
      throw err;
    });
}

/**
 * Update UI Sync Button indicator state
 */
function updateSyncStatusUI(connected, label) {
  if (!DOM.syncBtn || !DOM.syncDot || !DOM.syncStatusText) return;
  DOM.syncBtn.classList.remove('saving', 'offline');
  if (connected) {
    DOM.syncDot.className = 'sync-dot';
    DOM.syncStatusText.textContent = label || 'Server Connected';
    DOM.syncBtn.title = 'Server connected. Click to save local edits.';
    DOM.syncDot.title = 'connected';
  } else {
    DOM.syncDot.className = 'sync-dot offline';
    DOM.syncStatusText.textContent = label || 'Server Offline';
    DOM.syncBtn.title = 'Server disconnected. Click Sync to retry.';
    DOM.syncDot.title = 'disconnected';
    DOM.syncBtn.classList.add('offline');
  }
}

function loadData(options = {}) {
  return privateLoadData(options);
  showToast("Loading bookmarks...");
  if (AppState.isServerConnected) {
    fetch('/api/load')
      .then(res => {
        if (!res.ok) throw new Error("Database load failed");
        return res.json();
      })
      .then(data => {
        AppState.bookmarks = data || [];
        onDataLoadedSuccess();
      })
      .catch(err => {
        console.error("Failed to load live database, falling back to local file:", err);
        loadStaticFallback();
      });
  } else {
    loadStaticFallback();
  }
}

function loadStaticFallback() {
  if (window.initialBookmarks && Array.isArray(window.initialBookmarks)) {
    AppState.bookmarks = window.initialBookmarks;
    onDataLoadedSuccess();
  } else {
    showToast("Could not load database. Starting empty.", "error");
    AppState.bookmarks = [];
    onDataLoadedSuccess();
  }
}

function onDataLoadedSuccess() {
  processCollections();
  updateCollectionsFilterDropdown();
  processTags();

  // Set layout from localStorage
  const savedLayout = localStorage.getItem('bookmarks_layout') || 'grid';
  changeLayout(savedLayout, false); // false to avoid toast notifications on initial load

  applyFiltersAndSearch();
  console.info("Bookmarks loaded successfully.");
}

/**
 * Process collections/folders from current bookmarks
 */
function processCollections() {
  AppState.collections.clear();
  AppState.bookmarks.forEach(bm => {
    if (bm.folder && bm.folder.trim()) {
      AppState.collections.add(bm.folder.trim());
    }
  });
}

/**
 * Render the Collections Dropdown filter options in the header
 */
function updateCollectionsFilterDropdown() {
  const filterSelect = document.getElementById('filter-collection');
  if (!filterSelect) return;

  const currentVal = AppState.activeCollection || 'all';

  filterSelect.innerHTML = `
    <option value="all">All Collections</option>
    <option value="uncategorized">Others</option>
  `;

  Array.from(AppState.collections).sort().forEach(folder => {
    const opt = document.createElement('option');
    opt.value = folder;
    opt.textContent = folder;
    filterSelect.appendChild(opt);
  });

  filterSelect.value = currentVal;
}

/**
 * Process tags from current bookmarks
 */
function processTags() {
  AppState.tags.clear();
  AppState.bookmarks.forEach(bm => {
    if (bm.hashtags && Array.isArray(bm.hashtags)) {
      bm.hashtags.forEach(tag => {
        const clean = tag.trim().toLowerCase();
        if (clean) {
          AppState.tags.add(clean);
        }
      });
    }
  });
}

/**
 * Render the Tag Dropdown filter options
 */
function renderTagCloud() {
  // Redundant. Now handled dynamically inside updateSidebarNavigation() tag group sublist
}

/**
 * Filter feed by platform select
 */
function filterByPlatform(platform) {
  AppState.activePlatform = platform;
  applyFiltersAndSearch();
}

/**
 * Filter feed by tag selection
 */
function filterByTag(tag) {
  AppState.activeTag = tag;
  applyFiltersAndSearch();
}

function getBookmarkDateMs(bm, fields) {
  for (const field of fields) {
    const value = bm && bm[field];
    if (!value) continue;
    const ms = new Date(value).getTime();
    if (!Number.isNaN(ms)) return ms;
  }
  return 0;
}

function defaultAuthorNameForPlatform(platform) {
  return platform === 'x' ? 'X User' :
    platform === 'instagram' ? 'Instagram Creator' :
    platform === 'threads' ? 'Threads Creator' :
    platform === 'reddit' ? 'Reddit User' :
    platform === 'browser' ? 'Saved Link' :
    'Facebook User';
}

function platformLabel(platform) {
  const labels = {
    all: 'All Bookmarks',
    x: 'X / Twitter',
    instagram: 'Instagram',
    threads: 'Threads',
    reddit: 'Reddit',
    facebook: 'Facebook',
    web: 'Web'
  };
  return labels[platform] || platform;
}

function syncFilterSelects() {
  if (DOM.filterPlatform) DOM.filterPlatform.value = AppState.activePlatform;
  const collectionSelect = document.getElementById('filter-collection');
  if (collectionSelect) collectionSelect.value = AppState.activeCollection;
}

function getCurrentCountSource() {
  if (AppState.activeSource === "social") return AppState.activePlatform === "all" ? "social" : AppState.activePlatform;
  return "browser";
}

function getLibraryCountGroup(group, sourceKey = getCurrentCountSource()) {
  const root = AppState.libraryCounts && AppState.libraryCounts[group];
  if (!root) return null;
  if (sourceKey === "social" || sourceKey === "browser") return root[sourceKey] || null;
  return root.platforms && root.platforms[sourceKey] ? root.platforms[sourceKey] : null;
}

function normalizeCollectionKey(value) {
  const folder = String(value || "").trim();
  const lower = folder.toLowerCase();
  if (!folder || lower === "uncategorized" || lower === "others" || lower === "bookmarks bar") return "uncategorized";
  return folder;
}

function browserCategoryLabel(value) {
  return normalizeCollectionKey(value) === "uncategorized" ? "General Links" : normalizeCollectionKey(value);
}

function socialCategoryLabel(value) {
  return normalizeCollectionKey(value) === "uncategorized" ? "Others" : normalizeCollectionKey(value);
}

function getLoadedCollectionCounts() {
  const counts = { all: AppState.bookmarks.length, uncategorized: 0 };
  AppState.bookmarks.forEach(bm => {
    const key = normalizeCollectionKey(bm.folder);
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

function getCategoryDefaultLabel(source = AppState.activeSource) {
  return source === "browser" ? "General Links" : "Others";
}

function getCategoryContextFromPlatform(platformValue) {
  const platform = String(platformValue || "").trim();
  if (platform === "browser") return { source: "browser", platform: "browser" };
  if (platform && platform !== "all") return { source: "social", platform };
  return { source: AppState.activeSource === "browser" ? "browser" : "social", platform: AppState.activePlatform || "all" };
}

function getCategoryCountsForContext(context = {}) {
  const source = context.source || AppState.activeSource || "social";
  const platform = context.platform || AppState.activePlatform || "all";
  const root = AppState.libraryCounts && AppState.libraryCounts.collections;
  if (root) {
    if (source === "browser") return root.browser || { all: 0, uncategorized: 0 };
    if (platform && platform !== "all" && root.platforms && root.platforms[platform]) return root.platforms[platform];
    return root.social || { all: 0, uncategorized: 0 };
  }

  const counts = { all: 0, uncategorized: 0 };
  AppState.bookmarks.forEach(bm => {
    const bmSource = bm.source === "browser" || bm.platform === "browser" ? "browser" : "social";
    if (source === "browser" && bmSource !== "browser") return;
    if (source === "social" && bmSource === "browser") return;
    if (source === "social" && platform && platform !== "all" && bm.platform !== platform) return;
    const key = normalizeCollectionKey(bm.folder);
    counts[key] = (counts[key] || 0) + 1;
    counts.all += 1;
  });
  return counts;
}

function sortedCategoryItemsFromCounts(counts = {}, source = AppState.activeSource) {
  const defaultLabel = getCategoryDefaultLabel(source);
  return Object.entries(counts)
    .filter(([key, count]) => key !== "all" && (normalizeCollectionKey(key) === "uncategorized" || Number(count) > 0))
    .map(([key, count]) => {
      const normalized = normalizeCollectionKey(key);
      return normalized === "uncategorized"
        ? { value: "uncategorized", label: defaultLabel, count: count || 0, icon: "fa-regular fa-folder" }
        : { value: normalized, label: normalized, count: count || 0, icon: "fa-solid fa-folder" };
    })
    .filter((item, index, list) => list.findIndex(candidate => candidate.value.toLowerCase() === item.value.toLowerCase()) === index)
    .sort((a, b) => (b.count - a.count) || a.label.localeCompare(b.label));
}

function platformIconMarkup(platform, className = "") {
  const extra = className ? " " + className : "";
  if (platform === "x") {
    return "<svg class=\"platform-inline-icon" + extra + "\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M18.9 2h3.3l-7.2 8.2 8.5 11.8h-6.7l-5.2-6.9-6 6.9H2.3l7.7-8.8L1.9 2h6.8l4.7 6.3L18.9 2Zm-1.2 17.9h1.8L7.7 4H5.8l11.9 15.9Z\"/></svg>";
  }
  if (platform === "threads") {
    return "<svg class=\"platform-inline-icon" + extra + "\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M17.6 11.1c-.2-3.5-2.2-5.5-5.6-5.5-2 0-3.7.8-4.7 2.3l1.7 1.2c.7-.9 1.7-1.4 3-1.4 1.9 0 3.1 1 3.4 2.8-.9-.2-1.9-.3-3-.2-2.9.2-4.7 1.6-4.6 3.8.1 2.1 1.9 3.5 4.4 3.4 2.2-.1 3.8-1.2 4.7-3.1.7.5 1.1 1.2 1.1 2.1 0 2.6-2.5 4.4-6 4.4-4.3 0-7-3.2-7-8.7 0-5.4 2.7-8.7 7-8.7 3.1 0 5.4 1.5 6.7 4.4l2-.9C19.1 3.7 16 2 12 2 6.4 2 3 5.9 3 12.2 3 18.5 6.4 22 12 22c4.8 0 8.1-2.5 8.1-6.2 0-2.1-.9-3.6-2.5-4.7Zm-5.5 4.3c-1.2.1-2.1-.5-2.1-1.4 0-.9.9-1.5 2.5-1.6 1-.1 2 0 2.8.3-.4 1.6-1.5 2.6-3.2 2.7Z\"/></svg>";
  }
  const classes = { instagram: "fa-brands fa-instagram", facebook: "fa-brands fa-facebook", reddit: "fa-brands fa-reddit-alien", browser: "fa-solid fa-bookmark" };
  return "<i class=\"" + (classes[platform] || "fa-solid fa-circle-nodes") + extra + "\"></i>";
}

function getLoadedTagCounts() {
  const counts = {};
  AppState.bookmarks.forEach(bm => {
    if (!Array.isArray(bm.hashtags)) return;
    bm.hashtags.forEach(tag => {
      const clean = String(tag || "").trim().toLowerCase();
      if (clean) counts[clean] = (counts[clean] || 0) + 1;
    });
  });
  return counts;
}

function updateSidebarNavigation() {
  const platformCounts = AppState.platformCounts ? { ...AppState.platformCounts } : { all: AppState.bookmarks.length, instagram: 0, x: 0, threads: 0, reddit: 0, facebook: 0 };
  if (!AppState.platformCounts) {
    AppState.bookmarks.forEach(bm => {
      let platform = (bm.platform || "web").toLowerCase().trim();
      if (platform === "twitter") platform = "x";
      if (platformCounts[platform] !== undefined) platformCounts[platform]++;
    });
  }

  Object.entries(platformCounts).forEach(([platform, count]) => {
    const el = document.getElementById("count-platform-" + platform);
    if (el) el.textContent = count;
  });

  const browserCount = AppState.libraryCounts && AppState.libraryCounts.sources ? AppState.libraryCounts.sources.browser : (AppState.activeSource === "browser" ? AppState.bookmarks.length : 0);
  const browserCountEl = document.getElementById("count-browser-bookmarks");
  if (browserCountEl) browserCountEl.textContent = browserCount || 0;

  const browserItem = document.getElementById("sidebar-browser-item");
  if (browserItem) browserItem.classList.toggle("active", AppState.activeSource === "browser" && !AppState.isSettingsOpen);

  const settingsButton = document.getElementById("btn-settings");
  if (settingsButton) settingsButton.classList.toggle("active", !!AppState.isSettingsOpen);

  if (DOM.sidebarPlatformList) {
    DOM.sidebarPlatformList.querySelectorAll(".menu-item").forEach(item => {
      const btn = item.querySelector("[data-platform]");
      item.classList.toggle("active", !AppState.isSettingsOpen && AppState.activeSource === "social" && btn && btn.dataset.platform === AppState.activePlatform);
    });
  }

  const collectionSection = DOM.sidebarCollectionList ? DOM.sidebarCollectionList.closest(".sidebar-section") : null;
  if (collectionSection) collectionSection.hidden = false;
  if (AppState.activeSource !== "social") {
    const collectionList = DOM.sidebarCollectionList;
    if (collectionList) {
      const browserCollections = getLibraryCountGroup("collections", "browser") || { all: browserCount || 0, uncategorized: 0 };
      collectionList.innerHTML = "";
      [
        { value: "all", label: "All", count: browserCollections.all || browserCount || 0, icon: "fa-solid fa-folder-tree" },
        { value: "uncategorized", label: "Others", count: browserCollections.uncategorized || 0, icon: "fa-regular fa-folder" }
      ].forEach(item => {
        const li = document.createElement("li");
        li.className = "menu-item sidebar-category-disabled";
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.collection = item.value;
        button.disabled = true;
        const icon = document.createElement("i");
        icon.className = item.icon;
        const label = document.createElement("span");
        label.textContent = item.label;
        const count = document.createElement("span");
        count.className = "menu-count";
        count.textContent = item.count || 0;
        button.append(icon, label, count);
        li.appendChild(button);
        collectionList.appendChild(li);
      });
    }
    syncFilterSelects();
    return;
  }

  const counts = getLibraryCountGroup("collections") || getLoadedCollectionCounts();
  const collectionList = DOM.sidebarCollectionList;
  if (collectionList) {
    collectionList.innerHTML = "";
    const allItem = { value: "all", label: "All", count: counts.all || 0, icon: "fa-solid fa-folder-tree" };
    const categoryItems = sortedCategoryItemsFromCounts(counts, "social");
    if (!categoryItems.some(item => item.value === "uncategorized")) {
      categoryItems.unshift({ value: "uncategorized", label: "Others", count: 0, icon: "fa-regular fa-folder" });
    }

    [allItem, ...categoryItems].forEach(item => {
      const li = document.createElement("li");
      li.className = "menu-item" + (AppState.activeCollection === item.value ? " active" : "");
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.collection = item.value;
      const icon = document.createElement("i");
      icon.className = item.icon;
      const label = document.createElement("span");
      label.textContent = item.label;
      const count = document.createElement("span");
      count.className = "menu-count";
      count.textContent = item.count || 0;
      button.append(icon, label, count);
      li.appendChild(button);
      collectionList.appendChild(li);
    });
  }

  syncFilterSelects();
}
/**
 * Apply both active platform and tag filters along with text search query
 */
function applyFiltersAndSearch() {
  const query = AppState.searchQuery.toLowerCase().trim();

  AppState.filteredBookmarks = AppState.bookmarks.filter(bm => {
    // 1. Platform Filter
    if (AppState.activePlatform !== 'all' && bm.platform !== AppState.activePlatform) {
      return false;
    }

    // 1.5. Collection Filter
    if (AppState.activeSource === 'social' && AppState.activeCollection && AppState.activeCollection !== 'all') {
      if (AppState.activeCollection === 'uncategorized') {
        if (bm.folder && bm.folder.trim()) return false;
      } else {
        if ((bm.folder || '').trim() !== AppState.activeCollection) return false;
      }
    }

    // 2. Tag Filter
    if (AppState.activeTag !== 'all') {
      const hasTag = bm.hashtags && bm.hashtags.some(t => t.toLowerCase() === AppState.activeTag);
      if (!hasTag) return false;
    }

    // 3. Search Bar scanning
    if (query !== '') {
      const matchAuthorName = bm.authorName && bm.authorName.toLowerCase().includes(query);
      const matchUsername = bm.authorUsername && bm.authorUsername.toLowerCase().includes(query);
      const matchContent = bm.content && bm.content.toLowerCase().includes(query);
      const matchNotes = bm.notes && bm.notes.toLowerCase().includes(query);
      const matchTags = bm.hashtags && bm.hashtags.some(t => t.toLowerCase().includes(query));

      return matchAuthorName || matchUsername || matchContent || matchNotes || matchTags;
    }

    return true;
  });

  // Sort bookmarks by active criteria (strictly based on scraped date).
  AppState.filteredBookmarks.sort((a, b) => {
    if (AppState.activeSort === 'recent-desc') {
      return getBookmarkDateMs(b, ['firstSavedAt', 'createdAt', 'extensionScrapedAt', 'sourceSavedAt', 'timestamp']) - getBookmarkDateMs(a, ['firstSavedAt', 'createdAt', 'extensionScrapedAt', 'sourceSavedAt', 'timestamp']);
    } else if (AppState.activeSort === 'recent-asc') {
      return getBookmarkDateMs(a, ['firstSavedAt', 'createdAt', 'extensionScrapedAt', 'sourceSavedAt', 'timestamp']) - getBookmarkDateMs(b, ['firstSavedAt', 'createdAt', 'extensionScrapedAt', 'sourceSavedAt', 'timestamp']);
    } else if (AppState.activeSort === 'author-asc') {
      const nameA = (a.authorName || '').toLowerCase();
      const nameB = (b.authorName || '').toLowerCase();
      return nameA.localeCompare(nameB);
    } else if (AppState.activeSort === 'author-desc') {
      const nameA = (a.authorName || '').toLowerCase();
      const nameB = (b.authorName || '').toLowerCase();
      return nameB.localeCompare(nameA);
    }
    return 0;
  });

  // Reset pagination on any filter/search change
  AppState.visibleCount = POSTS_PER_PAGE;

  // Update Headers
  updateFeedHeaders();

  // Update Analytics Dashboard (if open)
  updateStatsAnalytics();

  // Render final filtered list
  renderFeedGrid();

  // Sync sidebar active highlights and platform/category/tag counts
  updateSidebarNavigation();
}

/**
 * Update Feed Grid Title & Subtitle text dynamically
 */
function updateFeedHeaders() {
  let title = 'All Bookmarks';
  if (AppState.activePlatform === 'x') title = 'X / Twitter';
  if (AppState.activePlatform === 'instagram') title = 'Instagram';
  if (AppState.activePlatform === 'threads') title = 'Threads';
  if (AppState.activePlatform === 'facebook') title = 'Facebook';
  if (AppState.activePlatform === 'reddit') title = 'Reddit';

  if (AppState.activeCollection && AppState.activeCollection !== 'all') {
    title += ` in ${AppState.activeCollection === '__uncategorized__' || AppState.activeCollection === 'uncategorized' ? 'Others' : AppState.activeCollection}`;
  }

  if (AppState.activeTag !== 'all') {
    title += ` (#${AppState.activeTag})`;
  }

  DOM.feedTitle.textContent = title;

  const count = AppState.filteredBookmarks.length;
  DOM.feedSubtitle.textContent = `Showing ${count} bookmark${count === 1 ? '' : 's'} matching search criteria`;
}

/**
 * Generate a beautiful, stable, unique pastel gradient for Instagram card fallbacks
 */
function getInstagramFallbackGradient(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue1 = Math.abs(hash % 360);
  const hue2 = (hue1 + 45) % 360;
  return `linear-gradient(135deg, hsl(${hue1}, 85%, 93%) 0%, hsl(${hue2}, 90%, 97%) 100%)`;
}

/**
 * Render processed lists inside bookmarks grid container
 */
/**
 * Build a single bookmark card DOM element
 */
function buildCardElement(bm) {
  const card = document.createElement('div');
  const platformClass = bm.platform === 'instagram' ? 'ig-post instagram-post' : `${bm.platform}-post`;
  card.className = `bookmark-card ${platformClass}`;
  card.setAttribute('data-id', bm.id);

  const initials = bm.authorName ? bm.authorName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '?';

  // Build tags markup (limit to 3 visible, only real hashtags)
  let tagsMarkup = '';
  const bmHashtags = bm.hashtags || [];
  if (bmHashtags.length > 0) {
    const visibleTags = bmHashtags.slice(0, 3);
    tagsMarkup = visibleTags.map(t => `<span class="card-tag">#${t}</span>`).join('');
    if (bmHashtags.length > 3) {
      tagsMarkup += `<span class="card-tag" style="opacity:0.5;">+${bmHashtags.length - 3}</span>`;
    }
  }

  // Action Buttons and Notes markup
  const notesVal = bm.notes || '';
  const notesMarkup = `
    <div class="card-actions-row">
      <button type="button" class="btn-card-action btn-read-post" data-id="${bm.id}">
        Read full post <i class="fa-solid fa-chevron-down" style="font-size: 0.7rem; margin-left: 2px;"></i>
      </button>
      <button type="button" class="btn-card-action btn-add-note" data-id="${bm.id}">
        <i class="fa-solid fa-file-pen" style="font-size: 0.85rem; margin-right: 2px;"></i> ${notesVal ? 'Edit Note' : 'Add Note'}
      </button>
    </div>
    ${notesVal ? `<div class="card-notes-display" style="margin-top: 8px;"><i class="fa-solid fa-note-sticky"></i> ${escapeHTML(notesVal)}</div>` : ''}
  `;

  let folderVal = bm.source === "browser" ? browserCategoryLabel(bm.folder) : socialCategoryLabel(bm.folder);
  const folderMarkup = bm.source === "browser" ? "" : "\n    <div class=\"card-category-container\">" +
    "\n      <button type=\"button\" class=\"btn-card-category\" title=\"Show category\" aria-expanded=\"false\">" +
    "\n        <i class=\"fa-solid fa-folder\"></i>" +
    "\n      </button>" +
    "\n      <div class=\"card-category-popover\" role=\"status\">" +
    "\n        <span>Category</span>" +
    "\n        <strong>" + escapeHTML(folderVal) + "</strong>" +
    "\n      </div>" +
    "\n    </div>";


  // Build visual card-media
  let mediaMarkup = '';
  const isBrowserBookmark = bm.source === 'browser' || bm.platform === 'browser';
  if (isBrowserBookmark) {
    if (bm.thumbnail) {
      mediaMarkup = `
        <div class="card-media browser-card-media">
          <img src="${escapeHTML(bm.thumbnail)}" alt="Saved Link Preview" loading="lazy" onerror="handleImageError(this, '${bm.id}', 'browser')">
        </div>
      `;
    } else {
      mediaMarkup = `
        <div class="card-media fallback-media browser-fallback">
          <div class="fallback-gradient">
            ${platformIconMarkup("browser", "fallback-inline-icon")}
            <span class="fallback-title">Saved Link</span>
            <span class="fallback-subtitle">Click to Open</span>
          </div>
        </div>
      `;
    }
  } else if (bm.platform === 'instagram') {
    if (bm.thumbnail) {
      mediaMarkup = `
        <div class="card-media">
          <img src="${bm.thumbnail}" alt="Instagram Post" loading="lazy" onerror="handleImageError(this, '${bm.id}', 'instagram')">
        </div>
      `;
    } else {
      const bgGradient = getInstagramFallbackGradient(bm.id);
      const isReel = bm.url && bm.url.includes('/reel/');
      mediaMarkup = `
        <div class="card-media fallback-media" style="background: ${bgGradient};">
          <div class="fallback-gradient">
            <i class="fa-brands fa-instagram fallback-icon"></i>
            <span class="fallback-title">${isReel ? 'Instagram Reel' : 'Instagram Post'}</span>
            <span class="fallback-subtitle">Click to View</span>
          </div>
        </div>
      `;
    }
  } else if (bm.platform === 'x') {
    if (bm.thumbnail) {
      mediaMarkup = `
        <div class="card-media">
          <img src="${bm.thumbnail}" alt="X Post" loading="lazy" onerror="handleImageError(this, '${bm.id}', 'x')">
        </div>
      `;
    } else {
      mediaMarkup = `
        <div class="card-media fallback-media" style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-color: rgba(255,255,255,0.05);">
          <div class="fallback-gradient" style="color: #f8fafc;">
            ${platformIconMarkup("x", "fallback-inline-icon")}
            <span class="fallback-title" style="color: #f8fafc;">X Post</span>
            <span class="fallback-subtitle" style="color: #cbd5e1;">Click to View</span>
          </div>
        </div>
      `;
    }
  } else if (bm.platform === 'threads') {
    if (bm.thumbnail) {
      mediaMarkup = `
        <div class="card-media">
          <img src="${bm.thumbnail}" alt="Threads Post" loading="lazy" onerror="handleImageError(this, '${bm.id}', 'threads')">
        </div>
      `;
    } else {
      mediaMarkup = `
        <div class="card-media fallback-media" style="background: linear-gradient(135deg, #262626 0%, #000000 100%); border-color: rgba(255,255,255,0.05);">
          <div class="fallback-gradient" style="color: #f8fafc;">
            ${platformIconMarkup("threads", "fallback-inline-icon")}
            <span class="fallback-title" style="color: #f8fafc;">Threads Post</span>
            <span class="fallback-subtitle" style="color: #cbd5e1;">Click to View</span>
          </div>
        </div>
      `;
    }
  } else if (bm.platform === 'reddit') {
    if (bm.thumbnail) {
      mediaMarkup = `
        <div class="card-media">
          <img src="${bm.thumbnail}" alt="Reddit Post" loading="lazy" onerror="handleImageError(this, '${bm.id}', 'reddit')">
        </div>
      `;
    } else {
      mediaMarkup = `
        <div class="card-media fallback-media reddit-fallback">
          <div class="fallback-gradient" style="color: #ff4500;">
            <i class="fa-brands fa-reddit-alien fallback-icon" style="background: none; -webkit-text-fill-color: #ff4500; color: #ff4500; font-size: 1.4rem; opacity: 0.9;"></i>
            <span class="fallback-title" style="color: var(--text-primary);">Reddit Post</span>
            <span class="fallback-subtitle" style="color: var(--text-muted);">Click to View</span>
          </div>
        </div>
      `;
    }
  } else if (bm.platform === 'facebook') {
    if (bm.thumbnail) {
      mediaMarkup = `
        <div class="card-media">
          <img src="${bm.thumbnail}" alt="Facebook Post" loading="lazy" onerror="handleImageError(this, '${bm.id}', 'facebook')">
        </div>
      `;
    } else {
      mediaMarkup = `
        <div class="card-media fallback-media" style="background: linear-gradient(135deg, #e7f3ff 0%, #cbd5e1 100%);">
          <div class="fallback-gradient" style="color: var(--platform-fb);">
            <i class="fa-brands fa-facebook fallback-icon" style="background: none; -webkit-text-fill-color: var(--platform-fb); color: var(--platform-fb); font-size: 1.4rem; opacity: 0.85;"></i>
            <span class="fallback-title" style="color: var(--text-primary);">Facebook Post</span>
            <span class="fallback-subtitle" style="color: var(--text-muted);">Click to View</span>
          </div>
        </div>
      `;
    }
  }

  const checkboxMarkup = `
    <div class="card-checkbox-container">
      <input type="checkbox" class="card-checkbox" data-id="${bm.id}" ${AppState.selectedIds.has(bm.id) ? 'checked' : ''}>
    </div>
  `;

  card.innerHTML = `
    <div class="card-header">
      ${checkboxMarkup}
      <div class="card-author-info">
        <div class="author-avatar">${initials}</div>
        <div class="author-names">
          <span class="author-name">${escapeHTML(bm.authorName || 'Social Post')}</span>
          <span class="author-username">@${escapeHTML(bm.authorUsername || 'user')}</span>
        </div>
      </div>
      <div class="card-header-actions">
        ${folderMarkup}
        
        <div class="card-menu-container">
          <button class="btn-card-menu" title="Actions">
            <i class="fa-solid fa-ellipsis-vertical"></i>
          </button>
          <div class="card-menu-dropdown">
            <button class="menu-item-edit"><i class="fa-solid fa-pen"></i> Edit</button>
            <button class="menu-item-delete"><i class="fa-solid fa-trash"></i> Delete</button>
          </div>
        </div>

        <div class="card-platform-icon" title="Original Platform: ${(bm.platform || "web").toUpperCase()}">
          ${platformIconMarkup(bm.platform)}
        </div>
      </div>
    </div>
    
    <div class="card-body">
      <div class="post-quote-icon"><i class="fa-solid fa-quote-left"></i></div>
      ${(() => {
      const contentVal = cleanPostContent(bm.content, bm.platform) || 'Saved Post details';
      const words = contentVal.split(/\s+/);
      const hasMore = words.length > 50;
      const summaryText = hasMore ? words.slice(0, 50).join(' ') + '...' : contentVal;
      return `<div class="post-content">${escapeHTML(summaryText)}</div>`;
    })()}
      ${mediaMarkup}
      ${notesMarkup}
    </div>
    
    <div class="card-footer">
      ${tagsMarkup}
    </div>
  `;

  // Attach handlers
  const readBtn = card.querySelector('.btn-read-post');
  if (bm.source === 'browser' && readBtn) readBtn.remove();
  if (readBtn) {
    readBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openPostModal(bm.id, false);
    });
  }

  const addNoteBtn = card.querySelector('.btn-add-note');
  if (addNoteBtn) {
    addNoteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openPostModal(bm.id, true);
    });
  }



  // Category icon popover binding
  const categoryBtn = card.querySelector('.btn-card-category');
  const categoryPopover = card.querySelector('.card-category-popover');
  if (categoryBtn && categoryPopover) {
    categoryBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.card-category-popover.active').forEach(el => {
        if (el !== categoryPopover) el.classList.remove('active');
      });
      document.querySelectorAll('.card-menu-dropdown.active').forEach(el => el.classList.remove('active'));
      const willOpen = !categoryPopover.classList.contains('active');
      categoryPopover.classList.toggle('active', willOpen);
      categoryBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });
  }

  // Three-dots dropdown bindings
  const menuBtn = card.querySelector('.btn-card-menu');
  const dropdown = card.querySelector('.card-menu-dropdown');

  if (menuBtn && dropdown) {
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.card-menu-dropdown.active').forEach(el => {
        if (el !== dropdown) el.classList.remove('active');
      });
      dropdown.classList.toggle('active');
    });

    const editBtn = card.querySelector('.menu-item-edit');
    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.remove('active');
        openEditBookmarkModal(bm);
      });
    }

    const deleteBtn = card.querySelector('.menu-item-delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.remove('active');
        if (confirm("Are you sure you want to permanently delete this bookmark?")) {
          deleteBookmark(bm.id);
        }
      });
    }
  }

  // Checkbox select bindings
  const checkbox = card.querySelector('.card-checkbox');
  if (checkbox) {
    checkbox.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSelectBookmark(bm.id, checkbox.checked);
    });
  }

  // Redirect to platform post or select card in selection mode
  card.addEventListener('click', (e) => {
    if (e.target.closest('.card-notes-edit') || e.target.closest('.card-folder-area') || e.target.closest('.card-category-container') || e.target.closest('.card-menu-container') || e.target.closest('.card-checkbox-container')) return;

    if (AppState.isSelectionMode) {
      const cb = card.querySelector('.card-checkbox');
      if (cb) {
        cb.checked = !cb.checked;
        toggleSelectBookmark(bm.id, cb.checked);
      }
    } else {
      window.open(bm.url, '_blank');
    }
  });

  return card;
}

/**
 * Render the Infinite Scroll Sentinel and status at the bottom of the feed
 */
function renderInfiniteScrollSentinel() {
  // Remove existing sentinel/load-more if present
  const existingSentinel = document.getElementById('infinite-scroll-sentinel');
  if (existingSentinel) existingSentinel.remove();
  const existingLoadMore = document.querySelector('.load-more-wrapper');
  if (existingLoadMore) existingLoadMore.remove();

  const total = AppState.filteredBookmarks.length;
  const showing = Math.min(AppState.visibleCount, total);

  if (total === 0) return; // Empty feed, no sentinel needed

  const sentinel = document.createElement('div');
  sentinel.id = 'infinite-scroll-sentinel';
  sentinel.className = 'infinite-scroll-sentinel';

  if (showing < total) {
    sentinel.innerHTML = `
      <div class="infinite-scroll-spinner">
        <i class="fa-solid fa-circle-notch fa-spin"></i>
        <span>Loading more bookmarks...</span>
      </div>
    `;
  } else {
    sentinel.innerHTML = `
      <div class="infinite-scroll-end">
        Showing all ${total} bookmarks
      </div>
    `;
  }

  // Insert after the grid
  DOM.bookmarksGrid.parentNode.insertBefore(sentinel, DOM.bookmarksGrid.nextSibling);

  // Bind/observe intersection if there are more bookmarks to load
  if (showing < total) {
    initInfiniteScrollObserver();
  } else if (AppState.scrollObserver) {
    AppState.scrollObserver.disconnect();
  }
}

let isScrollLoading = false;

/**
 * Initialize IntersectionObserver to trigger infinite scroll load
 */
function initInfiniteScrollObserver() {
  if (AppState.scrollObserver) {
    AppState.scrollObserver.disconnect();
  }

  const sentinel = document.getElementById('infinite-scroll-sentinel');
  const scrollContainer = document.getElementById('main-panel');
  if (!sentinel || !scrollContainer) return;

  AppState.scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !isScrollLoading) {
        const total = AppState.filteredBookmarks.length;
        if (AppState.visibleCount < total) {
          isScrollLoading = true;

          // Smooth micro-delay loading effect so the user sees the spinner spin cleanly
          setTimeout(() => {
            AppState.visibleCount += POSTS_PER_PAGE;
            renderFeedGrid();
            isScrollLoading = false;
          }, 450);
        }
      }
    });
  }, {
    root: scrollContainer,
    rootMargin: '200px' // Load 200px before reaching the bottom for seamless experience
  });

  AppState.scrollObserver.observe(sentinel);
}

function getGridColumnCount() {
  const w = window.innerWidth;
  if (w <= 768) return 2;
  if (w <= 1100) return 3;
  return 4;
}

/**
 * Render paginated bookmarks grid — only the first visibleCount items
 */
function browserCategorySortKey(label) {
  return label === "General Links" ? "" : label.toLowerCase();
}

function renderBrowserGroupedFeed(visibleSlice) {
  DOM.bookmarksGrid.classList.add("browser-grouped-feed");
  const groups = new Map();
  visibleSlice.forEach(bm => {
    const label = browserCategoryLabel(bm.folder);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(bm);
  });

  if (!groups.has("General Links")) {
    groups.set("General Links", []);
  }

  const ordered = Array.from(groups.entries()).sort(([a], [b]) => browserCategorySortKey(a).localeCompare(browserCategorySortKey(b)));
  const fragment = document.createDocumentFragment();
  ordered.forEach(([label, items]) => {
    const section = document.createElement("section");
    section.className = "browser-category-section";
    section.innerHTML = `
      <div class="browser-category-heading">
        <div>
          <h3>${escapeHTML(label)}</h3>
          <p>${items.length} saved link${items.length === 1 ? "" : "s"}</p>
        </div>
      </div>
      <div class="browser-category-grid"></div>
    `;
    const grid = section.querySelector(".browser-category-grid");
    items.forEach(bm => grid.appendChild(buildCardElement(bm)));
    fragment.appendChild(section);
  });
  DOM.bookmarksGrid.appendChild(fragment);
}

function renderFeedGrid() {
  DOM.bookmarksGrid.innerHTML = "";
  DOM.bookmarksGrid.classList.remove("browser-grouped-feed");

  if (AppState.filteredBookmarks.length === 0) {
    if (AppState.activeSource === "browser") {
      renderBrowserGroupedFeed([]);
    } else {
      DOM.bookmarksGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon"><i class="fa-solid fa-folder-open"></i></div>
          <h3>No bookmarks found</h3>
          <p>Try clearing your search filters, adjusting categories, or importing a fresh data archive.</p>
        </div>
      `;
    }
    const existing = document.getElementById("infinite-scroll-sentinel");
    if (existing) existing.remove();
    return;
  }

  const visibleSlice = AppState.filteredBookmarks.slice(0, AppState.visibleCount);

  if (AppState.activeSource === "browser") {
    renderBrowserGroupedFeed(visibleSlice);
  } else if (AppState.activeLayout === "list" || AppState.activeLayout === "compact") {
    const fragment = document.createDocumentFragment();
    visibleSlice.forEach(bm => {
      fragment.appendChild(buildCardElement(bm));
    });
    DOM.bookmarksGrid.appendChild(fragment);
  } else {
    const numCols = getGridColumnCount();
    const cols = [];
    for (let i = 0; i < numCols; i++) {
      const colDiv = document.createElement("div");
      colDiv.className = "masonry-col";
      cols.push(colDiv);
    }

    visibleSlice.forEach((bm, index) => {
      const targetCol = cols[index % numCols];
      targetCol.appendChild(buildCardElement(bm));
    });

    const fragment = document.createDocumentFragment();
    cols.forEach(col => fragment.appendChild(col));
    DOM.bookmarksGrid.appendChild(fragment);
  }

  renderInfiniteScrollSentinel();
}

/**
 * Open Slide Drawer Details View
 */
function saveBookmarkNotes(id, notes) {
  const idx = AppState.bookmarks.findIndex(bm => bm.id === id);
  if (idx !== -1) {
    AppState.bookmarks[idx].notes = notes;
    saveDataToServer();
    showToast("Notes auto-saved!", "success");
  }
}

/**
 * Update Folder metadata on a specific bookmark and sync to disk
 */
function saveBookmarkFolder(id, folder) {
  const idx = AppState.bookmarks.findIndex(bm => bm.id === id);
  if (idx !== -1) {
    AppState.bookmarks[idx].folder = folder;
    processCollections();
    updateCollectionsFilterDropdown();
    applyFiltersAndSearch();
    saveDataToServer();
    showToast(folder ? `Moved bookmark to "${folder}"` : "Removed from collection", "success");
  }
}

/**
 * Layout Switcher Controller
 */
function changeLayout(layout, showFeedbackToast = true) {
  AppState.activeLayout = layout;
  localStorage.setItem('bookmarks_layout', layout);

  const menu = document.getElementById('toolbar-layout-menu');
  if (menu) {
    menu.querySelectorAll('.dropdown-item').forEach(item => {
      const isMatch = item.getAttribute('data-layout') === layout;
      item.classList.toggle('active', isMatch);
      const checkIcon = item.querySelector('.check-icon');
      if (checkIcon) {
        checkIcon.style.visibility = isMatch ? 'visible' : 'hidden';
      }
    });
  }

  const activeIcon = document.getElementById('layout-active-icon');
  const activeLabel = document.getElementById('layout-active-label');
  if (activeIcon) {
    activeIcon.className = (() => {
      if (layout === 'grid') return 'fa-solid fa-grip';
      if (layout === 'list') return 'fa-solid fa-list';
      if (layout === 'compact') return 'fa-solid fa-bars';
      return 'fa-solid fa-grip';
    })();
  }
  if (activeLabel) {
    activeLabel.textContent = layout.charAt(0).toUpperCase() + layout.slice(1) + ' View';
  }

  if (DOM.bookmarksGrid) {
    DOM.bookmarksGrid.classList.remove('list-view', 'compact-view');
    if (layout === 'list') {
      DOM.bookmarksGrid.classList.add('list-view');
    } else if (layout === 'compact') {
      DOM.bookmarksGrid.classList.add('compact-view');
    }
  }

  renderFeedGrid();

  if (showFeedbackToast) {
    showToast(`Switched to ${layout.charAt(0).toUpperCase() + layout.slice(1)} view`, 'info');
  }
}

/**
 * Compute metrics and update dashboard counts in real time
 */
function categoryRowsMarkup(counts = {}, source = "social") {
  const items = sortedCategoryItemsFromCounts(counts, source).filter(item => item.count > 0);
  if (items.length === 0) return '<div class="stats-empty-line">No categories yet</div>';
  const total = Number(counts.all) || items.reduce((sum, item) => sum + Number(item.count || 0), 0) || 1;
  return items.map(item => {
    const pct = Math.round((Number(item.count || 0) / total) * 100);
    return '<div class="stats-category-row">' +
      '<div class="metric-info"><span>' + escapeHTML(item.label) + '</span><span>' + item.count + '</span></div>' +
      '<div class="metric-bar-container tiny"><div class="metric-bar" style="width:' + pct + '%;"></div></div>' +
    '</div>';
  }).join('');
}

function updateStatsAnalytics() {
  const panel = document.getElementById("stats-panel");
  if (!panel || panel.style.display === "none") return;

  const platformContainer = document.getElementById("stat-platform-splits");
  const browserContainer = document.getElementById("stat-browser-splits");
  if (!platformContainer || !browserContainer) return;

  const platformCounts = AppState.platformCounts || {};
  const socialTotal = Number(platformCounts.all) || 0;
  const platformRows = [
    { key: "instagram", label: "Instagram", count: Number(platformCounts.instagram) || 0, barClass: "ig-bar" },
    { key: "x", label: "X / Twitter", count: Number(platformCounts.x) || 0, barClass: "x-bar" },
    { key: "threads", label: "Threads", count: Number(platformCounts.threads) || 0, barClass: "threads-bar" },
    { key: "reddit", label: "Reddit", count: Number(platformCounts.reddit) || 0, barClass: "reddit-bar" },
    { key: "facebook", label: "Facebook", count: Number(platformCounts.facebook) || 0, barClass: "fb-bar" }
  ];

  platformContainer.innerHTML = platformRows.map(row => {
    const pct = socialTotal > 0 ? Math.round((row.count / socialTotal) * 100) : 0;
    const isOpen = AppState.analyticsOpenPlatform === row.key;
    const collectionCounts = getLibraryCountGroup("collections", row.key) || { all: row.count, uncategorized: 0 };
    return '<div class="stats-platform-block' + (isOpen ? ' open' : '') + '">' +
      '<button type="button" class="stats-metric-row stats-metric-button" data-analytics-platform="' + row.key + '">' +
        '<div class="metric-info"><span>' + escapeHTML(row.label) + '</span><span>' + row.count + ' (' + pct + '%)</span></div>' +
        '<div class="metric-bar-container"><div class="metric-bar ' + row.barClass + '" style="width:' + pct + '%;"></div></div>' +
      '</button>' +
      '<div class="stats-category-breakdown"' + (isOpen ? '' : ' hidden') + '>' + categoryRowsMarkup(collectionCounts, "social") + '</div>' +
    '</div>';
  }).join('');

  platformContainer.querySelectorAll('[data-analytics-platform]').forEach(button => {
    button.addEventListener('click', () => {
      const next = button.dataset.analyticsPlatform;
      AppState.analyticsOpenPlatform = AppState.analyticsOpenPlatform === next ? '' : next;
      updateStatsAnalytics();
    });
  });

  const sources = AppState.libraryCounts && AppState.libraryCounts.sources ? AppState.libraryCounts.sources : {};
  const browserTotal = Number(sources.browser) || 0;
  const grandTotal = (Number(sources.social) || socialTotal) + browserTotal;
  const browserPct = grandTotal > 0 ? Math.round((browserTotal / grandTotal) * 100) : 0;
  const browserCollections = getCategoryCountsForContext({ source: "browser", platform: "browser" });
  browserContainer.innerHTML = '<div class="stats-platform-block open">' +
    '<div class="stats-metric-row">' +
      '<div class="metric-info"><span>Saved Links</span><span>' + browserTotal + ' (' + browserPct + '%)</span></div>' +
      '<div class="metric-bar-container"><div class="metric-bar browser-bar" style="width:' + browserPct + '%;"></div></div>' +
    '</div>' +
    '<div class="stats-category-breakdown">' + categoryRowsMarkup(browserCollections, "browser") + '</div>' +
  '</div>';
}


function setManualImageFromFile(file) {
  if (!file) return;
  if (!file.type || !file.type.startsWith('image/')) {
    showToast('Please choose an image file.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = event => {
    if (DOM.addThumbnail) DOM.addThumbnail.value = String(event.target.result || '');
    updateManualImagePreview();
    showToast('Image ready. It will upload to Cloudinary on save.', 'success');
  };
  reader.onerror = () => showToast('Could not read image file.', 'error');
  reader.readAsDataURL(file);
}

function setManualImageSourceControlsVisible(visible) {
  if (DOM.addImageSourceControls) DOM.addImageSourceControls.hidden = !visible;
}

function clearManualImageValue() {
  if (DOM.addThumbnail) DOM.addThumbnail.value = '';
  if (DOM.addImageFile) DOM.addImageFile.value = '';
  updateManualImagePreview();
}

function updateManualImagePreview() {
  if (!DOM.addImagePreview || !DOM.addThumbnail) return;
  const value = DOM.addThumbnail.value.trim();
  if (!value) {
    DOM.addImagePreview.hidden = true;
    DOM.addImagePreview.innerHTML = '';
    setManualImageSourceControlsVisible(true);
    return;
  }
  setManualImageSourceControlsVisible(false);
  DOM.addImagePreview.hidden = false;
  DOM.addImagePreview.innerHTML = '<button type="button" class="manual-image-remove" title="Remove image" aria-label="Remove image"><i class="fa-solid fa-xmark"></i></button><img src="' + escapeHTML(value) + '" alt="Image preview" loading="lazy">';
}

function setManualImageFieldVisible(visible) {
  if (!DOM.addImageField) return;
  DOM.addImageField.hidden = !visible;
  if (DOM.btnToggleImageField) {
    const label = DOM.btnToggleImageField.querySelector('span');
    if (label) label.textContent = visible ? 'Hide Image Field' : 'Add / Change Image';
  }
  if (visible) updateManualImagePreview();
}

function updateCategoryEditButtonVisibility() {
  if (!DOM.btnEditCategoryName || !DOM.addCategory) return;
  const value = DOM.addCategory.value;
  DOM.btnEditCategoryName.hidden = !value || value === '__new__';
}

function renameSelectedModalCategory() {
  if (!DOM.addCategory) return;
  const currentValue = DOM.addCategory.value;
  if (!currentValue || currentValue === '__new__') return;
  const currentLabel = DOM.addCategory.options[DOM.addCategory.selectedIndex] ? DOM.addCategory.options[DOM.addCategory.selectedIndex].textContent : currentValue;
  const nextName = window.prompt('Rename this category for this bookmark:', currentLabel);
  if (nextName === null) return;
  const cleaned = nextName.trim();
  if (!cleaned) {
    showToast('Category name cannot be empty.', 'error');
    return;
  }
  const normalized = normalizeCollectionKey(cleaned);
  if (normalized === 'uncategorized') {
    DOM.addCategory.value = '';
    updateCategoryEditButtonVisibility();
    return;
  }
  let option = Array.from(DOM.addCategory.options).find(opt => opt.value.toLowerCase() === normalized.toLowerCase());
  if (!option) {
    option = document.createElement('option');
    option.value = normalized;
    option.textContent = normalized;
    const newOption = Array.from(DOM.addCategory.options).find(opt => opt.value === '__new__');
    DOM.addCategory.insertBefore(option, newOption || null);
  } else {
    option.textContent = normalized;
  }
  DOM.addCategory.value = option.value;
  if (DOM.addCategoryNew) {
    DOM.addCategoryNew.style.display = 'none';
    DOM.addCategoryNew.value = '';
  }
  updateCategoryEditButtonVisibility();
  showToast('Category name updated for this save.', 'info');
}

function updateManualModalPlatformUI(platformValue = '') {
  const isBrowser = platformValue === 'browser';
  if (DOM.addTagsGroup) DOM.addTagsGroup.hidden = isBrowser;
  if (isBrowser && DOM.addTags) DOM.addTags.value = '';
}

function setRouteHash(hash) {
  if (!hash) return;
  const url = new URL(window.location.href);
  url.hash = hash;
  window.history.replaceState(null, '', url.toString());
}

function appUrlForRoute(hash) {
  const url = new URL(window.location.href);
  url.hash = hash;
  return url.toString();
}

function showSidebarContextMenu(event, hash) {
  event.preventDefault();
  document.querySelectorAll('.sidebar-context-menu').forEach(menu => menu.remove());
  const menu = document.createElement('div');
  menu.className = 'sidebar-context-menu';
  menu.style.left = event.clientX + 'px';
  menu.style.top = event.clientY + 'px';
  const item = document.createElement('button');
  item.type = 'button';
  item.innerHTML = '<i class="fa-regular fa-window-restore"></i><span>Open in new tab</span>';
  item.addEventListener('click', () => {
    window.open(appUrlForRoute(hash), '_blank', 'noopener');
    menu.remove();
  });
  menu.appendChild(item);
  document.body.appendChild(menu);
  const closeMenu = () => menu.remove();
  setTimeout(() => {
    document.addEventListener('click', closeMenu, { once: true });
    document.addEventListener('keydown', closeMenu, { once: true });
    window.addEventListener('scroll', closeMenu, { once: true, capture: true });
  }, 0);
}

function initSidebarNewTabContextMenu() {
  document.querySelectorAll('[data-sidebar-route]').forEach(button => {
    button.addEventListener('contextmenu', event => showSidebarContextMenu(event, button.dataset.sidebarRoute));
  });
}

function applyRouteFromHash(options = {}) {
  const hash = decodeURIComponent(window.location.hash || '');
  let matched = false;
  if (hash === '#settings') {
    AppState.activeSource = 'browser';
    AppState.activePlatform = 'all';
    AppState.activeCollection = 'all';
    AppState.nextCursor = null;
    matched = true;
    openSettings();
  } else if (hash === '#bookmarks') {
    AppState.activeSource = 'browser';
    AppState.activePlatform = 'all';
    AppState.activeCollection = 'all';
    AppState.nextCursor = null;
    matched = true;
    closeSettings();
  } else if (hash.startsWith('#platform=')) {
    const platform = hash.slice('#platform='.length) || 'all';
    AppState.activeSource = 'social';
    AppState.activePlatform = platform;
    AppState.activeCollection = 'all';
    AppState.nextCursor = null;
    matched = true;
    closeSettings();
  }
  if (matched) {
    syncFilterSelects();
    updateSidebarNavigation();
    if (options.load && AppState.isServerConnected) loadData();
  }
  return matched;
}
function refreshLocalMetadataAndCounts() {
  processCollections();
  updateCollectionsFilterDropdown();
  processTags();
  renderTagCloud();
  applyFiltersAndSearch();
  refreshPlatformCounts();
}

/**
 * Core Data Sync Manager: Saves the active state back to data/bookmarks.json
 */
function saveDataToServer() {
  if (!AppState.isServerConnected) {
    showToast('App is offline. Reconnect to save changes to the server.', 'error');
    return Promise.resolve(false);
  }

  DOM.syncBtn.classList.add('saving');
  DOM.syncStatusText.textContent = 'Syncing...';

  const token = localStorage.getItem('admin_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  return fetch('/api/save', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      bookmarks: AppState.bookmarks,
      deletedIds: Array.from(AppState.pendingDeletedIds)
    })
  })
    .then(res => {
      if (!res.ok) throw new Error('Server rejected save operation');
      return res.json();
    })
    .then(() => {
      AppState.pendingDeletedIds.clear();
      showToast('Synchronized successfully with server!', 'success');
      updateSyncStatusUI(true);
      refreshPlatformCounts();
      return true;
    })
    .catch(err => {
      console.error('Save failure:', err);
      showToast('Server sync failed. Data is cached in memory.', 'error');
      updateSyncStatusUI(false);
      return false;
    });
}

/**
 * Trigger manual backup download/**
 * Trigger manual backup download of bookmarks.json (Option A Fallback)
 */
function triggerManualDownload() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(AppState.bookmarks, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", "bookmarks.json");
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast("Downloaded bookmarks.json. Overwrite the file in your data/ folder to complete manual sync!", "success");
}

/**
 * Import Drag & Drop archive file parse engine
 */
function handleFileImport(file) {
  showToast(`Reading ${file.name}...`);
  const reader = new FileReader();

  reader.onload = (event) => {
    const rawContent = event.target.result;
    const parsedItems = BookmarksImporter.parse(file.name, rawContent);

    if (parsedItems.length === 0) {
      showToast("No valid supported social bookmarks were found in this file.", "error");
      return;
    }

    // Merge into current active state
    const mergeResult = BookmarksImporter.merge(AppState.bookmarks, parsedItems);
    AppState.bookmarks = mergeResult.merged;

    // Reprocess system tags and render feed
    processCollections();
    updateCollectionsFilterDropdown();
    processTags();
    renderTagCloud();
    applyFiltersAndSearch();

    // Auto sync back to server database
    saveDataToServer();

    // Close modal
    DOM.importModalOverlay.classList.remove('active');

    const added = mergeResult.addedCount;
    const updated = mergeResult.updatedCount || 0;
    if (added === 0 && updated === 0) {
      showToast("All imported bookmarks already exist in your feed.", "info");
    } else {
      showToast(`Import complete! Added ${added} new and skipped ${updated} duplicates.`, "success");
    }
  };

  reader.onerror = () => {
    showToast("Error reading selected file.", "error");
  };

  reader.readAsText(file);
}

/**
 * Add Bookmark Manually from top action bar
 */
function handleManualBookmarkSubmit(e) {
  e.preventDefault();

  const authorName = DOM.addAuthorName.value.trim();
  const content = DOM.addContent.value.trim();
  const tagListInput = DOM.addTags.value.trim();
  const imageUrl = DOM.addThumbnail ? DOM.addThumbnail.value.trim() : '';

  let categoryVal = '';
  if (DOM.addCategory.value === '__new__') {
    categoryVal = DOM.addCategoryNew.value.trim();
  } else {
    categoryVal = DOM.addCategory.value.trim();
  }
  if (categoryVal.toLowerCase() === 'uncategorized') {
    categoryVal = '';
  }

  const addPlatformSelect = document.getElementById('add-platform');
  const platform = addPlatformSelect ? addPlatformSelect.value : '';

  if (!platform) {
    showToast("Please select a platform.", "error");
    return;
  }

  if (AppState.editingId) {
    const idx = AppState.bookmarks.findIndex(bm => bm.id === AppState.editingId);
    if (idx !== -1) {
      const bm = AppState.bookmarks[idx];
      bm.platform = platform;
      bm.authorName = authorName || (defaultAuthorNameForPlatform(platform));
      bm.authorUsername = authorName ? authorName.toLowerCase().replace(/\s+/g, '') : bm.authorUsername;
      bm.content = content || bm.content;
      bm.folder = categoryVal;
      bm.source = platform === 'browser' ? 'browser' : (bm.source === 'browser' && platform !== 'browser' ? 'social' : bm.source);
      bm.thumbnail = imageUrl;

      const newUserTags = tagListInput ? tagListInput.split(',').map(t => t.trim().toLowerCase().replace('#', '')).filter(Boolean) : [];
      bm.hashtags = platform === 'browser' ? [] : newUserTags;

      // Reprocess state and write to server
      refreshLocalMetadataAndCounts();
      saveDataToServer();

      // Close Modal & Reset
      DOM.addModalOverlay.classList.remove('active');
      DOM.addBookmarkForm.reset();
      DOM.addUrl.readOnly = false;
      AppState.editingId = null;

      showToast("Bookmark updated successfully!", "success");
    }
    return;
  }

  const url = DOM.addUrl.value.trim();

  // Parse hashtags
  const hashtags = platform === 'browser' ? [] : (tagListInput ? tagListInput.split(',').map(t => t.trim().toLowerCase().replace('#', '')).filter(Boolean) : []);

  // Extract unique code or ID for deduplication keys
  let id = '';
  if (platform === 'x') {
    const match = url.match(/\/status\/(\d+)/i);
    id = `x_${match ? match[1] : Date.now()}`;
  } else if (platform === 'instagram') {
    const code = BookmarksImporter.extractInstagramCode(url);
    id = `ig_${code || Date.now()}`;
  } else if (platform === 'threads') {
    const match = url.match(/\/post\/([A-Za-z0-9_-]+)/i);
    id = `threads_${match ? match[1] : Date.now()}`;
  } else if (platform === 'facebook') {
    const match = url.match(/\/posts\/([A-Za-z0-9_-]+)/i) || url.match(/story_fbid=([0-9]+)/i);
    id = `fb_${match ? match[1] : Date.now()}`;
  } else {
    id = `${platform}_${Date.now()}`;
  }

  // Create new bookmark record
  const newBookmark = {
    id: id,
    platform: platform,
    url: url,
    authorName: authorName || (defaultAuthorNameForPlatform(platform)),
    authorUsername: authorName ? authorName.toLowerCase().replace(/\s+/g, '') : 'username',
    content: content || `Saved ${platform.toUpperCase()} Post (click to load embed)`,
    timestamp: new Date().toISOString(),
    hashtags: hashtags,
    folder: categoryVal,
    notes: '',
    thumbnail: imageUrl
  };

  // Merge (deduplicate)
  const mergeResult = BookmarksImporter.merge(AppState.bookmarks, [newBookmark]);

  if (mergeResult.addedCount === 0) {
    showToast("This post is already in your bookmark feed!", "error");
    return;
  }

  AppState.bookmarks = mergeResult.merged;

  // Reprocess state and write to server
  refreshLocalMetadataAndCounts();
  saveDataToServer();

  // Close Modal
  DOM.addModalOverlay.classList.remove('active');
  DOM.addBookmarkForm.reset();

  showToast("Bookmark added to feed successfully!", "success");
}

/**
 * Populate the Category select dropdown in the Add/Edit bookmark modal
 */
function populateModalCategorySelect(selectedVal = '', context = null) {
  if (!DOM.addCategory) return;
  const platformSelect = document.getElementById('add-platform');
  const resolvedContext = context || getCategoryContextFromPlatform(platformSelect ? platformSelect.value : '');
  const counts = getCategoryCountsForContext(resolvedContext);
  const defaultLabel = getCategoryDefaultLabel(resolvedContext.source);
  DOM.addCategory.innerHTML = '';

  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = defaultLabel;
  DOM.addCategory.appendChild(defaultOpt);

  const sortedCollections = sortedCategoryItemsFromCounts(counts, resolvedContext.source)
    .filter(item => item.value !== 'uncategorized')
    .map(item => item.value);

  sortedCollections.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    DOM.addCategory.appendChild(opt);
  });

  const newOpt = document.createElement('option');
  newOpt.value = '__new__';
  newOpt.textContent = '+ Create new category...';
  newOpt.style.color = 'var(--accent-blue)';
  newOpt.style.fontWeight = 'bold';
  DOM.addCategory.appendChild(newOpt);

  if (selectedVal) {
    const normalized = normalizeCollectionKey(selectedVal);
    if (normalized === 'uncategorized') {
      DOM.addCategory.value = '';
    } else {
      const match = sortedCollections.find(c => c.toLowerCase() === normalized.toLowerCase());
      if (match) {
        DOM.addCategory.value = match;
      } else {
        const opt = document.createElement('option');
        opt.value = normalized;
        opt.textContent = normalized;
        DOM.addCategory.insertBefore(opt, newOpt);
        DOM.addCategory.value = normalized;
      }
    }
  } else {
    DOM.addCategory.value = '';
  }

  DOM.addCategoryNew.style.display = 'none';
  DOM.addCategoryNew.value = '';
  updateCategoryEditButtonVisibility();
}

let currentPostModalBookmarkId = null;

function cleanPostContent(content, platform) {
  if (!content) return platform === 'instagram' ? 'Saved Instagram Post' : 'Saved Post';
  const str = String(content).trim();
  return str || (platform === 'instagram' ? 'Saved Instagram Post' : 'Saved Post');
}

function formatConciseDate(dateVal) {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: '2-digit',
    year: 'numeric'
  });
}

/**
 * Open Modal to read the full post content and add custom notes
 */
function openPostModal(bmId, focusNote = false) {
  const bm = AppState.bookmarks.find(b => b.id === bmId);
  if (!bm) return;

  currentPostModalBookmarkId = bmId;

  // Clean content & format concise post date (only if postUploadedAt is present & non-empty)
  const cleanContent = cleanPostContent(bm.content, bm.platform);
  const hasPostUploadedAt = bm.postUploadedAt && String(bm.postUploadedAt).trim() !== '';
  const formattedPostDate = hasPostUploadedAt ? formatConciseDate(bm.postUploadedAt) : null;

  // Populate post content
  const initials = bm.authorName ? bm.authorName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '?';
  const platformIcon = platformIconMarkup(bm.platform);

  DOM.modalPostCardContent.innerHTML = `
    <div class="modal-post-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: ${formattedPostDate ? '6px' : '12px'};">
      <div class="modal-post-author" style="display: flex; align-items: center; gap: 8px;">
        <div class="author-avatar">${initials}</div>
        <div class="author-names" style="display: flex; flex-direction: column;">
          <span class="author-name" style="font-weight: 600; font-size: 0.9rem;">${escapeHTML(bm.authorName || 'Social Post')}</span>
          <span class="author-username" style="font-size: 0.75rem; color: var(--text-muted);">@${escapeHTML(bm.authorUsername || 'user')}</span>
        </div>
      </div>
      <div class="modal-post-platform" style="color: ${bm.platform === 'instagram' ? '#e1306c' : bm.platform === 'x' ? '#000000' : 'var(--accent-blue)'}; font-size: 1.2rem;">
        ${platformIcon}
      </div>
    </div>
    ${formattedPostDate ? `
      <div class="modal-post-date" style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 12px; display: flex; align-items: center; gap: 6px; padding-bottom: 6px; border-bottom: 1px dashed var(--border-color);">
        <i class="fa-regular fa-calendar-days" style="color: var(--accent-rose, #e11d48); font-size: 0.8rem;"></i>
        <span style="font-weight: 500;">${formattedPostDate}</span>
      </div>
    ` : ''}
    <div class="modal-post-text">
      ${escapeHTML(cleanContent)}
    </div>
    ${bm.thumbnail ? `
      <div class="modal-post-media">
        <img src="${bm.thumbnail}" alt="" loading="lazy">
      </div>
    ` : ''}
  `;

  // Populate note textarea
  const noteVal = bm.notes || '';
  DOM.modalNoteTextarea.value = noteVal;
  DOM.modalNoteCharCount.textContent = `${noteVal.length} / 1000`;

  // Open modal
  DOM.postModalOverlay.classList.add('active');

  if (focusNote) {
    setTimeout(() => DOM.modalNoteTextarea.focus(), 150);
  }
}

/**
 * Save the note changes from the modal and close it
 */
function saveModalNoteAndClose() {
  if (currentPostModalBookmarkId) {
    const val = DOM.modalNoteTextarea.value.trim();
    const bm = AppState.bookmarks.find(b => b.id === currentPostModalBookmarkId);
    if (bm && (bm.notes || '') !== val) {
      bm.notes = val;
      saveBookmarkNotes(bm.id, val);
      renderBookmarksGrid();
    }
  }
  DOM.postModalOverlay.classList.remove('active');
  currentPostModalBookmarkId = null;
}

/**
 * Open Bulk Edit Modal to update multiple bookmarks simultaneously
 */
function openBulkEditModal() {
  const selectedIds = Array.from(AppState.selectedIds);
  if (selectedIds.length === 0) {
    showToast("No bookmarks selected!", "error");
    return;
  }

  // Update label
  DOM.bulkEditCountLabel.textContent = `Editing ${selectedIds.length} selected bookmarks.`;

  // Populate categories selector
  DOM.bulkEditCategory.innerHTML = '';

  const defaultOpt = document.createElement('option');
  defaultOpt.value = '__no_change__';
  defaultOpt.textContent = 'Keep Original';
  DOM.bulkEditCategory.appendChild(defaultOpt);

  const othersOpt = document.createElement('option');
  othersOpt.value = '';
  othersOpt.textContent = 'Others';
  DOM.bulkEditCategory.appendChild(othersOpt);

  const selectedBookmarks = selectedIds.map(id => AppState.bookmarks.find(bm => bm.id === id)).filter(Boolean);
  const sameBrowser = selectedBookmarks.length > 0 && selectedBookmarks.every(bm => bm.source === 'browser' || bm.platform === 'browser');
  const firstPlatform = selectedBookmarks[0] && selectedBookmarks[0].platform;
  const samePlatform = selectedBookmarks.length > 0 && selectedBookmarks.every(bm => bm.platform === firstPlatform);
  const categoryContext = sameBrowser ? { source: 'browser', platform: 'browser' } : { source: 'social', platform: samePlatform ? firstPlatform : 'all' };
  othersOpt.textContent = getCategoryDefaultLabel(categoryContext.source);

  const sortedCollections = sortedCategoryItemsFromCounts(getCategoryCountsForContext(categoryContext), categoryContext.source)
    .filter(item => item.value !== 'uncategorized')
    .map(item => item.value);
  sortedCollections.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    DOM.bulkEditCategory.appendChild(opt);
  });

  const newOpt = document.createElement('option');
  newOpt.value = '__new__';
  newOpt.textContent = '+ Create new category...';
  newOpt.style.color = 'var(--accent-blue)';
  newOpt.style.fontWeight = 'bold';
  DOM.bulkEditCategory.appendChild(newOpt);

  // Reset values to Keep Original
  DOM.bulkEditCategory.value = '__no_change__';
  DOM.bulkEditCategoryNew.style.display = 'none';
  DOM.bulkEditCategoryNew.value = '';
  DOM.bulkEditPlatform.value = '__no_change__';

  // Show modal
  DOM.bulkEditModalOverlay.classList.add('active');
}

/**
 * Handle form submission for bulk editing
 */
function handleBulkEditSubmit(e) {
  e.preventDefault();
  const selectedIds = Array.from(AppState.selectedIds);
  if (selectedIds.length === 0) return;

  let categoryVal = DOM.bulkEditCategory.value;
  if (categoryVal === '__new__') {
    categoryVal = DOM.bulkEditCategoryNew.value.trim();
    if (!categoryVal) {
      showToast("Please enter a category name!", "error");
      return;
    }
  }

  const platformVal = DOM.bulkEditPlatform.value;

  let changedCount = 0;

  AppState.bookmarks.forEach(bm => {
    if (selectedIds.includes(bm.id)) {
      let bookmarkChanged = false;

      // 1. Update Category
      if (categoryVal !== '__no_change__') {
        let normalFolder = categoryVal;
        if (categoryVal.toLowerCase() === 'uncategorized' || categoryVal.toLowerCase() === 'others') {
          normalFolder = '';
        }
        bm.folder = normalFolder;
        bookmarkChanged = true;

        if (normalFolder && !AppState.collections.has(normalFolder)) {
          AppState.collections.add(normalFolder);
        }
      }

      // 2. Update Platform
      if (platformVal !== '__no_change__') {
        bm.platform = platformVal;
        bookmarkChanged = true;
      }

      if (bookmarkChanged) changedCount++;
    }
  });

  if (changedCount > 0) {
    saveDataToServer();
    showToast(`Successfully updated ${changedCount} bookmarks!`, "success");

    DOM.bulkEditModalOverlay.classList.remove('active');
    toggleSelectionMode(false);

    refreshLocalMetadataAndCounts();
  } else {
    DOM.bulkEditModalOverlay.classList.remove('active');
  }
}

/**
 * Open Modal pre-filled with existing bookmark metadata for editing
 */
function openEditBookmarkModal(bm) {
  AppState.editingId = bm.id;

  // Update header and submit button layout
  const titleEl = DOM.addModalOverlay.querySelector('h3');
  if (titleEl) titleEl.textContent = 'Edit Bookmark';

  const submitBtn = DOM.addBookmarkForm.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = 'Save Changes';

  // Prefill values
  DOM.addUrl.value = bm.url;
  DOM.addUrl.readOnly = true;

  const addPlatformSelect = document.getElementById('add-platform');
  if (addPlatformSelect) {
    addPlatformSelect.value = bm.source === 'browser' ? 'browser' : bm.platform;
    updateManualModalPlatformUI(addPlatformSelect.value);
  }

  DOM.addAuthorName.value = bm.authorName || '';
  DOM.addContent.value = bm.content || '';
  if (DOM.addThumbnail) DOM.addThumbnail.value = bm.thumbnail || '';
  setManualImageFieldVisible(!!bm.thumbnail);

  const userTags = bm.hashtags || [];
  DOM.addTags.value = userTags.join(', ');

  // Prefill category
  populateModalCategorySelect(bm.folder || '', getCategoryContextFromPlatform(bm.source === 'browser' ? 'browser' : bm.platform));

  DOM.addModalOverlay.classList.add('active');
}

/**
 * Delete bookmark and update state/sync to disk
 */
function deleteBookmark(id) {
  const idx = AppState.bookmarks.findIndex(bm => bm.id === id);
  if (idx !== -1) {
    AppState.pendingDeletedIds.add(id);
    AppState.bookmarks.splice(idx, 1);

    // Reprocess metadata, update collections & tags filters, apply filters, save to server
    refreshLocalMetadataAndCounts();
    saveDataToServer();
    showToast("Bookmark deleted successfully!", "success");
  }
}

/**
 * Multiple Selection & Bulk Delete Helpers
 */
function toggleSelectBookmark(id, select) {
  if (select) {
    AppState.selectedIds.add(id);
  } else {
    AppState.selectedIds.delete(id);
  }
  updateBulkSelectionUI();
}

function updateBulkSelectionUI() {
  const selectedCount = AppState.selectedIds.size;
  document.getElementById('selected-count').textContent = selectedCount;

  // Update card visual selected states
  document.querySelectorAll('.bookmark-card').forEach(card => {
    const id = card.getAttribute('data-id');
    if (AppState.selectedIds.has(id)) {
      card.classList.add('selected');
    } else {
      card.classList.remove('selected');
    }
  });

  // Update buttons disabled status if needed
  const deleteBtn = document.getElementById('btn-bulk-delete');
  if (deleteBtn) {
    deleteBtn.disabled = selectedCount === 0;
    deleteBtn.style.opacity = selectedCount === 0 ? '0.5' : '1';
    deleteBtn.style.cursor = selectedCount === 0 ? 'not-allowed' : 'pointer';
  }
}

function toggleSelectionMode(active) {
  AppState.isSelectionMode = active;
  AppState.selectedIds.clear();

  const grid = DOM.bookmarksGrid;
  const bulkBar = document.getElementById('bulk-action-bar');
  const selectModeBtn = document.getElementById('btn-select-mode');

  if (active) {
    grid.classList.add('selection-mode-active');
    if (bulkBar) bulkBar.classList.add('active');
    if (selectModeBtn) {
      selectModeBtn.classList.add('active');
      selectModeBtn.querySelector('span').textContent = 'Cancel Select';
    }
  } else {
    grid.classList.remove('selection-mode-active');
    if (bulkBar) bulkBar.classList.remove('active');
    if (selectModeBtn) {
      selectModeBtn.classList.remove('active');
      selectModeBtn.querySelector('span').textContent = 'Select Mode';
    }

    // Uncheck all checkboxes visually
    document.querySelectorAll('.card-checkbox').forEach(cb => cb.checked = false);
  }
  updateBulkSelectionUI();
}

function bulkDeleteSelected() {
  const count = AppState.selectedIds.size;
  if (count === 0) return;

  if (confirm(`Are you sure you want to permanently delete all ${count} selected bookmarks?`)) {
    // Keep an explicit deletion list so server saves never infer deletions from a stale tab.
    AppState.selectedIds.forEach(id => AppState.pendingDeletedIds.add(id));
    AppState.bookmarks = AppState.bookmarks.filter(bm => !AppState.selectedIds.has(bm.id));

    // Clear selection and exit selection mode
    toggleSelectionMode(false);

    // Reprocess state and write to server
    refreshLocalMetadataAndCounts();
    saveDataToServer();

    showToast(`Deleted ${count} bookmarks successfully!`, "success");
  }
}

function bulkSelectAll() {
  // Select all currently visible (filtered) bookmarks
  AppState.filteredBookmarks.forEach(bm => {
    AppState.selectedIds.add(bm.id);
  });

  // Update all visual checkboxes
  document.querySelectorAll('.card-checkbox').forEach(cb => {
    const id = cb.getAttribute('data-id');
    cb.checked = AppState.selectedIds.has(id);
  });

  updateBulkSelectionUI();
  showToast(`Selected all ${AppState.filteredBookmarks.length} visible bookmarks`, "info");
}

function bulkDeselectAll() {
  AppState.selectedIds.clear();
  document.querySelectorAll('.card-checkbox').forEach(cb => cb.checked = false);
  updateBulkSelectionUI();
}

/**
 * Debounce helper to optimize search typing frequency
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Global Event Listeners Registration
 */
function initEventListeners() {
  // Search typing (debounced to prevent typing lag and layout re-calculations)
  DOM.searchInput.addEventListener('input', debounce((e) => {
    AppState.searchQuery = e.target.value;
    applyFiltersAndSearch();
  }, 150));

  // Platform select in navbar change (hidden/backward compatibility)
  if (DOM.filterPlatform) {
    DOM.filterPlatform.addEventListener('change', (e) => {
      filterByPlatform(e.target.value);
    });
  }

  // Sort select in navbar change (hidden/backward compatibility)
  if (DOM.filterSort) {
    DOM.filterSort.addEventListener('change', (e) => {
      AppState.activeSort = e.target.value;
      applyFiltersAndSearch();
    });
  }

  // Collection select in navbar change (hidden/backward compatibility)
  const filterCollection = document.getElementById('filter-collection');
  if (filterCollection) {
    filterCollection.addEventListener('change', (e) => {
      AppState.activeCollection = e.target.value;
      AppState.nextCursor = null;
      if (AppState.isServerConnected) loadData();
      else applyFiltersAndSearch();
    });
  }

  // Sidebar platform and category navigation
  if (DOM.sidebarPlatformList) {
    DOM.sidebarPlatformList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-platform]');
      if (!btn) return;
      closeSettings();
      AppState.activeSource = 'social';
      setRouteHash(btn.dataset.sidebarRoute || ('#platform=' + btn.dataset.platform));
      AppState.activePlatform = btn.dataset.platform;
      AppState.activeCollection = "all";
      AppState.nextCursor = null;
      syncFilterSelects();
      applyFiltersAndSearch();
      const drawer = document.getElementById('mobile-drawer-overlay');
      if (drawer) drawer.classList.remove('active');
    });
  }

  if (DOM.sidebarCollectionList) {
    DOM.sidebarCollectionList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-collection]');
      if (!btn || btn.disabled || AppState.activeSource !== 'social') return;
      AppState.activeCollection = btn.dataset.collection;
      AppState.nextCursor = null;
      syncFilterSelects();
      if (AppState.isServerConnected) loadData();
      else applyFiltersAndSearch();
      const drawer = document.getElementById('mobile-drawer-overlay');
      if (drawer) drawer.classList.remove('active');
    });
  }

  // Dropdown menu elements
  const sortBtn = document.getElementById('toolbar-sort-btn');
  const sortMenu = document.getElementById('toolbar-sort-menu');
  const layoutBtn = document.getElementById('toolbar-layout-btn');
  const layoutMenu = document.getElementById('toolbar-layout-menu');
  const dataBtn = document.getElementById('toolbar-data-btn');
  const dataMenu = document.getElementById('toolbar-data-menu');

  const closeAllToolbarDropdowns = () => {
    if (sortMenu) sortMenu.classList.remove('active');
    if (sortBtn) sortBtn.setAttribute('aria-expanded', 'false');
    if (layoutMenu) layoutMenu.classList.remove('active');
    if (layoutBtn) layoutBtn.setAttribute('aria-expanded', 'false');
    if (dataMenu) dataMenu.classList.remove('active');
    if (dataBtn) dataBtn.setAttribute('aria-expanded', 'false');
  };

  // Sort dropdown menu event listeners
  if (sortBtn && sortMenu) {
    sortBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = sortMenu.classList.contains('active');
      closeAllToolbarDropdowns();
      if (!isOpen) {
        sortMenu.classList.add('active');
        sortBtn.setAttribute('aria-expanded', 'true');
      }
    });

    sortMenu.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const sortVal = item.dataset.sort;
        AppState.activeSort = sortVal;

        sortMenu.querySelectorAll('.dropdown-item').forEach(el => {
          const isSelected = el.dataset.sort === sortVal;
          el.classList.toggle('active', isSelected);
          const icon = el.querySelector('.check-icon');
          if (icon) {
            icon.style.visibility = isSelected ? 'visible' : 'hidden';
          }
        });

        const activeLabelEl = document.getElementById('sort-active-label');
        const sortLabels = {
          'recent-desc': 'Newest First',
          'recent-asc': 'Oldest First',
          'author-asc': 'Author A–Z',
          'author-desc': 'Author Z–A'
        };
        if (activeLabelEl) {
          activeLabelEl.textContent = sortLabels[sortVal] || 'Newest First';
        }

        applyFiltersAndSearch();
        closeAllToolbarDropdowns();
        sortBtn.focus();
      });
    });
  }

  // Layout Dropdown Switcher bindings
  if (layoutBtn && layoutMenu) {
    layoutBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = layoutMenu.classList.contains('active');
      closeAllToolbarDropdowns();
      if (!isOpen) {
        layoutMenu.classList.add('active');
        layoutBtn.setAttribute('aria-expanded', 'true');
      }
    });

    layoutMenu.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const layout = item.getAttribute('data-layout');
        changeLayout(layout);
        closeAllToolbarDropdowns();
      });
    });
  }



  // Global click to close active dropdowns
  document.addEventListener('click', () => {
    closeAllToolbarDropdowns();
    document.querySelectorAll('.card-menu-dropdown.active').forEach(el => {
      el.classList.remove('active');
    });
    document.querySelectorAll('.card-category-popover.active').forEach(el => {
      el.classList.remove('active');
    });
  });

  // Global keydown for Escape to close dropdowns and modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (DOM.postModalOverlay && DOM.postModalOverlay.classList.contains('active')) {
        saveModalNoteAndClose();
        return;
      }

      if (DOM.bulkEditModalOverlay && DOM.bulkEditModalOverlay.classList.contains('active')) {
        DOM.bulkEditModalOverlay.classList.remove('active');
        return;
      }

      const activeMenu = [sortMenu, layoutMenu, dataMenu].find(m => m && m.classList.contains('active'));
      const activeBtn = activeMenu === sortMenu ? sortBtn : activeMenu === layoutMenu ? layoutBtn : activeMenu === dataMenu ? dataBtn : null;

      closeAllToolbarDropdowns();

      if (activeBtn) {
        activeBtn.focus();
      }
    }
  });

  // Sync Actions listeners
  DOM.syncBtn.addEventListener('click', () => {
    if (AppState.isServerConnected) {
      saveDataToServer();
    } else {
      checkServerConnection().then(loadData).catch(() => {
        showToast('Server is offline. Please check the dev server or Vercel API.', 'error');
      });
    }
  });
  DOM.btnSyncNow.addEventListener('click', () => {
    DOM.btnSyncNow.classList.add('saving');
    checkServerConnection()
      .then(loadData)
      .catch(() => showToast('Could not reach the server.', 'error'))
      .finally(() => DOM.btnSyncNow.classList.remove('saving'));
  });
  DOM.btnExportJson.addEventListener('click', triggerManualDownload);



  // Analytics toggle stats panel (sidebar item)
  const btnToggleStats = document.getElementById('btn-toggle-stats');
  const statsPanel = document.getElementById('stats-panel');
  if (btnToggleStats && statsPanel) {
    btnToggleStats.addEventListener('click', () => {
      const isOpen = statsPanel.style.display !== 'none';
      const li = btnToggleStats.closest('.menu-item');
      if (isOpen) {
        statsPanel.style.display = 'none';
        btnToggleStats.classList.remove('active');
        if (li) li.classList.remove('active');
      } else {
        statsPanel.style.display = 'block';
        btnToggleStats.classList.add('active');
        if (li) li.classList.add('active');
        updateStatsAnalytics();
      }
      // Close mobile drawer after activation
      const drawer = document.getElementById('mobile-drawer-overlay');
      if (drawer) drawer.classList.remove('active');
    });
  }

  // Import Modal Overlay bindings
  DOM.btnImport.addEventListener('click', () => DOM.importModalOverlay.classList.add('active'));
  DOM.closeImportModal.addEventListener('click', () => DOM.importModalOverlay.classList.remove('active'));
  DOM.importModalOverlay.addEventListener('click', (e) => {
    if (e.target === DOM.importModalOverlay) DOM.importModalOverlay.classList.remove('active');
  });

  // File drag & drop triggers
  DOM.btnSelectFile.addEventListener('click', () => DOM.importFileInput.click());
  DOM.importFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileImport(e.target.files[0]);
    }
  });

  DOM.dragDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    DOM.dragDropZone.classList.add('dragover');
  });

  DOM.dragDropZone.addEventListener('dragleave', () => {
    DOM.dragDropZone.classList.remove('dragover');
  });

  DOM.dragDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    DOM.dragDropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleFileImport(e.dataTransfer.files[0]);
    }
  });

  // Add Link Modal bindings
  const resetAddModal = () => {
    AppState.editingId = null;
    const titleEl = DOM.addModalOverlay.querySelector('h3');
    if (titleEl) titleEl.textContent = 'Add Bookmark Manually';
    const submitBtn = DOM.addBookmarkForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Add to Feed';
    DOM.addUrl.readOnly = false;
    DOM.addBookmarkForm.reset();
    if (DOM.addThumbnail) DOM.addThumbnail.value = '';
    setManualImageFieldVisible(false);
    populateModalCategorySelect('', getCategoryContextFromPlatform(''));
  };

  if (DOM.addCategory) {
    DOM.addCategory.addEventListener('change', (e) => {
      if (e.target.value === '__new__') {
        DOM.addCategoryNew.style.display = 'block';
        DOM.addCategoryNew.focus();
      } else {
        DOM.addCategoryNew.style.display = 'none';
        DOM.addCategoryNew.value = '';
      }
      updateCategoryEditButtonVisibility();
    });
  }


  const addPlatformSelect = document.getElementById('add-platform');
  if (addPlatformSelect) {
    addPlatformSelect.addEventListener('change', () => {
      populateModalCategorySelect('', getCategoryContextFromPlatform(addPlatformSelect.value));
      updateManualModalPlatformUI(addPlatformSelect.value);
      if (addPlatformSelect.value === 'browser' && DOM.addUrl && DOM.addUrl.value.trim()) previewBrowserLink(DOM.addUrl.value.trim());
    });
  }

  if (DOM.btnToggleImageField) {
    DOM.btnToggleImageField.addEventListener('click', () => {
      setManualImageFieldVisible(DOM.addImageField ? DOM.addImageField.hidden : true);
      if (!DOM.addImageField.hidden && DOM.addThumbnail) DOM.addThumbnail.focus();
    });
  }
  if (DOM.addThumbnail) DOM.addThumbnail.addEventListener('input', updateManualImagePreview);
  if (DOM.addImagePreview) DOM.addImagePreview.addEventListener('click', event => { if (event.target.closest('.manual-image-remove')) clearManualImageValue(); });
  if (DOM.btnEditCategoryName) DOM.btnEditCategoryName.addEventListener('click', renameSelectedModalCategory);
  if (DOM.addImageDropzone && DOM.addImageFile) {
    DOM.addImageDropzone.addEventListener('click', () => DOM.addImageFile.click());
    DOM.addImageDropzone.addEventListener('dragover', event => { event.preventDefault(); DOM.addImageDropzone.classList.add('dragover'); });
    DOM.addImageDropzone.addEventListener('dragleave', () => DOM.addImageDropzone.classList.remove('dragover'));
    DOM.addImageDropzone.addEventListener('drop', event => {
      event.preventDefault();
      DOM.addImageDropzone.classList.remove('dragover');
      const file = event.dataTransfer && event.dataTransfer.files ? event.dataTransfer.files[0] : null;
      setManualImageFromFile(file);
    });
    DOM.addImageFile.addEventListener('change', event => {
      const file = event.target.files ? event.target.files[0] : null;
      setManualImageFromFile(file);
      event.target.value = '';
    });
  }

  DOM.btnAddBookmark.addEventListener('click', () => {
    resetAddModal();
    const addPlatformSelect = document.getElementById('add-platform');
    if (addPlatformSelect) {
      const nextPlatform = AppState.activeSource === 'browser' ? 'browser' : (AppState.activePlatform !== 'all' ? AppState.activePlatform : '');
      addPlatformSelect.value = nextPlatform;
      populateModalCategorySelect('', getCategoryContextFromPlatform(nextPlatform));
      updateManualModalPlatformUI(nextPlatform);
    }
    DOM.addModalOverlay.classList.add('active');
  });

  DOM.closeAddModal.addEventListener('click', () => {
    DOM.addModalOverlay.classList.remove('active');
    resetAddModal();
  });

  DOM.btnAddCancel.addEventListener('click', () => {
    DOM.addModalOverlay.classList.remove('active');
    resetAddModal();
  });

  DOM.addModalOverlay.addEventListener('click', (e) => {
    if (e.target === DOM.addModalOverlay) {
      DOM.addModalOverlay.classList.remove('active');
      resetAddModal();
    }
  });

  // Post View & Notes modal listeners
  if (DOM.closePostModal) {
    DOM.closePostModal.addEventListener('click', saveModalNoteAndClose);
  }
  if (DOM.postModalOverlay) {
    DOM.postModalOverlay.addEventListener('click', (e) => {
      if (e.target === DOM.postModalOverlay) {
        saveModalNoteAndClose();
      }
    });
  }
  if (DOM.modalNoteTextarea) {
    DOM.modalNoteTextarea.addEventListener('input', (e) => {
      let val = e.target.value;
      if (val.length > 1000) {
        val = val.substring(0, 1000);
        e.target.value = val;
      }
      if (DOM.modalNoteCharCount) {
        DOM.modalNoteCharCount.textContent = `${val.length} / 1000`;
      }
    });

    DOM.modalNoteTextarea.addEventListener('blur', () => {
      if (currentPostModalBookmarkId) {
        const val = DOM.modalNoteTextarea.value.trim();
        const bm = AppState.bookmarks.find(b => b.id === currentPostModalBookmarkId);
        if (bm && (bm.notes || '') !== val) {
          bm.notes = val;
          saveBookmarkNotes(bm.id, val);
          renderBookmarksGrid();
        }
      }
    });
  }

  DOM.addBookmarkForm.addEventListener('submit', handleManualBookmarkSubmit);

  // Select Mode toggle button
  const selectModeBtn = document.getElementById('btn-select-mode');
  if (selectModeBtn) {
    selectModeBtn.addEventListener('click', () => {
      toggleSelectionMode(!AppState.isSelectionMode);
    });
  }

  // Bulk action buttons
  const bulkSelectAllBtn = document.getElementById('btn-bulk-select-all');
  if (bulkSelectAllBtn) {
    bulkSelectAllBtn.addEventListener('click', bulkSelectAll);
  }

  const bulkDeselectAllBtn = document.getElementById('btn-bulk-deselect-all');
  if (bulkDeselectAllBtn) {
    bulkDeselectAllBtn.addEventListener('click', bulkDeselectAll);
  }

  const bulkCancelBtn = document.getElementById('btn-bulk-cancel');
  if (bulkCancelBtn) {
    bulkCancelBtn.addEventListener('click', () => {
      toggleSelectionMode(false);
    });
  }

  const bulkDeleteBtn = document.getElementById('btn-bulk-delete');
  if (bulkDeleteBtn) {
    bulkDeleteBtn.addEventListener('click', bulkDeleteSelected);
  }

  // Bulk Edit Event Listeners
  if (DOM.btnBulkEditTrigger) {
    DOM.btnBulkEditTrigger.addEventListener('click', openBulkEditModal);
  }
  if (DOM.closeBulkEditModal) {
    DOM.closeBulkEditModal.addEventListener('click', () => {
      DOM.bulkEditModalOverlay.classList.remove('active');
    });
  }
  if (DOM.btnBulkEditCancel) {
    DOM.btnBulkEditCancel.addEventListener('click', () => {
      DOM.bulkEditModalOverlay.classList.remove('active');
    });
  }
  if (DOM.bulkEditModalOverlay) {
    DOM.bulkEditModalOverlay.addEventListener('click', (e) => {
      if (e.target === DOM.bulkEditModalOverlay) {
        DOM.bulkEditModalOverlay.classList.remove('active');
      }
    });
  }
  if (DOM.bulkEditCategory) {
    DOM.bulkEditCategory.addEventListener('change', (e) => {
      if (e.target.value === '__new__') {
        DOM.bulkEditCategoryNew.style.display = 'block';
        DOM.bulkEditCategoryNew.focus();
      } else {
        DOM.bulkEditCategoryNew.style.display = 'none';
        DOM.bulkEditCategoryNew.value = '';
      }
    });
  }
  if (DOM.bulkEditForm) {
    DOM.bulkEditForm.addEventListener('submit', handleBulkEditSubmit);
  }

  // Admin Login Event Listeners
  if (DOM.btnAdminLogin) {
    DOM.btnAdminLogin.addEventListener('click', () => {
      if (AppState.isAdmin && AppState.isServerConnected) {
        // Log out
        localStorage.removeItem('admin_token');
        AppState.isAdmin = false;
        document.body.classList.add('visitor-mode');
        updateAdminLoginUI(false);
        applyFiltersAndSearch();
        showToast("Logged out from Admin session", "info");
      } else {
        // Open login modal
        DOM.loginPassword.value = '';
        DOM.loginModalOverlay.classList.add('active');
        DOM.loginPassword.focus();
      }
    });
  }

  if (DOM.closeLoginModal) {
    DOM.closeLoginModal.addEventListener('click', () => DOM.loginModalOverlay.classList.remove('active'));
  }
  if (DOM.btnLoginCancel) {
    DOM.btnLoginCancel.addEventListener('click', () => DOM.loginModalOverlay.classList.remove('active'));
  }
  if (DOM.loginModalOverlay) {
    DOM.loginModalOverlay.addEventListener('click', (e) => {
      if (e.target === DOM.loginModalOverlay) DOM.loginModalOverlay.classList.remove('active');
    });
  }
  if (DOM.loginForm) {
    DOM.loginForm.addEventListener('submit', handleAdminLoginSubmit);
  }

  // Mobile side drawer toggles
  const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
  const closeMobileDrawer = document.getElementById('close-mobile-drawer');
  const mobileDrawerOverlay = document.getElementById('mobile-drawer-overlay');

  if (mobileMenuToggle && mobileDrawerOverlay) {
    mobileMenuToggle.addEventListener('click', () => {
      mobileDrawerOverlay.classList.add('active');
    });
  }

  if (closeMobileDrawer && mobileDrawerOverlay) {
    closeMobileDrawer.addEventListener('click', () => {
      mobileDrawerOverlay.classList.remove('active');
    });
  }

  if (mobileDrawerOverlay) {
    mobileDrawerOverlay.addEventListener('click', (e) => {
      if (e.target === mobileDrawerOverlay) {
        mobileDrawerOverlay.classList.remove('active');
      }
    });
  }

  // Handle window resize dynamically to move elements between header and drawer
  let currentGridCols = getGridColumnCount();
  window.addEventListener('resize', debounce(() => {
    checkMobileDrawerLayout();
    const newCols = getGridColumnCount();
    if (newCols !== currentGridCols) {
      currentGridCols = newCols;
      if (!AppState.activeLayout || AppState.activeLayout === 'grid') {
        renderFeedGrid();
      }
    }
  }, 100));
}

/**
 * Toast Notification Utility Helper
 */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  DOM.toastContainer.appendChild(toast);

  // Trigger animation next frame
  requestAnimationFrame(() => {
    toast.classList.add('active');
  });

  // Remove toast after duration
  setTimeout(() => {
    toast.classList.remove('active');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3500);
}

/**
 * Formatter Helper: Converts ISO strings into readable local dates
 */
function formatDate(isoString) {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'Recently';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (e) {
    return 'Recently';
  }
}

/**
 * Escaping utility helper to prevent XSS issues
 */
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g,
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

/**
 * Image Error Fallback Handler
 * If Firefox ETP or Adblockers block the direct Instagram CDN thumbnail load,
 * we replace the image with a gorgeous glassmorphic platform card placeholder.
 * This keeps the grid perfectly aligned and sized under any privacy settings!
 */
function handleImageError(img, id, platform) {
  const container = img.parentNode;
  if (!container) return;

  container.className = 'card-media fallback-media';
  if (platform === 'x') {
    container.style.background = 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)';
    container.style.borderColor = 'rgba(255,255,255,0.05)';
    container.innerHTML = `
      <div class="fallback-gradient" style="color: #f8fafc;">
        <i class="fa-brands fa-x-twitter fallback-icon" style="background: none; -webkit-text-fill-color: #f8fafc; color: #f8fafc; font-size: 1.4rem; opacity: 0.85;"></i>
        <span class="fallback-title" style="color: #f8fafc;">X Post</span>
        <span class="fallback-subtitle" style="color: #cbd5e1;">Click to View</span>
      </div>
    `;
  } else if (platform === 'threads') {
    container.style.background = 'linear-gradient(135deg, #262626 0%, #000000 100%)';
    container.style.borderColor = 'rgba(255,255,255,0.05)';
    container.innerHTML = `
      <div class="fallback-gradient" style="color: #f8fafc;">
        <i class="fa-brands fa-threads fallback-icon" style="background: none; -webkit-text-fill-color: #f8fafc; color: #f8fafc; font-size: 1.4rem; opacity: 0.85;"></i>
        <span class="fallback-title" style="color: #f8fafc;">Threads Post</span>
        <span class="fallback-subtitle" style="color: #cbd5e1;">Click to View</span>
      </div>
    `;
  } else if (platform === 'facebook') {
    container.style.background = 'linear-gradient(135deg, #e7f3ff 0%, #cbd5e1 100%)';
    container.innerHTML = `
      <div class="fallback-gradient" style="color: var(--platform-fb);">
        <i class="fa-brands fa-facebook fallback-icon" style="background: none; -webkit-text-fill-color: var(--platform-fb); color: var(--platform-fb); font-size: 1.4rem; opacity: 0.85;"></i>
        <span class="fallback-title" style="color: var(--text-primary);">Facebook Post</span>
        <span class="fallback-subtitle" style="color: var(--text-muted);">Click to View</span>
      </div>
    `;
  } else {
    if (id) {
      container.style.background = getInstagramFallbackGradient(id);
    }
    container.innerHTML = `
      <div class="fallback-gradient">
        <i class="fa-brands fa-instagram fallback-icon"></i>
        <span class="fallback-title">Instagram Post</span>
        <span class="fallback-subtitle">Click to View</span>
      </div>
    `;
  }
}

/**
 * Update Admin Login button UI state
 */
function updateAdminLoginUI(isAdmin) {
  if (!DOM.btnAdminLogin) return;
  if (!AppState.isServerConnected) {
    DOM.btnAdminLogin.innerHTML = `<i class="fa-solid fa-user-gear"></i> <span class="btn-text">Admin Mode</span>`;
    DOM.btnAdminLogin.title = "Offline mode - all editing controls are enabled";
    DOM.btnAdminLogin.style.display = 'inline-flex';
    return;
  }
  DOM.btnAdminLogin.style.display = 'inline-flex';
  if (isAdmin) {
    DOM.btnAdminLogin.innerHTML = `<i class="fa-solid fa-lock-open"></i> <span class="btn-text">Logout</span>`;
    DOM.btnAdminLogin.title = "Log out from Admin session";
  } else {
    DOM.btnAdminLogin.innerHTML = `<i class="fa-solid fa-lock"></i> <span class="btn-text">Admin Login</span>`;
    DOM.btnAdminLogin.title = "Admin Login";
  }
}

/**
 * Handle Admin authentication form submission
 */
function handleAdminLoginSubmit(e) {
  e.preventDefault();
  const password = DOM.loginPassword.value;
  if (!password) return;

  showToast("Authenticating...");

  fetch('/api/status', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${password}`
    },
    cache: 'no-store'
  })
    .then(res => res.json())
    .then(data => {
      if (data && data.status === 'ok' && data.isAdmin) {
        localStorage.setItem('admin_token', password);
        AppState.isAdmin = true;
        document.body.classList.remove('visitor-mode');
        updateAdminLoginUI(true);
        DOM.loginModalOverlay.classList.remove('active');
        applyFiltersAndSearch();
        showToast("Authenticated successfully as Admin!", "success");
      } else {
        showToast("Invalid admin password.", "error");
      }
    })
    .catch(err => {
      console.error("Authentication check failed:", err);
      showToast("Authentication request failed.", "error");
    });
}

/**
 * Reposition filter elements dynamically between Header and Mobile Drawer depending on screen width
 */
function checkMobileDrawerLayout() {
  const isMobile = window.innerWidth <= 768;
  const sidebar = document.getElementById('sidebar');
  const sidebarMenu = document.querySelector('.sidebar-menu');
  const drawerBody = document.getElementById('mobile-drawer-body');

  if (isMobile) {
    if (sidebarMenu && drawerBody && sidebarMenu.parentNode !== drawerBody) {
      drawerBody.appendChild(sidebarMenu);
    }
  } else {
    if (sidebarMenu && sidebar && sidebarMenu.parentNode !== sidebar) {
      sidebar.appendChild(sidebarMenu);
    }
  }
}









/* Private dashboard and Browser Bookmarks controller */
Object.assign(AppState, { activeSource: "browser", nextCursor: null, hasMore: false, isLoadingMore: false, linkPreview: null });

function showPrivateLogin(message) {
  document.body.classList.add("auth-pending");
  document.body.classList.remove("visitor-mode");
  AppState.isAdmin = false;
  AppState.isServerConnected = false;
  const error = document.getElementById("private-login-error");
  if (error) { error.hidden = !message; error.textContent = message || ""; }
}

function checkServerConnection() {
  return fetch("/api/status", { method: "GET", cache: "no-store", credentials: "same-origin" })
    .then(async res => {
      if (res.status === 401) { showPrivateLogin(); return { authenticated: false }; }
      if (!res.ok) throw new Error("Status check failed");
      const data = await res.json();
      AppState.isServerConnected = true;
      AppState.isAdmin = true;
      applyRouteFromHash({ load: false });
      document.body.classList.remove("auth-pending", "visitor-mode");
      updateSyncStatusUI(true);
      const profile = data.profile || {};
      const name = document.getElementById("settings-profile-name");
      const email = document.getElementById("settings-profile-email");
      const member = document.getElementById("settings-member-since");
      if (name) name.textContent = profile.name || "SocialFeed Owner";
      if (email) email.textContent = profile.email || "Private account";
      if (member) member.textContent = profile.memberSince || "Private account";
      return { authenticated: true, data };
    })
    .catch(error => { showPrivateLogin("Unable to reach your private dashboard."); return { authenticated: false }; });
}

function loadData(options = {}) {
  if (!AppState.isServerConnected) return;
  const append = !!options.append;
  if (AppState.isLoadingMore) return;
  AppState.isLoadingMore = true;
  const params = new URLSearchParams({ source: AppState.activeSource, limit: "40" });
  if (AppState.activeSource === "social" && AppState.activePlatform !== "all") params.set("platform", AppState.activePlatform);
  if (AppState.activeSource === "social" && AppState.activeCollection && AppState.activeCollection !== "all") params.set("collection", AppState.activeCollection);
  if (append && AppState.nextCursor) params.set("cursor", AppState.nextCursor);
  fetch("/api/load?" + params.toString(), { credentials: "same-origin" })
    .then(async res => {
      if (res.status === 401) { showPrivateLogin(); throw new Error("Session expired"); }
      if (!res.ok) throw new Error("Database load failed");
      return res.json();
    })
    .then(data => {
      const incoming = Array.isArray(data) ? data : (data.bookmarks || []);
      AppState.bookmarks = append ? AppState.bookmarks.concat(incoming) : incoming;
      AppState.nextCursor = data.nextCursor || null;
      AppState.hasMore = !!data.hasMore;
      AppState.isLoadingMore = false;
      onDataLoadedSuccess();
      const more = document.getElementById("load-more-container");
      if (more) more.hidden = true;
    })
    .catch(error => {
      AppState.isLoadingMore = false;
      if (AppState.isServerConnected) showToast("Could not load bookmarks.", "error");
    });
}

function updateFeedHeaders() {
  let title = AppState.activeSource === "browser" ? "Browser Bookmarks" : "All Social Bookmarks";
  if (AppState.activeSource === "social" && AppState.activePlatform !== "all") title = platformLabel(AppState.activePlatform);
  if (AppState.activeCollection && AppState.activeCollection !== "all") title += " in " + (AppState.activeCollection === "uncategorized" ? "Others" : AppState.activeCollection);
  DOM.feedTitle.textContent = title;
  DOM.feedSubtitle.textContent = "Showing " + AppState.filteredBookmarks.length + " loaded bookmark" + (AppState.filteredBookmarks.length === 1 ? "" : "s");
  const browserItem = document.getElementById("sidebar-browser-item");
  if (browserItem) browserItem.classList.toggle("active", AppState.activeSource === "browser");
}

function openSettings() {
  AppState.isSettingsOpen = true;
  document.getElementById("feed-content").hidden = true;
  document.getElementById("settings-view").hidden = false;
  updateSidebarNavigation();
}

function closeSettings() {
  AppState.isSettingsOpen = false;
  document.getElementById("settings-view").hidden = true;
  document.getElementById("feed-content").hidden = false;
  updateSidebarNavigation();
}

async function previewBrowserLink(url) {
  if (!url) return null;
  const status = document.getElementById("add-preview-status");
  if (status) { status.hidden = false; status.textContent = "Looking up link preview…"; }
  try {
    const response = await fetch("/api/bookmark-preview", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Preview unavailable");
    AppState.linkPreview = data;
    if (DOM.addContent && !DOM.addContent.value) DOM.addContent.value = data.description || data.title || "";
    if (DOM.addAuthorName && !DOM.addAuthorName.value) DOM.addAuthorName.value = data.siteName || "";
    if (status) status.textContent = "Preview found: " + (data.title || data.siteName);
    return data;
  } catch (error) {
    AppState.linkPreview = null;
    if (status) status.textContent = "Preview unavailable — the link can still be saved.";
    return null;
  }
}

async function saveBrowserBookmark(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
  const url = DOM.addUrl.value.trim();
  const preview = AppState.linkPreview && AppState.linkPreview.url ? AppState.linkPreview : await previewBrowserLink(url);
  const canonical = preview && preview.canonicalUrl ? preview.canonicalUrl : url.toLowerCase().replace(/\/$/, "");
  if (AppState.bookmarks.some(item => item.source === "browser" && (item.canonicalUrl || item.url.toLowerCase().replace(/\/$/, "")) === canonical)) { showToast("This browser bookmark is already saved.", "error"); return; }
  const tagText = '';
  const imageUrl = DOM.addThumbnail ? DOM.addThumbnail.value.trim() : '';
  const category = DOM.addCategory.value === "__new__" ? DOM.addCategoryNew.value.trim() : DOM.addCategory.value.trim();
  const site = preview && preview.siteName ? preview.siteName : new URL(url).hostname;
  const bookmark = { id: "browser_" + Date.now(), source: "browser", platform: "browser", url: preview && preview.url ? preview.url : url, canonicalUrl: canonical, authorName: DOM.addAuthorName.value.trim() || site, authorUsername: site.replace(/^www\./, ""), content: DOM.addContent.value.trim() || (preview && preview.title) || "Saved browser bookmark", thumbnail: imageUrl || (preview && preview.image ? preview.image : ""), notes: (document.getElementById("add-notes") || {}).value || "", hashtags: [], folder: category === "uncategorized" ? "" : category, extensionScrapedAt: new Date().toISOString() };
  AppState.bookmarks.unshift(bookmark);
  AppState.linkPreview = null;
  refreshLocalMetadataAndCounts(); saveDataToServer();
  DOM.addModalOverlay.classList.remove("active"); DOM.addBookmarkForm.reset(); showToast("Browser bookmark saved.", "success");
}

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("private-login-form");
  const loginPassword = document.getElementById("private-login-password");
  const loginError = document.getElementById("private-login-error");
  if (loginForm) loginForm.addEventListener("submit", async event => {
    event.preventDefault();
    loginError.hidden = true;
    const response = await fetch("/api/auth/login", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: loginPassword.value }) });
    const data = await response.json();
    if (!response.ok) { loginError.textContent = data.error || "Unable to sign in."; loginError.hidden = false; return; }
    loginPassword.value = "";
    const state = await checkServerConnection();
    if (state.authenticated) { AppState.activeSource = "browser"; AppState.activePlatform = "all"; applyRouteFromHash({ load: false }); loadData(); }
  });

  const browserButton = document.getElementById("btn-browser-bookmarks");
  if (browserButton) browserButton.addEventListener("click", () => { closeSettings(); AppState.activeSource = "browser"; AppState.activePlatform = "all"; AppState.activeCollection = "all"; AppState.nextCursor = null; setRouteHash("#bookmarks"); updateSidebarNavigation(); loadData(); });
  if (DOM.sidebarPlatformList) DOM.sidebarPlatformList.addEventListener("click", event => { const button = event.target.closest("[data-platform]"); if (!button) return; closeSettings(); AppState.activeSource = "social"; AppState.activePlatform = button.dataset.platform; AppState.activeCollection = "all"; AppState.nextCursor = null; setRouteHash(button.dataset.sidebarRoute || ("#platform=" + button.dataset.platform)); updateSidebarNavigation(); loadData(); });

  const settingsButton = document.getElementById("btn-settings");
  if (settingsButton) settingsButton.addEventListener("click", () => { setRouteHash("#settings"); openSettings(); });
  const backButton = document.getElementById("btn-back-to-bookmarks");
  if (backButton) backButton.addEventListener("click", () => { setRouteHash("#bookmarks"); closeSettings(); });
  const logout = async () => { await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }); AppState.bookmarks = []; AppState.nextCursor = null; showPrivateLogin(); };
  const settingsLogout = document.getElementById("btn-settings-logout");
  if (settingsLogout) settingsLogout.addEventListener("click", logout);

  const more = document.getElementById("btn-load-more");
  if (more) more.addEventListener("click", () => loadData({ append: true }));

  const platformSelect = document.getElementById("add-platform");
  if (platformSelect && !platformSelect.querySelector("option[value=browser]")) { const option = document.createElement("option"); option.value = "browser"; option.textContent = "Browser Bookmark"; platformSelect.appendChild(option); }
  initSidebarNewTabContextMenu();
  window.addEventListener('hashchange', () => applyRouteFromHash({ load: true }));
  if (DOM.btnAddBookmark) DOM.btnAddBookmark.addEventListener("click", () => { if (AppState.activeSource === "browser" && platformSelect) { platformSelect.value = "browser"; AppState.linkPreview = null; populateModalCategorySelect('', getCategoryContextFromPlatform('browser')); updateManualModalPlatformUI("browser"); } });
  if (DOM.addUrl) DOM.addUrl.addEventListener("blur", () => { if (platformSelect && platformSelect.value === "browser" && DOM.addUrl.value.trim()) previewBrowserLink(DOM.addUrl.value.trim()); });
  if (DOM.addBookmarkForm) DOM.addBookmarkForm.addEventListener("submit", event => { if (platformSelect && platformSelect.value === "browser" && !AppState.editingId) saveBrowserBookmark(event); }, true);
});


async function refreshPlatformCounts() {
  try {
    const response = await fetch("/api/counts", { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    AppState.libraryCounts = data;
    AppState.platformCounts = data.platforms || { all: data.all || 0, instagram: data.instagram || 0, x: data.x || 0, threads: data.threads || 0, reddit: data.reddit || 0, facebook: data.facebook || 0 };
    updateSidebarNavigation();
    updateStatsAnalytics();
  } catch (error) {
    console.warn("Could not refresh platform counts", error);
  }
}

function renderInfiniteScrollSentinel() {
  const existing = document.getElementById("infinite-scroll-sentinel");
  if (existing) existing.remove();
  const total = AppState.filteredBookmarks.length;
  const showing = Math.min(AppState.visibleCount, total);
  if (!total) return;
  const sentinel = document.createElement("div");
  sentinel.id = "infinite-scroll-sentinel";
  sentinel.className = "infinite-scroll-sentinel";
  if (showing < total || AppState.isLoadingMore) {
    sentinel.innerHTML = "<div class=\"infinite-scroll-spinner\"><i class=\"fa-solid fa-circle-notch fa-spin\"></i><span>Loading more bookmarks…</span></div>";
  } else if (AppState.hasMore) {
    sentinel.innerHTML = "<div class=\"infinite-scroll-spinner\"><span>More bookmarks load automatically as you scroll</span></div>";
  } else {
    sentinel.innerHTML = "<div class=\"infinite-scroll-end\">Showing all loaded bookmarks</div>";
  }
  DOM.bookmarksGrid.parentNode.insertBefore(sentinel, DOM.bookmarksGrid.nextSibling);
  if (showing < total || AppState.hasMore) initInfiniteScrollObserver();
  else if (AppState.scrollObserver) AppState.scrollObserver.disconnect();
}

function initInfiniteScrollObserver() {
  if (AppState.scrollObserver) AppState.scrollObserver.disconnect();
  const sentinel = document.getElementById("infinite-scroll-sentinel");
  const scrollContainer = document.getElementById("main-panel");
  if (!sentinel || !scrollContainer) return;
  AppState.scrollObserver = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting) || isScrollLoading) return;
    const total = AppState.filteredBookmarks.length;
    if (AppState.visibleCount < total) {
      isScrollLoading = true;
      setTimeout(() => { AppState.visibleCount += POSTS_PER_PAGE; renderFeedGrid(); isScrollLoading = false; }, 300);
      return;
    }
    if (AppState.hasMore && !AppState.isLoadingMore) loadData({ append: true });
  }, { root: scrollContainer, rootMargin: "500px 0px" });
  AppState.scrollObserver.observe(sentinel);
}


function privateCheckServerConnection() {
  return fetch("/api/status", { method: "GET", cache: "no-store", credentials: "same-origin" }).then(async response => {
    if (response.status === 401) { showPrivateLogin(); return { authenticated: false }; }
    if (!response.ok) throw new Error("Status check failed");
    const data = await response.json();
    AppState.isServerConnected = true; AppState.isAdmin = true; AppState.activeSource = "browser"; AppState.activePlatform = "all";
    applyRouteFromHash({ load: false });
    document.body.classList.remove("auth-pending", "visitor-mode"); updateSyncStatusUI(true); refreshPlatformCounts();
    return { authenticated: true, data };
  }).catch(() => { showPrivateLogin("Unable to reach your private dashboard."); return { authenticated: false }; });
}

function privateLoadData(options = {}) {
  if (!AppState.isServerConnected) return;
  const append = !!options.append;
  if (AppState.isLoadingMore) return;
  AppState.isLoadingMore = true; renderInfiniteScrollSentinel();
  const params = new URLSearchParams({ source: AppState.activeSource || "browser", limit: "40" });
  if (AppState.activeSource === "social" && AppState.activePlatform !== "all") params.set("platform", AppState.activePlatform);
  if (AppState.activeSource === "social" && AppState.activeCollection && AppState.activeCollection !== "all") params.set("collection", AppState.activeCollection);
  if (append && AppState.nextCursor) params.set("cursor", AppState.nextCursor);
  fetch("/api/load?" + params.toString(), { credentials: "same-origin" }).then(async response => {
    if (response.status === 401) { showPrivateLogin(); throw new Error("Session expired"); }
    if (!response.ok) throw new Error("Bookmark load failed"); return response.json();
  }).then(data => {
    const incoming = data.bookmarks || [];
    AppState.bookmarks = append ? AppState.bookmarks.concat(incoming) : incoming;
    AppState.nextCursor = data.nextCursor || null; AppState.hasMore = !!data.hasMore; AppState.isLoadingMore = false;
    onDataLoadedSuccess();
    const more = document.getElementById("load-more-container"); if (more) more.hidden = true;
  }).catch(() => { AppState.isLoadingMore = false; renderInfiniteScrollSentinel(); });
}
