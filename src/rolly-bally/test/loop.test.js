import { describe, it, expect } from 'vitest';
import { Loop, FIXED_DT } from '../src/core/Loop.js';

function makeLoop() {
  const calls = { update: 0, alphas: [] };
  const loop = new Loop({
    update: (dt) => {
      expect(dt).toBe(FIXED_DT);
      calls.update++;
    },
    render: (alpha) => calls.alphas.push(alpha),
  });
  return { loop, calls };
}

describe('Loop accumulator', () => {
  it('runs one step per 1/60 s frame', () => {
    const { loop, calls } = makeLoop();
    for (let i = 0; i < 60; i++) loop.tick(1 / 60 + 1e-9);
    expect(calls.update).toBe(60);
    expect(calls.alphas.length).toBe(60);
  });

  it('accumulates short frames (120 Hz)', () => {
    const { loop, calls } = makeLoop();
    for (let i = 0; i < 120; i++) loop.tick(1 / 120 + 1e-9);
    expect(calls.update).toBe(60);
    for (const a of calls.alphas) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(1);
    }
  });

  it('caps sub-steps at 3 and drops the backlog', () => {
    const { loop, calls } = makeLoop();
    const steps = loop.tick(0.2);
    expect(steps).toBe(3);
    expect(loop.accumulator).toBeLessThan(FIXED_DT);
    loop.tick(1 / 60 + 1e-9);
    expect(calls.update).toBe(4);
  });

  it('ignores negative frame times', () => {
    const { loop, calls } = makeLoop();
    expect(loop.tick(-1)).toBe(0);
    expect(calls.update).toBe(0);
  });
});
