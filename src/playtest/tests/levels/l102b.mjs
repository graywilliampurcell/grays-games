import { chromium, BASE, SHOTS } from '../playwright.mjs';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1024, height: 640 } })).newPage();
for (const [lvl, x, z] of [[100, 38.5, 34.5]]) {
  await page.goto(`${BASE}/?test=1&level=${lvl}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
  const r = await page.evaluate(({ x, z }) => { const g = window.__game; const d = g.state().door; g.teleport({ x, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); for (let i = 0; i < 400; i++) g.step(1); g.clearInput(); return { door: d, text: g.text() }; }, { x, z });
  console.log(lvl, JSON.stringify(r));
  await page.screenshot({ path: `shots/l102-door-${lvl}.png` });
}
await browser.close();
