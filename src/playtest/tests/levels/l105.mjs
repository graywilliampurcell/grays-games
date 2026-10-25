// Level 105 checks (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
import fs from 'fs';
const SP = SHOTS;
fs.mkdirSync(SP, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const open = async (url) => {
    const ctx = await browser.newContext({ viewport: { width: 1024, height: 640 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
    await page.keyboard.press('Shift');
    return page;
};
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 700)); };
let page = await open(BASE + '/?test=1&level=104');
const shot = (name) => page.screenshot({ path: `${SP}l105-${name}.png` });
let st = await page.evaluate(() => window.__game.state());
check('Level 105 loads: 2 trapdoors, button door, sneaky cactus, nothing else',
    st.level.name === 'Level 105' && st.trapdoors.length === 2 && st.buttonDoor && st.buttonDoor.solid && !!st.spike && !st.spike2 && st.platforms.length === 0 && st.spikeRows.length === 0 && !st.spinWall && st.geysers.length === 0,
    { t: st.trapdoors, door: st.buttonDoor, spike: st.spike, rows: st.spikeRows, spin: st.spinWall });
check('tune buttoncreep', (await page.evaluate(() => window.__sound?.tuneName)) === 'buttoncreep', {});
// Timers: each 3/1/2, out of step with each other
let r = await page.evaluate(() => {
    const g = window.__game;
    const logs = [[], []];
    const last = [null, null];
    let differ = 0;
    for (let i = 0; i < 60 * 14; i++) {
        const ts = g.step(1).trapdoors;
        ts.forEach((t, k) => { if (t.phase !== last[k]) { logs[k].push({ i, phase: t.phase }); last[k] = t.phase; } });
        if (ts[0].phase !== ts[1].phase) differ++;
    }
    return { logs, dt: g.dt, differ };
});
const near = (xs, v) => xs?.length && xs.every((x) => Math.abs(x - v) < 0.05);
for (const k of [0, 1]) {
    const dur = {};
    const log = r.logs[k];
    for (let n = 1; n + 1 < log.length; n++) (dur[log[n].phase] ??= []).push((log[n + 1].i - log[n].i) * r.dt);
    check(`trapdoor ${k + 1}: closed 3 s, warning 1 s, open 2 s`, near(dur.closed, 3) && near(dur.warning, 1) && near(dur.open, 2), dur);
}
check('the two trapdoors run on their own timers (out of step)', r.differ > 60 * 4, { differ: r.differ, a: r.logs[0].slice(0, 4), b: r.logs[1].slice(0, 4) });
// Order along the path: trapdoor (top row), button wrong way, door, trapdoor
const T = st.trapdoors;
console.log('trapdoors', JSON.stringify(T.map((t) => [t.minX, t.maxX, t.minZ, t.maxZ])), 'door', JSON.stringify(st.buttonDoor), 'spike', JSON.stringify(st.spike), 'start', JSON.stringify(st.pos));
// Door shut blocks (door between (0,7) and (0,8), heading south at x 2.5)
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
r = await page.evaluate(walk, { p: { x: 2.5, z: 26.5 }, yaw: Math.PI, secs: 2 });
check('shut door blocks the way south', r.maxZ < 32 && !r.door.pressed, r);
await page.evaluate(() => { window.__game.teleport({ x: 2.5, z: 26.5, yaw: Math.PI }); window.__game.step(1); });
await shot('door-shut');
// Button at cell (0,5): walk in from (1,4)?? just teleport next to it in its wrong way and step on
r = await page.evaluate(() => {
    const g = window.__game;
    const before = g.state().buttonDoor;
    g.teleport({ x: 2.5, z: 22.5 });
    g.clearEvents();
    let pressedAt = null, openAt = null;
    for (let i = 0; i < 120; i++) { g.step(1); const ev = g.events.map((e) => e.type); if (pressedAt === null && ev.includes('button')) pressedAt = i; if (openAt === null && ev.includes('buttonDoorOpen')) openAt = i; }
    return { before, pressedAt, openAt, door: g.state().buttonDoor, dt: g.dt };
});
check('button in its wrong way opens the door in about 1 s', r.pressedAt !== null && r.openAt !== null && Math.abs((r.openAt - r.pressedAt) * r.dt - 1) < 0.1 && !r.door.solid, r);
await page.evaluate(() => { window.__game.teleport({ x: 2.5, z: 17, yaw: Math.PI }); window.__game.step(1); });
await shot('button');
r = await page.evaluate(walk, { p: { x: 2.5, z: 26.5 }, yaw: Math.PI, secs: 1.5 });
check('open door lets you through', r.maxZ > 33, r);
// Fall in the second trapdoor: back to start, door shuts
r = await page.evaluate((T) => {
    const g = window.__game;
    let t;
    for (let i = 0; i < 60 * 8; i++) { t = g.step(1).trapdoors[1]; if (t.phase === 'open' && t.timer > 1.5) break; }
    g.teleport({ x: (T.minX + T.maxX) / 2, z: (T.minZ + T.maxZ) / 2 });
    g.clearEvents();
    for (let i = 0; i < 10; i++) g.step(1);
    return { what: g.events.filter((e) => e.type === 'spike').map((e) => e.what), text: g.text(), door: g.state().buttonDoor, pos: g.state().pos };
}, T[1]);
check('second trapdoor: fall, back to start, door shut again', r.what.includes('trapdoor') && r.text.some((x) => x.includes('Ouch! You fell through the trapdoor. Back to the start.')) && r.door.solid && !r.door.pressed, r);
// First trapdoor: standing on it, it opens under you
r = await page.evaluate((T) => {
    const g = window.__game;
    g.restore();
    let t;
    for (let i = 0; i < 60 * 8; i++) { t = g.step(1).trapdoors[0]; if (t.phase === 'closed') break; }
    g.teleport({ x: (T.minX + T.maxX) / 2, z: (T.minZ + T.maxZ) / 2 });
    g.clearEvents();
    let fellAt = null;
    for (let i = 0; i < 60 * 5; i++) { const s = g.step(1); if (g.events.some((e) => e.type === 'spike')) { fellAt = s.trapdoors[0].phase; break; } }
    return { fellAt };
}, T[0]);
check('first trapdoor opens under you', r.fellAt === 'open', r);
// Walk across a trapdoor while closed: safe
r = await page.evaluate((T) => {
    const g = window.__game;
    g.restore();
    let t;
    for (let i = 0; i < 60 * 8; i++) { t = g.step(1).trapdoors[0]; if (t.phase === 'closed' && t.timer > 2.9) break; }
    g.teleport({ x: T.minX - 2.5, z: (T.minZ + T.maxZ) / 2, yaw: -Math.PI / 2 });
    g.clearEvents();
    g.setInput({ forward: true });
    let s, on = 0;
    for (let i = 0; i < 80; i++) { s = g.step(1); if (s.pos.x > T.minX && s.pos.x < T.maxX) on++; }
    g.clearInput();
    return { ev: [...new Set(g.events.map((e) => e.type))], pos: s.pos, over: on * g.dt };
}, T[0]);
check('walk across first trapdoor while closed: safe, quick', !r.ev.includes('spike') && r.pos.x > T[0].maxX && r.over < 1, r);
// Sneaky cactus Ouch
r = await page.evaluate(({ x, z }) => {
    const g = window.__game;
    g.restore();
    g.teleport({ x, z });
    g.clearEvents();
    for (let i = 0; i < 5; i++) g.step(1);
    return { ev: g.events.map((e) => e.type), text: g.text() };
}, st.spike);
check('sneaky cactus Ouch', r.ev.includes('spike') && r.text.some((x) => /cactus/.test(x)), r);
// Pictures
for (const [name, p] of [['start', null], ['trap1', { x: T[0].minX - 3.5, z: (T[0].minZ + T[0].maxZ) / 2, yaw: -Math.PI / 2 }], ['trap2', { x: T[1].minX - 3.5, z: (T[1].minZ + T[1].maxZ) / 2, yaw: -Math.PI / 2 }]]) {
    await page.evaluate((p) => { const g = window.__game; g.restore(); if (p) g.teleport(p); g.step(1); }, p);
    await shot(name);
}
await page.evaluate(() => { const g = window.__game; let t; for (let i = 0; i < 60 * 8; i++) { t = g.step(1).trapdoors[1]; if (t.phase === 'warning' && t.timer < 0.6) break; } });
await shot('trap2-warning');
// Its door: More levels coming soon!
r = await page.evaluate(() => {
    const g = window.__game;
    g.restore();
    const d = g.state().door;
    g.teleport({ x: d.x - 1.5, z: d.z, yaw: -Math.PI / 2 });
    g.setInput({ forward: true });
    for (let i = 0; i < 40; i++) g.step(1);
    g.clearInput();
    return { escaped: g.state().escaped, text: g.text() };
});
check('L105 door: More levels coming soon! + Quit', r.escaped && r.text.some((t) => /More levels coming soon!/.test(t)) && !r.text.some((t) => /Start Level/.test(t)), r.text);
await page.context().close();
// Level 104's door leads to Level 105
page = await open(BASE + '/?test=1&level=103');
r = await page.evaluate(() => {
    const g = window.__game;
    const d = g.state().door;
    g.teleport({ x: d.x - 1.5, z: d.z, yaw: -Math.PI / 2 });
    g.setInput({ forward: true });
    for (let i = 0; i < 40; i++) g.step(1);
    g.clearInput();
    return { name: g.state().level.name, escaped: g.state().escaped, text: g.text() };
});
check('L104 door: Start Level 105', r.escaped && r.text.some((t) => /Start Level 105/.test(t)), r);
check('no page errors', errors.length === 0, errors);
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
