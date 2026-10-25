// Level 99 checks: node t90.mjs (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
let browser = null; const launch = () => chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
let page = null;
const errors = [];
const load = async (n = 99) => { if (browser) await browser.close().catch(() => {}); browser = await launch(); page = await browser.newPage({ viewport: { width: 1024, height: 640 } }); page.on('pageerror', (e) => errors.push(String(e))); page.on('crash', () => console.log('CRASH')); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); }); for (let tr = 0; tr < 3; tr++) { try { await page.goto(`${BASE}/?test=1&level=${n - 1}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => window.__game?.ready); return; } catch (e) { console.log('retry load', String(e).slice(0, 80)); } } };
const shot = (name) => page.screenshot({ path: `${SP}l99-${name}.png` });
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info)); };
const E = -Math.PI / 2, W = Math.PI / 2, N = 0, S = Math.PI;
const yawOf = (f) => Math.atan2(-f.x, -f.z);


await load();
const st0 = await page.evaluate(() => window.__game.state());
console.log(st0.level.name, 'music', st0.music, 'belts', JSON.stringify(st0.belts), 'arm', JSON.stringify(st0.armBelts.map((b) => ({ ...b, arms: undefined }))), 'spike', JSON.stringify(st0.spike), 'start', JSON.stringify(st0.start), 'platforms', JSON.stringify(st0.platforms));
check('L99: 1 arm belt, 1 backward belt, 1 tire, path zapper', st0.level.name === 'Level 99' && st0.armBelts.length === 1 && st0.belts.length === 1 && st0.platforms.length === 1 && !!st0.spike && !st0.spike2, {});

const timing = await page.evaluate(() => {
    const g = window.__game; g.teleport({ x: 2.5, z: 26.5 }); const spawns = []; let last = -1;
    for (let i = 0; i < 60 * 11; i++) { const st = g.step(1); const b = st.armBelts[0]; const a = b.arms[b.arms.length - 1]; const s = a ? a.s : -1; if (a && s > last + 0.5) spawns.push({ t: +st.t.toFixed(2), side: a.side }); last = s; }
    return spawns;
});
check('arm belt: every 3 s alternating', timing.length >= 3 && Math.abs(timing[1].t - timing[0].t - 3) < 0.05 && Math.abs(timing[2].t - timing[1].t - 3) < 0.05 && timing[0].side === -timing[1].side, timing);

await load();
const cyc = await page.evaluate(() => {
    const g = window.__game; g.teleport({ x: 2.5, z: 26.5 }); let last = g.state().belts[0].phase; const log = [];
    for (let i = 0; i < 60 * 16; i++) { const st = g.step(1); const b = st.belts[0]; if (b.phase !== last) { log.push([b.phase, +st.t.toFixed(2)]); last = b.phase; } }
    return log;
});
check('backward belt: off 2, warn 2, on 3', cyc[0][0] === 'warning' && Math.abs(cyc[0][1] - 2) < 0.05 && cyc[1][0] === 'on' && Math.abs(cyc[1][1] - cyc[0][1] - 2) < 0.05 && cyc[2][0] === 'quiet' && Math.abs(cyc[2][1] - cyc[1][1] - 3) < 0.05 && cyc[3][0] === 'warning' && Math.abs(cyc[3][1] - cyc[2][1] - 2) < 0.05, cyc);

{
    const b = st0.belts[0]; const c = { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 };
    await load();
    const fl = await page.evaluate(({ c }) => {
        const g = window.__game; g.clearEvents(); g.teleport(c); let st; let onT = null; let flingT = null;
        for (let i = 0; i < 60 * 10; i++) { st = g.step(1); if (onT === null && st.belts[0].phase === 'on') onT = st.t; if (flingT === null && g.events.some((e) => e.type === 'belt')) flingT = st.t; if (flingT !== null && !st.shoved) break; }
        const m = document.getElementById('message');
        return { pos: st.pos, onT, flingT, ev: [...new Set(g.events.map((e) => e.type))], msg: m && !m.hidden ? m.textContent : '' };
    }, { c });
    check('backward belt: flung to landing, no Ouch', fl.flingT !== null && Math.abs(fl.pos.x - b.landing.x) < 0.05 && Math.abs(fl.pos.z - b.landing.z) < 0.05 && !fl.ev.includes('spike') && !fl.msg, { fl, landing: b.landing });
    await load();
    const yaw = b.alongX ? (b.landing.x < c.x ? E : W) : (b.landing.z < c.z ? S : N);
    const w = await page.evaluate(({ L, yaw, c }) => {
        const g = window.__game; let st = g.state(); let seenOn = false;
        for (let guard = 0; guard < 60 * 20 && !(seenOn && st.belts[0].phase === 'quiet'); guard++) { st = g.step(1); if (st.belts[0].phase === 'on') seenOn = true; }
        g.clearEvents(); g.teleport({ x: L.x, z: L.z, yaw }); g.setInput({ forward: true });
        for (let i = 0; i < 240; i++) st = g.step(1);
        g.clearInput(); const d0 = Math.hypot(L.x - c.x, L.z - c.z), d1 = Math.hypot(st.pos.x - L.x, st.pos.z - L.z);
        return { pos: st.pos, past: d1 > d0 + 7, flung: g.events.some((e) => e.type === 'belt') };
    }, { L: b.landing, yaw, c });
    check('backward belt: walk across while off', w.past && !w.flung, w);
    await load();
    await page.evaluate(({ L, yaw }) => { const g = window.__game; g.teleport({ ...L, yaw }); g.step(1); g.render(); }, { L: b.landing, yaw });
    await shot('belt');
}
{
    const b = st0.armBelts[0]; const len = b.alongX ? b.maxX - b.minX : b.maxZ - b.minZ;
    const c = { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 }; const yaw = yawOf(b.forward);
    await load();
    const push = await page.evaluate(({ p }) => {
        const g = window.__game; g.clearEvents(); let st; let pushT = null;
        for (let i = 0; i < 60 * 6; i++) { g.teleport(p); st = g.step(1); if (g.events.some((e) => e.type === 'armPush')) { pushT = st.t; break; } }
        for (let i = 0; i < 60; i++) { st = g.step(1); if (!st.shoved) break; }
        const m = document.getElementById('message');
        return { pushT, pos: st.pos, ev: [...new Set(g.events.map((e) => e.type))], msg: m && !m.hidden ? m.textContent : '' };
    }, { p: { x: c.x + b.right.x * 0.75, z: c.z + b.right.z * 0.75 } });
    check('arm belt: push to landing, no Ouch', push.pushT !== null && Math.abs(push.pos.x - b.landing.x) < 0.05 && Math.abs(push.pos.z - b.landing.z) < 0.05 && !push.ev.includes('spike') && !push.msg, { push, landing: b.landing });
    const res = [];
    for (let n = 0; n < 3; n++) {
        await load();
        res.push(await page.evaluate(({ L, yaw, n, b, endAlong, c }) => {
            const g = window.__game; let st = g.state(); let count = 0; let lastS = -1; let side = 1;
            g.teleport({ ...L, yaw });
            for (let guard = 0; guard < 60 * 20 && count <= n; guard++) { st = g.step(1); g.teleport({ ...L, yaw }); const a = st.armBelts[0].arms[st.armBelts[0].arms.length - 1]; const s = a ? a.s : -1; if (a && s > lastS + 0.5) { count++; side = a.side; } lastS = s; }
            g.clearEvents();
            g.teleport({ x: L.x - b.right.x * side * 0.75, z: L.z - b.right.z * side * 0.75, yaw }); g.setInput({ forward: true });
            let reached = false;
            for (let i = 0; i < 150; i++) { st = g.step(1); const along = (st.pos.x - c.x) * b.forward.x + (st.pos.z - c.z) * b.forward.z; if (along > endAlong) { reached = true; break; } }
            g.clearInput();
            return { t: +st.t.toFixed(2), reached, pushed: g.events.some((e) => e.type === 'armPush') };
        }, { L: b.landing, yaw, n, b: { right: b.right, forward: b.forward }, endAlong: len / 2 + 0.5, c }));
    }
    check('arm belt: dodge in the other half after each arm', res.every((r) => r.reached && !r.pushed), res);
    await load();
    await page.evaluate(({ p, yaw }) => { const g = window.__game; let st = g.state(); for (let guard = 0; guard < 600 && st.t < 1.8; guard++) st = g.step(1); g.teleport({ ...p, yaw }); g.step(1); g.render(); }, { p: b.landing, yaw });
    await shot('arm');
}

// tire ride: top row heading east, gap x 17-35
await load();
const ride = await page.evaluate(({ E }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 14.5, z: 2.5, yaw: E }); g.setInput({ forward: true });
    let st; let arriveT = null; let fell = false; let rideStartT = null;
    for (let i = 0; i < 2000; i++) {
        st = g.step(1); const p = st.platforms[0];
        if (p.riding && rideStartT === null) { rideStartT = st.t; g.clearInput(); }
        if (g.events.some((e) => e.type === 'fall')) fell = true;
        if (arriveT === null && g.events.some((e) => e.what === 'arrive')) { arriveT = st.t; break; }
    }
    return { fell, pos: st.pos, rideStartT, arriveT };
}, { E });
check('tire carries you east across the gap', !ride.fell && ride.arriveT !== null && ride.pos.x > 35, ride);
await load();
const fall = await page.evaluate(() => { const g = window.__game; g.clearEvents(); g.teleport({ x: 26, z: 2.5, yaw: 0 }); let st = g.step(5); const m = document.getElementById('message'); return { msg: m.hidden ? '' : m.textContent }; });
check('gap: Ouch, fell in', /fell in the gap/.test(fall.msg), fall);
await load();
await page.evaluate(({ E }) => { const g = window.__game; g.teleport({ x: 12.5, z: 2.5, yaw: E }); g.step(1); g.render(); }, { E });
await shot('tire');

// path zapper heading south
const sp = st0.spike;
const squeeze = async (x) => { await load(); return page.evaluate(({ x, S, sp }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x, z: sp.z - 5, yaw: S }); g.setInput({ forward: true }); let st;
    for (let i = 0; i < 120; i++) st = g.step(1);
    g.clearInput(); const m = document.getElementById('message');
    return { pos: st.pos, hit: g.events.some((e) => e.type === 'spike'), msg: m.hidden ? '' : m.textContent };
}, { x, S, sp }); };
const qa = await squeeze(sp.x - 1.08); check('squeeze past west side', !qa.hit && qa.pos.z > sp.z + 2, qa);
const qb = await squeeze(sp.x + 1.08); check('squeeze past east side', !qb.hit && qb.pos.z > sp.z + 2, qb);
const qc = await squeeze(sp.x); check('middle: Ouch', qc.hit && qc.msg === 'Ouch! A zapper sent you back to the start.', qc);
const qd = await squeeze(sp.x - 0.85); check('a bit off the side still hits', qd.hit, qd);
console.log('spike', JSON.stringify(sp));

// big zapper: walk east from path cell (10,1) into the dead end
const bigz = async (z) => { await load(); return page.evaluate(({ E, z }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 42.5, z, yaw: E }); g.setInput({ forward: true }); let st;
    for (let i = 0; i < 120; i++) { st = g.step(1); if (g.events.some((e) => e.type === 'spike')) break; }
    g.clearInput(); const m = document.getElementById('message');
    return { pos: st.pos, hit: g.events.some((e) => e.type === 'spike'), msg: m.hidden ? '' : m.textContent };
}, { E, z }); };
for (const z of [6.5, 5.45, 7.55]) { const r = await bigz(z); check(`big zapper at z ${z}: Ouch`, r.hit && r.msg === 'Ouch! A zapper sent you back to the start.', r); }
await load();
const edge = await page.evaluate(() => { const g = window.__game; g.clearEvents(); g.teleport({ x: 44.6, z: 6.5 }); g.step(5); return { hit: g.events.some((e) => e.type === 'spike') }; });
check('standing in the path cell next to the big zapper is safe', !edge.hit, edge);

const view = async (name, x, z, yaw) => { await load(); await page.evaluate(({ x, z, yaw }) => { const g = window.__game; g.teleport({ x, z, yaw }); g.step(2); g.render(); }, { x, z, yaw }); await shot(name); };
await view('bigzap', 38.5, 6.5, E);
await view('pathzap', sp.x, sp.z - 8, S);
await view('start', st0.start.x, st0.start.z, E);

const finish = () => page.evaluate(() => {
    const g = window.__game; const d = g.state().door; g.teleport({ x: d.x - 2.5, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); g.step(40); g.clearInput(); g.render();
    return { title: document.getElementById('finish-title').textContent, buttons: [...document.querySelectorAll('#menu-finish .item, #menu-finish button')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim()), note: !document.getElementById('finish-note').hidden };
});
await load();
const fin = await finish(); await shot('finish');
check('L99 door: You did it! + More levels coming soon + Quit', fin.title === 'You did it!' && fin.note && fin.buttons.join('|') === 'Quit', fin);
await load(98);
const f98 = await finish();
check('L98 door: Start Level 99', f98.buttons.some((b) => /Start Level 99/.test(b)), f98);
console.log('errors', errors);
console.log(results.every(Boolean) && !errors.length ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
