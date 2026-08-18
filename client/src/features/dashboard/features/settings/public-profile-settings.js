import { AppState } from '../../app/state.js';
import { actions, registerActions } from '../../app/actions.js';
import { socialFeedApi } from '../../api/socialfeed-api.js';

const showToast = (...args) => actions.showToast(...args);
const SOCIAL_PRESETS = {
  instagram: { label: 'Instagram', base: 'https://instagram.com/', icon: '◎' },
  x: { label: 'X', base: 'https://x.com/', icon: '𝕏' },
  threads: { label: 'Threads', base: 'https://threads.net/@', icon: '◎' },
  facebook: { label: 'Facebook', base: 'https://facebook.com/', icon: 'f' },
  tiktok: { label: 'TikTok', base: 'https://tiktok.com/@', icon: '♪' },
  whatsapp: { label: 'WhatsApp', base: 'https://wa.me/', icon: '◔' },
  telegram: { label: 'Telegram', base: 'https://t.me/', icon: '➤' },
  custom: { label: 'Custom site', base: '', icon: '↗' }
};

let profile = null;
function form() { return document.getElementById('public-profile-form'); }
function setStatus(message, error = false) { const status = document.getElementById('public-profile-status'); if (status) { status.textContent = message; status.className = error ? 'error' : ''; } }
function ensurePrivacyToggle() {
  const input = document.getElementById('public-profile-published') || document.getElementById('public-profile-private');
  if (!input) return null;
  input.id = 'public-profile-private';
  const label = input.closest('label');
  label?.classList.add('profile-private-toggle');
  const text = label?.querySelector('b');
  if (text) text.textContent = 'Make Private';
  return input;
}

