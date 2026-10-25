// Level 79 checks: node t79.mjs (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
const idx = 78;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const load = async (i = idx) => { for (let a = 0; a < 3; a++) { try { await page.goto(`${BASE}/?test=1&level=${i}`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; } catch (e) { if (a === 2) throw e; } } await page.waitForFunction(() => window.__game?.ready); };
const shot = (name) => page.screenshot({ path: `${SP}l79-${name}.png` });
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info)); };
let r;
const N = 0, S = Math.PI, E = -Math.PI / 2, W = Math.PI / 2;
await load();
const st0 = await page.evaluate(() => window.__game.state());
console.log('start', JSON.stringify(st0.pos), 'snowmen', JSON.stringify(st0.snowmen), 'platforms', JSON.stringify(st0.platforms), 'spike', JSON.stringify(st0.spike), 'rows', JSON.stringify(st0.spikeRows));
check('two snowmen, one sled, one arch, sneaky icicle, no path icicle, no thin ice', st0.snowmen.length === 2 && st0.platforms.length === 1 && st0.spikeRows.length === 1 && !!st0.spike && !st0.spike2 && st0.thinIce.length === 0, {});

// Sled: crack x41-43 z13-35, crossed heading south
const ride = (from) => page.evaluate(({ from }) => {
    const g = window.__game; g.clearEvents(); g.teleport(from); g.setInput({ forward: true });
    let st; let departT = null; let landT = null; let fell = false; const phases = [];
    for (let i = 0; i < 2000; i++) {
        st = g.step(1); const p = st.platforms[0];
        if (phases[phases.length - 1] !== p.phase) phases.push(p.phase);
        if (p.phase === 'zip' || p.phase === 'float') g.clearInput();
        if (p.phase === 'rest' && phases.includes('float') && departT === null) g.setInput({ forward: true });
        if (g.events.some((e) => e.type === 'fall' || e.type === 'spike')) fell = true;
        if (departT === null && g.events.some((e) => e.what === 'depart')) departT = st.t;
        if (landT === null && g.events.some((e) => e.what === 'land')) landT = st.t;
        if (landT !== null && !st.shoved) break;
    }
    g.clearInput();
    return { pos: st.pos, fell, phases, time: landT - departT };
}, { from });
const gap = st0.platforms[0].gap;
console.log('gap', JSON.stringify(gap));
await load();
r = await ride({ x: (gap.minX + gap.maxX) / 2, z: gap.minZ - 2.5, yaw: S });
check('sled: rides south across the crack, ~1.5 s', !r.fell && r.pos.z >= gap.maxZ && Math.abs(r.time - 1.5) < 0.1, r);
await load();
r = await ride({ x: (gap.minX + gap.maxX) / 2, z: gap.maxZ + 2.5, yaw: N });
check('sled: from the far side it zips over, then carries you back', !r.fell && r.phases.includes('float') && r.pos.z <= gap.minZ, r);
await load();
r = await page.evaluate(({ gap }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: gap.minX + 0.6, z: gap.minZ - 1, yaw: 0 }); g.step(2);
    g.teleport({ x: (gap.minX + gap.maxX) / 2, z: (gap.minZ + gap.maxZ) / 2, yaw: 0 }); let st; for (let i = 0; i < 120; i++) st = g.step(1);
    const m = document.getElementById('message');
    return { msg: m.hidden ? '' : m.textContent, pos: st.pos, events: [...new Set(g.events.map((e) => e.type))] };
}, { gap });
check('walking into the crack: Ouch, back to start', /crack/.test(r.msg) && Math.abs(r.pos.x - st0.pos.x) < 0.1, r);

// Sneaky icicle in cell (1,0), reached heading east from (0,0)
await load();
await page.evaluate(() => { const g = window.__game; g.teleport({ x: 2.5, z: 2.5, yaw: -Math.PI / 2 }); g.step(1); g.render(); });
await shot('a-sneaky');
r = await page.evaluate(() => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 2.5, z: 2.5, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); g.step(90); g.clearInput();
    const m = document.getElementById('message');
    return { msg: m.hidden ? '' : m.textContent, pos: g.state().pos, events: [...new Set(g.events.map((e) => e.type))] };
});
check('sneaky icicle: Ouch, back to start', /icicle/i.test(r.msg) && r.events.includes('spike') && Math.abs(r.pos.x - st0.pos.x) < 0.1, r);

