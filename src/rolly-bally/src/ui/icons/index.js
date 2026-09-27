// Inline SVG pictures for the menus. Every menu control is one of these
// (text captions are decoration only). All use class="icon" so .rb-btn sizes
// them; colors are baked in unless noted (currentColor = button text color).

const svg = (body, viewBox = '0 0 100 100') =>
  `<svg class="icon" viewBox="${viewBox}" aria-hidden="true">${body}</svg>`;

const INK = '#1d1d2b';
const MEDAL = { gold: '#ffc61a', silver: '#c9d3de', bronze: '#d98b4a', ribbon: '#ff5fa2' };

// ------------------------------------------------------------------ home

/** Rolling green hills with a sun and a ball (Playground). */
export const hills = svg(`
  <circle cx="76" cy="24" r="12" fill="#ffd21f" stroke="#fff" stroke-width="3"/>
  <path d="M0 70 Q20 42 42 62 T84 56 Q94 52 100 58 V100 H0 Z" fill="#7fd36b"/>
  <path d="M0 84 Q26 62 52 78 T100 74 V100 H0 Z" fill="#2fb84a"/>
  <circle cx="38" cy="57" r="10" fill="#e8302e" stroke="#fff" stroke-width="3"/>
`);

/** Checkered finish flag (Race). */
export const flag = (() => {
  let cells = '';
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      if ((r + c) % 2 === 0) cells += `<rect x="${26 + c * 12}" y="${14 + r * 10}" width="12" height="10" fill="${INK}"/>`;
    }
  }
  return svg(`
    <rect x="18" y="10" width="7" height="82" rx="3" fill="#8a5a2b" stroke="#fff" stroke-width="2"/>
    <rect x="26" y="14" width="60" height="40" fill="#fff" stroke="${INK}" stroke-width="3"/>
    ${cells}
    <circle cx="21.5" cy="10" r="6" fill="#ffd21f"/>
  `);
})();

/** Three balls in a pile (My Balls). */
export const balls = svg(`
  <circle cx="30" cy="68" r="20" fill="#2e6be8" stroke="#fff" stroke-width="4"/>
  <circle cx="70" cy="68" r="20" fill="#2fb84a" stroke="#fff" stroke-width="4"/>
  <circle cx="50" cy="36" r="20" fill="#e8302e" stroke="#fff" stroke-width="4"/>
  <circle cx="43" cy="29" r="6" fill="#fff" opacity="0.5"/>
  <circle cx="23" cy="61" r="6" fill="#fff" opacity="0.5"/>
  <circle cx="63" cy="61" r="6" fill="#fff" opacity="0.5"/>
`);

/** Gear (grown-up settings). Uses currentColor. */
export const gear = (() => {
  let teeth = '';
  for (let i = 0; i < 8; i++) {
    teeth += `<rect x="43" y="6" width="14" height="20" rx="3" fill="currentColor" transform="rotate(${i * 45} 50 50)"/>`;
  }
  return svg(`${teeth}<circle cx="50" cy="50" r="30" fill="currentColor"/><circle cx="50" cy="50" r="12" fill="#fff"/>`);
})();

// --------------------------------------------------------------- generic

export const home = svg(`
  <path d="M12 48 L50 14 L88 48" fill="none" stroke="currentColor" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M23 45 V86 H42 V64 H58 V86 H77 V45" fill="currentColor"/>
`);

export const back = svg(`
  <path d="M60 18 L28 50 L60 82" fill="none" stroke="currentColor" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
`);

/** Big "go" arrow (play triangle). */
export const go = svg(`<path d="M30 16 L84 50 L30 84 Z" fill="currentColor" stroke="currentColor" stroke-width="8" stroke-linejoin="round"/>`);

export const check = svg(`
  <path d="M18 52 L40 74 L84 26" fill="none" stroke="currentColor" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
`);

export const cross = svg(`
  <path d="M24 24 L76 76 M76 24 L24 76" fill="none" stroke="currentColor" stroke-width="14" stroke-linecap="round"/>
`);

export const lock = svg(`
  <path d="M32 46 V34 A18 18 0 0 1 68 34 V46" fill="none" stroke="${INK}" stroke-width="10"/>
  <rect x="22" y="44" width="56" height="44" rx="8" fill="#ffc61a" stroke="${INK}" stroke-width="5"/>
  <circle cx="50" cy="62" r="6" fill="${INK}"/><rect x="47" y="64" width="6" height="12" rx="2" fill="${INK}"/>
`);

