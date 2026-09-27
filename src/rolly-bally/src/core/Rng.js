// Seeded randomness. Every generated thing (tracks, terrain, AI wobble) must
// draw from an Rng built from the config seed so a seed reproduces exactly.
//
// Seeds are plain strings. The UI makes friendly 4-emoji seeds (see
// randomEmojiSeed); any other string (e.g. from the URL) is also a valid seed.

/** mulberry32: tiny, fast 32-bit PRNG. Returns a function yielding [0, 1). */
export function mulberry32(a) {
  let t = a >>> 0;
  return function next() {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** String → uint32 (cyrb53-style mixing, folded to 32 bits). */
export function hashString(str) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}

export class Rng {
  /** @param {string|number} seed */
  constructor(seed = 'rolly') {
    this.seed = String(seed);
    this._next = mulberry32(typeof seed === 'number' ? seed >>> 0 : hashString(this.seed));
  }

  /** Float in [0, 1). */
  next() {
    return this._next();
  }

  /** Float in [min, max). */
  range(min, max) {
    return min + (max - min) * this._next();
  }

  /** Integer in [min, max] (inclusive). */
  int(min, max) {
    return min + Math.floor(this._next() * (max - min + 1));
  }

  /** True with probability p. */
  chance(p) {
    return this._next() < p;
  }

  /** Random element of a non-empty array. */
  pick(arr) {
    return arr[Math.floor(this._next() * arr.length)];
  }

  /**
   * Weighted pick. Accepts either [{item, weight}] or (items, weightFn).
   * Items with weight <= 0 are never picked. Returns undefined if all weights are 0.
   */
  weighted(items, weightFn) {
    const entries = weightFn
      ? items.map((item) => ({ item, weight: weightFn(item) }))
      : items;
    let total = 0;
    for (const e of entries) total += Math.max(0, e.weight);
    if (total <= 0) return undefined;
    let r = this._next() * total;
    for (const e of entries) {
      const w = Math.max(0, e.weight);
      if (r < w) return e.item;
      r -= w;
    }
    return entries[entries.length - 1].item;
  }

  /** Fisher-Yates shuffle, returns a new array. */
  shuffle(arr) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this._next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /**
   * Independent child stream, e.g. rng.fork('ai') so that adding draws to the
   * track generator doesn't change the AI wobble for the same seed.
   */
  fork(label) {
    return new Rng(`${this.seed}/${label}`);
  }
}

// 64 kid-friendly, single-code-point emoji (no ZWJ / variation selectors),
// so 4 of them encode 24 bits.
export const SEED_EMOJI = Array.from(
  '🍎🍌🍇🍉🍓🍒🍍🥕🌽🍄🌵🌲🌻🌷🍀🌈' +
  '🐶🐱🐭🐰🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🐔🐧' +
  '🐢🐙🦀🐳🐬🐟🦋🐝🐞🦄🐲🦖🚀🚗🚂🚲' +
  '⚽🏀🎈🎁🎨🎸🎺🥁👑💎🔔🍩🍪🎂🍦🧁'
);

export const EMOJI_SEED_LENGTH = 4;

/** 24-bit integer → 4-emoji string. */
export function encodeEmojiSeed(n) {
  let v = n & 0xffffff;
  let out = '';
  for (let i = 0; i < EMOJI_SEED_LENGTH; i++) {
    out = SEED_EMOJI[v & 63] + out;
    v >>>= 6;
  }
  return out;
}

/** 4-emoji string → 24-bit integer, or null if it isn't a valid emoji seed. */
export function decodeEmojiSeed(str) {
  if (typeof str !== 'string') return null;
  const chars = Array.from(str);
  if (chars.length !== EMOJI_SEED_LENGTH) return null;
  let v = 0;
  for (const c of chars) {
    const idx = SEED_EMOJI.indexOf(c);
    if (idx < 0) return null;
    v = (v << 6) | idx;
  }
  return v;
}

export function isEmojiSeed(str) {
  return decodeEmojiSeed(str) !== null;
}

/** Fresh random 4-emoji seed string (uses Math.random: only for *choosing* a seed). */
export function randomEmojiSeed() {
  return encodeEmojiSeed(Math.floor(Math.random() * 0x1000000));
}
