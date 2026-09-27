// Runs the automatic (no-AI) checks for one game and returns findings.
//
// Targets = the game's `checks.flows` (menu flows from page load to playing, see
// taps-to-play.js) plus every `smokeUrls` entry not already covered. For each target:
//   1. open it in a fresh tablet-sized touch context (1024×768 CSS px) with the
//      instrumentation init scripts (permissions, window.open, audio tap, canvas sampler)
//   2. on every screen (load, after each tap, playing): screenshot, DOM scan (links,
//      inputs), touch-target sizes, axe, visible text
//   3. play: PLAY_S simulated seconds of random input at ~real-time pace, sampling the
//      canvas every 1/60 s step (flashing) and text/state every 0.5 s (timers)
//   4. idle: restore(), then up to IDLE_S simulated seconds with no input (hints;
//      the first IDLE_FLASH_S seconds are also sampled for flashing)
//   5. read the page recordings (permissions, window.open, audio levels, globals, cookies)
// Then every check turns the collected data into findings.
import { mkdirSync } from 'node:fs';
import { collectDiagnostics, DEFAULT_ARGS, waitForGame } from '../browser.js';
import { chromium } from 'playwright';
import { applyJudgments } from '../judgments.js';
import { EXTRA_BROWSER_ARGS, checksInitScript, readPageRecording, recordNetwork } from './instrument.js';
import { evaluateNetwork, readAnalyticsGlobals } from './network.js';
import { evaluatePermissions } from './permissions.js';
import { evaluateLinksOut, scanDom } from './links-out.js';
import { evaluateTouchTargets, measureTouchTargets } from './touch-targets.js';
import { evaluateReading } from './reading-level.js';
import { SAMPLER_INIT, analyzeFlashes, changedArea, evaluateFlashing, flashWorstStart, recordFrames, saveContactSheet } from './flashing.js';
import { evaluateLoudness } from './loudness.js';
import { evaluateAxe, runAxe } from './axe.js';
import { evaluateTapsToPlay } from './taps-to-play.js';
import { IDLE_S, evaluateHints, firstHint, isHint } from './hint-timing.js';
import { evaluatePauseMuteQuit, findControls } from './pause-mute-quit.js';
import { evaluateCountdowns } from './countdown-timers.js';
import { evaluateWordScan } from './word-scan.js';
import { domTextInPage, finding, randomInput, rng, slug } from './util.js';

export const ALL_CHECKS = ['network', 'permissions', 'links-out', 'input-fields', 'touch-targets', 'reading-level', 'flashing',
  'loudness', 'axe', 'taps-to-play', 'hint-timing', 'pause-mute-quit', 'countdown-timers', 'word-scan'];
export const CI_CHECKS = ['network', 'links-out', 'input-fields', 'permissions', 'word-scan'];

export const PLAY_S = 5;
export const IDLE_FLASH_S = 5;
/** A frame where this much of the screen changes luminance by ≥ 0.1 at once gets a screenshot (flash evidence). */
const CHANGE_SHOT_AREA = 0.25;
const TABLET = { width: 1024, height: 768 };

/** Collect game text (__game.text()) + DOM text. */
async function collectTexts(page) {
  const game = await page.evaluate(() => { try { return window.__game?.text?.() ?? []; } catch { return []; } }).catch(() => []);
  const dom = await page.evaluate(domTextInPage).catch(() => []);
  return [...new Set([...game, ...dom].map((s) => String(s).replace(/\s+/g, ' ').trim()).filter(Boolean))];
}

/** Key for de-duplicating UI strings whose numbers change every frame (FPS, positions, scores). */
export const textKey = (s) => String(s).replace(/\d+(?:[.,]\d+)*/g, '#');

const stateOf = (page) => page.evaluate(() => { try { return window.__game?.state?.() ?? null; } catch { return null; } }).catch(() => null);

/**
 * @param {object} o
 * @param {object} o.game      from getGame()
 * @param {string} o.baseUrl
 * @param {string} o.outDir
 * @param {object} o.config
 * @param {string[]} o.brackets
 * @param {object} o.rubric    from loadRubric()
 * @param {string[]} [o.only]  subset of ALL_CHECKS
 */
