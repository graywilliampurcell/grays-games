// Level 116 checks (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
import { LEVELS } from '../../js/levels.js';
import fs from 'fs';
const SP = SHOTS;
fs.mkdirSync(SP, { recursive: true });
// The correct path as cells, from the layout
const L = LEVELS.find((l) => l.name === 'Level 116').layout;
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
await page.goto(BASE + '/?test=1&level=115&lost=1', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
await page.keyboard.press('Shift');
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 700)); };
const shot = (name) => page.screenshot({ path: `${SP}l116-${name}.png`, timeout: 180000 });


const WALK = `
window.__walk = (points) => {
    const g = window.__game;
    let s = g.state();
    for (const [x, z] of points) {
        for (let tries = 0; tries < 40; tries++) {
            const dx = x - s.pos.x, dz = z - s.pos.z;
            const d = Math.hypot(dx, dz);
            if (d < 0.3) break;
            const yaw = Math.atan2(-dx, -dz);
            s = g.teleport({ yaw });
            g.setInput({ forward: true });
            let n = 0;
            for (; n < 20; n++) {
                s = g.step(2);
                if (s.escaped) { g.clearInput(); return s; }
                const ex = x - s.pos.x, ez = z - s.pos.z;
                if (Math.hypot(ex, ez) < 0.3 || ex * dx + ez * dz < 0) break;
            }
            g.clearInput();
            s = g.step(1);
        }
    }
    return s;
};
window.__center = ([i, j]) => [4 * i + 2.5, 4 * j + 2.5];
`;

await page.addScriptTag({ content: WALK });
let st = await page.evaluate(() => window.__game.restore());
check('Level 116 loads: 1 tail, 1 path spike, 3 fossils, nothing else',
    st.level.name === 'Level 116' && st.tails.length === 1 && st.platforms.length === 0 && st.spikeRows.length === 0 && !!st.spike && !st.spike2 && st.fossils.length === 3 && !st.buttonDoor,
    { tails: st.tails.length, p: st.platforms.length, rows: st.spikeRows, spike: st.spike, f: st.fossils });
check('path length 67', path.length === 67, {});
check('tune dinosqueeze', (await page.evaluate(() => window.__sound?.tuneName)) === 'dinosqueeze', {});
check('fossil looks: skull, shell, footprint', st.fossils.map((f) => f.kind).sort().join() === 'footprint,shell,skull', st.fossils);
check('counter 🦴 0 / 3, door locked with lock', st.fossilCounter === '🦴 0 / 3' && st.doorLocked && st.doorLockVisible, {});
console.log('tail', JSON.stringify(st.tails), 'spike', JSON.stringify(st.spike));

