// M1 hand-built test track: straight, curves, ramps, a narrow section, a
// jump gap and a long width-8 railed path. Used to tune ball feel + camera.
//
// Debug hotkeys (?debug=1): R respawn, N jump to next segment,
// G cycle feel presets (difficulty 1..5 speed caps / auto-roll).
// URL: ?mode=test-track&auto=1 starts with auto-roll on.

import * as THREE from 'three';
import { Ball } from '../ball/Ball.js';
import { ChaseCamera } from '../core/ChaseCamera.js';
import { BlockMesh } from '../voxel/BlockMesh.js';
import { buildStrips, buildPath, nearestStrip, forwardOf } from './pathBuilder.js';

const deg = (d) => (d * Math.PI) / 180;

export const TEST_TRACK = [
  { kind: 'start', len: 8, width: 8, rails: true, color: 'start' },
  { kind: 'straight', len: 16, width: 8, rails: true },
  { kind: 'curve-left', len: 22, width: 8, rails: true, turn: deg(90) },
  { kind: 'uphill', len: 12, width: 8, rails: true, rise: 3 },
  { kind: 'top', len: 6, width: 8, rails: true },
  { kind: 'downhill', len: 12, width: 8, rails: true, rise: -3 },
  { kind: 'curve-right', len: 18, width: 8, rails: true, turn: deg(-90) },
  { kind: 'narrow', len: 14, width: 3 },
  { kind: 'wide', len: 8, width: 6 },
  { kind: 'launch', len: 6, width: 6, rise: 1.4 },
  { kind: 'gap', len: 2.5, width: 6, gap: true, rise: -1.4 },
  { kind: 'landing', len: 10, width: 8, rails: true },
  { kind: 'hairpin', len: 36, width: 8, rails: true, turn: deg(180) },
  { kind: 'railed', len: 30, width: 8, rails: true },
  { kind: 'finish', len: 8, width: 8, rails: true, color: 'finish' },
];

// Feel presets matching the plan's difficulty ladder (speed cap, auto-roll).
export const FEEL_PRESETS = [
  { name: 'd1', speedCap: 6, autoRoll: true },
  { name: 'd2', speedCap: 7, autoRoll: true },
  { name: 'd3', speedCap: 8, autoRoll: true },
  { name: 'd4', speedCap: 10, autoRoll: false },
  { name: 'd5', speedCap: 12, autoRoll: false },
];

const FALL_DEPTH = 8; // meters below the lowest nearby track before respawn
const RESPAWN_DELAY = 0.6;

export default class TestTrackMode {
  async start(ctx, config) {
    this.ctx = ctx;
    const { scene, physics, camera, save } = ctx;

    this.blocks = new BlockMesh({ palette: 'race' });
    const { strips, segmentStarts } = buildStrips(TEST_TRACK);
    this.strips = strips;
    this.segmentStarts = segmentStarts;
    buildPath({ physics, blocks: this.blocks, strips });
    this._addFinishArch();
    scene.add(this.blocks.build());

    const auto = ctx.params?.raw?.auto === '1' || config.auto === true;
    this.presetIndex = auto ? 0 : 3;
    this.progress = 2;
    this.checkpoint = 0;
    this.falling = 0;
    this.finished = 0;

    const spawn = this._spawnAt(0);
    const skin = save.get().skins.selected;
    this.ball = new Ball({ physics, scene, position: spawn.pos, skin });
    this._applyPreset();

    this.cam = new ChaseCamera(camera, { mode: 'track' });
    this.cam.snap(spawn.pos, spawn.dir);
    this.forward = spawn.dir.clone();
    this._tmpF = new THREE.Vector3();

    ctx.debug.watch('speed', () => this.ball.speed);
    ctx.debug.watch('piece', () => `${this.progress} ${this.strips[this.progress].kind}`);
    ctx.debug.watch('feel', () => {
      const t = this.ball.tuning;
      return `${FEEL_PRESETS[this.presetIndex].name} cap ${t.speedCap} ${t.autoRoll ? 'auto' : 'manual'}`;
    });
    ctx.debug.watch('grnd', () => (this.ball.isGrounded() ? 'yes' : 'no'));
  }

