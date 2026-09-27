// Pure track layout: chain a piece list into ~1 m strips, one continuous
// center-line spline, and world-space features (checkpoints, hazards, ...).
// No physics, no rendering: TrackBuilder turns a layout into meshes + bodies,
// and tests use this directly.
//
//   const layout = new TrackLayout(['start', 'straight', {id: 'hammer', side: -1}, 'finish'], {width: 6, rails: 'curves'});
//   layout.spline.sampleAt(s)       frame at distance s (see TrackSpline)
//   layout.nearest(p, hintS)        {s, dist, lateral, height, index}
//   layout.checkpoints              [{s, position, forward, yaw, index}]  (start pad included)
//   layout.checkpointBefore(s)      latest checkpoint at or before s
//   layout.respawnAt(checkpoint)    {position (ball center), forward}
//   layout.startSlots               [{position, forward, s, lateral}]  slot 0 = player (front)
//   layout.laneAt(s)                {min, max} safe lateral range for AI (m, + = right)
//   layout.aiOffsetAt(s, lane)      lateral offset for an AI with lane in [-1, 1]
//   layout.hazardZones / gapZones / boostZones   [{s0, s1, ...}]
//   layout.pieceAt(s)               the piece record containing s

import { buildPieceDef, resolveOptions } from './Catalog.js';
import { TrackSpline } from './TrackSpline.js';
import { PROFILES, forwardXZ, lerp, smoothstep, clamp } from './math.js';

export const STRIP_STEP = 1; // max strip length (m)
export const LANE_MARGIN = 0.8; // keep AI centers this far from the road edge
export const LANE_RAMP = 2.5; // meters to blend into/out of a lane override
export const BALL_SPAWN_HEIGHT = 0.8; // ball center above the road on (re)spawn

/** Parabola h(u)·rise that leaves at `slope` (dy/dx) and ends at rise. */
function arcProfile(rise, len, slope) {
  if (Math.abs(rise) < 1e-9) return (u) => u; // unused (rise 0 → no height change)
  const c = (rise - slope * len) / (len * len);
  return (u) => (slope * len * u + c * len * len * u * u) / rise;
}

function railsFor(sec, mode) {
  if (sec.floor === false || sec.rails === false) return false;
  if (sec.rails === 'always' || sec.rails === true) return true;
  if (mode === 'full') return true;
  if (mode === 'curves') return Math.abs(sec.turn || 0) > 1e-6;
  return false;
}

