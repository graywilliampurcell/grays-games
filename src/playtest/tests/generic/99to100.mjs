import { chromium, BASE, SHOTS } from '../playwright.mjs';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(BASE + '/?test=1&level=98', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
const r = await page.evaluate(() => {
    const g = window.__game; const d = g.state().door;
    g.teleport({ x: d.x - 1.5, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true });
    let st; for (let i = 0; i < 60 && !(st = g.step(1)).escaped; i++); g.clearInput();
    const btn = document.querySelector('[data-act=next-level]');
    const label = btn.textContent; btn.click();
    st = g.step(2);
    return { label, name: st.level.name, room: st.room, start: st.pos };
});
console.log(JSON.stringify(r), 'errors', errors);
await browser.close();
