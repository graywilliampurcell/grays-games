// Level 139 checks (vite preview on 9173)
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
await page.goto(BASE + '/?test=1&level=139', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
await page.keyboard.press('Shift');
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 900)); };
const shot = (name) => page.screenshot({ path: `${SP}l140-${name}.png`, timeout: 180000 });
const ONLY = process.env.ONLY;
let r;
let st = await page.evaluate(() => window.__game.restore());
const TS = st.trampolines, F = st.fogs[0], Y = st.spikeRows[0];
check('Level 140 loads: 2 winds, 1 fog, 1 propeller, 1 big spike, 2 trampolines, 2 rainbows, no path/sneaky spike, golden door',
    st.level.name === 'Level 140' && st.winds.length === 2 && st.fogs.length === 1 && st.propellers.length === 1 && st.spikeRows.length === 1 && TS.length === 2 && st.platforms.length === 2 && st.platforms.every((p) => !!p.rainbow) && !st.spike && !st.spike2 && st.vents.length === 0 && (await page.evaluate(() => window.__game.maze().golden === true)),
    { w: st.winds.map((w) => w.dir), f: st.fogs.length, pr: st.propellers.length, rows: st.spikeRows.length, TS: TS.length, plat: st.platforms.length, spike: st.spike });
check('tune skyfinale', (await page.evaluate(() => window.__sound?.tuneName)) === 'skyfinale', {});
const yawOf = (d) => Math.atan2(-d.x, -d.z);
const P = st.propellers[0];
console.log('propeller', JSON.stringify(P), 'start', JSON.stringify(st.pos));
const yawToDoor = P.alongX ? (P.center.x > P.target.x ? -Math.PI / 2 : Math.PI / 2) : (P.center.z > P.target.z ? Math.PI : 0);
r = await page.evaluate(() => { const g = window.__game; g.restore(); const a0 = g.state().propellers[0].angle; g.step(480); return { a0, a2: g.state().propellers[0].angle }; });
check('one full turn every 8 s', Math.abs(r.a2 - r.a0) < 0.01, r);
const through = (wait) => page.evaluate(([P, wait, yaw]) => {
    const g = window.__game;
    g.restore();
    g.teleport({ x: P.target.x, z: P.target.z, yaw });
    if (wait < 0) { const want = -wait; for (let k = 0; k < 600; k++) { const a = g.state().propellers[0].angle; const d = ((want - a) % Math.PI + Math.PI) % Math.PI; if (d < 0.02) break; g.step(1); } } else g.step(wait);
    g.clearEvents();
    g.setInput({ forward: true });
    let s;
    for (let k = 0; k < 75; k++) s = g.step(1);
    g.clearInput();
    return { pos: s.pos, ev: g.events.map((e) => e.type).filter((t) => ['propellerPush', 'spike', 'fall'].includes(t)), msg: g.text() };
}, [P, wait, yawToDoor]);
const past = (pos) => (P.alongX ? Math.sign(pos.x - P.center.x) === Math.sign(P.center.x - P.target.x) && Math.abs(pos.x - P.center.x) > 2 : Math.sign(pos.z - P.center.z) === Math.sign(P.center.z - P.target.z) && Math.abs(pos.z - P.center.z) > 2);
r = await through(1);
check('propeller: walk through while open', r.ev.length === 0 && past(r.pos), r);
r = await through(-(2 * Math.PI - 0.45));
check('propeller: walk into a blade = pushed back, no Ouch', r.ev.includes('propellerPush') && !r.ev.includes('spike') && !past(r.pos), r);
r = await page.evaluate((P) => {
    const g = window.__game; g.restore(); g.teleport({ x: P.center.x, z: P.center.z, yaw: 0 }); g.clearEvents();
    let s; for (let k = 0; k < 600; k++) s = g.step(1);
    return { pos: s.pos, ev: g.events.map((e) => e.type).filter((x) => ['propellerPush', 'spike', 'fall'].includes(x)) };
}, P);
check('propeller: standing under it, pushed to Q', r.ev.includes('propellerPush') && !r.ev.includes('spike') && Math.hypot(r.pos.x - P.target.x, r.pos.z - P.target.z) < 0.6, r);
// Wind
const walk = (pose, secs) => page.evaluate(([pose, secs]) => {
    const g = window.__game; g.restore(); g.teleport(pose); g.clearEvents(); g.setInput({ forward: true });
    const ps = []; for (let k = 0; k < secs * 60; k++) ps.push(g.step(1).pos); g.clearInput();
    const a = ps.at(-31), b = ps.at(-1); return { v: Math.hypot(b.x - a.x, b.z - a.z) / 0.5, bad: g.events.some((e) => ['spike', 'fall'].includes(e.type)) };
}, [pose, secs]);
const vOpen = (await walk({ x: st.pos.x, z: st.pos.z, yaw: -Math.PI / 2 }, 1)).v;