export class TrackLayout {
  /**
   * @param {Array<string|object>} entries piece ids or {id, ...params}
   * @param {object} [opts] {width, rails: 'full'|'curves'|'none', hazardSpeed, start: {x,y,z,yaw}}
   */
  constructor(entries, opts = {}) {
    if (!entries || entries.length === 0) throw new Error('TrackLayout needs at least one piece');
    this.options = resolveOptions(opts);
    const start = opts.start || { x: 0, y: 0, z: 0, yaw: 0 };
    this.strips = [];
    this.pieces = [];

    let x = start.x;
    let y = start.y;
    let z = start.z;
    let yaw = start.yaw || 0;
    let s = 0;
    const defs = entries.map((e) => buildPieceDef(e, this.options));

    defs.forEach((def, pi) => {
      const entry = { x, y, z, yaw };
      const s0 = s;
      def.sections.forEach((sec, si) => {
        const len = sec.len;
        const n = Math.max(1, Math.ceil(len / STRIP_STEP - 1e-9));
        const turn = sec.turn || 0;
        const rise = sec.rise || 0;
        const wA = sec.width ?? this.options.width;
        const wB = sec.widthEnd ?? wA;
        const prof = sec.startSlope != null ? arcProfile(rise, len, sec.startSlope) : PROFILES[sec.profile || 'linear'];
        const rails = railsFor(sec, this.options.rails);
        const floor = sec.floor !== false;
        const y0 = y;
        const yaw0 = yaw;
        // Arc chord per strip (exact circle arcs, so exits are analytic).
        const dTheta = turn / n;
        const chord = Math.abs(dTheta) > 1e-9 ? (2 * (len / turn) * Math.sin(dTheta / 2)) : len / n;
        for (let i = 0; i < n; i++) {
          const u0 = i / n;
          const u1 = (i + 1) / n;
          const yawA = yaw0 + turn * u0;
          const yawB = yaw0 + turn * u1;
          const yawM = (yawA + yawB) / 2;
          const f = forwardXZ(yawM);
          const a = { x, y, z };
          x += f.x * chord;
          z += f.z * chord;
          y = i === n - 1 ? y0 + rise : y0 + rise * prof(u1);
          const b = { x, y, z };
          const dy = b.y - a.y;
          const l3 = Math.hypot(chord, dy);
          this.strips.push({
            a,
            b,
            yawA,
            yawB,
            yaw: yawM,
            pitch: Math.atan2(dy, chord),
            len: l3,
            hlen: chord,
            widthA: lerp(wA, wB, u0),
            widthB: lerp(wA, wB, u1),
            rails,
            floor,
            color: sec.color || null,
            edge: sec.edge !== false,
            piece: pi,
            section: si,
            s0: s,
            s1: s + l3,
          });
          s += l3;
        }
        yaw = yaw0 + turn;
        y = y0 + rise;
      });
      this.pieces.push({
        index: pi,
        id: def.piece.id,
        name: def.piece.name,
        kind: def.piece.kind,
        hazard: !!def.piece.hazard,
        gap: !!def.piece.gap,
        params: def.params,
        options: def.options,
        s0,
        s1: s,
        entry,
        exit: { x, y, z, yaw },
        def,
      });
    });

    // Floor boundaries get end caps (so a short jump hits a wall, not air).
    this.strips.forEach((st, i) => {
      const prev = this.strips[i - 1];
      const next = this.strips[i + 1];
      st.capStart = st.floor && (!prev || !prev.floor || Math.abs(prev.widthB - st.widthA) > 0.01);
      st.capEnd = st.floor && (!next || !next.floor || Math.abs(next.widthA - st.widthB) > 0.01);
    });

    // Center line: every strip start + the final end.
    const pts = this.strips.map((st) => ({ ...st.a, yaw: st.yawA, width: st.widthA, widthEnd: st.widthB, floor: st.floor, piece: st.piece }));
    const last = this.strips[this.strips.length - 1];
    pts.push({ ...last.b, yaw: last.yawB, width: last.widthB, floor: last.floor, piece: last.piece });
    this.spline = new TrackSpline(pts);
    this.length = this.spline.length;

    this._placeFeatures();
  }

  _frame(s) {
    const f = this.spline.sampleAt(s);
    return {
      s: f.s,
      position: { ...f.position },
      forward: { ...f.forward },
      right: { ...f.right },
      yaw: f.yaw,
      pitch: f.pitch,
      width: f.width,
    };
  }

  _placeFeatures() {
    this.features = [];
    this.checkpoints = [];
    this.startSlots = [];
    this.boostZones = [];
    this.hazardZones = [];
    this.gapZones = [];
    this.lanes = [];
    this.finish = null;

    for (const p of this.pieces) {
      const pieceLen = p.s1 - p.s0;
      for (const f of p.def.features) {
        const s = p.s0 + clamp(f.s, 0, pieceLen);
        const frame = this._frame(s);
        const wf = { ...f, ...frame, piece: p.index };
        this.features.push(wf);
        if (f.type === 'checkpoint') this.checkpoints.push(wf);
        else if (f.type === 'finish') this.finish = wf;
        else if (f.type === 'boost') this.boostZones.push({ s0: s - f.len / 2, s1: s + f.len / 2, piece: p.index, feature: wf });
        else if (f.type === 'gapMarker') this.gapZones.push({ s0: s, s1: s + f.len, piece: p.index, bridged: !!f.bridge });
        else if (f.type === 'hazard') {
          const [before, after] = f.zone || [3, 3];
          this.hazardZones.push({ s0: s - before, s1: s + after, type: f.hazard, piece: p.index, feature: wf });
        } else if (f.type === 'bumper') {
          this.hazardZones.push({ s0: s - 1, s1: s + 1, type: 'bumper', piece: p.index, feature: wf });
        } else if (f.type === 'start') {
          for (const slot of f.slots) {
            const fr = this._frame(p.s0 + slot.s);
            this.startSlots.push({
              s: fr.s,
              lateral: slot.lateral,
              forward: fr.forward,
              yaw: fr.yaw,
              position: {
                x: fr.position.x + fr.right.x * slot.lateral,
                y: fr.position.y + BALL_SPAWN_HEIGHT,
                z: fr.position.z + fr.right.z * slot.lateral,
              },
            });
          }
        }
      }
      for (const l of p.def.lanes) {
        this.lanes.push({ s0: p.s0 + l.s0, s1: p.s0 + l.s1, min: Math.min(l.min, l.max), max: Math.max(l.min, l.max) });
      }
    }
    this.checkpoints.sort((a, b) => a.s - b.s);
    this.checkpoints.forEach((c, i) => (c.index = i));
    // No explicit checkpoints: the track start is one.
    if (this.checkpoints.length === 0) {
      const c = this._frame(Math.min(2, this.length / 2));
      this.checkpoints.push({ type: 'checkpoint', ...c, piece: 0, index: 0, implicit: true });
    }
    this.lanes.sort((a, b) => a.s0 - b.s0);
    this.hazardZones.sort((a, b) => a.s0 - b.s0);
  }

