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
await page.goto(BASE + '/?test=1&level=121', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
await page.keyboard.press('Shift');
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 900)); };
const shot = (name) => page.screenshot({ path: `${SP}l122-${name}.png`, timeout: 180000 });
let st = await page.evaluate(() => window.__game.restore());
const p = st.platforms[0];
check('Level 122 loads: one plank gap (half), a path spike, nothing else',
    st.level.name === 'Level 122' && st.platforms.length === 1 && p.plank === 0.5 && st.cannons.length === 0 && !!st.spike && !st.spike2 && st.spikeRows.length === 0 && st.tails.length === 0 && st.vents.length === 0 && st.geysers.length === 0 && st.belts.length === 0,
    { p, spike: st.spike });
check('gap 3 cells long (span 11), crossed along x, 3 wide', p.span === 11 && p.alongX && p.gap.maxZ - p.gap.minZ === 3, p.gap);
check('tune pirateplank', (await page.evaluate(() => window.__sound?.tuneName)) === 'pirateplank', {});
const cz = (p.gap.minZ + p.gap.maxZ) / 2;
const yawE = -Math.PI / 2;
// Walk straight across the middle of the plank, heading east
const cross = (off) => page.evaluate(([g0, cz, off, yawE]) => {
    const g = window.__game;
    g.restore();
    g.teleport({ x: g0.minX - 1.5, z: cz + off, yaw: yawE });
    g.clearEvents();
    g.setInput({ forward: true });
    let s, t0 = null, t1 = null;
    for (let k = 0; k < 300; k++) {
        s = g.step(1);
        if (t0 === null && s.pos.x >= g0.minX) t0 = g.time();
        if (t1 === null && s.pos.x >= g0.maxX) t1 = g.time();
        if (s.pos.x > g0.maxX + 1.5 || g.events.some((e) => e.type === 'waterFall')) break;
    }
    g.clearInput();
    return { pos: s.pos, time: t1 - t0, ev: g.events.map((e) => e.type).filter((e) => ['waterFall', 'fall', 'splash'].includes(e)) };
}, [p.gap, cz, off, yawE]);
let r = await cross(0);
check('walk across the middle of the plank: no fall', r.ev.length === 0 && r.pos.x > p.gap.maxX + 1, r);
console.log('crossing time', r.time);
r = await cross(0.6);
check('walk across near its edge (0.6 off the middle): no fall', r.ev.length === 0 && r.pos.x > p.gap.maxX + 1, r);
r = await cross(-0.6);
check('walk across near its other edge: no fall', r.ev.length === 0 && r.pos.x > p.gap.maxX + 1, r);
r = await cross(1.0);
check('walk in beside the plank: falls in', r.ev.includes('waterFall'), r);
await page.evaluate(() => window.__game.step(200));
// Shot: before the plank, looking across
await page.evaluate(([g0, cz, yawE]) => { const g = window.__game; g.restore(); g.teleport({ x: g0.minX - 3, z: cz, yaw: yawE }); g.step(2); }, [p.gap, cz, yawE]);
await shot('plank');
await page.evaluate(([g0, cz, yawE]) => { const g = window.__game; g.teleport({ x: g0.minX + 4, z: cz, yaw: yawE, pitch: -0.6 }); g.step(2); }, [p.gap, cz, yawE]);
await shot('on-plank');
// Step off the side half way across: fall ~1.5 s, splash, Ouch! Splash! Back to the start.
r = await page.evaluate(([g0, cz]) => {
    const g = window.__game;
    g.restore();
    g.teleport({ x: g0.minX + 5.5, z: cz, yaw: Math.PI }); // facing +z (south)
    g.clearEvents();
    g.setInput({ forward: true });
    let s = g.step(1);
    let tStart = null, tSplash = null, tFall = null, minEye = 99, fallAt = null;
    for (let k = 0; k < 400; k++) {
        s = g.step(1);
        const ev = g.events.map((e) => e.type);
        if (tStart === null && ev.includes('waterFall')) { tStart = g.time(); g.clearInput(); fallAt = s.pos; }
        if (tStart !== null) minEye = Math.min(minEye, s.eyeY);
        if (tSplash === null && ev.includes('splash')) tSplash = g.time();
        if (ev.includes('fall')) { tFall = g.time(); break; }
    }
    return { tStart, tSplash, tFall, minEye, fallAt, pos: s.pos, start: s.start, msg: g.text(), sounds: g.events.filter((e) => e.type === 'sound').map((e) => e.name) };
}, [p.gap, cz]);
check('step off the side: falls ~1.5 s down to the sea, splash, Ouch! Splash! Back to the start.',
    r.tStart !== null && r.fallAt.z - cz > 0.74 && r.fallAt.z - cz < 0.95 && Math.abs(r.tSplash - r.tStart - 1.5) < 0.05 && r.tFall - r.tSplash > 0.6 && r.minEye < -6 && Math.hypot(r.pos.x - r.start.x, r.pos.z - r.start.z) < 0.1 && JSON.stringify(r.msg).includes('Ouch! Splash! Back to the start.') && r.sounds.includes('splash') && r.sounds.includes('ouch'), r);
