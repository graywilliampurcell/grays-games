// Level 89 checks: node t89.mjs (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const load = async (idx = 89) => { await page.goto(`${BASE}/?test=1&level=${idx - 1}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => window.__game?.ready); };
const shot = (name) => page.screenshot({ path: `${SP}l89-${name}.png` });
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info)); };
const E = -Math.PI / 2, W = Math.PI / 2, N = 0, S = Math.PI;


await load();
const st0 = await page.evaluate(() => window.__game.state());
console.log('belts', JSON.stringify(st0.belts), 'platforms', JSON.stringify(st0.platforms), 'start', JSON.stringify(st0.start), st0.level.name);
const bx = st0.belts.find((b) => b.alongX), bz = st0.belts.find((b) => !b.alongX);
check('level 89: two belts (one along x, one along z), one tire, no arm belt', st0.level.name === 'Level 89' && st0.belts.length === 2 && bx && bz && st0.platforms.length === 1 && !(st0.armBelts || []).length, {});
check('landings: bottom belt -> (2.5,50.5), east belt -> (50.5,2.5)', Math.abs(bx.landing.x - 2.5) < 0.01 && Math.abs(bx.landing.z - 50.5) < 0.01 && Math.abs(bz.landing.x - 50.5) < 0.01 && Math.abs(bz.landing.z - 2.5) < 0.01, { bx: bx.landing, bz: bz.landing });

// 1. Both cycles, independent (second half a cycle behind)
const cyc = await page.evaluate(() => {
    const g = window.__game; const last = g.state().belts.map((b) => b.phase); const log = [[], []];
    for (let i = 0; i < 60 * 16; i++) { const st = g.step(1); st.belts.forEach((b, k) => { if (b.phase !== last[k]) { log[k].push([b.phase, +st.t.toFixed(2)]); last[k] = b.phase; } }); }
    return log;
});
const ok = (log, t0) => log[0][0] === 'warning' && Math.abs(log[0][1] - t0) < 0.05 && log[1][0] === 'on' && Math.abs(log[1][1] - log[0][1] - 2) < 0.05 && log[2][0] === 'quiet' && Math.abs(log[2][1] - log[1][1] - 3) < 0.05 && Math.abs(log[3][1] - log[2][1] - 2) < 0.05;
check('belt 1: quiet 2 -> warning 2 -> on 3 -> quiet 2', ok(cyc[0], 2), cyc[0]);
check('belt 2: same cycle, starting 3.5 s later', ok(cyc[1], 5.5), cyc[1]);

// 2. Walking across while off is normal floor (each belt)
for (const [b, yaw, name, done] of [[bx, E, 'bottom', (p) => p.x > 29], [bz, S, 'east', (p) => p.z > 21]]) {
    await load();
    const walk = await page.evaluate(({ yaw, L }) => {
        const g = window.__game; g.clearEvents(); g.teleport({ x: L.x + (L.z > 40 ? 8 : 0), z: L.z + (L.z > 40 ? 0 : 8), yaw }); g.setInput({ forward: true }); let st;
        for (let i = 0; i < 200; i++) st = g.step(1);
        g.clearInput(); return { pos: st.pos, phases: st.belts.map((x) => x.phase), events: g.events.map((e) => e.type) };
    }, { yaw, L: b.landing });
    check(`${name} belt: walking across while off is normal floor`, done(walk.pos) && !walk.events.includes('belt'), walk);
}

// 3. On a belt when it turns on: flung to its landing, not an Ouch
for (const [b, k, at, name] of [[bx, st0.belts.indexOf(bx), { x: 20, z: 50.5, yaw: E }, 'bottom'], [bz, st0.belts.indexOf(bz), { x: 50.5, z: 12, yaw: S }, 'east']]) {
    await load();
    const fl = await page.evaluate(({ at, k }) => {
        const g = window.__game; g.clearEvents(); g.teleport(at); let st; let onT = null; let flingT = null;
        for (let i = 0; i < 60 * 9; i++) {
            st = g.step(1);
            if (onT === null && st.belts[k].phase === 'on') onT = st.t;
            if (flingT === null && g.events.some((e) => e.type === 'belt')) flingT = st.t;
            if (flingT !== null && !st.shoved) break;
        }
        const m = document.getElementById('message');
        return { pos: st.pos, onT, flingT, events: [...new Set(g.events.map((e) => e.type))], msg: m && !m.hidden ? m.textContent : '' };
    }, { at, k });
    check(`${name} belt: flung to its hallway's first cell when it turns on`, fl.onT !== null && fl.flingT !== null && Math.abs(fl.flingT - fl.onT) < 0.05 && Math.abs(fl.pos.x - b.landing.x) < 0.05 && Math.abs(fl.pos.z - b.landing.z) < 0.05 && !fl.events.includes('spike') && !fl.msg, fl);
}

