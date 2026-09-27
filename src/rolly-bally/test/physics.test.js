import { describe, it, expect, beforeAll } from 'vitest';
import { initRapier, Physics } from '../src/core/Physics.js';

beforeAll(async () => {
  await initRapier();
});

describe('Physics', () => {
  it('ball rests on a fixed cuboid', () => {
    const p = new Physics();
    p.addFixedCuboid({ position: { x: 0, y: -0.5, z: 0 }, halfExtents: { x: 5, y: 0.5, z: 5 } });
    const { body } = p.addDynamicBall({ position: { x: 0, y: 3, z: 0 }, radius: 0.5 });
    for (let i = 0; i < 180; i++) p.step();
    expect(body.translation().y).toBeCloseTo(0.5, 1);
    p.dispose();
  });

  it('heightfield layout is heights[ix * (nz + 1) + iz]', () => {
    const p = new Physics();
    const nx = 4;
    const nz = 2;
    const heights = new Float32Array((nx + 1) * (nz + 1));
    // Raise only the +x edge (ix = nx) to height 2.
    for (let iz = 0; iz <= nz; iz++) heights[nx * (nz + 1) + iz] = 2;
    p.addHeightfield({ nx, nz, heights, sizeX: 8, sizeZ: 4 });
    p.step(); // scene queries update during step
    const down = { x: 0, y: -1, z: 0 };
    const hiX = p.raycast({ x: 3.99, y: 10, z: 0 }, down, 20);
    const loX = p.raycast({ x: -3.99, y: 10, z: 0 }, down, 20);
    expect(hiX.point.y).toBeGreaterThan(1.9);
    expect(loX.point.y).toBeCloseTo(0, 2);
    p.dispose();
  });

  it('sensor callbacks fire on enter', () => {
    const p = new Physics();
    let entered = 0;
    p.addFixedCuboid({ position: { x: 0, y: -0.5, z: 0 }, halfExtents: { x: 5, y: 0.5, z: 5 } });
    p.addSensorCuboid({
      position: { x: 0, y: 1, z: 0 },
      halfExtents: { x: 1, y: 1, z: 1 },
      tag: 'star',
      onCollide: ({ started }) => { if (started) entered++; },
    });
    p.addDynamicBall({ position: { x: 0, y: 4, z: 0 }, radius: 0.5 });
    for (let i = 0; i < 120; i++) p.step();
    expect(entered).toBe(1);
    p.dispose();
  });
});