// Shots of the fall and the splash (step off the north side)
await page.evaluate(([g0, cz]) => {
    const g = window.__game;
    g.teleport({ x: g0.minX + 5.5, z: cz, yaw: 0 });
    g.clearEvents();
    g.setInput({ forward: true });
    for (let k = 0; k < 200 && !g.events.some((e) => e.type === 'waterFall'); k++) g.step(1);
    g.clearInput();
    g.step(30);
}, [p.gap, cz]);
await shot('falling1');
await page.evaluate(() => window.__game.step(30));
await shot('falling2');
await page.evaluate(() => window.__game.step(40));
await shot('splash');
await page.evaluate(() => window.__game.step(60));
// The camera falls beside the plank, not through it
r = await page.evaluate(([g0, cz]) => {
    const g = window.__game;
    g.restore();
    g.teleport({ x: g0.minX + 5.5, z: cz, yaw: 0 });
    g.clearEvents();
    g.setInput({ forward: true });
    for (let k = 0; k < 200 && !g.events.some((e) => e.type === 'waterFall'); k++) g.step(1);
    g.clearInput();
    g.step(10);
    const c = g.camera?.() ?? null;
    const s = g.state();
    g.step(200);
    return { cam: c ? { x: c.position.x, z: c.position.z } : null, eye: s.eyeY };
}, [p.gap, cz]);
console.log('fall camera', JSON.stringify(r));
// Walking off the start end of the plank back onto the deck: fine
// The path splinter spike: squeeze past on both sides, Ouch in the middle (heading south, corridor along z)
const sp = st.spike;
const pass = (off) => page.evaluate(([sp, off]) => {
    const g = window.__game;
    g.restore();
    g.teleport({ x: sp.x + off, z: sp.z - 2.5, yaw: Math.PI });
    g.clearEvents();
    g.setInput({ forward: true });
    let s;
    for (let k = 0; k < 120; k++) { s = g.step(1); if (s.pos.z > sp.z + 2 || g.events.some((e) => e.type === 'spike')) break; }
    g.clearInput();
    return { pos: s.pos, spike: g.events.some((e) => e.type === 'spike'), msg: g.text() };
}, [sp, off]);
r = await pass(1.06);
check('squeeze past the splinter spike on one side', !r.spike && r.pos.z > sp.z + 2, r);
r = await pass(-1.06);
check('squeeze past on the other side', !r.spike && r.pos.z > sp.z + 2, r);
r = await pass(0.5);
check('walk into it: Ouch! A splinter spike', r.spike && JSON.stringify(r.msg).includes('A splinter spike sent you back'), r);
await page.evaluate((sp) => { const g = window.__game; g.restore(); g.teleport({ x: sp.x, z: sp.z - 3.5, yaw: Math.PI }); g.step(2); }, sp);
await shot('spike');
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
// Level 121's door: Start Level 122
const page2 = await ctx.newPage();
page2.on('pageerror', (e) => errors.push(String(e)));
await page2.goto(BASE + '/?test=1&level=120', { waitUntil: 'domcontentloaded', timeout: 90000 });
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
    return { escaped: s.escaped, items, note: !document.getElementById('finish-note').hidden };
});
check('Level 121 door: Start Level 122', r.escaped && r.items[0] === 'Start Level 122' && !r.note, r);
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
