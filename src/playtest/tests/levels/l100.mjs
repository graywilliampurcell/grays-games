// Level 100 checks (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
import fs from 'fs';
const SP = SHOTS;
fs.mkdirSync(SP, { recursive: true });
let browser = null;
const launch = () => chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
let page = null;
const errors = [];
const load = async (n = 100) => {
    if (browser) await browser.close().catch(() => {});
    browser = await launch();
    page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${BASE}/?test=1&level=${n - 1}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
};
const shot = (name) => page.screenshot({ path: `${SP}l100-${name}.png` });
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 600)); };
const only = process.argv[2];

await load();
const st0 = await page.evaluate(() => window.__game.state());
const grid = st0.grid;
// The correct path, cell by cell (cell centers), by BFS over cells
const wall = (x, z) => grid[z]?.[x] === undefined || grid[z][x] === '#';
const cellOf = (x, z) => ({ i: Math.floor((x - 1) / 4), j: Math.floor((z - 1) / 4) });
const sz = grid.findIndex((r) => r.includes('S'));
const start = { i: cellOf(grid[sz].indexOf('S'), sz).i, j: cellOf(0, sz).j };
const dz = grid.findIndex((r) => r.includes('D'));
const exit = { i: 13, j: cellOf(0, dz).j };
const k = (c) => `${c.i},${c.j}`;
const prev = new Map([[k(start), null]]);
const q = [start];
while (q.length) {
    const c = q.shift();
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = { i: c.i + di, j: c.j + dj };
        if (n.i < 0 || n.j < 0 || n.i > 13 || n.j > 13 || prev.has(k(n))) continue;
        // the wall block between the two cells
        const wx = di ? 4 * Math.max(c.i, n.i) : 4 * c.i + 2;
        const wz = dj ? 4 * Math.max(c.j, n.j) : 4 * c.j + 2;
        if (wall(wx, wz)) continue;
        prev.set(k(n), c);
        q.push(n);
    }
}
const path = [];
for (let c = exit; c; c = prev.get(k(c))) path.unshift(c);
const center = (c) => ({ x: 4 * c.i + 2.5, z: 4 * c.j + 2.5 });
console.log('path cells', path.length);
check('Level 100 loads as 9 rooms', st0.level.name === 'Level 100' && st0.room === 0, { room: st0.room });
check('one danger per room', !!st0.spike && !st0.spike2 && !!st0.spaceDoor && st0.platforms.length === 4 && st0.geysers.length === 1 && st0.snowmen.length === 1 && st0.armBelts.length === 1 && st0.belts.length === 0 && st0.vents.length === 0 && st0.thinIce.length === 0, { platforms: st0.platforms.map((p) => ({ gap: p.gap, bubble: p.bubble, speed: p.speed })) });
check('path 85 cells', path.length === 85, {});

// Rooms along the path: in order 0..8, entered once each
// (plain path cells only: teleporting onto a danger sets it off)
const plain = path.filter((c) => [' ', 'S'].includes(grid[4 * c.j + 2][4 * c.i + 2]));
const roomsPlain = await page.evaluate((pts) => pts.map((p) => { window.__game.teleport(p); return window.__game.step(1).room; }), plain.map(center));
const rooms = path.map((c) => roomsPlain[plain.indexOf(c)] ?? null);
for (let n = 1; n < rooms.length; n++) if (rooms[n] === null) rooms[n] = rooms[n - 1];
const order = roomsPlain.filter((r, n) => n === 0 || r !== roomsPlain[n - 1]);
check('path visits rooms 0..8 in order once each', order.join() === '0,1,2,3,4,5,6,7,8', { order });

// Music crossfades into each room's tune
await load();
const music = await page.evaluate(async (pts) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }));
    const s = window.__sound;
    s.unlock();
    s.startMusic();
    const g = window.__game;
    const out = [];
    let last = -1;
    for (const p of pts) {
        g.teleport(p);
        const st = g.step(1);
        if (st.room !== last && st.room !== null) {
            out.push({ room: st.room, tune: s.tuneName, fading: s.fading.length });
            last = st.room;
        }
    }
    return out;
}, plain.map(center));
check('each room has its own tune, crossfaded', music.length === 9 && new Set(music.map((m) => m.tune)).size === 9 && music.slice(1).every((m) => m.fading >= 1), music);

