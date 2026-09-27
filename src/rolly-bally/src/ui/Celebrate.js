// "New ball!" popup: listens for skinUnlocked and shows the new ball on a
// burst, over whatever is on screen (menus or a running mode). It never
// blocks touches (pointer-events: none) and goes away by itself, so it
// can't interrupt steering. Several unlocks queue up one after another.
// While `hold()` returns true (e.g. the race trophy is on screen) the queue
// waits, so the new ball doesn't cover the cup; it pops up on Home instead.

import * as icons from './icons/index.js';
import { h } from './components.js';
import { drawSkinIcon } from '../ball/skins.js';

const SHOW_MS = 3200;
const HOLD_POLL_MS = 400;

export class Celebrate {
  constructor({ events, audio, parent = document.getElementById('ui') || document.body, hold = () => false }) {
    this.audio = audio;
    this.hold = hold;
    this.parent = parent;
    this.queue = [];
    this.current = null;
    this.off = events.on('skinUnlocked', ({ skinId } = {}) => {
      if (!skinId) return;
      this.queue.push(skinId);
      if (!this.current) this._next();
    });
  }

  _next() {
    if (this.queue.length && this.hold()) {
      this.current = setTimeout(() => this._next(), HOLD_POLL_MS);
      return;
    }
    const skinId = this.queue.shift();
    if (!skinId) {
      this.current = null;
      return;
    }
    const ball = drawSkinIcon(skinId, 160);
    ball.className = 'unlock-ball';
    const el = h('div', { class: 'unlock-toast', role: 'status', 'aria-label': 'New ball!' },
      h('div', { class: 'unlock-burst', html: icons.burst }),
      ball,
      h('div', { class: 'unlock-text' }, 'New ball!'),
    );
    this.parent.append(el);
    this.audio.play('unlock');
    this.current = setTimeout(() => {
      el.classList.add('leaving');
      setTimeout(() => {
        el.remove();
        this._next();
      }, 400);
    }, SHOW_MS);
  }

  dispose() {
    this.off();
    clearTimeout(this.current);
  }
}
