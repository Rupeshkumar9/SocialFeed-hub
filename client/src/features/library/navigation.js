import { AppState, DOM, POSTS_PER_PAGE } from '../../app/state.js';
import { actions, registerActions } from '../../app/actions.js';

const applyFiltersAndSearch = (...args) => actions.applyFiltersAndSearch(...args);
const closeSettings = (...args) => actions.closeSettings(...args);
const loadData = (...args) => actions.loadData(...args);
const openSettings = (...args) => actions.openSettings(...args);
const refreshPlatformCounts = (...args) => actions.refreshPlatformCounts(...args);

function processCollections() {
  AppState.collections.clear();
  AppState.bookmarks.forEach(bm => {
    if (bm.folder && bm.folder.trim()) {
      AppState.collections.add(bm.folder.trim());
    }
  });
}

/**
 * Render the Collections Dropdown filter options in the header
 */
function updateCollectionsFilterDropdown() {
  const filterSelect = document.getElementById('filter-collection');
  if (!filterSelect) return;

  const currentVal = AppState.activeCollection || 'all';

  filterSelect.innerHTML = `
    <option value="all">All Collections</option>
    <option value="uncategorized">Others</option>
  `;

  Array.from(AppState.collections).sort().forEach(folder => {
    const opt = document.createElement('option');
    opt.value = folder;
    opt.textContent = folder;
    filterSelect.appendChild(opt);
  });

  filterSelect.value = currentVal;
}

/**
 * Process tags from current bookmarks
 */
function processTags() {
  AppState.tags.clear();
  AppState.bookmarks.forEach(bm => {
    if (bm.hashtags && Array.isArray(bm.hashtags)) {
      bm.hashtags.forEach(tag => {
        const clean = tag.trim().toLowerCase();
        if (clean) {
          AppState.tags.add(clean);
        }
      });
    }
  });
}

/**
 * Render the Tag Dropdown filter options
 */
function renderTagCloud() {
  // Redundant. Now handled dynamically inside updateSidebarNavigation() tag group sublist
}

/**
 * Filter feed by platform select
 */
function filterByPlatform(platform) {
  AppState.activePlatform = platform;
  applyFiltersAndSearch();
}

/**
 * Filter feed by tag selection
 */
function filterByTag(tag) {
  AppState.activeTag = tag;
  applyFiltersAndSearch();
}


function syncFilterSelects() {
  if (DOM.filterPlatform) DOM.filterPlatform.value = AppState.activePlatform;
  const collectionSelect = document.getElementById('filter-collection');
  if (collectionSelect) collectionSelect.value = AppState.activeCollection;
}

function getCurrentCountSource() {
  if (AppState.activeSource === "social") return AppState.activePlatform === "all" ? "social" : AppState.activePlatform;
  return "browser";
}

function getLibraryCountGroup(group, sourceKey = getCurrentCountSource()) {
  const root = AppState.libraryCounts && AppState.libraryCounts[group];
  if (!root) return null;
  if (sourceKey === "social" || sourceKey === "browser") return root[sourceKey] || null;
  return root.platforms && root.platforms[sourceKey] ? root.platforms[sourceKey] : null;
}

function normalizeCollectionKey(value) {
  const folder = String(value || "").trim();
  const lower = folder.toLowerCase();
  if (!folder || lower === "uncategorized" || lower === "others" || lower === "bookmarks bar") return "uncategorized";
  return folder;
}

function browserCategoryLabel(value) {
  return normalizeCollectionKey(value) === "uncategorized" ? "General Links" : normalizeCollectionKey(value);
}

function socialCategoryLabel(value) {
  return normalizeCollectionKey(value) === "uncategorized" ? "Others" : normalizeCollectionKey(value);
}

