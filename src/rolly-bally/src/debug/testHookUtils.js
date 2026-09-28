// Pure helpers for the ?test=1 hook (src/debug/testHooks.js). No DOM, no
// three.js, so vitest can cover them (test/test-hooks.test.js).

export const TEST_DT = 1 / 60;
const DEADZONE = 0.12; // same as core/Input.js

const r3 = (v) => Math.round(v * 1000) / 1000;

/** {x, y, z} rounded to mm (stable, compact JSON). */
export function vec(v) {
  return v ? { x: r3(v.x), y: r3(v.y), z: r3(v.z) } : null;
}

export function round(v, k = 1000) {
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(v * k) / k : v;
}

/**
 * Bot input → the move vector Input.update() would produce.
 * Accepts {x, y, jump}; x/y clamped to the unit disc, NaN → 0.
 * `active` mirrors Input.isActive() (above the stick deadzone).
 */
export function normalizeTestInput(input) {
  const x = Number(input?.x) || 0;
  const y = Number(input?.y) || 0;
  const len = Math.hypot(x, y);
  const k = len > 1 ? 1 / len : 1;
  return { x: x * k, y: y * k, jump: !!input?.jump, active: len * k > DEADZONE };
}

/**
 * Walk a polyline of center-line points [{x,y,z,width?}] with cumulative
 * arc lengths `sArr` and return `count` samples every `spacing` m from s0.
 * Used for the "path ahead" in state() so a bot can steer along the track.
 */
export function samplePolyline(points, sArr, s0, count = 12, spacing = 2) {
  const out = [];
  if (!points || points.length < 2) return out;
  const total = sArr[sArr.length - 1];
  let i = 0;
  for (let k = 0; k < count; k++) {
    const s = Math.min(total, Math.max(0, s0 + k * spacing));
    while (i < sArr.length - 2 && sArr[i + 1] < s) i++;
    const a = points[i];
    const b = points[i + 1];
    const len = sArr[i + 1] - sArr[i];
    const t = len > 1e-9 ? Math.min(1, Math.max(0, (s - sArr[i]) / len)) : 0;
    const p = {
      s: r3(s),
      x: r3(a.x + (b.x - a.x) * t),
      y: r3(a.y + (b.y - a.y) * t),
      z: r3(a.z + (b.z - a.z) * t),
    };
    if (a.width !== undefined) p.width = r3(a.width);
    out.push(p);
    if (s >= total) break;
  }
  return out;
}

/** Cumulative 3D arc length of a point list. */
export function arcLengths(points) {
  const s = new Array(points.length).fill(0);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    s[i] = s[i - 1] + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  }
  return s;
}

/** Make any value JSON-safe (drops functions / THREE objects → plain numbers). */
export function plain(value) {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === 'number') return round(value);
  if (typeof value !== 'object') return typeof value === 'function' ? undefined : value;
  if (Array.isArray(value)) return value.map(plain);
  if ('x' in value && 'y' in value && 'z' in value && typeof value.x === 'number') return vec(value);
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    const p = plain(v);
    if (p !== undefined) out[k] = p;
  }
  return out;
}

/** Event log with a simulated clock. */
export class EventLog {
  constructor(now = () => 0) {
    this.now = now;
    this.list = [];
  }

  push(type, details = {}) {
    const e = { t: round(this.now(), 1e4), type, ...plain(details) };
    this.list.push(e);
    return e;
  }

  clear() {
    this.list.length = 0;
  }
}
