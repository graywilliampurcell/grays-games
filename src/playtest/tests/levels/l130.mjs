// Level 130 checks (vite preview on 9173)
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
await page.goto(BASE + '/?test=1&level=129', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
await page.keyboard.press('Shift');
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 900)); };
const shot = (name) => page.screenshot({ path: `${SP}l130-${name}.png`, timeout: 180000 });
const ONLY = process.env.ONLY ?? 'all';
const want = (k) => ONLY === 'all' || ONLY.split(',').includes(k);

let st = await page.evaluate(() => window.__game.restore());
const plank = st.platforms.find((p) => p.plank > 0);
check('Level 130 loads: rocking, 1 quarter plank, 2 cannon rides, 2 waves, sneaky + path spike (0.72), 1 big spike, golden door',
    st.level.name === 'Level 130' && !!st.rocking && st.platforms.length === 3 && st.platforms.filter((p) => p.plank > 0).length === 1 && Math.abs(plank.plank - 0.25) < 1e-6
    && st.cannons.length === 4 && st.vents.length === 2 && st.vents.every((v) => v.wave) && !!st.spike && !!st.spike2 && st.spikeRows.length === 1
    && st.tails.length === 0 && st.geysers.length === 0 && st.belts.length === 0 && (await page.evaluate(() => window.__game.maze().golden === true && window.__game.maze().spike2Radius === 0.72)),
    { pls: st.platforms.map((p) => [p.gap, p.plank]), cannons: st.cannons.length, vents: st.vents.length, spike: st.spike, spike2: st.spike2, rows: st.spikeRows });
check('tune piratefinale', (await page.evaluate(() => window.__sound?.tuneName)) === 'piratefinale', {});

