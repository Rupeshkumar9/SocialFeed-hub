import { AppState, DOM, POSTS_PER_PAGE } from '../../app/state.js';
import { actions, registerActions } from '../../app/actions.js';

const browserCategoryLabel = (...args) => actions.browserCategoryLabel(...args);
const cleanPostContent = (...args) => actions.cleanPostContent(...args);
const deleteBookmark = (...args) => actions.deleteBookmark(...args);
const escapeHTML = (...args) => actions.escapeHTML(...args);
const getInstagramFallbackGradient = (...args) => actions.getInstagramFallbackGradient(...args);
const openEditBookmarkModal = (...args) => actions.openEditBookmarkModal(...args);
const openPostModal = (...args) => actions.openPostModal(...args);
const platformIconMarkup = (...args) => actions.platformIconMarkup(...args);
const socialCategoryLabel = (...args) => actions.socialCategoryLabel(...args);
const toggleSelectBookmark = (...args) => actions.toggleSelectBookmark(...args);

function buildCardElement(bm) {
  const card = document.createElement('div');
  const platformClass = bm.platform === 'instagram' ? 'ig-post instagram-post' : `${bm.platform}-post`;
  card.className = `bookmark-card ${platformClass}`;
  card.setAttribute('data-id', bm.id);

  const initials = bm.authorName ? bm.authorName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '?';

  // Build tags markup (limit to 3 visible, only real hashtags)
  let tagsMarkup = '';
  const bmHashtags = bm.hashtags || [];
  if (bmHashtags.length > 0) {
    const visibleTags = bmHashtags.slice(0, 3);
    tagsMarkup = visibleTags.map(t => `<span class="card-tag">#${t}</span>`).join('');
    if (bmHashtags.length > 3) {
      tagsMarkup += `<span class="card-tag" style="opacity:0.5;">+${bmHashtags.length - 3}</span>`;
    }
  }

  // Action Buttons and Notes markup
  const notesVal = bm.notes || '';
  const notesMarkup = `
    <div class="card-actions-row">
      <button type="button" class="btn-card-action btn-read-post" data-id="${bm.id}">
        Read full post <i class="fa-solid fa-chevron-down" style="font-size: 0.7rem; margin-left: 2px;"></i>
      </button>
      <button type="button" class="btn-card-action btn-add-note" data-id="${bm.id}">
        <i class="fa-solid fa-file-pen" style="font-size: 0.85rem; margin-right: 2px;"></i> ${notesVal ? 'Edit Note' : 'Add Note'}
      </button>
    </div>
    ${notesVal ? `<div class="card-notes-display" style="margin-top: 8px;"><i class="fa-solid fa-note-sticky"></i> ${escapeHTML(notesVal)}</div>` : ''}
  `;

  let folderVal = bm.source === "browser" ? browserCategoryLabel(bm.folder) : socialCategoryLabel(bm.folder);
  const folderMarkup = bm.source === "browser" ? "" : "\n    <div class=\"card-category-container\">" +
    "\n      <button type=\"button\" class=\"btn-card-category\" title=\"Show category\" aria-expanded=\"false\">" +
    "\n        <i class=\"fa-solid fa-folder\"></i>" +
    "\n      </button>" +
    "\n      <div class=\"card-category-popover\" role=\"status\">" +
    "\n        <span>Category</span>" +
    "\n        <strong>" + escapeHTML(folderVal) + "</strong>" +
    "\n      </div>" +
    "\n    </div>";


  // Build visual card-media
  let mediaMarkup = '';
  const isBrowserBookmark = bm.source === 'browser' || bm.platform === 'browser';
  if (isBrowserBookmark) {
    if (bm.thumbnail) {
      mediaMarkup = `
        <div class="card-media browser-card-media">
          <img src="${escapeHTML(bm.thumbnail)}" alt="Saved Link Preview" loading="lazy" data-image-fallback="browser">
        </div>
      `;
    } else {
      mediaMarkup = `
        <div class="card-media fallback-media browser-fallback">
          <div class="fallback-gradient">
            ${platformIconMarkup("browser", "fallback-inline-icon")}
            <span class="fallback-title">Saved Link</span>
            <span class="fallback-subtitle">Click to Open</span>
          </div>
        </div>
      `;
    }
  } else if (bm.platform === 'instagram') {
    if (bm.thumbnail) {
      mediaMarkup = `
        <div class="card-media">
          <img src="${escapeHTML(bm.thumbnail)}" alt="Instagram Post" loading="lazy" data-image-fallback="instagram">
        </div>
      `;
    } else {
      const bgGradient = getInstagramFallbackGradient(bm.id);
      const isReel = bm.url && bm.url.includes('/reel/');
      mediaMarkup = `
        <div class="card-media fallback-media" style="background: ${bgGradient};">
          <div class="fallback-gradient">
            <i class="fa-brands fa-instagram fallback-icon"></i>
            <span class="fallback-title">${isReel ? 'Instagram Reel' : 'Instagram Post'}</span>
            <span class="fallback-subtitle">Click to View</span>
          </div>
        </div>
      `;
    }
  } else if (bm.platform === 'x') {
    if (bm.thumbnail) {
      mediaMarkup = `
        <div class="card-media">
          <img src="${escapeHTML(bm.thumbnail)}" alt="X Post" loading="lazy" data-image-fallback="x">
        </div>
      `;
    } else {
      mediaMarkup = `
        <div class="card-media fallback-media" style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-color: rgba(255,255,255,0.05);">
          <div class="fallback-gradient" style="color: #f8fafc;">
            ${platformIconMarkup("x", "fallback-inline-icon")}
            <span class="fallback-title" style="color: #f8fafc;">X Post</span>
            <span class="fallback-subtitle" style="color: #cbd5e1;">Click to View</span>
          </div>
        </div>
      `;
    }
  } else if (bm.platform === 'threads') {
    if (bm.thumbnail) {
      mediaMarkup = `
        <div class="card-media">
          <img src="${escapeHTML(bm.thumbnail)}" alt="Threads Post" loading="lazy" data-image-fallback="threads">
        </div>
      `;
    } else {
      mediaMarkup = `
        <div class="card-media fallback-media" style="background: linear-gradient(135deg, #262626 0%, #000000 100%); border-color: rgba(255,255,255,0.05);">
          <div class="fallback-gradient" style="color: #f8fafc;">
            ${platformIconMarkup("threads", "fallback-inline-icon")}
            <span class="fallback-title" style="color: #f8fafc;">Threads Post</span>
            <span class="fallback-subtitle" style="color: #cbd5e1;">Click to View</span>
          </div>
        </div>
      `;
    }
  } else if (bm.platform === 'reddit') {
    if (bm.thumbnail) {
      mediaMarkup = `
        <div class="card-media">
          <img src="${escapeHTML(bm.thumbnail)}" alt="Reddit Post" loading="lazy" data-image-fallback="reddit">
        </div>
      `;
    } else {
      mediaMarkup = `
        <div class="card-media fallback-media reddit-fallback">
          <div class="fallback-gradient" style="color: #ff4500;">
            <i class="fa-brands fa-reddit-alien fallback-icon" style="background: none; -webkit-text-fill-color: #ff4500; color: #ff4500; font-size: 1.4rem; opacity: 0.9;"></i>
            <span class="fallback-title" style="color: var(--text-primary);">Reddit Post</span>
            <span class="fallback-subtitle" style="color: var(--text-muted);">Click to View</span>
          </div>
        </div>
      `;
    }
  } else if (bm.platform === 'facebook') {
    if (bm.thumbnail) {
      mediaMarkup = `
        <div class="card-media">
          <img src="${escapeHTML(bm.thumbnail)}" alt="Facebook Post" loading="lazy" data-image-fallback="facebook">
        </div>
      `;
    } else {
      mediaMarkup = `
        <div class="card-media fallback-media" style="background: linear-gradient(135deg, #e7f3ff 0%, #cbd5e1 100%);">
          <div class="fallback-gradient" style="color: var(--platform-fb);">
            <i class="fa-brands fa-facebook fallback-icon" style="background: none; -webkit-text-fill-color: var(--platform-fb); color: var(--platform-fb); font-size: 1.4rem; opacity: 0.85;"></i>
            <span class="fallback-title" style="color: var(--text-primary);">Facebook Post</span>
            <span class="fallback-subtitle" style="color: var(--text-muted);">Click to View</span>
          </div>
        </div>
      `;
    }
  }

  const checkboxMarkup = `
    <div class="card-checkbox-container">
      <input type="checkbox" class="card-checkbox" data-id="${bm.id}" ${AppState.selectedIds.has(bm.id) ? 'checked' : ''}>
    </div>
  `;

  card.innerHTML = `
    <div class="card-header">
      ${checkboxMarkup}
      <div class="card-author-info">
        <div class="author-avatar">${initials}</div>
        <div class="author-names">
          <span class="author-name">${escapeHTML(bm.authorName || 'Social Post')}</span>
          <span class="author-username">@${escapeHTML(bm.authorUsername || 'user')}</span>
        </div>
      </div>
      <div class="card-header-actions">
        ${folderMarkup}
        
        <div class="card-menu-container">
          <button class="btn-card-menu" title="Actions">
            <i class="fa-solid fa-ellipsis-vertical"></i>
          </button>
          <div class="card-menu-dropdown">
            <button class="menu-item-edit"><i class="fa-solid fa-pen"></i> Edit</button>
            <button class="menu-item-delete"><i class="fa-solid fa-trash"></i> Delete</button>
          </div>
        </div>

        <div class="card-platform-icon" title="Original Platform: ${(bm.platform || "web").toUpperCase()}">
          ${platformIconMarkup(bm.platform)}
        </div>
      </div>
    </div>
    
    <div class="card-body">
      <div class="post-quote-icon"><i class="fa-solid fa-quote-left"></i></div>
      ${(() => {
      const contentVal = cleanPostContent(bm.content, bm.platform) || 'Saved Post details';
      const words = contentVal.split(/\s+/);
      const hasMore = words.length > 50;
      const summaryText = hasMore ? words.slice(0, 50).join(' ') + '...' : contentVal;
      return `<div class="post-content">${escapeHTML(summaryText)}</div>`;
    })()}
      ${mediaMarkup}
      ${notesMarkup}
    </div>
    
    <div class="card-footer">
      ${tagsMarkup}
    </div>
  `;

  card.querySelectorAll('img[data-image-fallback]').forEach((image) => {
    const fallbackPlatform = image.dataset.imageFallback;
    image.addEventListener('error', () => handleImageError(image, bm.id, fallbackPlatform), { once: true });
  });

  // Attach handlers
  const readBtn = card.querySelector('.btn-read-post');
  if (bm.source === 'browser' && readBtn) readBtn.remove();
  if (readBtn) {
    readBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openPostModal(bm.id, false);
    });
  }

  const addNoteBtn = card.querySelector('.btn-add-note');
  if (addNoteBtn) {
    addNoteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openPostModal(bm.id, true);
    });
  }



  // Category icon popover binding
  const categoryBtn = card.querySelector('.btn-card-category');
  const categoryPopover = card.querySelector('.card-category-popover');
  if (categoryBtn && categoryPopover) {
    categoryBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.card-category-popover.active').forEach(el => {
        if (el !== categoryPopover) el.classList.remove('active');
      });
      document.querySelectorAll('.card-menu-dropdown.active').forEach(el => el.classList.remove('active'));
      const willOpen = !categoryPopover.classList.contains('active');
      categoryPopover.classList.toggle('active', willOpen);
      categoryBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });
  }

  // Three-dots dropdown bindings
  const menuBtn = card.querySelector('.btn-card-menu');
  const dropdown = card.querySelector('.card-menu-dropdown');

  if (menuBtn && dropdown) {
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.card-menu-dropdown.active').forEach(el => {
        if (el !== dropdown) el.classList.remove('active');
      });
      dropdown.classList.toggle('active');
    });

    const editBtn = card.querySelector('.menu-item-edit');
    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.remove('active');
        openEditBookmarkModal(bm);
      });
    }

    const deleteBtn = card.querySelector('.menu-item-delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.remove('active');
        if (confirm("Are you sure you want to permanently delete this bookmark?")) {
          deleteBookmark(bm.id);
        }
      });
    }
  }

  // Checkbox select bindings
  const checkbox = card.querySelector('.card-checkbox');
  if (checkbox) {
    checkbox.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSelectBookmark(bm.id, checkbox.checked);
    });
  }

  // Redirect to platform post or select card in selection mode
  card.addEventListener('click', (e) => {
    if (e.target.closest('.card-notes-edit') || e.target.closest('.card-folder-area') || e.target.closest('.card-category-container') || e.target.closest('.card-menu-container') || e.target.closest('.card-checkbox-container')) return;

    if (AppState.isSelectionMode) {
      const cb = card.querySelector('.card-checkbox');
      if (cb) {
        cb.checked = !cb.checked;
        toggleSelectBookmark(bm.id, cb.checked);
      }
    } else {
      window.open(bm.url, '_blank');
    }
  });

  return card;
}

