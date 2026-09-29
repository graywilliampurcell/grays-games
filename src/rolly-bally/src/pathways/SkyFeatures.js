// Stuff on the sky roads (Pathways P6). Each feature sits on its own flat
// straight stretch of road laid out by SkyRoads.js ({type, s0, position,
// forward, right, yaw}); "along" below is meters from the stretch's start.
//
//  bouncy       a blue trampoline across the road: rolling over it throws
//               you up (stars in the air), with tall glass walls on both
//               sides so a big bounce can't carry you off the road.
//  ramps        a hump in the middle of the road: up, across the top
//               (stars), down. Narrower than the road, so you can go round.
//  darkTunnels  a 12 m tunnel over the road: it gets all dark inside, then
//               bright again (darkTunnel.js does the darkness).
//  trick        run-up, launch line, soft pink landing pad further on, tall
//               mountains either side and a big star sign: you shoot up and
//               earn stars for how high you go (trick.js does the flight).

import * as THREE from 'three';
import { ROAD_WIDTH, FEATURE_LEN } from './SkyRoads.js';
import { DarkTunnels } from './darkTunnel.js';
import { TrickMountains } from './trick.js';

export const BOUNCE = { at: 3, len: 3, speed: 12, push: 1.5, cooldown: 0.5 };
export const HUMP = { width: 4, height: 1.5, profile: [[1, 0], [5, 1.5], [9, 1.5], [13, 0]] };
export const TUNNEL = { inside: [1, 13], height: 3.2 };
export const TRICK = { launch: 12, pad: [17, 23], star: [16, 15] };
const GLASS_HEIGHT = 3.2;

/** World point on feature f: along (m), lateral (m, + = right), up (m). */
export function featurePoint(f, along, lateral = 0, up = 0) {
  return {
    x: f.position.x + f.forward.x * along + f.right.x * lateral,
    y: f.position.y + up,
    z: f.position.z + f.forward.z * along + f.right.z * lateral,
  };
}

/** Pure: (x, z) → feature-local {u: across 0..ROAD_WIDTH, v: along}. */
export function featureLocal(f, x, z) {
  const dx = x - f.position.x;
  const dz = z - f.position.z;
  return {
    u: dx * f.right.x + dz * f.right.z + ROAD_WIDTH / 2,
    v: dx * f.forward.x + dz * f.forward.z,
  };
}

/**
 * The hump's collider: its side profile extruded across the road.
 * Returns {vertices: Float32Array, indices: Uint32Array} in world space.
 */
export function humpMesh(f) {
  const hw = HUMP.width / 2;
  const prof = HUMP.profile;
  const v = [];
  for (const [along, h] of prof) {
    for (const lat of [-hw, hw]) {
      const p = featurePoint(f, along, lat, h);
      v.push(p.x, p.y, p.z);
    }
  }
  // Bottom corners under the profile ends (for the side walls).
  const idx = [];
  const n = prof.length;
  const L = (i) => 2 * i;
  const R = (i) => 2 * i + 1;
  // Top surfaces, facing up.
  for (let i = 0; i < n - 1; i++) idx.push(...upFacing(v, L(i), R(i), R(i + 1)), ...upFacing(v, L(i), R(i + 1), L(i + 1)));
  // Side walls: fan from the profile down to the road.
  for (const side of [L, R]) {
    const bases = [];
    for (let i = 1; i < n - 1; i++) {
      const b = v.length / 3;
      v.push(v[side(i) * 3], f.position.y, v[side(i) * 3 + 2]);
      bases.push(b);
    }
    // Quads between neighbouring columns (triangles at the two ends).
    idx.push(side(0), side(1), bases[0]);
    for (let i = 1; i < n - 2; i++) idx.push(side(i), side(i + 1), bases[i], side(i), bases[i], bases[i - 1]);
    idx.push(side(n - 2), side(n - 1), bases[n - 3]);
  }
  return { vertices: new Float32Array(v), indices: new Uint32Array(idx) };
}

