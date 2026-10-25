// Level 109 checks (vite preview on 9173)
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
await page.goto(BASE + '/?test=1&level=108', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
await page.keyboard.press('Shift');
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 700)); };
const shot = (name) => page.screenshot({ path: `${SP}l109-${name}.png` });



let st = await page.evaluate(() => window.__game.state());
check('Level 109 loads: two carpets, one button door, one trapdoor, one big cactus, nothing else',
    st.level.name === 'Level 109' && st.platforms.length === 2 && st.platforms.every((p) => p.carpet) && st.buttonDoors.length === 1 && st.buttonDoors[0].solid && st.trapdoors.length === 1 && st.spikeRows.length === 1 && !st.spike && !st.spike2 && !st.spinWall && st.geysers.length === 0,
    { doors: st.buttonDoors, p: st.platforms, t: st.trapdoors, rows: st.spikeRows, spike: st.spike, spin: st.spinWall });
check('tune twocarpetcreep', (await page.evaluate(() => window.__sound?.tuneName)) === 'twocarpetcreep', {});
console.log('platforms', JSON.stringify(st.platforms), 'rows', JSON.stringify(st.spikeRows), 'trap', JSON.stringify(st.trapdoors), 'start', JSON.stringify(st.pos));
await shot('start');
const walk = ({ p, yaw, secs }) => {
    const g = window.__game;
    g.teleport({ ...p, yaw });
    g.clearEvents();
    g.setInput({ forward: true });
    let s, minX = 99, maxX = 0, minZ = 99, maxZ = 0;
    for (let i = 0; i < secs * 60; i++) { s = g.step(1); minX = Math.min(minX, s.pos.x); maxX = Math.max(maxX, s.pos.x); minZ = Math.min(minZ, s.pos.z); maxZ = Math.max(maxZ, s.pos.z); }
    g.clearInput();
    return { pos: s.pos, minX, maxX, minZ, maxZ, doors: s.buttonDoors.map((d) => [d.pressed, d.solid]), ev: [...new Set(g.events.map((e) => e.type))] };
};
// Both carpets' cycles: rest 2 / cross 2 each, 1 s out of step
let r = await page.evaluate(() => {
    const g = window.__game;
    const logs = [[], []]; const last = [null, null];
    for (let i = 0; i < 60 * 13; i++) { const ps = g.step(1).platforms; ps.forEach((p, k) => { if (p.phase !== last[k]) { logs[k].push({ i, phase: p.phase, at: p.at }); last[k] = p.phase; } }); }
    return { logs, dt: g.dt };
});
const durs = r.logs.map((log) => log.slice(1, -1).map((e, k) => (log[k + 2].i - e.i) * r.dt));
check('each carpet: rest 2 s / cross 2 s', durs.every((d) => d.length >= 3 && d.every((x) => Math.abs(x - 2) < 0.05)), { durs });
const firstCross = r.logs.map((log) => log.find((e) => e.phase === 'cross')?.i);
const lag = Math.abs(firstCross[0] - firstCross[1]) * r.dt;
check('the two carpets run out of step (about 1 s apart)', Math.abs(lag - 1) < 0.05, { firstCross, lag });

