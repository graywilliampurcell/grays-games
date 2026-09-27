import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { initRapier, Physics } from '../src/core/Physics.js';
import { buildTrack } from '../src/track/TrackBuilder.js';
import { PIECE_IDS } from '../src/track/Catalog.js';

beforeAll(async () => {
  await initRapier();
});

const DOWN = { x: 0, y: -1, z: 0 };

function drawCalls(scene) {
  let n = 0;
  scene.traverse((o) => {
    if (o.isMesh || o.isLine) n++;
  });
  return n;
}

function fakeBall(physics, position, velocity) {
  const ball = { boosts: 0, pushes: 0, boost() { this.boosts++; }, push(i) { this.pushes++; this.body.applyImpulse(i, true); } };
  const { body } = physics.addDynamicBall({ position, radius: 0.5, mass: 1, friction: 0.8, restitution: 0.2, angularDamping: 0.6, tag: 'ball', data: ball });
  ball.body = body;
  if (velocity) {
    body.setLinvel(velocity, true);
    // Already rolling (ω × up = v / r) so friction doesn't eat the speed.
    body.setAngvel({ x: velocity.z / 0.5, y: 0, z: -velocity.x / 0.5 }, true);
  }
  return ball;
}

describe('TrackBuilder', () => {
  for (const width of [3, 8]) {
    it(`width ${width}: every floor sample of every piece has road under it`, () => {
      const physics = new Physics();
      const scene = new THREE.Scene();
      const track = buildTrack({ physics, scene, pieces: ['start', ...PIECE_IDS.filter((id) => id !== 'start')], options: { width } });
      physics.step();
      let checked = 0;
      for (let s = 0.3; s < track.length - 0.3; s += 0.5) {
        const f = track.spline.sampleAt(s);
        if (!f.floor) continue;
        for (const lat of [-0.45, 0, 0.45]) {
          const o = lat * f.width;
          const origin = { x: f.position.x + f.right.x * o, y: f.position.y + 3, z: f.position.z + f.right.z * o };
          const hit = physics.raycast(origin, DOWN, 6);
          const tag = hit && physics.info(hit.collider)?.tag;
          if (tag === 'hazard' || tag === 'bumper' || tag === 'hazard-static') continue;
          expect(tag, `s=${s.toFixed(1)} ${track.pieceAt(s).id}`).toBe('track');
          expect(hit.point.y).toBeCloseTo(f.position.y, 1);
          checked++;
        }
      }
      expect(checked).toBeGreaterThan(500);
      // Gaps really are holes.
      for (const g of track.gapZones.filter((z) => !z.bridged)) {
        const f = track.spline.sampleAt((g.s0 + g.s1) / 2);
        const hit = physics.raycast({ x: f.position.x, y: f.position.y + 3, z: f.position.z }, DOWN, 10);
        expect(hit && physics.info(hit.collider)?.tag === 'track').toBeFalsy();
      }
      track.dispose();
      expect(physics.bodies.size).toBe(0);
      expect(scene.children.length).toBe(0);
      physics.dispose();
    });
  }

  it('stays inside the Race draw-call budget', () => {
    const physics = new Physics();
    const scene = new THREE.Scene();
    const pieces = ['start', 'hammer', 'curve-gentle-left', 'wrecking-ball', 'spinner', 'bumpers', 'hammer', 'moving-platform', 'wrecking-ball', 'finish'];
    const track = buildTrack({ physics, scene, pieces, options: { width: 4 } });
    // road + blocks (≤ 2) + one per moving hazard
    expect(drawCalls(scene)).toBeLessThanOrEqual(3 + track.hazards.length);
    expect(track.hazards.length).toBe(6);
    track.dispose();
    physics.dispose();
  });

  it('rebuilds cleanly in the same world', () => {
    const physics = new Physics();
    const scene = new THREE.Scene();
    for (let i = 0; i < 3; i++) {
      const t = buildTrack({ physics, scene, pieces: ['start', 'hammer', 'finish'] });
      t.update(1 / 60);
      physics.step();
      t.dispose();
    }
    expect(physics.bodies.size).toBe(0);
    physics.dispose();
  });

  it('fires checkpoint, boost and finish sensors for the player ball', () => {
    const physics = new Physics();
    const events = [];
    const track = buildTrack({
      physics,
      scene: new THREE.Scene(),
      pieces: ['start', 'checkpoint', 'boost', 'finish'],
      options: { width: 6 },
      handlers: {
        onCheckpoint: (c) => events.push(c.start ? 'start' : 'checkpoint'),
        onBoost: () => events.push('boost'),
        onFinish: () => events.push('finish'),
      },
    });
    const slot = track.startSlots[3]; // behind the start line
    fakeBall(physics, slot.position, { x: slot.forward.x * 8, y: 0, z: slot.forward.z * 8 });
    for (let i = 0; i < 60 * 6; i++) {
      track.update(1 / 60);
      physics.step(1 / 60);
    }
    expect(events.slice(0, 4)).toEqual(['start', 'checkpoint', 'boost', 'finish']);
    physics.dispose();
  });

  it('default boost handler calls ball.boost', () => {
    const physics = new Physics();
    const track = buildTrack({ physics, scene: new THREE.Scene(), pieces: ['straight', 'boost', 'straight'] });
    const f = track.spline.sampleAt(4);
    const ball = fakeBall(physics, { x: f.position.x, y: 0.55, z: f.position.z }, { x: f.forward.x * 6, y: 0, z: f.forward.z * 6 });
    for (let i = 0; i < 120; i++) physics.step(1 / 60);
    expect(ball.boosts).toBe(1);
    physics.dispose();
  });

  it('rails keep a ball on the road (straight and curve)', () => {
    const physics = new Physics();
    const track = buildTrack({ physics, scene: new THREE.Scene(), pieces: ['straight', 'curve-sharp-left', 'straight'], options: { width: 4, rails: 'full' } });
    expect(track.bodies.length).toBe(2); // road + rails, each one trimesh
    for (const s of [6, 20]) {
      for (const side of [-1, 1]) {
        const f = track.spline.sampleAt(s);
        const v = { x: f.right.x * side * 10, y: 0, z: f.right.z * side * 10 };
        const ball = fakeBall(physics, { x: f.position.x, y: 0.55, z: f.position.z }, v);
        for (let i = 0; i < 60; i++) physics.step(1 / 60);
        const n = track.nearest(ball.body.translation(), s);
        expect(Math.abs(n.lateral)).toBeLessThan(2);
        expect(n.height).toBeGreaterThan(0);
        physics.remove(ball.body);
      }
    }
    physics.dispose();
  });

  it('the finish run-out ends in a wall', () => {
    const physics = new Physics();
    let bumps = 0;
    const track = buildTrack({ physics, scene: new THREE.Scene(), pieces: ['finish'], handlers: { onBumper: () => bumps++ } });
    const wall = track.features.find((f) => f.type === 'wall');
    const p = { x: wall.position.x - wall.forward.x * 3, y: 0.55, z: wall.position.z - wall.forward.z * 3 };
    const ball = fakeBall(physics, p, { x: wall.forward.x * 6, y: 0, z: wall.forward.z * 6 });
    for (let i = 0; i < 90; i++) physics.step(1 / 60);
    expect(bumps).toBeGreaterThan(0);
    expect(track.nearest(ball.body.translation()).s).toBeLessThan(wall.s);
    physics.dispose();
  });

  it('bumpers bounce the ball away', () => {
    const physics = new Physics();
    let bumps = 0;
    const track = buildTrack({ physics, scene: new THREE.Scene(), pieces: ['straight', 'bumpers', 'straight'], options: { width: 6 }, handlers: { onBumper: () => bumps++ } });
    const b = track.features.find((f) => f.type === 'bumper');
    const start = { x: b.position.x + b.right.x * b.lateral - b.forward.x * 3, y: 0.55, z: b.position.z + b.right.z * b.lateral - b.forward.z * 3 };
    const ball = fakeBall(physics, start, { x: b.forward.x * 6, y: 0, z: b.forward.z * 6 });
    let minAlong = Infinity;
    let bounced = false;
    for (let i = 0; i < 90; i++) {
      physics.step(1 / 60);
      const v = ball.body.linvel();
      if (v.x * b.forward.x + v.z * b.forward.z < -1) bounced = true;
      const p = ball.body.translation();
      minAlong = Math.min(minAlong, Math.hypot(p.x - b.position.x - b.right.x * b.lateral, p.z - b.position.z - b.right.z * b.lateral));
    }
    expect(bumps).toBeGreaterThan(0);
    expect(ball.pushes).toBeGreaterThan(0);
    expect(bounced).toBe(true);
    expect(minAlong).toBeGreaterThan(0.5); // never went through it
    physics.dispose();
  });

  for (const [id, speed] of [['launch', 11], ['gap-open', 7.5]]) {
    it(`${id}: a ball at ${speed} m/s clears the gap and lands on the road`, () => {
      const physics = new Physics();
      const track = buildTrack({ physics, scene: new THREE.Scene(), pieces: ['straight', id, 'straight'], options: { width: 5 } });
      const gap = track.gapZones[0];
      const f = track.spline.sampleAt(track.pieces[1].s0);
      const ball = fakeBall(physics, { x: f.position.x, y: f.position.y + 0.5, z: f.position.z }, { x: f.forward.x * speed, y: 0, z: f.forward.z * speed });
      let hint = track.pieces[1].s0;
      let crossed = false;
      for (let i = 0; i < 60 * 3; i++) {
        // Keep pushing like a player holding forward at the speed cap.
        const v = ball.body.linvel();
        const along = v.x * f.forward.x + v.z * f.forward.z;
        if (along < speed) ball.body.applyImpulse({ x: f.forward.x * 0.2, y: 0, z: f.forward.z * 0.2 }, true);
        physics.step(1 / 60);
        const n = track.nearest(ball.body.translation(), hint);
        hint = n.s;
        if (n.s > gap.s1 + 1) crossed = true;
        expect(n.height).toBeGreaterThan(-2); // never fell into the gap
      }
      expect(crossed).toBe(true);
      physics.dispose();
    });
  }
});