/** Pure: a dark tunnel as DarkTunnels wants it (world space). */
export function tunnelLayout(f) {
  const [v0, v1] = TUNNEL.inside;
  const H = TUNNEL.height;
  return {
    y: f.position.y,
    fwd: f.forward,
    yaw: f.yaw,
    spec: { W: ROAD_WIDTH, L: FEATURE_LEN.darkTunnels, inside: TUNNEL.inside, height: H, margin: 0 },
    local: (x, z) => featureLocal(f, x, z),
    exits: [featurePoint(f, v0 + 0.02, 0, H / 2), featurePoint(f, v1 - 0.02, 0, H / 2)],
    exitSize: { w: ROAD_WIDTH, h: H },
  };
}

/** Pure: a trick mountain as TrickMountains wants it (world space). */
export function trickLayout(f) {
  const [p0, p1] = TRICK.pad;
  const padMid = (p0 + p1) / 2;
  const [sAlong, sUp] = TRICK.star;
  return {
    fwd: f.forward,
    launch: { position: featurePoint(f, TRICK.launch, 0, 0.7), halfExtents: { x: ROAD_WIDTH / 2, y: 0.7, z: 0.5 }, yaw: f.yaw },
    pad: { position: featurePoint(f, padMid, 0, 0.6), halfExtents: { x: ROAD_WIDTH / 2, y: 0.5, z: (p1 - p0) / 2 }, yaw: f.yaw },
    target: featurePoint(f, padMid),
    star: { position: featurePoint(f, sAlong, 0, sUp), yaw: f.yaw + Math.PI },
  };
}

/** Triangle (a, b, c) wound so it faces up. */
function upFacing(v, a, b, c) {
  const ax = v[a * 3];
  const az = v[a * 3 + 2];
  const cross = (v[b * 3] - ax) * (v[c * 3 + 2] - az) - (v[b * 3 + 2] - az) * (v[c * 3] - ax);
  // y of (b-a)×(c-a) = (bz-az)(cx-ax) - (bx-ax)(cz-az) = -cross; up when > 0.
  return -cross > 0 ? [a, b, c] : [a, c, b];
}

/** Runtime for all stuff on the sky roads. */
export class SkyFeatures {
  /**
   * @param {object} o
   * @param {object} o.physics
   * @param {THREE.Scene} o.scene
   * @param {object} o.blocks BlockMesh the mode builds after this
   * @param {Array} o.features SkyRoads features
   * @param {object} o.audio
   * @param {HTMLElement} o.ui
   * @param {THREE.Camera} o.camera
   * @param {() => HTMLElement} o.counter star counter (fly target)
   * @param {() => number} o.spend  trick cost from the counter
   * @param {(n, from) => void} o.earn trick stars
   */
  constructor({ physics, scene, blocks, features, audio, ui, camera, counter, spend, earn }) {
    this.physics = physics;
    this.scene = scene;
    this.audio = audio;
    this.bodies = [];
    this.meshes = [];
    this.pads = [];
    this.glass = new THREE.MeshLambertMaterial({ color: '#bfe9ff', transparent: true, opacity: 0.28, depthWrite: false });

    const tunnels = [];
    const tricks = [];
    for (const f of features) {
      if (f.type === 'bouncy') this._bouncy(f, blocks);
      else if (f.type === 'ramps') this._hump(f, blocks);
      else if (f.type === 'darkTunnels') tunnels.push(this._tunnel(f, blocks));
      else if (f.type === 'trick') tricks.push(this._trick(f, blocks));
    }
    this.dark = new DarkTunnels({ scene, tunnels, audio });
    this.tricks = new TrickMountains({ physics, scene, tricks, audio, ui, camera, counter, spend, earn });
  }

  _fixed(position, halfExtents, yaw, extra = {}) {
    const { body } = this.physics.addFixedCuboid({ position, halfExtents, yaw, friction: 0.5, tag: 'feature', ...extra });
    this.bodies.push(body);
  }

  // ------------------------------------------------------------ bouncy

