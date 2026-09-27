// Ramps: smooth hill up or down (flat at both ends, steepest in the middle:
// 3 m over 12 m peaks at about 20°). Params: len, rise (m, positive).

function makeRamp(id, name, sign) {
  return {
    id,
    name,
    kind: 'ramp',
    build(o) {
      const rise = Math.abs(o.rise ?? 3) * sign;
      return { sections: [{ len: o.len ?? 12, rise, profile: 'smooth' }] };
    },
  };
}

export const rampUp = makeRamp('ramp-up', 'Uphill ramp', 1);
export const rampDown = makeRamp('ramp-down', 'Downhill ramp', -1);
