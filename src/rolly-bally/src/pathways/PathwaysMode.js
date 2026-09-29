// Pathways mode: sky roads (since 2026-09-29; the ground version is gone).
//
// Roads float in the sky like Race tracks, walls on both sides the whole
// way (SkyRoads.js lays them out, the Race track kit builds them). Not a
// race: no computer balls, countdown, checkpoints, medals or trophies.
//  - Start on the big checkered start pad; the road forks, you pick a way,
//    every branch reaches the end.
//  - Stars along the roads; a responsive ball (same top speed, quicker to
//    answer the finger, tighter turns) and a big star pickup radius.
//  - Gentle path assist keeps the ball near the middle of the road while the
//    finger points along it (a bowling bumper, not a rail).
//  - Falling off: fade, "boing", back on the road where you left it.
//  - The end pad under a rainbow star arch: confetti and a cheer, the trip's
//    stars big, then Again (same world) or New world (dice).
//
// Debug hotkeys (?debug=1): R respawn, G new world.

import * as THREE from 'three';
import '../playground/playground.css';
import './pathways.css';
import { Ball, DEFAULT_TUNING } from '../ball/Ball.js';
import { ChaseCamera } from '../core/ChaseCamera.js';
import { randomEmojiSeed } from '../core/Rng.js';
import { BlockMesh, applySky, getPalette } from '../voxel/BlockMesh.js';
import { Track } from '../track/TrackBuilder.js';
import { BALL_SPAWN_HEIGHT } from '../track/TrackLayout.js';
import { buildScenery } from '../race/Scenery.js';
import { StarField } from '../playground/Stars.js';
import { StuckWatch } from '../playground/StuckWatch.js';
import { Snowfall } from '../playground/Snow.js';
import { confetti } from '../fx/confetti.js';
import { iconButton } from '../ui/components.js';
import { refresh, dice } from '../ui/icons/index.js';
import { generateSkyRoads, nearestRoad, START_PAD, END_PAD, FORK_GAP } from './SkyRoads.js';
import { assistAccel } from './pathAssist.js';

export const PATHWAYS_TUNING = {
  speedCap: 9, // same as Playground
  accel: Math.round(DEFAULT_TUNING.accel * 1.4), // ~40% quicker to answer the finger
  turnAssist: 2.4, // Playground 1.6: turns tighter
};
export const STAR_RADIUS = 1.8; // Playground 1.25

const FADE_TIME = 0.35;
const FALL_BELOW = 10; // meters under the lowest road → respawn
const GROUND_BELOW = 60; // the ground far below (just for looks)
const STAR_CHEER_EVERY = 10;
const UP = new THREE.Vector3(0, 1, 0);
const RAINBOW = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];

const STAR_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.8l3.1 6.6 7.1.8-5.3 4.9 1.5 7.1L12 17.6l-6.4 3.6 1.5-7.1L1.8 9.2l7.1-.8z"/></svg>`;

/** Road colors per world: sand roads with green walls, or ice roads with blue walls. */
export const SKY_PALETTES = {
  grass: {
    ...getPalette('race'),
    track: '#f1d98a',
    trackAlt: '#e8cb72',
    edge: '#ffffff',
    rail: '#2fb84a',
    railPost: '#ffffff',
    startPad: '#ffd21f',
    endPad: '#ff5fa2',
    ground: '#5ccb3c',
  },
  snow: {
    ...getPalette('race'),
    track: '#bfe6ff',
    trackAlt: '#a6dafb',
    edge: '#ffffff',
    rail: '#2e6be8',
    railPost: '#ffffff',
    startPad: '#ff8a1f',
    endPad: '#ff5fa2',
    ground: '#f4f9ff',
  },
};

export default class PathwaysMode {
  async start(ctx, config) {
    this.ctx = ctx;
    this.config = config;
    this.sessionStars = 0;
    this.fade = null; // {phase: 'out'|'in', t}
    this.ended = false;
    this.lastSafe = new THREE.Vector3();
    this._pos = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this.stuck = new StuckWatch();
    this._cancelConfetti = [];
    this._timers = [];

    this._buildHud();
    this._buildWorld(config);

    const spawn = this._spawnPos();
    this.ball = new Ball({
      physics: ctx.physics,
      scene: ctx.scene,
      position: spawn,
      skin: ctx.save.get().skins.selected,
      tuning: { ...PATHWAYS_TUNING },
    });
    this.lastSafe.copy(spawn);
    this.ball.dust?.setColor(0xffffff);
    this.ball.onLand = (impact) => ctx.audio.play('thump', { volume: Math.min(0.6, impact / 18), pitch: 1.6 });

    this.cam = new ChaseCamera(ctx.camera, { mode: 'free', distance: 7.5, height: 3.4 });
    this.cam.snap(spawn, this.world.data.spawn.dir);

    ctx.debug.watch('speed', () => this.ball.speed);
    ctx.debug.watch('seed', () => this.config.seed);
    ctx.debug.watch('stars', () => `${this.sessionStars} (${this.world.stars.remaining} left)`);
    ctx.debug.watch('roads', () => {
      const d = this.world.data;
      return `${d.roads.length} roads ${d.forks} forks y ${d.minY}..${d.maxY}`;
    });
  }

