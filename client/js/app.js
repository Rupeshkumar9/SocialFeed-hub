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
  searchQuery: '',
  activeBookmark: null,
  isServerConnected: false,
  isAdmin: false,
  visibleCount: POSTS_PER_PAGE,
  editingId: null,
  isSelectionMode: false,
  selectedIds: new Set()
};

// DOM Cache
const DOM = {
  bookmarksGrid: document.getElementById('bookmarks-grid'),
  searchInput: document.getElementById('search-input'),
  feedTitle: document.getElementById('feed-title'),
  feedSubtitle: document.getElementById('feed-subtitle'),
  filterPlatform: document.getElementById('filter-platform'),
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
  
  // Sync Actions
  syncBtn: document.getElementById('sync-btn'),
  syncStatusText: document.getElementById('sync-status-text'),
  syncDot: document.getElementById('sync-dot'),
  btnSyncNow: document.getElementById('btn-sync-now'),
  btnExportJson: document.getElementById('action-export-json'),
  
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

  return fetch('/api/status', { method: 'GET', headers: headers, cache: 'no-store' })
    .then(res => res.json())
    .then(data => {
      if (data && data.status === 'ok') {
        AppState.isServerConnected = true;
        updateSyncStatusUI(true, 'Connected to Server');
        
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
      } else {
        AppState.isServerConnected = false;
        AppState.isAdmin = true;
        document.body.classList.remove('visitor-mode');
        updateAdminLoginUI(true);
        updateSyncStatusUI(false, 'Offline (Click to Save)');
      }
    })
    .catch(() => {
      AppState.isServerConnected = false;
      AppState.isAdmin = true;
      document.body.classList.remove('visitor-mode');
      updateAdminLoginUI(true);
      updateSyncStatusUI(false, 'Offline (Click to Save)');
    });
}

/**
 * Update UI Sync Button indicator state
 */
function updateSyncStatusUI(connected, message) {
  if (connected) {
    DOM.syncDot.className = 'sync-dot';
    DOM.syncStatusText.textContent = message;
    DOM.syncBtn.title = "Local server is running. Changes will save automatically!";
    DOM.syncBtn.classList.remove('saving');
  } else {
    DOM.syncDot.className = 'sync-dot offline';
    DOM.syncStatusText.textContent = message;
    DOM.syncBtn.title = "No local server running. Clicking this button will download your updated bookmarks.json file.";
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
  renderTagCloud();
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
    if (bm.tags && Array.isArray(bm.tags)) {
      bm.tags.forEach(tag => {
        if (tag.trim()) AppState.tags.add(tag.trim().toLowerCase());
      });
    }
  });
}

/**
 * Render the Tag Dropdown filter options
 */
