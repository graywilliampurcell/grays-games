// Level 78 checks: node t78.mjs (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
const idx = 77;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const load = async (i = idx) => { for (let a = 0; a < 3; a++) { try { await page.goto(`${BASE}/?test=1&level=${i}`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; } catch (e) { if (a === 2) throw e; } } await page.waitForFunction(() => window.__game?.ready); };
const shot = (name) => page.screenshot({ path: `${SP}l78-${name}.png` });
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info)); };
let r;
await load();
const st0 = await page.evaluate(() => window.__game.state());
console.log('start', JSON.stringify(st0.pos), 'snowmen', JSON.stringify(st0.snowmen), 'thinIce', JSON.stringify(st0.thinIce));
check('one snowman, five thin ice, no sled, no icicles', st0.snowmen.length === 1 && st0.thinIce.length === 5 && st0.platforms.length === 0 && !st0.spike && st0.spikeRows.length === 0, { s: st0.snowmen.length, t: st0.thinIce.length, p: st0.platforms.length, spike: st0.spike, rows: st0.spikeRows.length });

// Thin ice: each one breaks after 2.0 s standing; neighbour never counts
const ices = st0.thinIce.map((t, k) => ({ k, x: (t.minX + t.maxX) / 2, z: (t.minZ + t.maxZ) / 2 }));
for (const ice of ices) {
    await load();
    r = await page.evaluate(({ ice }) => {
        const g = window.__game; g.clearEvents(); g.teleport({ x: ice.x, z: ice.z, yaw: 0 });
        let st; let broke = null; let maxOther = 0;
        for (let i = 0; i < 240; i++) { st = g.step(1); st.thinIce.forEach((t, j) => { if (j !== ice.k) maxOther = Math.max(maxOther, t.time); }); if (g.events.some((e) => e.type === 'thinIce')) { broke = st.t; break; } }
        const m = document.getElementById('message');
        return { broke, maxOther, pos: st.pos, times: st.thinIce.map((t) => t.time), msg: m.hidden ? '' : m.textContent };
    }, { ice });
    check(`thin ice ${ice.k} at (${ice.x},${ice.z}) breaks at 2.0 s, back to start, all whole`, r.broke !== null && Math.abs(r.broke - 2.0) < 0.05 && r.msg === 'Ouch! The thin ice broke. Back to the start.' && Math.abs(r.pos.x - st0.pos.x) < 0.1 && Math.abs(r.pos.z - st0.pos.z) < 0.1 && r.times.every((t) => t === 0) && r.maxOther === 0, r);
}
// Walking across the path ones at normal speed
for (const [x, z, yaw, done] of [[18.5, 2.5, -Math.PI / 2, (p) => p.x > 26.5], [26.5, 30.5, Math.PI, (p) => p.z > 38.5], [22.5, 46.5, -Math.PI / 2, (p) => p.x > 30.5]]) {
    await load();
    r = await page.evaluate(({ x, z, yaw, done }) => {
        const fin = new Function('p', `return (${done})(p)`);
        const g = window.__game; g.clearEvents(); g.teleport({ x, z, yaw }); g.setInput({ forward: true });
        let st; let maxTime = 0;
        for (let i = 0; i < 240; i++) { st = g.step(1); maxTime = Math.max(maxTime, ...st.thinIce.map((t) => t.time)); if (fin(st.pos)) break; }
        g.clearInput();
        return { maxTime, pos: st.pos, events: [...new Set(g.events.map((e) => e.type))] };
    }, { x, z, yaw, done: done.toString() });
    check(`walking across thin ice from (${x},${z}): well under 2 s`, r.maxTime > 0 && r.maxTime < 1 && !r.events.includes('thinIce'), r);
}

