// Builds a game with Vite into tools/playbot/.cache/builds/<game>.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { CACHE_DIR } from './config.js';

function run(cmd, args, cwd, log) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const onData = (d) => { output += d; if (log) process.stderr.write(d); };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolvePromise(output);
      else reject(new Error(`${cmd} ${args.join(' ')} failed (exit ${code}) in ${cwd}\n${output.slice(-4000)}`));
    });
  });
}

export function buildDir(gameName) {
  return resolve(CACHE_DIR, 'builds', gameName);
}

/** Build `game` (from getGame) and return the output directory. */
export async function buildGame(game, { verbose = false } = {}) {
  const outDir = buildDir(game.name);
  if (!existsSync(resolve(game.absDir, 'node_modules'))) {
    const hasLock = existsSync(resolve(game.absDir, 'package-lock.json'));
    console.error(`[build] ${game.name}: installing dependencies (npm ${hasLock ? 'ci' : 'install'})`);
    await run('npm', [hasLock ? 'ci' : 'install'], game.absDir, verbose);
  }
  console.error(`[build] ${game.name}: vite build -> ${outDir}`);
  const started = Date.now();
  // --minify false: readable stack traces, and avoids optional minifiers (Mazle's config asks for terser,
  // which is not installed).
  await run('npx', ['vite', 'build', '--base', './', '--outDir', outDir, '--emptyOutDir', '--minify', 'false'], game.absDir, verbose);
  console.error(`[build] ${game.name}: done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  return outDir;
}
