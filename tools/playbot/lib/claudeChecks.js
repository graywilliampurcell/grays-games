// Claude checks (Phase 3): the always-true rules (rules.yaml claude_prompt) and the rubric's
// V-checks per chosen bracket, judged on the key screenshots + all game text.
//
// Policy (plan "Judge model" + rules.yaml header):
//   - a Claude "fail" on an always-true rule fails the review until a person clears it (needsHuman)
//   - "unsure" goes to the needsHuman list
//   - everything else (bracket V-checks) is advisory
//   - every non-pass carries one of the given screenshot filenames
//   - past human decisions (judgments/) go into the prompt as examples, and a saved decision for the
//     same game + rule + screenshot clears the question so it is not asked again.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, join, resolve } from 'node:path';
import { PLAYBOT_DIR } from './config.js';
import { judge } from './judge.js';
import { loadRubric, loadRules } from './rules.js';

export const JUDGMENTS_DIR = resolve(PLAYBOT_DIR, 'judgments');
const RULE_VERDICTS = ['pass', 'fail', 'unsure'];
const CHECK_VERDICTS = ['pass', 'warn', 'fail'];
const RANK = { pass: 0, warn: 1, unsure: 1, fail: 2 };

// ------------------------------------------------------------------ past human decisions

/**
 * Past human decisions, normalised to { game, rule, check, bracket, screenshot, question, decision, reason, by, date }.
 * Uses lib/judgments.js (loadJudgments / listJudgments / readJudgments) when it exists, else reads the JSON
 * files in judgments/ directly (an object, an array, or { judgments: [...] } per file).
 */
export async function loadPastJudgments({ game } = {}) {
  let raw = null;
  if (existsSync(resolve(PLAYBOT_DIR, 'lib', 'judgments.js'))) {
    try {
      const mod = await import('./judgments.js');
      const fn = mod.loadJudgments ?? mod.listJudgments ?? mod.readJudgments ?? mod.allJudgments;
      if (typeof fn === 'function') {
        const got = await fn(game ? { game } : undefined);
        raw = Array.isArray(got) ? got : got?.judgments ?? got?.list ?? null;
      }
    } catch { raw = null; }
  }
  if (!raw) {
    raw = [];
    if (existsSync(JUDGMENTS_DIR)) {
      for (const f of readdirSync(JUDGMENTS_DIR).filter((n) => n.endsWith('.json'))) {
        try {
          const j = JSON.parse(readFileSync(join(JUDGMENTS_DIR, f), 'utf8'));
          const list = Array.isArray(j) ? j : Array.isArray(j.judgments) ? j.judgments : [j];
          for (const e of list) raw.push({ ...e, _file: f });
        } catch { /* skip unreadable */ }
      }
    }
  }
  return raw.map(normaliseJudgment).filter((j) => j.decision && (!game || !j.game || j.game === game));
}

function normaliseJudgment(e) {
  const pick = (...ks) => { for (const k of ks) if (e?.[k] !== undefined && e[k] !== null && e[k] !== '') return e[k]; return undefined; };
  const shot = pick('screenshot', 'image') ?? e?.finding?.evidence?.screenshot ?? e?.evidence?.screenshot;
  return {
    id: pick('fingerprint', 'id'),
    game: pick('game'),
    rule: pick('rule', 'ruleId', 'rule_id'),
    check: pick('rubricCheck', 'check', 'checkId', 'check_id'),
    bracket: pick('bracket'),
    screenshot: typeof shot === 'string' ? basename(shot) : undefined,
    question: pick('question', 'claudeReason', 'claude_reason', 'summary') ?? e?.finding?.summary,
    claudeVerdict: pick('claudeVerdict', 'claude_verdict', 'verdictBefore'),
    decision: String(pick('decision', 'verdict', 'human', 'humanVerdict', 'outcome') ?? '').toLowerCase() || undefined,
    reason: pick('reason', 'note', 'notes', 'comment'),
    by: pick('by', 'decidedBy', 'decided_by', 'who'),
    date: pick('date', 'decidedAt', 'decided_at', 'at'),
  };
}

