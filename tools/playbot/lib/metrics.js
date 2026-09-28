// Kid-UX numbers from bot runs: a per-run recorder, stuck spots, summaries per
// bracket, the difficulty verdict, and heatmap PNGs (tiny PNG encoder on
// node:zlib, no dependencies). Pure: no browser.
import { deflateSync } from 'node:zlib';

// ---------------------------------------------------------------- stats

export const round = (v, k = 100) => (Number.isFinite(v) ? Math.round(v * k) / k : v);

export function mean(xs) {
  const f = xs.filter(Number.isFinite);
  return f.length ? f.reduce((s, x) => s + x, 0) / f.length : null;
}

/** Median that treats Infinity as a value (a run that never won sorts last). */
export function median(xs) {
  const s = xs.filter((x) => typeof x === 'number' && !Number.isNaN(x)).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function range(xs) {
  const f = xs.filter(Number.isFinite);
  return f.length ? [Math.min(...f), Math.max(...f)] : null;
}

/** "12.3 (8.1–20.4)" style: mean with range. */
export function meanRange(xs, digits = 1) {
  const m = mean(xs);
  const r = range(xs);
  if (m === null) return '–';
  return `${m.toFixed(digits)} (${r[0].toFixed(digits)}–${r[1].toFixed(digits)})`;
}

// ---------------------------------------------------------------- per-run recorder

/**
 * Records one bot run: where the player spent time (dwell per bin), distance
 * travelled, wall bumps, fails and wins, and "progress" (first visits to a
 * cell) for stuck-spot detection. Call sample() at a fixed interval.
 *   binOf(pos)  -> key string for the heatmap (e.g. block "x,z")
 *   cellOf(pos) -> key string for progress/stuck (e.g. corridor cell "i,j")
 */
export class RunRecorder {
  constructor({ binOf, cellOf = binOf, stuckAfterS = 20 } = {}) {
    this.binOf = binOf;
    this.cellOf = cellOf;
    this.stuckAfterS = stuckAfterS;
    this.dwell = {};
    this.cellDwell = {};
    this.visited = new Set();
    this.firstVisit = {};
    this.lastProgressT = 0;
    this.window = {}; // cell dwell since last progress
    this.stuck = [];
    this.pathLength = 0;
    this.bumps = 0;
    this.fails = [];
    this.wins = [];
    this.last = null;
    this.t = 0;
  }

  /** pos {x,z}, t seconds; dt = time since the previous sample. `teleported` skips distance. */
  sample(pos, t, { teleported = false } = {}) {
    const dt = this.last ? t - this.last.t : 0;
    if (this.last && !teleported) this.pathLength += Math.hypot(pos.x - this.last.x, pos.z - this.last.z);
    const bin = this.binOf(pos);
    const cell = this.cellOf(pos);
    if (dt > 0) {
      this.dwell[bin] = (this.dwell[bin] ?? 0) + dt;
      this.cellDwell[cell] = (this.cellDwell[cell] ?? 0) + dt;
      this.window[cell] = (this.window[cell] ?? 0) + dt;
    }
    if (!this.visited.has(cell)) {
      this.visited.add(cell);
      this.firstVisit[cell] = round(t);
      this.closeWindow(t);
    }
    this.last = { x: pos.x, z: pos.z, t };
    this.t = t;
  }

  /** Progress happened (new cell, or a win): end the current no-progress window. */
  closeWindow(t) {
    const len = t - this.lastProgressT;
    if (len >= this.stuckAfterS) this.stuck.push(stuckEntry(this.window, this.lastProgressT, t));
    this.lastProgressT = t;
    this.window = {};
  }

  bump() { this.bumps++; }
  fail(t, reason) { this.fails.push({ t: round(t), reason }); }
  win(t) { this.wins.push(round(t)); this.closeWindow(t); }

  /** Finish: flush an open no-progress window (e.g. the kid gave up there). */
  finish(t = this.t) {
    const len = t - this.lastProgressT;
    if (len >= this.stuckAfterS) this.stuck.push(stuckEntry(this.window, this.lastProgressT, t));
    this.lastProgressT = t;
    this.window = {};
    return {
      simSeconds: round(t),
      won: this.wins.length > 0,
      timeToWin: this.wins.length ? this.wins[0] : null,
      fails: this.fails.length,
      failReasons: countBy(this.fails.map((f) => f.reason)),
      pathLength: round(this.pathLength, 10),
      bumps: this.bumps,
      cellsVisited: this.visited.size,
      stuck: this.stuck,
      dwell: roundValues(this.dwell),
      cellDwell: roundValues(this.cellDwell),
    };
  }
}

function stuckEntry(window, t0, t1) {
  let cell = null;
  let best = -1;
  for (const [k, v] of Object.entries(window)) if (v > best) { best = v; cell = k; }
  return { cell, from: round(t0), to: round(t1), seconds: round(t1 - t0), cellSeconds: round(best) };
}

function roundValues(o) {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, round(v)]));
}

