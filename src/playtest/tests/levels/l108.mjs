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
await page.goto(BASE + '/?test=1&level=107', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
await page.keyboard.press('Shift');
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 700)); };
const shot = (name) => page.screenshot({ path: `${SP}l108-${name}.png` });


let st = await page.evaluate(() => window.__game.state());
check('Level 108 loads: one carpet, two button doors, sneaky cactus, nothing else',
    st.level.name === 'Level 108' && st.platforms.length === 1 && st.platforms[0].carpet && st.buttonDoors.length === 2 && st.buttonDoors.every((d) => d.solid && !d.pressed) && !!st.spike && !st.spike2 && st.spikeRows.length === 0 && !st.spinWall && st.trapdoors.length === 0 && st.geysers.length === 0,
    { doors: st.buttonDoors, spike: st.spike, p: st.platforms, t: st.trapdoors });
check('tune twodoorcreep', (await page.evaluate(() => window.__sound?.tuneName)) === 'twodoorcreep', {});
console.log('doors', JSON.stringify(st.buttonDoors), 'start', JSON.stringify(st.pos), 'carpet', JSON.stringify(st.platforms[0]));
await shot('start');
const walk = ({ p, yaw, secs }) => {
    const g = window.__game;
    g.teleport({ ...p, yaw });
    g.clearEvents();
    g.setInput({ forward: true });
    let s, minZ = 99, maxX = 0;
    for (let i = 0; i < secs * 60; i++) { s = g.step(1); minZ = Math.min(minZ, s.pos.z); maxX = Math.max(maxX, s.pos.x); }
    g.clearInput();
    return { pos: s.pos, minZ, maxX, doors: s.buttonDoors.map((d) => [d.pressed, d.solid]), ev: [...new Set(g.events.map((e) => e.type))] };
};
const press = ({ p, yaw }) => {
    const g = window.__game;
    g.teleport({ ...p, yaw });
    g.clearEvents();
    g.setInput({ forward: true });
    let pressedAt = null, openAt = null;
    for (let i = 0; i < 180; i++) { g.step(1); const ev = g.events.map((e) => e.type); if (pressedAt === null && ev.includes('button')) pressedAt = i; if (openAt === null && ev.includes('buttonDoorOpen')) openAt = i; }
    g.clearInput();
    return { pressedAt, openAt, doors: g.state().buttonDoors.map((d) => [d.pressed, d.solid]), dt: g.dt };
};
// Door J between (5,6) and (6,6), heading east (wall blocks x 24)
let r = await page.evaluate(walk, { p: { x: 18.5, z: 26.5 }, yaw: -Math.PI / 2, secs: 2 });
check('shut door J blocks the way east', r.maxX < 23.7, r);
await page.evaluate(() => { window.__game.teleport({ x: 17.5, z: 26.5, yaw: -Math.PI / 2 }); window.__game.step(1); });
await shot('door1-shut');
// Door j between (9,5) and (9,4), heading north (wall blocks z 20)
r = await page.evaluate(walk, { p: { x: 38.5, z: 26.5 }, yaw: 0, secs: 2 });
check('shut door j blocks the way north', r.minZ > 20.3, r);
// Button U at the end of the wrong way east off (5,9): opens J only
r = await page.evaluate(press, { p: { x: 22.5, z: 38.5 }, yaw: -Math.PI / 2 });
check('button U opens door J in about 1 s, door j stays shut', r.pressedAt !== null && Math.abs((r.openAt - r.pressedAt) * r.dt - 1) < 0.1 && r.doors[0][0] && !r.doors[0][1] && !r.doors[1][0] && r.doors[1][1], r);
await page.evaluate(() => { window.__game.teleport({ x: 26.5, z: 38.5, yaw: -Math.PI / 2 }); window.__game.step(1); });
await shot('button1');
r = await page.evaluate(walk, { p: { x: 18.5, z: 26.5 }, yaw: -Math.PI / 2, secs: 1.5 });
check('open door J lets you through', r.maxX > 26, r);
r = await page.evaluate(walk, { p: { x: 38.5, z: 26.5 }, yaw: 0, secs: 2 });
check('door j still blocks after button U', r.minZ > 20.3, r);
// Button u at the end of the wrong way south off (9,6)
r = await page.evaluate(press, { p: { x: 38.5, z: 26.5 }, yaw: Math.PI });
check('button u opens door j in about 1 s', r.pressedAt !== null && Math.abs((r.openAt - r.pressedAt) * r.dt - 1) < 0.1 && !r.doors[1][1], r);
await page.evaluate(() => { window.__game.teleport({ x: 38.5, z: 30.5, yaw: Math.PI }); window.__game.step(1); });
await shot('button2');
r = await page.evaluate(walk, { p: { x: 38.5, z: 26.5 }, yaw: 0, secs: 1.5 });
check('open door j lets you through', r.minZ < 18, r);
// Back to start (sneaky cactus) shuts both doors
r = await page.evaluate(({ x, z }) => {
    const g = window.__game;
    g.teleport({ x, z });
    g.clearEvents();
    for (let i = 0; i < 10; i++) g.step(1);
    return { ev: g.events.map((e) => e.type), text: g.text(), doors: g.state().buttonDoors.map((d) => [d.pressed, d.solid]) };
}, st.spike);
check('sneaky cactus Ouch', r.ev.includes('spike') && r.text.some((x) => /cactus/.test(x)), r);
check('back to start shuts both doors, buttons up', r.doors.every(([p, s]) => !p && s), r);
// Sneaky cactus can't be seen from the start cell
await page.evaluate(() => { const g = window.__game; g.restore(); g.step(1); });
await shot('sneaky-from-start');
// Carpet over the pit (x 21-31, z 21-23), crossed heading west
const c = st.platforms[0];
r = await page.evaluate(() => {
    const g = window.__game;
    const log = []; let last = null;
    for (let i = 0; i < 60 * 12; i++) { const p = g.step(1).platforms[0]; if (p.phase !== last) { log.push({ i, phase: p.phase, at: p.at }); last = p.phase; } }
    return { log, dt: g.dt };
});
const d = r.log.slice(1).map((e, k) => (r.log[k + 2]?.i ?? null) === null ? null : ((r.log[k + 2].i - e.i) * r.dt));
check('carpet cycle: rest 2 s / cross 2 s', r.log.length >= 5 && d.filter((x) => x !== null).every((x) => Math.abs(x - 2) < 0.05), { log: r.log, d });
r = await page.evaluate(() => {
    const g = window.__game;
    g.restore();
    let p;
    for (let i = 0; i < 60 * 10; i++) { p = g.step(1).platforms[0]; if (p.phase === 'rest' && p.at > 8 && p.time < 0.05) break; }
    g.teleport({ x: 34.5, z: 22.5, yaw: Math.PI / 2 });
    g.clearEvents();
    g.setInput({ forward: true });
    let s;
    for (let i = 0; i < 60; i++) s = g.step(1);
    g.clearInput();
    let departed = null, arrived = null;
    for (let i = 0; i < 60 * 6; i++) {
        s = g.step(1);
        const ev = g.events.map((e) => e.what ?? e.type);
        if (departed === null && ev.includes('depart')) departed = i;
        if (arrived === null && ev.includes('arrive')) { arrived = i; break; }
    }
    const atArrive = s.pos.x;
    g.setInput({ forward: true });
    for (let i = 0; i < 60; i++) s = g.step(1);
    g.clearInput();
    return { departed, arrived, atArrive, end: s.pos, ev: [...new Set(g.events.map((e) => e.what ?? e.type))] };
});
check('carpet ride west over the pit, no fall', r.departed !== null && r.arrived !== null && r.atArrive < 22 && r.end.x < 19 && !r.ev.includes('fall'), r);
r = await page.evaluate(() => {
    const g = window.__game;
    g.restore();
    let p;
    for (let i = 0; i < 60 * 10; i++) { p = g.step(1).platforms[0]; if (p.phase === 'rest' && p.at === 0) break; }
    g.teleport({ x: 34.5, z: 22.5, yaw: Math.PI / 2 });
    g.clearEvents();
    g.setInput({ forward: true });
    for (let i = 0; i < 60; i++) g.step(1);
    g.clearInput();
    return { ev: [...new Set(g.events.map((e) => e.type))], text: g.text() };
});
check('walking into the pit while the carpet is away: sand pit message', r.ev.includes('fall') && r.text.some((t) => t.includes('You fell in the sand pit')), r);
await page.evaluate(() => { const g = window.__game; g.restore(); let p; for (let i = 0; i < 60 * 10; i++) { p = g.step(1).platforms[0]; if (p.phase === 'rest' && p.at > 8 && p.time > 0.5) break; } g.teleport({ x: 35.5, z: 22.5, yaw: Math.PI / 2 }); g.step(1); });
await shot('carpet');
check('no page errors', errors.length === 0, errors);
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