function judgmentExamples(judgments, max = 25) {
  if (!judgments.length) return 'None saved yet.';
  return judgments.slice(-max).map((j) => {
    const what = [j.rule, j.check, j.bracket && `bracket ${j.bracket}`].filter(Boolean).join(' / ');
    return `- ${j.id ? `id ${j.id} ` : ''}[${j.game ?? 'any game'}] ${what}${j.screenshot ? ` (screenshot ${j.screenshot})` : ''}: ` +
      `${j.question ? `question "${j.question}" → ` : ''}person decided **${j.decision}**` +
      `${j.reason ? `: ${j.reason}` : ''}${j.by ? ` (${j.by}${j.date ? `, ${j.date}` : ''})` : ''}`;
  }).join('\n');
}

// Findings in the lib/checks/util.js shape (fingerprint = stable hash) + saved-decision lookup via lib/judgments.js.
let utilMod;
async function checksUtil() {
  if (utilMod === undefined) {
    utilMod = existsSync(resolve(PLAYBOT_DIR, 'lib', 'checks', 'util.js')) ? await import('./checks/util.js').catch(() => null) : null;
  }
  return utilMod;
}
let findingFn = null;
function makeFinding(o) {
  if (findingFn) return findingFn(o);
  const f = { check: o.check, status: o.status, summary: o.summary };
  if (o.rule) f.rule = o.rule;
  if (o.rubricCheck) f.rubricCheck = o.rubricCheck;
  if (o.bracket) f.bracket = o.bracket;
  f.evidence = { ...(o.screenshot ? { screenshot: o.screenshot } : {}), details: o.details ?? {} };
  f.fingerprint = createHash('sha1').update([o.check, o.rule ?? '', o.rubricCheck ?? '', o.bracket ?? '', o.key ?? o.summary].join('|')).digest('hex').slice(0, 12);
  return f;
}
let judgmentsMod;
async function savedDecision(game, finding) {
  if (judgmentsMod === undefined) {
    judgmentsMod = existsSync(resolve(PLAYBOT_DIR, 'lib', 'judgments.js')) ? await import('./judgments.js').catch(() => null) : null;
  }
  const j = judgmentsMod?.getJudgment?.(game, finding);
  if (!j?.decision) return null;
  return { decision: String(j.decision).toLowerCase(), note: j.note, decidedBy: j.decidedBy, decidedAt: j.decidedAt };
}

// ------------------------------------------------------------------ evidence

function shotList(manifest) {
  return manifest.shots.map((s) => `- ${s.file} [${s.screen}] ${s.description}${s.text?.length ? `\n  on-screen text: ${JSON.stringify(s.text).slice(0, 400)}` : ''}`).join('\n');
}

export function gameTextBlock(text, { maxSource = 250 } = {}) {
  const lines = [];
  lines.push(`UI text seen while playing (hook text()): ${JSON.stringify(text.hookText ?? [])}`);
  lines.push(`Messages shown to the player (message events): ${JSON.stringify(text.messages ?? [])}`);
  const dom = (text.domText ?? []).filter((l) => !(text.hookText ?? []).includes(l));
  if (dom.length) lines.push(`Other page text (DOM innerText): ${JSON.stringify(dom)}`);
  const src = (text.sourceStrings ?? []).slice(0, maxSource);
  if (src.length) {
    lines.push('String literals from the game source (may include text not seen in this run, and some developer-only strings):');
    lines.push(src.map((s) => `  ${s.file}: ${JSON.stringify(s.text)}`).join('\n'));
  }
  if (text.audio) {
    const a = text.audio;
    lines.push(`Sound (from the source; you cannot hear it): audio files ${a.audioFiles?.length ?? 0}` +
      `${a.voiceFiles?.length ? ` (voice-like: ${a.voiceFiles.join(', ')})` : ''}; speechSynthesis ${a.speechSynthesis ? 'used' : 'not used'};` +
      ` WebAudio ${a.webAudio ? 'used' : 'not used'}; <audio>/new Audio ${a.htmlAudio ? 'used' : 'not used'}.`);
  }
  return lines.join('\n');
}

