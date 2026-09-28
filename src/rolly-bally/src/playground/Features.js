// Playground "stuff": ramps, jumps, bounce pads, tunnels, spinning bumpers.
//
// Two halves:
//  - placeFeatures(ctx, rng): pure placement on flat spots, used by
//    TerrainGenerator.generate(). Every feature is axis-aligned on the cell
//    grid and must stay reachable from the spawn (flood-fill check).
//  - FeatureSet: builds meshes + colliders for placed features and runs the
//    moving/bouncy parts during play.
//
// Feature layout is described in local cell coords: u across [0, W), v along
// [0, L) in the feature's travel direction `dir` (0 +z, 1 +x, 2 -z, 3 -x).

import * as THREE from 'three';
import { rectFree, markRect, floodFill, vIndex, carveFlat, undoCarve, protectRect } from './TerrainGenerator.js';

export const FEATURE_COUNTS = { small: 2, medium: 4, large: 7 };
const MIN_SPAWN_DIST = 12;

const DIRS = [
  { x: 0, z: 1 },
  { x: 1, z: 0 },
  { x: 0, z: -1 },
  { x: -1, z: 0 },
];

/**
 * Per-type layout. blocked(u, v): solid at ground level. access: cells the
 * ball must be able to reach. stars: [u, v, heightAboveGround] bonus spots.
 */
export const FEATURE_SPECS = {
  // Up a wedge, across a platform, down the other side.
  ramps: {
    W: 3,
    L: 13,
    height: 1.5,
    blocked: (u, v) => v >= 1 && v < 12,
    access: [[1, 0], [1, 12]],
    stars: [[1.5, 6.5, 1.5 + 0.9]],
  },
  // A kicker with a clear landing strip after it.
  jumps: {
    W: 3,
    L: 14,
    height: 1.2,
    blocked: (u, v) => v >= 2 && v < 5,
    access: [[1, 0], [1, 10]],
    stars: [[1.5, 6.5, 1.9], [1.5, 8.5, 1.8], [1.5, 10.5, 1.2]],
  },
  // Flush trampoline pad in the middle of a 5×5 flat spot.
  bouncePads: {
    W: 5,
    L: 5,
    blocked: () => false,
    access: [[2, 2]],
    stars: [[2.5, 2.5, 3.6]],
  },
  // Rainbow arch: two walls and a roof; roll through the middle.
  tunnels: {
    W: 5,
    L: 9,
    height: 3,
    blocked: (u, v) => v >= 1 && v < 8 && (u === 0 || u === 4),
    access: [[2, 0], [2, 8]],
    stars: [[2.5, 2.5, 0.9], [2.5, 4.5, 0.9], [2.5, 6.5, 0.9]],
  },
  // Pathways "dark tunnel": 12 blocks long, straight, no branches. Walls and
  // roof are solid; a dark mouth on the ground at each end. Darkness itself
  // is done by the Pathways mode (pathways/darkTunnel.js).
  darkTunnels: {
    W: 5,
    L: 14,
    height: 3,
    inside: [1, 13], // v range under the roof
    blocked: (u, v) => v >= 1 && v < 13 && (u === 0 || u === 4),
    access: [[2, 0], [2, 13]],
    stars: [[2.5, 4.5, 0.9], [2.5, 7, 0.9], [2.5, 9.5, 0.9]],
  },
  // Pathways "trick mountain": straight run-up, soft landing pad, then a tall
  // curved mountain. Rolling into its foot launches the ball straight up;
  // the launch, star cost and scoring live in pathways/trick.js.
  trick: {
    W: 5,
    L: 16,
    height: 4.5,
    pad: [6, 9], // v range of the soft landing pad
    launch: 10.5, // v of the launch line at the mountain's foot
    foot: 11, // the mountain starts here
    blocked: (u, v) => v >= 11,
    access: [[2, 0]],
    roadTo: [2, 10], // the run-up is road too
    stars: [],
  },
  // Post in the middle with a slowly spinning bar.
  bumpers: {
    W: 7,
    L: 7,
    armLength: 6,
    blocked: (u, v) => u === 3 && v === 3,
    access: [[3, 0]],
    stars: [],
  },
};

