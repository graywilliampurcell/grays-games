// Collectible stars.
//  - placeStars(ctx, rng): pure placement (used by TerrainGenerator.generate).
//    Some stars go on feature bonus spots (ramp tops, jump arcs, tunnels),
//    the rest in little trails of 3–5 across reachable ground.
//  - StarField: one InstancedMesh of spinning stars + a pooled sparkle burst
//    (one Points draw call). collect(ballPos) returns how many were picked up.

import * as THREE from 'three';
import { cellCenter, heightAt, cellRange } from './TerrainGenerator.js';

export const STAR_COUNTS = {
  none: { small: 0, medium: 0, large: 0 },
  some: { small: 15, medium: 30, large: 50 },
  lots: { small: 40, medium: 80, large: 120 },
};

export const STAR_HOVER = 0.9; // star center height above the ground
const TRAIL_GAP = 2.5;

/**
 * ctx: {t, n, blocked, reach, features, pads, size, config}. Returns [{x, y, z}]
 * with exactly STAR_COUNTS[config.stars][size] entries.
 */
export function placeStars(ctx, rng) {
  const { t, n, blocked, reach, features, size, config } = ctx;
  const want = (STAR_COUNTS[config.stars] || STAR_COUNTS.none)[size] || 0;
  const stars = [];
  if (!want) return stars;

  const ok = (cx, cz) =>
    cx > 0 && cz > 0 && cx < n - 1 && cz < n - 1 && reach[cx * n + cz] && !blocked[cx * n + cz];
  const spaced = (x, z, gap) => stars.every((s) => (s.x - x) ** 2 + (s.z - z) ** 2 >= gap * gap);
  const onGround = (cx, cz) => {
    const p = cellCenter(t, cx, cz);
    return { x: p.x, y: heightAt(t, p.x, p.z) + STAR_HOVER, z: p.z };
  };

  // 1) Bonus spots on features (up to ~40% of the stars).
  const spots = rng.shuffle(features.flatMap((f) => f.starSpots || []));
  for (const s of spots) {
    if (stars.length >= Math.ceil(want * 0.4)) break;
    stars.push({ x: s.x, y: s.y, z: s.z });
  }

  // 2) Trails: pick a start cell, walk in a straight line.
  const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (let a = 0; a < want * 60 && stars.length < want; a++) {
    let cx = rng.int(2, n - 3);
    let cz = rng.int(2, n - 3);
    const [dx, dz] = rng.pick(dirs);
    const len = rng.int(3, 5);
    const step = TRAIL_GAP / Math.hypot(dx, dz);
    for (let k = 0; k < len && stars.length < want; k++) {
      if (!ok(cx, cz) || cellRange(t, cx, cz) > 0.5) break;
      const p = onGround(cx, cz);
      if (!spaced(p.x, p.z, 2)) break;
      stars.push(p);
      cx = Math.round(cx + dx * step);
      cz = Math.round(cz + dz * step);
    }
  }

  // 3) Fallback (tiny/crowded worlds): scan reachable cells in a seeded order.
  if (stars.length < want) {
    const start = rng.int(0, n * n - 1);
    for (let k = 0; k < n * n && stars.length < want; k++) {
      const i = (start + k * 7919) % (n * n);
      const cx = (i / n) | 0;
      const cz = i % n;
      if (!ok(cx, cz)) continue;
      const p = onGround(cx, cz);
      if (spaced(p.x, p.z, 1.5)) stars.push(p);
    }
  }
  return stars.slice(0, want);
}

// =================================================================== runtime

const COLLECT_RADIUS = 1.25;
const POP_TIME = 0.35;
const SPARKLES_PER_STAR = 14;
const SPARKLE_POOL = 256;

function makeStarGeometry() {
  const shape = new THREE.Shape();
  const outer = 0.5;
  const inner = 0.22;
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 1 });
  g.center();
  return g;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _y = new THREE.Vector3(0, 1, 0);

