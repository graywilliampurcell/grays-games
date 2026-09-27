// A few shared inline SVG icons used by app-level chrome. Screen/menu icons
// belong to the UI agent under src/ui/icons/.

export const ICONS = {
  home: `<svg class="icon" viewBox="0 0 64 64" aria-hidden="true">
    <path d="M8 30 L32 9 L56 30" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M15 28 V54 H27 V40 H37 V54 H49 V28" fill="currentColor"/>
  </svg>`,
  rotate: `<svg class="icon" viewBox="0 0 120 120" aria-hidden="true">
    <rect x="38" y="14" width="44" height="72" rx="8" fill="none" stroke="currentColor" stroke-width="6"/>
    <rect x="14" y="62" width="72" height="44" rx="8" fill="currentColor" opacity="0.9"/>
    <path d="M96 40 A36 36 0 0 1 90 82" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>
    <path d="M82 78 L91 86 L98 75" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  play: `<svg class="icon" viewBox="0 0 64 64" aria-hidden="true"><path d="M20 12 L52 32 L20 52 Z" fill="currentColor"/></svg>`,
  ball: `<svg class="icon" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="26" fill="currentColor"/><circle cx="24" cy="23" r="7" fill="#fff" opacity="0.5"/></svg>`,
};
