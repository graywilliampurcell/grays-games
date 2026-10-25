import { chromium, BASE, SHOTS } from '../playwright.mjs';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
for (const lvl of [39, 40]) {
  const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
  await page.goto(`${BASE}/?test=1&level=${lvl}`);
  await page.waitForFunction(() => window.__game?.ready);
  const ms = await page.evaluate(() => { __game.step(1); const t = performance.now(); for (let i = 0; i < 30; i++) { __game.teleport({ yaw: i * 0.1 }); __game.step(1); __game.state(); } return (performance.now() - t) / 30; });
  const info = await page.evaluate(() => { let tris = 0, meshes = 0; return 0; });
  console.log('level index', lvl, 'ms/render', ms.toFixed(1));
  await page.close();
}
await browser.close();
