import { chromium, BASE, SHOTS } from '../playwright.mjs';
const OUT = SHOTS;
import fs from 'fs';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 700 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
await page.goto(BASE + '/?test=1&level=40');
await page.waitForFunction(() => window.__game?.ready);
const g = (fn, arg) => page.evaluate(fn, arg);
let s = await g(() => __game.state());
console.log('level', s.level, 'current', JSON.stringify(s.current), 'spike', JSON.stringify(s.spike), 'start', JSON.stringify(s.start));
const c = s.current;
const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2;
await page.screenshot({ path: `${OUT}/start.png` });

// Yaw for facing a direction: north (-z) = 0, east (+x) = -PI/2, south = PI, west = PI/2
const YAW = { n: 0, e: -Math.PI / 2, s: Math.PI, w: Math.PI / 2 };
async function walk(maxSteps, stopFn) {
  await g(() => __game.setInput({ forward: true }));
  let st;
  for (let i = 0; i < maxSteps; i++) {
    st = await g(() => __game.step(1));
    if (stopFn(st)) break;
  }
  await g(() => __game.clearInput());
  return st;
}
const inCur = (p) => p.x > c.minX && p.x < c.maxX && p.z > c.minZ && p.z < c.maxZ;

// 1. Enter from the north (path), walking south
await g((a) => { __game.clearEvents(); return __game.teleport(a); }, { x: cx, z: c.minZ - 2.5, yaw: YAW.s });
await page.screenshot({ path: `${OUT}/approach.png` });
let t0 = await g(() => __game.time());
s = await walk(200, (st) => st.shoved);
const tStart = await g(() => __game.time());
await page.screenshot({ path: `${OUT}/shoving.png` });
let n = 0;
while (s.shoved && n < 500) { s = await g(() => __game.step(1)); n++; }
const tEnd = await g(() => __game.time());
console.log('1 from north: shove started at', s && JSON.stringify(s.pos), 'took', (tEnd - tStart).toFixed(3), 's; ended at', JSON.stringify(s.pos), 'target', JSON.stringify(c.target));
await page.screenshot({ path: `${OUT}/after-shove.png` });
let ev = await g(() => __game.events.map((e) => e.type));
console.log('events', ev.join(','));

// 2. Walk back out east (from the dead end): no shove; keep going into the middle
await g(() => __game.teleport({ yaw: -Math.PI / 2 }));
await g(() => __game.clearEvents());
s = await walk(200, (st) => st.pos.x > cx || st.shoved);
console.log('2 back out of the dead end: shoved?', s.shoved, 'pos', JSON.stringify(s.pos));
// then walk south out of the cell, along the path
await g(() => __game.teleport({ yaw: Math.PI }));
s = await walk(200, (st) => st.pos.z > c.maxZ + 1.5 || st.shoved);
console.log('2b on south along the path: shoved?', s.shoved, 'pos', JSON.stringify(s.pos));
// 3. Turn round and come back in from the south (path): shove
await g(() => __game.teleport({ yaw: 0 }));
s = await walk(200, (st) => st.shoved);
console.log('3 re-enter from south: shoved?', s.shoved);
while (s.shoved) s = await g(() => __game.step(1));
console.log('3 ended at', JSON.stringify(s.pos));
// 4. After walking back out of the dead end, go north along the path: no shove
await g(() => __game.teleport({ yaw: -Math.PI / 2 }));
s = await walk(200, (st) => st.pos.x > cx || st.shoved);
await g(() => __game.teleport({ yaw: 0 }));
s = await walk(200, (st) => st.pos.z < c.minZ - 1.5 || st.shoved);
console.log('4 back out then north: shoved?', s.shoved, 'pos', JSON.stringify(s.pos));
ev = await g(() => __game.events.filter((e) => e.type === 'current').length);
console.log('current events since 2:', ev);
// 5. Edge entry: come in from the north hugging the east wall (x near maxX - 0.5), still lands at target
await g((a) => __game.teleport(a), { x: c.maxX - 0.45, z: c.minZ - 2.5, yaw: YAW.s });
s = await walk(200, (st) => st.shoved);
while (s.shoved) s = await g(() => __game.step(1));
console.log('5 hugging the wall: ended at', JSON.stringify(s.pos));

// 6. The urchin: walk into it
await g(() => __game.clearEvents());
const sp = (await g(() => __game.state())).spike;
await g((a) => __game.teleport(a), { x: sp.x, z: sp.z - 2.6, yaw: YAW.s });
await page.screenshot({ path: `${OUT}/urchin-near.png` });
s = await walk(100, (st) => false);
ev = await g(() => __game.events.map((e) => e.type + (e.text ? ':' + e.text : '')));
console.log('6 urchin events', ev.join(' | '));
// 7. Look at the sky
await g(() => __game.teleport({ x: 30.5, z: 30.5, yaw: 0 }));
await g(() => { const p = window.__game; });
await page.evaluate(() => { const st = __game.state(); });
await browser.close();
