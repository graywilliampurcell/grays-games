// Level 102 checks (vite preview on 9173)
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
await page.goto(BASE + '/?test=1&level=101', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 600)); };
const shot = (name) => page.screenshot({ path: `${SP}l102-${name}.png` });

let st = await page.evaluate(() => window.__game.state());
const c = st.platforms[0];
check('Level 102 loads: one carpet, path cactus, nothing else', st.level.name === 'Level 102' && st.platforms.length === 1 && c.carpet && !st.buttonDoor && !!st.spike && !st.spike2 && st.spikeRows.length === 0, { c, spike: st.spike, level: st.level });
check('tune carpetcreep', (await page.evaluate(() => window.__sound?.tuneName)) === 'carpetcreep', {});
await shot('start');

// The cycle on its own: rests 2 s, crosses 2 s, never waits
let r = await page.evaluate(() => {
    const g = window.__game;
    const log = [];
    let last = null;
    for (let i = 0; i < 60 * 12; i++) {
        const p = g.step(1).platforms[0];
        if (p.phase !== last) { log.push({ i, phase: p.phase, at: p.at }); last = p.phase; }
    }
    return { log, dt: g.dt };
});
const d = r.log.slice(1).map((e, k) => (r.log[k + 2]?.i ?? null) === null ? null : ((r.log[k + 2].i - e.i) * r.dt));
check('cycle: rest 2 s / cross 2 s on its own', r.log.length >= 5 && d.filter((x) => x !== null).every((x) => Math.abs(x - 2) < 0.05), { log: r.log, d });

// Ride across: wait for it resting at the north (start) edge, step on, get carried, step off
r = await page.evaluate(() => {
    const g = window.__game;
    // wait till it starts a rest at the low (north) edge
    let p;
    for (let i = 0; i < 60 * 10; i++) { p = g.step(1).platforms[0]; if (p.phase === 'rest' && p.at === 0 && p.time < 0.05) break; }
    g.teleport({ x: 38.5, z: 7.5, yaw: Math.PI });
    g.clearEvents();
    g.setInput({ forward: true });
    let s;
    for (let i = 0; i < 60; i++) s = g.step(1);
    g.clearInput();
    const onAt = s.pos.z;
    let departed = null, arrived = null, maxDuring = 0;
    for (let i = 0; i < 60 * 6; i++) {
        s = g.step(1);
        const ev = g.events.map((e) => e.what ?? e.type);
        if (departed === null && ev.includes('depart')) departed = i;
        if (departed !== null && arrived === null) { g.setInput({ forward: true, right: true }); }
        if (arrived === null && ev.includes('arrive')) { arrived = i; g.clearInput(); break; }
    }
    const atArrive = s.pos.z;
    g.clearInput();
    g.setInput({ forward: true });
    for (let i = 0; i < 60; i++) s = g.step(1);
    g.clearInput();
    return { onAt, departed, arrived, atArrive, end: s.pos, ev: [...new Set(g.events.map((e) => e.what ?? e.type))], text: g.text() };
});
check('ride: carried across (no steering), steps off on the far floor, no fall', r.departed !== null && r.arrived !== null && r.atArrive > 17.5 && r.end.z > 21 && !r.ev.includes('fall'), r);

// Walk into the pit while the carpet is at the far edge
r = await page.evaluate(() => {
    const g = window.__game;
    g.restore();
    let p;
    for (let i = 0; i < 60 * 10; i++) { p = g.step(1).platforms[0]; if (p.phase === 'rest' && p.at > 8) break; }
    g.teleport({ x: 38.5, z: 7.5, yaw: Math.PI });
    g.clearEvents();
    g.setInput({ forward: true });
    for (let i = 0; i < 60; i++) g.step(1);
    g.clearInput();
    return { ev: [...new Set(g.events.map((e) => e.type))], text: g.text(), pos: g.state().pos };
});
check('walking into the pit: sand pit message, back to start', r.ev.includes('fall') && r.text.some((t) => t.includes('You fell in the sand pit')), r);
await shot('fell');

