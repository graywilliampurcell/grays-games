// TrackGenerator: difficulty rules → a seeded piece list (plan §3.4–3.6).
// Pure (no three.js, no physics), so it's fully testable.
//
//   const gen = generateTrack({ difficulty: 3, seed: '🍎🐶🚀⚽/race1' });
//   gen.pieces   ['start', {id:'straight', len: 8}, ..., 'finish']
//   gen.options  {width, rails, hazardSpeed}   → buildTrack({pieces, options})
//   gen.layout   the pure TrackLayout (spline, checkpoints, zones...)
//
// Rules (checked again by checkTrackRules, used by the tests):
//   - pieces come from the level's weighted allow-list (race/difficulty.js)
//   - at most `maxChallengeRun` hazards/gaps back to back (≤ 3: never two in a row)
//   - a checkpoint gate right before every gap (and moving platform)
//   - a launch ramp always has a boost pad right before it (after its checkpoint)
//   - checkpoint gates at least every ~20 m
//   - heading stays within ±90° of the start and the track never overlaps itself
//   - finish line at the level's track length (± a few m)
//   - the AI path is continuous and stays on the road (validateLayout)
// A candidate that fails validation is regenerated from a derived seed.

import { Rng } from '../core/Rng.js';
import { getPiece } from './Catalog.js';
import { TrackLayout } from './TrackLayout.js';
import { deg } from './math.js';
import { getDifficulty, RACE_TUNING } from '../race/difficulty.js';

const LEAD_IN = 8; // m of straight after the start pad
const FINISH_LINE_S = 4; // finish line position inside the finish piece
const MIN_FINAL = 6; // min straight before the finish piece
const MAX_FINAL = 16; // longer than this: add more pieces instead
const MAX_HEADING = deg(90); // |heading| relative to the start
const MAX_HEIGHT = 6; // |height| relative to the start
const MAX_ATTEMPTS = 25;

/** Kinds that don't break up a run of challenges (and don't count as one). */
const NEUTRAL = new Set(['checkpoint', 'boost']);

export function isChallenge(id) {
  const p = getPiece(id);
  return !!(p.hazard || p.gap);
}

const entryId = (e) => (typeof e === 'string' ? e : e.id);

// ------------------------------------------------------------ piece metrics

const _lenCache = new Map();

/** Exact arc length of one piece entry (m), from the pure layout. */
export function pieceLength(entry, options) {
  const key = `${JSON.stringify(entry)}|${options.width}`;
  let v = _lenCache.get(key);
  if (v === undefined) {
    v = new TrackLayout([entry], options).length;
    _lenCache.set(key, v);
  }
  return v;
}

/** Heading change (rad, + = left) and height change of an entry. */
function pieceDelta(entry, options) {
  const def = getPiece(entryId(entry)).build({ ...options, ...(typeof entry === 'string' ? {} : entry) });
  let turn = 0;
  let rise = 0;
  for (const s of def.sections) {
    turn += s.turn || 0;
    rise += s.rise || 0;
  }
  return { turn, rise };
}

// ------------------------------------------------------------ generation

function makeEntry(id, rng, cfg) {
  switch (id) {
    case 'straight':
      return { id, len: rng.pick([8, 10, 12]) };
    case 'ramp-up':
    case 'ramp-down':
      return { id, rise: cfg.rampRise };
    case 'bumpers':
      // Bouncy posts knock you sideways: keep rails on them unless the level has none.
      return cfg.rails === 'none' ? id : { id, guard: true };
    case 'beam':
      return { id, len: rng.pick([7, 8, 10]) };
    case 'hammer':
      return { id, side: rng.chance(0.5) ? 1 : -1, phase: +rng.range(0, Math.PI * 2).toFixed(3) };
    case 'wrecking-ball':
    case 'spinner':
    case 'moving-platform':
      return { id, phase: +rng.range(0, Math.PI * 2).toFixed(3) };
    default:
      return id;
  }
}

/** The entries a pick expands to (gates and boost pads the rules demand). */
function chunkFor(id, entry) {
  const p = getPiece(id);
  if (id === 'launch') return ['checkpoint', 'boost', entry];
  if (p.gap) return ['checkpoint', entry];
  return [entry];
}

/** One unvalidated candidate (attempt n) for a level and seed. */
export function generateCandidate(difficulty, seed, n = 0) {
  return attempt(getDifficulty(difficulty), String(seed), n);
}

