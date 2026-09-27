// CLI commands for the Claude-judged parts (Phase 3 Claude checks, Phase 4 comparisons).
//   playbot judge-rules <game> --brackets 5-7 [--profile plan.md] [--run <dir>] [--full] [--model <id>] [--recapture]
//   playbot compare     <game> --brackets 5-7 [--profile plan.md] [--run <dir>] [--full] [--model <id>] [--refresh]
// Plus the usual game-serving flags when key screenshots must be captured: --build=false, --dist, --url.
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { OUT_DIR, getGame, timestamp } from './config.js';
import { captureKeyshots, loadKeyshots } from './keyshots.js';
import { formatClaudeChecks, runClaudeChecks } from './claudeChecks.js';
import { readTesterProfile, resolveReviewSetup } from './testerProfile.js';
import { buildGameProfile, getComparableProfiles } from './gameProfile.js';
import { formatCompare, runCompare, writeCompare } from './compare.js';
import { loadRubric, parseBrackets } from './rules.js';

function pickModel(config, flags) {
  if (flags.model && flags.model !== true) return String(flags.model);
  if (flags.full) return config.judge?.reviewModel ?? config.judge?.model;
  return config.judge?.model;
}

function setupFor(game, flags) {
  const rubric = loadRubric();
  let profile = null;
  if (flags.profile && flags.profile !== true) {
    profile = readTesterProfile(resolve(String(flags.profile)), { knownBrackets: rubric.bracketIds });
    console.error(`[profile] ${flags.profile}: ${profile.found ? `Tester profile found (brackets ${profile.brackets.join(', ') || 'none'}; ${profile.comparables.length} comparable games)` : 'no "Tester profile" section'}`);
    for (const w of profile.warnings) console.error(`[profile] warn: ${w}`);
  } else if (game.planPage) {
    console.error(`[profile] no --profile given. ${game.name}'s plan is ${game.planPage}: fetch it (Notion MCP), save the markdown and pass --profile <file.md> to use its Tester profile.`);
  }
  return resolveReviewSetup({ profile, bracketsFlag: flags.brackets, parseBrackets, rubric, gameName: game.name, planPage: game.planPage });
}

/** Run dir (--run or a new timestamped one) with key screenshots (reused if present). */
async function ensureRun(config, game, flags, { prepareGame }) {
  const runDir = flags.run && flags.run !== true ? resolve(String(flags.run)) : join(OUT_DIR, game.name, timestamp());
  mkdirSync(runDir, { recursive: true });
  let keyshots = flags.recapture ? null : loadKeyshots(runDir);
  if (keyshots) {
    console.error(`[keyshots] reusing ${keyshots.dir} (${keyshots.manifest.shots.length} screenshots)`);
  } else {
    const target = await prepareGame(config, game, flags);
    try {
      keyshots = await captureKeyshots({ game, baseUrl: target.baseUrl, runDir, config, headed: !!flags.headed });
    } finally {
      await target.close();
    }
    for (const w of keyshots.manifest.warnings) console.error(`[keyshots] warn: ${w}`);
  }
  return { runDir, keyshots };
}

export async function cmdJudgeRules(config, positional, flags, deps) {
  const [name] = positional;
  if (!name) throw new Error('usage: playbot judge-rules <game> --brackets 5-7 [--profile plan.md] [--run <dir>] [--full]');
  const game = getGame(config, name);
  const setup = setupFor(game, flags);
  console.error(`[judge-rules] ${game.name}: brackets ${setup.brackets.join(', ')} (from ${setup.bracketsFrom})`);
  const { runDir, keyshots } = await ensureRun(config, game, flags, deps);
  const res = await runClaudeChecks({
    game: game.name, runDir, brackets: setup.brackets, keyshots, config, model: pickModel(config, flags),
    provider: flags.provider, focus: setup.focus,
  });
  console.log(formatClaudeChecks(res));
  console.log(`\nWrote ${join(runDir, 'claude.json')}`);
  return res.result === 'FAIL' ? 1 : 0;
}

export async function cmdCompare(config, positional, flags, deps) {
  const [name] = positional;
  if (!name) throw new Error('usage: playbot compare <game> --brackets 5-7 [--profile plan.md] [--run <dir>] [--full]');
  const game = getGame(config, name);
  const setup = setupFor(game, flags);
  console.error(`[compare] ${game.name}: brackets ${setup.brackets.join(', ')} (from ${setup.bracketsFrom}); comparables: ${setup.comparables.mode}`);
  const started = Date.now();
  const { runDir, keyshots } = await ensureRun(config, game, flags, deps);
  const model = pickModel(config, flags);
  const common = { config, model, provider: flags.provider, refresh: !!flags.refresh };
  const ourProfile = await buildGameProfile({ game: game.name, runDir, keyshots, setup, ...common });
  const comparables = await getComparableProfiles({
    mode: setup.comparables.mode, list: setup.comparables.list, game: game.name, ourProfile, setup, ...common,
  });
  if (comparables.picks.length < 2) console.error(`[compare] warn: only ${comparables.picks.length} comparable game profile(s)`);
  const res = await runCompare({ game: game.name, runDir, setup, ourProfile, comparables, ...common });
  res.ourProfile = { path: join(resolve(OUT_DIR, '..'), 'profiles', `${game.name}.json`), source: ourProfile.source, cached: ourProfile.cached, profile: ourProfile.profile };
  const cost = (ourProfile.cached ? 0 : ourProfile.judge.costUsd) + comparables.costUsd + (res.judge.costUsd ?? 0);
  res.cost = { seconds: Math.round((Date.now() - started) / 1000), costUsd: Math.round(cost * 1000) / 1000 };
  writeCompare(runDir, res);
  console.log(formatCompare(res));
  console.log(`\nWrote ${join(runDir, 'compare.json')}`);
  return 0;
}

export const CLAUDE_COMMANDS = { 'judge-rules': cmdJudgeRules, compare: cmdCompare };