/** World rect size (cells along x, z) of a feature. */
function rectSize(spec, dir) {
  return dir % 2 === 0 ? { w: spec.W, l: spec.L } : { w: spec.L, l: spec.W };
}

/**
 * Local (u, v) (continuous, cell units) → world (x, z) for a feature whose
 * rect min corner is at world (X0, Z0).
 */
export function featureToWorld(f, u, v) {
  const { W, L } = FEATURE_SPECS[f.type];
  switch (f.dir) {
    case 0: return { x: f.X0 + u, z: f.Z0 + v };
    case 1: return { x: f.X0 + v, z: f.Z0 + W - u };
    case 2: return { x: f.X0 + W - u, z: f.Z0 + L - v };
    default: return { x: f.X0 + L - v, z: f.Z0 + u };
  }
}

/** Local cell (u, v) → world cell (cx, cz). */
export function featureCell(f, n, u, v) {
  const p = featureToWorld(f, u + 0.5, v + 0.5);
  return { cx: Math.floor(p.x + n / 2), cz: Math.floor(p.z + n / 2) };
}

/**
 * Place the requested stuff on flat, free, reachable spots.
 * ctx: {t, n, blocked, used, spawnCell, pads, size, config} (mutates blocked/used).
 */
export function placeFeatures(ctx, rng) {
  const { t, n, blocked, used, protectedV, spawnCell, size, config } = ctx;
  const stuff = Array.isArray(config.stuff) ? config.stuff : [];
  const count = FEATURE_COUNTS[size] || FEATURE_COUNTS.medium;
  const placed = [];
  const accessCells = [];

  // Interleave types so a crowded world still gets some of each.
  const queue = [];
  for (let k = 0; k < count; k++) for (const type of stuff) if (FEATURE_SPECS[type]) queue.push(type);

  for (const type of queue) {
    const spec = FEATURE_SPECS[type];
    for (let attempt = 0; attempt < 120; attempt++) {
      const dir = rng.int(0, 3);
      const { w, l } = rectSize(spec, dir);
      const cx0 = rng.int(2, n - 2 - w);
      const cz0 = rng.int(2, n - 2 - l);
      const X0 = cx0 - n / 2;
      const Z0 = cz0 - n / 2;
      if (Math.hypot(X0 + w / 2, Z0 + l / 2) < MIN_SPAWN_DIST + Math.max(w, l) / 2) continue;
      if (!rectFree(used, n, cx0 - 1, cz0 - 1, w + 2, l + 2) || !rectFree(blocked, n, cx0 - 1, cz0 - 1, w + 2, l + 2)) continue;
      // Level a terrace (footprint + 1 cell apron) into the hillside.
      const carve = carveFlat(t, protectedV, cx0 - 1, cz0 - 1, w + 2, l + 2);
      if (!carve) continue;

      const f = { type, dir, cx0, cz0, w, l, X0, Z0, y: t.heights[vIndex(n, cx0, cz0)] };
      const d = DIRS[dir];
      f.fwd = { x: d.x, z: d.z };
      f.yaw = Math.atan2(d.x, d.z); // BlockMesh/physics yaw that turns local +z to fwd

      // Tentatively block its solid cells, then make sure nothing got cut off.
      const solid = [];
      for (let u = 0; u < spec.W; u++) {
        for (let v = 0; v < spec.L; v++) {
          if (!spec.blocked(u, v)) continue;
          const { cx, cz } = featureCell(f, n, u, v);
          if (!blocked[cx * n + cz]) solid.push(cx * n + cz);
        }
      }
      const access = spec.access.map(([u, v]) => featureCell(f, n, u, v));
      for (const i of solid) blocked[i] = 1;
      let ok = true;
      if (solid.length || placed.length === 0) {
        const reach = floodFill(t, blocked, spawnCell.cx, spawnCell.cz);
        ok = [...accessCells, ...access].every(({ cx, cz }) => reach[cx * n + cz]);
      }
      if (!ok) {
        for (const i of solid) blocked[i] = 0;
        undoCarve(t, carve);
        continue;
      }
      protectRect(protectedV, n, cx0 - 1, cz0 - 1, w + 2, l + 2);
      markRect(used, n, cx0, cz0, w, l, 1);
      f.access = access;
      f.starSpots = spec.stars.map(([u, v, dy]) => {
        const p = featureToWorld(f, u, v);
        return { x: p.x, y: f.y + dy, z: p.z };
      });
      f.center = featureToWorld(f, spec.W / 2, spec.L / 2);
      accessCells.push(...access);
      placed.push(f);
      break;
    }
  }
  return placed;
}

