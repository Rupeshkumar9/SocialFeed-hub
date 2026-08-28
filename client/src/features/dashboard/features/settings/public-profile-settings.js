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
let featuredShopId = null;
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
    row.dataset.shopId = String(item.id || `shop_${items.indexOf(item) + 1}`);
    row.innerHTML = `<div class="public-shop-row-heading"><span class="public-shop-row-icon">✦</span><strong>Shop pick</strong><button type="button" class="settings-inline-action" data-remove-shop>Remove</button></div><div class="public-shop-row-fields"><input data-shop-title aria-label="Shop title" placeholder="Product or tool name" maxlength="120"><input data-shop-url aria-label="Shop URL" type="url" placeholder="https://…"><input data-shop-merchant aria-label="Merchant" placeholder="Brand or store"><input data-shop-price aria-label="Price" placeholder="$29"><div class="public-shop-image-field"><label>Product image URL<input data-shop-thumbnail aria-label="Thumbnail URL" type="text" placeholder="https://…"></label><label class="public-shop-file-label">Choose image<input data-shop-thumbnail-file aria-label="Choose product image" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label><span class="public-shop-thumbnail" data-shop-thumbnail-preview aria-hidden="true"></span></div><textarea data-shop-description aria-label="Shop description" placeholder="Why you recommend it" maxlength="220" rows="2"></textarea></div>`;
    row.querySelector('[data-shop-title]').value = item.title || '';
    row.querySelector('[data-shop-url]').value = item.url || '';
    row.querySelector('[data-shop-merchant]').value = item.merchant || '';
    row.querySelector('[data-shop-price]').value = item.price || '';
    row.querySelector('[data-shop-thumbnail]').value = item.thumbnail || '';
    row.querySelector('[data-shop-description]').value = item.description || '';
    row.querySelector('[data-remove-shop]').addEventListener('click', () => row.remove());
    const thumbnailInput = row.querySelector('[data-shop-thumbnail]');
    const preview = row.querySelector('[data-shop-thumbnail-preview]');
    const updateThumbnailPreview = () => {
      preview.replaceChildren();
      const value = thumbnailInput.value.trim();
      if (!value) { preview.textContent = 'No image'; return; }
      const image = document.createElement('img'); image.src = value; image.alt = 'Product thumbnail preview';
      image.addEventListener('error', () => { preview.replaceChildren(); preview.textContent = 'Image unavailable'; }, { once: true });
      preview.appendChild(image);
    };
    thumbnailInput.addEventListener('input', updateThumbnailPreview);
    row.querySelector('[data-shop-thumbnail-file]').addEventListener('change', event => {
      const file = event.target.files?.[0]; if (!file) return;
      if (file.size > 2 * 1024 * 1024) { showToast('Shop image must be 2 MB or smaller.', 'error'); event.target.value = ''; return; }
      const reader = new FileReader(); reader.onload = () => { thumbnailInput.value = String(reader.result || ''); updateThumbnailPreview(); }; reader.readAsDataURL(file);
    });
    updateThumbnailPreview();
    host.appendChild(row);
  });
}

