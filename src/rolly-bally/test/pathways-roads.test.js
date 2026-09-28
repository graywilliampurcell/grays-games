// Pathways P1: roads generated through the world, stars along them, path
// assist, and the responsive-control tuning.
import { describe, it, expect } from 'vitest';
import { generatePathways, STAR_GAP, ROAD_HALF } from '../src/pathways/PathwaysGenerator.js';
import { assistAccel, ASSIST } from '../src/pathways/pathAssist.js';
import { floodFill, WALK_MAX_RANGE, cellRange } from '../src/playground/TerrainGenerator.js';
import { normalizePathwaysConfig } from '../src/app/configs.js';

const WORLDS = [];
for (const size of ['small', 'medium', 'large']) {
  for (const bumpiness of ['flat', 'hilly', 'mountains']) {
    for (const theme of ['grass', 'snow']) WORLDS.push({ size, bumpiness, theme, seed: `roads-${size}-${bumpiness}-${theme}` });
  }
}
const cache = new Map();
const world = (c) => {
  const key = JSON.stringify(c);
  if (!cache.has(key)) cache.set(key, generatePathways(c));
  return cache.get(key);
};

/** Cells connected to the spawn over road cells only (4-connected). */
function roadReach(w) {
  const { n, paths } = w;
  const start = paths.center[0];
  const seen = new Uint8Array(n * n);
  const s = paths.nodes[0].out;
  const stack = [s.cx * n + s.cz];
  seen[stack[0]] = 1;
  while (stack.length) {
    const i = stack.pop();
    const cx = (i / n) | 0;
    const cz = i % n;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const j = (cx + dx) * n + cz + dz;
      if (cx + dx < 0 || cz + dz < 0 || cx + dx >= n || cz + dz >= n || seen[j] || !paths.cells[j]) continue;
      seen[j] = 1;
      stack.push(j);
    }
  }
  return { seen, start };
}

describe('pathways roads', () => {
  it('is deterministic per seed', () => {
    const c = { size: 'small', bumpiness: 'hilly', seed: 'same' };
    const a = generatePathways(c);
    const b = generatePathways(c);
    expect(Array.from(a.paths.cells)).toEqual(Array.from(b.paths.cells));
    expect(a.stars).toEqual(b.stars);
    expect(generatePathways({ ...c, seed: 'other' }).paths.center).not.toEqual(a.paths.center);
  });

  it.each(WORLDS)('connects the spawn to every feature and pad: %o', (c) => {
    const w = world(c);
    const { n, paths } = w;
    const { seen } = roadReach(w);
    for (const node of paths.nodes) {
      expect(seen[node.in.cx * n + node.in.cz], `${node.id} in`).toBe(1);
      expect(seen[node.out.cx * n + node.out.cz], `${node.id} out`).toBe(1);
    }
    // A loop through every stop, 1–3 spokes from the spawn, and one road
    // through/around each feature.
    const stops = paths.nodes.length - 1;
    const loop = paths.segments.filter((s) => s.from !== 'spawn' && s.from !== s.to);
    const spokes = paths.segments.filter((s) => s.from === 'spawn');
    const through = paths.segments.filter((s) => s.from === s.to);
    expect(loop.length).toBe(stops);
    expect(spokes.length).toBeGreaterThanOrEqual(1);
    expect(spokes.length).toBeLessThanOrEqual(3);
    expect(through.length).toBe(w.features.filter((f) => f.type !== 'bouncePads').length);
  });

  it.each(WORLDS)('roads are 3 wide, never on solid cells, and rollable: %o', (c) => {
    const w = world(c);
    const { n, paths, blocked } = w;
    for (let i = 0; i < n * n; i++) if (paths.cells[i]) expect(blocked[i]).toBe(0);
    // Every centerline point has road on both sides (where there's no wall).
    let full = 0;
    for (const p of paths.center) {
      const i = Math.floor(p.x + n / 2) * n + Math.floor(p.z + n / 2);
      expect(paths.cells[i]).toBeGreaterThanOrEqual(2);
      const side = [[-ROAD_HALF, 0], [ROAD_HALF, 0], [0, -ROAD_HALF], [0, ROAD_HALF]].filter(([dx, dz]) => paths.cells[i + dx * n + dz]);
      if (side.length === 4) full++;
    }
    // (Roads narrow where they squeeze past a ramp or a tunnel wall.)
    expect(full / paths.center.length).toBeGreaterThan(0.7);
    // Centerline cells are walkable (slope-limited terrain), except where a
    // road runs up to a feature.
    const t = { n, heights: w.heights };
    let steep = 0;
    for (const p of paths.center) {
      const cx = Math.floor(p.x + n / 2);
      const cz = Math.floor(p.z + n / 2);
      if (cellRange(t, cx, cz) > WALK_MAX_RANGE) steep++;
    }
    expect(steep).toBe(0);
  });

  it.each(WORLDS)('no trees on roads, and the world stays reachable: %o', (c) => {
    const w = world(c);
    const { n, paths } = w;
    for (const tr of w.trees) expect(paths.cells[tr.cx * n + tr.cz]).toBe(0);
    const reach = floodFill({ n, heights: w.heights }, w.blocked, n / 2, n / 2);
    for (let i = 0; i < n * n; i++) if (paths.cells[i]) expect(reach[i]).toBe(1);
  });

  it('stars sit along the roads, closer together for Everywhere than Medium', () => {
    for (const size of ['small', 'medium', 'large']) {
      const base = { size, bumpiness: 'hilly', seed: `stars-${size}` };
      const lots = generatePathways({ ...base, stars: 'everywhere' });
      const some = generatePathways({ ...base, stars: 'medium' });
      expect(lots.stars.length).toBeGreaterThan(some.stars.length * 1.5);
      for (const w of [lots, some]) {
        const { n, paths } = w;
        const bonus = w.features.reduce((k, f) => k + f.starSpots.length, 0);
        const onRoad = w.stars.filter((s) => paths.cells[Math.floor(s.x + n / 2) * n + Math.floor(s.z + n / 2)]).length;
        expect(onRoad).toBeGreaterThanOrEqual(w.stars.length - bonus);
        // Never two stars on top of each other.
        for (let i = 0; i < w.stars.length; i++) {
          for (let j = i + 1; j < w.stars.length; j++) {
            const d = Math.hypot(w.stars[i].x - w.stars[j].x, w.stars[i].z - w.stars[j].z, w.stars[i].y - w.stars[j].y);
            expect(d).toBeGreaterThan(0.5);
          }
        }
      }
    }
    expect(STAR_GAP).toEqual({ everywhere: 3, medium: 6 });
  });

  it('builds a loop even with no stuff turned on', () => {
    for (const size of ['small', 'medium', 'large']) {
      const w = generatePathways({ size, bumpiness: 'mountains', stuff: [], seed: `bare-${size}` });
      expect(w.features).toHaveLength(0);
      expect(w.paths.nodes.length).toBeGreaterThanOrEqual(4);
      expect(w.paths.center.length).toBeGreaterThan(20);
      expect(w.stars.length).toBeGreaterThan(5);
    }
  });

  it('arrows point along the road', () => {
    const w = world(WORLDS[0]);
    expect(w.paths.arrows.length).toBeGreaterThan(3);
    for (const a of w.paths.arrows) {
      const p = w.paths.center[a.at];
      expect(Math.hypot(p.x - a.x, p.z - a.z)).toBeLessThan(1e-9);
      expect(Math.sin(a.yaw) * p.dx + Math.cos(a.yaw) * p.dz).toBeGreaterThan(0.99);
      const n = w.n;
      expect(cellRange({ n, heights: w.heights }, Math.floor(a.x + n / 2), Math.floor(a.z + n / 2))).toBe(0);
    }
  });

  it('keeps the chosen config (stars everywhere by default)', () => {
    const w = generatePathways({ seed: 'cfg' });
    expect(w.config).toEqual(normalizePathwaysConfig({ seed: 'cfg' }));
  });
});

