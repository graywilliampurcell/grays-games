// Pathways P6: bouncy, ramps, dark tunnels and the trick mountain on the sky roads.
import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { initRapier, Physics, GRAVITY } from '../src/core/Physics.js';
import { Track } from '../src/track/TrackBuilder.js';
import { BlockMesh } from '../src/voxel/BlockMesh.js';
import { generateSkyRoads, FEATURE_LEN, ROAD_WIDTH } from '../src/pathways/SkyRoads.js';
import {
  SkyFeatures, featurePoint, featureLocal, tunnelLayout, trickLayout, HUMP, TUNNEL, TRICK, BOUNCE,
} from '../src/pathways/SkyFeatures.js';
import { darknessAt } from '../src/pathways/darkTunnel.js';
import { aimBack, launchSpeed } from '../src/pathways/trick.js';
import { SKY_PALETTES } from '../src/pathways/PathwaysMode.js';

beforeAll(async () => {
  await initRapier();
});

const ALL = ['bouncy', 'ramps', 'darkTunnels', 'trick'];
const SIZES = ['small', 'medium', 'large'];
const BUMPS = ['flat', 'hilly', 'mountains'];
const SEEDS = ['🍎🐶🚀⚽', 'abc', 'sky-7', '🌈🐸🍩🎈', 'x1', 'x2'];
const DOWN = { x: 0, y: -1, z: 0 };
const UP = { x: 0, y: 1, z: 0 };

function each(fn) {
  for (const size of SIZES) for (const bumpiness of BUMPS) for (const seed of SEEDS) fn({ size, bumpiness, seed });
}

describe('stuff placement', () => {
  it('every chosen kind shows up, and only chosen kinds', () => {
    each((cfg) => {
      const all = generateSkyRoads({ ...cfg, stuff: ALL });
      expect(new Set(all.features.map((f) => f.type))).toEqual(new Set(ALL));
      for (const pick of [['bouncy'], ['trick', 'ramps'], ['darkTunnels']]) {
        const w = generateSkyRoads({ ...cfg, stuff: pick });
        expect(w.features.length).toBeGreaterThan(0);
        expect(w.features.every((f) => pick.includes(f.type))).toBe(true);
        expect(new Set(w.features.map((f) => f.type))).toEqual(new Set(pick));
      }
      expect(generateSkyRoads({ ...cfg, stuff: [] }).features).toEqual([]);
    });
  });

  it('every fork branch has stuff when stuff is on', () => {
    each((cfg) => {
      const w = generateSkyRoads({ ...cfg, stuff: ALL });
      w.roads.forEach((r, i) => {
        if (r.kind === 'branch') expect(w.features.some((f) => f.road === i)).toBe(true);
      });
    });
  });

  it('stuff sits on its own flat straight stretch, away from the pads', () => {
    each((cfg) => {
      const w = generateSkyRoads({ ...cfg, stuff: ALL });
      for (const f of w.features) {
        const l = w.layouts[f.road];
        expect(f.s1 - f.s0).toBeCloseTo(FEATURE_LEN[f.type], 6);
        for (const st of l.strips) {
          if (st.s1 <= f.s0 + 1e-6 || st.s0 >= f.s1 - 1e-6) continue;
          expect(st.a.y).toBeCloseTo(f.position.y, 6);
          expect(st.b.y).toBeCloseTo(f.position.y, 6);
          expect(st.yawA).toBeCloseTo(f.yaw, 9);
          expect(st.widthA).toBe(ROAD_WIDTH);
        }
        expect(l.pieceAt(f.s0 + 0.1).params.feature).toBe(f.type);
      }
    });
  });

  it('bonus stars above bounce pads and on the humps; none in the trick run-up', () => {
    const w = generateSkyRoads({ seed: 'bonus', size: 'large', stuff: ALL });
    const bonus = w.stars.filter((s) => s.bonus);
    expect(bonus.length).toBeGreaterThan(0);
    for (const f of w.features.filter((x) => x.type === 'trick')) {
      const onIt = w.stars.filter((s) => s.road === f.road && Math.abs(featureLocal(f, s.x, s.z).u - ROAD_WIDTH / 2) < ROAD_WIDTH && featureLocal(f, s.x, s.z).v > 0 && featureLocal(f, s.x, s.z).v < FEATURE_LEN.trick);
      expect(onIt).toEqual([]);
    }
  });
});

