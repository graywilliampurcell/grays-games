// Level 63 geyser + balloon checks: node t63.mjs (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
const idx = 66;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const load = async () => { await page.goto(`${BASE}/?test=1&level=${idx}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => window.__game?.ready); };
const shot = (name) => page.screenshot({ path: `${SP}l67-${name}.png` });
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info)); };
const E = -Math.PI / 2, S = Math.PI, N = 0;
await load();
const st0 = await page.evaluate(() => { const s = window.__game.state(); return { geysers: s.geysers.length, platforms: s.platforms.length, vents: s.vents.length, spike: s.spike, rows: s.spikeRows, start: s.start }; });
console.log(JSON.stringify(st0));
check('one path coal, one balloon, nothing else', st0.geysers === 0 && st0.platforms === 1 && st0.vents === 0 && !!st0.spike && (st0.rows ?? []).length === 0, st0);
// Coal at x 2.5, z 30.5 in the left column (heading south): squeeze both sides, both ways
for (const off of [-1.1, 1.1, -0.8, 0.8]) for (const [yaw, dz] of [[S, 1], [N, -1]]) {
    await load();
    const r = await page.evaluate(({ x, z, yaw }) => {
        const g = window.__game; g.clearEvents(); g.teleport({ x, z, yaw }); g.setInput({ forward: true });
        let msg = ''; let st;
        for (let i = 0; i < 120; i++) { st = g.step(1); const m = document.getElementById('message'); if (!msg && !m.hidden && m.textContent) msg = m.textContent; }
        g.clearInput(); return { msg, pos: st.pos };
    }, { x: 2.5 + off, z: 30.5 - dz * 3, yaw });
    check(`coal squeeze off ${off} dir ${dz} ${Math.abs(off) > 1 ? 'passes' : 'hits'}`, /ouch/i.test(r.msg) === (Math.abs(off) < 1) && (Math.abs(off) < 1 || Math.abs(r.pos.z - 30.5) > 2), r);
}
// Balloon ride east across the top row
for (const [x, yaw, lo, hi, label] of [[18.5, E, 36, 42, 'east']]) {
    await load();
    const ride = await page.evaluate(({ x, yaw }) => {
        const g = window.__game; g.clearEvents(); g.teleport({ x, z: 2.5, yaw }); g.setInput({ forward: true });
        const log = []; let last = null; let st; let fell = false;
        for (let i = 0; i < 1400; i++) {
            st = g.step(1); const p = st.platforms[0];
            if (p.phase === 'wait') g.clearInput();
            if (p.phase !== last) { log.push({ phase: p.phase, t: +st.t.toFixed(2), x: +st.pos.x.toFixed(2) }); last = p.phase; }
            if (g.events.some((e) => e.type === 'fall')) fell = true;
            if (log.length > 6 && p.phase === 'rest') break;
        }
        return { log, fell, pos: st.pos };
    }, { x, yaw });
    check(`balloon carries you ${label} over the lava`, !ride.fell && ride.pos.x > lo && ride.pos.x < hi, ride);
}
// Walk into the lava: Ouch, back to start
await load();
const lava = await page.evaluate(({ E }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 23.5, z: 2.5, yaw: E }); g.setInput({ forward: true });
    let msg = ''; let st;
    for (let i = 0; i < 200; i++) { st = g.step(1); const m = document.getElementById('message'); if (!msg && !m.hidden && m.textContent) msg = m.textContent; }
    g.clearInput(); return { msg, pos: st.pos, start: st.start };
}, { E });
check('lava: Ouch and back to the start', /lava/i.test(lava.msg) && Math.hypot(lava.pos.x - lava.start.x, lava.pos.z - lava.start.z) < 0.5, lava);
await load();
await page.evaluate(({ S }) => { const g = window.__game; g.teleport({ x: 2.5, z: 22.5, yaw: S }); g.step(2); g.render(); }, { S });
await shot('a-coal');
await page.evaluate(({ E }) => { const g = window.__game; g.teleport({ x: 14.5, z: 2.5, yaw: E }); g.step(2); g.render(); }, { E });
await shot('b-balloon');
console.log('errors', errors);
console.log(results.every(Boolean) && !errors.length ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
