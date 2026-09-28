// Pathways setup: the Playground chip layout with Pathways' own stars
// (everywhere / medium, no "none") and stuff (bouncy, ramps, dark tunnels,
// trick; all on by default). Dice re-rolls the seed (shown as 4 emoji);
// choices are remembered separately from Playground's.
//
// P0: Go plays an ordinary Playground world built from these choices
// (pathwaysToPlaygroundConfig); paths, dark tunnels and the trick mountain
// come in P1-P3.

import * as icons from '../icons/index.js';
import { h, iconButton, backButton, goButton, setPressed } from '../components.js';
import {
  PLAYGROUND_SIZES, PLAYGROUND_THEMES, PLAYGROUND_BUMPINESS, PATHWAYS_STUFF, PATHWAYS_STARS,
  pathwaysToPlaygroundConfig,
} from '../../app/configs.js';
import { randomEmojiSeed } from '../../core/Rng.js';
import { pathwaysSetupFrom } from '../progress.js';

// Single-choice groups: [key, values, icon set, row color, captions]
const GROUPS = [
  ['size', PLAYGROUND_SIZES, icons.size, 'green', { small: 'Small', medium: 'Medium', large: 'Big' }],
  ['theme', PLAYGROUND_THEMES, icons.theme, 'blue', { grass: 'Grass', snow: 'Snow' }],
  ['bumpiness', PLAYGROUND_BUMPINESS, icons.bumpiness, 'purple', { flat: 'Flat', hilly: 'Hills', mountains: 'Mountains' }],
  ['stars', PATHWAYS_STARS, icons.pathwaysStars, 'pink', { everywhere: 'Everywhere', medium: 'Medium' }],
];
const STUFF_CAPTIONS = { bouncy: 'Bouncy', ramps: 'Ramps', darkTunnels: 'Dark tunnels', trick: 'Trick' };

export class PathwaysSetupScreen {
  mount(root, params, app) {
    const state = pathwaysSetupFrom(app.save.get().ui?.pathways);
    const refresh = [];
    const remember = () => app.progress.setPathwaysSetup(state);

    const groups = GROUPS.map(([key, values, set, color, captions]) => {
      const btns = values.map((v) => {
        const btn = iconButton({
          icon: set[v], caption: captions[v], label: captions[v], color, kind: 'chip', className: 'pg-chip', app,
          onTap: () => {
            state[key] = v;
            sync();
            remember();
          },
        });
        refresh.push(() => setPressed(btn, state[key] === v));
        return btn;
      });
      return h('div', { class: `setup-group setup-group--${color}` }, btns);
    });

    const stuffBtns = PATHWAYS_STUFF.map((s) => {
      const btn = iconButton({
        icon: icons.pathwaysStuff[s], caption: STUFF_CAPTIONS[s], label: STUFF_CAPTIONS[s], color: 'orange', kind: 'chip', className: 'pg-chip', app,
        onTap: () => {
          const on = !state.stuff.includes(s);
          state.stuff = PATHWAYS_STUFF.filter((x) => (x === s ? on : state.stuff.includes(x)));
          sync();
          remember();
        },
      });
      refresh.push(() => setPressed(btn, state.stuff.includes(s)));
      return btn;
    });
    // Size, world, bumpiness, then stuff, then stars.
    groups.splice(3, 0, h('div', { class: 'setup-group setup-group--orange setup-group--stuff' }, stuffBtns));

    const seedEl = h('div', { class: 'pg-seed', 'aria-label': 'World code' });
    const dice = iconButton({
      icon: icons.dice, label: 'New world', kind: 'chip', color: 'white', className: 'pg-dice', app, sound: 'pop',
      onTap: () => {
        state.seed = randomEmojiSeed();
        dice.classList.remove('rolling');
        void dice.offsetWidth; // restart the animation
        dice.classList.add('rolling');
        sync();
        remember();
      },
    });

    const go = goButton(app, () => {
      remember();
      app.router.go('play', { mode: 'playground', config: pathwaysToPlaygroundConfig(state), returnTo: 'pathways-setup' });
    });

    const sync = () => {
      for (const fn of refresh) fn();
      seedEl.textContent = state.seed;
    };

    this.el = h('div', { class: 'rb-screen ui-screen setup playground-setup pathways-setup' },
      backButton(app),
      h('div', { class: 'setup-title', html: icons.pathways }),
      h('div', { class: 'setup-body' },
        h('div', { class: 'setup-main pg-groups' }, groups),
        h('div', { class: 'setup-side' }, h('div', { class: 'pg-seed-box' }, seedEl, dice), go),
      ),
    );
    sync();
    root.append(this.el);
  }

  unmount() {}
}
