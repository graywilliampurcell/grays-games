// Level 129 checks (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
import fs from 'fs';
const SP = SHOTS;
fs.mkdirSync(SP, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1024, height: 640 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(BASE + '/?test=1&level=128', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
await page.keyboard.press('Shift');
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 900)); };
const shot = (name) => page.screenshot({ path: `${SP}l129-${name}.png`, timeout: 180000 });
let st = await page.evaluate(() => window.__game.restore());
check('Level 129 loads: two waves, two cannon rides, the sneaky spike, nothing else',
    st.level.name === 'Level 129' && st.vents.length === 2 && st.vents.every((v) => v.wave) && st.platforms.length === 2 && st.platforms.every((p) => !p.plank) && st.cannons.length === 4 && !!st.spike && !st.spike2 && st.spikeRows.length === 0 && st.tails.length === 0 && st.geysers.length === 0 && st.belts.length === 0 && !st.rocking,
    { v: st.vents, c: st.cannons, spike: st.spike });
check('tune piratetwocannons', (await page.evaluate(() => window.__sound?.tuneName)) === 'piratetwocannons', {});
// Both cycles: calm 3, warning 1, splash 0.5, independent (out of step)
let r = await page.evaluate(() => {
    const g = window.__game;
    g.restore();
    const ch = [[], []];
    let last = g.state().vents.map((v) => v.phase);
    for (let k = 0; k < 900; k++) {
        const s = g.step(1);
        s.vents.forEach((v, i) => { if (v.phase !== last[i]) { ch[i].push([v.phase, g.time()]); last[i] = v.phase; } });
    }
    return ch;
});
for (const i of [0, 1]) {
    const c = r[i];
    const dur = (a) => { const j = c.findIndex((x, k) => k > 0 && x[0] === a); return j > 0 && c[j + 1] ? c[j + 1][1] - c[j][1] : null; };
    check(`wave ${i + 1}: calm ~3 s, warning ~1 s, splash ~0.5 s`, Math.abs(dur('quiet') - 3) < 0.05 && Math.abs(dur('warning') - 1) < 0.05 && Math.abs(dur('puff') - 0.5) < 0.05, { calm: dur('quiet'), warning: dur('warning'), splash: dur('puff') });
}
const firstPuff = r.map((c) => c.find((x) => x[0] === 'puff')?.[1]);
check('the two waves splash at different times', Math.abs(firstPuff[0] - firstPuff[1]) > 1, firstPuff);
// Each wave: standing in it at the splash washes you one cell back to its own Q, no Ouch
for (const i of [0, 1]) {
    const v = st.vents[i];
    const cx = (v.minX + v.maxX) / 2, cz = (v.minZ + v.maxZ) / 2;
    r = await page.evaluate(([i, cx, cz, v]) => {
        const g = window.__game;
        g.restore();
        for (let k = 0; k < 900; k++) { const s = g.step(1); const w = s.vents[i]; if (w.phase === 'warning' && w.timer <= 0.4) break; }
        g.teleport({ x: cx + 0.3, z: cz - 0.3 });
        g.clearEvents();
        let s;
        for (let k = 0; k < 120; k++) s = g.step(1);
        return { pos: s.pos, target: v.target, ev: g.events.map((e) => e.type === 'sound' ? 'sound:' + e.name : e.type), msg: g.text() };
    }, [i, cx, cz, v]);
    check(`wave ${i + 1}: washed one cell back to its Q, not an Ouch`, r.ev.includes('wave') && r.ev.includes('sound:wash') && Math.hypot(r.pos.x - r.target.x, r.pos.z - r.target.z) < 0.3 && !r.ev.includes('spike') && !r.ev.includes('waterFall') && !JSON.stringify(r.msg).includes('Ouch'), r);
    const d = Math.hypot(v.target.x - cx, v.target.z - cz);
    check(`wave ${i + 1}: Q one cell back`, Math.abs(d - 4) < 0.6, { d });
    // Crossing while calm
    r = await page.evaluate(([i, cx, cz, v]) => {
        const g = window.__game;
        g.restore();
        for (let k = 0; k < 900; k++) { const s = g.step(1); if (s.vents[i].phase === 'puff') break; }
        for (let k = 0; k < 900; k++) { const s = g.step(1); if (s.vents[i].phase === 'quiet') break; }
        const dx = cx - v.target.x, dz = cz - v.target.z;
        g.teleport({ x: v.target.x, z: v.target.z, yaw: Math.atan2(-dx, -dz) });
        g.clearEvents();
        g.setInput({ forward: true });
        let s, t0 = null, t1 = null;
        const inCell = (p) => p.x + 0.35 > v.minX && p.x - 0.35 < v.maxX && p.z + 0.35 > v.minZ && p.z - 0.35 < v.maxZ;
        for (let k = 0; k < 300; k++) {
            s = g.step(1);
            if (t0 === null && inCell(s.pos)) t0 = g.time();
            if (t0 !== null && !inCell(s.pos)) { t1 = g.time(); break; }
        }
        g.clearInput();
        return { cross: t1 - t0, ev: g.events.map((e) => e.type), pos: s.pos };
    }, [i, cx, cz, v]);
    check(`wave ${i + 1}: crossing while calm well under 3 s, no wash`, r.cross > 0 && r.cross < 1.2 && !r.ev.includes('wave'), r);
}
// Pause freezes both waves
await page.evaluate(() => window.__game.restore());
const before = await page.evaluate(() => window.__game.state().vents);
await page.keyboard.press('Space');
await page.evaluate(() => window.__game.setRealtime(true));
await page.waitForTimeout(1500);
const during = await page.evaluate(() => window.__game.state().vents);
await page.keyboard.press('Space');
await page.waitForTimeout(200);
await page.evaluate(() => window.__game.setRealtime(false));
check('pause freezes both waves', [0, 1].every((i) => during[i].phase === before[i].phase && Math.abs(during[i].timer - before[i].timer) < 0.05), { before, during });
// Shots of each wave mid-warning and splash, from its Q
for (const i of [0, 1]) {
    const v = st.vents[i];
    const cx = (v.minX + v.maxX) / 2, cz = (v.minZ + v.maxZ) / 2;
    const dx = cx - v.target.x, dz = cz - v.target.z;
    const pose = { x: v.target.x - dx * 0.6, z: v.target.z - dz * 0.6, yaw: Math.atan2(-dx, -dz) };
    await page.evaluate(([i, pose]) => { const g = window.__game; g.restore(); for (let k = 0; k < 900; k++) { const s = g.step(1); const w = s.vents[i]; if (w.phase === 'warning' && w.timer <= 0.1) break; } g.teleport(pose); g.step(1); }, [i, pose]);
    await shot(`wave${i + 1}-warning`);
    await page.evaluate(([i]) => { const g = window.__game; for (let k = 0; k < 900; k++) { const s = g.step(1); const w = s.vents[i]; if (w.phase === 'puff' && w.timer <= 0.25) break; } }, [i]);
    await shot(`wave${i + 1}-splash`);
}
// Every cannon (both rides, both directions)
for (let ci = 0; ci < 4; ci++) {
    r = await page.evaluate((ci) => {
        const g = window.__game;
        g.restore();
        const c = g.state().cannons[ci];
        g.teleport({ x: c.x, z: c.z });
        g.clearEvents();
        let s, t0 = null, tf = null;
        for (let k = 0; k < 300; k++) { s = g.step(1); const e = g.events; if (t0 === null && e.some((x) => x.type === 'cannon' && x.what === 'load')) t0 = g.time(); if (tf === null && e.some((x) => x.type === 'cannon' && x.what === 'fire')) tf = g.time(); }
        return { c, pos: s.pos, fuse: tf - t0, ev: g.events.filter((e) => ['cannon', 'fall', 'waterFall'].includes(e.type)).map((e) => e.type + ':' + (e.what ?? '')) };
    }, ci);
    check(`cannon ${ci + 1}: fires and lands at the other cannon, no fall`, r.ev.includes('cannon:fire') && Math.hypot(r.pos.x - r.c.landing.x, r.pos.z - r.c.landing.z) < 0.6 && !r.ev.some((e) => e.startsWith('fall') || e.startsWith('waterFall')), r);
}
// Shots: each ride from before its first cannon
for (const ci of [0, 2]) {
    await page.evaluate((ci) => { const g = window.__game; g.restore(); const c = g.state().cannons[ci]; const o = g.state().cannons[ci + 1]; const dx = o.x - c.x, dz = o.z - c.z, d = Math.hypot(dx, dz); g.teleport({ x: c.x - dx / d * 2.5, z: c.z - dz / d * 2.5, yaw: Math.atan2(-dx, -dz) }); g.step(1); }, ci);
    await shot(`cannon${ci / 2 + 1}`);
}
// Walking into a cannon gap's water from the side of the cannon: water fall
r = await page.evaluate(() => {
    const g = window.__game;
    g.restore();
    const p = g.state().platforms[0].gap;
    g.teleport({ x: (p.minX + p.maxX) / 2, z: (p.minZ + p.maxZ) / 2 });
    g.clearEvents();
    for (let k = 0; k < 300; k++) g.step(1);
    return { ev: [...new Set(g.events.map((e) => e.type))], p };
});
check('standing in a cannon gap: water fall', r.ev.includes('waterFall'), r);
// The sneaky spike: walk into it from each open side until one gives an Ouch
r = await page.evaluate((spike) => {
    const g = window.__game;
    let out = null;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        g.restore();
        g.teleport({ x: spike.x + dx * 1.2, z: spike.z + dz * 1.2, yaw: Math.atan2(dx, dz) });
        g.clearEvents();
        g.setInput({ forward: true });
        for (let k = 0; k < 40 && !g.events.some((e) => e.type === 'spike'); k++) g.step(2);
        g.clearInput();
        if (g.events.some((e) => e.type === 'spike')) { out = { dx, dz, msg: g.text() }; break; }
    }
    return out;
}, st.spike);
check('sneaky splinter spike: Ouch', !!r && JSON.stringify(r.msg).includes('Ouch!'), r);
if (r) { await page.evaluate(([spike, r]) => { const g = window.__game; g.restore(); g.teleport({ x: spike.x + r.dx * 1.6, z: spike.z + r.dz * 1.6, yaw: Math.atan2(r.dx, r.dz) }); g.step(2); }, [st.spike, r]); await shot('spike'); }
// Through the door
r = await page.evaluate(() => {
    const g = window.__game;
    g.restore();
    const d = g.maze().doorPosition;
    g.teleport({ x: d.x - 1.8, z: d.z, yaw: -Math.PI / 2 });
    g.setInput({ forward: true });
    let s;
    for (let i = 0; i < 40; i++) { s = g.step(2); if (s.escaped) break; }
    g.clearInput();
    g.step(30);
    return { escaped: s.escaped, text: g.text() };
});
check('door: escape, More levels coming soon!', r.escaped && JSON.stringify(r.text).match(/More levels coming soon|Start (Level [0-9]+|[A-Z][a-zA-Z ]* World)/) !== null, r);
await page.evaluate(() => { const g = window.__game; g.restore(); g.teleport({ yaw: -Math.PI / 2 }); g.step(1); });
await shot('start');
check('no page errors', errors.length === 0, errors);
const page2 = await ctx.newPage();
page2.on('pageerror', (e) => errors.push(String(e)));
await page2.goto(BASE + '/?test=1&level=127', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page2.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
r = await page2.evaluate(() => {
    const g = window.__game;
    const d = g.maze().doorPosition;
    g.teleport({ x: d.x - 1.8, z: d.z, yaw: -Math.PI / 2 });
    g.setInput({ forward: true });
    let s;
    for (let i = 0; i < 40; i++) { s = g.step(2); if (s.escaped) break; }
    g.clearInput();
    g.step(30);
    const items = [...document.querySelectorAll('#menu-finish .item')].filter((e) => !e.hidden).map((e) => e.textContent);
    return { escaped: s.escaped, items };
});
check('Level 128 door: Start Level 129', r.escaped && r.items[0] === 'Start Level 129', r);
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
