import './styles/public-profile.css';
import { socialFeedApi } from './api/socialfeed-api.js';

const root = document.getElementById('public-profile-app');
const username = decodeURIComponent(location.pathname.split('/').filter(Boolean)[0] || '');
const escapeHTML = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const hostFor = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };
const dateFor = value => { const date = new Date(value || ''); return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); };

const SOCIAL_GLYPHS = { instagram: '◎', x: '𝕏', threads: '◉', facebook: 'f', tiktok: '♪', whatsapp: '◔', telegram: '➤', website: '↗', custom: '↗' };
function platformForSocial(link = {}) {
  const declared = String(link.platform || '').toLowerCase();
  if (SOCIAL_GLYPHS[declared] && declared !== 'website') return declared;
  const host = hostFor(link.url);
  if (host.includes('instagram')) return 'instagram';
  if (host === 'x.com' || host.includes('twitter')) return 'x';
  if (host.includes('threads')) return 'threads';
  if (host.includes('facebook')) return 'facebook';
  if (host.includes('tiktok')) return 'tiktok';
  if (host === 'wa.me' || host.includes('whatsapp')) return 'whatsapp';
  if (host.includes('t.me') || host.includes('telegram')) return 'telegram';
  return declared || 'custom';
}
function profileSocialLinks(links = []) {
  return links.filter(link => link?.url).map(link => {
    const platform = platformForSocial(link);
    const label = link.label || hostFor(link.url) || 'Website';
    const glyph = SOCIAL_GLYPHS[platform] || SOCIAL_GLYPHS.custom;
    return `<a class="public-social-icon public-social-${escapeHTML(platform)}" href="${escapeHTML(link.url)}" target="_blank" rel="noreferrer noopener" aria-label="${escapeHTML(label)}" title="${escapeHTML(label)}"><span aria-hidden="true">${glyph}</span></a>`;
  }).join('');
}
function browserMarkup(items) { return `<div class="public-browser-list">${items.map(item => `<a class="public-browser-row" href="${escapeHTML(item.url)}" target="_blank" rel="noreferrer noopener"><span class="public-favicon">${escapeHTML((item.publicTitle || item.content || hostFor(item.url)).trim().charAt(0).toUpperCase() || '↗')}</span><span><strong>${escapeHTML(item.publicTitle || item.content || hostFor(item.url))}</strong><small>${escapeHTML(hostFor(item.url))}</small></span>${item.featured ? '<b class="public-star">★</b>' : ''}</a>`).join('')}</div>`; }
function socialMarkup(items) { return `<div class="public-social-grid">${items.map(item => `<article class="public-post"><div class="public-post-top"><span>${escapeHTML(item.platform || 'Saved post')}</span><time>${escapeHTML(dateFor(item.firstSavedAt))}</time></div>${item.thumbnail ? `<img src="${escapeHTML(item.thumbnail)}" alt="" loading="lazy">` : ''}<p>${escapeHTML(item.publicTitle || item.content || 'Saved post')}</p><a href="${escapeHTML(item.url || '#')}" target="_blank" rel="noreferrer noopener">Open original ↗</a></article>`).join('')}</div>`; }

async function render() {
  if (!username) { root.innerHTML = '<div class="public-empty"><h1>Profile not found</h1></div>'; return; }
  try {
    const result = await socialFeedApi.getPublicProfile(username);
    const profile = result.profile;
    document.title = `${profile.displayName || profile.username} · SocialFeed Hub`;
    root.dataset.theme = profile.theme?.background || 'default'; root.style.setProperty('--profile-accent', profile.theme?.accent || '#f43f5e');
    root.innerHTML = `<section class="public-shell"><header class="public-hero"><div class="public-avatar">${profile.avatarUrl ? `<img src="${escapeHTML(profile.avatarUrl)}" alt="">` : escapeHTML((profile.displayName || profile.username).charAt(0).toUpperCase())}</div><div class="public-identity"><p class="public-eyebrow">SocialFeed Hub profile</p><h1>${escapeHTML(profile.displayName || profile.username)}</h1><p class="public-username">@${escapeHTML(profile.username)}</p>${profile.bio ? `<p class="public-bio">${escapeHTML(profile.bio)}</p>` : ''}<nav class="public-social-links">${profileSocialLinks(profile.socialLinks)}</nav></div><button class="public-share" type="button" id="public-share">Share profile</button></header><nav class="public-tabs" aria-label="Profile sections"><button class="active" data-tab="browser">Links <span>${profile.counts?.browser || 0}</span></button><button data-tab="social">Saved Posts <span>${profile.counts?.social || 0}</span></button></nav><section id="public-content" class="public-content"><div class="public-loading">Loading links…</div></section></section>`;
    const content = document.getElementById('public-content');
    async function loadTab(tab) { content.innerHTML = '<div class="public-loading">Loading…</div>'; try { const data = await socialFeedApi.getPublicBookmarks(username, { source: tab }); content.innerHTML = data.bookmarks?.length ? (tab === 'browser' ? browserMarkup(data.bookmarks) : socialMarkup(data.bookmarks)) : `<div class="public-empty"><h2>No public ${tab === 'browser' ? 'links' : 'posts'} yet</h2><p>This profile has not published anything in this section.</p></div>`; } catch (error) { content.innerHTML = `<div class="public-empty"><h2>Unable to load this section</h2><p>${escapeHTML(error.message)}</p></div>`; } }
    document.querySelectorAll('.public-tabs button').forEach(button => button.addEventListener('click', () => { document.querySelectorAll('.public-tabs button').forEach(item => item.classList.toggle('active', item === button)); loadTab(button.dataset.tab); }));
    document.getElementById('public-share').addEventListener('click', async () => { try { await navigator.clipboard.writeText(location.href); document.getElementById('public-share').textContent = 'Profile URL copied'; } catch { /* no-op */ } });
    await loadTab(profile.defaultTab === 'posts' ? 'social' : 'browser');
    if (profile.defaultTab === 'posts') document.querySelector('.public-tabs button[data-tab="social"]')?.click();
  } catch (error) { root.innerHTML = `<div class="public-empty"><h1>Profile not found</h1><p>${escapeHTML(error.status === 404 ? 'This profile is private or does not exist.' : error.message)}</p><a href="/">Open SocialFeed Hub</a></div>`; }
}
render();
