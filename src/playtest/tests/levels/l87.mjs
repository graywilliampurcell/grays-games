// Level 87 checks: node t87.mjs (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const load = async (idx = 87) => { await page.goto(`${BASE}/?test=1&level=${idx - 1}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => window.__game?.ready); };
const shot = (name) => page.screenshot({ path: `${SP}l87-${name}.png` });
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info)); };
const E = -Math.PI / 2, W = Math.PI / 2, N = 0, S = Math.PI;

await load();
const st0 = await page.evaluate(() => window.__game.state());
console.log('belts', JSON.stringify(st0.belts), 'platforms', JSON.stringify(st0.platforms), 'spike', JSON.stringify(st0.spike), 'start', JSON.stringify(st0.start), st0.level.name);
const b0 = st0.belts[0];
check('level 87: one belt along x, one tire, no path zapper, no arm belt', st0.level.name === 'Level 87' && st0.belts.length === 1 && b0.alongX && st0.platforms.length === 1 && !(st0.armBelts || []).length, { b0, spike: st0.spike });

// 1. Belt cycle
const cyc = await page.evaluate(() => {
    const g = window.__game; let last = g.state().belts[0].phase; const log = [];
    for (let i = 0; i < 60 * 12; i++) { const st = g.step(1); const ph = st.belts[0].phase; if (ph !== last) { log.push([ph, st.t]); last = ph; } }
    return log;
});
check('cycle: quiet 2 s -> warning 2 s -> on 3 s -> quiet', cyc[0][0] === 'warning' && Math.abs(cyc[0][1] - 2) < 0.05 && cyc[1][0] === 'on' && Math.abs(cyc[1][1] - cyc[0][1] - 2) < 0.05 && cyc[2][0] === 'quiet' && Math.abs(cyc[2][1] - cyc[1][1] - 3) < 0.05, cyc);

// 2. Walk across the belt while off (east along z 2.5)
await load();
const walk = await page.evaluate(({ E, L }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: L.x, z: L.z, yaw: E }); g.setInput({ forward: true }); let st;
    for (let i = 0; i < 205; i++) st = g.step(1);
    g.clearInput(); return { pos: st.pos, events: g.events.map((e) => e.type) };
}, { E, L: b0.landing });
check('walking across while off is normal floor', walk.pos.x > 49 && !walk.events.includes('belt'), walk);

// 3. On it when it turns on: flung to the landing
await load();
const fl = await page.evaluate(({ E, L }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 40, z: L.z, yaw: E }); let st; let onT = null; let flingT = null;
    for (let i = 0; i < 60 * 6; i++) {
        st = g.step(1);
        if (onT === null && st.belts[0].phase === 'on') onT = st.t;
        if (flingT === null && g.events.some((e) => e.type === 'belt')) flingT = st.t;
        if (flingT !== null && !st.shoved) break;
    }
    const m = document.getElementById('message');
    return { pos: st.pos, onT, flingT, events: [...new Set(g.events.map((e) => e.type))], msg: m && !m.hidden ? m.textContent : '' };
}, { E, L: b0.landing });
check('flung to the hallway first cell, not an Ouch', fl.onT !== null && fl.flingT !== null && Math.abs(fl.flingT - fl.onT) < 0.05 && Math.abs(fl.pos.x - b0.landing.x) < 0.05 && Math.abs(fl.pos.z - b0.landing.z) < 0.05 && !fl.events.includes('spike') && !fl.msg, fl);

// 4. Big zapper: walking west into the dead end from path cell (4,8) is an Ouch
const bigz = async (z) => { await load(); return page.evaluate(({ W, z }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 18.5, z, yaw: W }); g.setInput({ forward: true }); let st;
    for (let i = 0; i < 120; i++) { st = g.step(1); if (g.events.some((e) => e.type === 'spike')) break; }
    g.clearInput(); const m = document.getElementById('message');
    return { pos: st.pos, hit: g.events.some((e) => e.type === 'spike'), msg: m.hidden ? '' : m.textContent };
}, { W, z }); };
const bz = await bigz(34.5); check('big zapper: Ouch + back to start', bz.hit && bz.msg === 'Ouch! A zapper sent you back to the start.' && Math.abs(bz.pos.z - 22.5) < 1, bz);
for (const z of [33.45, 35.55]) { const r = await bigz(z); check(`no way past at the side z ${z}`, r.hit, r); }
await load();
const edge = await page.evaluate(() => { const g = window.__game; g.clearEvents(); g.teleport({ x: 17.6, z: 34.5 }); g.step(5); return { hit: g.events.some((e) => e.type === 'spike'), pos: g.state().pos }; });
check('standing in the path cell next to it is safe', !edge.hit, edge);

