// Dark tunnels (Pathways P2): what it feels like to roll through one.
//
// Entering, the world fades to near-black over the first 2 blocks: the
// lights, sky and fog go dark; the ball keeps a faint glow and the stars
// inside still sparkle (they have their own glow); the far opening shows as
// a bright white rectangle. Leaving, it fades back over the last 2 blocks
// and plays a "whoosh". The tunnel blocks and colliders themselves are built
// by the mode (pathways/SkyFeatures.js on the sky roads).

import * as THREE from 'three';
import { FEATURE_SPECS } from '../playground/Features.js';

export const FADE_BLOCKS = 2; // fade in / out over this many blocks
export const MAX_DARK = 0.92; // how dark the lights get at full darkness
const DARK = new THREE.Color('#05060a');
const BALL_GLOW = 0.45; // emissive strength of the ball at full darkness
const WHOOSH_FROM = 0.5; // leaving after it was at least this dark → whoosh

/**
 * Pure: world (x, z) → the tunnel's local (u across, v along) coordinates
 * (inverse of featureToWorld).
 */
export function tunnelLocal(f, x, z) {
  const { W, L } = FEATURE_SPECS[f.type];
  const dx = x - f.X0;
  const dz = z - f.Z0;
  switch (f.dir) {
    case 0: return { u: dx, v: dz };
    case 1: return { u: W - dz, v: dx };
    case 2: return { u: W - dx, v: L - dz };
    default: return { u: dz, v: L - dx };
  }
}

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** The ground tunnel's shape (u across [0, W), walls 1 block thick). */
export const GROUND_TUNNEL = { ...FEATURE_SPECS.darkTunnels, margin: 1 };

/**
 * Pure: darkness 0..1 at local position (u, v), height y above the tunnel
 * floor. Full in the middle, fading over FADE_BLOCKS at each end, 0 outside.
 * spec: {W, inside: [v0, v1], height, margin} (u inside [margin, W - margin]).
 */
export function darknessAt(u, v, y = 0, s = GROUND_TUNNEL) {
  const [v0, v1] = s.inside;
  if (u < s.margin || u > s.W - s.margin || v < v0 || v > v1 || y > s.height) return 0;
  return Math.min(smooth((v - v0) / FADE_BLOCKS), smooth((v1 - v) / FADE_BLOCKS));
}

/** Runtime: darkness, exit lights, ball glow and whoosh for all dark tunnels. */
export class DarkTunnels {
  /**
   * @param {object} o
   * @param {THREE.Scene} o.scene
   * @param {Array} o.tunnels [{y, fwd: {x, z}, yaw, spec, local(x, z) → {u, v},
   *   exits: [{x, y, z}, {x, y, z}] (entrance, far end), exitSize: {w, h}}]
   * @param {object} o.audio
   */
  constructor({ scene, tunnels, audio }) {
    this.scene = scene;
    this.audio = audio;
    this.tunnels = tunnels;
    this.dark = 0;
    this.peak = 0;
    this.lights = [];
    scene.traverse((o) => {
      if (o.isLight) this.lights.push({ light: o, base: o.intensity });
    });
    this.sky = scene.background?.isColor ? scene.background.clone() : null;
    this.fog = scene.fog ? scene.fog.color.clone() : null;

    // A white "daylight" rectangle in each opening, facing in; only the one
    // ahead is shown, and only in the dark.
    this.mat = new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false, toneMapped: false, side: THREE.DoubleSide });
    this.geos = [];
    this.exits = tunnels.map((f) => {
      const geo = new THREE.PlaneGeometry(f.exitSize.w, f.exitSize.h);
      this.geos.push(geo);
      return f.exits.map((p) => {
        const m = new THREE.Mesh(geo, this.mat);
        m.position.set(p.x, p.y, p.z);
        m.rotation.y = f.yaw;
        m.visible = false;
        m.name = 'dark-tunnel-exit';
        scene.add(m);
        return m;
      });
    });
  }

  get count() {
    return this.tunnels.length;
  }

  /** Let the ball glow with its own colors in the dark (set once). */
  attachBall(ball) {
    this.ball = ball;
    const m = ball.mesh?.material;
    if (m && 'emissive' in m) {
      m.emissiveMap = m.map || null;
      m.emissive.setRGB(0, 0, 0);
      m.needsUpdate = true;
    }
  }

  /**
   * @param {number} dt
   * @param {{x, y, z}} pos ball position
   * @param {{x, z}} vel ball velocity (which way is "ahead")
   */
  update(dt, pos, vel) {
    let want = 0;
    let at = -1;
    let local = null;
    for (let i = 0; i < this.tunnels.length; i++) {
      const f = this.tunnels[i];
      const l = f.local(pos.x, pos.z);
      const d = darknessAt(l.u, l.v, pos.y - f.y, f.spec);
      if (d > want) {
        want = d;
        at = i;
        local = l;
      }
    }
    // Follow the ball closely, but never pop.
    this.dark += (want - this.dark) * (1 - Math.exp(-12 * dt));
    if (this.dark < 1e-3) this.dark = 0;

    if (this.dark > this.peak) this.peak = this.dark;
    if (want === 0 && this.peak >= WHOOSH_FROM) {
      this.audio?.play('whoosh', { volume: 0.8 });
      this.peak = 0;
    } else if (want === 0) {
      this.peak = 0;
    }

    this._apply(this.dark);

    // Show the opening ahead (by the ball's motion along the tunnel).
    for (const ends of this.exits) for (const m of ends) m.visible = false;
    if (at >= 0 && this.dark > 0.05) {
      const f = this.tunnels[at];
      const along = vel.x * f.fwd.x + vel.z * f.fwd.z;
      const ahead = Math.abs(along) < 0.3 ? (local.v < f.spec.L / 2 ? 1 : 0) : along > 0 ? 1 : 0;
      this.exits[at][ahead].visible = true;
    }
  }

  _apply(d) {
    const k = 1 - MAX_DARK * d;
    for (const { light, base } of this.lights) light.intensity = base * k;
    if (this.sky) this.scene.background.copy(this.sky).lerp(DARK, d);
    if (this.fog) this.scene.fog.color.copy(this.fog).lerp(DARK, d);
    const m = this.ball?.mesh?.material;
    if (m?.emissive) m.emissive.setScalar(BALL_GLOW * d);
  }

  dispose() {
    this._apply(0);
    for (const ends of this.exits) for (const m of ends) m.removeFromParent();
    for (const g of this.geos) g.dispose();
    this.mat.dispose();
  }
}
