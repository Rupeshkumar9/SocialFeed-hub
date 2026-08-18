import { requestJSON } from './client.js';

const jsonHeaders = { 'Content-Type': 'application/json' };

export const socialFeedApi = {
  getSession: () => requestJSON('/api/auth/session', { cache: 'no-store' }),
  login: (email, password) => requestJSON('/api/auth/login', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ email, password }) }),
  logout: () => requestJSON('/api/auth/logout', { method: 'POST' }),
  getDatabaseStatus: () => requestJSON('/api/database/status', { cache: 'no-store', timeoutMs: 8000 }),
  getCounts: () => requestJSON('/api/counts', { cache: 'no-store' }),
  getExtensionDevices: () => requestJSON('/api/extension/devices', { cache: 'no-store' }),
  revokeExtensionDevices: () => requestJSON('/api/extension/revoke-all', { method: 'POST' }),
  renameCategory: payload => requestJSON('/api/categories/rename', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload) }),
  getBookmarks: (params, options = {}) => requestJSON('/api/load?' + params.toString(), options),
  getPublicProfile: username => requestJSON('/api/public-profile?username=' + encodeURIComponent(username), { cache: 'no-store' }),
  getPublicBookmarks: (username, params = {}) => {
    const query = new URLSearchParams({ username, ...params });
    return requestJSON('/api/public-bookmarks?' + query.toString(), { cache: 'no-store' });
  },
  getPublicProfileSettings: () => requestJSON('/api/public-profile-settings', { cache: 'no-store' }),
  savePublicProfileSettings: payload => requestJSON('/api/public-profile-settings', { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(payload) }),
  updateBookmarkVisibility: payload => requestJSON('/api/bookmark-visibility', { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify(payload) }),
};
