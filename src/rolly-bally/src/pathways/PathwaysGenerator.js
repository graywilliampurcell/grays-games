// Pathways world generator (pure: no three.js, no DOM, no physics).
//
//   generatePathways(config) → the Playground world from generate(), plus
//   `paths` (the roads) and stars laid along them.
//
// Roads: a loop that visits every feature and safe pad in order around the
// spawn, plus 1–3 spokes from the spawn pad onto the loop, plus a short road
// from each feature's entry to its exit (the ramp/jump itself is the fun way). Each leg is routed
// with A* over the 1 m cells, preferring flat ground and going around solid
// things; a road runs into a feature at its first access cell and leaves from
// its last one, so the loop goes *through* ramps and tunnels. The centerline
// is widened to a 3-cell road; trees on the road are removed. Roads follow the
// terrain (the heightfield's one-step slope limit already makes every rise a
// gentle ramp); they guide, they don't fence.
//
// paths = {
//   cells: Uint8Array n*n   0 off-road, 1 road, 2 centerline, 3 centerline dot
//   nearest: Int32Array n*n index into `center` of the closest centerline
//            point for road cells, -1 elsewhere
//   center: [{x, y, z, dx, dz}]  centerline points (world), unit travel dir
//   segments: [{from, to, start, end}]  legs as index ranges into `center`
//   arrows: [{x, y, z, yaw, at}]  arrow markers pointing along the road (at = center index)
// }

import { Rng } from '../core/Rng.js';
import { pathwaysToPlaygroundConfig, normalizePathwaysConfig } from '../app/configs.js';
import {
  generate, cellCenter, cellRange, heightAt, floodFill, vIndex, WALK_MAX_RANGE,
} from '../playground/TerrainGenerator.js';
import { STAR_HOVER } from '../playground/Stars.js';

export const ROAD_HALF = 1; // centerline ± 1 cell → 3 cells wide
export const STAR_GAP = { everywhere: 3, medium: 6 };
export const ARROW_EVERY = 8;
export const MAX_SPOKES = 3;

const SLOPE_COST = 6; // per meter of corner-height range in a cell
const TREE_COST = 3; // trees on the way get cleared, but prefer going around

/**
 * @param {object} config Pathways config ({size, theme, bumpiness, stuff, stars, seed})
 */
export function generatePathways(config) {
  const cfg = normalizePathwaysConfig(config);
  // The base world: Playground terrain + stuff + pads + trees, no stars yet.
  const world = generate({ ...pathwaysToPlaygroundConfig(cfg), stars: 'none' });
  const rng = new Rng(`${cfg.seed}:pathways`);
  const { n } = world;
  const t = { n, heights: world.heights };

  // Cells a road must not cross: solid things (ramp wedges, kickers, tunnel
  // walls, the border) but not trees. Open feature ground (a tunnel's floor,
  // a bounce pad) is fine to drive through.
  const treeAt = new Map(world.trees.map((tr, i) => [tr.cx * n + tr.cz, i]));
  const wall = new Uint8Array(n * n);
  for (let i = 0; i < n * n; i++) if (world.blocked[i] && !treeAt.has(i)) wall[i] = 1;

  const nodes = pathNodes(world, t, rng);
  const spawn = nodes[0];
  const ring = nodes.slice(1);

  const legs = [];
  for (let k = 0; k < ring.length && ring.length > 1; k++) {
    legs.push([ring[k], ring[(k + 1) % ring.length]]);
    if (ring.length === 2) break; // two stops: one road between them, no double-back
  }
  for (const target of spokeTargets(spawn, ring)) legs.push([spawn, target]);
  // A road from each feature's entry to its exit too (straight through a
  // tunnel, a short way around a ramp or kicker), so the roads never break.
  for (const node of ring) {
    if (node.in.cx !== node.out.cx || node.in.cz !== node.out.cz) {
      legs.push([{ id: node.id, out: node.in }, { id: node.id, in: node.out }]);
    }
  }

  const cells = new Uint8Array(n * n);
  const center = [];
  const segments = [];
  const onCenter = new Int32Array(n * n).fill(-1);

  for (const [a, b] of legs) {
    const route = aStar(t, wall, treeAt, a.out, b.in);
    if (!route) continue;
    const start = center.length;
    for (let k = 0; k < route.length; k++) {
      const { cx, cz } = route[k];
      const i = cx * n + cz;
      const p = cellCenter(t, cx, cz);
      if (onCenter[i] < 0) onCenter[i] = center.length;
      cells[i] = k % 4 < 2 ? 3 : 2;
      center.push({ x: p.x, y: heightAt(t, p.x, p.z), z: p.z, dx: 0, dz: 0, cx, cz });
    }
    const end = center.length;
    setDirections(center, start, end);
    segments.push({ from: a.id, to: b.id, start, end });
  }

  // Widen to a 3-cell road (never onto walls or feature insides).
  for (const p of center) {
    for (let dx = -ROAD_HALF; dx <= ROAD_HALF; dx++) {
      for (let dz = -ROAD_HALF; dz <= ROAD_HALF; dz++) {
        const cx = p.cx + dx;
        const cz = p.cz + dz;
        if (cx < 1 || cz < 1 || cx > n - 2 || cz > n - 2) continue;
        const i = cx * n + cz;
        if (!cells[i] && !wall[i]) cells[i] = 1;
      }
    }
  }

  // Clear trees that ended up on the road.
  const keep = [];
  for (const tr of world.trees) {
    const i = tr.cx * n + tr.cz;
    if (cells[i]) world.blocked[i] = 0;
    else keep.push(tr);
  }
  world.trees = keep;

  const nearest = nearestCenter(n, cells, center);
  // Arrows lie flat, so only on flat cells (the next flat one if needed).
  const arrows = [];
  for (const s of segments) {
    for (let k = s.start + ARROW_EVERY / 2; k < s.end - 2; k += ARROW_EVERY) {
      let j = k;
      while (j < Math.min(s.end - 2, k + ARROW_EVERY / 2) && cellRange(t, center[j].cx, center[j].cz) > 0) j++;
      const p = center[j];
      if (cellRange(t, p.cx, p.cz) > 0) continue;
      arrows.push({ x: p.x, y: p.y, z: p.z, yaw: Math.atan2(p.dx, p.dz), at: j });
    }
  }

  world.stars = pathStars(world, t, center, segments, STAR_GAP[cfg.stars] || STAR_GAP.everywhere);
  world.reach = floodFill(t, world.blocked, n / 2, n / 2);
  world.paths = { cells, nearest, center: center.map(({ cx, cz, ...p }) => p), segments, arrows, nodes };
  world.config = cfg;
  return world;
}

