// Seeded random numbers for bots, so every run reproduces from its seed.

/** mulberry32: small, fast, good enough for test inputs. Returns () => [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Helpers on top of a () => [0,1) source. */
export function makeRng(seed) {
  const next = mulberry32(seed);
  const rng = {
    seed,
    next,
    range: (a, b) => a + (b - a) * next(),
    int: (a, b) => a + Math.floor(next() * (b - a + 1)), // inclusive
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    /** Weighted pick: items [{w, ...}] or parallel weights array. */
    weighted(items, weights = items.map((i) => i.w)) {
      const total = weights.reduce((s, w) => s + w, 0);
      let r = next() * total;
      for (let i = 0; i < items.length; i++) {
        r -= weights[i];
        if (r <= 0) return items[i];
      }
      return items[items.length - 1];
    },
    /** Approximately normal (sum of uniforms), mean 0, sd 1. */
    gauss() {
      let s = 0;
      for (let i = 0; i < 6; i++) s += next();
      return (s - 3) / Math.SQRT1_2; // variance of the sum is 6/12
    },
  };
  return rng;
}