// =================================================================== runtime

const BOUNCE_SPEED = 13; // m/s upward: ~4 m high
const BOUNCE_COOLDOWN = 0.25;
const JUMP_LIFT = 7.5; // m/s upward off a kicker lip: ~1.4 m hop
const BUMPER_SPIN = 1.1; // rad/s
const BUMPER_PUSH = 7;
const BUMPER_COOLDOWN = 0.45;
const RAINBOW = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];

const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _y = new THREE.Vector3(0, 1, 0);

export class FeatureSet {
  /**
   * @param {object} o
   * @param {import('../core/Physics.js').Physics} o.physics
   * @param {THREE.Object3D} o.scene
   * @param {import('../voxel/BlockMesh.js').BlockMesh} o.blocks shared static block mesh (caller builds it)
   * @param {Array} o.features from generate()
   * @param {object} o.audio
   */
  constructor({ physics, scene, blocks, features, audio }) {
    this.physics = physics;
    this.scene = scene;
    this.audio = audio;
    this.bodies = [];
    this.meshes = [];
    this.pads = [];
    this.bumpers = [];
    this.kickers = [];
    this.time = 0;

    for (const f of features) {
      if (f.type === 'ramps') this._ramp(f, blocks);
      else if (f.type === 'jumps') this._jump(f, blocks);
      else if (f.type === 'bouncePads') this._bouncePad(f, blocks);
      else if (f.type === 'tunnels') this._tunnel(f, blocks);
      else if (f.type === 'darkTunnels') this._darkTunnel(f, blocks);
      else if (f.type === 'trick') this._trick(f, blocks);
      else if (f.type === 'bumpers') this._bumper(f, blocks);
    }
    this._buildPadMesh();
    this._buildBumperMeshes();
  }

  // ------------------------------------------------------------ builders

  _at(f, u, v, dy = 0) {
    const p = featureToWorld(f, u, v);
    return { x: p.x, y: f.y + dy, z: p.z };
  }

  /** Solid wedge: visual + convex-hull collider. Rises along +fwd unless flip. */
  _wedge(f, blocks, u, v, width, length, height, color, flip = false) {
    const c = this._at(f, u, v, height / 2);
    const yaw = f.yaw + (flip ? Math.PI : 0);
    blocks.addWedge(c, { x: width, y: height, z: length }, color, { yaw, jitter: 0.03 });
    const pts = [];
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const corner = (lx, ly, lz) => pts.push(c.x + lx * cy + lz * sy, c.y + ly, c.z - lx * sy + lz * cy);
    const hw = width / 2;
    const hl = length / 2;
    const hh = height / 2;
    const base = -hh - 0.05; // sink a hair so the low edge meets the ground smoothly
    corner(-hw, base, -hl); corner(hw, base, -hl); corner(-hw, base, hl); corner(hw, base, hl);
    corner(-hw, hh, hl); corner(hw, hh, hl);
    this._hull(pts);
  }

  _hull(points, { friction = 0.8 } = {}) {
    const { RAPIER, world } = this.physics;
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const desc = RAPIER.ColliderDesc.convexHull(new Float32Array(points));
    if (!desc) return;
    desc.setFriction(friction);
    world.createCollider(desc, body);
    this.physics.bodies.add(body);
    this.bodies.push(body);
  }

