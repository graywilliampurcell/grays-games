// TrackBuilder: turn a piece list into a playable track — one road mesh +
// one smooth road collider, rails, gates, pads, bumpers and moving hazards —
// on top of the pure TrackLayout (spline + features + AI helpers).
//
//   const track = buildTrack({
//     physics, scene,
//     pieces: ['start', 'straight', 'hammer', 'finish'],
//     options: { width: 6, rails: 'curves', hazardSpeed: 1 },
//     handlers: { onCheckpoint, onFinish, onBoost, onBumper, onHazardHit },
//   });
//   mode.update(dt):  track.update(dt)      // BEFORE physics.step: moves hazards
//   mode.render(a):   track.render(a)       // pose hazard meshes (interpolated)
//   track.dispose()                         // bodies + meshes (safe to rebuild)
//
// Everything from TrackLayout is available on the track (spline, nearest,
// checkpoints, startSlots, laneAt, aiOffsetAt, hazardZones, ...).
//
// Handlers are called from inside physics.step (sensor/contact events), with
// the player's Ball (collider tag 'ball'): don't remove bodies there.
//   onCheckpoint(checkpoint, ball)   passing a checkpoint gate (start included)
//   onFinish(finish, ball)           crossing the finish line
//   onBoost(zone, ball)              entering a boost pad; if omitted the track
//                                    calls ball.boost(8, forward) itself
//   onBumper(ball)                   bouncing off a static bumper / end wall
//   onHazardHit({type, hazard, ball})

import * as THREE from 'three';
import { BlockMesh } from '../voxel/BlockMesh.js';
import { TrackLayout } from './TrackLayout.js';
import { makeHazardMaterial } from './hazards/parts.js';
import { HAZARDS } from './hazards/index.js';
import { BUMPER_HALF } from './pieces/bumpers.js';
import { rightXZ, yawQuat } from './math.js';

export const ROAD_THICKNESS = 0.6;
export const RAIL_HEIGHT = 0.7;
export const BOOST_STRENGTH = 8;
const BUMPER_KICK = 3; // extra outward impulse on a bumper hit (on top of restitution)

const _c = new THREE.Color();

function hashJitter(i, amount = 0.04) {
  const h = Math.imul(i + 1, 2654435761) >>> 0;
  return 1 + ((h % 1000) / 1000 - 0.5) * 2 * amount;
}

export class Track extends TrackLayout {
  /**
   * Build meshes, colliders and hazards.
   * @param {object} o {physics, scene, handlers?, palette?='race'}
   */
  build({ physics, scene, handlers = {}, palette = 'race' }) {
    this.physics = physics;
    this.scene = scene;
    this.handlers = handlers;
    this.bodies = [];
    this.hazards = [];
    this.time = 0;
    this.prevTime = 0;
    this.group = new THREE.Group();
    this.group.name = 'track';
    scene.add(this.group);

    this.blocks = new BlockMesh({ palette });
    this.palette = this.blocks.palette;
    this._buildRoad();
    this._buildRails();
    this._buildPillars();
    this._buildFeatures();
    this.group.add(this.blocks.build());
    return this;
  }

  _keep(r) {
    this.bodies.push(r.body);
    return r;
  }

  // ------------------------------------------------------------ road

