// Pathways P0: setup config, how it maps onto a Playground world, and that
// the setup is remembered in the save apart from Playground's.
import { describe, it, expect } from 'vitest';
import {
  PATHWAYS_STUFF, PATHWAYS_STARS, normalizePathwaysConfig, pathwaysToPlaygroundConfig,
} from '../src/app/configs.js';
import { Save } from '../src/core/Save.js';
import { Events } from '../src/core/Events.js';
import { migrateSave, resetProgressData, Progress, pathwaysSetupFrom } from '../src/ui/progress.js';
import { isEmojiSeed } from '../src/core/Rng.js';
import * as icons from '../src/ui/icons/index.js';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
}

describe('pathways config', () => {
  it('defaults: all stuff on, stars everywhere, a fresh emoji seed', () => {
    const c = normalizePathwaysConfig();
    expect(c.stuff).toEqual(['bouncy', 'ramps', 'darkTunnels', 'trick']);
    expect(c.stars).toBe('everywhere');
    expect(c.size).toBe('medium');
    expect(c.theme).toBe('grass');
    expect(isEmojiSeed(c.seed)).toBe(true);
  });

  it('has no "none" stars option', () => {
    expect(PATHWAYS_STARS).toEqual(['everywhere', 'medium']);
    expect(normalizePathwaysConfig({ stars: 'none' }).stars).toBe('everywhere');
  });

  it('cleans stuff: drops unknowns, keeps catalog order, allows none', () => {
    expect(normalizePathwaysConfig({ stuff: ['trick', 'jumps', 'bouncy'] }).stuff).toEqual(['bouncy', 'trick']);
    expect(normalizePathwaysConfig({ stuff: [] }).stuff).toEqual([]);
  });

  it('plays as an ordinary Playground world with the same seed', () => {
    const p = pathwaysToPlaygroundConfig({
      size: 'large', theme: 'snow', bumpiness: 'flat', stuff: ['bouncy', 'darkTunnels'], stars: 'medium', seed: 'abc',
    });
    expect(p).toEqual({
      size: 'large', theme: 'snow', bumpiness: 'flat', stuff: ['bouncePads', 'tunnels'], stars: 'some', seed: 'abc',
    });
    const all = pathwaysToPlaygroundConfig({ seed: 's' });
    expect(all.stuff).toEqual(['ramps', 'jumps', 'bouncePads', 'tunnels']);
    expect(all.stars).toBe('lots');
  });

  it('every stuff and stars choice has a picture', () => {
    for (const s of PATHWAYS_STUFF) expect(icons.pathwaysStuff[s]).toMatch(/^<svg/);
    for (const s of PATHWAYS_STARS) expect(icons.pathwaysStars[s]).toMatch(/^<svg/);
    expect(icons.pathways).toMatch(/^<svg/);
  });
});

describe('pathways setup in the save', () => {
  it('migrateSave fills and repairs ui.pathways', () => {
    expect(migrateSave({}).ui.pathways.stars).toBe('everywhere');
    const d = migrateSave({ ui: { pathways: { size: 'large', stars: 'lots', stuff: ['trick', 'x'], seed: 'q' } } });
    expect(d.ui.pathways).toEqual({ size: 'large', theme: 'grass', bumpiness: 'hilly', stuff: ['trick'], stars: 'everywhere', seed: 'q' });
  });

  it('is remembered apart from Playground and survives a progress reset', () => {
    const save = new Save(new MemoryStorage());
    const progress = new Progress({ save, events: new Events() });
    const before = save.get().ui.playground;
    progress.setPathwaysSetup({ size: 'small', theme: 'snow', stuff: ['ramps'], stars: 'medium', seed: 'zz' });
    expect(save.get().ui.pathways).toEqual(pathwaysSetupFrom({ size: 'small', theme: 'snow', stuff: ['ramps'], stars: 'medium', seed: 'zz' }));
    expect(save.get().ui.playground).toEqual(before);

    const fresh = resetProgressData(save.get());
    expect(fresh.ui.pathways.seed).toBe('zz');
    expect(fresh.ui.pathways.stuff).toEqual(['ramps']);
  });
});
