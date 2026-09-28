// Chromium launch (headless WebGL via SwiftShader) and page diagnostics.
import { chromium } from 'playwright';

export const DEFAULT_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

export async function launchBrowser(config = {}, { headed = false } = {}) {
  return chromium.launch({
    headless: !headed,
    args: config.browser?.args ?? DEFAULT_ARGS,
  });
}

export async function newPage(browser, config = {}) {
  const context = await browser.newContext({
    viewport: config.browser?.viewport ?? { width: 1280, height: 720 },
  });
  await context.addInitScript(installWebGLWatch);
  const page = await context.newPage();
  return { context, page };
}

// Runs in the page before any game code: records WebGL context loss/restores.
function installWebGLWatch() {
  window.__playbotDiag = { contextLost: [], contextRestored: [] };
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const ctx = orig.call(this, type, ...rest);
    if (ctx && /webgl/i.test(String(type)) && !this.__playbotWatched) {
      this.__playbotWatched = true;
      this.addEventListener('webglcontextlost', () => {
        window.__playbotDiag.contextLost.push({ at: performance.now(), type: String(type) });
      });
      this.addEventListener('webglcontextrestored', () => {
        window.__playbotDiag.contextRestored.push({ at: performance.now() });
      });
    }
    return ctx;
  };
}

const IGNORED_REQUEST = [/\/favicon\.ico$/];

/** Attach listeners that collect console errors, page errors and failed requests. */
export function collectDiagnostics(page) {
  const diag = { consoleErrors: [], consoleWarnings: [], pageErrors: [], failedRequests: [] };
  page.on('console', (msg) => {
    const entry = { text: msg.text(), location: msg.location() };
    if (msg.type() === 'error') diag.consoleErrors.push(entry);
    else if (msg.type() === 'warning') diag.consoleWarnings.push(entry);
  });
  page.on('pageerror', (err) => diag.pageErrors.push({ message: err.message, stack: err.stack }));
  page.on('requestfailed', (req) => {
    if (IGNORED_REQUEST.some((re) => re.test(req.url()))) return;
    diag.failedRequests.push({ url: req.url(), failure: req.failure()?.errorText ?? 'failed' });
  });
  page.on('response', (res) => {
    if (res.status() >= 400 && !IGNORED_REQUEST.some((re) => re.test(res.url()))) {
      diag.failedRequests.push({ url: res.url(), status: res.status() });
    }
  });
  diag.webgl = async () => page.evaluate(() => window.__playbotDiag ?? null).catch(() => null);
  return diag;
}

/**
 * Wait for window.__game.ready. If window.__game does not appear within `hookGraceMs`, falls back
 * to waiting for a canvas plus `fallbackWaitMs` and returns { hook: 'missing' }.
 */
export async function waitForGame(page, { timeoutMs = 30000, fallbackWaitMs = 3000, hookGraceMs = 10000 } = {}) {
  const started = Date.now();
  // Give the game a grace period to define window.__game at all; builds without the hook skip ahead.
  const appeared = await page
    .waitForFunction(() => typeof window.__game === 'object' && window.__game !== null, null, { timeout: Math.min(hookGraceMs, timeoutMs), polling: 100 })
    .then(() => true, () => false);
  if (appeared) {
    const remaining = Math.max(1000, timeoutMs - (Date.now() - started));
    const ready = await page
      .waitForFunction(() => window.__game?.ready === true, null, { timeout: remaining, polling: 100 })
      .then(() => true, () => false);
    return { hook: ready ? 'ready' : 'not-ready', waitedMs: Date.now() - started };
  }
  // Fallback for builds without the hook (older committed code).
  await page.waitForSelector('canvas', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(fallbackWaitMs);
  const hasCanvas = (await page.$('canvas')) !== null;
  return { hook: 'missing', canvas: hasCanvas, waitedMs: Date.now() - started };
}
