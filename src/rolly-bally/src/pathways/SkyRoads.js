// Sky roads (pure: no rendering, no physics): the Pathways world since
// 2026-09-29. Roads float in the sky like Race tracks, walls on both sides
// the whole way, from a big start pad to an end pad. Along the way the road
// forks in two and joins again; both branches reach the end.
//
//   generateSkyRoads(config, {Layout}) → {
//     roads:     [{kind: 'trunk'|'branch', entries, options}]  piece lists for TrackLayout/Track
//     layouts:   [Layout]         one per road (Layout = TrackLayout, or Track in the mode)
//     junctions: [{kind: 'fork'|'merge', x, y, z, yaw}]  where two branches leave / join
//     stars:     [{x, y, z, road}]
//     spawn:     {x, y, z, dir}   road height at the middle of the start pad
//     end:       {road, s0, s1, position, forward, yaw, width}  the end pad
//     minY, maxY, forks
//   }
//
// Road network: trunk → fork pad → two mirrored branches → merge pad → trunk
// → ... → end pad. The branches are mirror images left/right (so they meet
// again exactly) but each picks its own ups and downs. The trunk's heading
// stays within ±45° of the start direction, so the network always moves
// forward and never crosses itself.
//
// Setup chips: size → number of forks and trunk length; bumpiness → how much
// the roads go up and down; stars → a star every 3 m (Everywhere) or 6 m
// (Medium) along every road.

import { Rng } from '../core/Rng.js';
import { normalizePathwaysConfig } from '../app/configs.js';
import { TrackLayout } from '../track/TrackLayout.js';
import { deg, rightXZ } from '../track/math.js';
import { STAR_HOVER } from '../playground/Stars.js';

export const ROAD_WIDTH = 7;
export const START_PAD = { width: 12, len: 12 };
export const END_PAD = { width: 12, len: 12 };
export const FORK_GAP = 3; // air between the two branches where they leave a fork pad
export const BRANCH_OFFSET = (ROAD_WIDTH + FORK_GAP) / 2; // branch center ± this from the trunk line
export const FORK_WIDTH = 2 * BRANCH_OFFSET + ROAD_WIDTH;
export const STAR_GAP = { everywhere: 3, medium: 6 };
export const SIZES = {
  small: { forks: 1, trunk: 2 },
  medium: { forks: 2, trunk: 3 },
  large: { forks: 3, trunk: 4 },
};
export const BUMPS = {
  flat: { rise: 0, chance: 0, maxY: 0 },
  hilly: { rise: 2, chance: 0.35, maxY: 6 },
  mountains: { rise: 4, chance: 0.55, maxY: 14 },
};
const MAX_HEADING = deg(45);
const BRANCH_TURN = 45; // degrees each branch bends out and back
const BRANCH_CURVE_LEN = 12;

const pad = (len, width, widthEnd = width, extra = {}) => ({ id: 'pad', len, width, widthEnd, ...extra });

/**
 * @param {object} config Pathways config ({size, theme, bumpiness, stars, seed})
 * @param {{Layout?: typeof TrackLayout}} [opts] Layout class (Track in the mode)
 */
export function generateSkyRoads(config, { Layout = TrackLayout } = {}) {
  const cfg = normalizePathwaysConfig(config);
  const rng = new Rng(`${cfg.seed}:sky`);
  const size = SIZES[cfg.size] || SIZES.medium;
  const bumps = BUMPS[cfg.bumpiness] || BUMPS.hilly;
  const state = { heading: 0, y: 0 };

  const roads = [];
  const layouts = [];
  const junctions = [];
  const addRoad = (kind, entries, start) => {
    const options = { width: ROAD_WIDTH, rails: 'full', start: { ...start } };
    const layout = new Layout(entries, options);
    roads.push({ kind, entries, options });
    layouts.push(layout);
    return layout;
  };

  // Start pad (a wall behind it, so nobody rolls off backwards), then a taper.
  let entries = [
    pad(START_PAD.len, START_PAD.width, START_PAD.width, { color: 'startPad', wallAt: 0.3 }),
    pad(5, START_PAD.width, ROAD_WIDTH),
    ...trunkPieces(rng, size.trunk, bumps, state),
  ];
  let start = { x: 0, y: 0, z: 0, yaw: 0 };

  for (let f = 0; f < size.forks; f++) {
    entries.push(pad(5, ROAD_WIDTH, FORK_WIDTH), pad(3, FORK_WIDTH));
    const trunk = addRoad('trunk', entries, start);
    const e = trunk.pieces[trunk.pieces.length - 1].exit;
    junctions.push({ kind: 'fork', x: e.x, y: e.y, z: e.z, yaw: e.yaw });

    // Both branches: same shape mirrored, same length middle, own hills.
    const out = rng.int(2, 6);
    const middle = rng.int(3, 5) * 6;
    const r = rightXZ(e.yaw);
    const ends = [];
    for (const side of [-1, 1]) {
      const pieces = branchPieces(side, out, middle, rng, bumps, state.y);
      const at = { x: e.x + r.x * side * BRANCH_OFFSET, y: e.y, z: e.z + r.z * side * BRANCH_OFFSET, yaw: e.yaw };
      const b = addRoad('branch', pieces, at);
      ends.push(b.pieces[b.pieces.length - 1].exit);
    }
    start = {
      x: (ends[0].x + ends[1].x) / 2,
      y: (ends[0].y + ends[1].y) / 2,
      z: (ends[0].z + ends[1].z) / 2,
      yaw: (ends[0].yaw + ends[1].yaw) / 2,
    };
    junctions.push({ kind: 'merge', ...start });
    entries = [pad(3, FORK_WIDTH), pad(5, FORK_WIDTH, ROAD_WIDTH), ...trunkPieces(rng, size.trunk, bumps, state)];
  }

  // End pad, with a wall at the far end.
  entries.push(pad(4, ROAD_WIDTH, END_PAD.width), pad(END_PAD.len, END_PAD.width, END_PAD.width, { color: 'endPad', wallAt: END_PAD.len - 0.3 }));
  const last = addRoad('trunk', entries, start);
  const endPiece = last.pieces[last.pieces.length - 1];
  const endMid = last.spline.sampleAt((endPiece.s0 + endPiece.s1) / 2);
  const end = {
    road: layouts.length - 1,
    s0: endPiece.s0,
    s1: endPiece.s1,
    position: { ...endMid.position },
    forward: { ...endMid.forward },
    yaw: endMid.yaw,
    width: END_PAD.width,
  };

  const first = layouts[0].spline.sampleAt(START_PAD.len / 2);
  const spawn = { x: first.position.x, y: first.position.y, z: first.position.z, dir: { ...first.forward } };

  let minY = Infinity;
  let maxY = -Infinity;
  for (const l of layouts) {
    for (const st of l.strips) {
      minY = Math.min(minY, st.a.y, st.b.y);
      maxY = Math.max(maxY, st.a.y, st.b.y);
    }
  }

  return {
    config: cfg,
    width: ROAD_WIDTH,
    roads,
    layouts,
    junctions,
    stars: placeStars(layouts, STAR_GAP[cfg.stars] || STAR_GAP.everywhere),
    spawn,
    end,
    minY,
    maxY,
    forks: size.forks,
  };
}

