// Level 143 checks (served on 9173)
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
await page.goto(BASE + '/?test=1&level=142', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
await page.keyboard.press('Shift');
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 900)); };
const shot = (name) => page.screenshot({ path: `${SP}l143-${name}.png`, timeout: 180000 });
const ONLY = process.env.ONLY;
let st = await page.evaluate(() => window.__game.restore());
const p = st.platforms[0];
const m = st.sleepies[0];
check('Level 143 loads: one cap ride, one sleepy mushroom, nothing else',
    st.level.name === 'Level 143' && st.platforms.length === 1 && p.cap && !p.trench && st.sleepies.length === 1 && !st.spike && !st.spike2 && st.spikeRows.length === 0 && st.tails.length === 0 && st.vents.length === 0 && st.geysers.length === 0 && st.belts.length === 0 && st.trampolines.length === 0 && st.fogs.length === 0,
    { p, m, spike: st.spike, level: st.level });
check('sleepy mushroom at (10.5, 42.5); gap along x, 3 wide', m.x === 10.5 && m.z === 42.5 && p.alongX && p.span === 11 && p.gap.maxZ - p.gap.minZ === 3, { m, gap: p.gap });
check('tune mushroomsleepy', (await page.evaluate(() => window.__sound?.tuneName)) === 'mushroomsleepy', {});
check('not sleepy at the start', st.sleepy.left === 0 && st.sleepy.speed === 1 && !st.sleepy.shown, st.sleepy);
let r;
// Walk south straight into it
const walkInto = (off, steps = 200) => page.evaluate(([m, off, steps]) => {
    const g = window.__game;
    g.restore();
    g.teleport({ x: m.x + off, z: m.z - 3, yaw: Math.PI });
    g.clearEvents();
    g.setInput({ forward: true });
    let s, maxZ = -1e9, touchAt = null;
    const t0 = g.time();
    for (let k = 0; k < steps; k++) {
        s = g.step(1);
        maxZ = Math.max(maxZ, s.pos.z);
        if (touchAt === null && g.events.some((e) => e.type === 'sleepy')) touchAt = +(g.time() - t0).toFixed(2);
    }
    g.clearInput();
    return { pos: s.pos, maxZ, touchAt, sleepy: s.sleepy, ev: g.events.map((e) => e.type).filter((e) => ['sleepy', 'spike', 'fall'].includes(e)), sounds: g.events.filter((e) => e.type === 'sound').map((e) => e.name), msg: g.text() };
}, [m, off, steps]);
if (!ONLY || ONLY === 'touch') {
    r = await walkInto(0, 90);
    check('walk into it down the middle: solid (never closer than 0.86), sleepy, half speed, shown, not an Ouch', r.touchAt !== null && r.maxZ <= m.z - 0.85 && r.sleepy.left > 4.9 && r.sleepy.speed === 0.5 && r.sleepy.shown && !r.ev.includes('spike') && !r.ev.includes('fall') && r.ev.filter((e) => e === 'sleepy').length === 1, r);
    check('a yawn sound (Sound effects) once', r.sounds.filter((x) => x === 'sleepy').length === 1, r.sounds);
    check('no Ouch message', !JSON.stringify(r.msg).includes('Ouch'), r.msg);
    // Speed: 1 s of walking north away while sleepy vs normal
    r = await page.evaluate(([m]) => {
        const g = window.__game;
        const walk = () => { const a = g.state().pos; g.setInput({ forward: true }); g.step(60); g.clearInput(); const b = g.state().pos; return Math.hypot(b.x - a.x, b.z - a.z); };
        g.restore();
        g.teleport({ x: m.x, z: m.z - 0.85, yaw: Math.PI });
        g.step(2); // touching
        g.teleport({ x: m.x, z: m.z - 1.2, yaw: 0 }); // turn round, walk north (corridor runs north-south)
        const slow = walk();
        const left = g.state().sleepy.left;
        // wait till it wears off: about 5 s after the last touch
        let k = 0;
        while (g.state().sleepy.left > 0 && k < 600) { g.step(1); k++; }
        const after = g.state().sleepy;
        g.teleport({ x: m.x, z: m.z - 1.2, yaw: 0 });
        g.restore();
        g.teleport({ x: m.x, z: m.z - 1.2, yaw: 0 });
        const normal = walk();
        return { slow, normal, ratio: slow / normal, left, wearOff: (60 + k) / 60 + 2 / 60, after };
    }, [m]);
    check('walks at half speed while sleepy', Math.abs(r.ratio - 0.5) < 0.05, r);
    check('lasts about 5 s from the touch, then normal and the sign goes', Math.abs(r.wearOff - 5) < 0.1 && r.after.speed === 1 && !r.after.shown, r);
    // Touch again restarts the 5 s
    r = await page.evaluate(([m]) => {
        const g = window.__game;
        g.restore();
        g.teleport({ x: m.x, z: m.z - 0.85, yaw: Math.PI });
        g.step(2);
        g.teleport({ x: m.x, z: m.z - 2, yaw: Math.PI });
        g.step(180);
        const before = g.state().sleepy.left;
        g.teleport({ x: m.x, z: m.z - 0.85, yaw: Math.PI });
        const again = g.step(1).sleepy.left;
        return { before, again };
    }, [m]);
    check('touch again 3 s later: back to 5 s', r.before < 2.1 && r.again > 4.95, r);
    // Reset to the start ends it
    r = await page.evaluate(([m]) => {
        const g = window.__game;
        g.restore();
        g.teleport({ x: m.x, z: m.z - 0.85, yaw: Math.PI });
        g.step(2);
        const was = g.state().sleepy;
        const s = g.restore();
        return { was, now: g.step(1).sleepy };
    }, [m]);
    check('back to the start ends the sleepiness', r.was.left > 4.9 && r.now.left === 0 && r.now.speed === 1 && !r.now.shown, r);
    // Falling into the acid while sleepy ends it too
    r = await page.evaluate(([p, m]) => {
        const g = window.__game;
        g.restore();
        g.teleport({ x: m.x, z: m.z - 0.85, yaw: Math.PI });
        g.step(2);
        const cz = (p.gap.minZ + p.gap.maxZ) / 2;
        g.teleport({ x: p.gap.maxX - 2, z: cz + 1.05, yaw: Math.PI / 2 });
        g.clearEvents();
        let s;
        for (let k = 0; k < 120 && !g.events.some((e) => e.type === 'fall'); k++) s = g.step(1);
        s = g.step(1);
        return { fell: g.events.some((e) => e.type === 'fall'), sleepy: s.sleepy };
    }, [p, m]);
    check('fall in the acid while sleepy: back to the start, no longer sleepy', r.fell && r.sleepy.left === 0 && r.sleepy.speed === 1, r);
}
if (!ONLY || ONLY === 'squeeze') {
    for (const off of [0.95, -0.95, 1.0, -1.0]) {
        r = await walkInto(off, 200);
        check(`squeeze past at ${off} off the middle: get past, not sleepy`, r.maxZ > m.z + 1 && r.touchAt === null, r);
    }
    for (const off of [0.75, -0.75]) {
        r = await walkInto(off, 120);
        check(`at ${off} off the middle: bump it, sleepy`, r.touchAt !== null, r);
    }
}
if (!ONLY || ONLY === 'pause') {
    // Real time: touch it, pause for 2 s, the time doesn't run down
    r = await page.evaluate(async ([m]) => {
        const g = window.__game;
        g.restore();
        g.teleport({ x: m.x, z: m.z - 0.85, yaw: Math.PI });
        g.step(2);
        g.teleport({ x: m.x, z: m.z - 2, yaw: Math.PI });
        return g.state().sleepy;
    }, [m]);
    await page.keyboard.press('Space');
    await page.waitForTimeout(150);
    const a = await page.evaluate(() => ({ s: window.__game.state().sleepy, paused: document.body.classList.contains('paused') }));
    await page.evaluate(() => window.__game.setRealtime(true));
    await page.waitForTimeout(2000);
    const b = await page.evaluate(() => window.__game.state().sleepy);
    await page.evaluate(() => window.__game.setRealtime(false));
    check('paused: the sleepy time stays frozen', a.paused && Math.abs(a.s.left - b.left) < 0.02 && b.left > 4.5, { a, b });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    let paused = await page.evaluate(() => document.body.classList.contains('paused'));
    if (paused) { await page.keyboard.press('Space'); await page.waitForTimeout(150); paused = await page.evaluate(() => document.body.classList.contains('paused')); }
    console.log('unpaused:', !paused);
}
const cz = (p.gap.minZ + p.gap.maxZ) / 2;
if (!ONLY || ONLY === 'cross') {
    // Crossed heading west: start side is the east edge (maxX)
    const run = (args) => page.evaluate(([g0, cz, a]) => {
        const g = window.__game;
        g.restore();
        if (a.sleepyFirst) { const mm = g.state().sleepies[0]; g.teleport({ x: mm.x, z: mm.z - 0.85, yaw: Math.PI }); g.step(2); }
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
    r = await run({ stopAt: 0.85, steps: 400 });
    check('cap ride heading west: stop in the ring, it carries you over and sets you on the far floor', r.ev.length === 0 && r.departAt !== null && r.landAt !== null && r.pos.x < p.gap.minX - 0.5, r);
    check('ride time about 1.43 s, whoosh', r.landAt - r.departAt > 1.3 && r.landAt - r.departAt < 1.8 && r.sounds.includes('whoosh'), r);
    r = await run({ steps: 400 });
    check('keep pushing forward: no fall, arrives', r.ev.length === 0 && r.landAt !== null && r.pos.x < p.gap.minX, r);
    r = await run({ off: 1.05, steps: 200 });
    check('walk in near the wall beside the cap: acid', r.ev.includes('fall'), r);
    r = await run({ steps: 600, sleepyFirst: true });
    check('cross while sleepy: still carried across fine', r.ev.length === 0 && r.landAt !== null && r.pos.x < p.gap.minX, r);
    // Back the other way: the cap is now on the west side
    r = await page.evaluate(([g0, cz]) => {
        const g = window.__game;
        g.restore();
        g.teleport({ x: g0.minX - 1.5, z: cz, yaw: -Math.PI / 2 });
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
    check('from the west side: the cap comes to you and carries you east', r.came.at === r.came.target && r.landAt !== null && !r.fell && r.pos.x > p.gap.maxX, r);
}
if (!ONLY || ONLY === 'shots') {
    await page.evaluate(([m]) => { const g = window.__game; g.restore(); g.teleport({ x: m.x, z: m.z - 3.5, yaw: Math.PI }); g.step(30); }, [m]);
    await shot('sleepy');
    await page.evaluate(([m]) => { const g = window.__game; g.restore(); g.teleport({ x: m.x, z: m.z - 1.6, yaw: Math.PI }); g.step(30); }, [m]);
    await shot('sleepy-close');
    await page.evaluate(([m]) => { const g = window.__game; g.restore(); g.teleport({ x: m.x, z: m.z - 0.85, yaw: Math.PI }); g.step(2); g.teleport({ x: m.x + 0.95, z: m.z - 1.3, yaw: Math.PI }); g.step(60); }, [m]);
    await page.waitForTimeout(1200);
    await shot('sleepy-on');
    await page.evaluate(([g0, cz]) => { const g = window.__game; g.restore(); g.teleport({ x: g0.maxX + 3, z: cz, yaw: Math.PI / 2 }); g.step(10); }, [p.gap, cz]);
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
    await page2.goto(BASE + '/?test=1&level=141', { waitUntil: 'domcontentloaded', timeout: 90000 });
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
    check('Level 142 door: You did it! Start Level 143; Level 142 has no sleepy mushroom', r.escaped && r.items.some((x) => x.includes('Level 143')) && r.sleepies === 0, r);
    check('no page errors (prev)', errors.length === 0, errors);
}
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
