import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const load = async (level = 41) => { await page.goto(`${BASE}/?test=1&level=${level}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => window.__game?.ready); };
const shot = (name) => page.screenshot({ path: SP + 'l42-' + name + '.png' });
const EAST = -Math.PI / 2;
const WEST = Math.PI / 2;

await load();
let s = await page.evaluate(() => window.__game.state());
console.log(s.level, 'start', JSON.stringify(s.start), 'door', JSON.stringify(s.door), 'plat', JSON.stringify(s.platforms), 'current', JSON.stringify(s.current));
await page.evaluate(() => window.__game.step(10));
await shot('start');

// Push in two goes, walking away in between: progress kept
const r = await page.evaluate(({ EAST, WEST }) => {
    const g = window.__game; const log = [];
    const msg = () => document.getElementById('message')?.hidden ? '' : document.getElementById('message')?.textContent;
    g.teleport({ x: 2.5, z: 34.5, yaw: EAST }); g.step(1);
    g.setInput({ forward: true });
    let st; let t = 0;
    for (let i = 0; i < 400; i++) { st = g.step(1); if (st.platforms[0].pushing) break; }
    const t0 = g.time();
    for (let i = 0; i < 1000; i++) { st = g.step(1); if (g.time() - t0 >= 1.0) break; }
    g.clearInput();
    log.push(['after ~1s push', st.pos.x, st.platforms[0].push, st.platforms[0].riding]);
    // walk away west and come back
    g.teleport({ yaw: WEST }); g.setInput({ forward: true }); for (let i = 0; i < 60; i++) st = g.step(1); g.clearInput();
    for (let i = 0; i < 60; i++) st = g.step(1);
    log.push(['walked away', st.pos.x, st.platforms[0].push]);
    g.teleport({ yaw: EAST }); g.setInput({ forward: true });
    const t1 = g.time(); let enterAt = null;
    for (let i = 0; i < 2000; i++) { st = g.step(1); if (st.platforms[0].riding) { enterAt = g.time(); break; } }
    log.push(['entered', st.pos, st.platforms[0], 'secs after resuming', enterAt - t1]);
    let maxDev = 0;
    for (let i = 0; i < 2000; i++) { st = g.step(1); maxDev = Math.max(maxDev, Math.abs(st.pos.z - 34.5)); if (!st.platforms[0].riding) break; }
    log.push(['arrived', st.pos, st.platforms[0].at, 'maxZdev', maxDev, msg()]);
    for (let i = 0; i < 60; i++) st = g.step(1);
    g.clearInput();
    log.push(['walked on', st.pos, msg(), g.events.filter((e) => ['fall', 'platform'].includes(e.type)).map((e) => e.type + ':' + (e.what || ''))]);
    // and back again from the far side
    g.teleport({ yaw: WEST }); g.setInput({ forward: true });
    for (let i = 0; i < 2000; i++) { st = g.step(1); if (st.platforms[0].riding) break; }
    for (let i = 0; i < 2000; i++) { st = g.step(1); if (!st.platforms[0].riding) break; }
    for (let i = 0; i < 30; i++) st = g.step(1);
    g.clearInput();
    log.push(['back west', st.pos, st.platforms[0].at, msg()]);
    return log;
}, { EAST, WEST });
for (const l of r) console.log(JSON.stringify(l));

// Screens: bubble ahead, half-pushed, inside, crack
await load();
await page.evaluate((EAST) => { const g = window.__game; g.teleport({ x: 1.6, z: 34.5, yaw: EAST }); g.step(5); }, EAST);
await shot('bubble');
await page.evaluate((EAST) => { const g = window.__game; g.teleport({ x: 3.5, z: 34.5, yaw: EAST }); g.setInput({ forward: true }); for (let i = 0; i < 400; i++) { if (g.step(1).platforms[0].push > 1.6) break; } g.clearInput(); g.teleport({ x: 1.0, z: 33.6, yaw: EAST + 0.25 }); g.step(1); }, EAST);
await shot('stretched');
await page.evaluate((EAST) => { const g = window.__game; g.teleport({ x: 3.5, z: 34.5, yaw: EAST }); g.setInput({ forward: true }); for (let i = 0; i < 400; i++) { if (g.step(1).platforms[0].riding) break; } for (let i = 0; i < 25; i++) g.step(1); g.clearInput(); g.step(1); }, EAST);
await shot('inside');
await load();
await page.evaluate(() => { const g = window.__game; g.teleport({ x: 18.2, z: 34.5, yaw: Math.PI / 2 }); g.step(2); });
await page.mouse.move(512, 320);
await page.evaluate(() => { const p = window.__game; });
await shot('crack-from-far');

// Falls: middle of the crack, and walking in from the far side
for (const p of [{ x: 10.5, z: 34.5 }, { x: 5.9, z: 33.3 }]) {
    await load();
    const f = await page.evaluate((p) => { const g = window.__game; g.teleport(p); g.step(3); const st = g.state(); return { pos: st.pos, msg: document.getElementById('message')?.textContent, push: st.platforms[0].push, at: st.platforms[0].at }; }, p);
    console.log('fall', JSON.stringify(p), JSON.stringify(f));
}
// push progress cleared by going back to the start
await load();
const pr = await page.evaluate((EAST) => { const g = window.__game; g.teleport({ x: 3.5, z: 34.5, yaw: EAST }); g.setInput({ forward: true }); for (let i = 0; i < 400; i++) { if (g.step(1).platforms[0].push > 1.0) break; } g.clearInput(); const before = g.state().platforms[0].push; g.teleport({ x: 10.5, z: 34.5 }); g.step(2); return { before, after: g.state().platforms[0].push, pos: g.state().pos }; }, EAST);
console.log('push reset on fall', JSON.stringify(pr));
// Floor teeth are solid: stand on the near zigzag floor (x 5.1) where it's floor, and just before the crack on the far side
await load();
const teeth = await page.evaluate(() => { const g = window.__game; const out = []; for (const p of [{ x: 16.2, z: 34.5 }, { x: 4.2, z: 34.5 }]) { g.teleport(p); g.step(1); out.push([p, document.getElementById('message')?.hidden ? 'ok' : document.getElementById('message').textContent]); } return out; });
console.log('edges', JSON.stringify(teeth));

// The current: walk east along the top-ish row through (18.5, 6.5)
await load();
const cur = await page.evaluate((EAST) => { const g = window.__game; g.teleport({ x: 14.5, z: 6.5, yaw: EAST }); g.step(1); g.setInput({ forward: true }); let st; let shoved = null; for (let i = 0; i < 300; i++) { st = g.step(1); if (st.shoved && !shoved) shoved = g.time(); if (shoved && !st.shoved) break; } g.clearInput(); return { end: st.pos, shoved, events: g.events.filter((e) => e.type === 'current').length }; }, EAST);
console.log('current', JSON.stringify(cur));
await page.evaluate((EAST) => { const g = window.__game; g.teleport({ x: 13.5, z: 6.5, yaw: EAST }); g.step(3); }, EAST);
await shot('current');

// Walk whole level? Door checks: Level 41 -> Start Level 42; Level 42 -> More levels coming soon
for (const lv of [40, 41]) {
    await load(lv);
    const d = await page.evaluate(() => { const g = window.__game; const s = g.state(); g.teleport({ x: s.door.x - 1.2, z: s.door.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); for (let i = 0; i < 100; i++) { if (g.step(1).escaped) break; } g.clearInput(); return g.text(); });
    console.log('door', lv, JSON.stringify(d));
}
console.log('errors', errors);
await browser.close();