// 4. Big zapper: walking east into the dead end from path cell (2,8)
const bigz = async (z) => { await load(); return page.evaluate(({ E, z }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 10.5, z, yaw: E }); g.setInput({ forward: true }); let st;
    for (let i = 0; i < 120; i++) { st = g.step(1); if (g.events.some((e) => e.type === 'spike')) break; }
    g.clearInput(); const m = document.getElementById('message');
    return { pos: st.pos, hit: g.events.some((e) => e.type === 'spike'), msg: m.hidden ? '' : m.textContent };
}, { E, z }); };
const bzr = await bigz(34.5); check('big zapper: Ouch + back to start', bzr.hit && bzr.msg === 'Ouch! A zapper sent you back to the start.' && Math.abs(bzr.pos.z - st0.start.z) < 1, bzr);
for (const z of [33.45, 35.55]) { const r = await bigz(z); check(`no way past at the side z ${z}`, r.hit, r); }
await load();
const edge = await page.evaluate(() => { const g = window.__game; g.clearEvents(); g.teleport({ x: 11.4, z: 34.5 }); g.step(5); return { hit: g.events.some((e) => e.type === 'spike'), pos: g.state().pos }; });
check('standing in the path cell next to it is safe', !edge.hit, edge);

// 5. Tire ride heading north up the middle column
await load();
const ride = await page.evaluate(({ N }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 30.5, z: 46.5, yaw: N }); g.setInput({ forward: true });
    let st; let departT = null; let arriveT = null; let fell = false; let rideStartT = null;
    for (let i = 0; i < 1500; i++) {
        st = g.step(1); const p = st.platforms[0];
        if (p.riding && rideStartT === null) { rideStartT = st.t; g.clearInput(); }
        if (g.events.some((e) => e.type === 'fall')) fell = true;
        if (departT === null && g.events.some((e) => e.what === 'depart')) departT = st.t;
        if (arriveT === null && g.events.some((e) => e.what === 'arrive')) { arriveT = st.t; break; }
    }
    return { fell, pos: st.pos, rideStartT, departT, arriveT };
}, { N });
check('tire carries you across to the north edge', !ride.fell && ride.arriveT !== null && ride.pos.z < 27 && ride.pos.z > 20, ride);
console.log('RIDE depart->arrive', (ride.arriveT - ride.departT).toFixed(2), 'board->arrive', (ride.arriveT - ride.rideStartT).toFixed(2), 'speed', st0.platforms[0].speed);
await load();
const fall = await page.evaluate(() => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 30.5, z: 34, yaw: 0 }); let st = g.step(5); const m = document.getElementById('message');
    return { pos: st.pos, events: g.events.map((e) => e.type), msg: m.hidden ? '' : m.textContent };
});
check('gap: Ouch, fell in', fall.msg === 'Ouch! You fell in the gap. Back to the start.', fall);

// 6. Screenshots
await load();
await page.evaluate(({ E }) => { const g = window.__game; g.teleport({ x: 8, z: 34.5, yaw: E }); g.step(1); g.render(); }, { E });
await shot('a-bigzapper');
await page.evaluate(({ E }) => { const g = window.__game; g.teleport({ x: 2.5, z: 14.5, yaw: E }); g.step(1); g.render(); }, { E });
await shot('b-start');
await page.evaluate(({ N }) => { const g = window.__game; g.teleport({ x: 30.5, z: 46.5, yaw: N }); g.step(1); g.render(); }, { N });
await shot('c-tire');
await page.evaluate(({ E, L }) => { const g = window.__game; g.teleport({ x: L.x - 1, z: L.z, yaw: E }); g.step(1); g.render(); }, { E, L: bx.landing });
await shot('d-belt-bottom');
await page.evaluate(({ S, L }) => { const g = window.__game; g.teleport({ x: L.x, z: L.z - 1, yaw: S }); g.step(1); g.render(); }, { S, L: bz.landing });
await shot('e-belt-east');
await page.evaluate(({ k }) => { const g = window.__game; while (g.state().belts[k].phase !== 'warning') g.step(1); g.step(10); g.render(); }, { k: st0.belts.indexOf(bz) });
await shot('f-warning-east');

// 7. Doors
const door = async (idx) => { await load(idx); return page.evaluate(({ E }) => {
    const g = window.__game; const d = g.state().door; g.teleport({ x: d.x - 2.5, z: d.z, yaw: E }); g.setInput({ forward: true }); g.step(60); g.clearInput();
    return { escaped: g.state().escaped, title: document.getElementById('finish-title').textContent, buttons: [...document.querySelectorAll('#menu-finish .item, #menu-finish button')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim()) };
}, { E }); };
const f89 = await door(89); check('door: More levels coming soon + Quit', f89.escaped && f89.title === 'More levels coming soon!' && f89.buttons.join('|') === 'Quit', f89);
const f88 = await door(88); check("Level 88's door: You did it! + Start Level 89", f88.title === 'You did it!' && f88.buttons.some((x) => /Level 89/.test(x)), f88);

// 8. Level 87 (one belt) unchanged: its belt still warns at 2 s
await load(87);
const c87 = await page.evaluate(() => { const g = window.__game; let t = null; for (let i = 0; i < 200 && t === null; i++) { const st = g.step(1); if (st.belts[0].phase === 'warning') t = st.t; } return t; });
check('Level 87 belt timing unchanged', Math.abs(c87 - 2) < 0.05, c87);

console.log('errors', errors);
console.log(results.every(Boolean) && !errors.length ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
