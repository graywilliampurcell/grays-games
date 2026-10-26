// Iteration 172: the bright firefly must give "Ouch!" when you walk down its
// hallway facing it, in every level that has one (144, 146, 148, 149, 150).
// Gray walked at a firefly while it was bright and survived. Each check walks
// (or stands) in the firefly's own hallway, facing it, the moment it turns
// bright, and expects the Ouch about 1 s later. Served on 9173.
import { chromium, BASE, SHOTS } from '../playwright.mjs';
import fs from 'fs';
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1024, height: 640 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 700)); };

// One run in the hallway of firefly i: start `from` units from it (along the
// hallway, facing it, tilted by `pitch` radians), wait till it turns bright,
// then walk (or stand) and report when the Ouch came and how far away you were.
const run = (level, i, a) => page.evaluate(([level, i, a]) => {
    const g = window.__game;
    let s = g.restore();
    const f = s.fireflies[i];
    const grid = s.grid;
    const open = (x, z) => grid[z]?.[x] !== undefined && grid[z][x] !== '#' && grid[z][x] !== 'D';
    // the hallway: the longest straight open run from the firefly
    let best = null;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        let n = 0;
        while (open(Math.floor(f.x + dx * (n + 1)), Math.floor(f.z + dz * (n + 1)))) n++;
        if (!best || n > best.n) best = { dx, dz, n };
    }
    const from = Math.min(a.from, best.n);
    const x = f.x + best.dx * from, z = f.z + best.dz * from;
    // yaw: the camera looks down -z at yaw 0; yaw turns it toward -x
    const yaw = Math.atan2(best.dx, best.dz);
    g.teleport({ x, z, yaw });
    // wait till it turns bright (or `lead` seconds before, when walking in
    // early); jump most of the way in one go, since every step draws the view
    const F = g.maze().fireflies[i];
    const lead = a.lead ?? 0;
    const wait = ((F.time < 3 ? 3 - F.time : 8 - F.time) - lead) / g.dt;
    if (wait > 2) g.step(Math.floor(wait) - 1);
    g.teleport({ x, z, yaw });
    // tilt the view up or down (after the teleport, which levels it)
    if (a.pitch) { g.setInput({ lookDy: -a.pitch / 0.003 }); g.step(1); g.clearInput(); }
    if (a.walk) g.setInput({ forward: true });
    for (let k = 0; k < 120 && !F.bright; k++) g.step(1);
    g.clearEvents();
    const t0 = g.time();
    let ouchAt = null, dist = null, minDist = 99;
    for (let k = 0; k < 110; k++) {
        s = g.step(1);
        const d = Math.hypot(s.pos.x - f.x, s.pos.z - f.z);
        minDist = Math.min(minDist, d);
        if (g.events.some((e) => e.type === 'spike' && e.what === 'firefly')) { ouchAt = +(g.time() - t0).toFixed(2); dist = +d.toFixed(2); break; }
        if (!s.fireflies[i].bright) break;
    }
    g.clearInput();
    return { level: level + 1, f: [f.x, f.z], hall: best, from, ouchAt, dist, minDist: +minDist.toFixed(2), pitch: +g.state().pitch.toFixed(2) };
}, [level, i, a]);

for (const [level, count] of [[143, 1], [145, 1], [147, 1], [148, 2], [149, 2]]) {
    await page.goto(BASE + '/?test=1&level=' + level, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
    for (let i = 0; i < count; i++) {
        const name = `Level ${level + 1} firefly ${i + 1}`;
        let r = await run(level, i, { from: 12, walk: true });
        check(`${name}: walk down its hallway at it while it's bright: Ouch after about 1 s`, r.ouchAt !== null && r.ouchAt >= 0.96 && r.ouchAt < 1.1, r);
        r = await run(level, i, { from: 12, walk: true, lead: 0.4 });
        check(`${name}: walking at it already, it turns bright about 9 away: Ouch after about 1 s, before you're under it`, r.ouchAt !== null && r.ouchAt >= 0.96 && r.ouchAt < 1.1 && r.dist >= 1, r);
        r = await run(level, i, { from: 3, walk: false });
        check(`${name}: stand 3 away facing it: Ouch after about 1 s`, r.ouchAt !== null && r.ouchAt >= 0.96 && r.ouchAt < 1.1, r);
        r = await run(level, i, { from: 8, walk: false, pitch: -0.35 });
        check(`${name}: looking a bit down (about 20 deg), facing it: still Ouch`, r.ouchAt !== null && r.ouchAt >= 0.96 && r.ouchAt < 1.1, r);
        r = await run(level, i, { from: 8, walk: false, pitch: 0.35 });
        check(`${name}: looking a bit up (about 20 deg), facing it: still Ouch`, r.ouchAt !== null && r.ouchAt >= 0.96 && r.ouchAt < 1.1, r);
        r = await run(level, i, { from: 0.6, walk: false });
        check(`${name}: right under it (0.6 away): safe`, r.ouchAt === null, r);
    }
}
check('no page errors', errors.length === 0, errors);
await browser.close();
const failed = results.filter((x) => !x).length;
console.log(failed ? `${failed} FAILED` : 'ALL PASS');
process.exit(failed ? 1 : 0);
