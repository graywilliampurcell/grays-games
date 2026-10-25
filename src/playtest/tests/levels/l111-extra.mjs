// Level 111 extra checks: 111 switch Off, views of the bone spike, the ride, the switch
import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 500)); };
const ctx = await browser.newContext({ viewport: { width: 1024, height: 640 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(BASE + '/?test=1&level=110', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
await page.evaluate(() => window.__game.restore());
const shot = (name) => page.screenshot({ path: `${SP}l111b-${name}.png`, timeout: 180000 });

// Bone spike, seen from the corridor next to it (its dead end runs east-west in row 6)
await page.evaluate(() => {
    const g = window.__game;
    const s = g.state();
    // stand in the cell west of the spike's cell, looking east at it
    g.teleport({ x: s.spike.x - 4, z: s.spike.z, yaw: -Math.PI / 2 });
    g.step(1);
});
await shot('bonespike');

// Riding the long-neck, looking down
let r = await page.evaluate(() => {
    const g = window.__game;
    g.teleport({ x: 3.5, z: 2.5, yaw: -Math.PI / 2 });
    g.setInput({ forward: true });
    let s;
    for (let i = 0; i < 30; i++) { s = g.step(1); if (s.platforms[0].riding) break; }
    g.clearInput();
    g.setInput({ lookDy: 260 });
    g.step(1);
    g.setInput({});
    s = g.step(20);
    return { riding: s.platforms[0].riding, at: s.platforms[0].at, buddy: s.buddy.onHead };
});
await shot('ride-down');
console.log('ride', JSON.stringify(r));
await page.evaluate(() => { const g = window.__game; g.step(60); g.setInput({ lookDy: -260 }); g.step(1); g.setInput({}); g.teleport({ yaw: Math.PI / 2 }); g.step(1); });
await shot('after-ride-back');

// The long-neck from the far side, looking back across the pit (head at the far edge now)
await page.evaluate(() => { const g = window.__game; g.teleport({ x: 18.5, z: 2.5, yaw: Math.PI / 2 }); g.step(1); g.setInput({ lookDy: 120 }); g.step(1); g.setInput({}); g.step(1); });
await shot('longneck-view');

// 111 Off: start over -> no egg
await page.evaluate(() => { document.querySelector('#pause-btn').click(); });
await page.evaluate(() => { [...document.querySelectorAll('#menu-main .item')].find((i) => i.dataset.act === 'settings').click(); });
await page.evaluate(() => document.querySelector('[data-setting=dinoHatch]').scrollIntoView());
await shot('switch-on');
await page.evaluate(() => { document.querySelector('[data-setting=dinoHatch]').click(); });
await shot('switch-off');
r = await page.evaluate(() => {
    const off = !document.querySelector('[data-setting=dinoHatch]').classList.contains('on');
    [...document.querySelectorAll('#menu-settings .item')].find((i) => i.dataset.act === 'back').click();
    [...document.querySelectorAll('#menu-main .item')].find((i) => i.dataset.act === 'resume').click();
    const g = window.__game;
    g.restore();
    const b0 = g.state().buddy;
    g.clearEvents();
    g.step(60 * 4);
    return { off, b0: { mode: b0.mode, egg: b0.egg, visible: b0.visible }, events: g.events.filter((e) => e.type === 'buddy') };
});
check('111 Off: no egg, the buddy is already standing at the start', r.off && r.b0.mode === 'follow' && r.b0.visible && !r.b0.egg && r.events.length === 0, r);
await page.evaluate(() => { const g = window.__game; g.teleport({ yaw: g.state().start.yaw }); g.step(1); });
await shot('nohatch');
check('no page errors', errors.length === 0, errors);
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
