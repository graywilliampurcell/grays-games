// Level 149 checks (served on 9173)
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
await page.goto(BASE + '/?test=1&level=148', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
await page.keyboard.press('Shift');
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 900)); };
const shot = (name) => page.screenshot({ path: `${SP}l149-${name}.png`, timeout: 180000 });
const ONLY = process.env.ONLY;
let st = await page.evaluate(() => window.__game.restore());
const P = st.platforms;
const F = st.fogs[0];
const fA = st.fireflies.find((f) => f.x < 10), fB = st.fireflies.find((f) => f.x > 50);
check('Level 149 loads: two fireflies, one swarm, one trench, the sneaky mushroom, nothing else',
    st.level.name === 'Level 149' && st.fireflies.length === 2 && P.length === 1 && P[0].trench && !P[0].cap && st.fogs.length === 1 && F.swarm && !!st.spike && !st.spike2 && st.spikeRows.length === 0 && st.sleepies.length === 0 && st.vents.length === 0 && st.geysers.length === 0 && st.belts.length === 0 && (st.trampolines ?? []).length === 0 && st.winds.length === 0,
    { f: st.fireflies, P: P.map((p) => ({ gap: p.gap, alongX: p.alongX })), F, spike: st.spike });
check('fireflies (2.5,6.5) and (54.5,10.5); trench along x in row 0; swarm column 9; sneaky (6.5,46.5)',
    fA && fB && fA.z === 6.5 && fB.z === 10.5 && P[0].alongX && P[0].gap.minZ < 4 && F.minX === 37 && st.spike.x === 6.5 && st.spike.z === 46.5, { fA, fB, gap: P[0].gap, F, s: st.spike });
