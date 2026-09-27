// Playground mode: roll around a generated blocky world. No goal, no end.
//
// World = TerrainGenerator.generate(config) (pure, seeded) → heightfield
// collider + terrain mesh + BlockMesh (wall, pads, trees, features) +
// FeatureSet (bounce pads, spinning bumpers) + StarField.
// Falling out of the world → fade → respawn at the nearest safe pad.
// Steering for 5 s without moving (wedged) does the same (StuckWatch).
//
// Debug hotkeys (?debug=1): R respawn, G regenerate with a new seed.

import * as THREE from 'three';
import './playground.css';
import { Ball } from '../ball/Ball.js';
import { ChaseCamera } from '../core/ChaseCamera.js';
import { randomEmojiSeed } from '../core/Rng.js';
import { BlockMesh, applySky } from '../voxel/BlockMesh.js';
import { generate, heightAt } from './TerrainGenerator.js';
import { buildTerrainMesh, addWorldBlocks } from './TerrainMesh.js';
import { FeatureSet } from './Features.js';
import { StarField } from './Stars.js';
import { Snowfall } from './Snow.js';
import { confetti } from '../fx/confetti.js';
import { StuckWatch } from './StuckWatch.js';

const FADE_TIME = 0.35;
const FALL_BELOW = 6; // meters under the lowest ground → respawn
const CAM_CLEARANCE = 0.8;
const STAR_CHEER_EVERY = 10; // a small confetti burst every N stars this run

const STAR_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.8l3.1 6.6 7.1.8-5.3 4.9 1.5 7.1L12 17.6l-6.4 3.6 1.5-7.1L1.8 9.2l7.1-.8z"/></svg>`;

export default class PlaygroundMode {
  async start(ctx, config) {
    this.ctx = ctx;
    this.config = config;
    this.sessionStars = 0;
    this.fade = null; // {phase: 'out'|'in', t}
    this.lastSafe = new THREE.Vector3();
    this._pos = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._camTarget = new THREE.Vector3();
    this.camPull = null;
    this.stuck = new StuckWatch();

    this._buildHud();
    this._buildWorld(config);

    const { spawn } = this.world.data;
    const spawnPos = { x: spawn.x, y: spawn.y + 0.8, z: spawn.z };
    this.ball = new Ball({
      physics: ctx.physics,
      scene: ctx.scene,
      position: spawnPos,
      skin: ctx.save.get().skins.selected,
      tuning: { speedCap: 9 },
    });
    this.lastSafe.set(spawnPos.x, spawnPos.y, spawnPos.z);
    this.ball.dust?.setColor(config.theme === 'snow' ? 0xffffff : 0xf1e6cc);
    this.ball.onLand = (impact) => {
      ctx.audio.play('thump', { volume: Math.min(0.6, impact / 18), pitch: 1.6 });
    };
    this._cancelConfetti = [];

    this.cam = new ChaseCamera(ctx.camera, { mode: 'free', distance: 7.5, height: 3.4 });
    this.cam.snap(spawnPos, spawn.dir);

    ctx.debug.watch('speed', () => this.ball.speed);
    ctx.debug.watch('seed', () => this.config.seed);
    ctx.debug.watch('stars', () => `${this.sessionStars} (${this.world.stars.remaining} left)`);
    ctx.debug.watch('world', () => {
      const d = this.world.data;
      return `${d.n}² h ${d.minH}..${d.maxH} ${d.features.length} stuff ${d.pads.length} pads`;
    });
  }

  // ------------------------------------------------------------ world

