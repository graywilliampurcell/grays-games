// `playbot play <game>` and `playbot calibrate mazle`: run the bots, collect
// the numbers (lib/metrics.js), write play.json / calibrate.json + heatmap PNGs.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runPool, openGame, measureFps, FPS_VIEWPORT } from './session.js';
import { mazleSolver, mazleMonkey, mazleExplorer, mazleKid } from './mazle.js';
import { rollySolver, rollyMonkey, rollyExplorer, rollyKid, modeUrl } from './rolly.js';
import { persona, parseBrackets } from './personas.js';
import { loadCarver, loadLevels } from './carver.js';
import { analyzeLayout, iteration1Layouts, parseLayout } from './mazeGrid.js';
import {
  summarizeRuns, difficultyVerdict, trackVerdict, mergeDwell, heatmapPNG, fmtS, round,
} from '../metrics.js';

const log = (...a) => console.error('[play]', ...a);

// ---------------------------------------------------------------- Mazle layouts

/**
 * --layout level1 (default; also level<N> from levels.js) | iteration1 (5 random
 * 12 x 12 mazes, or --layout-seeds a,b,c) → [{ name, rows, analysis }]
 */
export async function mazleLayouts(spec = 'level1', { count = 5, seeds = null } = {}) {
  const carver = await loadCarver();
  const levels = await loadLevels();
  const out = [];
  for (const part of String(spec).split(',')) {
    const s = part.trim().toLowerCase();
    if (s === 'iteration1' || s === 'iter1') {
      // --layout-seeds picks specific mazes (a seed without a valid spike spot moves to the next one)
      const layouts = seeds
        ? seeds.map((sd) => iteration1Layouts(carver, 1, sd)[0])
        : iteration1Layouts(carver, count);
      for (const l of layouts) out.push({ name: `Iteration 1 (seed ${l.seed})`, group: 'Iteration 1', seed: l.seed, rows: l.layout });
    } else {
      const m = s.match(/^level(\d+)$/);
      const idx = m ? Number(m[1]) - 1 : NaN;
      if (!levels[idx]) throw new Error(`Unknown layout "${part}" (use level1..level${levels.length} or iteration1)`);
      out.push({ name: levels[idx].name, group: idx === 0 ? 'Iteration 2 (Level 1)' : levels[idx].name, rows: levels[idx].layout, builtin: idx });
    }
  }
  for (const l of out) l.analysis = analyzeLayout(l.rows, carver.analyzeMaze);
  return out;
}

// ---------------------------------------------------------------- heatmaps

function mazleHeatmap(rows, dwell) {
  const grid = parseLayout(rows);
  const markers = [];
  if (grid.start) markers.push({ i: grid.start.bx, j: grid.start.bz, color: [30, 90, 220] });
  if (grid.spike) markers.push({ i: grid.spike.bx, j: grid.spike.bz, color: [120, 120, 130] });
  if (grid.door) markers.push({ i: grid.door.block.x, j: grid.door.block.z, color: [122, 74, 34] });
  return heatmapPNG({
    cols: grid.w,
    rows: grid.h,
    scale: 10,
    value: (i, j) => dwell[`${i},${j}`] ?? 0,
    base: (i, j) => (grid.isWall(i, j) && !(grid.door && grid.door.block.x === i && grid.door.block.z === j) ? [70, 74, 80] : null),
    markers,
  });
}

