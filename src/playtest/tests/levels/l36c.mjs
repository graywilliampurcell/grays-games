import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP=SHOTS;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
await page.goto(BASE + '/?test=1&level=35'); await page.waitForFunction(() => window.__game?.ready);
const fall = await page.evaluate(() => {
  const g = window.__game; g.teleport({ x: 6.5, z: 12, yaw: Math.PI }); g.step(3);
  return { pos: g.state().pos, msg: document.getElementById('message')?.textContent, at: g.state().platforms[0].at };
});
console.log('fall', JSON.stringify(fall));
// ride, then go back: the disc should come back when called from the south
const back = await page.evaluate(() => {
  const g = window.__game; g.teleport({ x: 6.5, z: 21.5, yaw: 0 }); g.step(1);
  g.setInput({ forward: true }); for (let i=0;i<60;i++){ const st=g.step(1); if (st.pos.z<19) break; } g.clearInput();
  for (let i=0;i<200;i++) g.step(2);
  const a = g.state().platforms[0].at;
  g.teleport({ x: 6.5, z: 2.5, yaw: 0 }); g.step(1); // somewhere else; then reset to start
  return { afterRide: a };
});
console.log('back', JSON.stringify(back));
// view down into the crater
await page.evaluate(() => { const g=window.__game; g.teleport({ x: 6.5, z: 21.0, yaw: 0 }); g.step(5); });
await page.screenshot({ path: SP + 'l36-edge.png' });
await browser.close();
