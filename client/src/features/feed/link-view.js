import { AppState, DOM } from '../../app/state.js';
import { actions, registerActions } from '../../app/actions.js';

const escapeHTML = (...args) => actions.escapeHTML(...args);
const showToast = (...args) => actions.showToast(...args);

let returnFocusElement = null;
let renderedLinks = [];

function currentLinks() {
  const seen = new Set();
  return (AppState.filteredBookmarks || [])
    .map(bookmark => String(bookmark?.url || '').trim())
    .filter(url => {
      if (!url || seen.has(url)) return false;
      seen.add(url);
      return true;
    });
}

function currentViewLabel() {
  const title = DOM.feedTitle?.textContent?.trim();
  return title || (AppState.activeSource === 'browser' ? 'Browser Bookmarks' : 'All Social Bookmarks');
}

async function copyText(value) {
  const text = String(value || '');
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the compatibility copy path.
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  textarea.remove();
  return copied;
}

function renderLinks() {
  if (!DOM.linkViewList) return;
  renderedLinks = currentLinks();
  DOM.linkViewList.replaceChildren();
  DOM.linkViewCount.textContent = `${renderedLinks.length} link${renderedLinks.length === 1 ? '' : 's'}`;
  DOM.linkViewModalSubtitle.textContent = `${currentViewLabel()} · ${renderedLinks.length} loaded link${renderedLinks.length === 1 ? '' : 's'}`;
  DOM.linkViewEmpty.hidden = renderedLinks.length > 0;
  DOM.btnCopyAllLinks.disabled = renderedLinks.length === 0;

  const fragment = document.createDocumentFragment();
  renderedLinks.forEach((url, index) => {
    const item = document.createElement('li');
    item.className = 'link-view-item';
    item.innerHTML = `
      <span class="link-view-index" aria-hidden="true">${index + 1}</span>
      <code class="link-view-url" title="${escapeHTML(url)}">${escapeHTML(url)}</code>
      <button class="link-view-copy" type="button" data-link-copy-index="${index}" aria-label="Copy link ${index + 1}">Copy</button>
    `;
    item.querySelector('[data-link-copy-index]')?.addEventListener('click', async () => {
      const copied = await copyText(url);
      showToast(copied ? 'Link copied.' : 'Unable to copy this link.', copied ? 'success' : 'error');
    });
    fragment.appendChild(item);
  });
  DOM.linkViewList.appendChild(fragment);
}

function closeLinkViewModal() {
  if (!DOM.linkViewModalOverlay) return;
  DOM.linkViewModalOverlay.classList.remove('active');
  DOM.linkViewModalOverlay.hidden = true;
  returnFocusElement?.focus?.();
  returnFocusElement = null;
}

function openLinkViewModal() {
  if (!DOM.linkViewModalOverlay) return;
  renderLinks();
  returnFocusElement = document.getElementById('toolbar-layout-btn');
  DOM.linkViewModalOverlay.hidden = false;
  DOM.linkViewModalOverlay.classList.add('active');
  DOM.closeLinkViewModal?.focus();
}

DOM.closeLinkViewModal?.addEventListener('click', closeLinkViewModal);
DOM.linkViewModalOverlay?.addEventListener('click', event => {
  if (event.target === DOM.linkViewModalOverlay) closeLinkViewModal();
});
DOM.btnCopyAllLinks?.addEventListener('click', async () => {
  const copied = await copyText(renderedLinks.join('\n'));
  showToast(copied ? `${renderedLinks.length} links copied.` : 'Unable to copy the links.', copied ? 'success' : 'error');
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && DOM.linkViewModalOverlay?.classList.contains('active')) {
    event.preventDefault();
    closeLinkViewModal();
  }
});

registerActions('link-view', { closeLinkViewModal, openLinkViewModal });
export { closeLinkViewModal, openLinkViewModal };
