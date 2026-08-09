import { AppState, DOM, POSTS_PER_PAGE } from './state.js';
import { actions, registerActions } from './actions.js';

const applyFiltersAndSearch = (...args) => actions.applyFiltersAndSearch(...args);
const applyRouteFromHash = (...args) => actions.applyRouteFromHash(...args);
const bulkDeleteSelected = (...args) => actions.bulkDeleteSelected(...args);
const bulkDeselectAll = (...args) => actions.bulkDeselectAll(...args);
const bulkSelectAll = (...args) => actions.bulkSelectAll(...args);
const changeLayout = (...args) => actions.changeLayout(...args);
const checkServerConnection = (...args) => actions.checkServerConnection(...args);
const clearManualImageValue = (...args) => actions.clearManualImageValue(...args);
const closeSettings = (...args) => actions.closeSettings(...args);
const debounce = (...args) => actions.debounce(...args);
const filterByPlatform = (...args) => actions.filterByPlatform(...args);
const getCategoryContextFromPlatform = (...args) => actions.getCategoryContextFromPlatform(...args);
const getGridColumnCount = (...args) => actions.getGridColumnCount(...args);
const handleAdminLoginSubmit = (...args) => actions.handleAdminLoginSubmit(...args);
const handleBulkEditSubmit = (...args) => actions.handleBulkEditSubmit(...args);
const handleFileImport = (...args) => actions.handleFileImport(...args);
const handleManualBookmarkSubmit = (...args) => actions.handleManualBookmarkSubmit(...args);
const initSidebarNewTabContextMenu = (...args) => actions.initSidebarNewTabContextMenu(...args);
const loadData = (...args) => actions.loadData(...args);
const openBulkEditModal = (...args) => actions.openBulkEditModal(...args);
const openSettings = (...args) => actions.openSettings(...args);
const populateModalCategorySelect = (...args) => actions.populateModalCategorySelect(...args);
const previewBrowserLink = (...args) => actions.previewBrowserLink(...args);
const isKnownSocialPlatform = (...args) => actions.isKnownSocialPlatform(...args);
const platformLabel = (...args) => actions.platformLabel(...args);
const renderFeedGrid = (...args) => actions.renderFeedGrid(...args);
const refreshPlatformCounts = (...args) => actions.refreshPlatformCounts(...args);
const saveBookmarkNotes = (...args) => actions.saveBookmarkNotes(...args);
const saveModalNoteAndClose = (...args) => actions.saveModalNoteAndClose(...args);
const setManualImageFieldVisible = (...args) => actions.setManualImageFieldVisible(...args);
const setManualImageFromFile = (...args) => actions.setManualImageFromFile(...args);
const setRouteHash = (...args) => actions.setRouteHash(...args);
const showToast = (...args) => actions.showToast(...args);
const syncFilterSelects = (...args) => actions.syncFilterSelects(...args);
const toggleSelectionMode = (...args) => actions.toggleSelectionMode(...args);
const triggerManualDownload = (...args) => actions.triggerManualDownload(...args);
const updateAdminLoginUI = (...args) => actions.updateAdminLoginUI(...args);
const updateManualImagePreview = (...args) => actions.updateManualImagePreview(...args);
const updateManualModalPlatformUI = (...args) => actions.updateManualModalPlatformUI(...args);
const updateSidebarNavigation = (...args) => actions.updateSidebarNavigation(...args);
const updateStatsAnalytics = (...args) => actions.updateStatsAnalytics(...args);
const openCategoryRenameDialog = (...args) => actions.openCategoryRenameDialog(...args);