// Icicle arch across the dead end west of path cell (14.5,46.5); path turns north there
await load();
r = await page.evaluate(() => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 18.5, z: 46.5, yaw: Math.PI / 2 }); g.setInput({ forward: true });
    let st; for (let i = 0; i < 300; i++) { st = g.step(1); if (st.pos.x < 14.6) break; }
    g.clearInput(); g.teleport({ x: 14.5, z: 46.5, yaw: 0 }); g.setInput({ forward: true });
    for (let i = 0; i < 120; i++) { st = g.step(1); if (st.pos.z < 41.5) break; }
    g.clearInput();
    return { pos: st.pos, events: [...new Set(g.events.map((e) => e.type))] };
});
check('walking the path past the icicle arch: no Ouch', r.pos.z < 41.5 && !r.events.includes('spike'), r);
for (const z of [45.45, 46.5, 47.55]) {
    await load();
    r = await page.evaluate(({ z }) => {
        const g = window.__game; g.clearEvents(); g.teleport({ x: 14.5, z, yaw: Math.PI / 2 }); g.setInput({ forward: true });
        let st; for (let i = 0; i < 120; i++) { st = g.step(1); if (g.events.some((e) => e.type === 'spike')) break; }
        g.clearInput(); const m = document.getElementById('message');
        return { pos: st.pos, hit: g.events.some((e) => e.type === 'spike'), msg: m.hidden ? '' : m.textContent };
    }, { z });
    check(`walking into the icicle arch at z=${z}: Ouch`, r.hit && /icicle/.test(r.msg), r);
}

