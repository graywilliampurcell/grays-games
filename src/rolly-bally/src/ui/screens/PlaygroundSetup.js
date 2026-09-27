// Playground setup: picture chips for size, world, bumpiness, stuff
// (multi-select), stars; a dice that re-rolls the seed (shown as 4 emoji);
// and Go!. Every combination is valid. Choices (and the seed) are remembered,
// and the last few worlds played show as small emoji chips to go back to.

import * as icons from '../icons/index.js';
import { h, iconButton, backButton, goButton, setPressed } from '../components.js';
import {
  PLAYGROUND_SIZES, PLAYGROUND_THEMES, PLAYGROUND_BUMPINESS, PLAYGROUND_STUFF, PLAYGROUND_STARS,
  normalizePlaygroundConfig,
} from '../../app/configs.js';
import { randomEmojiSeed } from '../../core/Rng.js';
import { playgroundSetupFrom } from '../progress.js';

// Single-choice groups: [key, values, icon set, row color, captions]
const GROUPS = [
  ['size', PLAYGROUND_SIZES, icons.size, 'green', { small: 'Small', medium: 'Medium', large: 'Big' }],
  ['theme', PLAYGROUND_THEMES, icons.theme, 'blue', { grass: 'Grass', snow: 'Snow' }],
  ['bumpiness', PLAYGROUND_BUMPINESS, icons.bumpiness, 'purple', { flat: 'Flat', hilly: 'Hills', mountains: 'Mountains' }],
  ['stars', PLAYGROUND_STARS, icons.stars, 'pink', { none: 'No stars', some: 'Some', lots: 'Lots' }],
];
const STUFF_CAPTIONS = { ramps: 'Ramps', jumps: 'Jumps', bouncePads: 'Bouncy', tunnels: 'Tunnels', bumpers: 'Spinners' };

export class PlaygroundSetupScreen {
  mount(root, params, app) {
    const state = playgroundSetupFrom(app.save.get().ui?.playground);
    const refresh = [];
    const remember = () => app.progress.setPlaygroundSetup(state);

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

    const stuffBtns = PLAYGROUND_STUFF.map((s) => {
      const btn = iconButton({
        icon: icons.stuff[s], caption: STUFF_CAPTIONS[s], label: STUFF_CAPTIONS[s], color: 'orange', kind: 'chip', className: 'pg-chip', app,
        onTap: () => {
          const on = !state.stuff.includes(s);
          state.stuff = PLAYGROUND_STUFF.filter((x) => (x === s ? on : state.stuff.includes(x)));
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

    // Recent worlds (newest first): tap one to bring back its seed + settings.
    const recent = (app.save.get().ui?.recentWorlds || []).map((w) => {
      const btn = iconButton({
        caption: w.seed, label: 'Earlier world', kind: 'chip', color: 'white', className: 'pg-recent-chip', app, sound: 'pop',
        onTap: () => {
          Object.assign(state, normalizePlaygroundConfig(w));
          sync();
          remember();
        },
      });
      refresh.push(() => setPressed(btn, state.seed === w.seed));
      return btn;
    });
    const recentEl = recent.length ? h('div', { class: 'pg-recent', 'aria-label': 'Earlier worlds' }, recent) : null;

    const go = goButton(app, () => {
      remember();
      app.progress.rememberWorld(state);
      app.router.go('play', { mode: 'playground', config: normalizePlaygroundConfig(state), returnTo: 'playground-setup' });
    });

    const sync = () => {
      for (const fn of refresh) fn();
      seedEl.textContent = state.seed;
    };

    this.el = h('div', { class: 'rb-screen ui-screen setup playground-setup' },
      backButton(app),
      h('div', { class: 'setup-title', html: icons.hills }),
      h('div', { class: 'setup-body' },
        h('div', { class: 'setup-main pg-groups' }, groups),
        h('div', { class: 'setup-side' }, h('div', { class: 'pg-seed-box' }, seedEl, dice, recentEl), go),
      ),
    );
    sync();
    root.append(this.el);
  }

  unmount() {}
}
