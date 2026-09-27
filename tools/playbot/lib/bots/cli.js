// CLI commands for the bots (wired into bin/playbot.js):
//   playbot play <game> [--bots solver,monkey,explorer,kids,fps] [--brackets 5-7] [--seeds 5] [--seed N]
//                       [--layout level1|iteration1] [--browsers 8] [--per-browser 2] (+ smoke flags: --build=false, --url, --dist, --out)
//   playbot calibrate mazle [--brackets 5-7] [--seeds 20] [--iter1 5] (+ same flags)
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import os from 'node:os';
import { OUT_DIR, getGame, timestamp } from '../config.js';
import { playMazle, playRolly, printPlay, calibrateMazle, printCalibrate, writeJson } from './play.js';
import { parseBrackets } from './personas.js';

const ALL_BOTS = ['solver', 'monkey', 'explorer', 'kids', 'fps'];

function poolOpts(flags) {
  const cores = os.cpus().length;
  return {
    browsers: Number(flags.browsers ?? Math.max(1, Math.min(8, Math.floor(cores / 4)))),
    perBrowser: Number(flags['per-browser'] ?? 2),
  };
}

async function cmdPlay(config, positional, flags, { prepareGame }) {
  const [name] = positional;
  if (!name) throw new Error('usage: playbot play <game> [--bots solver,monkey,explorer,kids,fps] [--brackets 5-7] [--seeds 5] [--layout level1|iteration1]');
  const game = getGame(config, name);
  const bots = flags.bots ? String(flags.bots).split(',').map((s) => s.trim()) : ALL_BOTS;
  for (const b of bots) if (!ALL_BOTS.includes(b)) throw new Error(`unknown bot "${b}" (known: ${ALL_BOTS.join(', ')})`);
  const brackets = parseBrackets(flags.brackets);
  const seeds = Number(flags.seeds ?? 5);
  const outDir = flags.out ? resolve(String(flags.out)) : join(OUT_DIR, game.name, timestamp());
  const target = await prepareGame(config, game, flags);
  const started = Date.now();
  let result;
  try {
    const opts = { config, baseUrl: target.baseUrl, outDir, bots, brackets, seeds, seed: flags.seed, pool: poolOpts(flags) };
    mkdirSync(outDir, { recursive: true }); // heatmaps are written as runs finish
    if (game.name === 'mazle') result = await playMazle({ ...opts, layoutSpec: flags.layout ?? 'level1' });
    else if (game.name === 'rolly-bally') result = await playRolly(opts);
    else throw new Error(`no bots for game ${game.name}`);
  } finally {
    await target.close();
  }
  result = { ...result, options: { bots, brackets, seeds, seed: flags.seed ?? null, layout: flags.layout ?? null }, wallSeconds: Math.round((Date.now() - started) / 100) / 10 };
  const file = writeJson(outDir, 'play.json', result);
  console.log(printPlay(result));
  console.log(`${result.passed ? 'PASSED' : 'FAILED'}: ${file} (${result.heatmaps.length} heatmaps, ${result.wallSeconds}s)`);
  return result.passed ? 0 : 1;
}

async function cmdCalibrate(config, positional, flags, { prepareGame }) {
  const [name = 'mazle'] = positional;
  if (name !== 'mazle') throw new Error('calibrate only knows mazle (Iteration 1 vs Iteration 2)');
  const game = getGame(config, name);
  const brackets = parseBrackets(flags.brackets);
  const outDir = flags.out ? resolve(String(flags.out)) : join(OUT_DIR, game.name, `${timestamp()}-calibrate`);
  mkdirSync(outDir, { recursive: true });
  const target = await prepareGame(config, game, flags);
  let cal;
  try {
    cal = await calibrateMazle({
      config, baseUrl: target.baseUrl, outDir, brackets,
      kidSeeds: Number(flags.seeds ?? 20), iter1Count: Number(flags.iter1 ?? 5), pool: poolOpts(flags),
    });
  } finally {
    await target.close();
  }
  const file = writeJson(outDir, 'calibrate.json', cal);
  console.log(printCalibrate(cal));
  console.log(`\n${file} (${cal.heatmaps.length} heatmaps, ${cal.wallSeconds}s)`);
  return cal.errors.length ? 1 : 0;
}

export const PLAY_COMMANDS = { play: cmdPlay, calibrate: cmdCalibrate };
