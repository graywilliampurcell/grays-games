// Level 135 checks (vite preview on 9173)
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
await page.goto(BASE + '/?test=1&level=134', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
await page.keyboard.press('Shift');
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 900)); };
const shot = (name) => page.screenshot({ path: `${SP}l135-${name}.png`, timeout: 180000 });
const ONLY = process.env.ONLY;
let r;
let st = await page.evaluate(() => window.__game.restore());
check('Level 135 loads: one propeller, one rainbow, the sneaky spike, nothing else',
    st.level.name === 'Level 135' && st.propellers.length === 1 && st.platforms.length === 1 && !!st.platforms[0].rainbow && !!st.spike && !st.spike2 && st.spikeRows.length === 0 && st.winds.length === 0 && st.fogs.length === 0 && !st.trampoline && st.vents.length === 0 && st.tails.length === 0,
    { pr: st.propellers, spike: st.spike });
const P = st.propellers[0];
console.log('propeller', JSON.stringify(P));
check('tune skypropeller', (await page.evaluate(() => window.__sound?.tuneName)) === 'skypropeller', {});
const px = P.center.x, pz = P.center.z;
// Turn time: the angle after 8 s is back where it started
r = await page.evaluate(() => { const g = window.__game; g.restore(); const a0 = g.state().propellers[0].angle; g.step(240); const a1 = g.state().propellers[0].angle; g.step(240); return { a0, a1, a2: g.state().propellers[0].angle }; });
check('one full turn every 8 s', Math.abs(r.a2 - r.a0) < 0.01 && Math.abs(Math.abs(r.a1 - r.a0) - Math.PI) < 0.01, r);
// Open time: over one turn, how long a standing player in the middle (and at the sides) is clear
r = await page.evaluate(([px, pz]) => {
    const m = window.__game.maze();
    const p = m.propellers[0];
    const saved = p.angle;
    const out = {};
    for (const off of [0, 0.6, 1.0]) {
        let clear = 0, best = 0, run = 0;
        const N = 4800; // 2 turns
        for (let k = 0; k < N; k++) {
            p.angle = (k / 2400) * 2 * Math.PI;
            const t = m.propellerTouches(p, { x: px + (p.alongX ? 0 : off), z: pz + (p.alongX ? off : 0) }, 0.4, 1.8);
            if (!t) { clear++; run++; best = Math.max(best, run); } else run = 0;
        }
        out[off] = { clearShare: clear / N, longestOpen: (best / 2400) * 8 };
    }
    p.angle = saved;
    return out;
}, [px, pz]);
check('floor gap open long enough (> 1.5 s in the middle)', r[0].longestOpen > 1.5, r);
const OPEN = r;
// Walk through while it's open: from Q, start walking when the blades are level
const through = (wait) => page.evaluate(([P, wait]) => {
    const g = window.__game;
    g.restore();
    g.teleport({ x: P.target.x, z: P.target.z, yaw: P.alongX ? (P.center.x > P.target.x ? -Math.PI / 2 : Math.PI / 2) : (P.center.z > P.target.z ? Math.PI : 0) });
    if (wait < 0) { const want = -wait; for (let k = 0; k < 600; k++) { const a = g.state().propellers[0].angle; const d = ((want - a) % Math.PI + Math.PI) % Math.PI; if (d < 0.02) break; g.step(1); } } else g.step(wait);
    const a = g.state().propellers[0].angle;
    g.clearEvents();
    g.setInput({ forward: true });
    let s;
    for (let k = 0; k < 75; k++) s = g.step(1);
    g.clearInput();
    return { a, pos: s.pos, ev: g.events.map((e) => e.type).filter((t) => ['propellerPush', 'spike', 'fall'].includes(t)), msg: g.text() };
}, [P, wait]);
r = await through(1);
const past = (pos) => (P.alongX ? Math.sign(pos.x - P.center.x) === Math.sign(P.center.x - P.target.x) && Math.abs(pos.x - P.center.x) > 2 : Math.sign(pos.z - P.center.z) === Math.sign(P.center.z - P.target.z) && Math.abs(pos.z - P.center.z) > 2);
check('walk through while open: no push, out the far side', r.ev.length === 0 && past(r.pos), r);
// Walk in when a blade is coming down: pushed back to Q (not an Ouch)
// the first blade reaches straight down at angle 2pi (start pi/2): 6 s; start walking at ~5.5 s
r = await through(-(2 * Math.PI - 0.45));
check('walk into a blade: pushed back one square, not an Ouch', r.ev.includes('propellerPush') && !r.ev.includes('spike') && !past(r.pos), r);
// Standing in the propeller's plane: a blade comes and pushes you to Q
r = await page.evaluate((P) => {
    const g = window.__game;
    g.restore();
    g.teleport({ x: P.center.x, z: P.center.z, yaw: 0 });
    g.clearEvents();
    let s, t = null;
    for (let k = 0; k < 600; k++) { s = g.step(1); if (t === null && g.events.some((e) => e.type === 'propellerPush')) t = g.time(); }
    return { t, pos: s.pos, ev: g.events.map((e) => e.type).filter((x) => ['propellerPush', 'spike', 'fall'].includes(x)), msg: g.text() };
}, P);
const atQ = Math.hypot(r.pos.x - P.target.x, r.pos.z - P.target.z) < 0.6;
check('standing under it: a blade pushes you to Q (one square back), no Ouch, no message of falling', r.t !== null && atQ && !r.ev.includes('spike') && !r.ev.includes('fall'), r);
// Pause freezes the turning
if (!ONLY || ONLY === 'pause') {
    const ang = () => page.evaluate(() => window.__game.state().propellers[0].angle);
    await page.evaluate(() => { window.__game.restore(); window.__game.step(10); });
    await page.keyboard.press('Space');
    await page.evaluate(() => window.__game.setRealtime(true));
    const a0 = await ang();
    await page.waitForTimeout(1500);
    const a1 = await ang();
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);
    const a2 = await ang();
    await page.evaluate(() => window.__game.setRealtime(false));
    check('pause freezes the propeller (and it turns again after)', Math.abs(a1 - a0) < 0.001 && a2 !== a1, { a0, a1, a2 });
}
// Sneaky storm cloud
r = await page.evaluate((spike) => {
    const g = window.__game;
    const out = [];
    for (const [dx, dz, yaw] of [[1.08, 0, Math.PI / 2], [-1.08, 0, -Math.PI / 2], [0, 1.08, 0], [0, -1.08, Math.PI]]) {
        g.restore();
        g.teleport({ x: spike.x + dx, z: spike.z + dz, yaw });
        g.clearEvents();
        g.setInput({ forward: true });
        for (let k = 0; k < 60 && !g.events.some((e) => e.type === 'spike'); k++) g.step(1);
        g.clearInput();
        if (g.events.some((e) => e.type === 'spike')) return { spike: true, msg: g.text() };
        out.push(g.state().pos);
    }
    return { spike: false, out };
}, st.spike);
check('sneaky storm cloud: Ouch', r.spike && JSON.stringify(r.msg).includes('storm cloud'), r);
// Rainbow: cross it when solid
const G = st.platforms[0].gap;
const gx = (G.minX + G.maxX) / 2;
r = await page.evaluate(([G, gx]) => {
    const g = window.__game;
    g.restore();
    g.teleport({ x: gx, z: G.minZ - 1.5, yaw: Math.PI });
    let s = g.step(1);
    while (s.platforms[0].rainbow.phase !== 'gone') s = g.step(1);
    while (s.platforms[0].rainbow.phase === 'gone') s = g.step(1);
    g.clearEvents();
    g.setInput({ forward: true });
    for (let k = 0; k < 200; k++) { s = g.step(1); if (s.pos.z > G.maxZ + 1.5 || g.events.some((e) => e.type === 'fall')) break; }
    g.clearInput();
    return { pos: s.pos, ev: g.events.map((e) => e.type).filter((t) => ['fall', 'spike'].includes(t)) };
}, [G, gx]);
check('rainbow bridge: cross when solid', r.ev.length === 0 && r.pos.z > G.maxZ + 1, r);
r = await page.evaluate(([G, gx]) => {
    const g = window.__game;
    g.restore();
    g.teleport({ x: gx, z: G.minZ - 1.5, yaw: Math.PI });
    let s = g.step(1);
    while (s.platforms[0].rainbow.phase !== 'gone') s = g.step(1);
    g.clearEvents();
    g.setInput({ forward: true });
    for (let k = 0; k < 120; k++) { s = g.step(1); if (g.events.some((e) => e.type === 'fall')) break; }
    g.clearInput();
    g.step(200);
    return { ev: g.events.map((e) => e.type), msg: g.text() };
}, [G, gx]);
check('rainbow gone: fall off the island', r.ev.includes('fall') && JSON.stringify(r.msg).includes('fell off the island'), r);
// Screenshots
const yawToDoor = P.alongX ? (P.center.x > P.target.x ? -Math.PI / 2 : Math.PI / 2) : (P.center.z > P.target.z ? Math.PI : 0);
const poseAt = async (name, p, n = 30, angle) => {
    await page.evaluate(([p, n, angle]) => { const g = window.__game; g.restore(); g.teleport(p); g.step(n); if (angle !== undefined) { g.maze().propellers[0].angle = angle; g.maze().placePropeller(g.maze().propellers[0]); } g.render?.(); }, [p, n, angle]);
    await shot(name);
};
const back = (d) => P.alongX ? { x: P.center.x + Math.sign(P.target.x - P.center.x) * d, z: P.center.z } : { x: P.center.x, z: P.center.z + Math.sign(P.target.z - P.center.z) * d };
const fwd = (d) => back(-d);
await poseAt('prop-far', { ...back(9), yaw: yawToDoor }, 10, 0.5);
await poseAt('prop-near-open', { ...back(3), yaw: yawToDoor }, 10, Math.PI / 2);
await poseAt('prop-near-down', { ...back(3), yaw: yawToDoor }, 10, 0.25);
await poseAt('prop-near-side', { ...back(3), yaw: yawToDoor }, 10, 0.9);
await poseAt('prop-behind', { ...fwd(4), yaw: yawToDoor + Math.PI }, 10, 2.4);
await poseAt('rainbow', { x: gx, z: G.minZ - 3, yaw: Math.PI }, 10);
await poseAt('spike', { x: st.spike.x + (st.spike.x < 6 ? 3 : -3), z: st.spike.z, yaw: st.spike.x < 6 ? Math.PI / 2 : -Math.PI / 2 }, 10);
// Through the door
r = await page.evaluate(() => {
    const g = window.__game; g.restore();
    const d = g.maze().doorPosition;
    g.teleport({ x: d.x - 1.8, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true });
    let s; for (let i = 0; i < 40; i++) { s = g.step(2); if (s.escaped) break; } g.clearInput(); g.step(30);
    return { escaped: s.escaped, text: g.text() };
});
check('door: escape, More levels coming soon!', r.escaped && JSON.stringify(r.text).match(/More levels coming soon|Start (Level [0-9]+|[A-Z][a-zA-Z ]* World)/) !== null, r);
await page.evaluate(() => { const g = window.__game; g.restore(); g.teleport({ yaw: -Math.PI / 2 }); g.step(1); });
await shot('start');
const page2 = await ctx.newPage();
page2.on('pageerror', (e) => errors.push(String(e)));
await page2.goto(BASE + '/?test=1&level=133', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page2.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
r = await page2.evaluate(() => {
    const g = window.__game; const d = g.maze().doorPosition;
    g.teleport({ x: d.x - 1.8, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true });
    let s; for (let i = 0; i < 40; i++) { s = g.step(2); if (s.escaped) break; } g.clearInput(); g.step(30);
    const items = [...document.querySelectorAll('#menu-finish .item')].filter((e) => !e.hidden).map((e) => e.textContent);
    return { escaped: s.escaped, items, props: g.state().propellers.length };
});
check('Level 134 door: Start Level 135 (no propeller in 134)', r.escaped && r.items[0] === 'Start Level 135' && r.props === 0, r);
check('no page errors', errors.length === 0, errors);
console.log('OPEN', JSON.stringify(OPEN));
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
