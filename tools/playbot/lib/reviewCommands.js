// Phase 5 commands (wired into bin/playbot.js):
//
//   playbot review <game> --brackets 5-7[,8-10] [--profile plan.md] [--full] [--seeds N] [--bots a,b]
//                  [--ai=false] [--video=false] [--run <dir>] (+ --build=false, --dist, --url)
//     One run dir out/<game>/<ts>-review/ with smoke, checks (all), play (bots + kid personas),
//     a solver video, judge-rules, compare, then report.json + report.md (for the /playtest skill).
//
//   playbot ci <game> [--dist <dir>] [--hook-optional] [--monkey-seconds 20] [--out <dir>]
//     The no-AI deploy gate: smoke + solver + short monkey + checks --ci. Exit 1 on any failure.
//     Never calls Claude and never needs network beyond the local static server.
//
//   playbot reports-parent <game> [--set <notion url>]
//     Where the /playtest skill puts the Notion report: the game's planPage, else the shared
//     "Game tester reports" page (config reports.fallbackParent); --set records that page's URL.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import os from 'node:os';
import { OUT_DIR, PLAYBOT_DIR, getGame, timestamp } from './config.js';
import { runSmoke } from './smoke.js';
import { DEFAULT_ARGS } from './browser.js';
import { ALL_CHECKS, CI_CHECKS, runChecks } from './checks/index.js';
import { loadRubric, parseBrackets } from './rules.js';
import { aggregate, formatTable } from './review.js';
import { readTesterProfile, resolveReviewSetup } from './testerProfile.js';
import { writeReport } from './report.js';

const truthy = (v) => !(v === false || v === 'false' || v === '0' || v === 'no');
const secsSince = (t) => Math.round((Date.now() - t) / 1000);
const firstLine = (e) => String(e?.message ?? e).split('\n')[0];

/** Serve the game once; hand sub-commands a prepareGame that reuses it. */
function sharedTarget(target) {
  return { prepareGame: async () => ({ baseUrl: target.baseUrl, close: async () => {} }) };
}

async function step(steps, name, fn, { retries = 0 } = {}) {
  const t0 = Date.now();
  console.error(`\n[review] === ${name} ===`);
  for (let attempt = 0; ; attempt++) {
    try {
      const extra = (await fn()) ?? {};
      steps[name] = { status: 'ok', seconds: secsSince(t0), ...(attempt ? { attempts: attempt + 1 } : {}), ...extra };
      break;
    } catch (err) {
      console.error(`[review] ${name} error: ${err.stack ?? err}`);
      steps[name] = { status: 'error', seconds: secsSince(t0), error: firstLine(err), attempts: attempt + 1 };
      if (attempt >= retries) break;
      console.error(`[review] ${name}: retrying`);
    }
  }
  return steps[name];
}

/** Checks run + checks.json, same shape as `playbot checks`. */
async function checksStep({ game, baseUrl, runDir, config, brackets, rubric, only }) {
  const startedAt = new Date().toISOString();
  const res = await runChecks({ game, baseUrl, outDir: runDir, config, brackets, rubric, only });
  const summary = aggregate(res.findings, brackets);
  writeFileSync(join(runDir, 'checks.json'), JSON.stringify({
    game: game.name, baseUrl, brackets, only: only ?? ALL_CHECKS, startedAt, finishedAt: new Date().toISOString(),
    summary, targets: res.targets, judgmentsApplied: res.judged, findings: res.findings,
  }, null, 2));
  console.log(formatTable(res.findings, brackets));
  return { findings: res.findings, summary };
}

// ---------------------------------------------------------------- review

