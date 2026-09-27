// Moving platform: a slab, top flush with the road, sliding sideways across a
// hole in the road. It still overlaps the road line by ~0.8 m at the far ends
// of its travel. A rolling ball wouldn't keep up with the platform on friction
// alone (it just rolls in place), so a ball touching it gets the platform's
// change in velocity each step: it rides along like it's glued on.

import { Hazard } from './Hazard.js';
import { yawQuat } from '../math.js';

export const PLATFORM_PERIOD = 5; // s at speed 1
export const PLATFORM_THICKNESS = 0.6;

export class MovingPlatform extends Hazard {
  static type = 'movingPlatform';
  static reportsHits = false;

  static config(frame, width, params = {}, hazardSpeed = 1) {
    const speed = (params.speed ?? 1) * hazardSpeed;
    const platformWidth = Math.max(2.5, width * 0.6);
    return {
      yaw: frame.yaw,
      center: { ...frame.position },
      right: { ...frame.right },
      width,
      platformWidth,
      length: params.length ?? 6.9,
      travel: Math.max(0, width / 2 + platformWidth / 2 - 0.8),
      omega: (2 * Math.PI * speed) / PLATFORM_PERIOD,
      phase: params.phase ?? 0,
      friction: 1.0,
      restitution: 0.05,
    };
  }

  /** Lateral offset of the platform center from the road center (m). */
  static offset(cfg, t) {
    return cfg.travel * Math.sin(cfg.omega * t + cfg.phase);
  }

  /** Lateral velocity (m/s) of the platform. */
  static velocity(cfg, t) {
    return cfg.travel * cfg.omega * Math.cos(cfg.omega * t + cfg.phase);
  }

  static pose(cfg, t) {
    const o = MovingPlatform.offset(cfg, t);
    return {
      position: { x: cfg.center.x + cfg.right.x * o, y: cfg.center.y, z: cfg.center.z + cfg.right.z * o },
      rotation: yawQuat(cfg.yaw),
    };
  }

  // Balls that ever touched the platform; riding is re-checked geometrically
  // every step (contact events flicker while a ball bounces/rolls).
  _contact(body, started) {
    if (started && body) (this.known || (this.known = new Set())).add(body);
  }

  _isRiding(body, t) {
    const c = this.cfg;
    const p = body.translation();
    const o = MovingPlatform.pose(c, t).position;
    const dx = p.x - o.x;
    const dz = p.z - o.z;
    const lat = dx * c.right.x + dz * c.right.z;
    const along = dx * -c.right.z + dz * c.right.x;
    const h = p.y - o.y;
    return Math.abs(lat) <= c.platformWidth / 2 + 0.3 && Math.abs(along) <= c.length / 2 + 0.3 && h > 0 && h < 0.9;
  }

  update(t) {
    super.update(t);
    // Carry riders: a ball that just got on matches the platform's sideways
    // speed; after that it gets the platform's change in velocity each step.
    const v = MovingPlatform.velocity(this.cfg, t);
    const { right } = this.cfg;
    if (this.known && this.lastT !== undefined) {
      if (!this.riding) this.riding = new Set();
      for (const body of this.known) {
        if (!this.physics.bodies.has(body)) {
          this.known.delete(body);
          continue;
        }
        if (!this._isRiding(body, this.lastT)) {
          this.riding.delete(body);
          continue;
        }
        let dv = v - this.lastV;
        if (!this.riding.has(body)) {
          this.riding.add(body);
          const lv = body.linvel();
          dv += this.lastV - (lv.x * right.x + lv.z * right.z);
          // Drop the sideways roll it picked up while the platform slid under it.
          const w = body.angvel();
          const fx = -right.z;
          const fz = right.x;
          const k = w.x * fx + w.z * fz;
          body.setAngvel({ x: w.x - k * fx, y: w.y, z: w.z - k * fz }, true);
        }
        const m = body.mass();
        body.applyImpulse({ x: right.x * dv * m, y: 0, z: right.z * dv * m }, true);
      }
    }
    this.lastT = t;
    this.lastV = v;
  }

  _shapes(cfg) {
    return [
      {
        type: 'cuboid',
        halfExtents: { x: cfg.platformWidth / 2, y: PLATFORM_THICKNESS / 2, z: cfg.length / 2 },
        offset: { x: 0, y: -PLATFORM_THICKNESS / 2, z: 0 },
      },
    ];
  }

  _parts(cfg) {
    const w = cfg.platformWidth;
    const L = cfg.length;
    const t = PLATFORM_THICKNESS;
    const parts = [{ box: [0, -t / 2, 0], size: [w, t, L], color: 'platform' }];
    // Yellow edge trims + arrows showing it slides sideways.
    for (const sx of [-1, 1]) parts.push({ box: [sx * (w / 2 - 0.15), -t / 2 + 0.01, 0], size: [0.32, t + 0.04, L + 0.02], color: 'yellow' });
    for (const sx of [-1, 1]) {
      parts.push({ box: [sx * 0.55, 0.02, 0], size: [0.5, 0.06, 0.25], color: 'white' });
      parts.push({ box: [sx * 0.85, 0.02, 0], size: [0.12, 0.06, 0.7], color: 'white' });
    }
    return parts;
  }
}
