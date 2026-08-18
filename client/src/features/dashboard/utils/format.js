import { AppState, DOM, POSTS_PER_PAGE } from '../app/state.js';
import { actions, registerActions } from '../app/actions.js';

function getBookmarkDateMs(bm, fields) {
  for (const field of fields) {
    const value = bm && bm[field];
    if (!value) continue;
    const ms = new Date(value).getTime();
    if (!Number.isNaN(ms)) return ms;
  }
  return 0;
}

const KNOWN_SOCIAL_PLATFORMS = Object.freeze(['instagram', 'x', 'threads', 'reddit', 'facebook', 'youtube']);

function normalizePlatformSlug(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return normalized === 'twitter' ? 'x' : normalized;
}

function isKnownSocialPlatform(platform) {
  return KNOWN_SOCIAL_PLATFORMS.includes(normalizePlatformSlug(platform));
}

function defaultAuthorNameForPlatform(platform, customName = '') {
  return platform === 'x' ? 'X User' :
    platform === 'instagram' ? 'Instagram Creator' :
    platform === 'threads' ? 'Threads Creator' :
    platform === 'reddit' ? 'Reddit User' :
    platform === 'youtube' ? 'YouTube Creator' :
    platform === 'browser' ? 'Saved Link' :
    platform === 'facebook' ? 'Facebook User' :
    `${customName || platformLabel(platform)} Creator`;
}

function platformLabel(platform, customName = '') {
  const labels = {
    all: 'All Bookmarks',
    x: 'X / Twitter',
    instagram: 'Instagram',
    threads: 'Threads',
    reddit: 'Reddit',
    facebook: 'Facebook',
    youtube: 'YouTube',
    browser: 'Browser Bookmark',
    web: 'Web'
  };
  if (customName) return customName;
  const libraryLabel = AppState.libraryCounts?.platformLabels?.[platform];
  if (libraryLabel) return libraryLabel;
  return labels[platform] || String(platform || 'Platform')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}


function getInstagramFallbackGradient(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue1 = Math.abs(hash % 360);
  const hue2 = (hue1 + 45) % 360;
  return `linear-gradient(135deg, hsl(${hue1}, 85%, 93%) 0%, hsl(${hue2}, 90%, 97%) 100%)`;
}


function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Global Event Listeners Registration
 */

function formatDate(isoString) {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'Recently';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (e) {
    return 'Recently';
  }
}

/**
 * Escaping utility helper to prevent XSS issues
 */
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g,
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

registerActions('format', { getBookmarkDateMs, defaultAuthorNameForPlatform, platformLabel, normalizePlatformSlug, isKnownSocialPlatform, getInstagramFallbackGradient, debounce, formatDate, escapeHTML });
export { KNOWN_SOCIAL_PLATFORMS, getBookmarkDateMs, defaultAuthorNameForPlatform, platformLabel, normalizePlatformSlug, isKnownSocialPlatform, getInstagramFallbackGradient, debounce, formatDate, escapeHTML };
