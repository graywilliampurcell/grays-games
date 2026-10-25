// Level 81 checks: node t81.mjs (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
const idx = 80;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const load = async () => { await page.goto(`${BASE}/?test=1&level=${idx}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => window.__game?.ready); };
const shot = (name) => page.screenshot({ path: `${SP}l81-${name}.png` });
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info)); };
const E = -Math.PI / 2, W = Math.PI / 2, N = 0, S = Math.PI;
const look = (pitch) => page.evaluate(({ pitch }) => { const g = window.__game; const d = pitch - g.state().pitch; g.setInput({ lookDy: -d / 0.003 }); g.step(1); g.clearInput(); g.render(); }, { pitch });
const msg = () => page.evaluate(() => { const m = document.getElementById('message'); return m && !m.hidden ? m.textContent : ''; });

await load();
const st0 = await page.evaluate(() => window.__game.state());
console.log('platform', JSON.stringify(st0.platforms[0]), 'start', JSON.stringify(st0.start), 'level', st0.level.name);
check('one tire, fast speed, starts at south edge', st0.platforms.length === 1 && st0.platforms[0].speed > 7.7 && st0.platforms[0].startAt > 0 && st0.platforms[0].span === 19, st0.platforms[0]);
await shot('a-start');
await look(-0.9); await shot('a2-floor');
await look(0.9); await shot('a3-sky');
await look(0);

// 1. Ride south -> north, timing it
await load();
const ride = await page.evaluate(({ N }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 2.5, z: 26.5, yaw: N }); g.setInput({ forward: true });
    let st; let departT = null; let arriveT = null; let fell = false; let rideStartT = null;
    for (let i = 0; i < 1500; i++) {
        st = g.step(1);
        const p = st.platforms[0];
        if (p.riding && rideStartT === null) { rideStartT = st.t; g.clearInput(); }
        if (g.events.some((e) => e.type === 'fall')) fell = true;
        if (departT === null && g.events.some((e) => e.what === 'depart')) departT = st.t;
        if (arriveT === null && g.events.some((e) => e.what === 'arrive')) { arriveT = st.t; break; }
    }
    return { fell, pos: st.pos, at: st.platforms[0].at, rideStartT, departT, arriveT };
}, { N });
console.log(JSON.stringify(ride));
check('tire carries you across to the north edge', !ride.fell && ride.at === 0 && ride.pos.z < 7.5 && ride.pos.z > 4.5, ride);
console.log('RIDE TIME depart->arrive', (ride.arriveT - ride.departT).toFixed(2), 'board->arrive', (ride.arriveT - ride.rideStartT).toFixed(2));

// 2. Screenshots
await load();
await page.evaluate(({ N }) => { const g = window.__game; g.teleport({ x: 2.5, z: 28.5, yaw: N }); g.step(1); g.render(); }, { N });
await shot('b-approach');
await look(-0.6); await shot('b2-approach-down');
await look(0);
await page.evaluate(({ N }) => { const g = window.__game; g.teleport({ x: 2.5, z: 26, yaw: N }); g.setInput({ forward: true }); for (let i = 0; i < 200 && !g.state().platforms[0].riding; i++) g.step(1); g.clearInput(); g.step(40); g.render(); }, { N });
await shot('c-riding');
await look(-1.3); await shot('d-riding-look-down');
await look(0);
const steer = await page.evaluate(() => { const g = window.__game; const before = g.state(); g.setInput({ strafeLeft: true }); const st = g.step(10); g.clearInput(); return { before: before.pos, after: st.pos, riding: st.platforms[0].riding }; });
check('cannot fall off sideways while riding', Math.abs(steer.after.x - steer.before.x) < 1.2 && steer.after.x > 1.3, steer);
await page.evaluate(() => { window.__game.step(300); });
// the tire from the far side
await page.evaluate(({ S }) => { const g = window.__game; g.teleport({ x: 2.5, z: 3.5, yaw: S }); g.step(1); g.render(); }, { S });
await shot('e-from-north');

// 3. Walk into the gap beside the tire
await load();
await page.evaluate(({ N }) => { const g = window.__game; g.clearEvents(); g.teleport({ x: 2.5, z: 12, yaw: N }); g.step(2); }, { N });
const fall = { msg: await msg(), events: await page.evaluate(() => window.__game.events.map((e) => e.type)), pos: await page.evaluate(() => window.__game.state().pos) };
check('gap: "Ouch! You fell in the gap. Back to the start."', fall.msg === 'Ouch! You fell in the gap. Back to the start.' && fall.events.includes('fall'), fall);

// 4. From the north side: it comes over, then carries you south
await load();
const back = await page.evaluate(({ S }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 2.5, z: 3, yaw: S }); g.step(1);
    // wait at the edge for it to come
    let st; let came = false;
    for (let i = 0; i < 600; i++) { st = g.step(1); if (st.platforms[0].at === 0) { came = true; break; } }
    g.setInput({ forward: true });
    let arrived = false;
    for (let i = 0; i < 1500; i++) { st = g.step(1); if (st.platforms[0].riding) g.clearInput(); if (g.events.some((e) => e.what === 'arrive')) { arrived = true; break; } }
    return { came, arrived, pos: st.pos, at: st.platforms[0].at, fell: g.events.some((e) => e.type === 'fall') };
}, { S });
check('tire comes to you from the far side and carries you back', back.came && back.arrived && !back.fell && back.pos.z > 21, back);

// 5. Reset puts it back on its start edge
const reset = await page.evaluate(({ S }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 2.5, z: 3, yaw: S }); let st;
    for (let i = 0; i < 600; i++) { st = g.step(1); if (st.platforms[0].at === 0) break; }
    const before = st.platforms[0].at;
    g.teleport({ x: 2.5, z: 15, yaw: S }); g.step(2);
    return { before, after: g.state().platforms[0].at, startAt: g.state().platforms[0].startAt, fell: g.events.some((e) => e.type === 'fall') };
}, { S });
check('reset sends the tire back to its start edge', reset.before === 0 && reset.fell && reset.after === reset.startAt, reset);

// 6. Sneaky zapper
await load();
await page.evaluate(({ N }) => { const g = window.__game; g.teleport({ x: 14.5, z: 34.5, yaw: N }); g.step(1); g.render(); }, { N });
await shot('f-zapper');
await page.evaluate(({ N }) => { const g = window.__game; g.teleport({ x: 14.5, z: 32.6, yaw: N }); g.step(1); g.render(); }, { N });
await look(-0.35); await shot('f2-zapper-close');
await load();
const hit = await page.evaluate(({ N }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 14.5, z: 33.5, yaw: N }); g.setInput({ forward: true }); g.step(80); g.clearInput();
    const m = document.getElementById('message');
    return { msg: m.hidden ? '' : m.textContent, pos: g.state().pos, events: g.events.map((e) => e.type) };
}, { N });
check('zapper: Ouch, back to start', hit.msg === 'Ouch! A zapper sent you back to the start.' && hit.events.includes('spike'), hit);

// 7. Corridor views
for (const [name, x, z, yaw] of [['g-corridor1', 6.5, 34.5, E], ['g-corridor2', 30.5, 26.5, E], ['g-corridor3', 26.5, 2.5, E]]) {
    await page.evaluate(({ x, z, yaw }) => { const g = window.__game; g.teleport({ x, z, yaw }); g.step(30); g.render(); }, { x, z, yaw });
    await shot(name);
}

// 8. Door: More levels coming soon + Quit only
await load();
const fin = await page.evaluate(({ E }) => {
    const g = window.__game; g.teleport({ x: 49.5, z: 30.5, yaw: E }); g.setInput({ forward: true }); g.step(60); g.clearInput(); g.render();
    const vis = (id) => { const el = document.getElementById(id); return el && !el.hidden && el.offsetParent !== null; };
    return { escaped: g.state().escaped, title: document.getElementById('finish-title').textContent, note: vis('finish-note'), buttons: [...document.querySelectorAll('#menu-finish .item, #menu-finish button')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim()) };
}, { E });
await page.waitForTimeout(300);
await shot('h-door');
check('door: More levels coming soon + Quit', fin.escaped && fin.title === 'More levels coming soon!' && fin.buttons.join('|') === 'Quit', fin);

console.log('errors', errors);
console.log(results.every(Boolean) && !errors.length ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
