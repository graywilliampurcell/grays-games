// Level 106 checks (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
import fs from 'fs';
const SP = SHOTS;
fs.mkdirSync(SP, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const open = async (url, opts = { viewport: { width: 1024, height: 640 } }) => {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
    await page.keyboard.press('Shift');
    return page;
};
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 700)); };
let page = await open(BASE + '/?test=1&level=105');
const shot = (name) => page.screenshot({ path: `${SP}l106-${name}.png` });
let st = await page.evaluate(() => window.__game.state());
const c = st.platforms[0];
check('Level 106 loads: one carpet, path cactus, spinning wall, nothing else',
    st.level.name === 'Level 106' && st.platforms.length === 1 && c.carpet && !!st.spike && !st.spike2 && !!st.spinWall && !st.buttonDoor && st.trapdoors.length === 0 && st.spikeRows.length === 0,
    { c, spike: st.spike, sw: st.spinWall, bd: st.buttonDoor, t: st.trapdoors, rows: st.spikeRows });
check('tune squeezecreep', (await page.evaluate(() => window.__sound?.tuneName)) === 'squeezecreep', {});
console.log('carpet', JSON.stringify(c), 'spike', JSON.stringify(st.spike), 'start', JSON.stringify(st.pos));
await shot('start');
// Carpet cycle
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
check('carpet cycle: rest 2 s / cross 2 s', r.log.length >= 5 && d.filter((x) => x !== null).every((x) => Math.abs(x - 2) < 0.05), { log: r.log, d });
// Ride east across: wait for the rest at the west (start) edge
r = await page.evaluate(() => {
    const g = window.__game;
    let p;
    for (let i = 0; i < 60 * 10; i++) { p = g.step(1).platforms[0]; if (p.phase === 'rest' && p.at === 0 && p.time < 0.05) break; }
    g.teleport({ x: 22.5, z: 2.5, yaw: -Math.PI / 2 });
    g.clearEvents();
    g.setInput({ forward: true });
    let s;
    for (let i = 0; i < 60; i++) s = g.step(1);
    g.clearInput();
    const onAt = s.pos.x;
    let departed = null, arrived = null;
    for (let i = 0; i < 60 * 6; i++) {
        s = g.step(1);
        const ev = g.events.map((e) => e.what ?? e.type);
        if (departed === null && ev.includes('depart')) departed = i;
        if (arrived === null && ev.includes('arrive')) { arrived = i; break; }
    }
    const atArrive = s.pos.x;
    g.setInput({ forward: true });
    for (let i = 0; i < 60; i++) s = g.step(1);
    g.clearInput();
    return { onAt, departed, arrived, atArrive, end: s.pos, ev: [...new Set(g.events.map((e) => e.what ?? e.type))] };
});
check('carpet ride: carried east over the pit, steps off on the far floor, no fall', r.departed !== null && r.arrived !== null && r.atArrive > 32 && r.end.x > 37 && !r.ev.includes('fall'), r);
// Walk into the pit while the carpet is away
r = await page.evaluate(() => {
    const g = window.__game;
    g.restore();
    let p;
    for (let i = 0; i < 60 * 10; i++) { p = g.step(1).platforms[0]; if (p.phase === 'rest' && p.at > 8) break; }
    g.teleport({ x: 22.5, z: 2.5, yaw: -Math.PI / 2 });
    g.clearEvents();
    g.setInput({ forward: true });
    for (let i = 0; i < 60; i++) g.step(1);
    g.clearInput();
    return { ev: [...new Set(g.events.map((e) => e.type))], text: g.text() };
});
check('walking into the pit: sand pit message', r.ev.includes('fall') && r.text.some((t) => t.includes('You fell in the sand pit')), r);
await page.evaluate(() => { const g = window.__game; g.restore(); let p; for (let i = 0; i < 60 * 10; i++) { p = g.step(1).platforms[0]; if (p.phase === 'rest' && p.at === 0 && p.time > 0.5) break; } g.teleport({ x: 21.5, z: 2.5, yaw: -Math.PI / 2 }); g.step(1); });
await shot('carpet');
// Path cactus: heading west
const sp = st.spike;
const walkWest = (p) => page.evaluate(({ x, z }) => {
    const g = window.__game;
    g.restore();
    g.teleport({ x, z, yaw: Math.PI / 2 });
    g.clearEvents();
    g.setInput({ forward: true });
    let s;
    for (let i = 0; i < 60; i++) s = g.step(1);
    g.clearInput();
    return { ev: [...new Set(g.events.map((e) => e.type))], pos: s.pos, text: g.text() };
}, p);
r = await walkWest({ x: sp.x + 3, z: sp.z });
check('path cactus: Ouch with the cactus message', r.ev.includes('spike') && r.text.some((t) => t.includes('A cactus sent you back')), r);
for (const side of [-1, 1]) {
    r = await walkWest({ x: sp.x + 3, z: sp.z + side * 1.0 });
    check(`squeeze past the cactus on side ${side} (computer)`, !r.ev.includes('spike') && r.pos.x < sp.x - 2, r);
}
// Measured gap each side
r = await page.evaluate(({ x, z }) => {
    const g = window.__game;
    const free = [];
    for (const side of [-1, 1]) {
        let best = null;
        for (let k = 0; k <= 20; k++) {
            const off = 0.5 + k * 0.05;
            g.restore();
            g.teleport({ x: x + 3, z: z + side * off, yaw: Math.PI / 2 });
            g.clearEvents();
            g.setInput({ forward: true });
            let s;
            for (let i = 0; i < 60; i++) s = g.step(1);
            g.clearInput();
            if (!g.events.some((e) => e.type === 'spike') && s.pos.x < x - 2) { best = off; break; }
        }
        free.push(best);
    }
    return free;
}, sp);
console.log('closest pass offsets', JSON.stringify(r));
await page.evaluate(({ x, z }) => { const g = window.__game; g.restore(); g.teleport({ x: x + 4, z, yaw: Math.PI / 2 }); g.step(1); }, sp);
await shot('cactus');
// Spinning wall: E at x 28, row z 29-31
const spinFrom = (x, yaw) => page.evaluate(({ x, yaw }) => {
    const g = window.__game;
    g.restore();
    g.teleport({ x, z: 30.5, yaw });
    g.clearEvents();
    g.setInput({ forward: true });
    let s;
    for (let i = 0; i < 60 * 3; i++) { s = g.step(1); if (g.events.some((e) => e.type === 'spin')) break; }
    g.clearInput();
    for (let i = 0; i < 30; i++) s = g.step(1);
    const ev = g.events.filter((e) => ['spinStart', 'spin', 'spike', 'fall'].includes(e.type));
    return { ev, end: s.pos, yaw: s.yaw };
}, { x, yaw });
r = await spinFrom(30.5, Math.PI / 2);
check('spinning wall from the east (the path way): spins you through to the west cell', r.ev.some((e) => e.type === 'spinStart') && r.ev.some((e) => e.type === 'spin') && Math.abs(r.end.x - 26.5) < 0.7 && Math.abs(r.end.z - 30.5) < 0.7, r);
r = await spinFrom(26.5, -Math.PI / 2);
check('spinning wall from the west: back through to the east cell', r.ev.some((e) => e.type === 'spin') && Math.abs(r.end.x - 30.5) < 0.7, r);
await page.evaluate(() => { const g = window.__game; g.restore(); g.teleport({ x: 35.5, z: 30.5, yaw: Math.PI / 2 }); g.step(1); });
await shot('beetle');
// Door
r = await page.evaluate(() => {
    const g = window.__game;
    g.restore();
    const d = g.state().door;
    g.teleport({ x: d.x - 1.5, z: d.z, yaw: -Math.PI / 2 });
    g.setInput({ forward: true });
    for (let i = 0; i < 40; i++) g.step(1);
    g.clearInput();
    return { escaped: g.state().escaped, text: g.text() };
});
check('L106 door: More levels coming soon! + Quit', r.escaped && r.text.some((t) => /More levels coming soon!/.test(t)) && !r.text.some((t) => /Start Level/.test(t)), r.text);
await page.context().close();
page = await open(BASE + '/?test=1&level=104');
r = await page.evaluate(() => {
    const g = window.__game;
    const d = g.state().door;
    g.teleport({ x: d.x - 1.5, z: d.z, yaw: -Math.PI / 2 });
    g.setInput({ forward: true });
    for (let i = 0; i < 40; i++) g.step(1);
    g.clearInput();
    return { escaped: g.state().escaped, text: g.text() };
});
check('L105 door: Start Level 106', r.escaped && r.text.some((t) => /Start Level 106/.test(t)), r);
await page.context().close();
check('no page errors', errors.length === 0, errors);
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
