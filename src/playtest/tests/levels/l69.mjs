// Level 69 checks: two balloons + two geysers. node t69.mjs (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
import { LEVELS } from '../../js/levels.js';
import { analyzeMaze } from '../../js/mazeCarver.js';
const SP = SHOTS;
const idx = 68;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const load = async () => { await page.goto(`${BASE}/?test=1&level=${idx}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => window.__game?.ready); };
const shot = (name) => page.screenshot({ path: `${SP}l69-${name}.png` });
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info)); };
const E = -Math.PI / 2, W = Math.PI / 2, N = 0;
check('level 69 entry', LEVELS[idx].name === 'Level 69' && LEVELS.length === 69, LEVELS[idx].name);
await load();
const st0 = await page.evaluate(() => { const s = window.__game.state(); return { geysers: s.geysers, platforms: s.platforms, vents: s.vents.length, spike: s.spike, rows: s.spikeRows, start: s.start }; });
console.log(JSON.stringify(st0).slice(0, 1500));
check('two balloons, two geysers, nothing else', st0.geysers.length === 2 && st0.platforms.length === 2 && st0.vents === 0 && !st0.spike && (st0.rows ?? []).length === 0, { g: st0.geysers.length, p: st0.platforms.length, v: st0.vents, s: st0.spike, r: st0.rows });
const timing = await page.evaluate(() => {
    const g = window.__game; const log = [[], []]; const last = ['quiet', 'quiet'];
    for (let i = 0; i < 1200; i++) { const st = g.step(1); st.geysers.forEach((q, n) => { if (q.phase !== last[n]) { log[n].push({ p: q.phase, t: st.t }); last[n] = q.phase; } }); }
    return log;
});
const per = (l) => l.length >= 3 && Math.abs(l[1].t - l[0].t - 3) < 0.1 && Math.abs(l[2].t - l[1].t - 3) < 0.1;
check('each geyser erupts 3 s / quiet 3 s, 1.5 s apart', per(timing[0]) && per(timing[1]) && Math.abs(Math.abs(timing[0][0].t - timing[1][0].t) - 1.5) < 0.1, timing);
const G = [[0, { x: 30.5, z: 42.5 }, E, (p) => p.x > 37], [1, { x: 42.5, z: 38.5 }, N, (p) => p.z < 31]];
for (const [n, from, yaw] of G) {
    await load();
    const hit = await page.evaluate(({ from, yaw }) => {
        const g = window.__game; g.clearEvents(); g.teleport({ ...from, yaw });
        const mine = () => g.state().geysers.find((q) => Math.abs((q.minX + q.maxX) / 2 - from.x) < 3 || Math.abs((q.minZ + q.maxZ) / 2 - from.z) < 3);
        for (let i = 0; i < 600 && mine().phase !== 'erupt'; i++) g.step(1);
        g.step(20); g.setInput({ forward: true });
        let msg = ''; let st;
        for (let i = 0; i < 120; i++) { st = g.step(1); const m = document.getElementById('message'); if (!m.hidden && m.textContent) { msg = m.textContent; break; } }
        g.clearInput(); return { msg, pos: st.pos, start: st.start };
    }, { from, yaw });
    check(`geyser ${n + 1}: Ouch and back to start`, /lava geyser/.test(hit.msg) && Math.hypot(hit.pos.x - hit.start.x, hit.pos.z - hit.start.z) < 0.5, hit);
}
for (const [n, from, yaw, done] of G) {
    await load();
    const r = await page.evaluate(({ from, yaw }) => {
        const g = window.__game; g.clearEvents(); g.teleport({ ...from, yaw });
        const mine = () => g.state().geysers.find((q) => Math.abs((q.minX + q.maxX) / 2 - from.x) < 3 || Math.abs((q.minZ + q.maxZ) / 2 - from.z) < 3);
        for (let i = 0; i < 600 && mine().phase !== 'erupt'; i++) g.step(1);
        for (let i = 0; i < 600 && mine().phase !== 'quiet'; i++) g.step(1);
        g.setInput({ forward: true }); let st;
        for (let i = 0; i < 90; i++) st = g.step(1);
        g.clearInput(); return { pos: st.pos, hits: g.events.filter((e) => e.type === 'spike').length };
    }, { from, yaw });
    check(`geyser ${n + 1}: walk through while quiet`, done(r.pos) && r.hits === 0, r);
}
// Balloon rides: west bank of the top-row gap (heading east), east bank of the row-1 gap (heading west)
for (const [name, from, yaw, ok] of [['top row east', { x: 18.5, z: 2.5 }, E, (p) => p.x > 35.5 && p.x < 41], ['row 1 west', { x: 34.5, z: 6.5 }, W, (p) => p.x < 17.5 && p.x > 12]]) {
    await load();
    const ride = await page.evaluate(({ from, yaw }) => {
        const g = window.__game; g.clearEvents(); g.teleport({ ...from, yaw }); g.setInput({ forward: true });
        const log = []; const last = [null, null]; let st; let fell = false; let rode = -1;
        for (let i = 0; i < 1600; i++) {
            st = g.step(1);
            st.platforms.forEach((p, n) => { if (p.phase === 'wait') { g.clearInput(); rode = n; } if (p.phase !== last[n]) { log.push({ n, phase: p.phase, t: +st.t.toFixed(2), x: +st.pos.x.toFixed(2) }); last[n] = p.phase; } });
            if (g.events.some((e) => e.type === 'fall')) fell = true;
            if (rode >= 0 && log.filter((l) => l.n === rode).length > 5 && st.platforms[rode].phase === 'rest') { for (let k = 0; k < 60; k++) st = g.step(1); break; }
        }
        return { log, fell, pos: st.pos, rode };
    }, { from, yaw });
    check(`balloon ${name}`, !ride.fell && ok(ride.pos), ride);
}
// Lava: walk into each gap
for (const [name, from, yaw] of [['top row', { x: 37.5, z: 2.5 }, W], ['row 1', { x: 14.5, z: 6.5 }, E]]) {
    await load();
    const lava = await page.evaluate(({ from, yaw }) => {
        const g = window.__game; g.clearEvents(); g.teleport({ ...from, yaw }); g.setInput({ forward: true });
        let msg = ''; let st;
        for (let i = 0; i < 200; i++) { st = g.step(1); const m = document.getElementById('message'); if (!msg && !m.hidden && m.textContent) { msg = m.textContent; break; } }
        g.clearInput(); return { msg, pos: st.pos, start: st.start };
    }, { from, yaw });
    check(`lava ${name}: back to the start`, /lava/i.test(lava.msg) && Math.hypot(lava.pos.x - lava.start.x, lava.pos.z - lava.start.z) < 0.5, lava);
}
await load();
await page.evaluate(({ E }) => { const g = window.__game; g.teleport({ x: 2.5, z: 42.5, yaw: E }); g.step(2); g.render(); }, { E });
await shot('a-start');
await page.evaluate(({ E }) => { const g = window.__game; g.teleport({ x: 26.5, z: 42.5, yaw: E }); for (let i = 0; i < 600 && g.state().geysers[0].phase !== 'erupt'; i++) g.step(1); g.step(40); g.render(); }, { E });
await shot('b-geyser1');
await page.evaluate(({ N }) => { const g = window.__game; g.teleport({ x: 42.5, z: 42.5, yaw: N }); for (let i = 0; i < 600 && g.state().geysers[1].phase !== 'erupt'; i++) g.step(1); g.step(40); g.render(); }, { N });
await shot('c-geyser2');
await page.evaluate(({ W }) => { const g = window.__game; g.teleport({ x: 38.5, z: 6.5, yaw: W }); g.step(2); g.render(); }, { W });
await shot('d-balloon2');
await page.evaluate(({ E }) => { const g = window.__game; g.teleport({ x: 14.5, z: 2.5, yaw: E }); g.step(2); g.render(); }, { E });
await shot('e-balloon1');
console.log('errors', errors);
console.log(results.every(Boolean) && !errors.length ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
