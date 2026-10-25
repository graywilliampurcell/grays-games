// Level 70 checks (finale). node t70.mjs (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
import { LEVELS } from '../../js/levels.js';
const SP = SHOTS;
const idx = 69;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const load = async () => { await page.goto(`${BASE}/?test=1&level=${idx}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => window.__game?.ready); };
const shot = (name) => page.screenshot({ path: `${SP}l70-${name}.png` });
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info).slice(0, 400)); };
const E = -Math.PI / 2, W = Math.PI / 2, N = 0, Sth = Math.PI;
check('level 70 entry', LEVELS[idx].name === 'Level 70' && LEVELS.length === 70 && LEVELS[idx].finale === 'You beat Volcano World!' && !LEVELS[idx].nextLabel, LEVELS[idx].name);
await load();
const st0 = await page.evaluate(() => { const s = window.__game.state(); return { geysers: s.geysers, platforms: s.platforms, vents: s.vents.length, spike: s.spike, spike2: s.spike2, rows: s.spikeRows, start: s.start, door: s.door }; });
console.log(JSON.stringify({ g: st0.geysers.length, p: st0.platforms.length, v: st0.vents, spike: st0.spike, spike2: st0.spike2, rows: st0.rows, start: st0.start, door: st0.door }));
check('two balloons, two geysers, two vents', st0.geysers.length === 2 && st0.platforms.length === 2 && st0.vents === 2, {});
const near = (from) => `(() => { const gs = window.__game.state().geysers; let b = gs[0], bd = 1e9; for (const q of gs) { const d = Math.hypot((q.minX + q.maxX) / 2 - ${from.x}, (q.minZ + q.maxZ) / 2 - ${from.z}); if (d < bd) { bd = d; b = q; } } return b; })()`;
const G = [[1, { x: 10.5, z: 18.5 }, Sth, (p) => p.z > 25], [2, { x: 26.5, z: 34.5 }, N, (p) => p.z < 27]];
for (const [n, from, yaw] of G) {
    await load();
    const hit = await page.evaluate(({ from, yaw, mineSrc }) => {
        const g = window.__game; g.clearEvents(); g.teleport({ ...from, yaw });
        const mine = () => eval(mineSrc);
        for (let i = 0; i < 600 && mine().phase !== 'erupt'; i++) g.step(1);
        g.step(20); g.setInput({ forward: true });
        let msg = ''; let st;
        for (let i = 0; i < 120; i++) { st = g.step(1); const m = document.getElementById('message'); if (!m.hidden && m.textContent) { msg = m.textContent; break; } }
        g.clearInput(); return { msg, pos: st.pos, start: st.start };
    }, { from, yaw, mineSrc: near(from) });
    check(`geyser ${n}: Ouch and back to start`, /lava geyser/.test(hit.msg) && Math.hypot(hit.pos.x - hit.start.x, hit.pos.z - hit.start.z) < 0.5, hit);
}
for (const [n, from, yaw, done] of G) {
    await load();
    const r = await page.evaluate(({ from, yaw, mineSrc }) => {
        const g = window.__game; g.clearEvents(); g.teleport({ ...from, yaw });
        const mine = () => eval(mineSrc);
        for (let i = 0; i < 600 && mine().phase !== 'erupt'; i++) g.step(1);
        for (let i = 0; i < 600 && mine().phase !== 'quiet'; i++) g.step(1);
        g.setInput({ forward: true }); let st;
        for (let i = 0; i < 90; i++) st = g.step(1);
        g.clearInput(); return { pos: st.pos, hits: g.events.filter((e) => e.type === 'spike').length };
    }, { from, yaw, mineSrc: near(from) });
    check(`geyser ${n}: walk through while quiet`, done(r.pos) && r.hits === 0, r);
}
for (const [name, from, yaw, ok] of [['column heading south', { x: 18.5, z: 6.5 }, Sth, (p) => p.z > 24.5 && p.z < 29], ['bottom row heading east', { x: 2.5, z: 42.5 }, E, (p) => p.x > 20.5 && p.x < 25]]) {
    await load();
    const ride = await page.evaluate(({ from, yaw }) => {
        const g = window.__game; g.clearEvents(); g.teleport({ ...from, yaw }); g.setInput({ forward: true });
        const log = []; const last = [null, null]; let st; let fell = false; let rode = -1;
        for (let i = 0; i < 1600; i++) {
            st = g.step(1);
            st.platforms.forEach((p, n) => { if (p.phase === 'wait') { g.clearInput(); rode = n; } if (p.phase !== last[n]) { log.push({ n, phase: p.phase, t: +st.t.toFixed(2) }); last[n] = p.phase; } });
            if (g.events.some((e) => e.type === 'fall')) fell = true;
            if (rode >= 0 && log.filter((l) => l.n === rode).length > 5 && st.platforms[rode].phase === 'rest') { for (let k = 0; k < 60; k++) st = g.step(1); break; }
        }
        return { fell, pos: st.pos, rode, phases: log.filter((l) => l.n === rode).map((l) => l.phase).join(',') };
    }, { from, yaw });
    check(`balloon ${name}`, !ride.fell && ok(ride.pos), ride);
}
for (const [name, from, yaw] of [['column', { x: 18.5, z: 26.5 }, N], ['bottom row', { x: 22.5, z: 42.5 }, W]]) {
    await load();
    const lava = await page.evaluate(({ from, yaw }) => {
        const g = window.__game; g.clearEvents(); g.teleport({ ...from, yaw }); g.setInput({ forward: true });
        let msg = ''; let st;
        for (let i = 0; i < 200; i++) { st = g.step(1); const m = document.getElementById('message'); if (!msg && !m.hidden && m.textContent) { msg = m.textContent; break; } }
        g.clearInput(); return { msg, pos: st.pos, start: st.start };
    }, { from, yaw });
    check(`lava ${name}: back to the start`, /lava/i.test(lava.msg) && Math.hypot(lava.pos.x - lava.start.x, lava.pos.z - lava.start.z) < 0.5, lava);
}
// Path hot coal Z at (22.5, 10.5), corridor heading north: squeeze both sides, both ways
for (const off of [-1.04, 1.04, -0.9, 0.9, 0]) for (const dz of [-1, 1]) {
    await load();
    const r = await page.evaluate(({ off, dz }) => {
        const g = window.__game; g.clearEvents(); g.teleport({ x: 22.5 + off, z: 10.5 - dz * 3.6, yaw: dz < 0 ? 0 : Math.PI }); g.setInput({ forward: true });
        let msg = ''; let st;
        for (let i = 0; i < 70; i++) { st = g.step(1); const m = document.getElementById('message'); if (!msg && !m.hidden && m.textContent) { msg = m.textContent; break; } }
        g.clearInput(); return { msg, pos: { x: +st.pos.x.toFixed(2), z: +st.pos.z.toFixed(2) } };
    }, { off, dz });
    const passes = Math.abs(off) > 1;
    check(`coal squeeze off ${off} dir ${dz} ${passes ? 'passes' : 'hits'}`, /ouch/i.test(r.msg) === !passes && (!passes || Math.abs(r.pos.z - 10.5) > 2), r);
}
// Big hot coal across the dead end west of (34.5, 22.5)
await load();
const big = await page.evaluate(({ W }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 34.5, z: 22.5, yaw: W }); g.setInput({ forward: true });
    let msg = ''; for (let i = 0; i < 150; i++) { g.step(1); const m = document.getElementById('message'); if (!msg && !m.hidden && m.textContent) { msg = m.textContent; break; } }
    g.clearInput(); return { msg };
}, { W });
check('big hot coal: ouch', /hot coal/i.test(big.msg), big);
await load();
await page.evaluate(({ E }) => { const g = window.__game; g.step(2); g.render(); }, { E });
await shot('a-start');
await page.evaluate(() => { const g = window.__game; g.teleport({ x: 22.5, z: 16.5, yaw: 0 }); g.step(2); g.render(); });
await shot('b-pathcoal');
await page.evaluate(({ W }) => { const g = window.__game; g.teleport({ x: 38.5, z: 22.5, yaw: W }); g.step(2); g.render(); }, { W });
await shot('c-bigcoal');
await page.evaluate(({ Sth }) => { const g = window.__game; g.teleport({ x: 10.5, z: 14.5, yaw: Sth }); for (let i = 0; i < 600 && g.state().geysers.some((q) => q.phase !== 'erupt'); i++) g.step(1); g.step(30); g.render(); }, { Sth });
await shot('d-geyser');
await page.evaluate(({ Sth }) => { const g = window.__game; g.teleport({ x: 18.5, z: 4.5, yaw: Sth }); g.step(2); g.render(); }, { Sth });
await shot('e-balloon1');
await page.evaluate(({ E }) => { const g = window.__game; g.teleport({ x: 1.8, z: 42.5, yaw: E }); g.step(2); g.render(); }, { E });
await shot('f-balloon2');
console.log('errors', errors);
console.log(results.every(Boolean) && !errors.length ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
