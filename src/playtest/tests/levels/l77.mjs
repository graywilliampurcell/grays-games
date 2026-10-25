// Level 77 checks: node t77.mjs (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
const idx = 76;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const load = async (i = idx) => { for (let a = 0; a < 3; a++) { try { await page.goto(`${BASE}/?test=1&level=${i}`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; } catch (e) { if (a === 2) throw e; } } await page.waitForFunction(() => window.__game?.ready); }; const _unused = async (i) => { await page.goto(`${BASE}/?test=1&level=${i}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => window.__game?.ready); };
const shot = (name) => page.screenshot({ path: `${SP}l77-${name}.png` });
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info)); };

await load();
const st0 = await page.evaluate(() => window.__game.state());
st0.platforms.forEach((p, k) => console.log('platform', k, JSON.stringify(p)));
console.log('start', JSON.stringify(st0.pos), 'spikeRows', JSON.stringify(st0.spikeRows), 'thinIce', JSON.stringify(st0.thinIce));
let r;

// Where to stand on one side of a platform, and which way to face to cross
const side = (p, high) => {
    const g = p.gap; const midX = (g.minX + g.maxX) / 2; const midZ = (g.minZ + g.maxZ) / 2;
    if (p.alongX) return high ? { x: g.maxX + 2.5, z: midZ, yaw: Math.PI / 2 } : { x: g.minX - 2.5, z: midZ, yaw: -Math.PI / 2 };
    return high ? { x: midX, z: g.maxZ + 2.5, yaw: 0 } : { x: midX, z: g.minZ - 2.5, yaw: Math.PI };
};
const ride = (k, from) => page.evaluate(({ k, from }) => {
    const g = window.__game; g.clearEvents(); g.teleport(from); g.setInput({ forward: true });
    let st; let departT = null; let landT = null; let fell = false; const phases = [];
    for (let i = 0; i < 2000; i++) {
        st = g.step(1); const p = st.platforms[k];
        if (phases[phases.length - 1] !== p.phase) phases.push(p.phase);
        if (p.phase === 'zip' || p.phase === 'float') g.clearInput();
        if (p.phase === 'rest' && phases.includes('float') && departT === null) g.setInput({ forward: true });
        if (g.events.some((e) => e.type === 'fall' || e.type === 'spike')) fell = true;
        if (departT === null && g.events.some((e) => e.what === 'depart')) departT = st.t;
        if (landT === null && g.events.some((e) => e.what === 'land')) landT = st.t;
        if (landT !== null && !st.shoved) break;
    }
    return { pos: st.pos, fell, phases, time: landT - departT, others: st.platforms.map((p) => ({ at: p.at, phase: p.phase, startAt: p.startAt })) };
}, { k, from });

for (const k of [0]) {
    await load();
    const p = st0.platforms[k];
    const high = p.startAt > 0;
    const r = ride(k, side(p, high));
    const res = await r;
    const g = p.gap;
    const across = p.alongX ? (high ? res.pos.x < g.minX : res.pos.x >= g.maxX) : (high ? res.pos.z < g.minZ : res.pos.z >= g.maxZ);
    check(`sled ${k}: rides across from its start edge and lands`, !res.fell && across, res);
    check(`sled ${k}: ride about 1.5 s`, Math.abs(res.time - 1.5) < 0.1, res.time);
    
    // come back from the far side: it's there now, ride back
    const back = await ride(k, side(p, !high));
    const backAcross = p.alongX ? (!high ? back.pos.x < g.minX : back.pos.x >= g.maxX) : (!high ? back.pos.z < g.minZ : back.pos.z >= g.maxZ);
    check(`sled ${k}: rides back the other way`, !back.fell && backAcross, back);
    // from the far side while it's on the start side: it floats over
    await load();
    const fl = await ride(k, side(p, !high));
    check(`sled ${k}: zips over to you, then carries you`, !fl.fell && fl.phases.includes('float') && fl.phases.includes('zip'), fl);
    // reset: ride, then fall into the crack beside it -> both back at start edges
    await load();
    await ride(k, side(p, high));
    const reset = await page.evaluate(({ p }) => {
        const g = window.__game; g.clearEvents();
        const mid = { x: (p.gap.minX + p.gap.maxX) / 2, z: (p.gap.minZ + p.gap.maxZ) / 2 };
        g.teleport(mid); g.step(2);
        const m = document.getElementById('message');
        return { msg: m.hidden ? '' : m.textContent, events: g.events.map((e) => e.type), plats: g.state().platforms.map((q) => ({ at: q.at, startAt: q.startAt })) };
    }, { p });
    check(`crack ${k}: Ouch, back to start, sleds reset`, /fell in the crack/.test(reset.msg) && reset.plats.every((q) => q.at === q.startAt), reset);
}
// Thin ice (x37-39 z45-47, heading east)
const stand = async (x, z) => page.evaluate(({ x, z }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x, z, yaw: -Math.PI / 2 });
    let st; let broke = null; let maxTime = 0;
    for (let i = 0; i < 240; i++) { st = g.step(1); maxTime = Math.max(maxTime, st.thinIce[0].time); if (g.events.some((e) => e.type === 'thinIce')) { broke = st.t; break; } }
    const m = document.getElementById('message');
    return { broke, maxTime, pos: st.pos, time: st.thinIce[0].time, msg: m.hidden ? '' : m.textContent };
}, { x, z });
await load();
r = await stand(38.5, 46.5);
check('thin ice breaks at ~2.0 s, Ouch, back to start, whole again', r.broke !== null && Math.abs(r.broke - 2.0) < 0.05 && r.msg === 'Ouch! The thin ice broke. Back to the start.' && Math.abs(r.pos.x - st0.pos.x) < 0.1 && Math.abs(r.pos.z - st0.pos.z) < 0.1 && r.time === 0, r);
await load();
r = await stand(40.25, 46.5);
check('partly on it breaks', r.broke !== null, r);
await load();
r = await stand(40.5, 46.5);
check('next to it: never breaks', r.broke === null && r.maxTime === 0, r);
await load();
r = await page.evaluate(() => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 33.5, z: 46.5, yaw: -Math.PI / 2 }); g.setInput({ forward: true });
    let st; let maxTime = 0;
    for (let i = 0; i < 240; i++) { st = g.step(1); maxTime = Math.max(maxTime, st.thinIce[0].time); if (st.pos.x > 43.5) break; }
    g.clearInput();
    return { maxTime, pos: st.pos, events: [...new Set(g.events.map((e) => e.type))] };
});
check('walking across: well under 2 s, no break', r.maxTime > 0 && r.maxTime < 1 && !r.events.includes('thinIce') && r.pos.x > 43.5, r);


// Big icicle (icicle arch) across the dead end west of path cell (22.5,42.5)
await load();
r = await page.evaluate(() => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 26.5, z: 42.5, yaw: Math.PI / 2 }); g.setInput({ forward: true });
    let st; for (let i = 0; i < 40; i++) st = g.step(1);
    g.clearInput(); g.teleport({ x: 22.5, z: 42.5, yaw: 0 }); g.setInput({ forward: true });
    for (let i = 0; i < 120; i++) { st = g.step(1); if (st.pos.z < 34.5) break; }
    g.clearInput();
    return { pos: st.pos, events: [...new Set(g.events.map((e) => e.type))] };
});
check('walking the path past the icicle arch: no Ouch', r.pos.z < 34.5 && !r.events.includes('spike'), r);
for (const z of [41.45, 42.5, 43.55]) {
    await load();
    r = await page.evaluate(({ z }) => {
        const g = window.__game; g.clearEvents(); g.teleport({ x: 22.5, z, yaw: Math.PI / 2 }); g.setInput({ forward: true });
        let st; for (let i = 0; i < 120; i++) { st = g.step(1); if (g.events.some((e) => e.type === 'spike')) break; }
        g.clearInput(); const m = document.getElementById('message');
        return { pos: st.pos, hit: g.events.some((e) => e.type === 'spike'), msg: m.hidden ? '' : m.textContent };
    }, { z });
    check(`walking into the icicle arch at z=${z}: Ouch`, r.hit && /icicle/.test(r.msg), r);
}

// Counts
check('one sled, one thin ice, no snowman, no path/sneaky icicle, one arch', st0.platforms.length === 1 && st0.thinIce.length === 1 && st0.snowmen.length === 0 && !st0.spike && st0.spikeRows.length === 1, { p: st0.platforms.length, t: st0.thinIce.length, s: st0.snowmen.length, spike: st0.spike, rows: st0.spikeRows.length });

// Screenshots
await load();
const view = async (name, x, z, yaw, steps = 1) => { await page.evaluate(({ x, z, yaw, steps }) => { const g = window.__game; g.teleport({ x, z, yaw }); g.step(steps); g.render(); }, { x, z, yaw, steps }); await shot(name); };
await view('a-start', st0.pos.x, st0.pos.z, -Math.PI / 2);
await view('b-arch-from-path', 26.5, 42.5, Math.PI / 2);
await view('c-arch-close', 21.0, 42.5, Math.PI / 2);
await view('d-thin-ice', 33.5, 46.5, -Math.PI / 2);
await view('e-crack', 9.5, 46.5, -Math.PI / 2);

// Doors
const finish = () => page.evaluate(() => {
    const g = window.__game; const d = g.state().door; g.teleport({ x: d.x - 2.5, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); g.step(40); g.clearInput(); g.render();
    return { title: document.getElementById('finish-title').textContent, buttons: [...document.querySelectorAll('#menu-finish .item, #menu-finish button')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim()) };
});
await load();
const fin = await finish();
await shot('f-door');
check('L77 door: More levels coming soon + Quit', fin.title === 'More levels coming soon!' && fin.buttons.join('|') === 'Quit', fin);
await load(75);
const fin76 = await finish();
check('L76 door: Start Level 77', fin76.buttons.some((b) => /Start Level 77/.test(b)), fin76);

console.log('errors', errors);
console.log(results.every(Boolean) && !errors.length ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
