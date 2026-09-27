// Small DOM helpers shared by the menu screens.

import * as icons from './icons/index.js';

/** h('div', {class: 'x', onclick: fn}, child, 'text', [more]) → element */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/**
 * A picture button. `icon` is an SVG string or a Node; `caption` is optional
 * decoration for grown-ups; `label` is the accessible name.
 */
export function iconButton({ icon, caption, label, color = 'white', kind = '', className = '', onTap, app, sound = 'click' }) {
  const btn = h('button', {
    type: 'button',
    class: `rb-btn ${kind ? `rb-btn--${kind}` : ''} rb-btn--${color} ${className}`.trim(),
    'aria-label': label || caption || '',
  });
  if (icon instanceof Node) btn.append(icon);
  else if (icon) btn.insertAdjacentHTML('beforeend', icon);
  if (caption) btn.append(h('span', { class: 'rb-caption' }, caption));
  if (onTap) {
    btn.addEventListener('click', (e) => {
      if (app && sound) app.audio.play(sound);
      onTap(e);
    });
  }
  return btn;
}

/** Round "back" button for the top-left of a menu screen (plain tap). */
export function backButton(app, to = 'home') {
  return iconButton({
    icon: to === 'home' ? icons.home : icons.back,
    label: 'Back',
    kind: 'round',
    color: 'white',
    className: 'ui-back',
    app,
    onTap: () => app.router.go(to),
  });
}

/**
 * Make `btn` need a press-and-hold of `ms` before `onDone` fires; a ring
 * fills while holding (same look as the in-game Home button).
 */
export function makeHoldButton(btn, onDone, ms = 1000) {
  btn.classList.add('ui-hold');
  btn.style.setProperty('--hold-ms', `${ms}ms`);
  btn.insertAdjacentHTML('beforeend', '<svg class="hold-ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" pathLength="100"/></svg>');
  let timer = 0;
  const cancel = () => {
    clearTimeout(timer);
    timer = 0;
    btn.classList.remove('holding');
  };
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    btn.classList.add('holding');
    clearTimeout(timer);
    timer = setTimeout(() => {
      cancel();
      onDone();
    }, ms);
  });
  for (const t of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(t, cancel);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
  return btn;
}

/** A row of `n` dots (for race counts), wrapped in rows of 5. */
export function pips(n, color = 'var(--rb-white)') {
  const el = h('span', { class: 'ui-pips', 'aria-hidden': 'true' });
  for (let i = 0; i < n; i++) el.append(h('i', { style: `background:${color}` }));
  return el;
}

/** Big green Go! button. */
export function goButton(app, onTap) {
  return iconButton({ icon: icons.go, caption: 'Go!', label: 'Go', kind: 'big', color: 'green', className: 'ui-go', app, sound: 'go', onTap });
}

/** Simple toggle group helper: marks `selected` buttons with aria-pressed. */
export function setPressed(btn, on) {
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
}
