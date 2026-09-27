// Rolly Bally bots: track follower (solver), monkey, playground explorer and
// kid persona, driving window.__game in fixed steps (see HOOK_CONTRACT.md).
import { openGame, tick } from './session.js';
import { makeRng } from './rng.js';
import { RunRecorder, round } from '../metrics.js';

const finite = (...xs) => xs.every((v) => typeof v === 'number' && Number.isFinite(v));
const hyp = (x, z) => Math.hypot(x, z);

export function modeUrl(baseUrl, mode, { seed = 1, d = 1, stars = 'some' } = {}) {
  if (mode === 'test-track') return `${baseUrl}?mode=test-track&test=1`;
  if (mode === 'race') return `${baseUrl}?mode=race&seed=${seed}&d=${d}&n=1&test=1`;
  if (mode === 'playground') return `${baseUrl}?mode=playground&seed=${seed}&stars=${stars}&test=1`;
  throw new Error(`unknown Rolly Bally mode ${mode}`);
}

/** Track info for the current mode: race or test-track. */
const trackOf = (st) => st.race ?? st.testTrack ?? null;

/** Step through the race countdown until state 'racing'. */
async function waitRacing(page, maxSteps = 600) {
  let r = await tick(page, { x: 0, y: 0 }, 0);
  for (let n = 0; n < maxSteps && r.state.race && r.state.race.state !== 'racing'; n += 10) r = await tick(page, null, 10);
  return r.state;
}

async function openMode(browser, baseUrl, mode, opts) {
  const session = await openGame(browser, modeUrl(baseUrl, mode, opts));
  const { page } = session;
  let st = mode === 'race' ? await waitRacing(page) : (await tick(page, { x: 0, y: 0 }, 0)).state;
  await page.evaluate(() => window.__pb.resetCursor());
  st = (await tick(page, null, 0)).state;
  return { session, page, st };
}

/**
 * World direction (dx, dz) → the move vector {x, y} for the ball: y along the
 * mode's forward, x along its right (Ball.update: right = forward x up).
 */
export function moveFor(dx, dz, fwd, mag = 1) {
  const l = hyp(dx, dz) || 1;
  const ux = dx / l;
  const uz = dz / l;
  const fl = hyp(fwd.x, fwd.z) || 1;
  const fx = fwd.x / fl;
  const fz = fwd.z / fl;
  // right = (-fz, 0, fx)
  return { x: round((ux * -fz + uz * fx) * mag, 1000), y: round((ux * fx + uz * fz) * mag, 1000) };
}

/** First centreline point at least `look` metres from pos. */
function lookPoint(ahead, pos, look) {
  for (const p of ahead) if (hyp(p.x - pos.x, p.z - pos.z) >= look) return p;
  return ahead[ahead.length - 1];
}

