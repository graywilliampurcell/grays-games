// One race's simulation, without any DOM/HUD: generated track, the player's
// ball, AI opponents, checkpoints, falling + respawn, boosts and the finish.
// RaceMode wraps it with countdown, camera, HUD and results; tests and the
// tuning script drive it headless.
//
//   const sim = new RaceSim({physics, scene, difficulty, seed, skin, onEvent});
//   per fixed step:  sim.update(dt, move); physics.step(dt); sim.postStep(dt);
//   per frame:       sim.render(alpha, frameDt)
//   sim.dispose()
//
// onEvent(name, data): 'checkpoint' {checkpoint}, 'boost', 'bumper', 'hazard',
// 'fall', 'recover' (landed after all), 'respawn' {position, forward},
// 'finish' {place}, 'aiFinish' {racer}.

import * as THREE from 'three';
import { Ball } from '../ball/Ball.js';
import { SKINS } from '../ball/skinData.js';
import { Rng } from '../core/Rng.js';
import { buildTrack, BOOST_STRENGTH } from '../track/TrackBuilder.js';
import { generateTrack } from '../track/TrackGenerator.js';
import { getDifficulty, RACE_TUNING } from './difficulty.js';
import { AiRacer } from './AiRacer.js';

const LOOK_AHEAD = 3; // m ahead on the spline for "forward"
const AI_SKINS = ['blue', 'yellow', 'green', 'red', 'soccer', 'stripes', 'polka', 'checker'];

export class RaceSim {
  /**
   * @param {object} o
   * @param {object} o.physics
   * @param {THREE.Object3D} o.scene
   * @param {number} o.difficulty 1..5
   * @param {string} o.seed this race's seed
   * @param {string} [o.skin='red'] player skin
   * @param {Ball} [o.ball] reuse an existing player ball (series)
   * @param {(name:string, data?:object) => void} [o.onEvent]
   * @param {object} [o.tuning] RACE_TUNING overrides
   */
  constructor({ physics, scene, difficulty, seed, skin = 'red', ball = null, onEvent = () => {}, tuning = {} }) {
    this.physics = physics;
    this.scene = scene;
    this.level = getDifficulty(difficulty);
    this.seed = String(seed);
    this.tuning = { ...RACE_TUNING, ...tuning };
    this.onEvent = onEvent;
    this.time = 0; // s since GO
    this.started = false;
    this.finished = false;
    this.place = 0;
    this.falls = 0;
    this._events = []; // queued from inside physics.step

    this.gen = generateTrack({ difficulty: this.level.level, seed: this.seed });
    this.track = buildTrack({
      physics,
      scene,
      pieces: this.gen.pieces,
      options: this.gen.options,
      handlers: {
        onCheckpoint: (cp) => this._events.push(['checkpoint', cp]),
        onFinish: () => this._events.push(['finishLine']),
        onBoost: (zone, b) => {
          b.boost(BOOST_STRENGTH, zone.feature.forward);
          this._events.push(['boost', zone]);
        },
        onBumper: () => this._events.push(['bumper']),
        onHazardHit: (info) => this._events.push(['hazard', info.type]),
      },
    });

    // Player: slot 0, in front.
    const slot = this.track.startSlots[0];
    this.ownsBall = !ball;
    this.ball = ball || new Ball({ physics, scene, position: slot.position, skin });
    this.ball.setTuning({
      speedCap: this.level.speedCap,
      autoRoll: this.level.autoRoll,
      cruise: this.level.cruise,
    });
    this.s = slot.s;
    this.maxS = slot.s;
    this.rate = 0; // smoothed progress speed (m/s along the track)
    this.checkpoint = this.track.checkpoints[0];
    this.fallsHere = 0; // falls since the last checkpoint (mercy rule)
    this.stuckS = slot.s; // stuck detection: last progress point and time since
    this.stuckT = 0;
    this.fallTimer = 0;
    this.forward = new THREE.Vector3(slot.forward.x, 0, slot.forward.z);
    this._ahead = new THREE.Vector3();
    this._pos = new THREE.Vector3();
    this.ball.respawn(slot.position, this.forward);

    // Opponents in the slots behind, with seeded skins that differ from the player's.
    const rng = new Rng(`ai:${this.seed}`);
    const skins = rng.shuffle(AI_SKINS.filter((id) => id !== skin && SKINS.some((s) => s.id === id)));
    this.racers = [];
    for (let i = 0; i < this.level.opponents; i++) {
      this.racers.push(
        new AiRacer({
          physics,
          scene,
          skin: skins[i % skins.length],
          solid: this.level.level <= 2,
          track: this.track,
          slot: this.track.startSlots[1 + i],
          level: this.level,
          rng: rng.fork(`racer${i}`),
          tuning: this.tuning,
        }),
      );
    }
    this.setFrozen(true);
  }

  /** Countdown: hold everything still. */
  setFrozen(frozen) {
    this.frozen = frozen;
    this.ball.setFrozen(frozen);
  }

  /** GO! */
  start() {
    this.started = true;
    this.setFrozen(false);
  }

  get length() {
    return this.track.finish ? this.track.finish.s : this.track.length;
  }

  /** Current place (1 = leading) by distance along the track. */
  currentPlace() {
    if (this.finished) return this.place;
    let p = 1;
    for (const r of this.racers) if (r.finished || r.s > this.s) p++;
    return p;
  }

  // ------------------------------------------------------------ step

