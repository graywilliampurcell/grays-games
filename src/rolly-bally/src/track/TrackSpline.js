// The track's center line: a densely sampled polyline (≤ 1 m apart) with an
// arc-length parameter s (meters along the 3D center line, 0 at the start).
// Pure math, no three.js; out-params accept THREE.Vector3 or plain objects.
//
//   spline.length
//   spline.sampleAt(s)          → {s, position, forward, right, tangent, yaw, pitch, width, floor, piece}
//   spline.positionAt(s, out)   spline.forwardAt(s, out)   spline.rightAt(s, out)
//   spline.nearest(p, hintS?)   → {s, index, dist, lateral, height}
//   spline.progress(p, hintS?)  → s / length in [0,1]

import { clamp, forwardXZ, rightXZ } from './math.js';

export class TrackSpline {
  /**
   * @param {Array<{x,y,z,yaw,width,widthEnd?,floor,piece}>} points center line
   *   samples in order. Point i describes the segment [i, i+1]; its width runs
   *   from `width` to `widthEnd` (default: the next point's width), so a bridge
   *   can narrow abruptly.
   */
  constructor(points) {
    if (points.length < 2) throw new Error('TrackSpline needs at least 2 points');
    this.points = points;
    const s = new Float64Array(points.length);
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      s[i] = s[i - 1] + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    }
    this.s = s;
    this.length = s[s.length - 1];
  }

  /** Index i of the segment [i, i+1] containing s (clamped). */
  indexAt(s) {
    const arr = this.s;
    if (s <= 0) return 0;
    if (s >= this.length) return arr.length - 2;
    let lo = 0;
    let hi = arr.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (arr[mid] <= s) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  _t(i, s) {
    const len = this.s[i + 1] - this.s[i];
    return len > 1e-9 ? clamp((s - this.s[i]) / len, 0, 1) : 0;
  }

  positionAt(s, out = { x: 0, y: 0, z: 0 }) {
    const i = this.indexAt(s);
    const t = this._t(i, s);
    const a = this.points[i];
    const b = this.points[i + 1];
    out.x = a.x + (b.x - a.x) * t;
    out.y = a.y + (b.y - a.y) * t;
    out.z = a.z + (b.z - a.z) * t;
    return out;
  }

  yawAt(s) {
    const i = this.indexAt(s);
    const t = this._t(i, s);
    return this.points[i].yaw + (this.points[i + 1].yaw - this.points[i].yaw) * t;
  }

  _widthIn(i, t) {
    const a = this.points[i];
    const end = a.widthEnd ?? this.points[i + 1].width;
    return a.width + (end - a.width) * t;
  }

  widthAt(s) {
    const i = this.indexAt(s);
    return this._widthIn(i, this._t(i, s));
  }

  /** Horizontal unit forward (y = 0). */
  forwardAt(s, out = { x: 0, y: 0, z: 0 }) {
    const f = forwardXZ(this.yawAt(s));
    out.x = f.x;
    out.y = 0;
    out.z = f.z;
    return out;
  }

  /** Horizontal unit right (y = 0). */
  rightAt(s, out = { x: 0, y: 0, z: 0 }) {
    const r = rightXZ(this.yawAt(s));
    out.x = r.x;
    out.y = 0;
    out.z = r.z;
    return out;
  }

  /** Full frame at s. `floor` is false over gaps (the line keeps going through the air). */
  sampleAt(s, out = {}) {
    const i = this.indexAt(s);
    const t = this._t(i, s);
    const a = this.points[i];
    const b = this.points[i + 1];
    const sc = clamp(s, 0, this.length);
    out.s = sc;
    out.position = this.positionAt(sc, out.position || { x: 0, y: 0, z: 0 });
    out.yaw = a.yaw + (b.yaw - a.yaw) * t;
    const f = forwardXZ(out.yaw);
    const r = rightXZ(out.yaw);
    out.forward = Object.assign(out.forward || {}, { x: f.x, y: 0, z: f.z });
    out.right = Object.assign(out.right || {}, { x: r.x, y: 0, z: r.z });
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dy, dz) || 1;
    out.tangent = Object.assign(out.tangent || {}, { x: dx / len, y: dy / len, z: dz / len });
    out.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    out.width = this._widthIn(i, t);
    // Point i describes segment [i, i+1].
    out.floor = a.floor;
    out.piece = a.piece;
    return out;
  }

  /**
   * Closest point on the center line to p.
   * @param {{x,y,z}} p
   * @param {number} [hintS=-1] last known s; searches a window around it (fast,
   *   and avoids snapping to a different part of the track that passes nearby).
   *   Negative = search everything.
   * @returns {{s, index, dist, lateral, height}} lateral = signed offset along
   *   right (m), height = p.y minus the center line height.
   */
  nearest(p, hintS = -1, back = 8, ahead = 30) {
    let lo = 0;
    let hi = this.points.length - 2;
    if (hintS >= 0) {
      lo = Math.max(0, this.indexAt(hintS - back));
      hi = Math.min(hi, this.indexAt(hintS + ahead));
    }
    let best = -1;
    let bestD = Infinity;
    let bestT = 0;
    const pts = this.points;
    for (let i = lo; i <= hi; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const abz = b.z - a.z;
      const l2 = abx * abx + aby * aby + abz * abz;
      let t = l2 > 1e-12 ? ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / l2 : 0;
      t = clamp(t, 0, 1);
      const dx = p.x - (a.x + abx * t);
      const dy = p.y - (a.y + aby * t);
      const dz = p.z - (a.z + abz * t);
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = i;
        bestT = t;
      }
    }
    const s = this.s[best] + (this.s[best + 1] - this.s[best]) * bestT;
    const c = this.positionAt(s);
    const r = rightXZ(this.yawAt(s));
    return {
      s,
      index: best,
      dist: Math.sqrt(bestD),
      lateral: (p.x - c.x) * r.x + (p.z - c.z) * r.z,
      height: p.y - c.y,
    };
  }

  /** Fraction of the track completed at p (0..1). */
  progress(p, hintS = -1) {
    return this.nearest(p, hintS).s / this.length;
  }
}
