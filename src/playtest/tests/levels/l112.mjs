// Level 112 checks (vite preview on 9173)
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
await page.goto(BASE + '/?test=1&level=111', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
await page.keyboard.press('Shift');
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 700)); };
const shot = (name) => page.screenshot({ path: `${SP}l112-${name}.png`, timeout: 180000 });

let st = await page.evaluate(() => window.__game.state());
check('Level 112 loads: one tail swish, one path bone spike, nothing else',
    st.level.name === 'Level 112' && st.tails.length === 1 && st.vents.length === 0 && !!st.spike && !st.spike2 && st.platforms.length === 0 && st.spikeRows.length === 0 && !st.buttonDoor,
    { tails: st.tails, spike: st.spike, level: st.level.name, buddy: st.buddy?.mode });
check('tune dinotail', (await page.evaluate(() => window.__sound?.tuneName)) === 'dinotail', {});
const T = st.tails[0];
console.log('tail', JSON.stringify(T));

// Cycle timing: lifted 2 s, swish 1 s, alternating sides
let r = await page.evaluate(() => {
    const g = window.__game;
    g.restore();
    g.teleport({ x: 3, z: 10.5 });
    const log = [];
    let last = g.state().tails[0];
    for (let i = 0; i < 60 * 10 / 6; i++) {
        const s = g.step(6).tails[0];
        if (s.phase !== last.phase) log.push({ t: g.time(), phase: s.phase, s: s.s });
        last = s;
    }
    return log;
});
const swishes = r.filter((e) => e.phase === 'swish');
const lifts = r.filter((e) => e.phase === 'lifted');
const lifted = swishes.length > 1 ? swishes[1].t - lifts[0].t : NaN;
const swishTime = lifts[0].t - swishes[0].t;
check('lifted about 2 s, swish about 1 s', Math.abs(lifted - 2) < 0.15 && Math.abs(swishTime - 1) < 0.15, { r, lifted, swishTime });
check('each swish starts from the opposite wall', swishes.length >= 2 && Math.abs(swishes[0].s - swishes[1].s) > 1.5, swishes);

// Standing in the tail's cell when it swishes: pushed back one cell (to Q), no Ouch
r = await page.evaluate((T) => {
    const g = window.__game;
    g.restore();
    const cx = (T.minX + T.maxX) / 2, cz = (T.minZ + T.maxZ) / 2;
    // wait until the tail is lifted with ~1 s left, then stand in the middle of its cell
    let s = g.step(1);
    while (!(s.tails[0].phase === 'lifted' && s.tails[0].timer < 1.2)) s = g.step(3);
    g.teleport({ x: cx, z: cz, yaw: 0 });
    g.clearEvents();
    s = g.step(120);
    return { end: s.pos, events: g.events.filter((e) => ['tailPush', 'spike', 'swish', 'sound', 'reset'].includes(e.type)).map((e) => ({ t: e.t, type: e.type, name: e.name })) };
}, T);
check('a swish pushes you one cell back to the cell before (not an Ouch)',
    r.events.some((e) => e.type === 'tailPush') && !r.events.some((e) => e.type === 'spike') && Math.hypot(r.end.x - T.target.x, r.end.z - T.target.z) < 0.3,
    r);
check('soft swoosh plays', r.events.some((e) => e.type === 'sound' && e.name === 'swoosh'), r.events);

// Shot: the tail mid-swish from the cell before, looking at it
await page.evaluate((T) => {
    const g = window.__game;
    g.restore();
    let s = g.step(1);
    while (!(s.tails[0].phase === 'lifted' && s.tails[0].timer < 0.1)) s = g.step(1);
    g.teleport({ x: T.target.x, z: T.target.z + 3, yaw: 0 });
    g.step(30);
}, T);
await shot('swish-mid');
await page.evaluate(() => window.__game.step(70));
await shot('lifted');
// From the far side, looking back
await page.evaluate((T) => {
    const g = window.__game;
    g.teleport({ x: (T.minX + T.maxX) / 2, z: T.minZ - 6, yaw: Math.PI });
    let s = g.step(1);
    while (!(s.tails[0].phase === 'swish' && s.tails[0].timer < 0.6)) s = g.step(1);
}, T);
await shot('swish-far');
await page.evaluate((T) => {
    const g = window.__game;
    g.teleport({ x: (T.minX + T.maxX) / 2, z: T.target.z + 1, yaw: 0 });
    g.setInput({ lookDy: -200 });
    g.step(1);
    g.setInput({});
    let s = g.step(1);
    while (!(s.tails[0].phase === 'lifted' && s.tails[0].timer < 1.5)) s = g.step(1);
}, T);
await shot('lifted-up');

