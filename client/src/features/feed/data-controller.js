import { AppState, DOM, FEED_PAGE_SIZE, POSTS_PER_PAGE } from '../../app/state.js';
import { actions, registerActions } from '../../app/actions.js';
import { ApiError } from '../../api/client.js';
import { socialFeedApi } from '../../api/socialfeed-api.js';

const onDataLoadedSuccess = (...args) => actions.onDataLoadedSuccess(...args);
const renderInfiniteScrollSentinel = (...args) => actions.renderInfiniteScrollSentinel(...args);
const renderFeedLoadingState = (...args) => actions.renderFeedLoadingState(...args);
const setDatabaseStatus = (...args) => actions.setDatabaseStatus(...args);
const setSidebarNavigationLoading = (...args) => actions.setSidebarNavigationLoading(...args);
const showPrivateLogin = (...args) => actions.showPrivateLogin(...args);
const updateSidebarNavigation = (...args) => actions.updateSidebarNavigation(...args);
const updateStatsAnalytics = (...args) => actions.updateStatsAnalytics(...args);

const MAX_FEED_CACHE_ENTRIES = 10;

function feedCacheKey() {
  return `${AppState.activeSource || 'browser'}|${AppState.activePlatform || 'all'}|${AppState.activeCollection || 'all'}`;
}

function cloneBookmarks(bookmarks) {
  return bookmarks.map(bookmark => ({
    ...bookmark,
    hashtags: Array.isArray(bookmark.hashtags) ? [...bookmark.hashtags] : bookmark.hashtags
  }));
}

function invalidateFeedCache() {
  AppState.feedCache.clear();
}

function cacheFeedContext(key, bookmarks, nextCursor, hasMore) {
  AppState.feedCache.delete(key);
  AppState.feedCache.set(key, {
    bookmarks: cloneBookmarks(bookmarks),
    nextCursor,
    hasMore,
    cachedAt: Date.now()
  });
  while (AppState.feedCache.size > MAX_FEED_CACHE_ENTRIES) {
    AppState.feedCache.delete(AppState.feedCache.keys().next().value);
  }
}

function restoreCachedFeed(key) {
  const cached = AppState.feedCache.get(key);
  if (!cached) return null;
  AppState.feedCache.delete(key);
  AppState.feedCache.set(key, cached);
  return cached;
}

function cancelActiveLoad() {
  if (AppState.activeLoadController) {
    AppState.activeLoadController.abort();
    AppState.activeLoadController = null;
  }
  AppState.activeRequestId += 1;
  AppState.isLoadingMore = false;
  AppState.isNavigationLoading = false;
  setSidebarNavigationLoading(false);
}

async function checkDatabaseConnection() {
  try {
    await socialFeedApi.getDatabaseStatus();
    setDatabaseStatus(true);
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) showPrivateLogin('Session expired; sign in again.');
    else setDatabaseStatus(false, 'You are signed in, but the database connection is unavailable.');
    return false;
  }
}