for (const [n, W] of st.winds.entries()) {
    const cx = (W.minX + W.maxX) / 2, cz = (W.minZ + W.maxZ) / 2;
    const d = W.dir;
    // into the wind: start at the downwind end, walk against it; with: start upwind end
    const intoPose = d.x ? { x: d.x < 0 ? W.minX + 0.6 : W.maxX - 0.6, z: cz, yaw: yawOf({ x: -d.x, z: 0 }) } : { x: cx, z: d.z < 0 ? W.minZ + 0.6 : W.maxZ - 0.6, yaw: yawOf({ x: 0, z: -d.z }) };
    const withPose = d.x ? { x: d.x < 0 ? W.maxX - 0.6 : W.minX + 0.6, z: cz, yaw: yawOf(d) } : { x: cx, z: d.z < 0 ? W.maxZ - 0.6 : W.minZ + 0.6, yaw: yawOf(d) };
    const into = await walk(intoPose, 1.2);
    const withW = await walk(withPose, 1.0);
    check(`wind ${n + 1}: into ~60%, with ~140%, never into a hazard`, Math.abs(into.v / vOpen - 0.6) < 0.04 && Math.abs(withW.v / vOpen - 1.4) < 0.04 && !into.bad && !withW.bad, { into, withW, vOpen, W: { ...W, blocks: undefined } });
    r = await page.evaluate(([cx, cz]) => { const g = window.__game; g.restore(); g.teleport({ x: cx, z: cz, yaw: 0 }); const a = g.state().pos; g.step(120); const b = g.state().pos; return { a, b }; }, [cx, cz]);
    check(`wind ${n + 1}: standing still is not moved`, Math.hypot(r.a.x - r.b.x, r.a.z - r.b.z) < 0.01, r);
}

for (const [n, T] of TS.entries()) {
    r = await page.evaluate(([T, yaw]) => {
        const g = window.__game; g.restore(); g.teleport({ x: T.center.x - 4 * T.dir.x, z: T.center.z - 4 * T.dir.z, yaw }); g.clearEvents(); g.setInput({ forward: true });
        let s, t0 = null, t1 = null, view = null, others = null;
        for (let k = 0; k < 400; k++) {
            s = g.step(1); const ev = g.events.map((e) => e.type + ':' + (e.what ?? ''));
            if (t0 === null && ev.includes('trampoline:bounce')) { t0 = s.t; g.clearInput(); }
            if (t0 !== null && view === null && s.t - t0 > 0.7) { const tr = g.state().trampolines; view = tr.map((x) => x.view); }
            if (t0 !== null && ev.includes('trampoline:land')) { t1 = s.t; break; }
        }
        const after = g.step(10);
        return { time: t1 - t0, view, end: s.pos, yaw: s.yaw, afterView: g.state().trampolines.map((x) => x.view), spike: g.events.some((e) => e.type === 'spike'), fell: g.events.some((e) => e.type === 'fall') };
    }, [T, yawOf(T.dir)]);
    const dy = Math.atan2(Math.sin(r.yaw - yawOf(T.dir)), Math.cos(r.yaw - yawOf(T.dir)));
    check(`trampoline ${n + 1}: ~1.5 s bounce, lands at landing facing on, only it in view, back to normal`, Math.abs(r.time - 1.5) < 0.05 && Math.abs(r.end.x - T.landing.x) < 0.05 && Math.abs(r.end.z - T.landing.z) < 0.05 && Math.abs(dy) < 0.02 && r.view?.[n] === true && r.view?.[1 - n] === false && r.afterView.every((v) => v === false) && !r.spike && !r.fell, { r, T });
    r = await page.evaluate(([T, yaw]) => {
        const g = window.__game; g.restore(); g.teleport({ x: T.landing.x, z: T.landing.z, yaw }); g.clearEvents(); g.setInput({ forward: true });
        let s; for (let k = 0; k < 120; k++) s = g.step(1); g.clearInput();
        return { pos: s.pos, bounced: g.events.some((e) => e.type === 'trampoline') };
    }, [T, yawOf({ x: -T.dir.x, z: -T.dir.z })]);
    const back = (r.pos.x - T.landing.x) * -T.dir.x + (r.pos.z - T.landing.z) * -T.dir.z;
    check(`trampoline ${n + 1}: one way only from the landing side`, !r.bounced && back < 2.6, { r, back });
}

