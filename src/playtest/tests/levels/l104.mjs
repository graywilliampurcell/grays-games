// Level 104 checks (vite preview on 9173)
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
await page.goto(BASE + '/?test=1&level=103', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
await page.keyboard.press('Shift');
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 700)); };
const shot = (name) => page.screenshot({ path: `${SP}l104-${name}.png` });

let st = await page.evaluate(() => window.__game.state());
check('Level 104 loads: one trapdoor, one carpet, one big cactus, nothing else',
    st.level.name === 'Level 104' && st.trapdoors.length === 1 && st.platforms.length === 1 && st.platforms[0].carpet && st.spikeRows.length === 1 && !st.spike && !st.spike2 && !st.buttonDoor && !st.spinWall && st.geysers.length === 0,
    { t: st.trapdoors, rows: st.spikeRows, spike: st.spike, level: st.level.name });
check('tune trapdoorcreep', (await page.evaluate(() => window.__sound?.tuneName)) === 'trapdoorcreep', {});
const T = st.trapdoors[0];

// The cycle on its own: closed 3 / warning 1 / open 2
let r = await page.evaluate(() => {
    const g = window.__game;
    const log = [];
    let last = null;
    for (let i = 0; i < 60 * 14; i++) {
        const t = g.step(1).trapdoors[0];
        if (t.phase !== last) { log.push({ i, phase: t.phase }); last = t.phase; }
    }
    return { log, dt: g.dt, ev: [...new Set(g.events.map((e) => e.type))] };
});
const dur = {};
for (let k = 1; k + 1 < r.log.length; k++) (dur[r.log[k].phase] ??= []).push((r.log[k + 1].i - r.log[k].i) * r.dt);
const near = (xs, v) => xs?.length && xs.every((x) => Math.abs(x - v) < 0.05);
check('timer: closed 3 s, warning 1 s, open 2 s', near(dur.closed, 3) && near(dur.warning, 1) && near(dur.open, 2), { dur, log: r.log });
check('warning rumble + open events fire', r.ev.includes('trapdoorWarning') && r.ev.includes('trapdoorOpen'), r.ev);

// Standing on it when it opens: fall, back to start
r = await page.evaluate((T) => {
    const g = window.__game;
    g.restore();
    let t;
    for (let i = 0; i < 60 * 8; i++) { t = g.step(1).trapdoors[0]; if (t.phase === 'closed') break; }
    g.teleport({ x: (T.minX + T.maxX) / 2, z: (T.minZ + T.maxZ) / 2, yaw: Math.PI / 2 });
    g.clearEvents();
    let s, fellAt = null;
    for (let i = 0; i < 60 * 5; i++) {
        s = g.step(1);
        if (fellAt === null && g.events.some((e) => e.type === 'spike')) { fellAt = s.trapdoors[0].phase; break; }
    }
    return { fellAt, ev: [...new Set(g.events.map((e) => e.type))], what: g.events.filter((e) => e.type === 'spike').map((e) => e.what), text: g.text(), pos: s.pos };
}, T);
check('stand on it: it opens under you, "fell through the trapdoor", back to start', r.fellAt === 'open' && r.what.includes('trapdoor') && r.text.some((x) => x.includes('Ouch! You fell through the trapdoor. Back to the start.')), r);

// Walk onto it while open: fall
r = await page.evaluate((T) => {
    const g = window.__game;
    g.restore();
    let t;
    for (let i = 0; i < 60 * 8; i++) { t = g.step(1).trapdoors[0]; if (t.phase === 'open' && t.timer > 1.6) break; }
    g.teleport({ x: T.maxX + 2.5, z: (T.minZ + T.maxZ) / 2, yaw: Math.PI / 2 });
    g.clearEvents();
    g.setInput({ forward: true });
    for (let i = 0; i < 30; i++) g.step(1);
    g.clearInput();
    return { ev: [...new Set(g.events.map((e) => e.type))], what: g.events.filter((e) => e.type === 'spike').map((e) => e.what) };
}, T);
check('walk onto it while open: fall', r.what.includes('trapdoor'), r);

