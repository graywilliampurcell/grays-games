// Wrecking ball: hangs from a gantry over the road and swings across it like a
// pendulum (sinusoidal angle; frequency of a real pendulum of that length).

import { Hazard } from './Hazard.js';
import { axisAngleQuat, mulQuat, yawQuat } from '../math.js';

export const WRECK_PIVOT_HEIGHT = 6.5;
export const WRECK_RADIUS = 0.8;
const HANG = 0.9; // ball center height above the road at the bottom of the swing

export class WreckingBall extends Hazard {
  static type = 'wreckingBall';

  static config(frame, width, params = {}, hazardSpeed = 1) {
    const chain = WRECK_PIVOT_HEIGHT - HANG;
    const speed = (params.speed ?? 1) * hazardSpeed;
    const reach = width / 2 + 1; // swing out past the road edge
    return {
      yaw: frame.yaw,
      forward: { ...frame.forward },
      right: { ...frame.right },
      width,
      pivot: { x: frame.position.x, y: frame.position.y + WRECK_PIVOT_HEIGHT, z: frame.position.z },
      chain,
      amplitude: Math.asin(Math.min(0.95, reach / chain)),
      omega: Math.sqrt(20 / chain) * speed,
      phase: params.phase ?? 0,
      restitution: 0.5,
    };
  }

  static angle(cfg, t) {
    return cfg.amplitude * Math.sin(cfg.omega * t + cfg.phase);
  }

  static pose(cfg, t) {
    // Swing about the road's forward axis (horizontal), after facing the road.
    const q = mulQuat(axisAngleQuat(cfg.forward, WreckingBall.angle(cfg, t)), yawQuat(cfg.yaw));
    return { position: cfg.pivot, rotation: q };
  }

  /** World position of the ball's center at time t (for tests / AI). */
  static ballCenter(cfg, t) {
    const th = WreckingBall.angle(cfg, t);
    const f = cfg.forward;
    const down = { x: 0, y: -cfg.chain, z: 0 };
    const c = Math.cos(th);
    const s = Math.sin(th);
    // Rodrigues: v c + (f × v) s + f (f·v)(1 - c); f·v = 0 (f horizontal).
    const cross = { x: f.y * down.z - f.z * down.y, y: f.z * down.x - f.x * down.z, z: f.x * down.y - f.y * down.x };
    return {
      x: cfg.pivot.x + down.x * c + cross.x * s,
      y: cfg.pivot.y + down.y * c + cross.y * s,
      z: cfg.pivot.z + down.z * c + cross.z * s,
    };
  }

  _shapes(cfg) {
    return [{ type: 'ball', radius: WRECK_RADIUS, offset: { x: 0, y: -cfg.chain, z: 0 } }];
  }

  _parts(cfg) {
    const parts = [{ sphere: [0, -cfg.chain, 0], radius: WRECK_RADIUS, color: 'hazard', detail: 1 }];
    // Chain links (alternating orientation) from the pivot down to the ball.
    const links = Math.floor((cfg.chain - WRECK_RADIUS) / 0.45);
    for (let i = 0; i < links; i++) {
      const alt = i % 2;
      parts.push({ box: [0, -0.25 - i * 0.45, 0], size: alt ? [0.14, 0.45, 0.3] : [0.3, 0.45, 0.14], color: 'metal' });
    }
    parts.push({ box: [0, -cfg.chain + WRECK_RADIUS + 0.05, 0], size: [0.5, 0.2, 0.5], color: 'black' });
    return parts;
  }

  _static(cfg, blocks, physics) {
    const hw = cfg.width / 2 + 0.9 + WRECK_RADIUS;
    const base = cfg.pivot.y - WRECK_PIVOT_HEIGHT;
    const H = WRECK_PIVOT_HEIGHT + 0.4;
    for (const side of [-1, 1]) {
      const x = cfg.pivot.x + cfg.right.x * side * hw;
      const z = cfg.pivot.z + cfg.right.z * side * hw;
      blocks.addBox({ x, y: base + H / 2, z }, { x: 0.8, y: H, z: 0.8 }, 'metal', { yaw: cfg.yaw });
      blocks.addBox({ x, y: base - 3, z }, { x: 0.8, y: 6, z: 0.8 }, 'pillar', { yaw: cfg.yaw });
      this._fixed(physics, { position: { x, y: base + H / 2, z }, halfExtents: { x: 0.4, y: H / 2, z: 0.4 }, yaw: cfg.yaw });
    }
    // Cross beam (visual only: far above the ball).
    blocks.addBox({ x: cfg.pivot.x, y: base + H + 0.3, z: cfg.pivot.z }, { x: 2 * hw + 0.8, y: 0.6, z: 0.8 }, 'hazard', { yaw: cfg.yaw });
  }
}
