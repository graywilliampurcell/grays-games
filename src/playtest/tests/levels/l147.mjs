// Level 147 checks (served on 9173)
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
await page.goto(BASE + '/?test=1&level=146', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
await page.keyboard.press('Shift');
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 900)); };
const shot = (name) => page.screenshot({ path: `${SP}l147-${name}.png`, timeout: 180000 });
const ONLY = process.env.ONLY;
let st = await page.evaluate(() => window.__game.restore());
const P = st.platforms;
const F = st.fogs[0];
const row = st.spikeRows[0];
check('Level 147 loads: two trenches, one swarm, one big mushroom, nothing else',
    st.level.name === 'Level 147' && P.length === 2 && P.every((p) => p.trench && !p.cap) && st.fogs.length === 1 && F.swarm && st.spikeRows.length === 1 && !st.spike && !st.spike2 && st.sleepies.length === 0 && (st.fireflies?.length ?? 0) === 0 && st.vents.length === 0 && st.geysers.length === 0 && st.belts.length === 0 && (st.trampolines ?? []).length === 0 && st.winds.length === 0,
    { P: P.map((p) => ({ gap: p.gap, alongX: p.alongX })), F, row });
check('swarm x1-4 z29-40; big mushroom (46.5, 45.5)', F.minX === 1 && F.maxX === 4 && F.minZ === 29 && F.maxZ === 40 && row.x === 46.5 && row.z === 45.5, { F, row });
check('tune mushroomdouble', (await page.evaluate(() => window.__sound?.tuneName)) === 'mushroomdouble', {});
let r;
// Trench runs: p index, start point, yaw, check direction
const trench = (i, a) => page.evaluate(([i, a]) => {
    const g = window.__game;
    g.restore();
    g.teleport(a.from);
    g.clearEvents();
    g.setInput({ forward: true });
    let s;
    const at = {};
    const t0 = g.time();
    for (let k = 0; k < 420; k++) {
        s = g.step(1);
        for (const e of g.events) if (e.type === 'trench' && at[e.what] === undefined) at[e.what] = +(g.time() - t0).toFixed(2);
        if (g.events.some((e) => e.type === 'fall')) break;
        if (at.land !== undefined && g.time() - t0 > at.land + 0.3) break;
    }
    g.clearInput();
    return { at, pos: s.pos, fell: g.events.some((e) => e.type === 'fall'), msg: g.text(), start: s.start };
}, [i, a]);
if (!ONLY || ONLY === 'trench') {
    const A = P.find((p) => p.alongX), B = P.find((p) => !p.alongX);
    check('one trench along x (row 13), one along z (column 4)', !!A && !!B, {});
    const az = (A.gap.minZ + A.gap.maxZ) / 2, bx = (B.gap.minX + B.gap.maxX) / 2;
    const ok = (r) => !r.fell && r.at.drop !== undefined && r.at.bounce !== undefined && r.at.land !== undefined && Math.abs(r.at.land - r.at.bounce - 2.5) < 0.15;
    r = await trench(0, { from: { x: A.gap.minX - 1.5, z: az, yaw: -Math.PI / 2 } });
    check('trench 1 heading east: drop, bounce, bounce, land on the far floor', ok(r) && r.pos.x > A.gap.maxX + 0.5, { r, gap: A.gap });
    r = await trench(0, { from: { x: A.gap.maxX + 1.5, z: az, yaw: Math.PI / 2 } });
    check('trench 1 heading west too', ok(r) && r.pos.x < A.gap.minX - 0.5, { r, gap: A.gap });
    r = await trench(0, { from: { x: A.gap.minX - 1.5, z: az + 1.05, yaw: -Math.PI / 2 } });
    check('trench 1 walk off near the wall: acid, back to the start', r.fell && JSON.stringify(r.msg).includes('acid'), r);
    r = await trench(1, { from: { x: bx, z: B.gap.maxZ + 1.5, yaw: 0 } });
    check('trench 2 heading north: drop, bounce, bounce, land on the far floor', ok(r) && r.pos.z < B.gap.minZ - 0.5, { r, gap: B.gap });
    r = await trench(1, { from: { x: bx, z: B.gap.minZ - 1.5, yaw: Math.PI } });
    check('trench 2 heading south too', ok(r) && r.pos.z > B.gap.maxZ + 0.5, { r, gap: B.gap });
    r = await trench(1, { from: { x: bx - 1.05, z: B.gap.maxZ + 1.5, yaw: 0 } });
    check('trench 2 walk off near the wall: acid', r.fell, r);
    // The two are independent: ride trench 1, then trench 2 straight after
    r = await page.evaluate(() => window.__game.state().platforms.map((p) => p.trench));
    console.log('trench states', JSON.stringify(r).slice(0, 400));
}
const fx = (F.minX + F.maxX) / 2;
if (!ONLY || ONLY === 'swarm') {
    // Walk south through the swarm from just north of it
    r = await page.evaluate(([F, fx]) => {
        const g = window.__game;
        g.restore();
        g.teleport({ x: fx, z: F.minZ - 2, yaw: Math.PI });
        g.clearEvents();
        g.setInput({ forward: true });
        const trace = [];
        let s;
        for (let k = 0; k < 200; k++) { s = g.step(1); const t = g.state(); trace.push([Math.round(t.pos.z * 10) / 10, t.fogView]); }
        g.clearInput();
        return { trace, end: s.pos, ev: g.events.map((e) => e.type).filter((e) => ['spike', 'fall', 'sleepy'].includes(e)) };
    }, [F, fx]);
    const inside = r.trace.filter(([z]) => z > F.minZ + 1.6 && z < F.maxZ - 1.6);
    const after = r.trace.filter(([z]) => z > F.maxZ + 1.5);
    check('outside the swarm: clear', r.trace[0][1] === 0, r.trace[0]);
    check('deep in the swarm: full (see about 1 cell)', inside.length > 5 && inside.every(([, v]) => v === 1), inside.slice(0, 3));
    check('view opens up again after walking out', after.length > 0 && after.at(-1)[1] === 0, after.slice(-2));
    check('swarm is not a danger, walking goes right through', r.ev.length === 0 && r.end.z > F.maxZ + 1, r);
}
if (!ONLY || ONLY === 'big') {
    // The dead end runs south from its opening at z 45; walk in from the north
    for (const off of [0, 0.9, -0.9]) {
        r = await page.evaluate(([row, off]) => {
            const g = window.__game;
            g.restore();
            g.teleport({ x: row.x + off, z: row.z - 3, yaw: Math.PI });
            g.clearEvents();
            g.setInput({ forward: true });
            let s, maxZ = -99;
            for (let k = 0; k < 150; k++) { s = g.step(1); if (g.events.some((e) => e.type === 'spike')) break; maxZ = Math.max(maxZ, s.pos.z); }
            g.clearInput();
            return { ouch: g.events.some((e) => e.type === 'spike'), maxZ, msg: g.text(), pos: g.state().pos, start: g.state().start };
        }, [row, off]);
        check(`walk into the big mushroom ${off} off the middle: Ouch, back to the start, no way past`, r.ouch && r.maxZ < row.z + 1 && Math.hypot(r.pos.x - r.start.x, r.pos.z - r.start.z) < 0.1 && JSON.stringify(r.msg).includes('Ouch'), r);
    }
    // Walking past the opening along the path (row 10, x 41-56) is safe
    r = await page.evaluate(([row]) => { const g = window.__game; g.restore(); g.teleport({ x: row.x - 4, z: row.z - 3, yaw: -Math.PI / 2 }); g.clearEvents(); g.setInput({ forward: true }); g.step(80); g.clearInput(); return { ouch: g.events.some((e) => e.type === 'spike'), pos: g.state().pos }; }, [row]);
    check('walking along the path past its opening: safe', !r.ouch && r.pos.x > row.x + 2, r);
}
if (!ONLY || ONLY === 'shots') {
    const pose = async (name, t) => { await page.evaluate((t) => { const g = window.__game; g.restore(); g.teleport(t); g.step(10); }, t); await page.waitForTimeout(800); await shot(name); };
    const A = P.find((p) => p.alongX), B = P.find((p) => !p.alongX);
    await pose('trench1', { x: A.gap.minX - 3, z: (A.gap.minZ + A.gap.maxZ) / 2, yaw: -Math.PI / 2 });
    await pose('trench2', { x: (B.gap.minX + B.gap.maxX) / 2, z: B.gap.maxZ + 3, yaw: 0 });
    await pose('swarm-near', { x: fx, z: F.minZ - 2, yaw: Math.PI });
    await pose('swarm-inside', { x: fx, z: (F.minZ + F.maxZ) / 2, yaw: Math.PI });
    await pose('big', { x: row.x, z: row.z - 4, yaw: Math.PI });
    await pose('start', { yaw: -Math.PI / 2 });
}
if (!ONLY || ONLY === 'door') {
    r = await page.evaluate(() => {
        const g = window.__game;
        g.restore();
        const d = g.maze().doorPosition;
        g.teleport({ x: d.x - 1.8, z: d.z, yaw: -Math.PI / 2 });
        g.setInput({ forward: true });
        let s;
        for (let i = 0; i < 40; i++) { s = g.step(2); if (s.escaped) break; }
        g.clearInput();
        g.step(30);
        return { escaped: s.escaped, text: g.text() };
    });
    check('door: escape, More levels coming soon!', r.escaped && JSON.stringify(r.text).match(/More levels coming soon|Start (Level [0-9]+|[A-Z][a-zA-Z ]* World)/) !== null, r);
}
check('no page errors', errors.length === 0, errors);
if (!ONLY || ONLY === 'prev') {
    const page2 = await ctx.newPage();
    page2.on('pageerror', (e) => errors.push(String(e)));
    await page2.goto(BASE + '/?test=1&level=145', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page2.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
    r = await page2.evaluate(() => {
        const g = window.__game;
        const d = g.maze().doorPosition;
        g.teleport({ x: d.x - 1.8, z: d.z, yaw: -Math.PI / 2 });
        g.setInput({ forward: true });
        let s;
        for (let i = 0; i < 40; i++) { s = g.step(2); if (s.escaped) break; }
        g.clearInput();
        g.step(30);
        const items = [...document.querySelectorAll('#menu-finish .item')].filter((e) => !e.hidden).map((e) => e.textContent);
        return { escaped: s.escaped, items, sleepies: g.state().sleepies.length };
    });
    check('Level 146 door: You did it! Start Level 147', r.escaped && r.items.some((x) => x.includes('Level 147')), r);
    check('no page errors (prev)', errors.length === 0, errors);
}
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