function attempt(cfg, seed, n) {
  const rng = new Rng(n === 0 ? `track:${seed}` : `track:${seed}~${n}`);
  const options = { width: cfg.width, rails: cfg.rails, hazardSpeed: cfg.hazardSpeed || 1 };
  const len = (e) => pieceLength(e, options);
  const spacing = RACE_TUNING.checkpointSpacing;

  const pieces = ['start', { id: 'straight', len: LEAD_IN }];
  let s = len('start') + LEAD_IN;
  let lastCp = 6; // the start pad's checkpoint
  let heading = 0;
  let height = 0;
  let run = 0; // challenges back to back
  let prev = 'straight';
  const cpLen = len('checkpoint');

  // Append entries, inserting a checkpoint gate first when the middle of the
  // next stretch would be more than `spacing` m past the last one.
  const append = (list) => {
    const lastIsCp = entryId(pieces[pieces.length - 1]) === 'checkpoint';
    const entries = lastIsCp && entryId(list[0]) === 'checkpoint' ? list.slice(1) : list;
    const total = entries.reduce((a, e) => a + len(e), 0);
    const first = entryId(entries[0]);
    if (first !== 'checkpoint' && !lastIsCp && s + total / 2 - lastCp > spacing) {
      pieces.push('checkpoint');
      lastCp = s + cpLen / 2;
      s += cpLen;
    }
    for (const e of entries) {
      if (entryId(e) === 'checkpoint') lastCp = s + cpLen / 2;
      pieces.push(e);
      s += len(e);
    }
  };

  const ids = Object.keys(cfg.pieces);
  for (;;) {
    const room = cfg.length - FINISH_LINE_S - MIN_FINAL - s; // m left for pieces
    const options2 = [];
    for (const id of ids) {
      const weight = cfg.pieces[id];
      if (!(weight > 0)) continue;
      const entry = makeEntry(id, rng, cfg);
      const chunk = chunkFor(id, entry);
      const chunkLen = chunk.reduce((a, e) => a + len(e), 0);
      // Worst case a checkpoint gets inserted in front.
      if (chunkLen + cpLen > room) continue;
      const challenge = isChallenge(id);
      if (challenge && run >= cfg.maxChallengeRun) continue;
      if (id === 'boost' && (prev === 'boost' || prev === 'launch')) continue;
      // Too fast for a sharp turn right after a boost or a launch.
      if (id.startsWith('curve-sharp') && (prev === 'boost' || prev === 'launch')) continue;
      const { turn, rise } = pieceDelta(entry, options);
      if (Math.abs(heading + turn) > MAX_HEADING + 1e-6) continue;
      if (Math.abs(height + rise) > MAX_HEIGHT) continue;
      let w = weight;
      if (id === prev) w *= 0.3; // variety
      if (turn && Math.sign(turn) === Math.sign(heading)) w *= 0.6; // prefer turning back
      if (rise && Math.sign(rise) === Math.sign(height) && Math.abs(height) > 2) w *= 0.4;
      options2.push({ item: { id, chunk, turn, rise, challenge }, weight: w });
    }
    const pick = rng.weighted(options2);
    if (!pick) break;
    append(pick.chunk);
    heading += pick.turn;
    height += pick.rise;
    run = pick.challenge ? run + 1 : NEUTRAL.has(pick.id) ? run : 0;
    prev = pick.id;
    if (cfg.length - FINISH_LINE_S - s <= MAX_FINAL) break;
  }

  // Final sprint: a straight that lands the finish line on the target length.
  let finalLen = Math.max(MIN_FINAL, cfg.length - FINISH_LINE_S - s);
  while (finalLen > 0) {
    const l = Math.min(finalLen, 24);
    append([{ id: 'straight', len: +l.toFixed(2) }]);
    finalLen -= l;
    if (finalLen < MIN_FINAL / 2) break;
  }
  pieces.push('finish');
  return { pieces, options };
}

/**
 * Generate a race track.
 * @param {{difficulty:number, seed:string|number}} o
 * @returns {{pieces, options, difficulty, seed, layout, attempts, errors}}
 */
export function generateTrack({ difficulty = 1, seed = 'rolly' } = {}) {
  const cfg = getDifficulty(difficulty);
  let last = null;
  for (let n = 0; n < MAX_ATTEMPTS; n++) {
    const { pieces, options } = attempt(cfg, String(seed), n);
    const layout = new TrackLayout(pieces, options);
    const errors = [...checkTrackRules(pieces, cfg.level), ...validateLayout(layout, cfg.level)];
    last = { pieces, options, difficulty: cfg.level, seed: String(seed), layout, attempts: n + 1, errors };
    if (errors.length === 0) return last;
  }
  return last; // best effort (never seen in tests)
}

// ------------------------------------------------------------ rules & validation

/**
 * Rule check on a piece list for a level. Returns a list of problems ([] = ok).
 * @param {Array<string|object>} pieces
 * @param {number} level
 */
