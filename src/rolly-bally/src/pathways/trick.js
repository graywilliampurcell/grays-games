// Trick mountain (Pathways P3): run at it, it shoots you straight up, you
// earn stars for how high you go, then you land back on the soft pad.
//
//  - Costs 1 star from the counter if you have any; free when it's at 0.
//    The launch always works. (Only the on-screen counter goes down; saved
//    star totals and ball unlocks never do.)
//  - Faster in → higher up. Even a slow roll gives a small hop.
//  - A height meter rises on the left during the flight, with star marks.
//  - At the peak, 1–5 stars pop out and fly into the counter.
//  - The flight is aimed back onto the pink pad, which catches the ball
//    with a small soft bounce. Steering is off during the flight so a
//    finger still held on "forward" can't carry the ball off the pad.
// Blocks and colliders are built by FeatureSet (Features.js, type 'trick').

import * as THREE from 'three';
import { FEATURE_SPECS, featureToWorld } from '../playground/Features.js';
import { GRAVITY } from '../core/Physics.js';

const G = -GRAVITY;
export const MIN_ENTRY_SPEED = 1.5; // m/s toward the mountain to trigger
export const LAUNCH = { base: 4, perSpeed: 2.2, min: 9, max: 24 }; // vy = base + perSpeed * speed
/** Peak heights (m) for 2, 3, 4 and 5 stars (below the first: 1 star). */
export const STAR_HEIGHTS = [3.5, 6, 9, 12];
export const METER_MAX = 14; // meter full at this height
const COOLDOWN = 0.8;
const PAD_BOUNCE = 3; // m/s up when the pad catches you

/** Pure: launch speed straight up for a horizontal entry speed. */
export function launchSpeed(entrySpeed) {
  return Math.min(LAUNCH.max, Math.max(LAUNCH.min, LAUNCH.base + LAUNCH.perSpeed * entrySpeed));
}

/** Pure: peak height (m) reached with launch speed vy. */
export function peakHeight(vy) {
  return (vy * vy) / (2 * G);
}

/** Pure: stars earned for a peak height: 1 (small hop) … 5 (huge). */
export function starsForHeight(h) {
  let n = 1;
  for (const t of STAR_HEIGHTS) if (h >= t) n++;
  return n;
}

/** Pure: stars spent to use the trick with `have` on the counter. */
export function trickCost(have) {
  return have > 0 ? 1 : 0;
}

/** Pure: seconds until a ball at height dy above landing height, rising at vy, lands. */
export function timeToLand(dy, vy) {
  return (vy + Math.sqrt(Math.max(0, vy * vy + 2 * G * dy))) / G;
}

/**
 * Pure: horizontal velocity that carries the ball from `from` to `to` by the
 * time it lands (dy = height above landing height, vy = vertical speed).
 * Re-aimed every step during the flight, so air drag can't make it fall short.
 */
export function aimBack(from, to, vy, dy = 0) {
  const t = Math.max(0.05, timeToLand(dy, vy));
  return { x: (to.x - from.x) / t, z: (to.z - from.z) / t };
}

const STAR_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.8l3.1 6.6 7.1.8-5.3 4.9 1.5 7.1L12 17.6l-6.4 3.6 1.5-7.1L1.8 9.2l7.1-.8z"/></svg>`;

export class TrickMountains {
  /**
   * @param {object} o
   * @param {object} o.physics
   * @param {THREE.Scene} o.scene
   * @param {Array} o.features world features (only 'trick' are used)
   * @param {object} o.audio
   * @param {HTMLElement} o.ui mode HUD root
   * @param {THREE.Camera} o.camera
   * @param {() => number} o.spend take the cost from the counter; returns stars spent
   * @param {(n: number, from: {x, y}) => void} o.earn add n stars (from = screen point)
   * @param {() => HTMLElement} o.counter the star counter element (fly target)
   */
  constructor({ physics, scene, features, audio, ui, camera, spend, earn, counter }) {
    this.physics = physics;
    this.scene = scene;
    this.audio = audio;
    this.ui = ui;
    this.camera = camera;
    this.spend = spend;
    this.earn = earn;
    this.counter = counter;
    this.bodies = [];
    this.meshes = [];
    this.flight = null;
    this.meterHold = 0;
    this.tricks = features.filter((f) => f.type === 'trick').map((f) => this._build(f));
    if (this.tricks.length) this._buildMeter();
  }

