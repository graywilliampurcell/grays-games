import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const load = async (level = 53) => { await page.goto(`${BASE}/?test=1&level=${level}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => window.__game?.ready); };
const shot = (name) => page.screenshot({ path: SP + 'l54-' + name + '.png' });
const EAST = -Math.PI / 2, WEST = Math.PI / 2, SOUTH = Math.PI, NORTH = 0;
await load();
await page.evaluate(() => window.__game.step(10));
console.log('state', JSON.stringify(await page.evaluate(() => { const s = window.__game.state(); return { pos: s.pos, start: s.start, door: s.door, platforms: s.platforms, level: s.level }; })));
await shot('start');
const walk = (x, z, yaw, n = 300) => page.evaluate(({ x, z, yaw, n }) => {
  const g = window.__game; g.clearEvents(); g.teleport({ x, z, yaw }); g.setInput({ forward: true });
  let msg = ''; let st;
  for (let i = 0; i < n; i++) {
    st = g.step(1);
    const m = document.getElementById('message'); if (!msg && m && !m.hidden) { msg = m.textContent; }
  }
  g.clearInput();
  return { msg, pos: st.pos, events: g.events.map((e) => e.type + '@' + e.t) };
}, { x, z, yaw, n });
const tries = [
  ['bounce east', 18.5, 2.5, EAST, 200], ['bounce west', 38.5, 2.5, WEST, 200],
  ['past pad north side', 18.5, 1.5, EAST, 200], ['past pad south side', 18.5, 3.5, EAST, 200],
  ['cane N centre', 38.5, 29.5, NORTH, 120], ['cane N 37.5', 37.5, 29.5, NORTH, 120], ['cane N 39.5', 39.5, 29.5, NORTH, 120],
  ['cane N 37.42', 37.42, 29.5, NORTH, 120], ['cane N 39.58', 39.58, 29.5, NORTH, 120], ['cane N 37.7', 37.7, 29.5, NORTH, 120], ['cane N 39.3', 39.3, 29.5, NORTH, 120],
  ['cane S 37.42', 37.42, 23.5, SOUTH, 120], ['cane S 39.58', 39.58, 23.5, SOUTH, 120],
  ['caramel east 30 steps', 25.2, 6.5, EAST, 30], ['plain east 30 steps', 29.2, 6.5, EAST, 30],
];
for (const [name, x, z, yaw, n] of tries) { await load(); console.log(name, JSON.stringify(await walk(x, z, yaw, n))); }
await load();
await page.evaluate((y) => { const g = window.__game; g.teleport({ x: 38.5, z: 30.5, yaw: y }); g.step(2); }, NORTH);
await shot('path-cane');
await page.evaluate((y) => { const g = window.__game; g.teleport({ x: 22.5, z: 6.5, yaw: y }); g.step(2); }, EAST);
await shot('caramel');
await page.evaluate((y) => { const g = window.__game; g.teleport({ x: 18.5, z: 6.0, yaw: y }); g.step(2); }, NORTH);
await shot('river-bank');
await page.evaluate((y) => { const g = window.__game; g.teleport({ x: 17.5, z: 2.5, yaw: y }); g.step(2); }, EAST);
await shot('river');
await page.evaluate((y) => { const g = window.__game; g.teleport({ x: 38.5, z: 11.5, yaw: y }); g.setInput({ forward: true }); g.step(30); g.clearInput(); g.teleport({ x: 38.5, z: 14.5, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); g.step(120); g.clearInput(); }, SOUTH);
await page.waitForTimeout(500);
console.log('finish', await page.evaluate(() => [...document.querySelectorAll('#menu, #menu *')].filter((e) => e.offsetParent && e.children.length === 0).map((e) => e.textContent.trim()).filter(Boolean).join(' | ')));
await shot('finish');
await load(52);
await page.evaluate(() => { const g = window.__game; const d = g.state().door; g.teleport({ x: d.x - 3, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); g.step(120); g.clearInput(); });
await page.waitForTimeout(500);
console.log('l53 finish', await page.evaluate(() => [...document.querySelectorAll('#menu, #menu *')].filter((e) => e.offsetParent && e.children.length === 0).map((e) => e.textContent.trim()).filter(Boolean).join(' | ')));
console.log('errors', errors);
await browser.close();