/** Trunk: straights, gentle curves (heading kept within ±45°) and ramps. */
function trunkPieces(rng, count, bumps, state) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const ramp = bumps.rise > 0 && rng.chance(bumps.chance);
    if (ramp) {
      const upOk = state.y + bumps.rise <= bumps.maxY;
      const downOk = state.y - bumps.rise >= 0;
      const up = upOk && (!downOk || rng.chance(0.55));
      if (up || downOk) {
        out.push({ id: up ? 'ramp-up' : 'ramp-down', rise: bumps.rise, len: rampLen(bumps.rise) });
        state.y += up ? bumps.rise : -bumps.rise;
        continue;
      }
    }
    const turns = [-1, 1].filter((d) => Math.abs(state.heading + d * MAX_HEADING) <= MAX_HEADING + 1e-9);
    if (turns.length && rng.chance(0.5)) {
      const d = rng.pick(turns);
      out.push(d > 0 ? 'curve-gentle-left' : 'curve-gentle-right');
      state.heading += d * MAX_HEADING;
    } else {
      out.push({ id: 'straight', len: rng.int(8, 14) });
    }
  }
  return out;
}

const rampLen = (rise) => (rise >= 4 ? 16 : 12);

/**
 * One branch: bend out to `side` (-1 left, +1 right), run, bend back, a
 * middle stretch (flat or a hill), then the mirror image back in. The shape
 * only depends on (out, middle), so both branches end side by side.
 */
function branchPieces(side, out, middle, rng, bumps, y) {
  const away = side < 0 ? 'curve-gentle-left' : 'curve-gentle-right';
  const back = side < 0 ? 'curve-gentle-right' : 'curve-gentle-left';
  const bend = (id) => ({ id, angle: BRANCH_TURN, len: BRANCH_CURVE_LEN });
  const mid = [];
  const hillUp = bumps.rise > 0 && rng.chance(0.6);
  const hillDown = !hillUp && bumps.rise > 0 && y - bumps.rise >= 0 && rng.chance(0.4);
  if (hillUp || hillDown) {
    const id1 = hillUp ? 'ramp-up' : 'ramp-down';
    const id2 = hillUp ? 'ramp-down' : 'ramp-up';
    mid.push({ id: id1, rise: bumps.rise, len: middle / 2 }, { id: id2, rise: bumps.rise, len: middle / 2 });
  } else {
    mid.push({ id: 'straight', len: middle });
  }
  return [
    bend(away),
    { id: 'straight', len: out },
    bend(back),
    ...mid,
    bend(back),
    { id: 'straight', len: out },
    bend(away),
  ];
}

/** Stars along every road (not on the pads), gently weaving side to side. */
function placeStars(layouts, gap) {
  const stars = [];
  layouts.forEach((l, road) => {
    for (let s = gap / 2; s < l.length; s += gap) {
      if (l.pieceAt(s).id === 'pad') continue;
      const f = l.spline.sampleAt(s);
      const lateral = Math.sin(s * 0.3 + road) * ROAD_WIDTH * 0.18;
      stars.push({
        x: f.position.x + f.right.x * lateral,
        y: f.position.y + STAR_HOVER,
        z: f.position.z + f.right.z * lateral,
        road,
      });
    }
  });
  return stars;
}

/**
 * Nearest road point to p over every road: {road, s, dist, lateral, height}.
 * (Full search; roads are short.)
 */
export function nearestRoad(layouts, p) {
  let best = null;
  layouts.forEach((l, road) => {
    const n = l.nearest(p);
    if (!best || n.dist < best.dist) best = { road, ...n };
  });
  return best;
}
