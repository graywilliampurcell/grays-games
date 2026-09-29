// Pad: a flat road section of any width, optionally tapering, with an
// optional low wall across it. Not a race piece (not in PIECES, so the race
// generator and the gallery never pick it); Pathways' sky roads use it for
// the start pad, fork and merge pads and the end pad.
// Params: len (m), width, widthEnd (default width), color (palette key),
// wallAt (m from the piece start: a wall across the whole pad).

export default {
  id: 'pad',
  name: 'Pad',
  kind: 'pad',
  build(o) {
    const width = o.width;
    const sec = { len: o.len ?? 6, width, widthEnd: o.widthEnd ?? width };
    if (o.color) sec.color = o.color;
    return {
      sections: [sec],
      features: o.wallAt != null ? [{ type: 'wall', s: o.wallAt }] : [],
    };
  },
};