  // ------------------------------------------------------------ world

  _buildWorld(config) {
    const { scene, physics, audio } = this.ctx;
    const theme = config.theme === 'snow' ? 'snow' : 'grass';
    const palette = SKY_PALETTES[theme];
    applySky(scene, theme, { near: 60, far: 260 });

    const data = generateSkyRoads(config, { Layout: Track });
    const w = { data, tracks: data.layouts, meshes: [], bodies: [] };
    const handlers = { onBumper: () => audio.play('boing', { volume: 0.35, pitch: 1.3 }) };
    for (const t of w.tracks) t.build({ physics, scene, palette, handlers });

    w.blocks = new BlockMesh({ palette });
    this._startChecker(w.blocks, data, palette);
    this._dividers(w, data);
    this._rainbowArch(w, data);
    scene.add(w.blocks.build());

    // Green or snowy ground far below, and clouds between (just for looks).
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshLambertMaterial({ color: palette.ground }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(data.end.position.x / 2, data.minY - GROUND_BELOW, data.end.position.z / 2);
    ground.name = 'ground';
    scene.add(ground);
    w.meshes.push(ground);
    w.scenery = buildScenery(scene, { strips: w.tracks.flatMap((t) => t.strips) }, config.seed);

    // Rolling onto the end pad ends the trip.
    const e = data.end;
    const { body } = physics.addSensorCuboid({
      position: { x: e.position.x, y: e.position.y + 1.5, z: e.position.z },
      halfExtents: { x: e.width / 2, y: 2, z: END_PAD.len / 2 - 1 },
      yaw: e.yaw,
      tag: 'sensor',
      onCollide: ({ otherInfo, started }) => {
        if (started && otherInfo?.tag === 'ball') this._hitEnd = true;
      },
    });
    w.bodies.push(body);

    w.stars = new StarField({ scene, stars: data.stars, radius: STAR_RADIUS });
    w.snow = theme === 'snow' ? new Snowfall(scene) : null;
    this.world = w;
    this._hitEnd = false;
    this.hud.stars.classList.toggle('hidden', data.stars.length === 0);
  }

  /** Yellow-and-white (orange on snow) checkers on the start pad. */
  _startChecker(blocks, data, palette) {
    const road = data.layouts[0];
    const cells = 6;
    const size = START_PAD.width / cells;
    for (let i = 0; i < cells; i++) {
      for (let j = 0; j < cells; j++) {
        const f = road.spline.sampleAt((j + 0.5) * size);
        const lat = -START_PAD.width / 2 + (i + 0.5) * size;
        const p = { x: f.position.x + f.right.x * lat, y: f.position.y + 0.015, z: f.position.z + f.right.z * lat };
        blocks.addBox(p, { x: size, y: 0.03, z: size }, (i + j) % 2 ? 'white' : palette.startPad, { yaw: f.yaw, jitter: 0 });
      }
    }
  }

  /** A bumper nose between the two branches where they fork and join. */
  _dividers(w, data) {
    const { physics } = this.ctx;
    for (const j of data.junctions) {
      const f = { x: -Math.sin(j.yaw), z: -Math.cos(j.yaw) };
      const k = j.kind === 'fork' ? 1 : -1;
      const p = { x: j.x + f.x * k, y: j.y + 0.6, z: j.z + f.z * k };
      w.blocks.addBox(p, { x: FORK_GAP, y: 1.2, z: 2.4 }, 'bumper', { yaw: j.yaw });
      const { body } = physics.addFixedCuboid({
        position: p,
        halfExtents: { x: FORK_GAP / 2, y: 0.6, z: 1.2 },
        yaw: j.yaw,
        restitution: 0.6,
        tag: 'bumper',
      });
      w.bodies.push(body);
    }
  }

  /** Rainbow arch over the end pad with a big star on top. */
  _rainbowArch(w, data) {
    const e = data.end;
    const r = { x: Math.cos(e.yaw), z: -Math.sin(e.yaw) };
    const outer = e.width / 2 + 2.4;
    RAINBOW.forEach((color, band) => {
      const radius = outer - band * 0.3;
      const n = 28;
      for (let i = 0; i <= n; i++) {
        const a = (Math.PI * i) / n;
        const lat = Math.cos(a) * radius;
        const p = { x: e.position.x + r.x * lat, y: e.position.y + Math.sin(a) * radius, z: e.position.z + r.z * lat };
        w.blocks.addBox(p, { x: 0.55, y: 0.55, z: 0.5 }, color, { yaw: e.yaw, jitter: 0 });
      }
    });
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      const rr = i % 2 ? 0.8 : 1.9;
      if (i === 0) shape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else shape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false });
    geo.translate(0, 0, -0.25);
    const star = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: '#ffd21f', emissive: '#6b5200', flatShading: true }));
    star.position.set(e.position.x, e.position.y + outer + 2, e.position.z);
    star.name = 'end-star';
    this.ctx.scene.add(star);
    w.meshes.push(star);
    w.endStar = star;
  }

  _disposeWorld() {
    const w = this.world;
    if (!w) return;
    const { physics } = this.ctx;
    for (const t of w.tracks) t.dispose();
    w.stars.dispose();
    w.snow?.dispose();
    w.scenery.dispose();
    w.blocks.dispose();
    for (const b of w.bodies) physics.remove(b);
    for (const m of w.meshes) {
      m.removeFromParent();
      m.geometry.dispose();
      m.material.dispose();
    }
    this.world = null;
  }

  _spawnPos() {
    const s = this.world.data.spawn;
    return new THREE.Vector3(s.x, s.y + BALL_SPAWN_HEIGHT, s.z);
  }

  // ------------------------------------------------------------ HUD

  _buildHud() {
    const { ui } = this.ctx;
    const stars = document.createElement('div');
    stars.className = 'pg-stars';
    stars.innerHTML = `${STAR_SVG}<span class="pg-stars__n">0</span>`;
    const fade = document.createElement('div');
    fade.className = 'pg-fade';
    ui.append(stars, fade);
    this.hud = { stars, count: stars.querySelector('.pg-stars__n'), fade, end: null };
  }

  _bumpStarHud() {
    const { stars, count } = this.hud;
    count.textContent = String(this.sessionStars);
    stars.classList.remove('pg-stars--bump');
    void stars.offsetWidth; // restart the animation
    stars.classList.add('pg-stars--bump');
  }

  _cheer(n) {
    this._cancelConfetti.push(confetti(this.ctx.ui, n));
    if (this._cancelConfetti.length > 4) this._cancelConfetti.shift();
  }

  // ------------------------------------------------------------ loop

  update(dt) {
    const { input } = this.ctx;
    this.cam.getForward(this._fwd);
    this.ball.update(dt, input.getMove(), this._fwd);
    this.world.tracks.forEach((t) => t.update(dt));

    if (this._hitEnd && !this.ended) this._finish();

    const pos = this.ball.getPosition(this._pos);
    if (this.ball.isGrounded()) this.lastSafe.copy(pos);
    const out = pos.y < this.world.data.minY - FALL_BELOW;
    const wedged = !this.fade && !this.ended && this.stuck.update(dt, pos, input.isActive());
    if ((out || wedged) && !this.fade) this.fade = { phase: 'out', t: 0 };
    if (this.fade) {
      this.fade.t += dt;
      if (this.fade.phase === 'out' && this.fade.t >= FADE_TIME) {
        this.respawn();
        this.fade = { phase: 'in', t: 0 };
      } else if (this.fade.phase === 'in' && this.fade.t >= FADE_TIME) {
        this.fade = null;
      }
    }
    this._pathAssist(dt);
  }

  postStep() {
    const got = this.world.stars.collect(this.ball.getPosition(this._pos));
    if (!got) return;
    const { audio, events } = this.ctx;
    for (let i = 0; i < got; i++) {
      this.sessionStars++;
      events.emit('starCollected', { sessionStars: this.sessionStars });
    }
    audio.play('pop', { pitch: 1.2 });
    audio.play('sparkle', { volume: 0.7 });
    this._bumpStarHud();
    if (this.sessionStars % STAR_CHEER_EVERY === 0) {
      audio.play('confetti', { volume: 0.6 });
      this._cheer(24);
    }
  }

  render(alpha, frameDt) {
    const dt = Math.min(frameDt, 0.1);
    const look = this.ctx.input.consumeLook();
    if (look.dx || look.dy) this.cam.addLook(look.dx, look.dy);
    this.ball.render(alpha, frameDt);
    this.cam.update(dt, { position: this.ball.position, velocity: this.ball.velocity });
    this.world.tracks.forEach((t) => t.render(alpha));
    this.world.stars.render(dt);
    this.world.snow?.update(dt, this.ctx.camera.position);
    this.world.endStar.rotation.y += dt * 1.2;

    let o = 0;
    if (this.fade) {
      const k = Math.min(1, this.fade.t / FADE_TIME);
      o = this.fade.phase === 'out' ? k : 1 - k;
    }
    this.hud.fade.style.opacity = o.toFixed(3);
  }

  /** Nudge toward the middle of the road while the finger points along it. */
  _pathAssist(dt) {
    if (this.fade || this.ended || !this.ball.isGrounded()) return;
    const move = this.ctx.input.getMove();
    if (!move || (!move.x && !move.y)) return;
    const f = this.cam.getForward(this._fwd);
    f.y = 0;
    if (f.lengthSq() < 1e-6) return;
    f.normalize();
    const r = this._right.crossVectors(f, UP);
    const want = { x: r.x * move.x + f.x * move.y, z: r.z * move.x + f.z * move.y };
    const pos = this.ball.getPosition(this._pos);
    const near = nearestRoad(this.world.tracks, pos);
    if (!near || Math.abs(near.height) > 2) return;
    const road = this.world.tracks[near.road];
    const c = road.spline.sampleAt(near.s);
    if (Math.abs(near.lateral) > c.width / 2) return;
    const a = assistAccel(pos, { x: c.position.x, z: c.position.z, dx: c.forward.x, dz: c.forward.z }, want);
    if (a) this.ball.push({ x: a.x * dt, y: 0, z: a.z * dt });
  }

  // ------------------------------------------------------------ the end

  _finish() {
    this.ended = true;
    const { audio, ui, input } = this.ctx;
    input.setEnabled(false);
    audio.play('fanfare');
    audio.play('confetti');
    this._cheer(140);
    this._timers.push(setTimeout(() => this._cheer(80), 900));

    const app = { audio };
    const panel = document.createElement('div');
    panel.className = 'pw-end';
    panel.innerHTML = `<div class="pw-end__stars">${STAR_SVG}<span>${this.sessionStars}</span></div>`;
    const row = document.createElement('div');
    row.className = 'pw-end__buttons';
    row.append(
      iconButton({ icon: refresh, caption: 'Again', label: 'Again', color: 'green', kind: 'big', app, onTap: () => this._restart(false) }),
      iconButton({ icon: dice, caption: 'New world', label: 'New world', color: 'blue', kind: 'big', app, onTap: () => this._restart(true) }),
    );
    panel.append(row);
    ui.append(panel);
    this.hud.end = panel;
  }

  /** Again (same world) or New world (new seed): fresh stars, back to the start. */
  _restart(newWorld) {
    this.hud.end?.remove();
    this.hud.end = null;
    for (const t of this._timers) clearTimeout(t);
    this._timers = [];
    this._disposeWorld();
    if (newWorld) this.config = { ...this.config, seed: randomEmojiSeed() };
    this._buildWorld(this.config);
    this.sessionStars = 0;
    this.hud.count.textContent = '0';
    this.ended = false;
    this.fade = null;
    this.ctx.input.setEnabled(true);
    const spawn = this._spawnPos();
    this.ball.respawn(spawn, this.world.data.spawn.dir);
    this.lastSafe.copy(spawn);
    this.stuck.reset();
    this.cam.snap(spawn, this.world.data.spawn.dir);
    this.ctx.audio.play('pop');
  }

  // ------------------------------------------------------------ respawn / debug

  /** Back on the road where the ball last touched it, facing along the road. */
  respawnPoint() {
    const near = nearestRoad(this.world.tracks, this.lastSafe);
    const road = this.world.tracks[near.road];
    const f = road.spline.sampleAt(near.s);
    return {
      position: new THREE.Vector3(f.position.x, f.position.y + BALL_SPAWN_HEIGHT, f.position.z),
      forward: new THREE.Vector3(f.forward.x, 0, f.forward.z),
    };
  }

  respawn() {
    const { position, forward } = this.respawnPoint();
    this.ball.respawn(position, forward);
    this.lastSafe.copy(position);
    this.stuck.reset();
    this.cam.snap(position, forward);
    this.ctx.audio.play('boing');
  }

  regenerate() {
    this._restart(true);
  }

  dispose() {
    for (const cancel of this._cancelConfetti || []) cancel();
    for (const t of this._timers || []) clearTimeout(t);
    this._disposeWorld();
    this.ball?.dispose();
  }
}
