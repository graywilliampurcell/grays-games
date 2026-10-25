// Level 90 checks: node t90.mjs (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
let browser = null; const launch = () => chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
let page = null;
const errors = [];
const load = async (n = 90) => { if (browser) await browser.close().catch(() => {}); browser = await launch(); page = await browser.newPage({ viewport: { width: 1024, height: 640 } }); page.on('pageerror', (e) => errors.push(String(e))); page.on('crash', () => console.log('CRASH')); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); }); for (let tr = 0; tr < 3; tr++) { try { await page.goto(`${BASE}/?test=1&level=${n - 1}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => window.__game?.ready); return; } catch (e) { console.log('retry load', String(e).slice(0, 80)); } } };
const shot = (name) => page.screenshot({ path: `${SP}l90-${name}.png` });
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info)); };
const E = -Math.PI / 2, W = Math.PI / 2, N = 0, S = Math.PI;
const yawOf = (f) => Math.atan2(-f.x, -f.z);

await load();
const st0 = await page.evaluate(() => window.__game.state());
console.log('t', st0.t, st0.level.name, 'belts', JSON.stringify(st0.belts.map((b) => ({ ...b }))), 'arm', JSON.stringify(st0.armBelts.map((b) => ({ ...b, arms: undefined }))), 'spike', JSON.stringify(st0.spike), 'start', JSON.stringify(st0.start));
check('L90: 2 arm belts, 2 backward belts, no tire, path zapper', st0.level.name === 'Level 90' && st0.armBelts.length === 2 && st0.belts.length === 2 && st0.platforms.length === 0 && !!st0.spike, {});

// arm timing: belt 0 at 1 s then every 3 s; belt 1 (fast) at 2.5 s then every 2 s
const timing = await page.evaluate(() => {
    const g = window.__game; g.teleport({ x: 2.5, z: 26.5 }); const spawns = [[], []]; const last = [-1, -1];
    for (let i = 0; i < 60 * 10; i++) {
        const st = g.step(1);
        st.armBelts.forEach((b, k) => { const a = b.arms[b.arms.length - 1]; const s = a ? a.s : -1; if (a && s > last[k] + 0.5) spawns[k].push({ t: +st.t.toFixed(2), side: a.side }); last[k] = s; });
    }
    return spawns;
});
const okT = (s, first, dt) => s.length >= 3 && Math.abs(s[0].t - first) < 0.05 && Math.abs(s[1].t - s[0].t - dt) < 0.05 && Math.abs(s[2].t - s[1].t - dt) < 0.05 && s[0].side === -s[1].side && s[1].side === -s[2].side;
check('arm belt 1 (top row): 1 s then every 3 s alternating', okT(timing[0], 1, 3), timing[0]);
check('arm belt 2 (fast): 2.5 s then every 2 s alternating', okT(timing[1], 2.5, 2), timing[1]);

// backward belt cycles
await load();
const cyc = await page.evaluate(() => {
    const g = window.__game; g.teleport({ x: 2.5, z: 26.5 }); const last = g.state().belts.map((b) => b.phase); const log = [[], []];
    for (let i = 0; i < 60 * 16; i++) { const st = g.step(1); st.belts.forEach((b, k) => { if (b.phase !== last[k]) { log[k].push([b.phase, +st.t.toFixed(2)]); last[k] = b.phase; } }); }
    return log;
});
const ok = (log, t0) => log[0][0] === 'warning' && Math.abs(log[0][1] - t0) < 0.05 && log[1][0] === 'on' && Math.abs(log[1][1] - log[0][1] - 2) < 0.05 && log[2][0] === 'quiet' && Math.abs(log[2][1] - log[1][1] - 3) < 0.05;
check('backward belt 1: warn at 2, on 2 s later, 3 s on', ok(cyc[0], 2), cyc[0]);
check('backward belt 2: same, 3.5 s later', ok(cyc[1], 5.5), cyc[1]);

// each backward belt: flung to its landing when it turns on
for (let k = 0; k < 2; k++) {
    const b = st0.belts[k];
    const c = { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 };
    await load();
    const fl = await page.evaluate(({ c, k }) => {
        const g = window.__game; g.clearEvents(); g.teleport(c); let st; let onT = null; let flingT = null;
        for (let i = 0; i < 60 * 10; i++) { st = g.step(1); if (onT === null && st.belts[k].phase === 'on') onT = st.t; if (flingT === null && g.events.some((e) => e.type === 'belt')) flingT = st.t; if (flingT !== null && !st.shoved) break; }
        const m = document.getElementById('message');
        return { pos: st.pos, onT, flingT, ev: [...new Set(g.events.map((e) => e.type))], msg: m && !m.hidden ? m.textContent : '' };
    }, { c, k });
    check(`backward belt ${k + 1}: flung to landing, no Ouch`, fl.flingT !== null && Math.abs(fl.flingT - fl.onT) < 0.05 && Math.abs(fl.pos.x - b.landing.x) < 0.05 && Math.abs(fl.pos.z - b.landing.z) < 0.05 && !fl.ev.includes('spike') && !fl.msg, { fl, landing: b.landing });
    // walk across while off (start right after it turns off)
    await load();
    const yaw = b.alongX ? (b.landing.x < c.x ? E : W) : (b.landing.z < c.z ? S : N);
    const w = await page.evaluate(({ L, yaw, k, c }) => {
        const g = window.__game; let st = g.state(); let seenOn = false;
        for (let guard = 0; guard < 60 * 20 && !(seenOn && st.belts[k].phase === 'quiet'); guard++) { st = g.step(1); if (st.belts[k].phase === 'on') seenOn = true; }
        g.clearEvents(); g.teleport({ x: L.x, z: L.z, yaw }); g.setInput({ forward: true });
        for (let i = 0; i < 240; i++) st = g.step(1);
        g.clearInput(); const d0 = Math.hypot(L.x - c.x, L.z - c.z), d1 = Math.hypot(st.pos.x - L.x, st.pos.z - L.z);
        return { pos: st.pos, past: d1 > d0 + 9, flung: g.events.some((e) => e.type === 'belt') };
    }, { L: b.landing, yaw, k, c });
    check(`backward belt ${k + 1}: walk across while off`, w.past && !w.flung, w);
}

// arm belts: carry, push, dodge (incl. the fast one at many start times)
for (let k = 0; k < 2; k++) {
    const b = st0.armBelts[k];
    const len = b.alongX ? b.maxX - b.minX : b.maxZ - b.minZ;
    const c = { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 };
    const yaw = yawOf(b.forward);
    await load();
    const push = await page.evaluate(({ p }) => {
        const g = window.__game; g.clearEvents(); let st; let pushT = null;
        for (let i = 0; i < 60 * 6; i++) { g.teleport(p); st = g.step(1); if (g.events.some((e) => e.type === 'armPush')) { pushT = st.t; break; } }
        for (let i = 0; i < 60; i++) { st = g.step(1); if (!st.shoved) break; }
        const m = document.getElementById('message');
        return { pushT, pos: st.pos, ev: [...new Set(g.events.map((e) => e.type))], msg: m && !m.hidden ? m.textContent : '' };
    }, { p: { x: c.x + b.right.x * 0.75, z: c.z + b.right.z * 0.75 } });
    check(`arm belt ${k + 1}: push to landing, no Ouch`, push.pushT !== null && Math.abs(push.pos.x - b.landing.x) < 0.05 && Math.abs(push.pos.z - b.landing.z) < 0.05 && !push.ev.includes('spike') && !push.msg, { push, landing: b.landing });
    // dodge strategy: wait at the landing until an arm appears, walk in the other half; try after each of the first 4 arms
    const res = [];
    for (let n = 0; n < 4; n++) {
        await load();
        res.push(await page.evaluate(({ L, yaw, k, n, b, endAlong, c }) => {
            const g = window.__game; let st = g.state(); let count = 0; let lastS = -1; let side = 1;
            g.teleport({ ...L, yaw });
            for (let guard = 0; guard < 60 * 20 && count <= n; guard++) { st = g.step(1); g.teleport({ ...L, yaw }); const a = st.armBelts[k].arms[st.armBelts[k].arms.length - 1]; const s = a ? a.s : -1; if (a && s > lastS + 0.5) { count++; side = a.side; } lastS = s; }
            g.clearEvents();
            g.teleport({ x: L.x - b.right.x * side * 0.75, z: L.z - b.right.z * side * 0.75, yaw }); g.setInput({ forward: true });
            let reached = false;
            for (let i = 0; i < 150; i++) { st = g.step(1); const along = (st.pos.x - c.x) * b.forward.x + (st.pos.z - c.z) * b.forward.z; if (along > endAlong) { reached = true; break; } }
            g.clearInput();
            return { t: +st.t.toFixed(2), reached, pushed: g.events.some((e) => e.type === 'armPush') };
        }, { L: b.landing, yaw, k, n, b: { right: b.right, forward: b.forward }, endAlong: len / 2 + 0.5, c }));
    }
    check(`arm belt ${k + 1}: dodge in the other half after each arm`, res.every((r) => r.reached && !r.pushed), res);
    // straight walk in one half at many start times: how often you get pushed
    await load();
    await page.evaluate(({ p, yaw, k }) => { const g = window.__game; let st = g.state(); for (let guard = 0; guard < 600 && st.t < (k === 0 ? 1.8 : 3.3); guard++) st = g.step(1); g.teleport({ ...p, yaw }); g.step(1); g.render(); }, { p: b.landing, yaw, k });
    await shot(`arm${k + 1}`);
}

// path zapper: squeeze (corridor heading west)
const sp = st0.spike;
const squeeze = async (z) => { await load(); return page.evaluate(({ z, W, sp }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: sp.x + 5, z, yaw: W }); g.setInput({ forward: true }); let st;
    for (let i = 0; i < 120; i++) st = g.step(1);
    g.clearInput(); const m = document.getElementById('message');
    return { pos: st.pos, hit: g.events.some((e) => e.type === 'spike'), msg: m.hidden ? '' : m.textContent };
}, { z, W, sp }); };
const qa = await squeeze(sp.z - 1.08); check('squeeze past north side', !qa.hit && qa.pos.x < sp.x - 2, qa);
const qb = await squeeze(sp.z + 1.08); check('squeeze past south side', !qb.hit && qb.pos.x < sp.x - 2, qb);
const qc = await squeeze(sp.z); check('middle: Ouch', qc.hit && qc.msg === 'Ouch! A zapper sent you back to the start.', qc);
const qd = await squeeze(sp.z - 0.85); check('a bit off the side still hits', qd.hit, qd);
console.log('spike', JSON.stringify(sp));

// big zapper: walk north from path cell (12,5) into the dead end
const bigz = async (x) => { await load(); return page.evaluate(({ N, x }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x, z: 22.5, yaw: N }); g.setInput({ forward: true }); let st;
    for (let i = 0; i < 120; i++) { st = g.step(1); if (g.events.some((e) => e.type === 'spike')) break; }
    g.clearInput(); const m = document.getElementById('message');
    return { pos: st.pos, hit: g.events.some((e) => e.type === 'spike'), msg: m.hidden ? '' : m.textContent };
}, { N, x }); };
for (const x of [50.5, 49.45, 51.55]) { const r = await bigz(x); check(`big zapper at x ${x}: Ouch`, r.hit && r.msg === 'Ouch! A zapper sent you back to the start.', r); }
await load();
const edge = await page.evaluate(() => { const g = window.__game; g.clearEvents(); g.teleport({ x: 50.5, z: 21.4 }); g.step(5); return { hit: g.events.some((e) => e.type === 'spike') }; });
check('standing next to the big zapper is safe', !edge.hit, edge);

// views
const view = async (name, x, z, yaw) => { await load(); await page.evaluate(({ x, z, yaw }) => { const g = window.__game; g.teleport({ x, z, yaw }); g.step(2); g.render(); }, { x, z, yaw }); await shot(name); };
await view('bigzap', 50.5, 26.5, N);
await view('pathzap', sp.x + 8, sp.z, W);
await view('start', st0.start.x, st0.start.z, E);

// finale door
const finish = () => page.evaluate(() => {
    const g = window.__game; const d = g.state().door; g.teleport({ x: d.x - 2.5, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); g.step(40); g.clearInput(); g.render();
    return { title: document.getElementById('finish-title').textContent, buttons: [...document.querySelectorAll('#menu-finish .item, #menu-finish button')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim()) };
});
await load();
await page.evaluate(() => { const g = window.__game; const d = g.state().door; g.teleport({ x: d.x - 6, z: d.z, yaw: -Math.PI / 2 }); g.step(2); g.render(); });
await shot('door-golden');
const fin = await finish();
await shot('finish');
const fx = await page.evaluate(() => ({ confetti: document.querySelectorAll('.confetti, #confetti *').length, note: !document.getElementById('finish-note').hidden }));
check('L90 door: You beat Robot Factory World! + note + Quit only', fin.title === 'You beat Robot Factory World!' && fx.note && fin.buttons.join('|') === 'Quit', { fin, fx });
await load(89);
const f89 = await finish();
check('L89 door: Start Level 90', f89.title === 'You did it!' && f89.buttons.some((b) => /Start Level 90/.test(b)), f89);
console.log('errors', errors);
console.log(results.every(Boolean) && !errors.length ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