  get count() {
    return this.tricks.length;
  }

  _build(f) {
    const s = FEATURE_SPECS.trick;
    const at = (u, v, dy = 0) => {
      const p = featureToWorld(f, u, v);
      return { x: p.x, y: f.y + dy, z: p.z };
    };
    const t = { f, hit: false, padHit: false, cooldown: 0, pad: at(2.5, (s.pad[0] + s.pad[1]) / 2) };
    const launch = this.physics.addSensorCuboid({
      position: at(2.5, s.launch, 0.7),
      halfExtents: { x: 2.4, y: 0.7, z: 0.5 },
      yaw: f.yaw,
      tag: 'trickLaunch',
      onCollide: ({ otherInfo, started }) => {
        if (started && otherInfo?.tag === 'ball') t.hit = true;
      },
    });
    const pad = this.physics.addSensorCuboid({
      position: at(2.5, (s.pad[0] + s.pad[1]) / 2, 0.6),
      halfExtents: { x: 2.4, y: 0.5, z: (s.pad[1] - s.pad[0]) / 2 },
      yaw: f.yaw,
      tag: 'trickPad',
      onCollide: ({ otherInfo, started }) => {
        if (started && otherInfo?.tag === 'ball') t.padHit = true;
      },
    });
    this.bodies.push(launch.body, pad.body);

    // Big star sign on top of the mountain, facing the run-up.
    const star = new THREE.Mesh(starGeometry(), new THREE.MeshLambertMaterial({ color: '#ffd21f', emissive: '#8a6400', flatShading: true }));
    const top = at(2.5, s.foot + 4.2, s.height + 1.6);
    star.position.set(top.x, top.y, top.z);
    star.rotation.y = f.yaw + Math.PI;
    star.name = 'trick-star';
    this.scene.add(star);
    this.meshes.push(star);
    t.star = star;
    return t;
  }

  _buildMeter() {
    const meter = document.createElement('div');
    meter.className = 'pw-meter hidden';
    const marks = STAR_HEIGHTS.map((h, i) => `<div class="pw-meter__mark" style="bottom:${(h / METER_MAX) * 100}%">${STAR_ICON}<span>${i + 2}</span></div>`).join('');
    meter.innerHTML = `<div class="pw-meter__fill"></div>${marks}`;
    this.ui.append(meter);
    this.meter = meter;
    this.meterFill = meter.querySelector('.pw-meter__fill');
  }

  update(dt) {
    for (const t of this.tricks) if (t.cooldown > 0) t.cooldown -= dt;
  }

  postStep(dt, ball) {
    for (const t of this.tricks) {
      if (t.hit) {
        t.hit = false;
        this._maybeLaunch(t, ball);
      }
      if (t.padHit) {
        t.padHit = false;
        const v = ball.body.linvel();
        if (v.y < -4) {
          const p = ball.body.translation();
          this.lastCatch = { x: p.x - t.pad.x, z: p.z - t.pad.z }; // for tests/debug
          ball.body.setLinvel({ x: v.x * 0.3, y: PAD_BOUNCE, z: v.z * 0.3 }, true);
          this.audio.play('boing', { pitch: 0.8, volume: 0.8 });
          if (this.flight?.trick === t) this._land();
        }
      }
    }
    const fl = this.flight;
    if (fl) {
      const p = ball.body.translation();
      const v = ball.body.linvel();
      fl.height = Math.max(fl.height, p.y - fl.y0);
      // Keep steering the flight onto the pad.
      const aim = aimBack(p, fl.trick.pad, v.y, p.y - fl.y0);
      ball.body.setLinvel({ x: aim.x, y: v.y, z: aim.z }, true);
      if (!fl.awarded && v.y <= 0) {
        fl.awarded = true;
        fl.stars = starsForHeight(fl.height);
        this.earn(fl.stars, this._screen(p));
        this.audio.play('sparkle');
        this.audio.play('fanfare', { volume: 0.5 });
      }
      fl.time += dt;
      if (fl.time > 8) this._land(); // safety: never stuck "in flight"
    }
  }

