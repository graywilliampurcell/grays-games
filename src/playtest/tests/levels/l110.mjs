// Level 110 checks (vite preview on 9173)
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
await page.goto(BASE + '/?test=1&level=109', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
await page.keyboard.press('Shift');
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 700)); };
const shot = (name) => page.screenshot({ path: `${SP}l110-${name}.png` });

let st = await page.evaluate(() => window.__game.state());
check('Level 110 loads: two carpets, two trapdoors, one spinning wall, no cactus, no button door',
    st.level.name === 'Level 110' && st.platforms.length === 2 && st.platforms.every((p) => p.carpet) && st.trapdoors.length === 2 && !!st.spinWall && (st.buttonDoors ?? []).length === 0 && st.spikeRows.length === 0 && !st.spike && !st.spike2 && st.geysers.length === 0,
    { p: st.platforms, t: st.trapdoors, spin: st.spinWall, bd: st.buttonDoors, rows: st.spikeRows, spike: st.spike });
check('tune pyramidfinale', (await page.evaluate(() => window.__sound?.tuneName)) === 'pyramidfinale', {});
console.log('door', JSON.stringify(st.door), 'start', JSON.stringify(st.pos), 'trap', JSON.stringify(st.trapdoors));
await shot('start');

// Carpets: rest 2 / cross 2 each, 1 s out of step
let r = await page.evaluate(() => {
    const g = window.__game;
    const logs = [[], []]; const last = [null, null];
    for (let i = 0; i < 60 * 13; i++) { const ps = g.step(1).platforms; ps.forEach((p, k) => { if (p.phase !== last[k]) { logs[k].push({ i, phase: p.phase, at: p.at }); last[k] = p.phase; } }); }
    return { logs, dt: g.dt };
});
const durs = r.logs.map((log) => log.slice(1, -1).map((e, k) => (log[k + 2].i - e.i) * r.dt));
check('each carpet: rest 2 s / cross 2 s', durs.every((d) => d.length >= 3 && d.every((x) => Math.abs(x - 2) < 0.05)), { durs });
const firstCross = r.logs.map((log) => log.find((e) => e.phase === 'cross')?.i);
check('the two carpets run about 1 s apart', Math.abs(Math.abs(firstCross[0] - firstCross[1]) * r.dt - 1) < 0.05, { firstCross });

const ride = ({ k, p, yaw, axis, near }) => {
    const g = window.__game;
    g.restore();
    let q;
    for (let i = 0; i < 60 * 10; i++) { q = g.step(1).platforms[k]; if (q.phase === 'rest' && Math.abs(q.at - near) < 0.01 && q.time < 0.05) break; }
    g.teleport({ ...p, yaw });
    g.clearEvents();
    g.setInput({ forward: true });
    let s;
    for (let i = 0; i < 45; i++) s = g.step(1);
    g.clearInput();
    let departed = null, arrived = null;
    for (let i = 0; i < 60 * 6; i++) {
        s = g.step(1);
        const ev = g.events.map((e) => e.what ?? e.type);
        if (departed === null && ev.includes('depart')) departed = i;
        if (arrived === null && ev.includes('arrive')) { arrived = i; break; }
    }
    const atArrive = s.pos[axis];
    g.setInput({ forward: true });
    for (let i = 0; i < 60; i++) s = g.step(1);
    g.clearInput();
    return { departed, arrived, atArrive, end: s.pos, ev: [...new Set(g.events.map((e) => e.what ?? e.type))] };
};
r = await page.evaluate(ride, { k: 0, p: { x: 26.5, z: 34.5 }, yaw: Math.PI / 2, axis: 'x', near: 8.6 });
check('carpet 1: ride west over its pit, no fall', r.departed !== null && r.arrived !== null && r.atArrive < 14 && r.end.x < 12 && !r.ev.includes('fall'), r);
r = await page.evaluate(ride, { k: 1, p: { x: 34.5, z: 22.5 }, yaw: Math.PI, axis: 'z', near: 0 });
check('carpet 2: ride south over its pit, no fall', r.departed !== null && r.arrived !== null && r.atArrive > 34 && r.end.z > 36 && !r.ev.includes('fall'), r);
r = await page.evaluate(() => {
    const g = window.__game;
    g.restore();
    let p;
    for (let i = 0; i < 60 * 10; i++) { p = g.step(1).platforms[0]; if (p.phase === 'rest' && p.at < 0.01) break; }
    g.teleport({ x: 26.5, z: 34.5, yaw: Math.PI / 2 });
    g.clearEvents();
    g.setInput({ forward: true });
    for (let i = 0; i < 60; i++) g.step(1);
    g.clearInput();
    return { ev: [...new Set(g.events.map((e) => e.type))], text: g.text() };
});
check('pit 1 while its carpet is away: sand pit message', r.ev.includes('fall') && r.text.some((t) => t.includes('You fell in the sand pit')), r);
await page.evaluate(() => { const g = window.__game; g.restore(); let p; for (let i = 0; i < 60 * 10; i++) { p = g.step(1).platforms[0]; if (p.phase === 'rest' && p.at > 8 && p.time > 0.5) break; } g.teleport({ x: 27.5, z: 34.5, yaw: Math.PI / 2 }); g.step(1); });
await shot('carpet1');
await page.evaluate(() => { const g = window.__game; g.restore(); let p; for (let i = 0; i < 60 * 10; i++) { p = g.step(1).platforms[1]; if (p.phase === 'rest' && p.at === 0 && p.time > 0.5) break; } g.teleport({ x: 34.5, z: 21.5, yaw: Math.PI }); g.step(1); });
await shot('carpet2');