  // ------------------------------------------------------------ queries

  nearest(p, hintS = -1) {
    return this.spline.nearest(p, hintS);
  }

  pieceAt(s) {
    for (const p of this.pieces) if (s < p.s1) return p;
    return this.pieces[this.pieces.length - 1];
  }

  /** Latest checkpoint at or before s (the first one if none). */
  checkpointBefore(s) {
    let best = this.checkpoints[0];
    for (const c of this.checkpoints) {
      if (c.s <= s + 1e-6) best = c;
      else break;
    }
    return best;
  }

  /** Spawn position (ball center) + facing for a checkpoint (or s). */
  respawnAt(checkpointOrS) {
    const c = typeof checkpointOrS === 'number' ? this.checkpointBefore(checkpointOrS) : checkpointOrS;
    return {
      position: { x: c.position.x, y: c.position.y + BALL_SPAWN_HEIGHT, z: c.position.z },
      forward: { ...c.forward },
      s: c.s,
    };
  }

  isOverGap(s) {
    return this.gapZones.some((g) => s >= g.s0 && s <= g.s1);
  }

  inHazard(s) {
    return this.hazardZones.find((h) => s >= h.s0 && s <= h.s1) || null;
  }

  /**
   * Lateral range {min, max} where an AI ball can roll safely at s: inside
   * the road (minus LANE_MARGIN) and around static obstacles (piece lanes,
   * blended in over LANE_RAMP meters).
   */
  laneAt(s, out = { min: 0, max: 0 }) {
    const half = Math.max(0, this.spline.widthAt(s) / 2 - LANE_MARGIN);
    let min = -half;
    let max = half;
    // Blend overlapping zones continuously: each zone's weight grows steeply
    // as it becomes fully active (k → 1), so a fully-active zone wins over a
    // neighbour that is only ramping in; then blend with the plain road by
    // the strongest k.
    let wSum = 0;
    let zMin = 0;
    let zMax = 0;
    let kMax = 0;
    for (const z of this.lanes) {
      if (z.s0 - LANE_RAMP > s) break;
      if (s > z.s1 + LANE_RAMP) continue;
      const k = s < z.s0 ? smoothstep((s - (z.s0 - LANE_RAMP)) / LANE_RAMP) : s > z.s1 ? smoothstep((z.s1 + LANE_RAMP - s) / LANE_RAMP) : 1;
      if (k <= 0) continue;
      const w = k / (1.002 - k);
      wSum += w;
      zMin += z.min * w;
      zMax += z.max * w;
      if (k > kMax) kMax = k;
    }
    if (wSum > 0) {
      min = lerp(min, zMin / wSum, kMax);
      max = lerp(max, zMax / wSum, kMax);
    }
    out.min = min;
    out.max = max;
    return out;
  }

  /** Lateral offset (m) for an AI in lane ∈ [-1, 1] (0 = middle of the safe range). */
  aiOffsetAt(s, lane = 0) {
    const r = this.laneAt(s, this._laneTmp || (this._laneTmp = { min: 0, max: 0 }));
    const l = clamp(lane, -1, 1);
    return (r.min + r.max) / 2 + (l * (r.max - r.min)) / 2;
  }

  /** World position of the AI path at s for a lane (center-line height). */
  aiPointAt(s, lane = 0, out = { x: 0, y: 0, z: 0 }) {
    const off = this.aiOffsetAt(s, lane);
    this.spline.positionAt(s, out);
    const r = this.spline.rightAt(s, this._rTmp || (this._rTmp = { x: 0, y: 0, z: 0 }));
    out.x += r.x * off;
    out.z += r.z * off;
    return out;
  }
}