export function countBy(xs) {
  const out = {};
  for (const x of xs) out[x] = (out[x] ?? 0) + 1;
  return out;
}

// ---------------------------------------------------------------- summaries

/**
 * Summary over several runs of one persona on one level.
 * runs: finish() outputs (+ optional optimalLength, quit). capS: time cap.
 */
export function summarizeRuns(runs, { capS = null, optimalLength = null, minStuckRuns = 2 } = {}) {
  const ok = runs.filter((r) => !r.error);
  const n = ok.length;
  const ttw = ok.map((r) => (r.won ? r.timeToWin : Infinity));
  const fails = ok.map((r) => r.fails);
  const failsTotal = fails.reduce((s, x) => s + x, 0);
  const winsTotal = ok.filter((r) => r.won).length;
  const minutes = ok.reduce((s, r) => s + r.simSeconds / 60, 0);
  const pathRatio = optimalLength
    ? ok.filter((r) => r.won).map((r) => r.pathLength / optimalLength)
    : [];
  const stuckCells = {};
  for (const r of ok) {
    const seen = new Set();
    for (const s of r.stuck ?? []) {
      const e = (stuckCells[s.cell] ??= { cell: s.cell, runs: 0, episodes: 0, seconds: 0 });
      e.episodes++;
      e.seconds += s.seconds;
      if (!seen.has(s.cell)) { e.runs++; seen.add(s.cell); }
    }
  }
  const stuckSpots = Object.values(stuckCells)
    .map((e) => ({ ...e, seconds: round(e.seconds) }))
    .sort((a, b) => b.runs - a.runs || b.seconds - a.seconds);
  return {
    runs: n,
    errors: runs.length - n,
    capS,
    winRate: n ? round(winsTotal / n, 1000) : null,
    medianTimeToWin: round(median(ttw)),
    meanTimeToWinOfWinners: round(mean(ttw.filter(Number.isFinite))),
    timeToWinRange: range(ttw),
    quits: ok.filter((r) => r.quit).length,
    failsMean: round(mean(fails)),
    failsPerMinute: minutes ? round(failsTotal / minutes) : null,
    retryRate: failsTotal + winsTotal ? round(failsTotal / (failsTotal + winsTotal), 1000) : null,
    bumpsPerMinute: minutes ? round(ok.reduce((s, r) => s + r.bumps, 0) / minutes) : null,
    pathVsOptimal: pathRatio.length ? round(mean(pathRatio)) : null,
    stuckEpisodesPerRun: n ? round(ok.reduce((s, r) => s + (r.stuck?.length ?? 0), 0) / n) : null,
    stuckSpots: stuckSpots.filter((s) => s.runs >= Math.min(minStuckRuns, n)).slice(0, 10),
    cellsVisitedMean: round(mean(ok.map((r) => r.cellsVisited))),
  };
}

/**
 * Difficulty verdict for one bracket, set before any calibration run:
 *   too hard: fewer than 60% win within the cap, or the median time to win is
 *             longer than the bracket's whole session (rubric session_minutes max)
 *   too easy: the median time to win is under 10% of the session minimum
 *   ok:       otherwise
 */