async function loadData(options = {}) {
  if (!AppState.isServerConnected) return null;
  const append = Boolean(options.append);
  const force = Boolean(options.force);
  const navigation = Boolean(options.navigation);
  const requestContext = feedCacheKey();

  // A fresh navigation supersedes an in-flight request. Abort it instead of
  // merely ignoring its response so rapid platform switching does not leave
  // multiple expensive API calls running in parallel.
  if (!append && AppState.activeLoadController) cancelActiveLoad();
  if (append && AppState.isLoadingMore) return null;

  if (!append && !force) {
    const cached = restoreCachedFeed(requestContext);
    if (cached) {
      AppState.bookmarks = cloneBookmarks(cached.bookmarks);
      AppState.nextCursor = cached.nextCursor;
      AppState.hasMore = cached.hasMore;
      AppState.isLoadingMore = false;
      AppState.isNavigationLoading = false;
      setSidebarNavigationLoading(false);
      setDatabaseStatus(true);
      onDataLoadedSuccess({ append: false, cached: true });
      renderInfiniteScrollSentinel();
      return {
        bookmarks: cloneBookmarks(cached.bookmarks),
        nextCursor: cached.nextCursor,
        hasMore: cached.hasMore,
        cached: true
      };
    }
  }

  if (AppState.isLoadingMore && !append) {
    cancelActiveLoad();
  }

  AppState.isLoadingMore = true;
  if (navigation) {
    AppState.isNavigationLoading = true;
    setSidebarNavigationLoading(true);
    AppState.bookmarks = [];
    AppState.filteredBookmarks = [];
    AppState.visibleCount = POSTS_PER_PAGE;
    renderFeedLoadingState();
  }
  const requestId = ++AppState.activeRequestId;
  const controller = new AbortController();
  AppState.activeLoadController = controller;
  renderInfiniteScrollSentinel();
  const params = new URLSearchParams({ source: AppState.activeSource || 'browser', limit: String(FEED_PAGE_SIZE) });
  if (AppState.activeSource === 'social' && AppState.activePlatform !== 'all') params.set('platform', AppState.activePlatform);
  if (AppState.activeSource === 'social' && AppState.activeCollection && AppState.activeCollection !== 'all') params.set('collection', AppState.activeCollection);
  if (append && AppState.nextCursor) params.set('cursor', AppState.nextCursor);
  try {
    const data = await socialFeedApi.getBookmarks(params, { signal: controller.signal });
    if (requestId !== AppState.activeRequestId || requestContext !== `${AppState.activeSource}|${AppState.activePlatform}|${AppState.activeCollection}`) {
      return null;
    }
    const incoming = Array.isArray(data) ? data : (data?.bookmarks || []);
    AppState.bookmarks = append ? AppState.bookmarks.concat(incoming) : incoming;
    AppState.nextCursor = data?.nextCursor || null;
    AppState.hasMore = Boolean(data?.hasMore);
    cacheFeedContext(requestContext, AppState.bookmarks, AppState.nextCursor, AppState.hasMore);
    setDatabaseStatus(true);
    onDataLoadedSuccess({ append });
    AppState.isLoadingMore = false;
    AppState.isNavigationLoading = false;
    setSidebarNavigationLoading(false);
    AppState.activeLoadController = null;
    // The render happened while loading was still true so overlapping loads
    // stay blocked; refresh the sentinel after the final state is known.
    renderInfiniteScrollSentinel();
    const more = document.getElementById('load-more-container');
    if (more) more.hidden = true;
    return data;
  } catch (error) {
    // Aborted/stale requests are expected during fast navigation and should
    // not clear the current feed or flash an offline state.
    if (requestId !== AppState.activeRequestId) return null;
    AppState.isLoadingMore = false;
    AppState.activeLoadController = null;
    if (navigation) {
      AppState.isNavigationLoading = false;
      setSidebarNavigationLoading(false);
    }
    if (error instanceof ApiError && error.status === 401) showPrivateLogin('Session expired; sign in again.');
    else {
      setDatabaseStatus(false);
      AppState.bookmarks = append ? AppState.bookmarks : [];
      onDataLoadedSuccess({ append });
    }
    const more = document.getElementById('load-more-container');
    if (more) more.hidden = true;
    renderInfiniteScrollSentinel();
    return null;
  }
}

async function refreshPlatformCounts() {
  try {
    const data = await socialFeedApi.getCounts();
    AppState.libraryCounts = data;
    AppState.platformCounts = data?.platforms || { all: data?.all || 0, instagram: data?.instagram || 0, x: data?.x || 0, threads: data?.threads || 0, reddit: data?.reddit || 0, facebook: data?.facebook || 0, youtube: data?.youtube || 0 };
    setDatabaseStatus(true);
    updateSidebarNavigation();
    updateStatsAnalytics();
    return data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) showPrivateLogin('Session expired; sign in again.');
    else setDatabaseStatus(false);
    return null;
  }
}

registerActions('feed-data', { checkDatabaseConnection, loadData, refreshPlatformCounts, invalidateFeedCache, cancelActiveLoad });
export { checkDatabaseConnection, loadData, refreshPlatformCounts, invalidateFeedCache, cancelActiveLoad };