describe('dark tunnels in the sky', () => {
  const f = { type: 'darkTunnels', position: { x: 10, y: 5, z: -20 }, forward: { x: -Math.sin(0.7), z: -Math.cos(0.7) }, right: { x: Math.cos(0.7), z: -Math.sin(0.7) }, yaw: 0.7 };
  const t = tunnelLayout(f);

  it('local coordinates follow the road at any heading', () => {
    const p = featurePoint(f, 6, 1.5);
    const l = t.local(p.x, p.z);
    expect(l.v).toBeCloseTo(6, 9);
    expect(l.u).toBeCloseTo(ROAD_WIDTH / 2 + 1.5, 9);
  });

  it('dark in the middle, fading at the ends, light outside and above the roof', () => {
    const at = (v, lat = 0, up = 0) => {
      const p = featurePoint(f, v, lat);
      const l = t.local(p.x, p.z);
      return darknessAt(l.u, l.v, up, t.spec);
    };
    expect(at(7)).toBe(1);
    expect(at(7, 3)).toBe(1);
    expect(at(0.5)).toBe(0);
    expect(at(13.5)).toBe(0);
    expect(at(2)).toBeGreaterThan(0);
    expect(at(2)).toBeLessThan(1);
    expect(at(7, 0, TUNNEL.height + 1)).toBe(0);
    expect(at(7, ROAD_WIDTH)).toBe(0);
  });

  it('exit lights sit in the two openings', () => {
    const [a, b] = t.exits.map((p) => t.local(p.x, p.z).v);
    expect(a).toBeCloseTo(TUNNEL.inside[0], 1);
    expect(b).toBeCloseTo(TUNNEL.inside[1], 1);
  });
});

describe('trick mountain in the sky', () => {
  const f = { type: 'trick', position: { x: 0, y: 8, z: 0 }, forward: { x: 0, z: -1 }, right: { x: 1, z: 0 }, yaw: 0 };
  const t = trickLayout(f);

  it('run-up, launch line, then the landing pad further along', () => {
    const v = (p) => featureLocal(f, p.x, p.z).v;
    expect(v(t.launch.position)).toBeCloseTo(TRICK.launch, 6);
    expect(v(t.target)).toBeGreaterThan(TRICK.launch + 2);
    expect(v(t.target)).toBeLessThan(FEATURE_LEN.trick);
    expect(t.target.y).toBe(f.position.y);
  });

  it('a launch from the line lands on the pad', () => {
    for (const entry of [2, 5, 9]) {
      const vy0 = launchSpeed(entry);
      const p = { x: t.launch.position.x, y: f.position.y + 0.5, z: t.launch.position.z };
      let vy = vy0;
      const dt = 1 / 60;
      let steps = 0;
      while ((vy > 0 || p.y > f.position.y + 0.5) && steps++ < 600) {
        const aim = aimBack(p, t.target, vy, p.y - (f.position.y + 0.5));
        p.x += aim.x * dt;
        p.z += aim.z * dt;
        vy += GRAVITY * dt;
        p.y += vy * dt;
      }
      const l = featureLocal(f, p.x, p.z);
      expect(l.v).toBeGreaterThan(TRICK.pad[0]);
      expect(l.v).toBeLessThan(TRICK.pad[1]);
    }
  });
});

