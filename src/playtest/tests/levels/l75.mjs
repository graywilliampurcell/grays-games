// Level 75 checks: node t75.mjs (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
const idx = 74;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const load = async (i = idx) => { for (let a = 0; a < 3; a++) { try { await page.goto(`${BASE}/?test=1&level=${i}`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; } catch (e) { if (a === 2) throw e; } } await page.waitForFunction(() => window.__game?.ready); }; const _unused = async (i) => { await page.goto(`${BASE}/?test=1&level=${i}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => window.__game?.ready); };
const shot = (name) => page.screenshot({ path: `${SP}l75-${name}.png` });
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info)); };

await load();
const st0 = await page.evaluate(() => window.__game.state());
st0.platforms.forEach((p, k) => console.log('platform', k, JSON.stringify(p)));
console.log('start', JSON.stringify(st0.start), 'spikeRows', st0.spikeRows.length);
check('two sleds', st0.platforms.length === 2, st0.platforms.length);
await shot('a-start');

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

for (const k of [0, 1]) {
    await load();
    const p = st0.platforms[k];
    const high = p.startAt > 0;
    const r = ride(k, side(p, high));
    const res = await r;
    const g = p.gap;
    const across = p.alongX ? (high ? res.pos.x < g.minX : res.pos.x >= g.maxX) : (high ? res.pos.z < g.minZ : res.pos.z >= g.maxZ);
    check(`sled ${k}: rides across from its start edge and lands`, !res.fell && across, res);
    check(`sled ${k}: ride about 1.5 s`, Math.abs(res.time - 1.5) < 0.1, res.time);
    const o = res.others[1 - k];
    check(`sled ${k}: the other sled didn't move`, o.at === o.startAt && o.phase === 'rest', o);
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

// Screenshots of each sled waiting and during a ride
for (const k of [0, 1]) {
    await load();
    const p = st0.platforms[k];
    const from = side(p, p.startAt > 0);
    await page.evaluate(({ from }) => { const g = window.__game; g.teleport(from); g.step(1); g.render(); }, { from });
    await shot(`b-sled${k}-approach`);
    await page.evaluate(({ k, from }) => { const g = window.__game; g.teleport(from); g.setInput({ forward: true }); for (let i = 0; i < 200 && g.state().platforms[k].phase !== 'zip'; i++) g.step(1); g.clearInput(); g.step(25); g.render(); }, { k, from });
    await shot(`c-sled${k}-zipping`);
}

// The sneaky icicle: in the dead end's last cell, entered from the south
await load();
await page.evaluate(() => { const g = window.__game; g.teleport({ x: 18.5, z: 31.5, yaw: 0 }); g.step(1); g.render(); });
await shot('d-icicle');
const hit = await page.evaluate(() => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 18.5, z: 31.5, yaw: 0 }); g.setInput({ forward: true }); g.step(90); g.clearInput();
    const m = document.getElementById('message');
    return { msg: m.hidden ? '' : m.textContent, pos: g.state().pos, events: g.events.map((e) => e.type) };
});
check('icicle: Ouch, back to start', /icicle/i.test(hit.msg) && hit.events.includes('spike'), hit);

// Door: More levels coming soon + Quit only
await load();
const fin = await page.evaluate(() => {
    const g = window.__game; g.teleport({ x: 46, z: 2.5, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); g.step(40); g.clearInput(); g.render();
    return { escaped: g.state().escaped, title: document.getElementById('finish-title').textContent, buttons: [...document.querySelectorAll('#menu-finish .item, #menu-finish button')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim()) };
});
await shot('e-door');
check('door: More levels coming soon + Quit', fin.title === 'More levels coming soon!' && fin.buttons.join('|') === 'Quit', fin);

// Level 74's door now offers Start Level 75
await load(73);
const fin74 = await page.evaluate(() => {
    const g = window.__game; const d = g.state().door; g.teleport({ x: d.x - 2, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); g.step(40); g.clearInput(); g.render();
    return { title: document.getElementById('finish-title').textContent, buttons: [...document.querySelectorAll('#menu-finish .item, #menu-finish button')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim()) };
});
check('Level 74 door: Start Level 75', fin74.buttons.some((b) => /Start Level 75/.test(b)), fin74);

// Music
const mus = await page.evaluate(() => window.__sound?.tuneName ?? null);
console.log('errors', errors);
console.log(results.every(Boolean) && !errors.length ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
