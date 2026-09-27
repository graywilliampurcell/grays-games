// flashing (R15, WCAG 2.3.1 "Three Flashes or Below Threshold").
//
// Frames come from the game canvas at exact 1/60 s steps (window.__game.step(1)
// then a read-back of the canvas in the same task). Each frame is reduced to a
// GRID_W × GRID_H grid of blocks; per block we keep the mean relative luminance
// (WCAG: 0.2126 R + 0.7152 G + 0.0722 B on linearised sRGB) and a "red" value
// (R − G − B) × 320 used for saturated-red flashes.
//
// General flash: a pair of opposing luminance transitions, each a change of
// ≥ 0.1 where the darker side is < 0.8. Transitions are found with hysteresis,
// so a slow fade over several frames counts once.
// Red flash: opposing transitions of the red value by > 20 where one side is a
// saturated red (R / (R + G + B) ≥ 0.8).
//
// Area (WCAG: flashes over a combined area of ~25% of a 10° visual field, in
// practice a 341×256 px rectangle on a 1024×768 screen = 1/3 × 1/3 of the screen):
// transitions are found per block (32×24 blocks), then for every window of
// GRID/3 × GRID/3 blocks (sliding by one block) a frame counts as a transition of
// that window when the NET share of its blocks transitioning the same way (ups minus
// downs) is over 25%. The net share is what stops a camera panning over a textured
// floor from counting (as many blocks get darker as get brighter), while a real
// flash moves the whole area the same way at once.
//   fail: some WCAG-sized window (or the whole frame) has > 6 transitions (> 3
//         flashes) in some 1-second (60-frame) span, general or red
//   warn: the same in a small window (1/6 × 1/6 of the screen): local flicker
// Only the canvas is sampled (DOM overlays are not).

export const GRID_W = 32;
export const GRID_H = 24;
export const FPS = 60;

/** Runs in the page: reads back the largest canvas into a GRID_W×GRID_H grid. */
export function sampleCanvasInPage({ gw, gh }) {
  const canvases = [...document.querySelectorAll('canvas')].filter((c) => c.width > 0 && c.height > 0);
  if (!canvases.length) return null;
  const src = canvases.reduce((a, c) => (c.width * c.height > a.width * a.height ? c : a));
  const W = gw * 4;
  const H = gh * 4;
  let c = window.__playbotSampleCanvas;
  if (!c) {
    c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    window.__playbotSampleCanvas = c;
  }
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  g.drawImage(src, 0, 0, W, H);
  const d = g.getImageData(0, 0, W, H).data;
  if (window.__playbotFrames) window.__playbotFrames.push(c.toDataURL('image/jpeg', 0.8));
  let lut = window.__playbotLinLut;
  if (!lut) {
    lut = new Float32Array(256);
    for (let v = 0; v < 256; v++) { const s = v / 255; lut[v] = s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }
    window.__playbotLinLut = lut;
  }
  const lin = (v) => lut[v];
  const L = new Array(gw * gh).fill(0);
  const R = new Array(gw * gh).fill(0);
  const S = new Array(gw * gh).fill(0);
  const bw = W / gw;
  const bh = H / gh;
  for (let by = 0; by < gh; by++) {
    for (let bx = 0; bx < gw; bx++) {
      let sl = 0; let sr = 0; let sg = 0; let sb = 0; let n = 0;
      for (let y = by * bh; y < (by + 1) * bh; y++) {
        for (let x = bx * bw; x < (bx + 1) * bw; x++) {
          const i = (y * W + x) * 4;
          const r = lin(d[i]); const gg = lin(d[i + 1]); const b = lin(d[i + 2]);
          sl += 0.2126 * r + 0.7152 * gg + 0.0722 * b;
          sr += r; sg += gg; sb += b; n++;
        }
      }
      const k = by * gw + bx;
      L[k] = sl / n;
      R[k] = Math.max(0, (sr - sg - sb) / n) * 320;
      S[k] = sr + sg + sb > 0 ? sr / (sr + sg + sb) : 0;
    }
  }
  const round = (a) => a.map((v) => Math.round(v * 1000) / 1000);
  return { gw, gh, L: round(L), R: round(R), S: round(S), canvas: { width: src.width, height: src.height } };
}

/**
 * Transitions in a luminance series with hysteresis. Pure.
 * @returns {{frame, dir, from, to, counted}[]}  counted = met the "darker < 0.8" condition
 */
