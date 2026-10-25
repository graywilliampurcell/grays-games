// Level 121 checks (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
import { LEVELS } from '../../js/levels.js';
import fs from 'fs';
const SP = SHOTS;
fs.mkdirSync(SP, { recursive: true });
const N = 12;
const L = LEVELS.find((l) => l.name === 'Level 121').layout;
const open = (x, z) => L[z] && L[z][x] && L[z][x] !== '#';
let S, Dd;
L.forEach((row, z) => [...row].forEach((c, x) => { if (c === 'S') S = [Math.floor(x / 4), Math.floor(z / 4)]; if (c === 'D') Dd = [N - 1, Math.floor(z / 4)]; }));
const prev = new Map([[S.join(), null]]);
const q = [S];
while (q.length) {
    const [i, j] = q.shift();
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni > N - 1 || nj > N - 1 || prev.has([ni, nj].join())) continue;
        if (!open(4 * i + 2 + 2 * di, 4 * j + 2 + 2 * dj)) continue;
        prev.set([ni, nj].join(), [i, j]); q.push([ni, nj]);
    }
}
const path = [];
for (let c = Dd; c; c = prev.get(c.join())) path.unshift(c);
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1024, height: 640 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(BASE + '/?test=1&level=120', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
await page.keyboard.press('Shift');
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 900)); };
const shot = (name) => page.screenshot({ path: `${SP}l121-${name}.png`, timeout: 180000 });

let st = await page.evaluate(() => window.__game.restore());
check('Level 121 loads: one cannon gap with two cannons, the sneaky spike, nothing else',
    st.level.name === 'Level 121' && st.platforms.length === 1 && st.cannons.length === 2 && !!st.spike && !st.spike2 && st.spikeRows.length === 0 && st.tails.length === 0 && st.vents.length === 0 && (st.fossils ?? []).length === 0 && st.geysers.length === 0 && st.belts.length === 0 && !st.buttonDoor,
    { p: st.platforms, c: st.cannons, spike: st.spike, rows: st.spikeRows });
check('path length 79, gap span 15', path.length === 79 && st.platforms[0].span === 15, { len: path.length, span: st.platforms[0].span });
check('tune piratesneak', (await page.evaluate(() => window.__sound?.tuneName)) === 'piratesneak', {});
check('sneaky spike in cell (0,8)', Math.floor(st.spike.x / 4) === 0 && Math.floor(st.spike.z / 4) === 8, st.spike);
const C = ([i, j]) => [4 * i + 2.5, 4 * j + 2.5];
const near = C(path[58]); // the start side's cannon cell
const far = C(path[63]);
const yawE = -Math.PI / 2; // east (+x)
// Walk into the near cannon and keep holding forward: it stops you inside, fizzes ~1 s, fires, ~1.5 s flight, land in the far cannon
let r = await page.evaluate(([near, yawE]) => {
    const g = window.__game;
    g.restore();
    g.teleport({ x: near[0] - 3.5, z: near[1], yaw: yawE });
    g.clearEvents();
    g.setInput({ forward: true });
    let s = g.step(1);
    let tLoad = null, tFire = null, tLand = null, maxEye = 0, minX = 1e9, maxX = -1e9;
    for (let k = 0; k < 600; k++) {
        s = g.step(1);
        const ev = g.events.map((e) => e.type + ':' + (e.what ?? ''));
        if (tLoad === null && ev.includes('cannon:load')) tLoad = g.time();
        if (tFire === null && ev.includes('cannon:fire')) { tFire = g.time(); g.clearInput(); }
        if (tFire !== null) maxEye = Math.max(maxEye, s.eyeY);
        if (tLoad !== null && tFire === null) { minX = Math.min(minX, s.pos.x); maxX = Math.max(maxX, s.pos.x); }
        if (tFire !== null && !s.shoved) { tLand = g.time(); break; }
    }
    return { tLoad, tFire, tLand, fuse: tFire - tLoad, flight: tLand - tFire, pos: s.pos, maxEye, heldX: [minX, maxX], cannons: s.cannons, ev: g.events.filter((e) => e.type !== 'sound' || ['fizz', 'boom', 'splash'].includes(e.name)).map((e) => e.type + ':' + (e.what ?? e.name ?? '')) };
}, [near, yawE]);
check('cannon: fuse ~1 s (held inside), flight ~1.5 s high over the gap, land in the far cannon, no fall',
    Math.abs(r.fuse - 1) < 0.05 && Math.abs(r.flight - 1.5) < 0.05 && Math.hypot(r.pos.x - far[0] + 0.3, r.pos.z - far[1]) < 0.6 && r.maxEye > 6 && !r.ev.some((e) => e.startsWith('fall') || e.startsWith('waterFall')) && r.heldX[1] <= r.cannons[0].x + 0.85 && r.ev.includes('sound:fizz') && r.ev.includes('sound:boom'), { ...r, near, far });