  /** Axis-aligned-in-feature-frame solid box: visual + cuboid collider. */
  _box(f, blocks, u, v, dy, size, color, { collide = true, jitter } = {}) {
    const c = this._at(f, u, v, dy);
    blocks.addBox(c, size, color, { yaw: f.yaw, jitter });
    if (collide) {
      const { body } = this.physics.addFixedCuboid({
        position: c,
        halfExtents: { x: size.x / 2, y: size.y / 2, z: size.z / 2 },
        yaw: f.yaw,
        friction: 0.8,
        tag: 'feature',
      });
      this.bodies.push(body);
    }
  }

  _ramp(f, blocks) {
    const s = FEATURE_SPECS.ramps;
    const h = s.height;
    this._wedge(f, blocks, 1.5, 3, 3, 4, h, 'orange');
    this._box(f, blocks, 1.5, 6.5, h / 2 - 0.05, { x: 3, y: h + 0.1, z: 3 }, 'yellow');
    this._wedge(f, blocks, 1.5, 10, 3, 4, h, 'orange', true);
    // little edge stripes on the platform so it reads as a bridge
    for (const u of [0.15, 2.85]) {
      this._box(f, blocks, u, 6.5, h + 0.1, { x: 0.3, y: 0.2, z: 3 }, 'red', { collide: false, jitter: 0 });
    }
  }

  _jump(f, blocks) {
    const s = FEATURE_SPECS.jumps;
    this._wedge(f, blocks, 1.5, 3.5, 3, 3, s.height, 'red');
    // Launch sensor at the lip: a real hop needs more speed than a kid has,
    // so the kicker gives an extra "whoosh" upward when you roll off it.
    const lip = this._at(f, 1.5, 4.7, s.height + 0.4);
    const kick = { fwd: f.fwd, hit: false, cooldown: 0 };
    const { body } = this.physics.addSensorCuboid({
      position: lip,
      halfExtents: { x: 1.5, y: 0.6, z: 0.4 },
      yaw: f.yaw,
      tag: 'jumpLip',
      onCollide: ({ otherInfo, started }) => {
        if (started && otherInfo?.tag === 'ball') kick.hit = true;
      },
    });
    this.kickers.push(kick);
    this.bodies.push(body);
    // white stripes on the landing strip
    for (let v = 6; v < 14; v += 2) {
      this._box(f, blocks, 1.5, v + 0.5, 0.02, { x: 2.6, y: 0.06, z: 0.5 }, 'white', { collide: false, jitter: 0 });
    }
  }

  _bouncePad(f, blocks) {
    const c = this._at(f, 2.5, 2.5);
    // Blue rim (visual only; flush with the ground).
    blocks.addBox({ x: c.x, y: c.y - 0.08, z: c.z }, { x: 3.2, y: 0.2, z: 3.2 }, 'blue', { jitter: 0 });
    const { body } = this.physics.addSensorCuboid({
      position: { x: c.x, y: c.y + 0.45, z: c.z },
      halfExtents: { x: 1.3, y: 0.4, z: 1.3 },
      tag: 'bouncePad',
      onCollide: ({ otherInfo, started }) => {
        if (started && otherInfo?.tag === 'ball') pad.hit = true;
      },
    });
    const pad = { x: c.x, y: c.y, z: c.z, hit: false, cooldown: 0, squash: 0 };
    this.pads.push(pad);
    this.bodies.push(body);
  }

