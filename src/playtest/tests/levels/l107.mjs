// Level 104 checks (vite preview on 9173)
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
await page.goto(BASE + '/?test=1&level=106', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
await page.keyboard.press('Shift');
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 700)); };
const shot = (name) => page.screenshot({ path: `${SP}l107-${name}.png` });


let st = await page.evaluate(() => window.__game.state());
check('Level 107 loads: one trapdoor, one button door, one big cactus, nothing else',
    st.level.name === 'Level 107' && st.trapdoors.length === 1 && st.buttonDoor && st.buttonDoor.solid && st.spikeRows.length === 1 && !st.spike && !st.spike2 && st.platforms.length === 0 && !st.spinWall && st.geysers.length === 0,
    { t: st.trapdoors, rows: st.spikeRows, spike: st.spike, door: st.buttonDoor, level: st.level.name });
check('tune longwaycreep', (await page.evaluate(() => window.__sound?.tuneName)) === 'longwaycreep', {});
const T = st.trapdoors[0];
console.log('T', JSON.stringify(T), 'door', JSON.stringify(st.buttonDoor), 'Y', JSON.stringify(st.spikeRows), 'start', JSON.stringify(st.pos));
let r = await page.evaluate(() => {
    const g = window.__game;
    const log = []; let last = null;
    for (let i = 0; i < 60 * 14; i++) { const t = g.step(1).trapdoors[0]; if (t.phase !== last) { log.push({ i, phase: t.phase }); last = t.phase; } }
    return { log, dt: g.dt };
});
const dur = {};
for (let k = 1; k + 1 < r.log.length; k++) (dur[r.log[k].phase] ??= []).push((r.log[k + 1].i - r.log[k].i) * r.dt);
const near = (xs, v) => xs?.length && xs.every((x) => Math.abs(x - v) < 0.05);
check('trapdoor: closed 3 s, warning 1 s, open 2 s', near(dur.closed, 3) && near(dur.warning, 1) && near(dur.open, 2), dur);
// Trapdoor (cell 2,1, heading north): stand on it -> falls when it opens
r = await page.evaluate((T) => {
    const g = window.__game;
    g.restore();
    for (let i = 0; i < 60 * 8; i++) { if (g.step(1).trapdoors[0].phase === 'closed') break; }
    g.teleport({ x: (T.minX + T.maxX) / 2, z: (T.minZ + T.maxZ) / 2, yaw: 0 });
    g.clearEvents();
    let fellAt = null;
    for (let i = 0; i < 60 * 5; i++) { const s = g.step(1); if (g.events.some((e) => e.type === 'spike')) { fellAt = s.trapdoors[0].phase; break; } }
    return { fellAt, text: g.text(), pos: g.state().pos };
}, T);
check('trapdoor opens under you: fell through, back to start', r.fellAt === 'open' && r.text.some((x) => x.includes('Ouch! You fell through the trapdoor. Back to the start.')), r);
// Walk north across it while closed
r = await page.evaluate((T) => {
    const g = window.__game;
    g.restore();
    for (let i = 0; i < 60 * 8; i++) { const t = g.step(1).trapdoors[0]; if (t.phase === 'closed' && t.timer > 2.9) break; }
    g.teleport({ x: (T.minX + T.maxX) / 2, z: T.maxZ + 2.5, yaw: 0 });
    g.clearEvents();
    g.setInput({ forward: true });
    let s, on = 0;
    for (let i = 0; i < 80; i++) { s = g.step(1); if (s.pos.z > T.minZ && s.pos.z < T.maxZ) on++; }
    g.clearInput();
    return { ev: [...new Set(g.events.map((e) => e.type))], pos: s.pos, over: on * g.dt };
}, T);
check('walk across the trapdoor while closed: safe, quick', !r.ev.includes('spike') && r.pos.z < T.minZ && r.over < 1, r);
await page.evaluate((T) => { const g = window.__game; g.restore(); for (let i = 0; i < 60 * 8; i++) { const t = g.step(1).trapdoors[0]; if (t.phase === 'warning' && t.timer < 0.6) break; } g.teleport({ x: (T.minX + T.maxX) / 2, z: T.maxZ + 3.5, yaw: 0 }); g.step(1); }, T);
await shot('trapdoor-warning');
// Big cactus (dead end north off cell (0,3)): blocks at every offset
const Y = st.spikeRows[0];
for (const dx of [-1.05, 0, 1.05]) {
    r = await page.evaluate(({ Y, dx }) => {
        const g = window.__game;
        g.restore();
        g.teleport({ x: Y.x + dx, z: Y.z + 2.5, yaw: 0 });
        g.clearEvents();
        g.setInput({ forward: true });
        for (let i = 0; i < 60; i++) g.step(1);
        g.clearInput();
        return { ev: [...new Set(g.events.map((e) => e.type))], pos: g.state().pos };
    }, { Y, dx });
    check(`big cactus blocks (offset ${dx})`, r.ev.includes('spike'), r);
}
await page.evaluate(() => { const g = window.__game; g.restore(); g.teleport({ x: 2.5, z: 18.5, yaw: 0 }); g.step(1); });
await shot('big-cactus-from-path');
// Button door between (6,3) and (6,4): shut blocks heading south
const walk = ({ p, yaw, secs }) => {
    const g = window.__game;
    g.teleport({ ...p, yaw });
    g.clearEvents();
    g.setInput({ forward: true });
    let s, maxZ = 0;
    for (let i = 0; i < secs * 60; i++) { s = g.step(1); maxZ = Math.max(maxZ, s.pos.z); }
    g.clearInput();
    return { pos: s.pos, maxZ, door: s.buttonDoor, ev: [...new Set(g.events.map((e) => e.type))] };
};
await page.evaluate(() => window.__game.restore());
r = await page.evaluate(walk, { p: { x: 26.5, z: 14.5 }, yaw: Math.PI, secs: 2 });
check('shut button door blocks the way south', r.maxZ < 16.6 && !r.door.pressed, r);
await page.evaluate(() => { window.__game.teleport({ x: 26.5, z: 10.5, yaw: Math.PI }); window.__game.step(1); });
await shot('door-shut');
// Button in cell (9,4), end of the 3-deep wrong way south off (9,1)
r = await page.evaluate(() => {
    const g = window.__game;
    g.teleport({ x: 38.5, z: 14.5, yaw: Math.PI });
    g.clearEvents();
    g.setInput({ forward: true });
    let pressedAt = null, openAt = null;
    for (let i = 0; i < 150; i++) { g.step(1); const ev = g.events.map((e) => e.type); if (pressedAt === null && ev.includes('button')) pressedAt = i; if (openAt === null && ev.includes('buttonDoorOpen')) openAt = i; }
    g.clearInput();
    return { pressedAt, openAt, door: g.state().buttonDoor, dt: g.dt };
});
check('button down its 3-deep wrong way opens the door in about 1 s', r.pressedAt !== null && r.openAt !== null && Math.abs((r.openAt - r.pressedAt) * r.dt - 1) < 0.1 && !r.door.solid, r);
await page.evaluate(() => { window.__game.teleport({ x: 38.5, z: 7, yaw: Math.PI }); window.__game.step(1); });
await shot('button');
r = await page.evaluate(walk, { p: { x: 26.5, z: 14.5 }, yaw: Math.PI, secs: 1.5 });
check('open door lets you through', r.maxZ > 18, r);
// Fall in the trapdoor -> door shuts again
r = await page.evaluate((T) => {
    const g = window.__game;
    for (let i = 0; i < 60 * 8; i++) { const t = g.step(1).trapdoors[0]; if (t.phase === 'open' && t.timer > 1.5) break; }
    g.teleport({ x: (T.minX + T.maxX) / 2, z: (T.minZ + T.maxZ) / 2 });
    g.clearEvents();
    for (let i = 0; i < 10; i++) g.step(1);
    return { door: g.state().buttonDoor };
}, T);
check('back to start shuts the door and pops the button up', r.door.solid && !r.door.pressed, r);
// Walk the whole correct path with the solver (playbot-style) if available
r = await page.evaluate(() => ({ keys: Object.keys(window.__game) }));
console.log('hooks', r.keys.join(','));
check('no page errors', errors.length === 0, errors);
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
