// Launch ramp + landing: a ski-jump kicker, an open gap the ball flies over,
// and a long, wider landing that is lower than the lip. Needs speed: the
// generator puts a boost pad before it. Over the gap the center line follows
// a rough flight arc (the AI path), with no floor.
//
// Tuned for difficulty 5 (speed cap 12 m/s, +50% while boosted). Climbing the
// lip costs speed (gravity is -20): 12 m/s at the foot flies ~6.7 m, a boosted
// ball ~13 m; 8 m/s without a boost falls short (the boost pad is the point).

const KICK_LEN = 4;
const KICK_RISE = 0.8;
const GAP = 3.5;
const DROP = 2; // landing is this far below the lip

export default {
  id: 'launch',
  name: 'Launch ramp + landing',
  kind: 'gap',
  gap: true,
  build(o) {
    const w = o.width;
    const land = w + 2;
    const kickSlope = (2 * KICK_RISE) / KICK_LEN; // end slope of the u² profile
    return {
      sections: [
        { len: 4 },
        { len: KICK_LEN, rise: KICK_RISE, profile: 'kick', color: 'orange', rails: false },
        { len: GAP, rise: -DROP, startSlope: kickSlope, floor: false, width: w, widthEnd: land },
        { len: 16, width: land },
        { len: 3, width: land, widthEnd: w },
      ],
      features: [{ type: 'gapMarker', s: 4 + KICK_LEN, len: GAP }],
    };
  },
};
