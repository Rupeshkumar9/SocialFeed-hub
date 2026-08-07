import { AppState, DOM, POSTS_PER_PAGE } from '../../app/state.js';
import { actions, registerActions } from '../../app/actions.js';

const applyFiltersAndSearch = (...args) => actions.applyFiltersAndSearch(...args);
const defaultAuthorNameForPlatform = (...args) => actions.defaultAuthorNameForPlatform(...args);
const escapeHTML = (...args) => actions.escapeHTML(...args);
const getCategoryContextFromPlatform = (...args) => actions.getCategoryContextFromPlatform(...args);
const getCategoryCountsForContext = (...args) => actions.getCategoryCountsForContext(...args);
const getCategoryDefaultLabel = (...args) => actions.getCategoryDefaultLabel(...args);
const normalizeCollectionKey = (...args) => actions.normalizeCollectionKey(...args);
const platformIconMarkup = (...args) => actions.platformIconMarkup(...args);
const processCollections = (...args) => actions.processCollections(...args);
const refreshLocalMetadataAndCounts = (...args) => actions.refreshLocalMetadataAndCounts(...args);
const saveDataToServer = (...args) => actions.saveDataToServer(...args);
const setManualImageFieldVisible = (...args) => actions.setManualImageFieldVisible(...args);
const showToast = (...args) => actions.showToast(...args);
const sortedCategoryItemsFromCounts = (...args) => actions.sortedCategoryItemsFromCounts(...args);
const toggleSelectionMode = (...args) => actions.toggleSelectionMode(...args);
const updateCategoryEditButtonVisibility = (...args) => actions.updateCategoryEditButtonVisibility(...args);
const updateCollectionsFilterDropdown = (...args) => actions.updateCollectionsFilterDropdown(...args);
const updateManualModalPlatformUI = (...args) => actions.updateManualModalPlatformUI(...args);

let currentPostModalBookmarkId = null;

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

registerActions('bookmark-editor', { saveBookmarkNotes, saveBookmarkFolder, handleManualBookmarkSubmit, populateModalCategorySelect, cleanPostContent, formatConciseDate, openPostModal, saveModalNoteAndClose, openBulkEditModal, handleBulkEditSubmit, openEditBookmarkModal, previewBrowserLink, saveBrowserBookmark });
export { saveBookmarkNotes, saveBookmarkFolder, handleManualBookmarkSubmit, populateModalCategorySelect, cleanPostContent, formatConciseDate, openPostModal, saveModalNoteAndClose, openBulkEditModal, handleBulkEditSubmit, openEditBookmarkModal, previewBrowserLink, saveBrowserBookmark };