// 5. Tire ride heading south down the left column
await load();
const p0 = st0.platforms[0];
const ride = await page.evaluate(({ E }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 6.5, z: 50.5, yaw: E }); g.setInput({ forward: true });
    let st; let departT = null; let arriveT = null; let fell = false; let rideStartT = null;
    for (let i = 0; i < 1500; i++) {
        st = g.step(1); const p = st.platforms[0];
        if (p.riding && rideStartT === null) { rideStartT = st.t; g.clearInput(); }
        if (g.events.some((e) => e.type === 'fall')) fell = true;
        if (departT === null && g.events.some((e) => e.what === 'depart')) departT = st.t;
        if (arriveT === null && g.events.some((e) => e.what === 'arrive')) { arriveT = st.t; break; }
    }
    return { fell, pos: st.pos, rideStartT, departT, arriveT };
}, { E });
check('tire carries you across to the east edge', !ride.fell && ride.arriveT !== null && ride.pos.x > 27 && ride.pos.x < 31, ride);
console.log('RIDE depart->arrive', (ride.arriveT - ride.departT).toFixed(2), 'board->arrive', (ride.arriveT - ride.rideStartT).toFixed(2), 'speed', p0.speed);
await load();
const fall = await page.evaluate(({ S }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 18, z: 50.5, yaw: -Math.PI / 2 }); let st = g.step(5); const m = document.getElementById('message');
    return { pos: st.pos, events: g.events.map((e) => e.type), msg: m.hidden ? '' : m.textContent };
}, { S });
check('gap: Ouch, fell in', fall.msg === 'Ouch! You fell in the gap. Back to the start.', fall);

// 6. Screenshots
await load();
await page.evaluate(({ W }) => { const g = window.__game; g.teleport({ x: 21, z: 34.5, yaw: W }); g.step(1); g.render(); }, { W });
await shot('a-bigzapper');
await page.evaluate(({ E }) => { const g = window.__game; g.teleport({ x: 2.5, z: 22.5, yaw: E }); g.step(1); g.render(); }, { E });
await shot('b-start');
await page.evaluate(({ E }) => { const g = window.__game; g.teleport({ x: 6.5, z: 50.5, yaw: E }); g.step(1); g.render(); }, { E });
await shot('c-tire');
await page.evaluate(({ E, L }) => { const g = window.__game; g.teleport({ x: L.x - 1, z: L.z, yaw: E }); g.step(1); g.render(); }, { E, L: b0.landing });
await shot('d-belt');
await page.evaluate(() => { const g = window.__game; while (g.state().belts[0].phase !== 'warning') g.step(1); g.step(10); g.render(); });
await shot('e-warning');

// 7. Doors
const door = async (idx) => { await load(idx); return page.evaluate(({ E }) => {
    const g = window.__game; const d = g.state().door; g.teleport({ x: d.x - 2.5, z: d.z, yaw: E }); g.setInput({ forward: true }); g.step(60); g.clearInput();
    return { escaped: g.state().escaped, title: document.getElementById('finish-title').textContent, buttons: [...document.querySelectorAll('#menu-finish .item, #menu-finish button')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim()) };
}, { E }); };
const f87 = await door(87); check('door: More levels coming soon + Quit', f87.escaped && f87.title === 'More levels coming soon!' && f87.buttons.join('|') === 'Quit', f87);
const f86 = await door(86); check("Level 86's door: You did it! + Start Level 87", f86.title === 'You did it!' && f86.buttons.some((x) => /Level 87/.test(x)), f86);

console.log('errors', errors);
console.log(results.every(Boolean) && !errors.length ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
