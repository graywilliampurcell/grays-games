// Level 114 checks (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
import { LEVELS } from '../../js/levels.js';
import fs from 'fs';
const SP = SHOTS;
fs.mkdirSync(SP, { recursive: true });
// The correct path as cells, from the layout
const L = LEVELS.find((l) => l.name === 'Level 114').layout;
const open = (x, z) => L[z] && L[z][x] && L[z][x] !== '#';
let S, Dd;
L.forEach((row, z) => [...row].forEach((c, x) => { if (c === 'S') S = [Math.floor(x / 4), Math.floor(z / 4)]; if (c === 'D') Dd = [10, Math.floor(z / 4)]; }));
const prev = new Map([[S.join(), null]]);
const q = [S];
while (q.length) {
    const [i, j] = q.shift();
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni > 10 || nj > 10 || prev.has([ni, nj].join())) continue;
        if (!open(4 * i + 2 + 2 * di, 4 * j + 2 + 2 * dj)) continue;
        prev.set([ni, nj].join(), [i, j]); q.push([ni, nj]);
    }
}
const path = [];
for (let c = Dd; c; c = prev.get(c.join())) path.unshift(c);
console.log('path length', path.length);
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1024, height: 640 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(BASE + '/?test=1&level=113', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
await page.keyboard.press('Shift');
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 700)); };
const shot = (name) => page.screenshot({ path: `${SP}l114-${name}.png`, timeout: 180000 });

let st = await page.evaluate(() => window.__game.restore());
check('Level 114 loads: one tail, one long-neck, one big bone spike, nothing else',
    st.level.name === 'Level 114' && st.tails.length === 1 && st.platforms.length === 1 && st.spikeRows.length === 1 && !st.spike && !st.spike2 && (st.fossils ?? []).length === 0 && !st.buttonDoor,
    { tails: st.tails.length, p: st.platforms.length, rows: st.spikeRows, spike: st.spike, f: st.fossils });
check('path length 71', path.length === 71, {});
check('tune dinobigbone', (await page.evaluate(() => window.__sound?.tuneName)) === 'dinobigbone', {});
const T = st.tails[0];
const ROW = st.spikeRows[0];
console.log('tail', JSON.stringify(T), 'row', JSON.stringify(ROW));

// Tail: lifted 2 s, swish 1 s
let r = await page.evaluate(() => {
    const g = window.__game;
    g.restore();
    const log = [];
    let last = g.state().tails[0];
    for (let i = 0; i < 100; i++) {
        const s = g.step(6).tails[0];
        if (s.phase !== last.phase) log.push({ t: g.time(), phase: s.phase, s: s.s });
        last = s;
    }
    return log;
});
const sw = r.filter((e) => e.phase === 'swish'), li = r.filter((e) => e.phase === 'lifted');
const t0 = sw[0].t < li[0].t ? 0 : 1;
check('tail lifted ~2 s, swish ~1 s, alternating', sw.length >= 2 && Math.abs(Math.abs(sw[1].t - sw[0].t) - 3) < 0.2 && Math.abs(sw[0].s - sw[1].s) > 1.5, r);

// Push back to Q, no Ouch
r = await page.evaluate((T) => {
    const g = window.__game;
    g.restore();
    let s = g.step(1);
    while (!(s.tails[0].phase === 'lifted' && s.tails[0].timer < 1.2)) s = g.step(3);
    g.teleport({ x: (T.minX + T.maxX) / 2, z: (T.minZ + T.maxZ) / 2, yaw: -Math.PI / 2 });
    g.clearEvents();
    s = g.step(120);
    return { end: s.pos, target: T.target, ev: g.events.map((e) => e.type + (e.name ? ':' + e.name : '')) };
}, T);
check('a swish pushes you back one cell (to Q), no Ouch, swoosh', r.ev.includes('tailPush') && !r.ev.includes('spike') && r.ev.includes('sound:swoosh') && Math.hypot(r.end.x - T.target.x, r.end.z - T.target.z) < 0.3, r);

// Walk across while lifted (heading east)
r = await page.evaluate((T) => {
    const g = window.__game;
    g.restore();
    let s = g.step(1);
    while (!(s.tails[0].phase === 'lifted' && s.tails[0].timer > 1.9)) s = g.step(1);
    g.teleport({ x: T.target.x, z: T.target.z, yaw: -Math.PI / 2 });
    g.clearEvents();
    g.setInput({ forward: true });
    const t0 = g.time();
    let crossed = null;
    for (let i = 0; i < 40; i++) { s = g.step(2); if (crossed === null && s.pos.x > T.maxX + 0.4) crossed = g.time() - t0; }
    g.clearInput();
    return { crossed, pushes: g.events.filter((e) => e.type === 'tailPush').length };
}, T);
check('walk across while lifted: no push, under 1 s', r.pushes === 0 && r.crossed !== null && r.crossed < 1, r);

