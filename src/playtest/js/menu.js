// Main menu (plan Section 6), pause menu, Settings and Quit (plan Sections 3 and 4).
//
// Computer: the spacebar pauses; ↑/↓ move the glow and the spacebar picks.
// iPad: the ⏸ button pauses; tap an option to pick it.
// The same menu shows the "You did it!" screen when a level is finished, and
// the main menu (Mazle: Continue / New game) when the game opens.

import { TOUCH_SETUPS, KEYBOARD_SETUPS } from './settings.js';

export class Menu {
    // game: { canPause(), pause(), resume(), startOver(), quit(), nextLevel(),
    //         hasSave(), continueGame(), newGame(), toMainMenu(), reloadForUpdate(),
    //         settings, changeSettings(changes) }
    constructor(game) {
        this.game = game;
        this.state = 'closed'; // closed | title | erase | main | settings | quit | finish | update | thanks
        this.quitFrom = 'main'; // the panel Quit → No goes back to
        this.root = document.getElementById('menu');
        this.panels = {
            title: document.getElementById('menu-title'),
            erase: document.getElementById('menu-erase'),
            update: document.getElementById('menu-update'),
            main: document.getElementById('menu-main'),
            settings: document.getElementById('menu-settings'),
            quit: document.getElementById('menu-quit'),
            finish: document.getElementById('menu-finish'),
        };
        this.glowIndex = 0;
        this.updateWaiting = false; // a newer build is live and Gray hasn't reloaded yet
        this.updateLater = false; // Gray picked Later: from then on ask only on the main menu or an end screen
        this.updateFrom = null; // where Later goes back to: closed | title | finish
        this.finishGlow = 'next-level';

        document.getElementById('pause-btn').addEventListener('click', () => this.open());
        this.root.addEventListener('click', (e) => {
            const item = e.target.closest('.item');
            if (item && !item.hidden) this.pick(item);
        });
        for (const id of ['see-through', 'size']) {
            const slider = document.getElementById(id);
            slider.addEventListener('input', () => {
                this.game.changeSettings({ [id === 'size' ? 'size' : 'seeThrough']: Number(slider.value) });
                this.fillSettings();
            });
        }
        document.addEventListener('keydown', (e) => this.onKey(e));
    }

    isTouch() {
        return document.body.classList.contains('touch');
    }