/**
 * Render the Infinite Scroll Sentinel and status at the bottom of the feed
 */

function handleImageError(img, id, platform) {
  const container = img.parentNode;
  if (!container) return;

  container.className = 'card-media fallback-media';
  if (platform === 'x') {
    container.style.background = 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)';
    container.style.borderColor = 'rgba(255,255,255,0.05)';
    container.innerHTML = `
      <div class="fallback-gradient" style="color: #f8fafc;">
        <i class="fa-brands fa-x-twitter fallback-icon" style="background: none; -webkit-text-fill-color: #f8fafc; color: #f8fafc; font-size: 1.4rem; opacity: 0.85;"></i>
        <span class="fallback-title" style="color: #f8fafc;">X Post</span>
        <span class="fallback-subtitle" style="color: #cbd5e1;">Click to View</span>
      </div>
    `;
  } else if (platform === 'threads') {
    container.style.background = 'linear-gradient(135deg, #262626 0%, #000000 100%)';
    container.style.borderColor = 'rgba(255,255,255,0.05)';
    container.innerHTML = `
      <div class="fallback-gradient" style="color: #f8fafc;">
        <i class="fa-brands fa-threads fallback-icon" style="background: none; -webkit-text-fill-color: #f8fafc; color: #f8fafc; font-size: 1.4rem; opacity: 0.85;"></i>
        <span class="fallback-title" style="color: #f8fafc;">Threads Post</span>
        <span class="fallback-subtitle" style="color: #cbd5e1;">Click to View</span>
      </div>
    `;
  } else if (platform === 'facebook') {
    container.style.background = 'linear-gradient(135deg, #e7f3ff 0%, #cbd5e1 100%)';
    container.innerHTML = `
      <div class="fallback-gradient" style="color: var(--platform-fb);">
        <i class="fa-brands fa-facebook fallback-icon" style="background: none; -webkit-text-fill-color: var(--platform-fb); color: var(--platform-fb); font-size: 1.4rem; opacity: 0.85;"></i>
        <span class="fallback-title" style="color: var(--text-primary);">Facebook Post</span>
        <span class="fallback-subtitle" style="color: var(--text-muted);">Click to View</span>
      </div>
    `;
  } else {
    if (id) {
      container.style.background = getInstagramFallbackGradient(id);
    }
    container.innerHTML = `
      <div class="fallback-gradient">
        <i class="fa-brands fa-instagram fallback-icon"></i>
        <span class="fallback-title">Instagram Post</span>
        <span class="fallback-subtitle">Click to View</span>
      </div>
    `;
  }
}

/**
 * Update Admin Login button UI state
 */

registerActions('bookmark-card', { buildCardElement, handleImageError });
export { buildCardElement, handleImageError };
