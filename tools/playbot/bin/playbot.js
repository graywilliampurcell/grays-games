#!/usr/bin/env node
// playbot CLI. Usage:
//   playbot smoke <game> [--build=false] [--dist <dir>] [--url <baseUrl>] [--timeout <ms>] [--headed] [--out <dir>]
//   playbot judge-test <png...> [--provider claude-code|anthropic-api] [--model <id>]
//   playbot checks <game> [--brackets 5-7,8-10] [--only network,links-out,...] [--ci] [--idle <s>] [--play <s>] (+ smoke flags)
//   playbot decide <game> <checks.json> <fingerprint> <pass|warn|fail|ignore> [--note "..."]
//   playbot judge-rules <game> --brackets 5-7 [--profile plan.md] [--run <dir>] [--full]
//   playbot play <game> [--bots solver,monkey,explorer,kids,fps] [--brackets 5-7] [--seeds 5] [--layout level1|iteration1]
//   playbot calibrate mazle [--brackets 5-7] [--seeds 20] [--iter1 5]
//   playbot compare <game> --brackets 5-7 [--profile plan.md] [--run <dir>] [--full] [--refresh]
//   playbot review <game> --brackets 5-7[,8-10] [--profile plan.md] [--full] [--seeds N] [--ai=false] [--video=false]
//   playbot ci <game> [--dist <dir>] [--hook-optional] [--monkey-seconds 20]
//   playbot reports-parent <game> [--set <notion url>]
//   playbot report <game> --run <review dir>   (re-render report.md/report.json)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { OUT_DIR, getGame, loadConfig, timestamp } from '../lib/config.js';
import { buildDir, buildGame } from '../lib/build.js';
import { startServer } from '../lib/server.js';
import { runSmoke } from '../lib/smoke.js';
import { judge } from '../lib/judge.js';
import { ALL_CHECKS, CI_CHECKS, runChecks } from '../lib/checks/index.js';
import { loadRubric, parseBrackets } from '../lib/rules.js';
import { aggregate, formatTable } from '../lib/review.js';
import { saveJudgment } from '../lib/judgments.js';
import { CLAUDE_COMMANDS } from '../lib/claudeCommands.js';
import { PLAY_COMMANDS } from '../lib/bots/cli.js';
import { REVIEW_COMMANDS } from '../lib/reviewCommands.js';

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { positional.push(a); continue; }
    const [k, v] = a.slice(2).split(/=(.*)/s);
    if (v !== undefined) flags[k] = v;
    else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) flags[k] = argv[++i];
    else flags[k] = true;
  }
  return { positional, flags };
}

const truthy = (v) => !(v === false || v === 'false' || v === '0' || v === 'no');

/** Resolve the base URL for a game: --url, or serve --dist / a (fresh or cached) build. */
export async function prepareGame(config, game, flags) {
  if (flags.url) {
    const base = String(flags.url).endsWith('/') ? String(flags.url) : `${flags.url}/`;
    return { baseUrl: base, close: async () => {} };
  }
  let dir;
  if (flags.dist) dir = resolve(String(flags.dist));
  else if (truthy(flags.build ?? true)) dir = await buildGame(game, { verbose: !!flags.verbose });
  else {
    dir = buildDir(game.name);
    if (!existsSync(join(dir, 'index.html'))) throw new Error(`No cached build at ${dir}; run without --build=false`);
    console.error(`[build] ${game.name}: using cached build ${dir}`);
  }
  const server = await startServer({ [game.name]: dir }, config.server);
  return { baseUrl: server.urlFor(game.name), close: server.close };
}

async function cmdSmoke(config, positional, flags) {
  const [name] = positional;
  if (!name) throw new Error('usage: playbot smoke <game>');
  const game = getGame(config, name);
  if (flags.timeout) config.smoke = { ...config.smoke, readyTimeoutMs: Number(flags.timeout) };
  const outDir = flags.out ? resolve(String(flags.out)) : join(OUT_DIR, game.name, timestamp());
  const target = await prepareGame(config, game, flags);
  let summary;
  try {
    summary = await runSmoke({ game, baseUrl: target.baseUrl, outDir, config, headed: !!flags.headed });
  } finally {
    await target.close();
  }
  for (const r of summary.results) {
    const status = r.errors.length ? 'FAIL' : 'PASS';
    console.log(`${status} ${r.url}  hook=${r.hook} load=${r.loadMs}ms ready=${r.readyMs}ms` +
      (r.steppedFrames ? ` stepped=${r.steppedFrames} (${r.stepMs}ms)` : ''));
    for (const w of r.warnings) console.log(`  warn: ${w}`);
    for (const e of r.errors) console.log(`  error: ${e}`);
  }
  console.log(`${summary.passed ? 'PASSED' : 'FAILED'}: ${join(outDir, 'smoke.json')}`);
  return summary.passed ? 0 : 1;
}