export function difficultyVerdict(summary, sessionMinutes, { minWinRate = 0.6, easyFraction = 0.1 } = {}) {
  const [lo, hi] = sessionMinutes;
  const med = summary.medianTimeToWin;
  const reasons = [];
  let verdict = 'ok';
  if (summary.winRate === null) return { verdict: 'unknown', reasons: ['no runs'] };
  if (summary.winRate < minWinRate) reasons.push(`win rate ${(summary.winRate * 100).toFixed(0)}% < ${minWinRate * 100}% within ${fmtS(summary.capS)}`);
  if (med === Infinity || med > hi * 60) reasons.push(`median time to win ${fmtS(med)} > session max ${hi} min`);
  if (reasons.length) verdict = 'too hard';
  else if (med < lo * 60 * easyFraction) {
    verdict = 'too easy';
    reasons.push(`median time to win ${fmtS(med)} < ${easyFraction * 100}% of session min ${lo} min`);
  } else {
    reasons.push(`median time to win ${fmtS(med)} within ${lo}–${hi} min session, win rate ${(summary.winRate * 100).toFixed(0)}%`);
  }
  return { verdict, reasons };
}

/**
 * Rolly Bally verdict for one bracket (tracks are short; time isn't the issue):
 *   too hard: fewer than 60% finish within the cap, or more than 3 falls a minute
 *   ok:       otherwise
 */
export function trackVerdict(summary, { minWinRate = 0.6, maxFallsPerMinute = 3 } = {}) {
  const reasons = [];
  if (summary.winRate === null) return { verdict: 'unknown', reasons: ['no runs'] };
  if (summary.winRate < minWinRate) reasons.push(`finish rate ${(summary.winRate * 100).toFixed(0)}% < ${minWinRate * 100}% within ${fmtS(summary.capS)}`);
  if (summary.failsPerMinute > maxFallsPerMinute) reasons.push(`${summary.failsPerMinute} falls a minute > ${maxFallsPerMinute}`);
  if (reasons.length) return { verdict: 'too hard', reasons };
  return { verdict: 'ok', reasons: [`finish rate ${(summary.winRate * 100).toFixed(0)}%, median ${fmtS(summary.medianTimeToWin)}, ${summary.failsPerMinute} falls a minute`] };
}

export function fmtS(s) {
  if (s === null || s === undefined) return '–';
  if (s === Infinity) return 'never';
  if (s < 60) return `${s.toFixed(0)}s`;
  return `${Math.floor(s / 60)}m${String(Math.round(s % 60)).padStart(2, '0')}s`;
}

/** Sum dwell maps of several runs. */
export function mergeDwell(maps) {
  const out = {};
  for (const m of maps) for (const [k, v] of Object.entries(m ?? {})) out[k] = (out[k] ?? 0) + v;
  return out;
}

// ---------------------------------------------------------------- PNG

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** Encode RGBA pixels (Uint8Array, width*height*4) as a PNG Buffer. */
export function encodePNG(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Heat colour ramp: 0 → pale, 1 → dark red (via yellow/orange). */
export function heatColor(v) {
  const stops = [[255, 255, 204], [254, 217, 118], [253, 141, 60], [227, 26, 28], [128, 0, 38]];
  const x = Math.max(0, Math.min(1, v)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  return stops[i].map((c, k) => Math.round(c + (stops[i + 1][k] - c) * f));
}

/**
 * Heatmap of a grid of bins. cols x rows bins, value(i, j) -> seconds (or 0),
 * base(i, j) -> null | [r,g,b] for non-heat bins (walls), markers: [{i,j,color}].
 * Log scale so rarely visited bins still show. Returns a PNG Buffer.
 */
export function heatmapPNG({ cols, rows, value, base = () => null, markers = [], scale = 8 }) {
  let max = 0;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) max = Math.max(max, value(i, j) || 0);
  const W = cols * scale;
  const H = rows * scale;
  const px = new Uint8Array(W * H * 4);
  const fill = (i, j, rgb, inset = 0) => {
    for (let y = j * scale + inset; y < (j + 1) * scale - inset; y++) {
      for (let x = i * scale + inset; x < (i + 1) * scale - inset; x++) {
        const o = (y * W + x) * 4;
        px[o] = rgb[0]; px[o + 1] = rgb[1]; px[o + 2] = rgb[2]; px[o + 3] = 255;
      }
    }
  };
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const b = base(i, j);
      if (b) { fill(i, j, b); continue; }
      const v = value(i, j) || 0;
      fill(i, j, v > 0 && max > 0 ? heatColor(Math.log1p(v) / Math.log1p(max)) : [245, 245, 245]);
    }
  }
  for (const m of markers) fill(m.i, m.j, m.color, Math.floor(scale / 5));
  return encodePNG(W, H, px);
}