// Ride a carpet: wait for it resting at the near end, walk on, ride, step off
const ride = ({ k, p, yaw, axis, sign }) => {
    const g = window.__game;
    g.restore();
    let q;
    for (let i = 0; i < 60 * 10; i++) { q = g.step(1).platforms[k]; if (q.phase === 'rest' && q.at === 0 && q.time < 0.05) break; }
    g.teleport({ ...p, yaw });
    g.clearEvents();
    g.setInput({ forward: true });
    let s;
    for (let i = 0; i < 45; i++) s = g.step(1);
    g.clearInput();
    let departed = null, arrived = null;
    for (let i = 0; i < 60 * 6; i++) {
        s = g.step(1);
        const ev = g.events.map((e) => e.what ?? e.type);
        if (departed === null && ev.includes('depart')) departed = i;
        if (arrived === null && ev.includes('arrive')) { arrived = i; break; }
    }
    const atArrive = s.pos[axis];
    g.setInput({ forward: true });
    for (let i = 0; i < 60; i++) s = g.step(1);
    g.clearInput();
    return { departed, arrived, atArrive, end: s.pos, ev: [...new Set(g.events.map((e) => e.what ?? e.type))] };
};
r = await page.evaluate(ride, { k: 0, p: { x: 22.5, z: 2.5 }, yaw: -Math.PI / 2, axis: 'x' });
check('carpet 1: ride east over the pit (top row), no fall', r.departed !== null && r.arrived !== null && r.atArrive > 33 && r.end.x > 36 && !r.ev.includes('fall'), r);
r = await page.evaluate(ride, { k: 1, p: { x: 38.5, z: 18.5 }, yaw: Math.PI, axis: 'z' });
check('carpet 2: ride south over the pit (east side), no fall', r.departed !== null && r.arrived !== null && r.atArrive > 29 && r.end.z > 32 && !r.ev.includes('fall'), r);
r = await page.evaluate(() => {
    const g = window.__game;
    g.restore();
    let p;
    for (let i = 0; i < 60 * 10; i++) { p = g.step(1).platforms[1]; if (p.phase === 'rest' && p.at > 8) break; }
    g.teleport({ x: 38.5, z: 18.5, yaw: Math.PI });
    g.clearEvents();
    g.setInput({ forward: true });
    for (let i = 0; i < 60; i++) g.step(1);
    g.clearInput();
    return { ev: [...new Set(g.events.map((e) => e.type))], text: g.text() };
});
check('walking into pit 2 while its carpet is away: sand pit message', r.ev.includes('fall') && r.text.some((t) => t.includes('You fell in the sand pit')), r);
await page.evaluate(() => { const g = window.__game; g.restore(); let p; for (let i = 0; i < 60 * 10; i++) { p = g.step(1).platforms[0]; if (p.phase === 'rest' && p.at === 0 && p.time > 0.5) break; } g.teleport({ x: 21.5, z: 2.5, yaw: -Math.PI / 2 }); g.step(1); });
await shot('carpet1');
await page.evaluate(() => { const g = window.__game; g.restore(); let p; for (let i = 0; i < 60 * 10; i++) { p = g.step(1).platforms[1]; if (p.phase === 'rest' && p.at === 0 && p.time > 0.5) break; } g.teleport({ x: 38.5, z: 17.5, yaw: Math.PI }); g.step(1); });
await shot('carpet2');

// Button door J between (5,7) and (4,7), heading west (wall blocks x 20)
r = await page.evaluate(walk, { p: { x: 22.5, z: 30.5 }, yaw: Math.PI / 2, secs: 2 });
check('shut door blocks the way west', r.minX > 20.3, r);
await page.evaluate(() => { window.__game.teleport({ x: 23.5, z: 30.5, yaw: Math.PI / 2 }); window.__game.step(1); });
await shot('door-shut');
r = await page.evaluate(() => {
    const g = window.__game;
    g.teleport({ x: 34.5, z: 22.5, yaw: 0 });
    g.clearEvents();
    g.setInput({ forward: true });
    let pressedAt = null, openAt = null;
    for (let i = 0; i < 180; i++) { g.step(1); const ev = g.events.map((e) => e.type); if (pressedAt === null && ev.includes('button')) pressedAt = i; if (openAt === null && ev.includes('buttonDoorOpen')) openAt = i; }
    g.clearInput();
    return { pressedAt, openAt, doors: g.state().buttonDoors.map((d) => [d.pressed, d.solid]), dt: g.dt };
});
check('button opens the door in about 1 s', r.pressedAt !== null && Math.abs((r.openAt - r.pressedAt) * r.dt - 1) < 0.1 && r.doors[0][0] && !r.doors[0][1], r);
await page.evaluate(() => { window.__game.teleport({ x: 34.5, z: 23.5, yaw: 0 }); window.__game.step(1); });
await shot('button');
r = await page.evaluate(walk, { p: { x: 22.5, z: 30.5 }, yaw: Math.PI / 2, secs: 1.5 });
check('open door lets you through', r.minX < 18, r);

