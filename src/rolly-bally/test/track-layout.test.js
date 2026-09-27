import { describe, it, expect } from 'vitest';
import { Rng } from '../src/core/Rng.js';
import { PIECE_IDS } from '../src/track/Catalog.js';
import { TrackLayout, STRIP_STEP } from '../src/track/TrackLayout.js';
import { BUMPER_REACH } from '../src/track/pieces/bumpers.js';
import { wrapAngle } from '../src/track/math.js';

const deg = (r) => (r * 180) / Math.PI;
const middle = PIECE_IDS.filter((id) => id !== 'start' && id !== 'finish');

function randomTrack(seed, n = 30) {
  const rng = new Rng(seed);
  const list = ['start'];
  for (let i = 0; i < n; i++) list.push(rng.pick(middle));
  list.push('finish');
  return list;
}

function rotY(x, z, yaw) {
  return { x: x * Math.cos(yaw) + z * Math.sin(yaw), z: -x * Math.sin(yaw) + z * Math.cos(yaw) };
}

describe('track chaining', () => {
  const cases = [];
  for (const seed of ['a', 'b', 'c', 'd']) for (const width of [3, 5, 8]) cases.push({ seed, width });

  for (const { seed, width } of cases) {
    it(`seed ${seed} width ${width}: exits connect to entries, spline is continuous`, () => {
      const list = randomTrack(seed);
      const t = new TrackLayout(list, { width, rails: 'curves', start: { x: 3, y: 1, z: -2, yaw: 0.4 } });

      // Each piece exit = its entry transformed by the piece's local exit.
      for (let i = 0; i < t.pieces.length; i++) {
        const p = t.pieces[i];
        if (i > 0) expect(p.entry).toEqual(t.pieces[i - 1].exit);
        const local = new TrackLayout([list[i]], { width, rails: 'curves' }).pieces[0].exit;
        const d = rotY(local.x, local.z, p.entry.yaw);
        expect(p.exit.x).toBeCloseTo(p.entry.x + d.x, 6);
        expect(p.exit.z).toBeCloseTo(p.entry.z + d.z, 6);
        expect(p.exit.y).toBeCloseTo(p.entry.y + local.y, 6);
        expect(p.exit.yaw).toBeCloseTo(p.entry.yaw + local.yaw, 9);
        expect(p.s0).toBeCloseTo(i ? t.pieces[i - 1].s1 : 0, 9);
      }

      // Strips chain end to start, with small steps in heading and floor slope.
      for (let i = 1; i < t.strips.length; i++) {
        const a = t.strips[i - 1];
        const b = t.strips[i];
        expect(b.a).toEqual(a.b);
        expect(b.yawA).toBeCloseTo(a.yawB, 12);
        expect(b.s0).toBeCloseTo(a.s1, 9);
        expect(Math.abs(deg(wrapAngle(b.yaw - a.yaw)))).toBeLessThan(10);
        if (a.floor && b.floor) expect(Math.abs(deg(b.pitch - a.pitch))).toBeLessThan(12);
        // Width changes smoothly except at declared bridge edges.
        if (Math.abs(b.widthA - a.widthB) > 1e-9) expect(a.capEnd && b.capStart).toBe(true);
      }

      // Spline samples are dense and continuous.
      const { spline } = t;
      expect(spline.length).toBeCloseTo(t.pieces[t.pieces.length - 1].s1, 6);
      for (let i = 1; i < spline.points.length; i++) {
        const d = spline.s[i] - spline.s[i - 1];
        expect(d).toBeGreaterThan(0.2);
        expect(d).toBeLessThanOrEqual(STRIP_STEP * 1.6);
      }
      let prev = spline.positionAt(0);
      for (let s = 0.25; s <= spline.length; s += 0.25) {
        const p = spline.positionAt(s);
        expect(Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z)).toBeLessThanOrEqual(0.2501);
        prev = p;
      }
    });
  }

  it('is deterministic', () => {
    const a = new TrackLayout(randomTrack('same'), { width: 5 });
    const b = new TrackLayout(randomTrack('same'), { width: 5 });
    expect(a.strips).toEqual(b.strips);
    expect(a.checkpoints.map((c) => c.s)).toEqual(b.checkpoints.map((c) => c.s));
  });
});

