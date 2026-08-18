import { AppState } from '../../app/state.js';
import { actions, registerActions } from '../../app/actions.js';
import { socialFeedApi } from '../../api/socialfeed-api.js';

const showToast = (...args) => actions.showToast(...args);
const loadData = (...args) => actions.loadData(...args);
const invalidateFeedCache = (...args) => actions.invalidateFeedCache(...args);
const refreshPlatformCounts = (...args) => actions.refreshPlatformCounts(...args);
const updateSidebarNavigation = (...args) => actions.updateSidebarNavigation(...args);
const updateStatsAnalytics = (...args) => actions.updateStatsAnalytics(...args);

let dialog;
let returnFocus;
let context;

function ensureDialog() {
  if (dialog) return dialog;
  dialog = document.createElement('div');
  dialog.className = 'modal-overlay category-rename-overlay';
  dialog.hidden = true;
  dialog.innerHTML = `
    <div class="modal-box category-rename-box" role="dialog" aria-modal="true" aria-labelledby="category-rename-title">
      <div class="modal-header">
        <h3 id="category-rename-title">Rename category</h3>
        <button type="button" class="close-btn" data-category-rename-cancel aria-label="Close rename dialog"><i class="app-icon icon-xmark"></i></button>
      </div>
      <form class="category-rename-form">
        <p class="category-rename-description" id="category-rename-description"></p>
        <label for="category-rename-input">New category name</label>
        <input id="category-rename-input" type="text" maxlength="80" required autocomplete="off">
        <div class="category-rename-actions">
          <button type="button" class="btn-secondary" data-category-rename-cancel>Cancel</button>
          <button type="submit" class="btn-primary">Rename</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(dialog);
  const form = dialog.querySelector('.category-rename-form');
  form.addEventListener('submit', submitRename);
  dialog.querySelectorAll('[data-category-rename-cancel]').forEach(button => button.addEventListener('click', closeDialog));
  dialog.addEventListener('click', event => { if (event.target === dialog) closeDialog(); });
  return dialog;
}

function closeDialog() {
  if (!dialog) return;
  dialog.hidden = true;
  dialog.classList.remove('active');
  returnFocus?.focus?.();
  returnFocus = null;
  context = null;
}

async function submitRename(event) {
  event.preventDefault();
  const input = dialog.querySelector('#category-rename-input');
  const submit = dialog.querySelector('button[type="submit"]');
  const newName = input.value.trim().replace(/\s+/g, ' ');
  if (!newName || !context) return;
  submit.disabled = true;
  try {
    await socialFeedApi.renameCategory({ ...context, newName });
    const completed = { ...context };
    const source = completed.source;
    AppState.activeCollection = source === 'social' ? newName : 'all';
    AppState.nextCursor = null;
    closeDialog();
    invalidateFeedCache();
    await Promise.allSettled([refreshPlatformCounts(), loadData()]);
    updateSidebarNavigation();
    updateStatsAnalytics();
    showToast(`Renamed “${completed.oldName}” to “${newName}”.`, 'success');
  } catch (error) {
    showToast(error.message || 'Could not rename category.', 'error');
  } finally {
    submit.disabled = false;
  }
}

function openCategoryRenameDialog(nextContext = {}) {
  const oldName = String(nextContext.oldName || '').trim();
  const source = nextContext.source === 'browser' ? 'browser' : 'social';
  const platform = String(nextContext.platform || '').trim().toLowerCase();
  if (!oldName || oldName.toLowerCase() === 'uncategorized' || oldName.toLowerCase() === 'general links') {
    showToast('This category cannot be renamed.', 'error');
    return;
  }
  context = { source, platform, oldName };
  returnFocus = document.activeElement;
  const modal = ensureDialog();
  modal.querySelector('#category-rename-description').textContent = `Rename “${oldName}”${source === 'social' ? ` in ${platform}` : ''}.`;
  const input = modal.querySelector('#category-rename-input');
  input.value = oldName;
  modal.hidden = false;
  modal.classList.add('active');
  requestAnimationFrame(() => { input.focus(); input.select(); });
}

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && dialog && !dialog.hidden) closeDialog();
});

registerActions('category-rename', { openCategoryRenameDialog });
export { openCategoryRenameDialog };
