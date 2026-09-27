// Mazle bots: solver, monkey, explorer and kid persona, all driving
// window.__game through fixed steps (see HOOK_CONTRACT.md).
import { openGame, tick } from './session.js';
import { makeRng } from './rng.js';
import {
  parseLayout, cellGraph, findBlockPath, pathToWaypoints, segmentClear, lineOfSight, positionValid,
  polylineLength, blockDistances, DOOR_TOUCH, SPIKE_TOUCH, PLAYER_RADIUS,
} from './mazeGrid.js';
import { RunRecorder, round } from '../metrics.js';

const TURN_SPEED = 2.5; // testHooks.js turnLeft/turnRight rad/s
const TAU = Math.PI * 2;

export const wrap = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
/** Yaw that faces direction (dx, dz): yaw 0 faces -z, -PI/2 faces +x. */
export const yawTo = (dx, dz) => Math.atan2(-dx, -dz);
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const blockKey = (p) => `${Math.floor(p.x)},${Math.floor(p.z)}`;
const finite = (...xs) => xs.every((v) => typeof v === 'number' && Number.isFinite(v));

/**
 * Open Mazle, optionally with a custom layout ({ name, rows }), clear events.
 * Returns { session, page, grid, layout }.
 */
export async function openMazle(browser, baseUrl, layout = null, opts = {}) {
  const session = await openGame(browser, `${baseUrl}?test=1`, opts);
  const { page } = session;
  let rows;
  if (layout) {
    await page.evaluate(([r, n]) => window.__game.loadLayout(r, n), [layout.rows, layout.name]);
    rows = layout.rows;
  } else {
    rows = await page.evaluate(() => window.__game.state().grid);
  }
  await page.evaluate(() => { window.__game.clearEvents(); window.__pb.resetCursor(); });
  const grid = parseLayout(rows);
  return { session, page, grid, rows };
}

/** Wall bump: moving input held on both ticks and speed fell by more than half. */
function makeBumpDetector(minGapS = 0.5) {
  let prev = null;
  let lastBump = -Infinity;
  return (st, moving) => {
    const v = Math.hypot(st.vel.x, st.vel.z);
    let bump = false;
    if (prev && prev.moving && moving && prev.v > 2 && v < prev.v * 0.5 && st.t - lastBump > minGapS) {
      bump = true;
      lastBump = st.t;
    }
    prev = { v, moving };
    return bump;
  };
}

function heldMoving(inp) {
  if (!inp) return false;
  const f = (inp.forward ? 1 : 0) - (inp.back ? 1 : 0);
  const s = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  const j = inp.joystick ? Math.hypot(inp.joystick.x || 0, inp.joystick.y || 0) : 0;
  return f !== 0 || s !== 0 || j > 0.2;
}

// ---------------------------------------------------------------- solver

/**
 * Solver: A* over the layout's blocks (start → door, keeping away from the
 * spike), waypoints pulled tight, followed closed-loop with turnLeft/turnRight
 * + forward. Returns the run with the optimal length and the path it took.
 */
export async function mazleSolver({ browser, baseUrl, layout = null, capS = 120 }) {
  const { session, page, grid } = await openMazle(browser, baseUrl, layout);
  try {
    const start = { x: grid.start.bx, z: grid.start.bz };
    const blocks = findBlockPath(grid, start, grid.door.inside);
    if (!blocks) return { bot: 'solver', ok: false, error: 'no path from start to door' };
    const wps = pathToWaypoints(grid, blocks, grid.door.face);
    const optimalLength = Math.max(0, polylineLength(wps) - DOOR_TOUCH);
    const rec = new RunRecorder({ binOf: blockKey });
    const bump = makeBumpDetector();
    let k = 1;
    let input = {};
    let st = (await tick(page, {}, 0)).state;
    rec.sample(st.pos, st.t);
    while (st.t < capS) {
      const pos = st.pos;
      // Next waypoint: skip ones we're at, and any we can already slide to directly
      while (k < wps.length - 1 && (dist(pos, wps[k]) < 0.5 || segmentClear(grid, pos, wps[k + 1], 0.45))) k++;
      const wp = wps[k];
      const err = wrap(yawTo(wp.x - pos.x, wp.z - pos.z) - st.yaw);
      const turnStep = (TURN_SPEED / 60) * 0.6;
      input = { forward: Math.abs(err) < 0.35, turnLeft: err > turnStep, turnRight: err < -turnStep };
      const r = await tick(page, input, 1);
      st = r.state;
      rec.sample(st.pos, st.t);
      if (bump(st, heldMoving(input))) rec.bump();
      let done = false;
      for (const e of r.events) {
        if (e.type === 'spike') rec.fail(e.t, 'spike');
        if (e.type === 'escape') { rec.win(e.t); done = true; }
      }
      if (done) break;
    }
    const run = rec.finish(st.t);
    return {
      bot: 'solver',
      ok: run.won && run.fails === 0,
      ...run,
      optimalLength: round(optimalLength),
      pathVsOptimal: run.won ? round(run.pathLength / optimalLength) : null,
      waypoints: wps.map((p) => ({ x: round(p.x), z: round(p.z) })),
      errors: session.errors(),
    };
  } finally {
    await session.close();
  }
}

