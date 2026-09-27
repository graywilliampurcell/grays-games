// Short local videos of the solver bot (Playwright recordVideo). Videos stay local: the report
// notes their paths and never uploads them.
//
// The bots open their own browser contexts, so we hand them a thin browser wrapper whose
// newContext() adds recordVideo and turns WebGL drawing back on (bots normally skip draws;
// see lib/bots/session.js installDrawSkip). The bot code itself is reused unchanged.
import { mkdirSync, readdirSync, renameSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { launchBrowser } from './browser.js';

const VIDEO_SIZE = { width: 640, height: 360 };

// Init script: keep drawing on even when the bot asks for draw skipping.
function forceDraw() {
  Object.defineProperty(window, '__pbSkipDraw', { get: () => false, set: () => {}, configurable: false });
}

function recordingBrowser(browser, dir) {
  return new Proxy(browser, {
    get(target, prop) {
      if (prop === 'newContext') {
        return async (opts = {}) => {
          const context = await target.newContext({ ...opts, viewport: VIDEO_SIZE, recordVideo: { dir, size: VIDEO_SIZE } });
          await context.addInitScript(forceDraw);
          return context;
        };
      }
      const v = target[prop];
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
}

/** The bot run to record per game: the solver on the first level / the test track. */
async function solverRun(gameName, browser, baseUrl) {
  if (gameName === 'mazle') {
    const { mazleSolver } = await import('./bots/mazle.js');
    return mazleSolver({ browser, baseUrl, capS: 90 });
  }
  if (gameName === 'rolly-bally') {
    const { rollySolver } = await import('./bots/rolly.js');
    return rollySolver({ browser, baseUrl, mode: 'test-track', capS: 90 });
  }
  throw new Error(`no solver video for ${gameName}`);
}

/**
 * Record the solver playing `game` into <runDir>/video/solver.webm.
 * Returns { path, seconds, won, bot } (path absolute).
 */
export async function recordSolverVideo({ game, baseUrl, runDir, config, log = console.error }) {
  const dir = join(runDir, 'video');
  mkdirSync(dir, { recursive: true });
  const browser = await launchBrowser(config);
  const started = Date.now();
  let run;
  try {
    run = await solverRun(game.name, recordingBrowser(browser, dir), baseUrl);
  } finally {
    await browser.close();
  }
  // The context closed inside the bot, so the video file is complete. Name it.
  const webms = readdirSync(dir).filter((f) => f.endsWith('.webm') && f !== 'solver.webm')
    .map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs })).sort((a, b) => b.t - a.t);
  if (!webms.length) throw new Error('no video file was written');
  const path = join(dir, 'solver.webm');
  renameSync(join(dir, webms[0].f), path);
  const seconds = Math.round((Date.now() - started) / 1000);
  log(`[video] ${game.name}: solver ${run?.won ? 'won' : 'did not win'} -> ${path} (${seconds}s)`);
  return { path, seconds, won: !!run?.won, bot: 'solver', error: run?.error ?? null };
}
