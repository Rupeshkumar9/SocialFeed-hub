const stroke = body => ({ body, fill: 'none', stroke: 'currentColor' });
const fill = body => ({ body, fill: 'currentColor', stroke: 'none' });

const ICONS = Object.freeze({
  'arrow-down-wide-short': stroke('<path d="M4 6h16M7 10h10M10 14h4M6 13v7m0 0-3-3m3 3 3-3"/>'),
  'arrow-left': stroke('<path d="m15 18-6-6 6-6M9 12h11"/>'),
  bars: stroke('<path d="M4 6h16M4 12h16M4 18h16"/>'),
  bookmark: stroke('<path d="M6 4.8A2.8 2.8 0 0 1 8.8 2h6.4A2.8 2.8 0 0 1 18 4.8V22l-6-4-6 4Z"/>'),
  'calendar-days': stroke('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>'),
  'chart-line': stroke('<path d="M3 3v18h18M7 16l4-5 4 3 5-7"/>'),
  check: stroke('<path d="m5 12 4 4L19 6"/>'),
  'chevron-down': stroke('<path d="m6 9 6 6 6-6"/>'),
  'circle-nodes': stroke('<circle cx="12" cy="12" r="2.5"/><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="18" r="2"/><path d="m7 7.5 3 2.7m4 0 3-2.7m-10 9 3-2.7m4 0 3 2.7"/>'),
  'circle-notch': stroke('<path d="M21 12a9 9 0 1 1-6.2-8.55"/>'),
  'cloud-arrow-up': stroke('<path d="M16 16l-4-4-4 4M12 12v9M20 17.5A4.5 4.5 0 0 0 18 9a7 7 0 0 0-13.5 2A4 4 0 0 0 5 19h2"/>'),
  'credit-card': stroke('<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M6 15h4"/>'),
  database: stroke('<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>'),
  download: stroke('<path d="M12 3v12m0 0 5-5m-5 5-5-5M4 20h16"/>'),
  'ellipsis-vertical': fill('<circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/>'),
  facebook: fill('<path d="M13.8 22v-8h2.8l.5-3.2h-3.3V8.7c0-.9.3-1.6 1.7-1.6h1.8V4.2c-.3 0-1.4-.2-2.6-.2-2.6 0-4.4 1.6-4.4 4.5v2.3H7.4V14h2.9v8h3.5Z"/>'),
  'feather-pointed': stroke('<path d="M20.2 4.8a6 6 0 0 0-8.5 0L5 11.5V20h8.5l6.7-6.7a6 6 0 0 0 0-8.5ZM16 8 2 22M17.5 15H9"/>'),
  'file-import': stroke('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M12 18v-7m0 0-3 3m3-3 3 3"/>'),
  'file-pen': stroke('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h7M14 2v6h6M13 17l6-6 2 2-6 6-3 1Z"/>'),
  folder: stroke('<path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>'),
  'folder-open': stroke('<path d="M3 7a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v1M3 11h19l-3 9H5Z"/>'),
  'folder-tree': stroke('<path d="M4 4h6l2 3h8v5H8V7M8 12v7h4M8 16h4M12 17h8v4h-8Z"/>'),
  gear: stroke('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>'),
  grip: fill('<circle cx="8" cy="6" r="1.5"/><circle cx="16" cy="6" r="1.5"/><circle cx="8" cy="12" r="1.5"/><circle cx="16" cy="12" r="1.5"/><circle cx="8" cy="18" r="1.5"/><circle cx="16" cy="18" r="1.5"/>'),
  image: stroke('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 17 5-5 4 4 2-2 5 5"/>'),
  instagram: stroke('<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>'),
  'layer-group': stroke('<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>'),
  list: stroke('<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>'),
  lock: stroke('<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'),
  'lock-open': stroke('<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 7.6-1.7"/>'),
  'magnifying-glass': stroke('<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>'),
  'note-sticky': stroke('<path d="M5 3h14a2 2 0 0 1 2 2v10l-6 6H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M15 21v-6h6M7 8h10M7 12h6"/>'),
  pen: stroke('<path d="m4 20 4.5-1 10-10-3.5-3.5-10 10ZM13.5 7l3.5 3.5M4 20l1-4.5"/>'),
  'pen-to-square': stroke('<path d="M12 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="m14 4 3-3 4 4-3 3-8 8-4 1 1-4Z"/>'),
  plug: stroke('<path d="m8 12 8-8M14 2l8 8M6 10l8 8M4 12l8 8M9 17l-3 3M3 21l3-3"/>'),
  plus: stroke('<path d="M12 5v14M5 12h14"/>'),
  'quote-left': fill('<path d="M4 6h7v7H7.5c0 2.1 1.1 3.5 3.3 4.2V20C6.2 19.3 4 16.6 4 12V6Zm9 0h7v7h-3.5c0 2.1 1.1 3.5 3.3 4.2V20c-4.6-.7-6.8-3.4-6.8-8V6Z"/>'),
  'reddit-alien': stroke('<circle cx="12" cy="13" r="7"/><circle cx="9" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1" fill="currentColor" stroke="none"/><path d="M8.5 16c2 1.3 5 1.3 7 0M12 6l1.2-4 3.8 1M5 11a2 2 0 1 0-1 4M19 11a2 2 0 1 1 1 4"/>'),
  'right-from-bracket': stroke('<path d="M10 17l5-5-5-5M15 12H3M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/>'),
  rotate: stroke('<path d="M20 7v5h-5M4 17v-5h5M6.1 8a7 7 0 0 1 11.5-2.3L20 8M4 16l2.4 2.3A7 7 0 0 0 17.9 16"/>'),
  'square-check': stroke('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m7 12 3 3 7-7"/>'),
  threads: fill('<path d="M17.6 11.1c-.2-3.5-2.2-5.5-5.6-5.5-2 0-3.7.8-4.7 2.3l1.7 1.2c.7-.9 1.7-1.4 3-1.4 1.9 0 3.1 1 3.4 2.8-.9-.2-1.9-.3-3-.2-2.9.2-4.7 1.6-4.6 3.8.1 2.1 1.9 3.5 4.4 3.4 2.2-.1 3.8-1.2 4.7-3.1.7.5 1.1 1.2 1.1 2.1 0 2.6-2.5 4.4-6 4.4-4.3 0-7-3.2-7-8.7 0-5.4 2.7-8.7 7-8.7 3.1 0 5.4 1.5 6.7 4.4l2-.9C19.1 3.7 16 2 12 2 6.4 2 3 5.9 3 12.2 3 18.5 6.4 22 12 22c4.8 0 8.1-2.5 8.1-6.2 0-2.1-.9-3.6-2.5-4.7Zm-5.5 4.3c-1.2.1-2.1-.5-2.1-1.4 0-.9.9-1.5 2.5-1.6 1-.1 2 0 2.8.3-.4 1.6-1.5 2.6-3.2 2.7Z"/>'),
  trash: stroke('<path d="M4 7h16M9 3h6l1 4H8ZM7 7l1 14h8l1-14M10 11v6M14 11v6"/>'),
  user: stroke('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  'user-gear': stroke('<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 11-5.7M18 14v2m0 4v2m-4-4h2m4 0h2M15.9 15.9l1.4 1.4m1.4 1.4 1.4 1.4m0-4.2-1.4 1.4m-1.4 1.4-1.4 1.4"/>'),
  'window-restore': stroke('<rect x="3" y="7" width="14" height="14" rx="2"/><path d="M7 7V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2"/>'),
  'x-twitter': fill('<path d="M18.9 2h3.3l-7.2 8.2 8.5 11.8h-6.7l-5.2-6.9-6 6.9H2.3l7.7-8.8L1.9 2h6.8l4.7 6.3L18.9 2Zm-1.2 17.9h1.8L7.7 4H5.8l11.9 15.9Z"/>'),
  xmark: stroke('<path d="M6 6l12 12M18 6 6 18"/>'),
});

function iconNameFor(element) {
  for (const className of element.classList) {
    if (!className.startsWith('icon-') || className === 'icon-spin') continue;
    const name = className.slice(5);
    if (ICONS[name]) return name;
  }
  return '';
}

function renderIcon(element) {
  const name = iconNameFor(element);
  if (!name || element.dataset.appIcon === name) return;
  const definition = ICONS[name];
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'app-icon-svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('fill', definition.fill);
  svg.setAttribute('stroke', definition.stroke);
  if (definition.stroke !== 'none') {
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
  }
  svg.innerHTML = definition.body;
  element.replaceChildren(svg);
  element.dataset.appIcon = name;
}

function hydrateIcons(root = document) {
  if (root instanceof Element && root.matches('i.app-icon')) renderIcon(root);
  root.querySelectorAll?.('i.app-icon').forEach(renderIcon);
}

hydrateIcons();

const iconObserver = new MutationObserver(mutations => {
  for (const mutation of mutations) {
    if (mutation.type === 'attributes') {
      renderIcon(mutation.target);
      continue;
    }
    mutation.addedNodes.forEach(node => {
      if (node instanceof Element) hydrateIcons(node);
    });
  }
});

iconObserver.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

export { ICONS, hydrateIcons };
