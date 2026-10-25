// Level 124 checks (vite preview on 9173)
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
await page.goto(BASE + '/?test=1&level=123', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
await page.keyboard.press('Shift');
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 900)); };
const shot = (name) => page.screenshot({ path: `${SP}l124-${name}.png`, timeout: 180000 });
let st = await page.evaluate(() => window.__game.restore());
const p = st.platforms[0];
check('Level 124 loads: rocking, one half plank, one big spike, nothing else',
    st.level.name === 'Level 124' && !!st.rocking && st.platforms.length === 1 && p.plank === 0.5 && st.cannons.length === 0 && !st.spike && !st.spike2 && st.spikeRows.length === 1 && st.vents.length === 0 && st.tails.length === 0,
    { p, rows: st.spikeRows, rocking: st.rocking });
check('tune piraterock', (await page.evaluate(() => window.__sound?.tuneName)) === 'piraterock', {});
// The cycle: calm 6.5 s, tip 1.5 s (every 8 s), alternating sides, creak on each tip
let r = await page.evaluate(() => {
    const g = window.__game;
    g.restore();
    g.clearEvents();
    const ch = [];
    let last = g.state().rocking.phase, maxAngle = 0;
    for (let k = 0; k < 2200; k++) {
        const s = g.step(1);
        maxAngle = Math.max(maxAngle, s.rocking.angle);
        if (s.rocking.phase !== last) { ch.push([s.rocking.phase, g.time(), s.rocking.side]); last = s.rocking.phase; }
    }
    return { ch, maxAngle, creaks: g.events.filter((e) => e.type === 'sound' && e.name === 'shipCreak').length, rocks: g.events.filter((e) => e.type === 'rock').map((e) => e.side) };
});
console.log('rock phases', JSON.stringify(r.ch));
const tips = r.ch.filter((c) => c[0] === 'tip').map((c) => c[1]);
const calms = r.ch.filter((c) => c[0] === 'calm').map((c) => c[1]);
check('tips every 8 s, each 1.5 s, alternating sides, a creak each time',
    tips.length >= 3 && Math.abs(tips[1] - tips[0] - 8) < 0.05 && Math.abs(calms[0] - tips[0] - 1.5) < 0.05 && r.rocks[0] === -r.rocks[1] && r.creaks === tips.length && r.maxAngle > 0.06,
    { tips, calms, rocks: r.rocks, creaks: r.creaks, maxAngle: r.maxAngle });
