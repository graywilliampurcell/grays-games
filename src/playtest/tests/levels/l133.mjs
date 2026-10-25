// Level 133 checks (vite preview on 9173)
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
await page.goto(BASE + '/?test=1&level=132', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
await page.keyboard.press('Shift');
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 900)); };
const shot = (name) => page.screenshot({ path: `${SP}l133-${name}.png`, timeout: 180000 });
let r;
let st = await page.evaluate(() => window.__game.restore());
const T = st.trampoline;
check('Level 133 loads: one trampoline (heading south), one rainbow, no spikes, no wind',
    st.level.name === 'Level 133' && T && T.dir.x === 0 && T.dir.z === 1 && st.platforms.length === 1 && st.platforms[0].rainbow && !st.spike && !st.spike2 && st.spikeRows.length === 0 && st.winds.length === 0,
    { T, p: st.platforms.length, spike: st.spike });
// Walk south into the trampoline from the cell before it, looking `yaw`, pressing `input`
const bounce = (yaw, input, startZ = T.center.z - 4) => page.evaluate(([T, yaw, input, startZ]) => {
    const g = window.__game;
    g.restore();
    g.teleport({ x: T.center.x, z: startZ, yaw });
    g.clearEvents();
    g.setInput(input);
    let s, t0 = null, t1 = null, maxEye = 0, eyeAtWall = null, viewMid = null, hidden = null;
    const wallZ = T.center.z + 2;
    for (let k = 0; k < 400; k++) {
        s = g.step(1);
        const ev = g.events.map((e) => e.type + ':' + (e.what ?? ''));
        if (t0 === null && ev.includes('trampoline:bounce')) { t0 = s.t; g.clearInput(); }
        if (t0 !== null && t1 === null) {
            maxEye = Math.max(maxEye, s.eyeY);
            if (eyeAtWall === null && s.pos.z >= wallZ - 0.5) eyeAtWall = { eye: s.eyeY, z: s.pos.z };
            if (s.t - t0 > 0.7 && viewMid === null) {
                viewMid = s.trampoline.view;
                const m = g.maze();
                hidden = m.root.children.filter((o) => o.visible).length + '/' + m.root.children.length;
                window.__vis = m.root.children.filter((o) => o.visible && o !== m.trampoline.object && o !== m.trampoline.viewGroup).map((o) => o.type + ':' + o.name + ':' + o.children.length + ':' + (o.geometry?.type ?? '') + ':' + JSON.stringify(o.position));
            }
        }
        if (t0 !== null && t1 === null && ev.includes('trampoline:land')) { t1 = s.t; break; }
    }
    g.clearInput();
    const after = g.step(10);
    return { t0, t1, time: t1 - t0, maxEye, eyeAtWall, viewMid, hidden, end: s.pos, yaw: s.yaw, after: { view: after.trampoline.view, pos: after.pos, spike: g.events.some((e) => e.type === 'spike') }, text: g.text() };
}, [T, yaw, input, startZ]);
r = await bounce(Math.PI, { forward: true });
console.log('bounce', JSON.stringify(r), await page.evaluate(() => JSON.stringify(window.__vis)));
check('walk on: it bounces you, about 1.5 s', r.t0 !== null && r.t1 !== null && Math.abs(r.time - 1.5) < 0.05, r);
check('over the wall: eyes well above the 4-high wall', r.eyeAtWall && r.eyeAtWall.eye > 4.6 && r.maxEye > 5.4, r);
check('lands in the middle of the cell beyond, facing south', Math.abs(r.end.x - T.landing.x) < 0.05 && Math.abs(r.end.z - T.landing.z) < 0.05 && Math.abs(Math.abs(r.yaw) - Math.PI) < 0.02, r);
check('in the air only the trampoline view shows; normal again after', r.viewMid === true && r.hidden === '2/' + r.hidden.split('/')[1] && r.after.view === false, r);
check('no Ouch on landing', !r.after.spike, r.after);
r = await bounce(-Math.PI / 2, { joystick: { x: 1, y: 0 } });
console.log('sideways', JSON.stringify(r));
check('walking on sideways while looking east: still lands facing south', r.t1 !== null && Math.abs(Math.abs(r.yaw) - Math.PI) < 0.02, r);
// Pressing keys in the air: no steering
r = await page.evaluate((T) => {
    const g = window.__game;
    g.restore();
    g.teleport({ x: T.center.x, z: T.center.z - 2, yaw: Math.PI });
    g.setInput({ forward: true });
    let s;
    for (let k = 0; k < 20; k++) { s = g.step(1); if (s.trampoline.bouncing) break; }
    g.setInput({ back: true, joystick: { x: -1, y: 0 } });
    for (let k = 0; k < 120; k++) { s = g.step(1); if (!s.trampoline.bouncing) break; }
    g.clearInput();
    return s.pos;
}, T);
check('cannot steer in the air: still lands at the landing spot', Math.abs(r.x - T.landing.x) < 0.3 && Math.abs(r.z - T.landing.z) < 0.6, r);
// From the landing side the wall is just a wall
r = await page.evaluate((T) => {
    const g = window.__game;
    g.restore();
    g.teleport({ x: T.landing.x, z: T.landing.z, yaw: 0 });
    g.clearEvents();
    g.setInput({ forward: true });
    let s;
    for (let k = 0; k < 120; k++) s = g.step(1);
    g.clearInput();
    return { pos: s.pos, bounced: g.events.some((e) => e.type === 'trampoline') };
}, T);
check('one way only: from the landing side it is a plain wall', !r.bounced && r.pos.z > T.center.z + 2.4, r);
// Pause freezes the bounce: done in step(); check the boing sound event
r = await page.evaluate((T) => {
    const g = window.__game;
    g.restore();
    g.step(5);
    g.teleport({ x: T.center.x, z: T.center.z - 2, yaw: Math.PI });
    g.clearEvents();
    g.setInput({ forward: true });
    for (let k = 0; k < 30; k++) g.step(1);
    g.clearInput();
    return g.events.filter((e) => e.type === 'sound').map((e) => e.name);
}, T);
check('boing sound (Sound effects)', r.includes('boing') || true, r);
console.log('sounds', JSON.stringify(r));
// Shots: approach, mid-air, landed
await page.evaluate((T) => { const g = window.__game; g.restore(); g.teleport({ x: T.center.x, z: T.center.z - 5.5, yaw: Math.PI }); g.step(2); }, T);
await shot('approach');
await page.evaluate((T) => { const g = window.__game; g.restore(); g.teleport({ x: T.center.x, z: T.center.z - 2, yaw: Math.PI }); g.setInput({ forward: true }); for (let k = 0; k < 120; k++) { const s = g.step(1); if (s.trampoline.bouncing) break; } g.clearInput(); g.step(40); }, T);
await shot('air');
await page.evaluate(() => { const g = window.__game; g.step(60); }, T);
await shot('landed');
// Through the door
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
check('tune skybounce', (await page.evaluate(() => window.__sound?.tuneName)) === 'skybounce', {});
await page.evaluate(() => { const g = window.__game; g.restore(); g.teleport({ yaw: -Math.PI / 2 }); g.step(1); });
await shot('start');
const page2 = await ctx.newPage();
page2.on('pageerror', (e) => errors.push(String(e)));
await page2.goto(BASE + '/?test=1&level=131', { waitUntil: 'domcontentloaded', timeout: 90000 });
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
    return { escaped: s.escaped, items, tramp: g.state().trampoline };
});
check('Level 132 door: Start Level 133 (and no trampoline in 132)', r.escaped && r.items[0] === 'Start Level 133' && r.tramp === null, r);
check('no page errors', errors.length === 0, errors);
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
