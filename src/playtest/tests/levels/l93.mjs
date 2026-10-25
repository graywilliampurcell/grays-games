// Level 93 checks: node t93.mjs (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
let browser = null; const launch = () => chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
let page = null;
const errors = [];
const load = async (n = 93, query = 'test=1&') => { if (browser) await browser.close().catch(() => {}); browser = await launch(); page = await browser.newPage({ viewport: { width: 1024, height: 640 } }); page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); }); for (let tr = 0; tr < 3; tr++) { try { await page.goto(`${BASE}/?${query}level=${n - 1}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); if (query) await page.waitForFunction(() => window.__game?.ready); return; } catch (e) { console.log('retry load', String(e).slice(0, 80)); } } };
const shot = (name) => page.screenshot({ path: `${SP}l93-${name}.png` });
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info)); };
const E = -Math.PI / 2, W = Math.PI / 2, N = 0, S = Math.PI;

await load();
const st0 = await page.evaluate(() => window.__game.state());
console.log(st0.level.name, 'start', JSON.stringify(st0.start), 'door', JSON.stringify(st0.door), 'spike', JSON.stringify(st0.spike), 'spike2', JSON.stringify(st0.spike2), 'platforms', JSON.stringify(st0.platforms.map((p) => ({ speed: p.speed, gap: p.gap }))));
check('L93 loads: two leaves (one fast), sneaky + path bush, no big bush', st0.level.name === 'Level 93' && st0.platforms.length === 2 && !!st0.spike && !!st0.spike2 && st0.spikeRows.length === 0 && !st0.spaceDoor, {});
const speeds = st0.platforms.map((p) => p.speed).sort((a, b) => a - b);
check('one leaf normal (6), one fast (7.8)', Math.abs(speeds[0] - 6) < 0.01 && Math.abs(speeds[1] - 7.8) < 0.01, speeds);

const ride = (x, z, yaw, done) => page.evaluate(({ x, z, yaw, done }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x, z, yaw }); g.setInput({ forward: true }); let st; let rode = -1; let i; let t0 = null, t1 = null;
    const f = new Function('st', `return ${done}`);
    for (i = 0; i < 1500; i++) { st = g.step(1); const k = st.platforms.findIndex((p) => p.riding); if (k >= 0) { rode = k; if (t0 === null) t0 = i; t1 = i; } if (f(st)) break; }
    g.clearInput();
    return { pos: st.pos, rode, rideSteps: t1 - t0, events: [...new Set(g.events.map((e) => e.type))] };
}, { x, z, yaw, done });
await load();
const r1 = await ride(2.5, 31.5, N, 'st.pos.z < 18.5');
check('first river (heading north) crossed on its leaf', r1.rode >= 0 && r1.pos.z < 19 && !r1.events.includes('fall'), r1);
await load();
const r2 = await ride(42.5, 29.5, S, 'st.pos.z > 42');
check('second river (heading south) crossed on its leaf', r2.rode >= 0 && r2.pos.z > 41.5 && !r2.events.includes('fall'), r2);
await load();
const fall = await page.evaluate(() => { const g = window.__game; g.clearEvents(); g.teleport({ x: 2.5, z: 24, yaw: 0 }); let st; for (let i = 0; i < 200; i++) st = g.step(1); return { pos: st.pos, events: [...new Set(g.events.map((e) => e.type))] }; });
check('stepping into the river sends you back', fall.events.length > 0, fall);

// path bush Z heading north
const sp = st0.spike2;
const squeeze = async (x) => { await load(); return page.evaluate(({ x, N, sp }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x, z: sp.z + 4, yaw: N }); g.setInput({ forward: true }); let st;
    for (let i = 0; i < 120; i++) st = g.step(1);
    g.clearInput();
    return { pos: st.pos, hit: g.events.some((e) => e.type === 'spike') };
}, { x, N, sp }); };
for (const d of [1.05, 1.1]) {
    const a = await squeeze(sp.x - d); check(`squeeze past west side (${d})`, !a.hit && a.pos.z < sp.z - 2, a);
    const b = await squeeze(sp.x + d); check(`squeeze past east side (${d})`, !b.hit && b.pos.z < sp.z - 2, b);
}
const qc = await squeeze(sp.x); check('middle: Ouch', qc.hit, qc);
const qd = await squeeze(sp.x - 0.8); check('a bit off the side still hits', qd.hit, qd);
const q91 = await squeeze(sp.x - 1.0); console.log('info: at 1.0 off centre', JSON.stringify(q91));

// sneaky bush: from start go south one cell, then east into the dead end
await load();
const sn = await page.evaluate(() => { const g = window.__game; g.clearEvents(); g.teleport({ x: 2.5, z: 54.5, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); let st; for (let i = 0; i < 200; i++) { st = g.step(1); if (g.events.some((e) => e.type === 'spike')) break; } g.clearInput(); return { pos: st.pos, hit: g.events.some((e) => e.type === 'spike') }; });
check('sneaky bush round the corner: Ouch', sn.hit, sn);

const view = async (name, x, z, yaw) => { await load(); await page.evaluate(({ x, z, yaw }) => { const g = window.__game; g.teleport({ x, z, yaw }); g.step(2); g.render(); }, { x, z, yaw }); await shot(name); };
await view('start', st0.start.x, st0.start.z, E);
await view('river1', 2.5, 32.5, N);
await view('river2', 42.5, 28.5, S);
await view('bush', sp.x, sp.z + 6, N);
await view('sneaky', 2.5, 54.5, E);

const finish = () => page.evaluate(() => {
    const g = window.__game; const d = g.state().door; g.teleport({ x: d.x - 2.5, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); g.step(40); g.clearInput(); g.render();
    return { title: document.getElementById('finish-title').textContent, buttons: [...document.querySelectorAll('#menu-finish .item, #menu-finish button')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim()) };
});
await load();
const f93 = await finish();
await shot('finish');
check('L93 door: More levels coming soon! + Quit', f93.title === 'More levels coming soon!' && f93.buttons.join('|') === 'Quit', f93);
await load(92);
const f92 = await finish();
check('L92 door leads on', f92.buttons.length === 2 && f92.buttons[1] === 'Quit', f92);
await page.evaluate(() => document.querySelector('#menu-finish [data-act=next], #menu-finish .item')?.click());
await page.waitForTimeout(500);
const after = await page.evaluate(() => window.__game.state().level.name);
check('next level from 92 is Level 93', after === 'Level 93', { after });
const music = await page.evaluate(() => window.__game.state().music ?? null);
console.log('music', music);

if (browser) await browser.close();
browser = await launch(); page = await browser.newPage({ viewport: { width: 1024, height: 640 } }); page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(BASE + '/');
await page.evaluate(() => { localStorage.setItem('mazle.furthest', '92'); localStorage.setItem('mazle.news', JSON.stringify({ told: [...Array(93).keys()], beaten: 91, fresh: [] })); });
await page.reload(); await page.waitForTimeout(3000);
await page.evaluate(() => document.querySelector('[data-act=pick-level]')?.click());
await page.waitForTimeout(500);
await page.evaluate(() => document.querySelectorAll('#world-grid .item')[9]?.click());
await page.waitForTimeout(500);
const lv = await page.evaluate(() => [...document.querySelectorAll('#level-grid .item')].map((b) => ({ cls: b.className, text: b.textContent })));
await shot('levels');
check('Everything World levels: 91 candy, 92 space, 93 jungle', lv.length === 3 && /look-jungle/.test(lv[2].cls) && lv[2].text === '93', lv);
console.log('errors', errors);
console.log(results.every(Boolean) && !errors.length ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