// Fog: walk along it in its direction
r = await page.evaluate((F) => {
    const g = window.__game; g.restore();
    const along = F.alongX; const mid = along ? (F.minZ + F.maxZ) / 2 : (F.minX + F.maxX) / 2;
    g.teleport(along ? { x: F.minX - 3, z: mid, yaw: -Math.PI / 2 } : { x: mid, z: F.minZ - 3, yaw: Math.PI }); g.clearEvents(); g.setInput({ forward: true });
    const trace = []; let s;
    for (let k = 0; k < 150; k++) { s = g.step(1); trace.push([Math.round((along ? s.pos.x : s.pos.z) * 10) / 10, g.state().fogView]); }
    g.clearInput(); return { trace, spike: g.events.some((e) => e.type === 'spike'), end: s.pos };
}, F);
const lo = F.alongX ? F.minX : F.minZ, hi = F.alongX ? F.maxX : F.maxZ;
const inside = r.trace.filter(([x]) => x > lo + 2 && x < hi - 2);
const after = r.trace.filter(([x]) => x > hi + 1.5);
check('outside the fog: clear', r.trace[0][1] === 0, r.trace[0]);
check('deep in the fog: full fog', inside.length > 5 && inside.every(([, v]) => v === 1), inside.slice(0, 3));
check('fog opens again after', after.length > 0 && after.at(-1)[1] === 0, after.slice(-2));

r = await page.evaluate(() => { const g = window.__game; g.restore(); const seq = []; for (let k = 0; k < 64; k++) { const s = g.step(15); seq.push(s.platforms.map((p) => p.rainbow.phase[0]).join('')); } return seq.join(' '); });
console.log('phase pairs every 0.25 s', r);
check('two rainbows on their own cycles', r.includes('sg') && r.includes('gs'), {});
for (const n of [0, 1]) {
    const G = st.platforms[n].gap; const ax = (G.maxX - G.minX) > (G.maxZ - G.minZ);
    // crossing direction: rainbow 1 heading east (+x), rainbow 2 heading south (+z)
    const cross = (waitGone) => page.evaluate(([G, ax, n, waitGone]) => {
        const g = window.__game; g.restore();
        g.teleport(ax ? { x: G.minX - 1.5, z: (G.minZ + G.maxZ) / 2, yaw: -Math.PI / 2 } : { x: (G.minX + G.maxX) / 2, z: G.minZ - 1.5, yaw: Math.PI });
        let s = g.step(1);
        while (s.platforms[n].rainbow.phase !== 'gone') s = g.step(1);
        if (!waitGone) while (s.platforms[n].rainbow.phase === 'gone') s = g.step(1);
        g.clearEvents(); g.setInput({ forward: true });
        for (let k = 0; k < 200; k++) { s = g.step(1); if ((ax ? s.pos.x > G.maxX + 1.5 : s.pos.z > G.maxZ + 1.5) || g.events.some((e) => e.type === 'fall')) break; }
        g.clearInput(); g.step(10);
        return { pos: s.pos, ev: g.events.map((e) => e.type).filter((t) => ['fall', 'spike'].includes(t)), msg: g.text() };
    }, [G, ax, n, waitGone]);
    r = await cross(false);
    check(`rainbow ${n + 1}: cross when solid`, r.ev.length === 0 && (ax ? r.pos.x > G.maxX + 1 : r.pos.z > G.maxZ + 1), r);
    r = await cross(true);
    check(`rainbow ${n + 1}: gone = fall off the island`, r.ev.includes('fall'), r);
}
console.log('big', JSON.stringify(Y));
const into = (pose) => page.evaluate((pose) => {
    const g = window.__game; g.restore(); g.teleport(pose); g.clearEvents(); g.setInput({ forward: true });
    let s; for (let k = 0; k < 90; k++) { s = g.step(1); if (g.events.some((e) => e.type === 'spike')) break; } g.clearInput();
    return { spike: g.events.some((e) => e.type === 'spike'), msg: g.text(), pos: s.pos };
}, pose);
const yx = Y.position?.x ?? Y.x, yz = Y.position?.z ?? Y.z;
r = await into({ x: yx - 2.5, z: yz, yaw: -Math.PI / 2 });
const r2 = await into({ x: yx + 2.5, z: yz, yaw: Math.PI / 2 });
check('big storm cloud: Ouch', (r.spike || r2.spike) && JSON.stringify([r.msg, r2.msg]).includes('storm cloud'), { r, r2 });

