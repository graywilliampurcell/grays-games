// Race HUD (DOM in ctx.ui, pointer-events none so steering works over it):
// big position badge in medal colors, a progress bar with a dot per racer
// (the player's dot is their ball), series pips, the 3-2-1-GO countdown,
// checkpoint / boost flashes, the fall fade, the finish banner and confetti.
// Numbers are decoration; colors and pictures carry the meaning.

import { drawSkinIcon, getSkin } from '../ball/skins.js';
import { MEDAL_COLORS, flag, check } from './icons.js';
import { medalForPlace } from './difficulty.js';

const SUFFIX = ['', 'st', 'nd', 'rd', 'th'];
const CONFETTI_COLORS = ['#e8302e', '#ff8a1f', '#ffd21f', '#2fb84a', '#2e6be8', '#8a3ee8', '#ff5fa2', '#22d3ee'];

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

export class RaceHud {
  /**
   * @param {HTMLElement} root ctx.ui
   * @param {{races:number}} o
   */
  constructor(root, { races }) {
    this.root = root;
    this.races = races;

    this.progress = el('div', 'race-progress');
    this.bar = el('div', 'race-progress__track');
    this.fill = el('div', 'race-progress__fill');
    this.bar.appendChild(this.fill);
    this.progress.append(this.bar, el('div', 'race-progress__flag', flag));

    this.series = el('div', 'race-series');
    this.place = el('div', 'race-place');
    this.fade = el('div', 'race-fade');
    this.fx = el('div', 'race-fx'); // transient flashes/banners live here
    root.append(this.fade, this.progress, this.series, this.place, this.fx);

    this.dots = [];
    this.lastPlace = 0;
    this.timers = new Set();
  }

  /** New race: racer dots (player first) and series pips. */
  setupRace({ playerSkin, aiSkins, raceIndex, medals }) {
    for (const d of this.dots) d.remove();
    this.dots = [];
    aiSkins.forEach((id) => {
      const d = el('div', 'race-dot');
      d.style.background = getSkin(id).colors[0];
      this.bar.appendChild(d);
      this.dots.push(d);
    });
    const me = el('div', 'race-dot race-dot--player');
    try {
      me.appendChild(drawSkinIcon(playerSkin, 64));
    } catch {
      me.style.background = getSkin(playerSkin).colors[0];
    }
    this.bar.appendChild(me);
    this.dots.unshift(me);

    this.series.innerHTML = '';
    this.series.hidden = this.races <= 1;
    for (let i = 0; i < this.races; i++) {
      const pip = el('i');
      if (medals[i]) pip.style.background = MEDAL_COLORS[medals[i]];
      if (i === raceIndex) pip.className = 'current';
      this.series.appendChild(pip);
    }
    this.lastPlace = 0;
    this.setPlace(1);
    this.setProgress(0, []);
    this.clearFx();
    this.setVisible(true);
  }

  setVisible(on) {
    for (const e of [this.progress, this.series, this.place]) e.style.visibility = on ? '' : 'hidden';
  }

  /** @param {number} player 0..1 @param {number[]} ai 0..1 each */
  setProgress(player, ai) {
    const pct = (f) => `${(Math.min(1, Math.max(0, f)) * 100).toFixed(1)}%`;
    this.fill.style.width = pct(player);
    if (this.dots[0]) this.dots[0].style.left = pct(player);
    for (let i = 0; i < ai.length; i++) if (this.dots[i + 1]) this.dots[i + 1].style.left = pct(ai[i]);
  }

  setPlace(place) {
    if (place === this.lastPlace) return;
    this.lastPlace = place;
    const medal = medalForPlace(place);
    this.place.style.background = MEDAL_COLORS[medal];
    this.place.innerHTML = `${place}<sup>${SUFFIX[Math.min(4, place)]}</sup>`;
    this.place.setAttribute('aria-label', `Place ${place}`);
    this.place.classList.remove('bump');
    void this.place.offsetWidth; // restart the animation
    this.place.classList.add('bump');
  }

  // ------------------------------------------------------------ transient fx

  _transient(node, ms) {
    this.fx.appendChild(node);
    const t = setTimeout(() => {
      node.remove();
      this.timers.delete(t);
    }, ms);
    this.timers.add(t);
    return node;
  }

  clearFx() {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    this.fx.innerHTML = '';
    this.fade.style.opacity = '0';
  }

  /** '3' | '2' | '1' | 'GO!' */
  countdown(text) {
    const b = el('div', `race-banner${text === 'GO!' ? ' race-banner--go' : ''}`);
    b.appendChild(el('span', '', text));
    this._transient(b, 1100);
  }

  checkpoint() {
    this._transient(el('div', 'race-check', check), 1000);
  }

  boost() {
    this._transient(el('div', 'race-boost'), 900);
  }

  /** 0..1 white fade (falling / respawn). */
  setFade(v) {
    this.fade.style.opacity = String(Math.max(0, Math.min(1, v)));
  }

  finish() {
    const b = el('div', 'race-banner race-banner--finish');
    b.appendChild(el('span', '', 'FINISH'));
    this._transient(b, 2600);
    this.confetti();
  }

  /** DOM confetti burst (deterministic look, no Math.random needed). */
  confetti(n = 70, parent = this.fx) {
    const box = el('div', 'race-confetti');
    for (let i = 0; i < n; i++) {
      const c = el('i');
      const h = ((i * 2654435761) >>> 0) / 4294967296;
      const h2 = ((i * 40503 + 17) % 97) / 97;
      c.style.left = `${(h * 100).toFixed(1)}%`;
      c.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      c.style.animationDuration = `${(1.8 + h2 * 1.6).toFixed(2)}s`;
      c.style.animationDelay = `${(h2 * 0.6).toFixed(2)}s`;
      c.style.setProperty('--dx', `${((h2 - 0.5) * 30).toFixed(1)}vw`);
      c.style.setProperty('--rot', `${Math.round((h - 0.5) * 1440)}deg`);
      box.appendChild(c);
    }
    parent.appendChild(box);
    const t = setTimeout(() => {
      box.remove();
      this.timers.delete(t);
    }, 4000);
    this.timers.add(t);
  }

  dispose() {
    this.clearFx();
    for (const e of [this.progress, this.series, this.place, this.fade, this.fx]) e.remove();
  }
}
