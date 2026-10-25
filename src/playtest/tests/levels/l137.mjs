// Level 137 checks (vite preview on 9173)
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
await page.goto(BASE + '/?test=1&level=136', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
await page.keyboard.press('Shift');
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 900)); };
const shot = (name) => page.screenshot({ path: `${SP}l137-${name}.png`, timeout: 180000 });
const ONLY = process.env.ONLY;
let r;
let st = await page.evaluate(() => window.__game.restore());
check('Level 137 loads: one propeller, one wind blowing west, one big spike, nothing else',
    st.level.name === 'Level 137' && st.propellers.length === 1 && st.winds.length === 1 && st.winds[0].dir.x === -1 && st.spikeRows.length === 1 && !st.spike && !st.spike2 && st.platforms.length === 0 && st.fogs.length === 0 && !st.trampoline && st.vents.length === 0,
    { pr: st.propellers, w: st.winds, rows: st.spikeRows, spike: st.spike });
check('tune skylong', (await page.evaluate(() => window.__sound?.tuneName)) === 'skylong', {});
const P = st.propellers[0];
console.log('propeller', JSON.stringify(P), 'start', JSON.stringify(st.pos));
const yawToDoor = P.alongX ? (P.center.x > P.target.x ? -Math.PI / 2 : Math.PI / 2) : (P.center.z > P.target.z ? Math.PI : 0);
r = await page.evaluate(() => { const g = window.__game; g.restore(); const a0 = g.state().propellers[0].angle; g.step(480); return { a0, a2: g.state().propellers[0].angle }; });
check('one full turn every 8 s', Math.abs(r.a2 - r.a0) < 0.01, r);
const through = (wait) => page.evaluate(([P, wait, yaw]) => {
    const g = window.__game;
    g.restore();
    g.teleport({ x: P.target.x, z: P.target.z, yaw });
    if (wait < 0) { const want = -wait; for (let k = 0; k < 600; k++) { const a = g.state().propellers[0].angle; const d = ((want - a) % Math.PI + Math.PI) % Math.PI; if (d < 0.02) break; g.step(1); } } else g.step(wait);
    g.clearEvents();
    g.setInput({ forward: true });
    let s;
    for (let k = 0; k < 75; k++) s = g.step(1);
    g.clearInput();
    return { pos: s.pos, ev: g.events.map((e) => e.type).filter((t) => ['propellerPush', 'spike', 'fall'].includes(t)), msg: g.text() };
}, [P, wait, yawToDoor]);
const past = (pos) => (P.alongX ? Math.sign(pos.x - P.center.x) === Math.sign(P.center.x - P.target.x) && Math.abs(pos.x - P.center.x) > 2 : Math.sign(pos.z - P.center.z) === Math.sign(P.center.z - P.target.z) && Math.abs(pos.z - P.center.z) > 2);
r = await through(1);
check('propeller: walk through while open', r.ev.length === 0 && past(r.pos), r);
r = await through(-(2 * Math.PI - 0.45));
check('propeller: walk into a blade = pushed back, no Ouch', r.ev.includes('propellerPush') && !r.ev.includes('spike') && !past(r.pos), r);
r = await page.evaluate((P) => {
    const g = window.__game; g.restore(); g.teleport({ x: P.center.x, z: P.center.z, yaw: 0 }); g.clearEvents();
    let s; for (let k = 0; k < 600; k++) s = g.step(1);
    return { pos: s.pos, ev: g.events.map((e) => e.type).filter((x) => ['propellerPush', 'spike', 'fall'].includes(x)) };
}, P);
check('propeller: standing under it, pushed to Q', r.ev.includes('propellerPush') && !r.ev.includes('spike') && Math.hypot(r.pos.x - P.target.x, r.pos.z - P.target.z) < 0.6, r);
// Wind
const walk = (pose, secs) => page.evaluate(([pose, secs]) => {
    const g = window.__game; g.restore(); g.teleport(pose); g.clearEvents(); g.setInput({ forward: true });
    const ps = []; for (let k = 0; k < secs * 60; k++) ps.push(g.step(1).pos); g.clearInput();
    const a = ps.at(-31), b = ps.at(-1); return { v: Math.hypot(b.x - a.x, b.z - a.z) / 0.5, bad: g.events.some((e) => ['spike', 'fall'].includes(e.type)) };
}, [pose, secs]);
const W = st.winds[0];
const wz = (W.minZ + W.maxZ) / 2;
const vOpen = (await walk({ x: st.pos.x, z: st.pos.z, yaw: -Math.PI / 2 }, 1)).v;
const into = await walk({ x: W.minX + 0.6, z: wz, yaw: -Math.PI / 2 }, 1.2);
const withW = await walk({ x: W.maxX - 0.6, z: wz, yaw: Math.PI / 2 }, 1.0);
check('wind: into ~60%, with ~140%, never into a hazard', Math.abs(into.v / vOpen - 0.6) < 0.04 && Math.abs(withW.v / vOpen - 1.4) < 0.04 && !into.bad && !withW.bad, { into, withW, vOpen, W });
r = await page.evaluate((W) => { const g = window.__game; g.restore(); g.teleport({ x: (W.minX + W.maxX) / 2, z: (W.minZ + W.maxZ) / 2, yaw: 0 }); const a = g.state().pos; g.step(120); const b = g.state().pos; return { a, b, ev: g.events.map((e) => e.type) }; }, W);
check('wind: standing still is not moved', Math.hypot(r.a.x - r.b.x, r.a.z - r.b.z) < 0.01, r);
// Big storm cloud
const Y = st.spikeRows[0];
const yx = Y.position?.x ?? Y.x, yz = Y.position?.z ?? Y.z;
console.log('big', JSON.stringify(Y));
const hit = (pose) => page.evaluate((pose) => {
    const g = window.__game; g.restore(); g.teleport(pose); g.clearEvents(); g.setInput({ forward: true });
    for (let k = 0; k < 90; k++) { g.step(1); if (g.events.some((e) => e.type === 'spike')) break; } g.clearInput();
    return { spike: g.events.some((e) => e.type === 'spike'), msg: g.text() };
}, pose);
const hits = [];
for (const [dx, dz, yaw] of [[0, -2.5, Math.PI], [0, 2.5, 0], [-2.5, 0, -Math.PI / 2], [2.5, 0, Math.PI / 2]]) hits.push(await hit({ x: yx + dx, z: yz + dz, yaw }));
check('big storm cloud: Ouch', hits.some((h) => h.spike && JSON.stringify(h.msg).includes('storm cloud')), hits);
// Screenshots
const pose = async (name, p, n = 30, angle) => { await page.evaluate(([p, n, angle]) => { const g = window.__game; g.restore(); g.teleport(p); g.step(n); if (angle !== undefined) { g.maze().propellers[0].angle = angle; g.maze().placePropeller(g.maze().propellers[0]); } }, [p, n, angle]); await shot(name); };
const back = (d) => P.alongX ? { x: P.center.x + Math.sign(P.target.x - P.center.x) * d, z: P.center.z } : { x: P.center.x, z: P.center.z + Math.sign(P.target.z - P.center.z) * d };
await pose('prop-near', { ...back(3), yaw: yawToDoor }, 10, 0.4);
await pose('prop-far', { ...back(7), yaw: yawToDoor }, 10, Math.PI / 2);
await pose('wind', { x: W.minX - 2, z: wz, yaw: -Math.PI / 2 });
await pose('big-n', { x: yx, z: yz - 4, yaw: Math.PI });
await pose('big-s', { x: yx, z: yz + 4, yaw: 0 });
await pose('start', { yaw: -Math.PI / 2 }, 1);
r = await page.evaluate(() => {
    const g = window.__game; g.restore();
    const d = g.maze().doorPosition;
    g.teleport({ x: d.x - 1.8, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true });
    let s; for (let i = 0; i < 40; i++) { s = g.step(2); if (s.escaped) break; } g.clearInput(); g.step(30);
    return { escaped: s.escaped, text: g.text() };
});
check('door: escape, More levels coming soon!', r.escaped && JSON.stringify(r.text).match(/More levels coming soon|Start (Level [0-9]+|[A-Z][a-zA-Z ]* World)/) !== null, r);
const page2 = await ctx.newPage();
page2.on('pageerror', (e) => errors.push(String(e)));
await page2.goto(BASE + '/?test=1&level=135', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page2.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
r = await page2.evaluate(() => {
    const g = window.__game; const d = g.maze().doorPosition;
    g.teleport({ x: d.x - 1.8, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true });
    let s; for (let i = 0; i < 40; i++) { s = g.step(2); if (s.escaped) break; } g.clearInput(); g.step(30);
    const items = [...document.querySelectorAll('#menu-finish .item')].filter((e) => !e.hidden).map((e) => e.textContent);
    return { escaped: s.escaped, items };
});
check('Level 136 door: Start Level 137', r.escaped && r.items[0] === 'Start Level 137', r);
check('no page errors', errors.length === 0, errors);
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
