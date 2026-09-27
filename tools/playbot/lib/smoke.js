// Smoke test: load each smoke URL, check for errors, step frames, take screenshots.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { collectDiagnostics, launchBrowser, newPage, waitForGame } from './browser.js';

function slug(s) {
  return s.replace(/^\?/, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'root';
}

/**
 * @param {object} opts
 * @param {object} opts.game       from getGame()
 * @param {string} opts.baseUrl    URL the game is served at (ends with /)
 * @param {string} opts.outDir     directory for smoke.json + PNGs
 * @param {object} opts.config
 */
export async function runSmoke({ game, baseUrl, outDir, config, headed = false }) {
  mkdirSync(outDir, { recursive: true });
  const smokeCfg = { readyTimeoutMs: 30000, hookGraceMs: 10000, fallbackWaitMs: 3000, stepFrames: 60, ...config.smoke };
  const browser = await launchBrowser(config, { headed });
  const results = [];
  try {
    for (const suffix of game.smokeUrls) {
      results.push(await smokeOne({ browser, config, url: baseUrl + suffix, suffix, outDir, smokeCfg }));
    }
  } finally {
    await browser.close();
  }
  const summary = {
    game: game.name,
    baseUrl,
    startedAt: results[0]?.startedAt,
    finishedAt: new Date().toISOString(),
    browser: { version: results[0]?.browserVersion },
    passed: results.every((r) => r.errors.length === 0),
    results,
  };
  writeFileSync(join(outDir, 'smoke.json'), JSON.stringify(summary, null, 2));
  return summary;
}

async function smokeOne({ browser, config, url, suffix, outDir, smokeCfg }) {
  const startedAt = new Date().toISOString();
  const name = slug(suffix);
  const { context, page } = await newPage(browser, config);
  const diag = collectDiagnostics(page);
  const result = { url, startedAt, browserVersion: browser.version(), screenshots: [], warnings: [], errors: [] };
  try {
    const t0 = Date.now();
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    result.loadMs = Date.now() - t0;
    const wait = await waitForGame(page, {
      timeoutMs: smokeCfg.readyTimeoutMs, hookGraceMs: smokeCfg.hookGraceMs, fallbackWaitMs: smokeCfg.fallbackWaitMs,
    });
    result.hook = wait.hook;
    result.readyMs = wait.waitedMs;
    if (wait.hook === 'missing') {
      result.warnings.push('window.__game hook missing; used canvas + wait fallback');
      if (!wait.canvas) result.errors.push('no <canvas> found on page');
    } else if (wait.hook === 'not-ready') {
      result.errors.push(`window.__game present but not ready within ${smokeCfg.readyTimeoutMs}ms`);
    }

    const shot = async (label) => {
      const file = `${name}-${label}.png`;
      await page.screenshot({ path: join(outDir, file) });
      result.screenshots.push(file);
    };
    await shot('ready');

    if (wait.hook === 'ready') {
      const info = await page.evaluate(() => ({
        name: window.__game.name, version: window.__game.version, dt: window.__game.dt,
        hasStep: typeof window.__game.step === 'function',
      }));
      result.gameInfo = info;
      result.stateBefore = await page.evaluate(() => window.__game.state?.()).catch((e) => ({ error: String(e) }));
      if (info.hasStep) {
        const frames = smokeCfg.stepFrames;
        const t1 = Date.now();
        result.stateAfter = await page.evaluate((n) => window.__game.step(n), frames).catch((e) => {
          result.errors.push(`__game.step(${frames}) threw: ${e.message}`);
          return null;
        });
        result.steppedFrames = frames;
        result.stepMs = Date.now() - t1;
        await shot(`step${frames}`);
      } else {
        result.warnings.push('window.__game.step missing');
      }
      result.text = await page.evaluate(() => window.__game.text?.()).catch(() => undefined);
      result.events = await page.evaluate(() => window.__game.events?.slice(0, 50)).catch(() => undefined);
    } else {
      await page.waitForTimeout(1000);
      await shot('later');
    }

    result.webgl = await diag.webgl();
    if (result.webgl?.contextLost?.length) result.errors.push(`WebGL context lost x${result.webgl.contextLost.length}`);
  } catch (err) {
    result.errors.push(`smoke run failed: ${err.message}`);
  } finally {
    result.consoleErrors = diag.consoleErrors;
    result.consoleWarnings = diag.consoleWarnings.slice(0, 50);
    result.pageErrors = diag.pageErrors;
    result.failedRequests = diag.failedRequests;
    for (const e of diag.consoleErrors) result.errors.push(`console.error: ${e.text}`);
    for (const e of diag.pageErrors) result.errors.push(`pageerror: ${e.message}`);
    for (const r of diag.failedRequests) result.errors.push(`request failed: ${r.url} (${r.status ?? r.failure})`);
    await context.close();
  }
  return result;
}
