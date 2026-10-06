// Main menu (plan Section 6), pause menu, Settings and Quit (plan Sections 3 and 4).
//
// Computer: the spacebar pauses; ↑/↓ move the glow and the spacebar picks.
// iPad: the ⏸ button pauses; tap an option to pick it.
// The same menu shows the "You did it!" screen when a level is finished, and
// the main menu (Mazle: Continue / New game / Pick a level) when the game opens.
//
// Pick a level (plan Section 8) is two screens: the worlds (one button per
// world, showing its first level's number in its look), then that world's
// levels. Levels after the furthest one reached are plain gray locks.
//
// What's new (plan Section 9): when the main menu opens with a newly added
// level, a "New! Level N is ready!" box with OK comes first, and NEW!
// stickers sit on Pick a level, the world and the level until it's played.

import { TOUCH_SETUPS, KEYBOARD_SETUPS } from './settings.js';
import { WORLDS } from './levels.js';

export class Menu {
    // game: { canPause(), pause(), resume(), startOver(), quit(), nextLevel(),
    //         hasSave(), continueGame(), newGame(lockLevels), furthestLevel(), pickLevel(index),
    //         checkNews(), freshLevels(),
    //         toMainMenu(), reloadForUpdate(),
    //         settings, changeSettings(changes) }
    constructor(game) {
        this.game = game;
        this.state = 'closed'; // closed | title | news | erase | worlds | levels | replace | main | settings | quit | finish | update | thanks
        this.quitFrom = 'main'; // the panel Quit → No goes back to
        this.root = document.getElementById('menu');
        this.panels = {
            title: document.getElementById('menu-title'),
            erase: document.getElementById('menu-erase'),
            news: document.getElementById('menu-news'),
            worlds: document.getElementById('menu-worlds'),
            levels: document.getElementById('menu-levels'),
            replace: document.getElementById('menu-replace'),
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
        this.pickWorld = 0; // the world whose levels are showing
        this.pickIndex = 0; // the level Pick a level is asking about
        this.noteTimer = null;

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
            if (!e.repeat) this.moveGlow(-1, e.key === 'ArrowUp');
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
            e.preventDefault();
            if (!e.repeat) this.moveGlow(1, e.key === 'ArrowDown');
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
        // A world's finale with nothing after it yet (Level 20): "More levels coming soon!" underneath
        document.getElementById('finish-note').hidden = !(finaleTitle && !nextLevelName);
        const next = this.panels.finish.querySelector('[data-act=next-level]');
        next.hidden = !nextLevelName;
        if (nextLevelName) next.textContent = nextLabel || `Start ${nextLevelName}`;
        this.finishGlow = nextLevelName ? 'next-level' : 'finish-quit';
        this.show('finish', this.finishGlow);
        this.offerUpdate();
    }

    // Main menu: Continue (only with a saved spot, and then it glows first) /
    // New game / Pick a level. A newly added level is announced first.
    showTitle() {
        this.root.hidden = false;
        const hasSave = this.game.hasSave();
        this.panels.title.querySelector('[data-act=continue]').hidden = !hasSave;
        const pick = this.panels.title.querySelector('[data-act=pick-level]');
        this.sticker(pick, this.game.freshLevels().length > 0);
        const announced = this.game.checkNews();
        if (announced.length) {
            this.sticker(pick, true);
            const first = announced[0] + 1;
            const last = announced[announced.length - 1] + 1;
            document.getElementById('news-title').textContent = first === last
                ? `New! Level ${first} is ready!`
                : `New! Levels ${first}–${last} are ready!`;
            this.show('news', 'news-ok');
            return;
        }
        this.show('title', hasSave ? 'continue' : 'new-game');
        this.offerUpdate();
    }

    // The NEW! sticker on a button
    sticker(item, on) {
        let badge = item.querySelector('.new-badge');
        if (on && !badge) {
            badge = document.createElement('span');
            badge.className = 'new-badge';
            badge.textContent = 'NEW!';
            item.appendChild(badge);
        } else if (!on && badge) {
            badge.remove();
        }
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
        this.root.querySelectorAll('.pick-note').forEach((n) => { n.hidden = true; });
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

    // vertical: ↑/↓ in a grid of buttons (Pick a level) go a whole row up or
    // down; ↓ from the bottom row goes to the buttons below the grid
    moveGlow(delta, vertical = false) {
        const items = this.items();
        if (items.length === 0) return;
        const current = items[this.glowIndex];
        const grid = current?.closest('.pick-grid');
        if (vertical && grid) {
            const cells = items.filter((i) => grid.contains(i));
            const cols = Number(grid.dataset.cols) || 1;
            const at = cells.indexOf(current);
            const to = at + delta * cols;
            if (to >= 0 && to < cells.length) {
                this.glowIndex = items.indexOf(cells[to]);
                this.paintGlow();
                return;
            }
            if (delta > 0) {
                const below = items.indexOf(cells[cells.length - 1]) + 1;
                this.glowIndex = below < items.length ? below : 0;
                this.paintGlow();
                return;
            }
        }
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
            this.startNewGame(true);
        } else if (act === 'erase-no') {
            this.show('title', 'new-game');
        } else if (act === 'news-ok') {
            this.showTitle();
        } else if (act === 'pick-level') {
            this.showWorlds(0);
        } else if (act === 'pick-world') {
            const w = Number(item.dataset.world);
            if (item.classList.contains('locked')) this.note('Reach this world first!');
            else this.showLevels(w);
        } else if (act === 'pick-one') {
            const index = Number(item.dataset.level);
            if (item.classList.contains('locked')) {
                this.note('Reach this level first!');
            } else if (this.game.hasSave()) {
                // The saved spot would be replaced, so ask first (No glows first)
                this.pickIndex = index;
                this.show('replace', 'replace-no');
            } else {
                this.startPicked(index);
            }
        } else if (act === 'replace-yes') {
            this.startPicked(this.pickIndex);
        } else if (act === 'replace-no') {
            this.showLevels(this.pickWorld, this.pickIndex);
        } else if (act === 'to-worlds') {
            this.showWorlds(this.pickWorld);
        } else if (act === 'to-title') {
            this.showTitle();
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

    startNewGame(lockLevels = false) {
        this.game.newGame(lockLevels);
        this.close();
    }

    // Pick a level, step 1: one button per world that has a built level. A
    // world whose first level hasn't been reached is a plain gray lock.
    // The glow starts on glowWorld if it's open, else on the first open one.
    showWorlds(glowWorld = 0) {
        const furthest = this.game.furthestLevel();
        const grid = document.getElementById('world-grid');
        grid.innerHTML = '';
        grid.dataset.cols = String(Math.min(WORLDS.length, 5));
        grid.style.setProperty('--cols', grid.dataset.cols);
        WORLDS.forEach((world, w) => {
            const open = world.first <= furthest;
            const button = this.pickButton('pick-world', open ? String(world.first + 1) : '', open ? world.look : null, { world: w });
            if (open) this.sticker(button, this.game.freshLevels().some((n) => n >= world.first && n <= world.last));
            grid.appendChild(button);
        });
        this.show('worlds', null);
        const want = WORLDS[glowWorld]?.first <= furthest ? glowWorld : 0;
        this.glowOn(grid.children[want]);
    }

    // Pick a level, step 2: the world's built levels, then Worlds / Main menu
    showLevels(w, glowLevel = null) {
        const world = WORLDS[w];
        const furthest = this.game.furthestLevel();
        this.pickWorld = w;
        const grid = document.getElementById('level-grid');
        grid.innerHTML = '';
        const count = world.last - world.first + 1;
        grid.dataset.cols = String(Math.min(count, 5));
        grid.style.setProperty('--cols', grid.dataset.cols);
        for (let index = world.first; index <= world.last; index++) {
            const open = index <= furthest;
            const button = this.pickButton('pick-one', open ? String(index + 1) : '', open ? world.look : null, { level: index });
            if (open) this.sticker(button, this.game.freshLevels().includes(index));
            grid.appendChild(button);
        }
        this.show('levels', null);
        const glow = glowLevel !== null && glowLevel <= furthest ? glowLevel : world.first;
        this.glowOn(grid.children[glow - world.first]);
    }

    // A world or level button: its number in the world's look, or (locked)
    // a plain gray lock that gives nothing away
    pickButton(act, label, look, data) {
        const item = document.createElement('div');
        item.className = 'item pick';
        item.dataset.act = act;
        for (const [k, v] of Object.entries(data)) item.dataset[k] = String(v);
        if (look) {
            item.classList.add(`look-${look}`);
            item.textContent = label;
        } else {
            item.classList.add('locked');
            item.textContent = '🔒';
            item.setAttribute('aria-label', 'Locked');
        }
        return item;
    }

    glowOn(item) {
        const i = this.items().indexOf(item);
        if (i >= 0) {
            this.glowIndex = i;
            this.paintGlow();
        }
    }

    // "Reach this level first!" under the buttons for a moment
    note(text) {
        const el = this.panels[this.state]?.querySelector('.pick-note');
        if (!el) return;
        el.textContent = text;
        el.hidden = false;
        clearTimeout(this.noteTimer);
        this.noteTimer = setTimeout(() => { el.hidden = true; }, 2500);
    }

    startPicked(index) {
        this.game.pickLevel(index);
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
