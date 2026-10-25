// Level 131 checks (vite preview on 9173)
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
await page.goto(BASE + '/?test=1&level=130', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
await page.keyboard.press('Shift');
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 900)); };
const shot = (name) => page.screenshot({ path: `${SP}l131-${name}.png`, timeout: 180000 });
const ONLY = process.env.ONLY;
let st = await page.evaluate(() => window.__game.restore());
const p = st.platforms[0];
check('Level 131 loads: one rainbow gap, the sneaky spike, nothing else',
    st.level.name === 'Level 131' && st.platforms.length === 1 && !!p.rainbow && st.cannons.length === 0 && !!st.spike && !st.spike2 && st.spikeRows.length === 0 && st.tails.length === 0 && st.vents.length === 0 && st.geysers.length === 0 && st.belts.length === 0,
    { p, spike: st.spike, level: st.level });
check('gap 3 cells long (span 11), crossed along x, 3 wide', p.span === 11 && p.alongX && p.gap.maxZ - p.gap.minZ === 3, p.gap);
check('tune skywelcome', (await page.evaluate(() => window.__sound?.tuneName)) === 'skywelcome', {});
const cz = (p.gap.minZ + p.gap.maxZ) / 2;
const yawW = Math.PI / 2; // facing -x (crossed heading west)
const rb = () => page.evaluate(() => window.__game.state().platforms[0].rainbow);
// The cycle, standing at the start (far away)
let r = await page.evaluate(() => {
    const g = window.__game;
    g.restore();
    const changes = [];
    let last = g.state().platforms[0].rainbow.phase;
    const t0 = g.time();
    for (let k = 0; k < 60 * 17; k++) {
        const s = g.step(1);
        const ph = s.platforms[0].rainbow.phase;
        if (ph !== last) { changes.push([ph, +(g.time() - t0).toFixed(3)]); last = ph; }
    }
    return changes;
});
const at = (k) => r[k][1];
check('cycle: solid ~4 s, fading ~1 s, gone ~3 s, repeating', r.length >= 5 && r[0][0] === 'fading' && r[1][0] === 'gone' && r[2][0] === 'solid' && Math.abs(at(1) - at(0) - 1) < 0.05 && Math.abs(at(2) - at(1) - 3) < 0.05 && Math.abs(at(3) - at(2) - 4) < 0.05 && Math.abs(at(4) - at(3) - 1) < 0.05, r);
// Walk to the bridge's start edge, wait for it to become solid, cross
const toSolidStart = () => page.evaluate(([g0, cz, yawW]) => {
    const g = window.__game;
    g.restore();
    g.teleport({ x: g0.maxX + 1.5, z: cz, yaw: yawW });
    // wait for the next "appear"
    let s = g.step(1);
    while (s.platforms[0].rainbow.phase !== 'gone') s = g.step(1);
    while (s.platforms[0].rainbow.phase === 'gone') s = g.step(1);
    return s.platforms[0].rainbow;
}, [p.gap, cz, yawW]);
const cross = (off = 0) => page.evaluate(([g0, cz, off, yawW]) => {
    const g = window.__game;
    g.teleport({ x: g0.maxX + 1.5, z: cz + off, yaw: yawW });
    g.clearEvents();
    g.setInput({ forward: true });
    let s, t0 = null, t1 = null;
    for (let k = 0; k < 400; k++) {
        s = g.step(1);
        if (t0 === null && s.pos.x <= g0.maxX) t0 = g.time();
        if (t1 === null && s.pos.x <= g0.minX) t1 = g.time();
        if (s.pos.x < g0.minX - 1.5 || g.events.some((e) => e.type === 'fall')) break;
    }
    g.clearInput();
    return { pos: s.pos, time: t1 - t0, ev: g.events.map((e) => e.type).filter((e) => ['fall', 'spike'].includes(e)), msg: g.text(), rainbow: s.platforms[0].rainbow };
}, [p.gap, cz, off, yawW]);
if (!ONLY || ONLY === 'cross') {
    await toSolidStart();
    r = await cross(0);
    check('cross the rainbow while solid: no fall, well under the solid time', r.ev.length === 0 && r.pos.x < p.gap.minX - 1 && r.time < 2.2, r);
    await toSolidStart();
    r = await cross(1.05);
    check('cross near the wall side: no fall (full width)', r.ev.length === 0 && r.pos.x < p.gap.minX - 1, r);
    // Walk in while it's gone: fall off the island
    r = await page.evaluate(([g0, cz, yawW]) => {
        const g = window.__game;
        g.restore();
        let s = g.step(1);
        while (s.platforms[0].rainbow.phase !== 'gone') s = g.step(1);
        g.teleport({ x: g0.maxX + 0.8, z: cz, yaw: yawW });
        g.clearEvents();
        g.setInput({ forward: true });
        for (let k = 0; k < 60 && !g.events.some((e) => e.type === 'fall'); k++) s = g.step(1);
        g.clearInput();
        return { ev: g.events.map((e) => e.type).filter((e) => e === 'fall'), msg: g.text(), pos: s.pos, start: s.start, sounds: g.events.filter((e) => e.type === 'sound').map((e) => e.name) };
    }, [p.gap, cz, yawW]);
    check('walk in while it is gone: Ouch! You fell off the island. Back to the start.', r.ev.length === 1 && JSON.stringify(r.msg).includes('Ouch! You fell off the island. Back to the start.') && Math.hypot(r.pos.x - r.start.x, r.pos.z - r.start.z) < 0.1 && r.sounds.includes('ouch'), r);
}
if (!ONLY || ONLY === 'hold') {
    // Stand on it: it never goes while you're on it, then carries on once you're off
    r = await page.evaluate(([g0, cz, yawW]) => {
        const g = window.__game;
        g.restore();
        let s = g.step(1);
        while (s.platforms[0].rainbow.phase !== 'gone') s = g.step(1);
        while (s.platforms[0].rainbow.phase === 'gone') s = g.step(1);
        g.teleport({ x: (g0.minX + g0.maxX) / 2, z: cz, yaw: yawW });
        g.clearEvents();
        s = g.step(60 * 7); // stand there 7 s
        const held = s.platforms[0].rainbow;
        const fell = g.events.some((e) => e.type === 'fall');
        // Edge case: only a sliver of you on it (at the far edge)
        g.teleport({ x: g0.minX - 0.3, z: cz, yaw: yawW });
        s = g.step(60);
        const edge = s.platforms[0].rainbow;
        // Step off fully
        g.teleport({ x: g0.minX - 2, z: cz, yaw: yawW });
        s = g.step(2);
        const off = s.platforms[0].rainbow;
        return { held, fell, edge, off };
    }, [p.gap, cz, yawW]);
    check('standing on it 7 s: stays (held, fading), no fall', r.held.phase === 'fading' && r.held.held && !r.fell, r);
    check('a sliver of you still on it: still held', r.edge.phase === 'fading' && r.edge.held, r);
    check('step off: it goes', r.off.phase === 'gone', r);
}
if (!ONLY || ONLY === 'reset') {
    // A reset to the start doesn't change the cycle
    r = await page.evaluate((spike) => {
        const g = window.__game;
        g.restore();
        let s = g.step(30);
        const before = s.platforms[0].rainbow;
        g.teleport({ x: spike.x + 1.08, z: spike.z, yaw: Math.PI / 2 });
        g.clearEvents();
        g.setInput({ forward: true });
        for (let k = 0; k < 60 && !g.events.some((e) => e.type === 'spike'); k++) s = g.step(1);
        g.clearInput();
        const n = g.events.length;
        s = g.step(1);
        return { before, after: s.platforms[0].rainbow, spike: g.events.some((e) => e.type === 'spike'), msg: g.text() };
    }, st.spike);
    check('sneaky storm cloud: Ouch! A storm cloud sent you back to the start.', r.spike && JSON.stringify(r.msg).includes('A storm cloud sent you back to the start.'), r);
    check('reset to start does not restart the rainbow cycle', !(r.after.phase === 'solid' && r.after.time < 0.1), r);
    // Pause freezes it
    const t0 = (await rb()).time;
    await page.keyboard.press('Space');
    await page.evaluate(() => window.__game.setRealtime(true));
    await page.waitForTimeout(1500);
    const t1 = (await rb()).time;
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);
    await page.evaluate(() => window.__game.setRealtime(false));
    check('pause freezes the rainbow', Math.abs(t1 - t0) < 0.01, { t0, t1 });
    // The shimmer: heard when it appears near you, not from across the maze
    r = await page.evaluate(([g0, cz, yawW]) => {
        const g = window.__game;
        g.restore();
        let s = g.step(1);
        while (s.platforms[0].rainbow.phase !== 'gone') s = g.step(1);
        g.teleport({ x: g0.maxX + 2, z: cz, yaw: yawW });
        g.clearEvents();
        while (s.platforms[0].rainbow.phase === 'gone') s = g.step(1);
        g.step(2);
        const near = g.events.filter((e) => e.type === 'sound').map((e) => e.name);
        g.restore();
        s = g.step(1);
        while (s.platforms[0].rainbow.phase !== 'gone') s = g.step(1);
        g.clearEvents();
        while (s.platforms[0].rainbow.phase === 'gone') s = g.step(1);
        g.step(2);
        const far = g.events.filter((e) => e.type === 'sound').map((e) => e.name);
        return { near, far };
    }, [p.gap, cz, yawW]);
    check('shimmer when it appears near you, none from the start far away', r.near.includes('shimmer') && !r.far.includes('shimmer'), r);
}
if (!ONLY || ONLY === 'shots') {
    // Shots: solid, fading, gone; the spike; the start; looking down into the gap
    const view = (phase, pitch = -0.25, back = 3) => page.evaluate(([g0, cz, yawW, phase, pitch, back]) => {
        const g = window.__game;
        g.restore();
        g.teleport({ x: g0.maxX + back, z: cz, yaw: yawW, pitch });
        let s = g.step(1);
        while (s.platforms[0].rainbow.phase !== 'gone') s = g.step(1);
        while (s.platforms[0].rainbow.phase !== phase) s = g.step(1);
        g.step(phase === 'fading' ? 20 : 30);
    }, [p.gap, cz, yawW, phase, pitch, back]);
    await view('solid');
    await shot('solid');
    await view('fading');
    await shot('fading');
    await view('gone', -0.7, 1.2);
    await shot('gone-down');
    await page.evaluate(() => { const g = window.__game; g.restore(); g.teleport({ yaw: -Math.PI / 2, pitch: 0.25 }); g.step(2); });
    await shot('start');
    await page.evaluate((spike) => { const g = window.__game; g.restore(); g.teleport({ x: spike.x + 2.2, z: spike.z, yaw: Math.PI / 2 }); g.step(2); }, st.spike);
    await shot('spike');
}
if (!ONLY || ONLY === 'door') {
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
}
check('no page errors', errors.length === 0, errors);
if (!ONLY || ONLY === 'prev') {
    const page2 = await ctx.newPage();
    page2.on('pageerror', (e) => errors.push(String(e)));
    await page2.goto(BASE + '/?test=1&level=129', { waitUntil: 'domcontentloaded', timeout: 90000 });
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
        return { escaped: s.escaped, items, note: !document.getElementById('finish-note').hidden, title: document.getElementById('finish-title').textContent };
    });
    check('Level 130 finale: Start Sky World above Quit, no coming-soon line', r.escaped && r.items[0] === 'Start Sky World' && r.items.includes('Quit') && !r.note && r.title === 'You beat Pirate Ship World!', r);
}
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
