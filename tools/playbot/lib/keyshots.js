// Key screenshots per game (menu, playing, failing, winning) through the window.__game hook,
// plus every piece of game text we can find (hook text(), DOM innerText, message events and,
// as a separate source, string literals from the game's source directory).
//
// Output: <runDir>/keyshots/*.png + manifest.json + text.json
//   manifest.json: { game, baseUrl, capturedAt, shots: [{ file, screen, label, description, url, state, text }], warnings }
//   text.json:     { hookText: [...], domText: [...], messages: [...], sourceStrings: [{ file, text }], audio: {...} }
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { collectDiagnostics, launchBrowser, newPage, waitForGame } from './browser.js';

export const KEYSHOT_SCREENS = ['menu', 'playing', 'failing', 'winning'];

/** Capture key screenshots for `game` served at `baseUrl` into `<runDir>/keyshots`. */
export async function captureKeyshots({ game, baseUrl, runDir, config, headed = false, log = console.error }) {
  const dir = join(runDir, 'keyshots');
  mkdirSync(dir, { recursive: true });
  const script = SCRIPTS[game.name];
  if (!script) throw new Error(`No keyshot script for game "${game.name}"`);
  const browser = await launchBrowser(config, { headed });
  const ctx = {
    game, baseUrl, dir, config, log, browser,
    shots: [], warnings: [], hookText: new Set(), domText: new Set(), messages: new Set(), pageErrors: [],
  };
  try {
    await script(ctx);
  } finally {
    await browser.close();
  }
  const text = {
    hookText: [...ctx.hookText],
    domText: [...ctx.domText],
    messages: [...ctx.messages],
    sourceStrings: extractSourceStrings(game.absDir),
    audio: scanAudio(game.absDir),
  };
  const manifest = {
    game: game.name,
    baseUrl,
    capturedAt: new Date().toISOString(),
    viewport: config.browser?.viewport ?? { width: 1280, height: 720 },
    shots: ctx.shots,
    warnings: ctx.warnings,
    pageErrors: ctx.pageErrors,
  };
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  writeFileSync(join(dir, 'text.json'), JSON.stringify(text, null, 2));
  return { dir, manifest, text };
}

/** Load a previously captured keyshots dir (returns null if missing). */
export function loadKeyshots(runDir) {
  const dir = join(runDir, 'keyshots');
  const m = join(dir, 'manifest.json');
  if (!existsSync(m)) return null;
  const manifest = JSON.parse(readFileSync(m, 'utf8'));
  const t = join(dir, 'text.json');
  const text = existsSync(t) ? JSON.parse(readFileSync(t, 'utf8')) : { hookText: [], domText: [], messages: [], sourceStrings: [] };
  return { dir, manifest, text };
}

// ------------------------------------------------------------------ shared helpers

async function openPage(ctx, suffix) {
  const { context, page } = await newPage(ctx.browser, ctx.config);
  const diag = collectDiagnostics(page);
  page.on('pageerror', (e) => ctx.pageErrors.push({ url: suffix, message: e.message }));
  const url = ctx.baseUrl + suffix;
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  const wait = await waitForGame(page, { timeoutMs: ctx.config.smoke?.readyTimeoutMs ?? 30000 });
  if (wait.hook !== 'ready') throw new Error(`${url}: window.__game not ready (${wait.hook})`);
  return { context, page, url, diag, close: () => context.close() };
}

async function collectText(ctx, page) {
  const got = await page.evaluate(() => ({
    hook: (() => { try { return window.__game.text?.() ?? []; } catch { return []; } })(),
    dom: document.body?.innerText ?? '',
    messages: (window.__game.events ?? []).filter((e) => e.type === 'message').map((e) => e.text),
  }));
  for (const s of got.hook) addUnique(ctx.hookText, s);
  for (const line of got.dom.split('\n').map((l) => l.trim()).filter(Boolean)) addUnique(ctx.domText, line);
  for (const m of got.messages) if (m) ctx.messages.add(m);
  return got;
}

