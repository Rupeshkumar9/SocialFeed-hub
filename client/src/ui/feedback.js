import { AppState, DOM, POSTS_PER_PAGE } from '../app/state.js';
import { actions, registerActions } from '../app/actions.js';

const checkDatabaseConnection = (...args) => actions.checkDatabaseConnection(...args);
const loadData = (...args) => actions.loadData(...args);
const refreshPlatformCounts = (...args) => actions.refreshPlatformCounts(...args);

function updateSyncStatusUI(connected, label) {
  if (!DOM.syncBtn || !DOM.syncDot || !DOM.syncStatusText) return;
  DOM.syncBtn.classList.remove('saving', 'offline');
  DOM.syncBtn.dataset.status = connected ? 'connected' : 'offline';
  DOM.syncDot.classList.toggle('offline', !connected);
  DOM.syncDot.classList.toggle('connected', connected);
  if (connected) {
    DOM.syncStatusText.textContent = label || 'Server Connected';
    DOM.syncBtn.title = 'Server and database connected. Click for status details.';
    DOM.syncBtn.setAttribute('aria-label', 'Server and database connected. Click for status details.');
    DOM.syncDot.title = 'connected';
  } else {
    DOM.syncStatusText.textContent = label || 'Server Offline';
    DOM.syncBtn.title = 'Server or database unavailable. Click for status details.';
    DOM.syncBtn.setAttribute('aria-label', 'Server or database unavailable. Click for status details.');
    DOM.syncDot.title = 'disconnected';
    DOM.syncBtn.classList.add('offline');
  }
}

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

function ensureDatabaseBanner() {
  let banner = document.getElementById('database-status-banner');
  if (banner) return banner;
  banner = document.createElement('section');
  banner.id = 'database-status-banner';
  banner.className = 'database-status-banner';
  banner.hidden = true;
  banner.setAttribute('role', 'status');
  banner.innerHTML = '<div><strong>Database not connected</strong><span id="database-status-message">Bookmarks could not be loaded.</span></div><button type="button" id="btn-retry-database" class="btn-secondary">Retry connection</button>';
  const panel = document.getElementById('main-panel');
  if (panel) panel.prepend(banner);
  banner.querySelector('#btn-retry-database')?.addEventListener('click', async () => {
    const retryButton = banner.querySelector('#btn-retry-database');
    retryButton.disabled = true;
    await Promise.allSettled([checkDatabaseConnection(), loadData(), refreshPlatformCounts()]);
    retryButton.disabled = false;
  });
  return banner;
}

function setDatabaseStatus(connected, message = '') {
  AppState.databaseConnected = connected;
  const banner = ensureDatabaseBanner();
  banner.hidden = connected !== false;
  const messageNode = banner.querySelector('#database-status-message');
  if (messageNode) messageNode.textContent = message || 'You are signed in, but bookmarks could not be loaded. Check the database connection and try again.';
  const writeControls = ['btn-add-bookmark', 'action-import', 'btn-select-mode', 'btn-bulk-edit', 'btn-bulk-delete'];
  writeControls.forEach(id => {
    const element = document.getElementById(id);
    if (!element) return;
    element.disabled = connected === false;
    if (connected === false) element.title = 'Database connection is required for this action.';
  });
  updateSyncStatusUI(connected !== false, connected === false ? 'Database Offline' : undefined);
}

registerActions('feedback', { updateSyncStatusUI, showToast, ensureDatabaseBanner, setDatabaseStatus });
export { updateSyncStatusUI, showToast, ensureDatabaseBanner, setDatabaseStatus };
