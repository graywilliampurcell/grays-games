// Pathways mode: Playground with roads that guide you around the world.
//
// Same world, HUD, stars, fades and camera as PlaygroundMode; this adds:
//  - the roads (PathwaysGenerator), drawn into the terrain colors plus a
//    row of flat arrows pointing the way;
//  - a more responsive ball (same top speed, quicker to answer the finger
//    and tighter turns) and a bigger star pickup radius;
//  - gentle path assist: on a road, while the finger points roughly along
//    it, a small sideways push keeps the ball near the middle (a bowling
//    bumper, not a rail);
//  - respawn at the nearest point on a road;
//  - dark tunnels: the world goes dark inside them (darkTunnel.js).

import * as THREE from 'three';
import PlaygroundMode from '../playground/PlaygroundMode.js';
import { generatePathways } from './PathwaysGenerator.js';
import { worldToCell } from '../playground/TerrainGenerator.js';
import { DEFAULT_TUNING } from '../ball/Ball.js';
import { assistAccel } from './pathAssist.js';
import { DarkTunnels } from './darkTunnel.js';

export const PATHWAYS_TUNING = {
  speedCap: 9, // same as Playground
  accel: Math.round(DEFAULT_TUNING.accel * 1.4), // ~40% quicker to answer the finger
  turnAssist: 2.4, // Playground 1.6: turns tighter
};
export const STAR_RADIUS = 1.8; // Playground 1.25
const UP = new THREE.Vector3(0, 1, 0);

export default class PathwaysMode extends PlaygroundMode {
  generateWorld(config) {
    return generatePathways(config);
  }

  ballTuning() {
    return { ...PATHWAYS_TUNING };
  }

  starRadius() {
    return STAR_RADIUS;
  }

  async start(ctx, config) {
    await super.start(ctx, config);
    this.world.dark.attachBall(this.ball);
  }

  _buildWorld(config) {
    super._buildWorld(config);
    this.world.dark = new DarkTunnels({ scene: this.ctx.scene, features: this.world.data.features, audio: this.ctx.audio });
    if (this.ball) this.world.dark.attachBall(this.ball);
    const arrows = buildArrows(this.world.data.paths.arrows, config.theme);
    if (arrows) {
      this.ctx.scene.add(arrows);
      this.world.meshes.push(arrows);
    }
    this._right = new THREE.Vector3();
  }

  _disposeWorld() {
    this.world?.dark?.dispose();
    super._disposeWorld();
  }

  update(dt) {
    super.update(dt);
    this._pathAssist(dt);
  }

  render(alpha, frameDt) {
    super.render(alpha, frameDt);
    this.world.dark.update(Math.min(frameDt, 0.1), this.ball.position, this.ball.velocity);
  }

  _pathAssist(dt) {
    if (this.fade || !this.ball.isGrounded()) return;
    const move = this.ctx.input.getMove();
    if (!move || (!move.x && !move.y)) return;
    const f = this.cam.getForward(this._fwd);
    f.y = 0;
    if (f.lengthSq() < 1e-6) return;
    f.normalize();
    const r = this._right.crossVectors(f, UP);
    const want = { x: r.x * move.x + f.x * move.y, z: r.z * move.x + f.z * move.y };
    const pos = this.ball.getPosition(this._pos);
    const { n, paths } = this.world.data;
    const { cx, cz } = worldToCell(this.world.data, pos.x, pos.z);
    const k = paths.nearest[cx * n + cz];
    if (k < 0) return;
    const a = assistAccel(pos, paths.center[k], want);
    if (a) this.ball.push({ x: a.x * dt, y: 0, z: a.z * dt });
  }

  /** Respawn on the road point nearest to where the ball last touched ground. */
  respawnPoint() {
    const { center } = this.world.data.paths;
    if (!center.length) return super.respawnPoint();
    let best = center[0];
    let bestD = Infinity;
    for (const p of center) {
      const d = (p.x - this.lastSafe.x) ** 2 + (p.z - this.lastSafe.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return { x: best.x, y: best.y + 0.8, z: best.z };
  }
}

/** Flat arrows lying on the road, one InstancedMesh. */
function buildArrows(list, theme) {
  if (!list.length) return null;
  const s = new THREE.Shape();
  s.moveTo(0, 0.75);
  s.lineTo(0.6, 0.05);
  s.lineTo(0.22, 0.05);
  s.lineTo(0.22, -0.6);
  s.lineTo(-0.22, -0.6);
  s.lineTo(-0.22, 0.05);
  s.lineTo(-0.6, 0.05);
  s.closePath();
  const geo = new THREE.ShapeGeometry(s);
  geo.rotateX(Math.PI / 2); // lie flat, tip toward +z
  // Lit (not basic) so the arrows go dark inside dark tunnels too.
  const mat = new THREE.MeshLambertMaterial({
    color: theme === 'snow' ? '#2f7fd0' : '#ff8a1f',
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, list.length);
  mesh.name = 'road-arrows';
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  list.forEach((a, i) => {
    q.setFromAxisAngle(UP, a.yaw);
    m.compose(p.set(a.x, a.y + 0.06, a.z), q, one);
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}