describe('track spline helpers', () => {
  const t = new TrackLayout(['start', 'straight', 'curve-gentle-left', 'ramp-up', 'curve-sharp-right', 'ramp-down', 'checkpoint', 'finish'], {
    width: 6,
  });

  it('samples frames: position, forward, right', () => {
    const f = t.spline.sampleAt(3);
    expect(f.position.x).toBeCloseTo(0, 9);
    expect(f.position.z).toBeCloseTo(-3, 9);
    expect(f.forward).toMatchObject({ x: expect.closeTo(0, 9), z: -1 });
    expect(f.right.x).toBeCloseTo(1, 9);
    expect(f.width).toBeCloseTo(10, 9); // start pad
    expect(f.floor).toBe(true);
  });

  it('nearest() round-trips s and lateral offset', () => {
    const rng = new Rng('near');
    for (let i = 0; i < 300; i++) {
      const s = rng.range(0, t.length);
      const lat = rng.range(-2, 2);
      const f = t.spline.sampleAt(s);
      const p = { x: f.position.x + f.right.x * lat, y: f.position.y + 0.5, z: f.position.z + f.right.z * lat };
      const n = t.nearest(p, s - 1);
      expect(n.s).toBeCloseTo(s, 0);
      expect(Math.abs(n.s - s)).toBeLessThan(0.35);
      expect(n.lateral).toBeCloseTo(lat, 1);
      const g = t.nearest(p); // global search agrees
      expect(Math.abs(g.s - n.s)).toBeLessThan(1e-6);
      expect(t.spline.progress(p)).toBeCloseTo(n.s / t.length, 6);
    }
  });

  it('checkpoints: start is first, checkpointBefore is monotonic', () => {
    expect(t.checkpoints.length).toBe(2);
    expect(t.checkpoints[0].start).toBe(true);
    expect(t.checkpointBefore(0).index).toBe(0);
    expect(t.checkpointBefore(t.length).index).toBe(1);
    const r = t.respawnAt(t.checkpoints[1]);
    expect(r.position.y).toBeGreaterThan(t.checkpoints[1].position.y + 0.5);
    expect(t.finish).toBeTruthy();
    expect(t.startSlots.length).toBe(4);
    // Player slot is in front of the AI slots.
    for (const slot of t.startSlots.slice(1)) expect(slot.s).toBeLessThan(t.startSlots[0].s);
  });
});

describe('AI safe path', () => {
  for (const width of [3, 4, 6, 8]) {
    it(`width ${width}: stays on the road and avoids bumpers`, () => {
      const t = new TrackLayout(randomTrack('ai' + width, 40), { width });
      for (let s = 0; s <= t.length; s += 0.2) {
        const f = t.spline.sampleAt(s);
        for (const lane of [-1, -0.5, 0, 0.5, 1]) {
          const off = t.aiOffsetAt(s, lane);
          expect(Math.abs(off)).toBeLessThanOrEqual(f.width / 2 - 0.5 + 1e-9);
        }
      }
      const bumpers = t.features.filter((f) => f.type === 'bumper');
      for (const b of bumpers) {
        for (let ds = -BUMPER_REACH - 0.5; ds <= BUMPER_REACH + 0.5; ds += 0.1) {
          for (const lane of [-1, 0, 1]) {
            const off = t.aiOffsetAt(b.s + ds, lane);
            expect(Math.abs(off - b.lateral)).toBeGreaterThanOrEqual(BUMPER_REACH + 0.5 - 1e-6);
          }
        }
      }
    });
  }

  it('exposes hazard, gap and boost zones', () => {
    const t = new TrackLayout(['start', 'boost', 'launch', 'hammer', 'gap-bridged', 'moving-platform', 'finish'], { width: 4 });
    expect(t.boostZones.length).toBe(1);
    expect(t.gapZones.length).toBe(3);
    expect(t.gapZones.find((g) => g.bridged)).toBeTruthy();
    expect(t.hazardZones.map((h) => h.type)).toEqual(['hammer', 'movingPlatform']);
    const launch = t.pieces[2];
    expect(t.isOverGap(launch.s0 + 11)).toBe(true);
    expect(t.inHazard(t.pieces[3].s0 + 6).type).toBe('hammer');
  });
});
