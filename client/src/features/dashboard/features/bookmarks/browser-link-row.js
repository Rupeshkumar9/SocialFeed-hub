import { AppState } from '../../app/state.js';
import { actions, registerActions } from '../../app/actions.js';
import { socialFeedApi } from '../../api/socialfeed-api.js';

const escapeHTML = (...args) => actions.escapeHTML(...args);
const showToast = (...args) => actions.showToast(...args);
const renderFeedGrid = (...args) => actions.renderFeedGrid(...args);
const updateSidebarNavigation = (...args) => actions.updateSidebarNavigation(...args);
const openEditBookmarkModal = (...args) => actions.openEditBookmarkModal(...args);
const deleteBookmark = (...args) => actions.deleteBookmark(...args);

function hostFor(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'saved link'; }
}

function titleFor(bookmark) {
  return bookmark.publicTitle || bookmark.authorName || bookmark.siteName || bookmark.title || bookmark.content || hostFor(bookmark.url) || 'Untitled link';
}

function buildBrowserLinkRow(bookmark) {
  const row = document.createElement('article');
  row.className = 'bookmark-card browser-link-row';
  row.dataset.id = bookmark.id;
  const title = titleFor(bookmark);
  const host = hostFor(bookmark.url);
  const initial = title.trim().charAt(0).toUpperCase() || '↗';
  const favicon = bookmark.favicon || '';
  row.innerHTML = `
    <label class="browser-row-select" aria-label="Select ${escapeHTML(title)}"><input type="checkbox" class="card-checkbox" data-id="${escapeHTML(bookmark.id)}"><span></span></label>
    <button class="browser-row-main" type="button" aria-label="Open ${escapeHTML(title)}">
      <span class="browser-row-icon">${favicon ? `<img src="${escapeHTML(favicon)}" alt="" loading="lazy">` : ''}<span>${escapeHTML(initial)}</span></span>
      <span class="browser-row-copy"><strong>${escapeHTML(title)}</strong><small>${escapeHTML(host)}</small></span>
    </button>
    <span class="browser-row-meta">${bookmark.visibility === 'public' ? '<span class="browser-visibility-badge public">Public</span>' : '<span class="browser-visibility-badge">Private</span>'}${bookmark.featured ? '<span class="browser-featured" title="Featured publicly">★</span>' : ''}</span>
    <div class="card-menu-container browser-row-menu-container">
      <button class="btn-card-menu browser-row-menu" type="button" title="Actions" aria-label="Link actions" aria-haspopup="menu" aria-expanded="false"><i class="app-icon icon-ellipsis-vertical"></i></button>
      <div class="card-menu-dropdown browser-row-actions" role="menu">
        <button type="button" class="menu-item-edit" data-action="edit"><i class="app-icon icon-pen"></i> Edit</button>
        <button type="button" class="menu-item-visibility" data-action="visibility"><i class="app-icon icon-${bookmark.visibility === 'public' ? 'lock' : 'globe'}"></i> ${bookmark.visibility === 'public' ? 'Make private' : 'Publish to profile'}</button>
        <button type="button" data-action="copy"><i class="app-icon icon-copy"></i> Copy link</button>
        <button type="button" data-action="featured"><i class="app-icon icon-bookmark"></i> ${bookmark.featured ? 'Remove featured' : 'Feature publicly'}</button>
        <button type="button" class="menu-item-delete" data-action="delete"><i class="app-icon icon-trash"></i> Delete</button>
      </div>
    </div>`;

  const image = row.querySelector('img');
  image?.addEventListener('error', () => { image.hidden = true; row.querySelector('.browser-row-icon span').hidden = false; }, { once: true });
  row.querySelector('.browser-row-icon span').hidden = !(!bookmark.favicon || !image);
  row.querySelector('.browser-row-main').addEventListener('click', () => {
    if (AppState.isSelectionMode) {
      const checkbox = row.querySelector('.card-checkbox');
      checkbox.checked = !checkbox.checked;
      actions.toggleSelectBookmark(bookmark.id, checkbox.checked);
      return;
    }
    window.open(bookmark.url, '_blank', 'noopener,noreferrer');
  });
  const checkbox = row.querySelector('.card-checkbox');
  checkbox.addEventListener('click', event => event.stopPropagation());
  checkbox.addEventListener('change', () => {
    if (!AppState.isSelectionMode) {
      checkbox.checked = false;
      return;
    }
    actions.toggleSelectBookmark(bookmark.id, checkbox.checked);
  });
  const menuButton = row.querySelector('.browser-row-menu');
  const menu = row.querySelector('.browser-row-actions');
  menuButton.addEventListener('click', event => {
    event.stopPropagation();
    document.querySelectorAll('.browser-row-actions.active').forEach(openMenu => {
      if (openMenu !== menu) {
        openMenu.classList.remove('active');
        openMenu.closest('.browser-link-row')?.classList.remove('menu-open');
        openMenu.closest('.browser-link-row')?.querySelector('.browser-row-menu')?.setAttribute('aria-expanded', 'false');
      }
    });
    const willOpen = !menu.classList.contains('active');
    menu.classList.toggle('active', willOpen);
    row.classList.toggle('menu-open', willOpen);
    menuButton.setAttribute('aria-expanded', String(willOpen));
  });
  menu.addEventListener('click', async event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    event.stopPropagation();
    const action = button.dataset.action;
    try {
      if (action === 'copy') {
        await navigator.clipboard.writeText(bookmark.url);
        showToast('Link copied.', 'success');
      } else if (action === 'edit') {
        openEditBookmarkModal(bookmark);
      } else if (action === 'delete') {
        if (confirm('Are you sure you want to permanently delete this bookmark?')) deleteBookmark(bookmark.id);
      } else if (action === 'visibility') {
        const visibility = bookmark.visibility === 'public' ? 'private' : 'public';
        await socialFeedApi.updateBookmarkVisibility({ ids: [bookmark.id], visibility });
        bookmark.visibility = visibility;
        showToast(visibility === 'public' ? 'Link published to your profile.' : 'Link made private.', 'success');
        renderFeedGrid(); updateSidebarNavigation();
      } else if (action === 'featured') {
        const featured = !bookmark.featured;
        const visibility = featured ? 'public' : bookmark.visibility;
        await socialFeedApi.updateBookmarkVisibility({ ids: [bookmark.id], visibility, featured });
        bookmark.visibility = visibility;
        bookmark.featured = featured;
        showToast(featured ? 'Link published and featured publicly.' : 'Link removed from featured.', 'success');
        renderFeedGrid(); updateSidebarNavigation();
      }
    } catch (error) { showToast(error?.message || 'Unable to update link.', 'error'); }
    menu.classList.remove('active');
    menuButton.setAttribute('aria-expanded', 'false');
    row.classList.remove('menu-open');
  });
  return row;
}

registerActions('browser-link-row', { buildBrowserLinkRow });
export { buildBrowserLinkRow };
