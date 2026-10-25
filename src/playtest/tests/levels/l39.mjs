import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP=SHOTS;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const load = async () => { await page.goto(BASE + '/?test=1&level=38'); await page.waitForFunction(() => window.__game?.ready); };
await load();
const s = await page.evaluate(() => window.__game.state());
console.log(s.level, 'start', JSON.stringify(s.start), 'spike', JSON.stringify(s.spike), 'plat', JSON.stringify(s.platforms), 'door', JSON.stringify(s.door));
await page.evaluate(() => window.__game.step(10));
await page.screenshot({ path: SP + 'l39-start.png' });
// ride: from, yaw, axis, onAt (sign), title
const rides = [
  { name: 'gap1 east', x: 2.5, z: 30.5, yaw: -Math.PI / 2, on: (p) => p.x > 4.6, view: { x: 1.5, z: 30.5, yaw: -Math.PI / 2 } },
  { name: 'gap2 north', x: 30.5, z: 30.5, yaw: 0, on: (p) => p.z < 27.4, view: { x: 30.5, z: 31.0, yaw: 0 } },
];
for (const r of rides) {
  await load();
  await page.evaluate((v) => { window.__game.teleport(v); window.__game.step(10); }, r.view);
  await page.screenshot({ path: SP + 'l39-' + r.name.split(' ')[0] + '.png' });
  await load();
  const res = await page.evaluate(({ x, z, yaw, on }) => {
    const onF = new Function('p', 'return (' + on + ')(p)');
    const g = window.__game; const log = [];
    g.teleport({ x, z, yaw }); g.step(1);
    g.setInput({ forward: true });
    let st; for (let i = 0; i < 60; i++) { st = g.step(1); if (onF(st.pos)) break; }
    g.clearInput();
    log.push(['on', st.pos]);
    let idx = -1;
    for (let i = 0; i < 300; i++) { st = g.step(2); if (idx < 0) idx = st.platforms.findIndex((p) => p.riding); if (idx >= 0 && !st.platforms[idx].riding) break; }
    log.push(['arrived', idx, st.pos, document.getElementById('message')?.textContent]);
    g.setInput({ forward: true });
    for (let i = 0; i < 30; i++) st = g.step(2);
    g.clearInput();
    log.push(['off', st.pos, st.platforms.map((p) => p.riding), document.getElementById('message')?.textContent]);
    return log;
  }, { ...r, on: r.on.toString() });
  console.log(r.name, JSON.stringify(res));
}
for (const p of [{ x: 10.5, z: 30.5 }, { x: 30.5, z: 22.5 }]) {
  await load();
  const fall = await page.evaluate((p) => { const g = window.__game; g.teleport(p); g.step(3); return { pos: g.state().pos, msg: document.getElementById('message')?.textContent }; }, p);
  console.log('fall', JSON.stringify(p), JSON.stringify(fall));
}
// path crater Z at (22.5, 22.5): walk north up column 5 from row 7
for (const x of [22.5, 21.45, 23.55]) {
  await load();
  const r = await page.evaluate((x) => { const g=window.__game; g.teleport({ x, z: 29.5, yaw: 0 }); g.step(1); g.setInput({forward:true}); let st; for (let i=0;i<60;i++){ st=g.step(2); if (st.pos.z < 18.5) break;} g.clearInput(); return {end: g.state().pos, msg: document.getElementById('message')?.textContent}; }, x);
  console.log('north x', x, JSON.stringify(r));
}
await load();
await page.evaluate(() => { window.__game.teleport({ x: 22.5, z: 30.5, yaw: 0 }); window.__game.step(5); });
await page.screenshot({ path: SP + 'l39-approach.png' });
// hidden crater X at (10.5, 18.5): from (6.5, 14.5) go south then east
await load();
const h = await page.evaluate(() => { const g=window.__game; g.teleport({ x: 6.5, z: 18.5, yaw: -Math.PI / 2 }); g.step(1); g.setInput({forward:true}); for (let i=0;i<30;i++) g.step(2); g.clearInput(); return {end: g.state().pos, msg: document.getElementById('message')?.textContent}; });
console.log('hidden', JSON.stringify(h));
await load();
await page.evaluate(() => { window.__game.teleport({ x: 6.5, z: 9.5, yaw: Math.PI }); window.__game.step(5); });
await page.screenshot({ path: SP + 'l39-hidden.png' });
console.log('errors', errors);
await browser.close();