const pose = async (name, p, n = 30) => { await page.evaluate(([p, n]) => { const g = window.__game; g.restore(); g.teleport(p); g.step(n); }, [p, n]); await shot(name); };
await pose('start', { yaw: -Math.PI / 2 }, 1);
for (const [n, T] of TS.entries()) await pose(`tramp${n + 1}`, { x: T.center.x - 5.5 * T.dir.x, z: T.center.z - 5.5 * T.dir.z, yaw: yawOf(T.dir) }, 2);
await pose('big', { x: yx + 3.5, z: yz, yaw: Math.PI / 2 }, 2);
await pose('prop', { x: P.center.x - 4, z: P.center.z, yaw: -Math.PI / 2 }, 10);
    const fin = await page.evaluate(() => {
        const g = window.__game;
        g.restore();
        const calls = [];
        const orig = window.__sound.cheer.bind(window.__sound);
        window.__sound.cheer = (o) => { calls.push(o); return orig(o); };
        const d = g.maze().doorPosition;
        g.teleport({ x: d.x - 1.8, z: d.z, yaw: -Math.PI / 2 });
        g.clearEvents();
        g.setInput({ forward: true });
        let s;
        for (let i = 0; i < 40; i++) { s = g.step(2); if (s.escaped) break; }
        g.clearInput();
        g.step(30);
        const vis = (id) => { const el = document.getElementById(id); return !!el && !el.hidden && !el.closest('[hidden]'); };
        const next = document.querySelector('#menu-finish [data-act=next-level], [data-act=next-level]');
        const items = [...document.querySelectorAll('#menu-finish .item')].filter((e) => !e.hidden).map((e) => e.textContent);
        return { escaped: s.escaped, calls, ev: [...new Set(g.events.map((e) => e.type))], title: document.getElementById('finish-title').textContent,
            note: vis('finish-note') ? document.getElementById('finish-note').textContent : null, next: !!next && !next.hidden, items };
    });
    check('finale: golden door, confetti, extra-long cheer, You beat Sky World!, More levels coming soon!, Quit only',
        fin.escaped && fin.ev.some((e) => e.startsWith('confetti')) && fin.calls.some((c) => c?.long) && fin.title === 'You beat Sky World!' && ((/More levels coming soon/.test(fin.note ?? '') && !fin.next && fin.items.length === 1 && /Quit/.test(fin.items[0])) || fin.items.some((x) => /Start [A-Z][a-zA-Z ]* World/.test(x))), fin);

check('finale: golden door, confetti, extra-long cheer, You beat Sky World!, More levels coming soon!, Quit only',
    fin.escaped && fin.ev.some((e) => e.startsWith('confetti')) && fin.calls.some((c) => c?.long) && fin.title === 'You beat Sky World!' && ((/More levels coming soon/.test(fin.note ?? '') && !fin.next && fin.items.length === 1 && /Quit/.test(fin.items[0])) || fin.items.some((x) => /Start [A-Z][a-zA-Z ]* World/.test(x))), fin);
await page.waitForTimeout(1500);
await shot('finale');
const page2 = await ctx.newPage();
page2.on('pageerror', (e) => errors.push(String(e)));
await page2.goto(BASE + '/?test=1&level=138', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page2.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
r = await page2.evaluate(() => {
    const g = window.__game; const d = g.maze().doorPosition;
    g.teleport({ x: d.x - 1.8, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true });
    let s; for (let i = 0; i < 40; i++) { s = g.step(2); if (s.escaped) break; } g.clearInput(); g.step(30);
    const items = [...document.querySelectorAll('#menu-finish .item')].filter((e) => !e.hidden).map((e) => e.textContent);
    return { escaped: s.escaped, items };
});
check('Level 139 door: Start Level 140', r.escaped && r.items[0] === 'Start Level 140', r);
check('no page errors', errors.length === 0, errors);
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
