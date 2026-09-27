import { describe, it, expect } from 'vitest';
import { SKINS, STARTER_SKIN_IDS, UNLOCK_ORDER, getSkin } from '../src/ball/skinData.js';

const PATTERNS = ['solid', 'soccer', 'stripes', 'checker', 'dots', 'rainbow', 'swirl', 'face', 'stars'];

describe('skin catalog', () => {
  it('has unique ids and valid data', () => {
    const ids = SKINS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SKINS) {
      expect(PATTERNS).toContain(s.pattern);
      expect(s.colors.length).toBeGreaterThan(0);
      for (const c of s.colors) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('6 starters (plan §3.7) and every other skin is unlockable in order', () => {
    expect(STARTER_SKIN_IDS).toHaveLength(6);
    expect([...STARTER_SKIN_IDS, ...UNLOCK_ORDER].sort()).toEqual(SKINS.map((s) => s.id).sort());
    expect(UNLOCK_ORDER.some((id) => STARTER_SKIN_IDS.includes(id))).toBe(false);
  });

  it('getSkin falls back to the first skin', () => {
    expect(getSkin('rainbow').id).toBe('rainbow');
    expect(getSkin('nope')).toBe(SKINS[0]);
  });
});
