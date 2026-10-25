// Level 138 checks (vite preview on 9173)
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
await page.goto(BASE + '/?test=1&level=137', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
await page.keyboard.press('Shift');
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 900)); };
const shot = (name) => page.screenshot({ path: `${SP}l138-${name}.png`, timeout: 180000 });
let r;
let st = await page.evaluate(() => window.__game.restore());
const TS = st.trampolines, F = st.fogs[0];
check('Level 138 loads: two trampolines, one fog, one rainbow bridge, nothing else',
    st.level.name === 'Level 138' && TS.length === 2 && st.fogs.length === 1 && st.platforms.length === 1 && !!st.platforms[0].rainbow && !st.spike && !st.spike2 && st.spikeRows.length === 0 && st.winds.length === 0 && st.vents.length === 0 && (st.propellers ?? []).length === 0,
    { TS, F, plat: st.platforms.length, spike: st.spike, rows: st.spikeRows.length });
const yawOf = (d) => Math.atan2(-d.x, -d.z);
for (const [n, T] of TS.entries()) {
    r = await page.evaluate(([T, yaw]) => {
        const g = window.__game; g.restore(); g.teleport({ x: T.center.x - 4 * T.dir.x, z: T.center.z - 4 * T.dir.z, yaw }); g.clearEvents(); g.setInput({ forward: true });
        let s, t0 = null, t1 = null, view = null, others = null;
        for (let k = 0; k < 400; k++) {
            s = g.step(1); const ev = g.events.map((e) => e.type + ':' + (e.what ?? ''));
            if (t0 === null && ev.includes('trampoline:bounce')) { t0 = s.t; g.clearInput(); }
            if (t0 !== null && view === null && s.t - t0 > 0.7) { const tr = g.state().trampolines; view = tr.map((x) => x.view); }
            if (t0 !== null && ev.includes('trampoline:land')) { t1 = s.t; break; }
        }
        const after = g.step(10);
        return { time: t1 - t0, view, end: s.pos, yaw: s.yaw, afterView: g.state().trampolines.map((x) => x.view), spike: g.events.some((e) => e.type === 'spike'), fell: g.events.some((e) => e.type === 'fall') };
    }, [T, yawOf(T.dir)]);
    const dy = Math.atan2(Math.sin(r.yaw - yawOf(T.dir)), Math.cos(r.yaw - yawOf(T.dir)));
    check(`trampoline ${n + 1}: ~1.5 s bounce, lands at landing facing on, only it in view, back to normal`, Math.abs(r.time - 1.5) < 0.05 && Math.abs(r.end.x - T.landing.x) < 0.05 && Math.abs(r.end.z - T.landing.z) < 0.05 && Math.abs(dy) < 0.02 && r.view?.[n] === true && r.view?.[1 - n] === false && r.afterView.every((v) => v === false) && !r.spike && !r.fell, { r, T });
    r = await page.evaluate(([T, yaw]) => {
        const g = window.__game; g.restore(); g.teleport({ x: T.landing.x, z: T.landing.z, yaw }); g.clearEvents(); g.setInput({ forward: true });
        let s; for (let k = 0; k < 120; k++) s = g.step(1); g.clearInput();
        return { pos: s.pos, bounced: g.events.some((e) => e.type === 'trampoline') };
    }, [T, yawOf({ x: -T.dir.x, z: -T.dir.z })]);
    const back = (r.pos.x - T.landing.x) * -T.dir.x + (r.pos.z - T.landing.z) * -T.dir.z;
    check(`trampoline ${n + 1}: one way only from the landing side`, !r.bounced && back < 2.6, { r, back });
}
// Fog: walk along it in its direction
r = await page.evaluate((F) => {
    const g = window.__game; g.restore();
    const along = F.alongX; const mid = along ? (F.minZ + F.maxZ) / 2 : (F.minX + F.maxX) / 2;
    g.teleport(along ? { x: F.minX - 3, z: mid, yaw: -Math.PI / 2 } : { x: mid, z: F.minZ - 3, yaw: Math.PI }); g.clearEvents(); g.setInput({ forward: true });
    const trace = []; let s;
    for (let k = 0; k < 150; k++) { s = g.step(1); trace.push([Math.round((along ? s.pos.x : s.pos.z) * 10) / 10, g.state().fogView]); }
    g.clearInput(); return { trace, spike: g.events.some((e) => e.type === 'spike'), end: s.pos };
}, F);
const lo = F.alongX ? F.minX : F.minZ, hi = F.alongX ? F.maxX : F.maxZ;
const inside = r.trace.filter(([x]) => x > lo + 2 && x < hi - 2);
const after = r.trace.filter(([x]) => x > hi + 1.5);
check('outside the fog: clear', r.trace[0][1] === 0, r.trace[0]);
check('deep in the fog: full fog', inside.length > 5 && inside.every(([, v]) => v === 1), inside.slice(0, 3));
check('fog opens again after', after.length > 0 && after.at(-1)[1] === 0, after.slice(-2));
// Rainbow bridge cycles
r = await page.evaluate(() => { const g = window.__game; g.restore(); const ph = []; for (let k = 0; k < 600; k++) { const s = g.step(1); const p = g.state().platforms[0].rainbow.phase; if (ph.at(-1) !== p) ph.push(p); } return ph; });
check('rainbow bridge cycles solid / fading / gone', r.includes('solid') && r.includes('fading') && r.includes('gone'), r);
// Shots
const pose = async (name, p, n = 30) => { await page.evaluate(([p, n]) => { const g = window.__game; g.restore(); g.teleport(p); g.step(n); }, [p, n]); await shot(name); };
for (const [n, T] of TS.entries()) {
    await pose(`tramp${n + 1}-approach`, { x: T.center.x - 5.5 * T.dir.x, z: T.center.z - 5.5 * T.dir.z, yaw: yawOf(T.dir) }, 2);
    await page.evaluate(([T, yaw]) => { const g = window.__game; g.restore(); g.teleport({ x: T.center.x - 2 * T.dir.x, z: T.center.z - 2 * T.dir.z, yaw }); g.setInput({ forward: true }); for (let k = 0; k < 120; k++) { const s = g.step(1); if (g.state().trampolines.some((x) => x.bouncing)) break; } g.clearInput(); g.step(40); }, [T, yawOf(T.dir)]);
    await shot(`tramp${n + 1}-air`);
}
await pose('fog-outside', F.alongX ? { x: F.minX - 7, z: (F.minZ + F.maxZ) / 2, yaw: -Math.PI / 2 } : { x: (F.minX + F.maxX) / 2, z: F.minZ - 7, yaw: Math.PI });
// Door
r = await page.evaluate(() => {
    const g = window.__game; g.restore(); const d = g.maze().doorPosition;
    g.teleport({ x: d.x - 1.8, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true });
    let s; for (let i = 0; i < 40; i++) { s = g.step(2); if (s.escaped) break; } g.clearInput(); g.step(30);
    return { escaped: s.escaped, text: g.text() };
});
check('door: escape, More levels coming soon!', r.escaped && JSON.stringify(r.text).match(/More levels coming soon|Start (Level [0-9]+|[A-Z][a-zA-Z ]* World)/) !== null, r);
check('tune skytwobounce', (await page.evaluate(() => window.__sound?.tuneName)) === 'skytwobounce', {});
await page.evaluate(() => { const g = window.__game; g.restore(); g.teleport({ yaw: -Math.PI / 2 }); g.step(1); });
await shot('start');
const page2 = await ctx.newPage();
page2.on('pageerror', (e) => errors.push(String(e)));
await page2.goto(BASE + '/?test=1&level=136', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page2.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
r = await page2.evaluate(() => {
    const g = window.__game; const d = g.maze().doorPosition;
    g.teleport({ x: d.x - 1.8, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true });
    let s; for (let i = 0; i < 40; i++) { s = g.step(2); if (s.escaped) break; } g.clearInput(); g.step(30);
    const items = [...document.querySelectorAll('#menu-finish .item')].filter((e) => !e.hidden).map((e) => e.textContent);
    return { escaped: s.escaped, items, name: g.state().level.name };
});
check('Level 137 door: Start Level 138', r.escaped && r.items[0] === 'Start Level 138' && r.name === 'Level 137', r);
// Level 133 and 136 still have their one trampoline
for (const lv of [132, 135]) {
    const p3 = await ctx.newPage(); p3.on('pageerror', (e) => errors.push(String(e)));
    await p3.goto(`${BASE}/?test=1&level=${lv}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await p3.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
    r = await p3.evaluate(() => { const g = window.__game; const st = g.restore(); const T = st.trampoline; const yaw = Math.atan2(-T.dir.x, -T.dir.z); g.teleport({ x: T.center.x - 4 * T.dir.x, z: T.center.z - 4 * T.dir.z, yaw }); g.clearEvents(); g.setInput({ forward: true }); let s; for (let k = 0; k < 300; k++) { s = g.step(1); if (g.events.some((e) => e.what === 'land')) break; } g.clearInput(); return { n: st.trampolines.length, land: g.events.some((e) => e.what === 'land'), name: st.level.name, end: s.pos, landing: T.landing }; });
    check(`${r.name}: still one trampoline that works`, r.n === 1 && r.land, r);
    await p3.close();
}
check('no page errors', errors.length === 0, errors);
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