// ---------------------------------------------------------------- monkey

const MONKEY_DIRS = [
  { forward: true }, { back: true }, { left: true }, { right: true },
  { joystick: { x: 0.7, y: -0.7 } }, { joystick: { x: -0.7, y: -0.7 } },
  { joystick: { x: 0.7, y: 0.7 } }, { joystick: { x: -0.7, y: 0.7 } },
];

/**
 * Monkey: random held inputs (keys, turn, joystick, mouse look) for `seconds`
 * of simulated time, checking invariants after every step.
 */
export async function mazleMonkey({ browser, baseUrl, layout = null, seed = 1, seconds = 120, softLockS = 3 }) {
  const rng = makeRng(seed);
  const { session, page, grid } = await openMazle(browser, baseUrl, layout);
  const violations = [];
  const softLocks = [];
  const counts = { spike: 0, escape: 0, holds: 0, probes: 0 };
  const visited = new Set();
  const violate = (t, kind, detail) => { if (violations.length < 50) violations.push({ t: round(t), kind, ...detail }); };
  try {
    let st = (await tick(page, {}, 0)).state;
    let simT = 0; // total simulated time across restores
    let anchor = { x: st.pos.x, z: st.pos.z, t: 0 };
    const randomInput = () => {
      const inp = {};
      if (rng.chance(0.6)) {
        for (const k of ['forward', 'back', 'left', 'right']) if (rng.chance(0.3)) inp[k] = true;
      } else {
        inp.joystick = { x: rng.range(-1, 1), y: rng.range(-1, 1) };
      }
      const turn = rng.next();
      if (turn < 0.25) inp.turnLeft = true;
      else if (turn < 0.5) inp.turnRight = true;
      if (rng.chance(0.15)) inp.lookDx = rng.range(-8, 8);
      if (rng.chance(0.1)) inp.lookDy = rng.range(-4, 4);
      return inp;
    };
    const check = (s, inp, t) => {
      const { pos, vel } = s;
      if (!finite(pos.x, pos.y, pos.z, vel.x, vel.y, vel.z, s.yaw, s.pitch)) return violate(t, 'non-finite', { pos, vel, yaw: s.yaw });
      if (pos.x < 0 || pos.z < 0 || pos.x >= grid.w || pos.z >= grid.h) violate(t, 'out-of-bounds', { pos });
      else if (grid.isWall(Math.floor(pos.x), Math.floor(pos.z))) violate(t, 'inside-wall', { pos, block: blockKey(pos) });
      else if (!positionValid(grid, pos.x, pos.z, 0.39)) violate(t, 'overlapping-wall', { pos });
      if (Math.abs(s.pitch) > Math.PI / 2 + 1e-6) violate(t, 'pitch-out-of-range', { pitch: s.pitch });
      visited.add(blockKey(pos));
    };
    while (simT < seconds) {
      const inp = randomInput();
      counts.holds++;
      const holdSteps = Math.round(rng.range(0.2, 2) * 60);
      for (let i = 0; i < holdSteps && simT < seconds; i++) {
        const prevT = st.t;
        const r = await tick(page, i === 0 ? inp : null, 1);
        st = r.state;
        simT += Math.max(0, st.t - prevT);
        check(st, inp, simT);
        for (const e of r.events) {
          if (e.type === 'spike') counts.spike++;
          if (e.type === 'escape') counts.escape++;
        }
        if (st.escaped) {
          st = await page.evaluate(() => window.__game.restore());
          anchor = { x: st.pos.x, z: st.pos.z, t: simT };
          break;
        }
        // Soft-lock watch: not moved for softLockS while a move input is held
        if (dist(st.pos, anchor) > 0.05 || !heldMoving(inp) || st.frozen) {
          anchor = { x: st.pos.x, z: st.pos.z, t: simT };
        } else if (simT - anchor.t > softLockS) {
          counts.probes++;
          const from = { x: st.pos.x, z: st.pos.z };
          let escaped = false;
          for (const d of MONKEY_DIRS) {
            const pr = await tick(page, d, 30);
            simT += 0.5;
            if (dist(pr.state.pos, from) > 0.2) { escaped = true; st = pr.state; break; }
          }
          if (!escaped) {
            softLocks.push({ t: round(simT), pos: from, block: blockKey(from) });
            st = await page.evaluate(() => window.__game.restore());
          }
          anchor = { x: st.pos.x, z: st.pos.z, t: simT };
          break;
        }
      }
    }
    const errors = session.errors();
    return {
      bot: 'monkey',
      seed,
      seconds,
      ok: violations.length === 0 && softLocks.length === 0 && errors.length === 0,
      violations,
      softLocks,
      counts,
      blocksVisited: visited.size,
      coverage: round(visited.size / grid.floorCount, 1000),
      errors,
      reproduce: `node bin/playbot.js play mazle --bots monkey --seed ${seed}`,
    };
  } finally {
    await session.close();
  }
}