/** Heatmap of "x,z" bins (any integer bins), cropped to where anything happened. */
function binHeatmap(dwell, scale = 4) {
  const keys = Object.keys(dwell);
  if (!keys.length) return null;
  const pts = keys.map((k) => k.split(',').map(Number));
  const minX = Math.min(...pts.map((p) => p[0])) - 1;
  const minZ = Math.min(...pts.map((p) => p[1])) - 1;
  const maxX = Math.max(...pts.map((p) => p[0])) + 1;
  const maxZ = Math.max(...pts.map((p) => p[1])) + 1;
  return heatmapPNG({
    cols: maxX - minX + 1,
    rows: maxZ - minZ + 1,
    scale,
    value: (i, j) => dwell[`${i + minX},${j + minZ}`] ?? 0,
  });
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const strip = ({ dwell, cellDwell, ...rest }) => rest;

function writePng(outDir, name, buf, files) {
  if (!buf) return;
  const f = `${slug(name)}.png`;
  writeFileSync(join(outDir, f), buf);
  files.push(f);
}

function progress(label) {
  let last = 0;
  return (done, total, r) => {
    if (r?.error) log(`${label}: task failed: ${String(r.error).split('\n')[0]}`);
    const now = Date.now();
    if (done === total || now - last > 5000) {
      log(`${label}: ${done}/${total}`);
      last = now;
    }
  };
}

// ---------------------------------------------------------------- fps

async function fpsRun(config, url, input, { throttle = 4, seconds = 5 } = {}) {
  const [res] = await runPool([async ({ browser }) => {
    const s = await openGame(browser, url, { viewport: FPS_VIEWPORT, skipDraw: false });
    try {
      // settle first (shaders compile on the first frames)
      await s.page.evaluate(() => window.__game.step(10));
      const r = await measureFps(s.page, { throttle, seconds, input });
      return { ...r, errors: s.errors(), verdict: r.fps >= 30 ? 'ok' : r.fps >= 20 ? 'warn' : 'slow' };
    } finally {
      await s.close();
    }
  }], { config, browsers: 1, perBrowser: 1 });
  return res;
}

// ---------------------------------------------------------------- play: mazle

function kidGroupSummary(runs, p, optimalLength) {
  const capS = p.session_minutes[1] * 60;
  const summary = summarizeRuns(runs, { capS, optimalLength });
  return { summary, verdict: difficultyVerdict(summary, p.session_minutes) };
}

export async function playMazle({ config, baseUrl, outDir, bots, brackets, seeds, layoutSpec, seed, pool }) {
  const layouts = await mazleLayouts(layoutSpec, { count: 5 });
  const result = { game: 'mazle', layouts: layouts.map(({ rows, ...l }) => l), heatmaps: [] };
  const tasks = [];
  const keyed = [];
  const add = (key, fn) => { keyed.push(key); tasks.push(fn); };
  const seedList = seed ? [Number(seed)] : Array.from({ length: seeds }, (_, i) => i + 1);
  for (const L of layouts) {
    const layout = L.builtin === 0 ? null : { name: L.name, rows: L.rows };
    if (bots.includes('solver')) add({ bot: 'solver', layout: L.name }, ({ browser }) => mazleSolver({ browser, baseUrl, layout }));
    if (bots.includes('monkey')) {
      for (const s of seedList.slice(0, L.builtin === 0 ? seedList.length : 1)) {
        add({ bot: 'monkey', layout: L.name }, ({ browser }) => mazleMonkey({ browser, baseUrl, layout, seed: s }));
      }
    }
    if (bots.includes('explorer')) add({ bot: 'explorer', layout: L.name }, ({ browser }) => mazleExplorer({ browser, baseUrl, layout, seed: seedList[0] }));
    if (bots.includes('kids')) {
      for (const b of brackets) {
        const p = persona(b);
        for (const s of seedList) add({ bot: 'kid', layout: L.name, bracket: b }, ({ browser }) => mazleKid({ browser, baseUrl, layout, persona: p, seed: s }));
      }
    }
  }
  log(`mazle: ${tasks.length} bot runs on ${layouts.length} layout(s)`);
  const res = await runPool(tasks, { config, ...pool, onDone: progress('mazle') });
  const runs = res.map((r, i) => ({ ...keyed[i], ...r }));

  result.solver = runs.filter((r) => r.bot === 'solver').map(strip);
  result.monkey = runs.filter((r) => r.bot === 'monkey');
  result.explorer = runs.filter((r) => r.bot === 'explorer').map(strip);
  for (const e of runs.filter((r) => r.bot === 'explorer' && r.dwell)) {
    const L = layouts.find((l) => l.name === e.layout);
    writePng(outDir, `heatmap-explorer-${L.name}`, mazleHeatmap(L.rows, e.dwell), result.heatmaps);
  }
  if (bots.includes('kids')) {
    result.kids = {};
    for (const b of brackets) {
      const p = persona(b);
      const byLayout = {};
      for (const L of layouts) {
        const rs = runs.filter((r) => r.bot === 'kid' && r.bracket === b && r.layout === L.name);
        byLayout[L.name] = { ...kidGroupSummary(rs, p, L.analysis.optimalPathLength), runs: rs.map(strip) };
        writePng(outDir, `heatmap-kids-${b}-${L.name}`, mazleHeatmap(L.rows, mergeDwell(rs.map((r) => r.dwell))), result.heatmaps);
      }
      result.kids[b] = { persona: p, byLayout };
      // With several layouts of one group (Iteration 1), also a pooled summary
      const groups = [...new Set(layouts.map((l) => l.group))];
      result.kids[b].byGroup = Object.fromEntries(groups.map((g) => {
        const ls = layouts.filter((l) => l.group === g);
        const rs = runs.filter((r) => r.bot === 'kid' && r.bracket === b && ls.some((l) => l.name === r.layout));
        const opt = ls.reduce((s, l) => s + l.analysis.optimalPathLength, 0) / ls.length;
        return [g, kidGroupSummary(rs.map((r) => ({ ...r, pathLength: r.pathLength * opt / ls.find((l) => l.name === r.layout).analysis.optimalPathLength })), p, opt)];
      }));
    }
  }
  if (bots.includes('fps')) {
    log('mazle: frame rate at real speed, CPU 4x slower');
    result.fps = await fpsRun(config, `${baseUrl}?test=1`, { forward: true, turnLeft: true });
  }
  result.errors = runs.filter((r) => r.error).map((r) => ({ bot: r.bot, layout: r.layout, error: r.error }));
  result.passed = result.errors.length === 0
    && result.solver.every((r) => r.ok)
    && result.monkey.every((r) => r.ok)
    && result.explorer.every((r) => r.ok);
  return result;
}

// ---------------------------------------------------------------- play: rolly-bally

export async function playRolly({ config, baseUrl, outDir, bots, brackets, seeds, seed, pool, kidCapS = 300 }) {
  const result = { game: 'rolly-bally', heatmaps: [] };
  const tasks = [];
  const keyed = [];
  const add = (key, fn) => { keyed.push(key); tasks.push(fn); };
  const seedList = seed ? [Number(seed)] : Array.from({ length: seeds }, (_, i) => i + 1);
  if (bots.includes('solver')) {
    add({ bot: 'solver', mode: 'test-track' }, ({ browser }) => rollySolver({ browser, baseUrl, mode: 'test-track' }));
    for (let d = 1; d <= 5; d++) add({ bot: 'solver', mode: 'race', d }, ({ browser }) => rollySolver({ browser, baseUrl, mode: 'race', d, seed: seedList[0] }));
  }
  if (bots.includes('monkey')) {
    for (const mode of ['test-track', 'race', 'playground']) {
      for (const s of seedList.slice(0, 2)) add({ bot: 'monkey', mode }, ({ browser }) => rollyMonkey({ browser, baseUrl, mode, seed: s }));
    }
  }
  if (bots.includes('explorer')) add({ bot: 'explorer', mode: 'playground' }, ({ browser }) => rollyExplorer({ browser, baseUrl, seed: seedList[0] }));
  if (bots.includes('kids')) {
    for (const b of brackets) {
      const p = persona(b);
      for (const mode of ['test-track', 'race']) {
        for (const s of seedList) add({ bot: 'kid', mode, bracket: b }, ({ browser }) => rollyKid({ browser, baseUrl, mode, persona: p, seed: s, capS: kidCapS }));
      }
    }
  }
  log(`rolly-bally: ${tasks.length} bot runs`);
  const res = await runPool(tasks, { config, ...pool, onDone: progress('rolly-bally') });
  const runs = res.map((r, i) => ({ ...keyed[i], ...r }));
  result.solver = runs.filter((r) => r.bot === 'solver').map(strip);
  result.monkey = runs.filter((r) => r.bot === 'monkey');
  result.explorer = runs.filter((r) => r.bot === 'explorer').map(strip);
  for (const e of runs.filter((r) => r.bot === 'explorer' && r.dwell)) writePng(outDir, 'heatmap-explorer-playground', binHeatmap(e.dwell, 12), result.heatmaps);
  if (bots.includes('kids')) {
    result.kids = {};
    for (const b of brackets) {
      const p = persona(b);
      result.kids[b] = { persona: p, byMode: {} };
      for (const mode of ['test-track', 'race']) {
        const rs = runs.filter((r) => r.bot === 'kid' && r.bracket === b && r.mode === mode);
        const summary = summarizeRuns(rs, { capS: kidCapS });
        result.kids[b].byMode[mode] = {
          d: mode === 'race' ? p.race_level : undefined,
          summary,
          verdict: trackVerdict(summary),
          places: rs.map((r) => r.place ?? null),
          runs: rs.map(strip),
        };
        writePng(outDir, `heatmap-kids-${b}-${mode}`, binHeatmap(mergeDwell(rs.map((r) => r.dwell))), result.heatmaps);
      }
    }
  }
  if (bots.includes('fps')) {
    log('rolly-bally: frame rate at real speed, CPU 4x slower');
    result.fps = await fpsRun(config, modeUrl(baseUrl, 'test-track'), { x: 0, y: 1 });
  }
  result.errors = runs.filter((r) => r.error).map((r) => ({ bot: r.bot, mode: r.mode, error: r.error }));
  result.passed = result.errors.length === 0
    && result.solver.every((r) => r.ok)
    && result.monkey.every((r) => r.ok)
    && result.explorer.every((r) => r.ok);
  return result;
}

// ---------------------------------------------------------------- printing

export function printPlay(result) {
  const lines = [];
  const ok = (b) => (b ? 'PASS' : 'FAIL');
  for (const r of result.solver ?? []) {
    lines.push(`${ok(r.ok)} solver ${r.layout ?? r.mode}${r.d ? ` d=${r.d}` : ''}: ${r.won ? `won in ${fmtS(r.timeToWin)}` : 'did not win'}` +
      `${r.pathVsOptimal ? `, path ${r.pathVsOptimal}x optimal` : ''}${r.fails ? `, fails ${r.fails}` : ''}${r.place ? `, place ${r.place}` : ''}${r.error ? ` ERROR ${r.error.split('\n')[0]}` : ''}`);
  }
  for (const r of result.monkey ?? []) {
    lines.push(`${ok(r.ok)} monkey ${r.layout ?? r.mode} seed ${r.seed}: ${r.violations?.length ?? '?'} invariant violations, ${r.softLocks?.length ?? '?'} soft-locks, ${r.errors?.length ?? '?'} page errors` +
      `${r.coverage !== undefined ? `, coverage ${(r.coverage * 100).toFixed(0)}%` : ''}${r.error ? ` ERROR ${r.error.split('\n')[0]}` : ''}`);
    for (const v of (r.violations ?? []).slice(0, 3)) lines.push(`    ${v.kind} at ${v.t}s ${JSON.stringify(v.pos ?? '')}`);
  }
  for (const r of result.explorer ?? []) {
    lines.push(`${ok(r.ok)} explorer ${r.layout ?? r.mode}: coverage ${(r.coverage * 100).toFixed(1)}% (${r.reached}/${r.floorBlocks ?? r.terrain?.bins})` +
      `${r.unreachedFloorCount !== undefined ? `, floor never reached ${r.unreachedFloorCount} (${r.unreachedFloor.map((b) => `${b.x},${b.z}${b.why ? ` ${b.why}` : ''}`).slice(0, 4).join('; ')})` : ''}` +
      `, stuck spots ${r.stuckSpots?.length ?? '?'}${r.error ? ` ERROR ${r.error.split('\n')[0]}` : ''}`);
  }
  if (result.kids) {
    lines.push('', 'Kid personas:');
    for (const [b, k] of Object.entries(result.kids)) {
      const groups = k.byGroup ?? k.byMode;
      for (const [g, v] of Object.entries(groups)) {
        const s = v.summary;
        lines.push(`  ${b.padEnd(5)} ${g.padEnd(22)} win ${(s.winRate * 100).toFixed(0).padStart(3)}%  median ${fmtS(s.medianTimeToWin).padStart(7)}  fails/run ${String(s.failsMean).padStart(5)}  stuck/run ${String(s.stuckEpisodesPerRun).padStart(4)}  → ${v.verdict.verdict}`);
      }
    }
  }
  if (result.fps) lines.push('', `Frame rate (CPU 4x slower, ${result.fps.viewport?.width}x${result.fps.viewport?.height}, SwiftShader): ${result.fps.fps} fps, p95 frame ${result.fps.p95FrameMs} ms → ${result.fps.verdict}`);
  for (const e of result.errors ?? []) lines.push(`ERROR ${e.bot} ${e.layout ?? e.mode ?? ''}: ${String(e.error).split('\n')[0]}`);
  return lines.join('\n');
}

// ---------------------------------------------------------------- calibrate

/**
 * Kid personas on Iteration 1 (12 x 12 random mazes, several seeds) vs
 * Iteration 2 (Level 1, 7 x 7). Gray's playtest: Iteration 1 "too hard, took
 * too long"; Iteration 2 is the easier fix. Returns rows for the table.
 */
export async function calibrateMazle({ config, baseUrl, outDir, brackets, kidSeeds = 20, iter1Count = 5, pool }) {
  const level1 = await mazleLayouts('level1');
  const iter1 = await mazleLayouts('iteration1', { count: iter1Count });
  const conditions = [
    { label: 'Iteration 1 (12x12)', layouts: iter1 },
    { label: 'Iteration 2 (Level 1, 7x7)', layouts: level1 },
  ];
  const tasks = [];
  const keyed = [];
  for (const c of conditions) {
    const perLayout = Math.max(1, Math.round(kidSeeds / c.layouts.length));
    for (const L of c.layouts) {
      const layout = L.builtin === 0 ? null : { name: L.name, rows: L.rows };
      keyed.push({ bot: 'solver', cond: c.label, layout: L.name });
      tasks.push(({ browser }) => mazleSolver({ browser, baseUrl, layout }));
      for (const b of brackets) {
        const p = persona(b);
        for (let s = 1; s <= perLayout; s++) {
          keyed.push({ bot: 'kid', cond: c.label, layout: L.name, bracket: b });
          tasks.push(({ browser }) => mazleKid({ browser, baseUrl, layout, persona: p, seed: s }));
        }
      }
    }
  }
  log(`calibrate: ${tasks.length} runs`);
  const started = Date.now();
  const res = await runPool(tasks, { config, ...pool, onDone: progress('calibrate') });
  const runs = res.map((r, i) => ({ ...keyed[i], ...r }));
  const heatmaps = [];
  const rows = [];
  for (const b of brackets) {
    const p = persona(b);
    for (const c of conditions) {
      const rs = runs.filter((r) => r.bot === 'kid' && r.bracket === b && r.cond === c.label);
      // path length relative to each layout's own optimum
      const opt = (name) => c.layouts.find((l) => l.name === name).analysis.optimalPathLength;
      const summary = summarizeRuns(rs.map((r) => ({ ...r, pathLength: r.pathLength / opt(r.layout) })), { capS: p.session_minutes[1] * 60, optimalLength: 1 });
      rows.push({ bracket: b, condition: c.label, summary, verdict: difficultyVerdict(summary, p.session_minutes) });
      for (const L of c.layouts) {
        const lr = rs.filter((r) => r.layout === L.name);
        writePng(outDir, `heatmap-${b}-${L.name}`, mazleHeatmap(L.rows, mergeDwell(lr.map((r) => r.dwell))), heatmaps);
      }
    }
  }
  const layoutFacts = conditions.flatMap((c) => c.layouts.map((L) => ({
    condition: c.label,
    layout: L.name,
    cells: `${L.analysis.cells.cols}x${L.analysis.cells.rows}`,
    solutionCells: L.analysis.cells.solutionLength,
    deadEnds: L.analysis.cells.deadEnds,
    maxBranchDepth: L.analysis.cells.maxBranchDepth,
    junctions: L.analysis.cells.junctions,
    spikeFromStart: L.analysis.cells.spike?.fromStart ?? null,
    optimalPath: L.analysis.optimalPathLength,
    solverTime: runs.find((r) => r.bot === 'solver' && r.layout === L.name)?.timeToWin ?? null,
  })));
  // The check: for 5-7 (Gray's bracket in the plan), is Iteration 1 harder?
  const find = (b, cond) => rows.find((r) => r.bracket === b && r.condition.startsWith(cond));
  const checks = {};
  for (const b of brackets) {
    const i1 = find(b, 'Iteration 1');
    const i2 = find(b, 'Iteration 2');
    if (!i1 || !i2) continue;
    const s1 = i1.summary;
    const s2 = i2.summary;
    // 'yes' = Iteration 1 is harder on this measure, 'tie' = equal (e.g. both medians "never"), 'no' = easier
    const cmp = (a, b2) => (a > b2 ? 'yes' : a === b2 ? 'tie' : 'no');
    const harder = {
      medianTimeToWin: cmp(s1.medianTimeToWin, s2.medianTimeToWin),
      escapeRate: cmp(s2.winRate, s1.winRate),
      stuckEpisodesPerRun: cmp(s1.stuckEpisodesPerRun, s2.stuckEpisodesPerRun),
      meanTimeToWinOfWinners: cmp(s1.meanTimeToWinOfWinners, s2.meanTimeToWinOfWinners),
    };
    const vals = Object.values(harder);
    checks[b] = {
      iteration1Harder: !vals.includes('no') && vals.includes('yes'),
      harder,
      verdicts: { 'Iteration 1': i1.verdict.verdict, 'Iteration 2': i2.verdict.verdict },
      matchesGray: i1.verdict.verdict === 'too hard' && i2.verdict.verdict !== 'too hard',
    };
  }
  return {
    game: 'mazle',
    wallSeconds: round((Date.now() - started) / 1000, 10),
    brackets,
    kidRunsPerCondition: kidSeeds,
    layoutFacts,
    rows,
    checks,
    runs: runs.map(strip),
    errors: runs.filter((r) => r.error).map((r) => ({ bot: r.bot, layout: r.layout, error: r.error })),
    heatmaps,
  };
}

export function printCalibrate(cal) {
  const lines = [];
  lines.push('Layouts:');
  lines.push('  condition                   layout                   cells  path  dead-ends  max-branch  junctions  spike  optimal  solver');
  for (const f of cal.layoutFacts) {
    lines.push(`  ${f.condition.padEnd(27)} ${f.layout.padEnd(24)} ${f.cells.padStart(5)} ${String(f.solutionCells).padStart(5)} ${String(f.deadEnds).padStart(10)} ${String(f.maxBranchDepth).padStart(11)} ${String(f.junctions).padStart(10)} ${String(f.spikeFromStart).padStart(6)} ${String(f.optimalPath).padStart(8)} ${fmtS(f.solverTime).padStart(7)}`);
  }
  lines.push('', 'Kid personas (time cap = bracket session max; stuck = no new cell for the bracket hint time):');
  lines.push('  bracket  condition                   runs  escaped  median-time  mean(winners)  spikes/run  retry-rate  stuck/run  quits  bumps/min  path/opt  verdict');
  for (const r of cal.rows) {
    const s = r.summary;
    lines.push(`  ${r.bracket.padEnd(8)} ${r.condition.padEnd(27)} ${String(s.runs).padStart(4)} ${`${(s.winRate * 100).toFixed(0)}%`.padStart(8)} ${fmtS(s.medianTimeToWin).padStart(12)} ${fmtS(s.meanTimeToWinOfWinners).padStart(14)} ${String(s.failsMean).padStart(11)} ${String(s.retryRate).padStart(11)} ${String(s.stuckEpisodesPerRun).padStart(10)} ${String(s.quits).padStart(6)} ${String(s.bumpsPerMinute).padStart(10)} ${String(s.pathVsOptimal).padStart(9)}  ${r.verdict.verdict}`);
  }
  lines.push('', 'Calibration check (does the bot agree with Gray: Iteration 1 too hard, Iteration 2 easier?):');
  for (const [b, c] of Object.entries(cal.checks)) {
    lines.push(`  ${b.padEnd(6)} Iteration 1 harder: ${c.iteration1Harder ? 'YES' : 'NO'} ` +
      `(longer median time ${c.harder.medianTimeToWin}, lower escape rate ${c.harder.escapeRate}, more stuck ${c.harder.stuckEpisodesPerRun}, longer for those who escaped ${c.harder.meanTimeToWinOfWinners}); ` +
      `verdicts: Iteration 1 "${c.verdicts['Iteration 1']}", Iteration 2 "${c.verdicts['Iteration 2']}" → ${c.matchesGray ? 'matches Gray' : 'does NOT match Gray'}`);
  }
  if (cal.errors.length) lines.push('', `${cal.errors.length} run(s) failed: ${cal.errors.map((e) => String(e.error).split('\n')[0]).slice(0, 3).join(' | ')}`);
  return lines.join('\n');
}

export function writeJson(outDir, name, obj) {
  mkdirSync(outDir, { recursive: true });
  const f = join(outDir, name);
  writeFileSync(f, JSON.stringify(obj, (k, v) => (v === Infinity ? 'Infinity' : v), 2));
  return f;
}

export { parseBrackets };
