import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { initRapier, Physics } from '../src/core/Physics.js';
import { Track } from '../src/track/TrackBuilder.js';
import { PIECES } from '../src/track/Catalog.js';
import {
  generateSkyRoads, nearestRoad, BUMPS, SIZES, ROAD_WIDTH, BRANCH_OFFSET, STAR_GAP, START_PAD, END_PAD,
} from '../src/pathways/SkyRoads.js';
import { SKY_PALETTES } from '../src/pathways/PathwaysMode.js';

beforeAll(async () => {
  await initRapier();
});

const SIZE_KEYS = ['small', 'medium', 'large'];
const BUMP_KEYS = ['flat', 'hilly', 'mountains'];
const SEEDS = ['🍎🐶🚀⚽', 'abc', 'sky-7', '🌈🐸🍩🎈'];
const DOWN = { x: 0, y: -1, z: 0 };

function every(fn) {
  for (const size of SIZE_KEYS) for (const bumpiness of BUMP_KEYS) for (const seed of SEEDS) fn({ size, bumpiness, seed, stars: 'everywhere' });
}

describe('sky roads: layout', () => {
  it('is deterministic for a seed', () => {
    const a = generateSkyRoads({ seed: 'same', size: 'large', bumpiness: 'mountains' });
    const b = generateSkyRoads({ seed: 'same', size: 'large', bumpiness: 'mountains' });
    expect(JSON.stringify(a.roads)).toBe(JSON.stringify(b.roads));
    expect(a.stars).toEqual(b.stars);
    const c = generateSkyRoads({ seed: 'other', size: 'large', bumpiness: 'mountains' });
    expect(JSON.stringify(c.roads)).not.toBe(JSON.stringify(a.roads));
  });

  it('size sets the number of forks and how long the network is', () => {
    const len = (w) => w.layouts.reduce((s, l) => s + l.length, 0);
    for (const seed of SEEDS) {
      const ws = SIZE_KEYS.map((size) => generateSkyRoads({ seed, size, bumpiness: 'flat' }));
      ws.forEach((w, i) => {
        expect(w.forks).toBe(SIZES[SIZE_KEYS[i]].forks);
        expect(w.roads.filter((r) => r.kind === 'branch')).toHaveLength(2 * w.forks);
        expect(w.junctions).toHaveLength(2 * w.forks);
      });
      expect(len(ws[1])).toBeGreaterThan(len(ws[0]));
      expect(len(ws[2])).toBeGreaterThan(len(ws[1]));
    }
  });

  it('every fork: both branches end side by side and the next road starts between them', () => {
    every((cfg) => {
      const w = generateSkyRoads(cfg);
      w.roads.forEach((r, i) => {
        if (r.kind !== 'branch' || w.roads[i - 1].kind !== 'trunk') return;
        const [a, b] = [w.layouts[i], w.layouts[i + 1]].map((l) => l.pieces[l.pieces.length - 1].exit);
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeCloseTo(2 * BRANCH_OFFSET, 6);
        expect(a.y).toBeCloseTo(b.y, 6);
        expect(a.yaw).toBeCloseTo(b.yaw, 9);
        const next = w.roads[i + 2].options.start;
        expect(next.x).toBeCloseTo((a.x + b.x) / 2, 6);
        expect(next.z).toBeCloseTo((a.z + b.z) / 2, 6);
        expect(next.y).toBeCloseTo(a.y, 6);
        // Each branch starts where its fork's trunk ends, one branch offset to the side.
        const trunk = w.layouts[i - 1];
        const e = trunk.pieces[trunk.pieces.length - 1].exit;
        for (const l of [w.layouts[i], w.layouts[i + 1]]) {
          const s = l.options.start || w.roads[w.layouts.indexOf(l)].options.start;
          expect(Math.hypot(s.x - e.x, s.z - e.z)).toBeCloseTo(BRANCH_OFFSET, 6);
        }
      });
    });
  });

  it('walls on both sides the whole way; no race gates, finish or start grid', () => {
    every((cfg) => {
      const w = generateSkyRoads(cfg);
      for (const l of w.layouts) {
        expect(l.strips.every((st) => st.rails && st.floor)).toBe(true);
        expect(l.features.filter((f) => ['checkpoint', 'finish', 'start', 'startLine', 'hazard', 'boost'].includes(f.type))).toEqual([]);
      }
    });
  });

  it('roads never cross or touch each other (except where they fork and join)', () => {
    every((cfg) => {
      const w = generateSkyRoads(cfg);
      const pts = [];
      w.layouts.forEach((l, road) => {
        for (let s = 0; s <= l.length; s += 2) pts.push({ road, s, ...l.spline.positionAt(s) });
      });
      const nearJunction = (p) => w.junctions.some((j) => Math.hypot(p.x - j.x, p.z - j.z) < 16);
      for (let i = 0; i < pts.length; i++) {
        for (let k = i + 1; k < pts.length; k++) {
          const a = pts[i];
          const b = pts[k];
          if (a.road === b.road && Math.abs(a.s - b.s) < ROAD_WIDTH * 2) continue;
          const d = Math.hypot(a.x - b.x, a.z - b.z);
          if (d >= ROAD_WIDTH + 1 || Math.abs(a.y - b.y) > 6) continue;
          expect(nearJunction(a) && nearJunction(b), `roads ${a.road}@${a.s} and ${b.road}@${b.s} are ${d.toFixed(1)} m apart`).toBe(true);
        }
      }
    });
  });

  it('bumpiness: flat stays level; hills and mountains go up and down within limits', () => {
    for (const seed of SEEDS) {
      const flat = generateSkyRoads({ seed, size: 'large', bumpiness: 'flat' });
      expect(flat.minY).toBe(0);
      expect(flat.maxY).toBe(0);
    }
    const tallest = (b) => Math.max(...SEEDS.map((seed) => generateSkyRoads({ seed, size: 'large', bumpiness: b }).maxY));
    expect(tallest('hilly')).toBeGreaterThan(0);
    expect(tallest('mountains')).toBeGreaterThan(tallest('hilly'));
    every((cfg) => {
      const w = generateSkyRoads(cfg);
      const b = BUMPS[cfg.bumpiness];
      expect(w.minY).toBeGreaterThanOrEqual(-1e-9);
      expect(w.maxY).toBeLessThanOrEqual(b.maxY + b.rise + 1e-9);
    });
  });

  it('stars sit on the roads, every 3 m (Everywhere) or 6 m (Medium), none on the pads', () => {
    for (const seed of SEEDS) {
      const lots = generateSkyRoads({ seed, stars: 'everywhere' });
      const some = generateSkyRoads({ seed, stars: 'medium' });
      expect(lots.stars.length).toBeGreaterThan(some.stars.length * 1.7);
      for (const st of lots.stars) {
        const l = lots.layouts[st.road];
        const n = l.nearest(st);
        expect(Math.abs(n.lateral)).toBeLessThan(ROAD_WIDTH / 2 - 0.5);
        expect(n.height).toBeGreaterThan(0.5);
        expect(n.height).toBeLessThan(1.3);
        expect(l.pieceAt(n.s).id).not.toBe('pad');
      }
      const road0 = lots.stars.filter((s) => s.road === 0).map((s) => lots.layouts[0].nearest(s).s).sort((a, b) => a - b);
      for (let i = 1; i < road0.length; i++) {
        const gap = road0[i] - road0[i - 1];
        if (gap < STAR_GAP.everywhere * 1.5) expect(gap).toBeGreaterThan(STAR_GAP.everywhere * 0.7);
      }
    }
  });

  it('spawn is on the start pad; the end pad is the last piece', () => {
    every((cfg) => {
      const w = generateSkyRoads(cfg);
      const first = w.layouts[0].pieces[0];
      expect(first.id).toBe('pad');
      expect(first.params.width).toBe(START_PAD.width);
      expect(w.layouts[0].nearest(w.spawn).s).toBeCloseTo(START_PAD.len / 2, 3);
      const last = w.layouts[w.end.road];
      expect(w.end.road).toBe(w.layouts.length - 1);
      expect(last.pieces[last.pieces.length - 1].params.width).toBe(END_PAD.width);
      expect(w.end.s1 - w.end.s0).toBeCloseTo(END_PAD.len, 3);
    });
  });

  it('nearestRoad finds the road under a point', () => {
    const w = generateSkyRoads({ seed: 'near', size: 'medium', bumpiness: 'hilly' });
    w.layouts.forEach((l, road) => {
      const p = l.spline.positionAt(l.length / 2);
      const n = nearestRoad(w.layouts, { x: p.x, y: p.y + 0.8, z: p.z });
      expect(n.dist).toBeLessThan(1);
      expect(w.layouts[n.road].spline.positionAt(n.s).x).toBeCloseTo(p.x, 3);
    });
  });

  it('the pad piece is not a race piece', () => {
    expect(PIECES.some((p) => p.id === 'pad')).toBe(false);
  });
});