// After landing, walk on out of the far cannon: it doesn't fire again (you have to step out first)
r = await page.evaluate(([yawE]) => {
    const g = window.__game;
    g.clearEvents();
    g.setInput({ forward: true });
    let s = g.step(30);
    g.clearInput();
    s = g.step(90);
    return { pos: s.pos, cannons: s.cannons, ev: g.events.filter((e) => e.type === 'cannon').map((e) => e.what) };
}, [yawE]);
check('walking on out of the far cannon: no new fuse', r.ev.length === 0 && r.pos.x > far[0] + 1, r);
// Back the other way: into the far cannon heading west, it fires you back to the near one
r = await page.evaluate(([far]) => {
    const g = window.__game;
    g.teleport({ x: far[0] + 3.5, z: far[1], yaw: Math.PI / 2 });
    g.clearEvents();
    g.setInput({ forward: true });
    let s;
    let fired = false;
    for (let k = 0; k < 600; k++) {
        s = g.step(1);
        if (!fired && g.events.some((e) => e.type === 'cannon' && e.what === 'fire')) { fired = true; g.clearInput(); }
        if (fired && !s.shoved) break;
    }
    s = g.step(5);
    return { fired, pos: s.pos, ev: g.events.filter((e) => ['cannon', 'fall', 'waterFall'].includes(e.type)).map((e) => e.type + ':' + (e.what ?? '')) };
}, [far]);
check('works the other way too (far cannon fires you back)', r.fired && Math.hypot(r.pos.x - near[0], r.pos.z - near[1]) < 0.6 && !r.ev.some((e) => e.startsWith('fall')), r);
// Step out before it fires: cancelled, nothing happens
r = await page.evaluate(([near, yawE]) => {
    const g = window.__game;
    g.restore();
    g.teleport({ x: near[0] - 2.5, z: near[1], yaw: yawE });
    g.clearEvents();
    g.setInput({ forward: true });
    let s;
    for (let k = 0; k < 120 && !g.events.some((e) => e.type === 'cannon'); k++) s = g.step(1);
    s = g.step(10);
    g.setInput({ back: true });
    s = g.step(25);
    g.clearInput();
    s = g.step(120);
    return { pos: s.pos, ev: g.events.filter((e) => e.type === 'cannon').map((e) => e.what), cannons: s.cannons };
}, [near, yawE]);
check('stepping out before it fires cancels it', r.ev.includes('load') && r.ev.includes('cancel') && !r.ev.includes('fire') && r.pos.x < near[0], r);
// Shot: standing behind the near cannon, looking across the gap
await page.evaluate(([near, yawE]) => { const g = window.__game; g.restore(); g.teleport({ x: near[0] - 4.5, z: near[1], yaw: yawE }); g.step(2); }, [near, yawE]);
await shot('cannon');
// Shot: inside the cannon
await page.evaluate(([near, yawE]) => { const g = window.__game; g.teleport({ x: near[0] - 0.3, z: near[1], yaw: yawE }); g.step(20); }, [near, yawE]);
await shot('in-cannon');
// Mid-flight shot
await page.evaluate(() => { const g = window.__game; let s = g.step(1); for (let k = 0; k < 200 && !g.events.some((e) => e.type === 'cannon' && e.what === 'fire'); k++) s = g.step(1); g.step(40); });
await shot('flight');
// The water fall: land in the far cannon, turn round and walk out of its mouth into the water
r = await page.evaluate(([far]) => {
    const g = window.__game;
    let s = g.step(1);
    for (let k = 0; k < 200 && s.shoved; k++) s = g.step(1);
    g.teleport({ yaw: Math.PI / 2 });
    g.clearEvents();
    g.setInput({ forward: true });
    let tStart = null, tSplash = null, tFall = null, minEye = 99;
    for (let k = 0; k < 400; k++) {
        s = g.step(1);
        const ev = g.events.map((e) => e.type);
        if (tStart === null && ev.includes('waterFall')) { tStart = g.time(); g.clearInput(); }
        if (tStart !== null) minEye = Math.min(minEye, s.eyeY);
        if (tSplash === null && ev.includes('splash')) tSplash = g.time();
        if (ev.includes('fall')) { tFall = g.time(); break; }
    }
    return { tStart, tSplash, tFall, minEye, pos: s.pos, start: s.start, msg: g.text(), sounds: g.events.filter((e) => e.type === 'sound').map((e) => e.name) };
}, [far]);
check('water fall: falls ~1.5 s down to the sea, splash, then Ouch! Splash! Back to the start.',
    r.tStart !== null && Math.abs(r.tSplash - r.tStart - 1.5) < 0.05 && r.tFall - r.tSplash > 0.6 && r.minEye < -6 && Math.hypot(r.pos.x - r.start.x, r.pos.z - r.start.z) < 0.1 && JSON.stringify(r.msg).includes('Ouch! Splash! Back to the start.') && r.sounds.includes('splash') && r.sounds.includes('ouch'), r);