export class StarField {
  /**
   * @param {object} o
   * @param {THREE.Object3D} o.scene
   * @param {Array<{x,y,z}>} o.stars from generate()
   * @param {number} [o.radius] pickup distance (m) from the ball center
   */
  constructor({ scene, stars, radius = COLLECT_RADIUS }) {
    this.scene = scene;
    this.radius = radius;
    this.stars = stars.map((s, i) => ({ ...s, phase: i * 0.7, state: 'idle', t: 0 }));
    this.remaining = this.stars.length;
    this.time = 0;
    this.meshes = [];

    if (this.stars.length) {
      const mat = new THREE.MeshLambertMaterial({ color: '#ffd21f', emissive: '#b88a00', flatShading: true });
      this.mesh = new THREE.InstancedMesh(makeStarGeometry(), mat, this.stars.length);
      this.mesh.name = 'stars';
      this.mesh.frustumCulled = false;
      scene.add(this.mesh);
      this.meshes.push(this.mesh);
      this._updateMatrices();
    }

    // Sparkles: additive points, color fades to black = invisible.
    const pos = new Float32Array(SPARKLE_POOL * 3);
    const col = new Float32Array(SPARKLE_POOL * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.sparkles = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.35,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.sparkles.frustumCulled = false;
    this.sparkles.name = 'sparkles';
    scene.add(this.sparkles);
    this.meshes.push(this.sparkles);
    this.sp = Array.from({ length: SPARKLE_POOL }, () => ({ life: 0, vx: 0, vy: 0, vz: 0, r: 1, g: 1, b: 1 }));
    this.spNext = 0;
    this._sparkRng = 1;
  }

  get total() {
    return this.stars.length;
  }

  /** Check the ball against idle stars. Returns the number collected this call. */
  collect(ballPos) {
    let got = 0;
    const r2 = this.radius * this.radius;
    for (const s of this.stars) {
      if (s.state !== 'idle') continue;
      const dx = s.x - ballPos.x;
      const dy = s.y - ballPos.y;
      const dz = s.z - ballPos.z;
      if (dx * dx + dy * dy + dz * dz > r2) continue;
      s.state = 'pop';
      s.t = 0;
      this.remaining--;
      got++;
      this._burst(s);
    }
    return got;
  }

  // Cosmetic randomness only (not part of the seeded world).
  _rand() {
    this._sparkRng = (this._sparkRng * 16807) % 2147483647;
    return this._sparkRng / 2147483647;
  }

  _burst(s) {
    const pos = this.sparkles.geometry.attributes.position.array;
    for (let k = 0; k < SPARKLES_PER_STAR; k++) {
      const i = this.spNext;
      this.spNext = (this.spNext + 1) % SPARKLE_POOL;
      const p = this.sp[i];
      const a = this._rand() * Math.PI * 2;
      const up = this._rand();
      const sp = 2 + this._rand() * 3;
      p.vx = Math.cos(a) * sp;
      p.vz = Math.sin(a) * sp;
      p.vy = 2 + up * 4;
      p.life = 0.6 + this._rand() * 0.4;
      const white = this._rand() < 0.4;
      p.r = 1;
      p.g = white ? 1 : 0.85;
      p.b = white ? 1 : 0.2;
      pos[i * 3] = s.x;
      pos[i * 3 + 1] = s.y;
      pos[i * 3 + 2] = s.z;
    }
  }

  _updateMatrices() {
    this.stars.forEach((s, i) => {
      let scale = 1;
      let lift = Math.sin(this.time * 2 + s.phase) * 0.12;
      let spin = this.time * 2 + s.phase;
      if (s.state === 'pop') {
        const k = s.t / POP_TIME;
        scale = k < 0.4 ? 1 + k * 1.5 : Math.max(0, 1.6 * (1 - (k - 0.4) / 0.6));
        lift += k * 0.8;
        spin += k * 8;
      } else if (s.state === 'gone') {
        scale = 0;
      }
      _p.set(s.x, s.y + lift, s.z);
      _q.setFromAxisAngle(_y, spin);
      _m.compose(_p, _q, _s.setScalar(scale * 1.1));
      this.mesh.setMatrixAt(i, _m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  render(frameDt) {
    this.time += frameDt;
    if (this.mesh) {
      for (const s of this.stars) {
        if (s.state !== 'pop') continue;
        s.t += frameDt;
        if (s.t >= POP_TIME) s.state = 'gone';
      }
      this._updateMatrices();
    }
    const pos = this.sparkles.geometry.attributes.position.array;
    const col = this.sparkles.geometry.attributes.color.array;
    let any = false;
    for (let i = 0; i < SPARKLE_POOL; i++) {
      const p = this.sp[i];
      if (p.life <= 0) {
        if (col[i * 3] !== 0) col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0;
        continue;
      }
      any = true;
      p.life -= frameDt;
      p.vy -= 9 * frameDt;
      pos[i * 3] += p.vx * frameDt;
      pos[i * 3 + 1] += p.vy * frameDt;
      pos[i * 3 + 2] += p.vz * frameDt;
      const f = Math.max(0, Math.min(1, p.life * 1.6));
      col[i * 3] = p.r * f;
      col[i * 3 + 1] = p.g * f;
      col[i * 3 + 2] = p.b * f;
    }
    if (any || this._sparkDirty) {
      this.sparkles.geometry.attributes.position.needsUpdate = true;
      this.sparkles.geometry.attributes.color.needsUpdate = true;
    }
    this._sparkDirty = any;
  }

  dispose() {
    for (const m of this.meshes) {
      m.removeFromParent();
      m.geometry.dispose();
      m.material.dispose();
      if (m.isInstancedMesh) m.dispose();
    }
    this.meshes = [];
  }
}
