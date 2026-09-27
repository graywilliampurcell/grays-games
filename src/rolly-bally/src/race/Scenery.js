// Race backdrop: puffy blocky clouds below and far beside the track so it
// reads as a sky road instead of floating in flat blue. One InstancedMesh
// (one draw call), bright and fogged. Seeded from the race seed; visual only.

import * as THREE from 'three';
import { Rng } from '../core/Rng.js';

const MAX_BOXES = 360;

/**
 * @param {THREE.Object3D} scene
 * @param {{strips: Array<{a:{x,y,z}}>}} track
 * @param {string} seed
 * @returns {{mesh: THREE.InstancedMesh, dispose: () => void}}
 */
export function buildScenery(scene, track, seed) {
  const rng = new Rng(`scenery:${seed}`);
  const pts = track.strips.map((st) => st.a);
  let minY = Infinity;
  for (const p of pts) minY = Math.min(minY, p.y);

  const boxes = [];
  const clouds = Math.min(60, 18 + Math.round(pts.length / 2));
  let made = 0;
  for (let i = 0; i < clouds * 4 && made < clouds && boxes.length < MAX_BOXES - 5; i++) {
    const anchor = rng.pick(pts);
    const a = rng.range(0, Math.PI * 2);
    const below = rng.chance(0.6);
    // Below: deep under the road. Beside: far out, around road height.
    const r = below ? rng.range(4, 45) : rng.range(45, 110);
    const x = anchor.x + Math.cos(a) * r;
    const z = anchor.z + Math.sin(a) * r;
    const y = below ? minY - rng.range(22, 34) : anchor.y + rng.range(-16, 6);
    if (!below && tooClose(pts, x, z, 30)) continue;
    cloud(boxes, rng, x, y, z, below ? rng.range(1.3, 2.4) : rng.range(1.2, 2.2));
    made++;
  }

  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x8fa9c4, flatShading: true });
  const mesh = new THREE.InstancedMesh(geo, mat, boxes.length);
  mesh.name = 'scenery';
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  boxes.forEach((b, i) => mesh.setMatrixAt(i, m.compose(b.p, q, b.s)));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  scene.add(mesh);
  return {
    mesh,
    dispose() {
      mesh.removeFromParent();
      geo.dispose();
      mat.dispose();
      mesh.dispose();
    },
  };
}

function tooClose(pts, x, z, dist) {
  const d2 = dist * dist;
  for (const p of pts) if ((p.x - x) ** 2 + (p.z - z) ** 2 < d2) return true;
  return false;
}

/** A flat, lumpy cloud: a wide base slab plus a few puffs on top. */
function cloud(boxes, rng, x, y, z, scale) {
  const w = 6 * scale;
  const d = 4 * scale;
  boxes.push({ p: new THREE.Vector3(x, y, z), s: new THREE.Vector3(w, 1.2 * scale, d) });
  const puffs = rng.int(2, 4);
  for (let i = 0; i < puffs; i++) {
    const s = rng.range(1.6, 2.8) * scale;
    boxes.push({
      p: new THREE.Vector3(x + rng.range(-w / 3, w / 3), y + 0.3 * scale + s / 2, z + rng.range(-d / 4, d / 4)),
      s: new THREE.Vector3(s, s, s),
    });
  }
}
