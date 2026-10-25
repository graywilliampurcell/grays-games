import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP=SHOTS;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const load = async () => { await page.goto(BASE + '/?test=1&level=35'); await page.waitForFunction(() => window.__game?.ready); };
await load();
await page.evaluate(() => { window.__game.teleport({ x: 6.5, z: 25.5, yaw: 0 }); window.__game.step(10); });
await page.screenshot({ path: SP + 'l36-gap.png' });
const ride = await page.evaluate(() => {
  const g = window.__game; const log = [];
  g.teleport({ x: 6.5, z: 21.5, yaw: 0 }); g.step(1);
  g.setInput({ forward: true });
  let st; for (let i = 0; i < 60; i++) { st = g.step(1); if (st.pos.z < 19.0) break; }
  g.clearInput();
  log.push(['on', st.pos, st.platforms[0].at, st.platforms[0].riding]);
  for (let i = 0; i < 300; i++) { st = g.step(2); if (!st.platforms[0].riding && st.platforms[0].at === 0) break; if (i===40) log.push(['mid', st.pos.z, st.platforms[0].at]); }
  log.push(['arrived', st.pos, st.platforms[0].at, document.getElementById('message')?.textContent]);
  g.setInput({ forward: true });
  for (let i = 0; i < 30; i++) st = g.step(2);
  g.clearInput();
  log.push(['off', st.pos, document.getElementById('message')?.textContent]);
  return log;
});
console.log('ride', JSON.stringify(ride));
await load();
await page.evaluate(() => { const g=window.__game; g.teleport({ x: 6.5, z: 21.5, yaw: 0 }); g.step(1); g.setInput({forward:true}); for (let i=0;i<60;i++){ const st=g.step(1); if (st.pos.z<19.0) break;} g.clearInput(); g.step(45); });
await page.screenshot({ path: SP + 'l36-ride.png' });
// fall: from the north side with the disc at the south edge, walk south into the gap
await load();
const fall = await page.evaluate(() => {
  const g = window.__game; g.teleport({ x: 6.5, z: 6.5, yaw: Math.PI }); g.step(1);
  g.setInput({ forward: true }); for (let i = 0; i < 25; i++) g.step(1);
  g.clearInput();
  return { pos: g.state().pos, msg: document.getElementById('message')?.textContent, at: g.state().platforms[0].at };
});
console.log('fall', JSON.stringify(fall));
// call: stand at the north edge and the disc floats over
await load();
const call = await page.evaluate(() => { const g=window.__game; g.teleport({ x: 6.5, z: 7.5, yaw: Math.PI }); for (let i=0;i<150;i++) g.step(2); return g.state().platforms[0]; });
console.log('call', JSON.stringify(call));
await page.screenshot({ path: SP + 'l36-call.png' });
console.log('errors', errors);
await browser.close();