function autoChecksSummary(runDir) {
  const p = join(runDir, 'checks.json');
  if (!existsSync(p)) return null;
  try {
    const j = JSON.parse(readFileSync(p, 'utf8'));
    return JSON.stringify(j, (k, v) => (typeof v === 'string' && v.length > 300 ? `${v.slice(0, 300)}…` : v)).slice(0, 6000);
  } catch { return null; }
}

// ------------------------------------------------------------------ prompts + schemas

const CONTEXT = (game, brackets) => `You are the content and age-appropriateness judge for "${game}", a small web game a parent is building for his young kid(s). ` +
  `The chosen age brackets for this review are: ${brackets.join(', ')} (youngest = strictest).` +
  ' Nothing dies or gets hurt in these games: describe failing as bumping, falling or resetting (e.g. "the spike message"), never as death.';

function rulesPrompt({ game, brackets, rules, manifest, text, judgments, autoChecks }) {
  const ruleText = rules.map((r) => [
    `### ${r.id} — ${r.title}`,
    `Rule: ${String(r.text).trim()}`,
    `Question: ${String(r.claude_prompt).trim()}`,
    r.examples_ok?.length ? `OK examples: ${r.examples_ok.join(' | ')}` : '',
    r.examples_fail?.length ? `FAIL examples: ${r.examples_fail.join(' | ')}` : '',
  ].filter(Boolean).join('\n')).join('\n\n');
  return `${CONTEXT(game, brackets)}

Check the ALWAYS-TRUE content rules below. They apply to every age bracket. Breaking any of them fails the review.

How to judge:
- Judge only what the evidence (screenshots + game text) actually shows. Do not fail a rule for something you merely imagine could exist.
- "pass" = nothing in the evidence breaks the rule. "fail" = the evidence clearly breaks it. "unsure" = something could plausibly break it and a person should look.
- The rule's OK examples are decisions the owner already made; follow them. In particular: a hazard that sends the player back to the start with a short kind exclamation ("Ouch!", "Oops!") and nothing shown getting hurt is OK (Mazle's floor spike and its "Ouch! A spike sent you back to the start." message were explicitly approved by the owner, JP, on 2026-09-27). Static floor spikes are a hazard, not a weapon. A red message box is UI colour, not blood.
- Developer-only strings in the source (error messages, class names, debug labels) are not shown to kids; only judge player-facing text.
- Sound cannot be heard; use the sound notes and say "unsure" only if something points at a problem.
- For every "fail" or "unsure", "screenshot" MUST be exactly one of the screenshot filenames listed below (the one that best shows the problem, or best shows the screen where the missing thing should be). For "pass" it may be null or a filename.
- "reason": one or two plain sentences; quote text when relevant; name the missing control for rule R16.
- "matches_decision": if a non-pass verdict is the SAME situation a person already decided (same rule, same thing in the game), give that decision's id from the list below and use the verdict it implies; otherwise null.

Past decisions made by a person (follow them for the same situation):
${judgmentExamples(judgments)}

Screenshots (read every one):
${shotList(manifest)}

All game text:
${gameTextBlock(text)}
${autoChecks ? `\nAutomatic check results for this run (evidence; they do not replace your judgment):\n${autoChecks}\n` : ''}
Rules:

${ruleText}

Return one entry per rule (${rules.map((r) => r.id).join(', ')}), in that order.`;
}

