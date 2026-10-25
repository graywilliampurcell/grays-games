import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP=SHOTS;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(BASE + '/?test=1&level=32');
await page.waitForFunction(() => window.__game?.ready);
const walk = (x) => page.evaluate((x) => { window.__game.teleport({ x, z: 18.5, yaw: Math.PI }); window.__game.step(1); window.__game.setInput({forward:true}); let maxZ=0; for (let i=0;i<60;i++){ const st=window.__game.step(2); maxZ=Math.max(maxZ, st.pos.z); if (st.pos.z<10) break;} window.__game.clearInput(); const st=window.__game.state(); return {maxZ, end: st.pos, msg: document.getElementById('message')?.textContent}; }, x);
console.log('middle', JSON.stringify(await walk(30.5)));
console.log('west edge', JSON.stringify(await walk(29.42)));
console.log('east edge', JSON.stringify(await walk(31.58)));
await page.evaluate(() => { window.__game.teleport({ x: 30.5, z: 18.0, yaw: Math.PI }); window.__game.step(5); });
await page.screenshot({ path: SP + 'l33-approach.png' });
// big crater: walk east into the dead end from path cell (5,0)
const r = await page.evaluate(() => { window.__game.teleport({ x: 22.5, z: 2.5, yaw: -Math.PI/2 }); window.__game.step(1); window.__game.setInput({forward:true}); let st; for (let i=0;i<40;i++){ st=window.__game.step(2); if (st.pos.x<10) break;} window.__game.clearInput(); return {end: window.__game.state().pos, msg: document.getElementById('message')?.textContent}; });
console.log('big crater', JSON.stringify(r));
await page.evaluate(() => { window.__game.teleport({ x: 21.5, z: 2.5, yaw: -Math.PI/2 }); window.__game.step(5); });
await page.screenshot({ path: SP + 'l33-big.png' });
// seen from path cell (5,1) looking north? and from (4,0) looking east
await page.evaluate(() => { window.__game.teleport({ x: 17.5, z: 2.5, yaw: -Math.PI/2 }); window.__game.step(5); });
await page.screenshot({ path: SP + 'l33-big-far.png' });
console.log('errors', errors);
await browser.close();
