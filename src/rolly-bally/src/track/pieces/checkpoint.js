// Checkpoint gate: a pink arch; passing it moves the respawn point here.

export default {
  id: 'checkpoint',
  name: 'Checkpoint gate',
  kind: 'gate',
  build() {
    return {
      sections: [{ len: 5 }],
      features: [{ type: 'checkpoint', s: 2.5 }],
    };
  },
};