// Partly on when the rest ends: it keeps resting till fully on or off
r = await page.evaluate(() => {
    const g = window.__game;
    let p;
    for (let i = 0; i < 60 * 10; i++) { p = g.step(1).platforms[0]; if (p.phase === 'rest' && p.at === 0 && p.time < 0.05) break; }
    g.teleport({ x: 38.5, z: 9.1, yaw: Math.PI });
    g.clearEvents();
    for (let i = 0; i < 60 * 3; i++) p = g.step(1).platforms[0];
    const held = { phase: p.phase, at: p.at, time: p.time };
    // step back off
    g.teleport({ x: 38.5, z: 7.5, yaw: 0 });
    for (let i = 0; i < 10; i++) p = g.step(1).platforms[0];
    return { held, after: { phase: p.phase, at: p.at }, ev: [...new Set(g.events.map((e) => e.type))] };
});
check('partly on: keeps resting past 2 s, goes once you step off', r.held.phase === 'rest' && r.held.at === 0 && r.held.time > 2.5 && r.after.phase === 'cross' && !r.ev.includes('fall'), r);

// Reset to start doesn't change the cycle
r = await page.evaluate(() => {
    const g = window.__game;
    for (let i = 0; i < 45; i++) g.step(1);
    const before = g.state().platforms[0];
    g.teleport({ x: 38.5, z: 7.5, yaw: Math.PI });
    g.setInput({ forward: true });
    // walk into pit (carpet is crossing) -> reset
    g.clearEvents();
    for (let i = 0; i < 30; i++) g.step(1);
    g.clearInput();
    const after = g.state().platforms[0];
    return { before: { phase: before.phase, time: before.time, at: before.at }, after: { phase: after.phase, time: after.time, at: after.at }, ev: [...new Set(g.events.map((e) => e.type))] };
});
check('reset to start keeps the carpet cycle going', r.ev.includes('fall') && (r.after.phase !== r.before.phase || r.after.time > r.before.time), r);

// Screenshots of the carpet and pit
await page.evaluate(() => {
    const g = window.__game;
    g.restore();
    let p;
    for (let i = 0; i < 60 * 10; i++) { p = g.step(1).platforms[0]; if (p.phase === 'rest' && p.at === 0 && p.time > 0.5) break; }
    g.teleport({ x: 38.5, z: 6.2, yaw: Math.PI });
    g.step(1);
});
await shot('carpet-rest');
await page.evaluate(() => { const g = window.__game; for (let i = 0; i < 100; i++) g.step(1); });
await shot('carpet-flying');
await page.evaluate(() => { const g = window.__game; g.teleport({ x: 38.5, z: 8.4, yaw: Math.PI }); g.step(1); });
await shot('pit-down');

// The cactus on the path: Ouch, and squeezable on both sides
const sp = st.spike;
r = await page.evaluate(({ x, z }) => {
    const g = window.__game;
    g.restore();
    g.teleport({ x, z: z + 3, yaw: 0 });
    g.clearEvents();
    g.setInput({ forward: true });
    for (let i = 0; i < 60; i++) g.step(1);
    g.clearInput();
    return { ev: [...new Set(g.events.map((e) => e.type))], text: g.text() };
}, sp);
check('path cactus: Ouch with the cactus message', r.ev.includes('spike') && r.text.some((t) => t.includes('A cactus sent you back')), r);
for (const side of [-1, 1]) {
    r = await page.evaluate(({ x, z, side }) => {
        const g = window.__game;
        g.restore();
        g.teleport({ x: x + side * 1.05, z: z + 3, yaw: 0 });
        g.clearEvents();
        g.setInput({ forward: true });
        let s;
        for (let i = 0; i < 60; i++) s = g.step(1);
        g.clearInput();
        return { ev: [...new Set(g.events.map((e) => e.type))], pos: s.pos };
    }, { ...sp, side });
    check(`squeeze past the cactus on side ${side}`, !r.ev.includes('spike') && r.pos.z < sp.z - 2, r);
}
await page.evaluate(({ x, z }) => { const g = window.__game; g.restore(); g.teleport({ x, z: z + 4, yaw: 0 }); g.step(1); }, sp);
await shot('cactus');

check('no page errors', errors.length === 0, errors);
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
