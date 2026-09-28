// Review report (Phase 5): reads every result in one run dir and writes
//   report.json  machine-readable summary, incl. the key screenshots to attach in Notion
//   report.md    Notion-flavoured markdown (notion://docs/enhanced-markdown-spec) for the /playtest skill
//
// Inputs in <runDir>: smoke.json, checks.json, play.json, claude.json, compare.json, keyshots/,
// video/, plan.md (optional), plus the `steps` record from the review command.
//
// Result policy (plan "Age brackets" + "Judge model"):
//   - overall = the strictest chosen bracket
//   - an always-true rule fail (automatic, or Claude and not cleared by a person) -> FAIL
//   - smoke errors and bot bugs (solver/monkey/explorer failures, page errors) -> FAIL
//   - AI verdicts are advisory (at most WARN), except Claude on the always-true rules
//   - Claude "unsure" on an always-true rule -> WARN + listed under "Needs a human decision"
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import { REPO_ROOT } from './config.js';
import { loadRubric, loadRules } from './rules.js';
import { aggregate } from './review.js';
import { STATUS_ORDER, worst } from './checks/util.js';

const MAX_SHOTS = 8;
const LABEL = { pass: 'PASS', info: 'PASS', warn: 'WARN', fail: 'FAIL' };
const LEVEL = { PASS: 'pass', WARN: 'warn', FAIL: 'fail' };
const COLOR = { PASS: 'green_bg', WARN: 'yellow_bg', FAIL: 'red_bg' };
const TEXT_COLOR = { pass: 'green', info: 'gray', warn: 'orange', fail: 'red', unsure: 'orange' };
const DISPLAY = { mazle: 'Mazle', 'rolly-bally': 'Rolly Bally' };

const readJson = (p) => { try { return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null; } catch { return null; } };

