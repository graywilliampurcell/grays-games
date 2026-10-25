// Level 71 checks: node t71.mjs (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
const idx = 70;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const load = async () => { await page.goto(`${BASE}/?test=1&level=${idx}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => window.__game?.ready); };
const shot = (name) => page.screenshot({ path: `${SP}l71-${name}.png` });
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info)); };
const E = -Math.PI / 2, W = Math.PI / 2, N = 0, S = Math.PI;
const look = (pitch) => page.evaluate(({ pitch }) => { const g = window.__game; const d = pitch - g.state().pitch; g.setInput({ lookDy: -d / 0.003 }); g.step(1); g.clearInput(); g.render(); }, { pitch });

await load();
const st0 = await page.evaluate(() => window.__game.state());
console.log('platform', JSON.stringify(st0.platforms[0]), 'start', JSON.stringify(st0.start));
check('one sled, east start edge', st0.platforms.length === 1 && st0.platforms[0].startAt > 0, st0.platforms[0]);
await shot('a-start');
await page.evaluate(({ S }) => { const g = window.__game; g.teleport({ yaw: S }); g.step(1); g.render(); }, { S });
await shot('a-start-south');

// 1. Ride east -> west, timing it
await load();
const ride = await page.evaluate(({ W }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 30.5, z: 42.5, yaw: W }); g.setInput({ forward: true });
    const log = []; let last = null; let st; let fell = false; let msg = ''; let departT = null; let landT = null;
    for (let i = 0; i < 1200; i++) {
        st = g.step(1);
        const p = st.platforms[0];
        if (p.phase === 'zip') g.clearInput();
        if (p.phase !== last) { log.push({ phase: p.phase, t: st.t, x: st.pos.x }); last = p.phase; }
        const m = document.getElementById('message'); if (!msg && m && !m.hidden && m.textContent.trim()) msg = m.textContent;
        if (g.events.some((e) => e.type === 'fall')) fell = true;
        if (departT === null && g.events.some((e) => e.what === 'depart')) departT = st.t;
        if (landT === null && g.events.some((e) => e.what === 'land')) landT = st.t;
        if (landT !== null && !st.shoved) break;
    }
    return { log, fell, msg, pos: st.pos, at: st.platforms[0].at, departT, landT, events: g.events.map((e) => e.type + (e.what ? ':' + e.what : '')) };
}, { W });
console.log(JSON.stringify(ride));
check('ride crosses and lands on the far floor', !ride.fell && ride.pos.x > 15 && ride.pos.x < 16.6, ride.pos);
check('ride takes about 1.5 s', Math.abs(ride.landT - ride.departT - 1.5) < 0.1, ride.landT - ride.departT);

// 2. Screenshots during the ride
await load();
await page.evaluate(({ W }) => { const g = window.__game; g.teleport({ x: 31.5, z: 42.5, yaw: W }); g.step(1); g.render(); }, { W });
await shot('b-approach');
await page.evaluate(({ W }) => { const g = window.__game; g.teleport({ x: 30, z: 42.5, yaw: W }); g.setInput({ forward: true }); for (let i = 0; i < 80 && g.state().platforms[0].phase !== 'zip'; i++) g.step(1); g.clearInput(); }, { W });
await page.evaluate(() => { window.__game.step(20); window.__game.render(); });
await shot('c-zipping');
await look(-1.2);
await shot('d-zipping-look-down');
await look(0.6);
await shot('e-zipping-look-up');
// steer attempts during the ride
const steer = await page.evaluate(({ N }) => { const g = window.__game; const before = g.state(); g.setInput({ strafeLeft: true, forward: true }); const st = g.step(10); g.clearInput(); return { before: before.pos, after: st.pos, phase: st.platforms[0].phase }; }, { N });
check('cannot steer during the ride (z stays)', Math.abs(steer.after.z - steer.before.z) < 0.01, steer);
await page.evaluate(() => { window.__game.step(200); });
await look(0);
await shot('f-landed');

// 3. Walk into the crack beside the sled
await load();
const fall = await page.evaluate(({ W }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 20, z: 42.5, yaw: W }); g.step(2);
    const m = document.getElementById('message');
    return { msg: m.hidden ? '' : m.textContent, pos: g.state().pos, events: g.events.map((e) => e.type) };
}, { W });
check('crack: Ouch, back to start', /fell in the crack/.test(fall.msg) && fall.events.includes('fall'), fall);

// 4. Coming from the west side: it zips over, waits, carries you back east
await load();
const back = await page.evaluate(({ E }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 14.5, z: 42.5, yaw: E }); g.setInput({ forward: true });
    let st; const log = []; let last = null; let floated = false;
    for (let i = 0; i < 1500; i++) {
        st = g.step(1); const p = st.platforms[0];
        if (p.phase !== last) { log.push({ phase: p.phase, t: st.t, x: st.pos.x, at: p.at }); last = p.phase; }
        if (p.phase === 'float') floated = true;
        if (st.pos.x > 15.5 && p.phase === "float") g.clearInput();
        if (floated && p.phase === 'rest' && p.at === 0 && !g.events.some((e) => e.what === 'depart')) g.setInput({ forward: true });
        if (p.phase === 'zip') g.clearInput();
        if (g.events.some((e) => e.what === 'land') && !st.shoved) break;
    }
    return { log, pos: st.pos, events: [...new Set(g.events.map((e) => e.type + (e.what ? ':' + e.what : '')))] };
}, { E });
check('zips over from the far side and carries you back east', back.pos.x > 28.5 && back.pos.x < 30 && back.log.some((l) => l.phase === 'float') && !back.events.includes('fall'), back);

// 5. Reset to start puts it back on its start edge
await load();
const reset = await page.evaluate(({ W }) => {
    const g = window.__game; g.teleport({ x: 30, z: 42.5, yaw: W }); g.setInput({ forward: true }); for (let i = 0; i < 80 && g.state().platforms[0].phase !== 'zip'; i++) g.step(1); g.clearInput(); g.step(200);
    const before = g.state().platforms[0].at;
    g.teleport({ x: 20, z: 42.5 }); g.step(2);
    return { before, after: g.state().platforms[0].at, startAt: g.state().platforms[0].startAt };
}, { W });
check('reset sends the sled back to its start edge', reset.before === 0 && reset.after === reset.startAt, reset);

// 6. The sneaky icicle: touch it -> Ouch, back to start; screenshot it from the dead end
await load();
const ic = await page.evaluate(({ E }) => {
    const g = window.__game; const st = g.state(); g.clearEvents();
    g.teleport({ x: 2.5, z: 26.5, yaw: E }); g.step(1); g.render();
    return { spike: st.spike ?? null };
}, { E });
await shot('g-icicle-near');
await page.evaluate(({ S }) => { const g = window.__game; g.teleport({ x: 2.5, z: 21.5, yaw: S }); g.step(1); g.render(); }, { S });
await shot('h-icicle-from-deadend');
const hit = await page.evaluate(({ E }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 3.5, z: 26.5, yaw: E }); g.setInput({ forward: true }); g.step(60); g.clearInput();
    const m = document.getElementById('message');
    return { msg: m.hidden ? '' : m.textContent, pos: g.state().pos, events: g.events.map((e) => e.type) };
}, { E });
check('icicle: Ouch, back to start', /icicle/.test(hit.msg) && hit.events.includes('spike'), hit);

// 7. Door: More levels coming soon + Quit only
await load();
const fin = await page.evaluate(({ E }) => {
    const g = window.__game; g.teleport({ x: 46, z: 46.5, yaw: E }); g.setInput({ forward: true }); g.step(40); g.clearInput(); g.render();
    const vis = (id) => { const el = document.getElementById(id); return el && !el.hidden && el.offsetParent !== null; };
    return { escaped: g.state().escaped, title: document.getElementById('finish-title').textContent, note: vis('finish-note'), buttons: [...document.querySelectorAll('#menu-finish .item, #menu-finish button')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim()) };
}, { E });
await shot('i-door');
check('door: More levels coming soon + Quit', fin.title === 'More levels coming soon!' && fin.buttons.join('|') === 'Quit', fin);

console.log('errors', errors);
console.log(results.every(Boolean) && !errors.length ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
