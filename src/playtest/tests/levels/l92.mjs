// Level 92 checks: node t92.mjs (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
let browser = null; const launch = () => chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
let page = null;
const errors = [];
const load = async (n = 92, query = 'test=1&') => { if (browser) await browser.close().catch(() => {}); browser = await launch(); page = await browser.newPage({ viewport: { width: 1024, height: 640 } }); page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); }); for (let tr = 0; tr < 3; tr++) { try { await page.goto(`${BASE}/?${query}level=${n - 1}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); if (query) await page.waitForFunction(() => window.__game?.ready); return; } catch (e) { console.log('retry load', String(e).slice(0, 80)); } } };
const shot = (name) => page.screenshot({ path: `${SP}l92-${name}.png` });
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info)); };
const E = -Math.PI / 2, W = Math.PI / 2, N = 0, S = Math.PI;

await load();
const st0 = await page.evaluate(() => window.__game.state());
console.log(st0.level.name, 'start', JSON.stringify(st0.start), 'door', JSON.stringify(st0.door), 'platforms', JSON.stringify(st0.platforms), 'spaceDoor', JSON.stringify(st0.spaceDoor), 'theme', JSON.stringify(st0.level.theme ?? null));
check('L92 loads: one platform, a space door, no spikes', st0.level.name === 'Level 92' && st0.platforms.length === 1 && !!st0.spaceDoor && !st0.spike && !st0.spike2 && st0.spikeRows.length === 0, {});

// Platform: walk north from path cell (4,10) onto the gap
const ride = await page.evaluate(({ N }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 18.5, z: 42.5, yaw: N }); g.setInput({ forward: true }); let st; let minZ = 99; let rode = false;
    for (let i = 0; i < 900; i++) { st = g.step(1); minZ = Math.min(minZ, st.pos.z); if (st.platforms[0].riding) rode = true; if (st.pos.z < 30.5) break; }
    g.clearInput();
    return { pos: st.pos, rode, minZ, events: [...new Set(g.events.map((e) => e.type))] };
}, { N });
check('platform carries you across the gap heading north', ride.rode && ride.pos.z < 31 && !ride.events.includes('fall'), ride);
await load();
const fall = await page.evaluate(({ N }) => {
    const g = window.__game; g.clearEvents(); const p = g.state().platforms[0]; console.log(JSON.stringify(p));
    // jump in when the platform is on the far side: send it over first by riding, then walk back south? simpler: teleport onto the gap middle
    g.teleport({ x: 18.5, z: 36, yaw: N }); let st; for (let i = 0; i < 200; i++) st = g.step(1);
    return { pos: st.pos, events: [...new Set(g.events.map((e) => e.type))], msg: document.getElementById('message').textContent };
}, { N });
check('stepping into the gap off the platform sends you back', fall.events.length > 0, fall);

// Space door: walk west from path cell (6,3) through x 20
await load();
const door = await page.evaluate(({ W }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 26.5, z: 14.5, yaw: W }); g.setInput({ forward: true }); let st; const phases = new Set(); let blocked = 0;
    for (let i = 0; i < 1200; i++) { st = g.step(1); phases.add(st.spaceDoor.phase); if (st.pos.x > 20.5 && st.pos.x < 22) blocked++; if (st.pos.x < 16) break; }
    g.clearInput();
    return { pos: st.pos, phases: [...phases], blocked, events: [...new Set(g.events.map((e) => e.type))] };
}, { W });
check('through the space door heading west', door.pos.x < 16, door);
await load();
const cycle = await page.evaluate(() => { const g = window.__game; const ph = []; let last = null; for (let i = 0; i < 900; i++) { const st = g.step(1); if (st.spaceDoor.phase !== last) { ph.push([i, st.spaceDoor.phase]); last = st.spaceDoor.phase; } } return ph.slice(0, 10); });
check('space door opens and shuts by itself', cycle.length >= 3, cycle);
// stand in the doorway: it never closes on the player
await load();
const stand = await page.evaluate(() => { const g = window.__game; g.teleport({ x: 20, z: 14.5 }); let st; let moved = 0; for (let i = 0; i < 600; i++) { st = g.step(1); } return { pos: st.pos, door: st.spaceDoor }; });
check('standing in the doorway: not shut on you', Math.abs(stand.pos.x - 20) < 1.5 && !stand.door.solid, stand);

// Slippery spot: walk east from path cell (2,2) over x 14
await load();
const slip = await page.evaluate(({ E }) => {
    const g = window.__game; g.teleport({ x: 10.5, z: 10.5, yaw: E }); g.setInput({ forward: true }); let st; let slid = false; let i;
    for (i = 0; i < 200; i++) { st = g.step(1); if (st.sliding) slid = true; if (st.pos.x > 16) { g.clearInput(); } if (slid && !st.sliding && st.pos.x > 16) break; }
    g.clearInput(); for (let k = 0; k < 60; k++) st = g.step(1);
    return { slid, pos: st.pos };
}, { E });
check('slippery spot slides you', slip.slid, slip);

// views
const view = async (name, x, z, yaw) => { await load(); await page.evaluate(({ x, z, yaw }) => { const g = window.__game; g.teleport({ x, z, yaw }); g.step(2); g.render(); }, { x, z, yaw }); await shot(name); };
await view('gap', 18.5, 43.5, N);
await view('gap-down', 18.5, 40.2, N);
await view('door', 30.5, 14.5, W);
await view('slippery', 6.5, 10.5, E);
await view('start', st0.start.x, st0.start.z, E);

const finish = () => page.evaluate(() => {
    const g = window.__game; const d = g.state().door; g.teleport({ x: d.x - 2.5, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); g.step(40); g.clearInput(); g.render();
    return { title: document.getElementById('finish-title').textContent, note: !document.getElementById('finish-note').hidden, buttons: [...document.querySelectorAll('#menu-finish .item, #menu-finish button')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim()) };
});
await load();
const f92 = await finish();
await shot('finish');
check('L92 door: More levels coming soon! + Quit', f92.title === 'More levels coming soon!' && f92.buttons.join('|') === 'Quit', f92);
await load(91);
const f91 = await finish();
check('L91 door leads on to Level 92', f91.buttons.length === 2 && f91.buttons[1] === 'Quit', f91);
await page.evaluate(() => document.querySelector('#menu-finish [data-act=next], #menu-finish .item')?.click());
await page.waitForTimeout(500);
const after = await page.evaluate(() => window.__game.state().level.name);
check('next level from 91 is Level 92', after === 'Level 92', { after });

// Pick a level: Everything World shows 91 (cotton candy) and 92 (space)
if (browser) await browser.close();
browser = await launch(); page = await browser.newPage({ viewport: { width: 1024, height: 640 } }); page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(BASE + '/');
await page.evaluate(() => { localStorage.setItem('mazle.furthest', '91'); localStorage.setItem('mazle.news', JSON.stringify({ told: [...Array(92).keys()], beaten: 90, fresh: [] })); });
await page.reload(); await page.waitForTimeout(3000);
await page.evaluate(() => document.querySelector('[data-act=pick-level]')?.click());
await page.waitForTimeout(500);
await page.evaluate(() => document.querySelectorAll('#world-grid .item')[9]?.click());
await page.waitForTimeout(500);
const lv = await page.evaluate(() => [...document.querySelectorAll('#level-grid .item')].map((b) => ({ cls: b.className, text: b.textContent })));
await shot('levels');
check('Everything World levels: 91 candy, 92 space', lv.length === 2 && /look-candy/.test(lv[0].cls) && /look-space/.test(lv[1].cls) && lv[1].text === '92', lv);
console.log('errors', errors);
console.log(results.every(Boolean) && !errors.length ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