// Walk across while closed: safe, and quick
r = await page.evaluate((T) => {
    const g = window.__game;
    g.restore();
    let t;
    for (let i = 0; i < 60 * 8; i++) { t = g.step(1).trapdoors[0]; if (t.phase === 'closed' && t.timer > 2.9) break; }
    g.teleport({ x: T.maxX + 2.5, z: (T.minZ + T.maxZ) / 2, yaw: Math.PI / 2 });
    g.clearEvents();
    g.setInput({ forward: true });
    let s, on = 0;
    for (let i = 0; i < 80; i++) { s = g.step(1); if (s.pos.x > T.minX && s.pos.x < T.maxX) on++; }
    g.clearInput();
    return { ev: [...new Set(g.events.map((e) => e.type))], pos: s.pos, overSeconds: on * g.dt };
}, T);
check('walk across while closed: safe, over it well under 3 s', !r.ev.includes('spike') && r.pos.x < T.minX && r.overSeconds < 1, r);

// Warning screenshots
await page.evaluate((T) => {
    const g = window.__game;
    g.restore();
    let t;
    for (let i = 0; i < 60 * 8; i++) { t = g.step(1).trapdoors[0]; if (t.phase === 'closed') break; }
    g.teleport({ x: T.maxX + 3.5, z: (T.minZ + T.maxZ) / 2, yaw: Math.PI / 2 });
    g.step(1);
}, T);
await shot('closed');
await page.evaluate(() => { const g = window.__game; let t; for (let i = 0; i < 60 * 8; i++) { t = g.step(1).trapdoors[0]; if (t.phase === 'warning' && t.timer < 0.6) break; } });
await shot('warning');
await page.evaluate(() => { const g = window.__game; let t; for (let i = 0; i < 60 * 8; i++) { t = g.step(1).trapdoors[0]; if (t.phase === 'open' && t.open >= 1) break; } });
await shot('open');

// The big cactus: Ouch walking into it, no way past on either side
const Y = st.spikeRows[0];
for (const dx of [-1.05, 0, 1.05]) {
    r = await page.evaluate(({ Y, dx }) => {
        const g = window.__game;
        g.restore();
        g.teleport({ x: Y.x + dx, z: Y.z + 2.5, yaw: 0 });
        g.clearEvents();
        g.setInput({ forward: true });
        for (let i = 0; i < 60; i++) g.step(1);
        g.clearInput();
        return { ev: [...new Set(g.events.map((e) => e.type))], text: g.text() };
    }, { Y, dx });
    check(`big cactus blocks (offset ${dx})`, r.ev.includes('spike'), r);
}
await page.evaluate(({ Y }) => { const g = window.__game; g.restore(); g.teleport({ x: Y.x, z: Y.z + 5.5, yaw: 0 }); g.step(1); }, { Y });
await shot('big-cactus');
// Seen from the path cell it branches off
await page.evaluate(({ Y }) => { const g = window.__game; g.restore(); g.teleport({ x: Y.x, z: Y.z + 7, yaw: 0 }); g.step(1); }, { Y });
await shot('big-cactus-from-path');

// Pause freezes the trapdoor timer
r = await page.evaluate(() => {
    const g = window.__game;
    g.restore();
    const a = g.step(1).trapdoors[0];
    return { a };
});
await page.keyboard.press('Space');
await page.waitForTimeout(1500);
const paused = await page.evaluate(() => window.__game.state().trapdoors[0]);
await page.keyboard.press('Escape');
check('pause keeps the timer still', paused.timer === r.a.timer || Math.abs(paused.timer - r.a.timer) < 0.05, { before: r.a, paused });

// Sound effects off: no rumble
r = await page.evaluate(() => {
    const g = window.__game;
    return { sfx: window.__sound?.settings?.sfx };
});
check('no page errors', errors.length === 0, errors);
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