// ---------------------------------------------------------------- explorer

/**
 * Explorer (light Go-Explore): an archive of reached floor blocks; repeatedly
 * return (teleport) to an archived block, chosen favouring rarely-tried ones,
 * then explore with random held inputs, adding newly reached blocks. Reports
 * coverage, floor blocks never reached, and blocks it kept failing to leave.
 */
export async function mazleExplorer({ browser, baseUrl, layout = null, seed = 1, iterations = null, stepsPerTick = 3 }) {
  const rng = makeRng(seed);
  const { session, page, grid } = await openMazle(browser, baseUrl, layout);
  iterations ??= Math.ceil(grid.floorCount * 1.5); // ~900 for Level 1, ~2600 for a 12 x 12 maze
  const archive = new Map();
  const add = (pos, it) => {
    const k = blockKey(pos);
    if (!archive.has(k)) archive.set(k, { pos: { x: pos.x, z: pos.z }, found: it, attempts: 0, left: 0, spikes: 0 });
    return archive.get(k);
  };
  const counts = { spike: 0, escape: 0, simSeconds: 0 };
  const coverageCurve = [];
  // Unreached floor blocks within 2 blocks of an archived block
  const frontier = (c) => {
    const bx = Math.floor(c.pos.x);
    const bz = Math.floor(c.pos.z);
    let n = 0;
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) if (grid.isFloor(bx + dx, bz + dz) && !archive.has(`${bx + dx},${bz + dz}`)) n++;
    }
    return n;
  };
  try {
    let st = (await tick(page, {}, 0)).state;
    add(st.pos, 0);
    for (let it = 1; it <= iterations; it++) {
      // Choose a cell: favour rarely tried ones next to floor not reached yet (the frontier)
      const cells = [...archive.values()];
      const cell = rng.weighted(cells, cells.map((c) => (1 + 4 * frontier(c)) / Math.sqrt(1 + c.attempts)));
      cell.attempts++;
      if (st.escaped || st.frozen) st = await page.evaluate(() => window.__game.restore());
      st = await page.evaluate((p) => window.__game.teleport(p), { x: cell.pos.x, z: cell.pos.z, yaw: rng.range(-Math.PI, Math.PI) });
      await page.evaluate(() => window.__pb.resetCursor());
      const home = blockKey(cell.pos);
      let left = false;
      let ended = false;
      const holds = rng.int(2, 4);
      for (let h = 0; h < holds && !ended; h++) {
        const inp = { forward: rng.chance(0.7), back: rng.chance(0.1), left: rng.chance(0.2), right: rng.chance(0.2) };
        const turn = rng.next();
        if (turn < 0.35) inp.turnLeft = true;
        else if (turn < 0.7) inp.turnRight = true;
        const ticks = Math.max(1, Math.round((rng.range(0.3, 1.2) * 60) / stepsPerTick));
        for (let i = 0; i < ticks; i++) {
          const r = await tick(page, i === 0 ? inp : null, stepsPerTick);
          st = r.state;
          counts.simSeconds += stepsPerTick / 60;
          if (r.events.some((e) => e.type === 'spike')) { counts.spike++; cell.spikes++; ended = true; break; }
          if (blockKey(st.pos) !== home) left = true;
          add(st.pos, it);
          if (r.events.some((e) => e.type === 'escape')) { counts.escape++; ended = true; break; }
        }
      }
      if (left) cell.left++;
      if (it % 50 === 0) coverageCurve.push({ it, blocks: archive.size });
    }
    // Floor blocks the explorer never reached, split into "can't be reached by
    // walking at all" (not connected to the start) and "connected but never reached".
    const connected = blockDistances(grid, { x: grid.start.bx, z: grid.start.bz });
    const neverReached = [];
    const disconnected = [];
    for (let z = 0; z < grid.h; z++) {
      for (let x = 0; x < grid.w; x++) {
        if (!grid.isFloor(x, z) || archive.has(`${x},${z}`)) continue;
        const near = grid.spike && Math.hypot(x + 0.5 - grid.spike.x, z + 0.5 - grid.spike.z) < SPIKE_TOUCH + 0.75;
        const atDoor = grid.door && Math.hypot(x + 0.5 - grid.door.face.x, z + 0.5 - grid.door.face.z) < DOOR_TOUCH + 0.5;
        const why = near ? 'spike (touching it resets you)' : atDoor ? 'door (reaching it ends the level)' : undefined;
        const entry = { x, z, why };
        if (connected.has(`${x},${z}`)) neverReached.push(entry);
        else disconnected.push(entry);
      }
    }
    const stuckSpots = [...archive.entries()]
      .filter(([, c]) => c.attempts >= 5 && c.left / c.attempts < 0.2)
      .map(([k, c]) => ({ block: k, attempts: c.attempts, left: c.left }));
    const unexplained = neverReached.filter((b) => !b.why);
    const errors = session.errors();
    return {
      bot: 'explorer',
      seed,
      iterations,
      ok: unexplained.length === 0 && disconnected.length === 0 && stuckSpots.length === 0 && errors.length === 0,
      floorBlocks: grid.floorCount,
      reached: archive.size,
      coverage: round(archive.size / grid.floorCount, 1000),
      coverageCurve,
      unreachedFloorCount: neverReached.length,
      unreachedFloor: neverReached.slice(0, 40),
      disconnectedFloorCount: disconnected.length,
      disconnectedFloor: disconnected.slice(0, 40),
      stuckSpots,
      counts: { ...counts, simSeconds: round(counts.simSeconds) },
      dwell: Object.fromEntries([...archive.entries()].map(([k, c]) => [k, c.attempts])),
      errors,
    };
  } finally {
    await session.close();
  }
}

