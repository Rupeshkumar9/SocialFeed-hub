import { AppState, DOM, POSTS_PER_PAGE } from '../../app/state.js';
import { actions, registerActions } from '../../app/actions.js';

const updateSidebarNavigation = (...args) => actions.updateSidebarNavigation(...args);
const cancelActiveLoad = (...args) => actions.cancelActiveLoad(...args);

function openSettings() {
  cancelActiveLoad();
  AppState.isSettingsOpen = true;
  document.getElementById("feed-content").hidden = true;
  document.getElementById("settings-view").hidden = false;
  document.getElementById("settings-view").scrollTop = 0;
  updateSidebarNavigation();
}

function closeSettings() {
  AppState.isSettingsOpen = false;
  document.getElementById("settings-view").hidden = true;
  document.getElementById("feed-content").hidden = false;
  updateSidebarNavigation();
}

registerActions('settings', { openSettings, closeSettings });
export { openSettings, closeSettings };
