// Swinging hammer: a post beside the road with an arm at ball height that
// sweeps across the road and back (sinusoidal). Params: side (+1 right / -1
// left post), phase (radians), speed (x opts.hazardSpeed).

export default {
  id: 'hammer',
  name: 'Swinging hammer',
  kind: 'hazard',
  hazard: true,
  build(o) {
    return {
      sections: [{ len: 14 }],
      features: [
        { type: 'hazard', hazard: 'hammer', s: 6, zone: [2, 7], params: { side: o.side ?? 1, phase: o.phase ?? 0, speed: o.speed ?? 1 } },
      ],
    };
  },
};
