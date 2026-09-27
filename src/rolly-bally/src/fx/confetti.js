// DOM confetti burst for celebrations outside Race (Race has its own in
// RaceHud). Deterministic look (no Math.random), pointer-events none, removes
// itself. Returns a cancel function.

import './fx.css';

const COLORS = ['#e8302e', '#ff8a1f', '#ffd21f', '#2fb84a', '#2e6be8', '#8a3ee8', '#ff5fa2', '#22d3ee'];

/**
 * @param {HTMLElement} parent
 * @param {number} [n=60] pieces
 * @returns {() => void} remove now
 */
export function confetti(parent, n = 60) {
  const box = document.createElement('div');
  box.className = 'fx-confetti';
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i');
    const h = ((i * 2654435761) >>> 0) / 4294967296;
    const h2 = ((i * 40503 + 17) % 97) / 97;
    c.style.left = `${(h * 100).toFixed(1)}%`;
    c.style.background = COLORS[i % COLORS.length];
    c.style.animationDuration = `${(1.8 + h2 * 1.6).toFixed(2)}s`;
    c.style.animationDelay = `${(h2 * 0.6).toFixed(2)}s`;
    c.style.setProperty('--dx', `${((h2 - 0.5) * 30).toFixed(1)}vw`);
    c.style.setProperty('--rot', `${Math.round((h - 0.5) * 1440)}deg`);
    box.appendChild(c);
  }
  parent.appendChild(box);
  const t = setTimeout(() => box.remove(), 4200);
  return () => {
    clearTimeout(t);
    box.remove();
  };
}
