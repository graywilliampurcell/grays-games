// Loads Mazle's own maze carver (src/playtest/js/mazeCarver.js) and its levels
// (js/levels.js) read-only, without touching the game. Both are plain ES
// modules with no imports; they are imported from a data: URL so Node doesn't
// warn about the game package having no "type": "module".
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REPO_ROOT } from '../config.js';

const cache = new Map();

async function importSource(rel) {
  if (!cache.has(rel)) {
    const src = readFileSync(resolve(REPO_ROOT, rel), 'utf8');
    cache.set(rel, import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`));
  }
  return cache.get(rel);
}

/** { mulberry32, carveMaze, walkFrom, analyzeMaze, toLayout } */
export function loadCarver(dir = 'src/playtest') {
  return importSource(`${dir}/js/mazeCarver.js`);
}

/** LEVELS array from js/levels.js */
export async function loadLevels(dir = 'src/playtest') {
  return (await importSource(`${dir}/js/levels.js`)).LEVELS;
}
