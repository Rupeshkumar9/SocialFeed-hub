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

function renderShopLinks(links = []) {
  const host = document.getElementById('public-profile-shop-links');
  if (!host) return;
  host.replaceChildren();
  const items = links.length ? links : [{ title: '', url: '', description: '', thumbnail: '', price: '', merchant: '' }];
  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'public-shop-row';
    row.innerHTML = `<div class="public-shop-row-heading"><span class="public-shop-row-icon">✦</span><strong>Shop pick</strong><button type="button" class="settings-inline-action" data-remove-shop>Remove</button></div><div class="public-shop-row-fields"><input data-shop-title aria-label="Shop title" placeholder="Product or tool name" maxlength="120"><input data-shop-url aria-label="Shop URL" type="url" placeholder="https://…"><input data-shop-merchant aria-label="Merchant" placeholder="Brand or store"><input data-shop-price aria-label="Price" placeholder="$29"><input data-shop-thumbnail aria-label="Thumbnail URL" type="url" placeholder="Thumbnail image URL"><textarea data-shop-description aria-label="Shop description" placeholder="Why you recommend it" maxlength="220" rows="2"></textarea></div>`;
    row.querySelector('[data-shop-title]').value = item.title || '';
    row.querySelector('[data-shop-url]').value = item.url || '';
    row.querySelector('[data-shop-merchant]').value = item.merchant || '';
    row.querySelector('[data-shop-price]').value = item.price || '';
    row.querySelector('[data-shop-thumbnail]').value = item.thumbnail || '';
    row.querySelector('[data-shop-description]').value = item.description || '';
    row.querySelector('[data-remove-shop]').addEventListener('click', () => row.remove());
    host.appendChild(row);
  });
}

function collectShopLinks() {
  return [...document.querySelectorAll('#public-profile-shop-links .public-shop-row')].map(row => ({
    title: row.querySelector('[data-shop-title]')?.value.trim() || '',
    url: row.querySelector('[data-shop-url]')?.value.trim() || '',
    merchant: row.querySelector('[data-shop-merchant]')?.value.trim() || '',
    price: row.querySelector('[data-shop-price]')?.value.trim() || '',
    thumbnail: row.querySelector('[data-shop-thumbnail]')?.value.trim() || '',
    description: row.querySelector('[data-shop-description]')?.value.trim() || ''
  })).filter(item => item.title && item.url);
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
  return { username: document.getElementById('public-profile-username').value.trim().toLowerCase(), displayName: document.getElementById('public-profile-display-name').value.trim(), bio: document.getElementById('public-profile-bio').value.trim(), avatarUrl: document.getElementById('public-profile-avatar').value.trim(), published: !document.getElementById('public-profile-private').checked, defaultTab: document.getElementById('public-profile-default-tab').value, theme: { background: document.getElementById('public-profile-theme').value, accent: '#f43f5e', buttonStyle: 'soft' }, socialLinks: collectSocialLinks(), shopLinks: collectShopLinks() };
}
function updateUrl(username) { return `${location.origin}/u/${encodeURIComponent(username || 'socialfeed')}`; }
function updateUrlHint(username) {
  const hint = document.getElementById('public-profile-url');
  if (hint) hint.textContent = `/u/${encodeURIComponent(username || 'socialfeed')}`;
}

let publicManagerItems = [];
let publicManagerSource = 'browser';

function managerTitle(item = {}) {
  return item.publicTitle || item.authorName || item.siteName || item.title || item.content || item.url || 'Untitled public item';
}

function managerHost(url = '') {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'saved item'; }
}

function updatePublicContentCounts(data = {}) {
  const counts = data.counts || profile?.counts || {};
  const shopCount = (data.shopLinks || profile?.profile?.shopLinks || profile?.shopLinks || []).length;
  const values = {
    'public-profile-counts': `${counts.browser || 0} public links · ${counts.social || 0} public posts · ${shopCount} shop picks`,
    'public-links-count': counts.browser || 0,
    'public-posts-count': counts.social || 0,
    'public-shop-count': shopCount
  };
  Object.entries(values).forEach(([id, value]) => { const element = document.getElementById(id); if (element) element.textContent = String(value); });
}