// Keep one copy of lines that differ only in numbers (e.g. a live "Position: 2.5, 0.0, 2.5" HUD).
const seenKeys = new WeakMap();
function addUnique(set, s) {
  const key = s.replace(/-?\d+(\.\d+)?/g, '#');
  if (!seenKeys.has(set)) seenKeys.set(set, new Set());
  const keys = seenKeys.get(set);
  if (keys.has(key)) return;
  keys.add(key);
  set.add(s);
}

async function shot(ctx, page, { screen, label, description, url }) {
  await page.evaluate(() => window.__game.render?.());
  const file = `${screen}-${label}.png`;
  await page.screenshot({ path: join(ctx.dir, file) });
  const got = await collectText(ctx, page);
  const state = await page.evaluate(() => {
    try { const s = window.__game.state(); delete s.grid; delete s.debug; delete s.config; return s; } catch (e) { return { error: String(e) }; }
  });
  ctx.shots.push({ file, screen, label, description, url, text: got.hook, state: trimState(state) });
  ctx.log(`[keyshots] ${file}: ${description}`);
  return file;
}

function trimState(s) {
  if (!s || typeof s !== 'object') return s;
  const out = { ...s };
  for (const k of ['testTrack', 'race', 'gallery', 'playground']) {
    if (out[k] && typeof out[k] === 'object') {
      const { ahead, checkpoints, gaps, hazards, boosts, stars, ...rest } = out[k];
      out[k] = rest;
    }
  }
  return out;
}

const step = (page, n) => page.evaluate((k) => window.__game.step(k), n);
const setInput = (page, input) => page.evaluate((i) => window.__game.setInput(i), input);

async function safely(ctx, name, fn) {
  try { await fn(); } catch (err) {
    ctx.warnings.push(`${name}: ${err.message}`);
    ctx.log(`[keyshots] warn ${name}: ${err.message}`);
  }
}

// ------------------------------------------------------------------ Mazle

// three.js camera looks down -Z; yaw rotates about Y, so forward = (-sin yaw, -cos yaw).
const yawToward = (from, to) => Math.atan2(-(to.x - from.x), -(to.z - from.z));

/** Map layout chars to world coords using a known marker (the spike 'X'). */
function gridMapper(st) {
  let col = -1; let row = -1;
  st.grid.forEach((r, i) => { const c = r.indexOf('X'); if (c >= 0) { row = i; col = c; } });
  const ox = st.spike.x - col * st.cellSize;
  const oz = st.spike.z - row * st.cellSize;
  return {
    toWorld: (c, r) => ({ x: ox + c * st.cellSize, z: oz + r * st.cellSize }),
    spikeCell: { c: col, r: row },
  };
}

/** A floor cell 2–3 cells away from the spike in a straight, open line (to look at it). */
function spikeViewpoint(st) {
  const { toWorld, spikeCell } = gridMapper(st);
  const open = (c, r) => st.grid[r]?.[c] !== undefined && st.grid[r][c] !== '#';
  let best = null;
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    let k = 0;
    while (k < 3 && open(spikeCell.c + dc * (k + 1), spikeCell.r + dr * (k + 1))) k++;
    if (k >= 2 && (!best || k > best.k)) best = { k, c: spikeCell.c + dc * k, r: spikeCell.r + dr * k };
  }
  if (!best) return null;
  const p = toWorld(best.c, best.r);
  return { x: p.x, z: p.z, yaw: yawToward(p, st.spike) };
}

