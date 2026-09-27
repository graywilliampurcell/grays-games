// Private inline SVG icons for the Race HUD and results.

export const MEDAL_COLORS = {
  gold: '#ffc61a',
  silver: '#c9d3de',
  bronze: '#d98b4a',
  ribbon: '#ff5fa2',
};

const svg = (body, cls = 'icon') => `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true">${body}</svg>`;

/** Medal on a ribbon with the place number (ribbon = rosette for 4th+). */
export function medal(kind, place = null) {
  const c = MEDAL_COLORS[kind] || MEDAL_COLORS.ribbon;
  const label = place ? `<text x="50" y="72" text-anchor="middle" font-size="30" font-weight="900" fill="#1d1d2b" font-family="system-ui, sans-serif">${place}</text>` : '';
  if (kind === 'ribbon') {
    return svg(`
      <path d="M36 58 L24 96 L38 88 L44 99 L52 66 Z M64 58 L76 96 L62 88 L56 99 L48 66 Z" fill="#e8307e" stroke="#fff" stroke-width="3"/>
      <g fill="${c}" stroke="#fff" stroke-width="3">
        ${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<circle cx="${50 + 22 * Math.cos((a * Math.PI) / 180)}" cy="${44 + 22 * Math.sin((a * Math.PI) / 180)}" r="11"/>`).join('')}
      </g>
      <circle cx="50" cy="44" r="22" fill="${c}" stroke="#fff" stroke-width="4"/>
      ${place ? `<text x="50" y="55" text-anchor="middle" font-size="30" font-weight="900" fill="#fff" font-family="system-ui, sans-serif">${place}</text>` : ''}`);
  }
  return svg(`
    <path d="M30 2 L44 40 L56 40 L42 2 Z" fill="#2e6be8"/>
    <path d="M70 2 L56 40 L44 40 L58 2 Z" fill="#e8302e"/>
    <circle cx="50" cy="62" r="34" fill="${c}" stroke="#fff" stroke-width="5"/>
    <circle cx="50" cy="62" r="25" fill="none" stroke="#fff" stroke-width="3" opacity="0.6"/>
    ${label}`);
}

/** Trophy cup in a medal color. */
export function cup(kind) {
  const c = MEDAL_COLORS[kind] || MEDAL_COLORS.gold;
  if (kind === 'ribbon') return medal('ribbon');
  return svg(`
    <path d="M26 20 H10 Q8 44 32 48 M74 20 H90 Q92 44 68 48" fill="none" stroke="${c}" stroke-width="7"/>
    <path d="M24 10 H76 V36 A26 26 0 0 1 24 36 Z" fill="${c}" stroke="#fff" stroke-width="4"/>
    <rect x="44" y="60" width="12" height="16" fill="${c}"/>
    <rect x="30" y="74" width="40" height="18" rx="4" fill="${c}" stroke="#fff" stroke-width="4"/>
    <path d="M34 18 Q34 40 46 50" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity="0.6"/>
    <path d="M50 22 l4 8 9 1 -7 6 2 9 -8 -5 -8 5 2 -9 -7 -6 9 -1 z" fill="#fff" opacity="0.85"/>`);
}

/** Checkered finish flag (end of the progress bar). */
export const flag = svg(`
  <rect x="14" y="8" width="7" height="88" rx="3" fill="#1d1d2b"/>
  <g transform="translate(21 10)">
    <rect width="66" height="44" fill="#fff" stroke="#1d1d2b" stroke-width="3"/>
    ${[0, 1, 2, 3, 4, 5]
      .flatMap((i) => [0, 1, 2, 3].map((j) => ((i + j) % 2 ? `<rect x="${i * 11}" y="${j * 11}" width="11" height="11" fill="#1d1d2b"/>` : '')))
      .join('')}
  </g>`);

/** Big "next race" arrow. */
export const next = svg(`<path d="M22 14 L80 50 L22 86 Z" fill="currentColor" stroke="currentColor" stroke-width="8" stroke-linejoin="round"/>`);

/** House (home). */
export const home = svg(`
  <path d="M50 12 L90 48 H78 V88 H22 V48 H10 Z" fill="currentColor" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
  <rect x="42" y="62" width="16" height="26" fill="#fff" opacity="0.85"/>`);

/** Checkpoint tick. */
export const check = svg(`<path d="M18 52 L40 74 L84 26" fill="none" stroke="currentColor" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>`);
