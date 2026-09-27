import { describe, it, expect, beforeAll } from 'vitest';
import { initRapier, Physics } from '../src/core/Physics.js';
import { normalizePlaygroundConfig } from '../src/app/configs.js';
import { generate, heightAt } from '../src/playground/TerrainGenerator.js';
import { Rng } from '../src/core/Rng.js';

beforeAll(async () => {
  await initRapier();
});

describe('playground terrain collider', () => {
  it('heightAt() matches the Rapier heightfield (same triangulation)', () => {
    const w = generate(normalizePlaygroundConfig({ size: 'small', bumpiness: 'mountains', stuff: [], stars: 'none', seed: 'hf' }));
    const p = new Physics();
    p.addHeightfield({ nx: w.n, nz: w.n, heights: w.heights, sizeX: w.n, sizeZ: w.n });
    p.step();
    const t = { n: w.n, heights: w.heights };
    const rng = new Rng('probe');
    const down = { x: 0, y: -1, z: 0 };
    let checked = 0;
    for (let i = 0; i < 400; i++) {
      const x = rng.range(-w.n / 2 + 0.01, w.n / 2 - 0.01);
      const z = rng.range(-w.n / 2 + 0.01, w.n / 2 - 0.01);
      const hit = p.raycast({ x, y: w.maxH + 5, z }, down, w.maxH - w.minH + 20);
      expect(hit).not.toBeNull();
      expect(hit.point.y).toBeCloseTo(heightAt(t, x, z), 3);
      checked++;
    }
    expect(checked).toBe(400);
    p.dispose();
  });

  it('a ball dropped on the spawn pad comes to rest on it', () => {
    const w = generate(normalizePlaygroundConfig({ size: 'small', bumpiness: 'hilly', stuff: [], stars: 'none', seed: 'rest' }));
    const p = new Physics();
    p.addHeightfield({ nx: w.n, nz: w.n, heights: w.heights, sizeX: w.n, sizeZ: w.n });
    const { body } = p.addDynamicBall({ position: { x: 0, y: w.spawn.y + 2, z: 0 }, radius: 0.5 });
    for (let i = 0; i < 180; i++) p.step();
    const t = body.translation();
    expect(t.y).toBeCloseTo(w.spawn.y + 0.5, 1);
    expect(Math.hypot(t.x, t.z)).toBeLessThan(0.05);
    p.dispose();
  });
});
