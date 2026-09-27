import { describe, it, expect } from 'vitest';
import {
  DIFFICULTIES,
  RACE_TUNING,
  getDifficulty,
  medalForPlace,
  cupForPlaces,
  cupForMedals,
  raceSeed,
} from '../src/race/difficulty.js';
import { PIECES, hasPiece, getPiece } from '../src/track/Catalog.js';

// Plan §3.5, column by column.
const PLAN = [
  { width: 8, rails: 'full', gaps: 'none', speedCap: 6, autoRoll: true, opponents: 2, length: 120 },
  { width: 6, rails: 'full', gaps: 'none', speedCap: 7, autoRoll: true, opponents: 2, length: 150 },
  { width: 5, rails: 'curves', gaps: 'bridged', speedCap: 8, autoRoll: true, opponents: 3, length: 180 },
  { width: 4, rails: 'none', gaps: 'small', speedCap: 10, autoRoll: false, opponents: 3, length: 220 },
  { width: 3, rails: 'none', gaps: 'jumps', speedCap: 12, autoRoll: false, opponents: 3, length: 260 },
];

describe('difficulty ladder', () => {
  it('matches the plan table', () => {
    expect(DIFFICULTIES.length).toBe(5);
    DIFFICULTIES.forEach((d, i) => {
      expect(d.level).toBe(i + 1);
      expect(d).toMatchObject(PLAN[i]);
    });
    expect(RACE_TUNING.checkpointSpacing).toBe(20);
  });

  it('gets harder monotonically', () => {
    for (let i = 1; i < 5; i++) {
      const a = DIFFICULTIES[i - 1];
      const b = DIFFICULTIES[i];
      expect(b.width).toBeLessThan(a.width);
      expect(b.speedCap).toBeGreaterThan(a.speedCap);
      expect(b.length).toBeGreaterThan(a.length);
      expect(b.opponents).toBeGreaterThanOrEqual(a.opponents);
    }
  });

  it('allow-lists only name real pieces, allowed hazards and fitting gaps', () => {
    for (const d of DIFFICULTIES) {
      const ids = Object.keys(d.pieces);
      expect(ids).toContain('straight');
      for (const id of ids) {
        expect(hasPiece(id), id).toBe(true);
        expect(d.pieces[id]).toBeGreaterThan(0);
        const p = getPiece(id);
        if (p.hazard) expect(d.hazards, `${id} at ${d.level}`).toContain(id);
        if (p.gap) expect(d.gaps).not.toBe('none');
        expect(['start', 'finish', 'checkpoint']).not.toContain(id);
      }
      for (const h of d.hazards) expect(ids).toContain(h);
    }
    // Level 1: nothing to fall into or get hit by.
    expect(Object.keys(DIFFICULTIES[0].pieces).some((id) => getPiece(id).hazard || getPiece(id).gap)).toBe(false);
    // Level 3: only bridged gaps; launch ramps only at 5.
    expect(Object.keys(DIFFICULTIES[2].pieces).filter((id) => getPiece(id).gap)).toEqual(['gap-bridged']);
    for (const d of DIFFICULTIES) if (d.level < 5) expect(d.pieces.launch).toBeUndefined();
    expect(DIFFICULTIES[4].pieces.launch).toBeGreaterThan(0);
    expect(DIFFICULTIES[4].pieces.boost).toBeGreaterThan(0);
  });

  it('every catalog piece is used by some level (or is a gate)', () => {
    for (const p of PIECES) {
      if (['start', 'finish', 'checkpoint'].includes(p.id)) continue;
      expect(DIFFICULTIES.some((d) => p.id in d.pieces), p.id).toBe(true);
    }
  });

  it('opponent speeds: slower than the player at level 1, near the plan elsewhere', () => {
    expect(DIFFICULTIES[0].aiSpeed).toBeLessThan(DIFFICULTIES[0].cruise);
    for (const d of DIFFICULTIES) {
      expect(d.aiSpeed).toBeGreaterThan(0.5);
      expect(d.aiSpeed).toBeLessThanOrEqual(RACE_TUNING.aiSpeedFraction);
      expect(d.leadCap).toBeGreaterThan(0);
    }
  });

  it('getDifficulty clamps', () => {
    expect(getDifficulty(0).level).toBe(1);
    expect(getDifficulty(9).level).toBe(5);
    expect(getDifficulty('3').level).toBe(3);
    expect(getDifficulty(undefined).level).toBe(1);
  });
});

describe('medals and cups', () => {
  it('place → medal', () => {
    expect([1, 2, 3, 4, 5].map(medalForPlace)).toEqual(['gold', 'silver', 'bronze', 'ribbon', 'ribbon']);
  });

  it('cup from average place (CONTRACT §7)', () => {
    expect(cupForPlaces([1, 1, 2])).toBe('gold'); // 1.33
    expect(cupForPlaces([1, 2])).toBe('gold'); // 1.5
    expect(cupForPlaces([2, 2, 3])).toBe('silver');
    expect(cupForPlaces([3, 4])).toBe('bronze'); // 3.5
    expect(cupForPlaces([4, 4, 3])).toBe('ribbon');
    expect(cupForPlaces([])).toBe('ribbon');
    expect(cupForMedals(['gold', 'silver'])).toBe('gold');
    expect(cupForMedals(['ribbon', 'bronze'])).toBe('bronze');
  });

  it('race seeds are distinct and stable', () => {
    expect(raceSeed('🍎🐶🚀⚽', 0)).toBe(raceSeed('🍎🐶🚀⚽', 0));
    expect(raceSeed('abc', 0)).not.toBe(raceSeed('abc', 1));
  });
});
