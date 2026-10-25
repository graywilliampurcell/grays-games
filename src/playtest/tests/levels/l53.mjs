import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const load = async (level = 52) => { await page.goto(`${BASE}/?test=1&level=${level}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => window.__game?.ready); };
const shot = (name) => page.screenshot({ path: SP + 'l53-' + name + '.png' });
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
  ['bounce east', 14.5, 38.5, EAST, 200], ['bounce west', 34.5, 38.5, WEST, 200],
  ['past pad north side', 14.5, 37.5, EAST, 200], ['past pad south side', 14.5, 39.5, EAST, 200],
  ['cane S centre', 34.5, 17.5, SOUTH, 120], ['cane S left', 33.5, 17.5, SOUTH, 120], ['cane S right', 35.5, 17.5, SOUTH, 120],
  ['cane S 33.45', 33.45, 17.5, SOUTH, 120], ['cane S 35.55', 35.55, 17.5, SOUTH, 120], ['cane S 33.7', 33.7, 17.5, SOUTH, 120],
  ['cane N left', 33.5, 27.5, NORTH, 120], ['cane N right', 35.5, 27.5, NORTH, 120],
  ['big cane', 10.5, 22.5, WEST, 200],
];
for (const [name, x, z, yaw, n] of tries) { await load(); console.log(name, JSON.stringify(await walk(x, z, yaw, n))); }
await load();
await page.evaluate((y) => { const g = window.__game; g.teleport({ x: 10.5, z: 22.5, yaw: y }); g.step(2); }, WEST);
await shot('big-cane-from-path');
await page.evaluate((y) => { const g = window.__game; g.teleport({ x: 9.5, z: 22.5, yaw: y }); g.step(2); }, WEST);
await shot('big-cane');
await page.evaluate((y) => { const g = window.__game; g.teleport({ x: 34.5, z: 18.2, yaw: y }); g.step(2); }, SOUTH);
await shot('path-cane');
await page.evaluate((y) => { const g = window.__game; g.teleport({ x: 11.5, z: 38.5, yaw: y }); g.step(2); }, EAST);
await shot('river');
// finish: walk to door
await page.evaluate((y) => { const g = window.__game; g.teleport({ x: 37.5, z: 34.5, yaw: y }); g.setInput({ forward: true }); g.step(120); g.clearInput(); }, EAST);
await page.waitForTimeout(500);
console.log('finish', await page.evaluate(() => [...document.querySelectorAll('#menu, #menu *')].filter((e) => e.offsetParent && e.children.length === 0).map((e) => e.textContent.trim()).filter(Boolean).join(' | ')));
await shot('finish');
// Level 52 door -> Start Level 53
await load(51);
await page.evaluate(() => { const g = window.__game; const d = g.state().door; g.teleport({ x: d.x - 3, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); g.step(120); g.clearInput(); });
await page.waitForTimeout(500);
console.log('l52 finish', await page.evaluate(() => [...document.querySelectorAll('#menu, #menu *')].filter((e) => e.offsetParent && e.children.length === 0).map((e) => e.textContent.trim()).filter(Boolean).join(' | ')));
console.log('errors', errors);
await browser.close();