// Snowman: hallway x21-23 z29-43 heading north, he stands east at z29, path turns west
const timing = await (async () => { await load(); return page.evaluate(() => {
    const g = window.__game; g.clearEvents(); const throws = []; let gone = null;
    for (let i = 0; i < 60 * 9; i++) { const st = g.step(1); if (g.events.some((e) => e.type === 'throw')) { throws.push(st.t); g.clearEvents(); } if (throws.length === 1 && st.snowmen[0].balls.length === 0 && gone === null) gone = st.t; }
    return { throws, gone };
}); })();
const gaps = timing.throws.slice(1).map((t, k) => +(t - timing.throws[k]).toFixed(2));
check('throws every 2.5 s', Math.abs(timing.throws[0] - 2.5) < 0.05 && gaps.every((d) => Math.abs(d - 2.5) < 0.05), { throws: timing.throws, gaps });
check('flight ~0.83 s', Math.abs(timing.gone - timing.throws[0] - 0.83) < 0.06, { flight: +(timing.gone - timing.throws[0]).toFixed(2) });
for (const [x, z, expect] of [[22.5, 34.5, [22.5, 38.5]], [21.5, 31.5, [21.5, 34.5]], [22.5, 41.5, [26.5, 42.5]], [22.5, 30.5, [22.5, 34.5]]]) {
    await load();
    r = await page.evaluate(({ x, z }) => {
        const g = window.__game; g.clearEvents(); g.teleport({ x, z, yaw: Math.PI });
        let st; let hitT = null;
        for (let i = 0; i < 60 * 4; i++) { st = g.step(1); if (hitT === null && g.events.some((e) => e.type === 'snowball')) hitT = st.t; if (hitT !== null && !st.shoved) break; }
        return { hitT, pos: st.pos, events: [...new Set(g.events.map((e) => e.type))] };
    }, { x, z });
    check(`hit at (${x},${z}) pushes back to ${expect}`, r.hitT !== null && Math.abs(r.pos.x - expect[0]) < 0.6 && Math.abs(r.pos.z - expect[1]) < 0.6 && !r.events.includes('spike'), r);
}
await load();
r = await page.evaluate(() => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 21.45, z: 29.5, yaw: Math.PI });
    let st; for (let i = 0; i < 600; i++) st = g.step(1);
    return { pos: st.pos, events: [...new Set(g.events.map((e) => e.type))] };
});
check('safe spot beside him (21.45,29.5): no hits in 10 s', !r.events.includes('snowball') && r.events.includes('throw'), r);
await load();
r = await page.evaluate(() => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 22.4, z: 31.5, yaw: 0 }); g.setInput({ forward: true });
    const st = g.step(30); g.clearInput();
    return { pos: st.pos, events: [...new Set(g.events.map((e) => e.type))] };
});
check('snowman is solid, no Ouch', r.pos.z > 29.35 && !r.events.includes('spike'), r);
await load();
r = await page.evaluate(() => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 26.5, z: 42.5, yaw: Math.PI / 2 });
    let st; let thrown = false;
    for (let i = 0; i < 600; i++) { st = g.step(1); if (g.events.some((e) => e.type === 'throw')) thrown = true; if (thrown && st.snowmen[0].balls.length === 0) break; }
    const t0 = st.t; g.clearEvents();
    g.teleport({ x: 21.5, z: 41.5, yaw: 0 }); g.setInput({ forward: true });
    let reached = null;
    for (let i = 0; i < 600; i++) { st = g.step(1); if (st.pos.z < 29.9) { reached = +(st.t - t0).toFixed(2); break; } }
    const hits = g.events.filter((e) => e.type === 'snowball').length;
    g.clearInput(); for (let i = 0; i < 120; i++) st = g.step(1);
    const hitsWaiting = g.events.filter((e) => e.type === 'snowball').length - hits;
    g.teleport({ yaw: Math.PI / 2 }); g.setInput({ forward: true }); st = g.step(40); g.clearInput();
    return { reached, hits, hitsWaiting, pos: st.pos };
});
check('run the hallway: at most one hit, safe, round the corner west', r.reached !== null && r.hits <= 1 && r.hitsWaiting === 0 && r.pos.x < 19, r);

// Screenshots
await load();
const view = async (name, x, z, yaw, steps = 1) => { await page.evaluate(({ x, z, yaw, steps }) => { const g = window.__game; g.teleport({ x, z, yaw }); g.step(steps); g.render(); }, { x, z, yaw, steps }); await shot(name); };
await view('a-start', st0.pos.x, st0.pos.z, -Math.PI / 2);
await view('b-hallway', 22.5, 42.5, 0, 100);
await view('c-ice-top', 17.5, 2.5, -Math.PI / 2);
await view('d-ice-deadend', 14.5, 42.5, Math.PI / 2);
await view('e-ice-cracking', 26.5, 46.5, -Math.PI / 2, 90);

// Doors
const finish = () => page.evaluate(() => {
    const g = window.__game; const d = g.state().door; g.teleport({ x: d.x - 2.5, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); g.step(40); g.clearInput(); g.render();
    return { title: document.getElementById('finish-title').textContent, buttons: [...document.querySelectorAll('#menu-finish .item, #menu-finish button')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim()), note: document.getElementById('finish-note')?.hidden };
});
await load();
const fin = await finish();
await shot('f-door');
check('L78 door: More levels coming soon + Quit', fin.buttons.join('|') === 'Quit', fin);
await load(76);
const fin77 = await finish();
check('L77 door: Start Level 78', fin77.buttons.some((b) => /Start Level 78/.test(b)), fin77);
// Tune
r = await page.evaluate(() => 1);
console.log('errors', errors);
console.log(results.every(Boolean) && !errors.length ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
