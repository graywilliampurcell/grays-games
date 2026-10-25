import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const load = async (level = 49) => { await page.goto(`${BASE}/?test=1&level=${level}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => window.__game?.ready); };
const shot = (name) => page.screenshot({ path: SP + 'l50-' + name + '.png' });
const EAST = -Math.PI / 2, WEST = Math.PI / 2, SOUTH = Math.PI, NORTH = 0;
const msgOf = () => page.evaluate(() => { const m = document.getElementById('message'); return m && !m.hidden ? m.textContent : ''; });

await load();
await page.evaluate(() => window.__game.step(10));
console.log('state', JSON.stringify(await page.evaluate(() => { const s = window.__game.state(); return { pos: s.pos, door: s.door, spike2: s.spike2, currents: s.currents?.length, platforms: s.platforms?.length, level: s.level ?? s.levelName }; })));
await shot('start');

// Path urchin at (10.5, 2.5), top row heading east
for (const d of [-1.14, -1.08, -1.0, 1.0, 1.08, 1.14, 0]) {
    await load();
    const z = 2.5 + d;
    const o = await page.evaluate(({ z, EAST }) => { const g = window.__game; g.teleport({ x: 5.0, z, yaw: EAST }); g.step(1); g.setInput({ forward: true }); let st; let hit = ''; for (let i = 0; i < 300; i++) { st = g.step(1); const m = document.getElementById('message'); if (m && !m.hidden && !hit) hit = m.textContent; if (st.pos.x > 16) break; } g.clearInput(); return { end: st.pos, hit }; }, { z, EAST });
    console.log('squeeze z', z.toFixed(2), JSON.stringify(o));
}
await load();
await page.evaluate((EAST) => { const g = window.__game; g.teleport({ x: 3.0, z: 2.5, yaw: EAST }); g.step(3); }, EAST);
await shot('path-urchin');

async function ride(n, a, fwd, back) {
    return page.evaluate(({ n, a, fwd, back }) => {
        const g = window.__game; const log = [];
        const msg = () => { const m = document.getElementById('message'); return m && !m.hidden ? m.textContent : ''; };
        g.teleport({ x: a.x, z: a.z, yaw: fwd }); g.step(1);
        g.setInput({ forward: true });
        let st; const t1 = g.time(); let enterAt = null;
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
    }, { n, a, fwd, back });
}
await load();
for (const l of await ride(0, { x: 17.0, z: 2.5 }, EAST, WEST)) console.log('bubble', JSON.stringify(l));
await load();
const f = await page.evaluate(() => { const g = window.__game; g.teleport({ x: 26.5, z: 2.5 }); g.step(3); const m = document.getElementById('message'); return { pos: g.state().pos, msg: m && !m.hidden ? m.textContent : '' }; });
console.log('fall', JSON.stringify(f));
await load();
await page.evaluate((EAST) => { const g = window.__game; g.teleport({ x: 18.0, z: 2.5, yaw: EAST }); g.step(3); }, EAST);
await shot('bubble');

const walk = (from, yaw) => page.evaluate(({ from, yaw }) => { const g = window.__game; g.teleport({ ...from, yaw }); g.step(1); g.setInput({ forward: true }); let st; let shoved = null; for (let i = 0; i < 300; i++) { st = g.step(1); if (st.shoved && !shoved) shoved = g.time(); if (shoved && !st.shoved) break; } g.clearInput(); return { end: st.pos, shoved: !!shoved, events: g.events.filter((e) => e.type === 'current').length }; }, { from, yaw });
await load();
console.log('current from west', JSON.stringify(await walk({ x: 13.5, z: 10.5 }, EAST)));
await load();
console.log('current from east', JSON.stringify(await walk({ x: 23.5, z: 10.5 }, WEST)));
const back = (p) => page.evaluate(({ p, NORTH, EAST }) => { const g = window.__game; g.teleport({ ...p, yaw: NORTH }); g.setInput({ forward: true }); let st; for (let i = 0; i < 70; i++) st = g.step(1); g.teleport({ yaw: EAST }); for (let i = 0; i < 60; i++) st = g.step(1); g.clearInput(); return { end: st.pos, events: g.events.filter((e) => e.type === 'current').length }; }, { p, NORTH, EAST });
console.log('current back out', JSON.stringify(await back({ x: 18.5, z: 18.5 })));
await load();
await page.evaluate((EAST) => { const g = window.__game; g.teleport({ x: 12.0, z: 10.5, yaw: EAST }); g.step(3); }, EAST);
await shot('current');

await load();
const u = await page.evaluate((WEST) => { const g = window.__game; g.teleport({ x: 10.5, z: 26.5, yaw: WEST }); g.setInput({ forward: true }); let hit = ''; for (let i = 0; i < 200; i++) { g.step(1); const m = document.getElementById('message'); if (m && !m.hidden) { hit = m.textContent; break; } } g.clearInput(); return hit; }, WEST);
console.log('urchin', u);
await load();
await page.evaluate((WEST) => { const g = window.__game; g.teleport({ x: 11.5, z: 26.5, yaw: WEST }); g.step(3); }, WEST);
await shot('urchin');

for (const lv of [48, 49]) {
    await load(lv);
    const d = await page.evaluate(() => { const g = window.__game; const s = g.state(); g.teleport({ x: s.door.x - 1.2, z: s.door.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); for (let i = 0; i < 100; i++) { if (g.step(1).escaped) break; } g.clearInput(); return g.text(); });
    console.log('door', lv, JSON.stringify(d));
    if (lv === 49) {
        await page.evaluate(() => window.__game.step(60));
        console.log('confetti', await page.evaluate(() => !!document.querySelector('#confetti, .confetti, canvas.confetti')));
        await shot('finale');
    }
}
console.log('errors', errors);
await browser.close();
