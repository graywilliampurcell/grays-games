// Level 113 Quit/Continue with fossils (real mode, no test hooks)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1024, height: 640 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
// Saved spot: Level 113, standing on the skull fossil (fossil 0), the shell (1) already found
await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('mazle.progress', JSON.stringify({ level: 112, x: 2.5, z: 42.3, yaw: 0, pitch: 0, fossils: [1, 2] }));
    localStorage.setItem('mazle.furthest', JSON.stringify(112));
});
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(4000);
// dismiss What's new if shown
if (await page.isVisible('[data-act="news-ok"]')) await page.click('[data-act="news-ok"]');
await page.click('[data-act="continue"]');
await page.waitForTimeout(3000);
const counter = await page.textContent('#fossils');
const hidden = await page.getAttribute('#fossils', 'hidden');
console.log('after Continue:', counter, 'hidden', hidden);
await page.keyboard.press('Space');
await page.waitForTimeout(500);
await page.click('[data-act="quit"]');
await page.waitForTimeout(300);
if (await page.isVisible('[data-act="yes"]')) await page.click('[data-act="yes"]');
await page.waitForTimeout(500);
const saved = await page.evaluate(() => localStorage.getItem('mazle.progress'));
console.log('saved', saved);
const ok = counter === '🦴 3 / 3' && hidden === null && JSON.parse(saved).fossils?.join() === '0,1,2';
console.log(ok ? 'PASS' : 'FAIL', 'Continue restores found fossils, Quit saves them');
console.log('errors', errors);
await browser.close();
