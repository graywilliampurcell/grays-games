// Level 82 checks: node t82.mjs (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
const idx = 81;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const load = async () => { await page.goto(`${BASE}/?test=1&level=${idx}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => window.__game?.ready); };
const shot = (name) => page.screenshot({ path: `${SP}l82-${name}.png` });
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info)); };
const E = -Math.PI / 2, W = Math.PI / 2, N = 0, S = Math.PI;
const look = (pitch) => page.evaluate(({ pitch }) => { const g = window.__game; const d = pitch - g.state().pitch; g.setInput({ lookDy: -d / 0.003 }); g.step(1); g.clearInput(); g.render(); }, { pitch });

await load();
const st0 = await page.evaluate(() => window.__game.state());
console.log('belts', JSON.stringify(st0.belts), 'level', st0.level.name, 'platforms', st0.platforms.length, 'spike', JSON.stringify(st0.spike));
const b0 = st0.belts[0];
check('one belt, 16 blocks along x, back = east, lands at 46.5,38.5, no tire', st0.belts.length === 1 && b0.alongX && b0.maxX - b0.minX === 16 && b0.back === 1 && b0.landing.x === 46.5 && b0.landing.z === 38.5 && st0.platforms.length === 0, b0);

// 1. Cycle timing
const cyc = await page.evaluate(() => {
    const g = window.__game; g.teleport({ x: 2.5, z: 38.5 }); let last = g.state().belts[0].phase; const log = [];
    for (let i = 0; i < 60 * 14; i++) { const st = g.step(1); const ph = st.belts[0].phase; if (ph !== last) { log.push([ph, st.t]); last = ph; } }
    return log;
});
console.log('cycle', JSON.stringify(cyc));
const t0 = cyc[0][1];
check('cycle: quiet 4 s -> warning 2 s -> on 3 s -> quiet', cyc[0][0] === 'warning' && Math.abs(cyc[0][1] - 4) < 0.05 && cyc[1][0] === 'on' && Math.abs(cyc[1][1] - cyc[0][1] - 2) < 0.05 && cyc[2][0] === 'quiet' && Math.abs(cyc[2][1] - cyc[1][1] - 3) < 0.05 && cyc[3][0] === 'warning' && Math.abs(cyc[3][1] - cyc[2][1] - 4) < 0.05, cyc);

// 2. Walk across while it's off: no fling
await load();
const walk = await page.evaluate(({ W }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 46.5, z: 38.5, yaw: W }); g.setInput({ forward: true }); let st;
    for (let i = 0; i < 150; i++) st = g.step(1);
    g.clearInput();
    return { pos: st.pos, phase: st.belts[0].phase, t: st.t, events: g.events.map((e) => e.type) };
}, { W });
check('walking across while off is normal floor', walk.pos.x < 29 && !walk.events.includes('belt') && walk.phase === 'quiet', walk);

// 3. Standing on it when it turns on: flung to the back of the hallway, no Ouch
await load();
const fl = await page.evaluate(({ W }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 37, z: 38.5, yaw: W }); let st; let onT = null; let flingT = null; const path = [];
    for (let i = 0; i < 60 * 8; i++) {
        st = g.step(1);
        if (onT === null && st.belts[0].phase === 'on') onT = st.t;
        if (flingT === null && g.events.some((e) => e.type === 'belt')) flingT = st.t;
        if (flingT !== null) path.push(st.pos.x);
        if (flingT !== null && !st.shoved) break;
    }
    const m = document.getElementById('message');
    return { pos: st.pos, onT, flingT, events: [...new Set(g.events.map((e) => e.type))], msg: m && !m.hidden ? m.textContent : '', maxX: Math.max(...path) };
}, { W });
check('on it when it turns on: flung to 46.5,38.5 at once, not an Ouch', fl.onT !== null && Math.abs(fl.flingT - fl.onT) < 0.05 && Math.abs(fl.pos.x - 46.5) < 0.05 && Math.abs(fl.pos.z - 38.5) < 0.05 && !fl.events.includes('spike') && !fl.msg && fl.maxX <= 46.6, fl);

// 4. Stepping onto it while it's on (from the back of the hallway)
await load();
const st4 = await page.evaluate(({ W }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 46.5, z: 38.5, yaw: W });
    let st; for (let i = 0; i < 60 * 7; i++) { st = g.step(1); if (st.belts[0].phase === 'on') break; }
    g.clearEvents(); g.setInput({ forward: true }); let flung = false; let minX = 99;
    for (let i = 0; i < 40; i++) { st = g.step(1); minX = Math.min(minX, st.pos.x); if (g.events.some((e) => e.type === 'belt')) { flung = true; } }
    g.clearInput(); for (let i = 0; i < 60 && st.shoved; i++) st = g.step(1);
    return { flung, minX, pos: st.pos, phase: st.belts[0].phase };
}, { W });
check('stepping onto it while on flings you back', st4.flung && st4.minX > 44.4 && st4.pos.x > 45, st4);

// 5. Coming from the far side (the exit's side) while on: flung back to the hallway's first cell (east end)
await load();
const st5 = await page.evaluate(({ E }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 26.5, z: 38.5, yaw: E });
    let st; for (let i = 0; i < 60 * 7; i++) { st = g.step(1); if (st.belts[0].phase === 'on') break; }
    g.setInput({ forward: true }); for (let i = 0; i < 40 && !g.events.some((e) => e.type === 'belt'); i++) st = g.step(1);
    g.clearInput(); for (let i = 0; i < 60; i++) st = g.step(1);
    return { pos: st.pos, events: [...new Set(g.events.map((e) => e.type))] };
}, { E });
check('touching it from the far side while on also ends at the back of the hallway', Math.abs(st5.pos.x - 46.5) < 0.6 && st5.events.includes('belt'), st5);

// 6. Paused: the cycle stops (real time)
await load();
const pz = await page.evaluate(async () => {
    const g = window.__game; g.setRealtime(true);
    await new Promise((r) => setTimeout(r, 500));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }));
    await new Promise((r) => setTimeout(r, 300));
    const a = g.state().belts[0].timer; const menuOpen = !!document.querySelector('#menu:not([hidden])') || document.body.classList.contains('paused');
    await new Promise((r) => setTimeout(r, 1500));
    const b = g.state().belts[0].timer;
    g.setRealtime(false);
    return { a, b, menuOpen };
});
check('belt cycle freezes while paused', pz.a === pz.b, pz);

// 7. Siren: plays at the warning (sound unlocked by a key), obeys the Sound effects switch
await load();
await page.keyboard.press('KeyW');
const sir = await page.evaluate(() => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 46.5, z: 38.5 });
    for (let i = 0; i < 60 * 5; i++) g.step(1);
    return g.events.filter((e) => e.type === 'sound').map((e) => e.name);
});
check('siren sounds at the warning', sir.includes('siren'), sir);

// 8. Screenshots
await load();
await page.evaluate(({ W }) => { const g = window.__game; g.teleport({ x: 49.5, z: 38.5, yaw: W }); g.step(1); g.render(); }, { W });
await shot('a-belt-from-back');
await page.evaluate(() => { const g = window.__game; while (g.state().belts[0].phase !== 'warning') g.step(1); g.step(10); g.render(); });
await shot('b-warning-blink-on');
await page.evaluate(() => { const g = window.__game; g.step(40); g.render(); });
await shot('c-warning-blink-off');
await page.evaluate(() => { const g = window.__game; while (g.state().belts[0].phase !== 'on') g.step(1); g.step(10); g.render(); });
await shot('d-on');
await look(-0.7); await shot('d2-on-look-down');
await look(0);
await page.evaluate(({ E }) => { const g = window.__game; g.teleport({ x: 24.5, z: 38.5, yaw: E }); g.step(1); g.render(); }, { E });
await shot('e-from-far-side');

// 9. Sneaky zapper
await load();
const hit = await page.evaluate(({ E }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 3, z: 42.5, yaw: E }); g.setInput({ forward: true }); g.step(80); g.clearInput();
    const m = document.getElementById('message');
    return { msg: m.hidden ? '' : m.textContent, events: g.events.map((e) => e.type) };
}, { E });
check('zapper: Ouch, back to start', hit.msg === 'Ouch! A zapper sent you back to the start.' && hit.events.includes('spike'), hit);

// 10. Door
await load();
const fin = await page.evaluate(({ E }) => {
    const g = window.__game; const d = g.state().door; g.teleport({ x: d.x - 2.5, z: d.z, yaw: E }); g.setInput({ forward: true }); g.step(60); g.clearInput(); g.render();
    return { escaped: g.state().escaped, title: document.getElementById('finish-title').textContent, buttons: [...document.querySelectorAll('#menu-finish .item, #menu-finish button')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim()) };
}, { E });
check('door: More levels coming soon + Quit', fin.escaped && fin.title === 'More levels coming soon!' && fin.buttons.join('|') === 'Quit', fin);

// 11. Level 81's door now leads to Level 82
await page.goto(BASE + '/?test=1&level=80', { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => window.__game?.ready);
const f81 = await page.evaluate(({ E }) => {
    const g = window.__game; const d = g.state().door; g.teleport({ x: d.x - 2.5, z: d.z, yaw: E }); g.setInput({ forward: true }); g.step(60); g.clearInput();
    return { title: document.getElementById('finish-title').textContent, buttons: [...document.querySelectorAll('#menu-finish .item, #menu-finish button')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim()) };
}, { E });
check("Level 81's door: You did it! + Start Level 82", f81.title === 'You did it!' && f81.buttons.some((b) => /Level 82/.test(b)), f81);

console.log('errors', errors);
console.log(results.every(Boolean) && !errors.length ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
