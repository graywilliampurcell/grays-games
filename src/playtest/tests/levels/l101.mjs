// Level 101 checks (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
import fs from 'fs';
const SP = SHOTS;
fs.mkdirSync(SP, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const open = async (url, storage) => {
    const ctx = await browser.newContext({ viewport: { width: 1024, height: 640 } });
    if (storage) await ctx.addInitScript((st) => { if (!sessionStorage.getItem('seeded')) { for (const [k, v] of Object.entries(st)) localStorage.setItem(k, JSON.stringify(v)); sessionStorage.setItem('seeded', '1'); } }, storage);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    return page;
};
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 500)); };
const E = -Math.PI / 2, W = Math.PI / 2, N = 0, Sd = Math.PI;

let page = await open(BASE + '/?test=1&level=100');
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
const shot = (name) => page.screenshot({ path: `${SP}l101-${name}.png` });
const walk = ({ p, yaw, secs }) => {
    const g = window.__game;
    g.teleport({ ...p, yaw });
    g.clearEvents();
    g.setInput({ forward: true });
    let st;
    let maxX = 0;
    for (let i = 0; i < secs * 60; i++) { st = g.step(1); maxX = Math.max(maxX, st.pos.x); }
    g.clearInput();
    g.render();
    return { pos: st.pos, maxX, door: st.buttonDoor, ev: [...new Set(g.events.map((e) => e.type))], text: g.text() };
};
let st = await page.evaluate(() => window.__game.state());
check('Level 101 loads with a shut button door and a sneaky cactus', st.level.name === 'Level 101' && st.buttonDoor && st.buttonDoor.solid && !st.buttonDoor.pressed && !!st.spike && !st.spike2 && st.platforms.length === 0 && st.spikeRows.length === 0, { door: st.buttonDoor, spike: st.spike });
check('tune desertsneak', await page.evaluate(() => window.__sound?.tuneName), {});
await shot('start');
// The shut door blocks the corridor
let r = await page.evaluate(walk, { p: { x: 28.5, z: 26.5 }, yaw: E, secs: 2 });
check('shut door blocks the way', r.maxX < 32 && !r.door.pressed, r);
await shot('door-shut');
// Look at the door from a bit back
await page.evaluate(() => { window.__game.teleport({ x: 26.5, z: 26.5, yaw: -Math.PI / 2 }); window.__game.step(1); });
await shot('door-face');
// The button: walk onto it from the wrong way's opening
await page.evaluate(() => { window.__game.teleport({ x: 30.5, z: 21.5, yaw: 0 }); window.__game.step(1); });
await shot('button-view');
r = await page.evaluate(() => {
    const g = window.__game;
    g.teleport({ x: 30.5, z: 18.5, yaw: 0 });
    g.clearEvents();
    g.setInput({ forward: true });
    let pressedAt = null, openAt = null, passableAt = null;
    for (let i = 0; i < 240; i++) {
        const st = g.step(1);
        const ev = g.events.map((e) => e.type);
        if (pressedAt === null && ev.includes('button')) pressedAt = i;
        if (openAt === null && ev.includes('buttonDoorOpen')) openAt = i;
        if (passableAt === null && st.buttonDoor && !st.buttonDoor.solid) passableAt = i;
        if (pressedAt !== null && i > pressedAt + 3) g.clearInput();
    }
    return { pressedAt, openAt, passableAt, door: g.state().buttonDoor, pos: g.state().pos, dt: g.dt };
});
check('button presses when stepped on, door open after about 1 s', r.pressedAt !== null && r.openAt !== null && Math.abs((r.openAt - r.pressedAt) * r.dt - 1) < 0.1 && r.door.pressed && !r.door.solid && r.door.open === 1, r);
await shot('button-pressed');
r = await page.evaluate(walk, { p: { x: 28.5, z: 26.5 }, yaw: E, secs: 1.5 });
check('open door lets you through', r.maxX > 34, r);
await page.evaluate(() => { window.__game.teleport({ x: 26.5, z: 26.5, yaw: -Math.PI / 2 }); window.__game.step(1); });
await shot('door-open');
// Back to the start: door shuts, button pops back up
r = await page.evaluate(() => { window.__game.restore(); return window.__game.state(); });
check('reset shuts the door again', r.buttonDoor.solid && !r.buttonDoor.pressed && r.buttonDoor.open === 0, r.buttonDoor);
// The cactus is an Ouch with the cactus message
r = await page.evaluate(({ x, z }) => {
    const g = window.__game;
    g.teleport({ x, z: z - 1.05, yaw: Math.PI });
    g.clearEvents();
    g.setInput({ forward: true });
    for (let i = 0; i < 60; i++) g.step(1);
    g.clearInput();
    return { ev: g.events.map((e) => e.type), msg: document.getElementById('message')?.textContent };
}, st.spike);
check('cactus Ouch', r.ev.includes('spike') && /cactus/.test(r.msg), r);
// Cactus pictures
await page.evaluate(({ x, z }) => { window.__game.teleport({ x, z: z + 2.2, yaw: 0 }); window.__game.step(1); }, st.spike);
await shot('cactus');
// Sneaky cactus not visible from the path is a finder rule; quick look from the path next to its branch
// Press, then reset by touching the cactus: door shuts
r = await page.evaluate(({ x, z }) => {
    const g = window.__game;
    g.teleport({ x: 30.5, z: 14.5 }); g.step(2);
    const pressed = g.state().buttonDoor.pressed;
    g.teleport({ x, z }); g.step(1);
    return { pressed, after: g.state().buttonDoor };
}, st.spike);
check('Ouch sends you back and shuts the door', r.pressed && r.after.solid && !r.after.pressed, r);
// Sky look (from the start, looking up a bit is not possible; just look around)
for (const [name, yaw] of [['sky-n', N], ['sky-w', W], ['sky-s', Sd]]) {
    await page.evaluate((yaw) => { window.__game.teleport({ x: 2.5, z: 22.5, yaw }); window.__game.step(1); }, yaw);
    await shot(name);
}
// Its own door: More levels coming soon! with Quit
r = await page.evaluate(() => {
    const g = window.__game;
    const d = g.state().door;
    g.teleport({ x: d.x - 1.5, z: d.z, yaw: -Math.PI / 2 });
    g.setInput({ forward: true });
    for (let i = 0; i < 40; i++) g.step(1);
    g.clearInput();
    return { escaped: g.state().escaped, text: g.text() };
});
check('L101 door: More levels coming soon! + Quit', r.escaped && r.text.some((t) => /More levels coming soon!/.test(t)) && r.text.some((t) => /Quit/.test(t)) && !r.text.some((t) => /Start/.test(t)), r.text);
await shot('end');
await page.context().close();

