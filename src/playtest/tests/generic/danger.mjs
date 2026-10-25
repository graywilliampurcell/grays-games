// Level 100: each room's danger works (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
const launch = () => chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 400)); };
const E = -Math.PI / 2, W = Math.PI / 2, N = 0, S = Math.PI;
async function run(fn, arg) {
    const browser = await launch();
    const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(BASE + '/?test=1&level=99', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
    const out = await page.evaluate(fn, arg);
    if (arg?.shot) await page.screenshot({ path: `${SP}d100-${arg.shot}.png`, timeout: 120000 }).catch((e) => console.log('shot failed'));
    await browser.close();
    return out;
}
// Walk forward from p facing yaw for `secs`; report where you end up and the events
const walk = ({ p, yaw, secs, before = 0 }) => {
    const g = window.__game;
    g.teleport({ ...p, yaw });
    for (let i = 0; i < before * 60; i++) { g.teleport({ ...p, yaw }); g.step(1); }
    g.clearEvents();
    g.setInput({ forward: true });
    let st;
    let minZ = 99, maxZ = 0, minX = 99, maxX = 0;
    for (let i = 0; i < secs * 60; i++) { st = g.step(1); minZ = Math.min(minZ, st.pos.z); maxZ = Math.max(maxZ, st.pos.z); minX = Math.min(minX, st.pos.x); maxX = Math.max(maxX, st.pos.x); }
    g.clearInput();
    g.render();
    return { pos: st.pos, room: st.room, ev: [...new Set(g.events.map((e) => e.what ? `${e.type}:${e.what}` : e.type))], minZ, maxZ, minX, maxX };
};

let r;
if (process.argv[2] !== 'geyser') {
r = await run(walk, { p: { x: 11.5, z: 2.5 }, yaw: E, secs: 1.5 });
check('Cotton Candy: walking into the spike is an Ouch', r.ev.includes('spike'), r);
r = await run(walk, { p: { x: 11.5, z: 1.45 }, yaw: E, secs: 1.2 });
check('Cotton Candy: squeeze past the spike', !r.ev.includes('spike') && r.pos.x > 17, r);
r = await run(({ p, yaw }) => {
    const g = window.__game;
    let st = g.state();
    for (let i = 0; i < 60 * 10 && st.spaceDoor.phase !== 'closed'; i++) { g.teleport({ ...p, yaw }); st = g.step(1); }
    g.setInput({ forward: true });
    for (let i = 0; i < 40; i++) st = g.step(1);
    g.clearInput();
    return { pos: st.pos, door: st.spaceDoor };
}, { p: { x: 25.5, z: 2.5 }, yaw: E });
check('Space: the shut space door is solid', r.pos.x < 28 && r.door.solid, r);
r = await run(walk, { p: { x: 25.5, z: 2.5 }, yaw: E, secs: 2 });
check('Space: walk through the open door', r.pos.x > 30, r);
r = await run(walk, { p: { x: 38.5, z: 6.5 }, yaw: E, secs: 4 });
check('Jungle: ride the leaf over the river', r.maxX > 48.5 && !r.ev.includes('fall'), r);
r = await run(walk, { p: { x: 38.5, z: 34.5 }, yaw: N, secs: 5 });
check('Moon: ride the hover platform over the crater', r.minZ < 20.5 && !r.ev.includes('fall'), r);
r = await run(walk, { p: { x: 22.5, z: 18.5 }, yaw: S, secs: 8 });
check('Underwater: ride the bubble over the crack', r.maxZ > 32 && !r.ev.includes('fall'), r);
r = await run(walk, { p: { x: 6.5, z: 34.5 }, yaw: N, secs: 3 });
check('Candy: marshmallow bounce over the 3-cell river', r.ev.includes('bounce') && r.minZ < 20.5 && !r.ev.includes('fall'), r);
r = await run(walk, { p: { x: 6.5, z: 18.5 }, yaw: S, secs: 3 });
check('Candy: bounce back the other way', r.ev.includes('bounce') && r.maxZ > 32 && !r.ev.includes('fall'), r);
}
r = await run(({ p }) => {
    const g = window.__game;
    g.clearEvents();
    let st;
    for (let i = 0; i < 60 * 9; i++) { g.teleport({ x: p.x, z: p.z - 4 }); st = g.step(1); if (g.events.some((e) => e.type === 'geyser')) break; }
    for (let i = 0; i < 30; i++) { g.teleport(p); st = g.step(1); if (g.events.some((e) => e.type === 'spike')) break; }
    return { ev: [...new Set(g.events.map((e) => e.what ? `${e.type}:${e.what}` : e.type))], pos: st.pos, room: st.room };
}, { p: { x: 2.5, z: 46.5 } });
check('Volcano: the lava geyser sends you back to the start', r.ev.includes('spike:geyser') && r.room === 0, r);
r = await run(({ p }) => {
    const g = window.__game;
    g.clearEvents();
    let st;
    for (let i = 0; i < 60 * 6; i++) { g.teleport(p); st = g.step(1); if (g.events.some((e) => e.type === 'snowball')) break; }
    for (let i = 0; i < 40; i++) st = g.step(1);
    return { ev: [...new Set(g.events.map((e) => e.type))], pos: st.pos };
}, { p: { x: 26.5, z: 38.5 } });
check('Ice: the snowman throws, a hit pushes you back', r.ev.includes('throw') && r.ev.includes('snowball'), r);
r = await run(walk, { p: { x: 32.5, z: 37.6 }, yaw: E, secs: 1 });
check('Ice: the snowman is solid', r.maxX < 35, r);
r = await run(({ p, yaw }) => { const g = window.__game; g.teleport({ ...p, yaw }); g.step(30); g.render(); return g.state(); }, { p: { x: 22.5, z: 42.5 }, yaw: N });
check('no page errors', errors.length === 0, errors);
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
