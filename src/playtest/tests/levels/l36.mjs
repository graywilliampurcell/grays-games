import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP=SHOTS;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(BASE + '/?test=1&level=35');
await page.waitForFunction(() => window.__game?.ready);
const s = await page.evaluate(() => window.__game.state());
console.log(s.level, 'start', JSON.stringify(s.start), 'spike', JSON.stringify(s.spike), 'plat', JSON.stringify(s.platforms), 'door', JSON.stringify(s.door));
await page.evaluate(() => window.__game.step(10));
await page.screenshot({ path: SP + 'l36-start.png' });
// approach the giant crater from the north, facing +z (yaw PI)
await page.evaluate(() => { window.__game.teleport({ x: 6.5, z: 5.5, yaw: Math.PI }); window.__game.step(10); });
await page.screenshot({ path: SP + 'l36-gap.png' });
// ride: walk on, then stop
const ride = await page.evaluate(() => {
  const g = window.__game; const log = [];
  g.teleport({ x: 6.5, z: 7.5, yaw: Math.PI }); g.step(1);
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
await page.evaluate(() => { window.__game.teleport({ x: 6.5, z: 7.0, yaw: Math.PI }); window.__game.step(3); });
// mid-ride screenshot
await page.evaluate(() => { const g=window.__game; g.teleport({ x: 6.5, z: 7.5, yaw: Math.PI }); g.step(60); g.setInput({forward:true}); for (let i=0;i<40;i++){ const st=g.step(1); if (st.pos.z>9.6) break;} g.clearInput(); g.step(40); });
await page.screenshot({ path: SP + 'l36-ride.png' });
// fall: walk south from the far side? simpler: walk into the gap from the north when the disc is away
const fall = await page.evaluate(() => {
  const g = window.__game; g.teleport({ x: 6.5, z: 22.5, yaw: 0 }); g.step(1);
  // call disc to south edge first? instead go to north and walk in diagonally off its side? walk from south side while disc at north
  g.reset?.();
  return null;
});
await page.goto(BASE + '/?test=1&level=35');
await page.waitForFunction(() => window.__game?.ready);
const fall2 = await page.evaluate(() => {
  const g = window.__game; g.teleport({ x: 6.5, z: 23.5, yaw: 0 }); g.step(1); // south side, facing -z; disc is at north
  g.setInput({ forward: true }); let st; for (let i = 0; i < 20; i++) { st = g.step(1); }
  g.clearInput();
  return { pos: g.state().pos, msg: document.getElementById('message')?.textContent, plat: g.state().platforms[0] };
});
console.log('fall', JSON.stringify(fall2));
// path crater X: left column heading north
const walk = (x, z0) => page.evaluate(([x, z0]) => { const g=window.__game; g.teleport({ x, z: z0, yaw: 0 }); g.step(1); g.setInput({forward:true}); let st; for (let i=0;i<60;i++){ st=g.step(2); if (st.pos.z < 9.5 || Math.abs(st.pos.z-z0)>14) break;} g.clearInput(); return {end: g.state().pos, msg: document.getElementById('message')?.textContent}; }, [x, z0]);
for (const x of [2.5, 1.45, 3.55]) { await page.goto(BASE + '/?test=1&level=35'); await page.waitForFunction(() => window.__game?.ready); console.log('north x', x, JSON.stringify(await walk(x, 22.5))); }
await page.evaluate(() => { window.__game.teleport({ x: 2.5, z: 22.5, yaw: 0 }); window.__game.step(5); });
await page.screenshot({ path: SP + 'l36-approach.png' });
console.log('errors', errors);
await browser.close();
