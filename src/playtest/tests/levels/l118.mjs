// Level 118 checks (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
import { LEVELS } from '../../js/levels.js';
import fs from 'fs';
const SP = SHOTS;
fs.mkdirSync(SP, { recursive: true });
// The correct path as cells, from the layout
const L = LEVELS.find((l) => l.name === 'Level 118').layout;
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
await page.goto(BASE + '/?test=1&level=117', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
await page.keyboard.press('Shift');
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 700)); };
const shot = (name) => page.screenshot({ path: `${SP}l118-${name}.png`, timeout: 180000 });

let st = await page.evaluate(() => window.__game.restore());
check('Level 118 loads: two long-necks, one tail, no spikes, no fossils',
    st.level.name === 'Level 118' && st.tails.length === 1 && st.platforms.length === 2 && st.platforms.every((p) => p.longNeck !== false) && st.spikeRows.length === 0 && !st.spike && !st.spike2 && (st.fossils ?? []).length === 0 && !st.buttonDoor && !st.doorLocked,
    { tails: st.tails.length, p: st.platforms, rows: st.spikeRows, spike: st.spike, f: st.fossils });
check('path length 49', path.length === 49, {});
check('tune dinotwonecks', (await page.evaluate(() => window.__sound?.tuneName)) === 'dinotwonecks', {});
const C = ([i, j]) => [4 * i + 2.5, 4 * j + 2.5];
// pits: path cells 22-24 and 35-37 (1-based)
const pits = [[21, 23], [34, 36]];
for (const [n, [a, b]] of pits.entries()) {
    const before = C(path[a - 1]), after = C(path[b + 1]);
    const dx = Math.sign(path[a][0] - path[a - 1][0]), dz = Math.sign(path[a][1] - path[a - 1][1]);
    const yaw = Math.atan2(-dx, -dz);
    const r = await page.evaluate(([n, before, after, yaw]) => {
        const g = window.__game;
        g.restore();
        g.teleport({ x: before[0], z: before[1], yaw });
        g.clearEvents();
        let s = g.step(10);
        const other0 = JSON.stringify(s.platforms[1 - n].pos ?? s.platforms[1 - n]);
        g.setInput({ forward: true });
        for (let k = 0; k < 40 && !s.platforms[n].riding; k++) s = g.step(3);
        g.clearInput();
        const riding = s.platforms[n].riding;
        const t0 = g.time();
        let off = null;
        const gp = s.platforms[n].gap;
        const farD = (q) => Math.hypot(q.x - after[0], q.z - after[1]);
        for (let k = 0; k < 120; k++) { s = g.step(3); if (farD(s.pos) < 4.2 && s.platforms[n].phase === 'rest') { off = g.time() - t0; break; } }
        const other1 = JSON.stringify(s.platforms[1 - n].pos ?? s.platforms[1 - n]);
        g.setInput({ forward: true });
        s = g.step(40);
        g.clearInput();
        return { riding, ride: off, pos: s.pos, after, otherStill: other0 === other1, ev: g.events.map((e) => e.type).filter((t) => t !== 'sound') };
    }, [n, before, after, yaw]);
    check(`long-neck ${n + 1}: ride across the pit, no fall, other long-neck stays put`, r.riding && !r.ev.includes('fall') && Math.hypot(r.pos.x - r.after[0], r.pos.z - r.after[1]) < 2.2 && r.otherStill, r);
    await page.evaluate(([before, yaw, dx, dz]) => { const g = window.__game; g.restore(); g.teleport({ x: before[0] - dx * 2, z: before[1] - dz * 2, yaw }); g.step(2); }, [before, yaw, dx, dz]);
    await shot(`longneck${n + 1}`);
    // falling in from the far side (its long-neck waits at the start side)
    const f = await page.evaluate(([after, yaw]) => {
        const g = window.__game;
        g.restore();
        g.teleport({ x: after[0], z: after[1], yaw: yaw + Math.PI });
        g.clearEvents();
        g.setInput({ forward: true });
        for (let i = 0; i < 40; i++) g.step(2);
        g.clearInput();
        return g.events.map((e) => e.type);
    }, [after, yaw]);
    check(`long-neck ${n + 1}: walking into the pit from the far side is a fall`, f.includes('fall'), f);
}