/** Escape free text for Notion-flavoured markdown (\ * ~ ` $ [ ] < > { } | ^). */
export function esc(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim().replace(/[\\*~`$[\]<>{}|^]/g, (c) => `\\${c}`);
}
const code = (s) => `\`${String(s).replace(/`/g, "'")}\``;
const cut = (s, n = 220) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const pct = (x) => (x === null || x === undefined ? '–' : `${Math.round(x * 100)}%`);
function secs(s) {
  if (s === null || s === undefined) return '–';
  if (s === 'Infinity' || s === Infinity) return 'never';
  const n = Number(s);
  if (!Number.isFinite(n)) return 'never';
  return n >= 60 ? `${Math.floor(n / 60)}m${String(Math.round(n % 60)).padStart(2, '0')}s` : `${n.toFixed(1)}s`;
}
const status = (s) => `<span color="${TEXT_COLOR[s] ?? 'gray'}">**${String(s).toUpperCase()}**</span>`;

/** Path of a result file relative to the run dir (screenshots are stored either way). */
function relToRun(runDir, p) {
  if (!p) return null;
  return isAbsolute(p) ? relative(runDir, p) : p;
}
const repoRel = (p) => { const r = relative(REPO_ROOT, p); return r.startsWith('..') ? p : r; };

// ---------------------------------------------------------------- gather

function gather(runDir) {
  return {
    smoke: readJson(join(runDir, 'smoke.json')),
    checks: readJson(join(runDir, 'checks.json')),
    play: readJson(join(runDir, 'play.json')),
    claude: readJson(join(runDir, 'claude.json')),
    compare: readJson(join(runDir, 'compare.json')),
    keyshots: readJson(join(runDir, 'keyshots', 'manifest.json')),
  };
}

/** Bot bugs and difficulty numbers from play.json. */
function playSummary(play, brackets) {
  if (!play) return null;
  const bugs = [];
  for (const r of play.solver ?? []) if (!r.ok) bugs.push(`solver ${r.layout ?? r.mode}${r.d ? ` d=${r.d}` : ''}: ${r.error ? cut(r.error.split('\n')[0], 160) : r.won ? `won with ${r.fails} fail(s)` : 'did not reach the goal'}`);
  for (const r of play.monkey ?? []) {
    if (r.ok) continue;
    const parts = [];
    if (r.violations?.length) parts.push(`${r.violations.length} invariant violation(s) (${r.violations.slice(0, 2).map((v) => v.kind).join(', ')})`);
    if (r.softLocks?.length) parts.push(`${r.softLocks.length} soft-lock(s)`);
    if (r.errors?.length) parts.push(`${r.errors.length} page error(s): ${cut(r.errors[0], 120)}`);
    if (r.error) parts.push(cut(r.error.split('\n')[0], 160));
    bugs.push(`monkey ${r.layout ?? r.mode} seed ${r.seed}: ${parts.join('; ') || 'failed'}${r.reproduce ? ` (reproduce: ${r.reproduce})` : ''}`);
  }
  for (const r of play.explorer ?? []) if (!r.ok) bugs.push(`explorer ${r.layout ?? r.mode}: ${r.error ? cut(r.error.split('\n')[0], 160) : `${r.unreachedFloorCount ?? '?'} floor area(s) never reached`}`);
  for (const e of play.errors ?? []) {
    const line = `${e.bot} ${e.layout ?? e.mode ?? ''}: ${cut(String(e.error).split('\n')[0], 160)}`;
    if (!bugs.some((b) => b.includes(line.slice(0, 40)))) bugs.push(line);
  }
  const kids = {};
  for (const b of brackets) {
    const k = play.kids?.[b];
    if (!k) continue;
    const groups = k.byGroup ?? k.byMode ?? {};
    kids[b] = Object.entries(groups).map(([name, v]) => ({ name, summary: v.summary, verdict: v.verdict }));
  }
  return { bugs, kids, passed: play.passed !== false && bugs.length === 0 };
}

/** One row per rule R01..R16: automatic and Claude results. */
function ruleRows(rules, checks, claude) {
  const autoFindings = (checks?.findings ?? []).filter((f) => f.rule && !f.bracket);
  return rules.map((r) => {
    const mine = autoFindings.filter((f) => f.rule === r.id);
    const autoStatus = r.check === 'claude' ? null : mine.length ? worst(mine.map((f) => f.status)) : checks ? 'pass' : null;
    const autoWorst = mine.filter((f) => f.status === autoStatus && autoStatus !== 'pass' && autoStatus !== 'info')[0] ?? null;
    const c = claude?.rules?.find((x) => x.rule === r.id) ?? null;
    let claudeStatus = c ? c.verdict : null;
    const decided = c?.humanDecision?.decision ?? null;
    let effectiveClaude = claudeStatus;
    if (decided) effectiveClaude = decided === 'ignore' ? 'pass' : decided;
    const eff = worst([
      autoStatus ?? 'pass',
      effectiveClaude === 'unsure' ? 'warn' : effectiveClaude ?? 'pass',
    ]);
    return {
      rule: r.id, number: r.number, title: r.title, how: r.check,
      auto: autoStatus, autoSummary: autoWorst?.summary ?? null, autoChecks: [...new Set(mine.map((f) => f.check))],
      claude: claudeStatus, claudeReason: c && c.verdict !== 'pass' ? c.reason : null, humanDecision: c?.humanDecision ?? null,
      needsHuman: !!c?.needsHuman, fingerprint: c?.finding?.fingerprint ?? null,
      screenshot: c?.screenshot ? join('keyshots', c.screenshot) : null,
      result: LABEL[eff],
    };
  });
}

/** Per-bracket cells: rubric checks (auto + Claude), kid persona difficulty, and the bracket result. */
function bracketTable(brackets, rubric, checks, claude, playSum) {
  const rows = [];
  for (const c of rubric.checks) {
    const cells = {};
    for (const b of brackets) {
      const autoF = (checks?.findings ?? []).filter((f) => f.rubricCheck === c.id && f.bracket === b);
      const auto = autoF.length ? worst(autoF.map((f) => f.status)) : null;
      const ai = claude?.bracketResults?.[b]?.checks?.find((x) => x.check === c.id) ?? null;
      const aiStatus = ai?.verdict ?? null;
      const parts = [];
      if (auto) parts.push({ src: 'auto', status: auto, note: autoF.find((f) => f.status === auto)?.summary });
      if (aiStatus) parts.push({ src: 'AI', status: aiStatus, note: aiStatus !== 'pass' ? ai.reason : null });
      cells[b] = parts;
    }
    if (Object.values(cells).some((p) => p.length)) rows.push({ id: c.id, title: c.title, how: c.how, cells });
  }
  const difficulty = {};
  for (const b of brackets) {
    const groups = playSum?.kids?.[b] ?? [];
    difficulty[b] = groups.map((g) => ({ name: g.name, verdict: g.verdict?.verdict ?? 'unknown', reasons: g.verdict?.reasons ?? [] }));
  }
  return { rows, difficulty };
}

// ---------------------------------------------------------------- result

function computeResult({ brackets, data, playSum, rules, steps }) {
  const reasons = [];
  const perBracket = Object.fromEntries(brackets.map((b) => [b, { level: 'pass', reasons: [] }]));
  const bump = (level, reason, b = null) => {
    for (const k of b ? [b] : brackets) {
      perBracket[k].level = worst([perBracket[k].level, level]);
      perBracket[k].reasons.push(`${level.toUpperCase()}: ${reason}`);
    }
    if (!b) reasons.push(`${level.toUpperCase()}: ${reason}`);
  };
  // Bugs
  if (data.smoke && !data.smoke.passed) {
    const n = data.smoke.results.reduce((s, r) => s + r.errors.length, 0);
    bump('fail', `smoke test found ${n} error(s)`);
  }
  if (playSum?.bugs.length) bump('fail', `bots found ${playSum.bugs.length} bug(s)`);
  // Automatic checks (always-true rules + rubric), strictest bracket
  if (data.checks) {
    const agg = aggregate(data.checks.findings, brackets);
    for (const b of brackets) {
      const s = agg.brackets[b];
      if (s.status !== 'PASS') bump(LEVEL[s.status], `automatic checks: ${s.counts.fail} fail, ${s.counts.warn} warn`, b);
    }
  }
  // Always-true rules
  for (const r of rules) {
    if (r.result === 'FAIL') bump('fail', `always-true rule ${r.rule} (${r.title}) broken${r.claude === 'fail' && !r.humanDecision ? ' per Claude (until a person clears it)' : ''}`);
    else if (r.claude === 'unsure' && !r.humanDecision) bump('warn', `Claude unsure about ${r.rule} (${r.title}): a person decides`);
  }
  // AI bracket verdicts: advisory, at most WARN
  for (const b of brackets) {
    const br = data.claude?.bracketResults?.[b];
    if (br && br.result !== 'pass') bump('warn', `Claude rubric (advisory): ${br.checks.filter((c) => c.verdict !== 'pass').length} check(s) not met`, b);
    for (const g of playSum?.kids?.[b] ?? []) {
      if (g.verdict?.verdict === 'too hard') bump('warn', `kid persona ${b} on ${g.name}: too hard (${g.verdict.reasons.join('; ')})`, b);
    }
  }
  for (const [name, st] of Object.entries(steps ?? {})) {
    if (st.status === 'error') bump('warn', `step ${name} errored: ${cut(st.error, 140)}`);
  }
  // The bracket with the worst result (ties: the first chosen one) decides the overall result.
  const strictest = brackets.reduce((a, b) => (STATUS_ORDER[perBracket[b].level] > STATUS_ORDER[perBracket[a].level] ? b : a), brackets[0]);
  const overall = LABEL[worst(brackets.map((b) => perBracket[b].level))];
  return { overall, strictestBracket: strictest, perBracket: Object.fromEntries(Object.entries(perBracket).map(([b, v]) => [b, { result: LABEL[v.level], reasons: v.reasons }])), reasons };
}

// ---------------------------------------------------------------- screenshots

/** ≤ MAX_SHOTS key screenshots, most important first: human-decision evidence, one per key screen, heatmap, auto-fail evidence. */
function pickScreenshots(runDir, data, rules, brackets) {
  const out = [];
  const add = (rel, caption, why) => {
    if (!rel || out.length >= MAX_SHOTS || out.some((s) => s.file === rel)) return;
    if (!existsSync(join(runDir, rel))) return;
    out.push({ file: rel, path: join(runDir, rel), caption, why });
  };
  for (const r of rules) if (r.needsHuman && r.screenshot) add(r.screenshot, `${r.rule} ${r.title}: Claude ${r.claude}`, 'needs a human decision');
  const shots = data.keyshots?.shots ?? [];
  for (const screen of ['menu', 'playing', 'failing', 'winning']) {
    const s = shots.find((x) => x.screen === screen);
    if (s) add(join('keyshots', s.file), `${screen}: ${s.description ?? s.label ?? ''}`.trim(), 'key screen');
  }
  for (const f of (data.checks?.findings ?? []).filter((x) => x.status === 'fail' && (!x.bracket || brackets.includes(x.bracket)))) {
    add(relToRun(runDir, f.evidence?.screenshot), `${f.rule ?? f.rubricCheck ?? f.check}${f.bracket ? ` (${f.bracket})` : ''}: ${cut(f.summary, 120)}`, 'automatic check fail');
  }
  const heat = data.play?.heatmaps ?? [];
  const kidsHeat = heat.find((h) => h.includes(`kids-${brackets[0]}`)) ?? heat[0];
  if (kidsHeat) add(kidsHeat, `heatmap: where the ${brackets[0]} kid persona spent time`, 'difficulty');
  for (const s of shots) add(join('keyshots', s.file), `${s.screen}: ${s.description ?? ''}`.trim(), 'key screen');
  return out;
}

// ---------------------------------------------------------------- markdown

function mdHumanDecisions(runDir, rules, checks, gameName) {
  const lines = ['## Needs a human decision {color="orange"}'];
  const claudePath = repoRel(join(runDir, 'claude.json'));
  const checksPath = repoRel(join(runDir, 'checks.json'));
  const todo = rules.filter((r) => r.needsHuman);
  const autoFails = (checks?.findings ?? []).filter((f) => f.rule && !f.bracket && f.status === 'fail');
  if (!todo.length && !autoFails.length) {
    lines.push('Nothing. No always-true rule is waiting for a person.');
    return lines;
  }
  for (const r of todo) {
    lines.push(`- [ ] **${r.rule} ${esc(r.title)}**: Claude says ${status(r.claude)}. ${esc(r.claudeReason)}`);
    lines.push(`\tFingerprint ${code(r.fingerprint)}${r.screenshot ? `, screenshot ${code(r.screenshot)}` : ''}. Decide with:`);
    lines.push(`\t${code(`node tools/playbot/bin/playbot.js decide ${gameName} ${claudePath} ${r.fingerprint} <pass|warn|fail|ignore> --note "why"`)}`);
  }
  for (const f of autoFails) {
    lines.push(`- [ ] **${f.rule} (automatic ${esc(f.check)})**: ${esc(cut(f.summary, 240))}`);
    lines.push(`\tFix it, or if it is a false positive: ${code(`node tools/playbot/bin/playbot.js decide ${gameName} ${checksPath} ${f.fingerprint} ignore --note "why"`)}`);
  }
  lines.push('A saved decision is reused by later runs (tools/playbot/judgments/), so the same question is not asked again.');
  return lines;
}

function mdSummary(result, brackets, rubric, data, steps, setup) {
  const L = [];
  L.push('## Summary');
  L.push(`<callout icon="${result.overall === 'PASS' ? '✅' : result.overall === 'WARN' ? '⚠️' : '⛔'}" color="${COLOR[result.overall]}">`);
  L.push(`\t**Overall: ${result.overall}** (strictest chosen bracket: ${esc(result.strictestBracket)}). Brackets: ${brackets.map((b) => `${esc(b)} ${rubric.brackets[b]?.label ?? ''} = **${result.perBracket[b].result}**`).join(', ')}.`);
  L.push('</callout>');
  for (const r of result.reasons.slice(0, 12)) L.push(`- ${esc(r)}`);
  for (const b of brackets) {
    const own = result.perBracket[b].reasons.filter((r) => !result.reasons.includes(r));
    if (own.length) L.push(`- **${esc(b)}**: ${esc(own.slice(0, 8).join('; '))}`);
  }
  L.push(`- Brackets chosen by: ${esc(setup.bracketsFrom)}. Tester profile: ${setup.profileFound ? 'found in the game\'s plan' : 'none (brackets asked at review time; comparables picked by Claude)'}.`);
  L.push('- Policy: the strictest chosen bracket sets the result; an always-true rule fail is a FAIL; AI verdicts are advisory (at most WARN) except on the always-true rules, where a Claude fail holds until a person clears it.');
  const stepLine = Object.entries(steps ?? {}).map(([k, v]) => `${k} ${v.status}${v.seconds !== undefined ? ` (${v.seconds}s)` : ''}`).join(', ');
  if (stepLine) L.push(`- Steps: ${esc(stepLine)}.`);
  if (data.smoke) {
    const errs = data.smoke.results.flatMap((r) => r.errors.map((e) => `${r.url.split('/').pop()}: ${e}`));
    L.push(`- Smoke test: ${data.smoke.passed ? 'passed' : `**failed**: ${esc(cut(errs.join('; '), 300))}`} (${data.smoke.results.length} URL(s), hook ${esc([...new Set(data.smoke.results.map((r) => r.hook))].join('/'))}).`);
  }
  if (data.claude) L.push(`- Claude judge: ${esc(data.claude.judge?.model ?? '')}, ${data.claude.seconds}s, $${data.claude.costUsd} (rules + rubric)${data.compare?.cost ? `; comparison $${data.compare.cost.costUsd}` : ''}.`);
  return L;
}

function mdRules(rules) {
  const L = ['## Always-true rules'];
  L.push('Checked on every review, whatever the bracket. **Auto** = automatic checks (no AI), **Claude** = judged on the key screenshots and all game text.');
  L.push('<table header-row="true" fit-page-width="true">');
  L.push('\t<tr><td>Rule</td><td>Auto</td><td>Claude</td><td>Result</td><td>Notes</td></tr>');
  for (const r of rules) {
    const notes = [];
    if (r.autoSummary) notes.push(`auto: ${cut(r.autoSummary, 160)}`);
    if (r.claudeReason) notes.push(`Claude: ${cut(r.claudeReason, 200)}`);
    if (r.humanDecision) notes.push(`person decided ${r.humanDecision.decision}${r.humanDecision.note ? `: ${r.humanDecision.note}` : ''}`);
    if (r.screenshot && r.claude !== 'pass') notes.push(`screenshot ${r.screenshot}`);
    const autoCell = r.auto ? status(r.auto) : '–';
    const claudeCell = r.claude ? status(r.claude) : '–';
    L.push(`\t<tr${r.result === 'FAIL' ? ' color="red_bg"' : r.result === 'WARN' ? ' color="yellow_bg"' : ''}><td>**${r.rule}** ${esc(r.title)}</td><td>${autoCell}</td><td>${claudeCell}</td><td>**${r.result}**</td><td>${esc(notes.join(' · ')) || '–'}</td></tr>`);
  }
  L.push('</table>');
  return L;
}

function mdBrackets(brackets, rubric, table, result) {
  const L = ['## Age brackets'];
  for (const b of brackets) L.push(`- **${esc(b)} ${esc(rubric.brackets[b]?.label ?? '')}**: ${esc(rubric.brackets[b]?.description ?? '')}`);
  L.push('Cells: automatic result / AI (advisory) result. Rubric numbers are starting points we tune after watching Gray play.');
  L.push('<table header-row="true" header-column="true" fit-page-width="true">');
  L.push(`\t<tr><td>Check</td>${brackets.map((b) => `<td>${esc(b)}</td>`).join('')}</tr>`);
  for (const row of table.rows) {
    const cells = brackets.map((b) => {
      const parts = row.cells[b] ?? [];
      if (!parts.length) return '<td>–</td>';
      const txt = parts.map((p) => `${p.src} ${status(p.status)}${p.note && p.status !== 'pass' && p.status !== 'info' ? ` ${esc(cut(p.note, 110))}` : ''}`).join('<br>');
      return `<td>${txt}</td>`;
    }).join('');
    L.push(`\t<tr><td>${esc(row.title)}</td>${cells}</tr>`);
  }
  if (brackets.some((b) => table.difficulty[b]?.length)) {
    const cells = brackets.map((b) => `<td>${(table.difficulty[b] ?? []).map((d) => `${esc(d.name)}: ${status(d.verdict === 'ok' ? 'pass' : d.verdict === 'too hard' ? 'warn' : 'info')} ${esc(d.verdict)}`).join('<br>') || '–'}</td>`).join('');
    L.push(`\t<tr><td>Kid persona difficulty</td>${cells}</tr>`);
  }
  L.push(`\t<tr><td>**Bracket result**</td>${brackets.map((b) => `<td>**${result.perBracket[b].result}**</td>`).join('')}</tr>`);
  L.push('</table>');
  return L;
}

function mdPlay(play, playSum, steps) {
  const L = ['## Stuck spots & difficulty'];
  if (!play) {
    L.push(`Bots **not run**${steps?.play?.note ? `: ${esc(steps.play.note)}` : ''}. No difficulty numbers for this review.`);
    return L;
  }
  if (playSum.bugs.length) {
    L.push('**Bugs found by the bots:**');
    for (const b of playSum.bugs) L.push(`- ${esc(b)}`);
  }
  for (const r of play.solver ?? []) {
    L.push(`- Solver ${esc(r.layout ?? r.mode)}${r.d ? ` d=${r.d}` : ''}: ${r.won ? `won in ${secs(r.timeToWin)}` : 'did not win'}${r.pathVsOptimal ? `, path ${r.pathVsOptimal}× optimal` : ''}${r.fails ? `, ${r.fails} fail(s)` : ''}.`);
  }
  const monkeys = play.monkey ?? [];
  if (monkeys.length) {
    const v = monkeys.reduce((s, r) => s + (r.violations?.length ?? 0), 0);
    const sl = monkeys.reduce((s, r) => s + (r.softLocks?.length ?? 0), 0);
    L.push(`- Monkey: ${monkeys.length} run(s), ${v} invariant violation(s), ${sl} soft-lock(s).`);
  }
  for (const r of play.explorer ?? []) {
    L.push(`- Explorer ${esc(r.layout ?? r.mode)}: coverage ${pct(r.coverage)}${r.unreachedFloorCount !== undefined ? `, ${r.unreachedFloorCount} floor block(s) never reached` : ''}, ${r.stuckSpots?.length ?? 0} stuck spot(s)${r.stuckSpots?.length ? ` (${esc(r.stuckSpots.slice(0, 4).map((s) => s.cell ?? `${s.x},${s.z}`).join('; '))})` : ''}.`);
  }
  const kidRows = Object.entries(playSum.kids);
  if (kidRows.length) {
    L.push('Kid personas (one per chosen bracket; slower reactions and shakier aim for younger brackets):');
    L.push('<table header-row="true" fit-page-width="true">');
    L.push('\t<tr><td>Bracket</td><td>Level</td><td>Win rate</td><td>Median time to win</td><td>Fails / run</td><td>Retry rate</td><td>Stuck / run</td><td>Top stuck spots</td><td>Verdict</td></tr>');
    for (const [b, groups] of kidRows) {
      for (const g of groups) {
        const s = g.summary ?? {};
        const spots = (s.stuckSpots ?? []).slice(0, 3).map((x) => `${x.cell} (${x.runs} runs, ${secs(x.seconds)})`).join('; ') || '–';
        L.push(`\t<tr><td>${esc(b)}</td><td>${esc(g.name)}</td><td>${pct(s.winRate)}</td><td>${secs(s.medianTimeToWin)}</td><td>${s.failsMean ?? '–'}</td><td>${pct(s.retryRate)}</td><td>${s.stuckEpisodesPerRun ?? '–'}</td><td>${esc(spots)}</td><td>${status(g.verdict?.verdict === 'ok' ? 'pass' : 'warn')} ${esc(g.verdict?.verdict ?? '?')}: ${esc((g.verdict?.reasons ?? []).join('; '))}</td></tr>`);
      }
    }
    L.push('</table>');
  } else {
    L.push('- Kid personas: not run.');
  }
  if (play.fps) L.push(`- Frame rate at real speed with the CPU 4× slower (tablet-like, software WebGL): ${play.fps.fps} fps, p95 frame ${play.fps.p95FrameMs} ms → ${esc(play.fps.verdict)}.`);
  if (play.heatmaps?.length) L.push(`- Heatmaps (local): ${play.heatmaps.map((h) => code(h)).join(', ')}.`);
  return L;
}

function mdCompare(compare, steps) {
  const L = ['## Comparison with popular kids\' games'];
  if (!compare) {
    L.push(`Not run${steps?.compare?.note ? `: ${esc(steps.compare.note)}` : ''}.`);
    return L;
  }
  const from = compare.comparablesMode === 'tester-profile' ? 'from the game\'s **Tester profile**' : '**picked by Claude for this run** (no Tester profile)';
  L.push(`Comparable games, ${from}:`);
  for (const c of compare.comparables ?? []) L.push(`- **${esc(c.title)}**: ${esc(c.compare)}${c.why ? ` (${esc(c.why)})` : ''} · profile source: ${esc(c.source)}`);
  if (compare.summary) L.push(esc(compare.summary));
  L.push('Ranked by how much it matters for the chosen brackets:');
  for (const it of compare.items ?? []) {
    L.push(`${it.rank}. **[${it.priority.toUpperCase()}] ${esc(it.area)}** (vs ${esc(it.compared_with.join(', '))}; ${esc(it.matters_for_brackets.join(', '))})`);
    L.push(`\t- They do: ${esc(it.they_do)}`);
    L.push(`\t- We do: ${esc(it.we_do)}`);
    L.push(`\t- Suggestion: ${esc(it.suggestion)}`);
  }
  const p = compare.patterns ?? {};
  if (p.present?.length) L.push(`- Kid-game patterns present: ${esc(p.present.map((x) => x.pattern).join('; '))}.`);
  if (p.missing?.length) L.push(`- Patterns missing: ${esc(p.missing.map((x) => x.pattern).join('; '))}.`);
  if (p.avoid_seen?.length) L.push(`- Patterns to avoid seen: ${esc(p.avoid_seen.map((x) => `${x.pattern} (${x.evidence})`).join('; '))}.`);
  return L;
}

function mdScreenshots(shots) {
  const L = ['## Key screenshots'];
  if (!shots.length) { L.push('None captured.'); return L; }
  L.push(`${shots.length} screenshot(s), attached below.`);
  for (const s of shots) {
    L.push(`[[screenshot: ${s.file}]]`);
    L.push(`${code(s.file)}: ${esc(s.caption)}`);
  }
  return L;
}

function mdLocal(runDir, steps, playSum) {
  const L = ['## Local files'];
  L.push('Videos and full outputs stay on the build machine; they are not uploaded.');
  L.push(`- Run directory: ${code(repoRel(runDir))}`);
  if (steps?.video?.path) L.push(`- Solver video: ${code(repoRel(steps.video.path))}`);
  else L.push(`- Video: not recorded${steps?.video?.note ? ` (${esc(steps.video.note)})` : ''}`);
  for (const f of ['smoke.json', 'checks.json', 'play.json', 'claude.json', 'compare.json', 'report.json', 'plan.md']) {
    if (existsSync(join(runDir, f))) L.push(`- ${code(f)}`);
  }
  return L;
}

// ---------------------------------------------------------------- main

/**
 * @param {object} o
 * @param {string} o.gameName
 * @param {string} o.runDir
 * @param {string[]} o.brackets
 * @param {object} o.setup   from resolveReviewSetup()
 * @param {object} [o.steps] { smoke: {status, seconds, note?, error?}, checks, play, video: {path}, 'judge-rules', compare }
 * @param {string} [o.date]  YYYY-MM-DD
 */
export function writeReport({ gameName, runDir, brackets, setup, steps = {}, planPage = null, date = new Date().toISOString().slice(0, 10) }) {
  const rubric = loadRubric();
  const { rules: ruleDefs } = loadRules();
  const data = gather(runDir);
  const playSum = playSummary(data.play, brackets);
  const rules = ruleRows(ruleDefs, data.checks, data.claude);
  const table = bracketTable(brackets, rubric, data.checks, data.claude, playSum);
  const result = computeResult({ brackets, data, playSum, rules, steps });
  const shots = pickScreenshots(runDir, data, rules, brackets);
  const display = DISPLAY[gameName] ?? gameName;
  const title = `Tester report — ${date} · ${display}`;

  const md = [
    `# ${title}`,
    ...mdHumanDecisions(runDir, rules, data.checks, gameName),
    ...mdSummary(result, brackets, rubric, data, steps, setup),
    ...mdRules(rules),
    ...mdBrackets(brackets, rubric, table, result),
    ...mdPlay(data.play, playSum, steps),
    ...mdCompare(data.compare, steps),
    ...mdScreenshots(shots),
    ...mdLocal(runDir, steps, playSum),
  ].join('\n');

  const json = {
    title,
    game: gameName,
    date,
    runDir,
    planPage,
    brackets,
    bracketsFrom: setup.bracketsFrom,
    testerProfile: setup.profileFound ? { source: setup.profileSource, genre: setup.genre, focus: setup.focus } : null,
    overall: result.overall,
    strictestBracket: result.strictestBracket,
    perBracket: result.perBracket,
    reasons: result.reasons,
    needsHuman: [
      ...rules.filter((r) => r.needsHuman).map((r) => ({
        kind: 'claude-rule', rule: r.rule, title: r.title, verdict: r.claude, reason: r.claudeReason, fingerprint: r.fingerprint,
        screenshot: r.screenshot, file: join(runDir, 'claude.json'),
        decide: `node tools/playbot/bin/playbot.js decide ${gameName} ${repoRel(join(runDir, 'claude.json'))} ${r.fingerprint} <pass|warn|fail|ignore> --note "why"`,
      })),
      ...(data.checks?.findings ?? []).filter((f) => f.rule && !f.bracket && f.status === 'fail').map((f) => ({
        kind: 'auto-rule', rule: f.rule, check: f.check, reason: f.summary, fingerprint: f.fingerprint, screenshot: f.evidence?.screenshot ?? null,
        file: join(runDir, 'checks.json'),
        decide: `node tools/playbot/bin/playbot.js decide ${gameName} ${repoRel(join(runDir, 'checks.json'))} ${f.fingerprint} ignore --note "why"`,
      })),
    ],
    rules,
    bugs: playSum?.bugs ?? [],
    comparables: data.compare ? { mode: data.compare.comparablesMode, titles: (data.compare.comparables ?? []).map((c) => c.title), note: data.compare.comparablesNote } : null,
    // For the /playtest skill: upload these, then replace each "[[screenshot: <file>]]" line in report.md.
    screenshots: shots,
    videos: steps.video?.path ? [{ path: steps.video.path, bot: 'solver', uploaded: false }] : [],
    steps,
    notion: {
      markdownFile: join(runDir, 'report.md'),
      note: 'Page title = `title`; page content = report.md without its first line (the "# title" heading). Replace each "[[screenshot: <file>]]" line with the uploaded image markdown.',
    },
  };
  writeFileSync(join(runDir, 'report.md'), `${md}\n`);
  writeFileSync(join(runDir, 'report.json'), JSON.stringify(json, null, 2));
  return { json, md, mdPath: join(runDir, 'report.md'), jsonPath: join(runDir, 'report.json') };
}
