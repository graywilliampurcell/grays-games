// Level 148 checks (served on 9173)
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
await page.goto(BASE + '/?test=1&level=147', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
await page.keyboard.press('Shift');
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 900)); };
const shot = (name) => page.screenshot({ path: `${SP}l148-${name}.png`, timeout: 180000 });
const ONLY = process.env.ONLY;
let st = await page.evaluate(() => window.__game.restore());
const f = st.fireflies[0];
// The cap ride on column 13 (crossed north) and the one on column 7 (crossed south)
const pA = st.platforms.find((p) => p.gap.minX > 50);
const pB = st.platforms.find((p) => p.gap.minX > 28 && p.gap.maxX < 34);
check('Level 148 loads: two cap rides, two sleepy mushrooms, one firefly, nothing else',
    st.level.name === 'Level 148' && st.platforms.length === 2 && st.platforms.every((p) => p.cap && !p.trench) && st.sleepies.length === 2 && st.fireflies.length === 1 && !st.spike && !st.spike2 && st.spikeRows.length === 0 && st.vents.length === 0 && st.geysers.length === 0 && st.fogs.length === 0 && (st.trampolines ?? []).length === 0,
    { f, sleepies: st.sleepies, gaps: st.platforms.map((p) => ({ gap: p.gap, span: p.span, alongX: p.alongX, at: p.at })), level: st.level });
check('firefly (26.5, 14.5); sleepies (34.5, 50.5) and (22.5, 22.5); both gaps along z, 3 wide',
    f.x === 26.5 && f.z === 14.5 && st.sleepies.some((m) => m.x === 34.5 && m.z === 50.5) && st.sleepies.some((m) => m.x === 22.5 && m.z === 22.5) && pA && pB && !pA.alongX && !pB.alongX && pA.gap.maxX - pA.gap.minX === 3 && pB.gap.maxX - pB.gap.minX === 3, { f, s: st.sleepies, A: pA?.gap, B: pB?.gap });
