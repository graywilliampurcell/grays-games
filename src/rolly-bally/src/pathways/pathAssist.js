// Path assist (pure): the small sideways nudge that keeps a ball near the
// middle of a Pathways road while the finger points roughly along it.

export const ASSIST = {
  minInput: 0.25, // stick deflection before assist kicks in
  minAlign: 0.7, // |cos| between finger direction and the road
  pull: 5, // m/s² per meter off the centerline
  maxPull: 3.5, // m/s² cap
};

/**
 * Pure: sideways acceleration (x, z) that nudges a ball back toward the road
 * centerline, or null when there is no assist (off-road, finger not along
 * the road, no input).
 * @param {{x, z}} ball  position
 * @param {{x, z, dx, dz}} point  nearest centerline point (unit dir dx, dz)
 * @param {{x, z}} want  world-space stick direction (any length ≤ 1)
 */
export function assistAccel(ball, point, want) {
  const mag = Math.hypot(want.x, want.z);
  if (!point || mag < ASSIST.minInput) return null;
  const align = Math.abs((want.x * point.dx + want.z * point.dz) / mag);
  if (align < ASSIST.minAlign) return null;
  const ox = ball.x - point.x;
  const oz = ball.z - point.z;
  const along = ox * point.dx + oz * point.dz;
  const sx = ox - along * point.dx; // sideways offset from the centerline
  const sz = oz - along * point.dz;
  const off = Math.hypot(sx, sz);
  if (off < 0.15) return null;
  const k = Math.min(ASSIST.maxPull, off * ASSIST.pull) * ((align - ASSIST.minAlign) / (1 - ASSIST.minAlign));
  return { x: (-sx / off) * k, z: (-sz / off) * k };
}