// ------------------------------------------------------------------ nodes

/**
 * Stops the roads connect: [spawn, ...others sorted by angle around spawn].
 * Features enter at their first access cell and leave from their last. Worlds
 * with too few stops get waypoints around the spawn so there's still a loop.
 */
export function pathNodes(world, t, rng) {
  const { n } = world;
  const c = n / 2;
  const node = (id, inCell, outCell = inCell) => {
    const p = cellCenter(t, inCell.cx, inCell.cz);
    return { id, in: inCell, out: outCell, x: p.x, z: p.z, angle: Math.atan2(p.x, p.z) };
  };
  const out = [];
  world.features.forEach((f, i) => out.push(node(`${f.type}${i}`, f.access[0], f.access[f.access.length - 1])));
  world.pads.forEach((p, i) => {
    if (!p.spawn) out.push(node(`pad${i}`, { cx: p.cx + 1, cz: p.cz + 1 }));
  });

  if (out.length < 3) {
    // Waypoints on walkable, reachable ground roughly n/3 out, 4 directions.
    const r = n / 3;
    const start = rng.range(0, Math.PI / 2);
    for (let k = 0; k < 4 && out.length < 4; k++) {
      const a = start + (k * Math.PI) / 2;
      const cell = nearestWalkable(world, t, Math.round(c + Math.sin(a) * r), Math.round(c + Math.cos(a) * r));
      if (cell) out.push(node(`way${k}`, cell));
    }
  }
  out.sort((a, b) => a.angle - b.angle);
  return [node('spawn', { cx: c, cz: c - 3 }), ...out];
}

function nearestWalkable(world, t, cx0, cz0) {
  const { n, blocked, reach } = world;
  for (let r = 0; r < n / 4; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const cx = cx0 + dx;
        const cz = cz0 + dz;
        if (cx < 2 || cz < 2 || cx > n - 3 || cz > n - 3) continue;
        const i = cx * n + cz;
        if (!blocked[i] && reach[i] && cellRange(t, cx, cz) <= WALK_MAX_RANGE) return { cx, cz };
      }
    }
  }
  return null;
}

/** Ring stops that get a spoke from the spawn: the nearest, then spread out. */
function spokeTargets(spawn, ring) {
  if (!ring.length) return [];
  const byDist = [...ring].sort((a, b) => a.x ** 2 + a.z ** 2 - (b.x ** 2 + b.z ** 2));
  const picked = [byDist[0]];
  const want = Math.min(MAX_SPOKES, ring.length >= 6 ? 3 : ring.length >= 3 ? 2 : 1);
  for (const cand of byDist) {
    if (picked.length >= want) break;
    const far = picked.every((p) => {
      let d = Math.abs(p.angle - cand.angle);
      if (d > Math.PI) d = 2 * Math.PI - d;
      return d > (Math.PI * 2) / 3 - 0.3;
    });
    if (far) picked.push(cand);
  }
  return picked;
}

