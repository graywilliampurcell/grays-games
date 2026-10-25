// Level 63 geyser + balloon checks: node t63.mjs (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
const idx = 62;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const load = async () => { await page.goto(`${BASE}/?test=1&level=${idx}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => window.__game?.ready); };
const shot = (name) => page.screenshot({ path: `${SP}l63-${name}.png` });
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info)); };
const E = -Math.PI / 2, S = Math.PI;

await load();
const st0 = await page.evaluate(() => { const s = window.__game.state(); return { geysers: s.geysers, platforms: s.platforms.length, vents: s.vents.length, spike: s.spike, start: s.start }; });
console.log(JSON.stringify(st0));
check('one geyser, one gap, no vents, no coals', st0.geysers.length === 1 && st0.platforms === 1 && st0.vents === 0 && !st0.spike, st0);

// 1. Timer while far away: quiet 3 s, erupt 3 s
const timing = await page.evaluate(() => {
    const g = window.__game; const log = []; let last = 'quiet';
    for (let i = 0; i < 900; i++) { const st = g.step(1); const p = st.geysers[0].phase; if (p !== last) { log.push({ p, t: st.t }); last = p; } }
    return log;
});
check('erupts 3 s, quiet 3 s', timing.length >= 3 && Math.abs(timing[1].t - timing[0].t - 3) < 0.1 && Math.abs(timing[2].t - timing[1].t - 3) < 0.1, timing);

// 2. Walk into it while erupting: Ouch, back to the start
await load();
const hit = await page.evaluate(({ S }) => {
    const g = window.__game; g.clearEvents();
    g.teleport({ x: 2.5, z: 34.5, yaw: S });
    for (let i = 0; i < 600 && g.state().geysers[0].phase !== 'erupt'; i++) g.step(1);
    g.step(20); g.setInput({ forward: true });
    let msg = ''; let st;
    for (let i = 0; i < 120; i++) { st = g.step(1); const m = document.getElementById('message'); if (!m.hidden && m.textContent) { msg = m.textContent; break; } }
    g.clearInput();
    return { msg, pos: st.pos, start: st.start, events: g.events.map((e) => e.type + (e.what ? ':' + e.what : '')) };
}, { S });
check('erupting geyser: Ouch and back to the start', /lava geyser/.test(hit.msg) && Math.hypot(hit.pos.x - hit.start.x, hit.pos.z - hit.start.z) < 0.5, hit);

// 3. Stand in it when its time is up: it waits, then erupts once you've left
await load();
const wait = await page.evaluate(({ S }) => {
    const g = window.__game; g.clearEvents();
    // wait until an eruption ends, then step into the cell
    for (let i = 0; i < 600 && g.state().geysers[0].phase !== 'erupt'; i++) g.step(1);
    for (let i = 0; i < 600 && g.state().geysers[0].phase !== 'quiet'; i++) g.step(1);
    g.teleport({ x: 2.5, z: 38.5, yaw: S });
    g.step(60 * 5); // 5 s in the cell
    const during = g.state().geysers[0];
    g.setInput({ forward: true });
    let st; let left = null; let erupted = null;
    for (let i = 0; i < 200; i++) {
        st = g.step(1);
        if (left === null && st.pos.z - 0.4 > 40) left = st.t;
        if (erupted === null && st.geysers[0].phase === 'erupt') erupted = { t: st.t, z: st.pos.z };
        if (erupted && i > 120) break;
    }
    g.clearInput();
    return { during, left, erupted, hits: g.events.filter((e) => e.type === 'spike').length };
}, { S });
check('waits while you are in it, erupts after you leave, no ouch', wait.during.phase === 'quiet' && wait.during.waiting && wait.erupted && wait.erupted.z - 0.4 >= 40 && wait.hits === 0, wait);

// 4. Walk straight through while quiet
await load();
const through = await page.evaluate(({ S }) => {
    const g = window.__game; g.clearEvents();
    g.teleport({ x: 2.5, z: 33.5, yaw: S });
    for (let i = 0; i < 600 && g.state().geysers[0].phase !== 'erupt'; i++) g.step(1);
    for (let i = 0; i < 600 && g.state().geysers[0].phase !== 'quiet'; i++) g.step(1);
    g.setInput({ forward: true }); let st;
    for (let i = 0; i < 90; i++) st = g.step(1);
    g.clearInput();
    return { pos: st.pos, hits: g.events.filter((e) => e.type === 'spike').length };
}, { S });
check('walk through while quiet is safe', through.pos.z > 41 && through.hits === 0, through);

// 5. Screenshots: looking at it from the approach, quiet and erupting
await load();
await page.evaluate(({ S }) => { const g = window.__game; g.teleport({ x: 2.5, z: 30.5, yaw: S }); for (let i = 0; i < 600 && g.state().geysers[0].phase !== 'quiet'; i++) g.step(1); g.step(30); g.render(); }, { S });
await shot('a-quiet');
await page.evaluate(() => { const g = window.__game; for (let i = 0; i < 600 && g.state().geysers[0].phase !== 'erupt'; i++) g.step(1); g.step(40); g.render(); });
await shot('b-erupting');
await page.evaluate(() => { const g = window.__game; g.teleport({ x: 10.5, z: 26.5, yaw: Math.PI * 0.75 }); g.step(1); g.render(); });
await shot('c-over-walls');

// 6. Balloon ride east across the bottom row
await load();
const ride = await page.evaluate(({ E }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 14.5, z: 42.5, yaw: E }); g.setInput({ forward: true });
    const log = []; let last = null; let st; let fell = false;
    for (let i = 0; i < 1400; i++) {
        st = g.step(1); const p = st.platforms[0];
        if (p.phase === 'wait') g.clearInput();
        if (p.phase !== last) { log.push({ phase: p.phase, t: st.t, x: st.pos.x }); last = p.phase; }
        if (g.events.some((e) => e.type === 'fall')) fell = true;
        if (log.length > 6 && p.phase === 'rest' && !st.shoved) break;
    }
    return { log, fell, pos: st.pos };
}, { E });
check('balloon carries you over the lava', !ride.fell && ride.pos.x > 36 && ride.pos.x < 38.5, ride);

console.log('errors', errors);
console.log(results.every(Boolean) && !errors.length ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
