// Level 146 checks (served on 9173)
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
await page.goto(BASE + '/?test=1&level=145', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
await page.keyboard.press('Shift');
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 900)); };
const shot = (name) => page.screenshot({ path: `${SP}l146-${name}.png`, timeout: 180000 });
const ONLY = process.env.ONLY;
let st = await page.evaluate(() => window.__game.restore());
const p = st.platforms[0];
const f = st.fireflies[0];
check('Level 146 loads: one firefly, one path Ouch mushroom, one cap ride, nothing else',
    st.level.name === 'Level 146' && st.fireflies.length === 1 && !!st.spike && !st.spike2 && st.spikeRows.length === 0 && st.platforms.length === 1 && p.cap && !p.trench && st.sleepies.length === 0 && st.vents.length === 0 && st.geysers.length === 0 && st.fogs.length === 0 && (st.trampolines ?? []).length === 0,
    { f, spike: st.spike, p: { gap: p.gap, span: p.span, alongX: p.alongX }, level: st.level });
check('firefly at (26.5, 22.5); Ouch mushroom at (10.5, 26.5); gap x 22-33 z 1-4 along x', f.x === 26.5 && f.z === 22.5 && st.spike.x === 10.5 && st.spike.z === 26.5 && p.alongX && p.gap.maxZ - p.gap.minZ === 3, { f, spike: st.spike, gap: p.gap });
check('tune mushroomsqueeze', (await page.evaluate(() => window.__sound?.tuneName)) === 'mushroomsqueeze', {});
let r;
// Wait (stepping) till the firefly changes to `to`
const FIND = `(g, to) => { for (let k = 0; k < 400; k++) { if (g.state().fireflies[0].bright === to) return; g.step(1); } }`;
if (!ONLY || ONLY === 'cycle') {
    r = await page.evaluate(([F]) => {
        const g = window.__game;
        const find = eval(F);
        g.restore();
        g.teleport({ x: 30, z: 6, yaw: 0 });
        find(g, true); find(g, false);
        const changes = [];
        g.clearEvents();
        const t0 = g.time();
        for (let k = 0; k < 60 * 11; k++) { g.step(1); for (const e of g.events) if (e.type === 'firefly') changes.push([e.what, +(g.time() - t0).toFixed(2)]); g.clearEvents(); }
        return { changes };
    }, [FIND]);
    const c = r.changes;
    check('blinks: bright after 3 s dim, dim after 2 s bright, over and over', c.length >= 4 && c[0][0] === 'bright' && Math.abs(c[0][1] - 3) < 0.05 && c[1][0] === 'dim' && Math.abs(c[1][1] - c[0][1] - 2) < 0.05 && Math.abs(c[2][1] - c[1][1] - 3) < 0.05, r);
}
// Stand in the hallway facing it (west), from the moment it turns bright
const stare = (a) => page.evaluate(([F, f, a]) => {
    const g = window.__game;
    const find = eval(F);
    g.restore();
    g.teleport({ x: a.x ?? f.x - 9, z: a.z ?? f.z, yaw: a.yaw ?? -Math.PI / 2 });
    find(g, a.dim ? true : false); find(g, a.dim ? false : true);
    g.clearEvents();
    const t0 = g.time();
    let ouchAt = null, half = null, maxStare = 0;
    for (let k = 0; k < (a.steps ?? 110); k++) {
        if (a.turnAt && k === a.turnAt) g.teleport({ yaw: a.turnYaw });
        if (a.backAt && k === a.backAt) g.teleport({ yaw: a.yaw ?? -Math.PI / 2 });
        const s = g.step(1);
        maxStare = Math.max(maxStare, s.fireflyStare);
        if (k === 30) half = { stare: s.fireflyStare, glare: +getComputedStyle(document.getElementById('glare')).opacity };
        if (ouchAt === null && g.events.some((e) => e.type === 'spike' && e.what === 'firefly')) ouchAt = +(g.time() - t0).toFixed(2);
    }
    const s = g.state();
    return { ouchAt, half, maxStare: +maxStare.toFixed(2), pos: s.pos, start: s.start, msg: g.text(), flash: document.getElementById('white-flash').classList.contains('on'), glare: +getComputedStyle(document.getElementById('glare')).opacity, sounds: g.events.filter((e) => e.type === 'sound').map((e) => e.name) };
}, [FIND, f, a]);
if (!ONLY || ONLY === 'stare') {
    r = await stare({});
    check('face it while bright: Ouch after about 1.0 s, back to the start', r.ouchAt !== null && r.ouchAt >= 0.96 && r.ouchAt < 1.06 && Math.hypot(r.pos.x - r.start.x, r.pos.z - r.start.z) < 0.1, r);
    check('message: Ouch! The firefly was too bright. Back to the start.; white flash; ouch sound', JSON.stringify(r.msg).includes('Ouch! The firefly was too bright. Back to the start.') && r.flash && r.sounds.includes('ouch'), r);
    check('the view whitens as the count builds (half way: about 0.3), clear after the reset', Math.abs(r.half.glare - 0.3) < 0.03 && r.glare === 0, r);
    r = await stare({ dim: true, steps: 170 });
    check('face it the whole dim time (about 2.8 s): safe', r.ouchAt === null && r.maxStare === 0, r);
    r = await stare({ yaw: Math.PI / 2, steps: 115 });
    check('back to it the whole bright time: safe', r.ouchAt === null && r.maxStare === 0, r);
    r = await stare({ turnAt: 40, turnYaw: -Math.PI / 2 + 0.5, backAt: 45, steps: 100 });
    check('look away (about 29 deg) a moment after 0.67 s, then back: the count starts over, no Ouch in 1.6 s', r.ouchAt === null && r.maxStare < 0.95, r);
    r = await stare({ turnAt: 1, turnYaw: -Math.PI / 2 + 0.22, steps: 110 });
    check('12.6 deg off: still in your eyes, Ouch', r.ouchAt !== null, r);
    r = await stare({ turnAt: 1, turnYaw: -Math.PI / 2 + 0.3, steps: 110 });
    check('17 deg off: not in your eyes, safe', r.ouchAt === null, r);
    r = await stare({ x: f.x - 16, z: f.z + 8, steps: 110 });
    check('walls block it (standing two rows south and further west, facing east)', r.ouchAt === null && r.maxStare === 0, r);
    r = await stare({ x: f.x - 1, steps: 110 });
    check('right under it (1 away, it is up high): not in front of you, safe', r.ouchAt === null, r);
}
if (!ONLY || ONLY === 'pause') {
    r = await page.evaluate(([f]) => { const g = window.__game; g.restore(); g.teleport({ x: f.x - 9, z: f.z, yaw: Math.PI / 2 }); g.step(1); return g.state().fireflies[0]; }, [f]);
    await page.keyboard.press('Space');
    await page.waitForTimeout(150);
    const a = await page.evaluate(() => ({ f: window.__game.state().fireflies[0], paused: document.body.classList.contains('paused') }));
    await page.evaluate(() => window.__game.setRealtime(true));
    await page.waitForTimeout(2000);
    const b = await page.evaluate(() => window.__game.state().fireflies[0]);
    await page.evaluate(() => window.__game.setRealtime(false));
    check('paused: the blinking stays frozen', a.paused && Math.abs(a.f.time - b.time) < 0.02, { a, b });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    let paused = await page.evaluate(() => document.body.classList.contains('paused'));
    if (paused) { await page.keyboard.press('Space'); await page.waitForTimeout(150); paused = await page.evaluate(() => document.body.classList.contains('paused')); }
    console.log('unpaused:', !paused);
}
const cz = (p.gap.minZ + p.gap.maxZ) / 2;
if (!ONLY || ONLY === 'cross') {
    // Crossed heading east: start side is the west edge (minX)
    const run = (args) => page.evaluate(([g0, cz, a]) => {
        const g = window.__game;
        g.restore();
                g.teleport({ x: a.fromWest ? g0.minX - 1.5 : g0.maxX + 1.5, z: cz + (a.off ?? 0), yaw: a.fromWest ? -Math.PI / 2 : Math.PI / 2 });
        g.clearEvents();
        g.setInput({ forward: true });
        let s, departAt = null, landAt = null;
        const t0 = g.time();
        for (let k = 0; k < (a.steps ?? 600); k++) {
            if (a.stopAt !== undefined && s && (a.fromWest ? s.pos.x >= g0.minX + a.stopAt : s.pos.x <= g0.maxX - a.stopAt)) g.clearInput();
            s = g.step(1);
            if (departAt === null && g.events.some((e) => e.type === 'platform' && e.what === 'depart')) departAt = +(g.time() - t0).toFixed(2);
            if (landAt === null && g.events.some((e) => e.type === 'platform' && e.what === 'land')) landAt = +(g.time() - t0).toFixed(2);
            if (g.events.some((e) => e.type === 'fall')) break;
        }
        g.clearInput();
        return { pos: s.pos, p: s.platforms[0], departAt, landAt, ev: g.events.map((e) => e.type).filter((e) => ['fall', 'spike'].includes(e)), sounds: g.events.filter((e) => e.type === 'sound').map((e) => e.name) };
    }, [p.gap, cz, args]);
    r = await run({ fromWest: true, stopAt: 0.85, steps: 400 });
    check('cap ride heading east: stop in the ring, it carries you over and sets you on the far floor', r.ev.length === 0 && r.departAt !== null && r.landAt !== null && r.pos.x > p.gap.maxX + 0.5, r);
    check('ride time about 1.43 s, whoosh', r.landAt - r.departAt > 1.3 && r.landAt - r.departAt < 1.8 && r.sounds.includes('whoosh'), r);
    r = await run({ fromWest: true, steps: 400 });
    check('keep pushing forward: no fall, arrives', r.ev.length === 0 && r.landAt !== null && r.pos.x > p.gap.maxX, r);
    r = await run({ fromWest: true, off: 1.05, steps: 200 });
    check('walk in near the wall beside the cap: acid', r.ev.includes('fall'), r);
    // Back the other way: the cap is now on the east side
    r = await page.evaluate(([g0, cz]) => {
        const g = window.__game;
        g.restore();
        g.teleport({ x: g0.maxX + 1.5, z: cz, yaw: Math.PI / 2 });
        g.clearEvents();
        let s = g.step(150);
        const came = s.platforms[0];
        g.setInput({ forward: true });
        let landAt = null;
        for (let k = 0; k < 400 && landAt === null; k++) { s = g.step(1); if (g.events.some((e) => e.type === 'platform' && e.what === 'land')) landAt = k; if (g.events.some((e) => e.type === 'fall')) break; }
        g.clearInput();
        s = g.step(40);
        return { came, landAt, pos: s.pos, fell: g.events.some((e) => e.type === 'fall') };
    }, [p.gap, cz]);
    check('from the east side: the cap comes to you and carries you west', r.came.at === r.came.target && r.landAt !== null && !r.fell && r.pos.x < p.gap.minX, r);
}
if (!ONLY || ONLY === 'spike') {
    // Path heading west through it
    const pass = (dz) => page.evaluate(([spike, dz]) => {
        const g = window.__game;
        g.restore();
        g.teleport({ x: spike.x + 4, z: spike.z + dz, yaw: Math.PI / 2 }); // face -x
        g.clearEvents();
        g.setInput({ forward: true });
        let s;
        for (let k = 0; k < 110 && !g.events.some((e) => e.type === 'spike'); k++) s = g.step(1);
        g.clearInput();
        return { spike: g.events.some((e) => e.type === 'spike'), msg: g.text(), pos: s.pos };
    }, [st.spike, dz]);
    r = await pass(0);
    check('path Ouch mushroom: walking into it, Ouch! An Ouch mushroom sent you back to the start.', r.spike && JSON.stringify(r.msg).includes('An Ouch mushroom sent you back to the start.'), r);
    for (const dz of [1.0, -1.0]) { r = await pass(dz); check(`squeeze past it at ${dz} off the middle (Level 54 gap)`, !r.spike && r.pos.x < st.spike.x - 1, r); }
    for (const dz of [0.85, -0.85]) { r = await pass(dz); check(`${dz} off the middle: Ouch (tighter than Level 142's 1.0 / 0.64 fit)`, r.spike, r); }
    const rad = await page.evaluate(() => window.__game.maze().spikeRadius ?? null);
    console.log('spikeRadius', rad);
}
if (!ONLY || ONLY === 'shots') {
    await page.evaluate(([f]) => { const g = window.__game; g.restore(); g.teleport({ x: f.x - 10, z: f.z, yaw: -Math.PI / 2 }); g.step(10); }, [f]);
    await shot('firefly');
    await page.evaluate(([s]) => { const g = window.__game; g.restore(); g.teleport({ x: s.x + 4, z: s.z, yaw: Math.PI / 2 }); g.step(10); }, [st.spike]);
    await shot('spike');
    await page.evaluate(([g0, cz]) => { const g = window.__game; g.restore(); g.teleport({ x: g0.minX - 3, z: cz, yaw: -Math.PI / 2 }); g.step(10); }, [p.gap, cz]);
    await shot('cap');
    await page.evaluate(() => { const g = window.__game; g.restore(); g.teleport({ yaw: -Math.PI / 2 }); g.step(2); });
    await shot('start');
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
    await page2.goto(BASE + '/?test=1&level=144', { waitUntil: 'domcontentloaded', timeout: 90000 });
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
    check('Level 145 door: You did it! Start Level 146', r.escaped && r.items.some((x) => x.includes('Level 146')), r);
    check('no page errors (prev)', errors.length === 0, errors);
}
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