check('tune mushroomrides', (await page.evaluate(() => window.__sound?.tuneName)) === 'mushroomrides', {});
let r;
// A cap ride, walking along z: north (dir -1, start at the gap's south edge) or south (dir 1)
const ride = (args) => page.evaluate(([a]) => {
    const g = window.__game;
    if (!a.keep) g.restore();
    const g0 = a.gap;
    const cx = (g0.minX + g0.maxX) / 2 + (a.off ?? 0);
    const north = a.dir < 0;
    g.teleport({ x: cx, z: north ? g0.maxZ + 1.5 : g0.minZ - 1.5, yaw: north ? 0 : Math.PI });
    g.clearEvents();
    if (a.wait) g.step(a.wait);
    g.setInput({ forward: true });
    let s, departAt = null, landAt = null;
    const t0 = g.time();
    for (let k = 0; k < (a.steps ?? 400); k++) {
        if (a.stopAt !== undefined && s && (north ? s.pos.z <= g0.maxZ - a.stopAt : s.pos.z >= g0.minZ + a.stopAt)) g.clearInput();
        s = g.step(1);
        if (departAt === null && g.events.some((e) => e.type === 'platform' && e.what === 'depart')) departAt = +(g.time() - t0).toFixed(2);
        if (landAt === null && g.events.some((e) => e.type === 'platform' && e.what === 'land')) landAt = +(g.time() - t0).toFixed(2);
        if (g.events.some((e) => e.type === 'fall')) break;
    }
    g.clearInput();
    s = g.step(20);
    return { pos: s.pos, plats: s.platforms.map((p) => ({ minX: p.gap.minX, at: p.at, startAt: p.startAt, target: p.target, riding: p.riding })), departAt, landAt, ev: g.events.map((e) => e.type).filter((e) => ['fall', 'spike'].includes(e)), sounds: g.events.filter((e) => e.type === 'sound').map((e) => e.name) };
}, [args]);
if (!ONLY || ONLY === 'cross') {
    r = await ride({ gap: pA.gap, dir: -1, stopAt: 0.85 });
    check('first cap ride (heading north): stop in the ring, carried over to the far floor', r.ev.length === 0 && r.departAt !== null && r.landAt !== null && r.pos.z < pA.gap.minZ - 0.5, r);
    check('ride time about 1.4 s, whoosh', r.landAt - r.departAt > 1.3 && r.landAt - r.departAt < 1.8 && r.sounds.includes('whoosh'), r);
    const otherB = r.plats.find((p) => p.minX === pB.gap.minX);
    check('the second cap did not move while the first one rode (independent)', otherB.at === otherB.startAt && !otherB.riding, otherB);
    r = await ride({ gap: pB.gap, dir: 1, stopAt: 0.85, keep: true });
    check('second cap ride (heading south) right after: carried over to the far floor', r.ev.length === 0 && r.landAt !== null && r.pos.z > pB.gap.maxZ + 0.5, r);
    const otherA = r.plats.find((p) => p.minX === pA.gap.minX);
    check('the first cap stayed where it set you down (independent)', otherA.at !== otherA.startAt && !otherA.riding, otherA);
    r = await ride({ gap: pB.gap, dir: 1, steps: 400 });
    check('second cap: keep pushing forward, no fall, arrives', r.ev.length === 0 && r.landAt !== null && r.pos.z > pB.gap.maxZ, r);
    r = await ride({ gap: pA.gap, dir: -1, off: 1.05, steps: 200 });
    check('first cap: walk in near the wall beside the cap: acid', r.ev.includes('fall'), r);
    r = await ride({ gap: pB.gap, dir: 1, off: -1.05, steps: 200 });
    check('second cap: walk in near the wall beside the cap: acid', r.ev.includes('fall'), r);
    // Back the other way over each: the cap comes to you
    r = await ride({ gap: pA.gap, dir: 1, wait: 150, steps: 500 });
    check('first cap from the far side: it comes and carries you south', r.ev.length === 0 && r.landAt !== null && r.pos.z > pA.gap.maxZ, r);
    r = await ride({ gap: pB.gap, dir: -1, wait: 150, steps: 500 });
    check('second cap from the far side: it comes and carries you north', r.ev.length === 0 && r.landAt !== null && r.pos.z < pB.gap.minZ, r);
    r = await page.evaluate(() => { const g = window.__game; g.restore(); return g.step(2).platforms.map((p) => p.at === p.startAt); });
    check('a reset sends both caps back to their start sides', r.every(Boolean), r);
}
if (!ONLY || ONLY === 'sleepy') {
    // Walk into each sleepy mushroom along the path (first heading east, second heading north)
    const walk = (m, dir, off) => page.evaluate(([m, dir, off]) => {
        const g = window.__game;
        g.restore();
        const east = dir === 'east';
        g.teleport(east ? { x: m.x - 3.5, z: m.z + off, yaw: -Math.PI / 2 } : { x: m.x + off, z: m.z + 3.5, yaw: 0 });
        g.clearEvents();
        g.setInput({ forward: true });
        let s, touchAt = null, closest = 99;
        const t0 = g.time();
        for (let k = 0; k < 150; k++) {
            s = g.step(1);
            closest = Math.min(closest, Math.hypot(s.pos.x - m.x, s.pos.z - m.z));
            if (touchAt === null && g.events.some((e) => e.type === 'sleepy')) touchAt = +(g.time() - t0).toFixed(2);
        }
        g.clearInput();
        return { pos: s.pos, closest: +closest.toFixed(2), touchAt, sleepy: s.sleepy, ev: g.events.map((e) => e.type).filter((e) => ['spike', 'fall'].includes(e)), sounds: g.events.filter((e) => e.type === 'sound').map((e) => e.name) };
    }, [m, dir, off]);
    const m1 = st.sleepies.find((m) => m.z === 50.5);
    const m2 = st.sleepies.find((m) => m.z === 22.5);
    for (const [m, dir, name] of [[m1, 'east', 'first'], [m2, 'north', 'second']]) {
        r = await walk(m, dir, 0);
        check(`${name} sleepy mushroom: walk into it, solid, sleepy (half speed, shown), yawn, not an Ouch`, r.touchAt !== null && r.closest >= 0.85 && r.sleepy.left > 4 && r.sleepy.speed === 0.5 && r.sleepy.shown && r.ev.length === 0 && r.sounds.includes('sleepy'), r);
        for (const off of [1.05, -1.05]) {
            r = await walk(m, dir, off);
            const past = dir === 'east' ? r.pos.x > m.x + 1 : r.pos.z < m.z - 1;
            check(`${name}: squeeze past at ${off} off the middle, not sleepy`, past && r.touchAt === null, r);
        }
    }
    // Touch the first, walk on and touch the second: the 5 s starts over
    r = await page.evaluate(([m1, m2]) => {
        const g = window.__game;
        g.restore();
        g.teleport({ x: m1.x - 0.85, z: m1.z, yaw: -Math.PI / 2 });
        g.step(2);
        const a = g.state().sleepy.left;
        g.teleport({ x: m1.x - 3, z: m1.z, yaw: Math.PI / 2 });
        g.step(120);
        const b = g.state().sleepy.left;
        g.teleport({ x: m2.x, z: m2.z + 0.85, yaw: 0 });
        g.step(2);
        const c = g.state().sleepy.left;
        return { a, b, c };
    }, [m1, m2]);
    check('touch one, then the other 2 s later: the 5 s starts over', r.a > 4.9 && r.b < 3.1 && r.c > 4.9, r);
}
// Stand in the firefly's hallway facing it (east), from the moment it turns bright
const FIND = `(g, to) => { for (let k = 0; k < 400; k++) { if (g.state().fireflies[0].bright === to) return; g.step(1); } }`;
const stare = (a) => page.evaluate(([F, f, a]) => {
    const g = window.__game;
    const find = eval(F);
    g.restore();
    g.teleport({ x: a.x ?? f.x - 9, z: a.z ?? f.z, yaw: a.yaw ?? -Math.PI / 2 });
    find(g, a.dim ? true : false); find(g, a.dim ? false : true);
    g.clearEvents();
    const t0 = g.time();
    let ouchAt = null, maxStare = 0;
    for (let k = 0; k < (a.steps ?? 110); k++) {
        const s = g.step(1);
        maxStare = Math.max(maxStare, s.fireflyStare);
        if (ouchAt === null && g.events.some((e) => e.type === 'spike' && e.what === 'firefly')) ouchAt = +(g.time() - t0).toFixed(2);
    }
    const s = g.state();
    return { ouchAt, maxStare: +maxStare.toFixed(2), pos: s.pos, start: s.start, msg: g.text() };
}, [FIND, f, a]);
if (!ONLY || ONLY === 'stare') {
    r = await stare({});
    check('firefly: face it while bright, Ouch after about 1.0 s, back to the start', r.ouchAt !== null && r.ouchAt >= 0.96 && r.ouchAt < 1.06 && Math.hypot(r.pos.x - r.start.x, r.pos.z - r.start.z) < 0.1 && JSON.stringify(r.msg).includes('The firefly was too bright'), r);
    r = await stare({ dim: true, steps: 170 });
    check('firefly: face it while dim, safe', r.ouchAt === null && r.maxStare === 0, r);
    r = await stare({ yaw: Math.PI / 2, steps: 115 });
    check('firefly: back to it while bright, safe', r.ouchAt === null && r.maxStare === 0, r);
}
if (!ONLY || ONLY === 'shots') {
    await page.evaluate(([f]) => { const g = window.__game; g.restore(); g.teleport({ x: f.x - 10, z: f.z, yaw: -Math.PI / 2 }); g.step(10); }, [f]);
    await shot('firefly');
    for (const [p, n, north] of [[pA, 'capA', true], [pB, 'capB', false]]) {
        await page.evaluate(([g0, north]) => { const g = window.__game; g.restore(); g.teleport({ x: (g0.minX + g0.maxX) / 2, z: north ? g0.maxZ + 3 : g0.minZ - 3, yaw: north ? 0 : Math.PI }); g.step(10); }, [p.gap, north]);
        await shot(n);
    }
    await page.evaluate(([m]) => { const g = window.__game; g.restore(); g.teleport({ x: m.x - 4, z: m.z, yaw: -Math.PI / 2 }); g.step(10); }, [st.sleepies.find((m) => m.z === 50.5)]);
    await shot('sleepy1');
    await page.evaluate(([m]) => { const g = window.__game; g.restore(); g.teleport({ x: m.x, z: m.z + 4, yaw: 0 }); g.step(10); }, [st.sleepies.find((m) => m.z === 22.5)]);
    await shot('sleepy2');
    await page.evaluate(() => { const g = window.__game; g.restore(); g.teleport({ yaw: -Math.PI / 2 }); g.step(2); });
    await shot('start');
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
    await page2.goto(BASE + '/?test=1&level=146', { waitUntil: 'domcontentloaded', timeout: 90000 });
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
    check('Level 147 door: You did it! Start Level 148', r.escaped && r.items.some((x) => x.includes('Level 148')), r);
    check('no page errors (prev)', errors.length === 0, errors);
}
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
