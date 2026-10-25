import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP=SHOTS;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(BASE + '/?test=1&level=33');
await page.waitForFunction(() => window.__game?.ready);
const s = await page.evaluate(() => window.__game.state());
console.log(s.level, 'start', JSON.stringify(s.start), 'spike', JSON.stringify(s.spike), 'rows', JSON.stringify(s.spikeRows), 'door', JSON.stringify(s.door));
await page.evaluate(() => window.__game.step(10));
await page.screenshot({ path: SP + 'l34-start.png' });
// path crater at x 14.5 z 2.5; walk west->east along z
const walk = (z, x0, yaw, stopX) => page.evaluate(([z, x0, yaw, stopX]) => { window.__game.teleport({ x: x0, z, yaw }); window.__game.step(1); window.__game.setInput({forward:true}); let st; for (let i=0;i<60;i++){ st=window.__game.step(2); if ((yaw<0 && st.pos.x>stopX) || (yaw>0 && st.pos.x<stopX) || Math.abs(st.pos.x-x0)>12) break;} window.__game.clearInput(); const e=window.__game.state(); return {end: e.pos, msg: document.getElementById('message')?.textContent}; }, [z, x0, yaw, stopX]);
for (const z of [2.5, 1.45, 1.4, 3.55, 3.6]) console.log('east z', z, JSON.stringify(await walk(z, 9.5, -Math.PI/2, 18.5)));
await page.evaluate(() => { window.__game.teleport({ x: 7.5, z: 2.5, yaw: -Math.PI/2 }); window.__game.step(5); });
await page.screenshot({ path: SP + 'l34-approach.png' });
for (const [x0,yaw] of [[18.5,-Math.PI/2],[29.5,Math.PI/2]]) {
  const r = await page.evaluate(([x0,yaw]) => { window.__game.teleport({ x: x0, z: 10.5, yaw }); window.__game.step(1); window.__game.setInput({forward:true}); let st; for (let i=0;i<40;i++){ st=window.__game.step(2); if (Math.abs(st.pos.x-x0)>9 || Math.abs(st.pos.z-10.5)>3) break;} window.__game.clearInput(); return {end: window.__game.state().pos, msg: document.getElementById('message')?.textContent}; }, [x0,yaw]);
  console.log('big from', x0, JSON.stringify(r));
}
console.log('errors', errors);
await browser.close();
