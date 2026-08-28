import { AppState, DOM, FEED_PAGE_SIZE, POSTS_PER_PAGE } from '../../app/state.js';
import { actions, registerActions } from '../../app/actions.js';
import { buildBrowserLinkRow } from '../bookmarks/browser-link-row.js';

const applyFiltersAndSearch = (...args) => actions.applyFiltersAndSearch(...args);
const browserCategoryLabel = (...args) => actions.browserCategoryLabel(...args);
const buildCardElement = (...args) => actions.buildCardElement(...args);
const escapeHTML = (...args) => actions.escapeHTML(...args);
const loadData = (...args) => actions.loadData(...args);
const processCollections = (...args) => actions.processCollections(...args);
const updateFeedHeaders = (...args) => actions.updateFeedHeaders(...args);
const processTags = (...args) => actions.processTags(...args);
const showToast = (...args) => actions.showToast(...args);
const updateCollectionsFilterDropdown = (...args) => actions.updateCollectionsFilterDropdown(...args);
const normalizeCollectionKey = (...args) => actions.normalizeCollectionKey(...args);

let isScrollLoading = false;

function onDataLoadedSuccess({ append = false } = {}) {
  const scrollContainer = document.getElementById('main-panel');
  const previousScrollTop = append && scrollContainer ? scrollContainer.scrollTop : null;
  processCollections();
  updateCollectionsFilterDropdown();
  processTags();

  const browserLayout = localStorage.getItem('browser_bookmarks_layout') || 'dense';
  const socialLayout = localStorage.getItem('social_bookmarks_layout') || localStorage.getItem('bookmarks_layout') || 'grid';
  AppState.browserLayout = browserLayout;
  AppState.socialLayout = socialLayout;
  changeLayout(AppState.activeSource === 'browser' ? browserLayout : socialLayout, false);
  AppState.layoutInitialized = true;

  applyFiltersAndSearch({ resetPagination: !append });
  if (previousScrollTop !== null && scrollContainer) {
    scrollContainer.scrollTop = previousScrollTop;
    requestAnimationFrame(() => { scrollContainer.scrollTop = previousScrollTop; });
  }
  console.info("Bookmarks loaded successfully.");
}

function renderFeedLoadingState() {
  if (!DOM.bookmarksGrid) return;
  const existing = document.getElementById('infinite-scroll-sentinel');
  if (existing) existing.remove();
  DOM.bookmarksGrid.innerHTML = `
    <div class="feed-loading-state" role="status" aria-live="polite">
      <i class="app-icon icon-circle-notch icon-spin" aria-hidden="true"></i>
      <span>Loading ${AppState.activeSource === 'browser' ? 'links' : 'posts'}…</span>
    </div>
  `;
  updateFeedHeaders();
  DOM.feedSubtitle.textContent = `Loading ${AppState.activeSource === 'browser' ? 'links' : 'posts'}…`;
}

/**
 * Process collections/folders from current bookmarks
 */

function getGridColumnCount() {
  const w = window.innerWidth;
  if (w <= 768) return 2;
  if (w <= 1100) return 3;
  return 4;
}

/**
 * Render paginated bookmarks grid — only the first visibleCount items
 */
function browserCategorySortKey(label) {
  return label === "General Links" ? "" : label.toLowerCase();
}

