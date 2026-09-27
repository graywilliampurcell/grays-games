// Ball skin catalog (pure data, no three.js so tests/Save can import it).
// Rendering lives in skins.js. Unlock rules (UI agent): one skin per Race
// series completed, one per 50 Playground stars, in UNLOCK_ORDER.
//
// pattern: how skins.js paints the canvas texture
//   solid   colors[0] with a subtle voxel grid
//   soccer  white with dark pentagon-ish patches
//   stripes horizontal bands cycling through colors
//   checker checkerboard of colors[0]/colors[1]
//   dots    colors[0] base with colors[1] polka dots
//   rainbow bands of all colors
//   swirl   diagonal bands
//   face    colors[0] base with a smiley (colors[1])
//   stars   colors[0] base with colors[1] stars

export const SKINS = [
  // starters
  { id: 'red', name: 'Red', pattern: 'solid', colors: ['#e8302e'], starter: true },
  { id: 'blue', name: 'Blue', pattern: 'solid', colors: ['#2e6be8'], starter: true },
  { id: 'yellow', name: 'Yellow', pattern: 'solid', colors: ['#ffd21f'], starter: true },
  { id: 'green', name: 'Green', pattern: 'solid', colors: ['#2fb84a'], starter: true },
  { id: 'soccer', name: 'Soccer', pattern: 'soccer', colors: ['#ffffff', '#222222'], starter: true },
  { id: 'stripes', name: 'Stripes', pattern: 'stripes', colors: ['#e8302e', '#ffffff', '#2e6be8'], starter: true },
  // unlockables, in unlock order
  { id: 'checker', name: 'Checkers', pattern: 'checker', colors: ['#111111', '#ffffff'] },
  { id: 'polka', name: 'Polka', pattern: 'dots', colors: ['#ff5fa2', '#ffffff'] },
  { id: 'rainbow', name: 'Rainbow', pattern: 'rainbow', colors: ['#e8302e', '#ff8a1f', '#ffd21f', '#2fb84a', '#2e6be8', '#8a3ee8'] },
  { id: 'beach', name: 'Beach Ball', pattern: 'stripes', colors: ['#ffffff', '#e8302e', '#ffd21f', '#2e6be8'] },
  { id: 'smiley', name: 'Smiley', pattern: 'face', colors: ['#ffd21f', '#222222'] },
  { id: 'lava', name: 'Lava', pattern: 'swirl', colors: ['#ff3d00', '#ffb300', '#8b1a00'] },
  { id: 'night', name: 'Night Sky', pattern: 'stars', colors: ['#1b1f5e', '#ffe76a'] },
  { id: 'watermelon', name: 'Watermelon', pattern: 'stripes', colors: ['#2fb84a', '#1c7a30'] },
  { id: 'candy', name: 'Candy', pattern: 'swirl', colors: ['#ffffff', '#ff4f7b'] },
  { id: 'ladybug', name: 'Ladybug', pattern: 'dots', colors: ['#e8302e', '#111111'] },
  { id: 'ice', name: 'Ice', pattern: 'checker', colors: ['#bfefff', '#ffffff'] },
  { id: 'gold', name: 'Gold', pattern: 'stars', colors: ['#f5b700', '#fff3b0'] },
];

export const STARTER_SKIN_IDS = SKINS.filter((s) => s.starter).map((s) => s.id);
export const UNLOCK_ORDER = SKINS.filter((s) => !s.starter).map((s) => s.id);

export function getSkin(id) {
  return SKINS.find((s) => s.id === id) || SKINS[0];
}
