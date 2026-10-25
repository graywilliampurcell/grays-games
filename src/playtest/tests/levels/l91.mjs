// Level 91 checks: node t91.mjs (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
let browser = null; const launch = () => chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
let page = null;
const errors = [];
const load = async (n = 91, query = 'test=1&') => { if (browser) await browser.close().catch(() => {}); browser = await launch(); page = await browser.newPage({ viewport: { width: 1024, height: 640 } }); page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); }); for (let tr = 0; tr < 3; tr++) { try { await page.goto(`${BASE}/?${query}level=${n - 1}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); if (query) await page.waitForFunction(() => window.__game?.ready); return; } catch (e) { console.log('retry load', String(e).slice(0, 80)); } } };
const shot = (name) => page.screenshot({ path: `${SP}l91-${name}.png` });
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info)); };
const E = -Math.PI / 2, W = Math.PI / 2, N = 0, S = Math.PI;

await load();
const st0 = await page.evaluate(() => window.__game.state());
console.log(st0.level.name, 'spike', JSON.stringify(st0.spike), 'start', JSON.stringify(st0.start), 'door', JSON.stringify(st0.door));
check('L91 loads with a path spike, no platforms/doors', st0.level.name === 'Level 91' && !!st0.spike && st0.platforms.length === 0, {});
const sp = st0.spike;
// path spike at (54.5,26.5), corridor heading south
const squeeze = async (x) => { await load(); return page.evaluate(({ x, S, sp }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x, z: sp.z - 5, yaw: S }); g.setInput({ forward: true }); let st;
    for (let i = 0; i < 120; i++) st = g.step(1);
    g.clearInput(); const m = document.getElementById('message');
    return { pos: st.pos, hit: g.events.some((e) => e.type === 'spike'), msg: m.hidden ? '' : m.textContent };
}, { x, S, sp }); };
const qa = await squeeze(sp.x - 1.05); check('squeeze past west side', !qa.hit && qa.pos.z > sp.z + 2, qa);
const qb = await squeeze(sp.x + 1.05); check('squeeze past east side', !qb.hit && qb.pos.z > sp.z + 2, qb);
const qc = await squeeze(sp.x); check('middle: Ouch', qc.hit, qc);
const qd = await squeeze(sp.x - 0.8); check('a bit off the side still hits', qd.hit, qd);

// big spike: walk south from path cell (10,6) into the dead end
const big = async (x) => { await load(); return page.evaluate(({ S, x }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x, z: 26.5, yaw: S }); g.setInput({ forward: true }); let st;
    for (let i = 0; i < 120; i++) { st = g.step(1); if (g.events.some((e) => e.type === 'spike')) break; }
    g.clearInput(); const m = document.getElementById('message');
    return { pos: st.pos, hit: g.events.some((e) => e.type === 'spike'), msg: m.hidden ? '' : m.textContent };
}, { S, x }); };
for (const x of [42.5, 41.45, 43.55]) { const r = await big(x); check(`big spike at x ${x}: Ouch`, r.hit, r); }
await load();
const edge = await page.evaluate(() => { const g = window.__game; g.clearEvents(); g.teleport({ x: 42.5, z: 27.4 }); g.step(5); return { hit: g.events.some((e) => e.type === 'spike') }; });
check('standing on the path next to the big spike is safe', !edge.hit, edge);

// views
const view = async (name, x, z, yaw) => { await load(); await page.evaluate(({ x, z, yaw }) => { const g = window.__game; g.teleport({ x, z, yaw }); g.step(2); g.render(); }, { x, z, yaw }); await shot(name); };
await view('bigspike', 42.5, 22.5, S);
await view('bigspike-side', 38.5, 26.5, E);
await view('pathspike', sp.x, sp.z - 8, S);
await view('start', st0.start.x, st0.start.z, E);

const finish = () => page.evaluate(() => {
    const g = window.__game; const d = g.state().door; g.teleport({ x: d.x - 2.5, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); g.step(40); g.clearInput(); g.render();
    return { title: document.getElementById('finish-title').textContent, note: !document.getElementById('finish-note').hidden, buttons: [...document.querySelectorAll('#menu-finish .item, #menu-finish button')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim()) };
});
await load();
await page.evaluate(() => { const g = window.__game; const d = g.state().door; g.teleport({ x: d.x - 6, z: d.z, yaw: -Math.PI / 2 }); g.step(2); g.render(); });
await shot('door');
const f91 = await finish();
await shot('finish');
check('L91 door: More levels coming soon! + Quit', f91.title === 'More levels coming soon!' && f91.buttons.join('|') === 'Quit', f91);
await load(90);
const f90 = await finish();
await shot('l90-finish');
check('L90 door: You beat Robot Factory World! + Start Everything World + Quit, no note', f90.title === 'You beat Robot Factory World!' && !f90.note && f90.buttons.join('|') === 'Start Everything World|Quit', f90);

// Pick a level: Everything World button (not test mode, progress at Level 91)
if (browser) await browser.close();
browser = await launch(); page = await browser.newPage({ viewport: { width: 1024, height: 640 } }); page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(BASE + '/');
await page.evaluate(() => { localStorage.setItem('mazle.furthest', '90'); localStorage.setItem('mazle.news', JSON.stringify({ told: [...Array(91).keys()], beaten: 89, fresh: [] })); });
await page.reload(); await page.waitForTimeout(3000);
await page.evaluate(() => document.querySelector('[data-act=pick-level]')?.click());
await page.waitForTimeout(500);
const worlds = await page.evaluate(() => [...document.querySelectorAll('#world-grid .item')].map((b) => ({ cls: b.className, text: b.textContent })));
await shot('worlds');
check('Pick a level: 10 worlds, last is Everything World starting at 91', worlds.length === 10 && /look-everything/.test(worlds[9].cls) && worlds[9].text === '91', worlds.slice(8));
await page.evaluate(() => document.querySelectorAll('#world-grid .item')[9]?.click());
await page.waitForTimeout(500);
const lv = await page.evaluate(() => [...document.querySelectorAll('#level-grid .item')].map((b) => ({ cls: b.className, text: b.textContent })));
await shot('levels');
check('Everything World levels: 91 in the cotton candy look', lv.length === 1 && /look-candy/.test(lv[0].cls) && lv[0].text === '91', lv);
console.log('errors', errors);
console.log(results.every(Boolean) && !errors.length ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
