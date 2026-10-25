// Level 76 checks: node t76.mjs (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
const idx = 75;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const load = async (i = idx) => { for (let a = 0; a < 3; a++) { try { await page.goto(`${BASE}/?test=1&level=${i}`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; } catch (e) { if (a === 2) throw e; } } await page.waitForFunction(() => window.__game?.ready); };
const shot = (name) => page.screenshot({ path: `${SP}l76-${name}.png` });
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info)); };
const E = -Math.PI / 2, W = Math.PI / 2, N = 0, S = Math.PI;

await load();
const st0 = await page.evaluate(() => window.__game.state());
console.log('start', JSON.stringify(st0.pos), 'spike', JSON.stringify(st0.spike), 'spike2', JSON.stringify(st0.spike2), 'snowmen', JSON.stringify(st0.snowmen), 'platforms', JSON.stringify(st0.platforms));
check('one snowman, one sled, no thin ice, no big icicle', st0.snowmen.length === 1 && st0.platforms.length === 1 && st0.thinIce.length === 0 && st0.spikeRows.length === 0, {});

// 1. Sled: ride across from the west (start side), ~1.5 s
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
const r1 = await ride({ x: gap.minX - 2.5, z: (gap.minZ + gap.maxZ) / 2, yaw: E });
check('sled: rides east across the crack and lands, ~1.5 s', !r1.fell && r1.pos.x >= gap.maxX && Math.abs(r1.time - 1.5) < 0.1, r1);
await load();
const r1b = await ride({ x: gap.maxX + 2.5, z: (gap.minZ + gap.maxZ) / 2, yaw: W });
check('sled: from the far side it zips over, then carries you back', !r1b.fell && r1b.phases.includes('float') && r1b.pos.x < gap.minX, r1b);

// 2. Sneaky icicle in cell (2,11), entered heading east from (1,11)
await load();
await page.evaluate(() => { const g = window.__game; g.teleport({ x: 5.5, z: 46.5, yaw: -Math.PI / 2 }); g.step(1); g.render(); });
await shot('a-sneaky');
let r = await page.evaluate(() => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 5.5, z: 46.5, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); g.step(90); g.clearInput();
    const m = document.getElementById('message');
    return { msg: m.hidden ? '' : m.textContent, pos: g.state().pos, events: [...new Set(g.events.map((e) => e.type))] };
});
check('sneaky icicle: Ouch, back to start', /icicle/i.test(r.msg) && r.events.includes('spike') && Math.abs(r.pos.x - st0.pos.x) < 0.1, r);

// 3. Path icicle squeeze (spike2Radius 0.67) at (38.5,18.5), walking west
for (const [z, expectHit] of [[17.42, false], [19.58, false], [18.5, true], [17.7, true], [19.3, true]]) {
    await load();
    r = await page.evaluate(({ z }) => {
        const g = window.__game; g.clearEvents(); g.teleport({ x: 45.5, z, yaw: Math.PI / 2 }); g.setInput({ forward: true });
        let st; for (let i = 0; i < 240; i++) { st = g.step(1); if (st.pos.x < 32 || g.events.some((e) => e.type === 'spike')) break; }
        g.clearInput(); const m = document.getElementById('message');
        return { pos: st.pos, hit: g.events.some((e) => e.type === 'spike'), msg: m.hidden ? '' : m.textContent };
    }, { z });
    check(`walk past the path icicle at z=${z}: ${expectHit ? 'Ouch' : 'squeeze past'}`, r.hit === expectHit && (!expectHit || /icicle/.test(r.msg)), r);
}