  _bouncy(f, blocks) {
    const c = featurePoint(f, BOUNCE.at);
    blocks.addBox({ ...c, y: c.y + 0.02 }, { x: ROAD_WIDTH - 0.6, y: 0.04, z: BOUNCE.len + 0.6 }, 'blue', { yaw: f.yaw, jitter: 0 });
    blocks.addBox({ ...c, y: c.y + 0.05 }, { x: ROAD_WIDTH - 1.4, y: 0.04, z: BOUNCE.len - 0.4 }, 'cyan', { yaw: f.yaw, jitter: 0 });
    const pad = { f, hit: false, cooldown: 0 };
    const { body } = this.physics.addSensorCuboid({
      position: { ...c, y: c.y + 0.45 },
      halfExtents: { x: ROAD_WIDTH / 2 - 0.4, y: 0.4, z: BOUNCE.len / 2 },
      yaw: f.yaw,
      tag: 'bouncePad',
      onCollide: ({ otherInfo, started }) => {
        if (started && otherInfo?.tag === 'ball') pad.hit = true;
      },
    });
    this.bodies.push(body);
    this.pads.push(pad);

    // Tall glass walls all along the stretch.
    const len = FEATURE_LEN.bouncy;
    const geo = new THREE.BoxGeometry(0.2, GLASS_HEIGHT, len);
    for (const side of [-1, 1]) {
      const p = featurePoint(f, len / 2, side * (ROAD_WIDTH / 2 + 0.2), GLASS_HEIGHT / 2);
      const m = new THREE.Mesh(side < 0 ? geo : geo.clone(), this.glass);
      m.position.set(p.x, p.y, p.z);
      m.rotation.y = f.yaw;
      m.name = 'bouncy-glass';
      this.scene.add(m);
      this.meshes.push(m);
      this._fixed(p, { x: 0.1, y: GLASS_HEIGHT / 2, z: len / 2 }, f.yaw, { tag: 'rail', friction: 0.2 });
      // Blue frame along the top edge.
      blocks.addBox(featurePoint(f, len / 2, side * (ROAD_WIDTH / 2 + 0.2), GLASS_HEIGHT), { x: 0.3, y: 0.2, z: len }, 'blue', { yaw: f.yaw, jitter: 0 });
    }
  }

  // ------------------------------------------------------------ ramps (hump)

  _hump(f, blocks) {
    const [[a0], [a1, h], [a2], [a3]] = HUMP.profile;
    const up = featurePoint(f, (a0 + a1) / 2, 0, h / 2);
    const top = featurePoint(f, (a1 + a2) / 2, 0, h / 2);
    const down = featurePoint(f, (a2 + a3) / 2, 0, h / 2);
    // Wedges are high at local +z; forward is local -z at the feature's yaw.
    blocks.addWedge(up, { x: HUMP.width, y: h, z: a1 - a0 }, 'orange', { yaw: f.yaw + Math.PI });
    blocks.addBox(top, { x: HUMP.width, y: h, z: a2 - a1 }, 'yellow', { yaw: f.yaw });
    blocks.addWedge(down, { x: HUMP.width, y: h, z: a3 - a2 }, 'orange', { yaw: f.yaw });
    const { vertices, indices } = humpMesh(f);
    const { body } = this.physics.addFixedTrimesh(vertices, indices, { friction: 0.9, tag: 'track' });
    this.bodies.push(body);
  }

  // ------------------------------------------------------------ dark tunnel