// ---------------------------------------------------------------- kid persona

/**
 * A kid with no map knowledge. Walks corridor cell to corridor cell with the
 * turn keys + forward (like mouse/touch look), keeps going along corridors,
 * picks a branch at junctions (preferring ones it remembers not trying, with
 * memory that fades by age), turns back at dead ends, and walks to the door
 * once it can see it. Clumsiness from rubric.yaml: reaction delay before each
 * new decision takes effect, open-loop turn bursts with hold-duration jitter,
 * aim jitter, wrong turns (ignoring memory), and giving up after
 * give_up_after_s without reaching any new cell.
 */
export async function mazleKid({ browser, baseUrl, layout = null, persona: p, seed = 1, capS = null, stepsPerTick = 3, trace = null }) {
  const rng = makeRng(seed);
  capS ??= p.session_minutes[1] * 60;
  const { session, page, grid } = await openMazle(browser, baseUrl, layout);
  const cg = cellGraph(grid);
  if (!cg) {
    await session.close();
    throw new Error('kid persona needs a corridor-cell layout (mazeCarver.toLayout shape)');
  }
  const ck = cg.key;
  const cellAt = (pos) => cg.cellOf(pos.x, pos.z);
  const same = (a, b) => a && b && a.i === b.i && a.j === b.j;
  const reaction = p.reaction_ms / 1000;
  const hint = hintSeconds(p);
  const rec = new RunRecorder({ binOf: blockKey, cellOf: (pos) => ck(cellAt(pos)), stuckAfterS: hint });
  const bump = makeBumpDetector();
  const memory = new Map(); // cell key -> forget time
  const spikeCell = grid.spike ? cellAt(grid.spike) : null;
  const decisions = { junctions: 0, wrongTurns: 0, deadEnds: 0, backtracks: 0, spikeAvoided: 0, doorSeen: 0 };

  const remember = (c, t) => { if (rng.chance(p.memory_prob)) memory.set(ck(c), t + p.memory_s); };
  const remembered = (c, t) => (memory.get(ck(c)) ?? -1) > t;

  // Navigation state
  let from = null; // cell we came from
  let approach = cellAt(grid.start); // cell we're heading to
  let target = null; // { x, z } we're steering to
  let targetIsDoor = false;
  let decidedFor = null; // key of the approach cell we already decided the next move for
  let pending = null; // { at, apply() }
  let aimOffset = { x: 0, z: 0 };
  let noise = 0;
  let noiseUntil = 0;
  // Motor state
  let burst = null; // { until, dir, forward }
  let settleUntil = 0;
  let input = {};
  let quit = false;
  let lastHere = null;
  let blockedSince = null; // pushing forward without moving since this time

  const setTarget = (pt, isDoor = false) => {
    target = pt;
    targetIsDoor = isDoor;
    const j = p.aim_jitter * 1.5; // up to +-(aim_jitter * half a corridor)
    aimOffset = isDoor ? { x: 0, z: 0 } : { x: rng.range(-j, j), z: rng.range(-j, j) };
  };

  const chooseNext = (at, t) => {
    const links = cg.links[at.i][at.j];
    let options = links.filter((c) => !same(c, from));
    if (spikeCell && options.some((c) => same(c, spikeCell)) && rng.chance(p.spike_avoid)) {
      options = options.filter((c) => !same(c, spikeCell));
      decisions.spikeAvoided++;
    }
    if (options.length === 0) {
      decisions.deadEnds++;
      return from ?? links[0];
    }
    if (options.length === 1) return options[0];
    decisions.junctions++;
    const dirIn = from ? { di: at.i - from.i, dj: at.j - from.j } : null;
    const w = (c) => (dirIn && c.i - at.i === dirIn.di && c.j - at.j === dirIn.dj ? p.straight_bias : 1);
    if (rng.chance(p.wrong_turn_prob)) {
      decisions.wrongTurns++;
      return rng.pick(options);
    }
    const fresh = options.filter((c) => !remembered(c, t));
    if (fresh.length) return rng.weighted(fresh, fresh.map(w));
    if (from && rng.chance(p.memory_prob)) {
      decisions.backtracks++;
      return from;
    }
    return rng.weighted(options, options.map(w));
  };

  const doorVisible = (pos) => dist(pos, grid.door.face) < 24 && lineOfSight(grid, pos, grid.door.face);

  let st = (await tick(page, {}, 0)).state;
  rec.sample(st.pos, st.t);
  remember(approach, 0);
  // At the start the kid looks around first (one reaction time), then heads for the start cell's centre
  pending = { at: reaction, apply: () => setTarget(cg.center(approach)) };
  let escaped = false;

  while (st.t < capS && !escaped && !quit) {
    const t = st.t;
    const pos = st.pos;

    // --- perception / navigation
    // The kid sees where it actually is: if it overshot into some other cell, it carries on from there
    const here = cellAt(pos);
    if (target && !targetIsDoor && !same(here, approach) && !same(here, from)) {
      if (lastHere) remember(lastHere, t);
      from = lastHere && cg.links[here.i][here.j].some((c) => same(c, lastHere)) ? lastHere : null;
      approach = here;
      decidedFor = null;
      if (!(pending && pending.door)) pending = null;
      setTarget(cg.center(here));
    }
    lastHere = here;
    if (!targetIsDoor && doorVisible(pos) && !(pending && pending.door)) {
      decisions.doorSeen++;
      pending = { at: t + reaction, door: true, apply: () => setTarget(grid.door.face, true) };
    } else if (target && !targetIsDoor && !pending && decidedFor !== ck(approach)
      && dist(pos, cg.center(approach)) < Math.max(1.5, 1 + Math.hypot(st.vel.x, st.vel.z) * reaction)) {
      // The kid sees the cell it's walking into and decides what to do there; the new heading takes
      // effect a reaction time later (about when it gets there at its current speed)
      decidedFor = ck(approach);
      const at = approach;
      const next = chooseNext(at, t);
      pending = {
        at: t + reaction,
        cell: at, // only acted on once the kid is actually in that cell
        apply: (now) => {
          remember(at, now);
          from = at;
          approach = next;
          setTarget(cg.center(next));
        },
      };
    }
    if (pending && t >= pending.at && (!pending.cell || same(here, pending.cell))) {
      const pnd = pending;
      pending = null;
      pnd.apply(t);
    }

    // --- motor
    const prevInput = input;
    input = {};
    if (target) {
      if (t >= noiseUntil) {
        noise = rng.gauss() * p.aim_jitter * 0.5;
        noiseUntil = t + 0.5;
      }
      let aim = { x: target.x + aimOffset.x, z: target.z + aimOffset.z };
      // Heading for the door: walk straight at it when the way is clear, else to the floor in front of it first
      if (targetIsDoor && !segmentClear(grid, pos, grid.door.face, PLAYER_RADIUS)) aim = { x: grid.door.inside.x + 0.5, z: grid.door.inside.z + 0.5 };
      const err = wrap(yawTo(aim.x - pos.x, aim.z - pos.z) - st.yaw + noise);
      const speed = Math.hypot(st.vel.x, st.vel.z);
      blockedSince = prevInput.forward && speed < 0.3 && burst?.kind !== 'wiggle' ? (blockedSince ?? t) : null;
      if (blockedSince !== null && t - blockedSince > 0.8 + reaction) {
        // Walked into a wall and noticed: back off and turn a bit (like a kid wiggling free)
        blockedSince = null;
        const dur = rng.range(0.3, 0.8);
        burst = { kind: 'wiggle', until: t + dur, dir: rng.chance(0.5) ? 'turnLeft' : 'turnRight', forward: false, back: true };
        settleUntil = burst.until + 0.1;
      }
      if (burst && t < burst.until) {
        input = { forward: burst.forward, [burst.dir]: true, ...(burst.back ? { back: true } : {}) };
      } else {
        burst = null;
        const tol = 0.2 + p.aim_jitter;
        if (Math.abs(err) > tol && t >= settleUntil) {
          const dur = (Math.abs(err) / TURN_SPEED) * (1 + rng.range(-p.hold_duration_jitter, p.hold_duration_jitter));
          burst = { until: t + Math.max(dur, 1 / 60), dir: err > 0 ? 'turnLeft' : 'turnRight', forward: Math.abs(err) < 1.0 };
          settleUntil = burst.until + 0.15 + reaction * 0.25;
          input = { forward: burst.forward, [burst.dir]: true };
        } else {
          input = { forward: true };
        }
      }
    }

    if (trace && Math.round(t * 20) % 10 === 0) trace.push({ t: round(t), x: round(pos.x), z: round(pos.z), yaw: round(st.yaw), target, approach: ck(approach), from: from && ck(from), input: Object.keys(input).join('+'), pending: !!pending });
    const r = await tick(page, input, stepsPerTick);
    st = r.state;
    rec.sample(st.pos, st.t);
    if (bump(st, heldMoving(input))) rec.bump();
    for (const e of r.events) {
      if (e.type === 'spike') {
        rec.fail(e.t, 'spike');
        // Back at the start: look around again, then carry on from the start cell
        from = null;
        approach = cellAt(grid.start);
        target = null;
        targetIsDoor = false;
        decidedFor = null;
        burst = null;
        pending = { at: st.t + reaction, apply: () => setTarget(cg.center(approach)) };
      }
      if (e.type === 'escape') {
        rec.win(e.t);
        escaped = true;
      }
    }
    if (!escaped && st.t - rec.lastProgressT > p.give_up_after_s) quit = true;
  }
  const run = rec.finish(st.t);
  const errors = session.errors();
  await session.close();
  return {
    bot: 'kid',
    bracket: p.bracket,
    seed,
    capS,
    quit,
    quitAt: quit ? round(st.t) : null,
    quitCell: quit ? ck(cellAt(st.pos)) : null,
    ...run,
    decisions,
    errors,
  };
}

/** Seconds without progress that count as "stuck": the bracket's hint time (rubric), else 60. */
export function hintSeconds(p) {
  return p.stuck_s ?? 60;
}
