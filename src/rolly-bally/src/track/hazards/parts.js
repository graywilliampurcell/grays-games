// Build one merged, vertex-colored, pre-shaded geometry from simple parts, so
// each moving hazard is a single draw call with the same voxel look as
// BlockMesh (flat shading, top faces brighter than sides).
//
//   makePartsGeometry([
//     { box: [x, y, z], size: [sx, sy, sz], color: 'metal' },
//     { sphere: [x, y, z], radius: 0.8, color: 'hazard' },
//   ], palette)

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getPalette } from '../../voxel/BlockMesh.js';

const _c = new THREE.Color();

function shadeFor(ny, nx) {
  if (ny > 0.5) return 1;
  if (ny < -0.5) return 0.6;
  return Math.abs(nx) > 0.5 ? 0.8 : 0.9;
}

function colorize(geometry, color, palette) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  const n = g.attributes.normal;
  const v = palette[color] ?? color;
  _c.set(v);
  const colors = new Float32Array(n.count * 3);
  for (let i = 0; i < n.count; i++) {
    const s = shadeFor(n.getY(i), n.getX(i));
    colors[i * 3] = _c.r * s;
    colors[i * 3 + 1] = _c.g * s;
    colors[i * 3 + 2] = _c.b * s;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

export function makePartsGeometry(parts, palette = 'race') {
  const pal = getPalette(palette);
  const geos = parts.map((p) => {
    let g;
    if (p.sphere) {
      g = new THREE.IcosahedronGeometry(p.radius, p.detail ?? 1);
      g.translate(p.sphere[0], p.sphere[1], p.sphere[2]);
    } else {
      g = new THREE.BoxGeometry(p.size[0], p.size[1], p.size[2]);
      if (p.rotation) g.applyQuaternion(new THREE.Quaternion(p.rotation.x, p.rotation.y, p.rotation.z, p.rotation.w));
      g.translate(p.box[0], p.box[1], p.box[2]);
    }
    return colorize(g, p.color, pal);
  });
  const merged = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  merged.computeBoundingSphere();
  return merged;
}

/** Shared flat-shaded material for hazard meshes. */
export function makeHazardMaterial() {
  return new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
}