  _tunnel(f, blocks) {
    const s = FEATURE_SPECS.tunnels;
    const h = s.height;
    for (let v = 1; v < 8; v++) {
      const color = RAINBOW[(v - 1) % RAINBOW.length];
      for (const u of [0.5, 4.5]) this._box(f, blocks, u, v + 0.5, h / 2, { x: 1, y: h, z: 1 }, color, { collide: false });
      this._box(f, blocks, 2.5, v + 0.5, h + 0.4, { x: 5, y: 0.8, z: 1 }, color, { collide: false });
    }
    // One collider per wall and one for the roof.
    const add = (u, dy, size) => {
      const c = this._at(f, u, 4.5, dy);
      const { body } = this.physics.addFixedCuboid({
        position: c,
        halfExtents: { x: size.x / 2, y: size.y / 2, z: size.z / 2 },
        yaw: f.yaw,
        friction: 0.5,
        tag: 'feature',
      });
      this.bodies.push(body);
    };
    add(0.5, h / 2, { x: 1, y: h, z: 7 });
    add(4.5, h / 2, { x: 1, y: h, z: 7 });
    add(2.5, h + 0.4, { x: 5, y: 0.8, z: 7 });
  }

  _darkTunnel(f, blocks) {
    const s = FEATURE_SPECS.darkTunnels;
    const h = s.height;
    const [v0, v1] = s.inside;
    const len = v1 - v0;
    const mid = (v0 + v1) / 2;
    for (let v = v0; v < v1; v++) {
      const color = (v + f.cx0 + f.cz0) % 2 ? '#3b3f4c' : '#454a58';
      for (const u of [0.5, 4.5]) this._box(f, blocks, u, v + 0.5, h / 2, { x: 1, y: h, z: 1 }, color, { collide: false });
      this._box(f, blocks, 2.5, v + 0.5, h + 0.4, { x: 5, y: 0.8, z: 1 }, color, { collide: false });
    }
    // The "mouth": black frame blocks at both openings and a dark patch on
    // the ground just outside and inside each end.
    for (const v of [v0 + 0.5, v1 - 0.5]) {
      for (const u of [0.5, 4.5]) this._box(f, blocks, u, v, h / 2 + 0.02, { x: 1.08, y: h + 0.04, z: 1.04 }, 'black', { collide: false, jitter: 0 });
      this._box(f, blocks, 2.5, v, h + 0.4, { x: 5.08, y: 0.84, z: 1.04 }, 'black', { collide: false, jitter: 0 });
    }
    for (const v of [v0, v1]) {
      this._box(f, blocks, 2.5, v, 0.03, { x: 3, y: 0.06, z: 2 }, '#15161c', { collide: false, jitter: 0 });
    }
    const add = (u, dy, size) => {
      const c = this._at(f, u, mid, dy);
      const { body } = this.physics.addFixedCuboid({
        position: c,
        halfExtents: { x: size.x / 2, y: size.y / 2, z: size.z / 2 },
        yaw: f.yaw,
        friction: 0.5,
        tag: 'feature',
      });
      this.bodies.push(body);
    };
    add(0.5, h / 2, { x: 1, y: h, z: len });
    add(4.5, h / 2, { x: 1, y: h, z: len });
    add(2.5, h + 0.4, { x: 5, y: 0.8, z: len });
  }

  /**
   * Trick mountain blocks + colliders: a quarter-pipe profile of 0.5 m
   * slices rising to a near-vertical lip, a pink soft pad and white run-up
   * stripes. The big star sign and all the behaviour are in pathways/trick.js.
   */
  _trick(f, blocks) {
    const s = FEATURE_SPECS.trick;
    const R = 4; // quarter-pipe radius
    const colors = ['purple', '#9b52ee', 'purple', '#9b52ee'];
    for (let k = 0; k < 9; k++) {
      const x = Math.min(R, k * 0.5 + 0.25);
      const h = k === 8 ? s.height : R - Math.sqrt(R * R - x * x) + 0.15;
      this._box(f, blocks, 2.5, s.foot + k * 0.5 + 0.25, h / 2, { x: 5, y: h, z: 0.5 }, colors[k % colors.length], { jitter: 0 });
      // snowy top edge on each step reads as "mountain"
      this._box(f, blocks, 2.5, s.foot + k * 0.5 + 0.25, h + 0.06, { x: 5, y: 0.12, z: 0.5 }, 'white', { collide: false, jitter: 0 });
    }
    const [p0, p1] = s.pad;
    blocks.addBox(this._at(f, 2.5, (p0 + p1) / 2, 0.04), { x: 5, y: 0.1, z: p1 - p0 }, 'pink', { yaw: f.yaw, jitter: 0 });
    for (const u of [0.25, 4.75]) this._box(f, blocks, u, (p0 + p1) / 2, 0.12, { x: 0.5, y: 0.24, z: p1 - p0 }, '#ff8fc0', { collide: false, jitter: 0 });
    for (let v = 1; v < p0; v += 2) {
      this._box(f, blocks, 2.5, v + 0.5, 0.02, { x: 0.5, y: 0.05, z: 1 }, 'white', { collide: false, jitter: 0 });
    }
  }

