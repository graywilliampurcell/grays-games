// Pure maze geometry for the Mazle bots: parse a layout (levels.js format),
// path search over blocks, the corridor-cell graph, line of sight, and the
// Iteration 1 (12 x 12 random maze) layouts. No browser, no three.js.
//
// Layout: one string per row (z), one char per block (x): '#' wall, ' ' floor,
// 'S' start, 'X' spike, 'D' door (a wall block in the outer wall).
// Block (x, z) covers world [x, x+1) x [z, z+1); its centre is (x+0.5, z+0.5).

export const SPIKE_TOUCH = 1.0; // main.js SPIKE_TOUCH_DISTANCE
export const DOOR_TOUCH = 1.3; // main.js DOOR_TOUCH_DISTANCE
export const PLAYER_RADIUS = 0.4; // Player.radius

export function parseLayout(rows) {
  const h = rows.length;
  const w = rows[0].length;
  let start = null;
  let spike = null;
  let doorBlock = null;
  let floorCount = 0;
  for (let z = 0; z < h; z++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[z][x];
      if (ch === 'S') start = { x: x + 0.5, z: z + 0.5, bx: x, bz: z };
      if (ch === 'X') spike = { x: x + 0.5, z: z + 0.5, bx: x, bz: z };
      if (ch === 'D') doorBlock = { x, z };
      if (ch !== '#' && ch !== 'D') floorCount++;
    }
  }
  let door = null;
  if (doorBlock) {
    const { x, z } = doorBlock;
    // Same as Maze.createDoor: the door stands on the inside face of its wall block
    let face;
    let inside;
    if (x === w - 1) { face = { x, z: z + 0.5 }; inside = { x: x - 1, z }; }
    else if (x === 0) { face = { x: x + 1, z: z + 0.5 }; inside = { x: x + 1, z }; }
    else if (z === 0) { face = { x: x + 0.5, z: z + 1 }; inside = { x, z: z + 1 }; }
    else { face = { x: x + 0.5, z }; inside = { x, z: z - 1 }; }
    door = { block: doorBlock, face, inside };
  }
  const grid = {
    rows, w, h, start, spike, door, floorCount,
    isWall(x, z) {
      if (x < 0 || z < 0 || x >= w || z >= h) return true;
      const ch = rows[z][x];
      return ch === '#' || ch === 'D';
    },
    isFloor(x, z) { return !grid.isWall(x, z); },
  };
  return grid;
}

/** Same test as CollisionManager.isPositionValid (9 points at radius r). */
export function positionValid(grid, x, z, r = PLAYER_RADIUS) {
  for (const dx of [0, r, -r]) {
    for (const dz of [0, r, -r]) {
      if (grid.isWall(Math.floor(x + dx), Math.floor(z + dz))) return false;
    }
  }
  return true;
}

/** True if a circle of radius r can slide in a straight line from a to b. */
export function segmentClear(grid, a, b, r = PLAYER_RADIUS, stepLen = 0.1) {
  const d = Math.hypot(b.x - a.x, b.z - a.z);
  const n = Math.max(1, Math.ceil(d / stepLen));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (!positionValid(grid, a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, r)) return false;
  }
  return true;
}

/** Line of sight (eye height, walls are taller than the player): no wall block on the segment. */
export function lineOfSight(grid, a, b, stepLen = 0.1) {
  const d = Math.hypot(b.x - a.x, b.z - a.z);
  const n = Math.max(1, Math.ceil(d / stepLen));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (grid.isWall(Math.floor(a.x + (b.x - a.x) * t), Math.floor(a.z + (b.z - a.z) * t))) return false;
  }
  return true;
}

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Blocks within `dist` of point p (centre distance), used to keep the solver off the spike. */
function blocksNear(p, dist) {
  const out = new Set();
  if (!p) return out;
  const r = Math.ceil(dist) + 1;
  for (let x = Math.floor(p.x) - r; x <= Math.floor(p.x) + r; x++) {
    for (let z = Math.floor(p.z) - r; z <= Math.floor(p.z) + r; z++) {
      // closest point of the block to p
      const cx = Math.max(x, Math.min(p.x, x + 1));
      const cz = Math.max(z, Math.min(p.z, z + 1));
      if (Math.hypot(cx - p.x, cz - p.z) < dist) out.add(`${x},${z}`);
    }
  }
  return out;
}

/**
 * A* over floor blocks (4-connected). Blocks next to a wall cost extra so the
 * path keeps to corridor middles. `avoidSpike` blocks everything the player
 * could touch the spike from. Returns [{x,z}] block list (from..to) or null.
 */