function rubricPrompt({ game, brackets, checks, rubric, manifest, text, judgments, focus }) {
  const lines = checks.map((c) => {
    const per = brackets.map((b) => `  - ${b} (${rubric.brackets[b]?.label ?? ''}): threshold ${JSON.stringify(c.thresholds?.[b] ?? {})}; if missed: ${c.severity?.[b] ?? 'warn'}`).join('\n');
    return `### ${c.id} — ${c.title}\n${per}`;
  }).join('\n\n');
  const bracketDesc = brackets.map((b) => `- ${b}: ${String(rubric.brackets[b]?.description ?? '').trim()}`).join('\n');
  return `${CONTEXT(game, brackets)}

Judge the per-bracket rubric checks below from the key screenshots and game text. These are advisory (they help the developer), so be concrete and useful.

Brackets:
${bracketDesc}
${focus ? `\nGame focus / allowed on purpose (from its Tester profile): ${focus}\n` : ''}
How to judge each (check, bracket) pair:
- "pass" = meets the threshold for that bracket; "warn" = borderline or can't be confirmed from the evidence and matters; "fail" = clearly misses it.
- reading: count words in each instruction/message the child must understand; say which text is too long. Mazle-style controls help text counts as an instruction.
- spoken-instructions: the sound notes tell you whether any voice/speech exists (you cannot hear audio).
- time-pressure: visible timers, countdowns, racing opponents.
- failing: what happens on failing (see the failing screenshots): soft reset vs. "lose", and how quickly play resumes.
- things-on-screen: count distinct things competing for attention (HUD boxes, buttons, text panels, moving objects).
- scariness: darkness, menace, threatening things, for that bracket.
- contrast: text/background contrast (estimate against 4.5:1) and whether anything important is shown by colour alone.
- For "warn" or "fail", "screenshot" MUST be exactly one of the filenames below (the one that shows it). For "pass" it may be null or a filename.

Past decisions made by a person:
${judgmentExamples(judgments)}

Screenshots (read every one):
${shotList(manifest)}

All game text:
${gameTextBlock(text, { maxSource: 120 })}

Checks:

${lines}

Return one entry for every (check, bracket) pair: ${checks.length} checks × ${brackets.length} bracket(s) = ${checks.length * brackets.length} entries.`;
}

const rulesSchema = (ids) => ({
  type: 'object',
  required: ['rules'],
  properties: {
    rules: {
      type: 'array',
      items: {
        type: 'object',
        required: ['rule', 'verdict', 'reason', 'screenshot'],
        properties: {
          rule: { type: 'string', enum: ids },
          verdict: { type: 'string', enum: RULE_VERDICTS },
          reason: { type: 'string' },
          screenshot: { type: ['string', 'null'] },
          matches_decision: { type: ['string', 'null'] },
        },
      },
    },
  },
});

const rubricSchema = (checkIds, brackets) => ({
  type: 'object',
  required: ['checks'],
  properties: {
    checks: {
      type: 'array',
      items: {
        type: 'object',
        required: ['check', 'bracket', 'verdict', 'reason', 'screenshot'],
        properties: {
          check: { type: 'string', enum: checkIds },
          bracket: { type: 'string', enum: brackets },
          verdict: { type: 'string', enum: CHECK_VERDICTS },
          reason: { type: 'string' },
          screenshot: { type: ['string', 'null'] },
        },
      },
    },
  },
});

/** judge() plus our own completeness checks; retries once with the problems listed. */
async function judgeComplete({ prompt, images, schema, problemsOf, judgeOpts, label, log }) {
  let extra = '';
  let total = { costUsd: 0, seconds: 0, attempts: 0 };
  for (let attempt = 1; attempt <= 2; attempt++) {
    const t0 = Date.now();
    const res = await judge({ prompt: prompt + extra, images, schema, ...judgeOpts });
    total.costUsd += res.costUsd ?? 0;
    total.seconds += (Date.now() - t0) / 1000;
    total.attempts += res.attempts;
    const problems = problemsOf(res.value);
    log(`[claude-checks] ${label}: attempt ${attempt} ${problems.length ? `problems: ${problems.join('; ')}` : 'ok'} (${((Date.now() - t0) / 1000).toFixed(0)}s, $${(res.costUsd ?? 0).toFixed(3)})`);
    if (!problems.length || attempt === 2) return { ...res, ...total, problems };
    extra = `\n\nIMPORTANT: a previous answer had these problems, fix them: ${problems.join('; ')}`;
  }
  throw new Error('unreachable');
}

// ------------------------------------------------------------------ main

