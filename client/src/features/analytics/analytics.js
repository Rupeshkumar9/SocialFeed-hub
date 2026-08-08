import { AppState, DOM, POSTS_PER_PAGE } from '../../app/state.js';
import { actions, registerActions } from '../../app/actions.js';

const escapeHTML = (...args) => actions.escapeHTML(...args);
const getCategoryCountsForContext = (...args) => actions.getCategoryCountsForContext(...args);
const getLibraryCountGroup = (...args) => actions.getLibraryCountGroup(...args);
const platformLabel = (...args) => actions.platformLabel(...args);
const sortedCategoryItemsFromCounts = (...args) => actions.sortedCategoryItemsFromCounts(...args);

function categoryRowsMarkup(counts = {}, source = "social") {
  const items = sortedCategoryItemsFromCounts(counts, source).filter(item => item.count > 0);
  if (items.length === 0) return '<div class="stats-empty-line">No categories yet</div>';
  const total = Number(counts.all) || items.reduce((sum, item) => sum + Number(item.count || 0), 0) || 1;
  return items.map(item => {
    const pct = Math.round((Number(item.count || 0) / total) * 100);
    return '<div class="stats-category-row">' +
      '<div class="metric-info"><span>' + escapeHTML(item.label) + '</span><span>' + item.count + '</span></div>' +
      '<div class="metric-bar-container tiny"><div class="metric-bar" style="width:' + pct + '%;"></div></div>' +
    '</div>';
  }).join('');
}

function updateStatsAnalytics() {
  const panel = document.getElementById("stats-panel");
  if (!panel || panel.hidden || !AppState.isAnalyticsOpen) return;

  const platformContainer = document.getElementById("stat-platform-splits");
  const browserContainer = document.getElementById("stat-browser-splits");
  if (!platformContainer || !browserContainer) return;

  const platformCounts = AppState.platformCounts || {};
  const socialTotal = Number(platformCounts.all) || 0;
  const knownPlatformRows = [
    { key: "instagram", label: "Instagram", count: Number(platformCounts.instagram) || 0, barClass: "ig-bar" },
    { key: "x", label: "X / Twitter", count: Number(platformCounts.x) || 0, barClass: "x-bar" },
    { key: "threads", label: "Threads", count: Number(platformCounts.threads) || 0, barClass: "threads-bar" },
    { key: "reddit", label: "Reddit", count: Number(platformCounts.reddit) || 0, barClass: "reddit-bar" },
    { key: "facebook", label: "Facebook", count: Number(platformCounts.facebook) || 0, barClass: "fb-bar" },
    { key: "youtube", label: "YouTube", count: Number(platformCounts.youtube) || 0, barClass: "youtube-bar" }
  ];
  const knownKeys = new Set(['all', ...knownPlatformRows.map(row => row.key)]);
  const customPlatformRows = Object.entries(platformCounts)
    .filter(([key, count]) => !knownKeys.has(key) && Number(count) > 0)
    .map(([key, count]) => ({ key, label: platformLabel(key), count: Number(count), barClass: 'custom-platform-bar' }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const platformRows = [...knownPlatformRows, ...customPlatformRows];

  platformContainer.innerHTML = platformRows.map(row => {
    const pct = socialTotal > 0 ? Math.round((row.count / socialTotal) * 100) : 0;
    const isOpen = AppState.analyticsOpenPlatform === row.key;
    const collectionCounts = getLibraryCountGroup("collections", row.key) || { all: row.count, uncategorized: 0 };
    return '<div class="stats-platform-block' + (isOpen ? ' open' : '') + '">' +
      '<button type="button" class="stats-metric-row stats-metric-button" data-analytics-platform="' + escapeHTML(row.key) + '">' +
        '<div class="metric-info"><span>' + escapeHTML(row.label) + '</span><span>' + row.count + ' (' + pct + '%)</span></div>' +
        '<div class="metric-bar-container"><div class="metric-bar ' + row.barClass + '" style="width:' + pct + '%;"></div></div>' +
      '</button>' +
      '<div class="stats-category-breakdown"' + (isOpen ? '' : ' hidden') + '>' + categoryRowsMarkup(collectionCounts, "social") + '</div>' +
    '</div>';
  }).join('');

  platformContainer.querySelectorAll('[data-analytics-platform]').forEach(button => {
    button.addEventListener('click', () => {
      const next = button.dataset.analyticsPlatform;
      AppState.analyticsOpenPlatform = AppState.analyticsOpenPlatform === next ? '' : next;
      updateStatsAnalytics();
    });
  });

  const sources = AppState.libraryCounts && AppState.libraryCounts.sources ? AppState.libraryCounts.sources : {};
  const browserTotal = Number(sources.browser) || 0;
  const grandTotal = (Number(sources.social) || socialTotal) + browserTotal;
  const browserPct = grandTotal > 0 ? Math.round((browserTotal / grandTotal) * 100) : 0;
  const browserCollections = getCategoryCountsForContext({ source: "browser", platform: "browser" });
  browserContainer.innerHTML = '<div class="stats-platform-block open">' +
    '<div class="stats-metric-row">' +
      '<div class="metric-info"><span>Saved Links</span><span>' + browserTotal + ' (' + browserPct + '%)</span></div>' +
      '<div class="metric-bar-container"><div class="metric-bar browser-bar" style="width:' + browserPct + '%;"></div></div>' +
    '</div>' +
    '<div class="stats-category-breakdown">' + categoryRowsMarkup(browserCollections, "browser") + '</div>' +
  '</div>';
}

registerActions('analytics', { categoryRowsMarkup, updateStatsAnalytics });
export { categoryRowsMarkup, updateStatsAnalytics };
