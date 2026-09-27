// AI opponents (plan §3.4): kinematic balls that follow the track's safe AI
// path at a target speed with a little seeded lateral wobble. They can't fall
// (they float over gaps and roll through moving hazards).
//
// Rubber-banding: an opponent more than `leadCap` m ahead of the player slows
// to the player's pace (never below aiMinFraction × base, so it doesn't just
// wait); if the player is more than `behindCap` m ahead it speeds up a little.
//
//   AiDriver  pure driving logic (s, speed, lateral) — tested in node
//   AiRacer   AiDriver + optional kinematic body + mesh + blob shadow

import * as THREE from 'three';
import { makeBallGeometry, makeSkinMaterial } from '../ball/skins.js';
import { BALL_RADIUS } from '../ball/Ball.js';
import { RACE_TUNING } from './difficulty.js';
import { smoothstep, clamp, lerp } from '../track/math.js';

const MAX_LATERAL_SPEED = 3.5; // m/s sideways (lane changes around bumpers)
const STOP_AFTER_FINISH = 11; // m past the finish line where opponents stop

export class AiDriver {
  /**
   * @param {object} o
   * @param {object} o.track Track or TrackLayout
   * @param {{s:number, lateral:number}} o.slot start slot
   * @param {object} o.level difficulty entry (speedCap, aiSpeed, leadCap, behindCap)
   * @param {import('../core/Rng.js').Rng} o.rng this racer's own stream
   * @param {object} [o.tuning] RACE_TUNING overrides
   */
  constructor({ track, slot, level, rng, tuning = {} }) {
    this.track = track;
    this.level = level;
    this.tuning = { ...RACE_TUNING, ...tuning };
    const t = this.tuning;
    this.skill = 1 + rng.range(-t.aiSkillSpread, t.aiSkillSpread);
    this.baseSpeed = level.speedCap * level.aiSpeed * this.skill;
    this.s = slot.s;
    this.speed = 0;
    this.lateral = slot.lateral;
    // Lane in [-1, 1] from the slot's place in the safe range.
    const r = track.laneAt(slot.s);
    const half = (r.max - r.min) / 2 || 1;
    this.lane = clamp((slot.lateral - (r.min + r.max) / 2) / half, -0.8, 0.8);
    this.wobbleFreq = rng.range(0.25, 0.55); // Hz
    this.wobblePhase = rng.range(0, Math.PI * 2);
    this.time = 0;
    this.finished = false;
    this.finishTime = null;
    this.finishS = track.finish ? track.finish.s : track.length;
  }

  /** Target speed for the current gap to the player (rubber-banding). */
  targetSpeed(playerS, playerRate, playerFinished = false) {
    const base = this.baseSpeed;
    const t = this.tuning;
    if (this.s > this.finishS) {
      // Coast to a stop in the run-out.
      const left = this.finishS + STOP_AFTER_FINISH - this.s;
      return Math.max(0, Math.min(base, left * 1.2));
    }
    if (playerFinished) return base;
    const gap = this.s - playerS;
    const { leadCap, behindCap } = this.level;
    if (gap > leadCap) {
      const k = smoothstep((gap - leadCap) / 2);
      const minFraction = this.level.aiMinFraction ?? t.aiMinFraction; // per-level override
      const match = clamp(playerRate, base * minFraction, base);
      return lerp(base, match, k);
    }
    if (gap < -behindCap) {
      const k = smoothstep((-gap - behindCap) / 10);
      return base * lerp(1, t.aiCatchUp, k);
    }
    return base;
  }

