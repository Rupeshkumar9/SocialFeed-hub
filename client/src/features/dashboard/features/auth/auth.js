import { AppState, DOM, POSTS_PER_PAGE } from '../../app/state.js';
import { actions, registerActions } from '../../app/actions.js';
import { ApiError } from '../../api/client.js';
import { socialFeedApi } from '../../api/socialfeed-api.js';

const applyFiltersAndSearch = (...args) => actions.applyFiltersAndSearch(...args);
const applyRouteFromHash = (...args) => actions.applyRouteFromHash(...args);
const checkDatabaseConnection = (...args) => actions.checkDatabaseConnection(...args);
const invalidateFeedCache = (...args) => actions.invalidateFeedCache(...args);
const loadData = (...args) => actions.loadData(...args);
const refreshPlatformCounts = (...args) => actions.refreshPlatformCounts(...args);
const showToast = (...args) => actions.showToast(...args);
const updateSyncStatusUI = (...args) => actions.updateSyncStatusUI(...args);

function updateAdminLoginUI(isAdmin) {
  if (!DOM.btnAdminLogin) return;
  if (!AppState.isServerConnected) {
    DOM.btnAdminLogin.innerHTML = `<i class="app-icon icon-user-gear"></i> <span class="btn-text">Admin Mode</span>`;
    DOM.btnAdminLogin.title = "Offline mode - all editing controls are enabled";
    DOM.btnAdminLogin.style.display = 'inline-flex';
    return;
  }
  DOM.btnAdminLogin.style.display = 'inline-flex';
  if (isAdmin) {
    DOM.btnAdminLogin.innerHTML = `<i class="app-icon icon-lock-open"></i> <span class="btn-text">Logout</span>`;
    DOM.btnAdminLogin.title = "Log out from Admin session";
  } else {
    DOM.btnAdminLogin.innerHTML = `<i class="app-icon icon-lock"></i> <span class="btn-text">Admin Login</span>`;
    DOM.btnAdminLogin.title = "Admin Login";
  }
}

function updateDashboardAccount(profile = {}) {
  const name = document.getElementById('dashboard-account-name');
  const username = document.getElementById('dashboard-account-username');
  const avatar = document.getElementById('dashboard-account-avatar');
  const displayName = profile.displayName || profile.name || 'SocialFeed Owner';
  const handle = String(profile.username || 'socialfeed').trim().toLowerCase();
  if (name) name.textContent = displayName;
  if (username) username.textContent = `@${handle}`;
  if (avatar) {
    const image = avatar.querySelector('img');
    const fallback = avatar.querySelector('.public-account-avatar-fallback');
    const hasAvatar = Boolean(profile.avatarUrl);
    if (image) {
      image.src = profile.avatarUrl || '/favicon.svg';
      image.alt = profile.displayName ? `${displayName} profile` : '';
      image.hidden = !hasAvatar;
    }
    if (fallback) {
      fallback.textContent = displayName.trim().charAt(0).toUpperCase() || 'S';
      fallback.hidden = hasAvatar;
    }
  }
  const visitProfile = document.getElementById('btn-dashboard-visit-profile');
  if (visitProfile) visitProfile.href = `/u/${encodeURIComponent(handle)}`;
}

async function logout() {
  try { await socialFeedApi.logout(); } catch { /* Session is cleared locally either way. */ }
  invalidateFeedCache();
  AppState.bookmarks = [];
  AppState.nextCursor = null;
  AppState.databaseConnected = null;
  showPrivateLogin();
}

/**
 * Handle Admin authentication form submission
 */