// Tail
const T = st.tails[0];
{
    const cx = (T.minX + T.maxX) / 2, cz = (T.minZ + T.maxZ) / 2;
    const dx = Math.sign(Math.round(cx - T.target.x)), dz = Math.sign(Math.round(cz - T.target.z));
    const yaw = Math.atan2(-dx, -dz);
    let r = await page.evaluate(() => {
        const g = window.__game;
        g.restore();
        const log = [];
        let last = g.state().tails[0];
        for (let i = 0; i < 100; i++) { const s = g.step(6).tails[0]; if (s.phase !== last.phase) log.push({ t: g.time(), phase: s.phase, s: s.s }); last = s; }
        return log;
    });
    const sw = r.filter((e) => e.phase === 'swish');
    check('tail: lifted ~2 s, swish ~1 s, alternating', sw.length >= 2 && Math.abs(Math.abs(sw[1].t - sw[0].t) - 3) < 0.2 && Math.abs(sw[0].s - sw[1].s) > 1.5, r);
    r = await page.evaluate(([cx, cz, yaw]) => {
        const g = window.__game;
        g.restore();
        let s = g.step(1);
        while (!(s.tails[0].phase === 'lifted' && s.tails[0].timer < 1.2)) s = g.step(3);
        g.teleport({ x: cx, z: cz, yaw });
        g.clearEvents();
        s = g.step(120);
        return { end: s.pos, ev: g.events.map((e) => e.type + (e.name ? ':' + e.name : '')) };
    }, [cx, cz, yaw]);
    check('tail: a swish pushes you back one cell (to Q), no Ouch, swoosh', r.ev.includes('tailPush') && !r.ev.includes('spike') && r.ev.includes('sound:swoosh') && Math.hypot(r.end.x - T.target.x, r.end.z - T.target.z) < 0.3, r);
    r = await page.evaluate(([T, yaw, dx, dz]) => {
        const g = window.__game;
        g.restore();
        let s = g.step(1);
        while (!(s.tails[0].phase === 'lifted' && s.tails[0].timer > 1.9)) s = g.step(1);
        g.teleport({ x: T.target.x, z: T.target.z, yaw });
        g.clearEvents();
        g.setInput({ forward: true });
        const t0 = g.time();
        let crossed = null;
        for (let i = 0; i < 40; i++) {
            s = g.step(2);
            const past = dx > 0 ? s.pos.x > T.maxX + 0.4 : dx < 0 ? s.pos.x < T.minX - 0.4 : dz > 0 ? s.pos.z > T.maxZ + 0.4 : s.pos.z < T.minZ - 0.4;
            if (crossed === null && past) crossed = g.time() - t0;
        }
        g.clearInput();
        return { crossed, pushes: g.events.filter((e) => e.type === 'tailPush').length };
    }, [T, yaw, dx, dz]);
    check('tail: walk across while lifted: no push, under 1 s', r.pushes === 0 && r.crossed !== null && r.crossed < 1, r);
    await page.evaluate(([T, yaw, dx, dz]) => {
        const g = window.__game;
        g.restore();
        let s = g.step(1);
        while (!(s.tails[0].phase === 'lifted' && s.tails[0].timer < 0.1)) s = g.step(1);
        g.teleport({ x: T.target.x - dx * 2, z: T.target.z - dz * 2, yaw });
        g.step(30);
    }, [T, yaw, dx, dz]);
    await shot('tail-swish');
}

// Through the door
let r = await page.evaluate((last) => {
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
await page.evaluate(() => { const g = window.__game; g.teleport({ yaw: -Math.PI / 2 }); g.step(1); });
await shot('start');
check('no page errors', errors.length === 0, errors);
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