// Standing still in the open (row 5 hallway, west part): slide a quarter cell toward the low side, then back on the next tip
const openX = 9.5, openZ = 22.5;
r = await page.evaluate(([x, z]) => {
    const g = window.__game;
    g.restore();
    g.teleport({ x, z, yaw: 0 });
    const out = [];
    for (let n = 0; n < 2; n++) {
        for (let k = 0; k < 2000; k++) { const s = g.step(1); if (s.rocking.phase === 'tip') break; }
        const before = g.state().pos, side = g.state().rocking.side;
        for (let k = 0; k < 2000; k++) { const s = g.step(1); if (s.rocking.phase === 'calm') break; }
        const after = g.state().pos;
        out.push({ side, dz: after.z - before.z, dx: after.x - before.x, yaw: g.state().yaw, pitch: g.state().pitch });
    }
    return out;
}, [openX, openZ]);
check('in the open: slides ~0.75 (a quarter of a 3-wide cell) toward the low side, then back', r.every((t) => Math.abs(Math.abs(t.dz) - 0.75) < 0.03 && Math.sign(t.dz) === t.side && Math.abs(t.dx) < 0.01) && r[0].side === -r[1].side, r);
check('the lean never changes where you look', r.every((t) => Math.abs(t.yaw) < 0.001 && Math.abs(t.pitch) < 0.001), r);
// Against a wall: stops at it
r = await page.evaluate(([x]) => {
    const g = window.__game;
    g.restore();
    let s;
    for (let k = 0; k < 2000; k++) { s = g.step(1); if (s.rocking.phase === 'calm' && s.rocking.timer < 0.2) break; }
    const side = s.rocking.side;
    // the low side's wall is at z 21 (side -1) or 24 (side 1)
    const z = side > 0 ? 23.4 : 21.6;
    g.teleport({ x, z, yaw: 0 });
    for (let k = 0; k < 2000; k++) { s = g.step(1); if (s.rocking.phase === 'calm') break; }
    return { side, from: z, to: s.pos.z };
}, [openX]);
check('beside a wall: stops at the wall', Math.abs(r.to - r.from) < 0.3 && (r.side > 0 ? r.to < 24 : r.to > 21), r);
// On the plank, and near the gap: no slide, no fall
const cz = (p.gap.minZ + p.gap.maxZ) / 2, cx = (p.gap.minX + p.gap.maxX) / 2;
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
r = await still(cx, cz + 0.6);
check('on the plank (near its edge): no slide, no fall over two tips', Math.abs(r.pos.z - r.z) < 0.001 && Math.abs(r.pos.x - r.x) < 0.001 && r.ev.length === 0, r);
r = await still(p.gap.maxX + 2.5, cz);
check('a cell from the gap\'s edge: no slide', Math.abs(r.pos.z - r.z) < 0.001 && r.ev.length === 0, r);
// Walk across the plank during a tip: no fall
r = await page.evaluate(([g0, cz]) => {
    const g = window.__game;
    g.restore();
    for (let k = 0; k < 2000; k++) { const s = g.step(1); if (s.rocking.phase === 'calm' && s.rocking.timer < 0.3) break; }
    g.teleport({ x: g0.maxX + 1.2, z: cz, yaw: Math.PI / 2 });
    g.clearEvents();
    g.setInput({ forward: true });
    let s;
    for (let k = 0; k < 300; k++) { s = g.step(1); if (s.pos.x < g0.minX - 1.2) break; }
    g.clearInput();
    return { pos: s.pos, ev: g.events.map((e) => e.type).filter((e) => ['waterFall', 'fall'].includes(e)) };
}, [p.gap, cz]);
check('walk across the plank (heading west) while the ship tips: no fall', r.ev.length === 0 && r.pos.x < p.gap.minX - 1, r);
// The big splinter spike: no slide beside it; walking into it is an Ouch
const row = st.spikeRows[0];
r = await still(row.x, row.z + (row.spansX ? 1.8 : 0) );
check('just in front of the big spike: no slide', Math.abs(r.pos.z - r.z) < 0.001 && Math.abs(r.pos.x - r.x) < 0.001 && r.ev.length === 0, r);
r = await page.evaluate(([row]) => {
    const g = window.__game;
    g.restore();
    g.teleport({ x: row.x, z: row.z + 2, yaw: 0 });
    g.clearEvents();
    g.setInput({ forward: true });
    for (let k = 0; k < 120; k++) g.step(1);
    g.clearInput();
    return { ev: g.events.map((e) => e.type), msg: g.text() };
}, [row]);
check('walk into the big splinter spike: Ouch, back to start', r.ev.includes('spike') && JSON.stringify(r.msg).includes('splinter'), r);
// Pause freezes the rocking (mid-tip)
await page.evaluate(() => { const g = window.__game; g.restore(); for (let k = 0; k < 2000; k++) { const s = g.step(1); if (s.rocking.phase === 'tip' && s.rocking.timer < 0.8) break; } });
const before = await page.evaluate(() => window.__game.state().rocking);
await page.keyboard.press('Space');
await page.evaluate(() => window.__game.setRealtime(true));
await page.waitForTimeout(1500);
const during = await page.evaluate(() => window.__game.state().rocking);
await page.keyboard.press('Space');
await page.waitForTimeout(200);
await page.evaluate(() => window.__game.setRealtime(false));
check('pause freezes the rocking', during.phase === before.phase && Math.abs(during.timer - before.timer) < 0.05 && during.angle === before.angle, { before, during });
// Shots: start view calm, mid-tip both ways
const toTip = (side) => page.evaluate((side) => { const g = window.__game; for (let k = 0; k < 3000; k++) { const s = g.step(1); if (s.rocking.phase === 'tip' && s.rocking.side === side && s.rocking.timer < 0.76) break; } }, side);
await page.evaluate(() => { const g = window.__game; g.restore(); g.teleport({ x: 9.5, z: 22.5, yaw: Math.PI / 2 + 0.2 }); g.step(1); });
await shot('calm');
await toTip(1);
await shot('tip-a');
await toTip(-1);
await shot('tip-b');
await page.evaluate(([g0, cz]) => { const g = window.__game; g.restore(); g.teleport({ x: g0.maxX + 4, z: cz, yaw: Math.PI / 2 }); g.step(1); }, [p.gap, cz]);
await shot('plank');
await page.evaluate(([row]) => { const g = window.__game; g.restore(); g.teleport({ x: row.x + (row.spansX ? 0.5 : 4), z: row.z + (row.spansX ? 4 : 0.4), yaw: row.spansX ? 0 : -Math.PI / 2 }); g.step(1); }, [row]);
await shot('bigspike');
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
await page2.goto(BASE + '/?test=1&level=122', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page2.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
r = await page2.evaluate(() => {
    const g = window.__game;
    const before = g.state().rocking;
    const d = g.maze().doorPosition;
    g.teleport({ x: d.x - 1.8, z: d.z, yaw: -Math.PI / 2 });
    g.setInput({ forward: true });
    let s;
    for (let i = 0; i < 40; i++) { s = g.step(2); if (s.escaped) break; }
    g.clearInput();
    g.step(30);
    const items = [...document.querySelectorAll('#menu-finish .item')].filter((e) => !e.hidden).map((e) => e.textContent);
    return { escaped: s.escaped, items, rocking: before };
});
check('Level 123 door: Start Level 124; Level 123 does not rock', r.escaped && r.items[0] === 'Start Level 124' && r.rocking === null, r);
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