/** How sharply the centreline turns over the next points (radians). */
function upcomingTurn(ahead) {
  if (ahead.length < 3) return 0;
  const a = Math.atan2(ahead[1].x - ahead[0].x, ahead[1].z - ahead[0].z);
  const b = Math.atan2(ahead[ahead.length - 1].x - ahead[1].x, ahead[ahead.length - 1].z - ahead[1].z);
  return Math.abs(((b - a + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
}

function trackBinOf(pos) {
  return `${Math.floor(pos.x)},${Math.floor(pos.z)}`;
}

function collectEvents(events, rec, extra, t0 = 0) {
  let won = false;
  for (const e of events) {
    if (e.type === 'fail') rec.fail(e.t - t0, e.reason ?? 'fall');
    if (e.type === 'win') { rec.win(e.t - t0); won = true; extra.place ??= e.place ?? null; }
    if (e.type === 'checkpoint') extra.checkpoints = (extra.checkpoints ?? 0) + 1;
    if (e.type === 'respawn') extra.respawns = (extra.respawns ?? 0) + 1;
  }
  return won;
}

// ---------------------------------------------------------------- solver: track follower

/**
 * Follows the centreline: aims at a point ahead (further when fast), and steers
 * by the difference between the wanted velocity and the actual one, so it
 * corrects drift and lateral offset; slows before sharp turns.
 */
export async function rollySolver({ browser, baseUrl, mode = 'test-track', seed = 1, d = 1, capS = 240 }) {
  const { session, page, st: st0 } = await openMode(browser, baseUrl, mode, { seed, d });
  let st = st0;
  const rec = new RunRecorder({ binOf: trackBinOf, cellOf: (p) => `${Math.floor(p.x / 4)},${Math.floor(p.z / 4)}` });
  const extra = {};
  const t0 = st.t;
  try {
    rec.sample(st.pos, 0);
    let won = false;
    let maxProgress = 0;
    while (st.t - t0 < capS && !won) {
      const tr = trackOf(st);
      let input = { x: 0, y: 0 };
      if (tr && st.pos && tr.ahead?.length) {
        const cap = st.testTrack?.feel?.speedCap ?? 8;
        const speed = hyp(st.vel.x, st.vel.z);
        const turn = upcomingTurn(tr.ahead);
        const vWant = cap * Math.max(0.55, 1 - turn * 0.5);
        const p = lookPoint(tr.ahead, st.pos, 3 + speed * 0.4);
        const dx = p.x - st.pos.x;
        const dz = p.z - st.pos.z;
        const l = hyp(dx, dz) || 1;
        // wanted velocity minus current velocity = steering push
        const sx = (dx / l) * vWant - st.vel.x;
        const sz = (dz / l) * vWant - st.vel.z;
        input = moveFor(sx, sz, tr.forward, Math.min(1, hyp(sx, sz) / 2));
        maxProgress = Math.max(maxProgress, tr.progress ?? 0);
      }
      const r = await tick(page, input, 2);
      st = r.state;
      if (st.pos) rec.sample(st.pos, st.t - t0, { teleported: r.events.some((e) => e.type === 'respawn') });
      won = collectEvents(r.events, rec, extra, t0) || st.won;
      if (won && !rec.wins.length) rec.win(st.t - t0);
    }
    const run = rec.finish(st.t - t0);
    const errors = session.errors();
    return {
      bot: 'solver', mode, seed: mode === 'race' ? seed : undefined, d: mode === 'race' ? d : undefined,
      ok: run.won && errors.length === 0,
      ...run, ...extra,
      progress: round(Math.max(maxProgress, trackOf(st)?.progress ?? 0), 1000),
      trackLength: trackOf(st)?.length ?? null,
      errors,
    };
  } finally {
    await session.close();
  }
}

// ---------------------------------------------------------------- monkey

const PROBE_DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];

export async function rollyMonkey({ browser, baseUrl, mode = 'test-track', seed = 1, seconds = 120, softLockS = 4, fallLimitS = 8 }) {
  const rng = makeRng(seed);
  const { session, page, st: st0 } = await openMode(browser, baseUrl, mode, { seed });
  let st = st0;
  const violations = [];
  const softLocks = [];
  const counts = { fail: 0, respawn: 0, win: 0, restores: 0, probes: 0, holds: 0 };
  const violate = (t, kind, detail) => { if (violations.length < 50) violations.push({ t: round(t), kind, ...detail }); };
  // "Below the world": lower than the lowest point of the level by 10 m
  const floorY = () => {
    const tr = trackOf(st);
    if (tr?.ahead?.length) return Math.min(...tr.ahead.map((p) => p.y)) - 10;
    if (st.playground) return st.playground.minH - 10;
    return -50;
  };
  let simT = 0;
  let belowSince = null;
  let anchor = null;
  try {
    while (simT < seconds) {
      const inp = rng.chance(0.15) ? { x: 0, y: 0 } : { x: rng.range(-1, 1), y: rng.range(-1, 1) };
      if (rng.chance(0.3)) inp.y = 1;
      counts.holds++;
      const ticks = Math.round((rng.range(0.2, 2) * 60) / 2);
      for (let i = 0; i < ticks && simT < seconds; i++) {
        const r = await tick(page, i === 0 ? inp : null, 2);
        const prevT = st.t;
        st = r.state;
        simT += Math.max(0, st.t - prevT);
        for (const e of r.events) {
          if (e.type === 'fail') counts.fail++;
          if (e.type === 'respawn') { counts.respawn++; belowSince = null; }
          if (e.type === 'win') counts.win++;
        }
        if (st.error) violate(simT, 'state-error', { error: st.error });
        if (!st.pos) { violate(simT, 'no-ball', {}); continue; }
        if (!finite(st.pos.x, st.pos.y, st.pos.z, st.vel.x, st.vel.y, st.vel.z)) violate(simT, 'non-finite', { pos: st.pos, vel: st.vel });
        if (st.pos.y < floorY()) {
          belowSince ??= simT;
          if (simT - belowSince > fallLimitS) {
            violate(simT, 'below-world', { pos: st.pos, seconds: round(simT - belowSince) });
            belowSince = null;
          }
        } else belowSince = null;
        // After a win (race results / finished track) start again
        if (st.won) {
          counts.restores++;
          await page.evaluate(() => window.__game.restore());
          if (mode === 'race') await waitRacing(page);
          await page.evaluate(() => window.__pb.resetCursor());
          st = (await tick(page, inp, 0)).state;
          anchor = null;
          break;
        }
        // Soft-lock: ball hasn't moved for softLockS with the stick pushed, not frozen/falling
        const pushing = hyp(inp.x, inp.y) > 0.5;
        if (!anchor || hyp(st.pos.x - anchor.x, st.pos.z - anchor.z) > 0.05 || !pushing || st.frozen || st.fell) {
          anchor = { x: st.pos.x, z: st.pos.z, t: simT };
        } else if (simT - anchor.t > softLockS) {
          counts.probes++;
          const from = { ...st.pos };
          let moved = false;
          for (const [x, y] of PROBE_DIRS) {
            const pr = await tick(page, { x, y }, 42);
            simT += 0.7;
            if (pr.state.pos && hyp(pr.state.pos.x - from.x, pr.state.pos.z - from.z) > 0.2) { moved = true; st = pr.state; break; }
          }
          if (!moved) softLocks.push({ t: round(simT), pos: from, mode });
          anchor = null;
          break;
        }
      }
    }
    const errors = session.errors();
    return {
      bot: 'monkey', mode, seed, seconds,
      ok: violations.length === 0 && softLocks.length === 0 && errors.length === 0,
      violations, softLocks, counts, errors,
      reproduce: `node bin/playbot.js play rolly-bally --bots monkey --seed ${seed}`,
    };
  } finally {
    await session.close();
  }
}

// ---------------------------------------------------------------- explorer (playground)

/**
 * Light Go-Explore on the playground terrain: archive of 4 m x 4 m bins the
 * ball has stood in, return (teleport) to one, roll randomly, add new bins.
 */
export async function rollyExplorer({ browser, baseUrl, seed = 1, iterations = 600, bin = 4 }) {
  const rng = makeRng(seed);
  const { session, page, st: st0 } = await openMode(browser, baseUrl, 'playground', { seed });
  let st = st0;
  const size = st.playground.size;
  const half = size / 2;
  const binOf = (p) => `${Math.floor((p.x + half) / bin)},${Math.floor((p.z + half) / bin)}`;
  const archive = new Map();
  const counts = { fail: 0, star: 0, simSeconds: 0 };
  const nBins = size / bin;
  const frontier = (pos) => {
    const [bi, bj] = binOf(pos).split(',').map(Number);
    let n = 0;
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        const i = bi + di;
        const j = bj + dj;
        if (i >= 0 && j >= 0 && i < nBins && j < nBins && !archive.has(`${i},${j}`)) n++;
      }
    }
    return n;
  };
  const add = (pos, it) => {
    const k = binOf(pos);
    if (!archive.has(k)) archive.set(k, { pos: { ...pos }, found: it, attempts: 0, left: 0, fails: 0 });
  };
  try {
    add(st.pos, 0);
    for (let it = 1; it <= iterations; it++) {
      // Favour rarely tried bins next to bins not reached yet (the frontier)
      const cells = [...archive.values()];
      const cell = rng.weighted(cells, cells.map((c) => (1 + 2 * frontier(c.pos)) / Math.sqrt(1 + c.attempts)));
      cell.attempts++;
      await page.evaluate((p) => window.__game.teleport(p), { x: cell.pos.x, y: cell.pos.y + 0.2, z: cell.pos.z });
      await page.evaluate(() => window.__pb.resetCursor());
      const home = binOf(cell.pos);
      let left = false;
      let failed = false;
      const holds = rng.int(2, 4);
      for (let h = 0; h < holds && !failed; h++) {
        // Roll in one random world direction (steering is camera-relative, so re-aim every tick)
        const a = rng.range(-Math.PI, Math.PI);
        const ticks = Math.round((rng.range(0.5, 1.5) * 60) / 3);
        for (let i = 0; i < ticks; i++) {
          const cf = st.playground?.camForward ?? { x: 0, z: -1 };
          const r = await tick(page, moveFor(Math.sin(a), Math.cos(a), cf), 3);
          st = r.state;
          counts.simSeconds += 0.05;
          if (r.events.some((e) => e.type === 'star')) counts.star++;
          if (r.events.some((e) => e.type === 'fail') || st.fell) { counts.fail++; cell.fails++; failed = true; break; }
          if (!st.pos) continue;
          if (binOf(st.pos) !== home) left = true;
          if (st.onGround) add(st.pos, it);
        }
      }
      if (left) cell.left++;
      if (failed) {
        // let the fade/respawn finish before the next teleport
        st = (await tick(page, { x: 0, y: 0 }, 90)).state;
      }
    }
    const total = (size / bin) ** 2;
    const stuckSpots = [...archive.entries()]
      .filter(([, c]) => c.attempts >= 5 && c.left / c.attempts < 0.2)
      .map(([k, c]) => ({ bin: k, attempts: c.attempts, left: c.left, fails: c.fails }));
    const errors = session.errors();
    return {
      bot: 'explorer', mode: 'playground', seed, iterations,
      ok: stuckSpots.length === 0 && errors.length === 0,
      terrain: { size, bin, bins: total },
      reached: archive.size,
      coverage: round(archive.size / total, 1000),
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
 * Kid on a track: aims at the centreline a few metres ahead of where it was
 * reaction_ms ago (reaction lag), with aim jitter (heading noise, resampled
 * every 0.4 s) and hold-duration jitter (the stick isn't always fully pushed).
 * No velocity damping: kids push toward where they want to go.
 */
export async function rollyKid({ browser, baseUrl, mode = 'race', persona: p, seed = 1, d = null, capS = 300 }) {
  const rng = makeRng(seed * 7919 + 17);
  d ??= p.race_level;
  const { session, page, st: st0 } = await openMode(browser, baseUrl, mode, { seed, d });
  let st = st0;
  const rec = new RunRecorder({ binOf: trackBinOf, cellOf: (q) => `${Math.floor(q.x / 4)},${Math.floor(q.z / 4)}`, stuckAfterS: p.stuck_s });
  const extra = {};
  const t0 = st.t;
  const hist = [];
  const lagTicks = Math.max(0, Math.round(p.reaction_ms / 1000 / (2 / 60)));
  let noise = 0;
  let noiseUntil = 0;
  let mag = 1;
  try {
    rec.sample(st.pos, 0);
    let won = false;
    while (st.t - t0 < capS && !won) {
      hist.push(st);
      if (hist.length > lagTicks + 1) hist.shift();
      const seen = hist[0]; // what the kid reacts to: the state reaction_ms ago
      const tr = trackOf(seen);
      const trNow = trackOf(st);
      let input = { x: 0, y: 0 };
      const t = st.t - t0;
      if (tr && seen.pos && trNow) {
        if (t >= noiseUntil) {
          noise = rng.gauss() * p.aim_jitter;
          mag = 1 - rng.range(0, p.hold_duration_jitter);
          noiseUntil = t + 0.4;
        }
        const q = lookPoint(tr.ahead, seen.pos, 5);
        const a = Math.atan2(q.x - seen.pos.x, q.z - seen.pos.z) + noise;
        input = moveFor(Math.sin(a), Math.cos(a), trNow.forward, mag);
      }
      const r = await tick(page, input, 2);
      st = r.state;
      if (st.pos) rec.sample(st.pos, st.t - t0, { teleported: r.events.some((e) => e.type === 'respawn') });
      won = collectEvents(r.events, rec, extra, t0) || st.won;
      if (won && !rec.wins.length) rec.win(st.t - t0);
    }
    const run = rec.finish(st.t - t0);
    return {
      bot: 'kid', bracket: p.bracket, mode, seed, d: mode === 'race' ? d : undefined, capS,
      ...run, ...extra,
      progress: round(trackOf(st)?.progress ?? 0, 1000),
      errors: session.errors(),
    };
  } finally {
    await session.close();
  }
}
