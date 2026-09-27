// Ball skin rendering: paints a small canvas texture per skin (pixel-art
// style, nearest filtering) and wraps it in a flat-shaded material.
// Data lives in skinData.js; re-exported here for convenience.

import * as THREE from 'three';
import { SKINS, STARTER_SKIN_IDS, UNLOCK_ORDER, getSkin } from './skinData.js';

export { SKINS, STARTER_SKIN_IDS, UNLOCK_ORDER, getSkin };

const TEX_W = 64; // equirectangular: width = 2 × height
const TEX_H = 32;

const cache = new Map();

function paint(ctx, skin) {
  const [c0, c1 = '#ffffff'] = skin.colors;
  const px = (x, y, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  switch (skin.pattern) {
    case 'soccer': {
      px(0, 0, TEX_W, TEX_H, c0);
      // Staggered dark patches read as a soccer ball at a glance.
      for (let row = 0; row < 3; row++) {
        for (let i = 0; i < 5; i++) {
          const x = i * 13 + (row % 2) * 6;
          const y = 3 + row * 11;
          px(x + 1, y, 4, 1, c1);
          px(x, y + 1, 6, 3, c1);
          px(x + 1, y + 4, 4, 1, c1);
        }
      }
      break;
    }
    case 'stripes':
    case 'rainbow': {
      const bands = skin.colors.length * (skin.pattern === 'rainbow' ? 1 : 2);
      const h = TEX_H / bands;
      for (let i = 0; i < bands; i++) px(0, Math.floor(i * h), TEX_W, Math.ceil(h), skin.colors[i % skin.colors.length]);
      break;
    }
    case 'checker': {
      const s = 8;
      for (let y = 0; y < TEX_H; y += s) {
        for (let x = 0; x < TEX_W; x += s) px(x, y, s, s, ((x + y) / s) % 2 ? c1 : c0);
      }
      break;
    }
    case 'dots': {
      px(0, 0, TEX_W, TEX_H, c0);
      for (let y = 3; y < TEX_H; y += 8) {
        for (let x = ((y / 8) | 0) % 2 ? 6 : 2; x < TEX_W; x += 8) px(x, y, 3, 3, c1);
      }
      break;
    }
    case 'swirl': {
      for (let y = 0; y < TEX_H; y++) {
        for (let x = 0; x < TEX_W; x += 2) {
          const band = Math.floor((x + y * 2) / 6) % skin.colors.length;
          px(x, y, 2, 1, skin.colors[band]);
        }
      }
      break;
    }
    case 'face': {
      px(0, 0, TEX_W, TEX_H, c0);
      // Face centered at u = 0.75 (faces +X... good enough, the ball spins).
      const cx = 48;
      px(cx - 6, 11, 3, 4, c1); // eyes
      px(cx + 3, 11, 3, 4, c1);
      px(cx - 7, 19, 2, 2, c1); // smile
      px(cx - 5, 21, 10, 2, c1);
      px(cx + 5, 19, 2, 2, c1);
      break;
    }
    case 'stars': {
      px(0, 0, TEX_W, TEX_H, c0);
      const spots = [[4, 5], [18, 12], [31, 4], [44, 20], [57, 9], [10, 24], [26, 26], [50, 28], [38, 14]];
      for (const [x, y] of spots) {
        px(x, y - 1, 1, 3, c1);
        px(x - 1, y, 3, 1, c1);
      }
      break;
    }
    case 'solid':
    default:
      px(0, 0, TEX_W, TEX_H, c0);
      break;
  }

  // Subtle voxel grid so solid balls still visibly roll.
  ctx.globalAlpha = 0.12;
  for (let y = 0; y < TEX_H; y += 4) {
    for (let x = (y / 4) % 2 ? 0 : 4; x < TEX_W; x += 8) px(x, y, 4, 4, '#000000');
  }
  ctx.globalAlpha = 1;
}

const canvasCache = new Map();

/** The painted equirect canvas for a skin (cached; shared by textures and icons). */
export function getSkinCanvas(skinOrId) {
  const skin = typeof skinOrId === 'string' ? getSkin(skinOrId) : skinOrId;
  if (canvasCache.has(skin.id)) return canvasCache.get(skin.id);
  const canvas = document.createElement('canvas');
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  paint(canvas.getContext('2d'), skin);
  canvasCache.set(skin.id, canvas);
  return canvas;
}

/** CanvasTexture for a skin (cached). */
export function makeSkinTexture(skinOrId) {
  const skin = typeof skinOrId === 'string' ? getSkin(skinOrId) : skinOrId;
  if (cache.has(skin.id)) return cache.get(skin.id);
  const tex = new THREE.CanvasTexture(getSkinCanvas(skin));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.userData.shared = true; // cached: Game's disposeScene leaves it alone
  cache.set(skin.id, tex);
  return tex;
}

/** New flat-shaded material for a skin (textures are shared/cached). */
export function makeSkinMaterial(skinOrId) {
  return new THREE.MeshLambertMaterial({ map: makeSkinTexture(skinOrId), flatShading: true });
}

/** Low-poly "voxel-ish" ball geometry (faceted sphere). */
export function makeBallGeometry(radius = 0.5) {
  return new THREE.SphereGeometry(radius, 14, 10);
}

/** Standalone mesh for UI previews (skin picker). */
export function makeSkinPreviewMesh(skinOrId, radius = 0.5) {
  return new THREE.Mesh(makeBallGeometry(radius), makeSkinMaterial(skinOrId));
}

const pixelCache = new Map();

function skinPixels(skin) {
  if (!pixelCache.has(skin.id)) {
    pixelCache.set(skin.id, getSkinCanvas(skin).getContext('2d').getImageData(0, 0, TEX_W, TEX_H).data);
  }
  return pixelCache.get(skin.id);
}

// Light from upper-left-front, like the game's sun.
const LIGHT = (() => {
  const v = [-0.45, 0.6, 0.66];
  const l = Math.hypot(...v);
  return v.map((x) => x / l);
})();
const TILT = 0.3; // look slightly down on the ball so the top shows

/**
 * Draw a skin as a shaded 3D-looking sphere into `canvas` (2D, no WebGL),
 * sampling the same texture the game uses. `spin` (radians) turns it around
 * its vertical axis, so calling this every frame makes a turntable.
 * Default spin shows the side a face pattern is painted on.
 */
export function drawSkinSphere(canvas, skinOrId, spin = 0) {
  const skin = typeof skinOrId === 'string' ? getSkin(skinOrId) : skinOrId;
  const src = skinPixels(skin);
  const size = canvas.width;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const out = img.data;
  const r = size / 2 - 1;
  const c = size / 2;
  const ct = Math.cos(TILT);
  const st = Math.sin(TILT);
  for (let py = 0; py < size; py++) {
    const ny = -(py + 0.5 - c) / r; // up = +
    for (let px = 0; px < size; px++) {
      const nx = (px + 0.5 - c) / r;
      const d2 = nx * nx + ny * ny;
      if (d2 > 1) continue;
      const nz = Math.sqrt(1 - d2);
      // Rotate the view normal back into ball space (tilt about X).
      const by = ny * ct + nz * st;
      const bz = -ny * st + nz * ct;
      const lon = Math.atan2(nx, bz) + spin;
      const lat = Math.asin(Math.max(-1, Math.min(1, by)));
      let u = 0.75 + lon / (Math.PI * 2);
      u -= Math.floor(u);
      const tx = Math.min(TEX_W - 1, Math.floor(u * TEX_W));
      const ty = Math.min(TEX_H - 1, Math.floor((0.5 - lat / Math.PI) * TEX_H));
      const si = (ty * TEX_W + tx) * 4;
      const lambert = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
      const shade = 0.5 + 0.6 * lambert;
      const spec = Math.pow(lambert, 24) * 90;
      const edge = d2 > 0.9 ? 0.85 : 1; // soft dark rim
      const o = (py * size + px) * 4;
      out[o] = Math.min(255, src[si] * shade * edge + spec);
      out[o + 1] = Math.min(255, src[si + 1] * shade * edge + spec);
      out[o + 2] = Math.min(255, src[si + 2] * shade * edge + spec);
      out[o + 3] = d2 > (1 - 2 / r) ? 200 : 255; // light anti-alias on the edge
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/**
 * A skin as a 3D-looking ball picture on a new 2D canvas (for DOM buttons
 * without spinning up WebGL). Returns the canvas.
 */
export function drawSkinIcon(skinOrId, size = 96) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return drawSkinSphere(canvas, skinOrId);
}
