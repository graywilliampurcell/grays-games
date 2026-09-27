// Swinging hammer: a post beside the road; an arm at ball height sweeps from
// "open" (lying along the road edge, pointing forward) to "closed" (straight
// across the road) and back, sinusoidally. Closing sweeps toward the player,
// so it shoves the ball back and sideways. Big mallet head at the tip.

import { Hazard } from './Hazard.js';
import { yawQuat } from '../math.js';

export const HAMMER_PERIOD = 3.2; // s at speed 1
const ARM_Y = 0.55; // arm center height (ball center is 0.5)

export class Hammer extends Hazard {
  static type = 'hammer';

  static config(frame, width, params = {}, hazardSpeed = 1) {
    const side = params.side === -1 ? -1 : 1;
    const hw = width / 2;
    const off = side * (hw + 0.9);
    const speed = (params.speed ?? 1) * hazardSpeed;
    return {
      side,
      yaw: frame.yaw,
      pivot: {
        x: frame.position.x + frame.right.x * off,
        y: frame.position.y,
        z: frame.position.z + frame.right.z * off,
      },
      length: width + 1.4,
      omega: (2 * Math.PI * speed) / HAMMER_PERIOD,
      phase: params.phase ?? 0,
      restitution: 0.4,
    };
  }

  /** Opening angle: 0 = across the road, PI/2 = open (along the edge). */
  static angle(cfg, t) {
    return (Math.PI / 2) * (0.5 + 0.5 * Math.sin(cfg.omega * t + cfg.phase));
  }

  static pose(cfg, t) {
    const phi = Hammer.angle(cfg, t);
    // Body-local +x is the arm; a yaw rotation maps +x to right(yaw). Across
    // the road (phi 0) points away from the post, open (PI/2) points forward.
    const psi = cfg.side > 0 ? cfg.yaw + Math.PI - phi : cfg.yaw + phi;
    return { position: cfg.pivot, rotation: yawQuat(psi) };
  }

  _shapes(cfg) {
    const L = cfg.length;
    const armEnd = L - 1.3;
    return [
      { type: 'cuboid', halfExtents: { x: (armEnd - 0.4) / 2, y: 0.3, z: 0.25 }, offset: { x: (armEnd + 0.4) / 2, y: ARM_Y, z: 0 } },
      { type: 'cuboid', halfExtents: { x: 0.65, y: 0.7, z: 0.6 }, offset: { x: L - 0.65, y: 0.8, z: 0 } },
    ];
  }

  _parts(cfg) {
    const L = cfg.length;
    const armEnd = L - 1.3;
    return [
      { box: [(armEnd + 0.4) / 2, ARM_Y, 0], size: [armEnd - 0.4, 0.6, 0.5], color: 'wood' },
      { box: [L - 0.65, 0.8, 0], size: [1.3, 1.4, 1.2], color: 'hazard' },
      { box: [L - 0.65, 0.8, 0], size: [1.4, 0.3, 1.3], color: 'white' },
      { box: [0, 1.0, 0], size: [1.0, 0.5, 1.0], color: 'yellow' },
    ];
  }

  _static(cfg, blocks, physics) {
    const p = cfg.pivot;
    blocks.addBox({ x: p.x, y: p.y + 1.35, z: p.z }, { x: 0.8, y: 2.7, z: 0.8 }, 'metal', { yaw: cfg.yaw });
    blocks.addBox({ x: p.x, y: p.y + 2.85, z: p.z }, { x: 1.1, y: 0.3, z: 1.1 }, 'hazard', { yaw: cfg.yaw });
    blocks.addBox({ x: p.x, y: p.y - 3, z: p.z }, { x: 0.8, y: 6, z: 0.8 }, 'pillar', { yaw: cfg.yaw });
    // Post collider stops below the arm hub, so it never overlaps the arm.
    this._fixed(physics, { position: { x: p.x, y: p.y + 1.35, z: p.z }, halfExtents: { x: 0.35, y: 1.35, z: 0.35 }, yaw: cfg.yaw });
  }
}