  _buildWorld(config) {
    const { scene, physics, audio } = this.ctx;
    const data = generate(config);
    const theme = config.theme === 'snow' ? 'snow' : 'grass';
    const far = Math.min(230, 90 + data.n * 0.6);
    applySky(scene, theme, { near: theme === 'snow' ? 30 : 45, far });

    const w = { data, bodies: [], meshes: [] };
    const { n, heights, minH, maxH } = data;

    // Ground collider: smooth heightfield through the quantized vertices.
    const hf = physics.addHeightfield({ nx: n, nz: n, heights, sizeX: n, sizeZ: n, friction: 0.8, tag: 'ground' });
    w.bodies.push(hf.body);

    // Invisible tall walls on the outer ring of cells so you can't fall off
    // the edge (the visible low wall sits in the same cells).
    const lo = minH - 10;
    const hi = maxH + 40;
    const cy = (lo + hi) / 2;
    const hy = (hi - lo) / 2;
    const half = n / 2;
    for (const [x, z, hx, hz] of [
      [-half + 0.5, 0, 0.5, half],
      [half - 0.5, 0, 0.5, half],
      [0, -half + 0.5, half, 0.5],
      [0, half - 0.5, half, 0.5],
    ]) {
      const { body } = physics.addFixedCuboid({ position: { x, y: cy, z }, halfExtents: { x: hx, y: hy, z: hz }, friction: 0.2, tag: 'border' });
      w.bodies.push(body);
    }

    // Tree trunks are solid (the ball used to roll straight through them).
    for (const t of data.trees) {
      const { body } = physics.addFixedCuboid({
        position: { x: t.x, y: t.y + t.height / 2, z: t.z },
        halfExtents: { x: 0.4, y: t.height / 2, z: 0.4 },
        friction: 0.5,
        restitution: 0.3,
        tag: 'tree',
      });
      w.bodies.push(body);
    }

    const terrain = buildTerrainMesh(data);
    scene.add(terrain);
    w.meshes.push(terrain);

    w.blocks = new BlockMesh({ palette: theme });
    addWorldBlocks(data, w.blocks);
    w.features = new FeatureSet({ physics, scene, blocks: w.blocks, features: data.features, audio });
    scene.add(w.blocks.build());

    w.stars = new StarField({ scene, stars: data.stars });
    w.snow = theme === 'snow' ? new Snowfall(scene) : null;

    this.world = w;
    this.hud.stars.classList.toggle('hidden', data.stars.length === 0);
  }

  _disposeWorld() {
    const w = this.world;
    if (!w) return;
    const { physics } = this.ctx;
    w.features.dispose();
    w.stars.dispose();
    w.snow?.dispose();
    w.blocks.dispose();
    for (const b of w.bodies) physics.remove(b);
    for (const m of w.meshes) {
      m.removeFromParent();
      m.geometry.dispose();
      m.material.dispose();
    }
    this.world = null;
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
    this.hud = { stars, count: stars.querySelector('.pg-stars__n'), fade };
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
    this.world.features.update(dt);

    const pos = this.ball.getPosition(this._pos);
    if (this.ball.isGrounded()) this.lastSafe.copy(pos);

    const d = this.world.data;
    const half = d.n / 2 + 2;
    const out = pos.y < d.minH - FALL_BELOW || Math.abs(pos.x) > half || Math.abs(pos.z) > half;
    const wedged = !this.fade && this.stuck.update(dt, pos, input.isActive());
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
  }

  postStep(dt) {
    this.world.features.postStep(dt, this.ball);
    const got = this.world.stars.collect(this.ball.getPosition(this._pos));
    if (got) {
      const { audio, events } = this.ctx;
      for (let i = 0; i < got; i++) {
        this.sessionStars++;
        events.emit('starCollected', { sessionStars: this.sessionStars });
      }
      audio.play('pop', { pitch: 1.2 });
      audio.play('sparkle', { volume: 0.7 });
      this._bumpStarHud();
      if (this.world.stars.remaining === 0) {
        audio.play('fanfare');
        audio.play('confetti');
        this.hud.stars.classList.add('pg-stars--all');
        this._cheer(90);
      } else if (this.sessionStars % STAR_CHEER_EVERY === 0) {
        audio.play('confetti', { volume: 0.6 });
        this._cheer(24);
      }
    }
  }

  render(alpha, frameDt) {
    const dt = Math.min(frameDt, 0.1);
    const look = this.ctx.input.consumeLook();
    if (look.dx || look.dy) this.cam.addLook(look.dx, look.dy);
    this.ball.render(alpha, frameDt);
    this.cam.update(dt, { position: this.ball.position, velocity: this.ball.velocity });
    this._keepCameraClear(dt);
    this.world.features.render(alpha, dt);
    this.world.stars.render(dt);
    this.world.snow?.update(dt, this.ctx.camera.position);

    let o = 0;
    if (this.fade) {
      const k = Math.min(1, this.fade.t / FADE_TIME);
      o = this.fade.phase === 'out' ? k : 1 - k;
    }
    this.hud.fade.style.opacity = o.toFixed(3);
  }

