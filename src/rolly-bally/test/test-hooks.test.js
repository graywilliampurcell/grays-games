import { describe, it, expect } from 'vitest';
import { normalizeTestInput, samplePolyline, arcLengths, plain, EventLog, TEST_DT } from '../src/debug/testHookUtils.js';
import { parseUrlParams } from '../src/app/params.js';

describe('test hook helpers', () => {
  it('uses a fixed 1/60 s step', () => {
    expect(TEST_DT).toBe(1 / 60);
  });

  it('normalizes bot input like the joystick (unit disc, deadzone)', () => {
    expect(normalizeTestInput({ x: 0, y: 1 })).toEqual({ x: 0, y: 1, jump: false, active: true });
    const d = normalizeTestInput({ x: 3, y: 4, jump: 1 });
    expect(d.x).toBeCloseTo(0.6);
    expect(d.y).toBeCloseTo(0.8);
    expect(d.jump).toBe(true);
    expect(normalizeTestInput({ x: 0.05, y: 0 }).active).toBe(false);
    expect(normalizeTestInput({ x: 'nope' })).toEqual({ x: 0, y: 0, jump: false, active: false });
    expect(normalizeTestInput(null).active).toBe(false);
  });

  it('samples a polyline ahead of s', () => {
    const pts = [
      { x: 0, y: 0, z: 0, width: 8 },
      { x: 0, y: 0, z: -10, width: 4 },
      { x: 10, y: 0, z: -10, width: 2 },
    ];
    const s = arcLengths(pts);
    expect(s).toEqual([0, 10, 20]);
    const a = samplePolyline(pts, s, 5, 4, 5);
    expect(a.map((p) => p.s)).toEqual([5, 10, 15, 20]);
    expect(a[0]).toMatchObject({ x: 0, z: -5, width: 8 });
    expect(a[2]).toMatchObject({ x: 5, z: -10, width: 4 });
    // Stops at the end of the line.
    expect(samplePolyline(pts, s, 18, 10, 5)).toHaveLength(2);
  });

  it('makes values JSON-safe and logs events on the simulated clock', () => {
    expect(plain({ a: { x: 1.23456, y: 2, z: 3 }, f: () => 1, n: 1 / 3 })).toEqual({ a: { x: 1.235, y: 2, z: 3 }, n: 0.333 });
    let t = 0;
    const log = new EventLog(() => t);
    log.push('start', { mode: 'race' });
    t = 1.5;
    log.push('checkpoint', { index: 2 });
    expect(log.list).toEqual([
      { t: 0, type: 'start', mode: 'race' },
      { t: 1.5, type: 'checkpoint', index: 2 },
    ]);
    log.clear();
    expect(log.list).toEqual([]);
  });

  it('parses ?test=1 without changing the rest of the URL params', () => {
    expect(parseUrlParams('?mode=test-track&test=1')).toMatchObject({ test: true, debug: false, mode: 'test-track' });
    expect(parseUrlParams('?gallery=1')).toMatchObject({ test: false, mode: 'gallery' });
    expect(parseUrlParams('')).toMatchObject({ test: false, mode: null });
  });
});
