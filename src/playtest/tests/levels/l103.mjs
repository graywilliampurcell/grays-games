// Level 103 checks (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
import fs from 'fs';
const SP = SHOTS;
fs.mkdirSync(SP, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 700)); };
async function open(level) {
    const ctx = await browser.newContext({ viewport: { width: 1024, height: 640 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${BASE}/?test=1&level=${level}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
    await page.keyboard.press('Shift'); // sound starts on the first key
    return page;
}
let page = await open(102);
const shot = (name) => page.screenshot({ path: `${SP}l103-${name}.png` });
let st = await page.evaluate(() => window.__game.state());
check('Level 103 loads: spinning wall + button door, nothing else', st.level.name === 'Level 103' && !!st.spinWall && !!st.buttonDoor && !st.spike && !st.spike2 && st.spikeRows.length === 0 && st.platforms.length === 0, { sw: st.spinWall, bd: st.buttonDoor, level: st.level });
check('tune beetlecreep', (await page.evaluate(() => window.__sound?.tuneName)) === 'beetlecreep', {});
await shot('start');

const spinFrom = (x, yaw) => page.evaluate(({ x, yaw }) => {
    const g = window.__game;
    g.restore();
    g.teleport({ x, z: 2.5, yaw });
    g.clearEvents();
    g.setInput({ forward: true });
    let s;
    const track = [];
    for (let i = 0; i < 60 * 3; i++) { s = g.step(1); if (i % 6 === 0) track.push([s.pos.x, s.pos.z, s.spinWall.angle]); if (g.events.some((e) => e.type === 'spin')) break; }
    g.clearInput();
    for (let i = 0; i < 30; i++) s = g.step(1);
    const ev = g.events.filter((e) => ['spinStart', 'spin', 'spike', 'fall'].includes(e.type) || (e.type === 'sound' && e.name === 'grind'));
    return { ev, end: s.pos, yaw: s.yaw, spinning: s.spinning, track };
}, { x, yaw });
let r = await spinFrom(18.5, -Math.PI / 2);
let start = r.ev.find((e) => e.type === 'spinStart');
let done = r.ev.find((e) => e.type === 'spin');
check('from the west: walking into the beetle wall spins you to the east cell, facing away', !!start && !!done && Math.abs(done.t - start.t - 1) < 0.05 && Math.abs(r.end.x - 22.5) < 0.6 && Math.abs(r.end.z - 2.5) < 0.6 && Math.abs(r.yaw + Math.PI / 2) < 0.1 && r.ev.some((e) => e.name === 'grind') && !r.spinning, { ev: r.ev, end: r.end, yaw: r.yaw });
// Keep walking: you walk on east, no second spin
check('only one spin', r.ev.filter((e) => e.type === 'spinStart').length === 1, {});
// Keep walking after the spin: you walk on east, no second spin
r = await page.evaluate(() => {
    const g = window.__game;
    g.setInput({ forward: true });
    let s;
    for (let i = 0; i < 60; i++) s = g.step(1);
    g.clearInput();
    return { ev: g.events.filter((e) => e.type === 'spinStart').length, pos: s.pos };
});
check('walking on after the spin goes on east, no second spin', r.ev === 1 && r.pos.x > 25, r);
r = await spinFrom(22.5, Math.PI / 2);
start = r.ev.find((e) => e.type === 'spinStart');
done = r.ev.find((e) => e.type === 'spin');
check('from the east: same the other way', !!start && !!done && Math.abs(r.end.x - 18.5) < 0.6 && Math.abs(r.yaw - Math.PI / 2) < 0.1 && r.ev.filter((e) => e.type === 'spinStart').length === 1, { ev: r.ev, end: r.end, yaw: r.yaw });
// The player always clear of walls during and after the spin (distance to wall line)
check('spin path stays in the corridor', r.track.every(([x, z]) => z > 1.3 && z < 3.7 && x > 17.3 && x < 23.7), { track: r.track });

// Standing still against it, or walking along it, doesn't spin it
r = await page.evaluate(() => {
    const g = window.__game;
    g.restore();
    g.teleport({ x: 19.55, z: 2.5, yaw: 0 });
    g.clearEvents();
    for (let i = 0; i < 60; i++) g.step(1);
    g.setInput({ forward: true }); // facing north, along the wall
    for (let i = 0; i < 60; i++) g.step(1);
    g.clearInput();
    return { ev: g.events.filter((e) => e.type === 'spinStart') };
});
check('no spin unless you walk into it', r.ev.length === 0, r);
// A normal wall doesn't spin: the west cell's north wall
r = await page.evaluate(() => {
    const g = window.__game;
    g.restore();
    g.teleport({ x: 14.5, z: 2.5, yaw: 0 });
    g.clearEvents();
    g.setInput({ forward: true });
    for (let i = 0; i < 60; i++) g.step(1);
    g.clearInput();
    return { ev: g.events.filter((e) => e.type === 'spinStart'), pos: g.state().pos };
});
check('normal walls do not spin', r.ev.length === 0 && r.pos.z > 1.3, r);
// Pausing stops a spin midway
r = await page.evaluate(() => {
    const g = window.__game;
    g.restore();
    g.teleport({ x: 18.5, z: 2.5, yaw: -Math.PI / 2 });
    g.setInput({ forward: true });
    let s;
    for (let i = 0; i < 40; i++) { s = g.step(1); if (s.spinWall.spinning && s.spinWall.time > 0.3) break; }
    g.clearInput();
    return { time: s.spinWall.time, angle: s.spinWall.angle };
});
check('a spin is a game-step animation (stops with the game)', r.time > 0.25 && r.time < 0.6, r);

// Screenshots: the beetle wall from down its corridor, close up, mid-spin
await page.evaluate(() => { const g = window.__game; g.restore(); g.teleport({ x: 10.5, z: 2.5, yaw: -Math.PI / 2 }); g.step(1); });
await shot('beetle-far');
await page.evaluate(() => { const g = window.__game; g.teleport({ x: 15.5, z: 2.5, yaw: -Math.PI / 2 }); g.step(1); });
await shot('beetle-near');
await page.evaluate(() => { const g = window.__game; g.teleport({ x: 18.5, z: 2.5, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); for (let i = 0; i < 200; i++) { const s = g.step(1); if (s.spinWall.spinning && s.spinWall.time > 0.45) break; } g.clearInput(); });
await shot('mid-spin');
await page.evaluate(() => { const g = window.__game; for (let i = 0; i < 80; i++) g.step(1); });
await shot('after-spin');
await page.evaluate(() => { const g = window.__game; g.teleport({ x: 30.5, z: 2.5, yaw: Math.PI / 2 }); g.step(1); });
await shot('beetle-east-side');

// Button door: shut until the button is pressed, then open; reset shuts it
r = await page.evaluate(() => {
    const g = window.__game;
    g.restore();
    g.teleport({ x: 38.5, z: 34.5, yaw: 0 });
    g.setInput({ forward: true });
    let s;
    for (let i = 0; i < 90; i++) s = g.step(1);
    g.clearInput();
    const blocked = s.pos.z;
    const b = s.buttonDoor.button;
    g.teleport({ x: b.x, z: b.z });
    for (let i = 0; i < 90; i++) s = g.step(1);
    const open = s.buttonDoor;
    g.teleport({ x: 38.5, z: 34.5, yaw: 0 });
    g.setInput({ forward: true });
    for (let i = 0; i < 90; i++) s = g.step(1);
    g.clearInput();
    const through = s.pos.z;
    g.restore();
    return { blocked, open, through, after: g.state().buttonDoor };
});
check('button door blocks until the button is pressed, then opens; reset shuts it', r.blocked > 32.5 && r.open.pressed && r.open.open === 1 && r.through < 31 && !r.after.pressed && r.after.solid, r);
await page.evaluate(() => { const g = window.__game; g.restore(); g.teleport({ x: 38.5, z: 38.5, yaw: 0 }); g.step(1); });
await shot('button-door');

// Level 103's door: More levels coming soon
r = await page.evaluate(() => {
    const g = window.__game;
    g.restore();
    g.teleport({ x: 37.5, z: 6.5, yaw: -Math.PI / 2 });
    g.setInput({ forward: true });
    for (let i = 0; i < 90; i++) g.step(1);
    g.clearInput();
    return { text: g.text(), escaped: g.state().escaped };
});
check("Level 103's door: More levels coming soon + Quit", r.escaped && r.text.some((t) => t.match(/More levels coming soon|Start (Level [0-9]+|[A-Z][a-zA-Z ]* World)/) !== null), r);
await page.context().close();

page = await open(101);
r = await page.evaluate(() => {
    const g = window.__game;
    g.teleport({ x: 37.5, z: 34.5, yaw: -Math.PI / 2 });
    g.setInput({ forward: true });
    for (let i = 0; i < 90; i++) g.step(1);
    g.clearInput();
    return { text: g.text(), escaped: g.state().escaped, level: g.state().level };
});
check("Level 102's door leads to Level 103", r.escaped && r.text.some((t) => t.includes('Start Level 103')), r);
await page.context().close();

check('no page errors', errors.length === 0, errors);
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
