import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const load = async (level = 44) => { await page.goto(`${BASE}/?test=1&level=${level}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => window.__game?.ready); };
const shot = (name) => page.screenshot({ path: SP + 'l45-' + name + '.png' });
const EAST = -Math.PI / 2, WEST = Math.PI / 2, SOUTH = Math.PI, NORTH = 0;

await load();
await page.evaluate(() => window.__game.step(10));
await shot('start');

// Ride a bubble: platform n, from point a (yaw fwd) and back (yaw back)
async function ride(n, a, fwd, back, partial) {
    return page.evaluate(({ n, a, fwd, back, partial }) => {
        const g = window.__game; const log = [];
        const msg = () => { const m = document.getElementById('message'); return m && !m.hidden ? m.textContent : ''; };
        g.teleport({ x: a.x, z: a.z, yaw: fwd }); g.step(1);
        g.setInput({ forward: true });
        let st;
        if (partial) {
            for (let i = 0; i < 400; i++) { st = g.step(1); if (st.platforms[n].pushing) break; }
            const t0 = g.time();
            for (let i = 0; i < 1000; i++) { st = g.step(1); if (g.time() - t0 >= 1.0) break; }
            g.clearInput();
            log.push(['after ~1s push', st.platforms[n].push]);
            g.teleport({ yaw: back }); g.setInput({ forward: true }); for (let i = 0; i < 60; i++) st = g.step(1); g.clearInput();
            for (let i = 0; i < 60; i++) st = g.step(1);
            log.push(['walked away', st.pos, st.platforms[n].push]);
            g.teleport({ yaw: fwd }); g.setInput({ forward: true });
        }
        const t1 = g.time(); let enterAt = null;
        for (let i = 0; i < 2000; i++) { st = g.step(1); if (st.platforms[n].riding) { enterAt = g.time(); break; } }
        log.push(['entered after', enterAt - t1, st.pos]);
        for (let i = 0; i < 2000; i++) { st = g.step(1); if (!st.platforms[n].riding) break; }
        log.push(['arrived', st.pos, st.platforms[n].at, msg()]);
        for (let i = 0; i < 40; i++) st = g.step(1);
        g.clearInput();
        log.push(['walked on', st.pos, msg()]);
        g.teleport({ yaw: back }); g.setInput({ forward: true });
        for (let i = 0; i < 2000; i++) { st = g.step(1); if (st.platforms[n].riding) break; }
        for (let i = 0; i < 2000; i++) { st = g.step(1); if (!st.platforms[n].riding) break; }
        for (let i = 0; i < 30; i++) st = g.step(1);
        g.clearInput();
        log.push(['rode back', st.pos, st.platforms[n].at, msg()]);
        return log;
    }, { n, a, fwd, back, partial });
}
await load();
for (const l of await ride(1, { x: 34.5, z: 2.5 }, SOUTH, NORTH, true)) console.log('bubble1', JSON.stringify(l));
await load();
for (const l of await ride(0, { x: 2.5, z: 34.5 }, EAST, WEST, false)) console.log('bubble2', JSON.stringify(l));

// Falls
for (const p of [{ x: 34.5, z: 10.5 }, { x: 10.5, z: 34.5 }]) {
    await load();
    const f = await page.evaluate((p) => { const g = window.__game; g.teleport(p); g.step(3); const m = document.getElementById('message'); return { pos: g.state().pos, msg: m && !m.hidden ? m.textContent : '' }; }, p);
    console.log('fall', JSON.stringify(p), JSON.stringify(f));
}
// Current: walk west along row 7 through (6.5, 30.5)
await load();
const cur = await page.evaluate((WEST) => { const g = window.__game; g.teleport({ x: 14.5, z: 30.5, yaw: WEST }); g.step(1); g.setInput({ forward: true }); let st; let shoved = null; for (let i = 0; i < 300; i++) { st = g.step(1); if (st.shoved && !shoved) shoved = g.time(); if (shoved && !st.shoved) break; } g.clearInput(); return { end: st.pos, shoved: !!shoved, events: g.events.filter((e) => e.type === 'current').length }; }, WEST);
console.log('current', JSON.stringify(cur));
// walk back out south and continue west: no second shove
const cur2 = await page.evaluate((SOUTH) => { const g = window.__game; g.teleport({ x: 6.5, z: 26.5, yaw: SOUTH }); g.setInput({ forward: true }); let st; for (let i = 0; i < 70; i++) st = g.step(1); g.teleport({ yaw: Math.PI / 2 }); for (let i = 0; i < 60; i++) st = g.step(1); g.clearInput(); return { end: st.pos, events: g.events.filter((e) => e.type === 'current').length }; }, SOUTH);
console.log('current back out', JSON.stringify(cur2));
await load();
await page.evaluate((WEST) => { const g = window.__game; g.teleport({ x: 13.5, z: 30.5, yaw: WEST }); g.step(3); }, WEST);
await shot('current');
// Urchin at (10.5, 2.5)
await load();
const u = await page.evaluate(() => { const g = window.__game; g.teleport({ x: 6.5, z: 2.5, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); let hit = ''; for (let i = 0; i < 200; i++) { g.step(1); const m = document.getElementById('message'); if (m && !m.hidden) { hit = m.textContent; break; } } g.clearInput(); return hit; });
console.log('urchin', u);
await load();
await page.evaluate(() => { const g = window.__game; g.teleport({ x: 6.5, z: 2.5, yaw: -Math.PI / 2 }); g.step(3); });
await shot('urchin');
await load();
await page.evaluate((SOUTH) => { const g = window.__game; g.teleport({ x: 34.5, z: 1.8, yaw: SOUTH }); g.step(3); }, SOUTH);
await shot('bubble1');
await load();
await page.evaluate((EAST) => { const g = window.__game; g.teleport({ x: 2.0, z: 34.5, yaw: EAST }); g.step(3); }, EAST);
await shot('bubble2');
for (const lv of [43, 44]) {
    await load(lv);
    const d = await page.evaluate(() => { const g = window.__game; const s = g.state(); g.teleport({ x: s.door.x - 1.2, z: s.door.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); for (let i = 0; i < 100; i++) { if (g.step(1).escaped) break; } g.clearInput(); return g.text(); });
    console.log('door', lv, JSON.stringify(d));
}
console.log('errors', errors);
await browser.close();
