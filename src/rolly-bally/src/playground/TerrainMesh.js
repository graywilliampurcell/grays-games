// Visuals for the generated world (colliders are built in PlaygroundMode).
//  - buildTerrainMesh(): the ground surface as ONE mesh whose triangles match
//    the Rapier heightfield exactly, with per-cell colors so the 1 m grid reads
//    as blocks, plus dirt "skirts" down the outer edge.
//  - addWorldBlocks(): border wall, safe pads and trees into a BlockMesh.

import * as THREE from 'three';
import { getPalette } from '../voxel/BlockMesh.js';
import { vIndex, cellRange, cellMin } from './TerrainGenerator.js';

function cellHash(cx, cz) {
  let h = Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Height bands (meters) for the grass theme; only mountains reach them.
const STONE_FROM = 6.5;
const SNOWCAP_FROM = 10;

/** Ground color for a cell by theme, height and slope. */
function groundColor(theme, pal, y, lowest, sloped, out) {
  if (theme === 'snow') {
    if (y <= lowest + 0.5 && !sloped) return out.set(pal.ice); // frozen ponds in the dips
    return out.set(sloped ? pal.grassDark : pal.snow);
  }
  if (y >= SNOWCAP_FROM) return out.set(sloped ? '#dfe8f2' : '#f7fbff');
  if (y >= STONE_FROM) return out.set(sloped ? '#8a9096' : pal.stone);
  return out.set(sloped ? pal.grassDark : pal.grass);
}

// Pathways roads: sand on grass, blue ice on snow; lighter dashes down the middle.
const ROAD_COLORS = {
  grass: { road: '#e6cf8f', dash: '#fff3cf' },
  snow: { road: '#86c3ec', dash: '#e3f4ff' },
};

/**
 * @param {{n, heights, minH, maxH, theme, paths?}} world
 * @returns {THREE.Mesh}
 */
export function buildTerrainMesh(world) {
  const { n, heights: h, minH } = world;
  const theme = world.theme === 'snow' ? 'snow' : 'grass';
  const pal = getPalette(theme);
  const t = { n, heights: h };
  const half = n / 2;
  const bottom = minH - 4;
  const skirtTris = 4 * n * 2;
  const tris = n * n * 2 + skirtTris;
  const pos = new Float32Array(tris * 9);
  const col = new Float32Array(tris * 9);
  let k = 0;
  const c = new THREE.Color();
  const dirt = new THREE.Color(pal.dirt);
  const roads = world.paths?.cells;
  const roadPal = ROAD_COLORS[theme];

  const vert = (x, y, z, color) => {
    pos[k] = x;
    pos[k + 1] = y;
    pos[k + 2] = z;
    col[k] = color.r;
    col[k + 1] = color.g;
    col[k + 2] = color.b;
    k += 3;
  };

  for (let cx = 0; cx < n; cx++) {
    const x0 = cx - half;
    const x1 = x0 + 1;
    for (let cz = 0; cz < n; cz++) {
      const z0 = cz - half;
      const z1 = z0 + 1;
      const h00 = h[vIndex(n, cx, cz)];
      const h10 = h[vIndex(n, cx + 1, cz)];
      const h01 = h[vIndex(n, cx, cz + 1)];
      const h11 = h[vIndex(n, cx + 1, cz + 1)];
      const sloped = cellRange(t, cx, cz) > 0;
      const road = roads ? roads[cx * n + cz] : 0;
      if (road) c.set(road === 3 ? roadPal.dash : roadPal.road);
      else groundColor(theme, pal, cellMin(t, cx, cz), minH, sloped, c);
      // Checker + jitter so individual 1 m blocks read.
      const f = 1 + (cellHash(cx, cz) * 2 - 1) * 0.045 + ((cx + cz) & 1 ? -0.03 : 0.02);
      c.multiplyScalar(f);
      // Same split as Rapier's heightfield: diagonal (x0,z1)–(x1,z0). CCW from above.
      vert(x0, h00, z0, c); vert(x0, h01, z1, c); vert(x1, h10, z0, c);
      vert(x1, h11, z1, c); vert(x1, h10, z0, c); vert(x0, h01, z1, c);
    }
  }

  // Skirts: vertical dirt walls around the outside, facing outward.
  const quad = (ax, az, ah, bx, bz, bh, outX, outZ) => {
    const shade = c.copy(dirt).multiplyScalar(0.85);
    // Triangles a-top, b-top, a-bottom / b-top, b-bottom, a-bottom; flip if facing inward.
    const ex = bx - ax;
    const ez = bz - az;
    // normal of (a_top → b_top, a_top → a_bottom) = e × (0,-1,0) = (ez, 0, -ex)... pick order by sign
    const outward = ez * outX - ex * outZ > 0;
    if (outward) {
      vert(ax, ah, az, shade); vert(bx, bh, bz, shade); vert(ax, bottom, az, shade);
      vert(bx, bh, bz, shade); vert(bx, bottom, bz, shade); vert(ax, bottom, az, shade);
    } else {
      vert(ax, ah, az, shade); vert(ax, bottom, az, shade); vert(bx, bh, bz, shade);
      vert(bx, bh, bz, shade); vert(ax, bottom, az, shade); vert(bx, bottom, bz, shade);
    }
  };
  for (let i = 0; i < n; i++) {
    const a = i - half;
    const b = a + 1;
    quad(-half, a, h[vIndex(n, 0, i)], -half, b, h[vIndex(n, 0, i + 1)], -1, 0);
    quad(half, a, h[vIndex(n, n, i)], half, b, h[vIndex(n, n, i + 1)], 1, 0);
    quad(a, -half, h[vIndex(n, i, 0)], b, -half, h[vIndex(n, i + 1, 0)], 0, -1);
    quad(a, half, h[vIndex(n, i, n)], b, half, h[vIndex(n, i + 1, n)], 0, 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  mesh.name = 'terrain';
  return mesh;
}

/** Border wall, safe pads and trees → blocks. */
export function addWorldBlocks(world, blocks) {
  const { n, heights: h, pads, trees } = world;
  const t = { n, heights: h };
  const half = n / 2;
  const snow = world.theme === 'snow';

  // Low wall on the outermost ring of cells.
  const wallTop = 1.2;
  const wallCell = (cx, cz) => {
    const lo = cellMin(t, cx, cz) - 0.5;
    const hi = Math.max(h[vIndex(n, cx, cz)], h[vIndex(n, cx + 1, cz)], h[vIndex(n, cx, cz + 1)], h[vIndex(n, cx + 1, cz + 1)]) + wallTop;
    blocks.addBox(
      { x: cx - half + 0.5, y: (lo + hi) / 2, z: cz - half + 0.5 },
      { x: 1, y: hi - lo, z: 1 },
      (cx + cz) % 2 ? 'wall' : 'stone',
    );
  };
  for (let i = 0; i < n; i++) {
    wallCell(i, 0);
    wallCell(i, n - 1);
    if (i > 0 && i < n - 1) {
      wallCell(0, i);
      wallCell(n - 1, i);
    }
  }

  // Safe pads: bright checker tiles (spawn pad is bigger).
  for (const p of pads) {
    const s = p.size;
    for (let i = 0; i < s; i++) {
      for (let j = 0; j < s; j++) {
        blocks.addBox(
          { x: p.x - s / 2 + i + 0.5, y: p.y - 0.06, z: p.z - s / 2 + j + 0.5 },
          { x: 1, y: 0.2, z: 1 },
          (i + j) % 2 ? 'pad' : 'white',
          { jitter: 0 },
        );
      }
    }
  }

  // Trees: trunk + leafy block (grass) or stacked snowy pine (snow).
  for (const tr of trees) {
    const th = tr.height;
    blocks.addBox({ x: tr.x, y: tr.y + th / 2, z: tr.z }, { x: 0.8, y: th, z: 0.8 }, 'trunk');
    if (snow) {
      for (let k = 0; k < 3; k++) {
        const w = 3 - k * 0.9;
        const y = tr.y + th - 0.5 + k * 0.9;
        blocks.addBox({ x: tr.x, y, z: tr.z }, { x: w, y: 0.8, z: w }, 'leaves');
        blocks.addBox({ x: tr.x, y: y + 0.45, z: tr.z }, { x: w - 0.3, y: 0.15, z: w - 0.3 }, 'snow');
      }
    } else if (tr.kind === 2) {
      // round-ish bush tree
      blocks.addBox({ x: tr.x, y: tr.y + th + 0.6, z: tr.z }, { x: 2.6, y: 2, z: 2.6 }, 'leaves');
      blocks.addBox({ x: tr.x, y: tr.y + th + 1.9, z: tr.z }, { x: 1.6, y: 0.8, z: 1.6 }, 'leaves');
    } else {
      blocks.addBox({ x: tr.x, y: tr.y + th + 0.8, z: tr.z }, { x: 3, y: 2.4, z: 3 }, tr.kind ? 'leaves' : 'green');
    }
  }
}
