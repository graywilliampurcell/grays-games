// Level 74 checks: node t74.mjs (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
const idx = 73;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const load = async (level = idx) => { await page.goto(`${BASE}/?test=1&level=${level}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => window.__game?.ready); };
const shot = (name) => page.screenshot({ path: `${SP}l74-${name}.png` });
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info)); };

await load();
const st0 = await page.evaluate(() => window.__game.state());
console.log('start', JSON.stringify(st0.pos), 'snowmen', JSON.stringify(st0.snowmen), 'thinIce', JSON.stringify(st0.thinIce));
check('one snowman, one thin ice, no sled, no path/sneaky icicle', st0.snowmen.length === 1 && st0.thinIce.length === 1 && st0.platforms.length === 0 && !st0.spike, {});

// Snowman timing
const timing = await page.evaluate(() => {
    const g = window.__game; g.clearEvents();
    const throws = []; let gone = null;
    for (let i = 0; i < 60 * 9; i++) {
        const st = g.step(1);
        if (g.events.some((e) => e.type === 'throw')) { throws.push(st.t); g.clearEvents(); }
        if (throws.length === 1 && st.snowmen[0].balls.length === 0 && gone === null) gone = st.t;
    }
    return { throws, gone };
});
const gaps = timing.throws.slice(1).map((t, k) => +(t - timing.throws[k]).toFixed(2));
check('throws every 2.5 s', Math.abs(timing.throws[0] - 2.5) < 0.05 && gaps.every((d) => Math.abs(d - 2.5) < 0.05), { throws: timing.throws, gaps });
check('flight ~0.83 s', Math.abs(timing.gone - timing.throws[0] - 0.83) < 0.06, { flight: +(timing.gone - timing.throws[0]).toFixed(2) });

// Hits push one cell back (hallway x9-11, z39 -> z25 heading north)
for (const [x, z, expect] of [[10.5, 34.5, [10.5, 38.5]], [9.5, 31.5, [9.5, 34.5]], [11.55, 29.5, [11.5, 34.5]], [11.5, 37.5, [10.5, 42.5]], [10.5, 26.5, [10.5, 30.5]]]) {
    await load();
    const r = await page.evaluate(({ x, z }) => {
        const g = window.__game; g.clearEvents(); g.teleport({ x, z, yaw: Math.PI });
        let st; let hitT = null;
        for (let i = 0; i < 60 * 4; i++) { st = g.step(1); if (hitT === null && g.events.some((e) => e.type === 'snowball')) hitT = st.t; if (hitT !== null && !st.shoved) break; }
        return { hitT, pos: st.pos, events: [...new Set(g.events.map((e) => e.type))] };
    }, { x, z });
    check(`hit at (${x},${z}) pushes to ${expect}`, r.hitT !== null && Math.abs(r.pos.x - expect[0]) < 0.05 && Math.abs(r.pos.z - expect[1]) < 0.05 && !r.events.includes('spike'), r);
}
await load();
let r = await page.evaluate(() => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 11.55, z: 25.5, yaw: Math.PI });
    let st; for (let i = 0; i < 600; i++) st = g.step(1);
    return { pos: st.pos, events: [...new Set(g.events.map((e) => e.type))] };
});
check('safe spot beside him: no hits in 10 s', !r.events.includes('snowball') && r.events.includes('throw'), r);
await load();
r = await page.evaluate(() => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 11.55, z: 26.5, yaw: Math.PI });
    let st; for (let i = 0; i < 180; i++) st = g.step(1);
    return { events: [...new Set(g.events.map((e) => e.type))] };
});
check('one block in front of the safe spot is hit', r.events.includes('snowball'), r);
await load();
r = await page.evaluate(() => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 9.6, z: 27.5, yaw: 0 }); g.setInput({ forward: true });
    const st = g.step(30); g.clearInput();
    return { pos: st.pos, events: [...new Set(g.events.map((e) => e.type))] };
});
check('snowman is solid, no Ouch', r.pos.z > 25.35 && !r.events.includes('spike'), r);
await load();
r = await page.evaluate(() => {
    const g = window.__game; g.clearEvents();
    g.teleport({ x: 10.5, z: 42.5, yaw: Math.PI });
    let st; let thrown = false;
    for (let i = 0; i < 600; i++) { st = g.step(1); if (g.events.some((e) => e.type === 'throw')) thrown = true; if (thrown && st.snowmen[0].balls.length === 0) break; }
    const t0 = st.t; g.clearEvents();
    g.teleport({ x: 11.4, z: 37.5, yaw: 0 }); g.setInput({ forward: true });
    let reached = null;
    for (let i = 0; i < 600; i++) { st = g.step(1); if (st.pos.z < 25.9) { reached = +(st.t - t0).toFixed(2); break; } }
    const hits = g.events.filter((e) => e.type === 'snowball').length;
    for (let i = 0; i < 120; i++) st = g.step(1);
    const hitsWaiting = g.events.filter((e) => e.type === 'snowball').length - hits;
    g.clearInput(); g.teleport({ yaw: -Math.PI / 2 }); g.setInput({ forward: true }); st = g.step(40); g.clearInput();
    return { reached, hits, hitsWaiting, pos: st.pos };
});
check('run the hallway: at most one hit, safe, round the corner east', r.reached !== null && r.hits <= 1 && r.hitsWaiting === 0 && r.pos.x > 13, r);

// Thin ice (x37-39 z29-31, heading north)
const stand = async (x, z) => page.evaluate(({ x, z }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x, z, yaw: 0 });
    let st; let broke = null; let maxTime = 0;
    for (let i = 0; i < 240; i++) { st = g.step(1); maxTime = Math.max(maxTime, st.thinIce[0].time); if (g.events.some((e) => e.type === 'thinIce')) { broke = st.t; break; } }
    const m = document.getElementById('message');
    return { broke, maxTime, pos: st.pos, time: st.thinIce[0].time, msg: m.hidden ? '' : m.textContent };
}, { x, z });
await load();
r = await stand(38.5, 30.5);
check('thin ice breaks at ~2.0 s, Ouch, back to start, whole again', r.broke !== null && Math.abs(r.broke - 2.0) < 0.05 && r.msg === 'Ouch! The thin ice broke. Back to the start.' && Math.abs(r.pos.x - st0.pos.x) < 0.1 && Math.abs(r.pos.z - st0.pos.z) < 0.1 && r.time === 0, r);
await load();
r = await stand(38.5, 32.25);
check('partly on it breaks', r.broke !== null, r);
await load();
r = await stand(38.5, 32.5);
check('next to it: never breaks', r.broke === null && r.maxTime === 0, r);
await load();
r = await page.evaluate(() => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 38.5, z: 35.5, yaw: 0 }); g.setInput({ forward: true });
    let st; let maxTime = 0;
    for (let i = 0; i < 240; i++) { st = g.step(1); maxTime = Math.max(maxTime, st.thinIce[0].time); if (st.pos.z < 26.5) break; }
    g.clearInput();
    return { maxTime, pos: st.pos, events: [...new Set(g.events.map((e) => e.type))] };
});
check('walking across: well under 2 s, no break', r.maxTime > 0 && r.maxTime < 1 && !r.events.includes('thinIce') && r.pos.z < 26.5, r);

// Big icicle (icicle arch) across the dead end north of (38.5,10.5)
await load();
r = await page.evaluate(() => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 33.5, z: 10.5, yaw: -Math.PI / 2 }); g.setInput({ forward: true });
    let st; for (let i = 0; i < 240; i++) { st = g.step(1); if (st.pos.x > 45) break; }
    g.clearInput();
    return { pos: st.pos, events: [...new Set(g.events.map((e) => e.type))] };
});
check('walking past the icicle arch along the path: no Ouch', r.pos.x > 45 && !r.events.includes('spike'), r);
for (const x of [37.45, 38.5, 39.55]) {
    await load();
    r = await page.evaluate(({ x }) => {
        const g = window.__game; g.clearEvents(); g.teleport({ x, z: 10.5, yaw: 0 }); g.setInput({ forward: true });
        let st; for (let i = 0; i < 120; i++) { st = g.step(1); if (g.events.some((e) => e.type === 'spike')) break; }
        g.clearInput(); const m = document.getElementById('message');
        return { pos: st.pos, hit: g.events.some((e) => e.type === 'spike'), msg: m.hidden ? '' : m.textContent };
    }, { x });
    check(`walking into the icicle arch at x=${x}: Ouch`, r.hit && /icicle/.test(r.msg), r);
}

// Screenshots
await load();
const view = async (name, x, z, yaw, steps = 1) => { await page.evaluate(({ x, z, yaw, steps }) => { const g = window.__game; g.teleport({ x, z, yaw }); g.step(steps); g.render(); }, { x, z, yaw, steps }); await shot(name); };
await view('a-arch-from-path', 34.5, 10.5, -Math.PI / 2 + 0.5);
await view('b-arch-close', 38.5, 13.0, 0);
await view('c-thin-ice', 38.5, 37.5, 0);
await view('d-hallway', 10.5, 41.5, 0, 150);
await view('e-safe-spot', 11.55, 25.5, Math.PI);

// Doors
await load();
const fin = await page.evaluate(() => {
    const g = window.__game; const d = g.state().door; g.teleport({ x: d.x - 2.5, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); g.step(40); g.clearInput(); g.render();
    return { title: document.getElementById('finish-title').textContent, buttons: [...document.querySelectorAll('#menu-finish .item, #menu-finish button')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim()) };
});
check('L74 door: More levels coming soon + Quit', fin.title === 'More levels coming soon!' && fin.buttons.join('|') === 'Quit', fin);
await load(72);
const fin73 = await page.evaluate(() => {
    const g = window.__game; const d = g.state().door; g.teleport({ x: d.x - 2.5, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); g.step(40); g.clearInput(); g.render();
    return { title: document.getElementById('finish-title').textContent, buttons: [...document.querySelectorAll('#menu-finish .item, #menu-finish button')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim()) };
});
check('L73 door: Start Level 74', fin73.buttons.some((b) => /Level 74/.test(b)), fin73);

console.log('errors', errors);
console.log(results.every(Boolean) && !errors.length ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