export function transitions(series, { delta = 0.1, darkerMax = 0.8, satSeries = null } = {}) {
  const out = [];
  if (!series.length) return out;
  // Red mode (satSeries given): counted when either side is a saturated red.
  const counted = (fromI, toI, from, to) => (satSeries
    ? satSeries[fromI] >= 0.8 || satSeries[toI] >= 0.8
    : Math.min(from, to) < darkerMax);
  let dir = 0;
  let hi = series[0]; let hiI = 0;
  let lo = series[0]; let loI = 0;
  let ext = series[0]; let extI = 0;
  for (let i = 1; i < series.length; i++) {
    const v = series[i];
    if (dir === 0) {
      if (v > hi) { hi = v; hiI = i; }
      if (v < lo) { lo = v; loI = i; }
      if (v - lo >= delta) {
        out.push({ frame: i, dir: 1, from: lo, to: v, counted: counted(loI, i, lo, v) });
        dir = 1; ext = v; extI = i;
      } else if (hi - v >= delta) {
        out.push({ frame: i, dir: -1, from: hi, to: v, counted: counted(hiI, i, hi, v) });
        dir = -1; ext = v; extI = i;
      }
    } else if (dir === 1) {
      if (v > ext) { ext = v; extI = i; } else if (ext - v >= delta) {
        out.push({ frame: i, dir: -1, from: ext, to: v, counted: counted(extI, i, ext, v) });
        dir = -1; ext = v; extI = i;
      }
    } else if (v < ext) { ext = v; extI = i; } else if (v - ext >= delta) {
      out.push({ frame: i, dir: 1, from: ext, to: v, counted: counted(extI, i, ext, v) });
      dir = 1; ext = v; extI = i;
    }
  }
  return out;
}

/** Max number of counted transitions in any `win`-frame window. Pure. */
export function maxInWindow(trans, win = FPS) {
  const frames = trans.filter((t) => t.counted).map((t) => t.frame);
  let best = 0; let bestStart = 0; let j = 0;
  for (let i = 0; i < frames.length; i++) {
    while (frames[i] - frames[j] >= win) j++;
    if (i - j + 1 > best) { best = i - j + 1; bestStart = frames[j]; }
  }
  return { count: best, start: bestStart };
}

/**
 * Per block and frame: +1 / −1 when the block makes a counted transition up / down, else 0. Pure.
 * @returns {Int8Array[]} one array per frame (length gw*gh)
 */
function blockEvents(frames, { red = false } = {}) {
  const nb = frames[0].L.length;
  const ev = frames.map(() => new Int8Array(nb));
  for (let b = 0; b < nb; b++) {
    const tr = red
      ? transitions(frames.map((f) => f.R[b]), { delta: 20, satSeries: frames.map((f) => f.S?.[b] ?? 0) })
      : transitions(frames.map((f) => f.L[b]));
    for (const t of tr) if (t.counted) ev[t.frame][b] = t.dir;
  }
  return ev;
}

/**
 * Worst 1-second span over all (ww × wh)-block windows (sliding by one block). In each frame a window
 * "transitions" when the NET share of its blocks transitioning the same way (ups minus downs) is more than
 * 25% (WCAG's share of the 10° field). Consecutive same-direction window transitions count once, so a flash
 * whose blocks cross the threshold on neighbouring frames is one transition. Pure.
 */
function worstWindow(ev, { gw, gh, ww, wh, fps }) {
  const nx = gw - ww + 1;
  const ny = gh - wh + 1;
  const n = ev.length;
  const need = 0.25 * ww * wh;
  const lastDir = new Int8Array(nx * ny);
  const trans = Array.from({ length: nx * ny }, () => []);
  const sat = new Int32Array((gw + 1) * (gh + 1));
  for (let t = 0; t < n; t++) {
    const e = ev[t];
    let any = false;
    for (let i = 0; i < e.length; i++) if (e[i]) { any = true; break; }
    if (!any) continue;
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        sat[(y + 1) * (gw + 1) + x + 1] = e[y * gw + x] + sat[y * (gw + 1) + x + 1] + sat[(y + 1) * (gw + 1) + x] - sat[y * (gw + 1) + x];
      }
    }
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const net = sat[(y + wh) * (gw + 1) + x + ww] - sat[y * (gw + 1) + x + ww] - sat[(y + wh) * (gw + 1) + x] + sat[y * (gw + 1) + x];
        if (Math.abs(net) <= need) continue;
        const dir = net > 0 ? 1 : -1;
        const w = y * nx + x;
        if (dir === lastDir[w]) continue;
        lastDir[w] = dir;
        trans[w].push({ frame: t, dir, counted: true });
      }
    }
  }
  let best = { count: 0, start: 0, w: -1 };
  trans.forEach((tr, w) => {
    const m = maxInWindow(tr, fps);
    if (m.count > best.count) best = { ...m, w };
  });
  return {
    maxTransitionsPerSecond: best.count, maxFlashesPerSecond: Math.floor(best.count / 2), worstStartFrame: best.start,
    // window in fractions of the screen, for the report
    worstWindow: best.w < 0 ? null : { x: (best.w % nx) / gw, y: Math.floor(best.w / nx) / gh, w: ww / gw, h: wh / gh },
  };
}