/**
 * @param {object} o
 * @param {string} o.game        game name
 * @param {string} o.runDir      run directory (has keyshots/)
 * @param {string[]} o.brackets  chosen brackets
 * @param {object} o.keyshots    { dir, manifest, text } from keyshots.js
 * @param {object} o.config
 * @param {string} [o.model]
 * @param {string} [o.focus]     Tester profile "Focus"
 */
export async function runClaudeChecks({ game, runDir, brackets, keyshots, config, model, provider, focus, log = console.error }) {
  const started = Date.now();
  findingFn = (await checksUtil())?.finding ?? null;
  const { rules: allRules } = loadRules();
  const rules = allRules.filter((r) => r.claude_prompt && ['claude', 'both'].includes(r.check));
  const rubric = loadRubric();
  const vChecks = rubric.checks.filter((c) => (c.how ?? []).includes('V'));
  const judgments = await loadPastJudgments({ game });
  const { manifest, text, dir } = keyshots;
  const files = manifest.shots.map((s) => s.file);
  const images = files.map((f) => join(dir, f));
  const judgeOpts = { config, model, provider };
  const autoChecks = autoChecksSummary(runDir);
  // Screen category (menu/playing/failing/winning) of a screenshot: stable across runs, unlike the exact file.
  const screenOf = (file) => manifest.shots.find((x) => x.file === file)?.screen ?? 'none';

  const ruleIds = rules.map((r) => r.id);
  const rulesProblems = (v) => {
    const out = [];
    const got = new Map(v.rules.map((r) => [r.rule, r]));
    const missing = ruleIds.filter((id) => !got.has(id));
    if (missing.length) out.push(`missing rules ${missing.join(', ')}`);
    for (const r of v.rules) {
      if (r.verdict !== 'pass' && !files.includes(r.screenshot)) out.push(`${r.rule} is "${r.verdict}" but screenshot "${r.screenshot}" is not one of ${files.join(', ')}`);
    }
    return out;
  };
  const checkIds = vChecks.map((c) => c.id);
  const rubricProblems = (v) => {
    const out = [];
    const got = new Set(v.checks.map((c) => `${c.check}@${c.bracket}`));
    const missing = checkIds.flatMap((c) => brackets.map((b) => `${c}@${b}`)).filter((k) => !got.has(k));
    if (missing.length) out.push(`missing pairs ${missing.join(', ')}`);
    for (const c of v.checks) {
      if (c.verdict !== 'pass' && !files.includes(c.screenshot)) out.push(`${c.check}@${c.bracket} is "${c.verdict}" but screenshot "${c.screenshot}" is not one of the filenames`);
    }
    return out;
  };

  const [rulesRes, rubricRes] = await Promise.all([
    judgeComplete({
      label: 'always-true rules',
      prompt: rulesPrompt({ game, brackets, rules, manifest, text, judgments, autoChecks }),
      images, schema: rulesSchema(ruleIds), problemsOf: rulesProblems, judgeOpts, log,
    }),
    judgeComplete({
      label: 'bracket rubric',
      prompt: rubricPrompt({ game, brackets, checks: vChecks, rubric, manifest, text, judgments, focus }),
      images, schema: rubricSchema(checkIds, brackets), problemsOf: rubricProblems, judgeOpts, log,
    }),
  ]);

  // --- always-true rules
  const byRule = new Map(rulesRes.value.rules.map((r) => [r.rule, r]));
  const ruleResults = await Promise.all(rules.map(async (rule) => {
    const r = byRule.get(rule.id) ?? { verdict: 'unsure', reason: 'Claude gave no verdict for this rule.', screenshot: null };
    const screenshot = files.includes(r.screenshot) ? r.screenshot : null;
    const out = {
      rule: rule.id, number: rule.number, title: rule.title, verdict: r.verdict, reason: r.reason,
      screenshot, screenshotPath: screenshot ? join(dir, screenshot) : null,
    };
    if (r.verdict !== 'pass') {
      // Same question = same rule on the same screenshot (screen) → a saved decision answers it.
      out.finding = makeFinding({
        check: 'claude-rules', rule: rule.id, status: r.verdict === 'fail' ? 'fail' : 'warn',
        summary: `Claude ${r.verdict}: ${r.reason}`, screenshot: screenshot ? join(dir, screenshot) : undefined,
        details: { verdict: r.verdict, title: rule.title }, key: `${rule.id}@${screenOf(screenshot)}`,
      });
      // Exact match on the finding's fingerprint, else the past decision Claude says is the same situation.
      let saved = await savedDecision(game, out.finding);
      const same = !saved && r.matches_decision ? judgments.find((j) => j.id === r.matches_decision && (!j.rule || j.rule === rule.id)) : null;
      if (same) saved = { decision: same.decision, note: same.reason, decidedBy: same.by, decidedAt: same.date, matchedBy: 'claude', id: same.id };
      if (saved) out.humanDecision = saved;
      out.needsHuman = !saved;
      if (!screenshot) out.missingScreenshot = true;
    }
    return out;
  }));
  const decided = (r) => r.humanDecision?.decision;
  const ruleFails = ruleResults.filter((r) => (r.verdict === 'fail' && !decided(r)) || decided(r) === 'fail');
  const ruleUnsure = ruleResults.filter((r) => r.verdict === 'unsure' && !decided(r));

  // --- bracket V-checks (advisory); cap Claude's "fail" at the rubric severity for that bracket
  const bracketResults = {};
  for (const b of brackets) {
    const items = await Promise.all(checkIds.map(async (id) => {
      const c = rubricRes.value.checks.find((x) => x.check === id && x.bracket === b) ?? { verdict: 'warn', reason: 'No verdict from Claude.', screenshot: null };
      const severity = rubric.severity(id, b);
      let verdict = c.verdict;
      if (verdict === 'fail' && severity === 'warn') verdict = 'warn';
      const screenshot = files.includes(c.screenshot) ? c.screenshot : null;
      const item = {
        check: id, title: rubric.byId[id].title, verdict, claudeVerdict: c.verdict, severity,
        reason: c.reason, screenshot, screenshotPath: screenshot ? join(dir, screenshot) : null,
        threshold: rubric.threshold(id, b),
      };
      if (verdict !== 'pass') {
        item.finding = makeFinding({
          check: 'claude-rubric', rubricCheck: id, bracket: b, status: verdict, summary: `Claude ${c.verdict}: ${c.reason}`,
          screenshot: screenshot ? join(dir, screenshot) : undefined, details: { severity }, key: `${id}@${b}@${screenOf(screenshot)}`,
        });
        const saved = await savedDecision(game, item.finding);
        if (saved) {
          item.humanDecision = saved;
          item.verdict = saved.decision === 'ignore' ? 'pass' : saved.decision;
        }
      }
      return item;
    }));
    const worst = items.reduce((w, i) => (RANK[i.verdict] > RANK[w] ? i.verdict : w), 'pass');
    bracketResults[b] = { label: rubric.brackets[b]?.label, result: worst, checks: items };
  }
  // Strictest chosen bracket decides the advisory result.
  const strictest = brackets.reduce((best, b) => (RANK[bracketResults[b].result] > RANK[bracketResults[best].result] ? b : best), brackets[0]);

  const needsHuman = [
    ...ruleResults.filter((r) => r.needsHuman).map((r) => ({
      kind: 'rule', rule: r.rule, title: r.title, verdict: r.verdict, reason: r.reason, screenshot: r.screenshot,
      ask: r.verdict === 'fail'
        ? `Claude says ${r.rule} (${r.title}) is broken. The review fails until a person clears it.`
        : `Claude is unsure about ${r.rule} (${r.title}). Is this OK?`,
    })),
  ];

  const result = {
    game,
    runDir,
    createdAt: new Date().toISOString(),
    brackets,
    judge: { provider: rulesRes.provider, model: rulesRes.model },
    seconds: Math.round((Date.now() - started) / 1000),
    costUsd: round3(rulesRes.costUsd + rubricRes.costUsd),
    calls: [
      { name: 'always-true rules', seconds: Math.round(rulesRes.seconds), costUsd: round3(rulesRes.costUsd), attempts: rulesRes.attempts, problems: rulesRes.problems },
      { name: 'bracket rubric', seconds: Math.round(rubricRes.seconds), costUsd: round3(rubricRes.costUsd), attempts: rubricRes.attempts, problems: rubricRes.problems },
    ],
    screenshots: manifest.shots.map((s) => ({ file: s.file, screen: s.screen, description: s.description, path: join(dir, s.file) })),
    pastJudgmentsUsed: judgments.length,
    // Review-level outcome of the Claude checks.
    result: ruleFails.length ? 'FAIL' : ruleUnsure.length ? 'NEEDS_HUMAN' : 'PASS',
    resultNote: ruleFails.length
      ? `Always-true rule(s) ${ruleFails.map((r) => r.rule).join(', ')} flagged by Claude: the review FAILS until a person clears it.`
      : ruleUnsure.length ? `Claude is unsure about ${ruleUnsure.map((r) => r.rule).join(', ')}: a person decides.`
        : `No always-true rule flagged by Claude${ruleResults.some((r) => r.humanDecision) ? ` (already decided by a person: ${ruleResults.filter((r) => r.humanDecision).map((r) => `${r.rule} → ${r.humanDecision.decision}`).join(', ')})` : ''}.`,
    needsHuman,
    // Same shape as checks.json findings (lib/checks/util.js), so `playbot decide <game> claude.json <fingerprint> <decision>` works.
    findings: [
      ...ruleResults.filter((r) => r.finding).map((r) => r.finding),
      ...Object.values(bracketResults).flatMap((br) => br.checks.filter((c) => c.finding).map((c) => c.finding)),
    ],
    rules: ruleResults,
    bracketResults,
    advisory: {
      result: bracketResults[strictest].result,
      strictestBracket: strictest,
      note: 'Bracket checks are advisory (AI verdicts); the strictest chosen bracket sets this result.',
    },
  };
  writeFileSync(join(runDir, 'claude.json'), JSON.stringify(result, null, 2));
  return result;
}