function collectShopLinks() {
  return [...document.querySelectorAll('#public-profile-shop-links .public-shop-row')].map(row => ({
    id: row.dataset.shopId || '',
    title: row.querySelector('[data-shop-title]')?.value.trim() || '',
    url: row.querySelector('[data-shop-url]')?.value.trim() || '',
    merchant: row.querySelector('[data-shop-merchant]')?.value.trim() || '',
    price: row.querySelector('[data-shop-price]')?.value.trim() || '',
    thumbnail: row.querySelector('[data-shop-thumbnail]')?.value.trim() || '',
    description: row.querySelector('[data-shop-description]')?.value.trim() || '',
    featured: row.dataset.shopId === featuredShopId
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
  return { username: document.getElementById('public-profile-username').value.trim().toLowerCase(), displayName: document.getElementById('public-profile-display-name').value.trim(), bio: document.getElementById('public-profile-bio').value.trim(), avatarUrl: document.getElementById('public-profile-avatar').value.trim(), published: !document.getElementById('public-profile-private').checked, theme: { background: document.getElementById('public-profile-theme').value, accent: '#f43f5e', buttonStyle: 'soft' }, socialLinks: collectSocialLinks(), shopLinks: collectShopLinks() };
}
function updateUrl(username) { return `${location.origin}/u/${encodeURIComponent(username || 'socialfeed')}`; }
function updateUrlHint(username) {
  const hint = document.getElementById('public-profile-url');
  if (hint) hint.textContent = `/u/${encodeURIComponent(username || 'socialfeed')}`;
}

let publicContentItems = [];
let featuredSource = 'all-links';

function managerTitle(item = {}) {
  return item.publicTitle || item.authorName || item.siteName || item.title || item.content || item.url || 'Untitled public item';
}

function managerHost(url = '') {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'saved item'; }
}

function itemDate(item = {}) {
  const value = item.publicPublishedAt || item.visibilityUpdatedAt || item.firstSavedAt || item.createdAt || 0;
  const time = Date.parse(value); return Number.isFinite(time) ? time : 0;
}

function updatePublicContentCounts(data = {}) {
  const counts = data.counts || profile?.counts || {};
  const browser = Number(counts.browser || 0);
  const social = Number(counts.social || 0);
  const shopCount = (data.shopLinks || profile?.profile?.shopLinks || profile?.shopLinks || []).length;
  const values = { 'public-profile-counts': `${browser + social} public links · ${shopCount} shop picks`, 'public-links-count': browser + social };
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

function currentProfileData() { return profile?.profile || profile || {}; }

function renderPublicLinks(items = []) {
  const list = document.getElementById('public-links-list');
  const empty = document.getElementById('public-links-empty');
  if (!list || !empty) return;
  list.replaceChildren(); empty.hidden = items.length > 0;
  items.forEach(item => {
    const row = document.createElement('article'); row.className = 'public-curation-row';
    const title = managerTitle(item); const description = item.publicDescription || item.content || 'No public description yet.';
    row.innerHTML = `<span class="public-curation-thumb">↗</span><div class="public-curation-copy"><strong></strong><small></small><p></p></div><button type="button" class="public-content-remove">Remove</button>`;
    row.querySelector('strong').textContent = title;
    row.querySelector('small').textContent = `${item.platformName || item.platform || managerHost(item.url)} · ${new Date(itemDate(item)).toLocaleDateString()}`;
    row.querySelector('p').textContent = description;
    const image = item.thumbnail || item.favicon;
    if (image) { const imageElement = document.createElement('img'); imageElement.src = image; imageElement.alt = ''; imageElement.loading = 'lazy'; imageElement.addEventListener('error', () => imageElement.remove(), { once: true }); row.querySelector('.public-curation-thumb').replaceChildren(imageElement); }
    row.querySelector('.public-content-remove').addEventListener('click', async () => {
      if (!window.confirm(`Make “${title}” private?`)) return;
      const button = row.querySelector('.public-content-remove'); button.disabled = true;
      try { await socialFeedApi.updateBookmarkVisibility({ ids: [item.id], visibility: 'private', featured: false }); showToast('Item made private.', 'success'); await loadPublicContentItems(); }
      catch (error) { showToast(error?.message || 'Unable to make item private.', 'error'); button.disabled = false; }
    });
    list.appendChild(row);
  });
}

function renderFeaturedCurrent(item) {
  const host = document.getElementById('public-featured-current'); if (!host) return;
  const title = document.getElementById('public-featured-title'); const meta = document.getElementById('public-featured-meta'); const description = document.getElementById('public-featured-description'); const thumb = host.querySelector('.public-featured-thumb');
  const hasItem = Boolean(item);
  host.classList.toggle('is-empty', !hasItem);
  title.textContent = hasItem ? managerTitle(item) : 'No featured content selected';
  const isShop = hasItem && item.kind === 'Shop pick';
  meta.textContent = hasItem ? (isShop ? `Shop pick${item.merchant ? ` · ${item.merchant}` : ''}${item.price ? ` · ${item.price}` : ''}` : `${item.platformName || item.platform || managerHost(item.url)} · Public`) : 'Choose from all public links or shop picks.';
  description.textContent = hasItem ? (item.publicDescription || item.content || item.url || '') : '';
  thumb.replaceChildren();
  if (hasItem && (item.thumbnail || item.favicon)) { const image = document.createElement('img'); image.src = item.thumbnail || item.favicon; image.alt = ''; thumb.appendChild(image); }
  else thumb.textContent = '↗';
}

async function loadPublicContentItems() {
  try {
    const [browserResult, socialResult] = await Promise.all([
      socialFeedApi.getBookmarks(new URLSearchParams({ source: 'browser', limit: '100' })),
      socialFeedApi.getBookmarks(new URLSearchParams({ source: 'social', limit: '100' }))
    ]);
    const browser = Array.isArray(browserResult) ? browserResult : (browserResult?.bookmarks || []);
    const social = Array.isArray(socialResult) ? socialResult : (socialResult?.bookmarks || []);
    publicContentItems = [...browser, ...social].filter(item => item.visibility === 'public').sort((a, b) => itemDate(b) - itemDate(a));
    renderPublicLinks(publicContentItems);
    const featuredBookmark = publicContentItems.find(item => item.featured);
    const featuredShop = (currentProfileData().shopLinks || []).find(item => item.featured);
    renderFeaturedCurrent(featuredBookmark || (featuredShop ? { ...featuredShop, kind: 'Shop pick' } : null));
  } catch (error) { renderPublicLinks([]); renderFeaturedCurrent(null); showToast(error?.message || 'Unable to load public content.', 'error'); }
}

function featuredElements() { return { overlay: document.getElementById('featured-post-modal-overlay'), list: document.getElementById('featured-post-list'), empty: document.getElementById('featured-post-empty'), status: document.getElementById('featured-post-status') }; }
function setFeaturedStatus(message = '', error = false) { const status = featuredElements().status; if (status) { status.textContent = message; status.className = error ? 'error' : ''; } }

async function renderFeaturedChoices(source = featuredSource) {
  featuredSource = source; const elements = featuredElements(); if (!elements.list) return;
  elements.list.replaceChildren(); setFeaturedStatus('Loading…');
  try {
    let items = [];
    if (source === 'all-links') items = publicContentItems;
    else if (source === 'shop') items = (currentProfileData().shopLinks || []).filter(item => item.title && item.url);
    elements.empty.hidden = items.length > 0; setFeaturedStatus('');
    items.forEach(item => {
      const row = document.createElement('article'); row.className = 'featured-post-row';
      row.innerHTML = `<span class="public-curation-thumb">↗</span><div class="public-curation-copy"><strong></strong><small></small></div><button type="button" class="settings-inline-action"></button>`;
      row.querySelector('strong').textContent = managerTitle(item); row.querySelector('small').textContent = source === 'shop' ? `Shop pick${item.merchant ? ` · ${item.merchant}` : ''}${item.price ? ` · ${item.price}` : ''}` : `${item.platformName || item.platform || managerHost(item.url)} · Public`;
      const image = item.thumbnail || item.favicon; if (image) { const imageElement = document.createElement('img'); imageElement.src = image; imageElement.alt = ''; row.querySelector('.public-curation-thumb').replaceChildren(imageElement); }
      const button = row.querySelector('button'); const selected = item.featured === true; button.textContent = selected ? 'Selected' : 'Set featured'; button.disabled = selected;
      button.addEventListener('click', async () => {
        button.disabled = true; setFeaturedStatus('Saving…');
        try {
          if (source === 'shop') {
            for (const current of publicContentItems.filter(candidate => candidate.featured)) await socialFeedApi.updateBookmarkVisibility({ ids: [current.id], visibility: 'public', featured: false });
            featuredShopId = String(item.id || '');
            profile = await socialFeedApi.savePublicProfileSettings(collectProfile());
          } else {
            const currentFeatured = publicContentItems.filter(candidate => candidate.featured && candidate.id !== item.id);
            for (const current of currentFeatured) await socialFeedApi.updateBookmarkVisibility({ ids: [current.id], visibility: 'public', featured: false });
            if (featuredShopId) { featuredShopId = null; profile = await socialFeedApi.savePublicProfileSettings(collectProfile()); }
            await socialFeedApi.updateBookmarkVisibility({ ids: [item.id], visibility: 'public', featured: true });
          }
          showToast('Featured post updated.', 'success'); await loadPublicContentItems(); closeFeaturedPostModal();
        } catch (error) { setFeaturedStatus(error?.message || 'Unable to update featured post.', true); button.disabled = false; }
      });
      elements.list.appendChild(row);
    });
  } catch (error) { elements.empty.hidden = false; setFeaturedStatus(error?.message || 'Unable to load public items.', true); }
}

function openFeaturedPostModal() { const elements = featuredElements(); if (!elements.overlay) return; elements.overlay.hidden = false; elements.overlay.classList.add('active'); renderFeaturedChoices(featuredSource); }
function closeFeaturedPostModal() { const overlay = featuredElements().overlay; if (!overlay) return; overlay.classList.remove('active'); window.setTimeout(() => { overlay.hidden = true; }, 180); }

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
    document.getElementById('public-profile-theme').value = data.theme?.background || 'default';
    featuredShopId = String((data.shopLinks || []).find(item => item.featured)?.id || '');
    setAvatarPreview(document.getElementById('public-profile-avatar').value); renderSocialLinks(data.socialLinks || []); renderShopLinks(data.shopLinks || []);
    updatePublicContentCounts(data); await loadPublicContentItems();
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
document.getElementById('public-featured-change')?.addEventListener('click', openFeaturedPostModal);
document.querySelectorAll('[data-featured-tab]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-featured-tab]').forEach(tab => { const active = tab === button; tab.classList.toggle('is-active', active); tab.setAttribute('aria-selected', String(active)); });
  renderFeaturedChoices(button.dataset.featuredTab || 'browser');
}));
document.getElementById('close-featured-post-modal')?.addEventListener('click', closeFeaturedPostModal);
document.getElementById('featured-post-done')?.addEventListener('click', closeFeaturedPostModal);
document.getElementById('featured-post-modal-overlay')?.addEventListener('click', event => { if (event.target?.id === 'featured-post-modal-overlay') closeFeaturedPostModal(); });
document.getElementById('public-profile-username')?.addEventListener('input', event => { AppState.publicProfileUsername = event.target.value.trim().toLowerCase(); updateUrlHint(AppState.publicProfileUsername); });
document.getElementById('public-profile-display-name')?.addEventListener('input', () => { if (!document.getElementById('public-profile-avatar').value) setAvatarPreview(''); });
document.getElementById('public-profile-preview')?.addEventListener('click', () => window.open(updateUrl(document.getElementById('public-profile-username').value), '_blank', 'noopener,noreferrer'));
document.getElementById('public-profile-copy')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(updateUrl(document.getElementById('public-profile-username').value)); showToast('Profile URL copied.', 'success'); } catch { setStatus('Copy was blocked by the browser.', true); } });
function profileUrlFromForm() { return updateUrl(document.getElementById('public-profile-username')?.value || AppState.publicProfileUsername); }
function bindSaveButton(button, statusTarget) {
  button?.addEventListener('click', async () => {
    button.disabled = true; const status = document.getElementById(statusTarget); if (status) status.textContent = 'Saving…';
    try { profile = await socialFeedApi.savePublicProfileSettings(collectProfile()); if (status) status.textContent = 'Profile saved.'; showToast('Public profile updated.', 'success'); await loadPublicProfileSettings(); }
    catch (error) { if (status) { status.textContent = error?.message || 'Unable to save profile.'; status.className = 'error'; } }
    finally { button.disabled = false; }
  });
}
document.getElementById('public-profile-preview-content')?.addEventListener('click', () => window.open(profileUrlFromForm(), '_blank', 'noopener,noreferrer'));
document.getElementById('public-profile-copy-content')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(profileUrlFromForm()); showToast('Profile URL copied.', 'success'); } catch { showToast('Copy was blocked by the browser.', 'error'); } });
bindSaveButton(document.getElementById('public-profile-save-content'), 'public-content-status');
document.getElementById('public-profile-form')?.addEventListener('submit', async event => { event.preventDefault(); const button = document.getElementById('public-profile-save'); button.disabled = true; setStatus('Saving…'); try { profile = await socialFeedApi.savePublicProfileSettings(collectProfile()); setStatus('Profile saved.'); showToast('Public profile updated.', 'success'); await loadPublicProfileSettings(); } catch (error) { setStatus(error?.message || 'Unable to save profile.', true); } finally { button.disabled = false; } });

registerActions('public-profile-settings', { loadPublicProfileSettings, visitPublicProfile });
export { loadPublicProfileSettings, visitPublicProfile };
