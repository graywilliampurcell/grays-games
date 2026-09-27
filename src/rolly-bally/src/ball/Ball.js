// The player's ball: Rapier dynamic sphere + faceted mesh + blob shadow +
// steering controller. Also usable for non-player balls (skip update()).
//
// Per fixed step (inside mode.update, before the host steps physics):
//   ball.update(dt, input.getMove(), forwardVector)
// Per frame (inside mode.render):
//   ball.render(alpha)

import * as THREE from 'three';
import { makeBallGeometry, makeSkinMaterial } from './skins.js';
import { Dust } from '../fx/Dust.js';

export const BALL_RADIUS = 0.5;

/** Default feel. Modes override per difficulty via ball.setTuning({...}). */
export const DEFAULT_TUNING = {
  speedCap: 8, // m/s, horizontal speed the controller drives toward
  accel: 14, // m/s² of steering push on the ground
  airControl: 0.35, // fraction of accel available in the air
  turnAssist: 1.6, // extra push when steering against current motion
  capDrag: 3, // 1/s: how fast over-cap speed bleeds off (0 = never)
  autoRoll: false, // race diff 1-3: forward is automatic
  cruise: 0.7, // auto-roll: fraction of speedCap with stick centered
  slow: 0.3, // auto-roll: fraction of speedCap when pulling back
  lateral: 0.9, // auto-roll: sideways push as a fraction of accel
};

const UP = new THREE.Vector3(0, 1, 0);