export function findBlockPath(grid, from, to, { avoidSpike = true, wallPenalty = 2 } = {}) {
  const avoid = avoidSpike ? blocksNear(grid.spike, SPIKE_TOUCH + PLAYER_RADIUS + 0.2) : new Set();
  const key = (x, z) => z * grid.w + x;
  const nearWall = (x, z) => {
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (grid.isWall(x + dx, z + dz)) return true;
    return false;
  };
  const g = new Map([[key(from.x, from.z), 0]]);
  const prev = new Map();
  const h = (x, z) => Math.abs(x - to.x) + Math.abs(z - to.z);
  // Small binary heap
  const heap = [[h(from.x, from.z), from.x, from.z]];
  const push = (item) => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  const closed = new Set();
  while (heap.length) {
    const [, x, z] = pop();
    const k = key(x, z);
    if (closed.has(k)) continue;
    closed.add(k);
    if (x === to.x && z === to.z) {
      const path = [{ x, z }];
      for (let c = k; prev.has(c);) {
        c = prev.get(c);
        path.unshift({ x: c % grid.w, z: Math.floor(c / grid.w) });
      }
      return path;
    }
    for (const [dx, dz] of N4) {
      const nx = x + dx;
      const nz = z + dz;
      if (grid.isWall(nx, nz) || avoid.has(`${nx},${nz}`)) continue;
      const nk = key(nx, nz);
      const cost = g.get(k) + 1 + (nearWall(nx, nz) ? wallPenalty : 0);
      if (cost < (g.get(nk) ?? Infinity)) {
        g.set(nk, cost);
        prev.set(nk, k);
        push([cost + h(nx, nz), nx, nz]);
      }
    }
  }
  return null;
}

/** Plain BFS distances over floor blocks from a block (4-connected). Map key "x,z" -> steps. */
export function blockDistances(grid, from) {
  const dist = new Map([[`${from.x},${from.z}`, 0]]);
  const q = [from];
  while (q.length) {
    const c = q.shift();
    const d = dist.get(`${c.x},${c.z}`);
    for (const [dx, dz] of N4) {
      const n = { x: c.x + dx, z: c.z + dz };
      const k = `${n.x},${n.z}`;
      if (grid.isWall(n.x, n.z) || dist.has(k)) continue;
      dist.set(k, d + 1);
      q.push(n);
    }
  }
  return dist;
}

/**
 * Turn a block path into world waypoints: block centres, pulled tight where a
 * straight slide is clear (string pulling). Ends at `goal` if given.
 */
export function pathToWaypoints(grid, blocks, goal = null, r = PLAYER_RADIUS + 0.05) {
  const pts = blocks.map((b) => ({ x: b.x + 0.5, z: b.z + 0.5 }));
  if (goal) pts.push(goal);
  if (pts.length <= 2) return pts;
  const out = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && !segmentClear(grid, pts[i], pts[j], r)) j--;
    out.push(pts[j]);
    i = j;
  }
  return out;
}

export function polylineLength(pts) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
  return s;
}

// ---------------------------------------------------------------- corridor cells

/**
 * The corridor-cell graph of a layout made by mazeCarver.toLayout: cells of
 * `corridor` blocks with 1-block walls between them. Returns null when the
 * layout doesn't have that shape. links[i][j] = [{i,j}] (mazeCarver format).
 */
export function cellGraph(grid, corridor = 3) {
  const step = corridor + 1;
  if ((grid.w - 1) % step !== 0 || (grid.h - 1) % step !== 0) return null;
  const cols = (grid.w - 1) / step;
  const rows = (grid.h - 1) / step;
  const origin = (i, j) => ({ x: 1 + i * step, z: 1 + j * step });
  const links = [];
  for (let i = 0; i < cols; i++) {
    links[i] = [];
    for (let j = 0; j < rows; j++) {
      links[i][j] = [];
      const o = origin(i, j);
      for (let dx = 0; dx < corridor; dx++) {
        for (let dz = 0; dz < corridor; dz++) if (grid.isWall(o.x + dx, o.z + dz)) return null;
      }
    }
  }
  const mid = Math.floor(corridor / 2);
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const o = origin(i, j);
      if (i + 1 < cols && grid.isFloor(o.x + corridor, o.z + mid)) {
        links[i][j].push({ i: i + 1, j });
        links[i + 1][j].push({ i, j });
      }
      if (j + 1 < rows && grid.isFloor(o.x + mid, o.z + corridor)) {
        links[i][j].push({ i, j: j + 1 });
        links[i][j + 1].push({ i, j });
      }
    }
  }
  const cellOf = (x, z) => ({
    i: Math.max(0, Math.min(cols - 1, Math.floor((x - 1) / step))),
    j: Math.max(0, Math.min(rows - 1, Math.floor((z - 1) / step))),
  });
  const center = (c) => ({ x: 1 + c.i * step + corridor / 2, z: 1 + c.j * step + corridor / 2 });
  return { cols, rows, step, corridor, links, cellOf, center, key: (c) => `${c.i},${c.j}` };
}

