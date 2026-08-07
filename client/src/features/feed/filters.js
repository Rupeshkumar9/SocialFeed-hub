import { AppState, DOM, POSTS_PER_PAGE } from '../../app/state.js';
import { actions, registerActions } from '../../app/actions.js';

const getBookmarkDateMs = (...args) => actions.getBookmarkDateMs(...args);
const platformLabel = (...args) => actions.platformLabel(...args);
const renderFeedGrid = (...args) => actions.renderFeedGrid(...args);
const updateSidebarNavigation = (...args) => actions.updateSidebarNavigation(...args);
const updateStatsAnalytics = (...args) => actions.updateStatsAnalytics(...args);

function applyFiltersAndSearch() {
  const query = AppState.searchQuery.toLowerCase().trim();

  AppState.filteredBookmarks = AppState.bookmarks.filter(bm => {
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

  // Reset pagination on any filter/search change
  AppState.visibleCount = POSTS_PER_PAGE;

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
  let title = AppState.activeSource === "browser" ? "Browser Bookmarks" : "All Social Bookmarks";
  if (AppState.activeSource === "social" && AppState.activePlatform !== "all") title = platformLabel(AppState.activePlatform);
  if (AppState.activeCollection && AppState.activeCollection !== "all") title += " in " + (AppState.activeCollection === "uncategorized" ? "Others" : AppState.activeCollection);
  DOM.feedTitle.textContent = title;
  DOM.feedSubtitle.textContent = "Showing " + AppState.filteredBookmarks.length + " loaded bookmark" + (AppState.filteredBookmarks.length === 1 ? "" : "s");
  const browserItem = document.getElementById("sidebar-browser-item");
  if (browserItem) browserItem.classList.toggle("active", AppState.activeSource === "browser");
}

registerActions('feed-filters', { applyFiltersAndSearch, updateFeedHeaders });
export { applyFiltersAndSearch, updateFeedHeaders };
