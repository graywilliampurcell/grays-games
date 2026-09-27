// Playground world generator (pure: no three.js, no DOM, no physics).
//
//   generate(config) → { n, heights, minH, maxH, spawn, pads, features, trees, stars, blocked }
//
// Terrain model: a vertex grid of (n+1)² heights, 1 m cells, laid out
// heights[ix * (n + 1) + iz] (the Rapier heightfield layout, see Physics.js).
// Heights come from seeded value noise, quantized to 0.5 m steps, then
// slope-limited so any two neighbouring vertices (including diagonals) differ
// by at most one step. The collider is the smooth heightfield through those
// vertices, so the world rolls smoothly, while flat terraces + one-cell ramps
// between them give the blocky voxel look (plan §7: "smooth heightfield with a
// voxel-looking shell mesh"). The same triangles are drawn by TerrainMesh.js.
//
// World coordinates: the grid is centered on the origin, so vertex (ix, iz)
// sits at x = ix - n/2, z = iz - n/2, and the spawn pad is at (0, h, 0).

import { Rng } from '../core/Rng.js';
import { placeFeatures } from './Features.js';
import { placeStars } from './Stars.js';

export const SIZE_CELLS = { small: 64, medium: 128, large: 192 };
export const STEP = 0.5;
/** A cell whose corner heights span more than this is too steep to "walk". */
export const WALK_MAX_RANGE = STEP;

export const BUMPINESS = {
  flat: { amp: 1.1, scale: 18, octaves: 2, shape: 'plain' },
  hilly: { amp: 6, scale: 26, octaves: 3, shape: 'plain' },
  mountains: { amp: 24, scale: 46, octaves: 4, shape: 'peaks' },
};

export const SPAWN_PAD_HALF = 3; // flat vertex square [c-3, c+3] → 6×6 flat cells
const SPAWN_BLEND = 12; // meters over which terrain eases into the spawn pad

export const PAD_COUNTS = { small: 3, medium: 6, large: 10 }; // extra safe pads
export const TREE_COUNTS = { small: 14, medium: 45, large: 100 };

// ------------------------------------------------------------------ noise

