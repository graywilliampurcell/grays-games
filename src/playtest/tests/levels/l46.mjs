import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const load = async (level = 45) => { await page.goto(`${BASE}/?test=1&level=${level}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => window.__game?.ready); };
const shot = (name) => page.screenshot({ path: SP + 'l46-' + name + '.png' });
const EAST = -Math.PI / 2, WEST = Math.PI / 2;
await load();
let s = await page.evaluate(() => window.__game.state());
console.log(s.level, 'start', JSON.stringify(s.start), 'door', JSON.stringify(s.door), 'plat', JSON.stringify(s.platforms), 'current', JSON.stringify(s.current), 'music', s.music);
await page.evaluate(() => window.__game.step(10));
await shot('start');
// Path urchin at (22.5, 34.5) heading east
for (const d of [-1.14, -1.11, -1.08, 1.08, 1.11, 1.14, 0]) {
    await load();
    const z = 34.5 + d;
    const o = await page.evaluate(({ z, EAST }) => { const g = window.__game; g.teleport({ x: 15.5, z, yaw: EAST }); g.step(1); g.setInput({ forward: true }); let st; let hit = ''; for (let i = 0; i < 300; i++) { st = g.step(1); const m = document.getElementById('message'); if (m && !m.hidden && !hit) hit = m.textContent; if (st.pos.x > 28) break; } g.clearInput(); return { end: st.pos, hit }; }, { z, EAST });
    console.log('squeeze z', z.toFixed(2), JSON.stringify(o));
}
await load();
await page.evaluate((EAST) => { const g = window.__game; g.teleport({ x: 12.0, z: 34.5, yaw: EAST }); g.step(3); }, EAST);
await shot('path-urchin');
// Big urchin: dead end west off (2,8)
await load();
const big = await page.evaluate((WEST) => { const g = window.__game; g.teleport({ x: 10.5, z: 34.5, yaw: WEST }); g.step(1); g.setInput({ forward: true }); let st; let hit = ''; for (let i = 0; i < 200; i++) { st = g.step(1); const m = document.getElementById('message'); if (m && !m.hidden && !hit) { hit = m.textContent; break; } } g.clearInput(); return { pos: st.pos, hit }; }, WEST);
console.log('big urchin', JSON.stringify(big));
await load();
await page.evaluate((WEST) => { const g = window.__game; g.teleport({ x: 13.5, z: 34.5, yaw: WEST }); g.step(3); }, WEST);
await shot('big-urchin');
await page.evaluate(() => { const g = window.__game; g.teleport({ x: 10.5, z: 27.0, yaw: 0 + Math.PI }); g.step(3); });
await shot('big-urchin-from-path');
for (const lv of [44, 45]) {
    await load(lv);
    const d = await page.evaluate(() => { const g = window.__game; const s = g.state(); g.teleport({ x: s.door.x - 1.2, z: s.door.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); for (let i = 0; i < 100; i++) { if (g.step(1).escaped) break; } g.clearInput(); return g.text(); });
    console.log('door', lv, JSON.stringify(d));
}
console.log('errors', errors);
await browser.close();
