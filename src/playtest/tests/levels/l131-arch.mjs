// Iteration 171 (rainbow arches) checks, every Sky World level with a
// rainbow bridge: the walking surface is an arch (floor level at both edges,
// one peak in the middle), your eye stays below the wall tops, your speed
// across the ground is unchanged, and the cycle still works. (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
import fs from 'fs';
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 900)); };
const WALL = 4;
const EYE = 1.6;
const LEVELS = { 131: 1, 133: 1, 135: 1, 138: 1, 139: 2, 140: 2 };
const only = process.env.ONLY ? process.env.ONLY.split(',').map(Number) : null;
for (const [num, count] of Object.entries(LEVELS)) {
    if (only && !only.includes(+num)) continue;
    const ctx = await browser.newContext({ viewport: { width: 1024, height: 640 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${BASE}/?test=1&level=${num - 1}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
    const st = await page.evaluate(() => window.__game.restore());
    const rainbows = st.platforms.filter((p) => p.rainbow);
    check(`Level ${num}: ${count} rainbow(s)`, st.level.name === `Level ${num}` && rainbows.length === count, { name: st.level.name, n: rainbows.length });
    for (let i = 0; i < st.platforms.length; i++) {
        if (!st.platforms[i].rainbow) continue;
        const r = await page.evaluate(([i]) => {
            const g = window.__game;
            g.restore();
            const p0 = g.state().platforms[i];
            const gp = p0.gap;
            const mid = p0.alongX ? (gp.minZ + gp.maxZ) / 2 : (gp.minX + gp.maxX) / 2;
            const yaw = p0.alongX ? -Math.PI / 2 : Math.PI; // facing +x / +z
            const along = (s) => (p0.alongX ? s.pos.x - gp.minX : s.pos.z - gp.minZ);
            let s = g.step(1);
            while (s.platforms[i].rainbow.phase !== 'gone') s = g.step(1);
            while (s.platforms[i].rainbow.phase === 'gone') s = g.step(1);
            g.teleport(p0.alongX ? { x: gp.minX - 2, z: mid, yaw } : { x: mid, z: gp.minZ - 2, yaw });
            g.clearEvents();
            g.setInput({ forward: true });
            const samples = [];
            let t0 = null, t1 = null;
            for (let k = 0; k < 600; k++) {
                s = g.step(1);
                const a = along(s);
                samples.push([+a.toFixed(3), s.eyeY]);
                if (t0 === null && a >= 0) t0 = g.time();
                if (t1 === null && a >= p0.span) t1 = g.time();
                if (a > p0.span + 1.5 || g.events.some((e) => e.type === 'fall' || e.type === 'spike')) break;
            }
            g.clearInput();
            return { span: p0.span, samples, crossTime: t1 - t0, ev: g.events.map((e) => e.type).filter((e) => ['fall', 'spike'].includes(e)), pos: s.pos };
        }, [i]);
        const on = r.samples.filter(([a]) => a > 0 && a < r.span);
        const maxEye = Math.max(...r.samples.map(([, e]) => e));
        const peakAt = on.reduce((b, x) => (x[1] > b[1] ? x : b), [0, 0]);
        const edges = r.samples.filter(([a]) => a <= 0 || a >= r.span).map(([, e]) => e);
        let up = true, down = true;
        for (let k = 1; k < on.length; k++) {
            const [a, e] = on[k], [, ep] = on[k - 1];
            if (a < r.span / 2 - 0.3 && e < ep - 1e-3) up = false;
            if (a > r.span / 2 + 0.3 && e > ep + 1e-3) down = false;
        }
        const speed = r.span / r.crossTime;
        // Flat-ground speed for comparison: the floor just past the gap (same steps, full speed by then)
        const before = r.samples.filter(([a]) => a >= r.span);
        const stepsOn = r.samples.filter(([a]) => a >= 0 && a <= r.span);
        // (the median step, so one odd step at the edge doesn't count)
        const perStep = (xs) => { const d = xs.slice(1).map(([a], k) => a - xs[k][0]).sort((x, y) => x - y); return d[Math.floor(d.length / 2)] ?? 0; };
        r.flat = perStep(before) / perStep(stepsOn) * speed;
        const tag = `Level ${num} rainbow ${i}`;
        check(`${tag}: crossed with no fall`, r.ev.length === 0, { ev: r.ev, pos: r.pos });
        check(`${tag}: floor level before and after the gap`, edges.every((e) => Math.abs(e - EYE) < 0.01), { edges: [...new Set(edges)] });
        check(`${tag}: rises to one peak in the middle, then down`, up && down && Math.abs(peakAt[0] - r.span / 2) < 0.5, { peakAt, up, down });
        check(`${tag}: peak eye ${maxEye} below the wall tops (${WALL}), arch ${(maxEye - EYE).toFixed(2)} high`, maxEye < WALL - 0.2 && maxEye > WALL - 0.3, { maxEye });
        check(`${tag}: speed across the ground unchanged (${speed.toFixed(2)} vs flat ${r.flat.toFixed(2)})`, Math.abs(speed - r.flat) / r.flat < 0.05, { crossTime: r.crossTime });
    }
    if (+num === 131) {
        // Screenshots from the top of the arch: ahead, to the side, up a bit
        const p = rainbows[0];
        const cz = (p.gap.minZ + p.gap.maxZ) / 2;
        const cx = (p.gap.minX + p.gap.maxX) / 2;
        for (const [name, yaw] of [['ahead', Math.PI / 2], ['side', 0], ['back', -Math.PI / 2]]) {
            await page.evaluate(([x, z, yaw]) => {
                const g = window.__game;
                g.restore();
                let s = g.step(1);
                while (s.platforms[0].rainbow.phase !== 'gone') s = g.step(1);
                while (s.platforms[0].rainbow.phase === 'gone') s = g.step(1);
                g.teleport({ x, z, yaw });
                g.step(1);
            }, [cx, cz, yaw]);
            await page.screenshot({ path: `${SHOTS}l131-arch-top-${name}.png`, timeout: 180000 });
        }
        await page.evaluate(([x, z]) => { window.__game.teleport({ x, z, yaw: Math.PI / 2 }); window.__game.step(1); }, [p.gap.maxX + 3, cz]);
        await page.screenshot({ path: `${SHOTS}l131-arch-approach.png`, timeout: 180000 });
    }
    await ctx.close();
}
check('no page errors', errors.length === 0, errors.slice(0, 5));
await browser.close();
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAIL');