function setProfileMode(mode = 'content') {
  const selected = mode === 'edit' ? 'edit' : 'content';
  document.querySelectorAll('[data-profile-mode]').forEach(button => {
    const active = button.dataset.profileMode === selected;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('[data-profile-mode-panel]').forEach(panel => { panel.hidden = panel.dataset.profileModePanel !== selected; });
}

function publicManagerElements() {
  return {
    overlay: document.getElementById('public-manager-modal-overlay'),
    list: document.getElementById('public-manager-list'),
    empty: document.getElementById('public-manager-empty'),
    title: document.getElementById('public-manager-modal-title'),
    subtitle: document.getElementById('public-manager-modal-subtitle'),
    total: document.getElementById('public-manager-total'),
    totalLabel: document.getElementById('public-manager-total-label'),
    published: document.getElementById('public-manager-published'),
    private: document.getElementById('public-manager-private'),
    status: document.getElementById('public-manager-status'),
    editShop: document.getElementById('public-manager-go-edit')
  };
}

function setManagerStatus(message = '', error = false) {
  const status = publicManagerElements().status;
  if (status) { status.textContent = message; status.className = error ? 'error' : ''; }
}

function renderPublicManager(items = [], source = 'browser') {
  const elements = publicManagerElements();
  if (!elements.list) return;
  elements.list.replaceChildren();
  const isShop = source === 'shop';
  const title = isShop ? 'Manage shop picks' : source === 'social' ? 'Manage public posts' : 'Manage public links';
  const label = isShop ? 'shop picks' : source === 'social' ? 'social posts' : 'links';
  if (elements.title) elements.title.textContent = title;
  if (elements.subtitle) elements.subtitle.textContent = isShop ? 'Review the recommendations displayed in your Shop tab.' : 'Choose what visitors can see and polish the details shown on your public profile.';
  if (elements.totalLabel) elements.totalLabel.textContent = `public ${label}`;
  const profileData = profile?.profile || profile || {};
  const sharedCount = isShop ? items.length : source === 'social' ? Number(profileData.counts?.social || 0) : Number(profileData.counts?.browser || 0);
  if (elements.total) elements.total.textContent = String(sharedCount || items.filter(item => item.visibility === 'public').length);
  if (elements.published) elements.published.textContent = String(isShop ? items.length : items.filter(item => item.visibility === 'public').length);
  if (elements.private) elements.private.textContent = String(isShop ? 0 : items.filter(item => item.visibility !== 'public').length);
  if (elements.editShop) elements.editShop.hidden = !isShop;
  elements.empty.hidden = items.length > 0;
  if (!items.length) return;

  items.forEach((item, index) => {
    const row = document.createElement('article');
    row.className = 'public-manager-item';
    if (isShop) row.classList.add('is-shop');
    row.dataset.managerId = item.id || `shop_${index + 1}`;
    const titleText = isShop ? item.title : managerTitle(item);
    const description = isShop ? (item.description || 'Recommended shop pick') : (item.publicDescription || item.content || 'No public description yet.');
    const image = isShop ? item.thumbnail : (item.thumbnail || item.favicon);
    if (isShop) {
      row.innerHTML = `<div class="public-manager-item-media">${image ? '<img data-manager-image alt="" loading="lazy">' : '<span class="public-manager-image-fallback">✦</span>'}</div><div class="public-manager-item-copy"><div class="public-manager-item-meta"><span data-manager-merchant></span><strong data-manager-price></strong></div><strong class="public-manager-item-title"></strong><p></p><small data-manager-shop-host></small></div><button type="button" class="settings-inline-action public-manager-edit-shop">Edit</button>`;
      row.querySelector('.public-manager-item-title').textContent = titleText;
      row.querySelector('p').textContent = description;
      row.querySelector('[data-manager-merchant]').textContent = item.merchant || 'Shop pick';
      row.querySelector('[data-manager-price]').textContent = item.price || '';
      row.querySelector('[data-manager-shop-host]').textContent = managerHost(item.url);
    } else {
      row.innerHTML = `<div class="public-manager-item-media"><span class="public-manager-image-fallback">↗</span><img data-manager-image alt="" loading="lazy" hidden></div><div class="public-manager-item-copy"><div class="public-manager-item-meta"><span data-manager-source-label></span><label class="public-manager-visibility"><input type="checkbox" data-manager-visibility><span></span><b>Public</b></label></div><strong class="public-manager-item-title"></strong><small class="public-manager-item-url"></small><div class="public-manager-fields"><label>Public title<input type="text" data-manager-title maxlength="160"></label><label>Thumbnail URL<input type="url" data-manager-thumbnail placeholder="https://image.example/thumb.jpg"></label><label class="full-width">Public description<textarea data-manager-description maxlength="280" rows="2" placeholder="A short reason to click…"></textarea></label></div><div class="public-manager-item-actions"><button type="button" class="btn-primary" data-manager-save>Save item</button><a data-manager-open target="_blank" rel="noopener noreferrer">Open original ↗</a></div></div>`;
      row.querySelector('[data-manager-source-label]').textContent = item.platformName || item.platform || (source === 'social' ? 'Saved post' : managerHost(item.url));
      row.querySelector('.public-manager-item-title').textContent = titleText;
      row.querySelector('.public-manager-item-url').textContent = managerHost(item.url);
      row.querySelector('[data-manager-title]').value = item.publicTitle || titleText;
      row.querySelector('[data-manager-thumbnail]').value = item.thumbnail || '';
      row.querySelector('[data-manager-description]').value = item.publicDescription || '';
      row.querySelector('[data-manager-visibility]').checked = item.visibility === 'public';
      row.querySelector('[data-manager-open]').href = item.url || '#';
      row.querySelector('[data-manager-save]').addEventListener('click', async () => {
        const button = row.querySelector('[data-manager-save]');
        button.disabled = true; setManagerStatus('Saving item…');
        try {
          const result = await socialFeedApi.updateBookmarkVisibility({
            ids: [item.id],
            visibility: row.querySelector('[data-manager-visibility]').checked ? 'public' : 'private',
            publicTitle: row.querySelector('[data-manager-title]').value.trim(),
            publicDescription: row.querySelector('[data-manager-description]').value.trim(),
            thumbnail: row.querySelector('[data-manager-thumbnail]').value.trim(),
            publicOrder: index * 10
          });
          item.visibility = row.querySelector('[data-manager-visibility]').checked ? 'public' : 'private';
          item.publicTitle = row.querySelector('[data-manager-title]').value.trim();
          item.publicDescription = row.querySelector('[data-manager-description]').value.trim();
          item.thumbnail = row.querySelector('[data-manager-thumbnail]').value.trim();
          if (profile) { const profileData = profile.profile || profile; profileData.counts = result.counts || profileData.counts; updatePublicContentCounts(profileData); }
          setManagerStatus('Item updated.'); showToast('Public item updated.', 'success'); renderPublicManager(publicManagerItems, publicManagerSource);
        } catch (error) { setManagerStatus(error?.message || 'Unable to update item.', true); } finally { button.disabled = false; }
      });
    }
    const imageElement = row.querySelector('[data-manager-image]');
    if (imageElement && image) { imageElement.src = image; imageElement.hidden = false; row.querySelector('.public-manager-image-fallback')?.setAttribute('hidden', ''); imageElement.addEventListener('error', () => { imageElement.hidden = true; row.querySelector('.public-manager-image-fallback')?.removeAttribute('hidden'); }, { once: true }); }
    row.querySelector('.public-manager-edit-shop')?.addEventListener('click', () => { closePublicManager(); setProfileMode('edit'); });
    elements.list.appendChild(row);
  });
}

async function loadPublicManagerItems(source = publicManagerSource) {
  publicManagerSource = source;
  setManagerStatus('Loading…');
  try {
    const data = profile?.profile || profile || await socialFeedApi.getPublicProfileSettings();
    if (source === 'shop') publicManagerItems = data.shopLinks || [];
    else {
      const result = await socialFeedApi.getBookmarks(new URLSearchParams({ source, limit: '60' }));
      publicManagerItems = Array.isArray(result) ? result : (result?.bookmarks || []);
    }
    renderPublicManager(publicManagerItems, source); setManagerStatus('');
  } catch (error) { publicManagerItems = []; renderPublicManager([], source); setManagerStatus(error?.message || 'Unable to load public items.', true); }
}

async function openPublicManager(source = 'browser') {
  const elements = publicManagerElements();
  if (!elements.overlay) return;
  document.querySelectorAll('[data-public-manager-tab]').forEach(tab => { const active = tab.dataset.publicManagerTab === source; tab.classList.toggle('is-active', active); tab.setAttribute('aria-selected', String(active)); });
  elements.overlay.querySelector('.public-manager-modal-box')?.scrollTo(0, 0);
  elements.list?.scrollTo(0, 0);
  elements.overlay.hidden = false; elements.overlay.classList.add('active');
  await loadPublicManagerItems(source);
}

function closePublicManager() {
  const overlay = publicManagerElements().overlay;
  if (!overlay) return;
  overlay.classList.remove('active'); window.setTimeout(() => { overlay.hidden = true; }, 180);
}

async function loadPublicProfileSettings() {
  if (!form()) return; ensureAvatarPicker(); const privacyToggle = ensurePrivacyToggle();
  try {
    profile = await socialFeedApi.getPublicProfileSettings(); const data = profile.profile || profile;
    const visitLink = document.getElementById('btn-dashboard-visit-profile');
    const usernameInput = document.getElementById('public-profile-username');
    const hrefUsername = visitLink?.getAttribute('href')?.split('/').filter(Boolean).pop();
    const resolvedUsername = data.username || hrefUsername || 'socialfeed';
    AppState.publicProfileUsername = resolvedUsername;
    if (visitLink) visitLink.href = updateUrl(resolvedUsername);
    if (privacyToggle) privacyToggle.checked = !Boolean(data.published);
    if (usernameInput) usernameInput.value = resolvedUsername;
    updateUrlHint(resolvedUsername);
    document.getElementById('public-profile-display-name').value = data.displayName || '';
    document.getElementById('public-profile-avatar').value = data.avatarUrl || data.avatar || '';
    document.getElementById('public-profile-bio').value = data.bio || '';
    document.getElementById('public-profile-default-tab').value = ['links', 'posts', 'shop'].includes(data.defaultTab) ? data.defaultTab : 'links';
    document.getElementById('public-profile-theme').value = data.theme?.background || 'default';
    setAvatarPreview(document.getElementById('public-profile-avatar').value); renderSocialLinks(data.socialLinks || []); renderShopLinks(data.shopLinks || []);
    updatePublicContentCounts(data);
  } catch (error) { setStatus(error?.message || 'Unable to load profile settings.', true); }
}

async function visitPublicProfile(linkElement) {
  try { const result = await socialFeedApi.getPublicProfileSettings(); AppState.publicProfileUsername = (result.profile || result).username || 'socialfeed'; } catch { /* use last known username */ }
  const url = updateUrl(AppState.publicProfileUsername);
  if (linkElement) linkElement.href = url;
  window.open(url, '_blank', 'noopener,noreferrer');
}

document.getElementById('public-profile-add-social')?.addEventListener('click', () => { const existing = [...document.querySelectorAll('#public-profile-social-links .public-social-row')].map(row => ({ platform: row.querySelector('[data-social-platform]').value, url: socialUrlFor(row) })); existing.push({ platform: 'instagram', url: '' }); renderSocialLinks(existing); });
document.getElementById('public-profile-add-shop')?.addEventListener('click', () => {
  const existing = [...document.querySelectorAll('#public-profile-shop-links .public-shop-row')].map(row => ({ title: row.querySelector('[data-shop-title]').value, url: row.querySelector('[data-shop-url]').value, merchant: row.querySelector('[data-shop-merchant]').value, price: row.querySelector('[data-shop-price]').value, thumbnail: row.querySelector('[data-shop-thumbnail]').value, description: row.querySelector('[data-shop-description]').value }));
  existing.push({ title: '', url: '', merchant: '', price: '', thumbnail: '', description: '' }); renderShopLinks(existing);
});
document.querySelectorAll('[data-profile-mode]').forEach(button => button.addEventListener('click', () => setProfileMode(button.dataset.profileMode)));
document.querySelectorAll('[data-profile-mode-jump]').forEach(button => button.addEventListener('click', () => setProfileMode(button.dataset.profileModeJump)));
document.getElementById('btn-manage-public-content')?.addEventListener('click', () => openPublicManager('browser'));
document.getElementById('btn-manage-public-links')?.addEventListener('click', () => openPublicManager('browser'));
document.getElementById('btn-manage-public-posts')?.addEventListener('click', () => openPublicManager('social'));
document.getElementById('btn-manage-public-shop')?.addEventListener('click', () => openPublicManager('shop'));
document.querySelectorAll('[data-public-manager-tab]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-public-manager-tab]').forEach(tab => { const active = tab === button; tab.classList.toggle('is-active', active); tab.setAttribute('aria-selected', String(active)); });
  loadPublicManagerItems(button.dataset.publicManagerTab || 'browser');
}));
document.getElementById('close-public-manager-modal')?.addEventListener('click', closePublicManager);
document.getElementById('public-manager-done')?.addEventListener('click', closePublicManager);
document.getElementById('public-manager-go-edit')?.addEventListener('click', () => { closePublicManager(); setProfileMode('edit'); });
document.getElementById('public-manager-modal-overlay')?.addEventListener('click', event => { if (event.target?.id === 'public-manager-modal-overlay') closePublicManager(); });
document.getElementById('public-profile-username')?.addEventListener('input', event => { AppState.publicProfileUsername = event.target.value.trim().toLowerCase(); updateUrlHint(AppState.publicProfileUsername); });
document.getElementById('public-profile-display-name')?.addEventListener('input', () => { if (!document.getElementById('public-profile-avatar').value) setAvatarPreview(''); });
document.getElementById('public-profile-preview')?.addEventListener('click', () => window.open(updateUrl(document.getElementById('public-profile-username').value), '_blank', 'noopener,noreferrer'));
document.getElementById('public-profile-copy')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(updateUrl(document.getElementById('public-profile-username').value)); showToast('Profile URL copied.', 'success'); } catch { setStatus('Copy was blocked by the browser.', true); } });
document.getElementById('public-profile-preview-content')?.addEventListener('click', () => window.open(updateUrl(document.getElementById('public-profile-username').value), '_blank', 'noopener,noreferrer'));
document.getElementById('public-profile-copy-content')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(updateUrl(document.getElementById('public-profile-username').value)); showToast('Profile URL copied.', 'success'); } catch { setManagerStatus('Copy was blocked by the browser.', true); } });
document.getElementById('public-profile-form')?.addEventListener('submit', async event => { event.preventDefault(); setStatus('Saving…'); const button = document.getElementById('public-profile-save'); button.disabled = true; try { profile = await socialFeedApi.savePublicProfileSettings(collectProfile()); setStatus('Profile saved.'); showToast('Public profile updated.', 'success'); await loadPublicProfileSettings(); } catch (error) { setStatus(error?.message || 'Unable to save profile.', true); } finally { button.disabled = false; } });

registerActions('public-profile-settings', { loadPublicProfileSettings, visitPublicProfile });
export { loadPublicProfileSettings, visitPublicProfile };
