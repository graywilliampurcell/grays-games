// Straight: plain flat road. Params: len (m, default 12).
export default {
  id: 'straight',
  name: 'Straight',
  kind: 'path',
  build(o) {
    return { sections: [{ len: o.len ?? 12 }] };
  },
};
