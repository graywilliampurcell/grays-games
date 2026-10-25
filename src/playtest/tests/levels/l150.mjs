// Level 150 checks (served on 9173)
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
await page.goto(BASE + '/?test=1&level=149', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
await page.keyboard.press('Shift');
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 900)); };
const shot = (name) => page.screenshot({ path: `${SP}l150-${name}.png`, timeout: 180000 });
const ONLY = process.env.ONLY;
let st = await page.evaluate(() => window.__game.restore());
const P = st.platforms;
const T = P.filter((p) => p.trench), C = P.filter((p) => p.cap && !p.trench);
const F = st.fogs[0];
const golden = await page.evaluate(() => window.__game.maze().golden === true);
check('Level 150 loads: 2 trenches, 2 caps, 1 sleepy, 2 fireflies, 1 swarm, path Z, big Y, sneaky X, golden door, nothing else',
    st.level.name === 'Level 150' && P.length === 4 && T.length === 2 && C.length === 2 && st.sleepies.length === 1 && st.fireflies.length === 2 && st.fogs.length === 1 && F.swarm && !!st.spike && !!st.spike2 && st.spikeRows.length === 1 && st.vents.length === 0 && st.geysers.length === 0 && st.belts.length === 0 && (st.trampolines ?? []).length === 0 && st.winds.length === 0 && golden,
    { P: P.map((p) => ({ gap: p.gap, alongX: p.alongX, trench: p.trench, cap: p.cap })), s: st.sleepies, f: st.fireflies, F, spike: st.spike, spike2: st.spike2, rows: st.spikeRows, golden });
