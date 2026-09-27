// In-mode result overlays (DOM in ctx.ui):
//   showRaceResult  big medal for this race, the finishing order as balls on
//                   steps, the series so far, and a big ▶ "next race" button
//   showTrophy      after the series: a medal per race and the cup, big 🏠 button
// Both ignore taps for `tapDelay` s (a kid still steering mustn't skip them),
// then the button or a tap anywhere continues.

import { drawSkinIcon, getSkin } from '../ball/skins.js';
import { MEDAL_COLORS, medal as medalIcon, cup as cupIcon, next as nextIcon, home as homeIcon } from './icons.js';
import { medalForPlace } from './difficulty.js';

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

function ballPicture(skin, size) {
  try {
    return drawSkinIcon(skin, size);
  } catch {
    const c = el('canvas');
    c.style.background = getSkin(skin).colors[0];
    return c;
  }
}

/** Medal row for a series: earned medals, then empty slots. */
function medalRow(medals, races) {
  const row = el('div', 'race-medals');
  for (let i = 0; i < races; i++) {
    if (medals[i]) {
      const icon = el('span', '', medalIcon(medals[i])).firstElementChild;
      icon.style.animationDelay = `${0.15 * i}s`;
      row.appendChild(icon);
    } else {
      row.appendChild(el('span', 'todo'));
    }
  }
  return row;
}

/**
 * A panel that continues on a button tap (or a tap anywhere) after a delay.
 * @returns {{el:HTMLElement, dispose:() => void}}
 */
function panel(root, { children, button, color, label, tapDelay, audio, onContinue }) {
  const p = el('div', 'race-panel');
  p.setAttribute('data-ui', '');
  p.append(...children);
  const btn = el('button', `rb-btn rb-btn--round rb-btn--${color} race-panel__btn`, button);
  btn.type = 'button';
  btn.setAttribute('aria-label', label);
  btn.disabled = true;
  p.appendChild(btn);
  root.appendChild(p);

  let done = false;
  let ready = false;
  const go = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (!ready || done) return;
    done = true;
    audio?.play('click');
    onContinue();
  };
  const timer = setTimeout(() => {
    ready = true;
    btn.disabled = false;
    btn.classList.add('rb-pop');
  }, tapDelay * 1000);
  btn.addEventListener('click', go);
  // Tap anywhere: only a touch that STARTS on the ready panel counts (a
  // finger still steering from the race must not skip it when lifted).
  let armed = false;
  p.addEventListener('pointerdown', () => (armed = ready));
  p.addEventListener('pointerup', (e) => {
    if (armed) go(e);
    armed = false;
  });
  return {
    el: p,
    dispose() {
      clearTimeout(timer);
      p.remove();
    },
  };
}

/**
 * @param {HTMLElement} root
 * @param {object} o
 * @param {number} o.place 1..4
 * @param {Array<{skin:string, me:boolean}>} o.order finishing order (all racers)
 * @param {string[]} o.medals series medals so far (including this race)
 * @param {number} o.races series length
 * @param {boolean} o.isLast last race of the series
 */
export function showRaceResult(root, { place, order, medals, races, isLast, tapDelay = 1.2, audio, onNext }) {
  const medal = medalForPlace(place);
  const big = el('div', 'race-panel__medal', medalIcon(medal, place));
  big.setAttribute('aria-label', `Place ${place}`);

  const podium = el('div', 'race-panel__row race-podium');
  const heights = [92, 70, 54, 40];
  order.forEach((r, i) => {
    const slot = el('div', `race-podium__slot${r.me ? ' me' : ''}`);
    slot.appendChild(ballPicture(r.skin, 96));
    const step = el('div', 'race-podium__step', String(i + 1));
    step.style.height = `${heights[Math.min(3, i)]}px`;
    step.style.background = MEDAL_COLORS[medalForPlace(i + 1)];
    slot.appendChild(step);
    podium.appendChild(slot);
  });

  const children = [big, podium];
  if (races > 1) children.push(medalRow(medals, races));
  return panel(root, {
    children,
    button: isLast ? cupIcon('gold') : nextIcon,
    color: 'green',
    label: isLast ? 'See my trophy' : 'Next race',
    tapDelay,
    audio,
    onContinue: onNext,
  });
}

/**
 * @param {HTMLElement} root
 * @param {{medals:string[], cup:string, seed?:string}} o
 */
export function showTrophy(root, { medals, cup, seed = null, tapDelay = 1.2, audio, onDone }) {
  const big = el('div', 'race-panel__cup', cupIcon(cup));
  big.setAttribute('aria-label', `${cup} cup`);
  const children = [big, medalRow(medals, medals.length)];
  // Series code (4 emoji), small decoration so a grown-up can note it.
  if (seed) {
    const code = el('div', 'race-seed');
    code.textContent = seed;
    code.setAttribute('aria-label', 'Race code');
    children.push(code);
  }
  return panel(root, {
    children,
    button: homeIcon,
    color: 'blue',
    label: 'Home',
    tapDelay,
    audio,
    onContinue: onDone,
  });
}
