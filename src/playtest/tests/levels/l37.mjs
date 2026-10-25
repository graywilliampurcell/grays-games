import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP=SHOTS;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const load = async () => { await page.goto(BASE + '/?test=1&level=36'); await page.waitForFunction(() => window.__game?.ready); };
await load();
const s = await page.evaluate(() => window.__game.state());
console.log(s.level, 'start', JSON.stringify(s.start), 'spike', JSON.stringify(s.spike), 'spike2', JSON.stringify(s.spike2), 'plat', JSON.stringify(s.platforms), 'door', JSON.stringify(s.door));
await page.evaluate(() => window.__game.step(10));
await page.screenshot({ path: SP + 'l37-start.png' });
await page.evaluate(() => { window.__game.teleport({ x: 30.5, z: 5.5, yaw: Math.PI }); window.__game.step(10); });
await page.screenshot({ path: SP + 'l37-gap.png' });
const ride = await page.evaluate(() => {
  const g = window.__game; const log = [];
  g.teleport({ x: 30.5, z: 7.5, yaw: Math.PI }); g.step(1);
  g.setInput({ forward: true });
  let st; for (let i = 0; i < 40; i++) { st = g.step(1); if (st.pos.z > 9.6) break; }
  g.clearInput();
  log.push(['on', st.pos, st.platforms[0]]);
  for (let i = 0; i < 200; i++) { st = g.step(2); if (!st.platforms[0].riding && st.platforms[0].at > 0) break; }
  log.push(['arrived', st.pos, st.platforms[0], document.getElementById('message')?.textContent]);
  g.setInput({ forward: true });
  for (let i = 0; i < 30; i++) st = g.step(2);
  g.clearInput();
  log.push(['off', st.pos]);
  return log;
});
console.log('ride', JSON.stringify(ride));
await load();
const fall = await page.evaluate(() => {
  const g = window.__game; g.teleport({ x: 30.5, z: 14, yaw: Math.PI }); g.step(3);
  return { pos: g.state().pos, msg: document.getElementById('message')?.textContent };
});
console.log('fall', JSON.stringify(fall));
// path crater Z at (26.5, 2.5): walk east along the top row
for (const z of [2.5, 1.45, 3.55]) {
  await load();
  const r = await page.evaluate((z) => { const g=window.__game; g.teleport({ x: 18.5, z, yaw: -Math.PI/2 }); g.step(1); g.setInput({forward:true}); let st; for (let i=0;i<60;i++){ st=g.step(2); if (st.pos.x > 29.5) break;} g.clearInput(); return {end: g.state().pos, msg: document.getElementById('message')?.textContent}; }, z);
  console.log('east z', z, JSON.stringify(r));
}
await load();
await page.evaluate(() => { window.__game.teleport({ x: 18.5, z: 2.5, yaw: -Math.PI/2 }); window.__game.step(5); });
await page.screenshot({ path: SP + 'l37-approach.png' });
// hidden crater X at (6.5, 18.5): from (2.5, 18.5) walk east
await load();
const h = await page.evaluate(() => { const g=window.__game; g.teleport({ x: 2.5, z: 18.5, yaw: -Math.PI/2 }); g.step(1); g.setInput({forward:true}); let st; for (let i=0;i<30;i++){ st=g.step(2);} g.clearInput(); return {end: g.state().pos, msg: document.getElementById('message')?.textContent}; });
console.log('hidden', JSON.stringify(h));
await load();
await page.evaluate(() => { window.__game.teleport({ x: 2.5, z: 21.5, yaw: 0 }); window.__game.step(5); });
await page.screenshot({ path: SP + 'l37-hidden.png' });
console.log('errors', errors);
await browser.close();
