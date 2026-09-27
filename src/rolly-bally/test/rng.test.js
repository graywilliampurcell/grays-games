import { describe, it, expect } from 'vitest';
import {
  Rng, mulberry32, hashString, encodeEmojiSeed, decodeEmojiSeed, isEmojiSeed, randomEmojiSeed, SEED_EMOJI,
} from '../src/core/Rng.js';

describe('Rng', () => {
  it('is deterministic for the same seed', () => {
    const a = new Rng('🍎🐶🚀⚽');
    const b = new Rng('🍎🐶🚀⚽');
    const seqA = Array.from({ length: 50 }, () => a.next());
    const seqB = Array.from({ length: 50 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('differs for different seeds', () => {
    expect(new Rng('a').next()).not.toEqual(new Rng('b').next());
  });

  it('mulberry32 yields values in [0, 1)', () => {
    const next = mulberry32(12345);
    for (let i = 0; i < 1000; i++) {
      const v = next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('hashString is stable', () => {
    expect(hashString('rolly')).toBe(hashString('rolly'));
    expect(hashString('rolly')).not.toBe(hashString('bally'));
  });

  it('helpers stay in range', () => {
    const r = new Rng('helpers');
    for (let i = 0; i < 500; i++) {
      const n = r.int(1, 5);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(5);
      const f = r.range(-2, 3);
      expect(f).toBeGreaterThanOrEqual(-2);
      expect(f).toBeLessThan(3);
      expect(['x', 'y', 'z']).toContain(r.pick(['x', 'y', 'z']));
    }
  });

  it('weighted respects zero weights and both call styles', () => {
    const r = new Rng('w');
    for (let i = 0; i < 200; i++) {
      expect(r.weighted([{ item: 'a', weight: 0 }, { item: 'b', weight: 1 }])).toBe('b');
      expect(r.weighted(['a', 'b'], (x) => (x === 'a' ? 1 : 0))).toBe('a');
    }
    expect(r.weighted([{ item: 'a', weight: 0 }])).toBeUndefined();
  });

  it('fork gives independent, deterministic streams', () => {
    const a = new Rng('s').fork('ai');
    const b = new Rng('s').fork('ai');
    const c = new Rng('s').fork('track');
    expect(a.next()).toBe(b.next());
    expect(new Rng('s').fork('ai').next()).not.toBe(c.next());
  });
});

describe('emoji seeds', () => {
  it('has 64 unique single-code-point emoji', () => {
    expect(SEED_EMOJI.length).toBe(64);
    expect(new Set(SEED_EMOJI).size).toBe(64);
  });

  it('round-trips integers', () => {
    for (const n of [0, 1, 63, 64, 4095, 123456, 0xffffff]) {
      const s = encodeEmojiSeed(n);
      expect(Array.from(s).length).toBe(4);
      expect(decodeEmojiSeed(s)).toBe(n);
    }
  });

  it('rejects non-emoji seeds', () => {
    expect(decodeEmojiSeed('abcd')).toBeNull();
    expect(decodeEmojiSeed('🍎🍎🍎')).toBeNull();
    expect(isEmojiSeed(randomEmojiSeed())).toBe(true);
  });
});
