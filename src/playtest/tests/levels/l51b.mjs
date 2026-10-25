import { chromium, BASE, SHOTS } from '../playwright.mjs';
const OUT = SHOTS;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 700 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
// A: Level 40's door in test mode
await page.goto(BASE + '/?test=1&level=49');
await page.waitForFunction(() => window.__game?.ready);
await page.evaluate(() => { const d = __game.state().door; __game.teleport({ x: d.x - 1.0, z: d.z }); __game.step(2); });
await page.waitForTimeout(500);
console.log('A finish:', JSON.stringify(await page.evaluate(() => __game.text())));
await page.screenshot({ path: `${OUT}/l50-finish.png` });
await page.click('[data-act=next-level]');
await page.waitForTimeout(300);
console.log('A after Start Candy World:', JSON.stringify(await page.evaluate(() => __game.state().level)), JSON.stringify(await page.evaluate(() => __game.state().pos)));
// B: Level 41's door
await page.evaluate(() => { const d = __game.state().door; __game.teleport({ x: d.x - 1.0, z: d.z }); __game.step(2); });
await page.waitForTimeout(300);
console.log('B L51 finish:', JSON.stringify(await page.evaluate(() => __game.text())));
// C: main menu with Level 40 beaten
const ctx = await browser.newContext({ viewport: { width: 1024, height: 700 } });
const p2 = await ctx.newPage();
p2.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p2.goto(BASE + '/');
await p2.evaluate(() => {
  localStorage.setItem('mazle.news', JSON.stringify({ told: [...Array(50).keys()], beaten: 49, fresh: [] }));
  localStorage.setItem('mazle.furthest', '49');
  localStorage.setItem('mazle.progress', JSON.stringify({ level: 49, x: 34.5, z: 6.5, yaw: 0, pitch: 0 }));
});
await p2.reload();
await p2.waitForTimeout(1500);
await p2.screenshot({ path: `${OUT}/news51.png` });
console.log('C news:', await p2.locator('#news-title').innerText().catch(() => '?'));
await p2.click('#news-ok').catch(async () => { await p2.keyboard.press('Space'); });
await p2.waitForTimeout(300);
await p2.click('[data-act=pick-level]');
await p2.waitForTimeout(400);
await p2.screenshot({ path: `${OUT}/worlds51.png` });
await p2.locator('[data-act=pick-world]').last().click();
await p2.waitForTimeout(400);
await p2.screenshot({ path: `${OUT}/world-levels51.png` });
await browser.close();
