// Level 144 checks (served on 9173)
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
await page.goto(BASE + '/?test=1&level=143', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
await page.keyboard.press('Shift');
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 900)); };
const shot = (name) => page.screenshot({ path: `${SP}l144-${name}.png`, timeout: 180000 });
const ONLY = process.env.ONLY;
let st = await page.evaluate(() => window.__game.restore());
const p = st.platforms[0];
const f = st.fireflies[0];
const row = st.spikeRows[0];
check('Level 144 loads: one firefly, one big mushroom, one trench, nothing else',
    st.level.name === 'Level 144' && st.fireflies.length === 1 && st.spikeRows.length === 1 && st.platforms.length === 1 && !!p.trench && !p.cap && !st.spike && !st.spike2 && st.sleepies.length === 0 && st.vents.length === 0 && st.geysers.length === 0 && st.fogs.length === 0 && (st.trampolines ?? []).length === 0,
    { f, row, p: { gap: p.gap, span: p.span, alongX: p.alongX }, level: st.level });
check('firefly at (38.5, 50.5), 2.3 up; big mushroom at (10.5, 31.5)', f.x === 38.5 && f.z === 50.5 && f.y === 2.3 && row.x === 10.5 && row.z === 31.5, { f, row });
check('tune mushroomfirefly', (await page.evaluate(() => window.__sound?.tuneName)) === 'mushroomfirefly', {});
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
    g.teleport({ x: a.x ?? f.x + 9, z: a.z ?? f.z, yaw: a.yaw ?? Math.PI / 2 });
    find(g, a.dim ? true : false); find(g, a.dim ? false : true);
    g.clearEvents();
    const t0 = g.time();
    let ouchAt = null, half = null, maxStare = 0;
    for (let k = 0; k < (a.steps ?? 110); k++) {
        if (a.turnAt && k === a.turnAt) g.teleport({ yaw: a.turnYaw });
        if (a.backAt && k === a.backAt) g.teleport({ yaw: a.yaw ?? Math.PI / 2 });
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
    r = await stare({ yaw: -Math.PI / 2, steps: 115 });
    check('back to it the whole bright time: safe', r.ouchAt === null && r.maxStare === 0, r);
    r = await stare({ turnAt: 40, turnYaw: Math.PI / 2 + 0.5, backAt: 45, steps: 100 });
    check('look away (about 29 deg) a moment after 0.67 s, then back: the count starts over, no Ouch in 1.6 s', r.ouchAt === null && r.maxStare < 0.95, r);
    r = await stare({ turnAt: 1, turnYaw: Math.PI / 2 + 0.22, steps: 110 });
    check('12.6 deg off: still in your eyes, Ouch', r.ouchAt !== null, r);
    r = await stare({ turnAt: 1, turnYaw: Math.PI / 2 + 0.3, steps: 110 });
    check('17 deg off: not in your eyes, safe', r.ouchAt === null, r);
    r = await stare({ x: f.x + 16, steps: 110 });
    check('the wall at the hallway end blocks it (standing in the next cell east, facing it)', r.ouchAt === null && r.maxStare === 0, r);
    r = await stare({ x: f.x + 0.6, steps: 110 });
    check('right under it (0.6 away, it is overhead): not in front of you, safe', r.ouchAt === null, r);
}
if (!ONLY || ONLY === 'walk') {
    // Walk the hallway straight at it, setting off the moment it goes dim
    r = await page.evaluate(([F, f]) => {
        const g = window.__game;
        const find = eval(F);
        g.restore();
        g.teleport({ x: f.x + 12, z: f.z, yaw: -Math.PI / 2 });
        find(g, true); find(g, false);
        g.teleport({ yaw: Math.PI / 2 });
        g.clearEvents();
        g.setInput({ forward: true });
        const t0 = g.time();
        let s, safeAt = null;
        const trace = [];
        for (let k = 0; k < 400; k++) {
            s = g.step(1);
            if (k < 3 || k % 30 === 0) trace.push([k, +s.pos.x.toFixed(2), +s.pos.z.toFixed(2), g.events.map((e) => e.type).join('/')]);
            if (safeAt === null && s.pos.x < f.x + 2.6) safeAt = +(g.time() - t0).toFixed(2);
            if (g.events.some((e) => e.type === 'spike')) break;
            if (s.pos.x < f.x + 0.5) break;
        }
        g.clearInput();
        return { safeAt, pos: s.pos, ouch: g.events.some((e) => e.type === 'spike'), trace };
    }, [FIND, f]);
    check('walk straight down the hallway as it goes dim: past it before it can hurt you', !r.ouch && r.safeAt !== null && r.safeAt < 4, r);
}
if (!ONLY || ONLY === 'pause') {
    r = await page.evaluate(([f]) => { const g = window.__game; g.restore(); g.teleport({ x: f.x + 9, z: f.z, yaw: -Math.PI / 2 }); g.step(1); return g.state().fireflies[0]; }, [f]);
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
if (!ONLY || ONLY === 'big') {
    // The big mushroom fills the dead end's opening (the dead end runs north from (10.5, 33))
    for (const off of [0, 0.9, -0.9]) {
        r = await page.evaluate(([row, off]) => {
            const g = window.__game;
            g.restore();
            g.teleport({ x: row.x + off, z: row.z + 3, yaw: 0 });
            g.clearEvents();
            g.setInput({ forward: true });
            let s, minZ = 99;
            for (let k = 0; k < 150; k++) { s = g.step(1); if (g.events.some((e) => e.type === 'spike')) break; minZ = Math.min(minZ, s.pos.z); }
            g.clearInput();
            return { ouch: g.events.some((e) => e.type === 'spike'), minZ, msg: g.text(), pos: g.state().pos, start: g.state().start };
        }, [row, off]);
        check(`walk into the big mushroom ${off} off the middle: Ouch, back to the start, no way past`, r.ouch && r.minZ > row.z - 1 && Math.hypot(r.pos.x - r.start.x, r.pos.z - r.start.z) < 0.1 && JSON.stringify(r.msg).includes('Ouch'), r);
    }
}
if (!ONLY || ONLY === 'trench') {
    const cz = (p.gap.minZ + p.gap.maxZ) / 2;
    r = await page.evaluate(([g0, cz]) => {
        const g = window.__game;
        g.restore();
        g.teleport({ x: g0.minX - 1.5, z: cz, yaw: -Math.PI / 2 });
        g.clearEvents();
        g.setInput({ forward: true });
        let s;
        const at = {};
        const t0 = g.time();
        for (let k = 0; k < 400; k++) {
            s = g.step(1);
            for (const e of g.events) if (e.type === 'trench' && at[e.what] === undefined) at[e.what] = +(g.time() - t0).toFixed(2);
            if (g.events.some((e) => e.type === 'fall')) break;
            if (at.land !== undefined && g.time() - t0 > at.land + 0.3) break;
        }
        g.clearInput();
        return { at, pos: s.pos, fell: g.events.some((e) => e.type === 'fall') };
    }, [p.gap, cz]);
    check('trench heading east: drop, bounce, bounce, land on the far floor', !r.fell && r.at.drop !== undefined && r.at.land !== undefined && r.pos.x > p.gap.maxX + 0.5 && Math.abs(r.at.land - r.at.bounce - 2.5) < 0.1, { r, gap: p.gap });
}
if (!ONLY || ONLY === 'shots') {
    const look = async (name, a) => {
        await page.evaluate(([F, f, a]) => { const g = window.__game; const find = eval(F); g.restore(); g.teleport({ x: f.x + a.d, z: f.z, yaw: -Math.PI / 2 }); find(g, !a.bright); find(g, a.bright); g.teleport({ yaw: Math.PI / 2 }); g.step(a.extra ?? 12); }, [FIND, f, a]);
        await page.waitForTimeout(1500);
        await shot(name);
    };
    await look('dim', { d: 9, bright: false });
    await look('bright', { d: 9, bright: true });
    await look('bright-warning', { d: 9, bright: true, extra: 45 });
    await look('dim-close', { d: 4, bright: false });
    await look('bright-close', { d: 4, bright: true });
    await page.evaluate(([F, f]) => { const g = window.__game; const find = eval(F); g.restore(); g.teleport({ x: f.x + 9, z: f.z, yaw: Math.PI / 2 }); find(g, false); find(g, true); g.step(62); }, [FIND, f]);
    await page.waitForTimeout(150);
    await shot('ouch-flash');
    await page.waitForTimeout(1500);
    await shot('ouch-after');
    await page.evaluate(([row]) => { const g = window.__game; g.restore(); g.teleport({ x: row.x, z: row.z + 4, yaw: 0 }); g.step(10); }, [row]);
    await shot('big');
    await page.evaluate(([row]) => { const g = window.__game; g.restore(); g.teleport({ x: row.x + 1, z: row.z + 1.6, yaw: 0.4 }); g.step(10); }, [row]);
    await shot('big-close');
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
    await page2.goto(BASE + '/?test=1&level=142', { waitUntil: 'domcontentloaded', timeout: 90000 });
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
        return { escaped: s.escaped, items, fireflies: g.state().fireflies.length };
    });
    check('Level 143 door: Start Level 144; Level 143 has no firefly', r.escaped && r.items.some((x) => x.includes('Level 144')) && r.fireflies === 0, r);
    check('no page errors (prev)', errors.length === 0, errors);
}
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
