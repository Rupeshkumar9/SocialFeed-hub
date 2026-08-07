import './styles/main.css';
import './ui/icons.js';

import './utils/format.js';
import './ui/feedback.js';
import './features/library/navigation.js';
import './features/feed/filters.js';
import './features/feed/bookmark-card.js';
import './features/feed/feed-view.js';
import './features/analytics/analytics.js';
import './features/bookmarks/media.js';
import './features/import/import-controller.js';
import './features/bookmarks/editor.js';
import './features/bookmarks/selection.js';
import './features/settings/settings.js';
import './app/events.js';
import './features/auth/auth.js';
import './features/feed/data-controller.js';
import { bootstrapApp } from './app/bootstrap.js';

bootstrapApp().catch(error => {
  console.error('SocialFeed Hub failed to start:', error);
  document.body.classList.add('auth-pending');
  const message = document.getElementById('private-login-error');
  if (message) {
    message.hidden = false;
    message.textContent = 'The dashboard could not start. Refresh the page to try again.';
  }
});