// Snowmen: [0] top row x29-43 z1-3 heading east (M x43 z1-2, turns south, P 30.5,6.5);
// [1] x37-39 z5-19 heading north (M (38,5),(39,5), turns west, P 34.5,18.5)
const timing = await (async () => { await load(); return page.evaluate(() => {
    const g = window.__game; g.clearEvents(); const throws = [[], []]; const gone = [null, null];
    for (let i = 0; i < 60 * 9; i++) {
        const st = g.step(1);
        for (const e of g.events) if (e.type === 'throw') throws[st.snowmen.findIndex((s) => s.balls.length && s.balls.some((b) => b > s.length - 3))].push(st.t);
        g.clearEvents();
        st.snowmen.forEach((s, k) => { if (throws[k].length === 1 && s.balls.length === 0 && gone[k] === null) gone[k] = st.t; });
    }
    return { throws, gone, targets: g.state().snowmen.map((s) => s.target) };
}); })();
console.log('timing', JSON.stringify(timing));
for (const k of [0, 1]) {
    const t = timing.throws[k]; const gaps = t.slice(1).map((x, j) => +(x - t[j]).toFixed(2));
    check(`snowman ${k}: throws every 2.5 s (first at ${t[0]})`, gaps.length >= 2 && gaps.every((d) => Math.abs(d - 2.5) < 0.05), { t, gaps });
    check(`snowman ${k}: flight ~0.83 s`, Math.abs(timing.gone[k] - t[0] - 0.83) < 0.06, { flight: +(timing.gone[k] - t[0]).toFixed(2) });
}
check('snowmen out of step (independent timers)', Math.abs(timing.throws[0][0] - timing.throws[1][0]) > 1, {});
check('push targets: own P', timing.targets[0].x === 30.5 && timing.targets[0].z === 6.5 && timing.targets[1].x === 34.5 && timing.targets[1].z === 18.5, timing.targets);
for (const [x, z, yaw, expect] of [[38.5, 2.5, E, [34.5, 2.5]], [31.5, 1.5, E, [30.5, 6.5]], [42.5, 3.5, E, [38.5, 3.5]], [38.5, 10.5, N, [38.5, 14.5]], [37.5, 17.5, N, [34.5, 18.5]], [38.5, 6.5, N, [38.5, 10.5]]]) {
    await load();
    r = await page.evaluate(({ x, z, yaw }) => {
        const g = window.__game; g.clearEvents(); g.teleport({ x, z, yaw });
        let st; let hitT = null;
        for (let i = 0; i < 60 * 4; i++) { st = g.step(1); if (hitT === null && g.events.some((e) => e.type === 'snowball')) hitT = st.t; if (hitT !== null && !st.shoved) break; }
        return { hitT, pos: st.pos, events: [...new Set(g.events.map((e) => e.type))] };
    }, { x, z, yaw });
    check(`hit at (${x},${z}) pushes back to ${expect}`, r.hitT !== null && Math.abs(r.pos.x - expect[0]) < 0.6 && Math.abs(r.pos.z - expect[1]) < 0.6 && !r.events.includes('spike'), r);
}
for (const [x, z] of [[43.5, 3.55], [37.45, 5.5]]) {
    await load();
    r = await page.evaluate(({ x, z }) => {
        const g = window.__game; g.clearEvents(); g.teleport({ x, z, yaw: Math.PI });
        let st; for (let i = 0; i < 600; i++) st = g.step(1);
        return { pos: st.pos, events: [...new Set(g.events.map((e) => e.type))] };
    }, { x, z });
    check(`safe spot (${x},${z}): no hits in 10 s`, !r.events.includes('snowball') && r.events.includes('throw'), r);
}
await load();
r = await page.evaluate(() => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 40.5, z: 1.6, yaw: -Math.PI / 2 }); g.setInput({ forward: true });
    const a = g.step(30).pos; g.clearInput();
    g.teleport({ x: 38.6, z: 8.5, yaw: 0 }); g.setInput({ forward: true }); const b = g.step(30).pos; g.clearInput();
    return { a, b, events: [...new Set(g.events.map((e) => e.type))] };
});
check('both snowmen solid, no Ouch', r.a.x < 42.7 && r.b.z > 5.3 && !r.events.includes('spike'), r);
// Run each hallway right after a throw has gone
for (const [k, from, yaw, done, safe, turn, out] of [[1, [37.5, 18.5], N, 'p.z < 5.9', [37.45, 5.5], W, 'p.x < 35'], [0, [29.5, 3.5], E, 'p.x > 43.1', [43.5, 3.55], S, 'p.z > 5']]) {
    await load();
    r = await page.evaluate(({ k, from, yaw, done, safe, turn, out }) => {
        const fin = new Function('p', `return ${done}`); const away = new Function('p', `return ${out}`);
        const g = window.__game; g.clearEvents(); g.teleport({ x: from[0] - (yaw === 0 ? 3 : 0), z: from[1], yaw });
        let st; let thrown = false;
        for (let i = 0; i < 600; i++) { st = g.step(1); if (g.events.some((e) => e.type === 'throw') && st.snowmen[k].balls.length) thrown = true; if (thrown && st.snowmen[k].balls.length === 0) break; }
        g.clearEvents(); const t0 = st.t;
        g.teleport({ x: from[0], z: from[1], yaw }); g.setInput({ forward: true });
        let reached = null;
        for (let i = 0; i < 600; i++) { st = g.step(1); if (fin(st.pos)) { reached = +(st.t - t0).toFixed(2); break; } }
        const hits = g.events.filter((e) => e.type === 'snowball').length;
        g.clearInput(); g.teleport({ x: safe[0], z: safe[1] }); for (let i = 0; i < 120; i++) st = g.step(1);
        const hitsWaiting = g.events.filter((e) => e.type === 'snowball').length - hits;
        g.teleport({ yaw: turn }); g.setInput({ forward: true }); st = g.step(60); g.clearInput();
        return { reached, hits, hitsWaiting, pos: st.pos, ok: away(st.pos) };
    }, { k, from, yaw, done, safe, turn, out });
    check(`run snowman ${k}'s hallway: at most one hit, safe, round the corner`, r.reached !== null && r.hits <= 1 && r.hitsWaiting === 0 && r.ok, r);
}

// Screenshots
await load();
const view = async (name, x, z, yaw, steps = 1) => { await page.evaluate(({ x, z, yaw, steps }) => { const g = window.__game; g.teleport({ x, z, yaw }); g.step(steps); g.render(); }, { x, z, yaw, steps }); await shot(name); };
await view('b-start', st0.pos.x, st0.pos.z, E);
await view('c-hall1', 38.5, 18.5, N, 100);
await view('d-hall0', 30.5, 2.5, E, 100);
await view('e-sled', 42.5, 10.5, S);
await view('f-arch', 18.5, 46.5, W);

const finish = () => page.evaluate(() => {
    const g = window.__game; const d = g.state().door; g.teleport({ x: d.x - 2.5, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); g.step(40); g.clearInput(); g.render();
    return { title: document.getElementById('finish-title').textContent, buttons: [...document.querySelectorAll('#menu-finish .item, #menu-finish button')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim()) };
});
await load();
const fin = await finish();
await shot('g-door');
check('L79 door: More levels coming soon + Quit', fin.buttons.join('|') === 'Quit', fin);
await load(77);
const fin78 = await finish();
check('L78 door: Start Level 79', fin78.buttons.some((b) => /Start Level 79/.test(b)), fin78);
console.log('errors', errors);
console.log(results.every(Boolean) && !errors.length ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
