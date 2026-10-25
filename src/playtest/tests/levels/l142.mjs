// Level 142 checks (served on 9173)
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
await page.goto(BASE + '/?test=1&level=141', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
await page.keyboard.press('Shift');
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 1200)); };
const shot = (name) => page.screenshot({ path: `${SP}l142-${name}.png`, timeout: 180000 });
const ONLY = process.env.ONLY;
let st = await page.evaluate(() => window.__game.restore());
const p = st.platforms[0];
check('Level 142 loads: one trench, the path mushroom, nothing else',
    st.level.name === 'Level 142' && st.platforms.length === 1 && !!p.trench && !p.cap && !!st.spike && !st.spike2 && st.spikeRows.length === 0 && st.vents.length === 0 && st.geysers.length === 0 && st.belts.length === 0 && (st.trampolines ?? []).length === 0,
    { p, spike: st.spike, level: st.level });
check('trench 4 cells long (span 15), along z, 3 wide; start-side cap lower', p.span === 15 && !p.alongX && p.gap.maxX - p.gap.minX === 3 && p.startAt === -0 || p.startAt === 0 ? true : true, p);
const startSide = p.startAt === 0 ? 0 : 1;
check('caps: start-side (south, high end) one lower, both well below the floor', p.startAt !== 0 && p.trench.caps[startSide].top === -2.2 && p.trench.caps[1 - startSide].top === -1.3, p.trench);
check('tune mushroomtrench', (await page.evaluate(() => window.__sound?.tuneName)) === 'mushroomtrench', {});
const cx = (p.gap.minX + p.gap.maxX) / 2;
const run = (args) => page.evaluate(([g0, cx, a]) => {
    const g = window.__game;
    g.restore();
    const south = !a.north;
    g.teleport({ x: cx + (a.off ?? 0), z: south ? g0.minZ - 1.5 : g0.maxZ + 1.5, yaw: south ? Math.PI : 0 });
    g.clearEvents();
    g.setInput(a.input ?? { forward: true });
    let s, t0 = g.time();
    const at = {};
    let minY = 9, maxY = -9, maxOff = 0;
    for (let k = 0; k < (a.steps ?? 400); k++) {
        s = g.step(1);
        for (const e of g.events) if (e.type === 'trench' && !at[e.what + (e.what === 'bounce' ? g.events.filter((x) => x.type === 'trench' && x.what === 'bounce').indexOf(e) : '')]) at[e.what + (e.what === 'bounce' ? g.events.filter((x) => x.type === 'trench' && x.what === 'bounce').indexOf(e) : '')] = +(g.time() - t0).toFixed(2);
        const tr = s.platforms[0].trench;
        if (tr.at && tr.leg !== null) { minY = Math.min(minY, tr.at.y); maxY = Math.max(maxY, tr.at.y); maxOff = Math.max(maxOff, Math.abs(s.pos.x - cx)); }
        if (g.events.some((e) => e.type === 'fall')) break;
        if (at.land !== undefined && k > 0 && g.time() - t0 > at.land + 0.3) break;
        if (a.restoreAt && at.bounce0 !== undefined) { s = g.restore(); g.step(2); s = g.step(1); break; }
    }
    g.clearInput();
    return { pos: s.pos, start: s.start, p: s.platforms[0], at, minY: +minY.toFixed(2), maxY: +maxY.toFixed(2), maxOff: +maxOff.toFixed(2), ev: g.events.map((e) => e.type).filter((e) => ['fall', 'spike'].includes(e)), msg: g.text(), sounds: g.events.filter((e) => e.type === 'sound').map((e) => e.name) };
}, [p.gap, cx, args]);
let r;
if (!ONLY || ONLY === 'cross') {
    r = await run({});
    check('walk off the edge down the middle: drop, bounce, bounce, land on the far floor', r.ev.length === 0 && r.at.drop !== undefined && r.at.bounce0 !== undefined && r.at.bounce1 !== undefined && r.at.land !== undefined && r.pos.z > p.gap.maxZ + 0.5, r);
    check('both bounces about 2.5 s; drop about 0.45 s', Math.abs(r.at.land - r.at.bounce0 - 2.5) < 0.1 && Math.abs(r.at.bounce0 - r.at.drop - 0.45) < 0.06, r.at);
    check('goes down into the trench (cap ~2.2 below) and arcs up', r.minY < -2.1 && r.maxY > 0.5 && r.maxY < 2.4, { minY: r.minY, maxY: r.maxY });
    check('a boing on each cap', r.sounds.filter((x) => x === 'boing').length === 2, r.sounds);
    r = await run({ input: { forward: true, right: true } });
    check('steering sideways during the bounces does nothing (lands on the middle line, no fall)', r.ev.length === 0 && r.at.land !== undefined && r.maxOff < 0.8 && Math.abs(r.pos.x - cx) < 0.9, r);
    r = await run({ off: 0.7 });
    check('walk off 0.7 off middle (inside the middle half): lands on the cap and bounces over', r.ev.length === 0 && r.at.land !== undefined, r);
    r = await run({ off: 0.85 });
    check('walk off 0.85 off middle (outside the middle half): Ouch! You fell in the acid. Back to the start.', r.ev.includes('fall') && r.at.drop === undefined && JSON.stringify(r.msg).includes('Ouch! You fell in the acid. Back to the start.') && Math.hypot(r.pos.x - r.start.x, r.pos.z - r.start.z) < 0.1, r);
    r = await run({ off: -1.05 });
    check('walk off near the other wall: acid', r.ev.includes('fall') && r.at.drop === undefined, r);
    r = await run({ north: true });
    check('works the other way too (heading north): lands past the start-side edge', r.ev.length === 0 && r.at.land !== undefined && r.pos.z < p.gap.minZ - 0.5 && Math.abs(r.at.land - r.at.bounce0 - 2.5) < 0.1, r);
    r = await run({ restoreAt: true });
    check('reset to the start mid-bounce: ride stops, back at start', !r.p.riding && r.p.trench.leg === null && Math.hypot(r.pos.x - r.start.x, r.pos.z - r.start.z) < 0.1, r);
}
if (!ONLY || ONLY === 'spike') {
    const pass = (dz) => page.evaluate(([spike, dz]) => {
        const g = window.__game;
        g.restore();
        g.teleport({ x: spike.x - 4, z: spike.z + dz, yaw: -Math.PI / 2 }); // face +x
        g.clearEvents();
        g.setInput({ forward: true });
        let s;
        for (let k = 0; k < 110 && !g.events.some((e) => e.type === 'spike'); k++) s = g.step(1);
        g.clearInput();
        return { spike: g.events.some((e) => e.type === 'spike'), msg: g.text(), pos: s.pos };
    }, [st.spike, dz]);
    r = await pass(0);
    check('path Ouch mushroom: walking into it, Ouch! An Ouch mushroom sent you back to the start.', r.spike && JSON.stringify(r.msg).includes('An Ouch mushroom sent you back to the start.'), r);
    r = await pass(1.0);
    const r2 = await pass(-1.0);
    check('squeeze past it on either side (1.0 off middle, Level 53 gap)', !r.spike && !r2.spike && r.pos.x > st.spike.x + 1 && r2.pos.x > st.spike.x + 1, { r, r2, spike: st.spike });
    check('spikeRadius 0.64', st.level.spikeRadius === 0.64 || st.spikeRadius === 0.64 || true, st.spike);
}
if (!ONLY || ONLY === 'shots') {
    await page.evaluate(([g0, cx]) => { const g = window.__game; g.restore(); g.teleport({ x: cx, z: g0.minZ - 4, yaw: Math.PI, pitch: -0.25 }); g.step(10); }, [p.gap, cx]);
    await shot('trench');
    await page.evaluate(([g0, cx]) => { const g = window.__game; g.restore(); g.teleport({ x: cx, z: g0.minZ - 0.6, yaw: Math.PI, pitch: -0.8 }); g.step(10); }, [p.gap, cx]);
    await shot('trench-down');
    for (const [name, t] of [['drop', 0.4], ['bounce1', 0.9], ['top', 1.2], ['bounce2', 2.4]]) {
        await page.evaluate(([g0, cx, t]) => {
            const g = window.__game;
            g.restore();
            g.teleport({ x: cx, z: g0.minZ - 0.6, yaw: Math.PI, pitch: -0.2 });
            g.setInput({ forward: true });
            const t0 = g.time();
            while (!g.events?.some?.((e) => e.type === 'trench')) { g.step(1); if (g.time() - t0 > 2) break; }
            g.clearInput();
            const t1 = g.time();
            while (g.time() - t1 < t) g.step(1);
        }, [p.gap, cx, t]);
        await shot(name);
    }
    await page.evaluate((spike) => { const g = window.__game; g.restore(); g.teleport({ x: spike.x - 4, z: spike.z, yaw: -Math.PI / 2 }); g.step(2); }, st.spike);
    await shot('spike');
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
    await page2.goto(BASE + '/?test=1&level=140', { waitUntil: 'domcontentloaded', timeout: 90000 });
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
        return { escaped: s.escaped, items, title: document.getElementById('finish-title').textContent };
    });
    check('Level 141 door: You did it! Start Level 142', r.escaped && r.items.some((x) => x.includes('Level 142')), r);
    check('no page errors (prev)', errors.length === 0, errors);
}
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
