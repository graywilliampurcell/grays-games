// Smoothed third-person chase camera.
//   mode 'track': heading eases toward a supplied forward direction
//                 (setForward, e.g. the track spline tangent) — Race.
//   mode 'free' : heading eases toward the ball's velocity direction, with a
//                 slow auto-orbit when idle; two-finger drag turns it — Playground.
// Call update(dt, target) every render frame, snap() after a respawn.

import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

function dampFactor(sharpness, dt) {
  return 1 - Math.exp(-sharpness * dt);
}

function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

/** yaw 0 = looking along -Z (three.js default camera forward). */
function yawOf(v) {
  return Math.atan2(-v.x, -v.z);
}

export class ChaseCamera {
  constructor(camera, opts = {}) {
    this.camera = camera;
    this.mode = opts.mode || 'track';
    this.distance = opts.distance ?? 7;
    this.height = opts.height ?? 3.2;
    this.lookHeight = opts.lookHeight ?? 0.6;
    this.lookAhead = opts.lookAhead ?? 3;
    this.posSharpness = opts.posSharpness ?? 8;
    this.turnSharpness = opts.turnSharpness ?? 3;
    this.autoOrbit = opts.autoOrbit ?? 0.12; // rad/s when idle (free mode)
    this.lookSensitivity = opts.lookSensitivity ?? 0.006; // rad per px

    this.yaw = 0;
    this.lookYaw = 0; // extra yaw from two-finger drag
    this.lookPitch = 0;
    this.desiredForward = new THREE.Vector3(0, 0, -1);
    this.focus = new THREE.Vector3();
    this._pos = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this._initialized = false;
  }

  setMode(mode) {
    this.mode = mode;
  }

  /** Track mode: the direction the camera should face (any length, y ignored). */
  setForward(v) {
    this._tmp.set(v.x, 0, v.z);
    if (this._tmp.lengthSq() > 1e-6) this.desiredForward.copy(this._tmp.normalize());
  }

  /** Two-finger drag delta in pixels (pass input.consumeLook()). */
  addLook(dx, dy) {
    if (this.mode === 'free') {
      this.yaw -= dx * this.lookSensitivity;
    } else {
      this.lookYaw = THREE.MathUtils.clamp(this.lookYaw - dx * this.lookSensitivity, -1.2, 1.2);
    }
    this.lookPitch = THREE.MathUtils.clamp(this.lookPitch + dy * this.lookSensitivity * 0.5, -0.35, 0.5);
  }

  /** Horizontal unit vector the player considers "forward" (for steering). */
  getForward(out = new THREE.Vector3()) {
    const yaw = this.yaw + this.lookYaw;
    return out.set(-Math.sin(yaw), 0, -Math.cos(yaw));
  }

  /**
   * Jump straight to the chase position (after respawn / at start).
   * @param {{x,y,z}} position ball position
   * @param {{x,y,z}} [forward] facing direction
   */
  snap(position, forward) {
    if (forward) {
      this.setForward(forward);
      this.yaw = yawOf(this.desiredForward);
    }
    this.lookYaw = 0;
    this.focus.set(position.x, position.y, position.z);
    this._place(1);
    this._initialized = true;
  }

  /**
   * @param {number} dt seconds
   * @param {{position:{x,y,z}, velocity?:{x,y,z}}} target
   */
  update(dt, target) {
    const p = target.position;
    if (!this._initialized) {
      this.snap(p, this.desiredForward);
      return;
    }

    if (this.mode === 'track') {
      this.yaw = angleLerp(this.yaw, yawOf(this.desiredForward), dampFactor(this.turnSharpness, dt));
      // Look offset drifts back to center so the track view recovers on its own.
      this.lookYaw *= 1 - dampFactor(0.8, dt);
    } else {
      const v = target.velocity;
      const speed = v ? Math.hypot(v.x, v.z) : 0;
      if (speed > 1.2) {
        this._tmp.set(v.x, 0, v.z);
        // Turn faster the faster we roll; slow wobbles don't swing the view.
        const t = dampFactor(this.turnSharpness * Math.min(1, (speed - 1.2) / 4), dt);
        this.yaw = angleLerp(this.yaw, yawOf(this._tmp), t);
      } else {
        this.yaw += this.autoOrbit * dt;
      }
    }
    this.lookPitch *= 1 - dampFactor(0.5, dt);

    // Focus follows the ball; vertical follow is softer so bumps don't shake.
    const k = dampFactor(this.posSharpness, dt);
    this.focus.x += (p.x - this.focus.x) * k;
    this.focus.z += (p.z - this.focus.z) * k;
    this.focus.y += (p.y - this.focus.y) * dampFactor(this.posSharpness * 0.5, dt);
    this._place(dampFactor(this.posSharpness * 1.5, dt));
  }

  _place(t) {
    const fwd = this.getForward(this._fwd);
    const pitch = this.lookPitch;
    const dist = this.distance * Math.cos(pitch);
    const h = this.height + this.distance * Math.sin(pitch);
    this._tmp.copy(this.focus).addScaledVector(fwd, -dist).addScaledVector(UP, h);
    if (t >= 1) this._pos.copy(this._tmp);
    else this._pos.lerp(this._tmp, t);
    this.camera.position.copy(this._pos);
    this._tmp.copy(this.focus).addScaledVector(fwd, this.lookAhead).addScaledVector(UP, this.lookHeight);
    this.camera.lookAt(this._tmp);
  }
}
