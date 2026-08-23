import { AppState, DOM, POSTS_PER_PAGE } from '../../app/state.js';
import { actions, registerActions } from '../../app/actions.js';
import { socialFeedApi } from '../../api/socialfeed-api.js';
import { AppState as DashboardState } from '../../app/state.js';

const updateSidebarNavigation = (...args) => actions.updateSidebarNavigation(...args);
const cancelActiveLoad = (...args) => actions.cancelActiveLoad(...args);
const showToast = (...args) => actions.showToast(...args);
const loadPublicProfileSettings = (...args) => actions.loadPublicProfileSettings(...args);
const logout = (...args) => actions.logout(...args);

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
  DashboardState.isSettingsOpen = true;
  DashboardState.isProfileEditOpen = false;
  DashboardState.isExtensionOpen = false;
  DashboardState.activeSource = 'browser';
  DashboardState.activePlatform = 'all';
  DashboardState.activeCollection = 'all';
  document.getElementById("feed-content").hidden = true;
  document.getElementById("settings-view").hidden = false;
  document.getElementById("profile-edit-view").hidden = true;
  document.getElementById("extension-view").hidden = true;
  document.getElementById("settings-view").scrollTop = 0;
  updateSidebarNavigation();
}

function closeSettings() {
  DashboardState.isSettingsOpen = false;
  document.getElementById("settings-view").hidden = true;
  if (!DashboardState.isProfileEditOpen) document.getElementById("feed-content").hidden = false;
  updateSidebarNavigation();
}

function openExtension() {
  cancelActiveLoad();
  document.getElementById('mobile-drawer-overlay')?.classList.remove('active');
  DashboardState.isSettingsOpen = false;
  DashboardState.isProfileEditOpen = false;
  DashboardState.isExtensionOpen = true;
  DashboardState.activeSource = 'browser';
  DashboardState.activePlatform = 'all';
  DashboardState.activeCollection = 'all';
  document.getElementById('feed-content').hidden = true;
  document.getElementById('settings-view').hidden = true;
  document.getElementById('profile-edit-view').hidden = true;
  document.getElementById('extension-view').hidden = false;
  document.getElementById('extension-view').scrollTop = 0;
  updateSidebarNavigation();
  refreshExtensionDevices();
}

function closeExtension() {
  DashboardState.isExtensionOpen = false;
  document.getElementById('extension-view').hidden = true;
  if (!DashboardState.isSettingsOpen && !DashboardState.isProfileEditOpen) document.getElementById('feed-content').hidden = false;
  updateSidebarNavigation();
}

function openProfileEdit() {
  cancelActiveLoad();
  document.getElementById('mobile-drawer-overlay')?.classList.remove('active');
  DashboardState.isSettingsOpen = false;
  DashboardState.isProfileEditOpen = true;
  DashboardState.isExtensionOpen = false;
  DashboardState.activeSource = 'browser';
  DashboardState.activePlatform = 'all';
  DashboardState.activeCollection = 'all';
  document.getElementById("feed-content").hidden = true;
  document.getElementById("settings-view").hidden = true;
  document.getElementById("extension-view").hidden = true;
  document.getElementById("profile-edit-view").hidden = false;
  document.getElementById("profile-edit-view").scrollTop = 0;
  updateSidebarNavigation();
  loadPublicProfileSettings();
}

function closeProfileEdit() {
  DashboardState.isProfileEditOpen = false;
  document.getElementById("profile-edit-view").hidden = true;
  document.getElementById("feed-content").hidden = false;
  updateSidebarNavigation();
}

function accountFieldValue(field) {
  const input = document.getElementById(`settings-profile-${field}-input`);
  const text = document.getElementById(`settings-profile-${field}`);
  return String(input && !input.hidden ? input.value : text?.textContent || '').trim();
}

function setAccountField(field, value) {
  const text = document.getElementById(`settings-profile-${field}`);
  const input = document.getElementById(`settings-profile-${field}-input`);
  if (text) text.textContent = value || (field === 'email' ? 'Private account' : 'SocialFeed Owner');
  if (input) input.value = value || '';
}

function setAccountFieldEditing(field, editing) {
  const text = document.getElementById(`settings-profile-${field}`);
  const input = document.getElementById(`settings-profile-${field}-input`);
  const button = document.getElementById(`btn-edit-account-${field}`);
  if (text) text.hidden = editing;
  if (input) input.hidden = !editing;
  if (button) {
    button.textContent = editing ? 'Save' : 'Edit';
    button.dataset.editing = editing ? 'true' : 'false';
  }
}

async function saveAccountDetails(field) {
  const button = document.getElementById(`btn-edit-account-${field}`);
  if (button) button.disabled = true;
  try {
    const profile = await socialFeedApi.updateAccountProfile({
      displayName: accountFieldValue('name'),
      email: accountFieldValue('email')
    });
    setAccountField('name', profile.profile?.displayName);
    setAccountField('email', profile.profile?.email);
    setAccountFieldEditing('name', false);
    setAccountFieldEditing('email', false);
    document.getElementById('dashboard-account-name').textContent = profile.profile?.displayName || 'SocialFeed Owner';
    showToast('Account details updated.', 'success');
  } catch (error) {
    showToast(error?.message || 'Unable to update account details.', 'error');
  } finally {
    if (button) button.disabled = false;
  }
}

document.getElementById('btn-edit-account-name')?.addEventListener('click', event => {
  const button = event.currentTarget;
  if (button.dataset.editing === 'true') saveAccountDetails('name');
  else setAccountFieldEditing('name', true);
});

document.getElementById('btn-edit-account-email')?.addEventListener('click', event => {
  const button = event.currentTarget;
  if (button.dataset.editing === 'true') saveAccountDetails('email');
  else setAccountFieldEditing('email', true);
});

document.getElementById('change-password-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const status = document.getElementById('change-password-status');
  const button = document.getElementById('btn-change-password');
  const currentPassword = document.getElementById('current-password').value;
  const newPassword = document.getElementById('new-password').value;
  const confirmPassword = document.getElementById('confirm-password').value;
  if (newPassword !== confirmPassword) {
    if (status) status.textContent = 'New passwords do not match.';
    return;
  }
  button.disabled = true;
  if (status) status.textContent = 'Updating…';
  try {
    await socialFeedApi.changePassword({ currentPassword, newPassword });
    form.reset();
    if (status) status.textContent = 'Password changed.';
    showToast('Password changed successfully.', 'success');
  } catch (error) {
    if (status) status.textContent = error?.message || 'Unable to change password.';
    showToast(error?.message || 'Unable to change password.', 'error');
  } finally {
    button.disabled = false;
  }
});

document.getElementById('btn-delete-account')?.addEventListener('click', async event => {
  const button = event.currentTarget;
  const expected = 'DELETE MY ACCOUNT';
  const typed = window.prompt(`This permanently deletes your account and all saved data. Type ${expected} to continue:`);
  if (typed !== expected) {
    if (typed !== null) showToast('Account deletion cancelled. The confirmation text did not match.', 'error');
    return;
  }
  if (!window.confirm('Are you absolutely sure you want to permanently delete your account?')) return;
  button.disabled = true;
  try {
    await socialFeedApi.deleteAccount(expected);
    showToast('Your account has been deleted.', 'success');
    await logout();
  } catch (error) {
    button.disabled = false;
    showToast(error?.message || 'Unable to delete account.', 'error');
  }
});

registerActions('settings', { openSettings, closeSettings, openExtension, closeExtension, openProfileEdit, closeProfileEdit });

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
export { openSettings, closeSettings, openExtension, closeExtension, openProfileEdit, closeProfileEdit, setAccountField };
