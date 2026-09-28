// Aggregates findings into per-bracket columns and an overall result.
//
// - A finding with `bracket` belongs to that bracket's column only.
// - A finding without `bracket` (always-true rules, bracket-free checks) applies to
//   every chosen bracket.
// - Overall = strictest: any fail (in a chosen bracket, or bracket-free) → FAIL;
//   else any warn → WARN; else PASS. `info` never changes the result.
// - Findings for brackets that were not chosen are ignored.
import { STATUS_ORDER, worst } from './checks/util.js';

const LABEL = { pass: 'PASS', info: 'PASS', warn: 'WARN', fail: 'FAIL' };

/**
 * @param {object[]} findings
 * @param {string[]} brackets  chosen brackets, e.g. ['5-7','8-10']
 * @returns {{overall, brackets:{[b]:{status, counts, fails:[], warns:[]}}, rules:{[id]:status}, checks:{[id]:{status, perBracket, count}}, counts}}
 */
export function aggregate(findings, brackets) {
  const relevant = findings.filter((f) => !f.bracket || brackets.includes(f.bracket));
  const columns = {};
  for (const b of brackets) {
    const mine = relevant.filter((f) => !f.bracket || f.bracket === b);
    columns[b] = {
      status: LABEL[worst(mine.map((f) => f.status))],
      counts: countBy(mine),
      fails: mine.filter((f) => f.status === 'fail').map(ref),
      warns: mine.filter((f) => f.status === 'warn').map(ref),
    };
  }
  const rules = {};
  for (const f of relevant) if (f.rule) rules[f.rule] = worst([rules[f.rule] ?? 'pass', f.status]);
  const checks = {};
  for (const f of relevant) {
    const c = (checks[f.check] ??= { status: 'pass', perBracket: {}, count: 0 });
    c.count++;
    c.status = worst([c.status, f.status]);
    const cols = f.bracket ? [f.bracket] : ['all'];
    for (const b of cols) c.perBracket[b] = worst([c.perBracket[b] ?? 'pass', f.status]);
  }
  const overallStatus = worst(relevant.map((f) => f.status));
  const alwaysTrueFails = relevant.filter((f) => f.rule && !f.bracket && f.status === 'fail').map(ref);
  return {
    overall: LABEL[overallStatus],
    brackets: columns,
    rules,
    checks,
    alwaysTrueFails,
    counts: countBy(relevant),
  };
}

function ref(f) {
  return { check: f.check, rule: f.rule, rubricCheck: f.rubricCheck, bracket: f.bracket, target: f.target, summary: f.summary, fingerprint: f.fingerprint };
}

function countBy(list) {
  const c = { pass: 0, info: 0, warn: 0, fail: 0 };
  for (const f of list) c[f.status] = (c[f.status] ?? 0) + 1;
  return c;
}

/** Plain-text table: one row per (check, target, rule/rubric), one column per bracket. */
export function formatTable(findings, brackets) {
  const rows = new Map();
  for (const f of findings) {
    if (f.bracket && !brackets.includes(f.bracket)) continue;
    const key = `${f.check}|${f.rule ?? f.rubricCheck ?? ''}|${f.target ?? ''}`;
    const r = rows.get(key) ?? { check: f.check, rule: f.rule ?? f.rubricCheck ?? '', target: f.target ?? '', cells: {}, all: 'pass', summary: '' };
    const cols = f.bracket ? [f.bracket] : brackets;
    for (const b of cols) r.cells[b] = worst([r.cells[b] ?? 'pass', f.status]);
    if (!r.summary || STATUS_ORDER[f.status] > STATUS_ORDER[r.all]) r.summary = f.summary;
    r.all = worst([r.all, f.status]);
    rows.set(key, r);
  }
  const head = ['check', 'rule', 'target', ...brackets, 'summary'];
  const body = [...rows.values()]
    .sort((a, b) => STATUS_ORDER[b.all] - STATUS_ORDER[a.all] || a.check.localeCompare(b.check))
    .map((r) => [r.check, r.rule, r.target, ...brackets.map((b) => (r.cells[b] ?? '-').toUpperCase()), r.summary]);
  const widths = head.map((h, i) => Math.min(i === head.length - 1 ? 110 : 28, Math.max(h.length, ...body.map((row) => String(row[i]).length))));
  const fmt = (row) => row.map((c, i) => {
    const s = String(c);
    return (s.length > widths[i] ? `${s.slice(0, widths[i] - 1)}…` : s).padEnd(widths[i]);
  }).join('  ').trimEnd();
  return [fmt(head), fmt(widths.map((w) => '-'.repeat(w))), ...body.map(fmt)].join('\n');
}