// Trapdoor: closed 3 / warning 1 / open 2; stand on it -> fall, doors shut again
const T = st.trapdoors[0];
r = await page.evaluate(() => {
    const g = window.__game;
    const log = []; let last = null;
    for (let i = 0; i < 60 * 14; i++) { const t = g.step(1).trapdoors[0]; if (t.phase !== last) { log.push({ i, phase: t.phase }); last = t.phase; } }
    return { log, dt: g.dt };
});
const dur = {};
for (let k = 1; k + 1 < r.log.length; k++) (dur[r.log[k].phase] ??= []).push((r.log[k + 1].i - r.log[k].i) * r.dt);
const near = (xs, v) => xs?.length && xs.every((x) => Math.abs(x - v) < 0.05);
check('trapdoor: closed 3 s, warning 1 s, open 2 s', near(dur.closed, 3) && near(dur.warning, 1) && near(dur.open, 2), { dur });
r = await page.evaluate((T) => {
    const g = window.__game;
    let t;
    for (let i = 0; i < 60 * 8; i++) { t = g.step(1).trapdoors[0]; if (t.phase === 'closed') break; }
    g.teleport({ x: (T.minX + T.maxX) / 2, z: (T.minZ + T.maxZ) / 2, yaw: -Math.PI / 2 });
    g.clearEvents();
    let fellAt = null, s;
    for (let i = 0; i < 60 * 5; i++) { s = g.step(1); if (g.events.some((e) => e.type === 'spike')) { fellAt = s.trapdoors[0].phase; break; } }
    return { fellAt, what: g.events.filter((e) => e.type === 'spike').map((e) => e.what), text: g.text(), doors: g.state().buttonDoors.map((d) => [d.pressed, d.solid]) };
}, T);
check('stand on the trapdoor: falls through when it opens, back to start', r.fellAt === 'open' && r.what.includes('trapdoor') && r.text.some((x) => x.includes('fell through the trapdoor')), r);
check('back to start shuts the button door again', r.doors.every(([p, s]) => !p && s), r);
r = await page.evaluate((T) => {
    const g = window.__game;
    let t;
    for (let i = 0; i < 60 * 8; i++) { t = g.step(1).trapdoors[0]; if (t.phase === 'closed' && t.timer > 2.9) break; }
    g.teleport({ x: T.minX - 2.5, z: (T.minZ + T.maxZ) / 2, yaw: -Math.PI / 2 });
    g.clearEvents();
    g.setInput({ forward: true });
    let s;
    for (let i = 0; i < 80; i++) s = g.step(1);
    g.clearInput();
    return { ev: [...new Set(g.events.map((e) => e.type))], pos: s.pos };
}, T);
check('walk across the closed trapdoor: safe', !r.ev.includes('spike') && r.pos.x > T.maxX, r);

// Big cactus: blocks the straight wrong way west off (9,2), seen from the path
const Y = st.spikeRows[0];
for (const dz of [-1.05, 0, 1.05]) {
    r = await page.evaluate(({ Y, dz }) => {
        const g = window.__game;
        g.restore();
        g.teleport({ x: Y.x + 2.5, z: Y.z + dz, yaw: Math.PI / 2 });
        g.clearEvents();
        g.setInput({ forward: true });
        for (let i = 0; i < 60; i++) g.step(1);
        g.clearInput();
        return { ev: [...new Set(g.events.map((e) => e.type))], pos: g.state().pos };
    }, { Y, dz });
    check(`big cactus blocks (offset ${dz})`, r.ev.includes('spike'), r);
}
await page.evaluate(({ Y }) => { const g = window.__game; g.restore(); g.teleport({ x: Y.x + 2.5, z: Y.z - 6, yaw: Math.PI }); g.step(1); }, { Y });
await shot('big-cactus-from-path');
check('no page errors', errors.length === 0, errors);
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
