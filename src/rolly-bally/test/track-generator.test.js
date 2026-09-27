import { describe, it, expect } from 'vitest';
import { generateTrack, checkTrackRules, validateLayout, isChallenge } from '../src/track/TrackGenerator.js';
import { getDifficulty, RACE_TUNING } from '../src/race/difficulty.js';
import { getPiece } from '../src/track/Catalog.js';
import { TrackLayout } from '../src/track/TrackLayout.js';
import { wrapAngle } from '../src/track/math.js';

const SEEDS = 40;
const id = (e) => (typeof e === 'string' ? e : e.id);

describe('TrackGenerator determinism', () => {
  it('same seed ⇒ same track; different seeds differ', () => {
    for (let d = 1; d <= 5; d++) {
      const a = generateTrack({ difficulty: d, seed: '🍎🐶🚀⚽' });
      const b = generateTrack({ difficulty: d, seed: '🍎🐶🚀⚽' });
      expect(b.pieces).toEqual(a.pieces);
      expect(b.options).toEqual(a.options);
      const others = ['x', 'y', 'z'].map((s) => JSON.stringify(generateTrack({ difficulty: d, seed: s }).pieces));
      expect(new Set([JSON.stringify(a.pieces), ...others]).size).toBeGreaterThan(2);
    }
  });

  it('options follow the level', () => {
    for (let d = 1; d <= 5; d++) {
      const g = generateTrack({ difficulty: d, seed: 'opts' });
      const L = getDifficulty(d);
      expect(g.options.width).toBe(L.width);
      expect(g.options.rails).toBe(L.rails);
    }
  });
});

for (let d = 1; d <= 5; d++) {
  describe(`level ${d}: ${SEEDS} generated tracks obey the rules`, () => {
    const L = getDifficulty(d);
    const tracks = [];
    for (let i = 0; i < SEEDS; i++) tracks.push(generateTrack({ difficulty: d, seed: `rules-${d}-${i}` }));

    it('pass the generator validation', () => {
      for (const g of tracks) {
        expect(g.errors, `${g.seed}: ${g.errors.join('; ')}`).toEqual([]);
        expect(checkTrackRules(g.pieces, d)).toEqual([]);
        expect(validateLayout(new TrackLayout(g.pieces, g.options), d)).toEqual([]);
      }
    });

    it('start → finish, allow-listed pieces only, length per table', () => {
      for (const g of tracks) {
        const ids = g.pieces.map(id);
        expect(ids[0]).toBe('start');
        expect(ids[ids.length - 1]).toBe('finish');
        for (const x of ids.slice(1, -1)) expect(x === 'checkpoint' || x === 'straight' || x in L.pieces, x).toBe(true);
        const finish = g.layout.finish.s;
        expect(finish).toBeGreaterThanOrEqual(L.length - 2);
        expect(finish).toBeLessThanOrEqual(L.length * 1.08);
      }
    });

    it('a checkpoint gate right before every gap; boost before every launch', () => {
      for (const g of tracks) {
        const ids = g.pieces.map(id);
        ids.forEach((x, i) => {
          if (!getPiece(x).gap) return;
          if (x === 'launch') {
            expect(ids[i - 1]).toBe('boost');
            expect(ids[i - 2]).toBe('checkpoint');
          } else {
            expect(ids[i - 1], `${x} in ${g.seed}`).toBe('checkpoint');
          }
        });
        // And the respawn point for a gap is right in front of it.
        for (const z of g.layout.gapZones) {
          const cp = g.layout.checkpointBefore(z.s0);
          expect(z.s0 - cp.s).toBeLessThan(20); // launch: gate + boost pad + run-up
        }
      }
    });

    it('checkpoints about every 20 m', () => {
      const gaps = [];
      for (const g of tracks) {
        const s = g.layout.checkpoints.map((c) => c.s);
        for (let i = 1; i < s.length; i++) gaps.push(s[i] - s[i - 1]);
        // Nothing near the finish is far from a checkpoint either.
        expect(g.layout.finish.s - s[s.length - 1]).toBeLessThan(RACE_TUNING.checkpointSpacing + 12);
      }
      const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      expect(avg).toBeGreaterThan(15);
      expect(avg).toBeLessThan(25);
      // A launch (boost + ramp + landing) is the longest stretch.
      expect(Math.max(...gaps)).toBeLessThan(d === 5 ? 46 : 32);
    });

    it(d <= 3 ? 'never two hazards/gaps in a row' : `at most ${L.maxChallengeRun} hazards/gaps in a row`, () => {
      const limit = d <= 3 ? 1 : L.maxChallengeRun;
      for (const g of tracks) {
        let run = 0;
        for (const x of g.pieces.map(id)) {
          if (isChallenge(x)) run++;
          else if (x !== 'checkpoint' && x !== 'boost') run = 0;
          expect(run, g.seed).toBeLessThanOrEqual(limit);
        }
      }
    });

    it('hazards and gaps match the level', () => {
      for (const g of tracks) {
        for (const x of g.pieces.map(id)) {
          const p = getPiece(x);
          if (p.hazard) expect(L.hazards).toContain(x);
          if (d <= 2) expect(p.gap).toBe(false);
          if (d === 3 && p.gap) expect(x).toBe('gap-bridged');
        }
        if (d === 1) {
          // Level 1: full rails everywhere there is road, and no holes: you can't fall off.
          expect(g.layout.gapZones).toEqual([]);
          expect(g.layout.hazardZones).toEqual([]);
          for (const st of g.layout.strips) {
            expect(st.floor).toBe(true);
            expect(st.rails).toBe(true);
          }
        }
      }
    });

    it('heading stays within ±90° and the AI path is continuous', () => {
      for (const g of tracks) {
        for (const st of g.layout.strips) expect(Math.abs(wrapAngle(st.yaw))).toBeLessThanOrEqual(Math.PI / 2 + 1e-6);
        const lay = g.layout;
        for (const lane of [-1, 0, 1]) {
          let prev = null;
          for (let s = 0; s <= lay.finish.s + 5; s += 0.2) {
            const p = lay.aiPointAt(s, lane);
            if (prev) expect(Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z)).toBeLessThan(0.2 * 4);
            prev = { ...p };
          }
        }
      }
    });

    it('uses a variety of the allowed pieces', () => {
      const seen = new Set(tracks.flatMap((g) => g.pieces.map(id)));
      for (const x of Object.keys(L.pieces)) expect(seen.has(x), x).toBe(true);
    });
  });
}

describe('checkTrackRules catches broken lists', () => {
  it('flags a gap without a checkpoint, a launch without a boost, back-to-back hazards', () => {
    expect(checkTrackRules(['start', 'straight', 'gap-bridged', 'finish'], 3).join()).toMatch(/not preceded/);
    expect(checkTrackRules(['start', 'checkpoint', 'launch', 'finish'], 5).join()).toMatch(/not preceded/);
    expect(checkTrackRules(['start', 'hammer', 'bumpers', 'finish'], 3).join()).toMatch(/in a row/);
    expect(checkTrackRules(['start', 'hammer', 'finish'], 1).join()).toMatch(/not allowed/);
    expect(checkTrackRules(['start', 'checkpoint', 'gap-open', 'finish'], 3).join()).toMatch(/open gap/);
    expect(checkTrackRules(['start', 'straight', 'finish'], 1)).toEqual([]);
  });
});
