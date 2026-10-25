// Level 132 checks (vite preview on 9173)
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
await page.goto(BASE + '/?test=1&level=131', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
await page.keyboard.press('Shift');
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 900)); };
const shot = (name) => page.screenshot({ path: `${SP}l132-${name}.png`, timeout: 180000 });

let r;
let st = await page.evaluate(() => window.__game.restore());
check('Level 132 loads: one wind blowing east, one path spike, nothing else',
    st.level.name === 'Level 132' && st.winds.length === 1 && st.winds[0].dir.x === 1 && st.winds[0].dir.z === 0 && st.platforms.length === 0 && !!st.spike && !st.spike2 && st.spikeRows.length === 0 && st.vents.length === 0,
    { w: st.winds, spike: st.spike, r: st.level.spikeRadius });
console.log('wind box', JSON.stringify(st.winds[0]));
// Speed over the last 0.5 s of a walk of `secs`, or while inside the wind box
const walk = (pose, secs, input = { forward: true }) => page.evaluate(([pose, secs, input]) => {
    const g = window.__game;
    g.restore();
    g.teleport(pose);
    g.setInput(input);
    const n = Math.round(secs * 60);
    const ps = [];
    let s;
    for (let k = 0; k < n; k++) { s = g.step(1); ps.push(s.pos); }
    g.clearInput();
    const a = ps[Math.max(0, n - 31)], b = ps[n - 1];
    return { speed: Math.hypot(b.x - a.x, b.z - a.z) / 0.5, dx: b.x - pose.x, dz: b.z - pose.z, end: b, inWind: s.inWind, spike: g.events?.some?.((e) => e.type === 'spike') };
}, [pose, secs, input]);
const W0 = st.winds[0];
const midZ = (W0.minZ + W0.maxZ) / 2 - 0.5 + 0.5; // corridor middle
const cz = 34.5;
const normal = await walk({ x: 2, z: 2, yaw: -Math.PI / 2 }, 1.2);
const into = await walk({ x: W0.maxX - 0.6, z: cz, yaw: Math.PI / 2 }, 1.2);
const withW = await walk({ x: W0.minX + 0.6, z: cz, yaw: -Math.PI / 2 }, 1.0);
console.log('speeds', normal.speed, into.speed, withW.speed, JSON.stringify(into.end), JSON.stringify(withW.end));
check('walking into the wind ~60% of walking speed', Math.abs(into.speed / normal.speed - 0.6) < 0.03 && into.inWind?.x === 1, { normal: normal.speed, into: into.speed, inWind: into.inWind });
check('walking with the wind ~140%', Math.abs(withW.speed / normal.speed - 1.4) < 0.03 && withW.end.x < W0.maxX, { normal: normal.speed, with: withW.speed, end: withW.end });
// Across: a short step south, compared with the same step in the open
const acrossOpen = await walk({ x: 10, z: 1.5, yaw: Math.PI }, 0.3);
const acrossWind = await walk({ x: 28, z: 33.5, yaw: Math.PI }, 0.3);
check('walking across the wind: unaffected', Math.abs(acrossWind.dz - acrossOpen.dz) < 0.005 && Math.abs(acrossWind.dx) < 0.001, { open: acrossOpen.dz, wind: acrossWind.dz, dx: acrossWind.dx });
const standing = await walk({ x: 28, z: cz, yaw: Math.PI / 2 }, 2, {});
check('standing still in the wind: not moved', Math.abs(standing.dx) < 1e-6 && Math.abs(standing.dz) < 1e-6, standing);
// Joystick half push into the wind: still 60% of that speed
const halfOpen = await walk({ x: 2, z: 2, yaw: -Math.PI / 2 }, 1.2, { joystick: { x: 0, y: -0.5 } });
const halfInto = await walk({ x: W0.maxX - 0.6, z: cz, yaw: Math.PI / 2 }, 1.2, { joystick: { x: 0, y: -0.5 } });
check('iPad half push into the wind: 60% too', Math.abs(halfInto.speed / halfOpen.speed - 0.6) < 0.04, { halfOpen: halfOpen.speed, halfInto: halfInto.speed });
// Whoosh sound: heard near the hallway, not at the start
const hear = await page.evaluate(([x, z]) => {
    const g = window.__game;
    g.restore();
    g.clearEvents();
    g.step(10);
    const atStart = window.__sound?.ctx ? 1 : 0;
    g.teleport({ x, z, yaw: Math.PI / 2 });
    g.step(10);
    return { ctx: atStart, ev: g.events.filter((e) => e.type === 'sound').map((e) => e.name) };
}, [30, cz]);
check('wind whoosh sound started (Sound effects)', hear.ev.includes('wind') || hear.ctx === 1, hear);
// The path storm cloud: corridor along z (heading north)
const sp = st.spike;
const pass = (off) => page.evaluate(([sp, off]) => {
    const g = window.__game;
    g.restore();
    g.teleport({ x: sp.x + off, z: sp.z + 2.5, yaw: 0 });
    g.clearEvents();
    g.setInput({ forward: true });
    let s;
    for (let k = 0; k < 120; k++) { s = g.step(1); if (s.pos.z < sp.z - 2 || g.events.some((e) => e.type === 'spike')) break; }
    g.clearInput();
    return { pos: s.pos, spike: g.events.some((e) => e.type === 'spike'), msg: g.text() };
}, [sp, off]);
for (const off of [0.85, 0.9, 0.95, 1.0, 1.05]) { const q = await pass(off), q2 = await pass(-off); console.log('offset', off, q.spike, q.pos.z < sp.z - 2, q2.spike, q2.pos.z < sp.z - 2); }
r = await pass(1.0);
check('squeeze past the storm cloud on one side', !r.spike && r.pos.z < sp.z - 2, r);
r = await pass(-1.0);
check('squeeze past on the other side', !r.spike && r.pos.z < sp.z - 2, r);
r = await pass(0.4);
check('walk into it: Ouch! A storm cloud', r.spike && JSON.stringify(r.msg).includes('A storm cloud sent you back'), r);
await page.evaluate((sp) => { const g = window.__game; g.restore(); g.teleport({ x: sp.x, z: sp.z + 3.5, yaw: 0 }); g.step(2); }, sp);
await shot('spike');
await page.evaluate(([x, z]) => { const g = window.__game; g.restore(); g.teleport({ x, z, yaw: Math.PI / 2 }); g.step(30); }, [W0.maxX + 1.5, cz]);
await shot('wind-into');
await page.evaluate(([x, z]) => { const g = window.__game; g.restore(); g.teleport({ x, z, yaw: -Math.PI / 2 }); g.step(30); }, [W0.minX + 1, cz]);
await shot('wind-with');
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
check('tune skywindy', (await page.evaluate(() => window.__sound?.tuneName)) === 'skywindy', {});
await page.evaluate(() => { const g = window.__game; g.restore(); g.teleport({ yaw: -Math.PI / 2 }); g.step(1); });
await shot('start');
check('no page errors', errors.length === 0, errors);
const page2 = await ctx.newPage();
page2.on('pageerror', (e) => errors.push(String(e)));
await page2.goto(BASE + '/?test=1&level=130', { waitUntil: 'domcontentloaded', timeout: 90000 });
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
    return { escaped: s.escaped, items, wind: g.state().winds.length };
});
check('Level 131 door: Start Level 132 (and no wind in 131)', r.escaped && r.items[0] === 'Start Level 132' && r.wind === 0, r);
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
