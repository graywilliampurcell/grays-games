import { describe, it, expect } from 'vitest';
import { normalizePlaygroundConfig, PLAYGROUND_STUFF } from '../src/app/configs.js';
import {
  generate,
  floodFill,
  vIndex,
  worldToCell,
  heightAt,
  isFlatRect,
  SIZE_CELLS,
  SPAWN_PAD_HALF,
  STEP,
} from '../src/playground/TerrainGenerator.js';
import { STAR_COUNTS } from '../src/playground/Stars.js';

const cfg = (over = {}) =>
  normalizePlaygroundConfig({ size: 'small', bumpiness: 'hilly', stuff: PLAYGROUND_STUFF, stars: 'some', seed: 'test-seed', ...over });

const SEEDS = ['🍎🐶🚀⚽', 'alpha', 'beta', 'gamma'];

describe('playground terrain', () => {
  it('is deterministic for a seed', () => {
    const a = generate(cfg({ seed: 'same' }));
    const b = generate(cfg({ seed: 'same' }));
    expect(Array.from(a.heights)).toEqual(Array.from(b.heights));
    expect(JSON.stringify(a.features)).toEqual(JSON.stringify(b.features));
    expect(a.stars).toEqual(b.stars);
    expect(a.pads).toEqual(b.pads);
    expect(a.trees).toEqual(b.trees);
    const c = generate(cfg({ seed: 'different' }));
    expect(Array.from(c.heights)).not.toEqual(Array.from(a.heights));
  });

  it('has the right grid size', () => {
    for (const size of ['small', 'medium', 'large']) {
      const w = generate(cfg({ size, stars: 'none', stuff: [] }));
      expect(w.n).toBe(SIZE_CELLS[size]);
      expect(w.heights.length).toBe((w.n + 1) ** 2);
    }
  });

  for (const bumpiness of ['flat', 'hilly', 'mountains']) {
    it(`${bumpiness}: steps of 0.5, slope-limited, flat spawn pad`, () => {
      for (const seed of SEEDS) {
        const w = generate(cfg({ bumpiness, seed, size: 'medium' }));
        const { n, heights: h } = w;
        const c = n / 2;
        for (let ix = 0; ix <= n; ix++) {
          for (let iz = 0; iz <= n; iz++) {
            const v = h[vIndex(n, ix, iz)];
            expect(Math.round(v / STEP) * STEP).toBe(v);
            if (ix < n) expect(Math.abs(h[vIndex(n, ix + 1, iz)] - v)).toBeLessThanOrEqual(STEP);
            if (iz < n) expect(Math.abs(h[vIndex(n, ix, iz + 1)] - v)).toBeLessThanOrEqual(STEP);
            if (ix < n && iz < n) expect(Math.abs(h[vIndex(n, ix + 1, iz + 1)] - v)).toBeLessThanOrEqual(STEP);
          }
        }
        const padH = h[vIndex(n, c, c)];
        for (let ix = c - SPAWN_PAD_HALF; ix <= c + SPAWN_PAD_HALF; ix++) {
          for (let iz = c - SPAWN_PAD_HALF; iz <= c + SPAWN_PAD_HALF; iz++) expect(h[vIndex(n, ix, iz)]).toBe(padH);
        }
        expect(w.spawn).toMatchObject({ x: 0, y: padH, z: 0 });
      }
    });
  }

  it('mountains are taller than hills, hills taller than flat', () => {
    const range = (b) => {
      const w = generate(cfg({ bumpiness: b, size: 'medium', seed: 'range' }));
      return w.maxH - w.minH;
    };
    const flat = range('flat');
    const hilly = range('hilly');
    const mountains = range('mountains');
    expect(flat).toBeLessThanOrEqual(2);
    expect(hilly).toBeGreaterThan(flat);
    expect(mountains).toBeGreaterThan(hilly);
  });
});

describe('playground features', () => {
  it('places each requested kind of stuff and nothing else', () => {
    for (const seed of SEEDS) {
      const w = generate(cfg({ size: 'medium', seed }));
      const kinds = new Set(w.features.map((f) => f.type));
      for (const k of PLAYGROUND_STUFF) expect(kinds.has(k)).toBe(true);
      const none = generate(cfg({ size: 'medium', seed, stuff: [] }));
      expect(none.features).toEqual([]);
      const only = generate(cfg({ size: 'medium', seed, stuff: ['tunnels'] }));
      expect(only.features.length).toBeGreaterThan(0);
      expect(only.features.every((f) => f.type === 'tunnels')).toBe(true);
    }
  });

  it('flood fill from spawn reaches every feature, pad and ground star', () => {
    for (const size of ['small', 'medium', 'large']) {
      for (const bumpiness of ['flat', 'hilly', 'mountains']) {
        const w = generate(cfg({ size, bumpiness, seed: `${size}-${bumpiness}`, stars: 'lots' }));
        const t = { n: w.n, heights: w.heights };
        const reach = floodFill(t, w.blocked, w.n / 2, w.n / 2);
        for (const f of w.features) {
          for (const a of f.access) expect(reach[a.cx * w.n + a.cz], `${f.type} access`).toBe(1);
        }
        for (const p of w.pads) {
          const { cx, cz } = worldToCell(t, p.x, p.z);
          expect(reach[cx * w.n + cz]).toBe(1);
        }
        for (const s of w.stars) {
          const { cx, cz } = worldToCell(t, s.x, s.z);
          const ground = heightAt(t, s.x, s.z);
          // Ground stars (not bonus stars on/over features) sit on reachable cells.
          if (Math.abs(s.y - ground - 0.9) < 1e-6) expect(reach[cx * w.n + cz]).toBe(1);
        }
      }
    }
  });

  it('features sit on flat ground away from the spawn pad', () => {
    const w = generate(cfg({ size: 'large', seed: 'flat-spots' }));
    const t = { n: w.n, heights: w.heights };
    for (const f of w.features) {
      expect(Math.hypot(f.center.x, f.center.z)).toBeGreaterThan(10);
      expect(heightAt(t, f.center.x, f.center.z)).toBe(f.y);
      expect(isFlatRect(t, f.cx0, f.cz0, f.w, f.l)).toBe(true);
    }
  });
});

describe('playground stars', () => {
  for (const stars of ['none', 'some', 'lots']) {
    for (const size of ['small', 'medium', 'large']) {
      it(`${stars} stars on ${size}`, () => {
        for (const seed of SEEDS.slice(0, 2)) {
          const w = generate(cfg({ size, stars, seed, bumpiness: 'mountains' }));
          expect(w.stars.length).toBe(STAR_COUNTS[stars][size]);
        }
      });
    }
  }

  it('lots > some > none', () => {
    expect(STAR_COUNTS.lots.medium).toBeGreaterThan(STAR_COUNTS.some.medium);
    expect(STAR_COUNTS.none.medium).toBe(0);
  });
});
