import { chromium, BASE, SHOTS } from '../playwright.mjs';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 320, height: 200 } });
await page.goto(BASE + '/?test=1&level=40');
await page.waitForFunction(() => window.__game?.ready);
page.on('console', (m) => console.log('PAGE', m.text()));
await page.evaluate((l) => { window.__LIMIT = l; }, process.argv[2] || 99);
const out = await page.evaluate(() => {
  const G = window.__game; const log = [];
  const st0 = G.state(); const grid = st0.grid; const N = 9;
  const open = (x, z) => grid[z][x] !== '#';
  const start = { i: Math.floor(st0.start.x / 4), j: Math.floor(st0.start.z / 4) };
  const door = { i: N - 1, j: Math.floor(st0.door.z / 4) };
  const prev = new Map(); const q = [start]; prev.set(`${start.i},${start.j}`, null);
  while (q.length) { const c = q.shift(); for (const [di, dj] of [[1,0],[-1,0],[0,1],[0,-1]]) { const n = { i: c.i + di, j: c.j + dj }; if (n.i < 0 || n.j < 0 || n.i >= N || n.j >= N) continue; if (!open(4*c.i+2+2*di, 4*c.j+2+2*dj)) continue; const k = `${n.i},${n.j}`; if (prev.has(k)) continue; prev.set(k, c); q.push(n); } }
  const path = []; for (let c = door; c; c = prev.get(`${c.i},${c.j}`)) path.unshift(c);
  log.push('solution cells ' + path.length);
  // stepping without rendering: use the hook's advance through step but render is per call; fine
  let shoves = 0; let total = 0;
  const goTo = (x, z) => {
    for (let k = 0; k < 600; k++) {
      if (++total > 20000) return 'cap';
      let s = G.state();
      if (s.escaped) return 'escaped';
      if (s.shoved) { shoves++; let m = 0; while (s.shoved && m++ < 200) s = G.step(1); return 'shoved'; }
      const dx = x - s.pos.x, dz = z - s.pos.z;
      if (Math.hypot(dx, dz) < 0.35) { G.clearInput(); return 'ok'; }
      const want = Math.atan2(-dx, -dz); if (Math.abs(Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw))) > 0.08) G.teleport({ yaw: want }); G.setInput({ forward: true }); G.step(1);
    }
    return 'stuck';
  };
  for (let n = 1; n < Math.min(path.length, Number(window.__LIMIT)); n++) {
    const c = path[n];
    let r = goTo(4 * c.i + 2.5, 4 * c.j + 2.5); console.log('cell', n + 1, r, total);
    if (r === 'shoved') { log.push('shoved entering path cell ' + (n + 1) + ' -> ' + JSON.stringify(G.state().pos)); r = goTo(4 * c.i + 2.5, 4 * c.j + 2.5); log.push('walked back into the current: ' + r + ' shoved=' + G.state().shoved); }
    if (r === 'escaped') { log.push('escaped at cell ' + (n + 1)); break; }
    if (r !== 'ok') { log.push('problem ' + r + ' at ' + (n + 1)); break; }
  }
  if (!G.state().escaped && window.__LIMIT >= 99) log.push('door: ' + goTo(G.state().door.x - 0.5, G.state().door.z));
  log.push('escaped ' + G.state().escaped + ' shoves ' + shoves + ' time ' + G.time());
  return log;
});
console.log(out.join('\n'));
await browser.close();
