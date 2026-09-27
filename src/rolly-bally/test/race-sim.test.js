import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as THREE from 'three';
import { initRapier, Physics } from '../src/core/Physics.js';
import { RaceSim } from '../src/race/RaceSim.js';
import { Rng } from '../src/core/Rng.js';
import { RACE_TUNING, raceSeed } from '../src/race/difficulty.js';

// Ball skins paint a <canvas>; give node a do-nothing one.
const hadDocument = 'document' in globalThis;
beforeAll(async () => {
  await initRapier();
  if (!hadDocument) {
    const ctx2d = new Proxy({}, { get: () => () => {}, set: () => true });
    globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }) };
  }
});
afterAll(() => {
  if (!hadDocument) delete globalThis.document;
});

const DT = 1 / 60;

function makeSim(difficulty, seed, events = []) {
  const physics = new Physics();
  const sim = new RaceSim({ physics, scene: new THREE.Scene(), difficulty, seed, onEvent: (n, d) => events.push([n, d]) });
  return { physics, sim, events };
}

function step(physics, sim, move) {
  sim.update(DT, move);
  physics.step(DT);
  sim.postStep(DT);
}

describe('RaceSim', () => {
  it('is frozen until GO, then the auto-roll ball races to the finish', () => {
    const { physics, sim, events } = makeSim(1, 'go');
    const start = sim.ball.getPosition().clone();
    for (let i = 0; i < 60; i++) step(physics, sim, { x: 0, y: 1 });
    expect(sim.ball.getPosition().distanceTo(start)).toBeLessThan(0.01);
    expect(sim.racers.every((r) => r.driver.speed === 0)).toBe(true);
    sim.start();
    let steps = 0;
    while (!sim.finished && steps++ < 60 * 90) step(physics, sim, { x: 0, y: 0 });
    expect(sim.finished).toBe(true);
    expect(sim.place).toBeGreaterThanOrEqual(1);
    expect(events.some(([n]) => n === 'checkpoint')).toBe(true);
    expect(events.filter(([n]) => n === 'finish').length).toBe(1);
    sim.dispose();
    expect(physics.bodies.size).toBe(0);
    physics.dispose();
  });

  it('level 1: wild steering never falls off (full rails, no holes)', () => {
    for (const seed of ['wild1', 'wild2', 'wild3']) {
      const { physics, sim } = makeSim(1, seed);
      sim.start();
      const rng = new Rng(seed);
      let x = 1;
      let steps = 0;
      while (!sim.finished && steps++ < 60 * 120) {
        if (steps % 45 === 0) x = rng.pick([-1, 1, -1, 1, 0]);
        step(physics, sim, { x, y: rng.chance(0.5) ? 1 : -1 });
        expect(sim.near.height, `${seed} s=${sim.s.toFixed(1)}`).toBeGreaterThan(-1.2);
      }
      expect(sim.falls).toBe(0);
      expect(sim.finished).toBe(true);
      sim.dispose();
      physics.dispose();
    }
  });

  it('falling: respawn at the last checkpoint after the delay, then the mercy rule moves on', () => {
    const { physics, sim, events } = makeSim(3, 'fall');
    sim.start();
    // Roll a while so a checkpoint is reached.
    let steps = 0;
    while (sim.checkpoint.index < 1 && steps++ < 60 * 30) step(physics, sim, { x: 0, y: 1 });
    const cp = sim.checkpoint;
    expect(cp.index).toBeGreaterThanOrEqual(1);
    const drop = () => {
      const p = sim.ball.getPosition();
      sim.ball.body.setTranslation({ x: p.x, y: p.y - 30, z: p.z }, true);
      let n = 0;
      while (!events.some(([e]) => e === 'respawn') && n++ < 200) step(physics, sim, null);
      return n;
    };
    for (let k = 0; k < RACE_TUNING.mercyFalls - 1; k++) {
      events.length = 0;
      const n = drop();
      expect(n / 60).toBeGreaterThan(RACE_TUNING.respawnDelay - 0.1);
      expect(n / 60).toBeLessThan(RACE_TUNING.respawnDelay + 0.2);
      expect(sim.checkpoint).toBe(cp);
      expect(sim.ball.getPosition().distanceTo(new THREE.Vector3(cp.position.x, cp.position.y, cp.position.z))).toBeLessThan(1.5);
    }
    events.length = 0;
    drop();
    expect(sim.checkpoint.s).toBeGreaterThan(cp.s);
    expect(sim.falls).toBe(RACE_TUNING.mercyFalls);
    sim.dispose();
    physics.dispose();
  });

  it('a series reproduces from its seed', () => {
    const a = [0, 1, 2].map((i) => makeSim(4, raceSeed('🍎🐶🚀⚽', i)));
    const b = [0, 1, 2].map((i) => makeSim(4, raceSeed('🍎🐶🚀⚽', i)));
    a.forEach((x, i) => {
      expect(b[i].sim.gen.pieces).toEqual(x.sim.gen.pieces);
      expect(b[i].sim.racers.map((r) => r.skin)).toEqual(x.sim.racers.map((r) => r.skin));
    });
    expect(a[0].sim.gen.pieces).not.toEqual(a[1].sim.gen.pieces);
    for (const x of [...a, ...b]) {
      x.sim.dispose();
      x.physics.dispose();
    }
  });

  it('opponents never use the player skin', () => {
    const physics = new Physics();
    const sim = new RaceSim({ physics, scene: new THREE.Scene(), difficulty: 5, seed: 'skins', skin: 'blue' });
    expect(sim.racers.length).toBe(3);
    expect(sim.racers.map((r) => r.skin)).not.toContain('blue');
    expect(new Set(sim.racers.map((r) => r.skin)).size).toBe(3);
    sim.dispose();
    physics.dispose();
  });
});
