// Pathways P3: trick mountain — star cost, launch height, scoring, landing
// aim, layout and the road to it.
import { describe, it, expect } from 'vitest';
import {
  launchSpeed, peakHeight, starsForHeight, trickCost, aimBack, timeToLand, STAR_HEIGHTS, LAUNCH, METER_MAX,
} from '../src/pathways/trick.js';
import { FEATURE_SPECS, featureToWorld } from '../src/playground/Features.js';
import { GRAVITY } from '../src/core/Physics.js';
import { generatePathways } from '../src/pathways/PathwaysGenerator.js';
import { PATHWAYS_TUNING } from '../src/pathways/PathwaysMode.js';

describe('trick scoring', () => {
  it('costs 1 star if you have any, free at 0', () => {
    expect(trickCost(0)).toBe(0);
    expect(trickCost(1)).toBe(1);
    expect(trickCost(57)).toBe(1);
  });

  it('earns 1 star for a small hop up to 5 for a huge one', () => {
    expect(starsForHeight(0)).toBe(1);
    expect(starsForHeight(STAR_HEIGHTS[0] - 0.01)).toBe(1);
    STAR_HEIGHTS.forEach((h, i) => expect(starsForHeight(h)).toBe(i + 2));
    expect(starsForHeight(1000)).toBe(5);
  });

  it('faster in goes higher, and every launch pays back at least what it cost', () => {
    let last = 0;
    for (let s = 0; s <= 12; s += 0.5) {
      const vy = launchSpeed(s);
      expect(vy).toBeGreaterThanOrEqual(last);
      last = vy;
      const stars = starsForHeight(peakHeight(vy));
      expect(stars).toBeGreaterThanOrEqual(1);
      expect(stars - trickCost(1)).toBeGreaterThanOrEqual(0); // never a loss
    }
    expect(launchSpeed(0)).toBe(LAUNCH.min);
    expect(launchSpeed(100)).toBe(LAUNCH.max);
  });

  it('a slow roll is a small hop; full speed reaches 5 stars', () => {
    expect(starsForHeight(peakHeight(launchSpeed(2)))).toBe(1);
    expect(starsForHeight(peakHeight(launchSpeed(6)))).toBe(3);
    expect(starsForHeight(peakHeight(launchSpeed(PATHWAYS_TUNING.speedCap)))).toBe(5);
    expect(peakHeight(LAUNCH.max)).toBeLessThanOrEqual(METER_MAX + 1);
  });

  it('peak height matches the physics gravity', () => {
    expect(peakHeight(10)).toBeCloseTo(100 / (2 * -GRAVITY), 9);
  });

  it('aims the flight back onto the pad', () => {
    // The launch line to the pad center, as laid out.
    const S = FEATURE_SPECS.trick;
    const from = { x: 2.5, z: S.launch };
    const to = { x: 2.5, z: (S.pad[0] + S.pad[1]) / 2 };
    for (const vy of [LAUNCH.min, 15, LAUNCH.max]) {
      const v = aimBack(from, to, vy);
      const t = (2 * vy) / -GRAVITY;
      expect(from.x + v.x * t).toBeCloseTo(to.x, 9);
      expect(from.z + v.z * t).toBeCloseTo(to.z, 9);
      expect(Math.hypot(v.x, v.z)).toBeLessThan(vy / 2.5); // mostly straight up
    }
  });

  it('re-aiming mid-flight still lands on the pad', () => {
    // Simulate a flight with air drag, re-aiming every step like the game.
    const to = { x: 0, z: 0 };
    for (const vy0 of [LAUNCH.min, 16, LAUNCH.max]) {
      const p = { x: 0.4, y: 0, z: 3 };
      let vy = vy0;
      const dt = 1 / 60;
      for (let i = 0; i < 600; i++) {
        const v = aimBack(p, to, vy, p.y);
        p.x += v.x * 0.98 * dt; // 2% drag
        p.z += v.z * 0.98 * dt;
        vy += GRAVITY * dt;
        p.y += vy * dt;
        if (p.y <= 0 && vy < 0) break;
      }
      expect(Math.hypot(p.x - to.x, p.z - to.z)).toBeLessThan(0.3);
    }
    expect(timeToLand(0, 10)).toBeCloseTo((2 * 10) / -GRAVITY, 9);
  });
});

describe('trick mountain layout', () => {
  const S = FEATURE_SPECS.trick;

  it('run-up, then soft pad, then the launch line at the mountain foot', () => {
    expect(S.pad[0]).toBeGreaterThanOrEqual(5); // a long straight run-up first
    expect(S.pad[1]).toBeLessThan(S.launch);
    expect(S.launch).toBeLessThan(S.foot);
    for (let v = 0; v < S.L; v++) {
      for (let u = 0; u < S.W; u++) expect(S.blocked(u, v)).toBe(v >= S.foot);
    }
    expect(S.access).toEqual([[2, 0]]);
  });

  it('gets placed in Pathways worlds with a road up the run-up', () => {
    let seen = 0;
    for (const size of ['small', 'medium', 'large']) {
      for (const bumpiness of ['flat', 'hilly', 'mountains']) {
        const w = generatePathways({ size, bumpiness, stuff: ['trick'], seed: `trick-${size}-${bumpiness}` });
        const tricks = w.features.filter((f) => f.type === 'trick');
        expect(tricks.length).toBeGreaterThan(0);
        for (const f of tricks) {
          seen++;
          for (let v = 0; v <= 10; v++) {
            const p = featureToWorld(f, 2.5, v + 0.5);
            const i = Math.floor(p.x + w.n / 2) * w.n + Math.floor(p.z + w.n / 2);
            expect(w.paths.cells[i], `v=${v}`).toBeGreaterThan(0);
          }
        }
      }
    }
    expect(seen).toBeGreaterThan(9);
  });
});
