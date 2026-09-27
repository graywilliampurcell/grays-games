// Race setup: difficulty 1–5 (pictures of each track style, best cup badge),
// number of races 1/3/5/10 (dots), and a big Go!. Choices are remembered.

import * as icons from '../icons/index.js';
import { h, iconButton, backButton, goButton, pips, setPressed } from '../components.js';
import { RACE_COUNTS, normalizeRaceConfig } from '../../app/configs.js';
import { randomEmojiSeed } from '../../core/Rng.js';
import { raceSetupFrom } from '../progress.js';

const DIFF_COLORS = ['green', 'blue', 'purple', 'orange', 'red'];
const DIFF_NAMES = ['Rolling Hills', 'Bumpy Road', 'Sky Road', 'Hammer Time', 'Going Big'];

export class RaceSetupScreen {
  mount(root, params, app) {
    const data = app.save.get();
    const state = raceSetupFrom(data.ui?.race);
    const update = () => {
      diffBtns.forEach((b, i) => setPressed(b, state.difficulty === i + 1));
      countBtns.forEach((b, i) => setPressed(b, state.races === RACE_COUNTS[i]));
    };

    const diffBtns = [1, 2, 3, 4, 5].map((d) => {
      const best = data.bestCups?.[d];
      const btn = iconButton({
        icon: icons.difficulty[d],
        label: `Level ${d}: ${DIFF_NAMES[d - 1]}`,
        color: DIFF_COLORS[d - 1],
        className: 'rs-diff',
        app,
        onTap: () => {
          state.difficulty = d;
          update();
        },
      });
      btn.append(pips(d, 'var(--rb-yellow)'));
      btn.append(h('span', { class: `rs-cup${best ? '' : ' rs-cup--empty'}`, html: icons.cup(best || null) }));
      return btn;
    });

    const countBtns = RACE_COUNTS.map((n) => {
      const btn = iconButton({
        icon: pips(n),
        caption: String(n),
        label: `${n} ${n === 1 ? 'race' : 'races'}`,
        color: 'yellow',
        kind: 'chip',
        className: 'rs-count',
        app,
        onTap: () => {
          state.races = n;
          update();
        },
      });
      return btn;
    });

    const go = goButton(app, () => {
      app.progress.setRaceSetup(state);
      const config = normalizeRaceConfig({ ...state, seed: randomEmojiSeed() });
      app.router.go('play', { mode: 'race', config, returnTo: 'race-setup' });
    });

    this.el = h('div', { class: 'rb-screen ui-screen setup race-setup' },
      backButton(app),
      h('div', { class: 'setup-title', html: icons.flag }),
      h('div', { class: 'setup-body setup-body--stack' },
        h('div', { class: 'rb-row rs-diffs' }, diffBtns),
        h('div', { class: 'rb-row rs-bottom' },
          h('div', { class: 'setup-group setup-group--yellow rs-counts' }, countBtns),
          go,
        ),
      ),
    );
    update();
    root.append(this.el);
  }

  unmount() {}
}