/** Dice showing five pips (re-roll the seed). */
export const dice = svg(`
  <rect x="12" y="12" width="76" height="76" rx="16" fill="#fff" stroke="${INK}" stroke-width="6"/>
  <circle cx="32" cy="32" r="7" fill="${INK}"/><circle cx="68" cy="32" r="7" fill="${INK}"/>
  <circle cx="50" cy="50" r="7" fill="#e8302e"/>
  <circle cx="32" cy="68" r="7" fill="${INK}"/><circle cx="68" cy="68" r="7" fill="${INK}"/>
`);

export const soundOn = svg(`
  <path d="M14 38 H32 L54 18 V82 L32 62 H14 Z" fill="currentColor"/>
  <path d="M66 34 Q76 50 66 66 M76 24 Q94 50 76 76" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>
`);

export const soundOff = svg(`
  <path d="M14 38 H32 L54 18 V82 L32 62 H14 Z" fill="currentColor"/>
  <path d="M66 36 L90 64 M90 36 L66 64" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round"/>
`);

/** Trash can (reset progress). */
export const trash = svg(`
  <rect x="16" y="20" width="68" height="10" rx="4" fill="currentColor"/>
  <rect x="40" y="10" width="20" height="10" rx="3" fill="currentColor"/>
  <path d="M24 34 H76 L70 90 H30 Z" fill="currentColor"/>
  <path d="M40 44 V80 M50 44 V80 M60 44 V80" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity="0.6"/>
`);

/** Five-point star path centered at (cx, cy). */
function starPath(cx, cy, r, inner = 0.45) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * inner : r;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    d += `${i ? 'L' : 'M'}${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)} `;
  }
  return `${d}Z`;
}

export const star = svg(`<path d="${starPath(50, 54, 44)}" fill="#ffd21f" stroke="#fff" stroke-width="6" stroke-linejoin="round"/>`);

/** Trophy cup in a medal color ('gold' | 'silver' | 'bronze' | 'ribbon'); null = empty outline. */
export function cup(medal) {
  if (!medal) {
    return svg(`
      <path d="M28 14 H72 V38 A22 22 0 0 1 28 38 Z" fill="none" stroke="#fff" stroke-width="6" stroke-dasharray="8 6" opacity="0.8"/>
      <rect x="36" y="74" width="28" height="12" rx="3" fill="none" stroke="#fff" stroke-width="5" opacity="0.8"/>`);
  }
  if (medal === 'ribbon') {
    return svg(`
      <path d="M38 50 L26 92 L40 84 L46 96 L54 58 Z M62 50 L74 92 L60 84 L54 96 L46 58 Z" fill="#e8307e" stroke="#fff" stroke-width="3"/>
      <circle cx="50" cy="36" r="24" fill="${MEDAL.ribbon}" stroke="#fff" stroke-width="5"/>
      <circle cx="50" cy="36" r="10" fill="#fff" opacity="0.7"/>`);
  }
  const c = MEDAL[medal] || MEDAL.gold;
  return svg(`
    <path d="M28 20 H14 Q12 40 32 44 M72 20 H86 Q88 40 68 44" fill="none" stroke="${c}" stroke-width="6"/>
    <path d="M26 12 H74 V36 A24 24 0 0 1 26 36 Z" fill="${c}" stroke="#fff" stroke-width="4"/>
    <rect x="45" y="58" width="10" height="16" fill="${c}"/>
    <rect x="32" y="72" width="36" height="16" rx="4" fill="${c}" stroke="#fff" stroke-width="4"/>
    <path d="M36 20 Q36 40 46 48" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity="0.6"/>`);
}

/** "New ball!" sunburst behind a ball picture (used by the unlock popup). */
export const burst = (() => {
  let d = '';
  const n = 14;
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? 34 : 49;
    const a = (i * Math.PI) / n;
    d += `${i ? 'L' : 'M'}${(50 + r * Math.cos(a)).toFixed(1)} ${(50 + r * Math.sin(a)).toFixed(1)} `;
  }
  return svg(`<path d="${d}Z" fill="#ffd21f" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>`);
})();

// ------------------------------------------------------ race difficulties

