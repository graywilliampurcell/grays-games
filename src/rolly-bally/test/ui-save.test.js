// Save migration/defaults as seen through the UI progress module.
import { describe, it, expect } from 'vitest';
import { Save, SAVE_KEY, defaultSave } from '../src/core/Save.js';
import { Events } from '../src/core/Events.js';
import { STARTER_SKIN_IDS, UNLOCK_ORDER } from '../src/ball/skinData.js';
import { migrateSave, Progress, raceSetupFrom, playgroundSetupFrom } from '../src/ui/progress.js';
import { isEmojiSeed } from '../src/core/Rng.js';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
}

describe('migrateSave', () => {
  it('fills defaults from nothing', () => {
    for (const input of [undefined, null, {}, 'junk', 42]) {
      const d = migrateSave(input);
      expect(d.settings.sound).toBe(true);
      expect(d.skins.unlocked).toEqual(STARTER_SKIN_IDS);
      expect(d.skins.selected).toBe(STARTER_SKIN_IDS[0]);
      expect(d.bestCups).toEqual({});
      expect(d.stars.total).toBe(0);
      expect(d.seriesCompleted).toBe(0);
      expect(d.ui.race).toEqual({ difficulty: 1, races: 3 });
      expect(d.ui.playground.size).toBe('medium');
      expect(isEmojiSeed(d.ui.playground.seed)).toBe(true);
      expect(d.ui.newSkins).toEqual([]);
    }
  });

  it('repairs bad values', () => {
    const d = migrateSave({
      settings: { sound: 'yes' },
      skins: { unlocked: ['red', 'bogus', 'red'], selected: 'rainbow' },
      bestCups: { 1: 'gold', 9: 'gold', 2: 'platinum', x: 'silver' },
      stars: { total: -5 },
      seriesCompleted: 'NaN',
      ui: { race: { difficulty: 99, races: 7 }, newSkins: ['checker'] },
    });
    expect(d.settings.sound).toBe(true);
    expect(d.skins.unlocked).toEqual(STARTER_SKIN_IDS);
    expect(d.skins.selected).toBe('red'); // rainbow wasn't unlocked
    expect(d.bestCups).toEqual({ 1: 'gold' });
    expect(d.stars.total).toBe(0);
    expect(d.seriesCompleted).toBe(0);
    expect(d.ui.race).toEqual({ difficulty: 5, races: 5 });
    expect(d.ui.newSkins).toEqual([]); // checker is locked
  });

  it('grants unlocks already earned by counters (older saves)', () => {
    const d = migrateSave({ seriesCompleted: 2, stars: { total: 120 } });
    expect(d.skins.unlocked).toEqual([...STARTER_SKIN_IDS, ...UNLOCK_ORDER.slice(0, 4)]);
  });

  it('keeps previously unlocked skins and sound off', () => {
    const d = migrateSave({ settings: { sound: false }, skins: { unlocked: ['red', 'gold'], selected: 'gold' } });
    expect(d.settings.sound).toBe(false);
    expect(d.skins.unlocked).toContain('gold');
    expect(d.skins.selected).toBe('gold');
  });

  it('remembered setups normalize', () => {
    expect(raceSetupFrom({ difficulty: '3', races: '10', seed: 'x' })).toEqual({ difficulty: 3, races: 10 });
    const pg = playgroundSetupFrom({ size: 'large', theme: 'snow', stuff: ['tunnels', 'ramps', 'nope'], seed: 'abc' });
    expect(pg).toMatchObject({ size: 'large', theme: 'snow', stuff: ['ramps', 'tunnels'], seed: 'abc' });
  });
});

describe('Progress boot migration', () => {
  it('migrates what is in storage and persists it', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ seriesCompleted: 1, skins: { selected: 'nope' } }));
    const save = new Save(storage);
    new Progress({ save, events: new Events() });
    const stored = JSON.parse(storage.getItem(SAVE_KEY));
    expect(stored.skins.unlocked).toContain(UNLOCK_ORDER[0]);
    expect(stored.skins.selected).toBe('red');
    expect(stored.ui.race).toEqual({ difficulty: 1, races: 3 });
    // A fresh Save reading it back still matches core defaults' shape.
    const again = new Save(storage).get();
    expect(Object.keys(defaultSave()).every((k) => k in again)).toBe(true);
  });

  it('remembers setup choices across reloads', () => {
    const storage = new MemoryStorage();
    const p = new Progress({ save: new Save(storage), events: new Events() });
    p.setRaceSetup({ difficulty: 2, races: 1 });
    p.setPlaygroundSetup({ size: 'small', theme: 'snow', bumpiness: 'flat', stuff: [], stars: 'lots', seed: '🍎🍎🍎🍎' });
    const d = new Save(storage).get();
    expect(d.ui.race).toEqual({ difficulty: 2, races: 1 });
    expect(d.ui.playground).toEqual({ size: 'small', theme: 'snow', bumpiness: 'flat', stuff: [], stars: 'lots', seed: '🍎🍎🍎🍎' });
  });
});
