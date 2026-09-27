import { describe, it, expect, beforeEach } from 'vitest';
import { Save, SAVE_KEY, defaultSave, deepMerge } from '../src/core/Save.js';
import { STARTER_SKIN_IDS } from '../src/ball/skinData.js';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

class ThrowingStorage {
  getItem() { throw new Error('denied'); }
  setItem() { throw new Error('denied'); }
}

describe('Save', () => {
  let storage;
  beforeEach(() => { storage = new MemoryStorage(); });

  it('starts with defaults', () => {
    const s = new Save(storage).get();
    expect(s.settings.sound).toBe(true);
    expect(s.skins.unlocked).toEqual(STARTER_SKIN_IDS);
    expect(s.skins.unlocked.length).toBe(6);
    expect(s.skins.selected).toBe(STARTER_SKIN_IDS[0]);
    expect(s.bestCups).toEqual({});
    expect(s.stars.total).toBe(0);
    expect(s.seriesCompleted).toBe(0);
  });

  it('merges stored data over defaults (new fields appear)', () => {
    storage.setItem(SAVE_KEY, JSON.stringify({ settings: { sound: false }, stars: { total: 12 } }));
    const s = new Save(storage).get();
    expect(s.settings.sound).toBe(false);
    expect(s.stars.total).toBe(12);
    expect(s.skins.unlocked.length).toBe(6);
  });

  it('persists patch and function updates', () => {
    const save = new Save(storage);
    save.update({ bestCups: { 1: 'gold' } });
    save.update((d) => { d.stars.total += 5; d.skins.unlocked.push('checker'); });
    const reloaded = new Save(storage).get();
    expect(reloaded.bestCups).toEqual({ 1: 'gold' });
    expect(reloaded.stars.total).toBe(5);
    expect(reloaded.skins.unlocked).toContain('checker');
  });

  it('reset restores defaults', () => {
    const save = new Save(storage);
    save.update({ seriesCompleted: 3 });
    save.reset();
    expect(new Save(storage).get()).toEqual(defaultSave());
  });

  it('survives corrupt JSON and throwing storage', () => {
    storage.setItem(SAVE_KEY, '{not json');
    expect(new Save(storage).get()).toEqual(defaultSave());
    const save = new Save(new ThrowingStorage());
    expect(() => save.update({ seriesCompleted: 1 })).not.toThrow();
    expect(save.get().seriesCompleted).toBe(1);
    expect(new Save(null).get()).toEqual(defaultSave());
  });

  it('notifies subscribers', () => {
    const save = new Save(storage);
    let seen = null;
    const off = save.subscribe((d) => { seen = d.stars.total; });
    save.update({ stars: { total: 7 } });
    expect(seen).toBe(7);
    off();
  });

  it('deepMerge replaces arrays', () => {
    expect(deepMerge({ a: [1, 2], b: { c: 1 } }, { a: [3], b: { d: 2 } })).toEqual({ a: [3], b: { c: 1, d: 2 } });
  });
});