describe('stuff built with physics', () => {
  function build(stuff, seed = 'phys') {
    const physics = new Physics();
    const scene = new THREE.Scene();
    const w = generateSkyRoads({ seed, size: 'large', bumpiness: 'hilly', stuff }, { Layout: Track });
    for (const t of w.layouts) t.build({ physics, scene, palette: SKY_PALETTES.grass });
    const blocks = new BlockMesh({ palette: SKY_PALETTES.grass });
    const audio = { play() {} };
    const features = new SkyFeatures({ physics, scene, blocks, features: w.features, audio, ui: null, camera: null, counter: () => null, spend: () => 0, earn() {} });
    scene.add(blocks.build());
    physics.step();
    return { physics, w, features };
  }
  const tagAt = (physics, p, dir, dist) => {
    const hit = physics.raycast(p, dir, dist);
    return hit && { tag: physics.info(hit.collider)?.tag, toi: hit.toi };
  };

  it('humps: solid on top, road beside them', () => {
    const { physics, w } = build(['ramps']);
    for (const f of w.features) {
      const top = featurePoint(f, 7, 0, 4);
      const hit = tagAt(physics, top, DOWN, 6);
      expect(hit.tag).toBe('track');
      expect(4 - hit.toi).toBeCloseTo(HUMP.height, 1);
      const side = tagAt(physics, featurePoint(f, 7, HUMP.width / 2 + 0.6, 4), DOWN, 6);
      expect(4 - side.toi).toBeCloseTo(0, 1);
      const slope = tagAt(physics, featurePoint(f, 3, 0, 4), DOWN, 6);
      expect(4 - slope.toi).toBeGreaterThan(0.4);
      expect(4 - slope.toi).toBeLessThan(HUMP.height - 0.2);
    }
  });

  it('dark tunnels: a roof over the road', () => {
    const { physics, w } = build(['darkTunnels']);
    for (const f of w.features) {
      const hit = tagAt(physics, featurePoint(f, 7, 0, 0.5), UP, 6);
      expect(hit.tag).toBe('feature');
      expect(0.5 + hit.toi).toBeCloseTo(TUNNEL.height, 1);
      expect(tagAt(physics, featurePoint(f, -1, 0, 0.5), UP, 6)).toBeNull();
    }
  });

  it('bounce pads throw the ball up and it lands back on the road between the glass walls', () => {
    const { physics, w, features } = build(['bouncy']);
    for (const f of w.features) {
      const start = featurePoint(f, -3, 0, 0.5);
      const ball = {};
      const { body } = physics.addDynamicBall({ position: start, radius: 0.5, tag: 'ball', data: ball });
      ball.body = body;
      const v = 5;
      body.setLinvel({ x: f.forward.x * v, y: 0, z: f.forward.z * v }, true);
      body.setAngvel({ x: (f.forward.z * v) / 0.5, y: 0, z: (-f.forward.x * v) / 0.5 }, true);
      let peak = 0;
      for (let i = 0; i < 180; i++) {
        features.update(1 / 60);
        physics.step(1 / 60);
        features.postStep(1 / 60, ball);
        peak = Math.max(peak, body.translation().y - f.position.y);
      }
      expect(peak).toBeGreaterThan(3);
      const p = body.translation();
      const l = featureLocal(f, p.x, p.z);
      expect(Math.abs(l.u - ROAD_WIDTH / 2)).toBeLessThan(ROAD_WIDTH / 2);
      expect(p.y - f.position.y).toBeLessThan(1);
      expect(p.y - f.position.y).toBeGreaterThan(0);
      physics.remove(body);
      expect(BOUNCE.speed).toBeGreaterThan(10);
    }
  });

  it('glass walls along the bounce stretch are tall', () => {
    const { physics, w } = build(['bouncy']);
    for (const f of w.features) {
      for (const side of [-1, 1]) {
        const hit = tagAt(physics, featurePoint(f, 8, 0, 2.5), { x: f.right.x * side, y: 0, z: f.right.z * side }, ROAD_WIDTH);
        expect(hit.tag).toBe('rail');
      }
    }
  });
});
