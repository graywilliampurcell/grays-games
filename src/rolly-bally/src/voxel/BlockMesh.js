// Voxel-look renderer. Collect boxes and wedges, then build() into one
// InstancedMesh per shape (so a whole track or world is ~2 draw calls).
// Faces are pre-shaded (top bright, sides darker) and every instance gets a
// tiny deterministic color jitter so big surfaces read as blocks.
//
//   const blocks = new BlockMesh({ palette: 'race' });
//   blocks.addBox({x:0,y:-0.5,z:0}, {x:8,y:1,z:20}, 'track');
//   blocks.addWedge({x:0,y:0.5,z:-12}, {x:8,y:1,z:4}, 'trackAlt', { yaw: Math.PI });
//   scene.add(blocks.build());
//   ... later: blocks.dispose()

import * as THREE from 'three';

// Shared color keys every palette has (bright primaries).
const COMMON = {
  red: '#e8302e',
  orange: '#ff8a1f',
  yellow: '#ffd21f',
  green: '#2fb84a',
  blue: '#2e6be8',
  purple: '#8a3ee8',
  pink: '#ff5fa2',
  cyan: '#22d3ee',
  white: '#f7f7f7',
  black: '#222222',
  gray: '#9aa0a6',
  wood: '#b07a45',
};

export const PALETTES = {
  grass: {
    ...COMMON,
    sky: '#8fd3ff',
    fog: '#bfe6ff',
    grass: '#5ccb3c',
    grassDark: '#48b02e',
    dirt: '#9b6a3c',
    stone: '#9aa0a6',
    sand: '#f1d98a',
    water: '#3fa9f5',
    leaves: '#2f9e3a',
    trunk: '#7a4f2a',
    wall: '#c9a06a',
    rail: '#ffffff',
    pad: '#ffd21f',
  },
  snow: {
    ...COMMON,
    sky: '#b9dcff',
    fog: '#e3f1ff',
    grass: '#f4f9ff', // "ground" key so generators can share code
    grassDark: '#dde9f7',
    snow: '#f4f9ff',
    dirt: '#8d7d74',
    stone: '#8e9aa6',
    sand: '#e6eef7',
    water: '#9edcff',
    ice: '#aee4ff',
    leaves: '#2e7d4f',
    trunk: '#6b4a2e',
    wall: '#c7d6e6',
    rail: '#ffffff',
    pad: '#ff8a1f',
  },
  race: {
    ...COMMON,
    sky: '#6ec6ff',
    fog: '#c6ecff',
    track: '#ffd21f',
    trackAlt: '#ffb800',
    edge: '#2e6be8',
    rail: '#e8302e',
    railPost: '#ffffff',
    start: '#2fb84a',
    finish: '#ffffff',
    finishDark: '#222222',
    checkpoint: '#ff5fa2',
    boost: '#22d3ee',
    hazard: '#e8302e',
    metal: '#7a7f87',
    bumper: '#ff5fa2',
    platform: '#8a3ee8',
    pillar: '#dfe7f2',
  },
};

/** Resolve a palette name or object. */
export function getPalette(p) {
  return typeof p === 'string' ? PALETTES[p] || PALETTES.grass : p || PALETTES.grass;
}

// Face shade factors (baked into vertex colors).
const SHADE = { top: 1.0, bottom: 0.6, x: 0.8, z: 0.9 };

