// Level 84 checks: node t84.mjs (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
const idx = 83;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const load = async (i = idx) => { await page.goto(`${BASE}/?test=1&level=${i}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => window.__game?.ready); };
const shot = (name) => page.screenshot({ path: `${SP}l84-${name}.png` });
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info)); };
const E = -Math.PI / 2, W = Math.PI / 2, N = 0, S = Math.PI;

await load();
const st0 = await page.evaluate(() => window.__game.state());
const a0 = st0.armBelts[0];
console.log('armBelt', JSON.stringify(a0), 'platforms', st0.platforms.length, 'belts', st0.belts.length, 'spike', JSON.stringify(st0.spike), st0.level.name);
check('one arm belt along x, forward west, 24 long, 3 wide, landing 46.5,30.5; one tire; no backward belt', st0.armBelts.length === 1 && a0.alongX && a0.forward.x === -1 && a0.maxX - a0.minX === 24 && a0.maxZ - a0.minZ === 3 && a0.landing.x === 46.5 && a0.landing.z === 30.5 && st0.platforms.length === 1 && st0.belts.length === 0, a0);

// 1. Walking speed (row 0, open corridor), for comparison
const walk = await page.evaluate(({ E }) => {
    const g = window.__game; g.teleport({ x: 2.5, z: 2.5, yaw: E }); g.setInput({ forward: true }); g.step(30); const x0 = g.state().pos.x; g.step(60); const x1 = g.state().pos.x; g.clearInput(); return (x1 - x0);
}, { E });
console.log('walking speed per s', walk);

// 2. Standing still on the belt: carried west at ~125% of walking
await load();
const carry = await page.evaluate(() => {
    const g = window.__game; g.teleport({ x: 42, z: 30.5 }); g.step(1); const x0 = g.state().pos.x; g.step(30); const x1 = g.state().pos.x; return (x0 - x1) * 2;
});
check('belt carries you west at ~125% of walking', Math.abs(carry / walk - 1.25) < 0.05, { carry, walk, ratio: carry / walk });

// 3. Arms: every 3 s, alternating right/left, sliding back at ~walking speed
await load();
const arms = await page.evaluate(() => {
    const g = window.__game; g.teleport({ x: 2.5, z: 2.5 }); g.clearEvents(); const spawns = []; let n = 0; let s0 = null; let sAt = null;
    for (let i = 0; i < 60 * 10; i++) {
        const st = g.step(1); const b = st.armBelts[0];
        if (b.arms.length > n || (b.arms.length && spawns.length === 0)) {}
        const ev = g.events.filter((e) => e.type === 'arm').length;
        if (ev > spawns.length) spawns.push({ t: st.t, side: b.arms[b.arms.length - 1].side, s: b.arms[b.arms.length - 1].s, count: b.arms.length });
        if (spawns.length === 1 && sAt === null && b.arms.length) { s0 = b.arms[0].s; sAt = st.t; }
        if (spawns.length === 1 && sAt !== null && st.t - sAt >= 1 && s0 !== true) { spawns[0].speed = (s0 - b.arms[0].s) / (st.t - sAt); s0 = true; }
    }
    return spawns;
});
check('arms every 3 s alternating sides', arms.length >= 3 && Math.abs(arms[0].t - 1) < 0.05 && Math.abs(arms[1].t - arms[0].t - 3) < 0.05 && Math.abs(arms[2].t - arms[1].t - 3) < 0.05 && arms[0].side === 1 && arms[1].side === -1 && arms[2].side === 1, arms);
check('arm slides back at ~walking speed, one at a time', Math.abs(arms[0].speed - 7.5) < 0.2 && arms.every((a) => a.count === 1), arms);

// 4. Standing in the right half when the right arm comes: pushed back to 46.5,30.5, not an Ouch
await load();
const push = await page.evaluate(() => {
    const g = window.__game; g.clearEvents(); let st; let pushT = null;
    for (let i = 0; i < 60 * 3; i++) {
        g.teleport({ x: 30, z: 29.75 }); // held in the right (north) half
        st = g.step(1);
        if (g.events.some((e) => e.type === 'armPush')) { pushT = st.t; break; }
    }
    for (let i = 0; i < 60; i++) { st = g.step(1); if (!st.shoved) break; }
    const m = document.getElementById('message');
    return { pushT, pos: st.pos, events: [...new Set(g.events.map((e) => e.type))], msg: m && !m.hidden ? m.textContent : '' };
});
check('arm pushes you off the belt to 46.5,30.5, not an Ouch', push.pushT !== null && Math.abs(push.pos.x - 46.5) < 0.05 && Math.abs(push.pos.z - 30.5) < 0.05 && !push.events.includes('spike') && !push.msg, push);

// 5. Dodge: walk the left (south) half while a right arm comes: no push, off the far end
await load();
const dodge = await page.evaluate(({ W }) => {
    const g = window.__game; g.clearEvents(); let st;
    while (!g.events.some((e) => e.type === 'arm')) g.step(1); // first arm: right side
    g.teleport({ x: 46.5, z: 31.25, yaw: W }); g.setInput({ forward: true }); let t0 = g.state().t; let off = null;
    for (let i = 0; i < 120; i++) { st = g.step(1); if (off === null && st.pos.x < 20.5) off = st.t - t0; }
    g.clearInput();
    return { pos: st.pos, crossing: off, pushed: g.events.some((e) => e.type === 'armPush') };
}, { W });
check('dodging in the other half: no push, reach the far end', !dodge.pushed && dodge.pos.x < 20, dodge);
// and the same walk in the right half gets pushed
await load();
const nod = await page.evaluate(({ W }) => {
    const g = window.__game; g.clearEvents(); let st;
    while (!g.events.some((e) => e.type === 'arm')) g.step(1);
    g.teleport({ x: 46.5, z: 29.75, yaw: W }); g.setInput({ forward: true });
    for (let i = 0; i < 120; i++) st = g.step(1);
    g.clearInput();
    return { pos: st.pos, pushed: g.events.some((e) => e.type === 'armPush') };
}, { W });
check('same walk in the arm\'s half gets pushed', nod.pushed, nod);

// 6. Paused: arms freeze (game step not run while paused)
// 7. Sneaky zapper + tire ride
await load();
const tire = await page.evaluate(() => { const g = window.__game; const p = g.state().platforms[0]; return p; });
console.log('tire', JSON.stringify(tire));

// 8. Screenshots
await load();
await page.evaluate(({ W }) => { const g = window.__game; g.teleport({ x: 50, z: 30.5, yaw: W }); while (!g.events.some((e) => e.type === 'arm')) g.step(1); g.teleport({ x: 50, z: 30.5, yaw: W }); g.step(40); g.render(); }, { W });
await shot('a-belt');
await page.evaluate(({ W }) => { const g = window.__game; g.teleport({ x: 35, z: 31.25, yaw: W }); g.step(15); g.render(); }, { W });
await shot('b-arm-close');

// 9. Doors
await load();
const fin = await page.evaluate(({ E }) => {
    const g = window.__game; const d = g.state().door; g.teleport({ x: d.x - 2.5, z: d.z, yaw: E }); g.setInput({ forward: true }); g.step(60); g.clearInput();
    return { escaped: g.state().escaped, title: document.getElementById('finish-title').textContent, buttons: [...document.querySelectorAll('#menu-finish .item, #menu-finish button')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim()) };
}, { E });
check('door: More levels coming soon + Quit', fin.escaped && fin.title === 'More levels coming soon!' && fin.buttons.join('|') === 'Quit', fin);
await load(82);
const f83 = await page.evaluate(({ E }) => {
    const g = window.__game; const d = g.state().door; g.teleport({ x: d.x - 2.5, z: d.z, yaw: E }); g.setInput({ forward: true }); g.step(60); g.clearInput();
    return { title: document.getElementById('finish-title').textContent, buttons: [...document.querySelectorAll('#menu-finish .item, #menu-finish button')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim()) };
}, { E });
check("Level 83's door: You did it! + Start Level 84", f83.title === 'You did it!' && f83.buttons.some((b) => /Level 84/.test(b)), f83);

console.log('errors', errors);
console.log(results.every(Boolean) && !errors.length ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