function handleAdminLoginSubmit(e) {
  e.preventDefault();
  const password = DOM.loginPassword.value;
  if (!password) return;

  showToast("Authenticating...");

  fetch('/api/status', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${password}`
    },
    cache: 'no-store'
  })
    .then(res => res.json())
    .then(data => {
      if (data && data.status === 'ok' && data.isAdmin) {
        AppState.isAdmin = true;
        document.body.classList.remove('visitor-mode');
        updateAdminLoginUI(true);
        DOM.loginModalOverlay.classList.remove('active');
        applyFiltersAndSearch();
        showToast("Authenticated successfully as Admin!", "success");
      } else {
        showToast("Invalid admin password.", "error");
      }
    })
    .catch(err => {
      console.error("Authentication check failed:", err);
      showToast("Authentication request failed.", "error");
    });
}

function showPrivateLogin(message) {
  document.body.classList.remove('auth-checking');
  document.body.classList.add("auth-required");
  document.body.classList.remove("visitor-mode");
  AppState.isAdmin = false;
  AppState.isServerConnected = false;
  const error = document.getElementById("private-login-error");
  if (error) { error.hidden = !message; error.textContent = message || ""; }
}

function showAuthStartupError(message = 'Unable to verify your private session.') {
  document.body.classList.remove('auth-required');
  document.body.classList.add('auth-checking');
  const loadingMessage = document.getElementById('auth-loading-message');
  const retry = document.getElementById('auth-retry');
  if (loadingMessage) loadingMessage.textContent = message;
  if (retry) retry.hidden = false;
}

async function checkServerConnection() {
  try {
    const data = await socialFeedApi.getSession();
    AppState.isServerConnected = true;
    AppState.isAdmin = true;
    applyRouteFromHash({ load: false });
    document.body.classList.remove('auth-checking', 'auth-required', 'visitor-mode');
    updateSyncStatusUI(true);
    const profile = data?.profile || {};
    const name = document.getElementById('settings-profile-name');
    const email = document.getElementById('settings-profile-email');
    const nameInput = document.getElementById('settings-profile-name-input');
    const emailInput = document.getElementById('settings-profile-email-input');
    const member = document.getElementById('settings-member-since');
    if (name) name.textContent = profile.name || 'SocialFeed Owner';
    if (email) email.textContent = profile.email || 'Private account';
    if (nameInput) nameInput.value = profile.name || 'SocialFeed Owner';
    if (emailInput) emailInput.value = profile.email || '';
    if (member) member.textContent = profile.memberSince || 'Private account';
    const username = String(profile.username || '').trim().toLowerCase();
    updateDashboardAccount(profile);
    if (username) AppState.publicProfileUsername = username;
    return { authenticated: true, data };
  } catch (error) {
    updateSyncStatusUI(false, error instanceof ApiError && error.status === 401 ? 'Session Required' : 'Server Offline');
    if (error instanceof ApiError && error.status === 401) showPrivateLogin();
    else showAuthStartupError();
    return { authenticated: false, error };
  }
}

function initAuthEvents() {
  const loginForm = document.getElementById('private-login-form');
  const loginEmail = document.getElementById('private-login-email');
  const loginPassword = document.getElementById('private-login-password');
  const loginError = document.getElementById('private-login-error');
  const loginSubmit = document.getElementById('private-login-submit');
  const retry = document.getElementById('auth-retry');
  const authForm = loginForm;
  const authTitle = document.getElementById('auth-form-title');
  const authDescription = document.getElementById('auth-form-description');
  const modeLogin = document.getElementById('auth-mode-login');
  const modeSignup = document.getElementById('auth-mode-signup');
  const displayNameInput = document.getElementById('private-login-display-name');
  const displayNameLabel = document.getElementById('private-login-display-name-label');
  const usernameInput = document.getElementById('private-login-username');
  const usernameLabel = document.getElementById('private-login-username-label');
  let authMode = 'login';

  const setAuthMode = (mode) => {
    authMode = mode === 'signup' ? 'signup' : 'login';
    const signup = authMode === 'signup';
    authForm?.setAttribute('data-auth-mode', authMode);
    modeLogin?.classList.toggle('active', !signup);
    modeSignup?.classList.toggle('active', signup);
    if (authTitle) authTitle.textContent = signup ? 'Create your workspace' : 'Welcome back';
    if (authDescription) authDescription.textContent = signup ? 'Create an account to save and organize your own web.' : 'Sign in to open your SocialFeed Hub workspace.';
    if (displayNameInput) displayNameInput.hidden = !signup;
    if (displayNameLabel) displayNameLabel.hidden = !signup;
    if (usernameInput) usernameInput.hidden = !signup;
    if (usernameLabel) usernameLabel.hidden = !signup;
    if (displayNameInput) displayNameInput.required = signup;
    if (usernameInput) usernameInput.required = signup;
    if (loginPassword) loginPassword.autocomplete = signup ? 'new-password' : 'current-password';
    if (loginSubmit) loginSubmit.querySelector('span').textContent = signup ? 'Create account' : 'Sign in';
  };
  modeLogin?.addEventListener('click', () => setAuthMode('login'));
  modeSignup?.addEventListener('click', () => setAuthMode('signup'));
  setAuthMode('login');

  retry?.addEventListener('click', async () => {
    retry.hidden = true;
    const loadingMessage = document.getElementById('auth-loading-message');
    if (loadingMessage) loadingMessage.textContent = 'Checking your session…';
    const session = await checkServerConnection();
    if (session.authenticated) await Promise.allSettled([checkDatabaseConnection(), refreshPlatformCounts(), loadData({ navigation: true })]);
  });

  const setLoginSubmitting = (submitting) => {
    if (!loginSubmit) return;
    loginSubmit.disabled = submitting;
    loginSubmit.setAttribute('aria-busy', String(submitting));
    loginSubmit.innerHTML = submitting
      ? '<i class="app-icon icon-circle-notch icon-spin" aria-hidden="true"></i><span>Signing in...</span>'
      : `<span>${authMode === 'signup' ? 'Create account' : 'Sign in'}</span>`;
  };

  if (loginForm) loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (loginSubmit?.disabled) return;
    loginError.hidden = true;
    setLoginSubmitting(true);
    try {
      if (authMode === 'signup') {
        await socialFeedApi.signup({ email: loginEmail.value, password: loginPassword.value, displayName: displayNameInput.value, username: usernameInput.value });
      } else {
        await socialFeedApi.login(loginEmail.value, loginPassword.value);
      }
      loginEmail.value = '';
      loginPassword.value = '';
      const session = await checkServerConnection();
      if (session.authenticated) {
        if (window.location.pathname === '/login') {
          const requestedPath = new URLSearchParams(window.location.search).get('returnTo') || '/dashboard';
          const destination = requestedPath.startsWith('/') && !requestedPath.startsWith('//')
            ? requestedPath
            : '/dashboard';
          window.location.assign(destination);
          return;
        }
        AppState.activeSource = 'browser';
        AppState.activePlatform = 'all';
        AppState.activeCollection = 'all';
        applyRouteFromHash({ load: false });
        await Promise.allSettled([checkDatabaseConnection(), refreshPlatformCounts(), loadData({ navigation: true })]);
      }
    } catch (error) {
      loginError.textContent = error?.message || 'Unable to sign in.';
      loginError.hidden = false;
    } finally {
      setLoginSubmitting(false);
    }
  });

  document.getElementById('btn-settings-logout')?.addEventListener('click', logout);
  document.getElementById('btn-dashboard-logout')?.addEventListener('click', logout);
}

registerActions('auth', { updateAdminLoginUI, handleAdminLoginSubmit, showPrivateLogin, showAuthStartupError, checkServerConnection, initAuthEvents, logout });
export { updateAdminLoginUI, handleAdminLoginSubmit, showPrivateLogin, showAuthStartupError, checkServerConnection, initAuthEvents, logout, updateDashboardAccount };
