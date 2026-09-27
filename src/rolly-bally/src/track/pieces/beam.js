// Narrow beam: the road tapers down to a thin plank with no rails, then back.
// Params: len (beam length, default 10).

export function beamWidth(w) {
  return Math.min(w, Math.max(1.6, Math.min(2.4, w * 0.45)));
}

export default {
  id: 'beam',
  name: 'Narrow beam',
  kind: 'beam',
  build(o) {
    const w = o.width;
    const bw = beamWidth(w);
    const len = o.len ?? 10;
    const half = Math.max(0, bw / 2 - 0.55);
    return {
      sections: [
        { len: 3, width: w, widthEnd: bw, rails: false },
        { len, width: bw, rails: false, color: 'white' },
        { len: 3, width: bw, widthEnd: w, rails: false },
      ],
      lanes: [{ s0: 2, s1: 4 + len, min: -half, max: half }],
    };
  },
};
