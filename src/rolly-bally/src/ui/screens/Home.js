// Home: three big picture buttons (Playground, Pathways, Race). My Balls and
// the grown-up gear (1 s hold) are small round buttons in the bottom-right
// corner.

import * as icons from '../icons/index.js';
import { h, iconButton, makeHoldButton } from '../components.js';
import { drawSkinIcon } from '../../ball/skins.js';

export class HomeScreen {
  mount(root, params, app) {
    const data = app.save.get();
    const hasNew = (data.ui?.newSkins || []).length > 0;

    const ball = drawSkinIcon(data.skins.selected, 128);
    ball.className = 'icon ui-skin-pic';

    const buttons = h('div', { class: 'rb-row home-buttons' },
      iconButton({
        icon: icons.hills, caption: 'Playground', color: 'green', kind: 'big', className: 'home-btn', app,
        onTap: () => app.router.go('playground-setup'),
      }),
      iconButton({
        icon: icons.pathways, caption: 'Pathways', color: 'yellow', kind: 'big', className: 'home-btn', app,
        onTap: () => app.router.go('pathways-setup'),
      }),
      iconButton({
        icon: icons.flag, caption: 'Race', color: 'red', kind: 'big', className: 'home-btn', app,
        onTap: () => app.router.go('race-setup'),
      }),
    );

    const balls = iconButton({
      icon: ball, label: 'My Balls', kind: 'round', color: 'blue', className: `home-balls${hasNew ? ' has-new' : ''}`, app,
      onTap: () => app.router.go('skins'),
    });

    const gear = iconButton({ icon: icons.gear, label: 'Grown-ups (hold)', kind: 'round', color: 'white', className: 'home-gear' });
    makeHoldButton(gear, () => {
      app.audio.play('click');
      app.router.go('settings');
    });

    // A new deploy arrived while a game was going (see app/selfUpdate.js).
    const update = app.update?.pending
      ? iconButton({
        icon: icons.refresh, caption: 'New version!', label: 'New version! Tap to update', color: 'green', kind: 'chip', className: 'home-update', app,
        onTap: () => app.update.reloadNow(),
      })
      : null;

    this.el = h('div', { class: 'rb-screen ui-screen home' },
      update,
      h('h1', { class: 'home-title', 'aria-label': 'Rolly Bally' }, 'Rolly Bally'),
      buttons,
      h('div', { class: 'home-corner' }, balls, gear),
    );
    root.append(this.el);
  }

  unmount() {}
}