function initEventListeners() {
  DOM.feedTitle?.addEventListener('click', event => {
    const button = event.target.closest('[data-category-rename]');
    if (!button || button.dataset.categoryRename !== 'social') return;
    openCategoryRenameDialog({
      source: 'social',
      platform: AppState.activePlatform,
      oldName: AppState.activeCollection
    });
  });
  DOM.bookmarksGrid?.addEventListener('click', event => {
    const button = event.target.closest('[data-category-rename]');
    if (!button || button.dataset.categoryRename !== 'browser') return;
    openCategoryRenameDialog({ source: 'browser', oldName: button.dataset.categoryOld });
  });
  // Search typing (debounced to prevent typing lag and layout re-calculations)
  DOM.searchInput.addEventListener('input', debounce((e) => {
    AppState.searchQuery = e.target.value;
    applyFiltersAndSearch();
  }, 150));

  // On narrow screens search is represented by an icon so the sync controls
  // always remain reachable. The full input opens below the sticky header.
  if (DOM.searchBar && DOM.searchToggle) {
    const closeMobileSearch = () => {
      DOM.searchBar.classList.remove('is-open');
      DOM.searchToggle.setAttribute('aria-expanded', 'false');
      DOM.searchToggle.setAttribute('aria-label', 'Open search');
    };

    DOM.searchToggle.addEventListener('click', (event) => {
      event.stopPropagation();
      const isOpen = DOM.searchBar.classList.toggle('is-open');
      DOM.searchToggle.setAttribute('aria-expanded', String(isOpen));
      DOM.searchToggle.setAttribute('aria-label', isOpen ? 'Close search' : 'Open search');
      if (isOpen) requestAnimationFrame(() => DOM.searchInput.focus());
    });

    DOM.searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeMobileSearch();
        DOM.searchToggle.focus();
      }
    });

    document.addEventListener('click', (event) => {
      if (DOM.searchBar.classList.contains('is-open') && !DOM.searchBar.contains(event.target)) {
        closeMobileSearch();
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) closeMobileSearch();
    });
  }

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
      if (AppState.isServerConnected) loadData();
      else applyFiltersAndSearch();
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

  // The status indicator is read-only. Clicking it only explains the current
  // state; saving and refreshing are separate, explicit operations.
  DOM.syncBtn.addEventListener('click', () => {
    const connected = DOM.syncBtn.dataset.status === 'connected';
    showToast(
      connected ? 'Server and database are connected.' : 'Server or database is unavailable.',
      connected ? 'success' : 'error'
    );
  });

  // Refresh the current view from the server. A full refresh intentionally
  // starts at the first page and also updates sidebar/analytics counts.
  DOM.btnSyncNow.addEventListener('click', async () => {
    if (DOM.btnSyncNow.disabled) return;
    const icon = DOM.btnSyncNow.querySelector('.app-icon');
    DOM.btnSyncNow.disabled = true;
    DOM.btnSyncNow.classList.add('saving');
    DOM.btnSyncNow.setAttribute('aria-busy', 'true');
    DOM.btnSyncNow.title = 'Refreshing the latest bookmarks and counts...';
    icon?.classList.add('icon-spin');

    try {
      const session = await checkServerConnection();
      if (!session?.authenticated || !AppState.isServerConnected) {
        throw new Error('Your session is no longer available.');
      }

      const bookmarks = await loadData();
      if (!bookmarks) throw new Error('The server could not return the latest bookmarks.');

      const counts = await refreshPlatformCounts();
      if (!counts) {
        showToast('Bookmarks refreshed, but counts could not be updated.', 'error');
      } else {
        showToast('Latest bookmarks and counts loaded from the server.', 'success');
      }
    } catch (error) {
      console.error('Server refresh failed:', error);
      showToast(error?.message || 'Could not refresh data from the server.', 'error');
    } finally {
      DOM.btnSyncNow.disabled = false;
      DOM.btnSyncNow.classList.remove('saving');
      DOM.btnSyncNow.removeAttribute('aria-busy');
      DOM.btnSyncNow.title = 'Refresh the latest bookmarks and counts from the server';
      icon?.classList.remove('icon-spin');
    }
  });
  DOM.btnExportJson.addEventListener('click', triggerManualDownload);



  // Analytics modal (sidebar item)
  const btnToggleStats = document.getElementById('btn-toggle-stats');
  const statsPanel = document.getElementById('stats-panel');
  const closeAnalytics = document.getElementById('close-analytics-modal');
  const closeAnalyticsModal = () => {
    if (!statsPanel) return;
    statsPanel.hidden = true;
    statsPanel.classList.remove('active');
    AppState.isAnalyticsOpen = false;
    const li = btnToggleStats?.closest('.menu-item');
    btnToggleStats?.classList.remove('active');
    li?.classList.remove('active');
    AppState.analyticsReturnFocus?.focus?.();
    AppState.analyticsReturnFocus = null;
  };
  if (btnToggleStats && statsPanel) {
    btnToggleStats.addEventListener('click', () => {
      const isOpen = !statsPanel.hidden;
      const li = btnToggleStats.closest('.menu-item');
      if (isOpen) {
        closeAnalyticsModal();
      } else {
        closeSettings();
        AppState.analyticsReturnFocus = btnToggleStats;
        statsPanel.hidden = false;
        statsPanel.classList.add('active');
        AppState.isAnalyticsOpen = true;
        btnToggleStats.classList.add('active');
        if (li) li.classList.add('active');
        updateStatsAnalytics();
        closeAnalytics?.focus();
      }
      // Close mobile drawer after activation
      const drawer = document.getElementById('mobile-drawer-overlay');
      if (drawer) drawer.classList.remove('active');
    });
  }
  closeAnalytics?.addEventListener('click', closeAnalyticsModal);
  statsPanel?.addEventListener('click', event => {
    if (event.target === statsPanel) closeAnalyticsModal();
  });
  document.addEventListener('keydown', event => {
    if (!AppState.isAnalyticsOpen || !statsPanel) return;
    if (event.key === 'Escape') {
      closeAnalyticsModal();
      return;
    }
    if (event.key === 'Tab') {
      const focusable = [...statsPanel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
        .filter(element => !element.disabled && !element.hidden && element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

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
    AppState.linkPreview = null;
    const previewStatus = document.getElementById('add-preview-status');
    if (previewStatus) { previewStatus.hidden = true; previewStatus.textContent = ''; }
    updateManualModalPlatformUI('');
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
    });
  }


  const addPlatformSelect = document.getElementById('add-platform');
  if (addPlatformSelect) {
    addPlatformSelect.addEventListener('change', () => {
      populateModalCategorySelect('', getCategoryContextFromPlatform(addPlatformSelect.value));
      updateManualModalPlatformUI(addPlatformSelect.value);
      if (addPlatformSelect.value === 'browser' && DOM.addUrl && DOM.addUrl.value.trim()) previewBrowserLink(DOM.addUrl.value.trim());
      else {
        AppState.linkPreview = null;
        const status = document.getElementById('add-preview-status');
        if (status) { status.hidden = true; status.textContent = ''; }
      }
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
      const isCustom = AppState.activeSource === 'social' && nextPlatform && !isKnownSocialPlatform(nextPlatform);
      const selectedValue = isCustom ? '__custom__' : nextPlatform;
      addPlatformSelect.value = selectedValue;
      updateManualModalPlatformUI(selectedValue);
      if (isCustom && DOM.addCustomPlatformName) DOM.addCustomPlatformName.value = platformLabel(nextPlatform);
      populateModalCategorySelect('', getCategoryContextFromPlatform(isCustom ? nextPlatform : selectedValue));
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

function initPrivateEventListeners() {
  const browserButton = document.getElementById('btn-browser-bookmarks');
  if (browserButton) browserButton.addEventListener('click', () => {
    closeSettings();
    AppState.activeSource = 'browser';
    AppState.activePlatform = 'all';
    AppState.activeCollection = 'all';
    AppState.nextCursor = null;
    setRouteHash('#bookmarks');
    updateSidebarNavigation();
    loadData();
  });

  const settingsButton = document.getElementById('btn-settings');
  if (settingsButton) settingsButton.addEventListener('click', () => { setRouteHash('#settings'); openSettings(); });
  const backButton = document.getElementById('btn-back-to-bookmarks');
  if (backButton) backButton.addEventListener('click', () => { setRouteHash('#bookmarks'); closeSettings(); });
  const more = document.getElementById('btn-load-more');
  if (more) more.addEventListener('click', () => loadData({ append: true }));

  const platformSelect = document.getElementById('add-platform');
  if (platformSelect && !platformSelect.querySelector('option[value=browser]')) {
    const option = document.createElement('option');
    option.value = 'browser';
    option.textContent = 'Browser Bookmark';
    platformSelect.appendChild(option);
  }
  initSidebarNewTabContextMenu();
  window.addEventListener('hashchange', () => applyRouteFromHash({ load: true }));
  if (DOM.btnAddBookmark) DOM.btnAddBookmark.addEventListener('click', () => {
    if (AppState.activeSource === 'browser' && platformSelect) {
      platformSelect.value = 'browser';
      AppState.linkPreview = null;
      populateModalCategorySelect('', getCategoryContextFromPlatform('browser'));
      updateManualModalPlatformUI('browser');
    }
  });
  if (DOM.addUrl) DOM.addUrl.addEventListener('blur', () => {
    if (platformSelect?.value === 'browser' && DOM.addUrl.value.trim()) previewBrowserLink(DOM.addUrl.value.trim());
  });
  if (DOM.addUrl) DOM.addUrl.addEventListener('input', () => {
    AppState.linkPreview = null;
    const status = document.getElementById('add-preview-status');
    if (status) { status.hidden = true; status.textContent = ''; }
  });
}

registerActions('events', { initEventListeners, checkMobileDrawerLayout, initPrivateEventListeners });
export { initEventListeners, checkMobileDrawerLayout, initPrivateEventListeners };