  /**
   * Keep hills, tunnel roofs and walls from hiding the ball: pull the camera
   * in along the ball→camera ray when something is in the way (fast in, slow
   * out), and never below the ground under the camera.
   */
  _keepCameraClear(dt) {
    const camera = this.ctx.camera;
    const focus = this._look.copy(this.cam.focus);
    focus.y += 0.6;
    const dir = this._dir.copy(camera.position).sub(focus);
    const full = dir.length();
    if (full < 1e-3) return;
    dir.divideScalar(full);
    const { world, RAPIER } = this.ctx.physics;
    const hit = world.castRay(
      new RAPIER.Ray(focus, dir),
      full,
      true,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      undefined,
      this.ball.body,
      (collider) => this.ctx.physics.info(collider)?.tag !== 'border',
    );
    let toi = hit ? hit.timeOfImpact : full;
    toi = Math.min(toi, this._treeHit(focus, dir, toi));
    const want = toi < full ? Math.max(1.2, toi - 0.35) : full;
    if (this.camPull === null) this.camPull = want;
    else if (want < this.camPull) this.camPull = want;
    else this.camPull += (want - this.camPull) * (1 - Math.exp(-2 * dt));
    const dist = Math.min(full, this.camPull);
    const p = this._camTarget.copy(focus).addScaledVector(dir, dist);
    const ground = heightAt(this.world.data, p.x, p.z) + CAM_CLEARANCE;
    if (p.y < ground) p.y = ground;
    if (dist < full - 1e-3 || p.y !== camera.position.y) {
      camera.position.copy(p);
      this.cam.getForward(this._fwd);
      camera.lookAt(focus.x + this._fwd.x * this.cam.lookAhead, focus.y, focus.z + this._fwd.z * this.cam.lookAhead);
    }
  }

  /**
   * Tree canopies have no colliders (the ball rolls under them), so the
   * physics ray misses them. Ray vs. each nearby canopy box; returns the
   * nearest hit distance (or maxDist).
   */
  _treeHit(o, d, maxDist) {
    let best = maxDist;
    const r2 = (maxDist + 3) ** 2;
    for (const t of this.world.data.trees) {
      const dx = t.x - o.x;
      const dz = t.z - o.z;
      if (dx * dx + dz * dz > r2) continue;
      const top = t.y + t.height + 2.3;
      best = rayBox(o, d, t.x - 1.5, t.y + t.height - 1, t.z - 1.5, t.x + 1.5, top, t.z + 1.5, best);
    }
    return best;
  }

  // ------------------------------------------------------------ respawn / debug

  /** Respawn at the safe pad nearest to where the ball last touched ground. */
  respawn() {
    const { pads } = this.world.data;
    let best = pads[0];
    let bestD = Infinity;
    for (const p of pads) {
      const d = (p.x - this.lastSafe.x) ** 2 + (p.z - this.lastSafe.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    const pos = { x: best.x, y: best.y + 0.8, z: best.z };
    this.cam.getForward(this._fwd);
    this.ball.respawn(pos, this._fwd);
    this.lastSafe.set(pos.x, pos.y, pos.z);
    this.stuck.reset();
    this.cam.snap(pos, this._fwd);
    this.camPull = null;
    this.ctx.audio.play('boing');
  }

  regenerate() {
    this._disposeWorld();
    this.config = { ...this.config, seed: randomEmojiSeed() };
    this._buildWorld(this.config);
    this.lastSafe.set(0, 0, 0);
    this.respawn();
    this.hud.stars.classList.remove('pg-stars--all');
    this.ctx.audio.play('pop');
  }

  dispose() {
    for (const cancel of this._cancelConfetti || []) cancel();
    this._disposeWorld();
    this.ball?.dispose();
  }
}

/** Slab test: distance along unit ray (o, d) into the box, if < best; else best. */
function rayBox(o, d, x0, y0, z0, x1, y1, z1, best) {
  const span = { lo: 0, hi: best };
  if (!slab(o.x, d.x, x0, x1, span) || !slab(o.y, d.y, y0, y1, span) || !slab(o.z, d.z, z0, z1, span)) return best;
  return span.lo < best ? span.lo : best;
}

function slab(o, d, lo, hi, span) {
  if (Math.abs(d) < 1e-8) return o >= lo && o <= hi;
  let a = (lo - o) / d;
  let b = (hi - o) / d;
  if (a > b) [a, b] = [b, a];
  if (a > span.lo) span.lo = a;
  if (b < span.hi) span.hi = b;
  return span.lo <= span.hi;
}
