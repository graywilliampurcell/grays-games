// Level 128 checks (vite preview on 9173)
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
await page.goto(BASE + '/?test=1&level=127', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
await page.keyboard.press('Shift');
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 900)); };
const shot = (name) => page.screenshot({ path: `${SP}l128-${name}.png`, timeout: 180000 });

let st = await page.evaluate(() => window.__game.restore());
check('Level 128 loads: rocking, two third planks, nothing else',
    st.level.name === 'Level 128' && !!st.rocking && st.platforms.length === 2 && st.platforms.every((p) => Math.abs(p.plank - 1 / 3) < 1e-6) && st.cannons.length === 0 && !st.spike && !st.spike2 && st.spikeRows.length === 0 && st.vents.length === 0 && st.tails.length === 0,
    { pls: st.platforms.map((p) => [p.gap, p.plank]), rocking: st.rocking });
check('tune piratetwoplanks', (await page.evaluate(() => window.__sound?.tuneName)) === 'piratetwoplanks', {});
// Cross each plank (along x) both directions: dir +1 = east (yaw -PI/2), -1 = west
const cross = (gi, dir, off, joy, waitTip) => page.evaluate(([gi, dir, off, joy, waitTip]) => {
    const g = window.__game;
    g.restore();
    const g0 = g.state().platforms[gi].gap;
    const cz = (g0.minZ + g0.maxZ) / 2;
    if (waitTip) for (let k = 0; k < 2000; k++) { const s = g.step(1); if (s.rocking.phase === 'calm' && s.rocking.timer < 0.3) break; }
    g.teleport({ x: dir > 0 ? g0.minX - 1.2 : g0.maxX + 1.2, z: cz + off, yaw: dir > 0 ? -Math.PI / 2 : Math.PI / 2 });
    g.clearEvents();
    g.setInput(joy ? { joystick: joy } : { forward: true });
    let s, maxOff = 0, tipped = false;
    const t0 = g.time();
    for (let k = 0; k < 600; k++) {
        s = g.step(1);
        if (s.rocking.phase === 'tip') tipped = true;
        if (s.pos.x > g0.minX && s.pos.x < g0.maxX) maxOff = Math.max(maxOff, Math.abs(s.pos.z - cz));
        if ((dir > 0 ? s.pos.x > g0.maxX + 1.2 : s.pos.x < g0.minX - 1.2) || g.events.some((e) => e.type === 'waterFall')) break;
    }
    g.clearInput();
    return { gi, dir, t: g.time() - t0, pos: s.pos, maxOff, tipped, ev: g.events.map((e) => e.type).filter((e) => ['waterFall', 'fall', 'splash'].includes(e)) };
}, [gi, dir, off, joy, waitTip]);
for (const gi of [0, 1]) for (const dir of [1, -1]) {
    let r = await cross(gi, dir, 0, null, false);
    check(`plank ${gi + 1} dir ${dir}: computer straight across the middle: no fall`, r.ev.length === 0, r);
    r = await cross(gi, dir, 0.4, null, false);
    check(`plank ${gi + 1} dir ${dir}: 0.4 off centre: no fall`, r.ev.length === 0, r);
    r = await cross(gi, dir, 0.6, null, false);
    check(`plank ${gi + 1} dir ${dir}: 0.6 off centre: falls in`, r.ev.includes('waterFall'), r);
    r = await cross(gi, dir, 0, { x: 0, y: -1 }, false);
    check(`plank ${gi + 1} dir ${dir}: iPad circle straight: no fall`, r.ev.length === 0, r);
    r = await cross(gi, dir, 0, { x: 0, y: -0.5 }, false);
    check(`plank ${gi + 1} dir ${dir}: iPad half push (slow): no fall`, r.ev.length === 0, r);
    r = await cross(gi, dir, 0, null, true);
    check(`plank ${gi + 1} dir ${dir}: walk across while the ship tips: no fall`, r.ev.length === 0 && r.tipped, r);
}
// Standing on each plank (near its edge) through two tips: no slide, no fall; also a cell from the gap edge
const still = (x, z) => page.evaluate(([x, z]) => {
    const g = window.__game;
    g.restore();
    g.teleport({ x, z, yaw: Math.PI / 2 });
    g.clearEvents();
    let s;
    for (let n = 0; n < 2; n++) {
        for (let k = 0; k < 2000; k++) { s = g.step(1); if (s.rocking.phase === 'tip') break; }
        for (let k = 0; k < 2000; k++) { s = g.step(1); if (s.rocking.phase === 'calm') break; }
    }
    return { pos: s.pos, x, z, ev: g.events.map((e) => e.type).filter((e) => ['waterFall', 'fall', 'spike'].includes(e)) };
}, [x, z]);
for (const p of st.platforms) {
    const cx = (p.gap.minX + p.gap.maxX) / 2, cz = (p.gap.minZ + p.gap.maxZ) / 2;
    for (const dz of [0.4, -0.4]) {
        const r = await still(cx, cz + dz);
        check(`on a plank ${dz}: no slide, no fall over two tips`, Math.abs(r.pos.z - r.z) < 0.001 && Math.abs(r.pos.x - r.x) < 0.001 && r.ev.length === 0, r);
    }
    for (const x of [p.gap.minX - 2.5, p.gap.maxX + 2.5]) {
        const r = await still(x, cz);
        check('a cell from the gap edge: no slide', Math.abs(r.pos.z - r.z) < 0.001 && r.ev.length === 0, r);
    }
}
// Slides in the open (start cell)
let r = await page.evaluate(() => {
    const g = window.__game;
    g.restore();
    const out = [];
    for (let n = 0; n < 2; n++) {
        for (let k = 0; k < 2000; k++) { const s = g.step(1); if (s.rocking.phase === 'tip') break; }
        const before = g.state().pos, side = g.state().rocking.side;
        for (let k = 0; k < 2000; k++) { const s = g.step(1); if (s.rocking.phase === 'calm') break; }
        const after = g.state().pos;
        out.push({ side, dz: after.z - before.z });
    }
    return out;
}, []);
check('at the start: the ship rocks and you slide a quarter cell toward the low side', r.every((t) => Math.abs(Math.abs(t.dz) - 0.75) < 0.05 && Math.sign(t.dz) === t.side), r);
// Fall into the first gap: fall + splash + back to the start
r = await page.evaluate(() => {
    const g = window.__game;
    g.restore();
    const g0 = g.state().platforms[0].gap;
    g.teleport({ x: (g0.minX + g0.maxX) / 2, z: g0.minZ + 0.4, yaw: 0 });
    g.clearEvents();
    let s;
    for (let k = 0; k < 400; k++) s = g.step(1);
    return { ev: g.events.map((e) => e.type).filter((e) => ['waterFall', 'splash', 'fall'].includes(e)), text: g.text(), pos: s.pos, start: g.maze().startPosition };
});
check('off the plank: falls, splash, back to the start', r.ev.includes('waterFall') && r.ev.includes('splash') && JSON.stringify(r.text).includes('Splash'), r);
// Shots
for (const [i, p] of st.platforms.entries()) {
    const cz = (p.gap.minZ + p.gap.maxZ) / 2;
    await page.evaluate(([g0, cz, i]) => { const g = window.__game; g.restore(); g.teleport({ x: i === 0 ? g0.minX - 3 : g0.maxX + 3, z: cz, yaw: i === 0 ? -Math.PI / 2 : Math.PI / 2 }); g.step(1); }, [p.gap, cz, i]);
    await shot(`plank${i + 1}`);
}
await page.evaluate(([g0]) => { const g = window.__game; g.restore(); g.teleport({ x: (g0.minX + g0.maxX) / 2, z: (g0.minZ + g0.maxZ) / 2, yaw: -Math.PI / 2 }); g.step(1); }, [st.platforms[0].gap]);
await shot('on-plank');
await page.evaluate(() => { const g = window.__game; g.restore(); for (let k = 0; k < 2000; k++) { const s = g.step(1); if (s.rocking.phase === 'tip' && s.rocking.timer > 0.7) break; } });
await shot('tip');
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
const page2 = await ctx.newPage();
page2.on('pageerror', (e) => errors.push(String(e)));
await page2.goto(BASE + '/?test=1&level=126', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page2.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
r = await page2.evaluate(() => {
    const g = window.__game;
    const st = g.state();
    const d = g.maze().doorPosition;
    g.teleport({ x: d.x - 1.8, z: d.z, yaw: -Math.PI / 2 });
    g.setInput({ forward: true });
    let s;
    for (let i = 0; i < 40; i++) { s = g.step(2); if (s.escaped) break; }
    g.clearInput();
    g.step(30);
    const items = [...document.querySelectorAll('#menu-finish .item')].filter((e) => !e.hidden).map((e) => e.textContent);
    return { escaped: s.escaped, items, planks: st.platforms.map((p) => p.plank), cannons: st.cannons.length };
});
check('Level 127 unchanged (one plank + cannons) and its door: Start Level 128', r.escaped && r.items[0] === 'Start Level 128' && r.cannons === 2, r);
check('no page errors (other levels)', errors.length === 0, errors);
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
