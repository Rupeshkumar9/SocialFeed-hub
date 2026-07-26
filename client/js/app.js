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
  isTagsExpanded: false
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

function loadData() {
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
  showToast("Bookmarks loaded successfully!", "success");
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
    <option value="uncategorized">Uncategorized</option>
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

function updateSidebarNavigation() {
  const platformCounts = { all: AppState.bookmarks.length, instagram: 0, x: 0, threads: 0, reddit: 0, facebook: 0 };
  AppState.bookmarks.forEach(bm => {
    let platform = (bm.platform || 'web').toLowerCase().trim();
    if (platform === 'twitter') platform = 'x';
    if (platformCounts[platform] !== undefined) {
      platformCounts[platform]++;
    }
  });

  Object.entries(platformCounts).forEach(([platform, count]) => {
    const el = document.getElementById(`count-platform-${platform}`);
    if (el) el.textContent = count;
  });

  if (DOM.sidebarPlatformList) {
    DOM.sidebarPlatformList.querySelectorAll('.menu-item').forEach(item => {
      const btn = item.querySelector('[data-platform]');
      item.classList.toggle('active', btn && btn.dataset.platform === AppState.activePlatform);
    });
  }

  const counts = { all: AppState.bookmarks.length, uncategorized: 0, 'Tech': 0, 'Art & Design': 0, 'Food': 0 };
  AppState.bookmarks.forEach(bm => {
    let folder = bm.folder && bm.folder.trim() ? bm.folder.trim() : 'uncategorized';
    const lower = folder.toLowerCase();
    if (lower === 'uncategorized' || lower === 'others') {
      folder = 'uncategorized';
    } else if (lower === 'tech') {
      folder = 'Tech';
    } else if (lower === 'art & design') {
      folder = 'Art & Design';
    } else if (lower === 'food') {
      folder = 'Food';
    }
    counts[folder] = (counts[folder] || 0) + 1;
  });

  const collectionList = DOM.sidebarCollectionList;
  if (collectionList) {
    collectionList.innerHTML = '';
    const baseItems = [
      { value: 'all', label: 'All', icon: 'fa-solid fa-folder-tree' },
      { value: 'uncategorized', label: 'Others', icon: 'fa-regular fa-folder' },
      { value: 'Tech', label: 'Tech', icon: 'fa-solid fa-folder' },
      { value: 'Art & Design', label: 'Art & Design', icon: 'fa-solid fa-folder' },
      { value: 'Food', label: 'Food', icon: 'fa-solid fa-folder' }
    ];
    
    const baseKeys = ['all', 'uncategorized', 'tech', 'art & design', 'food'];
    const customItems = Array.from(AppState.collections)
      .filter(folder => !baseKeys.includes(folder.toLowerCase()))
      .sort()
      .map(folder => ({
        value: folder,
        label: folder,
        icon: 'fa-solid fa-folder'
      }));

    [...baseItems, ...customItems].forEach(item => {
      const li = document.createElement('li');
      li.className = `menu-item ${AppState.activeCollection === item.value ? 'active' : ''}`;
      li.innerHTML = `
        <button type="button" data-collection="${escapeHTML(item.value)}">
          <i class="${item.icon}"></i>
          <span>${escapeHTML(item.label)}</span>
          <span class="menu-count">${counts[item.value] || 0}</span>
        </button>
      `;
      collectionList.appendChild(li);
    });

    // Append collapsible Tags row
    const tagsLi = document.createElement('li');
    tagsLi.className = `menu-item tags-group-row`;
    const tagCount = AppState.tags.size;
    tagsLi.innerHTML = `
      <button type="button" class="tags-group-toggle" aria-expanded="${AppState.isTagsExpanded}" style="width: 100%; display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <i class="fa-solid fa-tags"></i>
          <span>Tags</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="menu-count">${tagCount}</span>
          <i class="fa-solid fa-chevron-down chevron-icon" style="transition: transform 0.2s; transform: ${AppState.isTagsExpanded ? 'rotate(180deg)' : 'rotate(0deg)'};"></i>
        </div>
      </button>
      <ul class="sidebar-tags-sublist" style="display: ${AppState.isTagsExpanded ? 'block' : 'none'}; list-style: none; margin-top: 8px;">
      </ul>
    `;
    collectionList.appendChild(tagsLi);

    const toggleBtn = tagsLi.querySelector('.tags-group-toggle');
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      AppState.isTagsExpanded = !AppState.isTagsExpanded;
      updateSidebarNavigation();
    });

    const sublist = tagsLi.querySelector('.sidebar-tags-sublist');
    if (sublist) {
      // 1. All Tags
      const allLi = document.createElement('li');
      allLi.className = `menu-item ${AppState.activeTag === 'all' ? 'active' : ''}`;
      allLi.innerHTML = `
        <button type="button" data-tag="all" style="padding: 6px 12px; font-size: 0.9rem; display: flex; align-items: center; width: 100%;">
          <i class="fa-solid fa-hashtag" style="font-size: 0.8rem;"></i>
          <span>All Tags</span>
        </button>
      `;
      sublist.appendChild(allLi);

      // 2. Sorted Tags
      const sortedTags = Array.from(AppState.tags).sort();
      
      // Auto reset active tag if it no longer exists
      if (AppState.activeTag !== 'all' && !AppState.tags.has(AppState.activeTag)) {
        AppState.activeTag = 'all';
      }

      sortedTags.forEach(tag => {
        const li = document.createElement('li');
        li.className = `menu-item ${AppState.activeTag === tag ? 'active' : ''}`;
        li.innerHTML = `
          <button type="button" data-tag="${escapeHTML(tag)}" title="${escapeHTML(tag)}" style="padding: 6px 12px; font-size: 0.9rem; display: flex; align-items: center; width: 100%;">
            <i class="fa-solid fa-hashtag" style="font-size: 0.8rem; flex-shrink: 0;"></i>
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; flex: 1;">${escapeHTML(tag)}</span>
          </button>
        `;
        sublist.appendChild(li);
      });

      // Add click listener to the sublist
      sublist.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-tag]');
        if (!btn) return;
        e.stopPropagation();
        const tag = btn.dataset.tag;
        AppState.activeTag = tag;
        applyFiltersAndSearch();
        const drawer = document.getElementById('mobile-drawer-overlay');
        if (drawer) drawer.classList.remove('active');
      });
    }
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
    if (AppState.activeCollection && AppState.activeCollection !== 'all') {
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
      return getBookmarkDateMs(b, ['extensionScrapedAt', 'createdAt', 'sourceSavedAt', 'timestamp']) - getBookmarkDateMs(a, ['extensionScrapedAt', 'createdAt', 'sourceSavedAt', 'timestamp']);
    } else if (AppState.activeSort === 'recent-asc') {
      return getBookmarkDateMs(a, ['extensionScrapedAt', 'createdAt', 'sourceSavedAt', 'timestamp']) - getBookmarkDateMs(b, ['extensionScrapedAt', 'createdAt', 'sourceSavedAt', 'timestamp']);
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
    title += ` in ${AppState.activeCollection === '__uncategorized__' || AppState.activeCollection === 'uncategorized' ? 'Uncategorized' : AppState.activeCollection}`;
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
  
  const initials = bm.authorName ? bm.authorName.split(' ').map(n=>n[0]).join('').substring(0, 2).toUpperCase() : '?';
  
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

  let folderVal = bm.folder && bm.folder.trim() ? bm.folder.trim() : 'Others';
  if (folderVal.toLowerCase() === 'uncategorized') {
    folderVal = 'Others';
  }
  const folderMarkup = `
    <div class="card-folder-area" title="Collection: ${escapeHTML(folderVal)}">
      <i class="fa-solid fa-folder"></i>
      <span class="folder-name">${escapeHTML(folderVal)}</span>
    </div>
  `;

  // Build visual card-media
  let mediaMarkup = '';
  if (bm.platform === 'instagram') {
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
            <i class="fa-brands fa-x-twitter fallback-icon" style="background: none; -webkit-text-fill-color: #f8fafc; color: #f8fafc; font-size: 1.4rem; opacity: 0.85;"></i>
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
            <i class="fa-brands fa-threads fallback-icon" style="background: none; -webkit-text-fill-color: #f8fafc; color: #f8fafc; font-size: 1.4rem; opacity: 0.85;"></i>
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
      <div class="card-header-actions" style="display: flex; align-items: center; gap: 8px;">
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

        <div class="card-platform-icon" title="Original Platform: ${bm.platform.toUpperCase()}">
          <i class="${(() => {
            if (bm.platform === 'x') return 'fa-brands fa-x-twitter';
            if (bm.platform === 'instagram') return 'fa-brands fa-instagram';
            if (bm.platform === 'threads') return 'fa-brands fa-threads';
            if (bm.platform === 'facebook') return 'fa-brands fa-facebook';
            return 'fa-solid fa-circle-nodes';
          })()}"></i>
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
    if (e.target.closest('.card-notes-edit') || e.target.closest('.card-folder-area') || e.target.closest('.card-menu-container') || e.target.closest('.card-checkbox-container')) return;
    
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
function renderFeedGrid() {
  DOM.bookmarksGrid.innerHTML = '';
  
  if (AppState.filteredBookmarks.length === 0) {
    DOM.bookmarksGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i class="fa-solid fa-folder-open"></i></div>
        <h3>No bookmarks found</h3>
        <p>Try clearing your search filters, adjusting tags, or importing a fresh data archive!</p>
      </div>
    `;
    // Clean up existing sentinel if any
    const existing = document.getElementById('infinite-scroll-sentinel');
    if (existing) existing.remove();
    return;
  }
  
  // Only render up to visibleCount
  const visibleSlice = AppState.filteredBookmarks.slice(0, AppState.visibleCount);
  
  if (AppState.activeLayout === 'list' || AppState.activeLayout === 'compact') {
    const fragment = document.createDocumentFragment();
    visibleSlice.forEach(bm => {
      fragment.appendChild(buildCardElement(bm));
    });
    DOM.bookmarksGrid.appendChild(fragment);
  } else {
    // True Pinterest Masonry Layout: Round-Robin Left-to-Right distribution across dynamic flex columns
    const numCols = getGridColumnCount();
    const cols = [];
    for (let i = 0; i < numCols; i++) {
      const colDiv = document.createElement('div');
      colDiv.className = 'masonry-col';
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

  // Render Infinite Scroll Sentinel
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
function updateStatsAnalytics() {
  const panel = document.getElementById('stats-panel');
  if (!panel || panel.style.display === 'none') return;
  
  const dataList = AppState.filteredBookmarks;
  const total = dataList.length;
  
  // Platform Splits
  const xCount = dataList.filter(bm => bm.platform === 'x').length;
  const igCount = dataList.filter(bm => bm.platform === 'instagram').length;
  const threadsCount = dataList.filter(bm => bm.platform === 'threads').length;
  const fbCount = dataList.filter(bm => bm.platform === 'facebook').length;
  
  const xPct = total > 0 ? (xCount / total) * 100 : 0;
  const igPct = total > 0 ? (igCount / total) * 100 : 0;
  const threadsPct = total > 0 ? (threadsCount / total) * 100 : 0;
  const fbPct = total > 0 ? (fbCount / total) * 100 : 0;
  
  document.getElementById('stat-x-count').textContent = `${xCount} (${Math.round(xPct)}%)`;
  document.getElementById('stat-ig-count').textContent = `${igCount} (${Math.round(igPct)}%)`;
  document.getElementById('stat-threads-count').textContent = `${threadsCount} (${Math.round(threadsPct)}%)`;
  document.getElementById('stat-fb-count').textContent = `${fbCount} (${Math.round(fbPct)}%)`;
  
  document.getElementById('stat-x-bar').style.width = `${xPct}%`;
  document.getElementById('stat-ig-bar').style.width = `${igPct}%`;
  document.getElementById('stat-threads-bar').style.width = `${threadsPct}%`;
  document.getElementById('stat-fb-bar').style.width = `${fbPct}%`;
  
  // Collections Stats
  const collectionCounts = {};
  dataList.forEach(bm => {
    const f = bm.folder || 'Uncategorized';
    collectionCounts[f] = (collectionCounts[f] || 0) + 1;
  });
  
  const collectionsList = document.getElementById('stat-collections-list');
  collectionsList.innerHTML = '';
  Object.entries(collectionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([folder, count]) => {
      const item = document.createElement('div');
      item.className = 'stats-list-item';
      item.innerHTML = `
        <span>${escapeHTML(folder)}</span>
        <span class="stats-badge">${count}</span>
      `;
      collectionsList.appendChild(item);
    });
    
  if (Object.keys(collectionCounts).length === 0) {
    collectionsList.innerHTML = `<div style="font-size:0.7rem; color:var(--text-muted); padding: 4px 0;">No collections</div>`;
  }
  
  // Tags Stats
  const tagCounts = {};
  dataList.forEach(bm => {
    if (bm.hashtags) {
      bm.hashtags.forEach(t => {
        tagCounts[t] = (tagCounts[t] || 0) + 1;
      });
    }
  });
  
  const tagsList = document.getElementById('stat-tags-list');
  tagsList.innerHTML = '';
  Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([tag, count]) => {
      const item = document.createElement('div');
      item.className = 'stats-list-item';
      item.innerHTML = `
        <span>#${escapeHTML(tag)}</span>
        <span class="stats-badge">${count}</span>
      `;
      tagsList.appendChild(item);
    });
    
  if (Object.keys(tagCounts).length === 0) {
    tagsList.innerHTML = `<div style="font-size:0.7rem; color:var(--text-muted); padding: 4px 0;">No tags</div>`;
  }
}



/**
 * Core Data Sync Manager: Saves the active state back to data/bookmarks.json
 */
function saveDataToServer() {
  if (AppState.isServerConnected) {
    DOM.syncBtn.classList.add('saving');
    DOM.syncStatusText.textContent = 'Syncing...';
    
    const token = localStorage.getItem('admin_token');
    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    fetch('/api/save', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(AppState.bookmarks)
    })
      .then(res => {
        if (!res.ok) throw new Error("Server rejected save operation");
        return res.json();
      })
      .then(data => {
        showToast("Synchronized successfully with Server disk!", "success");
        updateSyncStatusUI(true);
      })
      .catch(err => {
        console.error("Save failure:", err);
        showToast("Server sync failed. Data is cached in memory.", "error");
        updateSyncStatusUI(false);
      });
  } else {
    // If not connected to local sync server, notify user they are in offline mode
    showToast("App is offline. Click 'Offline (Click to Save)' in sidebar to download your updated database.", "error");
  }
}

/**
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
      showToast("No valid X or Instagram bookmarks parsed from file.", "error");
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
      showToast(`Import complete! Added ${added} new, enriched ${updated} existing.`, "success");
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
      bm.authorName = authorName || (platform === 'x' ? 'X User' : platform === 'instagram' ? 'Instagram Creator' : platform === 'threads' ? 'Threads Creator' : platform === 'reddit' ? 'Reddit User' : 'Facebook User');
      bm.authorUsername = authorName ? authorName.toLowerCase().replace(/\s+/g, '') : bm.authorUsername;
      bm.content = content || bm.content;
      bm.folder = categoryVal;
      
      const newUserTags = tagListInput ? tagListInput.split(',').map(t => t.trim().toLowerCase().replace('#', '')).filter(Boolean) : [];
      bm.hashtags = newUserTags;
      
      // Reprocess state and write to server
      processCollections();
      updateCollectionsFilterDropdown();
      processTags();
      renderTagCloud();
      applyFiltersAndSearch();
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
  const hashtags = tagListInput ? tagListInput.split(',').map(t => t.trim().toLowerCase().replace('#', '')).filter(Boolean) : [];

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
    authorName: authorName || (platform === 'x' ? 'X User' : platform === 'instagram' ? 'Instagram Creator' : platform === 'threads' ? 'Threads Creator' : platform === 'reddit' ? 'Reddit User' : 'Facebook User'),
    authorUsername: authorName ? authorName.toLowerCase().replace(/\s+/g, '') : 'username',
    content: content || `Saved ${platform.toUpperCase()} Post (click to load embed)`,
    timestamp: new Date().toISOString(),
    hashtags: hashtags,
    folder: categoryVal,
    notes: ''
  };

  // Merge (deduplicate)
  const mergeResult = BookmarksImporter.merge(AppState.bookmarks, [newBookmark]);
  
  if (mergeResult.addedCount === 0) {
    showToast("This post is already in your bookmark feed!", "error");
    return;
  }

  AppState.bookmarks = mergeResult.merged;
  
  // Reprocess state and write to server
  processCollections();
  updateCollectionsFilterDropdown();
  processTags();
  renderTagCloud();
  applyFiltersAndSearch();
  saveDataToServer();

  // Close Modal
  DOM.addModalOverlay.classList.remove('active');
  DOM.addBookmarkForm.reset();
  
  showToast("Bookmark added to feed successfully!", "success");
}

/**
 * Populate the Category select dropdown in the Add/Edit bookmark modal
 */
function populateModalCategorySelect(selectedVal = '') {
  if (!DOM.addCategory) return;
  DOM.addCategory.innerHTML = '';
  
  // Default option
  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = 'Others';
  DOM.addCategory.appendChild(defaultOpt);
  
  // Hardcoded categories
  const hardcodedCats = ['Tech', 'Art & Design', 'Food'];
  
  // Combine custom collections with hardcoded categories (avoiding duplicates)
  const allCatsSet = new Set(hardcodedCats);
  if (AppState.collections) {
    Array.from(AppState.collections).forEach(c => {
      const lower = c.toLowerCase();
      if (lower !== 'all' && lower !== 'uncategorized' && lower !== '__uncategorized__' && lower !== 'others') {
        allCatsSet.add(c);
      }
    });
  }
  
  const sortedCollections = Array.from(allCatsSet).sort((a, b) => a.localeCompare(b));
    
  sortedCollections.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    DOM.addCategory.appendChild(opt);
  });
  
  // Create New option
  const newOpt = document.createElement('option');
  newOpt.value = '__new__';
  newOpt.textContent = '+ Create new category...';
  newOpt.style.color = 'var(--accent-blue)';
  newOpt.style.fontWeight = 'bold';
  DOM.addCategory.appendChild(newOpt);
  
  // Set value
  if (selectedVal) {
    const lower = selectedVal.toLowerCase();
    if (lower === 'uncategorized' || lower === 'others') {
      DOM.addCategory.value = '';
    } else {
      const match = sortedCollections.find(c => c.toLowerCase() === lower);
      if (match) {
        DOM.addCategory.value = match;
      } else {
        const opt = document.createElement('option');
        opt.value = selectedVal;
        opt.textContent = selectedVal;
        DOM.addCategory.insertBefore(opt, newOpt);
        DOM.addCategory.value = selectedVal;
      }
    }
  } else {
    DOM.addCategory.value = '';
  }
  
  // Reset and hide new category input
  DOM.addCategoryNew.style.display = 'none';
  DOM.addCategoryNew.value = '';
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
  const initials = bm.authorName ? bm.authorName.split(' ').map(n=>n[0]).join('').substring(0, 2).toUpperCase() : '?';
  const platformIconClass = (() => {
    if (bm.platform === 'x') return 'fa-brands fa-x-twitter';
    if (bm.platform === 'instagram') return 'fa-brands fa-instagram';
    if (bm.platform === 'threads') return 'fa-brands fa-threads';
    if (bm.platform === 'facebook') return 'fa-brands fa-facebook';
    return 'fa-solid fa-circle-nodes';
  })();
  
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
        <i class="${platformIconClass}"></i>
      </div>
    </div>
    ${formattedPostDate ? `
      <div class="modal-post-date" style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 12px; display: flex; align-items: center; gap: 6px; padding-bottom: 6px; border-bottom: 1px dashed var(--border-color);">
        <i class="fa-regular fa-calendar-days" style="color: var(--accent-rose, #e11d48); font-size: 0.8rem;"></i>
        <span style="font-weight: 500;">${formattedPostDate}</span>
      </div>
    ` : ''}
    <div class="modal-post-text" style="font-size: 0.9rem; line-height: 1.5; color: var(--text-primary); white-space: pre-wrap; word-break: break-word; max-height: 250px; overflow-y: auto; padding-right: 4px;">
      ${escapeHTML(cleanContent)}
    </div>
    ${bm.thumbnail ? `
      <div class="modal-post-media" style="margin-top: 12px; border-radius: 8px; overflow: hidden; max-height: 200px; display: flex; justify-content: center; align-items: center; background: rgba(0,0,0,0.02); border: 1px solid var(--border-color);">
        <img src="${bm.thumbnail}" style="max-width: 100%; max-height: 200px; object-fit: contain;">
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
  
  // Hardcoded categories
  const hardcodedCats = ['Tech', 'Art & Design', 'Food'];
  const allCatsSet = new Set(hardcodedCats);
  if (AppState.collections) {
    Array.from(AppState.collections).forEach(c => {
      const lower = c.toLowerCase();
      if (lower !== 'all' && lower !== 'uncategorized' && lower !== '__uncategorized__' && lower !== 'others') {
        allCatsSet.add(c);
      }
    });
  }
  
  const sortedCollections = Array.from(allCatsSet).sort((a, b) => a.localeCompare(b));
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
    
    updateSidebarNavigation();
    applyFiltersAndSearch();
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
    addPlatformSelect.value = bm.platform;
  }

  DOM.addAuthorName.value = bm.authorName || '';
  DOM.addContent.value = bm.content || '';
  
  const userTags = bm.hashtags || [];
  DOM.addTags.value = userTags.join(', ');
  
  // Prefill category
  populateModalCategorySelect(bm.folder || '');
  
  DOM.addModalOverlay.classList.add('active');
}

