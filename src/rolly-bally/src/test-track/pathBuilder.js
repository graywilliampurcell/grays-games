// Turtle-style path builder used by the hand-built test track: walk a list
// of segments, cut them into ~1 m strips, then emit a smooth trimesh road
// (collision), rail cuboids and voxel boxes (visual).
//
// Heading convention: yaw 0 faces -Z; forward = (-sin yaw, 0, -cos yaw);
// positive turn = turning left.

import * as THREE from 'three';

const STEP = 1; // strip length (m)

export function forwardOf(yaw, out = new THREE.Vector3()) {
  return out.set(-Math.sin(yaw), 0, -Math.cos(yaw));
}

function rightOf(yaw, out = new THREE.Vector3()) {
  return out.set(Math.cos(yaw), 0, -Math.sin(yaw));
}

/**
 * @typedef {object} Segment
 * @property {number} len       length along the path (m)
 * @property {number} [width=8]
 * @property {number} [turn=0]  total heading change (radians, + = left)
 * @property {number} [rise=0]  total height change (m)
 * @property {boolean} [rails=false]
 * @property {boolean} [gap=false]  no floor (jump it)
 * @property {string} [color]   palette key override for the floor
 * @property {string} [kind]    label (debug / checkpoints)
 * @property {boolean} [checkpoint=true] respawn point at the segment start
 */

/**
 * Walk segments into strips.
 * @returns {{strips: object[], segmentStarts: number[]}}
 *   strip: {a, b (Vector3 centerline ends), yawA, yawB, yaw (mid), pitch,
 *           len, width, rails, gap, color, segment (index), kind}
 */
export function buildStrips(segments, start = { x: 0, y: 0, z: 0, yaw: 0 }) {
  const strips = [];
  const segmentStarts = [];
  const pos = new THREE.Vector3(start.x, start.y, start.z);
  let yaw = start.yaw || 0;
  const dir = new THREE.Vector3();

  segments.forEach((seg, si) => {
    segmentStarts.push(strips.length);
    const n = Math.max(1, Math.round(seg.len / STEP));
    const dl = seg.len / n;
    const dYaw = (seg.turn || 0) / n;
    const dRise = (seg.rise || 0) / n;
    for (let i = 0; i < n; i++) {
      const yawA = yaw;
      const yawB = yaw + dYaw;
      const yawMid = yaw + dYaw / 2;
      const a = pos.clone();
      forwardOf(yawMid, dir);
      pos.addScaledVector(dir, dl);
      pos.y += dRise;
      strips.push({
        a,
        b: pos.clone(),
        yawA,
        yawB,
        yaw: yawMid,
        pitch: Math.atan2(dRise, dl),
        len: Math.hypot(dl, dRise),
        width: seg.width ?? 8,
        rails: !!seg.rails,
        gap: !!seg.gap,
        color: seg.color || null,
        segment: si,
        kind: seg.kind || 'path',
        checkpoint: seg.checkpoint !== false && !seg.gap && i === 0,
      });
      yaw = yawB;
    }
  });
  return { strips, segmentStarts };
}

/** Road surface trimesh (top faces only) for all non-gap strips. */
export function roadTrimesh(strips) {
  const verts = [];
  const idx = [];
  const r = new THREE.Vector3();
  for (const s of strips) {
    if (s.gap) continue;
    const hw = s.width / 2;
    const base = verts.length / 3;
    rightOf(s.yawA, r);
    verts.push(s.a.x - r.x * hw, s.a.y, s.a.z - r.z * hw); // aL
    verts.push(s.a.x + r.x * hw, s.a.y, s.a.z + r.z * hw); // aR
    rightOf(s.yawB, r);
    verts.push(s.b.x - r.x * hw, s.b.y, s.b.z - r.z * hw); // bL
    verts.push(s.b.x + r.x * hw, s.b.y, s.b.z + r.z * hw); // bR
    idx.push(base, base + 1, base + 3, base, base + 3, base + 2);
  }
  return { vertices: new Float32Array(verts), indices: new Uint32Array(idx) };
}