// A little perspective road: trapezoid from a wide bottom to a narrow top.
// `w` = bottom half-width (difficulty 1 = 40 … 5 = 12).
function road(w, { rails = 'full', color = '#9aa4b5', sky = true, gap = false } = {}) {
  const top = w * 0.35;
  let s = sky ? '<rect width="100" height="100" fill="#b8e6ff"/>' : '';
  if (rails !== 'full') s += '<rect y="56" width="100" height="44" fill="#6ec6ff" opacity="0.6"/>';
  else s += '<path d="M0 44 Q30 34 60 42 T100 40 V100 H0 Z" fill="#7fd36b"/>';
  const road = (y0, y1) => {
    const f0 = (y0 - 30) / 70;
    const f1 = (y1 - 30) / 70;
    const hw0 = top + (w - top) * f0;
    const hw1 = top + (w - top) * f1;
    return `<path d="M${50 - hw1} ${y1} L${50 - hw0} ${y0} L${50 + hw0} ${y0} L${50 + hw1} ${y1} Z" fill="${color}" stroke="${INK}" stroke-width="2"/>`;
  };
  if (gap) s += road(30, 56) + road(66, 100);
  else s += road(30, 100);
  if (rails === 'full' || rails === 'curves') {
    const dash = rails === 'curves' ? ' stroke-dasharray="10 12"' : '';
    s += `<path d="M${50 - top - 2} 30 L${50 - w - 4} 100 M${50 + top + 2} 30 L${50 + w + 4} 100" stroke="#ff8a1f" stroke-width="5"${dash}/>`;
  }
  return s;
}

const hammer = (x, y, s = 1) => `
  <g transform="translate(${x} ${y}) scale(${s})">
    <rect x="-2" y="-30" width="4" height="26" fill="#555"/>
    <rect x="-12" y="-8" width="24" height="14" rx="2" fill="#e8302e" stroke="#fff" stroke-width="2"/>
  </g>`;

const bumper = (x, y, r = 5) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#ff5fa2" stroke="#fff" stroke-width="2"/>`;

const wreckingBall = (x, y) => `
  <path d="M${x} 4 L${x + 10} ${y}" stroke="#555" stroke-width="2"/>
  <circle cx="${x + 10}" cy="${y}" r="8" fill="#555" stroke="#fff" stroke-width="2"/>`;

/** Picture of each difficulty's track style (index 1..5). */
export const difficulty = {
  1: svg(road(44, { rails: 'full' }) + `<circle cx="50" cy="84" r="8" fill="#e8302e" stroke="#fff" stroke-width="2"/>`),
  2: svg(road(34, { rails: 'full' }) + bumper(38, 56) + bumper(60, 44, 4) + `<circle cx="50" cy="86" r="8" fill="#e8302e" stroke="#fff" stroke-width="2"/>`),
  3: svg(road(26, { rails: 'curves', gap: false }) + `<rect x="36" y="56" width="28" height="8" fill="#c68b4a" stroke="${INK}" stroke-width="1.5"/>` + hammer(50, 46, 0.8) + `<circle cx="50" cy="88" r="7" fill="#e8302e" stroke="#fff" stroke-width="2"/>`),
  4: svg(road(20, { rails: 'none', gap: true }) + hammer(44, 50, 0.9) + wreckingBall(60, 40) + `<circle cx="50" cy="88" r="7" fill="#e8302e" stroke="#fff" stroke-width="2"/>`),
  5: svg(road(11, { rails: 'none', gap: true, color: '#8a3ee8' }) + hammer(40, 52, 0.9) + hammer(60, 42, 0.7) + wreckingBall(26, 34) +
    `<path d="M38 28 L62 28" stroke="#ffd21f" stroke-width="5" stroke-linecap="round"/><circle cx="50" cy="90" r="6" fill="#e8302e" stroke="#fff" stroke-width="2"/>`),
};

// ------------------------------------------------------ playground chips

/** Floor size: a flat island with more tiles as it grows. */
function island(n) {
  const size = 20 + n * 18;
  const x0 = 50 - size / 2;
  const cell = size / (n + 1);
  let tiles = '';
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      tiles += `<rect x="${x0 + i * cell}" y="${x0 + j * cell}" width="${cell}" height="${cell}" fill="${(i + j) % 2 ? '#2fb84a' : '#7fd36b'}"/>`;
    }
  }
  return svg(`${tiles}<rect x="${x0}" y="${x0}" width="${size}" height="${size}" fill="none" stroke="#fff" stroke-width="4" rx="4"/>`);
}

export const size = { small: island(1), medium: island(2), large: island(3) };

