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
await page.goto(BASE + '/?test=1&level=138', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
await page.keyboard.press('Shift');
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 900)); };
const shot = (name) => page.screenshot({ path: `${SP}l139-${name}.png`, timeout: 180000 });
const ONLY = process.env.ONLY;
let r;
let st = await page.evaluate(() => window.__game.restore());
check('Level 139 loads: one propeller, two rainbows, two winds (north + west), one path spike r0.7, nothing else',
    st.level.name === 'Level 139' && st.propellers.length === 1 && st.platforms.length === 2 && st.platforms.every((p) => !!p.rainbow) && st.winds.length === 2 && st.winds.some((w) => w.dir.z === -1) && st.winds.some((w) => w.dir.x === -1) && !!st.spike && !st.spike2 && st.spikeRows.length === 0 && st.fogs.length === 0 && (st.trampolines ?? []).length === 0 && st.vents.length === 0,
    { pr: st.propellers.length, w: st.winds.map((w) => w.dir), plat: st.platforms.length, spike: st.spike, rows: st.spikeRows.length });
check('tune skytworainbows', (await page.evaluate(() => window.__sound?.tuneName)) === 'skytworainbows', {});
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
const yawOf = (d) => d.x === 1 ? -Math.PI / 2 : d.x === -1 ? Math.PI / 2 : d.z === 1 ? Math.PI : 0;
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
// Rainbows: both crossed heading west (-x)
for (const n of [0, 1]) {
    const G = st.platforms[n].gap;
    const gz = (G.minZ + G.maxZ) / 2;
    const cross = (waitGone) => page.evaluate(([G, gz, n, waitGone]) => {
        const g = window.__game; g.restore();
        g.teleport({ x: G.maxX + 1.5, z: gz, yaw: Math.PI / 2 });
        let s = g.step(1);
        while (s.platforms[n].rainbow.phase !== 'gone') s = g.step(1);
        if (!waitGone) while (s.platforms[n].rainbow.phase === 'gone') s = g.step(1);
        g.clearEvents(); g.setInput({ forward: true });
        for (let k = 0; k < 200; k++) { s = g.step(1); if (s.pos.x < G.minX - 1.5 || g.events.some((e) => e.type === 'fall')) break; }
        g.clearInput(); g.step(10);
        return { pos: s.pos, ev: g.events.map((e) => e.type).filter((t) => ['fall', 'spike'].includes(t)), msg: g.text(), phase: s.platforms[n].rainbow.phase };
    }, [G, gz, n, waitGone]);
    r = await cross(false);
    check(`rainbow ${n + 1}: cross when solid`, r.ev.length === 0 && r.pos.x < G.minX - 1, r);
    r = await cross(true);
    check(`rainbow ${n + 1}: gone = fall off the island`, r.ev.includes('fall') && JSON.stringify(r.msg).includes('fell off the island'), r);
}
r = await page.evaluate(() => { const g = window.__game; g.restore(); g.step(1); const a = g.state().platforms.map((p) => p.rainbow.phase + p.rainbow.time.toFixed(2)); return a; }).catch((e) => String(e));
console.log('rainbow phases at start', JSON.stringify(r));
r = await page.evaluate(() => { const g = window.__game; g.restore(); const seq = []; for (let k = 0; k < 16 * 4; k++) { const s = g.step(15); seq.push(s.platforms.map((p) => p.rainbow.phase[0]).join('')); } return seq.join(' '); });
console.log('phase pairs every 0.25 s', r);
check('two rainbows on their own cycles (not in step)', r.includes('sg') && r.includes('gs'), {});
// Path spike, heading south (+z), squeeze on both sides (offsets in x)
const sp = st.spike;
const pass = (off) => page.evaluate(([sp, off]) => {
    const g = window.__game; g.restore(); g.teleport({ x: sp.x + off, z: sp.z - 2.5, yaw: Math.PI }); g.clearEvents(); g.setInput({ forward: true });
    let s; for (let k = 0; k < 120; k++) { s = g.step(1); if (s.pos.z > sp.z + 2 || g.events.some((e) => e.type === 'spike')) break; }
    g.clearInput(); return { pos: s.pos, spike: g.events.some((e) => e.type === 'spike'), msg: g.text() };
}, [sp, off]);
const band = [];
for (const off of [0.85, 0.9, 0.95, 1.0, 1.05]) { const q = await pass(off), q2 = await pass(-off); band.push([off, !q.spike && q.pos.z > sp.z + 2, !q2.spike && q2.pos.z > sp.z + 2]); }
console.log('band', JSON.stringify(band));
r = await pass(1.0); check('squeeze past one side', !r.spike && r.pos.z > sp.z + 2, r);
r = await pass(-1.0); check('squeeze past other side', !r.spike && r.pos.z > sp.z + 2, r);
r = await pass(0.4); check('walk into it: storm cloud Ouch', r.spike && JSON.stringify(r.msg).includes('storm cloud'), r);
// Screenshots
const pose = async (name, p, n = 30, angle) => { await page.evaluate(([p, n, angle]) => { const g = window.__game; g.restore(); g.teleport(p); g.step(n); if (angle !== undefined) { g.maze().propellers[0].angle = angle; g.maze().placePropeller(g.maze().propellers[0]); } }, [p, n, angle]); await shot(name); };
const back = (d) => P.alongX ? { x: P.center.x + Math.sign(P.target.x - P.center.x) * d, z: P.center.z } : { x: P.center.x, z: P.center.z + Math.sign(P.target.z - P.center.z) * d };
await pose('prop-near', { ...back(3), yaw: yawToDoor }, 10, 0.4);
await pose('prop-far', { ...back(7), yaw: yawToDoor }, 10, Math.PI / 2);
const W0 = st.winds.find((w) => w.dir.z === -1), W1 = st.winds.find((w) => w.dir.x === -1);
await pose('wind1', { x: (W0.minX + W0.maxX) / 2, z: W0.minZ - 2, yaw: Math.PI });
await pose('wind2', { x: W1.minX - 2, z: (W1.minZ + W1.maxZ) / 2, yaw: -Math.PI / 2 });
for (const n of [0, 1]) { const G = st.platforms[n].gap; await pose('rainbow' + (n + 1), { x: G.maxX + 3, z: (G.minZ + G.maxZ) / 2, yaw: Math.PI / 2 }, 10); }
await pose('spike', { x: sp.x, z: sp.z - 3.5, yaw: Math.PI }, 2);
await pose('start', { yaw: -Math.PI / 2 }, 1);
r = await page.evaluate(() => {
    const g = window.__game; g.restore();
    const d = g.maze().doorPosition;
    g.teleport({ x: d.x - 1.8, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true });
    let s; for (let i = 0; i < 40; i++) { s = g.step(2); if (s.escaped) break; } g.clearInput(); g.step(30);
    return { escaped: s.escaped, text: g.text() };
});
check('door: escape, More levels coming soon!', r.escaped && JSON.stringify(r.text).match(/More levels coming soon|Start (Level [0-9]+|[A-Z][a-zA-Z ]* World)/) !== null, r);
const page2 = await ctx.newPage();
page2.on('pageerror', (e) => errors.push(String(e)));
await page2.goto(BASE + '/?test=1&level=137', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page2.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
r = await page2.evaluate(() => {
    const g = window.__game; const d = g.maze().doorPosition;
    g.teleport({ x: d.x - 1.8, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true });
    let s; for (let i = 0; i < 40; i++) { s = g.step(2); if (s.escaped) break; } g.clearInput(); g.step(30);
    const items = [...document.querySelectorAll('#menu-finish .item')].filter((e) => !e.hidden).map((e) => e.textContent);
    return { escaped: s.escaped, items };
});
check('Level 138 door: Start Level 139', r.escaped && r.items[0] === 'Start Level 139', r);
check('no page errors', errors.length === 0, errors);
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