/**
 * Analyze a frame sequence: frames [{L:number[], R?:number[], S?:number[], gw?, gh?}], one value
 * per block, row-major. Pure.
 * @returns {{frames, seconds, status, general, red, local, localRed, mean}}
 */
export function analyzeFlashes(frames, { fps = FPS, gw = frames[0]?.gw ?? GRID_W, gh = frames[0]?.gh ?? GRID_H } = {}) {
  const n = frames.length;
  if (!n) return { frames: 0, seconds: 0, status: 'pass', general: null, red: null, local: null, localRed: null, mean: null };
  const big = { gw, gh, fps, ww: Math.max(1, Math.round(gw / 3)), wh: Math.max(1, Math.round(gh / 3)) };
  const small = { gw, gh, fps, ww: Math.max(1, Math.round(gw / 6)), wh: Math.max(1, Math.round(gh / 6)) };
  const hasRed = !!frames[0].R;
  const ev = blockEvents(frames);
  const evRed = hasRed ? blockEvents(frames, { red: true }) : null;
  const general = worstWindow(ev, big);
  const red = hasRed ? worstWindow(evRed, big) : null;
  const local = worstWindow(ev, small);
  const localRed = hasRed ? worstWindow(evRed, small) : null;
  const whole = worstWindow(ev, { gw, gh, fps, ww: gw, wh: gh });
  const over = (r) => (r?.maxTransitionsPerSecond ?? 0) > 6;
  const status = over(general) || over(red) || over(whole) ? 'fail' : over(local) || over(localRed) ? 'warn' : 'pass';
  return { frames: n, seconds: n / fps, status, general, red, local, localRed, mean: whole };
}

/** Init script content that defines window.__playbotSample (add with context.addInitScript). */
export const SAMPLER_INIT = { content: `window.__playbotSample = ${sampleCanvasInPage.toString()};` };

/**
 * Drive the game for `frames` steps, sampling the canvas after every step.
 * `beforeStep(i)` can set input; `pace` (ms per frame, 0 = as fast as possible).
 * Returns {samples, textSamples, blank}
 */
export async function recordFrames(page, { frames = 180, beforeStep, pace = 0, onSample } = {}) {
  const samples = [];
  await page.evaluate(() => { window.__playbotFrames = []; window.__playbotChecks?.pauseRaf?.(); }).catch(() => {});
  const started = Date.now();
  try {
  for (let i = 0; i < frames; i++) {
    if (beforeStep) await beforeStep(i);
    const s = await page.evaluate(({ gw, gh }) => {
      window.__game.step(1);
      return window.__playbotSample({ gw, gh });
    }, { gw: GRID_W, gh: GRID_H }).catch(() => null);
    if (!s) break;
    samples.push(s);
    if (onSample) await onSample(i, s);
    if (pace) {
      const wait = started + (i + 1) * pace - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    }
  }
  } finally {
    await page.evaluate(() => window.__playbotChecks?.resumeRaf?.()).catch(() => {});
  }
  const blank = samples.length > 0 && samples.every((s) => s.L.every((v) => v === 0));
  return { samples, blank };
}

/** Start frame of the worst 1 s span that made the analysis fail/warn. Pure. */
export function flashWorstStart(a) {
  const over = (r) => (r?.maxTransitionsPerSecond ?? 0) > 6;
  for (const r of [a.general, a.red, a.mean, a.local, a.localRed]) if (over(r)) return r.worstStartFrame;
  return a.general?.worstStartFrame ?? 0;
}

