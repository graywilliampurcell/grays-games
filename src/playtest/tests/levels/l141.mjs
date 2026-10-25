// Level 141 checks (served on 9173)
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
await page.goto(BASE + '/?test=1&level=140', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
await page.keyboard.press('Shift');
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 900)); };
const shot = (name) => page.screenshot({ path: `${SP}l141-${name}.png`, timeout: 180000 });
const ONLY = process.env.ONLY;
let st = await page.evaluate(() => window.__game.restore());
const p = st.platforms[0];
check('Level 141 loads: one cap ride, the sneaky mushroom, nothing else',
    st.level.name === 'Level 141' && st.platforms.length === 1 && p.cap && !!st.spike && !st.spike2 && st.spikeRows.length === 0 && st.tails.length === 0 && st.vents.length === 0 && st.geysers.length === 0 && st.belts.length === 0,
    { p, spike: st.spike, level: st.level });
check('gap 3 cells long (span 11), along z, 3 wide', p.span === 11 && !p.alongX && p.gap.maxX - p.gap.minX === 3, p.gap);
check('tune mushroomwelcome', (await page.evaluate(() => window.__sound?.tuneName)) === 'mushroomwelcome', {});
const cx = (p.gap.minX + p.gap.maxX) / 2;
const yawS = Math.PI; // facing +z (crossed heading south)
// Walk straight in down the middle: no fall, cap waits (not in ring yet), then in the ring it goes
const run = (args) => page.evaluate(([g0, cx, yawS, a]) => {
    const g = window.__game;
    g.restore();
    g.teleport({ x: cx + (a.off ?? 0), z: g0.minZ - 1.5, yaw: yawS });
    g.clearEvents();
    g.setInput({ forward: true });
    let s, k = 0, departAt = null, landAt = null, t0 = g.time();
    const trace = [];
    for (; k < (a.steps ?? 600); k++) {
        if (a.stopAt !== undefined && s && s.pos.z >= g0.minZ + a.stopAt) g.clearInput();
        s = g.step(1);
        if (departAt === null && g.events.some((e) => e.type === 'platform' && e.what === 'depart')) departAt = +(g.time() - t0).toFixed(2);
        if (landAt === null && g.events.some((e) => e.type === 'platform' && e.what === 'land')) landAt = +(g.time() - t0).toFixed(2);
        if (k % 30 === 0) trace.push([+(s.pos.x).toFixed(2), +(s.pos.z).toFixed(2), s.platforms[0].at, s.platforms[0].riding]);
        if (g.events.some((e) => e.type === 'fall')) break;
    }
    g.clearInput();
    return { pos: s.pos, p: s.platforms[0], departAt, landAt, ev: g.events.map((e) => e.type).filter((e) => ['fall', 'spike'].includes(e)), msg: g.text(), sounds: g.events.filter((e) => e.type === 'sound').map((e) => e.name), trace: trace.slice(-8) };
}, [p.gap, cx, yawS, args]);
let r;
if (!ONLY || ONLY === 'cross') {
    // stop walking once in the ring (cap centre at minZ + 0.8)
    r = await run({ stopAt: 0.85, steps: 400 });
    check('walk onto the cap down the middle, stop in the ring: it carries you across and sets you on the far floor', r.ev.length === 0 && r.departAt !== null && r.landAt !== null && r.pos.z > p.gap.maxZ + 0.5 && r.p.at === r.p.target, r);
    check('ride time about (11-2.4)/6 = 1.43 s', r.landAt - r.departAt > 1.3 && r.landAt - r.departAt < 1.8, { d: r.departAt, l: r.landAt });
    check('whoosh as it sets off', r.sounds.includes('whoosh'), r.sounds);
    // keep walking forward the whole time: rides, can't leave it while moving (no fall)
    r = await run({ steps: 400 });
    check('keep pushing forward while it moves: no fall, arrives', r.ev.length === 0 && r.landAt !== null && r.pos.z > p.gap.maxZ, r);
}
if (!ONLY || ONLY === 'wait') {
    // Stand on the cap outside the ring: it doesn't go
    r = await page.evaluate(([g0, cx, yawS]) => {
        const g = window.__game;
        g.restore();
        g.teleport({ x: cx + 0.75, z: g0.minZ + 0.8, yaw: yawS });
        g.clearEvents();
        const s = g.step(120);
        return { p: s.platforms[0], ev: g.events.map((e) => e.type + (e.what ? ':' + e.what : '')) };
    }, [p.gap, cx, yawS]);
    check('on the cap but outside the ring for 2 s: it waits, no fall', r.p.at === r.p.target && !r.p.riding && !r.ev.includes('fall'), r);
    // Walk off its side into the acid while it waits
    r = await page.evaluate(([g0, cx, yawS]) => {
        const g = window.__game;
        g.restore();
        g.teleport({ x: cx + 0.75, z: g0.minZ + 0.8, yaw: Math.PI }); // walk on along the gap, past the cap's far side (never in the ring)
        g.clearEvents();
        g.setInput({ forward: true });
        let s;
        for (let k = 0; k < 90 && !g.events.some((e) => e.type === 'fall'); k++) s = g.step(1);
        g.clearInput();
        return { ev: g.events.map((e) => e.type).filter((e) => e === 'fall'), msg: g.text(), pos: s.pos, start: s.start, sounds: g.events.filter((e) => e.type === 'sound').map((e) => e.name) };
    }, [p.gap, cx, yawS]);
    check('walk off its edge while it waits: Ouch! You fell in the acid. Back to the start.', r.ev.length === 1 && JSON.stringify(r.msg).includes('Ouch! You fell in the acid. Back to the start.') && Math.hypot(r.pos.x - r.start.x, r.pos.z - r.start.z) < 0.1 && r.sounds.includes('ouch'), r);
    // Walk in near the wall (off the cap): acid
    r = await run({ off: 1.05, steps: 200 });
    check('walk in near the wall, beside the cap: fall into the acid', r.ev.includes('fall'), r);
    // While riding, try to walk sideways off: can't
    r = await page.evaluate(([g0, cx, yawS]) => {
        const g = window.__game;
        g.restore();
        g.teleport({ x: cx, z: g0.minZ + 0.8, yaw: -Math.PI / 2 });
        g.clearEvents();
        let s = g.step(25); // past the wait, now moving
        g.setInput({ forward: true });
        let maxOff = 0;
        for (let k = 0; k < 200; k++) {
            s = g.step(1);
            maxOff = Math.max(maxOff, Math.abs(s.pos.x - cx));
            if (g.events.some((e) => e.type === 'platform' && e.what === 'land')) break;
        }
        g.clearInput();
        s = g.step(60);
        return { maxOff, ev: g.events.map((e) => e.type + (e.what ? ':' + e.what : '')), pos: s.pos };
    }, [p.gap, cx, yawS]);
    check('walking sideways while it moves: kept on the cap (<= 0.8 off middle), no fall, lands', r.maxOff <= 0.81 && !r.ev.includes('fall') && r.ev.includes('platform:land'), r);
    // Comes back to you from the far side; and comes to you on reset
    r = await page.evaluate(([g0, cx]) => {
        const g = window.__game;
        g.restore();
        g.teleport({ x: cx, z: g0.maxZ + 1.5, yaw: 0 });
        g.clearEvents();
        let s = g.step(150);
        const came = s.platforms[0];
        g.restore();
        s = g.step(2);
        return { came, reset: s.platforms[0] };
    }, [p.gap, cx]);
    check('standing at the far edge: the empty cap floats over to you; reset sends it back', r.came.at === r.came.target && r.came.at > 5 && r.reset.at === r.reset.startAt, r);
}
if (!ONLY || ONLY === 'spike') {
    r = await page.evaluate((spike) => {
        const g = window.__game;
        g.restore();
        g.teleport({ x: spike.x + 1.6, z: spike.z, yaw: Math.PI / 2 });
        g.clearEvents();
        g.setInput({ forward: true });
        let s;
        for (let k = 0; k < 90 && !g.events.some((e) => e.type === 'spike'); k++) s = g.step(1);
        g.clearInput();
        return { spike: g.events.some((e) => e.type === 'spike'), msg: g.text() };
    }, st.spike);
    check('sneaky Ouch mushroom: Ouch! An Ouch mushroom sent you back to the start.', r.spike && JSON.stringify(r.msg).includes('An Ouch mushroom sent you back to the start.'), r);
}
if (!ONLY || ONLY === 'shots') {
    await page.evaluate(([g0, cx]) => { const g = window.__game; g.restore(); g.teleport({ x: cx, z: g0.minZ - 3, yaw: Math.PI, pitch: -0.3 }); g.step(10); }, [p.gap, cx]);
    await shot('cap');
    await page.evaluate(([g0, cx]) => { const g = window.__game; g.restore(); g.teleport({ x: cx, z: g0.minZ - 0.6, yaw: Math.PI, pitch: -0.9 }); g.step(10); }, [p.gap, cx]);
    await shot('cap-down');
    await page.evaluate(() => { const g = window.__game; g.restore(); g.teleport({ yaw: -Math.PI / 2, pitch: 0.25 }); g.step(2); });
    await shot('start');
    await page.evaluate(() => { const g = window.__game; g.restore(); g.teleport({ yaw: -Math.PI / 2, pitch: 0 }); g.step(2); });
    await shot('start-level');
    await page.evaluate((spike) => { const g = window.__game; g.restore(); g.teleport({ x: spike.x + 2.4, z: spike.z, yaw: Math.PI / 2 }); g.step(2); }, st.spike);
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
    await page2.goto(BASE + '/?test=1&level=139', { waitUntil: 'domcontentloaded', timeout: 90000 });
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
        return { escaped: s.escaped, items, note: !document.getElementById('finish-note').hidden, title: document.getElementById('finish-title').textContent };
    });
    check('Level 140 finale: Start Mushroom Forest World above Quit, no coming-soon line', r.escaped && r.items[0] === 'Start Mushroom Forest World' && r.items.includes('Quit') && !r.note && r.title === 'You beat Sky World!', r);
    check('no page errors (prev)', errors.length === 0, errors);
}
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
