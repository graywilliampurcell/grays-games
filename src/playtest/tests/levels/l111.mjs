// Level 111 checks (vite preview on 9173)
import { chromium, BASE, SHOTS } from '../playwright.mjs';
import fs from 'fs';
const SP = SHOTS;
fs.mkdirSync(SP, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const results = [];
const check = (name, ok, info) => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info ?? {}).slice(0, 700)); };

async function open(query) {
    const ctx = await browser.newContext({ viewport: { width: 1024, height: 640 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${BASE}/?test=1&level=110${query}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
    await page.keyboard.press('Shift'); // sound starts
    await page.evaluate(() => window.__game.restore());
    return page;
}
const shot = async (page, name) => { const t = Date.now(); await page.screenshot({ path: `${SP}l111-${name}.png`, timeout: 180000 }); console.log('shot', name, Date.now() - t, 'ms'); };

// Walk the player (teleporting in small steps at walking speed) along points
const WALK = `
window.__walk = (points) => {
    const g = window.__game;
    let s = g.state();
    for (const [x, z] of points) {
        for (let tries = 0; tries < 40; tries++) {
            const dx = x - s.pos.x, dz = z - s.pos.z;
            const d = Math.hypot(dx, dz);
            if (d < 0.3) break;
            const yaw = Math.atan2(-dx, -dz);
            s = g.teleport({ yaw });
            g.setInput({ forward: true });
            let n = 0;
            for (; n < 20; n++) {
                s = g.step(1);
                if (s.escaped) { g.clearInput(); return s; }
                const ex = x - s.pos.x, ez = z - s.pos.z;
                if (Math.hypot(ex, ez) < 0.3 || ex * dx + ez * dz < 0) break;
            }
            g.clearInput();
            s = g.step(1);
        }
    }
    return s;
};
window.__center = ([i, j]) => [4 * i + 2.5, 4 * j + 2.5];
`;

let page = await open('');
await page.evaluate(WALK);
let st = await page.evaluate(() => window.__game.state());
const p = st.platforms[0];
check('Level 111 loads: one long-neck pit, one bone spike, nothing else', st.level.name === 'Level 111' && st.platforms.length === 1 && !!st.spike && !st.spike2 && st.spikeRows.length === 0 && !st.buttonDoor && (st.trapdoors ?? []).length === 0 && !st.spinWall, { level: st.level, p, spike: st.spike });
check('tune dinosneak', (await page.evaluate(() => window.__sound?.tuneName)) === 'dinosneak', {});
check('egg at the start, buddy not out yet', st.buddy && st.buddy.mode === 'egg' && st.buddy.egg && !st.buddy.visible, st.buddy);
check('correct path found from start to door', st.buddy.path.length === 66, { n: st.buddy.path.length, first: st.buddy.path[0], last: st.buddy.path.at(-1) });
await page.evaluate(() => window.__game.step(30));
await shot(page, 'egg');
// Hatching: wobble at 2 s, crack + squeak at 2.8 s
let r = await page.evaluate(() => {
    const g = window.__game;
    g.clearEvents();
    const out = [];
    for (let i = 0; i < 60 * 4; i++) {
        const s = g.step(1);
        for (const e of g.events.splice(0)) if (['buddy', 'sound'].includes(e.type)) out.push({ t: e.t, type: e.type, what: e.what ?? e.name });
        if (i === 155) out.push({ shotAt: s.t });
    }
    return { out, b: g.state().buddy };
});
const wob = r.out.find((e) => e.what === 'wobble');
const crack = r.out.find((e) => e.what === 'crack');
const squeak = r.out.find((e) => e.what === 'squeak');
check('egg wobbles ~2 s, cracks ~2.8 s with crack sound and squeak, then he follows', wob && Math.abs(wob.t - 2) < 0.1 && crack && Math.abs(crack.t - 2.8) < 0.1 && squeak && r.out.some((e) => e.what === 'eggCrack') && r.b.mode === 'follow' && r.b.visible, r);
await shot(page, 'hatched');

// Follow along the first 20 path cells: about one cell behind, always on floor
r = await page.evaluate(() => {
    const g = window.__game;
    const s0 = g.state();
    const cells = s0.buddy.path.slice(0, 20).map(window.__center);
    const grid = s0.grid;
    let maxBehind = 0, minBehind = 99, offFloor = 0, samples = 0;
    const g2 = g;
    const orig = g2.step;
    let s;
    for (const c of cells) {
        s = window.__walk([c]);
        const b = s.buddy;
        const d = Math.hypot(b.x - s.pos.x, b.z - s.pos.z);
        samples++;
        maxBehind = Math.max(maxBehind, d);
        minBehind = Math.min(minBehind, d);
        if (grid[Math.floor(b.z)][Math.floor(b.x)] === '#') offFloor++;
    }
    // Stand still a moment: he catches up to about one cell behind
    s = g.step(60);
    const d = Math.hypot(s.buddy.x - s.pos.x, s.buddy.z - s.pos.z);
    return { maxBehind, minBehind, offFloor, samples, still: d, b: s.buddy, pos: s.pos };
});
check('buddy follows about a cell behind, never inside a wall', r.offFloor === 0 && r.still > 2 && r.still < 4.2 && r.maxBehind < 8, r);
await shot(page, 'follow');

// The long-neck ride: from the cell before the pit, walk east onto its head
r = await page.evaluate(() => {
    const g = window.__game;
    let s = g.state();
    const path = s.buddy.path;
    const k = path.findIndex(([i, j]) => i === 1 && j === 0);
    // Walk to the cell before the pit along the path
    s = window.__walk(path.slice(20, k).map(window.__center));
    const p0 = s.platforms[0];
    g.clearEvents();
    // Onto the head (walk east)
    s = window.__walk([[6.6, 2.5]], 5);
    let departed = null, arrived = null, onHead = false;
    for (let i = 0; i < 60 * 4; i++) {
        s = g.step(1);
        if (s.buddy.onHead) onHead = true;
        for (const e of g.events.splice(0)) {
            if (e.type === 'platform' && e.what === 'depart') departed = e.t;
            if (e.type === 'platform' && e.what === 'arrive') arrived = e.t;
        }
        if (i === 40) window.__mid = s;
        if (arrived !== null) break;
    }
    const atArrive = s.pos;
    const headAt = s.platforms[0];
    // Step off east, onto the floor beyond
    s = window.__walk([[18.5, 2.5]], 5);
    s = g.step(90);
    return { p0, departed, arrived, ride: arrived - departed, onHead, atArrive, headAt, after: s.pos, buddy: s.buddy, events: g.events.slice(-5) };
});
check('long-neck: carries you across, buddy rides on its head, then steps off after you', r.departed !== null && r.arrived !== null && r.onHead && r.atArrive.x > 14 && r.buddy.mode === 'follow' && !r.buddy.onHead && r.buddy.x > 14 && r.after.x > 17, r);
console.log('ride time (depart -> arrive)', r.ride);
await page.evaluate(() => window.__game.teleport({ x: 3.5, z: 2.5, yaw: -Math.PI / 2 }));
await page.evaluate(() => window.__game.step(2));

// Falling in the pit when the head is on the far side
r = await page.evaluate(() => {
    const g = window.__game;
    let s = g.state();
    g.clearEvents();
    // The head is at the far edge now: walk straight in from the start side
    g.teleport({ x: 3, z: 2.5, yaw: -Math.PI / 2 });
    g.setInput({ forward: true });
    for (let i = 0; i < 60 && !g.events.some((e) => e.type === 'fall'); i++) s = g.step(1);
    g.clearInput();
    s = g.step(2);
    const ev = g.events.map((e) => e.type + ':' + (e.text ?? ''));
    return { ev, pos: s.pos, head: s.platforms[0].at, buddy: s.buddy };
});
check('walking into the pit: Ouch, back to the start, buddy back at the start too', r.ev.includes('fall:') && r.ev.some((e) => e.includes('Ouch! You fell in the pit. Back to the start.')) && Math.hypot(r.buddy.x - 2.5, r.buddy.z - 34.5) < 2.6, r);

// Bone spike
r = await page.evaluate(() => {
    const g = window.__game;
    const s = g.state();
    g.clearEvents();
    g.teleport({ x: s.spike.x - 1.5, z: s.spike.z, yaw: -Math.PI / 2 });
    window.__walk([[s.spike.x, s.spike.z]], 4);
    return g.events.map((e) => e.type + ':' + (e.text ?? ''));
});
check('bone spike: Ouch and back to the start', r.some((e) => e.includes('Ouch! A bone spike sent you back to the start.')), r);

// Look at the bone spike, the pit with the long-neck, and the sky
await page.evaluate(() => {
    const g = window.__game;
    const s = g.state();
    g.teleport({ x: s.spike.x + 0.0, z: s.spike.z - 2.6, yaw: Math.PI });
    g.step(1);
});
await shot(page, 'bonespike');
await page.evaluate(() => { const g = window.__game; g.teleport({ x: 2.5, z: 2.5, yaw: -Math.PI / 2 }); g.step(1); });
await shot(page, 'pit');
await page.evaluate(() => { const g = window.__game; g.teleport({ x: 4.2, z: 2.5, yaw: -Math.PI / 2 }); g.getPlayer?.(); g.step(1); });
await page.evaluate(() => { document.querySelector('canvas'); });
await page.mouse.move(512, 320);
await page.evaluate(() => { window.__game.setInput({ lookDy: 220 }); window.__game.step(1); window.__game.setInput({}); window.__game.step(1); });
await shot(page, 'pitdown');
await page.evaluate(() => { window.__game.setInput({ lookDy: -500 }); window.__game.step(1); window.__game.setInput({}); window.__game.step(30); });
await shot(page, 'sky');
check('no page errors', errors.length === 0, errors);

// The lost rule (?lost=1): three trips into wrong ways without getting further
page = await open('&lost=1');
await page.evaluate(WALK);
r = await page.evaluate(() => {
    const g = window.__game;
    g.step(60 * 4); // hatched
    let s = g.state();
    const path = s.buddy.path;
    const key = (c) => c.join(',');
    const on = new Set(path.map(key));
    // Walk along the path until a wrong way branches off; step in and back out, three times
    const grid = s.grid;
    const open = (x, z) => grid[z]?.[x] !== undefined && grid[z][x] !== '#' && grid[z][x] !== 'D';
    const links = ([i, j]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([di, dj]) => open(4 * i + 2 + 2 * di, 4 * j + 2 + 2 * dj)).map(([di, dj]) => [i + di, j + dj]);
    // A wrong way off path cell 4 or later (not the sneaky spike's)
    let k = 3, off = null;
    for (; k < path.length; k++) {
        off = links(path[k]).find((c) => !on.has(key(c)));
        if (off) break;
    }
    g.clearEvents();
    s = window.__walk(path.slice(1, k + 1).map(window.__center));
    const asked = [];
    for (let n = 0; n < 3; n++) {
        s = window.__walk([window.__center(off), window.__center(path[k])]);
        for (const e of g.events.splice(0)) if (e.type === 'lost') asked.push(n);
    }
    return { k, off, asked, b: g.state().buddy, menu: window.__game.text() };
});
check('lost rule: 3 wrong ways without getting further -> asks', r.asked.length === 1 && r.asked[0] === 2 && r.menu.some((t) => t.includes('Help me!')), r);
await shot(page, 'help-ask');
// Help me! is glowing: the spacebar picks it
await page.keyboard.press(' ');
r = await page.evaluate(() => {
    const g = window.__game;
    let s = g.state();
    const path = s.buddy.path;
    const from = s.buddy.furthest;
    const out = [];
    // The player walks on along the path slowly; buddy should be ahead
    for (let k = from + 1; k < Math.min(path.length, from + 8); k++) {
        s = window.__walk([window.__center(path[k])], 4);
        s = g.step(20);
        const b = s.buddy;
        out.push({ k, mode: b.mode, ahead: Math.round(Math.hypot(b.x - s.pos.x, b.z - s.pos.z) * 10) / 10, bc: [Math.floor((b.x - 1) / 4), Math.floor((b.z - 1) / 4)] });
    }
    return { from, out, paused: document.body.classList.contains('paused') };
});
const helping = r.out.filter((o) => o.mode === 'help');
check('Help me!: buddy leads about 2 cells ahead, then goes back to following after 5 cells', !r.paused && helping.length >= 3 && helping.slice(1).every((o) => o.ahead > 4 && o.ahead < 10) && r.out.some((o) => o.mode !== 'help'), r);
await page.evaluate(() => window.__game.step(1));
await shot(page, 'helping');

// No, I'm good: asks again, not sooner than 60 s
page = await open('&lost=1');
await page.evaluate(WALK);
r = await page.evaluate(() => {
    const g = window.__game;
    g.step(60 * 4);
    const t0 = g.time();
    g.clearEvents();
    // Stand still at the start: 60 s without getting further
    const asks = [];
    for (let i = 0; i < 62 * 4; i++) {
        g.step(15);
        for (const e of g.events.splice(0)) if (e.type === 'lost') asks.push(g.time() - t0);
        if (asks.length) break;
    }
    return { asks };
});
check('60 s without getting further -> asks', r.asks.length === 1 && Math.abs(r.asks[0] - 60) < 0.6, r);
// Pick No, I'm good (↓ then space)
await page.keyboard.press('ArrowDown');
await page.keyboard.press(' ');
r = await page.evaluate(() => {
    const g = window.__game;
    const t0 = g.time();
    g.clearEvents();
    const asks = [];
    const paused = document.body.classList.contains('paused');
    for (let i = 0; i < 62 * 4; i++) {
        g.step(15);
        for (const e of g.events.splice(0)) if (e.type === 'lost') asks.push(g.time() - t0);
        if (asks.length) break;
    }
    return { asks, paused, mode: g.state().buddy.mode };
});
check("No, I'm good: play goes on, asks again after about 60 s", !r.paused && r.mode === 'follow' && r.asks.length === 1 && r.asks[0] >= 59.5, r);

// Settings: the 111 switch right below 6 7, On; Off -> no egg, buddy already there
page = await open('');
await page.evaluate(() => { document.querySelector('#pause-btn').click(); });
await page.evaluate(() => { [...document.querySelectorAll('#menu-main .item')].find((i) => i.dataset.act === 'settings').click(); });
r = await page.evaluate(() => {
    const items = [...document.querySelectorAll('#menu-settings .item')].map((i) => ({ s: i.dataset.setting, on: i.classList.contains('on'), text: i.innerText.replace(/\n/g, ' / ') }));
    return items;
});
const i67 = r.findIndex((i) => i.s === 'sixSeven');
check('111 switch: right below 6 7, On by default, shows 111 + Dinosaur World', r[i67 + 1]?.s === 'dinoHatch' && r[i67 + 1].on && r[i67 + 1].text.includes('111') && r[i67 + 1].text.includes('Dinosaur World'), r);
await shot(page, 'settings');
await page.evaluate(() => { document.querySelector('[data-setting=dinoHatch]').click(); });
await shot(page, 'settings-off');
r = await page.evaluate(() => {
    document.querySelector('[data-setting=dinoHatch]').classList.contains('on');
    [...document.querySelectorAll('#menu-settings .item')].find((i) => i.dataset.act === 'back').click();
    [...document.querySelectorAll('#menu-main .item')].find((i) => i.dataset.act === 'start-over').click();
    const g = window.__game;
    g.restore();
    const b0 = g.state().buddy;
    g.clearEvents();
    g.step(60 * 4);
    return { b0, events: g.events.filter((e) => e.type === 'buddy'), off: !document.querySelector('[data-setting=dinoHatch]').classList.contains('on') };
});
check('111 Off: no egg, the buddy is already standing at the start', r.off && r.b0.mode === 'follow' && r.b0.visible && !r.b0.egg && r.events.length === 0, r);
await page.evaluate(() => window.__game.step(1));
await shot(page, 'nohatch');

// Level 110's finish: Start Dinosaur World, no "More levels coming soon!"
page = await open('');
r = await page.evaluate(() => {
    const g = window.__game;
    const s = g.loadLevelIndex ? null : null;
    return null;
});
await page.goto(BASE + '/?test=1&level=109', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
r = await page.evaluate(() => {
    const g = window.__game;
    const s = g.state();
    g.teleport({ x: s.door.x - 2, z: s.door.z, yaw: -Math.PI / 2 });
    g.setInput({ forward: true });
    g.step(60);
    g.clearInput();
    return { level: s.level.name, text: g.text(), note: !document.getElementById('finish-note').hidden };
});
check('Level 110 end: "Start Dinosaur World" above Quit, no "More levels coming soon!"', r.level === 'Level 110' && r.text.includes('Start Dinosaur World') && r.text.indexOf('Start Dinosaur World') < r.text.indexOf('Quit') && !r.note, r);
await shot(page, 'l110-end');
await page.evaluate(() => [...document.querySelectorAll('#menu-finish .item')].find((i) => i.dataset.act === 'next-level').click());
r = await page.evaluate(() => { const s = window.__game.state(); return { level: s.level.name, buddy: s.buddy?.mode }; });
check('Start Dinosaur World starts Level 111 with the egg', r.level === 'Level 111' && r.buddy === 'egg', r);

// Pick a level: a Dinosaur World button
page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.evaluate(() => {
    localStorage.setItem('mazle.furthest', '110');
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
r = await page.evaluate(() => {
    const ok = [...document.querySelectorAll('#menu-news .item, #menu-title .item')].find((i) => !i.closest('[hidden]') && (i.dataset.act === 'news-ok'));
    ok?.click();
    [...document.querySelectorAll('#menu-title .item')].find((i) => i.dataset.act === 'pick-level').click();
    return [...document.querySelectorAll('#world-grid .item')].map((i) => ({ text: i.innerText, cls: i.className }));
});
check('Pick a level: Dinosaur World button (111) in its look', r.some((b) => b.text.startsWith('111') && b.cls.includes('look-dino')), r.slice(-3));
await page.screenshot({ path: `${SP}l111-picker.png` });

check('no page errors (all)', errors.length === 0, errors);
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
