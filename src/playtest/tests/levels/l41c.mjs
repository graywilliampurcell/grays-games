import { chromium, BASE, SHOTS } from '../playwright.mjs';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
await page.goto(BASE + '/?test=1&level=40');
await page.waitForFunction(() => window.__game?.ready);
const st0 = await page.evaluate(() => __game.state());
const grid = st0.grid;
// Cells: centre blocks at 4i+2, 4j+2. BFS over cells.
const N = 9, open = (x, z) => grid[z][x] !== '#';
const start = { i: Math.floor(st0.start.x / 4), j: Math.floor(st0.start.z / 4) };
const door = { i: N - 1, j: Math.floor(st0.door.z / 4) };
const prev = new Map(); const q = [start]; prev.set(`${start.i},${start.j}`, null);
while (q.length) { const c = q.shift(); for (const [di, dj] of [[1,0],[-1,0],[0,1],[0,-1]]) { const n = { i: c.i + di, j: c.j + dj }; if (n.i < 0 || n.j < 0 || n.i >= N || n.j >= N) continue; if (!open(4*c.i+2+2*di, 4*c.j+2+2*dj)) continue; const k = `${n.i},${n.j}`; if (prev.has(k)) continue; prev.set(k, c); q.push(n); } }
const path = []; for (let c = door; c; c = prev.get(`${c.i},${c.j}`)) path.unshift(c);
console.log('solution cells', path.length);
let shoves = 0, steps = 0;
async function goTo(x, z) {
  for (let k = 0; k < 400; k++) {
    const s = await page.evaluate(() => __game.state());
    if (s.escaped) return 'escaped';
    if (s.shoved) { shoves++; let t = s; while (t.shoved) t = await page.evaluate(() => __game.step(1)); return 'shoved'; }
    const dx = x - s.pos.x, dz = z - s.pos.z;
    if (Math.hypot(dx, dz) < 0.35) { await page.evaluate(() => __game.clearInput()); return 'ok'; }
    const yaw = Math.atan2(-dx, -dz);
    await page.evaluate((y) => { __game.teleport({ yaw: y }); __game.setInput({ forward: true }); __game.step(1); }, yaw);
    steps++;
  }
  return 'stuck';
}
for (let n = 1; n < path.length; n++) {
  const c = path[n];
  let r = await goTo(4 * c.i + 2.5, 4 * c.j + 2.5);
  if (r === 'shoved') {
    const s = await page.evaluate(() => __game.state());
    console.log('shoved at path cell', n + 1, 'to', JSON.stringify(s.pos));
    r = await goTo(4 * c.i + 2.5, 4 * c.j + 2.5); // walk back out into the current cell
    console.log('back into the current:', r);
  }
  if (r === 'escaped') { console.log('ESCAPED at path cell', n + 1); break; }
  if (r !== 'ok') { console.log('problem', r, 'at', n + 1); break; }
}
const s = await page.evaluate(() => __game.state());
if (!s.escaped) { const r = await goTo(s.door.x - 0.5, s.door.z); console.log('door:', r); }
console.log('escaped', (await page.evaluate(() => __game.state())).escaped, 'shoves', shoves, 'steps', steps);
await browser.close();
