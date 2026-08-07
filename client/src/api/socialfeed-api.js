import { requestJSON } from './client.js';

const jsonHeaders = { 'Content-Type': 'application/json' };

export const socialFeedApi = {
  getSession: () => requestJSON('/api/auth/session', { cache: 'no-store' }),
  login: password => requestJSON('/api/auth/login', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ password }) }),
  logout: () => requestJSON('/api/auth/logout', { method: 'POST' }),
  getDatabaseStatus: () => requestJSON('/api/database/status', { cache: 'no-store', timeoutMs: 8000 }),
  getCounts: () => requestJSON('/api/counts', { cache: 'no-store' }),
  getBookmarks: params => requestJSON('/api/load?' + params.toString()),
};