// ------------------------------------------------------------------ routing

/** Minimal binary heap of [priority, value]. */
class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(p, v) {
    const a = this.a;
    a.push([p, v]);
    let i = a.length - 1;
    while (i > 0) {
      const j = (i - 1) >> 1;
      if (a[j][0] <= a[i][0]) break;
      [a[i], a[j]] = [a[j], a[i]];
      i = j;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top[1];
  }
}

/**
 * A* over 4-connected cells from `from` to `to`. Walls are impassable, the
 * outer ring too; steep cells and trees cost extra. Returns [{cx, cz}] or null.
 */
export function aStar(t, wall, treeAt, from, to) {
  const { n } = t;
  const goal = to.cx * n + to.cz;
  const startI = from.cx * n + from.cz;
  const g = new Float64Array(n * n).fill(Infinity);
  const prev = new Int32Array(n * n).fill(-1);
  const closed = new Uint8Array(n * n);
  const h = (i) => Math.abs(((i / n) | 0) - to.cx) + Math.abs((i % n) - to.cz);
  const heap = new Heap();
  g[startI] = 0;
  heap.push(h(startI), startI);
  while (heap.size) {
    const i = heap.pop();
    if (closed[i]) continue;
    closed[i] = 1;
    if (i === goal) break;
    const cx = (i / n) | 0;
    const cz = i % n;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = cx + dx;
      const z = cz + dz;
      if (x < 1 || z < 1 || x > n - 2 || z > n - 2) continue;
      const j = x * n + z;
      if (closed[j] || (wall[j] && j !== goal)) continue;
      const cost = 1 + cellRange(t, x, z) * SLOPE_COST + (treeAt.has(j) ? TREE_COST : 0);
      const ng = g[i] + cost;
      if (ng < g[j]) {
        g[j] = ng;
        prev[j] = i;
        heap.push(ng + h(j), j);
      }
    }
  }
  if (!closed[goal]) return null;
  const out = [];
  for (let i = goal; i !== -1; i = prev[i]) out.push({ cx: (i / n) | 0, cz: i % n });
  return out.reverse();
}

/** Unit travel direction per centerline point, smoothed over ±2 points. */
function setDirections(center, start, end) {
  for (let k = start; k < end; k++) {
    const a = center[Math.max(start, k - 2)];
    const b = center[Math.min(end - 1, k + 2)];
    let dx = b.x - a.x;
    let dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) {
      dx = 0;
      dz = 1;
    } else {
      dx /= len;
      dz /= len;
    }
    center[k].dx = dx;
    center[k].dz = dz;
  }
}

/** For each road cell, the index of the closest centerline point (−1 off-road). */
function nearestCenter(n, cells, center) {
  const nearest = new Int32Array(n * n).fill(-1);
  const best = new Float64Array(n * n).fill(Infinity);
  center.forEach((p, k) => {
    for (let dx = -ROAD_HALF - 1; dx <= ROAD_HALF + 1; dx++) {
      for (let dz = -ROAD_HALF - 1; dz <= ROAD_HALF + 1; dz++) {
        const cx = p.cx + dx;
        const cz = p.cz + dz;
        if (cx < 0 || cz < 0 || cx >= n || cz >= n) continue;
        const i = cx * n + cz;
        if (!cells[i]) continue;
        const d = dx * dx + dz * dz;
        if (d < best[i]) {
          best[i] = d;
          nearest[i] = k;
        }
      }
    }
  });
  return nearest;
}

// ------------------------------------------------------------------ stars

/**
 * Every feature's bonus spots, plus stars every `gap` cells along each road
 * leg (never two closer than 1.5 m).
 */
export function pathStars(world, t, center, segments, gap) {
  const stars = [];
  for (const f of world.features) for (const sp of f.starSpots || []) stars.push({ x: sp.x, y: sp.y, z: sp.z });
  const spaced = (x, z) => stars.every((s) => (s.x - x) ** 2 + (s.z - z) ** 2 >= 1.5 * 1.5);
  for (const s of segments) {
    for (let k = s.start + 2; k < s.end; k += gap) {
      const p = center[k];
      if (world.blocked[p.cx * world.n + p.cz] || !spaced(p.x, p.z)) continue;
      stars.push({ x: p.x, y: heightAt(t, p.x, p.z) + STAR_HOVER, z: p.z });
    }
  }
  return stars;
}

// Re-exported for tests.
export { vIndex };
