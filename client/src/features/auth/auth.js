import { AppState, DOM, POSTS_PER_PAGE } from '../../app/state.js';
import { actions, registerActions } from '../../app/actions.js';
import { ApiError } from '../../api/client.js';
import { socialFeedApi } from '../../api/socialfeed-api.js';

const applyFiltersAndSearch = (...args) => actions.applyFiltersAndSearch(...args);
const applyRouteFromHash = (...args) => actions.applyRouteFromHash(...args);
const checkDatabaseConnection = (...args) => actions.checkDatabaseConnection(...args);
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
    const member = document.getElementById('settings-member-since');
    if (name) name.textContent = profile.name || 'SocialFeed Owner';
    if (email) email.textContent = profile.email || 'Private account';
    if (member) member.textContent = profile.memberSince || 'Private account';
    return { authenticated: true, data };
  } catch (error) {
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

  retry?.addEventListener('click', async () => {
    retry.hidden = true;
    const loadingMessage = document.getElementById('auth-loading-message');
    if (loadingMessage) loadingMessage.textContent = 'Checking your session…';
    const session = await checkServerConnection();
    if (session.authenticated) await Promise.allSettled([checkDatabaseConnection(), refreshPlatformCounts(), loadData()]);
  });

  const setLoginSubmitting = (submitting) => {
    if (!loginSubmit) return;
    loginSubmit.disabled = submitting;
    loginSubmit.setAttribute('aria-busy', String(submitting));
    loginSubmit.innerHTML = submitting
      ? '<i class="app-icon icon-circle-notch icon-spin" aria-hidden="true"></i><span>Signing in...</span>'
      : '<span>Sign in</span>';
  };

  if (loginForm) loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (loginSubmit?.disabled) return;
    loginError.hidden = true;
    setLoginSubmitting(true);
    try {
      await socialFeedApi.login(loginEmail.value, loginPassword.value);
      loginEmail.value = '';
      loginPassword.value = '';
      const session = await checkServerConnection();
      if (session.authenticated) {
        AppState.activeSource = 'browser';
        AppState.activePlatform = 'all';
        AppState.activeCollection = 'all';
        applyRouteFromHash({ load: false });
        await Promise.allSettled([checkDatabaseConnection(), refreshPlatformCounts(), loadData()]);
      }
    } catch (error) {
      loginError.textContent = error?.message || 'Unable to sign in.';
      loginError.hidden = false;
    } finally {
      setLoginSubmitting(false);
    }
  });

  const logout = async () => {
    try { await socialFeedApi.logout(); } catch { /* Session is cleared locally either way. */ }
    AppState.bookmarks = [];
    AppState.nextCursor = null;
    AppState.databaseConnected = null;
    showPrivateLogin();
  };
  document.getElementById('btn-settings-logout')?.addEventListener('click', logout);
}

registerActions('auth', { updateAdminLoginUI, handleAdminLoginSubmit, showPrivateLogin, showAuthStartupError, checkServerConnection, initAuthEvents });
export { updateAdminLoginUI, handleAdminLoginSubmit, showPrivateLogin, showAuthStartupError, checkServerConnection, initAuthEvents };
