// Spinner: a bar rotating around a post in the middle of the road.
// Params: phase, speed.

export default {
  id: 'spinner',
  name: 'Spinner',
  kind: 'hazard',
  hazard: true,
  build(o) {
    return {
      sections: [{ len: 12 }],
      features: [{ type: 'hazard', hazard: 'spinner', s: 6, zone: [4, 4], params: { phase: o.phase ?? 0, speed: o.speed ?? 1 } }],
    };
  },
};
