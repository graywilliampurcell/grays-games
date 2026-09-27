// Saved human decisions, so the same question is not asked twice.
//
// One JSON file per decision: judgments/<game>/<rule-or-check>/<fingerprint>.json
//   { game, rule, check, fingerprint, decision: 'pass'|'warn'|'fail'|'ignore', note,
//     decidedBy, decidedAt, finding: { summary, evidence } }
// The fingerprint comes from the finding (lib/checks/util.js finding(): a hash of
// check, rule, rubric check, bracket and a stable per-check key such as a host name,
// a text string or an element).
//
// applyJudgments(findings, game) marks every finding that has a saved decision
// (finding.judgment) and replaces its status with the decision ('ignore' → 'info').
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PLAYBOT_DIR } from './config.js';

export const JUDGMENTS_DIR = resolve(PLAYBOT_DIR, 'judgments');
const DECISIONS = new Set(['pass', 'warn', 'fail', 'ignore']);

const safe = (s) => String(s).replace(/[^a-z0-9._-]+/gi, '_');
const scopeOf = (f) => f.rule ?? f.rubricCheck ?? f.check;

export function judgmentPath(game, finding, dir = JUDGMENTS_DIR) {
  return join(dir, safe(game), safe(scopeOf(finding)), `${safe(finding.fingerprint)}.json`);
}

/** Read the saved decision for this finding, or null. */
export function getJudgment(game, finding, dir = JUDGMENTS_DIR) {
  const p = judgmentPath(game, finding, dir);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

/** Save a decision for a finding. Returns the file path. */
export function saveJudgment(game, finding, { decision, note = '', decidedBy = 'JP' }, dir = JUDGMENTS_DIR) {
  if (!DECISIONS.has(decision)) throw new Error(`decision must be one of ${[...DECISIONS].join(', ')}`);
  if (!finding.fingerprint) throw new Error('finding has no fingerprint');
  const p = judgmentPath(game, finding, dir);
  mkdirSync(join(p, '..'), { recursive: true });
  const record = {
    game, rule: finding.rule ?? null, rubricCheck: finding.rubricCheck ?? null, check: finding.check,
    bracket: finding.bracket ?? null, target: finding.target ?? null, fingerprint: finding.fingerprint, decision, note, decidedBy,
    decidedAt: new Date().toISOString(),
    // flat aliases for readers that want them (lib/claudeChecks.js past-decision examples)
    question: finding.summary, reason: note, screenshot: finding.evidence?.screenshot ?? null,
    finding: { status: finding.status, summary: finding.summary, evidence: finding.evidence },
  };
  writeFileSync(p, `${JSON.stringify(record, null, 2)}\n`);
  return p;
}

/** All saved decisions for a game (or every game). Accepts a game name or { game }. */
export function listJudgments(game = null, dir = JUDGMENTS_DIR) {
  if (game && typeof game === 'object') game = game.game ?? null;
  const out = [];
  if (!existsSync(dir)) return out;
  for (const g of readdirSync(dir)) {
    if (game && g !== safe(game)) continue;
    const gdir = join(dir, g);
    for (const scope of safeReaddir(gdir)) {
      for (const f of safeReaddir(join(gdir, scope))) {
        if (!f.endsWith('.json')) continue;
        try { out.push(JSON.parse(readFileSync(join(gdir, scope, f), 'utf8'))); } catch { /* skip */ }
      }
    }
  }
  return out;
}

function safeReaddir(p) {
  try { return readdirSync(p); } catch { return []; }
}

/** Apply saved decisions to findings in place; returns how many matched. */
export function applyJudgments(findings, game, dir = JUDGMENTS_DIR) {
  let n = 0;
  for (const f of findings) {
    if (f.status === 'pass') continue;
    const j = getJudgment(game, f, dir);
    if (!j) continue;
    n++;
    f.judgment = { decision: j.decision, note: j.note, decidedBy: j.decidedBy, decidedAt: j.decidedAt, originalStatus: f.status };
    f.status = j.decision === 'ignore' ? 'info' : j.decision;
  }
  return n;
}