/**
 * Delete bookmark and update state/sync to disk
 */
function deleteBookmark(id) {
  const idx = AppState.bookmarks.findIndex(bm => bm.id === id);
  if (idx !== -1) {
    AppState.bookmarks.splice(idx, 1);
    
    // Reprocess metadata, update collections & tags filters, apply filters, save to server
    processCollections();
    updateCollectionsFilterDropdown();
    processTags();
    renderTagCloud();
    applyFiltersAndSearch();
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
    // Filter out selected IDs
    AppState.bookmarks = AppState.bookmarks.filter(bm => !AppState.selectedIds.has(bm.id));
    
    // Clear selection and exit selection mode
    toggleSelectionMode(false);
    
    // Reprocess state and write to server
    processCollections();
    updateCollectionsFilterDropdown();
    processTags();
    renderTagCloud();
    applyFiltersAndSearch();
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
      applyFiltersAndSearch();
    });
  }
  
  // Sidebar platform and category navigation
  if (DOM.sidebarPlatformList) {
    DOM.sidebarPlatformList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-platform]');
      if (!btn) return;
      AppState.activePlatform = btn.dataset.platform;
      syncFilterSelects();
      applyFiltersAndSearch();
      const drawer = document.getElementById('mobile-drawer-overlay');
      if (drawer) drawer.classList.remove('active');
    });
  }

  if (DOM.sidebarCollectionList) {
    DOM.sidebarCollectionList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-collection]');
      if (!btn) return;
      AppState.activeCollection = btn.dataset.collection;
      syncFilterSelects();
      applyFiltersAndSearch();
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
    populateModalCategorySelect('');
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
    });
  }

  DOM.btnAddBookmark.addEventListener('click', () => {
    resetAddModal();
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







