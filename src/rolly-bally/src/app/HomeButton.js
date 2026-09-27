// The shared in-game Home button (top-left). Needs a 1 s press-and-hold so a
// kid bumping it doesn't quit; a ring fills while holding. The Game host adds
// one to every mode's HUD automatically (ctx.hud.homeButton).

import { ICONS } from './icons.js';

const HOLD_MS = 1000;

export function createHomeButton(onExit) {
  const btn = document.createElement('button');
  btn.className = 'rb-btn rb-btn--round hud-home';
  btn.setAttribute('aria-label', 'Home (hold)');
  btn.innerHTML = `${ICONS.home}<svg class="hold-ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" pathLength="100"/></svg>`;

  let timer = 0;
  const cancel = () => {
    clearTimeout(timer);
    timer = 0;
    btn.classList.remove('holding');
  };
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    btn.classList.add('holding');
    clearTimeout(timer);
    timer = setTimeout(() => {
      cancel();
      onExit();
    }, HOLD_MS);
  });
  btn.addEventListener('pointerup', cancel);
  btn.addEventListener('pointerleave', cancel);
  btn.addEventListener('pointercancel', cancel);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
  return btn;
}
