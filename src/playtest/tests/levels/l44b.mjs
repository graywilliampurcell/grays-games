import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const load = async (level = 43) => { await page.goto(`${BASE}/?test=1&level=${level}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => window.__game?.ready); };
const shot = (name) => page.screenshot({ path: SP + 'l44-' + name + '.png' });
const EAST = -Math.PI / 2, WEST = Math.PI / 2, SOUTH = Math.PI, NORTH = 0;
const msgJs = `(() => { const m = document.getElementById('message'); return m && !m.hidden ? m.textContent : ''; })()`;

await load();
let s = await page.evaluate(() => window.__game.state());
console.log(s.level, 'start', JSON.stringify(s.start), 'door', JSON.stringify(s.door), 'plat', JSON.stringify(s.platforms), 'current', JSON.stringify(s.current));
await page.evaluate(() => window.__game.step(10));
await shot('start');

// Bubble ride heading east over cells (4,0)..(6,0), z 2.5
// Path urchin at (34.5, 18.5): squeeze past both sides heading north; middle hits
await load();
await page.evaluate((NORTH) => { const g = window.__game; g.teleport({ x: 34.5, z: 26.2, yaw: 0 }); g.step(3); }, NORTH);
await shot('path-urchin');
// Big urchin: dead end east off (1,8) at z 34.5
await load();
await load();
await page.evaluate((EAST) => { const g = window.__game; g.teleport({ x: 3.0, z: 34.5, yaw: EAST }); g.step(3); }, EAST);
await shot('big-urchin');
await page.evaluate((EAST) => { const g = window.__game; g.teleport({ x: 6.5, z: 29.0, yaw: Math.PI }); g.step(3); }, EAST);
await shot('big-urchin-from-path');
await load();
await page.evaluate((EAST) => { const g = window.__game; g.teleport({ x: 9.5, z: 2.5, yaw: EAST }); g.step(3); }, EAST);
await shot('bubble');
// Fall in crack
await load();
const f = await page.evaluate(() => { const g = window.__game; g.teleport({ x: 22.5, z: 2.5 }); g.step(3); const m = document.getElementById('message'); return { pos: g.state().pos, msg: m && !m.hidden ? m.textContent : '' }; });
console.log('fall', JSON.stringify(f));
for (const lv of [42, 43]) {
    await load(lv);
    const d = await page.evaluate(() => { const g = window.__game; const s = g.state(); g.teleport({ x: s.door.x - 1.2, z: s.door.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); for (let i = 0; i < 100; i++) { if (g.step(1).escaped) break; } g.clearInput(); return g.text(); });
    console.log('door', lv, JSON.stringify(d));
}
console.log('errors', errors);
await browser.close();