function inferSocialLink(link = {}) {
  let platform = String(link.platform || '').toLowerCase();
  if (!SOCIAL_PRESETS[platform]) {
    try {
      const host = new URL(link.url).hostname.replace(/^www\./, '');
      platform = Object.entries(SOCIAL_PRESETS).find(([, preset]) => preset.base && host.includes(preset.base.replace(/^https:\/\//, '').split('/')[0]))?.[0] || 'custom';
    } catch { platform = 'custom'; }
  }
  let username = '';
  try { username = decodeURIComponent(new URL(link.url).pathname.split('/').filter(Boolean).pop() || '').replace(/^@/, ''); } catch { /* custom URL */ }
  return { platform, username, url: link.url || '' };
}

function socialUrlFor(row) {
  const platform = row.querySelector('[data-social-platform]')?.value || 'custom';
  const username = row.querySelector('[data-social-username]')?.value.trim().replace(/^@/, '') || '';
  if (platform === 'custom') return row.querySelector('[data-social-url]')?.value.trim() || '';
  return username ? SOCIAL_PRESETS[platform].base + encodeURIComponent(username) : '';
}

function updateSocialRow(row) {
  const platform = row.querySelector('[data-social-platform]')?.value || 'custom';
  const preset = SOCIAL_PRESETS[platform];
  const username = row.querySelector('[data-social-username]');
  const customUrl = row.querySelector('[data-social-url]');
  const preview = row.querySelector('[data-social-preview]');
  if (username) { username.hidden = platform === 'custom'; username.placeholder = `${preset.label} username`; }
  if (customUrl) { customUrl.hidden = platform !== 'custom'; customUrl.placeholder = 'https://your-site.example/profile'; }
  if (preview) preview.textContent = preset.icon;
}

function renderSocialLinks(links = []) {
  const host = document.getElementById('public-profile-social-links');
  if (!host) return;
  host.replaceChildren();
  const items = links.length ? links.map(inferSocialLink) : [{ platform: 'instagram', username: '', url: '' }];
  items.forEach(item => {
    const row = document.createElement('div'); row.className = 'public-social-row';
    row.innerHTML = `<span class="public-social-preview" data-social-preview aria-hidden="true"></span><select class="profile-select" data-social-platform aria-label="Social platform">${Object.entries(SOCIAL_PRESETS).map(([key, preset]) => `<option value="${key}">${preset.label}</option>`).join('')}</select><input data-social-username aria-label="Social username" type="text"><input data-social-url aria-label="Custom social URL" type="url"><button type="button" class="settings-inline-action" data-remove-social>Remove</button>`;
    row.querySelector('[data-social-platform]').value = item.platform;
    row.querySelector('[data-social-username]').value = item.username;
    row.querySelector('[data-social-url]').value = item.url;
    row.querySelector('[data-social-platform]').addEventListener('change', () => updateSocialRow(row));
    row.querySelector('[data-remove-social]').addEventListener('click', () => row.remove());
    updateSocialRow(row); host.appendChild(row);
  });
}

function collectSocialLinks() {
  return [...document.querySelectorAll('#public-profile-social-links .public-social-row')].map(row => {
    const platform = row.querySelector('[data-social-platform]').value;
    return { platform, label: SOCIAL_PRESETS[platform].label, url: socialUrlFor(row), enabled: true };
  }).filter(item => item.url);
}

function setAvatarPreview(value = '') {
  const preview = document.getElementById('public-profile-avatar-preview'); if (!preview) return;
  preview.replaceChildren();
  if (value) { const image = document.createElement('img'); image.src = value; image.alt = 'Profile picture preview'; preview.appendChild(image); }
  else preview.textContent = (document.getElementById('public-profile-display-name')?.value || 'R').trim().charAt(0).toUpperCase() || 'R';
}

function ensureAvatarPicker() {
  const input = document.getElementById('public-profile-avatar'); if (!input || input.dataset.pickerReady) return;
  input.dataset.pickerReady = 'true'; input.type = 'hidden';
  input.closest('label')?.childNodes[0] && (input.closest('label').childNodes[0].textContent = 'Profile picture');
  document.getElementById('public-profile-url')?.closest('small')?.remove();
  const picker = document.createElement('div'); picker.className = 'profile-avatar-picker';
  picker.innerHTML = `<span class="profile-avatar-preview" id="public-profile-avatar-preview">R</span><input id="public-profile-avatar-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif"><label for="public-profile-avatar-file" class="profile-avatar-upload"><i class="app-icon icon-image"></i><span>Upload image</span><small>PNG, JPG, WEBP · 2 MB max</small></label><button type="button" class="profile-avatar-remove" id="public-profile-avatar-remove">Remove</button>`;
  input.before(picker);
  picker.querySelector('#public-profile-avatar-file').addEventListener('change', event => {
    const file = event.target.files?.[0]; if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showToast('Profile picture must be 2 MB or smaller.', 'error'); event.target.value = ''; return; }
    const reader = new FileReader(); reader.onload = () => { input.value = String(reader.result || ''); setAvatarPreview(input.value); }; reader.readAsDataURL(file);
  });
  picker.querySelector('#public-profile-avatar-remove').addEventListener('click', () => { input.value = ''; picker.querySelector('#public-profile-avatar-file').value = ''; setAvatarPreview(''); });
  setAvatarPreview(input.value);
}

function collectProfile() {
  return { username: document.getElementById('public-profile-username').value.trim().toLowerCase(), displayName: document.getElementById('public-profile-display-name').value.trim(), bio: document.getElementById('public-profile-bio').value.trim(), avatarUrl: document.getElementById('public-profile-avatar').value.trim(), published: !document.getElementById('public-profile-private').checked, defaultTab: document.getElementById('public-profile-default-tab').value, theme: { background: document.getElementById('public-profile-theme').value, accent: '#f43f5e', buttonStyle: 'soft' }, socialLinks: collectSocialLinks() };
}
function updateUrl(username) { return `${location.origin}/${encodeURIComponent(username || 'socialfeed')}`; }

async function loadPublicProfileSettings() {
  if (!form()) return; ensureAvatarPicker(); const privacyToggle = ensurePrivacyToggle();
  try {
    profile = await socialFeedApi.getPublicProfileSettings(); const data = profile.profile || profile;
    AppState.publicProfileUsername = data.username || 'socialfeed';
    if (privacyToggle) privacyToggle.checked = !Boolean(data.published);
    document.getElementById('public-profile-username').value = data.username || 'socialfeed';
    document.getElementById('public-profile-display-name').value = data.displayName || '';
    document.getElementById('public-profile-avatar').value = data.avatarUrl || data.avatar || '';
    document.getElementById('public-profile-bio').value = data.bio || '';
    document.getElementById('public-profile-default-tab').value = data.defaultTab || 'links';
    document.getElementById('public-profile-theme').value = data.theme?.background || 'default';
    setAvatarPreview(document.getElementById('public-profile-avatar').value); renderSocialLinks(data.socialLinks || []);
    const counts = data.counts || profile.counts || {}; document.getElementById('public-profile-counts').textContent = `${counts.browser || 0} public links · ${counts.social || 0} public posts`;
  } catch (error) { setStatus(error?.message || 'Unable to load profile settings.', true); }
}

async function visitPublicProfile() {
  try { const result = await socialFeedApi.getPublicProfileSettings(); AppState.publicProfileUsername = (result.profile || result).username || 'socialfeed'; } catch { /* use last known username */ }
  window.open(updateUrl(AppState.publicProfileUsername), '_blank', 'noopener,noreferrer');
}

document.getElementById('public-profile-add-social')?.addEventListener('click', () => { const existing = [...document.querySelectorAll('#public-profile-social-links .public-social-row')].map(row => ({ platform: row.querySelector('[data-social-platform]').value, url: socialUrlFor(row) })); existing.push({ platform: 'instagram', url: '' }); renderSocialLinks(existing); });
document.getElementById('public-profile-username')?.addEventListener('input', event => { AppState.publicProfileUsername = event.target.value.trim().toLowerCase(); });
document.getElementById('public-profile-display-name')?.addEventListener('input', () => { if (!document.getElementById('public-profile-avatar').value) setAvatarPreview(''); });
document.getElementById('public-profile-preview')?.addEventListener('click', () => window.open(updateUrl(document.getElementById('public-profile-username').value), '_blank', 'noopener,noreferrer'));
document.getElementById('public-profile-copy')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(updateUrl(document.getElementById('public-profile-username').value)); showToast('Profile URL copied.', 'success'); } catch { setStatus('Copy was blocked by the browser.', true); } });
document.getElementById('public-profile-form')?.addEventListener('submit', async event => { event.preventDefault(); setStatus('Saving…'); const button = document.getElementById('public-profile-save'); button.disabled = true; try { profile = await socialFeedApi.savePublicProfileSettings(collectProfile()); setStatus('Profile saved.'); showToast('Public profile updated.', 'success'); await loadPublicProfileSettings(); } catch (error) { setStatus(error?.message || 'Unable to save profile.', true); } finally { button.disabled = false; } });

registerActions('public-profile-settings', { loadPublicProfileSettings, visitPublicProfile });
export { loadPublicProfileSettings, visitPublicProfile };