    onKey(e) {
        if (this.state === 'thanks') {
            e.preventDefault();
            return;
        }
        if (this.state === 'closed') {
            // The spacebar pauses. No other key pauses.
            if (e.key === ' ' && !e.repeat && this.game.canPause()) {
                e.preventDefault();
                this.open();
            }
            return;
        }
        // A held arrow key doesn't keep moving the glow (Gray is often still
        // holding ↑ when he walks into the door)
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            e.preventDefault();
            if (!e.repeat) this.moveGlow(-1);
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
            e.preventDefault();
            if (!e.repeat) this.moveGlow(1);
        } else if (e.key === ' ') {
            e.preventDefault();
            if (!e.repeat) {
                const item = this.items()[this.glowIndex];
                if (item) this.pick(item);
            }
        }
    }

    open() {
        if (this.state !== 'closed' || !this.game.canPause()) return;
        this.game.pause();
        this.root.hidden = false;
        this.show('main', 'resume');
    }

    // Level finished: "You did it!" with Start Level <next> / Quit, or, after
    // the last level, "More levels coming soon!" with just Quit
    // finaleTitle: the last level of a world shows its own title (Level 10:
    // "You beat Cotton Candy World!") with just Quit
    // nextLabel: the button's own words (Level 10: "Start Space World")
    showFinish(nextLevelName, finaleTitle, nextLabel) {
        this.root.hidden = false;
        document.getElementById('finish-title').textContent = finaleTitle || (nextLevelName ? 'You did it!' : 'More levels coming soon!');
        const next = this.panels.finish.querySelector('[data-act=next-level]');
        next.hidden = !nextLevelName;
        if (nextLevelName) next.textContent = nextLabel || `Start ${nextLevelName}`;
        this.finishGlow = nextLevelName ? 'next-level' : 'finish-quit';
        this.show('finish', this.finishGlow);
        this.offerUpdate();
    }

    // Main menu: Continue (only with a saved spot, and then it glows first) / New game
    showTitle() {
        this.root.hidden = false;
        const hasSave = this.game.hasSave();
        this.panels.title.querySelector('[data-act=continue]').hidden = !hasSave;
        this.show('title', hasSave ? 'continue' : 'new-game');
        this.offerUpdate();
    }

    // A newer build is live (updates.js). Ask now if Gray is playing, on the
    // main menu or on an end screen; otherwise ask at the next of those.
    updateFound() {
        this.updateWaiting = true;
        this.offerUpdate();
    }

    // "A new version of Mazle is ready!" with Reload now (glowing) / Later
    offerUpdate() {
        if (!this.updateWaiting || !['closed', 'title', 'finish'].includes(this.state)) return;
        if (this.state === 'closed') {
            if (this.updateLater) return;
            if (!this.game.canPause()) return;
            this.game.pause(); // freezes the game like the pause menu
        }
        this.updateFrom = this.state;
        this.root.hidden = false;
        this.show('update', 'update-reload');
    }

    // Take the menu away without resuming (a new level is starting)
    dismiss() {
        this.state = 'closed';
        this.root.hidden = true;
    }

    close() {
        this.state = 'closed';
        this.root.hidden = true;
        this.game.resume();
    }

    // Show one panel with the glow on the item whose data-act is glowAct
    show(panel, glowAct) {
        this.state = panel;
        for (const [name, el] of Object.entries(this.panels)) el.hidden = name !== panel;
        if (panel === 'settings') this.fillSettings();
        const items = this.items();
        this.glowIndex = Math.max(0, items.findIndex((i) => i.dataset.act === glowAct));
        this.paintGlow();
    }

    // The options in the open panel, top to bottom (only the ones showing)
    items() {
        const panel = this.panels[this.state];
        if (!panel) return [];
        return [...panel.querySelectorAll('.item')].filter((i) => !i.hidden && !i.closest('[hidden]'));
    }

    moveGlow(delta) {
        const items = this.items();
        if (items.length === 0) return;
        this.glowIndex = (this.glowIndex + delta + items.length) % items.length;
        this.paintGlow();
    }

    paintGlow() {
        const items = this.items();
        this.root.querySelectorAll('.item.glow').forEach((i) => i.classList.remove('glow'));
        items[this.glowIndex]?.classList.add('glow');
    }

    pick(item) {
        const act = item.dataset.act;
        if (act === 'resume') {
            this.close();
        } else if (act === 'start-over') {
            this.game.startOver();
            this.close();
        } else if (act === 'continue') {
            this.game.continueGame();
            this.close();
        } else if (act === 'new-game') {
            // A saved spot would be lost, so ask first (No glows first)
            if (this.game.hasSave()) this.show('erase', 'erase-no');
            else this.startNewGame();
        } else if (act === 'erase-yes') {
            this.startNewGame();
        } else if (act === 'erase-no') {
            this.show('title', 'new-game');
        } else if (act === 'main-menu') {
            // Saves the spot like Quit does, so no "Are you sure?"
            this.game.toMainMenu();
            this.showTitle();
        } else if (act === 'update-reload') {
            this.game.reloadForUpdate(this.updateFrom);
        } else if (act === 'update-later') {
            // Keep going; asked again at the next main menu or end screen
            this.updateLater = true;
            if (this.updateFrom === 'closed') this.close();
            else if (this.updateFrom === 'title') this.show('title', this.game.hasSave() ? 'continue' : 'new-game');
            else this.show('finish', this.finishGlow);
        } else if (act === 'settings') {
            this.show('settings', 'setup');
        } else if (act === 'quit' || act === 'finish-quit') {
            this.quitFrom = act === 'quit' ? 'main' : 'finish';
            this.show('quit', 'no'); // No glows first, so an accidental press doesn't quit
        } else if (act === 'no') {
            this.show(this.quitFrom, this.quitFrom === 'main' ? 'quit' : 'finish-quit');
        } else if (act === 'next-level') {
            this.dismiss();
            this.game.nextLevel();
        } else if (act === 'yes') {
            this.state = 'thanks';
            this.root.hidden = true;
            this.game.quit();
        } else if (act === 'back') {
            this.show('main', 'settings');
        } else if (act === 'toggle') {
            const key = item.dataset.setting;
            this.game.changeSettings({ [key]: !this.game.settings[key] });
            this.fillSettings();
        } else if (act === 'setup') {
            const key = this.isTouch() ? 'touchSetup' : 'keyboardSetup';
            this.game.changeSettings({ [key]: item.dataset.setup });
            this.fillSettings();
            this.glowIndex = this.items().indexOf(item);
            this.paintGlow();
        }
    }

    startNewGame() {
        this.game.newGame();
        this.close();
    }

    // Settings: the control setups for this device, (iPad only) the sliders, and the sound switches
    fillSettings() {
        const touch = this.isTouch();
        const setups = touch ? TOUCH_SETUPS : KEYBOARD_SETUPS;
        const current = this.game.settings[touch ? 'touchSetup' : 'keyboardSetup'];
        const list = document.getElementById('setup-list');
        if (list.dataset.device !== String(touch)) {
            list.innerHTML = '';
            for (const s of setups) {
                const item = document.createElement('div');
                item.className = 'item choice';
                item.dataset.act = 'setup';
                item.dataset.setup = s.id;
                item.textContent = s.name;
                list.appendChild(item);
            }
            list.dataset.device = String(touch);
        }
        for (const item of list.querySelectorAll('.choice')) {
            item.classList.toggle('selected', item.dataset.setup === current);
        }
        for (const item of this.panels.settings.querySelectorAll('.toggle')) {
            item.classList.toggle('on', !!this.game.settings[item.dataset.setting]);
        }
        document.getElementById('touch-sliders').hidden = !touch;
        document.getElementById('see-through').value = this.game.settings.seeThrough;
        document.getElementById('size').value = this.game.settings.size;
        document.getElementById('see-through-value').textContent = this.game.settings.seeThrough;
        document.getElementById('size-value').textContent = this.game.settings.size;
    }
}
