import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const load = async (level) => { await page.goto(`${BASE}/?test=1&level=${level}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => window.__game?.ready); };
const EAST = -Math.PI / 2;
for (const lv of [50, 51]) {
  await load(lv);
  const r = await page.evaluate((EAST) => { const g = window.__game; const d = g.state().door; g.teleport({ x: d.x - 4, z: d.z, yaw: EAST }); g.setInput({ forward: true }); for (let i = 0; i < 120; i++) g.step(1); g.clearInput(); return g.text(); }, EAST);
  console.log(lv, JSON.stringify(r));
}
await page.screenshot({ path: SP + 'l52-finish.png' });
for (const lv of [21, 41, 36, 16]) { await load(lv); await page.evaluate(() => window.__game.step(30)); }
console.log('errors', errors);
await browser.close();
