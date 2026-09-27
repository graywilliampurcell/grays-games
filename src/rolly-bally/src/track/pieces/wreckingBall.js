// Wrecking ball: a big ball on a chain hanging from a gantry, swinging across
// the road like a pendulum. Params: phase, speed.

export default {
  id: 'wrecking-ball',
  name: 'Wrecking ball',
  kind: 'hazard',
  hazard: true,
  build(o) {
    return {
      sections: [{ len: 12 }],
      features: [{ type: 'hazard', hazard: 'wreckingBall', s: 6, zone: [2, 2], params: { phase: o.phase ?? 0, speed: o.speed ?? 1 } }],
    };
  },
};