  /**
   * One fixed step, before physics.step.
   * @param {number} dt
   * @param {{x:number,y:number}} move player input
   */
  update(dt, move) {
    const t = this.track;
    t.update(dt);
    if (this.frozen) {
      this.ball.update(dt, null, this.forward);
      for (const r of this.racers) r.update(0, this.s, 0, false);
      return;
    }
    this.time += dt;

    const pos = this.ball.getPosition(this._pos);
    const near = t.nearest(pos, this.s);
    this.near = near;
    const prevS = this.s;
    if (near.dist < 12) this.s = near.s;
    if (!this.fallTimer) {
      const inst = Math.max(0, (this.s - prevS) / dt);
      this.rate += (Math.min(inst, 30) - this.rate) * Math.min(1, dt * 3);
    } else {
      this.rate *= 1 - Math.min(1, dt * 3);
    }
    this.maxS = Math.max(this.maxS, this.s);

    // Steer along the track a little ahead of the ball.
    t.spline.forwardAt(Math.min(t.length, this.s + LOOK_AHEAD), this._ahead);
    this.forward.lerp(this._ahead, 0.1).normalize();
    this.ball.update(dt, this.finished ? null : move, this.forward);

    // Checkpoints by position too (robust if a sensor is skipped).
    if (!this.fallTimer && this.ball.isGrounded() && Math.abs(near.height) < 1.5) {
      const cp = t.checkpointBefore(this.s);
      if (cp.s > this.checkpoint.s) this._reachCheckpoint(cp);
    }

    // Stuck (auto-roll levels only; with manual forward, stopping is a choice):
    // wedged somewhere for a while → same as a fall.
    let stuck = false;
    if (this.level.autoRoll && !this.fallTimer) {
      this.stuckT += dt;
      if (this.s > this.stuckS + 1.5) {
        this.stuckS = this.s;
        this.stuckT = 0;
      }
      stuck = this.stuckT > this.tuning.stuckTime;
    }

    // Falling: below the road for a moment → respawn at the checkpoint.
    const falling = stuck || near.height < -this.tuning.fallDepth || near.dist > 14;
    if (!this.fallTimer && falling && !this.finished) {
      this.fallTimer = this.tuning.respawnDelay;
      this.fallStuck = stuck;
      this.falls++;
      this.fallsHere++;
      this.onEvent('fall');
    } else if (this.fallTimer && !this.fallStuck && this.ball.isGrounded() && near.height > -1 && near.dist < 8) {
      // Dipped below the line but landed on the road after all (a low jump).
      this.fallTimer = 0;
      this.falls--;
      this.fallsHere--;
      this.onEvent('recover');
    } else if (this.fallTimer) {
      this.fallTimer -= dt;
      if (this.fallTimer <= 0) this.respawn();
    }

    // Finish by position too.
    if (!this.finished && this.s >= this.length && Math.abs(near.height) < 2) this._finish();

    for (const r of this.racers) {
      const was = r.finished;
      r.update(dt, this.s, this.rate, this.finished);
      if (!was && r.finished) this.onEvent('aiFinish', { racer: r });
    }
  }

  /** After physics.step: handle sensor events queued during the step. */
  postStep() {
    const q = this._events;
    this._events = [];
    for (const [name, data] of q) {
      if (name === 'checkpoint') {
        if (!this.fallTimer && data.s > this.checkpoint.s) this._reachCheckpoint(data);
      } else if (name === 'finishLine') {
        if (!this.finished && !this.frozen) this._finish();
      } else if (!this.finished || name === 'bumper') {
        this.onEvent(name, data);
      }
    }
  }

  _reachCheckpoint(cp) {
    this.checkpoint = cp;
    this.fallsHere = 0;
    this.onEvent('checkpoint', { checkpoint: cp });
  }

  _finish() {
    this.finished = true;
    this.finishTime = this.time;
    this.fallTimer = 0;
    let place = 1;
    for (const r of this.racers) if (r.finished) place++;
    this.place = place;
    this.ball.setTuning({ autoRoll: false });
    this.onEvent('finish', { place });
  }

  /**
   * Put the ball back at the last checkpoint. Mercy: after `mercyFalls`
   * falls in a row there, move on to the next checkpoint so a kid is never
   * stuck on one obstacle (plan pillar: always finish).
   */
  respawn() {
    if (this.fallsHere >= this.tuning.mercyFalls) {
      const next = this.track.checkpoints.find((c) => c.s > this.checkpoint.s + 1 && c.s < this.length);
      if (next) {
        this.checkpoint = next;
        this.fallsHere = 0;
      }
    }
    const sp = this.track.respawnAt(this.checkpoint);
    this.fallTimer = 0;
    this.s = sp.s;
    this.stuckS = sp.s;
    this.stuckT = 0;
    this.forward.set(sp.forward.x, 0, sp.forward.z);
    this.ball.respawn(sp.position, this.forward);
    this.onEvent('respawn', { position: sp.position, forward: this.forward });
  }

  /** Debug: jump to the start of the next piece. */
  skipToNextPiece() {
    const p = this.track.pieceAt(this.s);
    const next = this.track.pieces[Math.min(this.track.pieces.length - 1, p.index + 1)];
    const f = this.track.spline.sampleAt(next.s0 + 0.5);
    this.s = this.stuckS = f.s;
    this.stuckT = 0;
    this.forward.set(f.forward.x, 0, f.forward.z);
    const pos = { x: f.position.x, y: f.position.y + 0.8, z: f.position.z };
    this.ball.respawn(pos, this.forward);
    this.onEvent('respawn', { position: pos, forward: this.forward });
  }

  render(alpha, frameDt) {
    this.track.render(alpha);
    this.ball.render(alpha, frameDt);
    for (const r of this.racers) r.render(alpha);
  }

  dispose() {
    for (const r of this.racers) r.dispose();
    this.racers = [];
    this.track.dispose();
    if (this.ownsBall) this.ball.dispose();
  }
}