// Trapdoors: closed 3 / warning 1 / open 2, independent timers
r = await page.evaluate(() => {
    const g = window.__game;
    const logs = [[], []]; const last = [null, null];
    for (let i = 0; i < 60 * 14; i++) { const ts = g.step(1).trapdoors; ts.forEach((t, k) => { if (t.phase !== last[k]) { logs[k].push({ i, phase: t.phase }); last[k] = t.phase; } }); }
    return { logs, dt: g.dt };
});
for (const [k, log] of r.logs.entries()) {
    const dur = {};
    for (let n = 1; n + 1 < log.length; n++) (dur[log[n].phase] ??= []).push((log[n + 1].i - log[n].i) * r.dt);
    const near = (xs, v) => xs?.length && xs.every((x) => Math.abs(x - v) < 0.05);
    check(`trapdoor ${k}: closed 3 s, warning 1 s, open 2 s`, near(dur.closed, 3) && near(dur.warning, 1) && near(dur.open, 2), { dur });
}
const opens = r.logs.map((log) => log.find((e, n) => n > 0 && e.phase === 'open')?.i);
check('the two trapdoors open at different times', opens[0] !== opens[1], { opens });
for (const [k, T] of st.trapdoors.entries()) {
    r = await page.evaluate(({ T, k }) => {
        const g = window.__game;
        g.restore();
        let t;
        for (let i = 0; i < 60 * 8; i++) { t = g.step(1).trapdoors[k]; if (t.phase === 'closed') break; }
        g.teleport({ x: (T.minX + T.maxX) / 2, z: (T.minZ + T.maxZ) / 2, yaw: 0 });
        g.clearEvents();
        let fellAt = null, s;
        for (let i = 0; i < 60 * 5; i++) { s = g.step(1); if (g.events.some((e) => e.type === 'spike')) { fellAt = s.trapdoors[k].phase; break; } }
        return { fellAt, what: g.events.filter((e) => e.type === 'spike').map((e) => e.what), text: g.text() };
    }, { T, k });
    check(`stand on trapdoor ${k}: falls through when it opens`, r.fellAt === 'open' && r.what.includes('trapdoor') && r.text.some((x) => x.includes('fell through the trapdoor')), r);
}
await page.evaluate((T) => { const g = window.__game; g.restore(); g.teleport({ x: T.minX - 3, z: (T.minZ + T.maxZ) / 2, yaw: -Math.PI / 2 }); g.step(1); }, st.trapdoors.find((t) => t.minZ > 36) ?? st.trapdoors[0]);
await shot('trapdoor');

// Spinning wall: E at z 28, x 37-39, between (9,7) (z 30.5) and (9,6) (z 26.5)
const spinFrom = (z, yaw) => page.evaluate(({ z, yaw }) => {
    const g = window.__game;
    g.restore();
    g.teleport({ x: 38.5, z, yaw });
    g.clearEvents();
    g.setInput({ forward: true });
    let s;
    for (let i = 0; i < 60 * 3; i++) { s = g.step(1); if (g.events.some((e) => e.type === 'spin')) break; }
    g.clearInput();
    for (let i = 0; i < 30; i++) s = g.step(1);
    const ev = g.events.filter((e) => ['spinStart', 'spin', 'spike', 'fall'].includes(e.type));
    return { ev, end: s.pos };
}, { z, yaw });
r = await spinFrom(30.5, 0);
check('spinning wall heading north (the path way): spins you through', r.ev.some((e) => e.type === 'spin') && Math.abs(r.end.z - 26.5) < 0.7 && Math.abs(r.end.x - 38.5) < 0.7, r);
r = await spinFrom(26.5, Math.PI);
check('spinning wall from the north: back through', r.ev.some((e) => e.type === 'spin') && Math.abs(r.end.z - 30.5) < 0.7, r);
await page.evaluate(() => { const g = window.__game; g.restore(); g.teleport({ x: 38.5, z: 33.5, yaw: 0 }); g.step(1); });
await shot('beetle');

// The finale: golden door, confetti, long cheer, You beat Pyramid World!
const fin = await page.evaluate(({ door }) => {
    const g = window.__game;
    g.restore();
    g.clearEvents();
    g.teleport({ x: door.x - 1.5, z: door.z, yaw: -Math.PI / 2 });
    g.setInput({ forward: true });
    let st;
    for (let i = 0; i < 60 && !(st = g.step(1)).escaped; i++);
    g.clearInput();
    const vis = (id) => { const el = document.getElementById(id); return !!el && !el.hidden && !el.closest('[hidden]'); };
    const next = document.querySelector('[data-act=next-level]');
    return {
        escaped: st.escaped,
        ev: g.events.map((e) => e.type + (e.long ? ':long' : '')),
        title: document.getElementById('finish-title').textContent,
        note: vis('finish-note') ? document.getElementById('finish-note').textContent : null,
        next: !!next && !next.hidden && !next.closest('[hidden]'),
        golden: g.state().door?.golden ?? null,
    };
}, { door: st.door });
check('finale: confetti, You beat Pyramid World!, More levels coming soon!, no next button', fin.escaped && fin.ev.some((e) => e.startsWith('confetti')) && fin.title === 'You beat Pyramid World!' && /More levels coming soon|Start (Level [0-9]+|[A-Z][a-zA-Z ]* World)/.test(fin.note ?? '') && !fin.next, fin);
await page.waitForTimeout(1500);
await shot('finale');
check('no page errors', errors.length === 0, errors);
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