check('tune mushroomblinks', (await page.evaluate(() => window.__sound?.tuneName)) === 'mushroomblinks', {});
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
if (!ONLY || ONLY === 'cycle') {
    r = await page.evaluate(() => {
        const g = window.__game;
        g.restore();
        g.teleport({ yaw: -Math.PI / 2 });
        const trace = [];
        for (let k = 0; k < 900; k++) { const s = g.step(1); trace.push([+g.time().toFixed(3), s.fireflies[0].bright, s.fireflies[1].bright]); }
        return trace;
    });
    const both = r.filter(([, a, b]) => a && b).length;
    const dt = (r.at(-1)[0] - r[0][0]) / (r.length - 1);
    const aOn = r.filter(([, a]) => a).length * dt, bOn = r.filter(([, , b]) => b).length * dt;
    const firstOn = (i) => r.find((x) => x[i])?.[0] - r[0][0];
    check('two fireflies out of step: never bright together; each bright about 2 s of every 5 s', both === 0 && Math.abs(aOn / (r.length * dt) - 0.4) < 0.03 && Math.abs(bOn / (r.length * dt) - 0.4) < 0.03, { both, aOn, bOn, total: r.length * dt, firstA: firstOn(1), firstB: firstOn(2) });
}
const FIND = `(g, i, to) => { for (let k = 0; k < 400; k++) { if (g.state().fireflies[i].bright === to) return; g.step(1); } }`;
const stare = (i, f, a) => page.evaluate(([F, i, f, a]) => {
    const g = window.__game;
    const find = eval(F);
    g.restore();
    g.teleport({ x: f.x + a.dx, z: f.z, yaw: a.yaw });
    find(g, i, a.dim ? true : false); find(g, i, a.dim ? false : true);
    g.clearEvents();
    const t0 = g.time();
    let ouchAt = null, maxStare = 0;
    for (let k = 0; k < (a.steps ?? 110); k++) {
        const s = g.step(1);
        maxStare = Math.max(maxStare, s.fireflyStare);
        if (ouchAt === null && g.events.some((e) => e.type === 'spike' && e.what === 'firefly')) ouchAt = +(g.time() - t0).toFixed(2);
    }
    const s = g.state();
    return { ouchAt, maxStare: +maxStare.toFixed(2), pos: s.pos, start: s.start, msg: g.text() };
}, [FIND, i, f, a]);
if (!ONLY || ONLY === 'stare') {
    const iA = st.fireflies.indexOf(st.fireflies.find((f) => f.x < 10)), iB = 1 - iA;
    for (const [i, f, dx, yaw, name] of [[iA, fA, 9, Math.PI / 2, 'first firefly (facing west)'], [iB, fB, -9, -Math.PI / 2, 'second firefly (facing east)']]) {
        r = await stare(i, f, { dx, yaw });
        check(`${name}: face it while bright, Ouch after about 1.0 s, back to the start`, r.ouchAt !== null && r.ouchAt >= 0.96 && r.ouchAt < 1.06 && Math.hypot(r.pos.x - r.start.x, r.pos.z - r.start.z) < 0.1 && JSON.stringify(r.msg).includes('The firefly was too bright'), r);
        r = await stare(i, f, { dx, yaw, dim: true, steps: 170 });
        check(`${name}: face it while dim, safe`, r.ouchAt === null && r.maxStare === 0, r);
        r = await stare(i, f, { dx, yaw: yaw + Math.PI, steps: 115 });
        check(`${name}: back to it while bright, safe`, r.ouchAt === null && r.maxStare === 0, r);
    }
}
if (!ONLY || ONLY === 'trench') {
    const A = P[0];
    const az = (A.gap.minZ + A.gap.maxZ) / 2;
    const ok = (r) => !r.fell && r.at.drop !== undefined && r.at.bounce !== undefined && r.at.land !== undefined && Math.abs(r.at.land - r.at.bounce - 2.5) < 0.15;
    r = await trench(0, { from: { x: A.gap.minX - 1.5, z: az, yaw: -Math.PI / 2 } });
    check('trench heading east: drop, bounce, bounce, land on the far floor', ok(r) && r.pos.x > A.gap.maxX + 0.5, { r, gap: A.gap });
    r = await trench(0, { from: { x: A.gap.maxX + 1.5, z: az, yaw: Math.PI / 2 } });
    check('trench heading west too', ok(r) && r.pos.x < A.gap.minX - 0.5, { r, gap: A.gap });
    r = await trench(0, { from: { x: A.gap.minX - 1.5, z: az + 1.05, yaw: -Math.PI / 2 } });
    check('trench walk off near the wall: acid, back to the start', r.fell && JSON.stringify(r.msg).includes('acid'), r);
}
if (!ONLY || ONLY === 'spike') {
    r = await page.evaluate((spike) => {
        const g = window.__game;
        g.restore();
        g.teleport({ x: spike.x - 3.5, z: spike.z, yaw: -Math.PI / 2 });
        g.clearEvents();
        g.setInput({ forward: true });
        for (let k = 0; k < 120 && !g.events.some((e) => e.type === 'spike'); k++) g.step(1);
        g.clearInput();
        return { spike: g.events.some((e) => e.type === 'spike'), msg: g.text(), pos: g.state().pos, start: g.state().start };
    }, st.spike);
    check('sneaky Ouch mushroom: walk into it, Ouch, back to the start', r.spike && JSON.stringify(r.msg).includes('Ouch') && Math.hypot(r.pos.x - r.start.x, r.pos.z - r.start.z) < 0.1, r);
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
if (!ONLY || ONLY === 'shots') {
    const pose = async (name, t) => { await page.evaluate((t) => { const g = window.__game; g.restore(); g.teleport(t); g.step(10); }, t); await page.waitForTimeout(800); await shot(name); };
    await pose('fireflyA', { x: fA.x + 10, z: fA.z, yaw: Math.PI / 2 });
    await pose('fireflyB', { x: fB.x - 10, z: fB.z, yaw: -Math.PI / 2 });
    await pose('trench', { x: P[0].gap.minX - 3, z: (P[0].gap.minZ + P[0].gap.maxZ) / 2, yaw: -Math.PI / 2 });
    await pose('swarm-near', { x: fx, z: F.minZ - 2, yaw: Math.PI });
    await pose('swarm-inside', { x: fx, z: (F.minZ + F.maxZ) / 2, yaw: Math.PI });
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
    await page2.goto(BASE + '/?test=1&level=147', { waitUntil: 'domcontentloaded', timeout: 90000 });
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
        return { escaped: s.escaped, items };
    });
    check('Level 148 door: You did it! Start Level 149', r.escaped && r.items.some((x) => x.includes('Level 149')), r);
    check('no page errors (prev)', errors.length === 0, errors);
}
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
