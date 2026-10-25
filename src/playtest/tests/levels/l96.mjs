// Level 96 checks: node t96.mjs (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
let browser = null; const launch = () => chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
let page = null;
const errors = [];
const load = async (n = 96, query = 'test=1&') => { if (browser) await browser.close().catch(() => {}); browser = await launch(); page = await browser.newPage({ viewport: { width: 1024, height: 640 } }); page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); }); for (let tr = 0; tr < 3; tr++) { try { await page.goto(`${BASE}/?${query}level=${n - 1}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); if (query) await page.waitForFunction(() => window.__game?.ready); return; } catch (e) { console.log('retry load', String(e).slice(0, 80)); } } };
const shot = (name) => page.screenshot({ path: `${SP}l96-${name}.png` });
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info)); };
const E = -Math.PI / 2, W = Math.PI / 2, N = 0, S = Math.PI;


await load();
const st0 = await page.evaluate(() => window.__game.state());
console.log(st0.level.name, 'start', JSON.stringify(st0.start), 'door', JSON.stringify(st0.door), 'spike', JSON.stringify(st0.spike), 'spike2', JSON.stringify(st0.spike2));
check('L96 loads: sneaky + path cane, no big cane, no platforms', st0.level.name === 'Level 96' && !!st0.spike && !!st0.spike2 && st0.spikeRows.length === 0 && st0.platforms.length === 1, {});

const walk = (x, z, yaw, done, input = { forward: true }) => page.evaluate(({ x, z, yaw, done, input }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x, z, yaw }); g.setInput(input); let st; let i;
    const f = new Function('st', `return ${done}`); const speeds = [];
    let last = g.state().pos; for (i = 0; i < 1500; i++) { st = g.step(1); speeds.push({ x: st.pos.x, z: st.pos.z, v: Math.hypot(st.pos.x - last.x, st.pos.z - last.z) * 60 }); last = st.pos; if (f(st)) break; }
    g.clearInput();
    return { pos: st.pos, steps: i, speeds, events: g.events.map((e) => e.type) };
}, { x, z, yaw, done, input });
const sum = (r) => ({ pos: r.pos, steps: r.steps, events: [...new Set(r.events)] });
// chocolate river: bottom row, cells 1-4 (x 5-19), crossed heading east
await load();
const b1 = await walk(2.5, 54.5, E, 'st.pos.x > 21.5');
check('marshmallow bounce east over the river, lands safely', b1.events.includes('bounce') && b1.pos.x > 21 && b1.events.filter((e) => e !== 'bounce').length === 0, sum(b1));
await load();
const b2 = await walk(22.5, 54.5, W, 'st.pos.x < 3.5');
check('marshmallow bounce west back over the river', b2.events.includes('bounce') && b2.pos.x < 4 && b2.events.filter((e) => e !== 'bounce').length === 0, sum(b2));
for (const zz of [53.5, 55.5]) {
    await load();
    const f = await walk(1.5, zz, E, 'st.pos.x > 21.5 || st.pos.x < 0', { forward: true });
    const fx = await page.evaluate(() => ({ pos: window.__game.state().pos, msg: document.getElementById('message')?.textContent ?? '' }));
    check(`walking past the marshmallow (z ${zz}) into the chocolate: back to the start`, !f.events.includes('bounce') && f.events.length > 0, { ...sum(f), fx });
}
// caramel 1: cell (9,9), heading south
const caramel = async (x, z, yaw, axis, lo, hi, done) => {
    await load();
    const r = await walk(x, z, yaw, done);
    const on = r.speeds.filter((s) => s[axis] > lo + 0.6 && s[axis] < hi - 0.6).map((s) => s.v);
    const off = r.speeds.filter((s) => s[axis] < lo - 0.5 || s[axis] > hi + 0.5).map((s) => s.v);
    return { on: Math.max(...on), off: Math.max(...off), after: r.speeds[r.speeds.length - 1].v, events: [...new Set(r.events)] };
};
const c1 = await caramel(38.5, 33.5, S, 'z', 37, 40, 'st.pos.z > 42.6');
check('caramel 1 (heading south): half speed on it, normal after', Math.abs(c1.on / c1.off - 0.5) < 0.06 && c1.after > 7, c1);
const c2 = await caramel(21.5, 2.5, E, 'x', 25, 28, 'st.pos.x > 30.6');
check('caramel 2 (top row, heading east): half speed on it, normal after', Math.abs(c2.on / c2.off - 0.5) < 0.06 && c2.after > 7, c2);

// path cane Z heading north
const sp = st0.spike2;
const squeeze = async (x) => { await load(); return page.evaluate(({ x, N, sp }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x, z: sp.z + 4, yaw: N }); g.setInput({ forward: true }); let st;
    for (let i = 0; i < 120; i++) st = g.step(1);
    g.clearInput();
    return { pos: st.pos, hit: g.events.some((e) => e.type === 'spike') };
}, { x, N, sp }); };
for (const d of [1.0, 1.05]) {
    const a = await squeeze(sp.x - d); check(`squeeze past west side (${d})`, !a.hit && a.pos.z < sp.z - 2, a);
    const b = await squeeze(sp.x + d); check(`squeeze past east side (${d})`, !b.hit && b.pos.z < sp.z - 2, b);
}
const qc = await squeeze(sp.x); check('middle: Ouch', qc.hit, qc);
const qd = await squeeze(sp.x - 0.8); check('a bit off the side still hits', qd.hit, qd);
const q1 = await squeeze(sp.x - 0.95); console.log('info: at 0.95 off centre', JSON.stringify(q1));

// sneaky cane: (2,7) -> (3,7), then south to (3,8)
await load();
const sn = await page.evaluate(() => { const g = window.__game; g.clearEvents(); g.teleport({ x: 14.5, z: 30.5, yaw: Math.PI }); g.setInput({ forward: true }); let st; for (let i = 0; i < 200; i++) { st = g.step(1); if (g.events.some((e) => e.type === 'spike')) break; } g.clearInput(); return { pos: st.pos, hit: g.events.some((e) => e.type === 'spike') }; });
check('sneaky candy cane round the corner: Ouch', sn.hit, sn);

const view = async (name, x, z, yaw) => { await load(); await page.evaluate(({ x, z, yaw }) => { const g = window.__game; g.teleport({ x, z, yaw }); g.step(2); g.render(); }, { x, z, yaw }); await shot(name); };
await view('start', st0.start.x, st0.start.z, E);
await view('river', 2.0, 54.5, E);
await view('caramel1', 38.5, 33, S);
await view('caramel2', 21.5, 2.5, E);
await view('cane', sp.x, sp.z + 6, N);
await view('sneaky', 10.5, 30.5, E);
await view('sneaky2', 14.5, 30.5, S);

const finish = () => page.evaluate(() => {
    const g = window.__game; const d = g.state().door; g.teleport({ x: d.x - 2.5, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); g.step(40); g.clearInput(); g.render();
    return { title: document.getElementById('finish-title').textContent, buttons: [...document.querySelectorAll('#menu-finish .item, #menu-finish button')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim()) };
});
await load();
const f96 = await finish();
await shot('finish');
check('L96 door: More levels coming soon! + Quit', f96.title === 'More levels coming soon!' && f96.buttons.join('|') === 'Quit', f96);
await load(95);
const f95 = await finish();
check('L95 door leads on', f95.buttons.length === 2 && f95.buttons[1] === 'Quit', f95);
await page.evaluate(() => document.querySelector('#menu-finish [data-act=next], #menu-finish .item')?.click());
await page.waitForTimeout(500);
const after = await page.evaluate(() => window.__game.state().level.name);
check('next level from 95 is Level 96', after === 'Level 96', { after });
const music = await page.evaluate(() => window.__game.state().music ?? null);
console.log('music', music);

if (browser) await browser.close();
browser = await launch(); page = await browser.newPage({ viewport: { width: 1024, height: 640 } }); page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(BASE + '/');
await page.evaluate(() => { localStorage.setItem('mazle.furthest', '95'); localStorage.setItem('mazle.news', JSON.stringify({ told: [...Array(96).keys()], beaten: 94, fresh: [] })); });
await page.reload(); await page.waitForTimeout(3000);
await page.evaluate(() => document.querySelector('[data-act=pick-level]')?.click());
await page.waitForTimeout(500);
await page.evaluate(() => document.querySelectorAll('#world-grid .item')[9]?.click());
await page.waitForTimeout(500);
const lv = await page.evaluate(() => [...document.querySelectorAll('#level-grid .item')].map((b) => ({ cls: b.className, text: b.textContent })));
await shot('levels');
check('Everything World levels 91-96, 96 in the candy look', lv.length === 6 && /look-sweets/.test(lv[5].cls) && lv[5].text === '96', lv);
console.log('errors', errors);
console.log(results.every(Boolean) && !errors.length ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
