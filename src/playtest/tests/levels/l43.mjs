import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const load = async (level = 42) => { await page.goto(`${BASE}/?test=1&level=${level}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => window.__game?.ready); };
const shot = (name) => page.screenshot({ path: SP + 'l43-' + name + '.png' });
const EAST = -Math.PI / 2, WEST = Math.PI / 2, SOUTH = Math.PI, NORTH = 0;
const msgJs = `(() => { const m = document.getElementById('message'); return m && !m.hidden ? m.textContent : ''; })()`;

await load();
let s = await page.evaluate(() => window.__game.state());
console.log(s.level, 'start', JSON.stringify(s.start), 'door', JSON.stringify(s.door), 'plat', JSON.stringify(s.platforms), 'current', JSON.stringify(s.current));
await page.evaluate(() => window.__game.step(10));
await shot('start');

// Bubble ride heading west over cells (5,7)..(3,7), z 30.5
const r = await page.evaluate(({ EAST, WEST }) => {
    const g = window.__game; const log = [];
    const msg = () => { const m = document.getElementById('message'); return m && !m.hidden ? m.textContent : ''; };
    g.teleport({ x: 26.5, z: 30.5, yaw: WEST }); g.step(1);
    g.setInput({ forward: true });
    let st;
    for (let i = 0; i < 400; i++) { st = g.step(1); if (st.platforms[0].pushing) break; }
    const t0 = g.time();
    for (let i = 0; i < 1000; i++) { st = g.step(1); if (g.time() - t0 >= 1.0) break; }
    g.clearInput();
    log.push(['after ~1s push', st.pos.x, st.platforms[0].push, st.platforms[0].riding]);
    g.teleport({ yaw: EAST }); g.setInput({ forward: true }); for (let i = 0; i < 60; i++) st = g.step(1); g.clearInput();
    for (let i = 0; i < 60; i++) st = g.step(1);
    log.push(['walked away', st.pos.x, st.platforms[0].push]);
    g.teleport({ yaw: WEST }); g.setInput({ forward: true });
    const t1 = g.time(); let enterAt = null;
    for (let i = 0; i < 2000; i++) { st = g.step(1); if (st.platforms[0].riding) { enterAt = g.time(); break; } }
    log.push(['entered', st.pos, 'secs after resuming', enterAt - t1]);
    for (let i = 0; i < 2000; i++) { st = g.step(1); if (!st.platforms[0].riding) break; }
    log.push(['arrived', st.pos, st.platforms[0].at, msg()]);
    for (let i = 0; i < 40; i++) st = g.step(1);
    g.clearInput();
    log.push(['walked on', st.pos, msg()]);
    g.teleport({ yaw: EAST }); g.setInput({ forward: true });
    for (let i = 0; i < 2000; i++) { st = g.step(1); if (st.platforms[0].riding) break; }
    for (let i = 0; i < 2000; i++) { st = g.step(1); if (!st.platforms[0].riding) break; }
    for (let i = 0; i < 30; i++) st = g.step(1);
    g.clearInput();
    log.push(['back east', st.pos, st.platforms[0].at, msg()]);
    return log;
}, { EAST, WEST });
for (const l of r) console.log(JSON.stringify(l));

// Path urchin at (34.5, 10.5): squeeze past both sides heading south; middle hits
for (const x of [33.45, 35.55, 34.5]) {
    await load();
    const o = await page.evaluate(({ x, SOUTH }) => { const g = window.__game; g.teleport({ x, z: 6.5, yaw: SOUTH }); g.step(1); g.setInput({ forward: true }); let st; let hit = ''; for (let i = 0; i < 200; i++) { st = g.step(1); const m = document.getElementById('message'); if (m && !m.hidden && !hit) hit = m.textContent; if (st.pos.z > 14) break; } g.clearInput(); return { end: st.pos, hit }; }, { x, SOUTH });
    console.log('squeeze x', x, JSON.stringify(o));
}
await load();
await page.evaluate((NORTH) => { const g = window.__game; g.teleport({ x: 34.5, z: 2.8, yaw: Math.PI }); g.step(3); }, NORTH);
await shot('path-urchin');
// Big urchin: dead end east off (1,1) at z 6.5
await load();
const big = await page.evaluate((EAST) => { const g = window.__game; g.teleport({ x: 6.5, z: 6.5, yaw: EAST }); g.step(1); g.setInput({ forward: true }); let st; let hit = ''; for (let i = 0; i < 200; i++) { st = g.step(1); const m = document.getElementById('message'); if (m && !m.hidden && !hit) { hit = m.textContent; break; } } g.clearInput(); return { pos: st.pos, hit }; }, EAST);
console.log('big urchin', JSON.stringify(big));
await load();
await page.evaluate((EAST) => { const g = window.__game; g.teleport({ x: 5.5, z: 6.5, yaw: EAST }); g.step(3); }, EAST);
await shot('big-urchin');
await page.evaluate((EAST) => { const g = window.__game; g.teleport({ x: 5.5, z: 2.5, yaw: Math.PI }); g.step(3); }, EAST);
await shot('big-urchin-from-path');
await load();
await page.evaluate((WEST) => { const g = window.__game; g.teleport({ x: 27.5, z: 30.5, yaw: WEST }); g.step(3); }, WEST);
await shot('bubble');
// Fall in crack
await load();
const f = await page.evaluate(() => { const g = window.__game; g.teleport({ x: 18.5, z: 30.5 }); g.step(3); const m = document.getElementById('message'); return { pos: g.state().pos, msg: m && !m.hidden ? m.textContent : '' }; });
console.log('fall', JSON.stringify(f));
for (const lv of [41, 42]) {
    await load(lv);
    const d = await page.evaluate(() => { const g = window.__game; const s = g.state(); g.teleport({ x: s.door.x - 1.2, z: s.door.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); for (let i = 0; i < 100; i++) { if (g.step(1).escaped) break; } g.clearInput(); return g.text(); });
    console.log('door', lv, JSON.stringify(d));
}
console.log('errors', errors);
await browser.close();
