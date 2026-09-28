// Pathways P2: dark tunnels — layout, roads through them, and how dark it
// gets where.
import { describe, it, expect } from 'vitest';
import { FEATURE_SPECS, featureToWorld } from '../src/playground/Features.js';
import { tunnelLocal, darknessAt, FADE_BLOCKS } from '../src/pathways/darkTunnel.js';
import { generatePathways } from '../src/pathways/PathwaysGenerator.js';

const S = FEATURE_SPECS.darkTunnels;

describe('dark tunnel layout', () => {
  it('is ~12 blocks long, straight, walled both sides, no branches', () => {
    const [v0, v1] = S.inside;
    expect(v1 - v0).toBe(12);
    for (let v = 0; v < S.L; v++) {
      for (let u = 0; u < S.W; u++) {
        const wall = u === 0 || u === S.W - 1;
        expect(S.blocked(u, v)).toBe(wall && v >= v0 && v < v1);
      }
    }
    // One way in at each end, on the middle line.
    expect(S.access).toEqual([[2, 0], [2, S.L - 1]]);
  });

  it('local coordinates invert featureToWorld in every direction', () => {
    for (let dir = 0; dir < 4; dir++) {
      const f = { type: 'darkTunnels', dir, X0: -7, Z0: 11 };
      for (const [u, v] of [[0, 0], [2.5, 7], [4.9, 13.9], [1.2, 3.3]]) {
        const p = featureToWorld(f, u, v);
        const l = tunnelLocal(f, p.x, p.z);
        expect(l.u).toBeCloseTo(u, 9);
        expect(l.v).toBeCloseTo(v, 9);
      }
    }
  });
});

describe('darkness', () => {
  const [v0, v1] = S.inside;
  const mid = (v0 + v1) / 2;

  it('is full in the middle and zero outside the tunnel', () => {
    expect(darknessAt(2.5, mid)).toBe(1);
    expect(darknessAt(2.5, v0 - 0.5)).toBe(0);
    expect(darknessAt(2.5, v1 + 0.5)).toBe(0);
    expect(darknessAt(0.5, mid)).toBe(0); // inside a wall
    expect(darknessAt(2.5, mid, S.height + 1)).toBe(0); // on the roof
  });

  it('fades in over the first 2 blocks and out over the last 2', () => {
    expect(FADE_BLOCKS).toBe(2);
    expect(darknessAt(2.5, v0 + FADE_BLOCKS)).toBe(1);
    expect(darknessAt(2.5, v1 - FADE_BLOCKS)).toBe(1);
    const inRamp = [0.25, 0.5, 1, 1.5, 1.75].map((d) => darknessAt(2.5, v0 + d));
    for (let i = 1; i < inRamp.length; i++) expect(inRamp[i]).toBeGreaterThan(inRamp[i - 1]);
    expect(darknessAt(2.5, v0 + 1)).toBeCloseTo(0.5, 5);
    expect(darknessAt(2.5, v1 - 1)).toBeCloseTo(0.5, 5);
  });
});

describe('dark tunnels in Pathways worlds', () => {
  it('get placed, and a road runs straight through the inside', () => {
    let seen = 0;
    for (const size of ['small', 'medium', 'large']) {
      for (const bumpiness of ['flat', 'hilly', 'mountains']) {
        const w = generatePathways({ size, bumpiness, stuff: ['darkTunnels'], seed: `dark-${size}-${bumpiness}` });
        const tunnels = w.features.filter((f) => f.type === 'darkTunnels');
        expect(tunnels.length).toBeGreaterThan(0);
        for (const f of tunnels) {
          seen++;
          // Every inside cell on the middle line is road.
          for (let v = S.inside[0]; v < S.inside[1]; v++) {
            const p = featureToWorld(f, 2.5, v + 0.5);
            const i = Math.floor(p.x + w.n / 2) * w.n + Math.floor(p.z + w.n / 2);
            expect(w.paths.cells[i]).toBeGreaterThan(0);
          }
          // And stars inside for sparkle.
          const inside = w.stars.filter((s) => {
            const l = tunnelLocal(f, s.x, s.z);
            return darknessAt(l.u, l.v, s.y - f.y) > 0.9;
          });
          expect(inside.length).toBeGreaterThanOrEqual(2);
        }
      }
    }
    expect(seen).toBeGreaterThan(9);
  });

  it('Playground never places them', () => {
    const w = generatePathways({ size: 'medium', stuff: ['bouncy', 'ramps', 'trick'], seed: 'no-dark' });
    expect(w.features.some((f) => f.type === 'darkTunnels')).toBe(false);
  });
});
