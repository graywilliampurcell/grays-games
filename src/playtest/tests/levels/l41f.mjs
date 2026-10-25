import { chromium, BASE, SHOTS } from '../playwright.mjs';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 320, height: 200 } });
await page.goto(`${BASE}/?test=1&level=40`);
await page.waitForFunction(() => window.__game?.ready);
for (const n of [1, 10, 50]) {
  const r = await page.evaluate((n) => { const t = performance.now(); for (let i = 0; i < n; i++) { const s = __game.state(); __game.teleport({ yaw: -1.57 }); __game.setInput({ forward: true }); __game.step(1); } return [(performance.now() - t) / n, __game.state().pos]; }, n);
  console.log(n, JSON.stringify(r));
}
await browser.close();
