// Level 65 checks: two balloons + one vent. node t65.mjs (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
const idx = 64;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const load = async () => { await page.goto(`${BASE}/?test=1&level=${idx}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => window.__game?.ready); };
const shot = (name) => page.screenshot({ path: `${SP}l65-${name}.png` });
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info)); };
const E = -Math.PI / 2, W = Math.PI / 2, N = 0, S = Math.PI;

await load();
const st0 = await page.evaluate(() => { const s = window.__game.state(); return { geysers: s.geysers.length, platforms: s.platforms, vents: s.vents.length, spike: s.spike, rows: s.spikeRows, start: s.start, level: s.level }; });
console.log(JSON.stringify(st0));
check('two balloons, one vent, nothing else', st0.platforms.length === 2 && st0.platforms.every((p) => p.balloon) && st0.vents === 1 && st0.geysers === 0 && !st0.spike && !(st0.rows?.length), { n: st0.platforms.length, vents: st0.vents, g: st0.geysers, spike: st0.spike, rows: st0.rows });

// Ride each balloon in its path direction
const rides = [
    { name: 'right-column', from: { x: 42.5, z: 38.5, yaw: N }, done: (p) => p.z < 20 && p.z > 17 },
    { name: 'top-row', from: { x: 14.5, z: 2.5, yaw: E }, done: (p) => p.x > 32 && p.x < 34 },
];
for (const r of rides) {
    await load();
    const res = await page.evaluate(({ from }) => {
        const g = window.__game; g.clearEvents(); g.teleport(from); g.setInput({ forward: true });
        const log = []; let st; let maxLift = 0; let who = -1; let otherMoved = false; const at0 = g.state().platforms.map((p) => p.at);
        let otherViews = new Set(); let msg = '';
        for (let i = 0; i < 1500; i++) {
            st = g.step(1);
            const busy = st.platforms.findIndex((p) => p.phase !== 'rest');
            if (busy >= 0 && who < 0) who = busy;
            if (who >= 0) {
                const p = st.platforms[who];
                if (p.phase === 'wait') g.clearInput();
                if (!log.length || log[log.length - 1].phase !== p.phase) log.push({ phase: p.phase, t: st.t });
                maxLift = Math.max(maxLift, p.lift);
                const o = st.platforms[1 - who];
                if (o.at !== at0[1 - who] || o.phase !== 'rest') otherMoved = true;
                otherViews.add(String(o.view));
                if (log.length > 5 && p.phase === 'rest' && !st.shoved) break;
            }
            const m = document.getElementById('message'); if (!msg && m && !m.hidden && m.textContent.trim()) msg = m.textContent;
        }
        return { who, log, maxLift, otherMoved, otherViews: [...otherViews], pos: st.pos, msg, events: [...new Set(g.events.map((e) => e.type + (e.what ? ':' + e.what : '')))] };
    }, { from: r.from });
    console.log(JSON.stringify(res));
    const t = (ph) => res.log.find((l) => l.phase === ph)?.t;
    check(`${r.name}: rides across, lands on far floor, other balloon untouched`, res.who >= 0 && r.done(res.pos) && !res.events.includes('fall') && !res.otherMoved && res.maxLift >= 20, { pos: res.pos, who: res.who, other: res.otherMoved, lift: res.maxLift, phases: res.log });
}

// Visibility: while riding balloon A, balloon B (and the rest of the maze) hidden; normal after
await load();
const vis = await page.evaluate(({ N }) => {
    const g = window.__game; g.teleport({ x: 42.5, z: 38.5, yaw: N }); g.setInput({ forward: true });
    for (let i = 0; i < 200 && !g.state().platforms.some((p) => p.phase === 'wait'); i++) g.step(1);
    g.clearInput();
    const scene = g.maze ? g.maze : null;
    const out = [];
    for (const n of [80, 60, 120, 120, 200]) { const st = g.step(n); out.push(st.platforms.map((p) => ({ phase: p.phase, view: p.view, visible: p.visible }))); }
    return out;
}, { N });
console.log(JSON.stringify(vis));

// Screenshots: in the air on each, and both balloons from the ground
await load();
await page.evaluate(({ N }) => { const g = window.__game; g.teleport({ x: 42.5, z: 39.5, yaw: N }); g.step(2); g.render(); }, { N });
await shot('a-balloon1-approach');
await page.evaluate(({ E }) => { const g = window.__game; g.teleport({ x: 10.5, z: 2.5, yaw: E }); g.step(2); g.render(); }, { E });
await shot('b-balloon2-approach');
for (const [name, from] of [['c', { x: 42.5, z: 38.5, yaw: N }], ['d', { x: 14.5, z: 2.5, yaw: E }]]) {
    await load();
    await page.evaluate(({ from }) => { const g = window.__game; g.teleport(from); g.setInput({ forward: true }); for (let i = 0; i < 200 && !g.state().platforms.some((p) => p.phase === 'wait'); i++) g.step(1); g.clearInput(); }, { from });
    for (const [n, pitch, tag] of [[100, -1.0, 'rising'], [80, -1.0, 'top'], [140, -1.0, 'down'], [120, -0.2, 'landed']]) {
        await page.evaluate(({ n, pitch }) => { const g = window.__game; g.step(n); const d = pitch - g.state().pitch; g.setInput({ lookDy: -d / 0.003 }); g.step(1); g.clearInput(); g.render(); }, { n, pitch });
        await shot(`${name}-${tag}`);
    }
}

// Steam vent: stand on it heading west during a puff -> pushed back east
await load();
const vent = await page.evaluate(({ W }) => {
    const g = window.__game; g.clearEvents();
    g.teleport({ x: 30.5, z: 6.5, yaw: W });
    let st; for (let i = 0; i < 400 && !g.events.some((e) => e.type === 'steam'); i++) st = g.step(1);
    st = g.step(60);
    return { pos: st.pos, vents: st.vents, events: [...new Set(g.events.map((e) => e.type + (e.what ? ':' + e.what : '')))] };
}, { W });
check('vent pushes you back east to the cell before it', vent.events.includes('steam') && Math.abs(vent.pos.x - 34.5) < 1.2 && Math.abs(vent.pos.z - 6.5) < 1.2, vent);
await page.evaluate(({ W }) => { const g = window.__game; g.teleport({ x: 37.5, z: 6.5, yaw: W }); for (let i = 0; i < 400 && g.state().vents[0].phase !== 'warning'; i++) g.step(1); g.step(30); g.render(); }, { W });
await shot('e-vent');

// Lava in the right column: Ouch
await load();
const fall = await page.evaluate(({ N }) => { const g = window.__game; g.clearEvents(); g.teleport({ x: 42.5, z: 28, yaw: N }); g.step(2); const m = document.getElementById('message'); return { msg: m.hidden ? '' : m.textContent, events: g.events.map((e) => e.type) }; }, { N });
check('lava: Ouch, back to start', /fell in the lava/.test(fall.msg), fall);

// Door finishes the level
await load();
const door = await page.evaluate(({ E }) => { const g = window.__game; g.clearEvents(); g.teleport({ x: 40.5, z: 2.5, yaw: E }); g.setInput({ forward: true }); let st; for (let i = 0; i < 200; i++) st = g.step(1); g.clearInput(); return { events: [...new Set(g.events.map((e) => e.type))], state: st.state }; }, { E });
console.log(JSON.stringify(door));
await page.waitForTimeout(500);
await shot('f-door');

console.log('errors', errors);
console.log(results.every(Boolean) && !errors.length ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