// The quarter plank (crossed along x, east)
if (want('plank')) {
    const cross = (dir, off, joy, waitTip) => page.evaluate(([dir, off, joy, waitTip]) => {
        const g = window.__game;
        g.restore();
        const g0 = g.state().platforms.find((p) => p.plank > 0).gap;
        const cz = (g0.minZ + g0.maxZ) / 2;
        if (waitTip) for (let k = 0; k < 2000; k++) { const s = g.step(1); if (s.rocking.phase === 'calm' && s.rocking.timer < 0.3) break; }
        g.teleport({ x: dir > 0 ? g0.minX - 1.2 : g0.maxX + 1.2, z: cz + off, yaw: dir > 0 ? -Math.PI / 2 : Math.PI / 2 });
        g.clearEvents();
        g.setInput(joy ? { joystick: joy } : { forward: true });
        let s, maxOff = 0, tipped = false;
        const t0 = g.time();
        for (let k = 0; k < 600; k++) {
            s = g.step(1);
            if (s.rocking.phase === 'tip') tipped = true;
            if (s.pos.x > g0.minX && s.pos.x < g0.maxX) maxOff = Math.max(maxOff, Math.abs(s.pos.z - cz));
            if ((dir > 0 ? s.pos.x > g0.maxX + 1.2 : s.pos.x < g0.minX - 1.2) || g.events.some((e) => e.type === 'waterFall')) break;
        }
        g.clearInput();
        return { dir, t: g.time() - t0, pos: s.pos, maxOff, tipped, ev: g.events.map((e) => e.type).filter((e) => ['waterFall', 'fall', 'splash'].includes(e)) };
    }, [dir, off, joy, waitTip]);
    for (const dir of [1, -1]) {
        let r = await cross(dir, 0, null, false);
        check(`plank dir ${dir}: computer straight across the middle: no fall`, r.ev.length === 0, r);
        r = await cross(dir, 0.3, null, false);
        check(`plank dir ${dir}: 0.3 off centre: no fall`, r.ev.length === 0, r);
        r = await cross(dir, 0.45, null, false);
        check(`plank dir ${dir}: 0.45 off centre: falls in`, r.ev.includes('waterFall'), r);
        r = await cross(dir, 0, { x: 0, y: -1 }, false);
        check(`plank dir ${dir}: iPad circle straight: no fall`, r.ev.length === 0, r);
        r = await cross(dir, 0, { x: 0, y: -0.5 }, false);
        check(`plank dir ${dir}: iPad half push (slow): no fall`, r.ev.length === 0, r);
        r = await cross(dir, 0, null, true);
        check(`plank dir ${dir}: walk across while the ship tips: no fall`, r.ev.length === 0 && r.tipped, r);
    }
    // A sloppy thumb that corrects itself (wobble +-0.1 every 0.25 s, push back 0.15 past 0.2 off)
    const wob = [];
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
        wob.push(await page.evaluate(([seed]) => {
            const g = window.__game;
            let a = seed * 9301 + 49297;
            const rnd = () => ((a = (a * 9301 + 49297) % 233280) / 233280);
            g.restore();
            const g0 = g.state().platforms.find((p) => p.plank > 0).gap;
            const cz = (g0.minZ + g0.maxZ) / 2;
            g.teleport({ x: g0.minX - 1.2, z: cz, yaw: -Math.PI / 2 });
            g.clearEvents();
            let s = g.state(), wobble = 0, maxOff = 0;
            for (let k = 0; k < 600; k++) {
                if (k % 15 === 0) wobble = (rnd() * 2 - 1) * 0.1;
                const off = s.pos.z - cz;
                const fix = Math.abs(off) > 0.2 ? -Math.sign(off) * 0.15 : 0;
                g.setInput({ joystick: { x: wobble + fix, y: -1 } });
                s = g.step(1);
                if (s.pos.x > g0.minX && s.pos.x < g0.maxX) maxOff = Math.max(maxOff, Math.abs(s.pos.z - cz));
                if (s.pos.x > g0.maxX + 1.2 || g.events.some((e) => e.type === 'waterFall')) break;
            }
            g.clearInput();
            return { seed, maxOff, fell: g.events.some((e) => e.type === 'waterFall') };
        }, [seed]));
    }
    console.log('wobbly', JSON.stringify(wob));
    check('plank: a wobbly iPad thumb that corrects itself gets across (at least 6 of 8)', wob.filter((w) => !w.fell).length >= 6, wob);
    // On the plank through two tips: no slide
    const r = await page.evaluate(() => {
        const g = window.__game;
        g.restore();
        const g0 = g.state().platforms.find((p) => p.plank > 0).gap;
        const x = (g0.minX + g0.maxX) / 2, z = (g0.minZ + g0.maxZ) / 2 + 0.25;
        g.teleport({ x, z, yaw: -Math.PI / 2 });
        g.clearEvents();
        let s;
        for (let n = 0; n < 2; n++) {
            for (let k = 0; k < 2000; k++) { s = g.step(1); if (s.rocking.phase === 'tip') break; }
            for (let k = 0; k < 2000; k++) { s = g.step(1); if (s.rocking.phase === 'calm') break; }
        }
        return { pos: s.pos, x, z, ev: g.events.map((e) => e.type).filter((e) => ['waterFall', 'fall'].includes(e)) };
    });
    check('on the plank: no slide, no fall over two tips', Math.abs(r.pos.z - r.z) < 0.001 && Math.abs(r.pos.x - r.x) < 0.001 && r.ev.length === 0, r);
    await page.evaluate(() => { const g = window.__game; g.restore(); const g0 = g.state().platforms.find((p) => p.plank > 0).gap; g.teleport({ x: g0.minX - 3, z: (g0.minZ + g0.maxZ) / 2, yaw: -Math.PI / 2 }); g.step(1); });
    await shot('plank');
    const f = await page.evaluate(() => {
        const g = window.__game;
        g.restore();
        const g0 = g.state().platforms.find((p) => p.plank > 0).gap;
        g.teleport({ x: (g0.minX + g0.maxX) / 2, z: g0.minZ + 0.4, yaw: 0 });
        g.clearEvents();
        for (let k = 0; k < 400; k++) g.step(1);
        return { ev: g.events.map((e) => e.type).filter((e) => ['waterFall', 'splash'].includes(e)), text: g.text() };
    });
    check('off the plank: falls, splash, back to the start', f.ev.includes('waterFall') && f.ev.includes('splash') && JSON.stringify(f.text).includes('Splash'), f);
}

if (want('cannon')) {
    for (let ci = 0; ci < 4; ci++) {
        const r = await page.evaluate((ci) => {
            const g = window.__game;
            g.restore();
            const c = g.state().cannons[ci];
            g.teleport({ x: c.x, z: c.z });
            g.clearEvents();
            let s;
            for (let k = 0; k < 300; k++) s = g.step(1);
            return { c, pos: s.pos, ev: g.events.filter((e) => ['cannon', 'fall', 'waterFall'].includes(e.type)).map((e) => e.type + ':' + (e.what ?? '')) };
        }, ci);
        check(`cannon ${ci + 1}: fires and lands at the other cannon, no fall`, r.ev.includes('cannon:fire') && Math.hypot(r.pos.x - r.c.landing.x, r.pos.z - r.c.landing.z) < 0.6 && !r.ev.some((e) => e.startsWith('fall') || e.startsWith('waterFall')), r);
    }
    for (const ci of [0, 2]) {
        await page.evaluate((ci) => { const g = window.__game; g.restore(); const c = g.state().cannons[ci]; const o = g.state().cannons[ci + 1]; const dx = o.x - c.x, dz = o.z - c.z, d = Math.hypot(dx, dz); g.teleport({ x: c.x - dx / d * 2.5, z: c.z - dz / d * 2.5, yaw: Math.atan2(-dx, -dz) }); g.step(1); }, ci);
        await shot(`cannon${ci / 2 + 1}`);
    }
}

