// Level 115 checks (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
import { LEVELS } from '../../js/levels.js';
import fs from 'fs';
const SP = SHOTS;
fs.mkdirSync(SP, { recursive: true });
// The correct path as cells, from the layout
const L = LEVELS.find((l) => l.name === 'Level 115').layout;
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
await page.goto(BASE + '/?test=1&level=114', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
await page.keyboard.press('Shift');
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 700)); };
const shot = (name) => page.screenshot({ path: `${SP}l115-${name}.png`, timeout: 180000 });


let st = await page.evaluate(() => window.__game.restore());
check('Level 115 loads: two tails, one sneaky bone spike, nothing else',
    st.level.name === 'Level 115' && st.tails.length === 2 && st.platforms.length === 0 && st.spikeRows.length === 0 && !!st.spike && !st.spike2 && (st.fossils ?? []).length === 0 && !st.buttonDoor,
    { tails: st.tails.length, p: st.platforms.length, rows: st.spikeRows, spike: st.spike, f: st.fossils });
check('path length 66', path.length === 66, {});
check('tune dinotwotails', (await page.evaluate(() => window.__sound?.tuneName)) === 'dinotwotails', {});
console.log('tails', JSON.stringify(st.tails), 'spike', JSON.stringify(st.spike));

// Both cycles: lifted 2 s, swish 1 s, alternating; independent (out of step)
let r = await page.evaluate(() => {
    const g = window.__game;
    g.restore();
    const log = [[], []];
    let last = g.state().tails;
    for (let i = 0; i < 100; i++) {
        const s = g.step(6).tails;
        s.forEach((t, n) => { if (t.phase !== last[n].phase) log[n].push({ t: g.time(), phase: t.phase, s: t.s }); });
        last = s;
    }
    return log;
});
for (const n of [0, 1]) {
    const sw = r[n].filter((e) => e.phase === 'swish');
    check(`tail ${n + 1}: lifted ~2 s, swish ~1 s, alternating`, sw.length >= 2 && Math.abs(Math.abs(sw[1].t - sw[0].t) - 3) < 0.2 && Math.abs(sw[0].s - sw[1].s) > 1.5, r[n]);
}
const s0 = r[0].find((e) => e.phase === 'swish').t, s1 = r[1].find((e) => e.phase === 'swish').t;
check('the two tails swish at different times (own cycles)', Math.abs(s0 - s1) > 0.5, { s0, s1 });

for (const n of [0, 1]) {
    const T = st.tails[n];
    const cx = (T.minX + T.maxX) / 2, cz = (T.minZ + T.maxZ) / 2;
    const dx = Math.sign(Math.round(cx - T.target.x)), dz = Math.sign(Math.round(cz - T.target.z));
    const yaw = Math.atan2(-dx, -dz);
    // Push back to Q, no Ouch
    r = await page.evaluate(([T, n, cx, cz, yaw]) => {
        const g = window.__game;
        g.restore();
        let s = g.step(1);
        while (!(s.tails[n].phase === 'lifted' && s.tails[n].timer < 1.2)) s = g.step(3);
        g.teleport({ x: cx, z: cz, yaw });
        g.clearEvents();
        s = g.step(120);
        return { end: s.pos, target: T.target, ev: g.events.map((e) => e.type + (e.name ? ':' + e.name : '')) };
    }, [T, n, cx, cz, yaw]);
    check(`tail ${n + 1}: a swish pushes you back one cell (to Q), no Ouch, swoosh`, r.ev.includes('tailPush') && !r.ev.includes('spike') && r.ev.includes('sound:swoosh') && Math.hypot(r.end.x - T.target.x, r.end.z - T.target.z) < 0.3, r);
    // Walk across while lifted
    r = await page.evaluate(([T, n, cx, cz, yaw, dx, dz]) => {
        const g = window.__game;
        g.restore();
        let s = g.step(1);
        while (!(s.tails[n].phase === 'lifted' && s.tails[n].timer > 1.9)) s = g.step(1);
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
    }, [T, n, cx, cz, yaw, dx, dz]);
    check(`tail ${n + 1}: walk across while lifted: no push, under 1 s`, r.pushes === 0 && r.crossed !== null && r.crossed < 1, r);
    // Pictures
    await page.evaluate(([T, n, yaw, dx, dz]) => {
        const g = window.__game;
        g.restore();
        let s = g.step(1);
        while (!(s.tails[n].phase === 'lifted' && s.tails[n].timer < 0.1)) s = g.step(1);
        g.teleport({ x: T.target.x - dx * 2, z: T.target.z - dz * 2, yaw });
        g.step(30);
    }, [T, n, yaw, dx, dz]);
    await shot(`tail${n + 1}-swish`);
    await page.evaluate(() => window.__game.step(70));
    await shot(`tail${n + 1}-lifted`);
}

// Sneaky bone spike: walk into it
r = await page.evaluate((sp) => {
    const g = window.__game;
    const out = [];
    for (const [dx, dz] of [[2.5, 0], [-2.5, 0], [0, 2.5], [0, -2.5]]) {
        g.restore();
        g.teleport({ x: sp.x + dx, z: sp.z + dz, yaw: Math.atan2(dx, dz) });
        const p = g.state().pos;
        if (Math.hypot(p.x - sp.x - dx, p.z - sp.z - dz) > 0.2) continue;
        g.clearEvents();
        g.setInput({ forward: true });
        for (let i = 0; i < 30; i++) g.step(2);
        g.clearInput();
        out.push(g.events.filter((e) => e.type === 'spike').length);
    }
    return out;
}, st.spike);
check('sneaky bone spike: walking into it is an Ouch', r.length > 0 && r.some((n) => n > 0), r);
await page.evaluate((sp) => { const g = window.__game; g.restore(); g.teleport({ x: sp.x + 4, z: sp.z, yaw: Math.PI / 2 }); g.step(2); }, st.spike);
await shot('sneaky');

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
