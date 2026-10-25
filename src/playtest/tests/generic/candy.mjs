// Generic Candy World level check: node tcandy.mjs <level number, 1-based>
import { chromium, BASE, SHOTS } from '../playwright.mjs';
import { LEVELS } from '../../js/levels.js';
const SP = SHOTS;
const N = Number(process.argv[2]);
const idx = N - 1;
const L = LEVELS[idx];
const grid = L.layout;
const at = (x, z) => grid[z]?.[x] ?? '#';
const free = (x, z) => at(x, z) !== '#' && at(x, z) !== undefined;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const load = async (level = idx) => { await page.goto(`${BASE}/?test=1&level=${level}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => window.__game?.ready); };
const shot = (name) => page.screenshot({ path: `${SP}l${N}-${name}.png` });
const YAW = { east: -Math.PI / 2, west: Math.PI / 2, south: Math.PI, north: 0 };
const D = { east: [1, 0], west: [-1, 0], south: [0, 1], north: [0, -1] };
const walk = (x, z, yaw, n = 300) => page.evaluate(({ x, z, yaw, n }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x, z, yaw }); g.setInput({ forward: true });
    let msg = ''; let st;
    for (let i = 0; i < n; i++) {
        st = g.step(1);
        const m = document.getElementById('message'); if (!msg && m && !m.hidden && m.textContent.trim()) msg = m.textContent;
    }
    g.clearInput();
    return { msg, pos: { x: +st.pos.x.toFixed(2), z: +st.pos.z.toFixed(2) }, events: [...new Set(g.events.map((e) => e.type))] };
}, { x, z, yaw, n });
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info)); };
const groups = (ch) => {
    const seen = new Set(); const out = [];
    for (let z = 0; z < grid.length; z++) for (let x = 0; x < grid[z].length; x++) {
        if (grid[z][x] !== ch || seen.has(`${x},${z}`)) continue;
        const stack = [[x, z]]; const cells = []; seen.add(`${x},${z}`);
        while (stack.length) { const [a, b] = stack.pop(); cells.push([a, b]); for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = `${a + dx},${b + dz}`; if (grid[b + dz]?.[a + dx] === ch && !seen.has(k)) { seen.add(k); stack.push([a + dx, b + dz]); } } }
        const xs = cells.map((c) => c[0]); const zs = cells.map((c) => c[1]);
        out.push({ x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), n: cells.length });
    }
    return out;
};
const find = (ch) => { for (let z = 0; z < grid.length; z++) { const x = grid[z].indexOf(ch); if (x >= 0) return [x, z]; } return null; };

await load();
await page.evaluate(() => window.__game.step(10));
await shot('start');
// Rivers: bounce both ways, fall in beside the marshmallow
const rivers = groups('O');
console.log('rivers', rivers.length, 'caramel', groups('C').length, 'X', find('X'), 'Z', find('Z'), 'Y', find('Y'));
for (const [r, g] of rivers.entries()) {
    const alongX = g.x1 - g.x0 > g.z1 - g.z0;
    const mid = alongX ? (g.z0 + g.z1 + 1) / 2 : (g.x0 + g.x1 + 1) / 2;
    const lo = alongX ? g.x0 : g.z0; const hi = (alongX ? g.x1 : g.z1) + 1;
    for (const [dirName, from, sign] of [['+', lo - 2.5, 1], ['-', hi + 2.5, -1]]) {
        const dir = alongX ? (sign > 0 ? 'east' : 'west') : (sign > 0 ? 'south' : 'north');
        const p = alongX ? [from, mid] : [mid, from];
        await load();
        const res = await walk(p[0], p[1], YAW[dir], 200);
        const end = alongX ? res.pos.x : res.pos.z;
        check(`river ${r + 1} bounce ${dir}`, !res.msg && (sign > 0 ? end > hi : end < lo), res);
        await load();
        const side = alongX ? [from, mid - 0.9] : [mid - 0.9, from];
        const res2 = await walk(side[0], side[1], YAW[dir], 200);
        check(`river ${r + 1} beside the marshmallow ${dir} falls in`, /chocolate/i.test(res2.msg), res2);
    }
    await load();
    const view = alongX ? [lo - 4, mid] : [mid, lo - 4];
    await page.evaluate(({ x, z, yaw }) => { const g = window.__game; g.teleport({ x, z, yaw }); g.step(2); }, { x: view[0], z: view[1], yaw: YAW[alongX ? 'east' : 'south'] });
    await shot(`river${r + 1}`);
}
// Caramel: 30 steps on it vs 30 steps elsewhere
for (const [c, g] of groups('C').entries()) {
    const cx = (g.x0 + g.x1 + 1) / 2; const cz = (g.z0 + g.z1 + 1) / 2;
    let dir = null;
    for (const [name, [dx, dz]] of Object.entries(D)) if (free(Math.floor(cx + dx * 2), Math.floor(cz + dz * 2)) && at(Math.floor(cx + dx * 2), Math.floor(cz + dz * 2)) !== 'O') { dir = name; break; }
    await load();
    const res = await walk(cx - D[dir][0] * 0.3, cz - D[dir][1] * 0.3, YAW[dir], 30);
    const moved = Math.hypot(res.pos.x - (cx - D[dir][0] * 0.3), res.pos.z - (cz - D[dir][1] * 0.3));
    check(`caramel ${c + 1} slows you (moved ${moved.toFixed(2)} in 30 steps heading ${dir})`, moved > 0.2 && moved < 1.6, res);
    if (c === 0) {
        await load();
        await page.evaluate(({ x, z, yaw }) => { const g = window.__game; g.teleport({ x, z, yaw }); g.step(2); }, { x: cx - D[dir][0] * 3, z: cz - D[dir][1] * 3, yaw: YAW[dir] });
        await shot('caramel');
    }
}
// Candy canes: walking straight into one says Ouch
const runInto = async (name, [sx, sz], expectHit = true) => {
    for (const [dir, [dx, dz]] of Object.entries(D)) {
        if (!free(sx - dx * 3, sz - dz * 3) || !free(sx - dx * 2, sz - dz * 2)) continue;
        await load();
        const res = await walk(sx + 0.5 - dx * 3, sz + 0.5 - dz * 3, YAW[dir], 150);
        check(`${name} hit heading ${dir}`, /ouch/i.test(res.msg) === expectHit, res);
        await load();
        await page.evaluate(({ x, z, yaw }) => { const g = window.__game; g.teleport({ x, z, yaw }); g.step(2); }, { x: sx + 0.5 - dx * 3.5, z: sz + 0.5 - dz * 3.5, yaw: YAW[dir] });
        await shot(name.replace(/ /g, '-'));
        return;
    }
    check(`${name} approach found`, false, {});
};
const hasSneaky = !!find('X') && (!!find('Z') || !L.spikeRadius);
if (find('X')) await runInto(hasSneaky ? 'sneaky cane' : 'path cane', find('X'));
if (find('Z')) await runInto('path cane', find('Z'));
if (find('Y')) await runInto('big cane', find('Y'));
// Path cane squeeze: pass at the side, hit near the middle
const pc = find('Z') ?? (hasSneaky ? null : find('X'));
if (pc) {
    const [sx, sz] = pc;
    const along = free(sx, sz - 2) && free(sx, sz + 2) ? 'z' : 'x';
    for (const off of [-1.08, 1.08, -0.75, 0.75]) {
        for (const dir of along === 'z' ? ['south', 'north'] : ['east', 'west']) {
            const [dx, dz] = D[dir];
            await load();
            const x = sx + 0.5 - dx * 3 + (along === 'z' ? off : 0); const z = sz + 0.5 - dz * 3 + (along === 'x' ? off : 0);
            const res = await walk(x, z, YAW[dir], 120);
            check(`path cane squeeze offset ${off} heading ${dir} ${Math.abs(off) > 1 ? 'passes' : 'hits'}`, /ouch/i.test(res.msg) === (Math.abs(off) < 1), res);
        }
    }
}
// Finish screens: this level's door, and the level before's door
const doorFinish = async (level) => {
    await load(level);
    const r = await page.evaluate(() => { const g = window.__game; const d = g.state().door; g.teleport({ x: d.x - 2.5, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); g.step(150); g.clearInput(); return g.events.map((e) => e.type); });
    await page.waitForTimeout(800);
    return { events: [...new Set(r)], text: await page.evaluate(() => [...document.querySelectorAll('#menu, #menu *')].filter((e) => e.offsetParent && e.children.length === 0).map((e) => e.textContent.trim()).filter(Boolean).join(' | ')) };
};
const prev = await doorFinish(idx - 1);
check(`Level ${N - 1} door leads to Level ${N}`, prev.text.includes(`Level ${N}`), prev);
const own = await doorFinish(idx);
await shot('finish');
check(`Level ${N} door finish screen`, L.finale ? own.text.includes(L.finale) : own.text.includes('More levels coming soon'), own);
console.log('errors', errors);
console.log(results.every(Boolean) && errors.length === 0 ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
