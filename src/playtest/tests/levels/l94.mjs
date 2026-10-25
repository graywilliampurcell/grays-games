// Level 94 checks: node t94.mjs (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
let browser = null; const launch = () => chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
let page = null;
const errors = [];
const load = async (n = 94, query = 'test=1&') => { if (browser) await browser.close().catch(() => {}); browser = await launch(); page = await browser.newPage({ viewport: { width: 1024, height: 640 } }); page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); }); for (let tr = 0; tr < 3; tr++) { try { await page.goto(`${BASE}/?${query}level=${n - 1}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); if (query) await page.waitForFunction(() => window.__game?.ready); return; } catch (e) { console.log('retry load', String(e).slice(0, 80)); } } };
const shot = (name) => page.screenshot({ path: `${SP}l94-${name}.png` });
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info)); };
const E = -Math.PI / 2, W = Math.PI / 2, N = 0, S = Math.PI;

await load();
const st0 = await page.evaluate(() => window.__game.state());
console.log(st0.level.name, 'start', JSON.stringify(st0.start), 'door', JSON.stringify(st0.door), 'spike', JSON.stringify(st0.spike), 'spike2', JSON.stringify(st0.spike2), 'platforms', JSON.stringify(st0.platforms.map((p) => ({ speed: p.speed, gap: p.gap }))));
check('L94 loads: two hover discs, path crater, big crater, no sneaky', st0.level.name === 'Level 94' && st0.platforms.length === 2 && !!st0.spike && !st0.spike2 && st0.spikeRows.length === 1 && !st0.spaceDoor, { spikeRows: st0.spikeRows });
const ride = (x, z, yaw, done) => page.evaluate(({ x, z, yaw, done }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x, z, yaw }); g.setInput({ forward: true }); let st; let rode = -1; let i; let t0 = null, t1 = null;
    const f = new Function('st', `return ${done}`);
    for (i = 0; i < 1500; i++) { st = g.step(1); const k = st.platforms.findIndex((p) => p.riding); if (k >= 0) { rode = k; if (t0 === null) t0 = i; t1 = i; } if (f(st)) break; }
    g.clearInput();
    return { pos: st.pos, rode, rideSteps: t1 - t0, events: [...new Set(g.events.map((e) => e.type))] };
}, { x, z, yaw, done });
await load();
const r1 = await ride(2.5, 17.5, S, 'st.pos.z > 34');
check('first giant crater (heading south) crossed on its disc', r1.rode >= 0 && r1.pos.z > 33.5 && !r1.events.includes('fall'), r1);
await load();
const r2 = await ride(18.5, 54.5, E, 'st.pos.x > 34');
check('second giant crater (heading east) crossed on its disc', r2.rode >= 0 && r2.pos.x > 33.5 && !r2.events.includes('fall'), r2);
check('each disc its own', r1.rode !== r2.rode, { a: r1.rode, b: r2.rode });
await load();
const fall = await page.evaluate(() => { const g = window.__game; g.clearEvents(); g.teleport({ x: 2.5, z: 24, yaw: 0 }); let st; for (let i = 0; i < 200; i++) st = g.step(1); return { pos: st.pos, events: [...new Set(g.events.map((e) => e.type))] }; });
check('stepping into the crater sends you back', fall.events.length > 0, fall);

// path crater X, heading west
const sp = st0.spike;
const squeeze = async (z) => { await load(); return page.evaluate(({ z, W, sp }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: sp.x + 4, z, yaw: W }); g.setInput({ forward: true }); let st;
    for (let i = 0; i < 120; i++) st = g.step(1);
    g.clearInput();
    return { pos: st.pos, hit: g.events.some((e) => e.type === 'spike') };
}, { z, W, sp }); };
for (const d of [1.05]) {
    const a = await squeeze(sp.z - d); check(`squeeze past north side (${d})`, !a.hit && a.pos.x < sp.x - 2, a);
    const b = await squeeze(sp.z + d); check(`squeeze past south side (${d})`, !b.hit && b.pos.x < sp.x - 2, b);
}
const qc = await squeeze(sp.z); check('middle: Ouch', qc.hit, qc);
const qd = await squeeze(sp.z - 0.8); check('a bit off the side still hits', qd.hit, qd);

// big crater: walk west into the dead end off path cell 8
await load();
const bc = await page.evaluate(() => { const g = window.__game; g.clearEvents(); g.teleport({ x: 18.5, z: 14.5, yaw: Math.PI / 2 }); g.setInput({ forward: true }); let st; for (let i = 0; i < 200; i++) { st = g.step(1); if (g.events.some((e) => e.type === 'spike')) break; } g.clearInput(); return { pos: st.pos, hit: g.events.some((e) => e.type === 'spike') }; });
check('big crater in its dead end: Ouch', bc.hit, bc);
await load();
const pass = await page.evaluate(() => { const g = window.__game; g.clearEvents(); g.teleport({ x: 18.5, z: 10.5, yaw: Math.PI }); g.setInput({ forward: true }); let st; for (let i = 0; i < 100; i++) st = g.step(1); g.clearInput(); return { pos: st.pos, hit: g.events.some((e) => e.type === 'spike') }; });
console.log('info: walking down past the big crater opening', JSON.stringify(pass));

const view = async (name, x, z, yaw) => { await load(); await page.evaluate(({ x, z, yaw }) => { const g = window.__game; g.teleport({ x, z, yaw }); g.step(2); g.render(); }, { x, z, yaw }); await shot(name); };
await view('start', st0.start.x, st0.start.z, E);
await view('crater1', 2.5, 16.5, S);
await view('crater2', 17.5, 54.5, E);
await view('pathcrater', sp.x + 6, sp.z, W);
await view('bigcrater', 18.5, 10.5, S);
await view('bigcrater2', 19.5, 14.5, W);

const finish = () => page.evaluate(() => {
    const g = window.__game; const d = g.state().door; g.teleport({ x: d.x - 2.5, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); g.step(40); g.clearInput(); g.render();
    return { title: document.getElementById('finish-title').textContent, buttons: [...document.querySelectorAll('#menu-finish .item, #menu-finish button')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim()) };
});
await load();
const f94 = await finish();
await shot('finish');
check('L94 door: More levels coming soon! + Quit', f94.title === 'More levels coming soon!' && f94.buttons.join('|') === 'Quit', f94);
await load(93);
const f93 = await finish();
check('L93 door leads on', f93.buttons.length === 2 && f93.buttons[1] === 'Quit', f93);
await page.evaluate(() => document.querySelector('#menu-finish [data-act=next], #menu-finish .item')?.click());
await page.waitForTimeout(500);
const after = await page.evaluate(() => window.__game.state().level.name);
check('next level from 93 is Level 94', after === 'Level 94', { after });
const music = await page.evaluate(() => window.__game.state().music ?? null);
console.log('music', music);

if (browser) await browser.close();
browser = await launch(); page = await browser.newPage({ viewport: { width: 1024, height: 640 } }); page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(BASE + '/');
await page.evaluate(() => { localStorage.setItem('mazle.furthest', '93'); localStorage.setItem('mazle.news', JSON.stringify({ told: [...Array(94).keys()], beaten: 92, fresh: [] })); });
await page.reload(); await page.waitForTimeout(3000);
await page.evaluate(() => document.querySelector('[data-act=pick-level]')?.click());
await page.waitForTimeout(500);
await page.evaluate(() => document.querySelectorAll('#world-grid .item')[9]?.click());
await page.waitForTimeout(500);
const lv = await page.evaluate(() => [...document.querySelectorAll('#level-grid .item')].map((b) => ({ cls: b.className, text: b.textContent })));
await shot('levels');
check('Everything World levels: 91-94, 94 moon', lv.length === 4 && /look-moon/.test(lv[3].cls) && lv[3].text === '94', lv);
console.log('errors', errors);
console.log(results.every(Boolean) && !errors.length ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
