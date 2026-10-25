import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const load = async (level = 50) => { await page.goto(`${BASE}/?test=1&level=${level}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => window.__game?.ready); };
const shot = (name) => page.screenshot({ path: SP + 'l51-' + name + '.png' });
const EAST = -Math.PI / 2, WEST = Math.PI / 2, SOUTH = Math.PI, NORTH = 0;
await load();
await page.evaluate(() => window.__game.step(10));
console.log('state', JSON.stringify(await page.evaluate(() => { const s = window.__game.state(); return { pos: s.pos, start: s.start, door: s.door, spike: s.spike, platforms: s.platforms?.length, currents: s.currents?.length, level: s.level }; })));
await shot('start');
// the candy cane at (14.5, 2.5), reached heading east from (10.5, 2.5)
const u = await page.evaluate((EAST) => { const g = window.__game; g.teleport({ x: 10.5, z: 2.5, yaw: EAST }); g.setInput({ forward: true }); let hit = ''; let st; for (let i = 0; i < 200; i++) { st = g.step(1); const m = document.getElementById('message'); if (m && !m.hidden) { hit = m.textContent; break; } } g.clearInput(); return { hit, pos: st.pos }; }, EAST);
console.log('cane', JSON.stringify(u));
await load();
await page.evaluate((EAST) => { const g = window.__game; g.teleport({ x: 11.6, z: 2.5, yaw: EAST }); g.step(3); }, EAST);
await shot('cane');
// from the junction (path cell 3 = (10.5, 10.5)) looking north: the cane must be out of sight
await page.evaluate((NORTH) => { const g = window.__game; g.teleport({ x: 10.5, z: 10.5, yaw: NORTH }); g.step(3); }, NORTH);
await shot('junction');
// a corridor view
await page.evaluate((EAST) => { const g = window.__game; g.teleport({ x: 22.5, z: 18.5, yaw: EAST + 0.3 }); g.step(3); }, EAST);
await shot('corridor');
console.log('errors', errors);
await browser.close();