async function mazleScript(ctx) {
  const suffix = '?test=1';
  const { page, url, close } = await openPage(ctx, suffix);
  try {
    await step(page, 2);
    await shot(ctx, page, { screen: 'menu', label: 'start', url, description: 'Initial view when Level 1 opens (Mazle has no menu; this is the first screen a child sees, with the controls help and level name).' });

    await setInput(page, { forward: true });
    await step(page, 45);
    await page.evaluate(() => window.__game.clearInput());
    await step(page, 5);
    await shot(ctx, page, { screen: 'playing', label: 'walk', url, description: 'Playing: a few steps into the maze after walking forward.' });

    let st = await page.evaluate(() => window.__game.state());
    await safely(ctx, 'mazle spike view', async () => {
      const vp = spikeViewpoint(st);
      if (!vp) throw new Error('no open viewpoint near the spike');
      await page.evaluate((v) => window.__game.teleport(v), vp);
      await step(page, 1);
      await shot(ctx, page, { screen: 'playing', label: 'spike-ahead', url, description: 'Playing: standing a few cells from the floor spike hazard, looking at it.' });
    });

    await safely(ctx, 'mazle spike fail', async () => {
      await page.evaluate(() => window.__game.clearEvents());
      await page.evaluate((s) => window.__game.teleport({ x: s.x, z: s.z }), st.spike);
      await step(page, 2);
      const ev = await page.evaluate(() => window.__game.events.map((e) => e.type));
      if (!ev.includes('spike')) ctx.warnings.push(`spike event not seen after teleport (events: ${ev.join(',')})`);
      await shot(ctx, page, { screen: 'failing', label: 'spike', url, description: 'Failing: right after touching the spike. The game sends the player back to the start and shows a message.' });
      await step(page, 60);
      await shot(ctx, page, { screen: 'failing', label: 'spike-later', url, description: 'Failing: one second after the spike, still at the start with the message.' });
    });

    await safely(ctx, 'mazle win', async () => {
      await page.evaluate(() => window.__game.restore());
      st = await page.evaluate(() => window.__game.state());
      const { door } = st;
      // Stand 1.5 units in front of the door (towards the maze centre), facing it, then walk in.
      const cx = (st.grid[0].length - 1) / 2; const cz = (st.grid.length - 1) / 2;
      const { toWorld } = gridMapper(st);
      const centre = toWorld(cx, cz);
      const len = Math.hypot(centre.x - door.x, centre.z - door.z) || 1;
      const from = { x: door.x + ((centre.x - door.x) / len) * 1.5, z: door.z + ((centre.z - door.z) / len) * 1.5 };
      await page.evaluate((v) => window.__game.teleport(v), { ...from, yaw: yawToward(from, door) });
      await step(page, 1);
      await shot(ctx, page, { screen: 'playing', label: 'door-ahead', url, description: 'Playing: in front of the exit door (the goal).' });
      await setInput(page, { forward: true });
      for (let i = 0; i < 20; i++) {
        const s = await step(page, 10);
        if (s.escaped) break;
      }
      await page.evaluate(() => window.__game.clearInput());
      await step(page, 10);
      const s = await page.evaluate(() => window.__game.state());
      if (!s.escaped) ctx.warnings.push('Mazle did not reach the escaped state');
      await shot(ctx, page, { screen: 'winning', label: 'escaped', url, description: 'Winning: the escaped screen after reaching the door.' });
    });
  } finally {
    await close();
  }
}

// ------------------------------------------------------------------ Rolly Bally