  _bumper(f, blocks) {
    const s = FEATURE_SPECS.bumpers;
    const c = this._at(f, 3.5, 3.5);
    // Ring of little blocks around the base so it reads as "a thing".
    blocks.addBox({ x: c.x, y: c.y + 0.05, z: c.z }, { x: 1.6, y: 0.1, z: 1.6 }, 'white', { jitter: 0 });
    const half = s.armLength / 2;
    const bumper = { x: c.x, y: c.y, z: c.z, angle: 0, prevAngle: 0, spin: 0, hit: false, cooldown: 0 };
    bumper.spin = BUMPER_SPIN * ((f.cx0 + f.cz0) % 2 ? 1 : -1);
    const { body } = this.physics.addKinematic({
      position: c,
      shapes: [
        { type: 'cylinder', halfHeight: 0.9, radius: 0.5, offset: { x: 0, y: 0.9, z: 0 } },
        { type: 'cuboid', halfExtents: { x: half, y: 0.3, z: 0.3 }, offset: { x: 0, y: 0.55, z: 0 } },
      ],
      friction: 0.3,
      restitution: 0.8,
      events: true,
      tag: 'bumper',
      onCollide: ({ otherInfo, started }) => {
        if (started && otherInfo?.tag === 'ball') bumper.hit = true;
      },
    });
    bumper.body = body;
    this.bumpers.push(bumper);
    this.bodies.push(body);
  }

  _buildPadMesh() {
    if (!this.pads.length) return;
    const geo = new THREE.BoxGeometry(2.6, 0.12, 2.6);
    const mat = new THREE.MeshLambertMaterial({ color: '#ff5fa2', flatShading: true });
    this.padMesh = new THREE.InstancedMesh(geo, mat, this.pads.length);
    this.padMesh.name = 'bounce-pads';
    this._updatePads();
    this.scene.add(this.padMesh);
    this.meshes.push(this.padMesh);
  }

  _updatePads() {
    this.pads.forEach((p, i) => {
      // squash: 1 → pressed down, springs back with a wobble
      const k = p.squash > 0 ? Math.sin((1 - p.squash) * Math.PI * 3) * p.squash : 0;
      _p.set(p.x, p.y + 0.04 + k * 0.08, p.z);
      _s.set(1 + k * 0.12, 1 - k * 0.6, 1 + k * 0.12);
      _m.compose(_p, _q.identity(), _s);
      this.padMesh.setMatrixAt(i, _m);
    });
    this.padMesh.instanceMatrix.needsUpdate = true;
  }

  _buildBumperMeshes() {
    if (!this.bumpers.length) return;
    const n = this.bumpers.length;
    const half = FEATURE_SPECS.bumpers.armLength / 2;
    const postGeo = new THREE.CylinderGeometry(0.5, 0.55, 1.8, 8);
    postGeo.translate(0, 0.9, 0);
    const armGeo = new THREE.BoxGeometry(half * 2, 0.6, 0.6);
    armGeo.translate(0, 0.55, 0);
    // Pink/white striped arm via per-vertex colors is overkill: two instanced meshes instead.
    this.postMesh = new THREE.InstancedMesh(postGeo, new THREE.MeshLambertMaterial({ color: '#ffd21f', flatShading: true }), n);
    this.armMesh = new THREE.InstancedMesh(armGeo, new THREE.MeshLambertMaterial({ color: '#8a3ee8', flatShading: true }), n);
    this.postMesh.name = 'bumper-posts';
    this.armMesh.name = 'bumper-arms';
    this.bumpers.forEach((b, i) => {
      _m.makeTranslation(b.x, b.y, b.z);
      this.postMesh.setMatrixAt(i, _m);
    });
    this._updateArms(1);
    // Instances move; skip culling rather than recomputing bounds.
    this.postMesh.frustumCulled = false;
    this.armMesh.frustumCulled = false;
    this.scene.add(this.postMesh, this.armMesh);
    this.meshes.push(this.postMesh, this.armMesh);
  }

