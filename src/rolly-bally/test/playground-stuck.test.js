import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as THREE from 'three';
import { initRapier, Physics } from '../src/core/Physics.js';
import { Ball } from '../src/ball/Ball.js';
import { StuckWatch, STUCK_TIME } from '../src/playground/StuckWatch.js';

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

/** Roll a ball for `seconds` with `move`; returns the first time StuckWatch fired (or null). */
function run({ boxed, move, seconds = 8 }) {
  const physics = new Physics();
  physics.addFixedCuboid({ position: { x: 0, y: -0.5, z: 0 }, halfExtents: { x: 30, y: 0.5, z: 30 } });
  if (boxed) {
    // Four fixed walls hugging the ball: it can wiggle but not get out.
    for (const [x, z, hx, hz] of [[1.2, 0, 0.3, 1.5], [-1.2, 0, 0.3, 1.5], [0, 1.2, 1.5, 0.3], [0, -1.2, 1.5, 0.3]]) {
      physics.addFixedCuboid({ position: { x, y: 1, z }, halfExtents: { x: hx, y: 1, z: hz } });
    }
  }
  const ball = new Ball({ physics, scene: new THREE.Scene(), position: { x: 0, y: 0.6, z: 0 } });
  const watch = new StuckWatch();
  const fwd = new THREE.Vector3(0, 0, -1);
  const dt = 1 / 60;
  let firedAt = null;
  for (let i = 0; i < seconds * 60 && firedAt === null; i++) {
    ball.update(dt, move, fwd);
    physics.step(dt);
    const p = ball.getPosition();
    if (watch.update(dt, p, Math.hypot(move.x, move.y) > 0.12)) firedAt = (i + 1) * dt;
  }
  ball.dispose();
  physics.dispose();
  return firedAt;
}

describe('playground stuck rescue', () => {
  it('fires after ~5 s of steering when the ball is boxed in', () => {
    const t = run({ boxed: true, move: { x: 0.3, y: 1 } });
    expect(t).not.toBeNull();
    expect(t).toBeGreaterThanOrEqual(STUCK_TIME - 0.05);
    expect(t).toBeLessThan(STUCK_TIME + 1.5);
  });

  it('does not fire while the ball rolls freely', () => {
    expect(run({ boxed: false, move: { x: 0, y: 1 }, seconds: 7 })).toBeNull();
  });

  it('does not fire while resting without input', () => {
    expect(run({ boxed: true, move: { x: 0, y: 0 } })).toBeNull();
  });

  it('StuckWatch resets its timer on real movement', () => {
    const w = new StuckWatch({ time: 1, dist: 0.5 });
    const a = { x: 0, y: 0, z: 0 };
    const b = { x: 1, y: 0, z: 0 };
    w.update(0.25, a, true); // sets the anchor
    for (let i = 0; i < 3; i++) expect(w.update(0.25, a, true)).toBe(false);
    expect(w.update(0.25, b, true)).toBe(false); // moved: timer resets
    for (let i = 0; i < 3; i++) expect(w.update(0.25, b, true)).toBe(false);
    expect(w.update(0.25, b, true)).toBe(true);
  });
});
