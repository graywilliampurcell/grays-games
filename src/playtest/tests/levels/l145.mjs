// Level 145 checks (served on 9173)
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
await page.goto(BASE + '/?test=1&level=144', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
await page.keyboard.press('Shift');
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 900)); };
const shot = (name) => page.screenshot({ path: `${SP}l145-${name}.png`, timeout: 180000 });
const ONLY = process.env.ONLY;
let st = await page.evaluate(() => window.__game.restore());
const F = st.fogs[0];
const m = st.sleepies[0];
check('Level 145 loads: one swarm, one sneaky Ouch mushroom, one sleepy mushroom, nothing else',
    st.level.name === 'Level 145' && st.fogs.length === 1 && F.swarm && !!st.spike && !st.spike2 && st.sleepies.length === 1 && st.spikeRows.length === 0 && st.platforms.length === 0 && st.tails.length === 0 && st.vents.length === 0 && st.geysers.length === 0 && st.belts.length === 0 && st.trampolines.length === 0 && st.winds.length === 0 && (st.fireflies?.length ?? 0) === 0,
    { F, m, spike: st.spike, level: st.level });
check('swarm box x13-16 z17-28 (3 cells, column 3), sleepy (18.5,10.5), sneaky (6.5,30.5)', F.minX === 13 && F.maxX === 16 && F.minZ === 17 && F.maxZ === 28 && !F.alongX && m.x === 18.5 && m.z === 10.5 && st.spike.x === 6.5 && st.spike.z === 30.5, { F, m, s: st.spike });
check('tune mushroomswarm', (await page.evaluate(() => window.__sound?.tuneName)) === 'mushroomswarm', {});
let r;
const fx = (F.minX + F.maxX) / 2;
if (!ONLY || ONLY === 'swarm') {
    // Walk north through the swarm from just south of it
    r = await page.evaluate(([F, fx]) => {
        const g = window.__game;
        g.restore();
        g.teleport({ x: fx, z: F.maxZ + 2, yaw: 0 });
        g.clearEvents();
        g.setInput({ forward: true });
        const trace = [];
        let s;
        for (let k = 0; k < 220; k++) { s = g.step(1); const t = g.state(); trace.push([Math.round(t.pos.z * 10) / 10, t.fogView]); }
        g.clearInput();
        return { trace, end: s.pos, ev: g.events.map((e) => e.type).filter((e) => ['spike', 'fall', 'sleepy'].includes(e)) };
    }, [F, fx]);
    const inside = r.trace.filter(([z]) => z > F.minZ + 1.6 && z < F.maxZ - 1.6);
    const after = r.trace.filter(([z]) => z < F.minZ - 1.5);
    check('outside the swarm: clear', r.trace[0][1] === 0, r.trace[0]);
    check('deep in the swarm: full (see about 1 cell)', inside.length > 5 && inside.every(([, v]) => v === 1), inside.slice(0, 3));
    check('view opens up again after walking out', after.length > 0 && after.at(-1)[1] === 0, after.slice(-2));
    check('swarm is not a danger, walking goes right through', r.ev.length === 0 && r.end.z < F.minZ - 1, r);
    const walk = (from) => page.evaluate((from) => { const g = window.__game; g.restore(); g.teleport(from); const a = g.state().pos; g.setInput({ forward: true }); g.step(30); g.clearInput(); const b = g.state().pos; return Math.hypot(b.x - a.x, b.z - a.z); }, from);
    const vSwarm = await walk({ x: fx, z: F.maxZ - 0.5, yaw: 0 });
    const vOpen = await walk({ x: fx, z: F.maxZ + 3, yaw: 0 });
    check('walking speed in the swarm unchanged', Math.abs(vSwarm - vOpen) < 0.05, { vSwarm, vOpen });
    // The fog distances and colour inside
    r = await page.evaluate(([F, fx]) => {
        const g = window.__game;
        g.restore();
        g.teleport({ x: fx, z: (F.minZ + F.maxZ) / 2, yaw: 0 });
        g.step(60);
        const sc = g.scene?.() ?? null;
        return { fogView: g.state().fogView, fog: sc ? { near: sc.fog.near, far: sc.fog.far, color: sc.fog.color.getHexString() } : null };
    }, [F, fx]);
    check('inside: fog view 1', r.fogView === 1, r);
    console.log('fog inside', JSON.stringify(r));
    st = await page.evaluate(() => window.__game.restore());
    st = await page.evaluate(() => { window.__game.step(30); return window.__game.state(); });
    check('back at start: clear again', st.fogView === 0, st.fogView);
}
if (!ONLY || ONLY === 'sleepy') {
    r = await page.evaluate(([m]) => {
        const g = window.__game;
        g.restore();
        g.teleport({ x: m.x - 3, z: m.z, yaw: -Math.PI / 2 });
        g.clearEvents();
        g.setInput({ forward: true });
        let s, maxX = -1e9;
        for (let k = 0; k < 90; k++) { s = g.step(1); maxX = Math.max(maxX, s.pos.x); }
        g.clearInput();
        return { maxX, sleepy: s.sleepy, ev: g.events.map((e) => e.type).filter((e) => ['sleepy', 'spike', 'fall'].includes(e)) };
    }, [m]);
    check('sleepy mushroom heading east: solid, sleepy, half speed, not an Ouch', r.maxX <= m.x - 0.85 && r.sleepy.speed === 0.5 && r.sleepy.left > 4 && r.ev.includes('sleepy') && !r.ev.includes('spike'), r);
    for (const off of [0.95, -0.95]) {
        r = await page.evaluate(([m, off]) => {
            const g = window.__game;
            g.restore();
            g.teleport({ x: m.x - 3, z: m.z + off, yaw: -Math.PI / 2 });
            g.clearEvents();
            g.setInput({ forward: true });
            let s, maxX = -1e9;
            for (let k = 0; k < 200; k++) { s = g.step(1); maxX = Math.max(maxX, s.pos.x); }
            g.clearInput();
            return { maxX, ev: g.events.map((e) => e.type).filter((e) => ['sleepy', 'spike'].includes(e)) };
        }, [m, off]);
        check(`squeeze past the sleepy mushroom at ${off}`, r.maxX > m.x + 1 && r.ev.length === 0, r);
    }
}
if (!ONLY || ONLY === 'spike') {
    r = await page.evaluate((spike) => {
        const g = window.__game;
        g.restore();
        g.teleport({ x: spike.x + 1.6, z: spike.z, yaw: Math.PI / 2 });
        g.clearEvents();
        g.setInput({ forward: true });
        let s;
        for (let k = 0; k < 90 && !g.events.some((e) => e.type === 'spike'); k++) s = g.step(1);
        g.clearInput();
        return { spike: g.events.some((e) => e.type === 'spike'), msg: g.text() };
    }, st.spike);
    check('sneaky Ouch mushroom: Ouch!', r.spike && JSON.stringify(r.msg).includes('An Ouch mushroom sent you back to the start.'), r);
}
if (!ONLY || ONLY === 'shots') {
    const pose = async (name, p, wait = 0) => { await page.evaluate((p) => { const g = window.__game; g.restore(); g.teleport(p); g.step(40); }, p); if (wait) await page.waitForTimeout(wait); await shot(name); };
    await pose('swarm-outside', { x: fx, z: F.maxZ + 6, yaw: 0 });
    await pose('swarm-near', { x: fx, z: F.maxZ + 2, yaw: 0 });
    await pose('swarm-inside', { x: fx, z: (F.minZ + F.maxZ) / 2, yaw: 0 });
    await pose('swarm-inside-branch', { x: fx, z: F.maxZ - 2, yaw: Math.PI / 2 });
    await pose('swarm-behind', { x: fx, z: F.minZ - 3, yaw: Math.PI });
    await pose('sleepy', { x: m.x - 3.5, z: m.z, yaw: -Math.PI / 2 });
    await pose('spike', { x: st.spike.x + 2.4, z: st.spike.z, yaw: Math.PI / 2 });
    await pose('start', { yaw: -Math.PI / 2 });
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
    await page2.goto(BASE + '/?test=1&level=143', { waitUntil: 'domcontentloaded', timeout: 90000 });
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
        return { escaped: s.escaped, items, fogs: g.state().fogs.length };
    });
    check('Level 144 door: Start Level 145; Level 144 has no swarm', r.escaped && r.items.some((x) => x.includes('Level 145')) && r.fogs === 0, r);
    check('no page errors (prev)', errors.length === 0, errors);
}
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
