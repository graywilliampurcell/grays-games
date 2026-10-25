// Level 112: the buddy waits before the tail swish while helping
import { chromium, BASE, SHOTS } from '../playwright.mjs';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 800, height: 500 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(BASE + '/?test=1&level=111&lost=1', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
await page.evaluate(`window.__walk = (points) => {
    const g = window.__game;
    let s = g.state();
    for (const [x, z] of points) {
        for (let tries = 0; tries < 40; tries++) {
            const dx = x - s.pos.x, dz = z - s.pos.z;
            const d = Math.hypot(dx, dz);
            if (d < 0.3) break;
            const yaw = Math.atan2(-dx, -dz);
            s = g.teleport({ yaw });
            g.setInput({ forward: true });
            let n = 0;
            for (; n < 20; n++) {
                s = g.step(1);
                if (s.escaped) { g.clearInput(); return s; }
                const ex = x - s.pos.x, ez = z - s.pos.z;
                if (Math.hypot(ex, ez) < 0.3 || ex * dx + ez * dz < 0) break;
            }
            g.clearInput();
            s = g.step(1);
        }
    }
    return s;
};
window.__center = ([i, j]) => [4 * i + 2.5, 4 * j + 2.5];
`);
let r = await page.evaluate(() => {
    const g = window.__game;
    g.step(30);
    let s = g.state();
    const path = s.buddy.path;
    for (let k = 1; k <= 35; k++) { const [x, z] = window.__center(path[k]); g.teleport({ x, z }); g.step(2); }
    s = g.step(30);
    const key = (c) => c.join(',');
    const on = new Set(path.map(key));
    const grid = s.grid;
    const open = (x, z) => grid[z]?.[x] !== undefined && grid[z][x] !== '#' && grid[z][x] !== 'D';
    const links = ([i, j]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([di, dj]) => open(4 * i + 2 + 2 * di, 4 * j + 2 + 2 * dj)).map(([di, dj]) => [i + di, j + dj]);
    let k = 35, off = null;
    for (; k >= 20; k--) { off = links(path[k]).find((c) => !on.has(key(c))); if (off) break; }
    s = window.__walk(path.slice(k, 36).reverse().map(window.__center));
    const asked = [];
    for (let n = 0; n < 3; n++) {
        s = window.__walk([window.__center(off), window.__center(path[k])]);
        for (const e of g.events.splice(0)) if (e.type === 'lost') asked.push(n);
    }
    return { k, off, asked, furthest: g.state().buddy.furthest, menu: g.text() };
});
console.log(JSON.stringify(r));
await page.keyboard.press(' ');
r = await page.evaluate(() => {
    const g = window.__game;
    let s = g.state();
    const path = s.buddy.path;
    const out = [];
    // walk to path cell index 37 slowly, then wait there a while
    for (let k = s.buddy.furthest; k <= 38; k++) { s = window.__walk([window.__center(path[k])]); s = g.step(30); out.push({ k, mode: s.buddy.mode, bx: s.buddy.x, bz: s.buddy.z, pz: s.pos.z }); }
    s = g.step(240);
    out.push({ wait: true, mode: s.buddy.mode, bx: s.buddy.x, bz: s.buddy.z, pz: s.pos.z });
    for (let k = 39; k <= 44; k++) { s = window.__walk([window.__center(path[k])]); s = g.step(10); out.push({ k, mode: s.buddy.mode, bx: s.buddy.x, bz: s.buddy.z, pz: s.pos.z, px: s.pos.x }); }
    return out;
});
console.log(JSON.stringify(r, null, 0));
console.log('errors', errors);
await browser.close();
