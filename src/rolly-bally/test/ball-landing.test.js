import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as THREE from 'three';
import { initRapier, Physics } from '../src/core/Physics.js';
import { Ball } from '../src/ball/Ball.js';

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

function drop(height) {
  const physics = new Physics();
  physics.addFixedCuboid({ position: { x: 0, y: -0.5, z: 0 }, halfExtents: { x: 10, y: 0.5, z: 10 } });
  const scene = new THREE.Scene();
  const ball = new Ball({ physics, scene, position: { x: 0, y: 0.5, z: 0 } });
  physics.step(1 / 60);
  ball.body.setTranslation({ x: 0, y: height, z: 0 }, true);
  const lands = [];
  ball.onLand = (v) => lands.push(v);
  const fwd = new THREE.Vector3(0, 0, -1);
  let maxDust = 0;
  for (let i = 0; i < 150; i++) {
    ball.update(1 / 60, null, fwd);
    physics.step(1 / 60);
    ball.render(1, 1 / 60);
    maxDust = Math.max(maxDust, ball.dust.mesh.count);
  }
  ball.dispose();
  physics.dispose();
  return { lands, maxDust };
}

describe('Ball landing', () => {
  it('a real drop fires onLand once and puffs dust', () => {
    const { lands, maxDust } = drop(4);
    expect(lands.length).toBe(1);
    expect(lands[0]).toBeGreaterThan(6);
    expect(maxDust).toBeGreaterThan(0);
  });

  it('a tiny hop is not a landing', () => {
    const { lands, maxDust } = drop(0.7);
    expect(lands.length).toBe(0);
    expect(maxDust).toBe(0);
  });
});
