// Finish gate: checkered arch, then a railed run-out with a soft end wall so
// nobody rolls off after crossing the line.

export default {
  id: 'finish',
  name: 'Finish gate',
  kind: 'gate',
  build() {
    return {
      sections: [{ len: 6, rails: 'always' }, { len: 14, rails: 'always' }],
      features: [
        { type: 'finish', s: 4 },
        { type: 'wall', s: 19.6 },
      ],
    };
  },
};
