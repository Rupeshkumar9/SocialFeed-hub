import { AppState, DOM, POSTS_PER_PAGE } from '../../app/state.js';
import { actions, registerActions } from '../../app/actions.js';
import { BookmarksImporter } from './importer.js';

const applyFiltersAndSearch = (...args) => actions.applyFiltersAndSearch(...args);
const invalidateFeedCache = (...args) => actions.invalidateFeedCache(...args);
const processCollections = (...args) => actions.processCollections(...args);
const processTags = (...args) => actions.processTags(...args);
const refreshPlatformCounts = (...args) => actions.refreshPlatformCounts(...args);
const renderTagCloud = (...args) => actions.renderTagCloud(...args);
const showToast = (...args) => actions.showToast(...args);
const updateCollectionsFilterDropdown = (...args) => actions.updateCollectionsFilterDropdown(...args);
const updateSyncStatusUI = (...args) => actions.updateSyncStatusUI(...args);

function saveDataToServer() {
  if (!AppState.isServerConnected) {
    showToast('App is offline. Reconnect to save changes to the server.', 'error');
    return Promise.resolve(false);
  }

  const headers = { 'Content-Type': 'application/json' };

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
      invalidateFeedCache();
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

/** Download a complete, server-generated backup independent of feed filters. */
async function triggerManualDownload() {
  const button = DOM.btnExportJson;
  if (button) button.disabled = true;
  showToast('Preparing a complete MongoDB backup…');

  try {
    const response = await fetch('/api/export', {
      credentials: 'same-origin',
      cache: 'no-store'
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || `Backup failed (${response.status}).`);
    }

    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') || '';
    const fileName = disposition.match(/filename="?([^";]+)"?/i)?.[1] || `socialfeed-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const downloadUrl = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = downloadUrl;
    downloadAnchor.download = fileName;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(downloadUrl);
    showToast('Complete SocialFeed backup downloaded.', 'success');
  } catch (error) {
    console.error('Backup export failed:', error);
    showToast(error.message || 'Unable to export the backup.', 'error');
  } finally {
    if (button) button.disabled = false;
  }
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

registerActions('import-controller', { saveDataToServer, triggerManualDownload, handleFileImport });
export { saveDataToServer, triggerManualDownload, handleFileImport };