function shadeBoxGeometry() {
  const g = new THREE.BoxGeometry(1, 1, 1);
  const n = g.attributes.normal;
  const colors = new Float32Array(n.count * 3);
  for (let i = 0; i < n.count; i++) {
    const ny = n.getY(i);
    const nx = n.getX(i);
    const s = ny > 0.5 ? SHADE.top : ny < -0.5 ? SHADE.bottom : Math.abs(nx) > 0.5 ? SHADE.x : SHADE.z;
    colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = s;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

/**
 * Unit wedge in a 1×1×1 box centered at the origin: full-height at +z,
 * zero height at -z (so with yaw 0 it's a ramp you climb while moving +z).
 */
export function makeWedgeGeometry() {
  const L = -0.5;
  const H = 0.5;
  // Triangles listed per face, flat normals via toNonIndexed + computeVertexNormals.
  const v = [
    // bottom
    [L, L, L], [H, L, L], [H, L, H], [L, L, L], [H, L, H], [L, L, H],
    // back (+z) wall
    [L, L, H], [H, L, H], [H, H, H], [L, L, H], [H, H, H], [L, H, H],
    // slope
    [L, L, L], [L, H, H], [H, H, H], [L, L, L], [H, H, H], [H, L, L],
    // left (-x) side
    [L, L, L], [L, L, H], [L, H, H],
    // right (+x) side
    [H, L, L], [H, H, H], [H, L, H],
  ];
  const pos = new Float32Array(v.flat());
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const n = g.attributes.normal;
  const colors = new Float32Array(n.count * 3);
  for (let i = 0; i < n.count; i++) {
    const ny = n.getY(i);
    const s = ny > 0.3 ? SHADE.top : ny < -0.5 ? SHADE.bottom : Math.abs(n.getX(i)) > 0.5 ? SHADE.x : SHADE.z;
    colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = s;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

function hash3(x, y, z) {
  let h = Math.imul(Math.round(x * 7) | 0, 73856093) ^ Math.imul(Math.round(y * 7) | 0, 19349663) ^ Math.imul(Math.round(z * 7) | 0, 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const _yAxis = new THREE.Vector3(0, 1, 0);

export class BlockMesh {
  /**
   * @param {object} [opts]
   * @param {string|object} [opts.palette='grass'] 'grass' | 'snow' | 'race' or a {key: color} object
   * @param {number} [opts.jitter=0.05] per-block brightness variation (0 = none)
   */
  constructor({ palette = 'grass', jitter = 0.05 } = {}) {
    this.palette = getPalette(palette);
    this.jitter = jitter;
    this.boxes = [];
    this.wedges = [];
    this.group = null;
  }

  _color(key) {
    if (typeof key === 'number') return _c.setHex(key);
    const v = this.palette[key] ?? key;
    return _c.set(v);
  }

  _push(list, position, size, color, opts = {}) {
    let q = null;
    if (opts.rotation) q = opts.rotation.clone ? opts.rotation.clone() : new THREE.Quaternion(opts.rotation.x, opts.rotation.y, opts.rotation.z, opts.rotation.w);
    else if (opts.yaw) q = new THREE.Quaternion().setFromAxisAngle(_yAxis, opts.yaw);
    const c = this._color(color);
    const j = opts.jitter ?? this.jitter;
    const f = j ? 1 + (hash3(position.x, position.y, position.z) * 2 - 1) * j : 1;
    list.push({
      p: [position.x, position.y, position.z],
      s: [size.x, size.y, size.z],
      q,
      c: [c.r * f, c.g * f, c.b * f],
    });
    return this;
  }

  /**
   * Box centered at `position` with full size `size` ({x,y,z}).
   * color: palette key ('track', 'grass'...), CSS color string or hex number.
   * opts: {rotation: Quaternion} | {yaw: radians}, jitter override.
   */
  addBox(position, size, color, opts) {
    return this._push(this.boxes, position, size, color, opts);
  }

  /** Box from min/max corners (axis aligned). */
  addBoxMinMax(min, max, color, opts) {
    return this.addBox(
      { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2 },
      { x: max.x - min.x, y: max.y - min.y, z: max.z - min.z },
      color,
      opts,
    );
  }

  /**
   * Wedge (ramp) filling the box at `position`/`size`: low edge at local -z,
   * high edge at local +z; rotate with opts.yaw / opts.rotation.
   */
  addWedge(position, size, color, opts) {
    return this._push(this.wedges, position, size, color, opts);
  }

  get count() {
    return this.boxes.length + this.wedges.length;
  }

  _instanced(geometry, list, material) {
    const mesh = new THREE.InstancedMesh(geometry, material, list.length);
    list.forEach((b, i) => {
      _p.fromArray(b.p);
      _s.fromArray(b.s);
      if (b.q) _q.copy(b.q);
      else _q.identity();
      _m.compose(_p, _q, _s);
      mesh.setMatrixAt(i, _m);
      mesh.setColorAt(i, _c.setRGB(b.c[0], b.c[1], b.c[2]));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.computeBoundingBox();
    return mesh;
  }

  /** Build (or rebuild) into a THREE.Group with ≤ 2 draw calls. */
  build() {
    this.disposeGpu();
    const group = new THREE.Group();
    group.name = 'blocks';
    this.material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    if (this.boxes.length) group.add(this._instanced(shadeBoxGeometry(), this.boxes, this.material));
    if (this.wedges.length) group.add(this._instanced(makeWedgeGeometry(), this.wedges, this.material));
    this.group = group;
    return group;
  }

  /** Free GPU resources and detach from the scene. */
  disposeGpu() {
    if (!this.group) return;
    this.group.removeFromParent();
    this.group.traverse((o) => {
      if (o.isInstancedMesh) {
        o.geometry.dispose();
        o.dispose();
      }
    });
    if (this.material) this.material.dispose();
    this.group = null;
  }

  dispose() {
    this.disposeGpu();
    this.boxes = [];
    this.wedges = [];
  }
}

/**
 * Standard lighting for a voxel scene: hemisphere + sun. Returns the lights
 * group (the Game host adds this to every mode's scene by default).
 */
export function makeDefaultLights() {
  const g = new THREE.Group();
  g.name = 'default-lights';
  g.add(new THREE.HemisphereLight(0xffffff, 0x8a9a7a, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(0.5, 1, 0.3);
  g.add(sun);
  return g;
}

/** Set scene background + distance fog from a palette. */
export function applySky(scene, palette, { near = 60, far = 220 } = {}) {
  const p = getPalette(palette);
  scene.background = new THREE.Color(p.sky);
  scene.fog = new THREE.Fog(p.fog, near, far);
}