describe('sky roads: built', () => {
  function build(cfg) {
    const physics = new Physics();
    const scene = new THREE.Scene();
    const w = generateSkyRoads(cfg, { Layout: Track });
    for (const t of w.layouts) t.build({ physics, scene, palette: SKY_PALETTES.grass });
    physics.step();
    return { physics, scene, w };
  }

  it('road under every lane of every road, and a wall on each side', () => {
    for (const bumpiness of BUMP_KEYS) {
      const { physics, w } = build({ seed: `built-${bumpiness}`, size: 'medium', bumpiness });
      for (const l of w.layouts) {
        for (let s = 0.5; s < l.length - 0.5; s += 1.5) {
          const f = l.spline.sampleAt(s);
          for (const lat of [-0.4, 0, 0.4]) {
            const o = lat * f.width;
            const hit = physics.raycast({ x: f.position.x + f.right.x * o, y: f.position.y + 3, z: f.position.z + f.right.z * o }, DOWN, 6);
            const tag = hit && physics.info(hit.collider)?.tag;
            if (tag === 'bumper') continue; // the walls across the start and end pads
            expect(tag).toBe('track');
          }
          if (l.pieceAt(s).id === 'pad') continue;
          for (const side of [-1, 1]) {
            const dir = { x: f.right.x * side, y: 0, z: f.right.z * side };
            const hit = physics.raycast({ x: f.position.x, y: f.position.y + 0.4, z: f.position.z }, dir, f.width / 2 + 1);
            expect(hit && physics.info(hit.collider)?.tag, `s=${s.toFixed(1)} side ${side}`).toBe('rail');
          }
        }
      }
    }
  });

  it('a ball dropped on the start pad stays there', () => {
    const { physics, w } = build({ seed: 'drop', size: 'small', bumpiness: 'flat' });
    const { body } = physics.addDynamicBall({ position: { x: w.spawn.x, y: w.spawn.y + 0.8, z: w.spawn.z }, radius: 0.5, tag: 'ball' });
    for (let i = 0; i < 120; i++) physics.step(1 / 60);
    const p = body.translation();
    expect(p.y).toBeCloseTo(w.spawn.y + 0.5, 1);
    expect(Math.hypot(p.x - w.spawn.x, p.z - w.spawn.z)).toBeLessThan(0.5);
  });
});
