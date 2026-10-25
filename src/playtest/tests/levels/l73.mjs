// Level 73 checks: node t73.mjs (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
const idx = 72;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const load = async (level = idx) => { await page.goto(`${BASE}/?test=1&level=${level}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => window.__game?.ready); };
const shot = (name) => page.screenshot({ path: `${SP}l73-${name}.png` });
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info)); };
const E = -Math.PI / 2;

await load();
const st0 = await page.evaluate(() => window.__game.state());
console.log('thinIce', JSON.stringify(st0.thinIce), 'spike', JSON.stringify(st0.spike), 'start', JSON.stringify(st0.pos));
check('one thin ice, path icicle, no sled/snowman', st0.thinIce.length === 1 && !!st0.spike && st0.platforms.length === 0 && st0.snowmen.length === 0, {});

// 1. Stand still on the thin ice: breaks at ~2.0 s
const stand = async (x, z, frames) => page.evaluate(({ x, z, frames }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x, z, yaw: -Math.PI / 2 });
    let st; let broke = null; let maxTime = 0;
    for (let i = 0; i < frames; i++) { st = g.step(1); maxTime = Math.max(maxTime, st.thinIce[0].time); if (broke === null && g.events.some((e) => e.type === 'thinIce')) { broke = st.t; break; } }
    const m = document.getElementById('message');
    return { broke, maxTime, pos: st.pos, time: st.thinIce[0].time, msg: m.hidden ? '' : m.textContent, events: [...new Set(g.events.map((e) => e.type))] };
}, { x, z, frames });
await load();
let r = await stand(38.5, 2.5, 60 * 4);
check('standing on thin ice breaks it at ~2.0 s, Ouch, back to start, whole again', r.broke !== null && Math.abs(r.broke - 2.0) < 0.05 && r.msg === 'Ouch! The thin ice broke. Back to the start.' && Math.abs(r.pos.x - st0.pos.x) < 0.1 && Math.abs(r.pos.z - st0.pos.z) < 0.1 && r.time === 0, r);
await load();
r = await stand(36.75, 2.5, 60 * 4); // centre 0.25 outside the cell: part of you is on it
check('partly on it also breaks', r.broke !== null, r);
await load();
r = await stand(36.5, 2.5, 60 * 4); // edge exactly radius away: just off
check('right next to it (not on it): never breaks', r.broke === null && r.maxTime === 0, r);

// 2. Stand 1.5 s, step off, back on 1.5 s: count starts again, no break
await load();
r = await page.evaluate(() => {
    const g = window.__game; g.clearEvents();
    g.teleport({ x: 38.5, z: 2.5 }); let st = g.step(90); const t1 = st.thinIce[0].time;
    g.teleport({ x: 34.5, z: 2.5 }); st = g.step(5); const off = st.thinIce[0].time;
    g.teleport({ x: 38.5, z: 2.5 }); st = g.step(90);
    return { t1, off, t2: st.thinIce[0].time, events: [...new Set(g.events.map((e) => e.type))] };
});
check('stepping off starts the count again', Math.abs(r.t1 - 1.5) < 0.05 && r.off === 0 && !r.events.includes('thinIce'), r);

// 3. Walking across at normal speed
await load();
r = await page.evaluate(() => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 33.5, z: 2.5, yaw: -Math.PI / 2 }); g.setInput({ forward: true });
    let st; let on = 0; let maxTime = 0;
    for (let i = 0; i < 240; i++) { st = g.step(1); if (st.thinIce[0].time > 0) on++; maxTime = Math.max(maxTime, st.thinIce[0].time); if (st.pos.x > 43) break; }
    g.clearInput();
    return { maxTime, pos: st.pos, events: [...new Set(g.events.map((e) => e.type))] };
});
check('walking across takes well under 2 s, no break', r.maxTime > 0 && r.maxTime < 1 && !r.events.includes('thinIce') && r.pos.x > 43, r);

// 4. Path icicle squeeze (spikeRadius 0.64): pass each side, hit in the middle
for (const [z, expectHit] of [[1.45, false], [3.55, false], [2.5, true], [1.75, true]]) {
    await load();
    r = await page.evaluate(({ z }) => {
        const g = window.__game; g.clearEvents(); g.teleport({ x: 5.5, z, yaw: -Math.PI / 2 }); g.setInput({ forward: true });
        let st; for (let i = 0; i < 240; i++) { st = g.step(1); if (st.pos.x > 15 || g.events.some((e) => e.type === 'spike')) break; }
        g.clearInput(); const m = document.getElementById('message');
        return { pos: st.pos, hit: g.events.some((e) => e.type === 'spike'), msg: m.hidden ? '' : m.textContent };
    }, { z });
    check(`walk past the icicle at z=${z}: ${expectHit ? 'Ouch' : 'squeeze past'}`, r.hit === expectHit && (!expectHit || /icicle/.test(r.msg)), r);
}

// Screenshots
await load();
await page.evaluate(() => { const g = window.__game; g.teleport({ x: 30.5, z: 2.5, yaw: -Math.PI / 2 }); g.step(1); g.render(); });
await shot('a-thin-ice-approach');
await page.evaluate(() => { const g = window.__game; g.teleport({ x: 35.6, z: 2.5, yaw: -Math.PI / 2 }); g.teleport({ x: 37.0, z: 2.5, yaw: -Math.PI / 2 }); g.step(100); g.teleport({ x: 35.0, z: 2.5, yaw: -Math.PI / 2 }); g.render(); });
await shot('b-thin-ice-about-to-break');
await page.evaluate(() => { const g = window.__game; g.teleport({ x: 3.5, z: 2.5, yaw: -Math.PI / 2 }); g.step(1); g.render(); });
await shot('c-icicle-approach');
await page.evaluate(() => { const g = window.__game; g.teleport({ x: 8.5, z: 1.5, yaw: -Math.PI / 2 }); g.step(1); g.render(); });
await shot('d-icicle-squeeze');

// 5. Doors
await load();
const fin = await page.evaluate(() => {
    const g = window.__game; const d = g.state().door; g.teleport({ x: d.x - 2.5, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); g.step(40); g.clearInput(); g.render();
    return { escaped: g.state().escaped, title: document.getElementById('finish-title').textContent, buttons: [...document.querySelectorAll('#menu-finish .item, #menu-finish button')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim()) };
});
check('L73 door: More levels coming soon + Quit', fin.title === 'More levels coming soon!' && fin.buttons.join('|') === 'Quit', fin);
await load(71);
const fin72 = await page.evaluate(() => {
    const g = window.__game; const d = g.state().door; g.teleport({ x: d.x - 2.5, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); g.step(40); g.clearInput(); g.render();
    return { title: document.getElementById('finish-title').textContent, buttons: [...document.querySelectorAll('#menu-finish .item, #menu-finish button')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim()) };
});
check('L72 door: Start Level 73', fin72.buttons.some((b) => /Level 73/.test(b)), fin72);

console.log('errors', errors);
console.log(results.every(Boolean) && !errors.length ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