// 4. Snowman: throws every 2.5 s, hits push one cell back, safe spot beside him
await load();
const timing = await page.evaluate(() => {
    const g = window.__game; g.clearEvents(); const throws = []; let gone = null;
    for (let i = 0; i < 60 * 9; i++) { const st = g.step(1); if (g.events.some((e) => e.type === 'throw')) { throws.push(st.t); g.clearEvents(); } if (throws.length === 1 && st.snowmen[0].balls.length === 0 && gone === null) gone = st.t; }
    return { throws, gone };
});
const gaps = timing.throws.slice(1).map((t, k) => +(t - timing.throws[k]).toFixed(2));
check('throws every 2.5 s', Math.abs(timing.throws[0] - 2.5) < 0.05 && gaps.every((d) => Math.abs(d - 2.5) < 0.05), { throws: timing.throws, flight: timing.gone - timing.throws[0] });
for (const [x, zz, expect] of [[2.5, 6.5, [2.5, 10.5]], [1.5, 9.5, [1.5, 14.5]], [2.5, 13.5, [6.5, 14.5]]]) {
    await load();
    r = await page.evaluate(({ x, zz }) => {
        const g = window.__game; g.clearEvents(); g.teleport({ x, z: zz, yaw: 0 });
        let st; let hitT = null;
        for (let i = 0; i < 60 * 4; i++) { st = g.step(1); if (hitT === null && g.events.some((e) => e.type === 'snowball')) hitT = st.t; if (hitT !== null && !st.shoved) break; }
        return { hitT, pos: st.pos, events: [...new Set(g.events.map((e) => e.type))] };
    }, { x, zz });
    check(`snowball hit at (${x},${zz}) pushes to ${expect}`, r.hitT !== null && Math.abs(r.pos.x - expect[0]) < 0.1 && Math.abs(r.pos.z - expect[1]) < 0.1 && !r.events.includes('spike'), r);
}
await load();
r = await page.evaluate(() => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 3.55, z: 1.5, yaw: 0 });
    let st; for (let i = 0; i < 60 * 10; i++) st = g.step(1);
    return { pos: st.pos, events: [...new Set(g.events.map((e) => e.type))] };
});
check('safe spot beside the snowman: no hits in 10 s', !r.events.includes('snowball') && r.events.includes('throw'), r);
await load();
r = await page.evaluate(() => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 2.0, z: 4.5, yaw: 0 }); g.setInput({ forward: true });
    const st = g.step(40); g.clearInput();
    return { pos: st.pos, events: [...new Set(g.events.map((e) => e.type))] };
});
check('snowman is solid (stops you, no Ouch)', r.pos.z > 2.3 && !r.events.includes('spike'), r);
await load();
await page.evaluate(() => { const g = window.__game; g.teleport({ x: 2.5, z: 14.0, yaw: 0 }); g.step(150); g.render(); });
await shot('b-snowman');
await load();
await page.evaluate(() => { const g = window.__game; g.teleport({ x: 45.5, z: 18.5, yaw: Math.PI / 2 }); g.step(1); g.render(); });
await shot('c-path-icicle');
await load();
await page.evaluate(({ gap }) => { const g = window.__game; g.teleport({ x: gap.minX - 3, z: 46.5, yaw: -Math.PI / 2 }); g.step(1); g.render(); }, { gap });
await shot('d-sled');

// 5. Doors
await load();
const fin = await page.evaluate(() => {
    const g = window.__game; const d = g.state().door; g.teleport({ x: d.x - 2.5, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); g.step(40); g.clearInput(); g.render();
    return { escaped: g.state().escaped, title: document.getElementById('finish-title').textContent, buttons: [...document.querySelectorAll('#menu-finish .item, #menu-finish button')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim()) };
});
check('L76 door: More levels coming soon + Quit', fin.title === 'More levels coming soon!' && fin.buttons.join('|') === 'Quit', fin);
await load(74);
const fin75 = await page.evaluate(() => {
    const g = window.__game; const d = g.state().door; g.teleport({ x: d.x - 2.5, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); g.step(40); g.clearInput(); g.render();
    return { title: document.getElementById('finish-title').textContent, buttons: [...document.querySelectorAll('#menu-finish .item, #menu-finish button')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim()) };
});
check('L75 door: Start Level 76', fin75.buttons.some((b) => /Level 76/.test(b)), fin75);

console.log('errors', errors);
console.log(results.every(Boolean) && !errors.length ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
