// My Balls: a big spinning preview of the chosen ball and a grid of every
// skin. Locked skins show a lock plus a picture of how to earn them (a
// trophy for finishing a race series, or stars from the Playground).

import * as icons from '../icons/index.js';
import { h, iconButton, backButton, setPressed } from '../components.js';
import { SKINS, getSkin } from '../../ball/skinData.js';
import { drawSkinIcon, drawSkinSphere } from '../../ball/skins.js';
import { nextUnlockHint } from '../progress.js';

const PREVIEW_CSS = 260; // px, before devicePixelRatio

export class SkinsScreen {
  mount(root, params, app) {
    this.app = app;
    const data = app.save.get();
    const unlocked = new Set(data.skins.unlocked);
    const fresh = new Set(data.ui?.newSkins || []);
    const hint = nextUnlockHint(data);
    let selected = data.skins.selected;

    // Turntable: redraw the 2D sphere with a growing spin (~30 fps).
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const preview = h('canvas', { class: 'sk-preview', width: Math.round(PREVIEW_CSS * dpr), height: Math.round(PREVIEW_CSS * dpr) });
    let spin = 0;
    let last = 0;
    let lastDraw = 0;
    const tick = (now) => {
      this.raf = requestAnimationFrame(tick);
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      spin -= dt * 1.4;
      if (now - lastDraw < 33) return;
      lastDraw = now;
      drawSkinSphere(preview, selected, spin);
    };
    this.raf = requestAnimationFrame(tick);
    const nameEl = h('div', { class: 'rb-caption sk-name' }, getSkin(selected).name);

    const buttons = SKINS.map((skin) => {
      const isOpen = unlocked.has(skin.id);
      const pic = drawSkinIcon(skin.id, 128);
      pic.className = 'icon ui-skin-pic';
      const btn = iconButton({
        icon: pic,
        label: isOpen ? skin.name : `${skin.name} (locked)`,
        color: 'white',
        className: `sk-btn${isOpen ? '' : ' locked'}${fresh.has(skin.id) ? ' has-new' : ''}`,
        app,
        sound: isOpen ? 'pop' : 'thump',
        onTap: () => {
          if (!isOpen) {
            btn.classList.remove('wiggle');
            void btn.offsetWidth;
            btn.classList.add('wiggle');
            return;
          }
          selected = skin.id;
          app.progress.selectSkin(skin.id);
          nameEl.textContent = skin.name;
          lastDraw = 0;
          buttons.forEach((b, i) => setPressed(b, SKINS[i].id === selected));
        },
      });
      if (!isOpen) {
        btn.append(h('span', { class: 'sk-lock', html: icons.lock }));
        if (hint && hint.skinId === skin.id) btn.append(unlockHint(hint));
      }
      setPressed(btn, skin.id === selected);
      return btn;
    });

    this.el = h('div', { class: 'rb-screen ui-screen setup skins' },
      backButton(app),
      h('div', { class: 'setup-title', html: icons.balls }),
      h('div', { class: 'setup-body' },
        h('div', { class: 'sk-stage' }, preview, nameEl),
        h('div', { class: 'sk-grid' }, buttons),
      ),
    );
    root.append(this.el);
  }

  unmount() {
    cancelAnimationFrame(this.raf);
    this.app.progress.markSkinsSeen();
  }
}

/** "Trophy or ⭐ 23/50" picture under the next locked skin. */
function unlockHint({ starsHave, starsNeed }) {
  const pct = Math.round((starsHave / starsNeed) * 100);
  return h('span', { class: 'sk-hint', 'aria-hidden': 'true' },
    h('span', { class: 'sk-hint-icon', html: icons.cup('gold') }),
    h('span', { class: 'sk-hint-or' }, '/'),
    h('span', { class: 'sk-hint-icon', html: icons.star }),
    h('span', { class: 'sk-hint-bar' }, h('i', { style: `width:${pct}%` })),
  );
}
