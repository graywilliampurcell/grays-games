import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP=SHOTS;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(BASE + '/?test=1&level=31');
await page.waitForFunction(() => window.__game?.ready);
const walk = (z) => page.evaluate((z) => { window.__game.restore?.(); window.__game.teleport({ x: 5.5, z, yaw: -Math.PI/2 }); window.__game.step(1); window.__game.setInput({forward:true}); let maxX=0; for (let i=0;i<60;i++){ const st=window.__game.step(2); maxX=Math.max(maxX, st.pos.x); if (st.pos.x<4) break;} window.__game.clearInput(); const st=window.__game.state(); return {maxX, end: st.pos, msg: document.getElementById('message')?.textContent}; }, z);
console.log('middle', JSON.stringify(await walk(30.5)));
console.log('north edge', JSON.stringify(await walk(29.42)));
console.log('south edge', JSON.stringify(await walk(31.58)));
// screenshot approach
await page.evaluate(() => { window.__game.teleport({ x: 3.0, z: 30.5, yaw: -Math.PI/2 }); window.__game.step(5); });
await page.screenshot({ path: SP + 'l32-approach.png' });
// sneaky crater
const r = await page.evaluate(() => { window.__game.teleport({ x: 14.5, z: 4.5, yaw: 0 }); window.__game.step(1); const before=window.__game.state().pos; window.__game.teleport({ x: 14.5, z: 2.8 }); const st=window.__game.step(3); return {before, after: st.pos, msg: document.getElementById('message')?.textContent}; });
console.log('sneaky', JSON.stringify(r));
await page.evaluate(() => { window.__game.teleport({ x: 14.5, z: 7.0, yaw: 0 }); window.__game.step(5); });
await page.screenshot({ path: SP + 'l32-sneaky.png' });
console.log('errors', errors);
await browser.close();
