// Level 68 checks: 3-deep dead ends + big hot coal + balloon. node t68.mjs (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
import { LEVELS } from '../../js/levels.js';
import { analyzeMaze } from '../../js/mazeCarver.js';
const SP = SHOTS;
const idx = 67;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const load = async () => { await page.goto(`${BASE}/?test=1&level=${idx}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => window.__game?.ready); };
const shot = (name) => page.screenshot({ path: `${SP}l68-${name}.png` });
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info)); };
const E = -Math.PI / 2, W = Math.PI / 2;
check('level 68 entry', LEVELS[idx].name === 'Level 68', LEVELS[idx].name);
await load();
const st0 = await page.evaluate(() => { const s = window.__game.state(); return { geysers: s.geysers.length, platforms: s.platforms.length, vents: s.vents.length, spike: s.spike, rows: s.spikeRows, start: s.start }; });
check('one balloon, one big coal, nothing else', st0.geysers === 0 && st0.platforms === 1 && st0.vents === 0 && !st0.spike && (st0.rows ?? []).length === 1, st0);
// Balloon ride east along the bottom row
await load();
const ride = await page.evaluate(({ E }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 2.5, z: 42.5, yaw: E }); g.setInput({ forward: true });
    const log = []; let last = null; let st; let fell = false;
    for (let i = 0; i < 1400; i++) {
        st = g.step(1); const p = st.platforms[0];
        if (p.phase === 'wait') g.clearInput();
        if (p.phase !== last) { log.push({ phase: p.phase, t: +st.t.toFixed(2), x: +st.pos.x.toFixed(2) }); last = p.phase; }
        if (g.events.some((e) => e.type === 'fall')) fell = true;
        if (log.length > 6 && p.phase === 'rest') break;
    }
    return { log, fell, pos: st.pos };
}, { E });
check('balloon carries you east over the lava', !ride.fell && ride.pos.x > 19 && ride.pos.x < 26, ride);
// Walk into the lava from the east bank
await load();
const lava = await page.evaluate(({ W }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 22.5, z: 42.5, yaw: W }); g.setInput({ forward: true });
    let msg = ''; let st;
    for (let i = 0; i < 200; i++) { st = g.step(1); const m = document.getElementById('message'); if (!msg && !m.hidden && m.textContent) { msg = m.textContent; break; } }
    g.clearInput(); return { msg, pos: st.pos, start: st.start };
}, { W });
check('lava: Ouch and back to the start', /lava/i.test(lava.msg) && Math.hypot(lava.pos.x - lava.start.x, lava.pos.z - lava.start.z) < 0.5, lava);
// Big hot coal: walk east into it from the path cell (7,9)
await load();
const coal = await page.evaluate(({ E }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 30.5, z: 38.5, yaw: E }); g.setInput({ forward: true });
    let msg = ''; let st;
    for (let i = 0; i < 200; i++) { st = g.step(1); const m = document.getElementById('message'); if (!m.hidden && m.textContent) { msg = m.textContent; break; } }
    g.clearInput(); return { msg, pos: st.pos, start: st.start };
}, { E });
check('big hot coal: Ouch and back to start', /Ouch/.test(coal.msg) && Math.hypot(coal.pos.x - coal.start.x, coal.pos.z - coal.start.z) < 0.5, coal);
await load();
await page.evaluate(({ E }) => { const g = window.__game; g.teleport({ x: 26.5, z: 38.5, yaw: E }); g.step(2); g.render(); }, { E });
await shot('a-bigcoal');
await page.evaluate(({ E }) => { const g = window.__game; g.teleport({ x: 1.8, z: 42.5, yaw: E }); g.step(2); g.render(); }, { E });
await shot('b-balloon');
await page.evaluate(({ E }) => { const g = window.__game; g.teleport({ x: 2.5, z: 34.5, yaw: E }); g.step(2); g.render(); }, { E });
await shot('c-start');
console.log('errors', errors);
console.log(results.every(Boolean) && !errors.length ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