function updateBrowserCategoryMenu() {
  const menu = document.getElementById('toolbar-category-menu');
  if (!menu) return;
  menu.replaceChildren();
  document.querySelectorAll('.browser-category-section').forEach((section, index) => {
    const heading = section.querySelector('h3');
    const label = heading?.textContent?.replace('Rename category', '').trim() || `Category ${index + 1}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'dropdown-item browser-category-jump-item';
    button.dataset.categoryIndex = String(index);
    button.setAttribute('role', 'menuitem');
    button.innerHTML = `<i class="app-icon icon-folder"></i><span class="btn-text">${escapeHTML(label)}</span>`;
    menu.appendChild(button);
  });
  if (!menu.children.length) {
    const empty = document.createElement('span');
    empty.className = 'dropdown-empty';
    empty.textContent = 'No categories in this view';
    menu.appendChild(empty);
  }
}

function renderBrowserGroupedFeed(visibleSlice) {
  DOM.bookmarksGrid.classList.add("browser-grouped-feed");
  const groups = new Map();
  visibleSlice.forEach(bm => {
    const label = browserCategoryLabel(bm.folder);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(bm);
  });

  if (!groups.has("General Links")) {
    groups.set("General Links", []);
  }

  const ordered = Array.from(groups.entries()).sort(([a], [b]) => browserCategorySortKey(a).localeCompare(browserCategorySortKey(b)));
  const fragment = document.createDocumentFragment();
  ordered.forEach(([label, items]) => {
    const section = document.createElement("section");
    section.className = "browser-category-section";
    const rawCategory = items.length ? normalizeCollectionKey(items[0].folder) : '';
    const canRename = Boolean(rawCategory) && rawCategory.toLowerCase() !== 'uncategorized';
    section.innerHTML = `
      <div class="browser-category-heading">
        <div>
          <h3>${escapeHTML(label)}${canRename ? ` <button type="button" class="category-rename-btn" data-category-rename="browser" data-category-old="${escapeHTML(rawCategory)}" aria-label="Rename category" title="Rename category"><i class="app-icon icon-pen"></i></button>` : ''}</h3>
          <p>${items.length} saved link${items.length === 1 ? "" : "s"}</p>
        </div>
      </div>
      <div class="browser-category-grid"></div>
    `;
    const grid = section.querySelector(".browser-category-grid");
    items.forEach(bm => grid.appendChild(buildBrowserLinkRow(bm)));
    fragment.appendChild(section);
  });
  DOM.bookmarksGrid.appendChild(fragment);
  updateBrowserCategoryMenu();
}

function renderFeedGrid() {
  DOM.bookmarksGrid.innerHTML = "";
  DOM.bookmarksGrid.classList.remove("browser-grouped-feed");

  if (AppState.filteredBookmarks.length === 0) {
    if (AppState.databaseConnected === false) {
      DOM.bookmarksGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon"><i class="app-icon icon-database"></i></div>
          <h3>Bookmarks are unavailable</h3>
          <p>The dashboard is open, but the database connection must recover before bookmarks can be displayed.</p>
        </div>
      `;
      const existing = document.getElementById("infinite-scroll-sentinel");
      if (existing) existing.remove();
      return;
    }
    if (AppState.activeSource === "browser") {
      renderBrowserGroupedFeed([]);
    } else {
      DOM.bookmarksGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon"><i class="app-icon icon-folder-open"></i></div>
          <h3>No bookmarks found</h3>
          <p>Try clearing your search filters, adjusting categories, or importing a fresh data archive.</p>
        </div>
      `;
    }
    const existing = document.getElementById("infinite-scroll-sentinel");
    if (existing) existing.remove();
    return;
  }

  const visibleSlice = AppState.filteredBookmarks.slice(0, AppState.visibleCount);

  AppState.activeLayout = AppState.activeSource === 'browser' ? AppState.browserLayout : AppState.socialLayout;
  if (AppState.activeSource === "browser") {
    renderBrowserGroupedFeed(visibleSlice);
  } else if (AppState.activeLayout === "list" || AppState.activeLayout === "compact") {
    const fragment = document.createDocumentFragment();
    visibleSlice.forEach(bm => {
      fragment.appendChild(buildCardElement(bm));
    });
    DOM.bookmarksGrid.appendChild(fragment);
  } else {
    const numCols = getGridColumnCount();
    const cols = [];
    for (let i = 0; i < numCols; i++) {
      const colDiv = document.createElement("div");
      colDiv.className = "masonry-col";
      cols.push(colDiv);
    }

    visibleSlice.forEach((bm, index) => {
      const targetCol = cols[index % numCols];
      targetCol.appendChild(buildCardElement(bm));
    });

    const fragment = document.createDocumentFragment();
    cols.forEach(col => fragment.appendChild(col));
    DOM.bookmarksGrid.appendChild(fragment);
  }

  renderInfiniteScrollSentinel();
}

/**
 * Open Slide Drawer Details View
 */

function changeLayout(layout, showFeedbackToast = true) {
  if (AppState.activeSource === 'browser' && layout !== 'dense') layout = 'dense';
  AppState.activeLayout = layout;
  if (AppState.activeSource === 'browser') {
    AppState.browserLayout = layout;
    localStorage.setItem('browser_bookmarks_layout', layout);
  } else {
    AppState.socialLayout = layout;
    localStorage.setItem('social_bookmarks_layout', layout);
  }

  const menu = document.getElementById('toolbar-layout-menu');
  if (menu) {
    menu.querySelectorAll('.dropdown-item').forEach(item => {
      const browserOnly = item.classList.contains('browser-layout-item');
      const socialOnly = item.classList.contains('social-layout-item');
      item.hidden = (AppState.activeSource === 'browser' && socialOnly) || (AppState.activeSource === 'social' && browserOnly);
      const isMatch = item.getAttribute('data-layout') === layout;
      item.classList.toggle('active', isMatch);
      const checkIcon = item.querySelector('.check-icon');
      if (checkIcon) {
        checkIcon.style.visibility = isMatch ? 'visible' : 'hidden';
      }
    });
  }

  const categoryToolbar = document.getElementById('toolbar-category-dropdown');
  if (categoryToolbar) categoryToolbar.hidden = AppState.activeSource !== 'browser';

  const activeIcon = document.getElementById('layout-active-icon');
  const activeLabel = document.getElementById('layout-active-label');
  if (activeIcon) {
    activeIcon.className = (() => {
      if (layout === 'grid' || layout === 'dense') return 'app-icon icon-grip';
      if (layout === 'list') return 'app-icon icon-list';
      if (layout === 'compact') return 'app-icon icon-bars';
      return 'app-icon icon-grip';
    })();
  }
  if (activeLabel) {
    activeLabel.textContent = layout === 'dense' ? 'Dense Links' : layout === 'comfortable' ? 'Comfortable Links' : layout.charAt(0).toUpperCase() + layout.slice(1) + ' View';
  }

  if (DOM.bookmarksGrid) {
    DOM.bookmarksGrid.classList.remove('list-view', 'compact-view', 'browser-density-dense', 'browser-density-comfortable');
    if (layout === 'list') {
      DOM.bookmarksGrid.classList.add('list-view');
    } else if (layout === 'compact') {
      DOM.bookmarksGrid.classList.add('compact-view');
    } else if (layout === 'dense') {
      DOM.bookmarksGrid.classList.add('browser-density-dense');
    }
  }

  renderFeedGrid();

  if (showFeedbackToast) {
    showToast(`Switched to ${layout.charAt(0).toUpperCase() + layout.slice(1)} view`, 'info');
  }
}

/**
 * Compute metrics and update dashboard counts in real time
 */

function renderInfiniteScrollSentinel() {
  const existing = document.getElementById("infinite-scroll-sentinel");
  if (existing) existing.remove();
  const total = AppState.filteredBookmarks.length;
  const showing = Math.min(AppState.visibleCount, total);
  if (!total) return;
  const sentinel = document.createElement("div");
  sentinel.id = "infinite-scroll-sentinel";
  sentinel.className = "infinite-scroll-sentinel";
  if (showing < total || AppState.isLoadingMore) {
      sentinel.innerHTML = `<div class="infinite-scroll-spinner"><i class="app-icon icon-circle-notch icon-spin"></i><span>Loading more ${AppState.activeSource === 'browser' ? 'links' : 'posts'}…</span></div>`;
  } else if (AppState.hasMore) {
    sentinel.innerHTML = `<div class="infinite-scroll-spinner"><span>More ${AppState.activeSource === 'browser' ? 'links' : 'posts'} load automatically as you scroll</span></div>`;
  } else {
    sentinel.innerHTML = `<div class="infinite-scroll-end">Showing all loaded ${AppState.activeSource === 'browser' ? 'links' : 'posts'}</div>`;
  }
  DOM.bookmarksGrid.parentNode.insertBefore(sentinel, DOM.bookmarksGrid.nextSibling);
  if (showing < total || AppState.hasMore) initInfiniteScrollObserver();
  else if (AppState.scrollObserver) AppState.scrollObserver.disconnect();
}

function initInfiniteScrollObserver() {
  if (AppState.scrollObserver) AppState.scrollObserver.disconnect();
  const sentinel = document.getElementById("infinite-scroll-sentinel");
  const scrollContainer = document.getElementById("main-panel");
  if (!sentinel || !scrollContainer) return;
  AppState.scrollObserver = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting) || isScrollLoading) return;
    // Do not chain social API pages immediately after the first response.
    // Wait for the user to begin scrolling so platform switches stay fast.
    if (scrollContainer.scrollTop <= 0 && AppState.hasMore && AppState.bookmarks.length >= FEED_PAGE_SIZE) return;
    const total = AppState.filteredBookmarks.length;
    if (AppState.visibleCount < total) {
      isScrollLoading = true;
      const previousScrollTop = scrollContainer.scrollTop;
      setTimeout(() => {
        AppState.visibleCount += POSTS_PER_PAGE;
        renderFeedGrid();
        scrollContainer.scrollTop = previousScrollTop;
        requestAnimationFrame(() => { scrollContainer.scrollTop = previousScrollTop; });
        isScrollLoading = false;
      }, 300);
      return;
    }
    if (AppState.hasMore && !AppState.isLoadingMore) loadData({ append: true });
  }, { root: scrollContainer, rootMargin: "200px 0px" });
  AppState.scrollObserver.observe(sentinel);
}

registerActions('feed-view', { onDataLoadedSuccess, renderFeedLoadingState, getGridColumnCount, renderBrowserGroupedFeed, updateBrowserCategoryMenu, renderFeedGrid, browserCategorySortKey, changeLayout, renderInfiniteScrollSentinel, initInfiniteScrollObserver });
export { onDataLoadedSuccess, renderFeedLoadingState, getGridColumnCount, renderBrowserGroupedFeed, updateBrowserCategoryMenu, renderFeedGrid, browserCategorySortKey, changeLayout, renderInfiniteScrollSentinel, initInfiniteScrollObserver };
