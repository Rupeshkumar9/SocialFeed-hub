import { AppState, DOM, POSTS_PER_PAGE } from '../../app/state.js';
import { actions, registerActions } from '../../app/actions.js';

const getBookmarkDateMs = (...args) => actions.getBookmarkDateMs(...args);
const platformLabel = (...args) => actions.platformLabel(...args);
const escapeHTML = (...args) => actions.escapeHTML(...args);
const renderFeedGrid = (...args) => actions.renderFeedGrid(...args);
const updateSidebarNavigation = (...args) => actions.updateSidebarNavigation(...args);
const updateStatsAnalytics = (...args) => actions.updateStatsAnalytics(...args);

function applyFiltersAndSearch(options = {}) {
  const query = AppState.searchQuery.toLowerCase().trim();

  AppState.filteredBookmarks = AppState.bookmarks.filter(bm => {
    const isBrowserBookmark = bm.source === 'browser' || bm.platform === 'browser';
    if (AppState.activeSource === 'browser' && !isBrowserBookmark) return false;
    if (AppState.activeSource === 'social' && isBrowserBookmark) return false;

    // 1. Platform Filter
    if (AppState.activePlatform !== 'all' && bm.platform !== AppState.activePlatform) {
      return false;
    }

    // 1.5. Collection Filter
    if (AppState.activeSource === 'social' && AppState.activeCollection && AppState.activeCollection !== 'all') {
      if (AppState.activeCollection === 'uncategorized') {
        if (bm.folder && bm.folder.trim()) return false;
      } else {
        if ((bm.folder || '').trim() !== AppState.activeCollection) return false;
      }
    }

    // 2. Tag Filter
    if (AppState.activeTag !== 'all') {
      const hasTag = bm.hashtags && bm.hashtags.some(t => t.toLowerCase() === AppState.activeTag);
      if (!hasTag) return false;
    }

    // 3. Search Bar scanning
    if (query !== '') {
      const matchAuthorName = bm.authorName && bm.authorName.toLowerCase().includes(query);
      const matchUsername = bm.authorUsername && bm.authorUsername.toLowerCase().includes(query);
      const matchContent = bm.content && bm.content.toLowerCase().includes(query);
      const matchNotes = bm.notes && bm.notes.toLowerCase().includes(query);
      const matchTags = bm.hashtags && bm.hashtags.some(t => t.toLowerCase().includes(query));

      return matchAuthorName || matchUsername || matchContent || matchNotes || matchTags;
    }

    return true;
  });

  // Sort bookmarks by active criteria (strictly based on scraped date).
  AppState.filteredBookmarks.sort((a, b) => {
    if (AppState.activeSort === 'recent-desc') {
      return getBookmarkDateMs(b, ['firstSavedAt', 'createdAt', 'extensionScrapedAt', 'sourceSavedAt', 'timestamp']) - getBookmarkDateMs(a, ['firstSavedAt', 'createdAt', 'extensionScrapedAt', 'sourceSavedAt', 'timestamp']);
    } else if (AppState.activeSort === 'recent-asc') {
      return getBookmarkDateMs(a, ['firstSavedAt', 'createdAt', 'extensionScrapedAt', 'sourceSavedAt', 'timestamp']) - getBookmarkDateMs(b, ['firstSavedAt', 'createdAt', 'extensionScrapedAt', 'sourceSavedAt', 'timestamp']);
    } else if (AppState.activeSort === 'author-asc') {
      const nameA = (a.authorName || '').toLowerCase();
      const nameB = (b.authorName || '').toLowerCase();
      return nameA.localeCompare(nameB);
    } else if (AppState.activeSort === 'author-desc') {
      const nameA = (a.authorName || '').toLowerCase();
      const nameB = (b.authorName || '').toLowerCase();
      return nameB.localeCompare(nameA);
    }
    return 0;
  });

  // Reset pagination on a fresh/filter-driven render, but retain the visible
  // window when a server page is appended at the current scroll position.
  if (options.resetPagination !== false) AppState.visibleCount = POSTS_PER_PAGE;

  // Update Headers
  updateFeedHeaders();

  // Update Analytics Dashboard (if open)
  updateStatsAnalytics();

  // Render final filtered list
  renderFeedGrid();

  // Sync sidebar active highlights and platform/category/tag counts
  updateSidebarNavigation();
}

/**
 * Update Feed Grid Title & Subtitle text dynamically
 */

function updateFeedHeaders() {
  let title = AppState.activeSource === "browser" ? "My Links" : "All Posts";
  const category = AppState.activeCollection && AppState.activeCollection !== "all"
    ? (AppState.activeCollection === "uncategorized" ? "Others" : AppState.activeCollection)
    : '';
  const platform = AppState.activeSource === "social" && AppState.activePlatform !== "all"
    ? platformLabel(AppState.activePlatform)
    : 'All Posts';
  if (AppState.activeSource === "social") title = category ? `${category} in ${platform}` : platform;
  DOM.feedTitle.hidden = AppState.activeSource === 'social';
  DOM.feedTitle.innerHTML = escapeHTML(title);
  const noun = AppState.activeSource === "browser" ? "link" : "post";
  const loadedMessage = "Showing " + AppState.filteredBookmarks.length + " loaded " + noun + (AppState.filteredBookmarks.length === 1 ? "" : "s");
  DOM.feedSubtitle.textContent = loadedMessage;
  if (DOM.feedLoadedCount) {
    DOM.feedLoadedCount.textContent = AppState.filteredBookmarks.length;
    DOM.feedLoadedCount.title = loadedMessage;
    DOM.feedLoadedCount.dataset.tooltip = loadedMessage;
    DOM.feedLoadedCount.setAttribute('aria-label', loadedMessage);
  }
  const browserItem = document.getElementById("sidebar-browser-item");
  if (browserItem) browserItem.classList.toggle("active", AppState.activeSource === "browser");
}

registerActions('feed-filters', { applyFiltersAndSearch, updateFeedHeaders });
export { applyFiltersAndSearch, updateFeedHeaders };
