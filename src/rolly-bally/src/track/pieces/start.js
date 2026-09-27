// Wide start pad: room for the player + 3 AI balls, then a taper down to the
// track width. The player's slot (0) is in front, center; AI slots behind.

export const START_PAD_WIDTH = 10;

export default {
  id: 'start',
  name: 'Wide pad (start)',
  kind: 'gate',
  build(o) {
    const w = o.width;
    const W = Math.max(w, START_PAD_WIDTH);
    const spread = Math.min(2.8, W / 2 - 1.2);
    return {
      sections: [
        { len: 9, width: W, color: 'start' },
        { len: 5, width: W, widthEnd: w },
      ],
      features: [
        { type: 'checkpoint', s: 6, start: true },
        { type: 'startLine', s: 7.5 },
        {
          type: 'start',
          s: 6,
          slots: [
            { s: 6, lateral: 0 },
            { s: 3, lateral: -spread },
            { s: 3, lateral: spread },
            { s: 3, lateral: 0 },
          ],
        },
      ],
    };
  },
};
