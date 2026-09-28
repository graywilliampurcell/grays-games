// Config shapes for modes + normalizers (fill defaults, clamp bad values).
// The setup screens build configs with these; the URL parser uses them too.
// See CONTRACT.md §Configs.

import { randomEmojiSeed } from '../core/Rng.js';

export const RACE_COUNTS = [1, 3, 5, 10];
export const PLAYGROUND_SIZES = ['small', 'medium', 'large'];
export const PLAYGROUND_THEMES = ['grass', 'snow'];
export const PLAYGROUND_BUMPINESS = ['flat', 'hilly', 'mountains'];
export const PLAYGROUND_STUFF = ['ramps', 'jumps', 'bouncePads', 'tunnels', 'bumpers'];
export const PLAYGROUND_STARS = ['none', 'some', 'lots'];
export const PATHWAYS_STUFF = ['bouncy', 'ramps', 'darkTunnels', 'trick'];
export const PATHWAYS_STARS = ['everywhere', 'medium'];

function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function seedOr(seed) {
  return typeof seed === 'string' && seed.length > 0 ? seed : randomEmojiSeed();
}

/**
 * {difficulty: 1..5, races: 1|3|5|10, seed: string, startRace?: 1..races}
 * startRace only comes from the debug URL (?race=K) and applies to that run.
 */
export function normalizeRaceConfig(c = {}) {
  const d = Math.round(Number(c.difficulty));
  const n = Number(c.races);
  const out = {
    difficulty: Number.isFinite(d) ? Math.min(5, Math.max(1, d)) : 1,
    races: RACE_COUNTS.includes(n)
      ? n
      : Number.isFinite(n) && n > 0
        ? RACE_COUNTS.reduce((best, x) => (Math.abs(x - n) < Math.abs(best - n) ? x : best), 3)
        : 3,
    seed: seedOr(c.seed),
  };
  const k = Math.round(Number(c.startRace));
  if (Number.isFinite(k) && k > 1) out.startRace = Math.min(out.races, k);
  return out;
}

/**
 * {size, theme, bumpiness, stuff: string[], stars, seed}
 * Unknown stuff entries are dropped; order follows PLAYGROUND_STUFF.
 */
export function normalizePlaygroundConfig(c = {}) {
  const stuffIn = Array.isArray(c.stuff) ? c.stuff : ['ramps', 'jumps'];
  return {
    size: oneOf(c.size, PLAYGROUND_SIZES, 'medium'),
    theme: oneOf(c.theme, PLAYGROUND_THEMES, 'grass'),
    bumpiness: oneOf(c.bumpiness, PLAYGROUND_BUMPINESS, 'hilly'),
    stuff: PLAYGROUND_STUFF.filter((s) => stuffIn.includes(s)),
    stars: oneOf(c.stars, PLAYGROUND_STARS, 'some'),
    seed: seedOr(c.seed),
  };
}

/**
 * Pathways setup: {size, theme, bumpiness, stuff: string[], stars, seed}.
 * Same size/theme/bumpiness as Playground; its own stuff and stars (no
 * "none"). All stuff is on by default.
 */
export function normalizePathwaysConfig(c = {}) {
  const stuffIn = Array.isArray(c.stuff) ? c.stuff : PATHWAYS_STUFF;
  return {
    size: oneOf(c.size, PLAYGROUND_SIZES, 'medium'),
    theme: oneOf(c.theme, PLAYGROUND_THEMES, 'grass'),
    bumpiness: oneOf(c.bumpiness, PLAYGROUND_BUMPINESS, 'hilly'),
    stuff: PATHWAYS_STUFF.filter((s) => stuffIn.includes(s)),
    stars: oneOf(c.stars, PATHWAYS_STARS, 'everywhere'),
    seed: seedOr(c.seed),
  };
}

// Pathways P0 plays an ordinary Playground world. Nearest Playground
// equivalents until paths, dark tunnels and the trick mountain exist
// (P1-P3): Trick stands in as jumps for now.
const PATHWAYS_TO_PLAYGROUND_STUFF = { bouncy: 'bouncePads', ramps: 'ramps', darkTunnels: 'tunnels', trick: 'jumps' };
const PATHWAYS_TO_PLAYGROUND_STARS = { everywhere: 'lots', medium: 'some' };

/** The Playground config a Pathways setup plays (same seed, same world). */
export function pathwaysToPlaygroundConfig(c = {}) {
  const p = normalizePathwaysConfig(c);
  return normalizePlaygroundConfig({
    ...p,
    stuff: p.stuff.map((s) => PATHWAYS_TO_PLAYGROUND_STUFF[s]),
    stars: PATHWAYS_TO_PLAYGROUND_STARS[p.stars],
  });
}

/** Test-track / gallery take an optional seed only. */
export function normalizeSimpleConfig(c = {}) {
  return { ...c, seed: seedOr(c.seed) };
}

export const NORMALIZERS = {
  race: normalizeRaceConfig,
  playground: normalizePlaygroundConfig,
  'test-track': normalizeSimpleConfig,
  gallery: normalizeSimpleConfig,
};

export function normalizeConfig(mode, config) {
  const fn = NORMALIZERS[mode] || normalizeSimpleConfig;
  return fn(config || {});
}
