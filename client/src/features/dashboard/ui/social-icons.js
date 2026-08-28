const SOCIAL_ICON_DEFINITIONS = Object.freeze({
  instagram: {
    body: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>',
    fill: 'none',
    stroke: 'currentColor',
  },
  x: {
    body: '<path d="M18.9 2h3.3l-7.2 8.2 8.5 11.8h-6.7l-5.2-6.9-6 6.9H2.3l7.7-8.8L1.9 2h6.8l4.7 6.3L18.9 2Zm-1.2 17.9h1.8L7.7 4H5.8l11.9 15.9Z"/>',
    fill: 'currentColor',
    stroke: 'none',
  },
  threads: {
    body: '<path d="M17.6 11.1c-.2-3.5-2.2-5.5-5.6-5.5-2 0-3.7.8-4.7 2.3l1.7 1.2c.7-.9 1.7-1.4 3-1.4 1.9 0 3.1 1 3.4 2.8-.9-.2-1.9-.3-3-.2-2.9.2-4.7 1.6-4.6 3.8.1 2.1 1.9 3.5 4.4 3.4 2.2-.1 3.8-1.2 4.7-3.1.7.5 1.1 1.2 1.1 2.1 0 2.6-2.5 4.4-6 4.4-4.3 0-7-3.2-7-8.7 0-5.4 2.7-8.7 7-8.7 3.1 0 5.4 1.5 6.7 4.4l2-.9C19.1 3.7 16 2 12 2 6.4 2 3 5.9 3 12.2 3 18.5 6.4 22 12 22c4.8 0 8.1-2.5 8.1-6.2 0-2.1-.9-3.6-2.5-4.7Zm-5.5 4.3c-1.2-.1-2.1-.5-2.1-1.4 0-.9.9-1.5 2.5-1.6 1-.1 2 0 2.8.3-.4 1.6-1.5 2.6-3.2 2.7Z"/>',
    fill: 'currentColor',
    stroke: 'none',
  },
  facebook: {
    body: '<path d="M13.8 22v-8h2.8l.5-3.2h-3.3V8.7c0-.9.3-1.6 1.7-1.6h1.8V4.2c-.3 0-1.4-.2-2.6-.2-2.6 0-4.4 1.6-4.4 4.5v2.3H7.4V14h2.9v8h3.5Z"/>',
    fill: 'currentColor',
    stroke: 'none',
  },
  tiktok: {
    body: '<path d="M18.5 5.5a5.8 5.8 0 0 0 3.5 1.2V10a8.3 8.3 0 0 1-3.5-.8v6.1a5.2 5.2 0 1 1-4.5-5.2v3.1a2.2 2.2 0 1 0 1.4 2.1V2h3.1v3.5Z"/>',
    fill: 'currentColor',
    stroke: 'none',
  },
  telegram: {
    body: '<path d="m21 3-7.2 18-3.2-7.6L3 10.2 21 3Z"/><path d="m10.6 13.4 5.2-4.3"/>',
    fill: 'none',
    stroke: 'currentColor',
  },
  custom: {
    body: '<path d="M14 4h6v6M20 4l-9 9M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/>',
    fill: 'none',
    stroke: 'currentColor',
  },
});

function socialIconMarkup(platform, className = 'social-icon-svg') {
  const definition = SOCIAL_ICON_DEFINITIONS[platform] || SOCIAL_ICON_DEFINITIONS.custom;
  const strokeAttributes = definition.stroke === 'none'
    ? ''
    : ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="${definition.fill}" stroke="${definition.stroke}"${strokeAttributes}>${definition.body}</svg>`;
}

export { SOCIAL_ICON_DEFINITIONS, socialIconMarkup };
