// Level 72 checks: node t72.mjs (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
const idx = 71;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const load = async (level = idx) => { await page.goto(`${BASE}/?test=1&level=${level}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => window.__game?.ready); };
const shot = (name) => page.screenshot({ path: `${SP}l72-${name}.png` });
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info)); };
const E = -Math.PI / 2, W = Math.PI / 2, N = 0, S = Math.PI;

await load();
const st0 = await page.evaluate(() => window.__game.state());
console.log('snowmen', JSON.stringify(st0.snowmen), 'platforms', st0.platforms.length, 'spike', st0.spike);
check('one snowman, one sled, no icicle', st0.snowmen.length === 1 && st0.platforms.length === 1 && !st0.spike, { sm: st0.snowmen.length, p: st0.platforms.length });

// 1. Throw interval and flight time (player far away at the start)
const timing = await page.evaluate(() => {
    const g = window.__game; g.clearEvents();
    const throws = []; let firstBall = null; let gone = null; let maxBalls = 0;
    for (let i = 0; i < 60 * 9; i++) {
        const st = g.step(1);
        maxBalls = Math.max(maxBalls, st.snowmen[0].balls.length);
        if (g.events.some((e) => e.type === 'throw')) { throws.push(st.t); g.clearEvents(); }
        if (throws.length === 1 && st.snowmen[0].balls.length === 0 && gone === null) gone = st.t;
    }
    return { throws, gone, maxBalls };
});
const gaps = timing.throws.slice(1).map((t, k) => +(t - timing.throws[k]).toFixed(2));
check('first throw ~2.5 s, then every 2.5 s', Math.abs(timing.throws[0] - 2.5) < 0.05 && gaps.every((d) => Math.abs(d - 2.5) < 0.05), { throws: timing.throws, gaps });
check('snowball flies down the hallway in ~0.83 s', Math.abs(timing.gone - timing.throws[0] - 0.83) < 0.06, { flight: +(timing.gone - timing.throws[0]).toFixed(2), maxBalls: timing.maxBalls });

// 2. Hit in the hallway's middle -> pushed one cell back
for (const [x, zz, expect] of [[24.5, 10.5, [18.5, 10.5]], [27.5, 9.5, [22.5, 9.5]], [26.5, 11.55, [22.5, 11.5]], [18.5, 11.5, [18.5, 6.5]], [30.5, 10.5, [26.5, 10.5]]]) {
    await load();
    const r = await page.evaluate(({ x, zz }) => {
        const g = window.__game; g.clearEvents(); g.teleport({ x, z: zz, yaw: Math.PI / 2 });
        let st; let hitT = null;
        for (let i = 0; i < 60 * 4; i++) { st = g.step(1); if (hitT === null && g.events.some((e) => e.type === 'snowball')) hitT = st.t; if (hitT !== null && !st.shoved) break; }
        const m = document.getElementById('message');
        return { hitT, pos: st.pos, events: [...new Set(g.events.map((e) => e.type))], msg: m.hidden ? '' : m.textContent, balls: st.snowmen[0].balls };
    }, { x, zz });
    check(`hit at (${x},${zz}) pushes to ${expect}`, r.hitT !== null && Math.abs(r.pos.x - expect[0]) < 0.05 && Math.abs(r.pos.z - expect[1]) < 0.05 && !r.events.includes('spike') && !r.events.includes('fall'), r);
}

// 3. Safe spot beside him: never hit
await load();
const safe = await page.evaluate(() => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 31.5, z: 11.55, yaw: Math.PI / 2 });
    let st; for (let i = 0; i < 60 * 10; i++) st = g.step(1);
    return { pos: st.pos, events: [...new Set(g.events.map((e) => e.type))] };
});
check('safe spot beside the snowman: no hits in 10 s', !safe.events.includes('snowball') && safe.events.includes('throw'), safe);
// a bit further out (one block in front of the safe spot, same side) is hit
await load();
const front = await page.evaluate(() => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 30.5, z: 11.55, yaw: Math.PI / 2 });
    let st; for (let i = 0; i < 60 * 3; i++) st = g.step(1);
    return { pos: st.pos, events: [...new Set(g.events.map((e) => e.type))] };
});
check('in front of him (not beside) is hit', front.events.includes('snowball'), front);

// 4. He's solid
await load();
const solid = await page.evaluate(() => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 29.5, z: 9.6, yaw: -Math.PI / 2 }); g.setInput({ forward: true });
    let st = g.step(30); g.clearInput();
    return { pos: st.pos, events: [...new Set(g.events.map((e) => e.type))] };
});
check('snowman is solid (stops you, no Ouch)', solid.pos.x < 30.65 && !solid.events.includes('spike'), solid);

// 5. Running the hallway right after a snowball passes, holding forward the whole way: count hits until the safe spot
await load();
const run = await page.evaluate(() => {
    const g = window.__game; g.clearEvents();
    g.teleport({ x: 18.5, z: 6.5, yaw: Math.PI });
    let st; let thrown = false;
    for (let i = 0; i < 600; i++) { st = g.step(1); if (g.events.some((e) => e.type === 'throw')) thrown = true; if (thrown && st.snowmen[0].balls.length === 0) break; }
    const t0 = st.t; g.clearEvents();
    g.teleport({ x: 18.5, z: 11.4, yaw: -Math.PI / 2 }); g.setInput({ forward: true });
    let reached = null; let firstHitX = null;
    for (let i = 0; i < 600; i++) {
        st = g.step(1);
        if (firstHitX === null && g.events.some((e) => e.type === 'snowball')) firstHitX = st.pos.x;
        if (st.pos.x > 31.1 && reached === null) { reached = +(st.t - t0).toFixed(2); break; }
    }
    const hits = g.events.filter((e) => e.type === 'snowball').length;
    for (let i = 0; i < 120; i++) st = g.step(1);
    const hitsWaiting = g.events.filter((e) => e.type === 'snowball').length - hits;
    g.clearInput(); g.teleport({ yaw: Math.PI }); g.setInput({ forward: true }); st = g.step(40); g.clearInput();
    return { reached, hits, hitsWaiting, firstHitX, pos: st.pos };
});
check('run the hallway: at most one hit, then safe beside him, round the corner', run.reached !== null && run.hits <= 1 && run.hitsWaiting === 0 && run.pos.z > 13, run);

// 6. Back to start clears snowballs and restarts his timer; sled ride east
await load();
const sled = await page.evaluate(() => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 2.5, z: 22.5, yaw: -Math.PI / 2 }); g.setInput({ forward: true });
    let st; let dep = null; let land = null;
    for (let i = 0; i < 900; i++) { st = g.step(1); if (st.platforms[0].phase === 'zip') g.clearInput(); if (dep === null && g.events.some((e) => e.what === 'depart')) dep = st.t; if (land === null && g.events.some((e) => e.what === 'land')) land = st.t; if (land !== null && !st.shoved) break; }
    return { pos: st.pos, ride: land - dep, events: [...new Set(g.events.map((e) => e.type + (e.what ? ':' + e.what : '')))] };
});
check('sled carries you east over the crack in ~1.5 s', sled.pos.x > 15 && sled.pos.x < 17.5 && Math.abs(sled.ride - 1.5) < 0.1 && !sled.events.includes('fall'), sled);
await load();
const fall = await page.evaluate(() => {
    const g = window.__game; g.step(170); const before = g.state().snowmen[0];
    g.clearEvents(); g.teleport({ x: 10, z: 22.5 }); const st = g.step(2);
    const m = document.getElementById('message');
    return { before: before.balls.length, after: st.snowmen[0], msg: m.hidden ? '' : m.textContent };
});
check('crack: Ouch, back to start; snowballs cleared, timer restarted', /fell in the crack/.test(fall.msg) && fall.before === 1 && fall.after.balls.length === 0 && fall.after.timer > 2.4, fall);

// Screenshots
await load();
await page.evaluate(() => { const g = window.__game; g.teleport({ x: 18.5, z: 10.5, yaw: -Math.PI / 2 }); g.step(1); g.render(); });
await shot('a-hallway');
await page.evaluate(() => { const g = window.__game; g.step(150); g.render(); });
await shot('b-throwing');
await page.evaluate(() => { const g = window.__game; g.teleport({ x: 18.5, z: 10.5, yaw: -Math.PI / 2 }); g.clearEvents(); for (let i = 0; i < 300; i++) { const st = g.step(1); if (st.snowmen[0].balls.length && st.snowmen[0].balls[0] < 9) break; } g.render(); });
await shot('c-snowball');
await page.evaluate(() => { const g = window.__game; g.teleport({ x: 27.5, z: 10.5, yaw: -Math.PI / 2 }); g.step(1); g.render(); });
await shot('d-close');
await page.evaluate(() => { const g = window.__game; g.teleport({ x: 31.5, z: 11.55, yaw: Math.PI / 2 }); g.step(1); g.render(); });
await shot('e-safe-spot-look-back');
await page.evaluate(() => { const g = window.__game; g.teleport({ x: 30.5, z: 14.5, yaw: 0 }); g.step(1); g.render(); });
await shot('f-from-turn');
await page.evaluate(() => { const g = window.__game; g.teleport({ x: 2.5, z: 22.5, yaw: -Math.PI / 2 }); g.step(1); g.render(); });
await shot('g-sled');

// 7. Level 72 door: More levels coming soon + Quit; Level 71 door: Start Level 72
await load();
const fin = await page.evaluate(() => {
    const g = window.__game; const d = g.state().door; g.teleport({ x: d.x - 2.5, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); g.step(40); g.clearInput(); g.render();
    return { escaped: g.state().escaped, title: document.getElementById('finish-title').textContent, buttons: [...document.querySelectorAll('#menu-finish .item, #menu-finish button')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim()) };
});
check('L72 door: More levels coming soon + Quit', fin.title === 'More levels coming soon!' && fin.buttons.join('|') === 'Quit', fin);
await load(70);
const fin71 = await page.evaluate(() => {
    const g = window.__game; const d = g.state().door; g.teleport({ x: d.x - 2.5, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); g.step(40); g.clearInput(); g.render();
    return { title: document.getElementById('finish-title').textContent, buttons: [...document.querySelectorAll('#menu-finish .item, #menu-finish button')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim()) };
});
check('L71 door: You did it + Start Level 72', fin71.buttons.some((b) => /Level 72/.test(b)), fin71);

console.log('errors', errors);
console.log(results.every(Boolean) && !errors.length ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
