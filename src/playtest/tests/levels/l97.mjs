// Level 97 checks: node t97.mjs (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
let browser = null; const launch = () => chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
let page = null;
const errors = [];
const load = async (n = 97, query = 'test=1&') => { if (browser) await browser.close().catch(() => {}); browser = await launch(); page = await browser.newPage({ viewport: { width: 1024, height: 640 } }); page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); }); for (let tr = 0; tr < 3; tr++) { try { await page.goto(`${BASE}/?${query}level=${n - 1}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); if (query) await page.waitForFunction(() => window.__game?.ready); return; } catch (e) { console.log('retry load', String(e).slice(0, 80)); } } };
const shot = (name) => page.screenshot({ path: `${SP}l97-${name}.png` });
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info)); };
const E = -Math.PI / 2, W = Math.PI / 2, N = 0, S = Math.PI;
const msgWalk = (x, z, yaw, frames = 120) => page.evaluate(({ x, z, yaw, frames }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x, z, yaw }); g.setInput({ forward: true });
    let msg = ''; let st;
    for (let i = 0; i < frames; i++) { st = g.step(1); const m = document.getElementById('message'); if (!msg && !m.hidden && m.textContent) msg = m.textContent; }
    g.clearInput(); return { msg, pos: st.pos, start: st.start, events: [...new Set(g.events.map((e) => e.type))] };
}, { x, z, yaw, frames });

await load();
const st0 = await page.evaluate(() => { const s = window.__game.state(); return { name: s.level.name, geysers: s.geysers, platforms: s.platforms.length, vents: s.vents, spike: s.spike, spike2: s.spike2, rows: s.spikeRows, start: s.start, door: s.door }; });
console.log(JSON.stringify(st0));
check('L97: one geyser, one vent, one balloon, one path coal, no sneaky/big', st0.name === 'Level 97' && st0.geysers.length === 1 && st0.platforms === 1 && st0.vents.length === 1 && !!st0.spike && !st0.spike2 && st0.rows.length === 0, {});

// Geyser (13,3) heading south: z 13-15, x 53-55
await load();
const gh = await page.evaluate(({ S }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 54.5, z: 6.5, yaw: S });
    for (let i = 0; i < 600 && g.state().geysers[0].phase !== 'erupt'; i++) g.step(1);
    g.step(20); g.setInput({ forward: true }); let msg = ''; let st;
    for (let i = 0; i < 120; i++) { st = g.step(1); const m = document.getElementById('message'); if (!m.hidden && m.textContent) { msg = m.textContent; break; } }
    g.clearInput(); return { msg, pos: st.pos, start: st.start };
}, { S });
check('geyser erupting: Ouch and back to start', /lava geyser/.test(gh.msg), gh);
await load();
const gq = await page.evaluate(({ S }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 54.5, z: 9.5, yaw: S });
    for (let i = 0; i < 600 && g.state().geysers[0].phase !== 'erupt'; i++) g.step(1);
    for (let i = 0; i < 600 && g.state().geysers[0].phase !== 'quiet'; i++) g.step(1);
    g.setInput({ forward: true }); let st; for (let i = 0; i < 70; i++) st = g.step(1);
    g.clearInput(); return { pos: st.pos, hits: g.events.filter((e) => e.type === 'spike').length };
}, { S });
check('geyser quiet: walk through', gq.pos.z > 17 && gq.hits === 0, gq);

// Vent (13,9) z 37-39, Q (54.5,34.5), heading south
await load();
const vp = await page.evaluate(({ S }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 54.5, z: 36.6, yaw: S });
    for (let i = 0; i < 600 && g.state().vents[0].phase !== 'puff'; i++) g.step(1);
    g.teleport({ x: 54.5, z: 38.5, yaw: S }); let st; for (let i = 0; i < 60; i++) st = g.step(1);
    return { pos: st.pos, events: [...new Set(g.events.map((e) => e.type))] };
}, { S });
check('vent puff pushes you back one square (to Q 54.5,34.5)', Math.abs(vp.pos.z - 34.5) < 1.2 && Math.abs(vp.pos.x - 54.5) < 1, vp);
await load();
const va = await page.evaluate(({ S }) => {
    const g = window.__game; g.teleport({ x: 54.5, z: 30.5, yaw: S }); g.step(2); const before = g.state().vents[0].audible;
    g.teleport({ x: 54.5, z: 46.5, yaw: S }); g.step(5); const after = g.state().vents[0].audible; return { before, after };
}, { S });
check('vent audible before, silent once past it (Iteration 86)', va.before === true && va.after === false, va);

// Path coal (4,8) heading west, centre (18.5,34.5), spikeRadius 0.7
const cx = st0.spike.x, cz = st0.spike.z;
for (const off of [-1.05, 1.05, -0.8, 0.8, 0]) {
    await load();
    const r = await msgWalk(cx + 3, cz + off, W);
    const pass = Math.abs(off) > 1;
    check(`coal squeeze off ${off} ${pass ? 'passes' : 'hits'}`, /ouch/i.test(r.msg) === !pass && (!pass || r.pos.x < cx - 2), r);
}

// Balloon: rests at north edge of the gap (0,9)-(0,12), heading south
await load();
const ride = await page.evaluate(({ S }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 2.5, z: 34.5, yaw: S }); g.setInput({ forward: true });
    const log = []; let last = null; let st; let fell = false; const views = new Set();
    for (let i = 0; i < 2000; i++) {
        st = g.step(1); const p = st.platforms[0]; if (p.view) views.add(p.view);
        if (p.phase === 'wait') g.clearInput();
        if (p.phase !== last) { log.push({ phase: p.phase, t: +st.t.toFixed(2), z: +st.pos.z.toFixed(2) }); last = p.phase; }
        if (g.events.some((e) => e.type === 'fall')) fell = true;
        if (log.length > 6 && p.phase === 'rest') break;
    }
    return { log, fell, pos: st.pos, views: [...views] };
}, { S });
check('balloon carries you south over the lava', !ride.fell && ride.pos.z > 51 && ride.pos.z < 58, ride);
await load();
const lava = await msgWalk(2.5, 34.5, S, 200);
console.log('info: walking straight into the gap', JSON.stringify(lava));

const view = async (name, x, z, yaw, wait) => { await load(); await page.evaluate(({ x, z, yaw, wait }) => { const g = window.__game; g.teleport({ x, z, yaw }); if (wait) for (let i = 0; i < 600 && g.state().geysers[0].phase !== 'erupt'; i++) g.step(1); g.step(wait ? 30 : 2); g.render(); }, { x, z, yaw, wait }); await shot(name); };
await view('start', st0.start.x, st0.start.z, E);
await view('geyser', 54.5, 6.5, S, true);
await view('vent', 54.5, 30.5, S);
await view('coal', cx + 6, cz, W);
await view("balloon", 2.5, 34.5, S);

const finish = () => page.evaluate(() => {
    const g = window.__game; const d = g.state().door; g.teleport({ x: d.x - 2.5, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); g.step(40); g.clearInput(); g.render();
    return { title: document.getElementById('finish-title').textContent, buttons: [...document.querySelectorAll('#menu-finish .item, #menu-finish button')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim()) };
});
await load();
const f97 = await finish();
await shot('finish');
check('L97 door: More levels coming soon! + Quit', f97.title === 'More levels coming soon!' && f97.buttons.join('|') === 'Quit', f97);
await load(96);
const f96 = await finish();
check('L96 door leads on', f96.buttons.length === 2 && f96.buttons[1] === 'Quit', f96);
await page.evaluate(() => document.querySelector('#menu-finish [data-act=next], #menu-finish .item')?.click());
await page.waitForTimeout(500);
const after = await page.evaluate(() => window.__game.state().level.name);
check('next level from 96 is Level 97', after === 'Level 97', { after });

if (browser) await browser.close();
browser = await launch(); page = await browser.newPage({ viewport: { width: 1024, height: 640 } }); page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(BASE + '/');
await page.evaluate(() => { localStorage.setItem('mazle.furthest', '96'); localStorage.setItem('mazle.news', JSON.stringify({ told: [...Array(97).keys()], beaten: 95, fresh: [] })); });
await page.reload(); await page.waitForTimeout(3000);
await page.evaluate(() => document.querySelector('[data-act=pick-level]')?.click());
await page.waitForTimeout(500);
await page.evaluate(() => document.querySelectorAll('#world-grid .item')[9]?.click());
await page.waitForTimeout(500);
const lv = await page.evaluate(() => [...document.querySelectorAll('#level-grid .item')].map((b) => ({ cls: b.className, text: b.textContent })));
await shot('levels');
check('Everything World levels 91-97, 97 in the volcano look', lv.length === 7 && /look-volcano/.test(lv[6].cls) && lv[6].text === '97', lv);
console.log('errors', errors);
console.log(results.every(Boolean) && !errors.length ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