export const theme = {
  grass: svg(`
    <path d="M50 10 L90 30 L50 50 L10 30 Z" fill="#5cc93b" stroke="#fff" stroke-width="3"/>
    <path d="M10 30 L50 50 V90 L10 70 Z" fill="#8a5a2b"/><path d="M90 30 L50 50 V90 L90 70 Z" fill="#6b4420"/>
    <path d="M10 30 L50 50 L90 30 V40 L50 60 L10 40 Z" fill="#2fb84a"/>`),
  snow: svg(`
    <path d="M50 10 L90 30 L50 50 L10 30 Z" fill="#ffffff" stroke="#bfefff" stroke-width="3"/>
    <path d="M10 30 L50 50 V90 L10 70 Z" fill="#8fb8d8"/><path d="M90 30 L50 50 V90 L90 70 Z" fill="#6a93b8"/>
    <path d="M10 30 L50 50 L90 30 V40 L50 60 L10 40 Z" fill="#e8f7ff"/>
    <g stroke="#2e6be8" stroke-width="3" stroke-linecap="round"><path d="M50 18 V42 M40 24 L60 36 M60 24 L40 36"/></g>`),
};

export const bumpiness = {
  flat: svg(`<rect x="6" y="56" width="88" height="30" rx="4" fill="#2fb84a"/><rect x="6" y="56" width="88" height="8" fill="#7fd36b"/>`),
  hilly: svg(`<path d="M6 86 V62 Q20 40 36 58 T66 54 Q80 40 94 58 V86 Z" fill="#2fb84a"/>`),
  mountains: svg(`
    <path d="M4 88 L32 22 L52 58 L68 34 L96 88 Z" fill="#8a8f9e"/>
    <path d="M24 40 L32 22 L40 40 L34 36 L30 42 Z M62 44 L68 34 L74 46 Z" fill="#fff"/>`),
};

export const stuff = {
  ramps: svg(`<path d="M10 80 L84 80 L84 34 Z" fill="#ff8a1f" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>`),
  jumps: svg(`
    <path d="M6 84 L40 84 L40 62 Z" fill="#ff8a1f" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>
    <path d="M42 56 Q62 10 86 58" fill="none" stroke="#fff" stroke-width="4" stroke-dasharray="6 6"/>
    <circle cx="64" cy="28" r="9" fill="#e8302e" stroke="#fff" stroke-width="3"/>`),
  bouncePads: svg(`
    <path d="M20 84 L28 72 L20 66 L28 58" fill="none" stroke="#555" stroke-width="5"/>
    <path d="M80 84 L72 72 L80 66 L72 58" fill="none" stroke="#555" stroke-width="5"/>
    <rect x="14" y="48" width="72" height="12" rx="5" fill="#22d3ee" stroke="#fff" stroke-width="3"/>
    <path d="M50 42 V12 M38 24 L50 12 L62 24" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`),
  tunnels: svg(`
    <path d="M10 86 V52 A40 40 0 0 1 90 52 V86 H70 V56 A20 20 0 0 0 30 56 V86 Z" fill="#8a8f9e" stroke="#fff" stroke-width="4"/>
    <path d="M30 86 V56 A20 20 0 0 1 70 56 V86 Z" fill="${INK}" opacity="0.75"/>`),
  bumpers: svg(`
    <rect x="12" y="44" width="76" height="12" rx="6" fill="#8a3ee8" stroke="#fff" stroke-width="3" transform="rotate(-20 50 50)"/>
    <circle cx="50" cy="50" r="12" fill="#ff5fa2" stroke="#fff" stroke-width="4"/>
    <path d="M22 18 A36 36 0 0 1 84 26" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
    <path d="M76 18 L84 26 L74 30" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`),
};

export const stars = {
  none: svg(`<path d="${starPath(50, 54, 38)}" fill="none" stroke="#fff" stroke-width="6" stroke-linejoin="round" opacity="0.8"/>
    <path d="M16 86 L84 18" stroke="#e8302e" stroke-width="10" stroke-linecap="round"/>`),
  some: svg(`<path d="${starPath(32, 56, 26)}" fill="#ffd21f" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>
    <path d="${starPath(68, 44, 26)}" fill="#ffd21f" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>`),
  lots: svg([[22, 30], [50, 22], [78, 30], [34, 66], [66, 66]]
    .map(([x, y]) => `<path d="${starPath(x, y, 18)}" fill="#ffd21f" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>`).join('')),
};