  _addFinishArch() {
    const s = this.strips[this.segmentStarts[this.segmentStarts.length - 1] + 4];
    const hw = s.width / 2 + 0.6;
    const r = new THREE.Vector3(Math.cos(s.yaw), 0, -Math.sin(s.yaw));
    for (const side of [-1, 1]) {
      const p = s.a.clone().addScaledVector(r, side * hw);
      this.blocks.addBox({ x: p.x, y: p.y + 2.5, z: p.z }, { x: 1, y: 5, z: 1 }, 'white', { yaw: s.yaw });
    }
    // Checkered banner across the top.
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 2; j++) {
        const off = -hw + ((i + 0.5) * (2 * hw)) / 10;
        const p = s.a.clone().addScaledVector(r, off);
        this.blocks.addBox(
          { x: p.x, y: p.y + 5.25 + j * 0.5, z: p.z },
          { x: (2 * hw) / 10, y: 0.5, z: 0.6 },
          (i + j) % 2 ? 'finishDark' : 'finish',
          { yaw: s.yaw, jitter: 0 },
        );
      }
    }
  }

  _spawnAt(stripIndex) {
    const s = this.strips[stripIndex];
    const pos = s.a.clone().lerp(s.b, 0.5);
    pos.y += this.ball ? this.ball.radius + 0.3 : 0.8;
    return { pos, dir: forwardOf(s.yaw) };
  }

  _applyPreset() {
    const p = FEEL_PRESETS[this.presetIndex];
    this.ball.setTuning({ speedCap: p.speedCap, autoRoll: p.autoRoll });
  }

  // -------------------------------------------------------------- loop

  update(dt) {
    const { input } = this.ctx;
    const pos = this.ball.getPosition(this._tmpPos || (this._tmpPos = new THREE.Vector3()));

    // Track progress (nearest strip, searched around the last one).
    const near = nearestStrip(this.strips, pos, this.progress);
    if (near.dist < 6) {
      this.progress = near.index;
      // Latest checkpoint at or before our position becomes the respawn point.
      for (let i = near.index; i > this.checkpoint; i--) {
        if (this.strips[i].checkpoint) {
          this.checkpoint = i;
          break;
        }
      }
    }

    // Camera faces along the track a few meters ahead.
    const ahead = this.strips[Math.min(this.strips.length - 1, this.progress + 3)];
    forwardOf(ahead.yaw, this._tmpF);
    this.forward.lerp(this._tmpF, 0.08).normalize();
    this.cam.setForward(this.forward);

    this.ball.update(dt, input.getMove(), this.forward);

    // Fall detection → delayed respawn at the last checkpoint.
    const floorY = Math.min(this.strips[this.progress].a.y, this.strips[this.progress].b.y);
    if (!this.falling && pos.y < floorY - FALL_DEPTH) {
      this.falling = RESPAWN_DELAY;
    }
    if (this.falling) {
      this.falling -= dt;
      if (this.falling <= 0) {
        this.falling = 0;
        this.respawn();
      }
    }

    // Finish: celebrate, then back to the start.
    const last = this.segmentStarts[this.segmentStarts.length - 1];
    if (!this.finished && this.progress >= last + 5) {
      this.finished = 2.5;
      this.ctx.audio.play('fanfare');
    }
    if (this.finished) {
      this.finished -= dt;
      if (this.finished <= 0) {
        this.finished = 0;
        this.checkpoint = 0;
        this.progress = 0;
        this.respawn();
      }
    }
  }

  render(alpha, frameDt) {
    const look = this.ctx.input.consumeLook();
    if (look.dx || look.dy) this.cam.addLook(look.dx, look.dy);
    this.ball.render(alpha, frameDt);
    this.cam.update(Math.min(frameDt, 0.1), { position: this.ball.position, velocity: this.ball.velocity });
  }

  // -------------------------------------------------------------- debug hooks

  respawn() {
    const spawn = this._spawnAt(this.checkpoint);
    this.progress = this.checkpoint;
    this.ball.respawn(spawn.pos, spawn.dir);
    this.forward.copy(spawn.dir);
    this.cam.snap(spawn.pos, spawn.dir);
    this.ctx.audio.play('boing');
  }

  nextPiece() {
    const seg = this.strips[this.progress].segment;
    const next = this.segmentStarts[(seg + 1) % this.segmentStarts.length];
    this.checkpoint = next;
    if (this.strips[next].gap) this.checkpoint = this.segmentStarts[(seg + 2) % this.segmentStarts.length];
    this.respawn();
  }

  regenerate() {
    this.presetIndex = (this.presetIndex + 1) % FEEL_PRESETS.length;
    this._applyPreset();
    this.ctx.audio.play('pop');
  }

  dispose() {
    this.ball?.dispose();
    this.blocks?.dispose();
  }
}