// Walking across while it's lifted: no push, and well under the lifted time
r = await page.evaluate((T) => {
    const g = window.__game;
    g.restore();
    g.teleport({ yaw: 0 });
    let s = g.step(1);
    while (!(s.tails[0].phase === 'lifted' && s.tails[0].timer > 1.9)) s = g.step(1);
    g.teleport({ x: (T.minX + T.maxX) / 2, z: T.target.z, yaw: 0 });
    g.clearEvents();
    g.setInput({ forward: true });
    const t0 = g.time();
    let crossed = null;
    for (let i = 0; i < 40; i++) {
        s = g.step(2);
        if (crossed === null && s.pos.z < T.minZ - 0.4) crossed = g.time() - t0;
    }
    g.clearInput();
    return { crossed, end: s.pos, pushes: g.events.filter((e) => e.type === 'tailPush').length };
}, T);
check('walking across while lifted: no push, crossing well under 2 s', r.pushes === 0 && r.crossed !== null && r.crossed < 1, r);

// Pause freezes the cycle
await page.evaluate(() => { window.__game.setRealtime(true); document.querySelector('#pause-btn').click(); });
await page.waitForTimeout(300);
r = await page.evaluate(() => window.__game.state().tails[0]);
await page.waitForTimeout(2500);
const paused = await page.evaluate(() => ({ ...window.__game.state().tails[0], body: document.body.className }));
await page.evaluate(() => [...document.querySelectorAll('#menu-main .item')].find((i) => i.dataset.act === 'resume').click());
await page.waitForTimeout(1000);
const running = await page.evaluate(() => { const t = window.__game.state().tails[0]; window.__game.setRealtime(false); return t; });
check('...and it runs again after Continue', running.timer !== paused.timer || running.phase !== paused.phase, running);
check('pause keeps the tail still', Math.abs(paused.timer - r.timer) < 0.05 && paused.phase === r.phase, { r, paused });

// Path bone spike: squeeze past on each side without an Ouch; touching it is an Ouch
r = await page.evaluate(() => {
    const g = window.__game;
    const out = [];
    const sp = g.state().spike;
    for (const side of [-1, 1]) {
        g.restore();
        g.step(30);
        g.teleport({ x: sp.x + 4, z: sp.z + side * 1.08, yaw: Math.PI / 2 });
        g.clearEvents();
        g.setInput({ forward: true });
        let s;
        for (let i = 0; i < 40; i++) s = g.step(2);
        g.clearInput();
        out.push({ side, x: s.pos.x, z: s.pos.z, ouch: g.events.filter((e) => e.type === 'spike').length });
    }
    g.restore();
    g.step(30);
    g.teleport({ x: sp.x + 3, z: sp.z, yaw: Math.PI / 2 });
    g.clearEvents();
    g.setInput({ forward: true });
    for (let i = 0; i < 40; i++) g.step(2);
    g.clearInput();
    out.push({ middle: true, ouch: g.events.filter((e) => e.type === 'spike').length });
    return { sp, out };
});
check('path bone spike: squeeze past both sides, Ouch in the middle', r.out[0].ouch === 0 && r.out[1].ouch === 0 && r.out[0].x < r.sp.x - 2 && r.out[1].x < r.sp.x - 2 && r.out[2].ouch > 0, r);
await page.evaluate(() => { const g = window.__game; const sp = g.state().spike; g.restore(); g.teleport({ x: sp.x + 6, z: sp.z, yaw: Math.PI / 2 }); g.step(2); });
await shot('bonespike');

// The buddy is here
st = await page.evaluate(() => { const g = window.__game; g.restore(); return g.step(60 * 4).buddy; });
check('the buddy is in the level', !!st && st.visible, st);
await page.evaluate(() => { const g = window.__game; g.teleport({ yaw: Math.PI }); g.step(1); });
await shot('start');

check('no page errors', errors.length === 0, errors);
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
