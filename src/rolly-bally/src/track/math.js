// Small pure helpers shared by the track kit (no three.js, testable in node).
//
// Heading convention (CONTRACT §8): yaw 0 faces -Z, positive yaw turns left.
//   forward(yaw) = (-sin yaw, 0, -cos yaw)
//   right(yaw)   = ( cos yaw, 0, -sin yaw)

export const deg = (d) => (d * Math.PI) / 180;

export function forwardXZ(yaw) {
  return { x: -Math.sin(yaw), z: -Math.cos(yaw) };
}

export function rightXZ(yaw) {
  return { x: Math.cos(yaw), z: -Math.sin(yaw) };
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothstep(t) {
  const u = clamp(t, 0, 1);
  return u * u * (3 - 2 * u);
}

/** Wrap an angle into (-PI, PI]. */
export function wrapAngle(a) {
  let d = a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Height profiles for sections that rise/fall: u in [0,1] → fraction of rise.
 *  linear  constant slope (kinks at both ends)
 *  smooth  smoothstep: starts and ends flat, steepest in the middle
 *  kick    u²: starts flat and gets steeper (ski-jump / launch lip)
 */
export const PROFILES = {
  linear: (u) => u,
  smooth: (u) => u * u * (3 - 2 * u),
  kick: (u) => u * u,
};

/** Quaternion {x,y,z,w} for a yaw (about +Y). */
export function yawQuat(yaw) {
  return { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) };
}

/** Quaternion product a*b (apply b first, then a). */
export function mulQuat(a, b) {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

/** Quaternion for a rotation of `angle` about a unit axis {x,y,z}. */
export function axisAngleQuat(axis, angle) {
  const s = Math.sin(angle / 2);
  return { x: axis.x * s, y: axis.y * s, z: axis.z * s, w: Math.cos(angle / 2) };
}

/** Rotate vector v by quaternion q. */
export function rotateVec(q, v) {
  // t = 2 * cross(q.xyz, v); v' = v + w*t + cross(q.xyz, t)
  const tx = 2 * (q.y * v.z - q.z * v.y);
  const ty = 2 * (q.z * v.x - q.x * v.z);
  const tz = 2 * (q.x * v.y - q.y * v.x);
  return {
    x: v.x + q.w * tx + (q.y * tz - q.z * ty),
    y: v.y + q.w * ty + (q.z * tx - q.x * tz),
    z: v.z + q.w * tz + (q.x * ty - q.y * tx),
  };
}
