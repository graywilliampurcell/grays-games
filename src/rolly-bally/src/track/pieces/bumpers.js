// Static bumpers: bouncy diamond posts in a weave the ball rolls between.
// Returns AI lanes that thread the gaps. Params: guard (true = rails on this
// piece whatever the track's rails setting; the generator uses it at level 3).

export const BUMPER_HALF = 0.45; // half size of the square post (rotated 45°)
export const BUMPER_REACH = BUMPER_HALF * Math.SQRT2; // half width across the path

function rowsFor(w) {
  if (w >= 5) {
    return [
      { s: 3.5, lats: [w * 0.15] },
      { s: 7, lats: [-w * 0.3, w * 0.3] },
      { s: 10.5, lats: [-w * 0.15] },
    ];
  }
  return [
    { s: 4, lats: [w * 0.18] },
    { s: 10, lats: [-w * 0.18] },
  ];
}

/** Widest free lateral interval between posts (inside the road). */
export function freeInterval(w, lats, margin = 0.6) {
  const edge = w / 2 - 0.2;
  const blocks = lats.map((l) => [l - BUMPER_REACH, l + BUMPER_REACH]).sort((a, b) => a[0] - b[0]);
  let best = null;
  let lo = -edge;
  for (const [b0, b1] of [...blocks, [edge, edge]]) {
    if (b0 - lo > (best ? best[1] - best[0] : -Infinity)) best = [lo, b0];
    lo = Math.max(lo, b1);
  }
  let min = best[0] + margin;
  let max = best[1] - margin;
  if (min > max) min = max = (best[0] + best[1]) / 2;
  return { min, max };
}

export default {
  id: 'bumpers',
  name: 'Static bumpers',
  kind: 'hazard',
  hazard: true,
  build(o) {
    const w = o.width;
    const features = [];
    const lanes = [];
    for (const row of rowsFor(w)) {
      for (const lateral of row.lats) features.push({ type: 'bumper', s: row.s, lateral, half: BUMPER_HALF });
      lanes.push({ s0: row.s - 1.2, s1: row.s + 1.2, ...freeInterval(w, row.lats) });
    }
    return { sections: [{ len: 14, rails: o.guard ? 'always' : undefined }], features, lanes };
  },
};
