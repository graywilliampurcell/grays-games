#!/usr/bin/env node
// playbot CLI. Usage:
//   playbot smoke <game> [--build=false] [--dist <dir>] [--url <baseUrl>] [--timeout <ms>] [--headed] [--out <dir>]
//   playbot judge-test <png...> [--provider claude-code|anthropic-api] [--model <id>]
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { OUT_DIR, getGame, loadConfig, timestamp } from '../lib/config.js';
import { buildDir, buildGame } from '../lib/build.js';
import { startServer } from '../lib/server.js';
import { runSmoke } from '../lib/smoke.js';
import { judge } from '../lib/judge.js';

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

const COMMANDS = { smoke: cmdSmoke, 'judge-test': cmdJudgeTest };

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