function lattice(seed, x, z) {
  let h = seed ^ Math.imul(x, 374761393) ^ Math.imul(z, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const smooth = (t) => t * t * (3 - 2 * t);

/** Value noise in [0, 1). */
export function valueNoise(seed, x, z) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const fx = smooth(x - x0);
  const fz = smooth(z - z0);
  const a = lattice(seed, x0, z0);
  const b = lattice(seed, x0 + 1, z0);
  const c = lattice(seed, x0, z0 + 1);
  const d = lattice(seed, x0 + 1, z0 + 1);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

/** Fractal value noise in [-1, 1]. */
function fbm(seed, x, z, octaves) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * (valueNoise(seed + o * 1013, x * f, z * f) * 2 - 1);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

// ------------------------------------------------------------------ grid helpers

export const vIndex = (n, ix, iz) => ix * (n + 1) + iz;
export const cIndex = (n, cx, cz) => cx * n + cz;

/** Corner-height range (max - min) of cell (cx, cz). */
export function cellRange(t, cx, cz) {
  const { n, heights: h } = t;
  const a = h[vIndex(n, cx, cz)];
  const b = h[vIndex(n, cx + 1, cz)];
  const c = h[vIndex(n, cx, cz + 1)];
  const d = h[vIndex(n, cx + 1, cz + 1)];
  return Math.max(a, b, c, d) - Math.min(a, b, c, d);
}

export function cellMin(t, cx, cz) {
  const { n, heights: h } = t;
  return Math.min(h[vIndex(n, cx, cz)], h[vIndex(n, cx + 1, cz)], h[vIndex(n, cx, cz + 1)], h[vIndex(n, cx + 1, cz + 1)]);
}

export function cellMax(t, cx, cz) {
  const { n, heights: h } = t;
  return Math.max(h[vIndex(n, cx, cz)], h[vIndex(n, cx + 1, cz)], h[vIndex(n, cx, cz + 1)], h[vIndex(n, cx + 1, cz + 1)]);
}

/** World (x, z) of a cell's center. */
export function cellCenter(t, cx, cz) {
  return { x: cx - t.n / 2 + 0.5, z: cz - t.n / 2 + 0.5 };
}

/** Cell containing world (x, z), clamped to the grid. */
export function worldToCell(t, x, z) {
  const cx = Math.min(t.n - 1, Math.max(0, Math.floor(x + t.n / 2)));
  const cz = Math.min(t.n - 1, Math.max(0, Math.floor(z + t.n / 2)));
  return { cx, cz };
}

/**
 * Surface height at world (x, z), using the same triangulation as Rapier's
 * heightfield: each cell is split along the diagonal from (x0, z1) to (x1, z0).
 */
export function heightAt(t, x, z) {
  const { n, heights: h } = t;
  const gx = Math.min(n, Math.max(0, x + n / 2));
  const gz = Math.min(n, Math.max(0, z + n / 2));
  const cx = Math.min(n - 1, Math.floor(gx));
  const cz = Math.min(n - 1, Math.floor(gz));
  const fx = gx - cx;
  const fz = gz - cz;
  const h00 = h[vIndex(n, cx, cz)];
  const h10 = h[vIndex(n, cx + 1, cz)];
  const h01 = h[vIndex(n, cx, cz + 1)];
  const h11 = h[vIndex(n, cx + 1, cz + 1)];
  if (fx + fz <= 1) return h00 + (h10 - h00) * fx + (h01 - h00) * fz;
  return h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
}

/** True if every vertex of the cell rect [cx0, cx0+w) × [cz0, cz0+l) has the same height. */
export function isFlatRect(t, cx0, cz0, w, l) {
  const { n, heights: h } = t;
  if (cx0 < 0 || cz0 < 0 || cx0 + w > n || cz0 + l > n) return false;
  const y = h[vIndex(n, cx0, cz0)];
  for (let ix = cx0; ix <= cx0 + w; ix++) {
    for (let iz = cz0; iz <= cz0 + l; iz++) {
      if (h[vIndex(n, ix, iz)] !== y) return false;
    }
  }
  return true;
}

/**
 * Level the cell rect [cx0, cx0+w) × [cz0, cz0+l) to one height (a terrace cut
 * into / built onto a hill) without breaking the slope limit:
 *   h'(v) = clamp(h(v), L - STEP*d(v), L + STEP*d(v)),  d = Chebyshev distance to the rect.
 * min/max of STEP-Lipschitz functions stay STEP-Lipschitz, so no re-smoothing
 * is needed. Refused (returns null, nothing changed) if the cut/fill would be
 * deeper than maxCut or would touch a protected vertex (other pads/features).
 * On success returns an undo list [index, oldHeight, ...] and the level.
 */
export function carveFlat(t, protectedV, cx0, cz0, w, l, maxCut = 2.5) {
  const { n, heights: h } = t;
  if (cx0 < 0 || cz0 < 0 || cx0 + w > n || cz0 + l > n) return null;
  let sum = 0;
  let count = 0;
  for (let ix = cx0; ix <= cx0 + w; ix++) {
    for (let iz = cz0; iz <= cz0 + l; iz++) {
      sum += h[vIndex(n, ix, iz)];
      count++;
    }
  }
  const L = Math.round(sum / count / STEP) * STEP + 0; // + 0 turns -0 into 0
  const undo = [];
  for (let ix = 0; ix <= n; ix++) {
    const dx = ix < cx0 ? cx0 - ix : ix > cx0 + w ? ix - cx0 - w : 0;
    for (let iz = 0; iz <= n; iz++) {
      const dz = iz < cz0 ? cz0 - iz : iz > cz0 + l ? iz - cz0 - l : 0;
      const d = Math.max(dx, dz);
      const i = vIndex(n, ix, iz);
      const v = h[i];
      const nv = Math.min(L + STEP * d, Math.max(L - STEP * d, v));
      if (nv === v) continue;
      if (protectedV[i] || (d === 0 && Math.abs(nv - v) > maxCut)) {
        for (let k = 0; k < undo.length; k += 2) h[undo[k]] = undo[k + 1];
        return null;
      }
      undo.push(i, v);
      h[i] = nv;
    }
  }
  return { undo, level: L };
}

export function undoCarve(t, carve) {
  if (!carve) return;
  const u = carve.undo;
  for (let k = 0; k < u.length; k += 2) t.heights[u[k]] = u[k + 1];
}

/** Protect the vertices of a cell rect (grown by margin) from later carving. */
export function protectRect(protectedV, n, cx0, cz0, w, l, margin = 0) {
  for (let ix = Math.max(0, cx0 - margin); ix <= Math.min(n, cx0 + w + margin); ix++) {
    for (let iz = Math.max(0, cz0 - margin); iz <= Math.min(n, cz0 + l + margin); iz++) protectedV[vIndex(n, ix, iz)] = 1;
  }
}

// ------------------------------------------------------------------ heights

/**
 * Lower every vertex so neighbours (8-connected) differ by at most one STEP:
 * h'(v) = min over u of h(u) + STEP * chebyshev(u, v). Two chamfer sweeps per
 * iteration; repeated until stable (usually 1–2 iterations).
 */
function limitSlope(h, n) {
  const N = n + 1;
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 50) {
    changed = false;
    // forward sweep: neighbours above/left already final for this pass
    for (let ix = 0; ix < N; ix++) {
      for (let iz = 0; iz < N; iz++) {
        const i = ix * N + iz;
        let m = h[i];
        if (iz > 0) m = Math.min(m, h[i - 1] + STEP);
        if (ix > 0) {
          m = Math.min(m, h[i - N] + STEP);
          if (iz > 0) m = Math.min(m, h[i - N - 1] + STEP);
          if (iz < N - 1) m = Math.min(m, h[i - N + 1] + STEP);
        }
        if (m < h[i]) {
          h[i] = m;
          changed = true;
        }
      }
    }
    // backward sweep
    for (let ix = N - 1; ix >= 0; ix--) {
      for (let iz = N - 1; iz >= 0; iz--) {
        const i = ix * N + iz;
        let m = h[i];
        if (iz < N - 1) m = Math.min(m, h[i + 1] + STEP);
        if (ix < N - 1) {
          m = Math.min(m, h[i + N] + STEP);
          if (iz < N - 1) m = Math.min(m, h[i + N + 1] + STEP);
          if (iz > 0) m = Math.min(m, h[i + N - 1] + STEP);
        }
        if (m < h[i]) {
          h[i] = m;
          changed = true;
        }
      }
    }
  }
}

/**
 * Build the (n+1)² height grid for a bumpiness level. The middle
 * (2*SPAWN_PAD_HALF)² cells are guaranteed flat (the spawn pad).
 */
export function makeHeights(n, bumpiness, rng) {
  const b = BUMPINESS[bumpiness] || BUMPINESS.hilly;
  const seed = Math.floor(rng.next() * 4294967296) | 0;
  const ox = rng.range(0, 1000);
  const oz = rng.range(0, 1000);
  const N = n + 1;
  const c = n / 2;
  const raw = new Float64Array(N * N);
  for (let ix = 0; ix < N; ix++) {
    for (let iz = 0; iz < N; iz++) {
      let v = fbm(seed, ox + ix / b.scale, oz + iz / b.scale, b.octaves);
      if (b.shape === 'peaks') {
        // Mostly rolling lowland with a few tall peaks.
        const p = (v + 1) / 2;
        v = p * p * p * 2.2 - 0.25;
      }
      raw[ix * N + iz] = v * b.amp;
    }
  }
  // Ease the terrain into the spawn pad height so the pad isn't in a pit or on a spike.
  const padH = Math.round(raw[c * N + c] / STEP) * STEP + 0;
  const h = new Float32Array(N * N);
  for (let ix = 0; ix < N; ix++) {
    for (let iz = 0; iz < N; iz++) {
      const d = Math.max(0, Math.max(Math.abs(ix - c), Math.abs(iz - c)) - SPAWN_PAD_HALF);
      const k = smooth(Math.min(1, d / SPAWN_BLEND));
      const v = padH + (raw[ix * N + iz] - padH) * k;
      h[ix * N + iz] = Math.round(v / STEP) * STEP + 0;
    }
  }
  limitSlope(h, n);
  // The slope limit may have nicked the pad; flatten it to its lowest vertex
  // and limit again (this never lowers the pad further, see test).
  let pad = Infinity;
  for (let ix = c - SPAWN_PAD_HALF; ix <= c + SPAWN_PAD_HALF; ix++) {
    for (let iz = c - SPAWN_PAD_HALF; iz <= c + SPAWN_PAD_HALF; iz++) pad = Math.min(pad, h[ix * N + iz]);
  }
  for (let ix = c - SPAWN_PAD_HALF; ix <= c + SPAWN_PAD_HALF; ix++) {
    for (let iz = c - SPAWN_PAD_HALF; iz <= c + SPAWN_PAD_HALF; iz++) h[ix * N + iz] = pad;
  }
  limitSlope(h, n);
  return h;
}

// ------------------------------------------------------------------ reachability

/**
 * Flood fill over cells from (sx, sz): 4-connected, skipping blocked cells
 * and cells steeper than WALK_MAX_RANGE. Returns Uint8Array (1 = reachable).
 */
export function floodFill(t, blocked, sx, sz) {
  const { n } = t;
  const seen = new Uint8Array(n * n);
  const walk = (cx, cz) => !blocked[cx * n + cz] && cellRange(t, cx, cz) <= WALK_MAX_RANGE;
  if (!walk(sx, sz)) return seen;
  const stack = [sx * n + sz];
  seen[sx * n + sz] = 1;
  while (stack.length) {
    const i = stack.pop();
    const cx = (i / n) | 0;
    const cz = i - cx * n;
    if (cx > 0 && !seen[i - n] && walk(cx - 1, cz)) { seen[i - n] = 1; stack.push(i - n); }
    if (cx < n - 1 && !seen[i + n] && walk(cx + 1, cz)) { seen[i + n] = 1; stack.push(i + n); }
    if (cz > 0 && !seen[i - 1] && walk(cx, cz - 1)) { seen[i - 1] = 1; stack.push(i - 1); }
    if (cz < n - 1 && !seen[i + 1] && walk(cx, cz + 1)) { seen[i + 1] = 1; stack.push(i + 1); }
  }
  return seen;
}

/** Mark cell rect [cx0, cx0+w) × [cz0, cz0+l) (grown by margin) in grid. */
export function markRect(grid, n, cx0, cz0, w, l, margin = 0, value = 1) {
  for (let cx = Math.max(0, cx0 - margin); cx < Math.min(n, cx0 + w + margin); cx++) {
    for (let cz = Math.max(0, cz0 - margin); cz < Math.min(n, cz0 + l + margin); cz++) grid[cx * n + cz] = value;
  }
}

export function rectFree(grid, n, cx0, cz0, w, l) {
  if (cx0 < 0 || cz0 < 0 || cx0 + w > n || cz0 + l > n) return false;
  for (let cx = cx0; cx < cx0 + w; cx++) {
    for (let cz = cz0; cz < cz0 + l; cz++) if (grid[cx * n + cz]) return false;
  }
  return true;
}

// ------------------------------------------------------------------ generate

/**
 * Generate a whole playground world from a normalized config
 * ({size, theme, bumpiness, stuff[], stars, seed}). Deterministic per config.
 */
export function generate(config) {
  const size = SIZE_CELLS[config.size] ? config.size : 'medium';
  const n = SIZE_CELLS[size];
  const rng = new Rng(config.seed);
  const heights = makeHeights(n, config.bumpiness, rng.fork('terrain'));
  const t = { n, heights };

  // blocked: solid things at ground level (walls, feature solids, tree trunks).
  // used: footprint of anything placed (so things don't overlap).
  const blocked = new Uint8Array(n * n);
  const used = new Uint8Array(n * n);
  for (let i = 0; i < n; i++) {
    blocked[i * n] = blocked[i * n + n - 1] = 1; // z edges
    blocked[i] = blocked[(n - 1) * n + i] = 1; // x edges
  }
  const c = n / 2;
  markRect(used, n, c - SPAWN_PAD_HALF, c - SPAWN_PAD_HALF, SPAWN_PAD_HALF * 2, SPAWN_PAD_HALF * 2, 2);
  const spawnCell = { cx: c, cz: c };
  const spawnH = heights[vIndex(n, c, c)];
  const spawn = { x: 0, y: spawnH, z: 0, dir: { x: 0, y: 0, z: -1 } };
  const pads = [{ x: 0, y: spawnH, z: 0, cx: c - 1, cz: c - 1, size: 5, spawn: true }];

  // Vertices that later terrace carving must not move (pads, features).
  const protectedV = new Uint8Array((n + 1) * (n + 1));
  protectRect(protectedV, n, c - SPAWN_PAD_HALF, c - SPAWN_PAD_HALF, SPAWN_PAD_HALF * 2, SPAWN_PAD_HALF * 2);

  const ctx = { t, n, rng, blocked, used, protectedV, spawnCell, pads, size, config };

  const features = placeFeatures(ctx, rng.fork('features'));
  placePads(ctx, rng.fork('pads'));
  const trees = placeTrees(ctx, rng.fork('trees'));
  const reach = floodFill(t, blocked, spawnCell.cx, spawnCell.cz);
  const stars = placeStars({ ...ctx, reach, features }, rng.fork('stars'));

  let minH = Infinity;
  let maxH = -Infinity;
  for (const v of heights) {
    if (v < minH) minH = v;
    if (v > maxH) maxH = v;
  }

  return { n, size, theme: config.theme, heights, minH, maxH, spawn, pads, features, trees, stars, blocked, reach };
}

/** Extra flat 3×3 "safe pads" spread around the world: respawn points + landmarks. */
function placePads(ctx, rng) {
  const { t, n, used, pads, size, blocked, protectedV, spawnCell } = ctx;
  const reach = floodFill(t, blocked, spawnCell.cx, spawnCell.cz); // carving never changes walkability
  const want = PAD_COUNTS[size];
  const minDist = n / 5;
  for (let a = 0; a < want * 80 && pads.length < want + 1; a++) {
    const cx0 = rng.int(3, n - 6);
    const cz0 = rng.int(3, n - 6);
    if (!rectFree(used, n, cx0 - 1, cz0 - 1, 5, 5) || !rectFree(blocked, n, cx0 - 1, cz0 - 1, 5, 5)) continue;
    const p = cellCenter(t, cx0 + 1, cz0 + 1);
    if (pads.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < minDist)) continue;
    if (!reach[(cx0 + 1) * n + cz0 + 1]) continue;
    // Level a 5×5 terrace for the 3×3 pad.
    if (!carveFlat(t, protectedV, cx0 - 1, cz0 - 1, 5, 5)) continue;
    protectRect(protectedV, n, cx0 - 1, cz0 - 1, 5, 5);
    markRect(used, n, cx0, cz0, 3, 3, 1);
    pads.push({ x: p.x, y: t.heights[vIndex(n, cx0, cz0)], z: p.z, cx: cx0, cz: cz0, size: 3 });
  }
}

/**
 * Decorative trees (trunk cell is solid). Each tree keeps its 8 neighbours
 * free, so a lone blocked cell can never cut the world in two.
 */
function placeTrees(ctx, rng) {
  const { t, n, used, blocked, size } = ctx;
  const want = TREE_COUNTS[size];
  const trees = [];
  for (let a = 0; a < want * 30 && trees.length < want; a++) {
    const cx = rng.int(2, n - 3);
    const cz = rng.int(2, n - 3);
    if (!rectFree(used, n, cx - 1, cz - 1, 3, 3) || !rectFree(blocked, n, cx - 1, cz - 1, 3, 3)) continue;
    if (cellRange(t, cx, cz) !== 0) continue;
    const p = cellCenter(t, cx, cz);
    trees.push({ x: p.x, y: cellMin(t, cx, cz), z: p.z, cx, cz, kind: rng.int(0, 2), height: rng.int(3, 5) });
    blocked[cx * n + cz] = 1;
    markRect(used, n, cx - 1, cz - 1, 3, 3);
  }
  return trees;
}
