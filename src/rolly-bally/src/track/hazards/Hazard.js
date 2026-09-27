// Base class for moving (kinematic) hazards. A subclass provides:
//   static config(frame, width, params, hazardSpeed) → cfg   (pure)
//   static pose(cfg, t) → {position, rotation}               (pure; used by tests)
//   _shapes(cfg)      → Physics.addKinematic shapes (body-local)
//   _parts(cfg)       → makePartsGeometry parts (body-local)
//   _static(cfg, blocks, physics)  optional fixed posts/gantries
//   _contact(body, started)        optional: player ball's body touching it
//   static reportsHits = false     don't call onHit (e.g. platforms you ride)
//
// The Track drives it: update(t) before each physics step sets the kinematic
// target for time t (end of the step), render(t) poses the mesh. Rapier derives
// the body's velocity from those targets, so hits shove the ball plausibly.

import * as THREE from 'three';
import { makePartsGeometry } from './parts.js';

export class Hazard {
  /**
   * @param {object} o
   * @param {object} o.physics Physics
   * @param {THREE.Object3D} o.scene
   * @param {object} o.frame track frame at the hazard {position, yaw, forward, right, width}
   * @param {object} o.params piece params {phase, speed, side...}
   * @param {number} [o.hazardSpeed=1]
   * @param {THREE.Material} o.material shared hazard material
   * @param {object} [o.blocks] BlockMesh for static parts
   * @param {(info) => void} [o.onHit] called when the player ball is hit
   */
  constructor({ physics, scene, frame, params = {}, hazardSpeed = 1, material, blocks, onHit }) {
    const Cls = this.constructor;
    this.type = Cls.type;
    this.physics = physics;
    this.cfg = Cls.config(frame, frame.width, params, hazardSpeed);
    const p0 = Cls.pose(this.cfg, 0);
    this.staticBodies = [];
    if (blocks) this._static(this.cfg, blocks, physics);

    const { body, colliders } = physics.addKinematic({
      position: p0.position,
      rotation: p0.rotation,
      shapes: this._shapes(this.cfg),
      friction: this.cfg.friction ?? 0.5,
      restitution: this.cfg.restitution ?? 0.3,
      tag: 'hazard',
      data: this,
      events: true,
      onCollide: ({ other, otherInfo, started }) => {
        if (otherInfo?.tag !== 'ball') return;
        if (started && onHit && Cls.reportsHits !== false) onHit({ type: this.type, hazard: this, ball: otherInfo.data });
        this._contact(other.parent(), started);
      },
    });
    this.body = body;
    this.colliders = colliders;

    this.mesh = new THREE.Mesh(makePartsGeometry(this._parts(this.cfg)), material);
    this.mesh.name = `hazard-${this.type}`;
    scene.add(this.mesh);
    this.render(0);
  }

  _static() {}

  /** Player ball body contact started/ended (subclasses may track riders). */
  _contact() {}

  _fixed(physics, opts) {
    const r = physics.addFixedCuboid({ friction: 0.4, restitution: 0.3, tag: 'hazard-static', ...opts });
    this.staticBodies.push(r.body);
    return r;
  }

  pose(t) {
    return this.constructor.pose(this.cfg, t);
  }

  /** Set the kinematic target for time t (call before the physics step). */
  update(t) {
    const p = this.pose(t);
    this.body.setNextKinematicTranslation(p.position);
    this.body.setNextKinematicRotation(p.rotation);
  }

  /** Pose the mesh for render time t. */
  render(t) {
    const p = this.pose(t);
    this.mesh.position.set(p.position.x, p.position.y, p.position.z);
    this.mesh.quaternion.set(p.rotation.x, p.rotation.y, p.rotation.z, p.rotation.w);
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    if (!this.physics.disposed) {
      this.physics.remove(this.body);
      for (const b of this.staticBodies) this.physics.remove(b);
    }
  }
}
