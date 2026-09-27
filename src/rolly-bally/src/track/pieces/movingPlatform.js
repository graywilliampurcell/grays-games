// Moving platform: a hole in the road with a platform sliding sideways across
// it; roll on when it lines up. Params: phase, speed.

export const MOVING_GAP = 7;

export default {
  id: 'moving-platform',
  name: 'Moving platform',
  kind: 'hazard',
  hazard: true,
  gap: true,
  build(o) {
    return {
      sections: [{ len: 3 }, { len: MOVING_GAP, floor: false }, { len: 3 }],
      features: [
        { type: 'gapMarker', s: 3, len: MOVING_GAP },
        {
          type: 'hazard',
          hazard: 'movingPlatform',
          s: 3 + MOVING_GAP / 2,
          zone: [MOVING_GAP / 2, MOVING_GAP / 2],
          params: { length: MOVING_GAP - 0.1, phase: o.phase ?? 0, speed: o.speed ?? 1 },
        },
      ],
    };
  },
};