if (want('wave')) {
    for (const i of [0, 1]) {
        const v = st.vents[i];
        const cx = (v.minX + v.maxX) / 2, cz = (v.minZ + v.maxZ) / 2;
        let r = await page.evaluate(([i, cx, cz, v]) => {
            const g = window.__game;
            g.restore();
            for (let k = 0; k < 900; k++) { const s = g.step(1); const w = s.vents[i]; if (w.phase === 'warning' && w.timer <= 0.4) break; }
            g.teleport({ x: cx + 0.3, z: cz - 0.3 });
            g.clearEvents();
            let s;
            for (let k = 0; k < 120; k++) s = g.step(1);
            return { pos: s.pos, target: v.target, ev: g.events.map((e) => e.type === 'sound' ? 'sound:' + e.name : e.type), msg: g.text() };
        }, [i, cx, cz, v]);
        check(`wave ${i + 1}: washed one cell back to its Q, not an Ouch`, r.ev.includes('wave') && Math.hypot(r.pos.x - r.target.x, r.pos.z - r.target.z) < 0.3 && !r.ev.includes('spike') && !r.ev.includes('waterFall') && !JSON.stringify(r.msg).includes('Ouch'), r);
        const pose = { x: v.target.x - (cx - v.target.x) * 0.6, z: v.target.z - (cz - v.target.z) * 0.6, yaw: Math.atan2(-(cx - v.target.x), -(cz - v.target.z)) };
        await page.evaluate(([i, pose]) => { const g = window.__game; g.restore(); for (let k = 0; k < 900; k++) { const s = g.step(1); const w = s.vents[i]; if (w.phase === 'warning' && w.timer <= 0.1) break; } g.teleport(pose); g.step(1); }, [i, pose]);
        await shot(`wave${i + 1}`);
    }
    const w = await page.evaluate(() => {
        const g = window.__game;
        g.restore();
        const ch = [[], []];
        let last = g.state().vents.map((v) => v.phase);
        for (let k = 0; k < 600; k++) { const s = g.step(1); s.vents.forEach((v, i) => { if (v.phase !== last[i]) { ch[i].push([v.phase, g.time()]); last[i] = v.phase; } }); }
        return ch.map((c) => c.find((x) => x[0] === 'puff')?.[1]);
    });
    check('the two waves splash at different times', Math.abs(w[0] - w[1]) > 1, w);
}