export async function runChecks({ game, baseUrl, outDir, config, brackets, rubric, only = null, headed = false,
  playSeconds = PLAY_S, idleSeconds = IDLE_S, log = (m) => console.error(m) }) {
  mkdirSync(outDir, { recursive: true });
  const want = new Set(only?.length ? only : ALL_CHECKS);
  const needDom = ['links-out', 'input-fields', 'touch-targets', 'axe'].some((c) => want.has(c));
  const needPlay = ['flashing', 'loudness', 'countdown-timers'].some((c) => want.has(c));
  const needIdle = want.has('hint-timing');
  const gameOrigin = new URL(baseUrl).origin;
  const viewport = game.checks?.viewport ?? config.checks?.viewport ?? TABLET;
  const smokeCfg = { readyTimeoutMs: 30000, hookGraceMs: 10000, fallbackWaitMs: 3000, ...config.smoke };
  const maxTouch = Math.max(...brackets.map((b) => rubric.threshold('touch-target', b).min_touch_target_px ?? 0), 44);

  const targets = (game.checks?.flows ?? []).map((f) => ({ name: f.name, url: f.url, taps: f.taps ?? [], playing: f.playing ?? null, flow: f }));
  for (const u of game.smokeUrls ?? []) {
    if (!targets.some((t) => t.url === u)) targets.push({ name: slug(u), url: u, taps: [], playing: null, flow: null });
  }

  const browser = await chromium.launch({ headless: !headed, args: [...(config.browser?.args ?? DEFAULT_ARGS), ...EXTRA_BROWSER_ARGS] });
  const textKeys = new Set();
  const texts = [];
  texts.push = (...items) => {
    for (const it of items) {
      const k = textKey(it.text);
      if (textKeys.has(k)) continue;
      textKeys.add(k);
      Array.prototype.push.call(texts, it);
    }
    return texts.length;
  };
  const collected = { screens: [], texts, pages: [], flashSegments: [], flows: [], playing: [], hints: [], timers: [], net: { requests: [], websockets: [], popups: [], navigations: [] } };
  const runInfo = [];
  try {
    for (const t of targets) {
      log(`[checks] ${game.name}: ${t.name} (${t.url})`);
      const started = Date.now();
      const info = { target: t.name, url: baseUrl + t.url };
      try {
        await runTarget({ browser, t, baseUrl, outDir, viewport, smokeCfg, maxTouch, want, needDom, needPlay, needIdle, playSeconds, idleSeconds, game, collected, info });
      } catch (err) {
        info.error = String(err.stack ?? err);
        log(`[checks]   error: ${err.message}`);
      }
      info.seconds = (Date.now() - started) / 1000;
      runInfo.push(info);
    }
  } finally {
    await browser.close();
  }

  // ---- evaluate
  const ctx = { brackets, rubric, finding };
  const findings = [];
  const add = (id, fn) => { if (want.has(id)) findings.push(...fn()); };
  add('network', () => evaluateNetwork({ net: collected.net, gameOrigin, pages: collected.pages }));
  add('permissions', () => evaluatePermissions(collected.pages));
  if (want.has('links-out') || want.has('input-fields')) {
    findings.push(...evaluateLinksOut(collected.screens, collected.pages, gameOrigin).filter((f) => want.has(f.check)));
  }
  add('touch-targets', () => evaluateTouchTargets(collected.screens.filter((s) => s.targets), ctx));
  const audioPresent = collected.pages.some((p) => (p.audio ?? []).some((a) => a.rms > 0.003) || (p.media ?? []).length);
  add('reading-level', () => evaluateReading(collected.texts, { ...ctx, audio: audioPresent }));
  add('flashing', () => evaluateFlashing(collected.flashSegments, ctx));
  add('loudness', () => evaluateLoudness(collected.pages.filter((p) => p.played), ctx));
  add('axe', () => evaluateAxe(collected.screens));
  add('taps-to-play', () => evaluateTapsToPlay(collected.flows, ctx));
  add('hint-timing', () => evaluateHints(collected.hints, ctx));
  add('pause-mute-quit', () => evaluatePauseMuteQuit(collected.playing, ctx));
  add('countdown-timers', () => evaluateCountdowns(collected.timers, ctx));
  add('word-scan', () => evaluateWordScan(collected.texts, game, ctx));
  for (const info of runInfo) {
    if (info.error || info.hook !== 'ready') {
      findings.push(finding({ check: 'harness', status: 'warn', target: info.target,
        summary: info.error ? `Target failed: ${info.error.split('\n')[0]}` : `window.__game hook ${info.hook}; play/idle checks skipped`,
        screenshot: info.screenshot, key: `${info.target}:${info.error ? 'error' : info.hook}`, details: info }));
    }
  }

  // Every non-pass finding carries a screenshot: fall back to the target's (or the run's) first screenshot.
  const firstShot = collected.screens.find((s) => s.screenshot)?.screenshot ?? null;
  for (const f of findings) {
    if (f.status === 'pass' || f.evidence.screenshot) continue;
    const s = collected.screens.find((x) => x.target === f.target && x.screenshot)?.screenshot ?? firstShot;
    if (s) f.evidence.screenshot = s;
  }
  const judged = applyJudgments(findings, game.name);
  return { findings, targets: runInfo, judged };
}