export class Ball {
  /**
   * @param {object} opts
   * @param {import('../core/Physics.js').Physics} opts.physics
   * @param {THREE.Object3D} opts.scene parent for the mesh
   * @param {{x,y,z}} opts.position spawn position (center of the ball)
   * @param {string} [opts.skin='red'] skin id
   * @param {object} [opts.tuning] overrides for DEFAULT_TUNING
   * @param {boolean} [opts.shadow=true] draw a blob shadow under the ball
   * @param {boolean} [opts.dust=true] puff of dust blocks on hard landings
   */
  constructor({ physics, scene, position, skin = 'red', tuning = {}, shadow = true, dust = true, radius = BALL_RADIUS }) {
    this.physics = physics;
    this.radius = radius;
    this.tuning = { ...DEFAULT_TUNING, ...tuning };
    const { body, collider } = physics.addDynamicBall({
      position,
      radius,
      mass: 1,
      friction: 0.8,
      restitution: 0.2,
      linearDamping: 0.05,
      angularDamping: 0.6,
      ccd: true,
      tag: 'ball',
      data: this,
    });
    this.body = body;
    this.collider = collider;

    this.mesh = new THREE.Mesh(makeBallGeometry(radius), makeSkinMaterial(skin));
    this.mesh.name = 'ball';
    scene.add(this.mesh);
    this.skin = skin;

    this.shadow = null;
    if (shadow) {
      this.shadow = new THREE.Mesh(
        new THREE.CircleGeometry(radius * 0.95, 20).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }),
      );
      this.shadow.renderOrder = 1;
      scene.add(this.shadow);
    }
    this.scene = scene;
    this.dust = dust ? new Dust(scene) : null;

    this.prev = new THREE.Vector3().copy(position);
    this.position = new THREE.Vector3().copy(position); // interpolated, updated in render()
    this.velocity = new THREE.Vector3();
    this.grounded = false;
    this.groundNormal = new THREE.Vector3(0, 1, 0);
    this.boostTime = 0;
    this.boostCapScale = 1;
    this.frozen = false;
    this.popTime = 1; // respawn "pop" animation progress (1 = done)
    /** Called with (position, direction) after respawn(). */
    this.onRespawn = null;
    /** Called with (impactSpeed m/s) when the ball lands after a real drop/jump. */
    this.onLand = null;
    this.airTime = 0;
    this._airVy = 0;

    this._d = new THREE.Vector3();
    this._r = new THREE.Vector3();
    this._vh = new THREE.Vector3();
    this._down = { x: 0, y: -1, z: 0 };
  }

  setTuning(partial) {
    Object.assign(this.tuning, partial);
  }

  setSkin(id) {
    if (id === this.skin) return;
    this.mesh.material.dispose();
    this.mesh.material = makeSkinMaterial(id);
    this.skin = id;
  }

  /** Current physics position (not interpolated). */
  getPosition(out = new THREE.Vector3()) {
    const t = this.body.translation();
    return out.set(t.x, t.y, t.z);
  }

  getVelocity(out = new THREE.Vector3()) {
    const v = this.body.linvel();
    return out.set(v.x, v.y, v.z);
  }

  /** Total speed in m/s. */
  get speed() {
    const v = this.body.linvel();
    return Math.hypot(v.x, v.y, v.z);
  }

  /** Horizontal speed in m/s. */
  get groundSpeed() {
    const v = this.body.linvel();
    return Math.hypot(v.x, v.z);
  }

  isGrounded() {
    return this.grounded;
  }

  _probeGround() {
    const t = this.body.translation();
    const hit = this.physics.raycast(t, this._down, this.radius + 0.2, { excludeBody: this.body });
    this.grounded = !!hit && hit.normal.y > 0.35;
    if (hit) this.groundNormal.set(hit.normal.x, hit.normal.y, hit.normal.z);
    return hit;
  }

  /**
   * One fixed step of control. Call before the physics step.
   * @param {number} dt
   * @param {{x:number,y:number}} move input (x right, y forward) in [-1,1]
   * @param {THREE.Vector3} forward horizontal "forward" (camera or track direction)
   */
  update(dt, move, forward) {
    const t = this.body.translation();
    this.prev.set(t.x, t.y, t.z);
    if (this.frozen) return;
    const wasGrounded = this.grounded;
    const hit = this._probeGround();
    this._checkLanding(dt, wasGrounded, hit);

    if (this.boostTime > 0) {
      this.boostTime -= dt;
      if (this.boostTime <= 0) this.boostCapScale = 1;
    }

    const tu = this.tuning;
    const cap = tu.speedCap * this.boostCapScale;
    const f = this._d.set(forward.x, 0, forward.z);
    if (f.lengthSq() < 1e-6) f.set(0, 0, -1);
    f.normalize();
    const r = this._r.crossVectors(f, UP); // right-hand side
    const v = this.body.linvel();
    const vh = this._vh.set(v.x, 0, v.z);
    const control = this.grounded ? 1 : tu.airControl;
    const mx = move ? move.x : 0;
    const my = move ? move.y : 0;
    let ix = 0;
    let iz = 0;

    if (tu.autoRoll) {
      // Forward drives toward a target speed; stick only nudges it.
      const frac = my >= 0 ? tu.cruise + (1 - tu.cruise) * my : tu.cruise + (tu.slow - tu.cruise) * -my;
      const target = cap * frac;
      const vf = vh.dot(f);
      const a = THREE.MathUtils.clamp((target - vf) * 3, -tu.accel, tu.accel) * control;
      const lat = mx * tu.accel * tu.lateral * control;
      ix = f.x * a + r.x * lat;
      iz = f.z * a + r.z * lat;
    } else if (mx !== 0 || my !== 0) {
      // Manual: push in the stick direction, but not past the cap in that direction.
      const dx = r.x * mx + f.x * my;
      const dz = r.z * mx + f.z * my;
      const mag = Math.min(1, Math.hypot(mx, my));
      const len = Math.hypot(dx, dz) || 1;
      const ux = dx / len;
      const uz = dz / len;
      const along = vh.x * ux + vh.z * uz;
      if (along < cap * mag) {
        const speed = vh.length();
        const against = speed > 0.5 ? Math.max(0, -along / speed) : 0;
        const a = tu.accel * mag * control * (1 + (tu.turnAssist - 1) * against);
        ix = ux * a;
        iz = uz * a;
      }
    }
    if (ix !== 0 || iz !== 0) this.body.applyImpulse({ x: ix * dt, y: 0, z: iz * dt }, true);

    // Soft speed cap: bleed off horizontal speed above the cap (on the ground).
    const hs = vh.length();
    if (this.grounded && tu.capDrag > 0 && hs > cap) {
      const k = Math.max(cap / hs, 1 - tu.capDrag * dt);
      this.body.setLinvel({ x: v.x * k, y: v.y, z: v.z * k }, true);
    }
  }

  /** Landing after a jump/drop: dust puff + onLand(impact). */
  _checkLanding(dt, wasGrounded, hit) {
    const vy = this.body.linvel().y;
    if (!this.grounded) {
      this.airTime += dt;
      this._airVy = vy;
      return;
    }
    if (!wasGrounded && this.airTime > 0.2 && this._airVy < -4 && hit) {
      const impact = -this._airVy;
      if (this.dust) this.dust.puff(hit.point, impact / 12);
      if (this.onLand) this.onLand(impact);
    }
    this.airTime = 0;
    this._airVy = 0;
  }

  /**
   * Speed boost (boost pads): impulse along dir (defaults to current motion)
   * and a temporarily raised cap.
   */
  boost(strength = 8, dir = null, duration = 1.5) {
    let d = dir;
    if (!d) {
      const v = this.body.linvel();
      d = new THREE.Vector3(v.x, 0, v.z);
      if (d.lengthSq() < 1e-4) return;
    }
    const n = new THREE.Vector3(d.x, d.y || 0, d.z).normalize();
    this.body.applyImpulse({ x: n.x * strength, y: n.y * strength, z: n.z * strength }, true);
    this.boostTime = duration;
    this.boostCapScale = 1.5;
  }

  /** Raw impulse (bounce pads, bumpers). */
  push(impulse) {
    this.body.applyImpulse(impulse, true);
  }

  /** Stop the ball in place (countdown, results). */
  setFrozen(frozen) {
    this.frozen = frozen;
    this.body.setEnabled(!frozen);
  }

  /**
   * Teleport to pos (ball center), facing dir, at rest. Plays the pop-in
   * animation; mode should snap the camera and play 'boing'.
   */
  respawn(pos, dir = null) {
    this.body.setTranslation({ x: pos.x, y: pos.y, z: pos.z }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.prev.set(pos.x, pos.y, pos.z);
    this.position.set(pos.x, pos.y, pos.z);
    this.boostTime = 0;
    this.boostCapScale = 1;
    this.popTime = 0;
    this.airTime = 0; // a respawn drop is not a "landing"
    this._airVy = 0;
    if (this.onRespawn) this.onRespawn(pos, dir);
  }

  /** Update mesh from physics, interpolated by alpha in [0,1]. */
  render(alpha = 1, dt = 1 / 60) {
    const t = this.body.translation();
    this.position.set(
      this.prev.x + (t.x - this.prev.x) * alpha,
      this.prev.y + (t.y - this.prev.y) * alpha,
      this.prev.z + (t.z - this.prev.z) * alpha,
    );
    this.mesh.position.copy(this.position);
    const q = this.body.rotation();
    this.mesh.quaternion.set(q.x, q.y, q.z, q.w);
    this.velocity.copy(this.body.linvel());

    if (this.dust) this.dust.update(Math.min(dt, 0.1));

    if (this.popTime < 1) {
      this.popTime = Math.min(1, this.popTime + dt / 0.35);
      // Overshooting "boing" scale.
      const s = 1 + Math.sin(this.popTime * Math.PI * 1.5) * (1 - this.popTime) * 0.6;
      this.mesh.scale.setScalar(Math.max(0.05, this.popTime < 0.15 ? this.popTime / 0.15 : s));
    } else {
      this.mesh.scale.setScalar(1);
    }

    if (this.shadow) {
      const hit = this.physics.raycast(this.position, this._down, 30, { excludeBody: this.body });
      if (hit) {
        const h = this.position.y - hit.point.y;
        this.shadow.visible = true;
        this.shadow.position.set(hit.point.x, hit.point.y + 0.03, hit.point.z);
        const s = THREE.MathUtils.clamp(1 - h / 12, 0.3, 1);
        this.shadow.scale.setScalar(s);
        this.shadow.material.opacity = 0.35 * s;
      } else {
        this.shadow.visible = false;
      }
    }
  }

  dispose() {
    this.dust?.dispose();
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    if (this.shadow) {
      this.scene.remove(this.shadow);
      this.shadow.geometry.dispose();
      this.shadow.material.dispose();
    }
    this.physics.remove(this.body);
  }
}
