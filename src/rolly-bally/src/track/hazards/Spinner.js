// Spinner: a bar at ball height rotating around a post in the middle of the
// road at a constant speed (direction from params.dir, default +1).

import { Hazard } from './Hazard.js';
import { yawQuat } from '../math.js';

export const SPINNER_OMEGA = 1.3; // rad/s at speed 1

export class Spinner extends Hazard {
  static type = 'spinner';

  static config(frame, width, params = {}, hazardSpeed = 1) {
    const speed = (params.speed ?? 1) * hazardSpeed;
    return {
      yaw: frame.yaw,
      center: { ...frame.position },
      barLength: Math.max(1.5, width - 0.5),
      omega: SPINNER_OMEGA * speed * (params.dir === -1 ? -1 : 1),
      phase: params.phase ?? 0,
      restitution: 0.4,
    };
  }

  static angle(cfg, t) {
    return cfg.phase + cfg.omega * t;
  }

  static pose(cfg, t) {
    return { position: cfg.center, rotation: yawQuat(cfg.yaw + Spinner.angle(cfg, t)) };
  }

  _shapes(cfg) {
    return [
      { type: 'cuboid', halfExtents: { x: cfg.barLength / 2, y: 0.25, z: 0.3 }, offset: { x: 0, y: 0.5, z: 0 } },
      { type: 'cylinder', halfHeight: 0.8, radius: 0.45, offset: { x: 0, y: 0.8, z: 0 } },
    ];
  }

  _parts(cfg) {
    const L = cfg.barLength;
    return [
      { box: [0, 0.5, 0], size: [L, 0.5, 0.6], color: 'hazard' },
      { box: [L / 2 - 0.3, 0.5, 0], size: [0.6, 0.54, 0.64], color: 'white' },
      { box: [-L / 2 + 0.3, 0.5, 0], size: [0.6, 0.54, 0.64], color: 'white' },
      { box: [0, 0.8, 0], size: [0.9, 1.6, 0.9], color: 'metal' },
      { box: [0, 1.7, 0], size: [1.1, 0.25, 1.1], color: 'yellow' },
    ];
  }
}