describe('path assist', () => {
  const point = { x: 0, z: 0, dx: 0, dz: 1 }; // road runs along +z through the origin

  it('pushes back toward the middle when rolling along the road', () => {
    const a = assistAccel({ x: 1, z: 0 }, point, { x: 0, z: 1 });
    expect(a.x).toBeLessThan(0);
    expect(Math.abs(a.z)).toBeLessThan(1e-9);
    const b = assistAccel({ x: -1, z: 5 }, point, { x: 0, z: -1 }); // either direction along
    expect(b.x).toBeGreaterThan(0);
  });

  it('is gentle and capped', () => {
    const a = assistAccel({ x: 50, z: 0 }, point, { x: 0, z: 1 });
    expect(Math.hypot(a.x, a.z)).toBeLessThanOrEqual(ASSIST.maxPull + 1e-9);
  });

  it('lets go when steering off the road, idle, or already centered', () => {
    expect(assistAccel({ x: 1, z: 0 }, point, { x: 1, z: 0 })).toBe(null); // finger across the road
    expect(assistAccel({ x: 1, z: 0 }, point, { x: 0, z: 0 })).toBe(null);
    expect(assistAccel({ x: 0.05, z: 0 }, point, { x: 0, z: 1 })).toBe(null);
    expect(assistAccel({ x: 1, z: 0 }, null, { x: 0, z: 1 })).toBe(null);
  });
});

describe('pathways tuning', () => {
  it('same top speed as Playground, quicker and tighter control, bigger star pickup', async () => {
    const { PATHWAYS_TUNING, STAR_RADIUS } = await import('../src/pathways/PathwaysMode.js');
    const { DEFAULT_TUNING } = await import('../src/ball/Ball.js');
    expect(PATHWAYS_TUNING.speedCap).toBe(9);
    expect(PATHWAYS_TUNING.accel / DEFAULT_TUNING.accel).toBeCloseTo(1.4, 1);
    expect(PATHWAYS_TUNING.turnAssist).toBeGreaterThan(DEFAULT_TUNING.turnAssist);
    expect(STAR_RADIUS).toBeGreaterThan(1.25);
  });
});
