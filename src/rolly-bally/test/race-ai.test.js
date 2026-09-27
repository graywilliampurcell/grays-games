import { describe, it, expect } from 'vitest';
import { AiDriver } from '../src/race/AiRacer.js';
import { generateTrack } from '../src/track/TrackGenerator.js';
import { getDifficulty, RACE_TUNING } from '../src/race/difficulty.js';
import { Rng } from '../src/core/Rng.js';

const DT = 1 / 60;

function setup(d, seed = 'ai') {
  const g = generateTrack({ difficulty: d, seed });
  const level = getDifficulty(d);
  const rng = new Rng(seed);
  const drivers = [1, 2, 3].slice(0, level.opponents).map((k) => new AiDriver({ track: g.layout, slot: g.layout.startSlots[k], level, rng: rng.fork(`r${k}`) }));
  return { layout: g.layout, level, drivers };
}

/** Run a race where the player moves at a fixed pace (m/s along the track). */
function run(d, playerPace, seed) {
  const { layout, level, drivers } = setup(d, seed);
  let ps = layout.startSlots[0].s;
  let maxLead = -Infinity;
  let t = 0;
  while (ps < layout.finish.s && t < 300) {
    ps += playerPace * DT;
    t += DT;
    for (const a of drivers) {
      a.step(DT, ps, playerPace);
      maxLead = Math.max(maxLead, a.s - ps);
    }
  }
  return { drivers, maxLead, level, place: 1 + drivers.filter((a) => a.finished).length };
}

describe('AiDriver', () => {
  it('is deterministic for a seed', () => {
    const a = setup(3, 'det').drivers;
    const b = setup(3, 'det').drivers;
    for (let i = 0; i < 600; i++) {
      for (const x of [...a, ...b]) x.step(DT, 50, 5);
    }
    a.forEach((x, i) => {
      expect(b[i].s).toBe(x.s);
      expect(b[i].lateral).toBe(x.lateral);
    });
  });

  it('cruises at about aiSpeed × speed cap when level with the player', () => {
    const { level, drivers } = setup(2);
    const a = drivers[0];
    for (let i = 0; i < 60 * 4; i++) a.step(DT, a.s, 5);
    const base = level.speedCap * level.aiSpeed;
    expect(a.speed).toBeGreaterThan(base * (1 - RACE_TUNING.aiSkillSpread) - 0.01);
    expect(a.speed).toBeLessThan(base * (1 + RACE_TUNING.aiSkillSpread) + 0.01);
  });

  it('rubber-bands: never runs away from a slow player', () => {
    for (let d = 1; d <= 5; d++) {
      const L = getDifficulty(d);
      const { maxLead } = run(d, L.speedCap * 0.5, `slow${d}`);
      // Slows to match past leadCap (a little more while ramping down).
      expect(maxLead, `level ${d}`).toBeLessThan(L.leadCap + 5);
    }
  });

  it('a player at the speed cap wins; level 1 opponents are slower than cruising', () => {
    for (let d = 1; d <= 5; d++) {
      const L = getDifficulty(d);
      expect(run(d, L.speedCap, `fast${d}`).place).toBe(1);
    }
    const L1 = getDifficulty(1);
    expect(run(1, L1.speedCap * L1.cruise, 'cruise').place).toBe(1);
  });

  it('speeds up (a little) when the player is far ahead', () => {
    const { level, drivers } = setup(4);
    const a = drivers[0];
    const base = a.baseSpeed;
    expect(a.targetSpeed(a.s + 100, 10)).toBeGreaterThan(base);
    expect(a.targetSpeed(a.s + 100, 10)).toBeLessThanOrEqual(base * RACE_TUNING.aiCatchUp + 1e-9);
    expect(a.targetSpeed(a.s - level.leadCap - 20, 0)).toBeCloseTo(base * RACE_TUNING.aiMinFraction, 6);
  });

  it('stays in the safe lanes (on the road) and stops after the finish', () => {
    for (let d = 1; d <= 5; d++) {
      const { layout, drivers } = setup(d, `lanes${d}`);
      const lane = { min: 0, max: 0 };
      let steps = 0;
      while (steps++ < 60 * 120) {
        for (const a of drivers) {
          a.step(DT, a.s, 8);
          const f = layout.spline.sampleAt(a.s);
          layout.laneAt(a.s, lane);
          if (f.floor) expect(Math.abs(a.lateral)).toBeLessThan(f.width / 2);
        }
      }
      for (const a of drivers) {
        expect(a.finished).toBe(true);
        expect(a.s).toBeLessThan(layout.finish.s + 12);
        expect(a.speed).toBeLessThan(0.5);
      }
    }
  });
});