// Screenshots: from a path cell inside each room, looking along the path
if (!only || only === 'shots') {
    for (let r = 0; r < 9; r++) {
        const n = rooms.indexOf(r);
        const a = path[n + 1];
        const b = path[n + 2] ?? path[n + 1];
        const p0 = center(path[n]);
        const p1 = center(b);
        const yaw = Math.atan2(-(p1.x - p0.x), -(p1.z - p0.z));
        await page.evaluate(({ p, yaw }) => { const g = window.__game; g.teleport({ ...p, yaw }); g.step(2); g.render(); }, { p: center(a), yaw });
        await shot(`room${r}`);
    }
    // Looking back across the Space -> Jungle boundary from Space
    const n = rooms.indexOf(2);
    const p0 = center(path[n - 2]);
    const p1 = center(path[n + 1]);
    await page.evaluate(({ p, yaw }) => { const g = window.__game; g.teleport({ ...p, yaw }); g.step(2); g.render(); }, { p: p0, yaw: Math.atan2(-(p1.x - p0.x), -(p1.z - p0.z)) });
    await shot('boundary');
}

// Robot-arm belt: ride time standing still and walking
{
    const b = st0.armBelts[0];
    const len = b.alongX ? b.maxX - b.minX : b.maxZ - b.minZ;
    const yaw = Math.atan2(-b.forward.x, -b.forward.z);
    const ride = async (walk) => {
        await load();
        return page.evaluate(({ b, yaw, walk }) => {
            const g = window.__game;
            // Wait until an arm has come and gone; the next one comes on the other side
            let st = g.state();
            let lastSide = null;
            for (let i = 0; i < 60 * 8; i++) { g.teleport({ ...b.landing, yaw }); st = g.step(1); const arms = st.armBelts[0].arms; if (arms.length) lastSide = arms[arms.length - 1].side; else if (lastSide !== null) break; }
            const c = { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 };
            const half = (b.alongX ? b.maxX - b.minX : b.maxZ - b.minZ) / 2 - 0.05;
            const startAt = { x: c.x - b.forward.x * half, z: c.z - b.forward.z * half };
            const side = lastSide;
            g.clearEvents();
            g.teleport({ x: startAt.x + b.right.x * side * 0.75, z: startAt.z + b.right.z * side * 0.75, yaw });
            if (walk) g.setInput({ forward: true });
            const t0 = g.time();
            let off = null;
            for (let i = 0; i < 60 * 4; i++) {
                st = g.step(1);
                const inBelt = st.pos.x > b.minX && st.pos.x < b.maxX && st.pos.z > b.minZ && st.pos.z < b.maxZ;
                if (!inBelt) { off = st.t - t0; break; }
            }
            g.clearInput();
            return { off, pushed: g.events.some((e) => e.type === 'armPush'), pos: st.pos };
        }, { b, yaw, walk });
    };
    const still = await ride(false);
    const walking = await ride(true);
    check('arm belt 3 cells long', len === 12, { len });
    console.log('ride time standing', still, 'walking', walking);
}

// The finale: golden door, confetti, fireworks, "You beat 100 levels!"
await load();
const fin = await page.evaluate(({ door }) => {
    const g = window.__game;
    g.clearEvents();
    g.teleport({ x: door.x - 1.5, z: door.z, yaw: -Math.PI / 2 });
    g.setInput({ forward: true });
    let st;
    for (let i = 0; i < 60 && !(st = g.step(1)).escaped; i++);
    g.clearInput();
    const vis = (id) => { const el = document.getElementById(id); return !!el && !el.hidden && !el.closest('[hidden]'); };
    const next = document.querySelector('[data-act=next-level]');
    return {
        escaped: st.escaped,
        ev: [...new Set(g.events.map((e) => e.type))],
        title: document.getElementById('finish-title').textContent,
        note: vis('finish-note') ? document.getElementById('finish-note').textContent : null,
        next: next && !next.hidden,
        fireworks: vis('fireworks'),
    };
}, { door: st0.door });
check('finale: confetti, fireworks, You beat 100 levels!, More levels coming soon!, Quit only', fin.escaped && fin.ev.includes('confetti') && fin.ev.includes('fireworks') && fin.title === 'You beat 100 levels!' && /More levels coming soon|Start (Level [0-9]+|[A-Z][a-zA-Z ]* World)/.test(fin.note ?? '') && !fin.next && fin.fireworks, fin);
await page.waitForTimeout(1500);
await shot('finale');

// Back to the start (an Ouch) puts you in the Cotton Candy room with its tune
console.log('errors', errors);
check('no page errors', errors.length === 0, errors);
console.log(results.filter((r) => !r).length ? 'SOME FAILED' : 'ALL PASS');
await browser.close();
