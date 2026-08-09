const params = new URLSearchParams(window.location.search);
const pairingId = params.get('pairingId') || '';
const secret = params.get('secret') || '';
const statusEl = document.getElementById('status');
const errorEl = document.getElementById('error');
const loginForm = document.getElementById('login-form');
const connectPanel = document.getElementById('connect-panel');
const loginSubmit = document.getElementById('login-submit');
const connectButton = document.getElementById('connect-button');

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = !message;
}

function setStatus(message, className = '') {
  statusEl.textContent = message;
  statusEl.className = `status ${className}`.trim();
}

async function request(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', ...options, headers: { Accept: 'application/json', ...(options.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
  return payload;
}

async function checkSession() {
  if (!pairingId || !secret) {
    setStatus('This pairing link is incomplete.', 'error');
    return false;
  }
  try {
    await request('/api/auth/session', { cache: 'no-store' });
    loginForm.hidden = true;
    connectPanel.hidden = false;
    setStatus('You are signed in.');
    return true;
  } catch (error) {
    if (error.message.includes('Authentication')) {
      loginForm.hidden = false;
      setStatus('Sign in to approve this extension.');
      return false;
    }
    setStatus('Unable to reach SocialFeed.', 'error');
    showError(error.message);
    return false;
  }
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  showError('');
  loginSubmit.disabled = true;
  try {
    await request('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: document.getElementById('email').value, password: document.getElementById('password').value }) });
    await checkSession();
  } catch (error) {
    showError(error.message);
  } finally {
    loginSubmit.disabled = false;
  }
});

connectButton.addEventListener('click', async () => {
  showError('');
  connectButton.disabled = true;
  setStatus('Connecting this extension…');
  try {
    await request('/api/extension/pair/authorize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pairingId, secret, label: `${navigator.platform || 'Browser'} extension` }) });
    setStatus('Extension connected successfully. You can close this tab.', 'success');
    connectPanel.hidden = true;
  } catch (error) {
    showError(error.message);
    setStatus('Connection was not completed.', 'error');
    connectButton.disabled = false;
  }
});

checkSession();