/**
 * Save a contact sheet of the downsampled canvas frames [from, from+count) kept by the last
 * recordFrames() call (12 per row, frame numbers drawn in), as evidence for a flashing finding.
 * Returns the PNG file name or null.
 */
export async function saveContactSheet(page, outDir, name, from, count = FPS) {
  const url = await page.evaluate(async ({ from, count }) => {
    const frames = (window.__playbotFrames ?? []).slice(from, from + count);
    if (!frames.length) return null;
    const imgs = await Promise.all(frames.map((src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; })));
    const w = imgs[0]?.width ?? 128; const h = imgs[0]?.height ?? 96; const cols = 12; const rows = Math.ceil(imgs.length / cols);
    const c = document.createElement('canvas');
    c.width = cols * (w + 2); c.height = rows * (h + 2);
    const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
    g.font = 'bold 11px sans-serif';
    imgs.forEach((im, i) => {
      const x = (i % cols) * (w + 2); const y = Math.floor(i / cols) * (h + 2);
      if (im) g.drawImage(im, x, y);
      g.fillStyle = '#000'; g.fillRect(x, y, 30, 13); g.fillStyle = '#ff0'; g.fillText(String(from + i), x + 2, y + 11);
    });
    return c.toDataURL('image/png');
  }, { from, count }).catch(() => null);
  if (!url) return null;
  const { writeFileSync } = await import('node:fs');
  const file = `${name}.png`;
  writeFileSync(`${outDir}/${file}`, Buffer.from(url.split(',')[1], 'base64'));
  return file;
}

/** Fraction of blocks whose luminance changed by ≥ 0.1 between two samples. Pure. */
export function changedArea(a, b, delta = 0.1) {
  if (!a || !b) return 0;
  let n = 0;
  for (let i = 0; i < a.L.length; i++) if (Math.abs(a.L[i] - b.L[i]) >= delta) n++;
  return n / a.L.length;
}

/**
 * @param {{target, segment, analysis, screenshot, changeShots:[{frame, screenshot}], blank}[]} segments
 */
export function evaluateFlashing(segments, { finding }) {
  const out = [];
  for (const s of segments) {
    const a = s.analysis;
    if (!a || !a.frames) {
      out.push(finding({ check: 'flashing', rule: 'R15', status: 'info', target: s.target, summary: `${s.segment}: no canvas frames sampled`, screenshot: s.screenshot, key: `${s.target}:${s.segment}:none`, details: {} }));
      continue;
    }
    if (s.blank) {
      out.push(finding({ check: 'flashing', rule: 'R15', status: 'warn', target: s.target, summary: `${s.segment}: canvas read back all black (${a.frames} frames); flashing not measurable`, screenshot: s.screenshot, key: `${s.target}:${s.segment}:blank`, details: a }));
      continue;
    }
    const g = a.general; const r = a.red;
    const worstFrame = flashWorstStart(a);
    const near = s.sheet ? { screenshot: s.sheet } : (s.changeShots ?? []).filter((c) => c.screenshot)
      .sort((x, y) => Math.abs(x.frame - worstFrame) - Math.abs(y.frame - worstFrame))[0];
    const pct = (w) => (w ? ` at ${Math.round(w.x * 100)}%,${Math.round(w.y * 100)}%` : '');
    const fl = (x) => ((x?.maxTransitionsPerSecond ?? 0) / 2).toFixed(1).replace(/\.0$/, '');
    const summary = `${s.segment} (${a.seconds.toFixed(1)} s @60fps): max ${fl(g)} flashes/s over a 1/3-screen area${pct(g.worstWindow)}, ` +
      `red ${fl(r)}/s, whole frame ${fl(a.mean)}/s, local 1/6-screen ${fl(a.local)}/s${pct(a.local?.worstWindow)} (limit 3/s)`;
    out.push(finding({ check: 'flashing', rule: 'R15', status: a.status, target: s.target, summary,
      screenshot: a.status === 'pass' ? undefined : (near?.screenshot ?? s.screenshot), key: `${s.target}:${s.segment}`,
      details: { ...a, changeShots: s.changeShots, contactSheet: s.sheet ?? null,
        note: 'Canvas only; DOM overlays are not sampled. The contact sheet shows the worst 1 s window (60 frames, 1/60 s apart, downscaled).' } }));
  }
  return out;
}
