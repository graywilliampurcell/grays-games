// Loads rules.yaml (always-true content rules) and rubric.yaml (per-bracket checks).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import YAML from 'yaml';
import { PLAYBOT_DIR } from './config.js';

export function loadRules(path = resolve(PLAYBOT_DIR, 'rules.yaml')) {
  const doc = YAML.parse(readFileSync(path, 'utf8'));
  const rules = doc.rules ?? [];
  return { rules, byId: Object.fromEntries(rules.map((r) => [r.id, r])) };
}

export function loadRubric(path = resolve(PLAYBOT_DIR, 'rubric.yaml')) {
  const doc = YAML.parse(readFileSync(path, 'utf8'));
  const checks = doc.checks ?? [];
  const byId = Object.fromEntries(checks.map((c) => [c.id, c]));
  return {
    brackets: doc.brackets ?? {},
    bracketIds: Object.keys(doc.brackets ?? {}),
    checks,
    byId,
    personas: doc.personas ?? {},
    /** Threshold object for (check, bracket), or {} */
    threshold(checkId, bracket) { return byId[checkId]?.thresholds?.[bracket] ?? {}; },
    /** 'fail' | 'warn' | 'human' — what missing the threshold means for this bracket. */
    severity(checkId, bracket) { return byId[checkId]?.severity?.[bracket] ?? 'warn'; },
  };
}

/** "5-7,8-10" (also accepts en dashes) → ['5-7','8-10']; validates against the rubric. */
export function parseBrackets(spec, rubric) {
  if (!spec || spec === true) return [...rubric.bracketIds];
  const list = String(spec).split(',').map((s) => s.trim().replace(/[–—]/g, '-')).filter(Boolean);
  const bad = list.filter((b) => !rubric.bracketIds.includes(b));
  if (bad.length) throw new Error(`Unknown bracket(s) ${bad.join(', ')}. Known: ${rubric.bracketIds.join(', ')}`);
  return list;
}
