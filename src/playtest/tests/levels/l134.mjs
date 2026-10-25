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
await page.goto(BASE + '/?test=1&level=133', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
await page.keyboard.press('Shift');
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 900)); };
const shot = (name) => page.screenshot({ path: `${SP}l134-${name}.png`, timeout: 180000 });
let r;
let st = await page.evaluate(() => window.__game.restore());
check('Level 134 loads: one fog, one wind blowing north, one big spike, nothing else',
    st.level.name === 'Level 134' && st.fogs.length === 1 && st.winds.length === 1 && st.winds[0].dir.z === -1 && st.spikeRows.length === 1 && !st.spike && !st.spike2 && st.platforms.length === 0 && !st.trampoline && st.vents.length === 0,
    { fogs: st.fogs, w: st.winds, rows: st.spikeRows, spike: st.spike });
const F = st.fogs[0];
console.log('fog', JSON.stringify(F), 'fogView', st.fogView);
// Walk south through the fog from just north of it, noting how deep the fog view gets
const fx = (F.minX + F.maxX) / 2;
r = await page.evaluate(([fx, z0]) => {
    const g = window.__game;
    g.restore();
    g.teleport({ x: fx, z: z0, yaw: Math.PI });
    g.clearEvents();
    g.setInput({ forward: true });
    const trace = [];
    let s;
    for (let k = 0; k < 180; k++) { s = g.step(1); const t = g.state(); trace.push([Math.round(t.pos?.z * 10) / 10 || Math.round(s.pos.z * 10) / 10, t.fogView]); }
    g.clearInput();
    return { trace, spike: g.events.some((e) => e.type === 'spike'), end: s.pos };
}, [fx, F.minZ - 3]);
const inside = r.trace.filter(([z]) => z > F.minZ + 2 && z < F.maxZ - 2);
const after = r.trace.filter(([z]) => z > F.maxZ + 1.5);
console.log('trace', JSON.stringify(r.trace.filter((_, k) => k % 10 === 0)));
check('outside the fog: clear', r.trace[0][1] === 0, r.trace[0]);
check('deep in the fog: full fog', inside.length > 5 && inside.every(([, v]) => v === 1), inside.slice(0, 3));
check('fog opens up again after walking out', after.length > 0 && after.at(-1)[1] === 0, after.slice(-2));
check('fog is not a danger, walking goes right through', !r.spike && r.end.z > F.maxZ + 1, r.end);
// Speed in the fog = normal speed
const walk = (pose, secs) => page.evaluate(([pose, secs]) => {
    const g = window.__game; g.restore(); g.teleport(pose); g.setInput({ forward: true });
    const ps = []; for (let k = 0; k < secs * 60; k++) ps.push(g.step(1).pos); g.clearInput();
    const a = ps.at(-31), b = ps.at(-1); return Math.hypot(b.x - a.x, b.z - a.z) / 0.5;
}, [pose, secs]);
const vFog = await walk({ x: fx, z: F.minZ + 0.5, yaw: Math.PI }, 1);
const vOpen = await walk({ x: 2, z: 50, yaw: -Math.PI / 2 }, 1);
check('walking speed in the fog unchanged', Math.abs(vFog - vOpen) < 0.05, { vFog, vOpen });
// Wind: blows north, walking south into it ~60%
const W = st.winds[0];
const wx = (W.minX + W.maxX) / 2;
const vInto = await walk({ x: wx, z: W.minZ + 0.6, yaw: Math.PI }, 1.2);
const vWith = await walk({ x: wx, z: W.maxZ - 0.6, yaw: 0 }, 1.0);
check('wind: into ~60%, with ~140%', Math.abs(vInto / vOpen - 0.6) < 0.04 && Math.abs(vWith / vOpen - 1.4) < 0.04, { vInto, vWith, vOpen });
// The big storm cloud: walk into it from either side along the dead end
const Y = st.spikeRows[0];
console.log('big', JSON.stringify(Y));
const into = (pose) => page.evaluate((pose) => {
    const g = window.__game; g.restore(); g.teleport(pose); g.clearEvents(); g.setInput({ forward: true });
    let s; for (let k = 0; k < 90; k++) { s = g.step(1); if (g.events.some((e) => e.type === 'spike')) break; } g.clearInput();
    return { spike: g.events.some((e) => e.type === 'spike'), msg: g.text(), pos: s.pos };
}, pose);
const yx = Y.position?.x ?? Y.x, yz = Y.position?.z ?? Y.z;
r = await into({ x: yx - 2.5, z: yz, yaw: -Math.PI / 2 });
const r2 = await into({ x: yx + 2.5, z: yz, yaw: Math.PI / 2 });
check('big storm cloud: Ouch', (r.spike || r2.spike) && JSON.stringify([r.msg, r2.msg]).includes('storm cloud'), { r, r2 });
// Screenshots
const pose = async (name, p, n = 30) => { await page.evaluate(([p, n]) => { const g = window.__game; g.restore(); g.teleport(p); g.step(n); }, [p, n]); await shot(name); };
await pose('fog-outside', { x: fx, z: F.minZ - 7, yaw: Math.PI });
await pose('fog-near', { x: fx, z: F.minZ - 2.5, yaw: Math.PI });
await pose('fog-inside', { x: fx, z: (F.minZ + F.maxZ) / 2, yaw: Math.PI });
await pose('fog-inside-branch', { x: fx, z: F.minZ + 1.5, yaw: -Math.PI / 2 });
await pose('fog-inside-up', { x: fx, z: (F.minZ + F.maxZ) / 2, yaw: Math.PI, pitch: 0.6 });
await pose('fog-behind', { x: fx, z: F.maxZ + 3, yaw: 0 });
await pose('big-a', { x: yx - 4, z: yz, yaw: -Math.PI / 2 });
await pose('big-b', { x: yx + 4, z: yz, yaw: Math.PI / 2 });
await pose('wind', { x: wx, z: W.minZ - 2, yaw: Math.PI });
st = await page.evaluate(() => window.__game.restore());
check('back at start: fog view clear again', st.fogView === 0, st.fogView);
// Through the door
r = await page.evaluate(() => {
    const g = window.__game; g.restore();
    const d = g.maze().doorPosition;
    g.teleport({ x: d.x - 1.8, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true });
    let s; for (let i = 0; i < 40; i++) { s = g.step(2); if (s.escaped) break; } g.clearInput(); g.step(30);
    return { escaped: s.escaped, text: g.text() };
});
check('door: escape, More levels coming soon!', r.escaped && JSON.stringify(r.text).match(/More levels coming soon|Start (Level [0-9]+|[A-Z][a-zA-Z ]* World)/) !== null, r);
check('tune skyfog', (await page.evaluate(() => window.__sound?.tuneName)) === 'skyfog', {});
await page.evaluate(() => { const g = window.__game; g.restore(); g.teleport({ yaw: -Math.PI / 2 }); g.step(1); });
await shot('start');
const page2 = await ctx.newPage();
page2.on('pageerror', (e) => errors.push(String(e)));
await page2.goto(BASE + '/?test=1&level=132', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page2.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
r = await page2.evaluate(() => {
    const g = window.__game; const d = g.maze().doorPosition;
    g.teleport({ x: d.x - 1.8, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true });
    let s; for (let i = 0; i < 40; i++) { s = g.step(2); if (s.escaped) break; } g.clearInput(); g.step(30);
    const items = [...document.querySelectorAll('#menu-finish .item')].filter((e) => !e.hidden).map((e) => e.textContent);
    return { escaped: s.escaped, items, fogs: g.state().fogs.length };
});
check('Level 133 door: Start Level 134 (no fog in 133)', r.escaped && r.items[0] === 'Start Level 134' && r.fogs === 0, r);
check('no page errors', errors.length === 0, errors);
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