/**
 * Facts about a layout: block-path optimum (world units, solver's A*), and the
 * corridor-cell numbers from mazeCarver.analyzeMaze (solution length in cells,
 * dead ends and their depth, max branch depth). `analyzeMaze` is passed in so
 * this module stays free of the game source.
 */
export function analyzeLayout(rows, analyzeMaze) {
  const grid = parseLayout(rows);
  const out = {
    size: { w: grid.w, h: grid.h },
    floorBlocks: grid.floorCount,
    hasStart: !!grid.start, hasSpike: !!grid.spike, hasDoor: !!grid.door,
  };
  if (grid.start && grid.door) {
    const blocks = findBlockPath(grid, { x: grid.start.bx, z: grid.start.bz }, grid.door.inside);
    out.solvable = !!blocks;
    if (blocks) {
      const wps = pathToWaypoints(grid, blocks, grid.door.face);
      // The door counts as reached DOOR_TOUCH short of its face
      out.optimalPathLength = round2(Math.max(0, polylineLength(wps) - DOOR_TOUCH));
      out.optimalBlocks = blocks.length;
    }
  }
  const cg = cellGraph(grid);
  if (cg && analyzeMaze && grid.start && grid.door) {
    const startCell = cg.cellOf(grid.start.x, grid.start.z);
    const exitCell = cg.cellOf(grid.door.inside.x + 0.5, grid.door.inside.z + 0.5);
    const a = analyzeMaze(cg.links, startCell, exitCell);
    let edges = 0;
    for (const col of cg.links) for (const l of col) edges += l.length;
    const spikeCell = grid.spike ? cg.cellOf(grid.spike.x, grid.spike.z) : null;
    const spikeDE = spikeCell && a.deadEnds.find((d) => d.i === spikeCell.i && d.j === spikeCell.j);
    const onPath = spikeCell && a.solution.some((c) => c.i === spikeCell.i && c.j === spikeCell.j);
    out.cells = {
      cols: cg.cols,
      rows: cg.rows,
      perfectMaze: edges / 2 === cg.cols * cg.rows - 1,
      solutionLength: a.solution.length,
      deadEnds: a.deadEnds.length,
      deadEndDepths: a.deadEnds.map((d) => d.depth),
      maxBranchDepth: a.maxBranchDepth,
      junctions: cg.links.flat().filter((l) => l.length >= 3).length,
      spike: spikeCell ? { cell: spikeCell, inDeadEnd: !!spikeDE, onSolution: !!onPath, fromStart: spikeDE?.fromStart ?? null } : null,
      startCell,
      exitCell,
    };
  }
  return out;
}

const round2 = (v) => Math.round(v * 100) / 100;

// ---------------------------------------------------------------- Iteration 1

/**
 * Iteration 1 of Mazle Level 1 (Mazle plan build log, 2026-09-26): a new
 * random 12 x 12 corridor maze each load, corridors about 3 blocks wide,
 * "about 25 dead ends", start on the west edge facing in, door on the east
 * edge, the spike at the end of a dead end 3-6 cells from the start and never
 * on the correct path. The original generator was never committed; this
 * rebuilds it with mazeCarver.js (growing tree, newestBias 0.75 = its default,
 * which gives 25.5 dead ends on average for 12 x 12) the same way
 * tools/find-level.mjs picks start/exit/spike.
 * Seeds that have no dead end 3-6 cells from the start are skipped.
 */
export function iteration1Layout(carver, seed, { cols = 12, rows = 12, corridor = 3, newestBias = 0.75 } = {}) {
  const random = carver.mulberry32(seed);
  const links = carver.carveMaze(cols, rows, random, newestBias);
  const startCell = { i: 0, j: Math.floor(random() * rows) };
  const exitCell = { i: cols - 1, j: Math.floor(random() * rows) };
  const { solution, deadEnds, maxBranchDepth } = carver.analyzeMaze(links, startCell, exitCell);
  const spikeCell = deadEnds.find((d) => d.fromStart >= 3 && d.fromStart <= 6);
  if (!spikeCell) return null;
  const layout = carver.toLayout(links, { corridor, startCell, exitCell, spikeCell });
  return { seed, layout, solutionLength: solution.length, deadEnds: deadEnds.length, maxBranchDepth };
}

/** The first `count` Iteration 1 layouts starting at seed `from`. */
export function iteration1Layouts(carver, count = 5, from = 1) {
  const out = [];
  for (let seed = from; out.length < count && seed < from + 10000; seed++) {
    const l = iteration1Layout(carver, seed);
    if (l) out.push(l);
  }
  return out;
}
