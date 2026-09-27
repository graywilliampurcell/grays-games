// Gap (bridged): a hole in the road with a narrow wooden bridge down the middle.

export default {
  id: 'gap-bridged',
  name: 'Gap (bridged)',
  kind: 'gap',
  gap: true,
  build(o) {
    const w = o.width;
    const bridge = Math.min(w, Math.max(2.5, w * 0.55));
    const len = o.len ?? 3;
    return {
      sections: [
        { len: 3 },
        // Only 'full' rails keep rails on the bridge.
        { len, width: bridge, color: 'wood', edge: false, rails: o.rails === 'full' ? undefined : false },
        { len: 3 },
      ],
      lanes: [{ s0: 3, s1: 3 + len, min: -(bridge / 2 - 0.6), max: bridge / 2 - 0.6 }],
      features: [{ type: 'gapMarker', s: 3, len, bridge }],
    };
  },
};
