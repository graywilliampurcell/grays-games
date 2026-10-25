// Level 98 checks: node t98.mjs (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
let browser = null; const launch = () => chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
let page = null;
const errors = [];
const load = async (n = 98, query = 'test=1&') => { if (browser) await browser.close().catch(() => {}); browser = await launch(); page = await browser.newPage({ viewport: { width: 1024, height: 640 } }); page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); }); for (let tr = 0; tr < 3; tr++) { try { await page.goto(`${BASE}/?${query}level=${n - 1}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); if (query) await page.waitForFunction(() => window.__game?.ready); return; } catch (e) { console.log('retry load', String(e).slice(0, 80)); } } };
const shot = (name) => page.screenshot({ path: `${SP}l98-${name}.png` });
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info)); };
const E = -Math.PI / 2, W = Math.PI / 2, N = 0, S = Math.PI;

await load();
const st0 = await page.evaluate(() => window.__game.state());
console.log(st0.level.name, 'start', JSON.stringify(st0.start ?? st0.pos), 'spike', JSON.stringify(st0.spike), 'spike2', JSON.stringify(st0.spike2), 'snowmen', JSON.stringify(st0.snowmen?.map((s) => ({ ...s, balls: undefined }))), 'platforms', JSON.stringify(st0.platforms), 'thin', JSON.stringify(st0.thinIce), 'music', st0.music);
check('L98: one sled, one snowman, one thin ice, sneaky + path icicle, no big icicle', st0.level.name === 'Level 98' && st0.platforms.length === 1 && st0.snowmen.length === 1 && st0.thinIce.length === 1 && !!st0.spike && !!st0.spike2 && st0.spikeRows.length === 0, {});

// Sled: path crosses heading west
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
    return { pos: st.pos, fell, phases, time: landT - departT, events: [...new Set(g.events.map((e) => e.type))] };
}, { from });
const gap = st0.platforms[0].gap;
const r1 = await ride({ x: gap.maxX + 2.5, z: (gap.minZ + gap.maxZ) / 2, yaw: W });
check('sled: rides west across the crack and lands, ~1.5 s', !r1.fell && r1.pos.x <= gap.minX && Math.abs(r1.time - 1.5) < 0.15, r1);
await load();
const r1b = await ride({ x: gap.minX - 2.5, z: (gap.minZ + gap.maxZ) / 2, yaw: E });
check('sled: from the other side it comes over, then carries you back', !r1b.fell && r1b.pos.x >= gap.maxX, r1b);
await load();
const fallR = await page.evaluate(({ gap }) => { const g = window.__game; g.clearEvents(); g.teleport({ x: gap.maxX + 0.6, z: gap.minZ + 0.6, yaw: Math.PI / 2 }); g.setInput({ forward: true }); g.step(200); g.clearInput(); return [...new Set(g.events.map((e) => e.type))]; }, { gap });
console.log('info: walking into the crack beside the sled', JSON.stringify(fallR));

// Sneaky icicle: from the start cell south, then east to (2,13)
await load();
let r = await page.evaluate(() => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 2.5, z: 54.5, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); g.step(120); g.clearInput();
    const m = document.getElementById('message');
    return { msg: m.hidden ? '' : m.textContent, pos: g.state().pos, events: [...new Set(g.events.map((e) => e.type))] };
});
check('sneaky icicle round the corner: Ouch, back to start', /icicle/i.test(r.msg) && r.events.includes('spike'), r);

// Path icicle Z heading east, spike2Radius 0.7
const sp = st0.spike2;
const squeeze = async (z) => { await load(); return page.evaluate(({ z, sp }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: sp.x - 5, z, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); let st;
    for (let i = 0; i < 150; i++) { st = g.step(1); if (st.pos.x > sp.x + 3) break; }
    g.clearInput(); const m = document.getElementById('message');
    return { pos: st.pos, hit: g.events.some((e) => e.type === 'spike'), msg: m.hidden ? '' : m.textContent };
}, { z, sp }); };
for (const d of [1.0, 1.05]) {
    const a = await squeeze(sp.z - d); check(`squeeze past north side (${d})`, !a.hit && a.pos.x > sp.x + 2, a);
    const b = await squeeze(sp.z + d); check(`squeeze past south side (${d})`, !b.hit && b.pos.x > sp.x + 2, b);
}
const qc = await squeeze(sp.z); check('middle: Ouch', qc.hit && /icicle/i.test(qc.msg), qc);
const qd = await squeeze(sp.z - 0.8); check('a bit off the side still hits', qd.hit, qd);

// Thin ice
const ti = st0.thinIce[0];
console.log('thin ice', JSON.stringify(ti));
const tx = ti.x ?? (ti.minX + ti.maxX) / 2, tz = ti.z ?? (ti.minZ + ti.maxZ) / 2;
await load();
r = await page.evaluate(({ tx, tz }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: tx, z: tz, yaw: -Math.PI / 2 });
    let st; let broke = null;
    for (let i = 0; i < 240; i++) { st = g.step(1); if (broke === null && g.events.some((e) => e.type === 'thinIce')) { broke = st.t; break; } }
    const m = document.getElementById('message');
    return { broke, pos: st.pos, msg: m.hidden ? '' : m.textContent };
}, { tx, tz });
check('standing on the thin ice breaks it at ~2 s, Ouch', r.broke !== null && Math.abs(r.broke - 2.0) < 0.05 && /thin ice/.test(r.msg), r);
await load();
r = await page.evaluate(({ tx, tz }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: tx - 5, z: tz, yaw: -Math.PI / 2 }); g.setInput({ forward: true });
    let st; let maxTime = 0;
    for (let i = 0; i < 240; i++) { st = g.step(1); maxTime = Math.max(maxTime, st.thinIce[0].time); if (st.pos.x > tx + 5) break; }
    g.clearInput();
    return { maxTime, pos: st.pos, events: [...new Set(g.events.map((e) => e.type))] };
}, { tx, tz });
check('walking across the thin ice: no break', r.maxTime > 0 && r.maxTime < 1 && !r.events.includes('thinIce'), r);

// Snowman: hallway x53-55 z5-19 heading south, he is at the south end
await load();
const timing = await page.evaluate(() => {
    const g = window.__game; g.clearEvents(); const throws = [];
    for (let i = 0; i < 60 * 9; i++) { const st = g.step(1); if (g.events.some((e) => e.type === 'throw')) { throws.push(st.t); g.clearEvents(); } }
    return { throws };
});
check('snowman throws every 2.5 s', timing.throws.length >= 3 && timing.throws.slice(1).every((t, k) => Math.abs(t - timing.throws[k] - 2.5) < 0.05), timing);
for (const z of [6.5, 10.5, 14.5]) {
    await load();
    r = await page.evaluate(({ z }) => {
        const g = window.__game; g.clearEvents(); g.teleport({ x: 54.5, z, yaw: Math.PI });
        let st; let hitT = null;
        for (let i = 0; i < 60 * 4; i++) { st = g.step(1); if (hitT === null && g.events.some((e) => e.type === 'snowball')) hitT = st.t; if (hitT !== null && !st.shoved) break; }
        return { hitT, pos: st.pos, events: [...new Set(g.events.map((e) => e.type))] };
    }, { z });
    check(`snowball hit at z=${z} pushes you back north`, r.hitT !== null && r.pos.z < z && !r.events.includes('spike'), r);
}
await load();
r = await page.evaluate(() => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 53.45, z: 18.5, yaw: Math.PI });
    let st; for (let i = 0; i < 60 * 10; i++) st = g.step(1);
    return { pos: st.pos, events: [...new Set(g.events.map((e) => e.type))] };
});
check('safe spot beside the snowman: no hits', !r.events.includes('snowball') && r.events.includes('throw'), r);

const view = async (name, x, z, yaw, steps = 2) => { await load(); await page.evaluate(({ x, z, yaw, steps }) => { const g = window.__game; g.teleport({ x, z, yaw }); g.step(steps); g.render(); }, { x, z, yaw, steps }); await shot(name); };
await view('start', st0.pos.x, st0.pos.z, E);
await view('sled', gap.maxX + 3, (gap.minZ + gap.maxZ) / 2, W);
await view('icicle', sp.x - 6, sp.z, E);
await view('sneaky', 2.5, 54.5, E);
await view('snowman', 54.5, 3.5, S, 160);
await view('thin', tx - 6, tz, E);

const finish = () => page.evaluate(() => {
    const g = window.__game; const d = g.state().door; g.teleport({ x: d.x - 2.5, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); g.step(40); g.clearInput(); g.render();
    return { title: document.getElementById('finish-title').textContent, buttons: [...document.querySelectorAll('#menu-finish .item, #menu-finish button')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim()) };
});
await load();
const f98 = await finish();
check('L98 door: More levels coming soon! + Quit', f98.title === 'More levels coming soon!' && f98.buttons.join('|') === 'Quit', f98);
await load(97);
const f97 = await finish();
check('L97 door leads on', f97.buttons.length === 2 && f97.buttons[1] === 'Quit', f97);
await page.evaluate(() => document.querySelector('#menu-finish [data-act=next], #menu-finish .item')?.click());
await page.waitForTimeout(500);
const after = await page.evaluate(() => window.__game.state().level.name);
check('next level from 97 is Level 98', after === 'Level 98', { after });

if (browser) await browser.close();
browser = await launch(); page = await browser.newPage({ viewport: { width: 1024, height: 640 } }); page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(BASE + '/');
await page.evaluate(() => { localStorage.setItem('mazle.furthest', '97'); localStorage.setItem('mazle.news', JSON.stringify({ told: [...Array(98).keys()], beaten: 96, fresh: [] })); });
await page.reload(); await page.waitForTimeout(3000);
await page.evaluate(() => document.querySelector('[data-act=pick-level]')?.click());
await page.waitForTimeout(500);
await page.evaluate(() => document.querySelectorAll('#world-grid .item')[9]?.click());
await page.waitForTimeout(500);
const lv = await page.evaluate(() => [...document.querySelectorAll('#level-grid .item')].map((b) => ({ cls: b.className, text: b.textContent })));
await shot('levels');
check('Everything World levels 91-98, 98 in the ice look', lv.length === 8 && /look-ice/.test(lv[7].cls) && lv[7].text === '98', lv);
console.log('errors', errors);
console.log(results.every(Boolean) && !errors.length ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