// Shots of the fall and the splash
await page.evaluate(([far]) => {
    const g = window.__game;
    g.teleport({ x: far[0] - 4, z: far[1], yaw: Math.PI / 2 });
    g.setInput({ forward: true });
    for (let k = 0; k < 200 && !g.events.some((e) => e.type === 'waterFall'); k++) g.step(1);
    g.clearInput();
    g.step(55);
}, [far]);
await shot('falling');
await page.evaluate(() => { const g = window.__game; g.step(40); });
await shot('splash');
await page.evaluate(() => { const g = window.__game; g.step(60); });
// Pause freezes the fall
r = await page.evaluate(([far]) => {
    const g = window.__game;
    g.restore();
    g.teleport({ x: far[0] - 4, z: far[1], yaw: Math.PI / 2 });
    g.clearEvents();
    g.setInput({ forward: true });
    let s;
    for (let k = 0; k < 200 && !g.events.some((e) => e.type === 'waterFall'); k++) s = g.step(1);
    g.clearInput();
    s = g.step(20);
    return { eye: s.eyeY };
}, [far]);
const eye0 = r.eye;
await page.keyboard.press('Space');
await page.evaluate(() => window.__game.setRealtime(true));
await page.waitForTimeout(1500);
const paused = await page.evaluate(() => window.__game.state().eyeY);
await page.keyboard.press('Space');
await page.waitForTimeout(300);
await page.evaluate(() => window.__game.setRealtime(false));
check('pause freezes the fall', Math.abs(paused - eye0) < 0.01, { eye0, paused });
await page.evaluate(() => { const g = window.__game; g.step(120); });
// The sneaky splinter spike
r = await page.evaluate((spike) => {
    const g = window.__game;
    g.restore();
    g.teleport({ x: spike.x + 0.9, z: spike.z, yaw: Math.PI / 2 });
    g.clearEvents();
    g.setInput({ forward: true });
    let s;
    for (let k = 0; k < 60 && !g.events.some((e) => e.type === 'spike'); k++) s = g.step(2);
    g.clearInput();
    return { ev: g.events.map((e) => e.type), msg: g.text() };
}, st.spike);
check('sneaky splinter spike: Ouch', r.ev.includes('spike') && JSON.stringify(r.msg).includes('Ouch!'), r);
await page.evaluate((spike) => { const g = window.__game; g.restore(); g.teleport({ x: spike.x + 1.2, z: spike.z, yaw: Math.PI / 2 }); g.step(2); }, st.spike);
await shot('spike');
// Through the door
r = await page.evaluate((last) => {
    const g = window.__game;
    g.restore();
    g.teleport({ x: 4 * last[0] + 2.5 - 1, z: 4 * last[1] + 2.5, yaw: -Math.PI / 2 });
    g.setInput({ forward: true });
    let s;
    for (let i = 0; i < 40; i++) { s = g.step(2); if (s.escaped) break; }
    g.clearInput();
    g.step(30);
    return { escaped: s.escaped, text: g.text() };
}, path[path.length - 1]);
check('door: escape, More levels coming soon!', r.escaped && JSON.stringify(r.text).match(/More levels coming soon|Start (Level [0-9]+|[A-Z][a-zA-Z ]* World)/) !== null, r);
await page.evaluate(() => { const g = window.__game; g.restore(); g.teleport({ yaw: -Math.PI / 2 }); g.step(1); });
await shot('start');
await page.evaluate(() => { const g = window.__game; g.teleport({ yaw: -Math.PI / 2 }); g.getPlayer?.(); });
check('no page errors', errors.length === 0, errors);
// Level 120's finale screen: Start Pirate Ship World above Quit, no "More levels coming soon!"
const page2 = await ctx.newPage();
page2.on('pageerror', (e) => errors.push(String(e)));
await page2.goto(BASE + '/?test=1&level=119', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page2.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
r = await page2.evaluate(() => {
    const g = window.__game;
    const m = g.maze();
    m.setFossils?.([0, 1, 2]);
    const d = m.doorPosition;
    g.teleport({ x: d.x - 1.8, z: d.z, yaw: -Math.PI / 2 });
    g.setInput({ forward: true });
    let s;
    for (let i = 0; i < 40; i++) { s = g.step(2); if (s.escaped) break; }
    g.clearInput();
    g.step(30);
    const items = [...document.querySelectorAll('#menu-finish .item')].filter((e) => !e.hidden).map((e) => e.textContent);
    return { escaped: s.escaped, items, note: !document.getElementById('finish-note').hidden, title: document.getElementById('finish-title').textContent };
});
check('Level 120 finale: Start Pirate Ship World above Quit, no coming-soon line', r.escaped && r.items[0] === 'Start Pirate Ship World' && r.items.includes('Quit') && !r.note && r.title === 'You beat Dinosaur World!', r);
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