function renderTagCloud() {
  const currentActiveTag = AppState.activeTag;
  DOM.tagsDropdownMenu.innerHTML = '';
  
  // Create All Tags option
  const allTagEl = document.createElement('div');
  allTagEl.className = `dropdown-item ${currentActiveTag === 'all' ? 'active' : ''}`;
  allTagEl.textContent = 'All Tags';
  allTagEl.addEventListener('click', (e) => {
    e.stopPropagation();
    filterByTag('all');
    DOM.tagsDropdownMenu.classList.remove('active');
  });
  DOM.tagsDropdownMenu.appendChild(allTagEl);

  // Render sorted tags
  const sortedTags = Array.from(AppState.tags).sort();
  sortedTags.forEach(tag => {
    const tagEl = document.createElement('div');
    tagEl.className = `dropdown-item ${currentActiveTag === tag ? 'active' : ''}`;
    tagEl.textContent = `#${tag}`;
    tagEl.addEventListener('click', (e) => {
      e.stopPropagation();
      filterByTag(tag);
      DOM.tagsDropdownMenu.classList.remove('active');
    });
    DOM.tagsDropdownMenu.appendChild(tagEl);
  });
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
  
  // Update toggle button text to show selected tag
  const btn = DOM.tagsDropdownBtn;
  if (tag === 'all') {
    btn.innerHTML = `<i class="fa-solid fa-tags"></i> Tags <i class="fa-solid fa-chevron-down"></i>`;
  } else {
    btn.innerHTML = `<i class="fa-solid fa-tags"></i> #${tag} <i class="fa-solid fa-chevron-down"></i>`;
  }

  applyFiltersAndSearch();
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
        if (bm.folder !== AppState.activeCollection) return false;
      }
    }
    
    // 2. Tag Filter
    if (AppState.activeTag !== 'all') {
      const hasTag = bm.tags && bm.tags.some(t => t.toLowerCase() === AppState.activeTag);
      if (!hasTag) return false;
    }
    
    // 3. Search Bar scanning
    if (query !== '') {
      const matchAuthorName = bm.authorName && bm.authorName.toLowerCase().includes(query);
      const matchUsername = bm.authorUsername && bm.authorUsername.toLowerCase().includes(query);
      const matchContent = bm.content && bm.content.toLowerCase().includes(query);
      const matchNotes = bm.notes && bm.notes.toLowerCase().includes(query);
      const matchTags = bm.tags && bm.tags.some(t => t.toLowerCase().includes(query));
      
      return matchAuthorName || matchUsername || matchContent || matchNotes || matchTags;
    }
    
    return true;
  });

  // Sort bookmarks by timestamp (newest first)
  AppState.filteredBookmarks.sort((a, b) => {
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  // Reset pagination on any filter/search change
  AppState.visibleCount = POSTS_PER_PAGE;

  // Update Headers
  updateFeedHeaders();
  
  // Update Analytics Dashboard (if open)
  updateStatsAnalytics();
  
  // Render final filtered list
  renderFeedGrid();
}

/**
 * Update Feed Grid Title & Subtitle text dynamically
 */
function updateFeedHeaders() {
  let title = 'All Bookmarks';
  if (AppState.activePlatform === 'x') title = 'X / Twitter';
  if (AppState.activePlatform === 'instagram') title = 'Instagram';
  
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
  card.className = `bookmark-card ${bm.platform}-post`;
  card.setAttribute('data-id', bm.id);
  
  const initials = bm.authorName ? bm.authorName.split(' ').map(n=>n[0]).join('').substring(0, 2).toUpperCase() : '?';
  
  // Build tags markup (limit to 3 visible)
  let tagsMarkup = '';
  if (bm.tags && bm.tags.length > 0) {
    const visibleTags = bm.tags.slice(0, 3);
    tagsMarkup = visibleTags.map(t => `<span class="card-tag">#${t}</span>`).join('');
    if (bm.tags.length > 3) {
      tagsMarkup += `<span class="card-tag" style="opacity:0.5;">+${bm.tags.length - 3}</span>`;
    }
  }

  // Editable Notes markup
  const notesVal = bm.notes || '';
  const notesMarkup = `
    <div class="card-notes-edit">
      <textarea class="card-notes-textarea" placeholder="Write custom notes...">${escapeHTML(notesVal)}</textarea>
    </div>
    ${notesVal ? `<div class="card-notes-display"><i class="fa-solid fa-note-sticky"></i> ${escapeHTML(notesVal)}</div>` : ''}
  `;

  // Build folder select options
  const folderOptions = Array.from(AppState.collections).sort().map(f => 
    `<option value="${escapeHTML(f)}" ${bm.folder === f ? 'selected' : ''}>${escapeHTML(f)}</option>`
  ).join('');

  const folderMarkup = `
    <div class="card-folder-area" title="Collection">
      <i class="fa-solid fa-folder"></i>
      <select class="folder-select" data-id="${bm.id}">
        <option value="">Uncategorized</option>
        ${folderOptions}
        <option value="__new__" style="color: var(--accent-blue); font-weight: bold;">+ New...</option>
      </select>
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
          <i class="${bm.platform === 'x' ? 'fa-brands fa-x-twitter' : 'fa-brands fa-instagram'}"></i>
        </div>
      </div>
    </div>
    
    <div class="card-body">
      <div class="post-quote-icon"><i class="fa-solid fa-quote-left"></i></div>
      ${(() => {
        const contentVal = bm.content || 'Saved Post details';
        const words = contentVal.split(/\s+/);
        const hasMore = words.length > 50;
        const summaryText = hasMore ? words.slice(0, 50).join(' ') + '...' : contentVal;
        if (hasMore) {
          return `
            <div class="post-content">${escapeHTML(summaryText)}</div>
            <div class="card-hover-overlay">
              <div class="hover-overlay-quote"><i class="fa-solid fa-quote-left"></i></div>
              <div class="hover-overlay-content">${escapeHTML(contentVal)}</div>
            </div>
          `;
        } else {
          return `<div class="post-content">${escapeHTML(contentVal)}</div>`;
        }
      })()}
      ${mediaMarkup}
      ${notesMarkup}
    </div>
    
    <div class="card-footer">
      ${tagsMarkup}
    </div>
  `;

  // Attach handlers
  const textarea = card.querySelector('.card-notes-textarea');
  textarea.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  
  textarea.addEventListener('blur', (e) => {
    const newNotes = e.target.value.trim();
    if (newNotes !== (bm.notes || '')) {
      saveBookmarkNotes(bm.id, newNotes);
    }
  });

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      textarea.blur();
    }
  });

  const folderSelect = card.querySelector('.folder-select');
  if (folderSelect) {
    folderSelect.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    folderSelect.addEventListener('change', (e) => {
      e.stopPropagation();
      const val = e.target.value;
      if (val === '__new__') {
        const newFolder = prompt("Enter new collection name:");
        if (newFolder && newFolder.trim()) {
          const cleanFolder = newFolder.trim();
          AppState.collections.add(cleanFolder);
          bm.folder = cleanFolder;
          saveBookmarkFolder(bm.id, cleanFolder);
        } else {
          e.target.value = bm.folder || "";
        }
      } else {
        bm.folder = val;
        saveBookmarkFolder(bm.id, val);
      }
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
  
  // Use DocumentFragment for fast batch DOM insertion
  const fragment = document.createDocumentFragment();
  visibleSlice.forEach(bm => {
    fragment.appendChild(buildCardElement(bm));
  });
  DOM.bookmarksGrid.appendChild(fragment);

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
  
  const gridBtn = document.getElementById('layout-grid-btn');
  const listBtn = document.getElementById('layout-list-btn');
  const compactBtn = document.getElementById('layout-compact-btn');
  
  if (gridBtn) gridBtn.classList.toggle('active', layout === 'grid');
  if (listBtn) listBtn.classList.toggle('active', layout === 'list');
  if (compactBtn) compactBtn.classList.toggle('active', layout === 'compact');
  
  if (DOM.bookmarksGrid) {
    DOM.bookmarksGrid.classList.remove('list-view', 'compact-view');
    if (layout === 'list') {
      DOM.bookmarksGrid.classList.add('list-view');
    } else if (layout === 'compact') {
      DOM.bookmarksGrid.classList.add('compact-view');
    }
  }
  
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
  
  const xPct = total > 0 ? (xCount / total) * 100 : 0;
  const igPct = total > 0 ? (igCount / total) * 100 : 0;
  
  document.getElementById('stat-x-count').textContent = `${xCount} (${Math.round(xPct)}%)`;
  document.getElementById('stat-ig-count').textContent = `${igCount} (${Math.round(igPct)}%)`;
  
  document.getElementById('stat-x-bar').style.width = `${xPct}%`;
  document.getElementById('stat-ig-bar').style.width = `${igPct}%`;
  
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
    if (bm.tags) {
      bm.tags.forEach(t => {
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
 * Export active feed items as Obsidian-friendly Markdown files
 */
function exportBookmarksToMarkdown() {
  const listToExport = AppState.filteredBookmarks;
  if (listToExport.length === 0) {
    showToast("No bookmarks matching current filters to export", "error");
    return;
  }
  
  let markdown = `# Bookmarks Feed Export\n\n`;
  markdown += `*Exported on: ${new Date().toLocaleString()}*\n`;
  markdown += `*Total items: ${listToExport.length}*\n\n---\n\n`;
  
  listToExport.forEach(bm => {
    markdown += `## ${bm.authorName || 'Social Post'} (@${bm.authorUsername || 'user'})\n\n`;
    markdown += `- **Platform:** ${bm.platform.toUpperCase()}\n`;
    markdown += `- **URL:** [Original Post](${bm.url})\n`;
    if (bm.folder) {
      markdown += `- **Collection:** [[${bm.folder}]]\n`;
    }
    if (bm.tags && bm.tags.length > 0) {
      markdown += `- **Tags:** ${bm.tags.map(t => `#${t}`).join(' ')}\n`;
    }
    markdown += `- **Saved Date:** ${formatDate(bm.timestamp)}\n\n`;
    
    markdown += `### Content\n> ${bm.content ? bm.content.replace(/\n/g, '\n> ') : 'No content'}\n\n`;
    
    if (bm.notes && bm.notes.trim()) {
      markdown += `### Personal Notes\n${bm.notes}\n\n`;
    }
    
    markdown += `---\n\n`;
  });
  
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", url);
  downloadAnchor.setAttribute("download", `bookmarks_export_${new Date().toISOString().split('T')[0]}.md`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  URL.revokeObjectURL(url);
  
  showToast(`Exported ${listToExport.length} bookmarks to Markdown!`, "success");
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
        updateSyncStatusUI(true, 'Server Synchronized');
      })
      .catch(err => {
        console.error("Save failure:", err);
        showToast("Server sync failed. Data is cached in memory.", "error");
        updateSyncStatusUI(false, 'Sync Failed (Click Save)');
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
  const SYSTEM_TAGS = ['imported', 'manual', 'x-archive', 'instagram-archive', 'extracted-link', 'instagram', 'x-post'];

  if (AppState.editingId) {
    const idx = AppState.bookmarks.findIndex(bm => bm.id === AppState.editingId);
    if (idx !== -1) {
      const bm = AppState.bookmarks[idx];
      bm.authorName = authorName || (bm.platform === 'x' ? 'X User' : 'Instagram Creator');
      bm.authorUsername = authorName ? authorName.toLowerCase().replace(/\s+/g, '') : bm.authorUsername;
      bm.content = content || bm.content;
      
      const originalSystemTags = bm.tags ? bm.tags.filter(t => SYSTEM_TAGS.includes(t.toLowerCase())) : [];
      const newUserTags = tagListInput ? tagListInput.split(',').map(t => t.trim().toLowerCase().replace('#', '')).filter(Boolean) : [];
      bm.tags = Array.from(new Set([...originalSystemTags, ...newUserTags]));
      
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
  
  // Auto detect platform
  const lowerUrl = url.toLowerCase();
  let platform = '';
  if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) platform = 'x';
  else if (lowerUrl.includes('instagram.com')) platform = 'instagram';
  
  if (!platform) {
    showToast("Invalid URL. Must be an X (Twitter) or Instagram post URL.", "error");
    return;
  }

  // Parse tags
  const tags = tagListInput ? tagListInput.split(',').map(t => t.trim().toLowerCase().replace('#', '')).filter(Boolean) : [];
  if (!tags.includes('manual')) tags.push('manual');

  // Extract unique code or ID for deduplication keys
  let id = '';
  if (platform === 'x') {
    const match = url.match(/\/status\/(\d+)/i);
    id = `x_${match ? match[1] : Date.now()}`;
  } else {
    const code = BookmarksImporter.extractInstagramCode(url);
    id = `ig_${code || Date.now()}`;
  }

  // Create new bookmark record
  const newBookmark = {
    id: id,
    platform: platform,
    url: url,
    authorName: authorName || (platform === 'x' ? 'X User' : 'Instagram Creator'),
    authorUsername: authorName ? authorName.toLowerCase().replace(/\s+/g, '') : 'username',
    content: content || `Saved ${platform.toUpperCase()} Post (click to load embed)`,
    timestamp: new Date().toISOString(),
    tags: tags,
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
  
  DOM.addAuthorName.value = bm.authorName || '';
  DOM.addContent.value = bm.content || '';
  
  const SYSTEM_TAGS = ['imported', 'manual', 'x-archive', 'instagram-archive', 'extracted-link', 'instagram', 'x-post'];
  const userTags = bm.tags ? bm.tags.filter(t => !SYSTEM_TAGS.includes(t.toLowerCase())) : [];
  DOM.addTags.value = userTags.join(', ');
  
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
  
  // Platform select in navbar change
  DOM.filterPlatform.addEventListener('change', (e) => {
    filterByPlatform(e.target.value);
  });

  // Collection select in navbar change
  const filterCollection = document.getElementById('filter-collection');
  if (filterCollection) {
    filterCollection.addEventListener('change', (e) => {
      AppState.activeCollection = e.target.value;
      applyFiltersAndSearch();
    });
  }
  
  // Tags dropdown click toggle
  DOM.tagsDropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    DOM.tagsDropdownMenu.classList.toggle('active');
  });

  // Global click to close active dropdowns
  document.addEventListener('click', () => {
    DOM.tagsDropdownMenu.classList.remove('active');
    document.querySelectorAll('.card-menu-dropdown.active').forEach(el => {
      el.classList.remove('active');
    });
  });

  // Layout Switcher bindings
  const gridBtn = document.getElementById('layout-grid-btn');
  const listBtn = document.getElementById('layout-list-btn');
  const compactBtn = document.getElementById('layout-compact-btn');
  if (gridBtn && listBtn && compactBtn) {
    gridBtn.addEventListener('click', () => changeLayout('grid'));
    listBtn.addEventListener('click', () => changeLayout('list'));
    compactBtn.addEventListener('click', () => changeLayout('compact'));
  }
  
  // Sync Actions listeners
  DOM.syncBtn.addEventListener('click', () => {
    if (AppState.isServerConnected) {
      checkServerConnection().then(saveDataToServer);
    } else {
      triggerManualDownload();
    }
  });
  DOM.btnSyncNow.addEventListener('click', () => {
    checkServerConnection().then(loadData);
  });
  DOM.btnExportJson.addEventListener('click', triggerManualDownload);

  // Markdown Export listener
  const btnExportMd = document.getElementById('action-export-md');
  if (btnExportMd) {
    btnExportMd.addEventListener('click', exportBookmarksToMarkdown);
  }

  // Analytics toggle stats panel
  const btnToggleStats = document.getElementById('btn-toggle-stats');
  const statsPanel = document.getElementById('stats-panel');
  if (btnToggleStats && statsPanel) {
    btnToggleStats.addEventListener('click', () => {
      const isOpen = statsPanel.style.display !== 'none';
      if (isOpen) {
        statsPanel.style.display = 'none';
        btnToggleStats.classList.remove('active');
      } else {
        statsPanel.style.display = 'block';
        btnToggleStats.classList.add('active');
        updateStatsAnalytics();
      }
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
  };

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
