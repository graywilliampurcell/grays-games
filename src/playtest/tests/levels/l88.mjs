// Level 88 checks: node t88.mjs (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
const SP = SHOTS;
const idx = 87;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const load = async (i = idx) => { await page.goto(`${BASE}/?test=1&level=${i}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => window.__game?.ready); };
const shot = (name) => page.screenshot({ path: `${SP}l88-${name}.png` });
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info)); };
const yawOf = (f) => Math.atan2(-f.x, -f.z); // yaw 0 faces -z

await load();
const st0 = await page.evaluate(() => window.__game.state());
console.log(st0.level.name, 'platforms', st0.platforms.length, 'belts', st0.belts.length, 'spike', JSON.stringify(st0.spike));
check('two arm belts, no tire, no backward belt', st0.armBelts.length === 2 && st0.platforms.length === 0 && st0.belts.length === 0, st0.armBelts.map((b) => ({ ...b, arms: undefined })));

// walking speed
const walk = await page.evaluate(() => {
    const g = window.__game; g.teleport({ x: 26.5, z: 38.5, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); g.step(20); const x0 = g.state().pos.x; g.step(30); const x1 = g.state().pos.x; g.clearInput(); return (x1 - x0) * 2;
});
console.log('walk', walk);

// independent timers: first arms at 1 s and 2.5 s, then every 3 s, each alternating
await load();
const timing = await page.evaluate(() => {
    const g = window.__game; g.teleport({ x: 26.5, z: 38.5 }); const spawns = [[], []]; const last = [-1, -1];
    for (let i = 0; i < 60 * 9; i++) {
        const st = g.step(1);
        st.armBelts.forEach((b, k) => {
            const a = b.arms[b.arms.length - 1];
            const s = a ? a.s : -1;
            if (a && s > last[k] + 0.5) spawns[k].push({ t: st.t, side: a.side });
            last[k] = s;
        });
    }
    return spawns;
});
const okT = (s, first) => s.length >= 3 && Math.abs(s[0].t - first) < 0.05 && Math.abs(s[1].t - s[0].t - 3) < 0.05 && Math.abs(s[2].t - s[1].t - 3) < 0.05 && s[0].side === 1 && s[1].side === -1 && s[2].side === 1;
check('belt 1 arms at 1 s then every 3 s, alternating; belt 2 at 2.5 s then every 3 s', okT(timing[0], 1) && okT(timing[1], 2.5), timing);

for (let k = 0; k < 2; k++) {
    const b = st0.armBelts[k];
    const len = b.alongX ? b.maxX - b.minX : b.maxZ - b.minZ;
    const c = { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 };
    const at = (along, across) => ({ x: c.x + b.forward.x * along + b.right.x * across, z: c.z + b.forward.z * along + b.right.z * across });
    const yaw = yawOf(b.forward);
    // carry
    await load();
    const carry = await page.evaluate(({ p, f }) => {
        const g = window.__game; g.teleport(p); g.step(1); const a = g.state().pos; g.step(30); const q = g.state().pos; return ((q.x - a.x) * f.x + (q.z - a.z) * f.z) * 2;
    }, { p: at(-len / 2 + 2, 0), f: b.forward });
    check(`belt ${k + 1} carries forward at ~125% of walking`, Math.abs(carry / walk - 1.25) < 0.06, { carry, walk, ratio: carry / walk });
    // push in the arm's half
    await load();
    const push = await page.evaluate(({ p, k }) => {
        const g = window.__game; g.clearEvents(); let st; let pushT = null;
        for (let i = 0; i < 60 * 5; i++) {
            g.teleport(p); st = g.step(1);
            if (g.events.some((e) => e.type === 'armPush')) { pushT = st.t; break; }
        }
        for (let i = 0; i < 60; i++) { st = g.step(1); if (!st.shoved) break; }
        const m = document.getElementById('message');
        return { pushT, pos: st.pos, events: [...new Set(g.events.map((e) => e.type))], msg: m && !m.hidden ? m.textContent : '' };
    }, { p: at(0, len === 0 ? 0 : 0.75), k });
    check(`belt ${k + 1}: arm pushes you to its landing, not an Ouch`, push.pushT !== null && Math.abs(push.pos.x - b.landing.x) < 0.05 && Math.abs(push.pos.z - b.landing.z) < 0.05 && !push.events.includes('spike') && !push.msg, { push, landing: b.landing });
    // dodge: walk the other half while this belt's first (right) arm comes
    await load();
    const dodge = await page.evaluate(({ start, yaw, k, f, endAlong, c }) => {
        const g = window.__game; g.clearEvents(); let st = g.state();
        const first = k === 0 ? 1 : 2.5;
        while (st.t < first + 0.02) st = g.step(1);
        g.teleport({ ...start, yaw }); g.setInput({ forward: true });
        let reached = false;
        for (let i = 0; i < 150; i++) { st = g.step(1); const along = (st.pos.x - c.x) * f.x + (st.pos.z - c.z) * f.z; if (along > endAlong) reached = true; }
        g.clearInput();
        return { pos: st.pos, reached, pushed: g.events.some((e) => e.type === 'armPush') };
    }, { start: { x: b.landing.x + b.right.x * -0.75, z: b.landing.z + b.right.z * -0.75 }, yaw, k, f: b.forward, endAlong: len / 2 + 0.5, c });
    check(`belt ${k + 1}: dodging in the left half, no push, reach the far end`, !dodge.pushed && dodge.reached, dodge);
    await load();
    const nod = await page.evaluate(({ start, yaw, k }) => {
        const g = window.__game; g.clearEvents(); let st = g.state();
        const first = k === 0 ? 1 : 2.5;
        while (st.t < first + 0.02) st = g.step(1);
        g.teleport({ ...start, yaw }); g.setInput({ forward: true });
        for (let i = 0; i < 150; i++) st = g.step(1);
        g.clearInput();
        return { pos: st.pos, pushed: g.events.some((e) => e.type === 'armPush') };
    }, { start: { x: b.landing.x + b.right.x * 0.75, z: b.landing.z + b.right.z * 0.75 }, yaw, k });
    check(`belt ${k + 1}: the same walk in the arm's half gets pushed`, nod.pushed, nod);
    // screenshot from the landing
    await load();
    await page.evaluate(({ p, yaw, k }) => { const g = window.__game; let st = g.state(); while (st.t < (k === 0 ? 1.8 : 3.3)) st = g.step(1); g.teleport({ ...p, yaw }); g.step(1); g.render(); }, { p: b.landing, yaw, k });
    await shot(`belt${k + 1}`);
}

// sneaky zapper
await load();
const sp = st0.spike;
const zap = await page.evaluate((sp) => {
    const g = window.__game; g.clearEvents(); g.teleport({ x: sp.x + 0.2, z: sp.z }); g.step(5); const m = document.getElementById('message');
    return { events: [...new Set(g.events.map((e) => e.type))], pos: g.state().pos, msg: m && !m.hidden ? m.textContent : '' };
}, sp);
check('sneaky zapper: Ouch, back to start', zap.events.includes('spike') && /zapper/.test(zap.msg), zap);
await load();
await page.evaluate((sp) => { const g = window.__game; g.teleport({ x: sp.x, z: sp.z + 6, yaw: 0 }); g.step(2); g.render(); }, sp);
await shot('sneaky');

// doors
await load();
const fin = await page.evaluate(() => {
    const g = window.__game; const d = g.state().door; g.teleport({ x: d.x - 2.5, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); g.step(60); g.clearInput();
    return { escaped: g.state().escaped, title: document.getElementById('finish-title').textContent, buttons: [...document.querySelectorAll('#menu-finish .item, #menu-finish button')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim()) };
});
check('door: More levels coming soon + Quit', fin.escaped && fin.title === 'More levels coming soon!' && fin.buttons.join('|') === 'Quit', fin);
await load(86);
const f87 = await page.evaluate(() => {
    const g = window.__game; const d = g.state().door; g.teleport({ x: d.x - 2.5, z: d.z, yaw: -Math.PI / 2 }); g.setInput({ forward: true }); g.step(60); g.clearInput();
    return { title: document.getElementById('finish-title').textContent, buttons: [...document.querySelectorAll('#menu-finish .item, #menu-finish button')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim()) };
});
check("Level 87's door: You did it! + Start Level 88", f87.title === 'You did it!' && f87.buttons.some((b) => /Level 88/.test(b)), f87);

console.log('errors', errors);
console.log(results.every(Boolean) && !errors.length ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
