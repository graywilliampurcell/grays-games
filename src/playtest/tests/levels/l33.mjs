import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP=SHOTS;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(BASE + '/?test=1&level=32');
await page.waitForFunction(() => window.__game?.ready);
const s = await page.evaluate(() => window.__game.state());
console.log(s.level, 'start', JSON.stringify(s.start), 'spike', JSON.stringify(s.spike), 'rows', JSON.stringify(s.spikeRows), 'door', JSON.stringify(s.door));
await page.evaluate(() => window.__game.step(10));
await page.screenshot({ path: SP + 'l33-start.png' });
for (const yaw of [0, Math.PI]) {
  const r = await page.evaluate((yaw) => { window.__game.teleport({ x: 30.5, z: 14, yaw }); window.__game.step(1); window.__game.setInput({forward:true}); const st = window.__game.step(20); window.__game.clearInput(); return st.pos; }, yaw);
  console.log('yaw', yaw.toFixed(2), JSON.stringify(r));
}
console.log('errors', errors);
await browser.close();
