import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
await page.goto(`${BASE}/?test=1&level=50`); await page.waitForFunction(() => window.__game?.ready);
// look up at the sky: pitch via look-up input
await page.evaluate(() => { const g = window.__game; g.teleport({ x: 20.5, z: 22.5, yaw: 0.6 }); g.setInput({ lookUp: true, tiltUp: true, up: true }); g.step(40); g.clearInput(); g.step(200); });
console.log(JSON.stringify(await page.evaluate(() => window.__game.state().pitch)));
await page.screenshot({ path: SP + 'l51-sky.png' });
await browser.close();
