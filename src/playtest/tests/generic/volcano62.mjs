// Volcano World Level 61 check: node tvolcano.mjs
import { chromium, BASE, SHOTS } from '../playwright.mjs';
import { LEVELS } from '../../js/levels.js';
const SP = SHOTS;
const N = Number(process.argv[2] ?? 61);
const idx = N - 1;
const L = LEVELS[idx];
const grid = L.layout;
const at = (x, z) => grid[z]?.[x] ?? '#';
const free = (x, z) => at(x, z) !== '#';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const load = async (level = idx) => { await page.goto(`${BASE}/?test=1&level=${level}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => window.__game?.ready); };
const shot = (name) => page.screenshot({ path: `${SP}l${N}-${name}.png` });
const YAW = { east: -Math.PI / 2, west: Math.PI / 2, south: Math.PI, north: 0 };
const D = { east: [1, 0], west: [-1, 0], south: [0, 1], north: [0, -1] };
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info)); };
const find = (ch) => { for (let z = 0; z < grid.length; z++) { const x = grid[z].indexOf(ch); if (x >= 0) return [x, z]; } return null; };
const walk = (x, z, yaw, n = 300) => page.evaluate(({ x, z, yaw, n }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x, z, yaw }); g.setInput({ forward: true });
    let msg = ''; let st;
    for (let i = 0; i < n; i++) { st = g.step(1); const m = document.getElementById('message'); if (!msg && m && !m.hidden && m.textContent.trim()) msg = m.textContent; }
    g.clearInput();
    return { msg, pos: { x: +st.pos.x.toFixed(2), z: +st.pos.z.toFixed(2) }, events: [...new Set(g.events.map((e) => e.type))] };
}, { x, z, yaw, n });

await load();
await page.evaluate(() => window.__game.step(10));
await shot('start');
// Sneaky hot coal
const X = find('X');
for (const [dir, [dx, dz]] of X ? Object.entries(D) : []) {
    if (!free(X[0] - dx * 3, X[1] - dz * 3) || !free(X[0] - dx * 2, X[1] - dz * 2)) continue;
    await load();
    const res = await walk(X[0] + 0.5 - dx * 3, X[1] + 0.5 - dz * 3, YAW[dir], 150);
    check(`hot coal hit heading ${dir}`, /hot coal/i.test(res.msg), res);
    await load();
    await page.evaluate(({ x, z, yaw }) => { const g = window.__game; g.teleport({ x, z, yaw }); g.step(2); }, { x: X[0] + 0.5 - dx * 3.5, z: X[1] + 0.5 - dz * 3.5, yaw: YAW[dir] });
    await shot('coal');
    break;
}
// Steam vents
const vents = (await page.evaluate(() => window.__game.state().vents));
console.log('vents', JSON.stringify(vents));
const waitPhase = (phase, minTimer = 0) => page.evaluate(({ phase, minTimer }) => {
    const g = window.__game; let st = g.state(); let n = 0;
    while (!(st.vents[0].phase === phase && st.vents[0].timer >= minTimer) && n++ < 2000) st = g.step(1);
    return st.vents[0];
}, { phase, minTimer });
for (const [k, v] of vents.entries()) {
    const cx = (v.minX + v.maxX) / 2; const cz = (v.minZ + v.maxZ) / 2;
    const alongZ = Math.abs(v.target.z - cz) > Math.abs(v.target.x - cx);
    const back = alongZ ? Math.sign(v.target.z - cz) : Math.sign(v.target.x - cx); // toward start
    const fwdDir = alongZ ? (back < 0 ? 'south' : 'north') : (back < 0 ? 'east' : 'west');
    // Standing on it during a puff: pushed back to the target
    for (const [name, px, pz] of [['middle', cx, cz], ['far edge', cx - (alongZ ? 0 : back * 1.65), cz - (alongZ ? back * 1.65 : 0)],
        ['near edge overlap', alongZ ? cx : (back > 0 ? v.maxX + 0.3 : v.minX - 0.3), alongZ ? (back > 0 ? v.maxZ + 0.3 : v.minZ - 0.3) : cz]]) {
        await load();
        await page.evaluate(({ x, z, yaw }) => { const g = window.__game; g.clearEvents(); g.teleport({ x, z, yaw }); }, { x: px, z: pz, yaw: YAW[fwdDir] });
        await waitPhase('puff');
        const r = await page.evaluate(() => { const g = window.__game; let st; for (let i = 0; i < 60; i++) st = g.step(1); return { pos: st.pos, events: [...new Set(g.events.map((e) => e.type))] }; });
        check(`vent ${k + 1} ${name} pushed back`, r.events.includes('steam') && Math.abs(r.pos.x - v.target.x) < 0.05 && Math.abs(r.pos.z - v.target.z) < 0.05, r);
    }
    // Just off it (0.5 away): not pushed
    await load();
    const ox = alongZ ? cx : (back > 0 ? v.maxX + 0.5 : v.minX - 0.5); const oz = alongZ ? (back > 0 ? v.maxZ + 0.5 : v.minZ - 0.5) : cz;
    await page.evaluate(({ x, z, yaw }) => { const g = window.__game; g.clearEvents(); g.teleport({ x, z, yaw }); }, { x: ox, z: oz, yaw: YAW[fwdDir] });
    await waitPhase('puff');
    const r2 = await page.evaluate(() => { const g = window.__game; let st; for (let i = 0; i < 40; i++) st = g.step(1); return { pos: st.pos, events: [...new Set(g.events.map((e) => e.type))] }; });
    check(`vent ${k + 1} just off it: not pushed`, !r2.events.includes('steam'), r2);
    // Walking over while quiet: get past freely
    await load();
    await waitPhase('quiet', 2.9);
    const r3 = await walk(v.target.x, v.target.z, YAW[fwdDir], 100);
    const past = alongZ ? (back < 0 ? r3.pos.z > v.maxZ + 0.5 : r3.pos.z < v.minZ - 0.5) : (back < 0 ? r3.pos.x > v.maxX + 0.5 : r3.pos.x < v.minX - 0.5);
    check(`vent ${k + 1} cross while quiet`, past && !r3.events.includes('steam'), r3);
    // Walking over during the warning into the puff: pushed back
    await load();
    await waitPhase('warning'); await page.evaluate(() => window.__game.step(33));
    const r4 = await walk(v.target.x, v.target.z, YAW[fwdDir], 70);
    check(`vent ${k + 1} walk in during warning gets pushed`, r4.events.includes('steam'), r4);
    // Pictures: warning wisps and the puff, from 2 squares back
    await load();
    const vx = v.target.x + (alongZ ? 0 : back * 4); const vz = v.target.z + (alongZ ? back * 4 : 0);
    await page.evaluate(({ x, z, yaw }) => { const g = window.__game; g.teleport({ x, z, yaw }); }, { x: vx, z: vz, yaw: YAW[fwdDir] });
    await waitPhase('quiet', 2.9); await shot(`vent${k + 1}-quiet`);
    await waitPhase('warning', 0.3); await page.evaluate(() => window.__game.step(30)); await shot(`vent${k + 1}-warning`);
    await waitPhase('puff', 0.3); await page.evaluate(() => window.__game.step(8)); await shot(`vent${k + 1}-puff`);
}
// Finish screens
const doorFinish = async (level) => {
    await load(level);
    const r = await page.evaluate(() => { const g = window.__game; const d = g.state().door; g.teleport({ x: d.x - 2.5, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); g.step(150); g.clearInput(); return g.events.map((e) => e.type); });
    await page.waitForTimeout(800);
    return { events: [...new Set(r)], text: await page.evaluate(() => [...document.querySelectorAll('#menu, #menu *')].filter((e) => e.offsetParent && e.children.length === 0).map((e) => e.textContent.trim()).filter(Boolean).join(' | ')) };
};
const prev = await doorFinish(idx - 1);
await shot('prev-finish');
if (N === 61) check('Level 60 finale shows Start Volcano World, no coming soon', prev.text.includes('Start Volcano World') && !/coming soon/i.test(prev.text) && prev.text.includes('You beat Candy World'), prev);
else check(`Level ${N - 1} door leads to Level ${N}`, prev.text.includes(`Level ${N}`), prev);
const own = await doorFinish(idx);
await shot('finish');
check(`Level ${N} door finish screen`, L.finale ? own.text.includes(L.finale) : own.text.includes('More levels coming soon'), own);
console.log('errors', errors);
console.log(results.every(Boolean) && errors.length === 0 ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
