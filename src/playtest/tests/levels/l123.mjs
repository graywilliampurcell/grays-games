// Level 122 checks (vite preview on 9173)
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
await page.goto(BASE + '/?test=1&level=122', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
await page.keyboard.press('Shift');
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 900)); };
const shot = (name) => page.screenshot({ path: `${SP}l123-${name}.png`, timeout: 180000 });
let st = await page.evaluate(() => window.__game.restore());
const v = st.vents[0];
check('Level 123 loads: one big wave, one cannon ride, nothing else',
    st.level.name === 'Level 123' && st.vents.length === 1 && v.wave && st.platforms.length === 1 && !st.platforms[0].plank && st.cannons.length === 2 && !st.spike && !st.spike2 && st.spikeRows.length === 0 && st.tails.length === 0 && st.geysers.length === 0 && st.belts.length === 0,
    { v, c: st.cannons });
check('wave cell beside the east outer wall', v.maxX === 48 && v.maxX - v.minX === 3, v);
check('tune piratewave', (await page.evaluate(() => window.__sound?.tuneName)) === 'piratewave', {});
// The cycle: calm 3, warning 1, splash 0.5
let r = await page.evaluate(() => {
    const g = window.__game;
    g.restore();
    const ch = [];
    let last = g.state().vents[0].phase;
    for (let k = 0; k < 800; k++) {
        const s = g.step(1);
        const p = s.vents[0].phase;
        if (p !== last) { ch.push([p, g.time()]); last = p; }
    }
    return ch;
});
const dur = (a) => { const i = r.findIndex((c, k) => k > 0 && c[0] === a); return i > 0 && r[i + 1] ? r[i + 1][1] - r[i][1] : null; };
console.log('phases', JSON.stringify(r.slice(0, 8)));
check('calm ~3 s, warning ~1 s, splash ~0.5 s', Math.abs(dur('quiet') - 3) < 0.05 && Math.abs(dur('warning') - 1) < 0.05 && Math.abs(dur('puff') - 0.5) < 0.05, { calm: dur('quiet'), warning: dur('warning'), splash: dur('puff') });
const cx = (v.minX + v.maxX) / 2, cz = (v.minZ + v.maxZ) / 2;
// Standing in the cell when it splashes: washed back to Q, no Ouch, sounds rush + wash
const waitFor = (phase, left) => `for (let k = 0; k < 600; k++) { const s = g.step(1); const w = s.vents[0]; if (w.phase === '${phase}' && w.timer <= ${left}) break; }`;
r = await page.evaluate(([cx, cz, v, w1]) => {
    const g = window.__game;
    g.restore();
    eval(w1);
    g.teleport({ x: cx + 0.9, z: cz - 1.2, yaw: 0 });
    g.clearEvents();
    let s;
    for (let k = 0; k < 120; k++) s = g.step(1);
    const ev = g.events.map((e) => e.type === 'sound' ? 'sound:' + e.name : e.type);
    return { pos: s.pos, target: v.target, ev, msg: g.text() };
}, [cx, cz, v, waitFor('warning', 0.5)]);
const rushHeard = await page.evaluate(([w1]) => { const g = window.__game; g.restore(); eval(w1); g.clearEvents(); for (let k = 0; k < 100; k++) g.step(1); return g.events.filter((e) => e.type === 'sound').map((e) => e.name); }, [waitFor('quiet', 0.5)]);
check('warning: rushing sound', rushHeard.includes('rush'), rushHeard);
check('in the cell during the splash: washed one cell back to Q, not an Ouch', r.ev.includes('wave') && r.ev.includes('sound:wash') && Math.hypot(r.pos.x - r.target.x, r.pos.z - r.target.z) < 0.3 && !r.ev.includes('spike') && !r.ev.includes('sound:ouch') && !JSON.stringify(r.msg).includes('Ouch'), r);
// Just touching the cell's edge during the splash also washes you back
r = await page.evaluate(([cx, cz, v, w1]) => {
    const g = window.__game;
    g.restore();
    eval(w1);
    g.teleport({ x: cx, z: v.maxZ + 0.3, yaw: 0 });
    g.clearEvents();
    let s;
    for (let k = 0; k < 120; k++) s = g.step(1);
    return { pos: s.pos, ev: g.events.map((e) => e.type) };
}, [cx, cz, v, waitFor('warning', 0.3)]);
check('a bit of you in the cell: washed back too', r.ev.includes('wave'), r);
// Walk across right after a splash (calm): well under 3 s, no wash
r = await page.evaluate(([cx, v, w1]) => {
    const g = window.__game;
    g.restore();
    eval(w1);
    for (let k = 0; k < 600; k++) { const s = g.step(1); if (s.vents[0].phase === 'quiet') break; }
    g.teleport({ x: cx, z: v.target.z, yaw: 0 });
    g.clearEvents();
    g.setInput({ forward: true });
    let s, t0 = null, t1 = null;
    for (let k = 0; k < 300; k++) {
        s = g.step(1);
        if (t0 === null && s.pos.z - 0.35 < v.maxZ) t0 = g.time();
        if (t1 === null && s.pos.z + 0.35 < v.minZ) { t1 = g.time(); break; }
    }
    g.clearInput();
    return { cross: t1 - t0, ev: g.events.map((e) => e.type), pos: s.pos };
}, [cx, v, waitFor('puff', 0.02)]);
check('crossing while calm takes well under 3 s, no wash', r.cross < 1.2 && !r.ev.includes('wave'), r);
// Pause freezes the cycle
await page.evaluate(() => window.__game.restore());
const before = await page.evaluate(() => window.__game.state().vents[0]);
await page.keyboard.press('Space');
await page.evaluate(() => window.__game.setRealtime(true));
await page.waitForTimeout(1500);
const during = await page.evaluate(() => window.__game.state().vents[0]);
await page.keyboard.press('Space');
await page.waitForTimeout(200);
await page.evaluate(() => window.__game.setRealtime(false));
check('pause freezes the wave', during.phase === before.phase && Math.abs(during.timer - before.timer) < 0.05, { before, during });
// Shots: from Q looking north at the wave cell, through the cycle
await page.evaluate(([cx, v, w1]) => { const g = window.__game; g.restore(); eval(w1); g.teleport({ x: cx - 0.6, z: v.target.z + 6.5, yaw: 0.12 }); g.step(1); }, [cx, v, waitFor('quiet', 1)]);
await shot('calm');
await page.evaluate(([cx, v, w1]) => { const g = window.__game; eval(w1); g.teleport({ x: cx - 0.6, z: v.target.z + 6.5, yaw: 0.12 }); g.step(1); }, [cx, v, waitFor('warning', 0.5)]);
await shot('warning-mid');
await page.evaluate(([cx, v, w1]) => { const g = window.__game; eval(w1); g.step(1); }, [cx, v, waitFor('warning', 0.05)]);
await shot('warning-top');
await page.evaluate(([cx, v, w1]) => { const g = window.__game; eval(w1); g.step(1); }, [cx, v, waitFor('puff', 0.25)]);
await shot('splash');
await page.evaluate(() => { const g = window.__game; g.step(25); });
await shot('wet');
// The cannon ride still works
r = await page.evaluate(() => {
    const g = window.__game;
    g.restore();
    const c = g.state().cannons[0];
    g.teleport({ x: c.x, z: c.z, yaw: 0 });
    g.clearEvents();
    let s;
    for (let k = 0; k < 300; k++) s = g.step(1);
    return { c, pos: s.pos, ev: g.events.filter((e) => ['cannon', 'fall', 'waterFall'].includes(e.type)).map((e) => e.type + ':' + (e.what ?? '')) };
});
check('cannon ride: fires and lands in the other cannon, no fall', r.ev.includes('cannon:fire') && Math.hypot(r.pos.x - r.c.landing.x, r.pos.z - r.c.landing.z) < 0.6 && !r.ev.some((e) => e.startsWith('fall') || e.startsWith('waterFall')), r);
// Through the door
r = await page.evaluate(() => {
    const g = window.__game;
    g.restore();
    const d = g.maze().doorPosition;
    g.teleport({ x: d.x - 1.8, z: d.z, yaw: -Math.PI / 2 });
    g.setInput({ forward: true });
    let s;
    for (let i = 0; i < 40; i++) { s = g.step(2); if (s.escaped) break; }
    g.clearInput();
    g.step(30);
    return { escaped: s.escaped, text: g.text() };
});
check('door: escape, More levels coming soon!', r.escaped && JSON.stringify(r.text).match(/More levels coming soon|Start (Level [0-9]+|[A-Z][a-zA-Z ]* World)/) !== null, r);
await page.evaluate(() => { const g = window.__game; g.restore(); g.teleport({ yaw: -Math.PI / 2 }); g.step(1); });
await shot('start');
check('no page errors', errors.length === 0, errors);
const page2 = await ctx.newPage();
page2.on('pageerror', (e) => errors.push(String(e)));
await page2.goto(BASE + '/?test=1&level=121', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page2.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
r = await page2.evaluate(() => {
    const g = window.__game;
    const d = g.maze().doorPosition;
    g.teleport({ x: d.x - 1.8, z: d.z, yaw: -Math.PI / 2 });
    g.setInput({ forward: true });
    let s;
    for (let i = 0; i < 40; i++) { s = g.step(2); if (s.escaped) break; }
    g.clearInput();
    g.step(30);
    const items = [...document.querySelectorAll('#menu-finish .item')].filter((e) => !e.hidden).map((e) => e.textContent);
    return { escaped: s.escaped, items };
});
check('Level 122 door: Start Level 123', r.escaped && r.items[0] === 'Start Level 123', r);
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