  _buildRoad() {
    const pos = [];
    const col = [];
    const colliderV = [];
    const colliderI = [];
    const T = ROAD_THICKNESS;
    const pal = this.palette;

    const pushTri = (p1, p2, p3, color) => {
      pos.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z);
      for (let k = 0; k < 3; k++) col.push(color.r, color.g, color.b);
    };
    // Quad p1-p2-p3-p4 (a loop), wound so its normal points along `out`.
    const pushQuad = (p1, p2, p3, p4, out, colorKey, shade, jitter) => {
      const v = pal[colorKey] ?? colorKey;
      _c.set(v).multiplyScalar(shade * jitter);
      const nx = (p2.y - p1.y) * (p3.z - p1.z) - (p2.z - p1.z) * (p3.y - p1.y);
      const ny = (p2.z - p1.z) * (p3.x - p1.x) - (p2.x - p1.x) * (p3.z - p1.z);
      const nz = (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
      if (nx * out.x + ny * out.y + nz * out.z >= 0) {
        pushTri(p1, p2, p3, _c);
        pushTri(p1, p3, p4, _c);
      } else {
        pushTri(p1, p3, p2, _c);
        pushTri(p1, p4, p3, _c);
      }
    };
    const down = (p) => ({ x: p.x, y: p.y - T, z: p.z });
    const across = (L, R, t) => ({ x: L.x + (R.x - L.x) * t, y: L.y + (R.y - L.y) * t, z: L.z + (R.z - L.z) * t });

    // Collider rows are shared between neighbouring strips (smooth internal edges).
    let lastRow = -1;
    const addRow = (L, R) => {
      colliderV.push(L.x, L.y, L.z, R.x, R.y, R.z);
      return colliderV.length / 3 - 2;
    };

    this.strips.forEach((st, i) => {
      if (!st.floor) {
        lastRow = -1;
        return;
      }
      const rA = rightXZ(st.yawA);
      const rB = rightXZ(st.yawB);
      const hA = st.widthA / 2;
      const hB = st.widthB / 2;
      const aL = { x: st.a.x - rA.x * hA, y: st.a.y, z: st.a.z - rA.z * hA };
      const aR = { x: st.a.x + rA.x * hA, y: st.a.y, z: st.a.z + rA.z * hA };
      const bL = { x: st.b.x - rB.x * hB, y: st.b.y, z: st.b.z - rB.z * hB };
      const bR = { x: st.b.x + rB.x * hB, y: st.b.y, z: st.b.z + rB.z * hB };
      const fwd = { x: st.b.x - st.a.x, y: 0, z: st.b.z - st.a.z };
      const up = { x: 0, y: 1, z: 0 };
      const j = hashJitter(i);
      const main = st.color || (Math.floor(st.s0 / 2) % 2 ? 'trackAlt' : 'track');

      // Top: edge trim | main | edge trim.
      const e = st.edge && Math.min(st.widthA, st.widthB) >= 1.5 ? 0.3 : 0;
      if (e) {
        const tA = e / st.widthA;
        const tB = e / st.widthB;
        const aL2 = across(aL, aR, tA);
        const aR2 = across(aL, aR, 1 - tA);
        const bL2 = across(bL, bR, tB);
        const bR2 = across(bL, bR, 1 - tB);
        pushQuad(aL, aL2, bL2, bL, up, 'edge', 1, 1);
        pushQuad(aL2, aR2, bR2, bL2, up, main, 1, j);
        pushQuad(aR2, aR, bR, bR2, up, 'edge', 1, 1);
      } else {
        pushQuad(aL, aR, bR, bL, up, main, 1, j);
      }
      // Sides + bottom.
      pushQuad(aL, bL, down(bL), down(aL), { x: -rA.x, y: 0, z: -rA.z }, e ? 'edge' : main, 0.8, 1);
      pushQuad(aR, bR, down(bR), down(aR), { x: rA.x, y: 0, z: rA.z }, e ? 'edge' : main, 0.8, 1);
      pushQuad(down(aL), down(aR), down(bR), down(bL), { x: 0, y: -1, z: 0 }, e ? 'edge' : main, 0.6, 1);
      if (st.capStart) pushQuad(aL, aR, down(aR), down(aL), { x: -fwd.x, y: 0, z: -fwd.z }, e ? 'edge' : main, 0.9, 1);
      if (st.capEnd) pushQuad(bL, bR, down(bR), down(bL), fwd, e ? 'edge' : main, 0.9, 1);

      // Collider: shared rows along the road, plus end caps at floor edges.
      const rowA = st.capStart || lastRow < 0 ? addRow(aL, aR) : lastRow;
      const rowB = addRow(bL, bR);
      // (aL, aR, bR) and (aL, bR, bL) are counter-clockwise seen from above.
      colliderI.push(rowA, rowA + 1, rowB + 1, rowA, rowB + 1, rowB);
      lastRow = st.capEnd ? -1 : rowB;
      for (const [L, R, capOn] of [[aL, aR, st.capStart], [bL, bR, st.capEnd]]) {
        if (!capOn) continue;
        const base = colliderV.length / 3;
        const dL = down(L);
        const dR = down(R);
        colliderV.push(L.x, L.y, L.z, R.x, R.y, R.z, dR.x, dR.y, dR.z, dL.x, dL.y, dL.z);
        colliderI.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    });

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    this.roadMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.roadMesh = new THREE.Mesh(g, this.roadMaterial);
    this.roadMesh.name = 'road';
    this.group.add(this.roadMesh);

    if (colliderI.length) {
      this.roadCollider = this._keep(
        this.physics.addFixedTrimesh(new Float32Array(colliderV), new Uint32Array(colliderI), {
          friction: 0.9,
          restitution: 0.1,
          tag: 'track',
        }),
      ).collider;
    }
  }

  // ------------------------------------------------------------ rails

  // Rails: one box per strip side, visual in BlockMesh, and all of them
  // merged into ONE trimesh collider (hundreds of cuboid bodies would be
  // wasteful on the iPad).
  _buildRails() {
    const q = new THREE.Quaternion();
    const e = new THREE.Euler(0, 0, 0, 'YXZ');
    const m = new THREE.Matrix4();
    const unit = new THREE.BoxGeometry(1, 1, 1);
    const up = unit.attributes.position;
    const ui = unit.index.array;
    const v = new THREE.Vector3();
    const verts = [];
    const idx = [];
    this.strips.forEach((st) => {
      if (!st.rails || !st.floor) return;
      const rA = rightXZ(st.yawA);
      const rB = rightXZ(st.yawB);
      for (const side of [-1, 1]) {
        const oA = side * (st.widthA / 2 + 0.15);
        const oB = side * (st.widthB / 2 + 0.15);
        const pa = { x: st.a.x + rA.x * oA, y: st.a.y, z: st.a.z + rA.z * oA };
        const pb = { x: st.b.x + rB.x * oB, y: st.b.y, z: st.b.z + rB.z * oB };
        const dx = pb.x - pa.x;
        const dy = pb.y - pa.y;
        const dz = pb.z - pa.z;
        const h = Math.hypot(dx, dz);
        const len = Math.hypot(h, dy);
        e.set(Math.atan2(dy, h), Math.atan2(-dx, -dz), 0);
        q.setFromEuler(e);
        const c = new THREE.Vector3((pa.x + pb.x) / 2, (pa.y + pb.y) / 2 + RAIL_HEIGHT / 2 - 0.1, (pa.z + pb.z) / 2);
        const size = new THREE.Vector3(0.3, RAIL_HEIGHT + 0.2, len + 0.04);
        const color = Math.floor(st.s0 / 2) % 2 ? 'rail' : 'railPost';
        this.blocks.addBox(c, size, color, { rotation: q.clone(), jitter: 0 });
        m.compose(c, q, size);
        const base = verts.length / 3;
        for (let k = 0; k < up.count; k++) {
          v.fromBufferAttribute(up, k).applyMatrix4(m);
          verts.push(v.x, v.y, v.z);
        }
        for (let k = 0; k < ui.length; k++) idx.push(base + ui[k]);
      }
    });
    unit.dispose();
    if (idx.length) {
      this._keep(
        this.physics.addFixedTrimesh(new Float32Array(verts), new Uint32Array(idx), { friction: 0.2, restitution: 0.3, tag: 'rail' }),
      );
    }
  }

  _buildPillars() {
    let next = 6;
    for (const st of this.strips) {
      if (st.s0 < next || !st.floor) continue;
      next = st.s0 + 12;
      const h = 30;
      const m = { x: (st.a.x + st.b.x) / 2, y: Math.min(st.a.y, st.b.y), z: (st.a.z + st.b.z) / 2 };
      this.blocks.addBox({ x: m.x, y: m.y - ROAD_THICKNESS - h / 2, z: m.z }, { x: 1.2, y: h, z: 1.2 }, 'pillar', { yaw: st.yaw });
    }
  }

  // ------------------------------------------------------------ features

  _at(f, lateral = 0, up = 0) {
    return {
      x: f.position.x + f.right.x * lateral,
      y: f.position.y + up,
      z: f.position.z + f.right.z * lateral,
    };
  }

  _arch(f, postColor, bannerA, bannerB) {
    const hw = f.width / 2 + 0.7;
    for (const side of [-1, 1]) {
      const p = this._at(f, side * hw, 2.25);
      this.blocks.addBox(p, { x: 0.8, y: 4.5, z: 0.8 }, postColor, { yaw: f.yaw });
      this._keep(this.physics.addFixedCuboid({ position: p, halfExtents: { x: 0.4, y: 2.25, z: 0.4 }, yaw: f.yaw, tag: 'rail' }));
    }
    const n = Math.max(4, Math.round(hw * 2));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < 2; j++) {
        const off = -hw + ((i + 0.5) * 2 * hw) / n;
        this.blocks.addBox(this._at(f, off, 4.75 + j * 0.5), { x: (2 * hw) / n, y: 0.5, z: 0.6 }, (i + j) % 2 ? bannerB : bannerA, {
          yaw: f.yaw,
          jitter: 0,
        });
      }
    }
  }

  _floorBand(f, rows, colorA, colorB) {
    const n = Math.max(2, Math.round(f.width));
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i < n; i++) {
        const off = -f.width / 2 + ((i + 0.5) * f.width) / n;
        const p = this._at(f, off, 0.015);
        const fw = (r - (rows - 1) / 2) * 0.6;
        p.x += f.forward.x * fw;
        p.z += f.forward.z * fw;
        this.blocks.addBox(p, { x: f.width / n, y: 0.03, z: 0.6 }, (i + r) % 2 ? colorB : colorA, { yaw: f.yaw, jitter: 0 });
      }
    }
  }

  _sensorAcross(f, depth, onEnter) {
    this._keep(
      this.physics.addSensorCuboid({
        position: this._at(f, 0, 2),
        halfExtents: { x: f.width / 2 + 0.5, y: 2.5, z: depth / 2 },
        yaw: f.yaw,
        tag: 'sensor',
        onCollide: ({ otherInfo, started }) => {
          if (started && otherInfo?.tag === 'ball') onEnter(otherInfo.data);
        },
      }),
    );
  }

  _buildFeatures() {
    const h = this.handlers;
    const hazardMaterial = (this.hazardMaterial = makeHazardMaterial());
    for (const f of this.features) {
      switch (f.type) {
        case 'checkpoint':
          if (!f.start) {
            this._arch(f, 'checkpoint', 'checkpoint', 'white');
            this._floorBand(f, 1, 'checkpoint', 'white');
          }
          this._sensorAcross(f, 1, (ball) => h.onCheckpoint?.(f, ball));
          break;
        case 'finish':
          this._arch(f, 'white', 'finish', 'finishDark');
          this._floorBand(f, 2, 'finish', 'finishDark');
          this._sensorAcross(f, 1, (ball) => h.onFinish?.(f, ball));
          break;
        case 'startLine':
          this._floorBand(f, 1, 'white', 'finishDark');
          break;
        case 'boost':
          this._buildBoost(f);
          break;
        case 'bumper':
          this._buildBumper(f);
          break;
        case 'wall':
          this._buildWall(f);
          break;
        case 'hazard': {
          const Cls = HAZARDS[f.hazard];
          if (!Cls) break;
          const hz = new Cls({
            physics: this.physics,
            scene: this.group,
            frame: f,
            params: f.params,
            hazardSpeed: this.options.hazardSpeed,
            material: hazardMaterial,
            blocks: this.blocks,
            onHit: (info) => h.onHazardHit?.(info),
          });
          this.hazards.push(hz);
          this.bodies.push(hz.body, ...hz.staticBodies);
          break;
        }
        default:
          break;
      }
    }
  }

  _buildBoost(f) {
    const zone = this.boostZones.find((z) => z.feature === f);
    // Chevrons pointing forward.
    const n = Math.max(2, Math.round(f.len / 1.3));
    const arm = Math.min(1.6, f.width * 0.28);
    for (let i = 0; i < n; i++) {
      const along = -f.len / 2 + (i + 0.5) * (f.len / n);
      for (const side of [-1, 1]) {
        const lat = side * arm * 0.42;
        const p = this._at(f, lat, 0.02);
        p.x += f.forward.x * (along - 0.25);
        p.z += f.forward.z * (along - 0.25);
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), f.yaw - side * 0.9);
        this.blocks.addBox(p, { x: arm, y: 0.04, z: 0.35 }, 'boost', { rotation: q, jitter: 0 });
      }
    }
    const center = this._at(f, 0, 0.75);
    this._keep(
      this.physics.addSensorCuboid({
        position: center,
        halfExtents: { x: f.width / 2, y: 0.9, z: f.len / 2 },
        yaw: f.yaw,
        tag: 'boost',
        data: zone,
        onCollide: ({ otherInfo, started }) => {
          if (!started || otherInfo?.tag !== 'ball') return;
          const ball = otherInfo.data;
          if (this.handlers.onBoost) this.handlers.onBoost(zone, ball);
          else ball?.boost?.(BOOST_STRENGTH, f.forward);
        },
      }),
    );
  }

  _buildBumper(f) {
    const half = f.half ?? BUMPER_HALF;
    const H = 1.1;
    const p = this._at(f, f.lateral, H / 2);
    const rot = yawQuat(f.yaw + Math.PI / 4);
    this.blocks.addBox(p, { x: half * 2, y: H, z: half * 2 }, 'bumper', { rotation: rot });
    this.blocks.addBox({ x: p.x, y: p.y + H / 2 + 0.1, z: p.z }, { x: half * 2 - 0.2, y: 0.2, z: half * 2 - 0.2 }, 'white', { rotation: rot, jitter: 0 });
    this._keep(
      this.physics.addFixedCuboid({
        position: p,
        halfExtents: { x: half, y: H / 2, z: half },
        rotation: rot,
        friction: 0.2,
        restitution: 0.9,
        tag: 'bumper',
        events: true,
        onCollide: ({ otherInfo, started }) => {
          if (!started || otherInfo?.tag !== 'ball') return;
          const ball = otherInfo.data;
          if (ball?.body) {
            const t = ball.body.translation();
            const dx = t.x - p.x;
            const dz = t.z - p.z;
            const d = Math.hypot(dx, dz) || 1;
            ball.push({ x: (dx / d) * BUMPER_KICK, y: 0.6, z: (dz / d) * BUMPER_KICK });
          }
          this.handlers.onBumper?.(ball);
        },
      }),
    );
  }

  _buildWall(f) {
    const w = f.width + 0.6;
    const p = this._at(f, 0, 0.6);
    this.blocks.addBox(p, { x: w, y: 1.2, z: 0.6 }, 'bumper', { yaw: f.yaw });
    this._keep(
      this.physics.addFixedCuboid({
        position: p,
        halfExtents: { x: w / 2, y: 0.6, z: 0.3 },
        yaw: f.yaw,
        restitution: 0.5,
        tag: 'bumper',
        events: true,
        onCollide: ({ otherInfo, started }) => {
          if (started && otherInfo?.tag === 'ball') this.handlers.onBumper?.(otherInfo.data);
        },
      }),
    );
  }

  // ------------------------------------------------------------ runtime

  /** Advance hazard time and set kinematic targets. Call before physics.step. */
  update(dt) {
    this.prevTime = this.time;
    this.time += dt;
    for (const h of this.hazards) h.update(this.time);
  }

  /** Pose hazard meshes between the last two steps (alpha ∈ [0,1]). */
  render(alpha = 1) {
    const t = this.prevTime + (this.time - this.prevTime) * alpha;
    for (const h of this.hazards) h.render(t);
  }

  /** Jump hazards to time t (e.g. restart). */
  setTime(t) {
    this.time = this.prevTime = t;
    for (const h of this.hazards) {
      const p = h.pose(t);
      h.body.setTranslation(p.position, true);
      h.body.setRotation(p.rotation, true);
      h.render(t);
    }
  }

  dispose() {
    for (const h of this.hazards || []) h.dispose();
    this.hazards = [];
    if (this.physics && !this.physics.disposed) {
      const seen = new Set();
      for (const b of this.bodies || []) {
        if (seen.has(b)) continue;
        seen.add(b);
        if (this.physics.bodies.has(b)) this.physics.remove(b);
      }
    }
    this.bodies = [];
    this.blocks?.dispose();
    this.roadMesh?.geometry.dispose();
    this.roadMaterial?.dispose();
    this.hazardMaterial?.dispose();
    this.group?.removeFromParent();
  }
}

/**
 * Lay out and build a track.
 * @param {object} o
 * @param {object} o.physics
 * @param {THREE.Object3D} o.scene
 * @param {Array<string|object>} o.pieces piece ids or {id, ...params}
 * @param {object} [o.options] {width, rails, hazardSpeed, start}
 * @param {object} [o.handlers]
 * @returns {Track}
 */
export function buildTrack({ physics, scene, pieces, options = {}, handlers = {}, palette }) {
  return new Track(pieces, options).build({ physics, scene, handlers, palette });
}
