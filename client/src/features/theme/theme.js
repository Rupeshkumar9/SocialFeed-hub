import { DOM } from '../../app/state.js';
import { registerActions } from '../../app/actions.js';

const THEME_KEY = 'socialfeed_theme';

function getTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function updateThemeButton() {
  if (!DOM.themeToggle) return;
  const dark = getTheme() === 'dark';
  DOM.themeToggle.setAttribute('aria-pressed', String(dark));
  DOM.themeToggle.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  DOM.themeToggle.title = dark ? 'Switch to light theme' : 'Switch to dark theme';
  DOM.themeToggle.innerHTML = `<i class="app-icon ${dark ? 'icon-sun' : 'icon-moon'}" aria-hidden="true"></i><span class="sr-only">${dark ? 'Switch to light theme' : 'Switch to dark theme'}</span>`;
}

function setTheme(theme, persist = true) {
  const next = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  document.documentElement.style.colorScheme = next;
  if (persist) localStorage.setItem(THEME_KEY, next);
  updateThemeButton();
  return next;
}

function toggleTheme() {
  return setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

function initTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  const preferred = stored === 'dark' || stored === 'light'
    ? stored
    : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  setTheme(preferred, false);
  DOM.themeToggle?.addEventListener('click', toggleTheme);
}

registerActions('theme', { getTheme, setTheme, toggleTheme, initTheme });
initTheme();

export { getTheme, setTheme, toggleTheme, initTheme };
