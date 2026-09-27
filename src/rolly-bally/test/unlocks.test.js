import { describe, it, expect, beforeEach } from 'vitest';
import { Save, defaultSave } from '../src/core/Save.js';
import { Events } from '../src/core/Events.js';
import { STARTER_SKIN_IDS, UNLOCK_ORDER, SKINS } from '../src/ball/skinData.js';
import {
  Progress, applySeriesComplete, applyStars, earnedUnlocks, unlockedSkinsFor,
  nextUnlockHint, isBetterCup, STARS_PER_SKIN,
} from '../src/ui/progress.js';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
}

describe('unlock math', () => {
  it('starts with only the starters', () => {
    expect(unlockedSkinsFor(defaultSave())).toEqual(STARTER_SKIN_IDS);
    expect(earnedUnlocks(defaultSave())).toBe(0);
  });

  it('one skin per series, in UNLOCK_ORDER', () => {
    let data = defaultSave();
    const r1 = applySeriesComplete(data, { difficulty: 2, cup: 'silver' });
    expect(r1.unlocked).toEqual([UNLOCK_ORDER[0]]);
    expect(r1.data.seriesCompleted).toBe(1);
    expect(r1.data.bestCups[2]).toBe('silver');
    const r2 = applySeriesComplete(r1.data, { difficulty: 2, cup: 'bronze' });
    expect(r2.unlocked).toEqual([UNLOCK_ORDER[1]]);
    expect(r2.data.bestCups[2]).toBe('silver'); // keeps the best
    const r3 = applySeriesComplete(r2.data, { difficulty: 2, cup: 'gold' });
    expect(r3.data.bestCups[2]).toBe('gold');
    expect(data.seriesCompleted).toBe(0); // pure
  });

  it('one skin per 50 stars', () => {
    let data = defaultSave();
    const unlocked = [];
    for (let i = 0; i < STARS_PER_SKIN * 2; i++) {
      const r = applyStars(data, 1);
      data = r.data;
      unlocked.push(...r.unlocked);
      if (i === STARS_PER_SKIN - 2) expect(unlocked).toEqual([]);
    }
    expect(data.stars.total).toBe(100);
    expect(unlocked).toEqual(UNLOCK_ORDER.slice(0, 2));
  });

  it('series and stars share one order and stop at the end', () => {
    let data = { ...defaultSave(), seriesCompleted: 3, stars: { total: 60 } };
    expect(unlockedSkinsFor(data)).toHaveLength(STARTER_SKIN_IDS.length + 4);
    data = { ...defaultSave(), seriesCompleted: 999 };
    expect(unlockedSkinsFor(data)).toEqual(SKINS.map((s) => s.id));
    const r = applySeriesComplete({ ...data, skins: { unlocked: unlockedSkinsFor(data), selected: 'red' } }, { difficulty: 1, cup: 'gold' });
    expect(r.unlocked).toEqual([]);
    expect(nextUnlockHint(r.data)).toBeNull();
  });

  it('records new skins for badges', () => {
    const r = applySeriesComplete(defaultSave(), { difficulty: 1, cup: 'gold' });
    expect(r.data.ui.newSkins).toEqual([UNLOCK_ORDER[0]]);
  });

  it('hint points at the next locked skin with star progress', () => {
    const h = nextUnlockHint({ ...defaultSave(), stars: { total: 73 } });
    expect(h).toEqual({ skinId: UNLOCK_ORDER[0], starsHave: 23, starsNeed: 50 });
  });

  it('cup ranking', () => {
    expect(isBetterCup('gold', 'silver')).toBe(true);
    expect(isBetterCup('ribbon', undefined)).toBe(true);
    expect(isBetterCup('bronze', 'silver')).toBe(false);
  });
});

describe('Progress (event wiring)', () => {
  let save, events, progress, seen;
  beforeEach(() => {
    save = new Save(new MemoryStorage());
    events = new Events();
    progress = new Progress({ save, events });
    seen = [];
    events.on('skinUnlocked', (p) => seen.push(p.skinId));
  });

  it('seriesComplete writes save and emits skinUnlocked', () => {
    events.emit('seriesComplete', { difficulty: 3, races: 3, medals: ['gold', 'silver', 'gold'], cup: 'gold' });
    expect(save.get().seriesCompleted).toBe(1);
    expect(save.get().bestCups[3]).toBe('gold');
    expect(save.get().skins.unlocked).toContain(UNLOCK_ORDER[0]);
    expect(seen).toEqual([UNLOCK_ORDER[0]]);
  });

  it('starCollected counts toward unlocks', () => {
    for (let i = 0; i < 50; i++) events.emit('starCollected', { sessionStars: i + 1 });
    expect(save.get().stars.total).toBe(50);
    expect(seen).toEqual([UNLOCK_ORDER[0]]);
  });

  it('selectSkin only accepts unlocked skins', () => {
    expect(progress.selectSkin(UNLOCK_ORDER[0])).toBe(false);
    expect(progress.selectSkin('blue')).toBe(true);
    expect(save.get().skins.selected).toBe('blue');
  });

  it('resetProgress keeps sound + setups, wipes progress', () => {
    progress.setSound(false);
    progress.setRaceSetup({ difficulty: 4, races: 5 });
    events.emit('seriesComplete', { difficulty: 1, cup: 'gold' });
    progress.selectSkin(UNLOCK_ORDER[0]);
    progress.resetProgress();
    const d = save.get();
    expect(d.seriesCompleted).toBe(0);
    expect(d.bestCups).toEqual({});
    expect(d.skins.unlocked).toEqual(STARTER_SKIN_IDS);
    expect(d.skins.selected).toBe(STARTER_SKIN_IDS[0]);
    expect(d.settings.sound).toBe(false);
    expect(d.ui.race).toEqual({ difficulty: 4, races: 5 });
  });

  it('dispose stops listening', () => {
    progress.dispose();
    events.emit('seriesComplete', { difficulty: 1, cup: 'gold' });
    expect(save.get().seriesCompleted).toBe(0);
  });
});