const rad = await page.evaluate(() => ({ r1: window.__game.maze().spikeRadius, r2: window.__game.maze().spike2Radius }));
check('path Ouch mushroom has Level 60\'s squeeze (0.72)', rad.r2 === 0.72 && st.spike2.x === 54.5 && st.spike2.z === 10.5, { rad, s2: st.spike2 });
check('tune mushroomfinale', (await page.evaluate(() => window.__sound?.tuneName)) === 'mushroomfinale', {});
let r;
// Generic walk: from, yaw, steps; stopWhen (pos -> bool) clears input
const walk = (a) => page.evaluate(([a]) => {
    const g = window.__game;
    if (!a.keep) g.restore();
    g.teleport(a.from);
    g.clearEvents();
    if (a.wait) g.step(a.wait);
    g.setInput({ forward: true });
    let s;
    const at = {};
    const t0 = g.time();
    const stop = a.stop ? eval(a.stop) : null;
    for (let k = 0; k < (a.steps ?? 300); k++) {
        if (stop && s && stop(s.pos)) g.clearInput();
        s = g.step(1);
        for (const e of g.events) { const n = e.type + ':' + (e.what ?? ''); if (at[n] === undefined) at[n] = +(g.time() - t0).toFixed(2); }
        if (g.events.some((e) => e.type === 'fall' || e.type === 'spike')) break;
    }
    g.clearInput();
    s = g.step(20);
    return { at, pos: s.pos, start: s.start, sleepy: s.sleepy, msg: g.text(), ev: [...new Set(g.events.map((e) => e.type))], sounds: g.events.filter((e) => e.type === 'sound').map((e) => e.name) };
}, [a]);
const mid = (g) => ({ x: (g.minX + g.maxX) / 2, z: (g.minZ + g.maxZ) / 2 });
const YAW = { east: -Math.PI / 2, west: Math.PI / 2, north: 0, south: Math.PI };
const before = (gap, dir, d = 1.5, off = 0) => {
    const m = mid(gap);
    if (dir === 'east') return { x: gap.minX - d, z: m.z + off, yaw: YAW.east };
    if (dir === 'west') return { x: gap.maxX + d, z: m.z + off, yaw: YAW.west };
    if (dir === 'south') return { x: m.x + off, z: gap.minZ - d, yaw: YAW.south };
    return { x: m.x + off, z: gap.maxZ + d, yaw: YAW.north };
};
const past = (gap, dir, pos) => dir === 'east' ? pos.x > gap.maxX + 0.5 : dir === 'west' ? pos.x < gap.minX - 0.5 : dir === 'south' ? pos.z > gap.maxZ + 0.5 : pos.z < gap.minZ - 0.5;
const ringStop = (gap, dir) => dir === 'east' ? `(p) => p.x >= ${gap.minX + 0.85}` : dir === 'west' ? `(p) => p.x <= ${gap.maxX - 0.85}` : dir === 'south' ? `(p) => p.z >= ${gap.minZ + 0.85}` : `(p) => p.z <= ${gap.maxZ - 0.85}`;
const tA = T.find((p) => p.gap.minZ < 8), tB = T.find((p) => p.gap.minZ > 8);
const cA = C.find((p) => p.alongX), cB = C.find((p) => !p.alongX);
if (!ONLY || ONLY === 'trench') {
    for (const [p, dir, name] of [[tA, 'east', 'first trench (heading east)'], [tB, 'west', 'second trench (heading west)']]) {
        r = await walk({ from: before(p.gap, dir), steps: 420 });
        check(`${name}: drop, bounce, bounce, land on the far floor, 2.5 s`, !r.ev.includes('fall') && r.at['trench:land'] !== undefined && Math.abs(r.at['trench:land'] - r.at['trench:bounce'] - 2.5) < 0.15 && past(p.gap, dir, r.pos), r);
        r = await walk({ from: before(p.gap, dir, 1.5, 1.05), steps: 420 });
        check(`${name}: walk off near the wall: acid`, r.ev.includes('fall') && JSON.stringify(r.msg).includes('acid'), r);
    }
}
if (!ONLY || ONLY === 'cap') {
    for (const [p, dir, name] of [[cA, 'east', 'first cap ride (heading east)'], [cB, 'south', 'second cap ride (heading south)']]) {
        r = await walk({ from: before(p.gap, dir), stop: ringStop(p.gap, dir), steps: 400 });
        const ride = r.at['platform:land'] - r.at['platform:depart'];
        check(`${name}: stop in the ring, carried over (~1.4 s)`, !r.ev.includes('fall') && ride > 1.3 && ride < 1.8 && past(p.gap, dir, r.pos), r);
        r = await walk({ from: before(p.gap, dir, 1.5, 1.05), steps: 200 });
        check(`${name}: walk in beside the cap: acid`, r.ev.includes('fall'), r);
    }
    r = await walk({ from: before(cA.gap, 'east'), stop: ringStop(cA.gap, 'east'), steps: 400 });
    const s = await page.evaluate(() => window.__game.state().platforms);
    const b = s.find((p) => p.gap.minX === cB.gap.minX && p.gap.minZ === cB.gap.minZ);
    check('the second cap did not move while the first rode (independent)', b && b.at === b.startAt && !b.riding, b);
}
if (!ONLY || ONLY === 'sleepy') {
    const m = st.sleepies[0];
    r = await walk({ from: { x: m.x + 3.5, z: m.z, yaw: YAW.west }, steps: 150 });
    check(`sleepy mushroom (${m.x},${m.z}): walk into it, half speed, not an Ouch`, r.ev.includes('sleepy') && !r.ev.includes('spike') && r.sleepy.speed === 0.5, r);
    for (const off of [1.05, -1.05]) {
        r = await walk({ from: { x: m.x + 3.5, z: m.z + off, yaw: YAW.west }, steps: 150 });
        check(`sleepy: squeeze past at ${off}`, !r.ev.includes('sleepy') && r.pos.x < m.x - 1, r);
    }
}
if (!ONLY || ONLY === 'spike') {
    const z = st.spike2;
    r = await walk({ from: { x: z.x, z: z.z - 4, yaw: YAW.south }, steps: 110 });
    check('path Ouch mushroom: walk into it, Ouch, back to the start', r.ev.includes('spike') && JSON.stringify(r.msg).includes('Ouch'), r);
    for (const off of [1.08, -1.08]) {
        r = await walk({ from: { x: z.x + off, z: z.z - 4, yaw: YAW.south }, steps: 110 });
        check(`squeeze past it at ${off} (Level 60's gap)`, !r.ev.includes('spike') && r.pos.z > z.z + 1, r);
    }
    for (const off of [0.95, -0.95]) {
        r = await walk({ from: { x: z.x + off, z: z.z - 4, yaw: YAW.south }, steps: 110 });
        check(`${off} off the middle: Ouch (tighter than Level 146's)`, r.ev.includes('spike'), r);
    }
    const x = st.spike;
    r = await walk({ from: { x: x.x - 3.5, z: x.z, yaw: YAW.east }, steps: 120 });
    const r2 = await walk({ from: { x: x.x + 3.5, z: x.z, yaw: YAW.west }, steps: 120 });
    const r3 = await walk({ from: { x: x.x, z: x.z - 3.5, yaw: YAW.south }, steps: 120 });
    const r4 = await walk({ from: { x: x.x, z: x.z + 3.5, yaw: YAW.north }, steps: 120 });
    check('sneaky Ouch mushroom: walking into it = Ouch', [r, r2, r3, r4].some((q) => q.ev.includes('spike')), { x, ev: [r, r2, r3, r4].map((q) => q.ev) });
    const y = st.spikeRows[0];
    check('big Ouch mushroom present', !!y, y);
}
if (!ONLY || ONLY === 'cycle') {
    r = await page.evaluate(() => {
        const g = window.__game;
        g.restore();
        const trace = [];
        for (let k = 0; k < 900; k++) { const s = g.step(1); trace.push([s.fireflies[0].bright, s.fireflies[1].bright]); }
        return trace;
    });
    const both = r.filter(([a, b]) => a && b).length;
    const aOn = r.filter(([a]) => a).length / r.length, bOn = r.filter(([, b]) => b).length / r.length;
    check('two fireflies out of step: never bright together, each bright ~40%', both === 0 && Math.abs(aOn - 0.4) < 0.03 && Math.abs(bOn - 0.4) < 0.03, { both, aOn, bOn });
}
const FIND = `(g, i, to) => { for (let k = 0; k < 400; k++) { if (g.state().fireflies[i].bright === to) return; g.step(1); } }`;
if (!ONLY || ONLY === 'stare') {
    for (const [i, f] of st.fireflies.entries()) {
        const from = f.z > 50 ? { x: f.x - 9, z: f.z, yaw: YAW.east } : { x: f.x, z: f.z + 9, yaw: YAW.north };
        r = await page.evaluate(([F, i, from]) => {
            const g = window.__game;
            const find = eval(F);
            g.restore();
            g.teleport(from);
            find(g, i, false); find(g, i, true);
            g.clearEvents();
            const t0 = g.time();
            let ouchAt = null;
            for (let k = 0; k < 110; k++) { g.step(1); if (ouchAt === null && g.events.some((e) => e.type === 'spike' && e.what === 'firefly')) ouchAt = +(g.time() - t0).toFixed(2); }
            return { ouchAt, msg: g.text() };
        }, [FIND, i, from]);
        check(`firefly ${i + 1} (${f.x},${f.z}): face it while bright, Ouch after ~1 s`, r.ouchAt !== null && r.ouchAt >= 0.96 && r.ouchAt < 1.06, r);
    }
}
if (!ONLY || ONLY === 'swarm') {
    const fz = (F.minZ + F.maxZ) / 2;
    r = await page.evaluate(([F, fz]) => {
        const g = window.__game;
        g.restore();
        g.teleport({ x: F.maxX + 2, z: fz, yaw: Math.PI / 2 });
        g.clearEvents();
        g.setInput({ forward: true });
        const trace = [];
        let s;
        for (let k = 0; k < 200; k++) { s = g.step(1); const t = g.state(); trace.push([Math.round(t.pos.x * 10) / 10, t.fogView]); }
        g.clearInput();
        return { trace, end: s.pos, ev: g.events.map((e) => e.type).filter((e) => ['spike', 'fall', 'sleepy'].includes(e)) };
    }, [F, fz]);
    const inside = r.trace.filter(([x]) => x > F.minX + 1.6 && x < F.maxX - 1.6);
    check('swarm: clear outside, full inside, no danger', r.trace[0][1] === 0 && inside.length > 5 && inside.every(([, v]) => v === 1) && r.ev.length === 0 && r.end.x < F.minX - 1, { F, first: r.trace[0], inside: inside.slice(0, 2), end: r.end, ev: r.ev });
}
if (!ONLY || ONLY === 'shots') {
    const pose = async (name, t) => { await page.evaluate((t) => { const g = window.__game; g.restore(); g.teleport(t); g.step(10); }, t); await page.waitForTimeout(800); await shot(name); };
    await pose('start', { yaw: YAW.east });
    await pose('zpath', { x: st.spike2.x, z: st.spike2.z - 4, yaw: YAW.south });
    await pose('trenchA', before(tA.gap, 'east', 3));
    await pose('capB', before(cB.gap, 'south', 3));
    await pose('sleepy', { x: st.sleepies[0].x + 4, z: st.sleepies[0].z, yaw: YAW.west });
    const y = st.spikeRows[0];
    await pose('big', { x: y.x, z: y.z + 1.5, yaw: YAW.north });
    await pose('door', (() => { return { yaw: YAW.east }; })());
}
if (!ONLY || ONLY === 'door') {
    const fin = await page.evaluate(() => {
        const g = window.__game;
        g.restore();
        const calls = [];
        const orig = window.__sound.cheer.bind(window.__sound);
        window.__sound.cheer = (o) => { calls.push(o); return orig(o); };
        const d = g.maze().doorPosition;
        g.teleport({ x: d.x - 1.8, z: d.z, yaw: -Math.PI / 2 });
        g.clearEvents();
        g.setInput({ forward: true });
        let s;
        for (let i = 0; i < 40; i++) { s = g.step(2); if (s.escaped) break; }
        g.clearInput();
        g.step(30);
        const vis = (id) => { const el = document.getElementById(id); return !!el && !el.hidden && !el.closest('[hidden]'); };
        const next = document.querySelector('#menu-finish [data-act=next-level], [data-act=next-level]');
        const items = [...document.querySelectorAll('#menu-finish .item')].filter((e) => !e.hidden).map((e) => e.textContent);
        return { escaped: s.escaped, calls, ev: [...new Set(g.events.map((e) => e.type))], title: document.getElementById('finish-title').textContent,
            note: vis('finish-note') ? document.getElementById('finish-note').textContent : null, next: !!next && !next.hidden, items };
    });
    check('finale: golden door, confetti, extra-long cheer, You beat Mushroom Forest World!, More levels coming soon!, Quit only',
        fin.escaped && fin.ev.some((e) => e.startsWith('confetti')) && fin.calls.some((c) => c?.long) && fin.title === 'You beat Mushroom Forest World!' && /More levels coming soon|Start (Level [0-9]+|[A-Z][a-zA-Z ]* World)/.test(fin.note ?? '') && !fin.next && fin.items.length === 1 && /Quit/.test(fin.items[0]), fin);
    await page.waitForTimeout(1500);
    await shot('finale');
}
check('no page errors', errors.length === 0, errors);
if (!ONLY || ONLY === 'prev') {
    const page2 = await ctx.newPage();
    page2.on('pageerror', (e) => errors.push(String(e)));
    await page2.goto(BASE + '/?test=1&level=148', { waitUntil: 'domcontentloaded', timeout: 90000 });
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
        return { escaped: s.escaped, items, title: document.getElementById('finish-title').textContent };
    });
    check('Level 149 door: You did it! Start Level 150', r.escaped && r.items.some((x) => x.includes('Level 150')), r);
    check('no page errors (prev)', errors.length === 0, errors);
}
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