async function cmdJudgeTest(config, positional, flags) {
  if (!positional.length) throw new Error('usage: playbot judge-test <png...>');
  const schema = {
    type: 'object',
    required: ['describes', 'is_game_screen', 'visible_text'],
    properties: {
      describes: { type: 'string' },
      is_game_screen: { type: 'boolean' },
      visible_text: { type: 'array', items: { type: 'string' } },
    },
  };
  const started = Date.now();
  const res = await judge({
    prompt: 'You are checking screenshots from a kids video game test run. Describe what the screenshot shows in one or two sentences, say whether it looks like a working game screen (not blank, not an error page), and list any text visible on screen.',
    images: positional,
    schema,
    provider: flags.provider,
    model: flags.model,
    config,
  });
  const { usage, ...rest } = res;
  console.log(JSON.stringify({ ...rest, outputTokens: usage?.output_tokens, seconds: (Date.now() - started) / 1000 }, null, 2));
  return 0;
}

async function cmdChecks(config, positional, flags) {
  const [name] = positional;
  if (!name) throw new Error('usage: playbot checks <game> [--brackets 5-7,8-10] [--only a,b] [--ci]');
  const game = getGame(config, name);
  const rubric = loadRubric();
  const brackets = parseBrackets(flags.brackets ?? game.brackets?.join(','), rubric);
  let only = null;
  if (flags.ci) only = CI_CHECKS;
  if (flags.only && flags.only !== true) only = String(flags.only).split(',').map((s) => s.trim()).filter(Boolean);
  const unknown = (only ?? []).filter((c) => !ALL_CHECKS.includes(c));
  if (unknown.length) throw new Error(`Unknown check(s) ${unknown.join(', ')}. Known: ${ALL_CHECKS.join(', ')}`);
  const outDir = flags.out ? resolve(String(flags.out)) : join(OUT_DIR, game.name, timestamp());
  const target = await prepareGame(config, game, flags);
  const startedAt = new Date().toISOString();
  let res;
  try {
    res = await runChecks({
      game, baseUrl: target.baseUrl, outDir, config, brackets, rubric, only, headed: !!flags.headed,
      ...(flags.idle ? { idleSeconds: Number(flags.idle) } : {}), ...(flags.play ? { playSeconds: Number(flags.play) } : {}),
    });
  } finally {
    await target.close();
  }
  const summary = aggregate(res.findings, brackets);
  const report = {
    game: game.name, baseUrl: target.baseUrl, brackets, only: only ?? ALL_CHECKS, startedAt, finishedAt: new Date().toISOString(),
    summary, targets: res.targets, judgmentsApplied: res.judged, findings: res.findings,
  };
  writeFileSync(join(outDir, 'checks.json'), JSON.stringify(report, null, 2));
  console.log(formatTable(res.findings, brackets));
  console.log('');
  console.log(`brackets: ${brackets.map((b) => `${b}=${summary.brackets[b].status}`).join('  ')}`);
  console.log(`${summary.overall}: ${summary.counts.fail} fail, ${summary.counts.warn} warn, ${summary.counts.info} info, ${summary.counts.pass} pass` +
    `${res.judged ? ` (${res.judged} saved human decision(s) applied)` : ''} -> ${join(outDir, 'checks.json')}`);
  return summary.overall === 'FAIL' ? 1 : 0;
}

async function cmdDecide(config, positional, flags) {
  const [name, file, fingerprint, decision] = positional;
  if (!decision) throw new Error('usage: playbot decide <game> <checks.json> <fingerprint> <pass|warn|fail|ignore> [--note "..."]');
  const report = JSON.parse(readFileSync(resolve(file), 'utf8'));
  const f = report.findings.find((x) => x.fingerprint === fingerprint);
  if (!f) throw new Error(`No finding with fingerprint ${fingerprint} in ${file}`);
  const p = saveJudgment(getGame(config, name).name, f, { decision, note: flags.note === true ? '' : (flags.note ?? ''), decidedBy: flags.by ?? 'JP' });
  console.log(`saved ${p}`);
  return 0;
}

const COMMANDS = { smoke: cmdSmoke, 'judge-test': cmdJudgeTest, checks: cmdChecks, decide: cmdDecide };
// Claude-judged commands (judge-rules, compare): they get prepareGame to capture key screenshots.
for (const [k, fn] of Object.entries(CLAUDE_COMMANDS)) COMMANDS[k] = (c, p, f) => fn(c, p, f, { prepareGame });
for (const [k, fn] of Object.entries(PLAY_COMMANDS)) COMMANDS[k] = (c, p, f) => fn(c, p, f, { prepareGame });
// Phase 5: review (everything + report.md), ci (no-AI deploy gate), reports-parent (Notion target).
for (const [k, fn] of Object.entries(REVIEW_COMMANDS)) COMMANDS[k] = (c, p, f) => fn(c, p, f, { prepareGame });

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const fn = COMMANDS[cmd];
  if (!fn) {
    console.error(`usage: playbot <${Object.keys(COMMANDS).join('|')}> ...`);
    return 2;
  }
  const { positional, flags } = parseArgs(rest);
  return fn(loadConfig(), positional, flags);
}

main().then((code) => process.exit(code), (err) => {
  console.error(err.stack ?? String(err));
  process.exit(1);
});
