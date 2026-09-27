// Cheap falling snow for the snow theme: one Points cloud that lives in a
// box around the camera and wraps, so it costs one draw call anywhere.

import * as THREE from 'three';

const COUNT = 700;
const BOX = { x: 44, y: 22, z: 44 };

export class Snowfall {
  constructor(scene) {
    this.pos = new Float32Array(COUNT * 3);
    this.drift = new Float32Array(COUNT);
    let s = 12345;
    const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < COUNT; i++) {
      this.pos[i * 3] = rand() * BOX.x;
      this.pos[i * 3 + 1] = rand() * BOX.y;
      this.pos[i * 3 + 2] = rand() * BOX.z;
      this.drift[i] = rand() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    this.attr = new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3);
    geo.setAttribute('position', this.attr);
    this.points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.13, transparent: true, opacity: 0.9, depthWrite: false }),
    );
    this.points.frustumCulled = false;
    this.points.name = 'snowfall';
    scene.add(this.points);
    this.time = 0;
  }

  /** Move flakes down and wrap them into the box around `center` (the camera). */
  update(dt, center) {
    this.time += dt;
    const out = this.attr.array;
    const ox = center.x - BOX.x / 2;
    const oy = center.y - BOX.y / 2;
    const oz = center.z - BOX.z / 2;
    const wrap = (v, size) => ((v % size) + size) % size;
    for (let i = 0; i < COUNT; i++) {
      const j = i * 3;
      this.pos[j + 1] -= dt * 1.6;
      const sway = Math.sin(this.time * 0.8 + this.drift[i]) * 0.6;
      out[j] = ox + wrap(this.pos[j] + sway - ox, BOX.x);
      out[j + 1] = oy + wrap(this.pos[j + 1] - oy, BOX.y);
      out[j + 2] = oz + wrap(this.pos[j + 2] - oz, BOX.z);
    }
    this.attr.needsUpdate = true;
  }

  dispose() {
    this.points.removeFromParent();
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}
