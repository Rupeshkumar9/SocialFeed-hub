/* Runs after the legacy dashboard controller and establishes the private feed state. */
(async () => {
  try {
    const status = await fetch('/api/status', { credentials: 'same-origin', cache: 'no-store' });
    if (!status.ok) { document.body.classList.add('auth-pending'); return; }

    AppState.isServerConnected = true;
    AppState.isAdmin = true;
    AppState.activeSource = 'browser';
    AppState.activePlatform = 'all';
    AppState.activeCollection = 'all';
    AppState.nextCursor = null;
    AppState.hasMore = false;
    document.body.classList.remove('auth-pending', 'visitor-mode');

    const [countsResponse, bookmarksResponse] = await Promise.all([
      fetch('/api/counts', { credentials: 'same-origin', cache: 'no-store' }),
      fetch('/api/load?source=browser&limit=40', { credentials: 'same-origin', cache: 'no-store' })
    ]);

    if (countsResponse.ok) {
      const counts = await countsResponse.json();
      AppState.libraryCounts = counts;
      AppState.platformCounts = counts.platforms || { all: counts.all || 0, instagram: counts.instagram || 0, x: counts.x || 0, threads: counts.threads || 0, reddit: counts.reddit || 0, facebook: counts.facebook || 0 };
    }
    if (bookmarksResponse.ok) {
      const data = await bookmarksResponse.json();
      AppState.bookmarks = data.bookmarks || [];
      AppState.nextCursor = data.nextCursor || null;
      AppState.hasMore = !!data.hasMore;
      AppState.visibleCount = POSTS_PER_PAGE;
      onDataLoadedSuccess();
    }

    updateSidebarNavigation();
    const loadMore = document.getElementById('load-more-container');
    if (loadMore) loadMore.hidden = true;
  } catch (error) {
    console.warn('Private dashboard bootstrap failed:', error);
  }
})();