export async function cmdReview(config, positional, flags, { prepareGame }) {
  const [name] = positional;
  if (!name) throw new Error('usage: playbot review <game> --brackets 5-7[,8-10] [--profile plan.md] [--full]');
  const game = getGame(config, name);
  const rubric = loadRubric();
  let profile = null;
  if (flags.profile && flags.profile !== true) profile = readTesterProfile(resolve(String(flags.profile)), { knownBrackets: rubric.bracketIds });
  const setup = resolveReviewSetup({ profile, bracketsFlag: flags.brackets, parseBrackets, rubric, gameName: game.name, planPage: game.planPage });
  const brackets = setup.brackets;
  const runDir = flags.run && flags.run !== true ? resolve(String(flags.run)) : join(OUT_DIR, game.name, `${timestamp()}-review`);
  mkdirSync(runDir, { recursive: true });
  if (profile) copyFileSync(resolve(String(flags.profile)), join(runDir, 'plan.md'));
  const ai = truthy(flags.ai ?? true);
  console.error(`[review] ${game.name}: brackets ${brackets.join(', ')} (from ${setup.bracketsFrom}); ` +
    `Tester profile: ${setup.profileFound ? 'yes' : 'no'}; run dir ${runDir}`);

  const steps = {};
  const target = await prepareGame(config, game, flags);
  const shared = sharedTarget(target);
  // Flags for the sub-commands: same run dir, served game, chosen brackets.
  const sub = { ...flags, run: runDir, out: runDir, brackets: brackets.join(',') };
  delete sub.url; delete sub.dist;
  try {
    await step(steps, 'smoke', async () => {
      const s = await runSmoke({ game, baseUrl: target.baseUrl, outDir: runDir, config });
      return { passed: s.passed, note: s.passed ? undefined : `${s.results.reduce((n, r) => n + r.errors.length, 0)} error(s)` };
    });

    await step(steps, 'checks', async () => {
      const { summary } = await checksStep({ game, baseUrl: target.baseUrl, runDir, config, brackets, rubric, only: null });
      return { overall: summary.overall };
    });

    // Bots: lib/bots is Phase 2; load it guarded so a missing/broken bots module marks the step "not run".
    let cli = null;
    try { cli = await import('./bots/cli.js'); } catch (err) { steps.play = { status: 'not run', note: `bots not available: ${firstLine(err)}` }; }
    if (cli?.PLAY_COMMANDS?.play) {
      const seeds = flags.seeds ?? (flags.full ? 5 : 3);
      const playFlags = { ...sub, seeds: String(seeds), ...(flags.bots ? { bots: flags.bots } : {}) };
      delete playFlags.run;
      await step(steps, 'play', async () => {
        const code = await cli.PLAY_COMMANDS.play(config, [game.name], playFlags, shared);
        return { passed: code === 0, seeds: Number(seeds) };
      });
    } else if (!steps.play) {
      steps.play = { status: 'not run', note: 'lib/bots/cli.js has no play command yet' };
    }

    if (truthy(flags.video ?? true)) {
      await step(steps, 'video', async () => {
        const { recordSolverVideo } = await import('./video.js');
        const v = await recordSolverVideo({ game, baseUrl: target.baseUrl, runDir, config });
        return { path: v.path, won: v.won, local: true };
      });
    } else {
      steps.video = { status: 'not run', note: '--video=false' };
    }

    if (ai) {
      const { CLAUDE_COMMANDS } = await import('./claudeCommands.js');
      const claudeFlags = { ...sub };
      delete claudeFlags.out;
      await step(steps, 'judge-rules', async () => {
        await CLAUDE_COMMANDS['judge-rules'](config, [game.name], claudeFlags, shared);
      }, { retries: 1 });
      await step(steps, 'compare', async () => {
        await CLAUDE_COMMANDS.compare(config, [game.name], claudeFlags, shared);
      }, { retries: 1 }); // claude -p occasionally times out; profiles are cached, so a retry is cheap
    } else {
      steps['judge-rules'] = { status: 'not run', note: '--ai=false' };
      steps.compare = { status: 'not run', note: '--ai=false' };
    }
  } finally {
    await target.close();
  }

  const rep = writeReport({ gameName: game.name, runDir, brackets, setup, steps, planPage: game.planPage ?? null });
  console.log(`\n${rep.json.title}: ${rep.json.overall} (strictest bracket ${rep.json.strictestBracket})`);
  for (const r of rep.json.reasons) console.log(`  ${r}`);
  if (rep.json.needsHuman.length) {
    console.log('Needs a human decision:');
    for (const n of rep.json.needsHuman) console.log(`  - ${n.rule} ${n.verdict ?? n.check}: ${n.decide}`);
  }
  console.log(`Screenshots to attach (${rep.json.screenshots.length}): ${rep.json.screenshots.map((s) => s.file).join(', ')}`);
  console.log(`Wrote ${rep.mdPath}\nWrote ${rep.jsonPath}`);
  return 0;
}