async function rollyScript(ctx) {
  // Home screen (no ?mode) and the two setup screens it leads to.
  {
    const { page, url, close } = await openPage(ctx, '?test=1');
    try {
      await page.waitForTimeout(500);
      await shot(ctx, page, { screen: 'menu', label: 'home', url, description: 'Home screen (menu): big picture buttons and the grown-ups gear.' });
      for (const [caption, label, desc] of [
        ['Race', 'race-setup', 'Race setup screen, reached by tapping Race on Home.'],
        ['Playground', 'playground-setup', 'Playground setup screen, reached by tapping Playground on Home.'],
      ]) {
        await safely(ctx, `rolly ${label}`, async () => {
          await page.goto(url, { waitUntil: 'load' });
          await waitForGame(page, {});
          await page.getByText(caption, { exact: true }).first().click({ force: true, timeout: 5000 });
          await page.waitForTimeout(700);
          await shot(ctx, page, { screen: 'menu', label, url, description: desc });
        });
      }
    } finally {
      await close();
    }
  }

  // Test track: playing, falling through a gap, finishing.
  {
    const { page, url, close } = await openPage(ctx, '?mode=test-track&test=1');
    try {
      await setInput(page, { x: 0, y: 1 });
      await step(page, 90);
      await shot(ctx, page, { screen: 'playing', label: 'test-track', url, description: 'Playing: rolling along the test track a few seconds in.' });

      let st = await page.evaluate(() => window.__game.state());
      await safely(ctx, 'rolly gap fall', async () => {
        const gap = st.testTrack?.gaps?.[0];
        if (!gap) throw new Error('no gap on the test track');
        await page.evaluate(() => window.__game.clearEvents());
        await page.evaluate((s) => window.__game.teleport({ s }), (gap.s0 + gap.s1) / 2);
        let s;
        for (let i = 0; i < 30; i++) { s = await step(page, 4); if (s.fell) break; }
        if (!s.fell) ctx.warnings.push('ball did not fall after teleporting over the gap');
        await step(page, 12);
        await shot(ctx, page, { screen: 'failing', label: 'gap-fall', url, description: 'Failing: the ball dropped through a gap in the track (respawns at the last checkpoint).' });
        for (let i = 0; i < 40; i++) { s = await step(page, 5); if (!s.fell) break; }
        await step(page, 10);
        await shot(ctx, page, { screen: 'failing', label: 'respawn', url, description: 'Failing: after the fall, back on the track at the last checkpoint.' });
      });

      await safely(ctx, 'rolly finish', async () => {
        st = await page.evaluate(() => window.__game.state());
        const finishS = st.testTrack.finishS;
        await page.evaluate((s) => window.__game.teleport({ s }), finishS - 4);
        await setInput(page, { x: 0, y: 1 });
        let s;
        for (let i = 0; i < 60; i++) { s = await step(page, 3); if (s.won) break; }
        if (!s.won) ctx.warnings.push('test track finish not reached');
        await step(page, 20);
        await shot(ctx, page, { screen: 'winning', label: 'test-track-finish', url, description: 'Winning: just after crossing the test-track finish (fanfare plays, then back to the start).' });
      });
    } finally {
      await close();
    }
  }

  // Playground: free roaming with stars to collect.
  await safely(ctx, 'rolly playground', async () => {
    const { page, url, close } = await openPage(ctx, '?mode=playground&seed=1&test=1');
    try {
      await setInput(page, { x: 0, y: 1 });
      await step(page, 120);
      await shot(ctx, page, { screen: 'playing', label: 'playground', url, description: 'Playground mode: rolling around the seeded world with stars to collect.' });
    } finally {
      await close();
    }
  });

  // Race: the main kid-facing mode (countdown, then racing).
  await safely(ctx, 'rolly race', async () => {
    const { page, url, close } = await openPage(ctx, '?mode=race&seed=1&test=1');
    try {
      await step(page, 30);
      await shot(ctx, page, { screen: 'playing', label: 'race-countdown', url, description: 'Race mode: the countdown before the start.' });
      await setInput(page, { x: 0, y: 1 });
      await step(page, 360);
      await shot(ctx, page, { screen: 'playing', label: 'race', url, description: 'Race mode: racing against the other balls a few seconds after GO.' });
      await safely(ctx, 'rolly race finish', async () => {
        const st = await page.evaluate(() => window.__game.state());
        await page.evaluate((s) => window.__game.teleport({ s }), st.race.length - 6);
        let s;
        for (let i = 0; i < 80; i++) { s = await step(page, 5); if (s.won) break; }
        if (!s.won) throw new Error('race finish not reached');
        await step(page, 60);
        await page.waitForTimeout(600);
        await shot(ctx, page, { screen: 'winning', label: 'race-finish', url, description: `Winning: just after crossing the race finish line (place ${s.race?.place ?? '?'}).` });
        for (let i = 0; i < 40; i++) { s = await step(page, 15); if (['results', 'trophy'].includes(s.race?.state)) break; }
        await page.waitForTimeout(800);
        await shot(ctx, page, { screen: 'winning', label: 'race-results', url, description: `Race results screen (race state: ${s.race?.state}).` });
      });
    } finally {
      await close();
    }
  });
}

const SCRIPTS = { mazle: mazleScript, 'rolly-bally': rollyScript };

// ------------------------------------------------------------------ source text

const SRC_EXT = new Set(['.js', '.mjs', '.ts', '.jsx', '.tsx', '.html']);
const SKIP = new Set(['node_modules', 'dist', 'build', '.git', '.vite', 'coverage', 'tools', 'test', 'tests', '__tests__', 'public']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name) || name.startsWith('.')) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (SRC_EXT.has(extname(name)) && !/\.(test|spec)\./.test(name) && !/testHook/i.test(name) && !/vite\.config/.test(name)) out.push(p);
  }
  return out;
}

