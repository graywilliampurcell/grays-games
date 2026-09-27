// Loads playbot.config.json and applies env overrides.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PLAYBOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_ROOT = resolve(PLAYBOT_DIR, '..', '..');
export const CACHE_DIR = resolve(PLAYBOT_DIR, '.cache');
export const OUT_DIR = resolve(PLAYBOT_DIR, 'out');

export function loadConfig(path = resolve(PLAYBOT_DIR, 'playbot.config.json')) {
  const config = JSON.parse(readFileSync(path, 'utf8'));
  config.server ??= {};
  if (process.env.PLAYBOT_HOST) config.server.host = process.env.PLAYBOT_HOST;
  if (process.env.PLAYBOT_PORT) config.server.port = Number(process.env.PLAYBOT_PORT);
  config.judge ??= {};
  if (process.env.PLAYBOT_JUDGE_PROVIDER) config.judge.provider = process.env.PLAYBOT_JUDGE_PROVIDER;
  if (process.env.PLAYBOT_JUDGE_MODEL) config.judge.model = process.env.PLAYBOT_JUDGE_MODEL;
  return config;
}

export function getGame(config, name) {
  const game = config.games?.[name];
  if (!game) {
    throw new Error(`Unknown game "${name}". Known: ${Object.keys(config.games ?? {}).join(', ')}`);
  }
  return { name, ...game, absDir: resolve(REPO_ROOT, game.dir) };
}

export function timestamp(d = new Date()) {
  return d.toISOString().replace(/[:.]/g, '-');
}