// Tail pictures
await page.evaluate((T) => {
    const g = window.__game;
    g.restore();
    let s = g.step(1);
    while (!(s.tails[0].phase === 'lifted' && s.tails[0].timer < 0.1)) s = g.step(1);
    g.teleport({ x: T.target.x - 3, z: T.target.z, yaw: -Math.PI / 2 });
    g.step(30);
}, T);
await shot('swish');
await page.evaluate(() => window.__game.step(70));
await shot('lifted');

// Big bone spike: walking into it from either side is an Ouch
r = await page.evaluate((ROW) => {
    const g = window.__game;
    const out = [];
    const offs = ROW.spansX ? [[0, 2.5], [0, -2.5]] : [[2.5, 0], [-2.5, 0]];
    for (const [dx, dz] of offs) {
        g.restore();
        g.teleport({ x: ROW.x + dx, z: ROW.z + dz, yaw: Math.atan2(dx, dz) });
        g.clearEvents();
        g.setInput({ forward: true });
        for (let i = 0; i < 30; i++) g.step(2);
        g.clearInput();
        out.push(g.events.filter((e) => e.type === 'spike').length);
    }
    return out;
}, ROW);
check('big bone spike: Ouch from both sides', r.every((n) => n > 0), r);

// Seen from the correct path: path cell 17 and the cells around it
const k = 16;
const c = path[k];
const cx = 4 * c[0] + 2.5, cz = 4 * c[1] + 2.5;
console.log('path cell 17', c, 'row at', ROW);
const yaw = Math.atan2(-(ROW.x - cx), -(ROW.z - cz));
await page.evaluate(([cx, cz, yaw, px, pz]) => { const g = window.__game; g.restore(); g.teleport({ x: px, z: pz, yaw }); g.step(2); }, [cx, cz, yaw, 4 * path[k - 1][0] + 2.5, 4 * path[k - 1][1] + 2.5]);
await shot('bigbone-from-path');
// The opening must not stick into the path cell: distance from the row to path cell 17's centre >= 2
check('big bone spike sits inside its wrong way, not in the path cell', Math.hypot(ROW.x - cx, ROW.z - cz) >= 1.9, { cx, cz, row: ROW });

// Long-neck ride heading west
r = await page.evaluate(() => {
    const g = window.__game;
    g.restore();
    const p0 = g.state().platforms[0];
    const cz = (p0.gap.minZ + p0.gap.maxZ) / 2;
    g.teleport({ x: p0.gap.maxX + 1.0, z: cz, yaw: Math.PI / 2 });
    g.clearEvents();
    let s = g.step(10);
    g.setInput({ forward: true });
    for (let n = 0; n < 40 && !s.platforms[0].riding; n++) s = g.step(3);
    g.clearInput();
    const t0 = g.time();
    const riding = s.platforms[0].riding;
    for (let n = 0; n < 60 && !(s.pos.x < p0.gap.minX + 1.5 && s.platforms[0].phase === 'rest'); n++) s = g.step(10);
    const ride = g.time() - t0;
    g.setInput({ forward: true });
    s = g.step(40);
    g.clearInput();
    return { riding, ride, pos: s.pos, gap: p0.gap, buddy: s.buddy, ev: g.events.map((e) => e.type).filter((t) => t !== 'sound') };
});
check('rode the long-neck west across the pit', r.riding && !r.ev.includes('fall') && r.pos.x < r.gap.minX - 0.3, r);
await page.evaluate(() => { const g = window.__game; g.restore(); const p0 = g.state().platforms[0]; g.teleport({ x: p0.gap.maxX + 3, z: (p0.gap.minZ + p0.gap.maxZ) / 2, yaw: Math.PI / 2 }); g.step(2); });
await shot('longneck');
// Walking into the pit is a fall
r = await page.evaluate(() => {
    const g = window.__game;
    g.restore();
    const p0 = g.state().platforms[0];
    g.teleport({ x: p0.gap.minX - 1.0, z: (p0.gap.minZ + p0.gap.maxZ) / 2 + 0.0, yaw: -Math.PI / 2 });
    g.clearEvents();
    g.setInput({ forward: true });
    for (let i = 0; i < 40; i++) g.step(2);
    g.clearInput();
    return g.events.map((e) => e.type);
});
check('walking into the pit from the far side (long-neck away) is a fall', r.includes('fall'), r);

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

st = await page.evaluate(() => { const g = window.__game; g.restore(); return g.step(60 * 4).buddy; });
check('the buddy is in the level', !!st && st.visible, st);
await page.evaluate(() => { const g = window.__game; g.teleport({ yaw: 0 }); g.step(1); });
await shot('start');
check('no page errors', errors.length === 0, errors);
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
