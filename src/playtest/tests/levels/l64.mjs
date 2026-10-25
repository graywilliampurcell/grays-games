// Level 64 checks: two geysers + big hot coal. node t64.mjs (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
const idx = 63;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const load = async () => { await page.goto(`${BASE}/?test=1&level=${idx}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => window.__game?.ready); };
const shot = (name) => page.screenshot({ path: `${SP}l64-${name}.png` });
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info)); };
const E = -Math.PI / 2, W = Math.PI / 2, N = 0;

await load();
const st0 = await page.evaluate(() => { const s = window.__game.state(); return { geysers: s.geysers, platforms: s.platforms.length, vents: s.vents.length, spike: s.spike, rows: s.spikeRows, start: s.start }; });
console.log(JSON.stringify(st0));
check('two geysers, one big coal, nothing else', st0.geysers.length === 2 && st0.platforms === 0 && st0.vents === 0 && !st0.spike && st0.rows.length === 1, st0);

// Timers: each 3 s / 3 s, out of step
const timing = await page.evaluate(() => {
    const g = window.__game; const log = [[], []]; const last = ['quiet', 'quiet'];
    for (let i = 0; i < 1200; i++) { const st = g.step(1); st.geysers.forEach((q, n) => { if (q.phase !== last[n]) { log[n].push({ p: q.phase, t: st.t }); last[n] = q.phase; } }); }
    return log;
});
const per = (l) => l.length >= 3 && Math.abs(l[1].t - l[0].t - 3) < 0.1 && Math.abs(l[2].t - l[1].t - 3) < 0.1;
check('each erupts 3 s / quiet 3 s, 1.5 s apart', per(timing[0]) && per(timing[1]) && Math.abs(Math.abs(timing[0][0].t - timing[1][0].t) - 1.5) < 0.1, timing);

// Walk into each while erupting
for (const [n, from, yaw] of [[0, { x: 14.5, z: 42.5 }, E], [1, { x: 2.5, z: 10.5 }, N]]) {
    await load();
    const hit = await page.evaluate(({ n, from, yaw }) => {
        const g = window.__game; g.clearEvents();
        g.teleport({ ...from, yaw });
        for (let i = 0; i < 600 && g.state().geysers.find((q) => Math.abs((q.minX + q.maxX) / 2 - from.x) < 3 || Math.abs((q.minZ + q.maxZ) / 2 - from.z) < 3).phase !== 'erupt'; i++) g.step(1);
        g.step(20); g.setInput({ forward: true });
        let msg = ''; let st;
        for (let i = 0; i < 120; i++) { st = g.step(1); const m = document.getElementById('message'); if (!m.hidden && m.textContent) { msg = m.textContent; break; } }
        g.clearInput();
        return { msg, pos: st.pos, start: st.start };
    }, { n, from, yaw });
    check(`geyser ${n + 1}: Ouch and back to start`, /lava geyser/.test(hit.msg) && Math.hypot(hit.pos.x - hit.start.x, hit.pos.z - hit.start.z) < 0.5, hit);
}

// Walk through each while quiet
for (const [n, from, yaw, done] of [[0, { x: 13.5, z: 42.5 }, E, (p) => p.x > 21], [1, { x: 2.5, z: 11.5 }, N, (p) => p.z < 3.6]]) {
    await load();
    const r = await page.evaluate(({ from, yaw }) => {
        const g = window.__game; g.clearEvents(); g.teleport({ ...from, yaw });
        const mine = () => g.state().geysers.find((q) => Math.abs((q.minX + q.maxX) / 2 - from.x) < 3 || Math.abs((q.minZ + q.maxZ) / 2 - from.z) < 3);
        for (let i = 0; i < 600 && mine().phase !== 'erupt'; i++) g.step(1);
        for (let i = 0; i < 600 && mine().phase !== 'quiet'; i++) g.step(1);
        g.setInput({ forward: true }); let st;
        for (let i = 0; i < 90; i++) st = g.step(1);
        g.clearInput();
        return { pos: st.pos, hits: g.events.filter((e) => e.type === 'spike').length };
    }, { from, yaw });
    check(`geyser ${n + 1}: walk through while quiet`, done(r.pos) && r.hits === 0, r);
}

// Big hot coal: walk west into it from its opening
await load();
const coal = await page.evaluate(({ W }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 22.5, z: 26.5, yaw: W }); g.setInput({ forward: true });
    let msg = ''; let st;
    for (let i = 0; i < 200; i++) { st = g.step(1); const m = document.getElementById('message'); if (!m.hidden && m.textContent) { msg = m.textContent; break; } }
    g.clearInput();
    return { msg, pos: st.pos, start: st.start, events: g.events.map((e) => e.type + (e.what ? ':' + e.what : '')) };
}, { W });
check('big hot coal: Ouch and back to start', /Ouch/.test(coal.msg) && Math.hypot(coal.pos.x - coal.start.x, coal.pos.z - coal.start.z) < 0.5, coal);
// Walk past its opening along the path (path runs north-south through (5,6)?) - just screenshots
await load();
await page.evaluate(({ W }) => { const g = window.__game; g.teleport({ x: 22.5, z: 26.5, yaw: W }); g.step(2); g.render(); }, { W });
await shot('a-bigcoal');
await page.evaluate(({ E }) => { const g = window.__game; g.teleport({ x: 10.5, z: 42.5, yaw: E }); for (let i = 0; i < 600 && g.state().geysers.some((q) => q.minZ > 40 && q.phase !== 'erupt'); i++) g.step(1); g.step(40); g.render(); }, { E });
await shot('b-geyser1');
await page.evaluate(({ N }) => { const g = window.__game; g.teleport({ x: 2.5, z: 14.5, yaw: N }); for (let i = 0; i < 600 && g.state().geysers.some((q) => q.maxZ < 10 && q.phase !== 'erupt'); i++) g.step(1); g.step(40); g.render(); }, { N });
await shot('c-geyser2');

console.log('errors', errors);
console.log(results.every(Boolean) && !errors.length ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
