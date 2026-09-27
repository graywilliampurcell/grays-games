// Cheap landing dust: a small pool of flat-shaded cubes in one InstancedMesh
// (one draw call). puff() throws a ring of little blocks outward from a
// point; update() moves, shrinks and hides them. No per-frame allocation.

import * as THREE from 'three';

const MAX = 24;
const LIFE = 0.55; // s

export class Dust {
  /**
   * @param {THREE.Object3D} scene
   * @param {number|string} [color=0xffffff]
   */
  constructor(scene, color = 0xffffff) {
    this.scene = scene;
    const geo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    const mat = new THREE.MeshLambertMaterial({ color, flatShading: true, transparent: true, opacity: 0.8 });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX);
    this.mesh.name = 'dust';
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.parts = Array.from({ length: MAX }, () => ({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), spin: 0 }));
    this.next = 0;
    this.live = 0;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._axis = new THREE.Vector3(0.3, 1, 0.2).normalize();
  }

  setColor(color) {
    this.mesh.material.color.set(color);
  }

  /**
   * Burst of `n` blocks around `pos` (the contact point), scaled by `power` 0..1.
   */
  puff(pos, power = 1, n = 10) {
    const k = Math.max(0.3, Math.min(1, power));
    for (let i = 0; i < n; i++) {
      const d = this.parts[this.next];
      this.next = (this.next + 1) % MAX;
      const a = (i / n) * Math.PI * 2 + (this.next % 3) * 0.4;
      d.life = LIFE * (0.8 + 0.4 * ((i * 7) % 5) / 5);
      d.p.set(pos.x + Math.cos(a) * 0.35, pos.y + 0.1, pos.z + Math.sin(a) * 0.35);
      const sp = (2 + ((i * 3) % 4) * 0.5) * k;
      d.v.set(Math.cos(a) * sp, (1.5 + (i % 3) * 0.6) * k, Math.sin(a) * sp);
      d.spin = (i % 2 ? 1 : -1) * 6;
    }
    this.live = MAX;
  }

  update(dt) {
    if (!this.live) return;
    let count = 0;
    for (const d of this.parts) {
      if (d.life <= 0) continue;
      d.life -= dt;
      if (d.life <= 0) continue;
      d.v.y -= 9 * dt;
      d.v.multiplyScalar(1 - 3 * dt);
      d.p.addScaledVector(d.v, dt);
      const s = Math.min(1, d.life / (LIFE * 0.6));
      this._q.setFromAxisAngle(this._axis, d.spin * d.life);
      this._m.compose(d.p, this._q, this._s.setScalar(s));
      this.mesh.setMatrixAt(count++, this._m);
    }
    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (!count) this.live = 0;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.dispose();
  }
}