  _tunnel(f, blocks) {
    const [v0, v1] = TUNNEL.inside;
    const H = TUNNEL.height;
    const mid = (v0 + v1) / 2;
    const L = v1 - v0;
    const wallAt = ROAD_WIDTH / 2 + 0.8;
    for (const side of [-1, 1]) {
      const p = featurePoint(f, mid, side * wallAt, H / 2);
      blocks.addBox(p, { x: 1, y: H + 0.4, z: L }, '#3b404b', { yaw: f.yaw });
      this._fixed(p, { x: 0.5, y: (H + 0.4) / 2, z: L / 2 }, f.yaw);
    }
    const roof = featurePoint(f, mid, 0, H + 0.3);
    blocks.addBox(roof, { x: 2 * wallAt + 1, y: 0.6, z: L }, '#2d313a', { yaw: f.yaw });
    this._fixed(roof, { x: wallAt + 0.5, y: 0.3, z: L / 2 }, f.yaw);
    // Black frame around each opening and a dark patch on the road outside it.
    for (const v of [v0, v1]) {
      const out = v === v0 ? -1 : 1;
      blocks.addBox(featurePoint(f, v, 0, H + 0.35), { x: 2 * wallAt + 1.4, y: 0.8, z: 0.4 }, 'black', { yaw: f.yaw, jitter: 0 });
      for (const side of [-1, 1]) blocks.addBox(featurePoint(f, v, side * wallAt, H / 2), { x: 1.4, y: H + 0.4, z: 0.4 }, 'black', { yaw: f.yaw, jitter: 0 });
      blocks.addBox(featurePoint(f, v + out * 0.7, 0, 0.015), { x: ROAD_WIDTH - 0.6, y: 0.03, z: 1.4 }, '#1b1d24', { yaw: f.yaw, jitter: 0 });
    }
    return tunnelLayout(f);
  }

  // ------------------------------------------------------------ trick

  _trick(f, blocks) {
    // Run-up stripes, pink landing pad.
    for (let a = 4; a < TRICK.launch; a += 2) {
      blocks.addBox(featurePoint(f, a, 0, 0.015), { x: ROAD_WIDTH - 1.6, y: 0.03, z: 0.5 }, 'white', { yaw: f.yaw, jitter: 0 });
    }
    blocks.addBox(featurePoint(f, TRICK.launch, 0, 0.02), { x: ROAD_WIDTH - 0.6, y: 0.04, z: 0.6 }, 'yellow', { yaw: f.yaw, jitter: 0 });
    const [p0, p1] = TRICK.pad;
    const padMid = (p0 + p1) / 2;
    blocks.addBox(featurePoint(f, padMid, 0, 0.02), { x: ROAD_WIDTH - 0.6, y: 0.04, z: p1 - p0 }, 'pink', { yaw: f.yaw, jitter: 0 });
    // Stepped purple mountains either side, snow on the steps.
    for (const side of [-1, 1]) {
      const steps = [[3.2, 13], [2.4, 10], [1.6, 7], [0.8, 4]];
      steps.forEach(([w, h], i) => {
        const lat = side * (ROAD_WIDTH / 2 + 0.6 + w / 2 + i * 0.9);
        blocks.addBox(featurePoint(f, TRICK.launch + 3, lat, h / 2), { x: w, y: h, z: 8 - i }, i % 2 ? '#7a34d6' : 'purple', { yaw: f.yaw });
        blocks.addBox(featurePoint(f, TRICK.launch + 3, lat, h + 0.15), { x: w, y: 0.3, z: 8 - i }, 'white', { yaw: f.yaw, jitter: 0 });
      });
    }
    return trickLayout(f);
  }

  // ------------------------------------------------------------ runtime

  attachBall(ball) {
    this.dark.attachBall(ball);
  }

  get flying() {
    return !!this.tricks.flight;
  }

  update(dt) {
    for (const p of this.pads) if (p.cooldown > 0) p.cooldown -= dt;
    this.tricks.update(dt);
  }

  postStep(dt, ball) {
    for (const p of this.pads) {
      if (!p.hit) continue;
      p.hit = false;
      if (p.cooldown > 0) continue;
      p.cooldown = BOUNCE.cooldown;
      const v = ball.body.linvel();
      const fw = p.f.forward;
      ball.body.setLinvel({ x: v.x + fw.x * BOUNCE.push, y: BOUNCE.speed, z: v.z + fw.z * BOUNCE.push }, true);
      this.audio.play('boing', { pitch: 1.15 });
    }
    this.tricks.postStep(dt, ball);
  }

  render(dt, ballPos, ballVel) {
    this.dark.update(dt, ballPos, ballVel);
    this.tricks.render(dt, ballPos);
  }

  reset() {
    this.tricks.reset();
  }

  dispose() {
    this.dark.dispose();
    this.tricks.dispose();
    for (const b of this.bodies) this.physics.remove(b);
    for (const m of this.meshes) {
      m.removeFromParent();
      m.geometry.dispose();
    }
    this.glass.dispose();
  }
}
