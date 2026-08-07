import { AppState, DOM, POSTS_PER_PAGE } from '../../app/state.js';
import { actions, registerActions } from '../../app/actions.js';

const refreshLocalMetadataAndCounts = (...args) => actions.refreshLocalMetadataAndCounts(...args);
const saveDataToServer = (...args) => actions.saveDataToServer(...args);
const showToast = (...args) => actions.showToast(...args);

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

registerActions('bookmark-selection', { deleteBookmark, toggleSelectBookmark, updateBulkSelectionUI, toggleSelectionMode, bulkDeleteSelected, bulkSelectAll, bulkDeselectAll });
export { deleteBookmark, toggleSelectBookmark, updateBulkSelectionUI, toggleSelectionMode, bulkDeleteSelected, bulkSelectAll, bulkDeselectAll };
