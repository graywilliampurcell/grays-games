// Grown-up menu (reached by holding the Home gear for 1 s): sound on/off,
// reset progress (with a confirm that needs a 1.5 s hold), and the version.
// Text is fine here.

import * as icons from '../icons/index.js';
import { h, iconButton, backButton, makeHoldButton } from '../components.js';

export class SettingsScreen {
  mount(root, params, app) {
    const { save, progress } = app;

    const sound = iconButton({
      icon: '', caption: '', label: 'Sound', kind: 'big', className: 'st-sound', app,
      onTap: () => {
        progress.setSound(!save.get().settings.sound);
        render();
        app.audio.play('click');
      },
    });

    const stats = h('p', { class: 'st-stats' });
    const reset = iconButton({
      icon: icons.trash, caption: 'Reset progress', label: 'Reset progress', kind: 'big', color: 'red', className: 'st-reset', app,
      onTap: () => confirm.classList.remove('hidden'),
    });

    // Reset needs a long press too, so two quick taps can't wipe progress.
    const doReset = iconButton({ icon: icons.check, caption: 'Hold to reset', label: 'Yes, reset (press and hold)', kind: 'chip', color: 'red', app });
    makeHoldButton(doReset, () => {
      app.audio.play('click');
      progress.resetProgress();
      confirm.classList.add('hidden');
      render();
    }, 1500);

    const confirm = h('div', { class: 'st-confirm hidden', role: 'dialog' },
      h('div', { class: 'st-confirm-card' },
        h('p', {}, 'Reset all progress? Unlocked balls, best cups and stars will be cleared.'),
        h('div', { class: 'rb-row' },
          iconButton({
            icon: icons.back, caption: 'Keep', label: 'Keep progress', kind: 'chip', color: 'green', app,
            onTap: () => confirm.classList.add('hidden'),
          }),
          doReset,
        ),
      ),
    );

    const render = () => {
      const d = save.get();
      const on = d.settings.sound;
      sound.className = `rb-btn rb-btn--big st-sound rb-btn--${on ? 'blue' : 'white'}`;
      sound.innerHTML = `${on ? icons.soundOn : icons.soundOff}<span class="rb-caption">Sound ${on ? 'on' : 'off'}</span>`;
      sound.setAttribute('aria-pressed', on ? 'true' : 'false');
      const cups = Object.keys(d.bestCups).length;
      stats.textContent = `Balls unlocked: ${d.skins.unlocked.length} · Race series finished: ${d.seriesCompleted} · `
        + `Stars collected: ${d.stars.total} · Levels with a cup: ${cups}`;
    };

    this.el = h('div', { class: 'rb-screen ui-screen settings' },
      backButton(app),
      h('div', { class: 'setup-title', html: icons.gear }),
      h('div', { class: 'rb-row' }, sound, reset),
      stats,
      h('p', { class: 'st-version' }, `Rolly Bally v${app.version} · build ${app.build}`),
      h('p', { class: 'st-note' }, 'Tip: add this page to the Home Screen (Share → Add to Home Screen) for full-screen play.'),
      confirm,
    );
    render();
    root.append(this.el);
  }

  unmount() {}
}
