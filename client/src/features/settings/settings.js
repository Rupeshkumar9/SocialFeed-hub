import { AppState, DOM, POSTS_PER_PAGE } from '../../app/state.js';
import { actions, registerActions } from '../../app/actions.js';
import { socialFeedApi } from '../../api/socialfeed-api.js';

const updateSidebarNavigation = (...args) => actions.updateSidebarNavigation(...args);
const cancelActiveLoad = (...args) => actions.cancelActiveLoad(...args);
const showToast = (...args) => actions.showToast(...args);
const loadPublicProfileSettings = (...args) => actions.loadPublicProfileSettings(...args);

async function refreshExtensionDevices() {
  const status = document.getElementById('extension-devices-status');
  const revokeButton = document.getElementById('btn-revoke-extension-devices');
  if (!status) return;
  try {
    const result = await socialFeedApi.getExtensionDevices();
    const count = Array.isArray(result.devices) ? result.devices.length : 0;
    status.textContent = count ? `${count} browser${count === 1 ? '' : 's'} connected` : 'No browsers connected';
    status.className = count ? 'integration-status connected' : 'integration-status';
    if (revokeButton) revokeButton.hidden = count === 0;
  } catch (error) {
    status.textContent = 'Connection status unavailable';
    status.className = 'integration-status error';
    if (revokeButton) revokeButton.hidden = true;
  }
}

function openSettings() {
  cancelActiveLoad();
  document.getElementById('mobile-drawer-overlay')?.classList.remove('active');
  AppState.isSettingsOpen = true;
  document.getElementById("feed-content").hidden = true;
  document.getElementById("settings-view").hidden = false;
  document.getElementById("settings-view").scrollTop = 0;
  updateSidebarNavigation();
  refreshExtensionDevices();
  loadPublicProfileSettings();
}

function closeSettings() {
  AppState.isSettingsOpen = false;
  document.getElementById("settings-view").hidden = true;
  document.getElementById("feed-content").hidden = false;
  updateSidebarNavigation();
}

registerActions('settings', { openSettings, closeSettings });

document.getElementById('btn-revoke-extension-devices')?.addEventListener('click', async () => {
  const button = document.getElementById('btn-revoke-extension-devices');
  if (!button) return;
  button.disabled = true;
  try {
    await socialFeedApi.revokeExtensionDevices();
    showToast('All browser extensions disconnected.', 'success');
    await refreshExtensionDevices();
  } catch (error) {
    showToast(error?.message || 'Unable to disconnect extensions.', 'error');
  } finally {
    button.disabled = false;
  }
});
export { openSettings, closeSettings };
