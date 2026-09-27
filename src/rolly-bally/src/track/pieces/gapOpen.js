// Gap (open): a small hole with a little kicker in front; roll fast to hop it
// (the far side is a bit lower so it's forgiving).

const OPEN_GAP = 2.2;
const KICK = { len: 2.5, rise: 0.35 };
const DROP = 0.9;

export default {
  id: 'gap-open',
  name: 'Gap (open)',
  kind: 'gap',
  gap: true,
  build(o) {
    const len = o.len ?? OPEN_GAP;
    return {
      sections: [
        { len: 3 },
        { len: KICK.len, rise: KICK.rise, profile: 'kick', color: 'orange' },
        { len, rise: -DROP, startSlope: (2 * KICK.rise) / KICK.len, floor: false },
        { len: 5 },
      ],
      features: [{ type: 'gapMarker', s: 3 + KICK.len, len }],
    };
  },
};