  _updateArms(alpha) {
    this.bumpers.forEach((b, i) => {
      const a = b.prevAngle + (b.angle - b.prevAngle) * alpha;
      _q.setFromAxisAngle(_y, a);
      _p.set(b.x, b.y, b.z);
      _m.compose(_p, _q, _s.set(1, 1, 1));
      this.armMesh.setMatrixAt(i, _m);
    });
    this.armMesh.instanceMatrix.needsUpdate = true;
  }

  // ------------------------------------------------------------ loop

  /** Fixed step, before physics: spin the bumpers. */
  update(dt) {
    this.time += dt;
    for (const b of this.bumpers) {
      b.prevAngle = b.angle;
      b.angle += b.spin * dt;
      _q.setFromAxisAngle(_y, b.angle);
      b.body.setNextKinematicRotation(_q);
      if (b.cooldown > 0) b.cooldown -= dt;
    }
    for (const p of this.pads) {
      if (p.cooldown > 0) p.cooldown -= dt;
    }
    for (const k of this.kickers) {
      if (k.cooldown > 0) k.cooldown -= dt;
    }
  }

  /** After physics: apply bounces / bumps flagged by contact callbacks. */
  postStep(dt, ball) {
    for (const p of this.pads) {
      if (!p.hit) continue;
      p.hit = false;
      if (p.cooldown > 0) continue;
      p.cooldown = BOUNCE_COOLDOWN;
      p.squash = 1;
      const v = ball.body.linvel();
      ball.body.setLinvel({ x: v.x, y: BOUNCE_SPEED, z: v.z }, true);
      this.audio.play('boing', { pitch: 1.15 });
    }
    for (const k of this.kickers) {
      if (!k.hit) continue;
      k.hit = false;
      const v = ball.body.linvel();
      const along = v.x * k.fwd.x + v.z * k.fwd.z;
      if (k.cooldown > 0 || along < 2) continue; // only when rolling off the lip forward
      k.cooldown = 0.5;
      ball.body.setLinvel({ x: v.x + k.fwd.x * 1.5, y: Math.max(v.y, JUMP_LIFT), z: v.z + k.fwd.z * 1.5 }, true);
      this.audio.play('whoosh');
    }
    for (const b of this.bumpers) {
      if (!b.hit) continue;
      b.hit = false;
      if (b.cooldown > 0) continue;
      b.cooldown = BUMPER_COOLDOWN;
      const t = ball.body.translation();
      let dx = t.x - b.x;
      let dz = t.z - b.z;
      const d = Math.hypot(dx, dz) || 1;
      dx /= d;
      dz /= d;
      ball.push({ x: dx * BUMPER_PUSH, y: 2.5, z: dz * BUMPER_PUSH });
      this.audio.play('boing', { pitch: 1.5 });
    }
  }

  render(alpha, frameDt) {
    if (this.padMesh) {
      let any = false;
      for (const p of this.pads) {
        if (p.squash > 0) {
          p.squash = Math.max(0, p.squash - frameDt * 2.2);
          any = true;
        }
      }
      if (any || this._padsDirty) this._updatePads();
      this._padsDirty = any;
    }
    if (this.armMesh) this._updateArms(alpha);
  }

  dispose() {
    for (const body of this.bodies) this.physics.remove(body);
    this.bodies = [];
    for (const m of this.meshes) {
      m.removeFromParent();
      m.geometry.dispose();
      m.material.dispose();
      m.dispose();
    }
    this.meshes = [];
  }
}