/** Quaternion for a strip-aligned box (yaw, then pitch up along forward). */
export function stripRotation(s, out = new THREE.Quaternion()) {
  return out.setFromEuler(new THREE.Euler(s.pitch, s.yaw, 0, 'YXZ'));
}

/**
 * Add colliders + blocks for a strip list.
 * @param {object} opts {physics, blocks: BlockMesh, strips, railHeight}
 */
export function buildPath({ physics, blocks, strips, railHeight = 0.7, thickness = 0.6 }) {
  const { vertices, indices } = roadTrimesh(strips);
  physics.addFixedTrimesh(vertices, indices, { friction: 0.9, restitution: 0.1, tag: 'track' });

  const q = new THREE.Quaternion();
  const up = new THREE.Vector3();
  const right = new THREE.Vector3();
  const mid = new THREE.Vector3();
  strips.forEach((s, i) => {
    if (s.gap) return;
    stripRotation(s, q);
    up.set(0, 1, 0).applyQuaternion(q);
    right.set(1, 0, 0).applyQuaternion(q);
    mid.copy(s.a).add(s.b).multiplyScalar(0.5);

    // Floor slab, top flush with the road surface. Alternate colors every 2 m.
    const floorColor = s.color || (Math.floor(i / 2) % 2 ? 'trackAlt' : 'track');
    const c = mid.clone().addScaledVector(up, -thickness / 2);
    blocks.addBox(c, { x: s.width, y: thickness, z: s.len + 0.06 }, floorColor, { rotation: q.clone() });

    // Edge trim so the path edge is readable.
    for (const side of [-1, 1]) {
      // Slightly wider/taller than the slab it sits in so faces never z-fight.
      const e = mid.clone().addScaledVector(right, side * (s.width / 2 - 0.14)).addScaledVector(up, -thickness / 2 + 0.02);
      blocks.addBox(e, { x: 0.32, y: thickness + 0.04, z: s.len + 0.04 }, 'edge', { rotation: q.clone(), jitter: 0 });
    }

    if (s.rails) {
      for (const side of [-1, 1]) {
        const p = mid.clone().addScaledVector(right, side * (s.width / 2 + 0.15)).addScaledVector(up, railHeight / 2 - 0.1);
        physics.addFixedCuboid({
          position: p,
          halfExtents: { x: 0.15, y: railHeight / 2 + 0.1, z: s.len / 2 + 0.03 },
          rotation: q.clone(),
          friction: 0.2,
          restitution: 0.3,
          tag: 'rail',
        });
        blocks.addBox(p, { x: 0.3, y: railHeight + 0.2, z: s.len + 0.06 }, Math.floor(i / 2) % 2 ? 'rail' : 'railPost', {
          rotation: q.clone(),
          jitter: 0,
        });
      }
    }

    // Support pillars every 12 m (visual only) for a sense of height.
    if (i % 12 === 6) {
      const h = 30;
      blocks.addBox({ x: mid.x, y: mid.y - thickness - h / 2, z: mid.z }, { x: 1.2, y: h, z: 1.2 }, 'pillar');
    }
  });
}

/**
 * Nearest strip to a point, searching a window around `hint` (strip index).
 * Returns {index, dist, t} where t ∈ [0,1] is the position along the strip.
 */
export function nearestStrip(strips, p, hint = 0, back = 6, ahead = 25) {
  let best = { index: hint, dist: Infinity, t: 0 };
  const lo = Math.max(0, hint - back);
  const hi = Math.min(strips.length - 1, hint + ahead);
  const ab = new THREE.Vector3();
  const ap = new THREE.Vector3();
  for (let i = lo; i <= hi; i++) {
    const s = strips[i];
    ab.subVectors(s.b, s.a);
    ap.subVectors(p, s.a);
    const t = THREE.MathUtils.clamp(ap.dot(ab) / ab.lengthSq(), 0, 1);
    const d = ap.addScaledVector(ab, -t).length();
    if (d < best.dist) best = { index: i, dist: d, t };
  }
  return best;
}
