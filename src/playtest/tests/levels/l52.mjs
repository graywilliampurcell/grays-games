import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const load = async (level = 51) => { await page.goto(`${BASE}/?test=1&level=${level}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => window.__game?.ready); };
const shot = (name) => page.screenshot({ path: SP + 'l52-' + name + '.png' });
const EAST = -Math.PI / 2, WEST = Math.PI / 2, SOUTH = Math.PI, NORTH = 0;
await load();
await page.evaluate(() => window.__game.step(10));
console.log('state', JSON.stringify(await page.evaluate(() => { const s = window.__game.state(); return { pos: s.pos, start: s.start, door: s.door, platforms: s.platforms, level: s.level }; })));
await shot('start');
// Walk north from the start side's bank into the marshmallow
const walk = (x, z, yaw, n = 300) => page.evaluate(({ x, z, yaw, n }) => {
  const g = window.__game; g.clearEvents(); g.teleport({ x, z, yaw }); g.setInput({ forward: true });
  let msg = ''; let st; let maxCam = 0; let bounceStart = null, bounceEnd = null; const fallen = [];
  for (let i = 0; i < n; i++) {
    st = g.step(1);
    const p = window.__game.state();
    const cam = p.camera?.y ?? p.cameraY ?? 0; if (cam > maxCam) maxCam = cam;
    const m = document.getElementById('message'); if (!msg && m && !m.hidden) { msg = m.textContent; }
    if (g.events.some((e) => e.type === 'bounce') && bounceStart === null) bounceStart = g.time();
    if (bounceStart !== null && bounceEnd === null && !g.events.some((e) => e.type === 'fall') && i > 0) {}
  }
  g.clearInput();
  return { msg, pos: st.pos, events: g.events.map((e) => e.type + '@' + e.t), maxCam };
}, { x, z, yaw, n });
console.log('north over', JSON.stringify(await walk(2.5, 23.5, NORTH, 200)));
await load();
console.log('south over', JSON.stringify(await walk(2.5, 1.5, SOUTH, 200)));
await load();
console.log('side past pad (west)', JSON.stringify(await walk(1.5, 23.5, NORTH, 200)));
await load();
console.log('side past pad (east)', JSON.stringify(await walk(3.5, 23.5, NORTH, 200)));
// Bounce timing: positions over time
await load();
const tl = await page.evaluate((NORTH) => { const g = window.__game; g.teleport({ x: 2.5, z: 22.2, yaw: NORTH }); g.setInput({ forward: true }); const out = []; for (let i = 0; i < 120; i++) { const s = g.step(1); if (i % 6 === 0) out.push([g.time(), s.pos.z.toFixed(2), document.getElementById('message').hidden ? '' : 'MSG']); } g.clearInput(); return out; }, NORTH);
console.log('timeline', JSON.stringify(tl));
// mid-bounce screenshot
await load();
await page.evaluate((NORTH) => { const g = window.__game; g.teleport({ x: 2.5, z: 22.2, yaw: NORTH }); g.setInput({ forward: true }); for (let i = 0; i < 200; i++) { g.step(1); if (g.events.some((e) => e.type === 'bounce')) break; } g.clearInput(); g.step(Math.round(0.5 / g.dt)); }, NORTH);
await shot('midbounce');
// views
await load();
await page.evaluate((NORTH) => { const g = window.__game; g.teleport({ x: 2.5, z: 26, yaw: NORTH }); g.step(2); }, NORTH);
await shot('river');
await page.evaluate((NORTH) => { const g = window.__game; g.teleport({ x: 3.3, z: 23.3, yaw: NORTH + 0.3 }); g.step(2); }, NORTH);
await shot('marshmallow');
await page.evaluate((SOUTH) => { const g = window.__game; g.teleport({ x: 2.5, z: 1.6, yaw: SOUTH }); g.step(2); }, SOUTH);
await shot('river-far');
// caramel: cell (7,3) x29-31 z13-15, corridor runs north-south
await load();
const car = await page.evaluate((SOUTH) => { const g = window.__game; g.teleport({ x: 30.5, z: 6.5, yaw: SOUTH }); g.setInput({ forward: true }); const out = []; let last = g.state().pos.z; for (let i = 0; i < 200; i++) { const s = g.step(1); if (i % 5 === 4) { out.push([s.pos.z.toFixed(2), ((s.pos.z - last) / (5 * g.dt)).toFixed(2)]); last = s.pos.z; } } g.clearInput(); return out; }, SOUTH);
console.log('caramel', JSON.stringify(car));
await load();
await page.evaluate((SOUTH) => { const g = window.__game; g.teleport({ x: 30.5, z: 9.6, yaw: SOUTH }); g.step(2); }, SOUTH);
await shot('caramel');
console.log('errors', errors);
await browser.close();
