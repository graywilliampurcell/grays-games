// Level 127 checks (vite preview on 9173)
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
await page.goto(BASE + '/?test=1&level=126', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
await page.keyboard.press('Shift');
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 900)); };
const shot = (name) => page.screenshot({ path: `${SP}l127-${name}.png`, timeout: 180000 });

let st = await page.evaluate(() => window.__game.restore());
const pl = st.platforms.find((p) => p.plank > 0);
const cp = st.platforms.find((p) => !p.plank);
check('Level 127 loads: one third plank, one cannon ride, one big spike, nothing else',
    st.level.name === 'Level 127' && !st.rocking && st.platforms.length === 2 && st.platforms.filter((p) => p.plank > 0).length === 1 && Math.abs(pl.plank - 1 / 3) < 1e-6 && pl.gap.minX === 37 && st.cannons.length === 2 && !st.spike && !st.spike2 && st.spikeRows.length === 1 && st.vents.length === 0 && st.tails.length === 0,
    { pl, cp, cannons: st.cannons, rows: st.spikeRows });
check('tune piratelongway', (await page.evaluate(() => window.__sound?.tuneName)) === 'piratelongway', {});
const cx = (pl.gap.minX + pl.gap.maxX) / 2;
// Walk north across the plank (from below the gap) with a given offset and joystick
const cross = (off, joy, keys) => page.evaluate(([g0, cx, off, joy, keys]) => {
    const g = window.__game;
    g.restore();
    g.teleport({ x: cx + off, z: g0.maxZ + 1.2, yaw: 0 });
    g.clearEvents();
    g.setInput(keys ? { forward: true } : { joystick: joy });
    let s, maxOff = 0;
    const t0 = g.time();
    for (let k = 0; k < 600; k++) {
        s = g.step(1);
        if (s.pos.z < g0.maxZ && s.pos.z > g0.minZ) maxOff = Math.max(maxOff, Math.abs(s.pos.x - cx));
        if (s.pos.z < g0.minZ - 1.2 || g.events.some((e) => e.type === 'waterFall')) break;
    }
    const t = g.time() - t0;
    g.clearInput();
    return { pos: s.pos, t, maxOff, ev: g.events.map((e) => e.type).filter((e) => ['waterFall', 'fall', 'splash'].includes(e)) };
}, [pl.gap, cx, off, joy, keys]);
let r = await cross(0, null, true);
check('computer: walk straight across the middle of the third plank: no fall', r.ev.length === 0 && r.pos.z < pl.gap.minZ - 1, r);
r = await cross(0.4, null, true);
check('computer: 0.4 off centre (plank half-width 0.5): no fall', r.ev.length === 0 && r.pos.z < pl.gap.minZ - 1, r);
r = await cross(0.6, null, true);
check('0.6 off centre: off the plank, falls in', r.ev.includes('waterFall'), r);
r = await cross(0, { x: 0, y: -1 });
check('iPad circle pushed straight up: no fall', r.ev.length === 0 && r.pos.z < pl.gap.minZ - 1, r);
for (const jx of [0.03, 0.05, 0.08, 0.12]) {
    r = await cross(0, { x: jx, y: -1 });
    console.log('iPad circle off by', jx, JSON.stringify(r));
}
r = await cross(0, { x: 0, y: -0.5 });
check('iPad circle half pushed (slow walk): no fall', r.ev.length === 0 && r.pos.z < pl.gap.minZ - 1, r);
// The cannon ride, both ways
for (const i of [0, 1]) {
    r = await page.evaluate((i) => {
        const g = window.__game;
        g.restore();
        const c = g.state().cannons[i];
        g.teleport({ x: c.x, z: c.z });
        g.clearEvents();
        let s;
        for (let k = 0; k < 300; k++) s = g.step(1);
        return { c, pos: s.pos, ev: g.events.filter((e) => ['cannon', 'fall', 'waterFall'].includes(e.type)).map((e) => e.type + ':' + (e.what ?? '')) };
    }, i);
    check(`cannon ${i + 1}: fires and lands at the other cannon, no fall`, r.ev.includes('cannon:fire') && Math.hypot(r.pos.x - r.c.landing.x, r.pos.z - r.c.landing.z) < 0.6 && !r.ev.some((e) => e.startsWith('fall') || e.startsWith('waterFall')), r);
}
// Walking into the cannon gap: water fall + splash, back to start
r = await page.evaluate(([g0]) => {
    const g = window.__game;
    g.restore();
    g.teleport({ x: (g0.minX + g0.maxX) / 2, z: g0.minZ + 2, yaw: Math.PI });
    g.clearEvents();
    let s;
    for (let k = 0; k < 400; k++) s = g.step(1);
    return { ev: g.events.map((e) => e.type).filter((e) => ['waterFall', 'splash', 'fall'].includes(e)), text: g.text(), pos: s.pos };
}, [cp.gap]);
check('in the cannon gap: falls, splash, back to the start', r.ev.includes('waterFall') && r.ev.includes('splash'), r);
// Big splinter spike: Ouch
const row = st.spikeRows[0];
console.log('big spike', JSON.stringify(row));
r = await page.evaluate(([row]) => {
    const g = window.__game;
    const out = [];
    for (const [dx, dz, yaw] of [[2, 0, Math.PI / 2], [-2, 0, -Math.PI / 2], [0, 2, 0], [0, -2, Math.PI]]) {
        g.restore();
        g.teleport({ x: row.x + dx, z: row.z + dz, yaw });
        g.clearEvents();
        g.setInput({ forward: true });
        for (let k = 0; k < 120; k++) g.step(1);
        g.clearInput();
        out.push(g.events.some((e) => e.type === 'spike'));
    }
    return { out, msg: g.text() };
}, [row]);
check('walk into the big splinter spike: Ouch', r.out.some(Boolean), r);
// Shots
await page.evaluate(([g0, cx]) => { const g = window.__game; g.restore(); g.teleport({ x: cx, z: g0.maxZ + 3, yaw: 0 }); g.step(1); }, [pl.gap, cx]);
await shot('plank');
await page.evaluate(([g0, cx]) => { const g = window.__game; g.restore(); g.teleport({ x: cx, z: g0.maxZ - 4, yaw: 0 }); g.step(1); }, [pl.gap, cx]);
await shot('on-plank');
await page.evaluate(([g0]) => { const g = window.__game; g.restore(); g.teleport({ x: (g0.minX + g0.maxX) / 2, z: g0.minZ - 4.5, yaw: Math.PI }); g.step(1); }, [cp.gap]);
await shot('cannon');
await page.evaluate(([row]) => { const g = window.__game; g.restore(); g.teleport({ x: row.x + (row.spansX ? 0 : 4.5), z: row.z + (row.spansX ? 4.5 : 0), yaw: row.spansX ? 0 : Math.PI / 2 }); g.step(1); }, [row]);
await shot('bigspike');
await page.evaluate(() => { const g = window.__game; g.restore(); g.step(1); });
await shot('start');
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
check('no page errors', errors.length === 0, errors);
// Earlier plank levels still all-plank, Level 126 door leads on
const page2 = await ctx.newPage();
page2.on('pageerror', (e) => errors.push(String(e)));
await page2.goto(BASE + '/?test=1&level=125', { waitUntil: 'domcontentloaded', timeout: 90000 });
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
check('Level 126 door: Start Level 127', r.escaped && r.items[0] === 'Start Level 127', r);
for (const [lv, n] of [[121, 1], [123, 1]]) {
    await page2.goto(`${BASE}/?test=1&level=${lv}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page2.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
    const s2 = await page2.evaluate(() => window.__game.state());
    check(`Level ${lv + 1} unchanged: ${lv === 121 ? 'half plank' : 'half plank'}`, s2.platforms.length === n && s2.platforms[0].plank === 0.5, s2.platforms);
}
check('no page errors (other levels)', errors.length === 0, errors);
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