// ---------------------------------------------------------------- ci (no AI)

function ghAnnotate(kind, msg) {
  if (process.env.GITHUB_ACTIONS) console.log(`::${kind} title=playbot::${msg.replace(/\r?\n/g, ' ')}`);
}

/** Solver + short monkey through the Phase 2 bots, with small budgets for CI. */
async function ciBots(game, baseUrl, config, { monkeySeconds }) {
  const { runPool } = await import('./bots/session.js');
  const tasks = [];
  if (game.name === 'mazle') {
    const { mazleSolver, mazleMonkey } = await import('./bots/mazle.js');
    tasks.push(['solver level-1', ({ browser }) => mazleSolver({ browser, baseUrl, capS: 120 })]);
    tasks.push(['monkey level-1', ({ browser }) => mazleMonkey({ browser, baseUrl, seed: 1, seconds: monkeySeconds })]);
  } else if (game.name === 'rolly-bally') {
    const { rollySolver, rollyMonkey } = await import('./bots/rolly.js');
    tasks.push(['solver test-track', ({ browser }) => rollySolver({ browser, baseUrl, mode: 'test-track', capS: 240 })]);
    tasks.push(['monkey test-track', ({ browser }) => rollyMonkey({ browser, baseUrl, mode: 'test-track', seed: 1, seconds: monkeySeconds })]);
    tasks.push(['monkey race', ({ browser }) => rollyMonkey({ browser, baseUrl, mode: 'race', seed: 1, seconds: monkeySeconds })]);
  } else {
    throw new Error(`no CI bots for ${game.name}`);
  }
  const results = await runPool(tasks.map(([, fn]) => fn), { config, browsers: Math.min(2, os.cpus().length), perBrowser: 2 });
  return results.map((r, i) => {
    const problems = [];
    if (r.error) problems.push(firstLine(r.error));
    if (r.bot === 'solver' && !r.won) problems.push('solver did not reach the goal');
    for (const v of (r.violations ?? []).slice(0, 3)) problems.push(`invariant ${v.kind} at ${v.t}s`);
    for (const s of (r.softLocks ?? []).slice(0, 3)) problems.push(`soft-lock at ${s.t ?? '?'}s`);
    for (const e of (r.errors ?? []).slice(0, 3)) problems.push(e);
    return { name: tasks[i][0], ok: !!r.ok && problems.length === 0, problems, result: r };
  });
}