// Level 100's end screen
page = await open(BASE + '/?test=1&level=99');
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
r = await page.evaluate(() => {
    const g = window.__game;
    const d = g.state().door;
    g.teleport({ x: d.x - 1.5, z: d.z, yaw: -Math.PI / 2 });
    g.setInput({ forward: true });
    for (let i = 0; i < 40; i++) g.step(1);
    g.clearInput();
    return { escaped: g.state().escaped, text: g.text() };
});
check('L100 end: You beat 100 levels! + Start Desert Pyramid World, no More levels line', r.escaped && r.text.some((t) => /You beat 100 levels!/.test(t)) && r.text.some((t) => t === 'Start Pyramid World') && !r.text.some((t) => /More levels coming soon|Start (Level [0-9]+|[A-Z][a-zA-Z ]* World)/.test(t)), r.text);
await page.screenshot({ path: `${SP}l101-l100end.png` });
// Pick it: Level 101 starts
await page.keyboard.press('Space');
await page.waitForTimeout(500);
r = await page.evaluate(() => window.__game.state().level);
check('Start Pyramid World starts Level 101', r.name === 'Level 101', r);
await page.context().close();

// Saved spot with the button pressed: the door is open after Continue
page = await open(BASE + '/', { 'mazle.progress': { level: 100, x: 28.5, z: 26.5, yaw: -Math.PI / 2, pitch: 0, button: true }, 'mazle.furthest': 100 });
await page.waitForTimeout(6000);
await page.screenshot({ path: `${SP}l101-continue-menu.png` });
await page.keyboard.press('Space');
await page.waitForTimeout(1500);
await page.screenshot({ path: `${SP}l101-continue.png` });
// walk forward 1.5 s: should pass the door
await page.keyboard.down('ArrowUp');
await page.waitForTimeout(1500);
await page.keyboard.up('ArrowUp');
await page.waitForTimeout(300);
await page.screenshot({ path: `${SP}l101-continue-walked.png` });
// Pick a level worlds screen
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
await page.screenshot({ path: `${SP}l101-pause.png` });
await page.context().close();
page = await open(BASE + '/', { 'mazle.furthest': 100, 'mazle.news': { told: [...Array(101).keys()], beaten: 99, fresh: [100] } });
await page.waitForTimeout(6000);
await page.screenshot({ path: `${SP}l101-title.png` });
check('no page errors', errors.length === 0, errors.slice(0, 5));
console.log(results.filter((x) => !x).length ? 'SOME FAILED' : 'ALL PASS');
await browser.close();