  /**
   * Advance one fixed step.
   * @param {number} dt
   * @param {number} playerS player's distance along the track
   * @param {number} playerRate player's progress speed (m/s along the track)
   * @param {boolean} [playerFinished]
   * @returns {number} distance moved (m)
   */
  step(dt, playerS, playerRate, playerFinished = false) {
    this.time += dt;
    const target = this.targetSpeed(playerS, playerRate, playerFinished);
    const a = this.tuning.aiAccel;
    this.speed += clamp(target - this.speed, -a * 1.5 * dt, a * dt);
    const ds = this.speed * dt;
    this.s = Math.min(this.s + ds, this.track.length - 0.5);
    if (!this.finished && this.s >= this.finishS) {
      this.finished = true;
      this.finishTime = this.time;
    }
    const wob = this.tuning.aiWobble * Math.sin(this.time * this.wobbleFreq * Math.PI * 2 + this.wobblePhase);
    const want = this.track.aiOffsetAt(this.s, clamp(this.lane + wob, -1, 1));
    const maxD = MAX_LATERAL_SPEED * dt;
    this.lateral += clamp(want - this.lateral, -maxD, maxD);
    return ds;
  }

  /** World position of the ball center. */
  position(out = { x: 0, y: 0, z: 0 }) {
    const sp = this.track.spline;
    sp.positionAt(this.s, out);
    const r = sp.rightAt(this.s, this._r || (this._r = { x: 0, y: 0, z: 0 }));
    out.x += r.x * this.lateral;
    out.z += r.z * this.lateral;
    out.y += BALL_RADIUS;
    return out;
  }
}

export class AiRacer {
  /**
   * @param {object} o AiDriver options plus
   * @param {object} o.physics
   * @param {THREE.Object3D} o.scene
   * @param {string} o.skin skin id
   * @param {boolean} [o.solid=true] give it a kinematic body the player can bump
   */
  constructor({ physics, scene, skin, solid = true, ...driverOpts }) {
    this.driver = new AiDriver(driverOpts);
    this.skin = skin;
    this.physics = physics;
    this.pos = new THREE.Vector3();
    this.prev = new THREE.Vector3();
    this.driver.position(this.pos);
    this.prev.copy(this.pos);

    this.body = null;
    if (solid && physics) {
      this.body = physics.addKinematic({
        position: this.pos,
        shapes: [{ type: 'ball', radius: BALL_RADIUS }],
        friction: 0.3,
        restitution: 0.4,
        tag: 'ai',
        data: this,
      }).body;
    }

    this.mesh = new THREE.Mesh(makeBallGeometry(BALL_RADIUS), makeSkinMaterial(skin));
    this.mesh.name = 'ai-ball';
    this.mesh.position.copy(this.pos);
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(BALL_RADIUS * 0.95, 16).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }),
    );
    this.shadow.renderOrder = 1;
    scene.add(this.mesh, this.shadow);

    this._axis = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._r = { x: 0, y: 0, z: 0 };
    this._roll = 0;
  }

  get s() {
    return this.driver.s;
  }

  get finished() {
    return this.driver.finished;
  }

  /** One fixed step (before physics.step). */
  update(dt, playerS, playerRate, playerFinished) {
    this.prev.copy(this.pos);
    this._roll += this.driver.step(dt, playerS, playerRate, playerFinished);
    this.driver.position(this.pos);
    if (this.body) this.body.setNextKinematicTranslation(this.pos);
  }

  render(alpha) {
    this.mesh.position.lerpVectors(this.prev, this.pos, alpha);
    // Roll about the axis up × forward = -right.
    if (this._roll) {
      const r = this.driver.track.spline.rightAt(this.driver.s, this._r);
      this._axis.set(-r.x, 0, -r.z);
      this._q.setFromAxisAngle(this._axis, this._roll / BALL_RADIUS);
      this.mesh.quaternion.premultiply(this._q);
      this._roll = 0;
    }
    const f = this.driver.track.spline.sampleAt(this.driver.s, this._frame || (this._frame = {}));
    this.shadow.visible = f.floor;
    this.shadow.position.set(this.mesh.position.x, f.position.y + 0.03, this.mesh.position.z);
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.shadow.removeFromParent();
    this.shadow.geometry.dispose();
    this.shadow.material.dispose();
    if (this.body && !this.physics.disposed && this.physics.bodies.has(this.body)) this.physics.remove(this.body);
  }
}
