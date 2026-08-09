// Application State
export const POSTS_PER_PAGE = 50;

export const AppState = {
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
  isAnalyticsOpen: false,
  analyticsReturnFocus: null,
  isSettingsOpen: false,
  activeSource: 'browser',
  nextCursor: null,
  hasMore: false,
  isLoadingMore: false,
  linkPreview: null,
  databaseConnected: null,
  activeRequestId: 0,
  scrollObserver: null,
  layoutInitialized: false
};

// DOM Cache
export const DOM = {
  bookmarksGrid: document.getElementById('bookmarks-grid'),
  searchBar: document.querySelector('.search-bar-container'),
  searchToggle: document.getElementById('search-toggle'),
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
  addUrlLabel: document.getElementById('add-url-label'),
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
  addCustomPlatformGroup: document.getElementById('add-custom-platform-group'),
  addCustomPlatformName: document.getElementById('add-custom-platform-name'),
  themeToggle: document.getElementById('theme-toggle'),

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