export async function cmdCi(config, positional, flags, { prepareGame }) {
  const [name] = positional;
  if (!name) throw new Error('usage: playbot ci <game> [--dist <dir>] [--hook-optional] [--monkey-seconds 20]');
  const game = getGame(config, name);
  const rubric = loadRubric();
  const brackets = [...rubric.bracketIds];
  const runDir = flags.out && flags.out !== true ? resolve(String(flags.out)) : join(OUT_DIR, game.name, `${timestamp()}-ci`);
  mkdirSync(runDir, { recursive: true });
  const hookOptional = !!flags['hook-optional'];
  const monkeySeconds = Number(flags['monkey-seconds'] ?? 20);
  const started = Date.now();
  const failures = [];
  const notices = [];
  const out = { game: game.name, runDir, startedAt: new Date().toISOString(), steps: {} };
  // Hermetic by default: Chromium resolves only the local server, so the gate never reaches the
  // internet. Requests to other hosts are still seen (and fail the network check / smoke).
  if (truthy(flags.offline ?? true)) {
    config.browser = { ...config.browser, args: [...(config.browser?.args ?? DEFAULT_ARGS), '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost'] };
  }

  const target = await prepareGame(config, game, flags);
  out.baseUrl = target.baseUrl;
  try {
    // 1. smoke
    const smoke = await runSmoke({ game, baseUrl: target.baseUrl, outDir: runDir, config });
    const hooks = [...new Set(smoke.results.map((r) => r.hook))];
    const hookReady = smoke.results.every((r) => r.hook === 'ready');
    out.steps.smoke = { passed: smoke.passed, hooks };
    for (const r of smoke.results) for (const e of r.errors) failures.push(`smoke ${r.url}: ${e}`);
    if (!hookReady) {
      const msg = `${game.name}: window.__game hook ${hooks.join('/')} in this build; solver and monkey skipped (smoke + no-AI red-flag checks only).`;
      if (hookOptional) { notices.push(msg); ghAnnotate('notice', msg); } else failures.push(`hook required but ${hooks.join('/')}`);
    }

    // 2. bots (solver + short monkey) only with the hook
    if (hookReady) {
      try {
        const bots = await ciBots(game, target.baseUrl, config, { monkeySeconds });
        out.steps.bots = bots.map(({ name: n, ok, problems }) => ({ name: n, ok, problems }));
        writeFileSync(join(runDir, 'ci-bots.json'), JSON.stringify(bots, null, 2));
        for (const b of bots) if (!b.ok) failures.push(`bot ${b.name}: ${b.problems.join('; ') || 'failed'}`);
      } catch (err) {
        failures.push(`bots could not run: ${firstLine(err)}`);
        out.steps.bots = { error: firstLine(err) };
      }
    } else {
      out.steps.bots = { skipped: true };
    }

    // 3. red-flag checks (network, links out, input fields, permissions, word scan)
    const { findings, summary } = await checksStep({ game, baseUrl: target.baseUrl, runDir, config, brackets, rubric, only: CI_CHECKS });
    out.steps.checks = { overall: summary.overall, counts: summary.counts };
    for (const f of findings.filter((x) => x.status === 'fail')) failures.push(`${f.check}${f.rule ? ` ${f.rule}` : ''}: ${f.summary}`);
  } finally {
    await target.close();
  }

  out.finishedAt = new Date().toISOString();
  out.seconds = secsSince(started);
  out.notices = notices;
  out.failures = failures;
  out.passed = failures.length === 0;
  writeFileSync(join(runDir, 'ci.json'), JSON.stringify(out, null, 2));

  console.log(`\nplaybot ci ${game.name}: ${out.passed ? 'PASSED' : 'FAILED'} in ${out.seconds}s -> ${join(runDir, 'ci.json')}`);
  console.log(`  smoke: ${out.steps.smoke.passed ? 'pass' : 'FAIL'} (hook ${out.steps.smoke.hooks.join('/')})`);
  if (Array.isArray(out.steps.bots)) for (const b of out.steps.bots) console.log(`  ${b.ok ? 'pass' : 'FAIL'} ${b.name}${b.problems.length ? `: ${b.problems.join('; ')}` : ''}`);
  else console.log(`  bots: ${out.steps.bots.skipped ? 'skipped (no hook)' : `error ${out.steps.bots.error}`}`);
  console.log(`  checks --ci: ${out.steps.checks.overall} (${out.steps.checks.counts.fail} fail, ${out.steps.checks.counts.warn} warn)`);
  for (const n of notices) console.log(`  notice: ${n}`);
  for (const f of failures) {
    console.log(`  FAIL ${f}`);
    ghAnnotate('error', `${game.name}: ${f}`);
  }
  return out.passed ? 0 : 1;
}

