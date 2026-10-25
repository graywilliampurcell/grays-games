// Level 83 checks: node t83.mjs (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
const idx = 82;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const load = async () => { await page.goto(`${BASE}/?test=1&level=${idx}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => window.__game?.ready); };
const shot = (name) => page.screenshot({ path: `${SP}l83-${name}.png` });
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info)); };
const E = -Math.PI / 2, W = Math.PI / 2, N = 0, S = Math.PI;
const look = (pitch) => page.evaluate(({ pitch }) => { const g = window.__game; const d = pitch - g.state().pitch; g.setInput({ lookDy: -d / 0.003 }); g.step(1); g.clearInput(); g.render(); }, { pitch });

await load();
const st0 = await page.evaluate(() => window.__game.state());
console.log('belts', JSON.stringify(st0.belts), 'level', st0.level.name, 'platforms', st0.platforms.length, 'spike', JSON.stringify(st0.spike));
const b0 = st0.belts[0];
check('one belt, 16 blocks along x, back = west, lands at 22.5,50.5, no tire', st0.belts.length === 1 && b0.alongX && b0.maxX - b0.minX === 16 && b0.back === -1 && b0.landing.x === 22.5 && b0.landing.z === 50.5 && st0.platforms.length === 0, b0);
check('level 83, path zapper at 42.5,22.5 radius 0.64', st0.level.name === 'Level 83' && st0.spike && Math.abs(st0.spike.x - 42.5) < 0.01 && Math.abs(st0.spike.z - 22.5) < 0.01, st0.spike);


// 1. Cycle timing: quiet 2 s from now on
const cyc = await page.evaluate(() => {
    const g = window.__game; g.teleport({ x: 6.5, z: 2.5 }); let last = g.state().belts[0].phase; const log = [];
    for (let i = 0; i < 60 * 12; i++) { const st = g.step(1); const ph = st.belts[0].phase; if (ph !== last) { log.push([ph, st.t]); last = ph; } }
    return log;
});
check('cycle: quiet 2 s -> warning 2 s -> on 3 s -> quiet 2 s', cyc[0][0] === 'warning' && Math.abs(cyc[0][1] - 2) < 0.05 && cyc[1][0] === 'on' && Math.abs(cyc[1][1] - cyc[0][1] - 2) < 0.05 && cyc[2][0] === 'quiet' && Math.abs(cyc[2][1] - cyc[1][1] - 3) < 0.05 && cyc[3][0] === 'warning' && Math.abs(cyc[3][1] - cyc[2][1] - 2) < 0.05, cyc);

// 2. Walk across while it's off
await load();
const walk = await page.evaluate(({ E }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 22.5, z: 50.5, yaw: E }); g.setInput({ forward: true }); let st;
    for (let i = 0; i < 100; i++) st = g.step(1);
    g.clearInput();
    return { pos: st.pos, phase: st.belts[0].phase, events: g.events.map((e) => e.type) };
}, { E });
check('walking across while off is normal floor', walk.pos.x > 40 && !walk.events.includes('belt'), walk);

// 3. On it when it turns on: flung to 22.5,50.5
await load();
const fl = await page.evaluate(({ E }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 32, z: 50.5, yaw: E }); let st; let onT = null; let flingT = null;
    for (let i = 0; i < 60 * 6; i++) {
        st = g.step(1);
        if (onT === null && st.belts[0].phase === 'on') onT = st.t;
        if (flingT === null && g.events.some((e) => e.type === 'belt')) flingT = st.t;
        if (flingT !== null && !st.shoved) break;
    }
    const m = document.getElementById('message');
    return { pos: st.pos, onT, flingT, events: [...new Set(g.events.map((e) => e.type))], msg: m && !m.hidden ? m.textContent : '' };
}, { E });
check('on it when it turns on: flung to 22.5,50.5, not an Ouch', fl.onT !== null && Math.abs(fl.flingT - fl.onT) < 0.05 && Math.abs(fl.pos.x - 22.5) < 0.05 && Math.abs(fl.pos.z - 50.5) < 0.05 && !fl.events.includes('spike') && !fl.msg, fl);

// 4. Path zapper: squeeze past on both sides, hit in the middle
const squeeze = async (x) => { await load(); return page.evaluate(({ x, S }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x, z: 17.5, yaw: S }); g.setInput({ forward: true }); let st;
    for (let i = 0; i < 150; i++) st = g.step(1);
    g.clearInput(); const m = document.getElementById('message');
    return { pos: st.pos, hit: g.events.some((e) => e.type === 'spike'), msg: m.hidden ? '' : m.textContent };
}, { x, S }); };
const left = await squeeze(41.45); check('squeeze past on the west side', !left.hit && left.pos.z > 25, left);
const right = await squeeze(43.55); check('squeeze past on the east side', !right.hit && right.pos.z > 25, right);
const mid = await squeeze(42.5); check('middle: Ouch, back to start', mid.hit && mid.msg === 'Ouch! A zapper sent you back to the start.', mid);
const tight = await squeeze(41.9); check('a bit off the side still hits', tight.hit, tight);

// 5. Screenshots
await load();
await page.evaluate(({ S }) => { const g = window.__game; g.teleport({ x: 42.5, z: 13.5, yaw: S }); g.step(1); g.render(); }, { S });
await shot('a-zapper-approach');
await page.evaluate(({ E }) => { const g = window.__game; g.teleport({ x: 20.5, z: 50.5, yaw: E }); g.step(1); g.render(); }, { E });
await shot('b-belt');
await page.evaluate(() => { const g = window.__game; while (g.state().belts[0].phase !== 'warning') g.step(1); g.step(10); g.render(); });
await shot('c-warning');

// 6. Door
await load();
const fin = await page.evaluate(({ E }) => {
    const g = window.__game; const d = g.state().door; g.teleport({ x: d.x - 2.5, z: d.z, yaw: E }); g.setInput({ forward: true }); g.step(60); g.clearInput();
    return { escaped: g.state().escaped, title: document.getElementById('finish-title').textContent, buttons: [...document.querySelectorAll('#menu-finish .item, #menu-finish button')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim()) };
}, { E });
check('door: More levels coming soon + Quit', fin.escaped && fin.title === 'More levels coming soon!' && fin.buttons.join('|') === 'Quit', fin);

// 7. Level 82's door now leads to Level 83
await page.goto(BASE + '/?test=1&level=81', { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => window.__game?.ready);
const f82 = await page.evaluate(({ E }) => {
    const g = window.__game; const d = g.state().door; g.teleport({ x: d.x - 2.5, z: d.z, yaw: E }); g.setInput({ forward: true }); g.step(60); g.clearInput();
    return { title: document.getElementById('finish-title').textContent, buttons: [...document.querySelectorAll('#menu-finish .item, #menu-finish button')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim()) };
}, { E });
check("Level 82's door: You did it! + Start Level 83", f82.title === 'You did it!' && f82.buttons.some((b) => /Level 83/.test(b)), f82);

console.log('errors', errors);
console.log(results.every(Boolean) && !errors.length ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