const round3 = (n) => Math.round((n ?? 0) * 1000) / 1000;

/** Plain-text tables for the terminal. */
export function formatClaudeChecks(res) {
  const out = [];
  out.push(`Claude checks for ${res.game} (${res.brackets.join(', ')}) — ${res.judge.model}, ${res.seconds}s, $${res.costUsd}`);
  out.push(`RESULT: ${res.result} — ${res.resultNote}`);
  out.push('');
  out.push('Always-true rules:');
  for (const r of res.rules) {
    const tag = r.humanDecision ? ` [person: ${r.humanDecision.decision}]` : r.needsHuman ? ' [NEEDS HUMAN]' : '';
    out.push(`  ${r.rule} ${r.verdict.toUpperCase().padEnd(6)} ${r.title}${tag}${r.screenshot && r.verdict !== 'pass' ? `  <${r.screenshot}>` : ''}`);
    if (r.verdict !== 'pass') out.push(`         ${r.reason}`);
  }
  for (const [b, br] of Object.entries(res.bracketResults)) {
    out.push('');
    out.push(`Bracket ${b} (${br.label}) — advisory result: ${br.result.toUpperCase()}`);
    for (const c of br.checks) {
      out.push(`  ${c.verdict.toUpperCase().padEnd(4)} ${c.title}${c.claudeVerdict !== c.verdict ? ` (Claude: ${c.claudeVerdict}, capped at rubric severity)` : ''}${c.screenshot && c.verdict !== 'pass' ? `  <${c.screenshot}>` : ''}`);
      out.push(`       ${c.reason}`);
    }
  }
  if (res.needsHuman.length) {
    out.push('');
    out.push('Needs a person:');
    for (const n of res.needsHuman) out.push(`  - ${n.ask} <${n.screenshot ?? 'no screenshot'}>`);
  }
  return out.join('\n');
}
