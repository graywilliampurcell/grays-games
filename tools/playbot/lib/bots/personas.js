// Kid personas per age bracket: rubric.yaml "personas" (reaction, jitter,
// wrong turns, give-up time) plus a few maze-navigation numbers the rubric
// doesn't have. The extras below are guesses, set before any calibration run
// and NOT tuned to make Iteration 1 vs 2 come out a particular way.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import YAML from 'yaml';
import { PLAYBOT_DIR } from '../config.js';

export const BRACKETS = ['2-4', '5-7', '8-10', '11-13'];

// memory_prob:   chance the kid remembers having been in a maze cell
// memory_s:      how long such a memory lasts (s)
// straight_bias: weight for "keep going straight" at a junction (others weigh 1)
// spike_avoid:   chance the kid steers clear of a spike it can see
// race_level:    Rolly Bally race difficulty the persona plays (?d=)
export const PERSONA_EXTRAS = {
  '2-4': { memory_prob: 0.3, memory_s: 30, straight_bias: 2, spike_avoid: 0.2, race_level: 1 },
  '5-7': { memory_prob: 0.55, memory_s: 60, straight_bias: 2, spike_avoid: 0.5, race_level: 2 },
  '8-10': { memory_prob: 0.75, memory_s: 120, straight_bias: 1.5, spike_avoid: 0.75, race_level: 3 },
  '11-13': { memory_prob: 0.9, memory_s: 240, straight_bias: 1.5, spike_avoid: 0.9, race_level: 4 },
};

let rubricCache = null;
export function loadRubric(path = resolve(PLAYBOT_DIR, 'rubric.yaml')) {
  if (!rubricCache) rubricCache = YAML.parse(readFileSync(path, 'utf8'));
  return rubricCache;
}

/** Session length [min, max] minutes for a bracket, from rubric check "session-length". */
export function sessionMinutes(bracket, rubric = loadRubric()) {
  const c = rubric.checks.find((x) => x.id === 'session-length');
  return c?.thresholds?.[bracket]?.session_minutes ?? [5, 10];
}

export function persona(bracket, rubric = loadRubric()) {
  const base = rubric.personas?.[bracket];
  if (!base) throw new Error(`No persona for bracket "${bracket}" in rubric.yaml (have: ${Object.keys(rubric.personas ?? {}).join(', ')})`);
  const hint = rubric.checks.find((x) => x.id === 'hint-when-stuck')?.thresholds?.[bracket]?.hint_within_s;
  return {
    bracket,
    ...base,
    ...PERSONA_EXTRAS[bracket],
    session_minutes: sessionMinutes(bracket, rubric),
    // "stuck" = this long without reaching anywhere new (the bracket's hint time; 60 s when the rubric has none)
    stuck_s: hint ?? 60,
  };
}

export function parseBrackets(arg) {
  if (!arg || arg === true || arg === 'all') return BRACKETS.slice();
  const list = String(arg).split(',').map((s) => s.trim()).filter(Boolean);
  for (const b of list) if (!BRACKETS.includes(b)) throw new Error(`Unknown bracket "${b}" (known: ${BRACKETS.join(', ')})`);
  return list;
}