// ---------------------------------------------------------------- reports-parent

export async function cmdReportsParent(config, positional, flags) {
  const [name] = positional;
  if (!name) throw new Error('usage: playbot reports-parent <game> [--set <notion url>]');
  const game = getGame(config, name);
  const cfgPath = join(PLAYBOT_DIR, 'playbot.config.json');
  if (flags.set && flags.set !== true) {
    // Edit the file as stored (not the env-overridden config), keeping its formatting.
    const url = String(flags.set);
    if (!/^https:\/\/(app\.notion\.com|www\.notion\.so|notion\.so)\//.test(url)) throw new Error(`not a Notion URL: ${url}`);
    const text = readFileSync(cfgPath, 'utf8');
    const re = /("fallbackParent"\s*:\s*\{[^}]*?"url"\s*:\s*)(null|"[^"]*")/;
    if (!re.test(text)) throw new Error(`no reports.fallbackParent.url in ${cfgPath}`);
    writeFileSync(cfgPath, text.replace(re, `$1${JSON.stringify(url)}`));
    console.log(JSON.stringify({ recorded: JSON.parse(readFileSync(cfgPath, 'utf8')).reports.fallbackParent }, null, 2));
    return 0;
  }
  const fb = config.reports?.fallbackParent ?? {};
  let res;
  if (game.planPage) res = { game: game.name, parent: 'plan', url: game.planPage, create: false };
  else if (fb.url) res = { game: game.name, parent: 'fallback', title: fb.title, url: fb.url, create: false };
  else res = { game: game.name, parent: 'fallback', title: fb.title ?? 'Game tester reports', url: null, create: true, under: fb.under ?? null, underUrl: fb.underUrl ?? null };
  console.log(JSON.stringify(res, null, 2));
  return 0;
}

// ---------------------------------------------------------------- report (re-render)

/** Re-write report.md/report.json from an existing run dir (e.g. after re-running compare or recording decisions). */
export async function cmdReport(config, positional, flags) {
  const [name] = positional;
  if (!name || !flags.run || flags.run === true) throw new Error('usage: playbot report <game> --run <run dir> [--brackets 5-7]');
  const game = getGame(config, name);
  const runDir = resolve(String(flags.run));
  const prev = existsSync(join(runDir, 'report.json')) ? JSON.parse(readFileSync(join(runDir, 'report.json'), 'utf8')) : {};
  const rubric = loadRubric();
  const planMd = join(runDir, 'plan.md');
  const profile = existsSync(planMd) ? readTesterProfile(planMd, { knownBrackets: rubric.bracketIds }) : null;
  const setup = resolveReviewSetup({ profile, bracketsFlag: flags.brackets ?? prev.brackets?.join(','), parseBrackets, rubric, gameName: game.name, planPage: game.planPage });
  if (prev.bracketsFrom && !flags.brackets) setup.bracketsFrom = prev.bracketsFrom;
  const steps = { ...(prev.steps ?? {}) };
  // A step that errored before but whose output now exists (re-run by hand) counts as done.
  for (const [k, f] of [['judge-rules', 'claude.json'], ['compare', 'compare.json'], ['play', 'play.json'], ['checks', 'checks.json'], ['smoke', 'smoke.json']]) {
    if (steps[k]?.status !== 'ok' && existsSync(join(runDir, f))) steps[k] = { status: 'ok', note: `${f} added after the review run` };
  }
  const rep = writeReport({ gameName: game.name, runDir, brackets: setup.brackets, setup, steps, planPage: game.planPage ?? null, date: prev.date });
  console.log(`${rep.json.title}: ${rep.json.overall}\nWrote ${rep.mdPath}\nWrote ${rep.jsonPath}`);
  return 0;
}

export const REVIEW_COMMANDS = { review: cmdReview, ci: cmdCi, 'reports-parent': cmdReportsParent, report: cmdReport };