function getLoadedCollectionCounts() {
  const counts = { all: AppState.bookmarks.length, uncategorized: 0 };
  AppState.bookmarks.forEach(bm => {
    const key = normalizeCollectionKey(bm.folder);
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

function getCategoryDefaultLabel(source = AppState.activeSource) {
  return source === "browser" ? "General Links" : "Others";
}

function getCategoryContextFromPlatform(platformValue) {
  const platform = String(platformValue || "").trim();
  if (platform === "browser") return { source: "browser", platform: "browser" };
  if (platform && platform !== "all") return { source: "social", platform };
  return { source: AppState.activeSource === "browser" ? "browser" : "social", platform: AppState.activePlatform || "all" };
}

function getCategoryCountsForContext(context = {}) {
  const source = context.source || AppState.activeSource || "social";
  const platform = context.platform || AppState.activePlatform || "all";
  const root = AppState.libraryCounts && AppState.libraryCounts.collections;
  if (root) {
    if (source === "browser") return root.browser || { all: 0, uncategorized: 0 };
    if (platform && platform !== "all" && root.platforms && root.platforms[platform]) return root.platforms[platform];
    return root.social || { all: 0, uncategorized: 0 };
  }

  const counts = { all: 0, uncategorized: 0 };
  AppState.bookmarks.forEach(bm => {
    const bmSource = bm.source === "browser" || bm.platform === "browser" ? "browser" : "social";
    if (source === "browser" && bmSource !== "browser") return;
    if (source === "social" && bmSource === "browser") return;
    if (source === "social" && platform && platform !== "all" && bm.platform !== platform) return;
    const key = normalizeCollectionKey(bm.folder);
    counts[key] = (counts[key] || 0) + 1;
    counts.all += 1;
  });
  return counts;
}

function sortedCategoryItemsFromCounts(counts = {}, source = AppState.activeSource) {
  const defaultLabel = getCategoryDefaultLabel(source);
  return Object.entries(counts)
    .filter(([key, count]) => key !== "all" && (normalizeCollectionKey(key) === "uncategorized" || Number(count) > 0))
    .map(([key, count]) => {
      const normalized = normalizeCollectionKey(key);
      return normalized === "uncategorized"
        ? { value: "uncategorized", label: defaultLabel, count: count || 0, icon: "fa-regular fa-folder" }
        : { value: normalized, label: normalized, count: count || 0, icon: "fa-solid fa-folder" };
    })
    .filter((item, index, list) => list.findIndex(candidate => candidate.value.toLowerCase() === item.value.toLowerCase()) === index)
    .sort((a, b) => (b.count - a.count) || a.label.localeCompare(b.label));
}

function platformIconMarkup(platform, className = "") {
  const extra = className ? " " + className : "";
  if (platform === "x") {
    return "<svg class=\"platform-inline-icon" + extra + "\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M18.9 2h3.3l-7.2 8.2 8.5 11.8h-6.7l-5.2-6.9-6 6.9H2.3l7.7-8.8L1.9 2h6.8l4.7 6.3L18.9 2Zm-1.2 17.9h1.8L7.7 4H5.8l11.9 15.9Z\"/></svg>";
  }
  if (platform === "threads") {
    return "<svg class=\"platform-inline-icon" + extra + "\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M17.6 11.1c-.2-3.5-2.2-5.5-5.6-5.5-2 0-3.7.8-4.7 2.3l1.7 1.2c.7-.9 1.7-1.4 3-1.4 1.9 0 3.1 1 3.4 2.8-.9-.2-1.9-.3-3-.2-2.9.2-4.7 1.6-4.6 3.8.1 2.1 1.9 3.5 4.4 3.4 2.2-.1 3.8-1.2 4.7-3.1.7.5 1.1 1.2 1.1 2.1 0 2.6-2.5 4.4-6 4.4-4.3 0-7-3.2-7-8.7 0-5.4 2.7-8.7 7-8.7 3.1 0 5.4 1.5 6.7 4.4l2-.9C19.1 3.7 16 2 12 2 6.4 2 3 5.9 3 12.2 3 18.5 6.4 22 12 22c4.8 0 8.1-2.5 8.1-6.2 0-2.1-.9-3.6-2.5-4.7Zm-5.5 4.3c-1.2.1-2.1-.5-2.1-1.4 0-.9.9-1.5 2.5-1.6 1-.1 2 0 2.8.3-.4 1.6-1.5 2.6-3.2 2.7Z\"/></svg>";
  }
  const classes = { instagram: "fa-brands fa-instagram", facebook: "fa-brands fa-facebook", reddit: "fa-brands fa-reddit-alien", browser: "fa-solid fa-bookmark" };
  return "<i class=\"" + (classes[platform] || "fa-solid fa-circle-nodes") + extra + "\"></i>";
}

function getLoadedTagCounts() {
  const counts = {};
  AppState.bookmarks.forEach(bm => {
    if (!Array.isArray(bm.hashtags)) return;
    bm.hashtags.forEach(tag => {
      const clean = String(tag || "").trim().toLowerCase();
      if (clean) counts[clean] = (counts[clean] || 0) + 1;
    });
  });
  return counts;
}

function updateSidebarNavigation() {
  const platformCounts = AppState.platformCounts ? { ...AppState.platformCounts } : { all: AppState.bookmarks.length, instagram: 0, x: 0, threads: 0, reddit: 0, facebook: 0 };
  if (!AppState.platformCounts) {
    AppState.bookmarks.forEach(bm => {
      let platform = (bm.platform || "web").toLowerCase().trim();
      if (platform === "twitter") platform = "x";
      if (platformCounts[platform] !== undefined) platformCounts[platform]++;
    });
  }

  Object.entries(platformCounts).forEach(([platform, count]) => {
    const el = document.getElementById("count-platform-" + platform);
    if (el) el.textContent = count;
  });

  const browserCount = AppState.libraryCounts && AppState.libraryCounts.sources ? AppState.libraryCounts.sources.browser : (AppState.activeSource === "browser" ? AppState.bookmarks.length : 0);
  const browserCountEl = document.getElementById("count-browser-bookmarks");
  if (browserCountEl) browserCountEl.textContent = browserCount || 0;

  const browserItem = document.getElementById("sidebar-browser-item");
  if (browserItem) browserItem.classList.toggle("active", AppState.activeSource === "browser" && !AppState.isSettingsOpen);

  const settingsButton = document.getElementById("btn-settings");
  if (settingsButton) settingsButton.classList.toggle("active", !!AppState.isSettingsOpen);

  if (DOM.sidebarPlatformList) {
    DOM.sidebarPlatformList.querySelectorAll(".menu-item").forEach(item => {
      const btn = item.querySelector("[data-platform]");
      item.classList.toggle("active", !AppState.isSettingsOpen && AppState.activeSource === "social" && btn && btn.dataset.platform === AppState.activePlatform);
    });
  }

  const collectionSection = DOM.sidebarCollectionList ? DOM.sidebarCollectionList.closest(".sidebar-section") : null;
  if (collectionSection) collectionSection.hidden = false;
  if (AppState.activeSource !== "social") {
    const collectionList = DOM.sidebarCollectionList;
    if (collectionList) {
      const socialCollections = getLibraryCountGroup("collections", "social") || { all: platformCounts.all || 0, uncategorized: 0 };
      collectionList.innerHTML = "";
      [
        { value: "all", label: "All", count: socialCollections.all || 0, icon: "fa-solid fa-folder-tree" },
        { value: "uncategorized", label: "Others", count: socialCollections.uncategorized || 0, icon: "fa-regular fa-folder" }
      ].forEach(item => {
        const li = document.createElement("li");
        li.className = "menu-item sidebar-category-disabled";
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.collection = item.value;
        button.disabled = true;
        const icon = document.createElement("i");
        icon.className = item.icon;
        const label = document.createElement("span");
        label.textContent = item.label;
        const count = document.createElement("span");
        count.className = "menu-count";
        count.textContent = item.count || 0;
        button.append(icon, label, count);
        li.appendChild(button);
        collectionList.appendChild(li);
      });
    }
    syncFilterSelects();
    return;
  }

  const counts = getLibraryCountGroup("collections") || getLoadedCollectionCounts();
  const collectionList = DOM.sidebarCollectionList;
  if (collectionList) {
    collectionList.innerHTML = "";
    const allItem = { value: "all", label: "All", count: counts.all || 0, icon: "fa-solid fa-folder-tree" };
    const categoryItems = sortedCategoryItemsFromCounts(counts, "social");
    if (!categoryItems.some(item => item.value === "uncategorized")) {
      categoryItems.unshift({ value: "uncategorized", label: "Others", count: 0, icon: "fa-regular fa-folder" });
    }

    [allItem, ...categoryItems].forEach(item => {
      const li = document.createElement("li");
      li.className = "menu-item" + (AppState.activeCollection === item.value ? " active" : "");
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.collection = item.value;
      const icon = document.createElement("i");
      icon.className = item.icon;
      const label = document.createElement("span");
      label.textContent = item.label;
      const count = document.createElement("span");
      count.className = "menu-count";
      count.textContent = item.count || 0;
      button.append(icon, label, count);
      li.appendChild(button);
      collectionList.appendChild(li);
    });
  }

  syncFilterSelects();
}
/**
 * Apply both active platform and tag filters along with text search query
 */

function setRouteHash(hash) {
  if (!hash) return;
  const url = new URL(window.location.href);
  url.hash = hash;
  window.history.replaceState(null, '', url.toString());
}

function appUrlForRoute(hash) {
  const url = new URL(window.location.href);
  url.hash = hash;
  return url.toString();
}

function showSidebarContextMenu(event, hash) {
  event.preventDefault();
  document.querySelectorAll('.sidebar-context-menu').forEach(menu => menu.remove());
  const menu = document.createElement('div');
  menu.className = 'sidebar-context-menu';
  menu.style.left = event.clientX + 'px';
  menu.style.top = event.clientY + 'px';
  const item = document.createElement('button');
  item.type = 'button';
  item.innerHTML = '<i class="fa-regular fa-window-restore"></i><span>Open in new tab</span>';
  item.addEventListener('click', () => {
    window.open(appUrlForRoute(hash), '_blank', 'noopener');
    menu.remove();
  });
  menu.appendChild(item);
  document.body.appendChild(menu);
  const closeMenu = () => menu.remove();
  setTimeout(() => {
    document.addEventListener('click', closeMenu, { once: true });
    document.addEventListener('keydown', closeMenu, { once: true });
    window.addEventListener('scroll', closeMenu, { once: true, capture: true });
  }, 0);
}

function initSidebarNewTabContextMenu() {
  document.querySelectorAll('[data-sidebar-route]').forEach(button => {
    button.addEventListener('contextmenu', event => showSidebarContextMenu(event, button.dataset.sidebarRoute));
  });
}

function applyRouteFromHash(options = {}) {
  const hash = decodeURIComponent(window.location.hash || '');
  let matched = false;
  if (hash === '#settings') {
    AppState.activeSource = 'browser';
    AppState.activePlatform = 'all';
    AppState.activeCollection = 'all';
    AppState.nextCursor = null;
    matched = true;
    openSettings();
  } else if (hash === '#bookmarks') {
    AppState.activeSource = 'browser';
    AppState.activePlatform = 'all';
    AppState.activeCollection = 'all';
    AppState.nextCursor = null;
    matched = true;
    closeSettings();
  } else if (hash.startsWith('#platform=')) {
    const platform = hash.slice('#platform='.length) || 'all';
    AppState.activeSource = 'social';
    AppState.activePlatform = platform;
    AppState.activeCollection = 'all';
    AppState.nextCursor = null;
    matched = true;
    closeSettings();
  }
  if (matched) {
    syncFilterSelects();
    updateSidebarNavigation();
    if (options.load && AppState.isServerConnected) loadData();
  }
  return matched;
}
function refreshLocalMetadataAndCounts() {
  processCollections();
  updateCollectionsFilterDropdown();
  processTags();
  renderTagCloud();
  applyFiltersAndSearch();
  refreshPlatformCounts();
}

registerActions('library-navigation', { processCollections, updateCollectionsFilterDropdown, processTags, renderTagCloud, filterByPlatform, filterByTag, syncFilterSelects, getCurrentCountSource, getLibraryCountGroup, normalizeCollectionKey, browserCategoryLabel, socialCategoryLabel, getLoadedCollectionCounts, getCategoryDefaultLabel, getCategoryContextFromPlatform, getCategoryCountsForContext, sortedCategoryItemsFromCounts, platformIconMarkup, getLoadedTagCounts, updateSidebarNavigation, setRouteHash, appUrlForRoute, showSidebarContextMenu, initSidebarNewTabContextMenu, applyRouteFromHash, refreshLocalMetadataAndCounts });
export { processCollections, updateCollectionsFilterDropdown, processTags, renderTagCloud, filterByPlatform, filterByTag, syncFilterSelects, getCurrentCountSource, getLibraryCountGroup, normalizeCollectionKey, browserCategoryLabel, socialCategoryLabel, getLoadedCollectionCounts, getCategoryDefaultLabel, getCategoryContextFromPlatform, getCategoryCountsForContext, sortedCategoryItemsFromCounts, platformIconMarkup, getLoadedTagCounts, updateSidebarNavigation, setRouteHash, appUrlForRoute, showSidebarContextMenu, initSidebarNewTabContextMenu, applyRouteFromHash, refreshLocalMetadataAndCounts };
