import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const load = async (level = 47) => { await page.goto(`${BASE}/?test=1&level=${level}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => window.__game?.ready); };
const shot = (name) => page.screenshot({ path: SP + 'l48-' + name + '.png' });
const EAST = -Math.PI / 2, WEST = Math.PI / 2, SOUTH = Math.PI, NORTH = 0;
await load();
let s = await page.evaluate(() => window.__game.state());
console.log(s.level.name, 'music', s.music);
await page.evaluate(() => window.__game.step(10));
await shot('start');
// Bubble ride heading south down the right-hand column (x 34.5, z 5-16)
const r = await page.evaluate(({ SOUTH, NORTH }) => {
    const g = window.__game; const log = [];
    const msg = () => { const m = document.getElementById('message'); return m && !m.hidden ? m.textContent : ''; };
    g.teleport({ x: 34.5, z: 2.5, yaw: SOUTH }); g.step(1);
    g.setInput({ forward: true });
    let st;
    for (let i = 0; i < 400; i++) { st = g.step(1); if (st.platforms[0].pushing) break; }
    const t0 = g.time(); let enterAt = null;
    for (let i = 0; i < 2000; i++) { st = g.step(1); if (st.platforms[0].riding) { enterAt = g.time(); break; } }
    log.push(['entered after push secs', enterAt - t0, st.pos]);
    for (let i = 0; i < 2000; i++) { st = g.step(1); if (!st.platforms[0].riding) break; }
    log.push(['arrived', st.pos, st.platforms[0].at, msg()]);
    for (let i = 0; i < 40; i++) st = g.step(1);
    g.clearInput();
    log.push(['walked on', st.pos, msg()]);
    g.teleport({ yaw: NORTH }); g.setInput({ forward: true });
    for (let i = 0; i < 2000; i++) { st = g.step(1); if (st.platforms[0].riding) break; }
    for (let i = 0; i < 2000; i++) { st = g.step(1); if (!st.platforms[0].riding) break; }
    for (let i = 0; i < 30; i++) st = g.step(1);
    g.clearInput();
    log.push(['back north', st.pos, st.platforms[0].at, msg()]);
    return log;
}, { SOUTH, NORTH });
for (const l of r) console.log(JSON.stringify(l));
// Path urchin at (22.5, 14.5) in the row-3 corridor, east-west
for (const d of [-1.14, -1.08, 1.08, 1.14, 0]) {
    await load();
    const z = 14.5 + d;
    const o = await page.evaluate(({ z, EAST }) => { const g = window.__game; g.teleport({ x: 15.5, z, yaw: EAST }); g.step(1); g.setInput({ forward: true }); let st; let hit = ''; for (let i = 0; i < 300; i++) { st = g.step(1); const m = document.getElementById('message'); if (m && !m.hidden && !hit) hit = m.textContent; if (st.pos.x > 28) break; } g.clearInput(); return { end: st.pos, hit }; }, { z, EAST });
    console.log('squeeze z', z.toFixed(2), JSON.stringify(o));
}
await load();
await page.evaluate((EAST) => { const g = window.__game; g.teleport({ x: 14.0, z: 14.5, yaw: EAST }); g.step(3); }, EAST);
await shot('path-urchin');
// Big urchin: dead end west off (5,7), row at x 19.5
await load();
const big = await page.evaluate((WEST) => { const g = window.__game; g.teleport({ x: 24.5, z: 30.5, yaw: WEST }); g.step(1); g.setInput({ forward: true }); let st; let hit = ''; for (let i = 0; i < 200; i++) { st = g.step(1); const m = document.getElementById('message'); if (m && !m.hidden && !hit) { hit = m.textContent; break; } } g.clearInput(); return { pos: st.pos, hit }; }, WEST);
console.log('big urchin', JSON.stringify(big));
await load();
await page.evaluate((WEST) => { const g = window.__game; g.teleport({ x: 26.5, z: 30.5, yaw: WEST }); g.step(3); }, WEST);
await shot('big-urchin');
await page.evaluate((SOUTH) => { const g = window.__game; g.teleport({ x: 30.5, z: 26.5, yaw: SOUTH }); g.step(3); }, SOUTH);
await shot('big-urchin-from-path');
await load();
await page.evaluate((SOUTH) => { const g = window.__game; g.teleport({ x: 34.5, z: 2.0, yaw: SOUTH }); g.step(3); }, SOUTH);
await shot('bubble');
await load();
const f = await page.evaluate(() => { const g = window.__game; g.teleport({ x: 34.5, z: 10.5 }); g.step(3); const m = document.getElementById('message'); return { pos: g.state().pos, msg: m && !m.hidden ? m.textContent : '' }; });
console.log('fall', JSON.stringify(f));
for (const lv of [46, 47]) {
    await load(lv);
    const d = await page.evaluate(() => { const g = window.__game; const s = g.state(); g.teleport({ x: s.door.x - 1.2, z: s.door.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); for (let i = 0; i < 100; i++) { if (g.step(1).escaped) break; } g.clearInput(); return g.text(); });
    console.log('door', lv, JSON.stringify(d));
}
console.log('errors', errors);
await browser.close();
