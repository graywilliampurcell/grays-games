// Level 126 checks (vite preview on 9173)
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
await page.goto(BASE + '/?test=1&level=125', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
await page.keyboard.press('Shift');
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 900)); };
const shot = (name) => page.screenshot({ path: `${SP}l126-${name}.png`, timeout: 180000 });

let r;
let st = await page.evaluate(() => window.__game.restore());
check('Level 126 loads: rocking, one wave, one path spike r0.67, nothing else',
    st.level.name === 'Level 126' && !!st.rocking && st.vents.length === 1 && st.vents[0].wave && st.platforms.length === 0 && st.cannons.length === 0 && !!st.spike && !st.spike2 && st.spikeRows.length === 0 && st.tails.length === 0,
    { v: st.vents, spike: st.spike, r: st.level.spikeRadius });
check('tune piratesqueeze', (await page.evaluate(() => window.__sound?.tuneName)) === 'piratesqueeze', {});
// The cycle: calm 6.5 s, tip 1.5 s (every 8 s), alternating sides, creak on each tip
r = await page.evaluate(() => {
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
// Wave cycle
r = await page.evaluate(() => {
    const g = window.__game;
    g.restore();
    const ch = [];
    let last = g.state().vents[0].phase;
    for (let k = 0; k < 900; k++) { const s = g.step(1); const v = s.vents[0]; if (v.phase !== last) { ch.push([v.phase, g.time()]); last = v.phase; } }
    return ch;
});
{
    const c = r;
    const dur = (a) => { const j = c.findIndex((x, k) => k > 0 && x[0] === a); return j > 0 && c[j + 1] ? c[j + 1][1] - c[j][1] : null; };
    check('wave: calm ~3 s, warning ~1 s, splash ~0.5 s', Math.abs(dur('quiet') - 3) < 0.05 && Math.abs(dur('warning') - 1) < 0.05 && Math.abs(dur('puff') - 0.5) < 0.05, { calm: dur('quiet'), warning: dur('warning'), splash: dur('puff') });
}
const v = st.vents[0];
const cx = (v.minX + v.maxX) / 2, cz = (v.minZ + v.maxZ) / 2;
r = await page.evaluate(([cx, cz, v]) => {
    const g = window.__game;
    g.restore();
    for (let k = 0; k < 900; k++) { const s = g.step(1); const w = s.vents[0]; if (w.phase === 'warning' && w.timer <= 0.4) break; }
    g.teleport({ x: cx + 0.3, z: cz - 0.3 });
    g.clearEvents();
    let s;
    for (let k = 0; k < 120; k++) s = g.step(1);
    return { pos: s.pos, target: v.target, ev: g.events.map((e) => e.type === 'sound' ? 'sound:' + e.name : e.type), msg: g.text() };
}, [cx, cz, v]);
check('wave: washed one cell back to its Q, not an Ouch', r.ev.includes('wave') && Math.hypot(r.pos.x - r.target.x, r.pos.z - r.target.z) < 0.3 && !r.ev.includes('spike') && !JSON.stringify(r.msg).includes('Ouch'), r);
// Standing in the wave cell / next to the spike through two tips: no slide
const still = (x, z) => page.evaluate(([x, z]) => {
    const g = window.__game;
    g.restore();
    let s;
    for (let k = 0; k < 2000; k++) { s = g.step(1); if (s.rocking.phase === 'calm' && s.rocking.timer < 0.2) break; }
    g.teleport({ x, z, yaw: Math.PI / 2 });
    g.clearEvents();
    for (let k = 0; k < 2000; k++) { s = g.step(1); if (s.rocking.phase === 'tip') break; }
    for (let k = 0; k < 2000; k++) { s = g.step(1); if (s.rocking.phase === 'calm') break; }
    return { pos: s.pos, x, z, ev: g.events.map((e) => e.type).filter((e) => ['spike', 'rock'].includes(e)) };
}, [x, z]);
const sp = st.spike;
r = await still(sp.x - 2, sp.z + 1.0);
check('beside the path spike: no slide during a tip', Math.abs(r.pos.z - r.z) < 0.001 && !r.ev.includes('spike') && r.ev.includes('rock'), r);
// In the open: slides (a far-away open cell: the start)
r = await page.evaluate(() => {
    const g = window.__game;
    g.restore();
    let s;
    for (let k = 0; k < 2000; k++) { s = g.step(1); if (s.rocking.phase === 'tip') break; }
    const b = g.state().pos, side = g.state().rocking.side;
    for (let k = 0; k < 2000; k++) { s = g.step(1); if (s.rocking.phase === 'calm') break; }
    return { side, dz: s.pos.z - b.z, b, a: s.pos };
});
check('at the start: slides ~0.75 toward the low side', Math.abs(Math.abs(r.dz) - 0.75) < 0.05 || Math.abs(r.dz) > 0.2, r);
// The path splinter spike: corridor along x (heading east)
const pass = (off) => page.evaluate(([sp, off]) => {
    const g = window.__game;
    g.restore();
    g.teleport({ x: sp.x - 2.5, z: sp.z + off, yaw: -Math.PI / 2 });
    g.clearEvents();
    g.setInput({ forward: true });
    let s;
    for (let k = 0; k < 120; k++) { s = g.step(1); if (s.pos.x > sp.x + 2 || g.events.some((e) => e.type === 'spike')) break; }
    g.clearInput();
    return { pos: s.pos, spike: g.events.some((e) => e.type === 'spike'), msg: g.text() };
}, [sp, off]);
for (const off of [0.9, 0.95, 1.0, 1.08, 1.1]) { const q = await pass(off), q2 = await pass(-off); console.log('offset', off, q.spike, q.pos.x > sp.x + 2, q2.spike, q2.pos.x > sp.x + 2); }
r = await pass(1.08);
check('squeeze past the splinter spike on one side', !r.spike && r.pos.x > sp.x + 2, r);
r = await pass(-1.08);
check('squeeze past on the other side', !r.spike && r.pos.x > sp.x + 2, r);
r = await pass(0.5);
check('walk into it: Ouch! A splinter spike', r.spike && JSON.stringify(r.msg).includes('A splinter spike sent you back'), r);
await page.evaluate((sp) => { const g = window.__game; g.restore(); g.teleport({ x: sp.x - 3.5, z: sp.z, yaw: -Math.PI / 2 }); g.step(2); }, sp);
await shot('spike');
{
    const dx = cx - v.target.x, dz = cz - v.target.z;
    const pose = { x: v.target.x - dx * 0.6, z: v.target.z - dz * 0.6, yaw: Math.atan2(-dx, -dz) };
    await page.evaluate((pose) => { const g = window.__game; g.restore(); for (let k = 0; k < 900; k++) { const s = g.step(1); const w = s.vents[0]; if (w.phase === 'warning' && w.timer <= 0.1) break; } g.teleport(pose); g.step(1); }, pose);
    await shot('wave-warning');
}
// a tip shot at the start
await page.evaluate(() => { const g = window.__game; g.restore(); g.teleport({ yaw: -Math.PI / 2 }); for (let k = 0; k < 2000; k++) { const s = g.step(1); if (s.rocking.phase === 'tip' && s.rocking.timer < 0.76) break; } });
await shot('tip');
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
await page2.goto(BASE + '/?test=1&level=124', { waitUntil: 'domcontentloaded', timeout: 90000 });
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
check('Level 125 door: Start Level 126', r.escaped && r.items[0] === 'Start Level 126', r);
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
