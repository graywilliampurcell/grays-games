// Level 136 checks (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
import fs from 'fs';
const SP = SHOTS;
fs.mkdirSync(SP, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1024, height: 640 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(BASE + '/?test=1&level=135', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
await page.keyboard.press('Shift');
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 900)); };
const shot = (name) => page.screenshot({ path: `${SP}l136-${name}.png`, timeout: 180000 });
let r;
let st = await page.evaluate(() => window.__game.restore());
const T = st.trampoline, F = st.fogs[0], sp = st.spike;
check('Level 136 loads: one path spike r0.67, one trampoline (west), one fog, nothing else',
    st.level.name === 'Level 136' && st.level.spikeRadius === 0.67 && !!sp && !st.spike2 && st.spikeRows.length === 0 && T && T.dir.x === -1 && st.fogs.length === 1 && st.platforms.length === 0 && st.winds.length === 0 && st.vents.length === 0 && (st.propellers ?? []).length === 0,
    { T, F, sp, r: st.level.spikeRadius, rows: st.spikeRows.length, plat: st.platforms.length });
// Fog: walk east through it
const fz = (F.minZ + F.maxZ) / 2;
r = await page.evaluate(([F, fz]) => {
    const g = window.__game; g.restore(); g.teleport({ x: F.minX - 3, z: fz, yaw: -Math.PI / 2 }); g.clearEvents(); g.setInput({ forward: true });
    const trace = []; let s;
    for (let k = 0; k < 150; k++) { s = g.step(1); trace.push([Math.round(s.pos.x * 10) / 10, g.state().fogView]); }
    g.clearInput(); return { trace, spike: g.events.some((e) => e.type === 'spike'), end: s.pos };
}, [F, fz]);
const inside = r.trace.filter(([x]) => x > F.minX + 2 && x < F.maxX - 2);
const after = r.trace.filter(([x]) => x > F.maxX + 1.5);
check('outside the fog: clear', r.trace[0][1] === 0, r.trace[0]);
check('deep in the fog: full fog', inside.length > 5 && inside.every(([, v]) => v === 1), inside.slice(0, 3));
check('fog opens again after', after.length > 0 && after.at(-1)[1] === 0, after.slice(-2));
check('fog not a danger', !r.spike && r.end.x > F.maxX + 1, r.end);
// Path spike, heading east, squeeze on both sides
const pass = (off) => page.evaluate(([sp, off]) => {
    const g = window.__game; g.restore(); g.teleport({ x: sp.x - 2.5, z: sp.z + off, yaw: -Math.PI / 2 }); g.clearEvents(); g.setInput({ forward: true });
    let s; for (let k = 0; k < 120; k++) { s = g.step(1); if (s.pos.x > sp.x + 2 || g.events.some((e) => e.type === 'spike')) break; }
    g.clearInput(); return { pos: s.pos, spike: g.events.some((e) => e.type === 'spike'), msg: g.text() };
}, [sp, off]);
const band = [];
for (const off of [0.85, 0.9, 0.95, 1.0, 1.05]) { const q = await pass(off), q2 = await pass(-off); band.push([off, !q.spike && q.pos.x > sp.x + 2, !q2.spike && q2.pos.x > sp.x + 2]); }
console.log('band', JSON.stringify(band));
r = await pass(1.0); check('squeeze past one side', !r.spike && r.pos.x > sp.x + 2, r);
r = await pass(-1.0); check('squeeze past other side', !r.spike && r.pos.x > sp.x + 2, r);
r = await pass(0.4); check('walk into it: storm cloud Ouch', r.spike && JSON.stringify(r.msg).includes('storm cloud'), r);
// Trampoline: walk west onto it
r = await page.evaluate((T) => {
    const g = window.__game; g.restore(); g.teleport({ x: T.center.x + 4, z: T.center.z, yaw: Math.PI / 2 }); g.clearEvents(); g.setInput({ forward: true });
    let s, t0 = null, t1 = null, view = null;
    for (let k = 0; k < 400; k++) {
        s = g.step(1); const ev = g.events.map((e) => e.type + ':' + (e.what ?? ''));
        if (t0 === null && ev.includes('trampoline:bounce')) { t0 = s.t; g.clearInput(); }
        if (t0 !== null && view === null && s.t - t0 > 0.7) view = s.trampoline.view;
        if (t0 !== null && ev.includes('trampoline:land')) { t1 = s.t; break; }
    }
    const after = g.step(10);
    return { time: t1 - t0, view, end: s.pos, yaw: s.yaw, afterView: after.trampoline.view, spike: g.events.some((e) => e.type === 'spike') };
}, T);
check('trampoline: ~1.5 s bounce over the wall, lands at landing facing west, view hidden in air', Math.abs(r.time - 1.5) < 0.05 && Math.abs(r.end.x - T.landing.x) < 0.05 && Math.abs(r.end.z - T.landing.z) < 0.05 && Math.abs(r.yaw - Math.PI / 2) < 0.02 && r.view === true && r.afterView === false && !r.spike, r);
r = await page.evaluate((T) => {
    const g = window.__game; g.restore(); g.teleport({ x: T.landing.x, z: T.landing.z, yaw: -Math.PI / 2 }); g.clearEvents(); g.setInput({ forward: true });
    let s; for (let k = 0; k < 120; k++) s = g.step(1); g.clearInput();
    return { pos: s.pos, bounced: g.events.some((e) => e.type === 'trampoline') };
}, T);
check('one way only from the landing side', !r.bounced && r.pos.x < T.center.x - 2.4, r);
// Shots
const pose = async (name, p, n = 30) => { await page.evaluate(([p, n]) => { const g = window.__game; g.restore(); g.teleport(p); g.step(n); }, [p, n]); await shot(name); };
await pose('fog-outside', { x: F.minX - 7, z: fz, yaw: -Math.PI / 2 });
await pose('fog-inside', { x: (F.minX + F.maxX) / 2, z: fz, yaw: -Math.PI / 2 });
await pose('spike', { x: sp.x - 3.5, z: sp.z, yaw: -Math.PI / 2 }, 2);
await pose('tramp-approach', { x: T.center.x + 5.5, z: T.center.z, yaw: Math.PI / 2 }, 2);
await page.evaluate((T) => { const g = window.__game; g.restore(); g.teleport({ x: T.center.x + 2, z: T.center.z, yaw: Math.PI / 2 }); g.setInput({ forward: true }); for (let k = 0; k < 120; k++) { const s = g.step(1); if (s.trampoline.bouncing) break; } g.clearInput(); g.step(40); }, T);
await shot('tramp-air');
// Door
r = await page.evaluate(() => {
    const g = window.__game; g.restore(); const d = g.maze().doorPosition;
    g.teleport({ x: d.x - 1.8, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true });
    let s; for (let i = 0; i < 40; i++) { s = g.step(2); if (s.escaped) break; } g.clearInput(); g.step(30);
    return { escaped: s.escaped, text: g.text() };
});
check('door: escape, More levels coming soon!', r.escaped && JSON.stringify(r.text).match(/More levels coming soon|Start (Level [0-9]+|[A-Z][a-zA-Z ]* World)/) !== null, r);
check('tune skysqueeze', (await page.evaluate(() => window.__sound?.tuneName)) === 'skysqueeze', {});
await page.evaluate(() => { const g = window.__game; g.restore(); g.teleport({ yaw: -Math.PI / 2 }); g.step(1); });
await shot('start');
const page2 = await ctx.newPage();
page2.on('pageerror', (e) => errors.push(String(e)));
await page2.goto(BASE + '/?test=1&level=134', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page2.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
r = await page2.evaluate(() => {
    const g = window.__game; const d = g.maze().doorPosition;
    g.teleport({ x: d.x - 1.8, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true });
    let s; for (let i = 0; i < 40; i++) { s = g.step(2); if (s.escaped) break; } g.clearInput(); g.step(30);
    const items = [...document.querySelectorAll('#menu-finish .item')].filter((e) => !e.hidden).map((e) => e.textContent);
    return { escaped: s.escaped, items, name: g.state().level.name };
});
check('Level 135 door: Start Level 136', r.escaped && r.items[0] === 'Start Level 136' && r.name === 'Level 135', r);
check('no page errors', errors.length === 0, errors);
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
