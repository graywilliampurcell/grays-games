// Level 62 balloon checks: node t62.mjs (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
const idx = 61;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const load = async () => { await page.goto(`${BASE}/?test=1&level=${idx}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => window.__game?.ready); };
const shot = (name) => page.screenshot({ path: `${SP}l62-${name}.png` });
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info)); };
const E = -Math.PI / 2, W = Math.PI / 2;

// 1. Ride west -> east, timing each phase
await load();
const st0 = await page.evaluate(() => window.__game.state().platforms[0]);
console.log('platform', JSON.stringify(st0));
const ride = await page.evaluate(({ E }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 2.5, z: 2.5, yaw: E }); g.setInput({ forward: true });
    const log = []; let last = null; let st; let maxLift = 0; let fell = false; let msg = '';
    for (let i = 0; i < 1200; i++) {
        st = g.step(1);
        const p = st.platforms[0];
        // let go of forward once fully in the basket
        if (p.phase === 'wait') g.clearInput();
        if (p.phase !== last) { log.push({ phase: p.phase, t: st.t, x: st.pos.x }); last = p.phase; }
        maxLift = Math.max(maxLift, p.lift);
        const m = document.getElementById('message'); if (!msg && m && !m.hidden && m.textContent.trim()) msg = m.textContent;
        if (g.events.some((e) => e.type === 'fall')) fell = true;
        if (log.length > 6 && p.phase === 'rest' && !st.shoved) break;
    }
    return { log, maxLift, fell, msg, pos: st.pos, at: st.platforms[0].at, events: g.events.map((e) => e.type + (e.what ? ':' + e.what : '')) };
}, { E });
console.log(JSON.stringify(ride));
const ph = Object.fromEntries(ride.log.map((l, i) => [l.phase + i, l.t]));
check('ride crosses and lands on the far floor', !ride.fell && ride.pos.x > 20 && ride.pos.x < 21.5, ride.pos);
check('rose high above walls', ride.maxLift >= 20, ride.maxLift);

// 2. Visibility during the ride + screenshots
await load();
const views = [];
await page.evaluate(({ E }) => { const g = window.__game; g.teleport({ x: 3.3, z: 2.5, yaw: E }); g.setInput({ forward: true }); for (let i = 0; i < 60 && g.state().platforms[0].phase !== 'wait'; i++) g.step(1); g.clearInput(); }, { E });
await page.evaluate(() => window.__game.step(10));
await shot('a-in-basket');
for (const [name, n, pitch] of [['b-rising', 40, -0.9], ['c-rising-down', 50, -1.3], ['d-top', 35, -1.0], ['e-top-look-down', 60, -1.4], ['f-descending', 75, -1.2], ['g-descending2', 40, -1.0], ['h-landed', 80, 0]]) {
    const v = await page.evaluate(({ n, pitch }) => {
        const g = window.__game; const st = g.step(n);
        const cam = window.__sound ? null : null;
        return { phase: st.platforms[0].phase, view: st.platforms[0].view, lift: st.platforms[0].lift, pos: st.pos };
    }, { n, pitch });
    // tilt the camera for the picture
    await page.evaluate(({ pitch }) => { const g = window.__game; const d = pitch - g.state().pitch; g.setInput({ lookDy: -d / 0.003 }); g.step(1); g.clearInput(); g.render(); }, { pitch });
    await shot(name);
    views.push({ name, ...v });
}
console.log(JSON.stringify(views));
check('views: corridor while rising/descending, cloud at top, normal after', views[0].view === 'corridor' && views[3].view === 'cloud' && views[4].view === 'corridor' && views[6].view === null, views.map((v) => v.view));

// 3. Step out before the burner fires: cancelled
await load();
const cancel = await page.evaluate(({ E, W }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 3.3, z: 2.5, yaw: E }); g.setInput({ forward: true });
    let st; for (let i = 0; i < 60 && g.state().platforms[0].phase !== 'wait'; i++) st = g.step(1);
    g.clearInput(); g.step(20);
    g.teleport({ yaw: W }); g.setInput({ forward: true }); st = g.step(40); g.clearInput(); st = g.step(120);
    return { phase: st.platforms[0].phase, at: st.platforms[0].at, pos: st.pos, events: g.events.map((e) => e.type + (e.what ? ':' + e.what : '')) };
}, { E, W });
check('stepping out within 1 s cancels', cancel.phase === 'rest' && cancel.at === 0 && !cancel.events.includes('platform:depart') && cancel.events.includes('platform:cancel'), cancel);

// 4. Walk into the lava beside/ahead of the basket
await load();
const fall = await page.evaluate(({ E }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 9, z: 2.5, yaw: E }); g.step(2);
    const m = document.getElementById('message');
    return { msg: m.hidden ? '' : m.textContent, pos: g.state().pos, events: g.events.map((e) => e.type) };
}, { E });
check('lava: Ouch, back to start', /fell in the lava/.test(fall.msg) && fall.events.includes('fall'), fall);

// 5. Coming from the far side: it floats over, then rides back west
await load();
const back = await page.evaluate(({ W }) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: 22.5, z: 2.5, yaw: W }); g.setInput({ forward: true });
    let st; const log = []; let last = null;
    for (let i = 0; i < 1200; i++) {
        st = g.step(1); const p = st.platforms[0];
        if (p.phase !== last) { log.push({ phase: p.phase, t: st.t, x: st.pos.x, at: p.at }); last = p.phase; }
        // stop at the edge till it arrives
        if (st.pos.x < 21 && p.phase === 'float') g.clearInput();
        if (p.phase === 'rest' && p.at > 0 && log.length > 1 && log.length < 3) g.setInput({ forward: true });
        if (p.phase === 'wait') g.clearInput();
        if (log.length > 6 && p.phase === 'rest' && !st.shoved) break;
    }
    return { log, pos: st.pos, events: [...new Set(g.events.map((e) => e.type + (e.what ? ':' + e.what : '')))] };
}, { W });
check('floats over from the far side and carries you back west', back.pos.x < 5 && back.pos.x > 3.5 && back.log.some((l) => l.phase === 'float') && !back.events.includes('fall'), back);

// 6. Reset to start puts it back on the start side
await load();
const reset = await page.evaluate(({ E, W }) => {
    const g = window.__game; g.teleport({ x: 22.5, z: 2.5, yaw: W }); g.setInput({ forward: true }); g.step(12); g.clearInput(); g.step(200);
    const before = g.state().platforms[0].at;
    g.teleport({ x: 9, z: 2.5 }); g.step(2);
    return { before, after: g.state().platforms[0].at, phase: g.state().platforms[0].phase };
}, { E, W });
check('reset sends the balloon back to its start edge', reset.before > 0 && reset.after === 0, reset);

console.log('errors', errors);
console.log(results.every(Boolean) && !errors.length ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