/**
 * String literals from the game's source that look like player-facing text (have a space-separated
 * word and a letter, or end with ! ? .), plus text nodes from HTML files. Deduplicated.
 */
export function extractSourceStrings(absDir, { maxStrings = 600 } = {}) {
  const seen = new Set();
  const out = [];
  const add = (file, s) => {
    const t = s.replace(/\s+/g, ' ').trim();
    if (!t || seen.has(t) || !looksLikeUiText(t)) return;
    seen.add(t);
    out.push({ file: relative(absDir, file), text: t });
  };
  let files = [];
  try { files = walk(absDir); } catch { return out; }
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    if (extname(file) === '.html') {
      const body = src.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
      for (const m of body.matchAll(/>([^<>]+)</g)) add(file, m[1]);
      continue;
    }
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
    for (const m of code.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)) {
      const s = (m[1] ?? m[2] ?? m[3] ?? '').replace(/\$\{[^}]*\}/g, '…');
      add(file, s);
    }
    if (out.length >= maxStrings) break;
  }
  return out.slice(0, maxStrings);
}

function looksLikeUiText(t) {
  if (t.length < 2 || t.length > 300) return false;
  if (!/[a-z]{2,}/i.test(t)) return false;
  if (/^\[[\w-]+\]/.test(t)) return false; // dev log lines like "[router] ..."

  if (/^[\w-]+\(/.test(t)) return false; // css functions like translate(...)
  if (/^[#.@]?[\w-]+(\s*[>+~,]\s*[#.]?[\w-]+)*$/.test(t) && !/[A-Z]/.test(t[0])) return false; // selectors / identifiers
  if (/^(\.{0,2}\/|https?:|data:|#[0-9a-f]{3,8}$|rgba?\(|hsla?\(|\d)/i.test(t)) return false; // paths, urls, colours, numbers
  if (/[{};=<>]|=>|\bfunction\b|\bconst\b|\breturn\b/.test(t)) return false; // code / css / html fragments
  if (/^(px|em|rem|vh|vw|%|ms|s)\b/.test(t)) return false;
  if (/^[a-z-]+:\s/.test(t) && /;|px|%/.test(t)) return false; // css declarations
  const words = t.split(/\s+/);
  if (words.length >= 2 && /[a-z]/i.test(words[1])) {
    // Mostly lowercase-dashed tokens (class lists like "rb-row home-buttons") are not UI text.
    if (words.every((w) => /^[a-z0-9_\-.…,[\]]+$/.test(w)) && words.some((w) => /[-_[]/.test(w))) return false;
    return true;
  }
  return /^[A-Z][a-z]+/.test(t) && /[!?.]$|^[A-Z][a-z]+$/.test(t) && t.length <= 40; // single capitalised words like "Race", "Oops!"
}

/** What the source says about sound (the judge cannot hear): audio files, speech synthesis, WebAudio. */
export function scanAudio(absDir) {
  const res = { audioFiles: [], speechSynthesis: false, webAudio: false, htmlAudio: false, voiceFiles: [] };
  const walkAll = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.') || name === 'dist') continue;
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) walkAll(p);
      else if (/\.(mp3|ogg|wav|m4a|webm)$/i.test(name)) {
        res.audioFiles.push(relative(absDir, p));
        if (/voice|speak|say|narrat|vo[_-]/i.test(name)) res.voiceFiles.push(relative(absDir, p));
      }
    }
  };
  try { walkAll(absDir); } catch { /* ignore */ }
  let files = [];
  try { files = walk(absDir); } catch { /* ignore */ }
  for (const f of files) {
    const s = readFileSync(f, 'utf8');
    if (/speechSynthesis|SpeechSynthesisUtterance/.test(s)) res.speechSynthesis = true;
    if (/AudioContext|createOscillator/.test(s)) res.webAudio = true;
    if (/new Audio\(|<audio/.test(s)) res.htmlAudio = true;
  }
  res.audioFiles = res.audioFiles.slice(0, 50);
  return res;
}
