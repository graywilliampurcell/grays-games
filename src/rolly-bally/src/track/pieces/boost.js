// Boost pad: cyan chevrons on the road; rolling over them gives a speed boost.

export default {
  id: 'boost',
  name: 'Boost pad',
  kind: 'boost',
  build(o) {
    return {
      sections: [{ len: o.len ?? 8 }],
      features: [{ type: 'boost', s: 4, len: 4 }],
    };
  },
};