/** Contact sheet of the worst 1 s window when the flash analysis is not a pass. */
async function flashSheet(page, outDir, name, analysis) {
  let sheet = null;
  if (analysis && analysis.status !== 'pass') sheet = await saveContactSheet(page, outDir, name, flashWorstStart(analysis), 60);
  await page.evaluate(() => { window.__playbotFrames = null; }).catch(() => {});
  return sheet;
}

async function runTarget({ browser, t, baseUrl, outDir, viewport, smokeCfg, maxTouch, want, needDom, needPlay, needIdle, playSeconds, idleSeconds, game, collected, info }) {
  const context = await browser.newContext({ viewport, hasTouch: true, deviceScaleFactor: 1 });
  await context.addInitScript(checksInitScript);
  await context.addInitScript(SAMPLER_INIT);
  const net = recordNetwork(context, { target: t.name });
  const page = await context.newPage();
  collectDiagnostics(page);
  const shots = new Set();
  const shot = async (label) => {
    const name = `${slug(t.name)}-${slug(label)}.png`;
    try {
      await page.screenshot({ path: `${outDir}/${name}`, timeout: 15000 });
      shots.add(name);
      return name;
    } catch { return null; }
  };
  const pageRec = { target: t.name };
  try {
    await page.goto(baseUrl + t.url, { waitUntil: 'load', timeout: 30000 });
    const wait = await waitForGame(page, { timeoutMs: smokeCfg.readyTimeoutMs, hookGraceMs: smokeCfg.hookGraceMs, fallbackWaitMs: smokeCfg.fallbackWaitMs });
    info.hook = wait.hook;
    const hook = wait.hook === 'ready';

    const screen = async (label) => {
      await page.waitForTimeout(250);
      const screenshot = await shot(label);
      const entry = { target: t.name, label, screenshot };
      if (needDom) {
        entry.dom = await scanDom(page);
        if (want.has('touch-targets')) Object.assign(entry, await measureTouchTargets(page, { outDir, name: `${slug(t.name)}-${slug(label)}`, maxThreshold: maxTouch }));
        if (want.has('axe')) entry.axe = await runAxe(page);
      }
      for (const text of await collectTexts(page)) collected.texts.push({ text, screen: `${t.name}:${label}`, screenshot });
      collected.screens.push(entry);
      return entry;
    };

    const load = await screen('load');
    info.screenshot = load.screenshot;
    pageRec.screenshot = load.screenshot;

    // ---- taps from load to playing
    const flow = { target: t.name, flow: t.flow ?? { name: t.name }, taps: [], tapShots: [], reached: false, screenshot: load.screenshot };
    let playingScreen = load;
    for (const [i, tp] of t.taps.entries()) {
      const loc = page.locator(tp.tap).first();
      try {
        await loc.waitFor({ state: 'visible', timeout: 10000 });
        await loc.tap({ force: true, timeout: 5000 }).catch(() => loc.click({ force: true, timeout: 5000 }));
      } catch (err) {
        flow.error = `tap ${i + 1} (${tp.label ?? tp.tap}) failed: ${err.message.split('\n')[0]}`;
        break;
      }
      flow.taps.push(tp);
      await page.waitForTimeout(tp.waitMs ?? 500);
      const s = await screen(`tap${i + 1}-${tp.label ?? 'tap'}`);
      flow.tapShots.push(s.screenshot);
      flow.screenshot = s.screenshot;
      playingScreen = s;
    }
    if (!flow.error && hook) {
      flow.reached = await page.waitForFunction((expr) => {
        const s = window.__game?.state?.();
        if (!s) return false;
        try { return expr ? !!new Function('s', `return (${expr});`)(s) : true; } catch { return false; }
      }, t.playing, { timeout: 30000, polling: 100 }).then(() => true, () => false);
      if (!flow.reached) flow.error = `state never matched ${t.playing}`;
    }
    if (t.flow) collected.flows.push(flow);
    if (flow.reached && t.taps.length) {
      playingScreen = await screen('playing');
      flow.playingShot = playingScreen.screenshot;
    }
    if (want.has('pause-mute-quit') && (flow.reached || !t.taps.length)) {
      collected.playing.push({ target: t.name, label: playingScreen.label, screenshot: playingScreen.screenshot, controls: await findControls(page) });
    }

    // Audio unlock for games that create their AudioContext on the first key/tap (harmless key).
    await page.keyboard.press('Shift').catch(() => {});

    const timerSamples = [];
    const states = [];
    const sampleText = async (tSim) => {
      timerSamples.push({ t: tSim, texts: await collectTexts(page) });
      const st = await stateOf(page);
      if (st) states.push(st);
    };

    // ---- play: random input at ~real-time pace
    if (hook && flow.reached !== false && needPlay) {
      const rand = rng(12345);
      const kind = game.checks?.input ?? 'joystick';
      const changeShots = [];
      let prev = null;
      const frames = Math.round(playSeconds * 60);
      const rec = await recordFrames(page, {
        frames, pace: 1000 / 60,
        beforeStep: async (i) => {
          if (i % 30 === 0) await page.evaluate((inp) => window.__game.setInput(inp), randomInput(kind, rand)).catch(() => {});
        },
        onSample: async (i, s) => {
          if (prev && changeShots.length < 6 && changedArea(prev, s) >= CHANGE_SHOT_AREA) changeShots.push({ frame: i, area: changedArea(prev, s), screenshot: await shot(`play-f${i}`) });
          prev = s;
          if (i % 30 === 29) {
            await sampleText((i + 1) / 60);
            for (const text of timerSamples[timerSamples.length - 1].texts) collected.texts.push({ text, screen: `${t.name}:play`, screenshot: null });
          }
        },
      });
      await page.evaluate(() => window.__game.clearInput?.()).catch(() => {});
      const endShot = await shot('play-end');
      for (const x of collected.texts) if (x.screen === `${t.name}:play` && !x.screenshot) x.screenshot = endShot;
      const analysis = rec.samples.length ? analyzeFlashes(rec.samples) : null;
      const sheet = await flashSheet(page, outDir, `${slug(t.name)}-play-flash-frames`, analysis);
      collected.flashSegments.push({ target: t.name, segment: 'play', analysis, blank: rec.blank, screenshot: endShot, changeShots, sheet });
      pageRec.played = true;
      info.playFrames = rec.samples.length;
    }

    // ---- idle: no input, watch for hints
    if (hook && flow.reached !== false && needIdle) {
      await page.evaluate(async () => { try { await window.__game.restore?.(); } catch { /* ignore */ } window.__game.clearInput?.(); }).catch(() => {});
      await page.waitForTimeout(200);
      const baseline = new Set((await collectTexts(page)).map(textKey));
      const evStart = await page.evaluate(() => window.__game.events?.length ?? 0).catch(() => 0);
      const observations = [];
      const screenshots = {};
      const deadlines = [...new Set([10, 20, 45, 60].filter((s) => s <= idleSeconds).concat([idleSeconds]))];
      let frame = 0;
      let hint = null;
      const observe = async () => {
        const tSim = frame / 60;
        const evs = await page.evaluate((n) => (window.__game.events ?? []).slice(n).map((e) => ({ type: e.type, text: e.text ?? e.message ?? null })), evStart).catch(() => []);
        for (const e of evs.slice(observations.filter((o) => o.source === 'event').length)) observations.push({ t: tSim, source: 'event', type: e.type, text: e.text });
        const texts = await collectTexts(page);
        for (const x of texts) {
          if (baseline.has(textKey(x))) continue;
          baseline.add(textKey(x));
          observations.push({ t: tSim, source: 'text', text: x });
          collected.texts.push({ text: x, screen: `${t.name}:idle`, screenshot: null });
        }
        timerSamples.push({ t: playSeconds + tSim, texts });
        const h = firstHint(observations);
        if (h && !hint) { hint = h; screenshots[`hint@${tSim.toFixed(1)}`] = await shot(`idle-hint-${Math.round(tSim)}s`); }
        for (const d of deadlines) if (tSim >= d && !screenshots[d]) screenshots[d] = await shot(`idle-${d}s`);
      };
      const flashFrames = want.has('flashing') ? Math.min(idleSeconds, IDLE_FLASH_S) * 60 : 0;
      if (flashFrames) {
        const changeShots = [];
        let prev = null;
        const rec = await recordFrames(page, {
          frames: flashFrames,
          onSample: async (i, s) => {
            frame = i + 1;
            if (prev && changeShots.length < 6 && changedArea(prev, s) >= CHANGE_SHOT_AREA) changeShots.push({ frame: i, area: changedArea(prev, s), screenshot: await shot(`idle-f${i}`) });
            prev = s;
            if (frame % 30 === 0) await observe();
          },
        });
        const analysis = rec.samples.length ? analyzeFlashes(rec.samples) : null;
        const sheet = await flashSheet(page, outDir, `${slug(t.name)}-idle-flash-frames`, analysis);
        collected.flashSegments.push({ target: t.name, segment: 'idle', analysis, blank: rec.blank, screenshot: await shot(`idle-${IDLE_FLASH_S}s`), changeShots, sheet });
      }
      while (frame < idleSeconds * 60) {
        const n = Math.min(30, idleSeconds * 60 - frame);
        await page.evaluate((k) => window.__game.step(k), n).catch(() => {});
        frame += n;
        await observe();
      }
      const idleEnd = screenshots[idleSeconds] ?? await shot(`idle-${idleSeconds}s`);
      for (const x of collected.texts) if (x.screen === `${t.name}:idle` && !x.screenshot) x.screenshot = idleEnd;
      const st = await stateOf(page);
      if (st) states.push(st);
      collected.hints.push({ target: t.name, observations: observations.slice(0, 100), idleSeconds, firstHint: hint, screenshots, screenshot: idleEnd,
        hintLike: observations.filter(isHint).length });
    }
    if (timerSamples.length || states.length) {
      collected.timers.push({ target: t.name, samples: timerSamples, states, screenshot: pageRec.screenshot,
        shotNear: () => [...shots].find((s) => s.includes('play-end')) ?? pageRec.screenshot });
    }

    // ---- page recordings
    const rec = await readPageRecording(page);
    Object.assign(pageRec, rec ?? {});
    pageRec.globals = await readAnalyticsGlobals(page);
    pageRec.cookies = (await context.cookies().catch(() => [])).map((c) => ({ name: c.name, domain: c.domain, path: c.path, expires: c.expires }));
  } finally {
    pageRec.popups = net.rec.popups;
    pageRec.navigations = net.rec.navigations;
    collected.net.requests.push(...net.rec.requests);
    collected.net.websockets.push(...net.rec.websockets);
    collected.net.popups.push(...net.rec.popups);
    collected.net.navigations.push(...net.rec.navigations);
    net.detach();
    collected.pages.push(pageRec);
    await context.close();
  }
}
