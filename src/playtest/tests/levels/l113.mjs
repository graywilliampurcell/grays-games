// Level 113 checks (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
import fs from 'fs';
const SP = SHOTS;
fs.mkdirSync(SP, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 700)); };

async function open(query) {
    const ctx = await browser.newContext({ viewport: { width: 1024, height: 640 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${BASE}/?test=1&level=112${query}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
    await page.keyboard.press('Shift'); // sound starts
    await page.evaluate(() => window.__game.restore());
    return page;
}
const shot = async (page, name) => { const t = Date.now(); await page.screenshot({ path: `${SP}l113-${name}.png`, timeout: 180000 }); console.log('shot', name, Date.now() - t, 'ms'); };

// Walk the player (teleporting in small steps at walking speed) along points
const WALK = `
window.__walk = (points) => {
    const g = window.__game;
    let s = g.state();
    for (const [x, z] of points) {
        for (let tries = 0; tries < 40; tries++) {
            const dx = x - s.pos.x, dz = z - s.pos.z;
            const d = Math.hypot(dx, dz);
            if (d < 0.3) break;
            const yaw = Math.atan2(-dx, -dz);
            s = g.teleport({ yaw });
            g.setInput({ forward: true });
            let n = 0;
            for (; n < 20; n++) {
                s = g.step(2);
                if (s.escaped) { g.clearInput(); return s; }
                const ex = x - s.pos.x, ez = z - s.pos.z;
                if (Math.hypot(ex, ez) < 0.3 || ex * dx + ez * dz < 0) break;
            }
            g.clearInput();
            s = g.step(1);
        }
    }
    return s;
};
window.__center = ([i, j]) => [4 * i + 2.5, 4 * j + 2.5];
`;
const page = await open('&lost=1');
await page.addScriptTag({ content: WALK });
let st = await page.evaluate(() => window.__game.state());
check('Level 113 loads: 3 fossils, one long-neck, no tail, no spikes', st.level.name === 'Level 113' && st.fossils.length === 3 && st.platforms.length === 1 && (st.tails ?? []).length === 0 && !st.spike && !st.spike2 && st.spikeRows.length === 0, { f: st.fossils, p: st.platforms.length });
check('fossil looks: skull, shell, footprint', st.fossils.map((f) => f.kind).join() === 'skull,shell,footprint', st.fossils);
check('counter shows 🦴 0 / 3, door locked, lock shown', st.fossilCounter === '🦴 0 / 3' && st.doorLocked && st.doorLockVisible, { c: st.fossilCounter, l: st.doorLocked, v: st.doorLockVisible });
check('tune dinofossil', (await page.evaluate(() => window.__sound?.tuneName)) === 'dinofossil', {});

// Geometry helpers in the page
const geo = await page.evaluate(() => {
    const s = window.__game.state();
    const path = s.buddy.path;
    const key = (c) => c.join(',');
    const on = new Set(path.map(key));
    const grid = s.grid;
    const open = (x, z) => grid[z]?.[x] !== undefined && grid[z][x] !== '#' && grid[z][x] !== 'D';
    const links = ([i, j]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([di, dj]) => open(4 * i + 2 + 2 * di, 4 * j + 2 + 2 * dj)).map(([di, dj]) => [i + di, j + dj]);
    const fossilWays = s.fossils.map((f) => {
        const F = [Math.floor((f.x - 1) / 4), Math.floor((f.z - 1) / 4)];
        const W = links(F)[0];
        const P = links(W).find((c) => on.has(key(c)));
        return { F, W, P, k: path.findIndex((c) => key(c) === key(P)) };
    });
    const inFossil = new Set(fossilWays.flatMap((w) => [key(w.F), key(w.W)]));
    // A plain wrong way (no fossil) off the path, and how far along
    let plain = null;
    for (let k = 3; k < path.length && !plain; k++) {
        const off = links(path[k]).find((c) => !on.has(key(c)) && !inFossil.has(key(c)));
        if (off) plain = { k, off };
    }
    return { path, fossilWays, plain };
});
console.log('fossil ways', JSON.stringify(geo.fossilWays), 'plain', JSON.stringify(geo.plain));

// Walking up to the locked door: the message once, nothing starts, it stays solid
let r = await page.evaluate((geo) => {
    const g = window.__game;
    const last = geo.path[geo.path.length - 1];
    g.teleport({ x: 4 * last[0] + 2.5, z: 4 * last[1] + 2.5 });
    g.clearEvents();
    let s = window.__walk([[4 * last[0] + 2.5 + 3, 4 * last[1] + 2.5]]);
    g.setInput({ forward: true });
    s = g.step(90);
    g.clearInput();
    const msgs = g.events.filter((e) => e.type === 'message').map((e) => e.text);
    return { pos: s.pos, escaped: s.escaped, msgs, locked: g.events.filter((e) => e.type === 'lockedDoor').length, text: g.text() };
}, geo);
check('locked door: "Find all 3 fossils first!" once, no escape, solid', !r.escaped && r.locked === 1 && r.msgs.length === 1 && r.msgs[0] === 'Find all 3 fossils first!' && r.pos.x < 44.2, r);
await shot(page, 'locked-door');

// Fossil 1: walk down its wrong way and pick it up
const getFossil = (n) => page.evaluate(({ geo, n }) => {
    const g = window.__game;
    const w = geo.fossilWays[n];
    g.teleport({ x: 4 * w.P[0] + 2.5, z: 4 * w.P[1] + 2.5 });
    g.step(1);
    g.clearEvents();
    const s = window.__walk([window.__center(w.W), window.__center(w.F)]);
    return { s, ev: g.events.filter((e) => ['fossil', 'fossilUnlock', 'sound'].includes(e.type)).map((e) => e.type + ':' + (e.name ?? e.found ?? '')) };
}, { geo, n });
// Views of each fossil from the cell before it
for (const n of [0, 1, 2]) {
    await page.evaluate(({ geo, n }) => {
        const g = window.__game;
        const w = geo.fossilWays[n];
        const [px, pz] = window.__center(w.W), [fx, fz] = window.__center(w.F);
        g.teleport({ x: px - (fx - px) * 0.35, z: pz - (fz - pz) * 0.35, yaw: Math.atan2(-(fx - px), -(fz - pz)) });
        g.step(2);
    }, { geo, n });
    await shot(page, `fossil${n + 1}-view`);
}
r = await getFossil(0);
check('fossil 1 picked up with a ding, counter 1 / 3', r.s.fossils[0].collected && r.s.fossilCounter === '🦴 1 / 3' && r.ev.includes('sound:ding') && r.ev.includes('fossil:1') && r.s.doorLocked, r.ev);

// Falling in the pit (back to the start): fossil 1 stays found
r = await page.evaluate(() => {
    const g = window.__game;
    const p = g.state().platforms[0];
    g.clearEvents();
    // walk into the far end of the pit (head is resting at the near/start side or far side)
    const cx = (p.gap.minX + p.gap.maxX) / 2;
    g.teleport({ x: cx, z: p.gap.minZ + 1.5 });
    const s = g.step(3);
    return { s, ev: g.events.map((e) => e.type) };
});
check('fell in the pit: back to start, fossil 1 still found, counter 1 / 3', r.ev.includes('fall') && r.s.fossils[0].collected && r.s.fossilCounter === '🦴 1 / 3', { ev: r.ev, c: r.s.fossilCounter });

// Ride the long-neck across: from the pit's south edge onto the head, ride north
r = await page.evaluate(() => {
    const g = window.__game;
    const p0 = g.state().platforms[0];
    const cx = (p0.gap.minX + p0.gap.maxX) / 2;
    g.teleport({ x: cx, z: p0.gap.maxZ + 1.0, yaw: 0 });
    g.clearEvents();
    let s = g.step(10);
    const log = [];
    g.setInput({ forward: true });
    for (let n = 0; n < 40 && !s.platforms[0].riding; n++) s = g.step(3);
    g.clearInput();
    log.push({ riding: s.platforms[0].riding, z: s.pos.z });
    for (let n = 0; n < 60 && !(s.pos.z < p0.gap.minZ + 1.5 && s.platforms[0].phase === 'rest'); n++) s = g.step(10);
    log.push({ z: s.pos.z, phase: s.platforms[0].phase });
    g.setInput({ forward: true });
    s = g.step(40);
    g.clearInput();
    return { pos: s.pos, log, ev: g.events.map((e) => e.type).filter((t) => t !== 'sound') };
});
check('rode the long-neck across the pit (no fall)', !r.ev.includes('fall') && r.pos.z < 21, r);

// Fossils 2 and 3: the 3rd pops the lock off with a click
r = await getFossil(1);
check('fossil 2: counter 2 / 3, still locked', r.s.fossilCounter === '🦴 2 / 3' && r.s.doorLocked, r.ev);
r = await getFossil(2);
check('fossil 3: counter 3 / 3, unlocked with a click', r.s.fossilCounter === '🦴 3 / 3' && !r.s.doorLocked && r.ev.includes('fossilUnlock') && r.ev.includes('sound:click') && r.ev.includes('sound:ding'), r.ev);
st = await page.evaluate(() => window.__game.step(60));
check('the padlock is gone after popping off', !st.doorLockVisible, {});

// Picture of the door from a few steps back, locked (before) and unlocked (now)
const doorView = (geo) => {
    const g = window.__game;
    const last = geo.path[geo.path.length - 1];
    g.teleport({ x: 4 * last[0] + 2.5 - 3, z: 4 * last[1] + 2.5, yaw: -Math.PI / 2 });
    g.step(1);
};
await page.evaluate(doorView, geo);
await shot(page, 'door-unlocked');

// Through the door now
r = await page.evaluate((geo) => {
    const g = window.__game;
    const last = geo.path[geo.path.length - 1];
    g.clearEvents();
    const s = window.__walk([[4 * last[0] + 2.5 + 3, 4 * last[1] + 2.5]]);
    return { escaped: s.escaped, text: g.text() };
}, geo);
check('door works after all 3: escape, More levels coming soon!', r.escaped && r.text.some((t) => t.match(/More levels coming soon|Start (Level [0-9]+|[A-Z][a-zA-Z ]* World)/) !== null), r);

// Starting the level again: no fossils, locked again
st = await page.evaluate(() => window.__game.restore());
check('starting again: 0 / 3 and locked with the padlock', st.fossilCounter === '🦴 0 / 3' && st.doorLocked && st.doorLockVisible && st.fossils.every((f) => !f.collected), { c: st.fossilCounter });
await page.evaluate(doorView, geo);
await shot(page, 'door-locked');

// The lost rule: going down a fossil's wrong way doesn't count; plain ones do
r = await page.evaluate((geo) => {
    const g = window.__game;
    const w = geo.fossilWays[2]; // off path cell 28
    g.teleport({ x: 4 * w.P[0] + 2.5, z: 4 * w.P[1] + 2.5 });
    g.step(2);
    g.clearEvents();
    const asked = [];
    for (let n = 0; n < 3; n++) {
        window.__walk([window.__center(w.W), window.__center(w.P)]);
        for (const e of g.events.splice(0)) if (e.type === 'lost') asked.push(n);
    }
    const fossilWays = g.state().buddy.wrongWays;
    // a plain wrong way three times, from a cell before path cell 28
    const p = geo.plain;
    g.teleport({ x: 4 * geo.path[p.k][0] + 2.5, z: 4 * geo.path[p.k][1] + 2.5 });
    g.step(2);
    const asked2 = [];
    for (let n = 0; n < 3; n++) {
        window.__walk([window.__center(p.off), window.__center(geo.path[p.k])]);
        for (const e of g.events.splice(0)) if (e.type === 'lost') asked2.push(n);
    }
    return { asked, fossilWays, asked2, collected: g.state().fossils.map((f) => f.collected) };
}, geo);
check('lost rule: fossil wrong way x3 does not ask; plain wrong way x3 asks', r.asked.length === 0 && r.fossilWays === 0 && r.asked2.length === 1, r);