// Tail cycle
let r = await page.evaluate(() => {
    const g = window.__game;
    g.restore();
    const log = [];
    let last = g.state().tails[0];
    for (let i = 0; i < 100; i++) {
        const t = g.step(6).tails[0];
        if (t.phase !== last.phase) log.push({ t: g.time(), phase: t.phase, s: t.s });
        last = t;
    }
    return log;
});
const sw = r.filter((e) => e.phase === 'swish');
check('tail: lifted ~2 s, swish ~1 s, alternating', sw.length >= 2 && Math.abs(Math.abs(sw[1].t - sw[0].t) - 3) < 0.2 && Math.abs(sw[0].s - sw[1].s) > 1.5, r);
{
    const T = st.tails[0];
    const cx = (T.minX + T.maxX) / 2, cz = (T.minZ + T.maxZ) / 2;
    const dx = Math.sign(Math.round(cx - T.target.x)), dz = Math.sign(Math.round(cz - T.target.z));
    const yaw = Math.atan2(-dx, -dz);
    r = await page.evaluate(([T, cx, cz, yaw]) => {
        const g = window.__game;
        g.restore();
        let s = g.step(1);
        while (!(s.tails[0].phase === 'lifted' && s.tails[0].timer < 1.2)) s = g.step(3);
        g.teleport({ x: cx, z: cz, yaw });
        g.clearEvents();
        s = g.step(120);
        return { end: s.pos, target: T.target, ev: g.events.map((e) => e.type + (e.name ? ':' + e.name : '')) };
    }, [T, cx, cz, yaw]);
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

// Path bone spike heading south: squeeze past both sides, Ouch in the middle
r = await page.evaluate(() => {
    const g = window.__game;
    const out = [];
    const sp = g.state().spike;
    for (const off of [-1.1, -1.0, 1.0, 1.1]) {
        g.restore();
        g.step(30);
        g.teleport({ x: sp.x + off, z: sp.z - 3.5, yaw: Math.PI });
        const p0 = g.state().pos;
        g.clearEvents();
        g.setInput({ forward: true });
        let s;
        for (let i = 0; i < 40; i++) s = g.step(2);
        g.clearInput();
        out.push({ off, x0: p0.x, x: s.pos.x, z: s.pos.z, ouch: g.events.filter((e) => e.type === 'spike').length });
    }
    g.restore();
    g.step(30);
    g.teleport({ x: sp.x, z: sp.z - 3, yaw: Math.PI });
    g.clearEvents();
    g.setInput({ forward: true });
    for (let i = 0; i < 40; i++) g.step(2);
    g.clearInput();
    out.push({ middle: true, ouch: g.events.filter((e) => e.type === 'spike').length });
    return { sp, out };
});
const left = r.out.filter((o) => o.off < 0 && o.ouch === 0 && o.z > r.sp.z + 2), right = r.out.filter((o) => o.off > 0 && o.ouch === 0 && o.z > r.sp.z + 2);
check('path bone spike: squeeze past both sides, Ouch in the middle', left.length > 0 && right.length > 0 && r.out[4].ouch > 0, r);
await page.evaluate(() => { const g = window.__game; const sp = g.state().spike; g.restore(); g.teleport({ x: sp.x, z: sp.z - 6, yaw: Math.PI }); g.step(2); });
await shot('bonespike');

// Fossils: locked door first, then pick up all 3, then the door works
const geo = await page.evaluate(() => {
    const s = window.__game.state();
    const path = s.buddy.path;
    const key = (c) => c.join(',');
    const on = new Set(path.map(key));
    const grid = s.grid;
    const open = (x, z) => grid[z]?.[x] !== undefined && grid[z][x] !== '#' && grid[z][x] !== 'D';
    const links = ([i, j]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([di, dj]) => open(4 * i + 2 + 2 * di, 4 * j + 2 + 2 * dj)).map(([di, dj]) => [i + di, j + dj]);
    return { path, ways: s.fossils.map((f) => {
        const F = [Math.floor((f.x - 1) / 4), Math.floor((f.z - 1) / 4)];
        const W = links(F)[0];
        const P = links(W).find((c) => on.has(key(c)));
        return { F, W, P, k: path.findIndex((c) => key(c) === key(P)) };
    }) };
});
console.log('fossil ways', JSON.stringify(geo.ways));
check('each fossil in the last cell of its own 2-deep wrong way', geo.ways.every((w) => w.P && w.k >= 0), geo.ways);
r = await page.evaluate((geo) => {
    const g = window.__game;
    g.restore();
    const last = geo.path[geo.path.length - 1];
    g.teleport({ x: 4 * last[0] + 2.5, z: 4 * last[1] + 2.5, yaw: -Math.PI / 2 });
    g.clearEvents();
    g.setInput({ forward: true });
    const s = g.step(90);
    g.clearInput();
    return { pos: s.pos, escaped: s.escaped, msgs: g.events.filter((e) => e.type === 'message').map((e) => e.text) };
}, geo);
check('locked door: "Find all 3 fossils first!", no escape', !r.escaped && r.msgs.includes('Find all 3 fossils first!'), r);
await shot('locked-door');
for (const n of [0, 1, 2]) {
    r = await page.evaluate(({ geo, n }) => {
        const g = window.__game;
        const w = geo.ways[n];
        g.teleport({ x: 4 * w.P[0] + 2.5, z: 4 * w.P[1] + 2.5 });
        g.step(1);
        g.clearEvents();
        const s = window.__walk([window.__center(w.W), window.__center(w.F)]);
        return { c: s.fossilCounter, locked: s.doorLocked, ev: g.events.filter((e) => ['fossil', 'fossilUnlock', 'sound'].includes(e.type)).map((e) => e.type + ':' + (e.name ?? '')) };
    }, { geo, n });
    check(`fossil ${n + 1}: ding, counter ${n + 1} / 3`, r.c === `🦴 ${n + 1} / 3` && r.ev.includes('sound:ding') && r.locked === (n < 2) && (n < 2 || r.ev.some((e) => e.startsWith('fossilUnlock'))), r);
    if (n === 0) {
        // An Ouch on the spike keeps the fossil
        const k = await page.evaluate(() => { const g = window.__game; const sp = g.state().spike; g.teleport({ x: sp.x, z: sp.z - 3, yaw: Math.PI }); g.clearEvents(); g.setInput({ forward: true }); const s = g.step(60); g.clearInput(); return { c: s.fossilCounter, ouch: g.events.some((e) => e.type === 'spike') }; });
        check('Ouch keeps the collected fossil', k.ouch && k.c === '🦴 1 / 3', k);
    }
}
r = await page.evaluate((last) => {
    const g = window.__game;
    g.teleport({ x: 4 * last[0] + 2.5 - 1, z: 4 * last[1] + 2.5, yaw: -Math.PI / 2 });
    g.setInput({ forward: true });
    let s;
    for (let i = 0; i < 40; i++) { s = g.step(2); if (s.escaped) break; }
    g.clearInput();
    g.step(30);
    return { escaped: s.escaped, text: g.text() };
}, path[path.length - 1]);
check('unlocked door: escape, More levels coming soon!', r.escaped && JSON.stringify(r.text).match(/More levels coming soon|Start (Level [0-9]+|[A-Z][a-zA-Z ]* World)/) !== null, r);

st = await page.evaluate(() => { const g = window.__game; g.restore(); return g.step(60 * 4).buddy; });
check('the buddy is in the level', !!st && st.visible, st);
await page.evaluate(() => { const g = window.__game; g.teleport({ yaw: -Math.PI / 2 }); g.step(1); });
await shot('start');
check('no page errors', errors.length === 0, errors);
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