  _maybeLaunch(t, ball) {
    if (this.flight || t.cooldown > 0) return;
    const v = ball.body.linvel();
    const along = v.x * t.f.fwd.x + v.z * t.f.fwd.z;
    if (along < MIN_ENTRY_SPEED) return;
    t.cooldown = COOLDOWN;
    const spent = this.spend();
    const vy = launchSpeed(Math.hypot(v.x, v.z));
    const p = ball.body.translation();
    const back = aimBack(p, t.pad, vy);
    ball.body.setLinvel({ x: back.x, y: vy, z: back.z }, true);
    ball.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.flight = { trick: t, y0: p.y, height: 0, awarded: false, spent, time: 0, ball, airControl: ball.tuning.airControl };
    ball.tuning.airControl = 0;
    this.audio.play('whoosh', { pitch: 0.8 });
    this.audio.play('boing', { pitch: 1.4, volume: 0.6 });
  }

  _land() {
    this._endFlight();
    this.meterHold = 1.2;
  }

  /** Ball respawned / world reset: drop any flight. */
  reset() {
    this._endFlight();
    this.meterHold = 0;
  }

  _endFlight() {
    const fl = this.flight;
    if (fl) fl.ball.tuning.airControl = fl.airControl;
    this.flight = null;
  }

  render(dt, ballPos) {
    for (const t of this.tricks) t.star.rotation.z = Math.sin(performance.now() / 500) * 0.12;
    if (!this.meter) return;
    const fl = this.flight;
    if (fl) {
      const h = Math.max(fl.height, ballPos.y - fl.y0);
      this.meter.classList.remove('hidden');
      this.meterFill.style.height = `${Math.min(100, (h / METER_MAX) * 100).toFixed(1)}%`;
    } else if (this.meterHold > 0) {
      this.meterHold -= dt;
      if (this.meterHold <= 0) this.meter.classList.add('hidden');
    }
  }

  /** World → HUD pixel position. */
  _screen(p) {
    const v = new THREE.Vector3(p.x, p.y, p.z).project(this.camera);
    const r = this.ui.getBoundingClientRect();
    return { x: ((v.x + 1) / 2) * r.width, y: ((1 - v.y) / 2) * r.height };
  }

  /** Stars pop out at `from` and fly into the counter. Returns the elements. */
  flyStars(n, from) {
    const target = this.counter()?.getBoundingClientRect();
    const r = this.ui.getBoundingClientRect();
    const tx = target ? target.left - r.left + 30 : r.width - 60;
    const ty = target ? target.top - r.top + 30 : 40;
    const els = [];
    for (let i = 0; i < n; i++) {
      const el = document.createElement('div');
      el.className = 'pw-fly';
      el.innerHTML = STAR_ICON;
      const spread = (i - (n - 1) / 2) * 46;
      el.style.left = `${from.x + spread}px`;
      el.style.top = `${from.y - 30}px`;
      el.style.transitionDelay = `${0.25 + i * 0.12}s`;
      this.ui.append(el);
      els.push(el);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.style.left = `${tx}px`;
        el.style.top = `${ty}px`;
        el.classList.add('pw-fly--go');
      }));
      setTimeout(() => el.remove(), 1600 + i * 120);
    }
    return els;
  }

  dispose() {
    this._endFlight();
    for (const b of this.bodies) this.physics.remove(b);
    for (const m of this.meshes) {
      m.removeFromParent();
      m.geometry.dispose();
      m.material.dispose();
    }
    this.meter?.remove();
  }
}

function starGeometry() {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.55 : 1.3;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false });
}
