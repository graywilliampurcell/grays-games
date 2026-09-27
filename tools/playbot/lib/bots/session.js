// Browser plumbing shared by the bots: a small pool of headless browsers and
// pages, a "game session" wrapper around window.__game, and the frame-rate probe.
import { collectDiagnostics, launchBrowser, waitForGame } from '../browser.js';

// Bots don't look at pixels, so a small canvas keeps SwiftShader cheap.
export const BOT_VIEWPORT = { width: 320, height: 240 };
// Frame-rate runs use a tablet-sized canvas (iPad-ish CSS pixels).
export const FPS_VIEWPORT = { width: 1024, height: 768 };

/**
 * Runs async `tasks` (functions taking a {browser}) over `browsers` headless
 * browsers with up to `perBrowser` tasks each at once. Chromium has one GPU
 * process per browser, so several browsers parallelise SwiftShader better
 * than many pages in one. Results keep task order; a task that throws gives
 * { error }.
 */
export async function runPool(tasks, { config = {}, browsers = 4, perBrowser = 2, onDone } = {}) {
  const n = Math.max(1, Math.min(browsers, Math.ceil(tasks.length / perBrowser)));
  const list = await Promise.all(Array.from({ length: n }, () => launchBrowser(config)));
  const results = new Array(tasks.length);
  let next = 0;
  let done = 0;
  const worker = async (browser) => {
    while (next < tasks.length) {
      const i = next++;
      try {
        results[i] = await tasks[i]({ browser });
      } catch (err) {
        results[i] = { error: err.stack ?? String(err) };
      }
      done++;
      onDone?.(done, tasks.length, results[i]);
    }
  };
  try {
    await Promise.all(list.flatMap((b) => Array.from({ length: perBrowser }, () => worker(b))));
  } finally {
    await Promise.all(list.map((b) => b.close().catch(() => {})));
  }
  return results;
}

/**
 * Open `url` (a ?test=1 URL) in a fresh context and wait for __game.ready.
 * Returns { page, context, diag, close(), errors() }.
 */
export async function openGame(browser, url, { viewport = BOT_VIEWPORT, timeoutMs = 30000, skipDraw = true } = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await context.addInitScript(installDrawSkip, skipDraw);
  const page = await context.newPage();
  const diag = collectDiagnostics(page);
  await page.goto(url, { waitUntil: 'load', timeout: timeoutMs });
  const wait = await waitForGame(page, { timeoutMs, hookGraceMs: timeoutMs, fallbackWaitMs: 0 });
  if (wait.hook !== 'ready') {
    await context.close();
    throw new Error(`${url}: window.__game ${wait.hook}`);
  }
  await page.evaluate(installProbe);
  return {
    page,
    context,
    diag,
    /** Page errors, console errors, failed requests so far (strings). */
    errors() {
      return [
        ...diag.pageErrors.map((e) => `pageerror: ${e.message}`),
        ...diag.consoleErrors.map((e) => `console.error: ${e.text}`),
        ...diag.failedRequests.map((r) => `request failed: ${r.url} (${r.status ?? r.failure})`),
      ];
    },
    close: () => context.close().catch(() => {}),
  };
}

// Bots read state, not pixels, and SwiftShader draws cost ~5-7 ms a frame, so
// bot pages turn WebGL draw calls into no-ops (10x faster runs). The game's own
// code runs unchanged; only the GPU work is skipped. window.__pbSkipDraw = false
// turns drawing back on (e.g. before a screenshot). Frame-rate runs never skip.
function installDrawSkip(skip) {
  window.__pbSkipDraw = !!skip;
  for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!C) continue;
    for (const m of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'drawRangeElements', 'clear']) {
      const orig = C.prototype[m];
      if (!orig) continue;
      C.prototype[m] = function patched(...args) {
        if (window.__pbSkipDraw) return undefined;
        return orig.apply(this, args);
      };
    }
  }
}

// In-page helper: set input, step, and return the new events since the last call
// (so each round trip is one small message).
function installProbe() {
  let cursor = 0;
  window.__pb = {
    tick(input, n, withState = true) {
      const g = window.__game;
      if (input !== undefined && input !== null) g.setInput(input);
      if (n > 0) g.step(n);
      const ev = g.events;
      // events can be cleared/reset by the game; keep the cursor sane
      if (cursor > ev.length) cursor = 0;
      const events = ev.slice(cursor);
      cursor = ev.length;
      return { state: withState ? g.state() : null, events };
    },
    resetCursor() { cursor = window.__game.events.length; },
  };
}

/** One round trip: optional input, step n, get { state, events }. */
export function tick(page, input, n) {
  return page.evaluate(([i, k]) => window.__pb.tick(i, k), [input ?? null, n]);
}

/**
 * Frame rate at real speed: CPU slowed `throttle`x (CDP) to act like a tablet,
 * __game.setRealtime(true), count requestAnimationFrame callbacks for `seconds`.
 * `input` is held meanwhile so the game is doing real work.
 */
export async function measureFps(page, { throttle = 4, seconds = 5, input = null } = {}) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  try {
    const res = await page.evaluate(async ([secs, inp]) => {
      const g = window.__game;
      if (inp) g.setInput(inp);
      g.setRealtime(true);
      const t0 = g.time();
      const frames = [];
      await new Promise((resolve) => {
        const start = performance.now();
        const loop = (now) => {
          frames.push(now);
          if (now - start < secs * 1000) requestAnimationFrame(loop);
          else resolve();
        };
        requestAnimationFrame(loop);
      });
      g.setRealtime(false);
      g.clearInput();
      const gaps = [];
      for (let i = 1; i < frames.length; i++) gaps.push(frames[i] - frames[i - 1]);
      gaps.sort((a, b) => a - b);
      const dur = (frames[frames.length - 1] - frames[0]) / 1000;
      return {
        frames: frames.length,
        seconds: Math.round(dur * 100) / 100,
        fps: Math.round(((frames.length - 1) / dur) * 10) / 10,
        p95FrameMs: Math.round(gaps[Math.floor(gaps.length * 0.95)] * 10) / 10,
        maxFrameMs: Math.round(gaps[gaps.length - 1] * 10) / 10,
        simSeconds: Math.round((g.time() - t0) * 100) / 100,
      };
    }, [seconds, input]);
    return { throttle, viewport: page.viewportSize(), renderer: 'SwiftShader (software WebGL, CPU)', ...res };
  } finally {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }).catch(() => {});
    await cdp.detach().catch(() => {});
  }
}
