// Level 95 checks: node t95.mjs (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
let browser = null; const launch = () => chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
let page = null;
const errors = [];
const load = async (n = 95, query = 'test=1&') => { if (browser) await browser.close().catch(() => {}); browser = await launch(); page = await browser.newPage({ viewport: { width: 1024, height: 640 } }); page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); }); for (let tr = 0; tr < 3; tr++) { try { await page.goto(`${BASE}/?${query}level=${n - 1}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); if (query) await page.waitForFunction(() => window.__game?.ready); return; } catch (e) { console.log('retry load', String(e).slice(0, 80)); } } };
const shot = (name) => page.screenshot({ path: `${SP}l95-${name}.png` });
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info)); };
const E = -Math.PI / 2, W = Math.PI / 2, N = 0, S = Math.PI;

await load();
const st0 = await page.evaluate(() => window.__game.state());
console.log(st0.level.name, 'start', JSON.stringify(st0.start), 'door', JSON.stringify(st0.door), 'spike', JSON.stringify(st0.spike), 'spike2', JSON.stringify(st0.spike2), 'platforms', JSON.stringify(st0.platforms.map((p) => ({ bubble: p.bubble, gap: p.gap }))), 'keys', Object.keys(st0).join(','));
check('L95 loads: one bubble, path urchin, big urchin, no sneaky', st0.level.name === 'Level 95' && st0.platforms.length === 1 && !!st0.spike && !st0.spike2 && st0.spikeRows.length === 1, { spikeRows: st0.spikeRows });
// bubble ride: push into the bubble heading north from path cell 69 (1,11)
await load();
const r1 = await page.evaluate(() => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 6.5, z: 46.5, yaw: 0 }); g.setInput({ forward: true }); let st; let rode = false; let i;
    for (i = 0; i < 3000; i++) { st = g.step(1); if (st.platforms[0].riding) rode = true; if (st.pos.z < 30.5) break; }
    g.clearInput();
    return { pos: st.pos, rode, steps: i, events: [...new Set(g.events.map((e) => e.type))] };
});
check('bubble ride over the crack (heading north)', r1.rode && r1.pos.z < 31 && !r1.events.includes('fall'), r1);
await load();
const fall = await page.evaluate(() => { const g = window.__game; g.clearEvents(); g.teleport({ x: 6.5, z: 38, yaw: 0 }); let st; for (let i = 0; i < 200; i++) st = g.step(1); return { pos: st.pos, events: [...new Set(g.events.map((e) => e.type))] }; });
check('stepping into the crack sends you back', fall.events.length > 0, fall);
// water current: walk west into cell (4,4) from (5,4); shoved north to V (18.5,14.5)
const cur = async (x, yaw) => { await load(); return page.evaluate(({ x, yaw }) => { const g = window.__game; g.clearEvents(); g.teleport({ x, z: 18.5, yaw }); g.setInput({ forward: true }); let st; let minZ = 99; for (let i = 0; i < 90; i++) { st = g.step(1); minZ = Math.min(minZ, st.pos.z); } g.clearInput(); for (let i = 0; i < 60; i++) st = g.step(1); return { pos: st.pos, minZ, events: [...new Set(g.events.map((e) => e.type))] }; }, { x, yaw }); };
const c1 = await cur(23.5, W);
check('current shoves you north into its dead end (from the east)', c1.minZ < 15.6, c1);
const c2 = await cur(13.5, E);
check('current shoves you north into its dead end (from the west)', c2.minZ < 15.6, c2);
await load();
const back = await page.evaluate(() => { const g = window.__game; g.clearEvents(); g.teleport({ x: 18.5, z: 13.5, yaw: Math.PI }); g.setInput({ forward: true }); let st; for (let i = 0; i < 40; i++) st = g.step(1); g.setInput({ forward: true }); g.teleport({ x: st.pos.x, z: st.pos.z, yaw: -Math.PI / 2 }); for (let i = 0; i < 90; i++) st = g.step(1); g.clearInput(); return { pos: st.pos }; });
check('walking back out of the dead end and on east is not shoved', back.pos.x > 21, back);

// path urchin X, heading east
const sp = st0.spike;
const squeeze = async (z) => { await load(); return page.evaluate(({ z, E, sp }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: sp.x - 4, z, yaw: E }); g.setInput({ forward: true }); let st;
    for (let i = 0; i < 120; i++) st = g.step(1);
    g.clearInput();
    return { pos: st.pos, hit: g.events.some((e) => e.type === 'spike') };
}, { z, E, sp }); };
for (const d of [1.05]) {
    const a = await squeeze(sp.z - d); check(`squeeze past north side (${d})`, !a.hit && a.pos.x > sp.x + 2, a);
    const b = await squeeze(sp.z + d); check(`squeeze past south side (${d})`, !b.hit && b.pos.x > sp.x + 2, b);
}
const qc = await squeeze(sp.z); check('middle: Ouch', qc.hit, qc);
const qd = await squeeze(sp.z - 0.8); check('a bit off the side still hits', qd.hit, qd);

// big urchin: walk east into the dead end off path cell 95 (0,12)
await load();
const bc = await page.evaluate(() => { const g = window.__game; g.clearEvents(); g.teleport({ x: 2.5, z: 50.5, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); let st; for (let i = 0; i < 200; i++) { st = g.step(1); if (g.events.some((e) => e.type === 'spike')) break; } g.clearInput(); return { pos: st.pos, hit: g.events.some((e) => e.type === 'spike') }; });
check('big urchin in its dead end: Ouch', bc.hit, bc);
await load();
const pass = await page.evaluate(() => { const g = window.__game; g.clearEvents(); g.teleport({ x: 2.5, z: 46.5, yaw: Math.PI }); g.setInput({ forward: true }); let st; for (let i = 0; i < 100; i++) st = g.step(1); g.clearInput(); return { pos: st.pos, hit: g.events.some((e) => e.type === 'spike') }; });
check('walking down the path past the big urchin opening is safe', !pass.hit && pass.pos.z > 52, pass);

const view = async (name, x, z, yaw) => { await load(); await page.evaluate(({ x, z, yaw }) => { const g = window.__game; g.teleport({ x, z, yaw }); g.step(2); g.render(); }, { x, z, yaw }); await shot(name); };
await view('start', st0.start.x, st0.start.z, E);
await view('crack', 6.5, 46.5, N);
await view('current', 24.5, 18.5, W);
await view('pathurchin', sp.x - 6, sp.z, E);
await view('bigurchin', 2.5, 46.5, S);
await view('bigurchin2', 1.6, 50.5, E);

const finish = () => page.evaluate(() => {
    const g = window.__game; const d = g.state().door; g.teleport({ x: d.x - 2.5, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); g.step(40); g.clearInput(); g.render();
    return { title: document.getElementById('finish-title').textContent, buttons: [...document.querySelectorAll('#menu-finish .item, #menu-finish button')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim()) };
});
await load();
const f95 = await finish();
await shot('finish');
check('L95 door: More levels coming soon! + Quit', f95.title === 'More levels coming soon!' && f95.buttons.join('|') === 'Quit', f95);
await load(94);
const f94 = await finish();
check('L94 door leads on', f94.buttons.length === 2 && f94.buttons[1] === 'Quit', f94);
await page.evaluate(() => document.querySelector('#menu-finish [data-act=next], #menu-finish .item')?.click());
await page.waitForTimeout(500);
const after = await page.evaluate(() => window.__game.state().level.name);
check('next level from 94 is Level 95', after === 'Level 95', { after });
const music = await page.evaluate(() => window.__game.state().music ?? null);
console.log('music', music);

if (browser) await browser.close();
browser = await launch(); page = await browser.newPage({ viewport: { width: 1024, height: 640 } }); page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(BASE + '/');
await page.evaluate(() => { localStorage.setItem('mazle.furthest', '94'); localStorage.setItem('mazle.news', JSON.stringify({ told: [...Array(95).keys()], beaten: 93, fresh: [] })); });
await page.reload(); await page.waitForTimeout(3000);
await page.evaluate(() => document.querySelector('[data-act=pick-level]')?.click());
await page.waitForTimeout(500);
await page.evaluate(() => document.querySelectorAll('#world-grid .item')[9]?.click());
await page.waitForTimeout(500);
const lv = await page.evaluate(() => [...document.querySelectorAll('#level-grid .item')].map((b) => ({ cls: b.className, text: b.textContent })));
await shot('levels');
check('Everything World levels: 91-95, 95 sea', lv.length === 5 && /look-sea/.test(lv[4].cls) && lv[4].text === '95', lv);
console.log('errors', errors);
console.log(results.every(Boolean) && !errors.length ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