export function checkTrackRules(pieces, level) {
  const cfg = getDifficulty(level);
  const errors = [];
  const ids = pieces.map(entryId);
  if (ids[0] !== 'start') errors.push('first piece is not the start pad');
  if (ids[ids.length - 1] !== 'finish') errors.push('last piece is not the finish');
  if (ids.filter((id) => id === 'start' || id === 'finish').length !== 2) errors.push('start/finish appear more than once');
  let run = 0;
  ids.forEach((id, i) => {
    if (id === 'start' || id === 'finish') return;
    const p = getPiece(id);
    if (id !== 'checkpoint' && id !== 'straight' && !(id in cfg.pieces)) errors.push(`${id} not allowed at level ${level}`);
    if (p.gap) {
      const before = id === 'launch' ? [ids[i - 2], ids[i - 1]] : [ids[i - 1]];
      const want = id === 'launch' ? ['checkpoint', 'boost'] : ['checkpoint'];
      if (before.join() !== want.join()) errors.push(`${id} at #${i} is not preceded by ${want.join(' + ')}`);
    }
    if (id === 'gap-open' && level <= 3) errors.push(`open gap at level ${level}`);
    if (p.hazard && !cfg.hazards.includes(id)) errors.push(`hazard ${id} not allowed at level ${level}`);
    if (p.gap && cfg.gaps === 'none') errors.push(`gap ${id} at level ${level}`);
    if (isChallenge(id)) {
      run++;
      if (run > Math.max(1, cfg.maxChallengeRun)) errors.push(`${run} challenges in a row at #${i}`);
    } else if (!NEUTRAL.has(id)) run = 0;
  });
  return errors;
}

/**
 * Geometry checks on a laid-out track: length, checkpoint spacing, a
 * continuous on-road AI path, no self-overlap. Returns problems ([] = ok).
 */
export function validateLayout(layout, level) {
  const cfg = getDifficulty(level);
  const errors = [];
  const finishS = layout.finish ? layout.finish.s : layout.length;
  if (!layout.finish) errors.push('no finish line');
  if (Math.abs(finishS - cfg.length) > cfg.length * 0.08) errors.push(`finish at ${finishS.toFixed(1)} m, want ${cfg.length}`);

  // Checkpoints: about every `spacing` m. The generator adds a gate when the
  // middle of the next piece would pass `spacing`, so a stretch may run over
  // by half its last piece; a launch (boost + ramp + landing) is one stretch.
  const cps = layout.checkpoints.map((c) => c.s);
  cps.push(finishS);
  for (let i = 1; i < cps.length; i++) {
    const a = cps[i - 1];
    const b = cps[i];
    let longest = 0;
    for (const p of layout.pieces) if (p.s1 > a && p.s0 < b) longest = Math.max(longest, p.s1 - p.s0);
    const allowed = Math.max(RACE_TUNING.checkpointSpacing + 3 + longest / 2, longest + 16);
    if (b - a > allowed) errors.push(`${(b - a).toFixed(1)} m without a checkpoint at s=${a.toFixed(1)}`);
  }

  // AI path: continuous and on the road for every lane.
  const step = 0.25;
  const lane = { min: 0, max: 0 };
  const prevOff = [null, null, null];
  const lanes = [-1, 0, 1];
  for (let s = 0; s <= Math.min(layout.length, finishS + 10); s += step) {
    layout.laneAt(s, lane);
    if (lane.min > lane.max + 1e-6) errors.push(`empty AI lane at s=${s.toFixed(1)}`);
    const f = layout.spline.sampleAt(s);
    lanes.forEach((l, k) => {
      const off = layout.aiOffsetAt(s, l);
      if (f.floor && Math.abs(off) > f.width / 2 - 0.3) errors.push(`AI lane ${l} off the road at s=${s.toFixed(1)}`);
      // Lane blends are steep around bumpers (the AI rate-limits its sideways
      // speed); this catches real breaks.
      if (prevOff[k] !== null && Math.abs(off - prevOff[k]) > step * 3.5) errors.push(`AI lane ${l} jumps at s=${s.toFixed(1)}`);
      prevOff[k] = off;
    });
    if (errors.length > 20) break;
  }

  // No self-overlap: far-apart strips must not share space.
  const st = layout.strips;
  for (let i = 0; i < st.length; i += 2) {
    const a = st[i];
    for (let j = i + 1; j < st.length; j += 2) {
      const b = st[j];
      if (b.s0 - a.s1 < 30) continue;
      const dx = (a.a.x + a.b.x - b.a.x - b.b.x) / 2;
      const dz = (a.a.z + a.b.z - b.a.z - b.b.z) / 2;
      const dy = (a.a.y + a.b.y - b.a.y - b.b.y) / 2;
      const need = (Math.max(a.widthA, a.widthB) + Math.max(b.widthA, b.widthB)) / 2 + 3;
      if (Math.hypot(dx, dz) < need && Math.abs(dy) < 6) {
        errors.push(`track overlaps itself at s=${a.s0.toFixed(0)} / ${b.s0.toFixed(0)}`);
        return errors;
      }
    }
  }
  return errors;
}
