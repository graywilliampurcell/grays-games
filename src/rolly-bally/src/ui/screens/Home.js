// Home: three big picture buttons (Playground, Race, My Balls) and a small
// gear in the corner that needs a 1 s hold to open the grown-up menu.

import * as icons from '../icons/index.js';
import { h, iconButton, makeHoldButton } from '../components.js';
import { drawSkinIcon } from '../../ball/skins.js';

export class HomeScreen {
  mount(root, params, app) {
    const data = app.save.get();
    const hasNew = (data.ui?.newSkins || []).length > 0;

    const ball = drawSkinIcon(data.skins.selected, 192);
    ball.className = 'icon ui-skin-pic';

    const buttons = h('div', { class: 'rb-row home-buttons' },
      iconButton({
        icon: icons.hills, caption: 'Playground', color: 'green', kind: 'big', className: 'home-btn', app,
        onTap: () => app.router.go('playground-setup'),
      }),
      iconButton({
        icon: icons.flag, caption: 'Race', color: 'red', kind: 'big', className: 'home-btn', app,
        onTap: () => app.router.go('race-setup'),
      }),
      iconButton({
        icon: ball, caption: 'My Balls', label: 'My Balls', color: 'blue', kind: 'big', className: `home-btn${hasNew ? ' has-new' : ''}`, app,
        onTap: () => app.router.go('skins'),
      }),
    );

    const gear = iconButton({ icon: icons.gear, label: 'Grown-ups (hold)', kind: 'round', color: 'white', className: 'home-gear' });
    makeHoldButton(gear, () => {
      app.audio.play('click');
      app.router.go('settings');
    });

    this.el = h('div', { class: 'rb-screen ui-screen home' },
      h('h1', { class: 'home-title', 'aria-label': 'Rolly Bally' }, 'Rolly Bally'),
      buttons,
      gear,
    );
    root.append(this.el);
  }

  unmount() {}
}
