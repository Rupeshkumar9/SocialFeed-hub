import { AppState, DOM, POSTS_PER_PAGE } from '../../app/state.js';
import { actions, registerActions } from '../../app/actions.js';
import { ApiError } from '../../api/client.js';
import { socialFeedApi } from '../../api/socialfeed-api.js';

const onDataLoadedSuccess = (...args) => actions.onDataLoadedSuccess(...args);
const renderInfiniteScrollSentinel = (...args) => actions.renderInfiniteScrollSentinel(...args);
const setDatabaseStatus = (...args) => actions.setDatabaseStatus(...args);
const showPrivateLogin = (...args) => actions.showPrivateLogin(...args);
const updateSidebarNavigation = (...args) => actions.updateSidebarNavigation(...args);
const updateStatsAnalytics = (...args) => actions.updateStatsAnalytics(...args);

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
  if (AppState.isLoadingMore) return null;
  AppState.isLoadingMore = true;
  const requestId = ++AppState.activeRequestId;
  renderInfiniteScrollSentinel();
  const params = new URLSearchParams({ source: AppState.activeSource || 'browser', limit: '40' });
  if (AppState.activeSource === 'social' && AppState.activePlatform !== 'all') params.set('platform', AppState.activePlatform);
  if (AppState.activeSource === 'social' && AppState.activeCollection && AppState.activeCollection !== 'all') params.set('collection', AppState.activeCollection);
  if (append && AppState.nextCursor) params.set('cursor', AppState.nextCursor);
  try {
    const data = await socialFeedApi.getBookmarks(params);
    if (requestId !== AppState.activeRequestId) return null;
    const incoming = Array.isArray(data) ? data : (data?.bookmarks || []);
    AppState.bookmarks = append ? AppState.bookmarks.concat(incoming) : incoming;
    AppState.nextCursor = data?.nextCursor || null;
    AppState.hasMore = Boolean(data?.hasMore);
    AppState.isLoadingMore = false;
    setDatabaseStatus(true);
    onDataLoadedSuccess();
    const more = document.getElementById('load-more-container');
    if (more) more.hidden = true;
    return data;
  } catch (error) {
    if (requestId === AppState.activeRequestId) AppState.isLoadingMore = false;
    if (error instanceof ApiError && error.status === 401) showPrivateLogin('Session expired; sign in again.');
    else {
      setDatabaseStatus(false);
      AppState.bookmarks = append ? AppState.bookmarks : [];
      onDataLoadedSuccess();
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
    AppState.platformCounts = data?.platforms || { all: data?.all || 0, instagram: data?.instagram || 0, x: data?.x || 0, threads: data?.threads || 0, reddit: data?.reddit || 0, facebook: data?.facebook || 0 };
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

registerActions('feed-data', { checkDatabaseConnection, loadData, refreshPlatformCounts });
export { checkDatabaseConnection, loadData, refreshPlatformCounts };
