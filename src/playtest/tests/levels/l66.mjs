// Level 66 checks: path hot coal + geyser + vent. node t66.mjs (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
const idx = 65;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const load = async () => { await page.goto(`${BASE}/?test=1&level=${idx}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => window.__game?.ready); };
const shot = (name) => page.screenshot({ path: `${SP}l66-${name}.png` });
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info)); };
const E = -Math.PI / 2, W = Math.PI / 2, N = 0;

await load();
const st0 = await page.evaluate(() => { const s = window.__game.state(); return { geysers: s.geysers, platforms: s.platforms.length, vents: s.vents.length, spike: s.spike, rows: s.spikeRows, start: s.start }; });
console.log(JSON.stringify(st0));
check('one geyser, one vent, one path coal, nothing else', st0.geysers.length === 1 && st0.platforms === 0 && st0.vents === 1 && !!st0.spike && st0.rows.length === 0, st0);

// Timers: each 3 s / 3 s, out of step
const timing = await page.evaluate(() => {
    const g = window.__game; const log = [[], []]; const last = ['quiet', 'quiet'];
    for (let i = 0; i < 1200; i++) { const st = g.step(1); st.geysers.forEach((q, n) => { if (q.phase !== last[n]) { log[n].push({ p: q.phase, t: st.t }); last[n] = q.phase; } }); }
    return log;
});
const per = (l) => l.length >= 3 && Math.abs(l[1].t - l[0].t - 3) < 0.1 && Math.abs(l[2].t - l[1].t - 3) < 0.1;
check('erupts 3 s / quiet 3 s', per(timing[0]), timing);

// Walk into each while erupting
for (const [n, from, yaw] of [[0, { x: 26.5, z: 2.5 }, E]]) {
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
for (const [n, from, yaw, done] of [[0, { x: 25.5, z: 2.5 }, E, (p) => p.x > 33]]) {
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


// Path hot coal squeeze (Level 53's gap): pass at the side, hit near the middle
const S = Math.PI;
for (const off of [-1.08, 1.08, -0.75, 0.75]) for (const [yaw, dx] of [[E, 1], [W, -1]]) {
    await load();
    const r = await page.evaluate(({ x, z, yaw }) => {
        const g = window.__game; g.clearEvents(); g.teleport({ x, z, yaw }); g.setInput({ forward: true });
        let msg = ''; let st;
        for (let i = 0; i < 120; i++) { st = g.step(1); const m = document.getElementById('message'); if (!msg && !m.hidden && m.textContent) msg = m.textContent; }
        g.clearInput(); return { msg, pos: st.pos };
    }, { x: 26.5 - dx * 3, z: 14.5 + off, yaw });
    check(`coal squeeze off ${off} dir ${dx} ${Math.abs(off) > 1 ? 'passes' : 'hits'}`, /ouch/i.test(r.msg) === (Math.abs(off) < 1) && (Math.abs(off) < 1 || Math.abs(r.pos.x - 26.5) > 2), r);
}
await load();
await page.evaluate(({ E }) => { const g = window.__game; g.teleport({ x: 18.5, z: 14.5, yaw: E }); g.step(2); g.render(); }, { E });
await shot('a-coal');
await page.evaluate(({ E }) => { const g = window.__game; g.teleport({ x: 18.5, z: 2.5, yaw: E }); for (let i = 0; i < 600 && g.state().geysers[0].phase !== 'erupt'; i++) g.step(1); g.step(40); g.render(); }, { E });
await shot('b-geyser');
console.log('errors', errors);
console.log(results.every(Boolean) && !errors.length ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
