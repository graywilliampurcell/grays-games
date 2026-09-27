import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { initRapier, Physics } from '../src/core/Physics.js';
import { buildTrack } from '../src/track/TrackBuilder.js';
import { Hammer, WreckingBall, Spinner, MovingPlatform } from '../src/track/hazards/index.js';
import { rotateVec } from '../src/track/math.js';

beforeAll(async () => {
  await initRapier();
});

// A frame for a road running along -Z at the origin.
const frame = (width) => ({ position: { x: 0, y: 0, z: 0 }, yaw: 0, forward: { x: 0, y: 0, z: -1 }, right: { x: 1, y: 0, z: 0 }, width });

describe('hazard poses (pure)', () => {
  for (const width of [3, 4, 8]) {
    for (const side of [-1, 1]) {
      it(`hammer w${width} side ${side}: closes across the road, opens clear of it`, () => {
        const cfg = Hammer.config(frame(width), width, { side });
        const hw = width / 2;
        const armAt = (t, d) => {
          const p = Hammer.pose(cfg, t);
          const v = rotateVec(p.rotation, { x: d, y: 0, z: 0 });
          return { x: p.position.x + v.x, z: p.position.z + v.z };
        };
        // Closed: sin = -1 → t with omega*t = 3PI/2.
        const tClosed = (1.5 * Math.PI) / cfg.omega;
        expect(Hammer.angle(cfg, tClosed)).toBeCloseTo(0, 9);
        const tip = armAt(tClosed, cfg.length);
        const base = armAt(tClosed, 0.4);
        expect(Math.min(tip.x, base.x)).toBeLessThan(-hw);
        expect(Math.max(tip.x, base.x)).toBeGreaterThan(hw);
        expect(tip.z).toBeCloseTo(0, 6);
        // Open: sin = 1 → arm along the edge, outside the road.
        const tOpen = (0.5 * Math.PI) / cfg.omega;
        for (const d of [0.4, cfg.length / 2, cfg.length]) {
          const p = armAt(tOpen, d);
          expect(Math.abs(p.x)).toBeGreaterThan(hw + 0.3);
          expect(p.z).toBeLessThanOrEqual(1e-9); // points forward (-Z)
        }
      });
    }

    it(`wrecking ball w${width}: hangs low and swings past both edges`, () => {
      const cfg = WreckingBall.config(frame(width), width, {});
      const c0 = WreckingBall.ballCenter(cfg, 0);
      expect(c0.x).toBeCloseTo(0, 6);
      expect(c0.y).toBeCloseTo(0.9, 6);
      let minX = Infinity;
      let maxX = -Infinity;
      for (let t = 0; t < 4; t += 0.01) {
        const c = WreckingBall.ballCenter(cfg, t);
        minX = Math.min(minX, c.x);
        maxX = Math.max(maxX, c.x);
        expect(c.z).toBeCloseTo(0, 6); // swings across, not along
        // Pose quaternion agrees with ballCenter.
        const p = WreckingBall.pose(cfg, t);
        const v = rotateVec(p.rotation, { x: 0, y: -cfg.chain, z: 0 });
        expect(p.position.x + v.x).toBeCloseTo(c.x, 6);
        expect(p.position.y + v.y).toBeCloseTo(c.y, 6);
      }
      expect(minX).toBeLessThan(-width / 2 + 0.2);
      expect(maxX).toBeGreaterThan(width / 2 - 0.2);
    });

    it(`spinner w${width}: rotates and fits inside the road`, () => {
      const cfg = Spinner.config(frame(width), width, {});
      expect(cfg.barLength).toBeLessThan(width);
      expect(Spinner.angle(cfg, 1) - Spinner.angle(cfg, 0)).toBeCloseTo(cfg.omega, 9);
    });

    it(`moving platform w${width}: lines up with the road and always overlaps it`, () => {
      const cfg = MovingPlatform.config(frame(width), width, {});
      expect(MovingPlatform.offset(cfg, 0)).toBeCloseTo(0, 9);
      const far = cfg.travel;
      const overlap = width / 2 - (far - cfg.platformWidth / 2);
      expect(overlap).toBeGreaterThanOrEqual(0.8 - 1e-9);
      let maxOff = 0;
      for (let t = 0; t < 6; t += 0.05) maxOff = Math.max(maxOff, Math.abs(MovingPlatform.offset(cfg, t)));
      expect(maxOff).toBeCloseTo(far, 1);
    });
  }
});

/** A plain dynamic ball tagged like the player so hazards/sensors react to it. */
function addBall(physics, position) {
  const fake = { pushes: 0, push(i) { this.pushes++; this.body.applyImpulse(i, true); }, boosts: 0, boost() { this.boosts++; } };
  const { body } = physics.addDynamicBall({ position, radius: 0.5, mass: 1, friction: 0.8, restitution: 0.2, angularDamping: 0.6, tag: 'ball', data: fake });
  fake.body = body;
  return fake;
}

function run(physics, track, seconds, each) {
  const dt = 1 / 60;
  for (let i = 0; i < seconds * 60; i++) {
    track.update(dt);
    physics.step(dt);
    each?.();
  }
}

describe('hazards shove the ball (Rapier)', () => {
  for (const [id, lateral] of [['hammer', 0], ['wrecking-ball', 0], ['spinner', 1.1]]) {
    it(`${id} knocks a resting ball away at a plausible speed`, () => {
      const physics = new Physics();
      let hits = 0;
      const track = buildTrack({
        physics,
        scene: new THREE.Scene(),
        pieces: ['straight', id, 'straight'],
        options: { width: 4, rails: 'none' },
        handlers: { onHazardHit: () => hits++ },
      });
      const hz = track.features.find((f) => f.type === 'hazard');
      const start = { x: hz.position.x + hz.right.x * lateral, y: hz.position.y + 0.5, z: hz.position.z + hz.right.z * lateral };
      const ball = addBall(physics, start);
      let maxSpeed = 0;
      run(physics, track, 5, () => {
        const v = ball.body.linvel();
        maxSpeed = Math.max(maxSpeed, Math.hypot(v.x, v.z));
      });
      const p = ball.body.translation();
      const moved = Math.hypot(p.x - start.x, p.z - start.z);
      expect(hits).toBeGreaterThan(0);
      expect(moved).toBeGreaterThan(1);
      expect(maxSpeed).toBeGreaterThan(2);
      expect(maxSpeed).toBeLessThan(25);
      expect(Number.isFinite(p.y)).toBe(true);
      track.dispose();
      physics.dispose();
    });
  }

  it('moving platform carries a ball sideways', () => {
    const physics = new Physics();
    const track = buildTrack({ physics, scene: new THREE.Scene(), pieces: ['straight', 'moving-platform', 'straight'], options: { width: 4 } });
    const hz = track.features.find((f) => f.type === 'hazard');
    const ball = addBall(physics, { x: hz.position.x, y: hz.position.y + 0.55, z: hz.position.z });
    const cfg = track.hazards[0].cfg;
    run(physics, track, Math.PI / 2 / cfg.omega); // quarter period: platform at full travel
    const p = ball.body.translation();
    const lateral = (p.x - hz.position.x) * hz.right.x + (p.z - hz.position.z) * hz.right.z;
    expect(lateral).toBeGreaterThan(cfg.travel * 0.7);
    expect(p.y).toBeGreaterThan(hz.position.y + 0.3); // still riding on top
    track.dispose();
    physics.dispose();
  });
});