if (want('spike')) {
    // Path spike (heading south): squeeze past both sides, Ouch in the middle
    let r = await page.evaluate(() => {
        const g = window.__game;
        const out = [];
        const sp = g.state().spike2;
        for (const off of [-1.1, -1.0, 1.0, 1.1]) {
            g.restore();
            g.teleport({ x: sp.x + off, z: sp.z - 3.5, yaw: Math.PI });
            g.clearEvents();
            g.setInput({ forward: true });
            let s;
            for (let i = 0; i < 40; i++) s = g.step(2);
            g.clearInput();
            out.push({ off, x: s.pos.x, z: s.pos.z, ouch: g.events.filter((e) => e.type === 'spike').length });
        }
        g.restore();
        g.teleport({ x: sp.x, z: sp.z - 3, yaw: Math.PI });
        g.clearEvents();
        g.setInput({ forward: true });
        for (let i = 0; i < 40; i++) g.step(2);
        g.clearInput();
        out.push({ middle: true, ouch: g.events.filter((e) => e.type === 'spike').length, msg: g.text() });
        return { sp, out };
    });
    const left = r.out.filter((o) => o.off < 0 && o.ouch === 0 && o.z > r.sp.z + 2), right = r.out.filter((o) => o.off > 0 && o.ouch === 0 && o.z > r.sp.z + 2);
    check('path splinter spike (0.72): squeeze past both sides, Ouch in the middle', left.length > 0 && right.length > 0 && r.out[4].ouch > 0 && JSON.stringify(r.out[4].msg).includes('splinter spike'), r);
    // iPad circle straight past one side
    r = await page.evaluate(() => {
        const g = window.__game;
        const sp = g.state().spike2;
        g.restore();
        g.teleport({ x: sp.x + 1.05, z: sp.z - 3.5, yaw: Math.PI });
        g.clearEvents();
        g.setInput({ joystick: { x: 0, y: -1 } });
        let s;
        for (let i = 0; i < 40; i++) s = g.step(2);
        g.clearInput();
        return { pos: s.pos, ouch: g.events.filter((e) => e.type === 'spike').length, sp };
    });
    check('path splinter spike: iPad circle squeezes past', r.ouch === 0 && r.pos.z > r.sp.z + 2, r);
    await page.evaluate(() => { const g = window.__game; const sp = g.state().spike2; g.restore(); g.teleport({ x: sp.x, z: sp.z - 6, yaw: Math.PI }); g.step(2); });
    await shot('pathspike');
    // Sneaky spike
    r = await page.evaluate((spike) => {
        const g = window.__game;
        let out = null;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            g.restore();
            g.teleport({ x: spike.x + dx * 1.2, z: spike.z + dz * 1.2, yaw: Math.atan2(dx, dz) });
            g.clearEvents();
            g.setInput({ forward: true });
            for (let k = 0; k < 40 && !g.events.some((e) => e.type === 'spike'); k++) g.step(2);
            g.clearInput();
            if (g.events.some((e) => e.type === 'spike')) { out = { dx, dz, msg: g.text() }; break; }
        }
        return out;
    }, st.spike);
    check('sneaky splinter spike: Ouch', !!r && JSON.stringify(r.msg).includes('Ouch!'), r);
    // Big spike: walking into it is an Ouch
    const row = st.spikeRows[0];
    r = await page.evaluate((row) => {
        const g = window.__game;
        const out = [];
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            g.restore();
            g.teleport({ x: row.x + dx * 2.2, z: row.z + dz * 2.2, yaw: Math.atan2(dx, dz) });
            g.clearEvents();
            g.setInput({ forward: true });
            for (let k = 0; k < 40 && !g.events.some((e) => e.type === 'spike'); k++) g.step(2);
            g.clearInput();
            out.push(g.events.filter((e) => e.type === 'spike').length);
        }
        return out;
    }, row.position ?? row);
    check('big splinter spike: Ouch from its open side', r.some((n) => n > 0), { r, row });
}

if (want('rock')) {
    const r = await page.evaluate(() => {
        const g = window.__game;
        g.restore();
        const out = [];
        for (let n = 0; n < 2; n++) {
            let t0;
            for (let k = 0; k < 2000; k++) { const s = g.step(1); if (s.rocking.phase === 'tip') { t0 = g.time(); break; } }
            const before = g.state().pos, side = g.state().rocking.side;
            for (let k = 0; k < 2000; k++) { const s = g.step(1); if (s.rocking.phase === 'calm') break; }
            out.push({ side, t0, dz: g.state().pos.z - before.z });
        }
        return out;
    });
    check('at the start: tips every 8 s, slides a quarter cell toward the low side, alternating', r.every((t) => Math.abs(Math.abs(t.dz) - 0.75) < 0.05 && Math.sign(t.dz) === t.side) && r[0].side !== r[1].side && Math.abs(r[1].t0 - r[0].t0 - 8) < 0.2, r);
    await page.evaluate(() => { const g = window.__game; g.restore(); for (let k = 0; k < 2000; k++) { const s = g.step(1); if (s.rocking.phase === 'tip' && s.rocking.timer > 0.7) break; } });
    await shot('tip');
}

if (want('finale')) {
    await page.evaluate(() => { const g = window.__game; g.restore(); g.teleport({ yaw: -Math.PI / 2 }); g.step(1); });
    await shot('start');
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
    check('finale: golden door, confetti, extra-long cheer, You beat Pirate Ship World!, More levels coming soon!, Quit only',
        fin.escaped && fin.ev.some((e) => e.startsWith('confetti')) && fin.calls.some((c) => c?.long) && fin.title === 'You beat Pirate Ship World!' && ((/More levels coming soon/.test(fin.note ?? '') && !fin.next && fin.items.length === 1 && /Quit/.test(fin.items[0])) || fin.items.some((x) => /Start [A-Z][a-zA-Z ]* World/.test(x))), fin);
    await page.waitForTimeout(1500);
    await shot('finale');
}
check('no page errors', errors.length === 0, errors);
if (want('prev')) {
    const page2 = await ctx.newPage();
    page2.on('pageerror', (e) => errors.push(String(e)));
    await page2.goto(BASE + '/?test=1&level=128', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page2.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
    const r = await page2.evaluate(() => {
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
    check('Level 129 door: Start Level 130', r.escaped && r.items[0] === 'Start Level 130', r);
    check('no page errors (Level 129)', errors.length === 0, errors);
}
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
