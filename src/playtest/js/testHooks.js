// Test-only hook for the playtest bot (see tools/playbot/HOOK_CONTRACT.md).
// Only active when the page URL has ?test=1; otherwise nothing here runs.
import * as THREE from 'three';
import { LEVELS } from './levels.js';

const params = new URLSearchParams(window.location.search);
export const TEST_MODE = params.get('test') === '1';

const DT = 1 / 60;
const TURN_SPEED = 2.5; // radians per second for turnLeft / turnRight
const MOUSE_SENSITIVITY = 0.003; // radians per pixel for the bot's lookDx / lookDy

// Wires up window.__game. Returns null outside test mode, otherwise an object
// main.js uses to report events and (in realtime mode) advance the game.
export function installTestHooks(game) {
    if (!TEST_MODE) return null;

    let time = 0;
    let input = {};
    let layout = LEVELS[0].layout;
    const events = [];

    const hooks = {
        realtime: false,
        emit(type, details = {}) {
            events.push({ t: round(time), type, ...details });
        },
        // One simulation step with the bot's input applied
        advance(dt) {
            const player = game.getPlayer();
            const turn = (input.turnRight ? 1 : 0) - (input.turnLeft ? 1 : 0);
            const lookX = turn * TURN_SPEED * dt + (input.lookDx || 0) * MOUSE_SENSITIVITY;
            const lookY = (input.lookDy || 0) * MOUSE_SENSITIVITY;
            if (lookX || lookY) player.look(lookX, lookY);
            game.step(dt);
            time += dt;
        },
    };

    function applyInput() {
        const player = game.getPlayer();
        const keys = player.keysPressed;
        for (const k of ['arrowup', 'arrowdown', 'arrowleft', 'arrowright']) {
            keys[k] = false;
        }
        // The game has no side-step any more (iteration 3), so input.left /
        // input.right do nothing; bots turn with turnLeft / turnRight.
        keys.arrowup = !!input.forward;
        keys.arrowdown = !!input.back;
        // Same meaning as the touch joystick: x right, y down (y < 0 = forward), each -1..1
        const joy = input.joystick || { x: 0, y: 0 };
        player.touchMove.x = clamp(joy.x || 0);
        player.touchMove.y = clamp(joy.y || 0);
    }

    function state() {
        const player = game.getPlayer();
        const maze = game.getMaze();
        const look = new THREE.Euler(0, 0, 0, 'YXZ').setFromQuaternion(player.camera.quaternion);
        const start = maze.getStartPosition();
        return {
            t: round(time),
            pos: vec(player.position),
            vel: vec(player.velocity),
            yaw: round(look.y),
            pitch: round(look.x),
            escaped: game.isEscaped(),
            frozen: player.frozen,
            level: { index: game.getLevelIndex(), name: document.getElementById('level').textContent },
            grid: (game.getLevelIndex() >= 0 ? LEVELS[game.getLevelIndex()].layout : layout).slice(),
            cellSize: 1,
            spike: maze.spikePosition ? { x: maze.spikePosition.x, z: maze.spikePosition.z } : null,
            spike2: maze.spike2Position ? { x: maze.spike2Position.x, z: maze.spike2Position.z } : null,
            sliding: !!player.slide,
            shoved: !!player.shove,
            current: maze.current ? currentState(maze.current) : null,
            currents: maze.currents.map(currentState),
            vents: maze.vents.map((v) => ({ minX: v.minX, maxX: v.maxX, minZ: v.minZ, maxZ: v.maxZ, phase: v.phase, timer: round(v.timer), audible: v.audible !== false, wave: !!v.wave, target: { x: v.target.x, z: v.target.z } })),
            fossils: (maze.fossils ?? []).map((f) => ({ x: f.position.x, z: f.position.z, kind: f.kind, collected: f.collected })),
            doorLocked: !!maze.fossilsLocked,
            doorLockVisible: !!maze.doorLock?.object.visible,
            fossilCounter: document.getElementById('fossils').hidden ? null : document.getElementById('fossils').textContent,
            tails: (maze.tails ?? []).map((t) => ({ minX: t.minX, maxX: t.maxX, minZ: t.minZ, maxZ: t.maxZ, alongX: t.alongX, out: t.out, phase: t.phase, timer: round(t.timer), s: round(t.s), low: round(t.low), target: { x: t.target.x, z: t.target.z } })),
            snowmen: maze.snowmen.map((s) => ({ minX: s.minX, maxX: s.maxX, minZ: s.minZ, maxZ: s.maxZ, alongX: s.alongX, sign: s.sign, entrance: s.entrance, length: s.length, timer: round(s.timer), balls: s.balls.map((b) => round(b.u)), target: { x: s.target.x, z: s.target.z }, center: { x: s.center.x, z: s.center.z }, hearing: round(s.hearing ?? 0), rolling: (s.rolls ?? []).length })),
            thinIce: maze.thinIce.map((t) => ({ minX: t.minX, maxX: t.maxX, minZ: t.minZ, maxZ: t.maxZ, time: round(t.time) })),
            armBelts: maze.armBelts.map((b) => ({ minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ, alongX: b.alongX, forward: { x: b.forward.x, z: b.forward.z }, right: { x: b.right.x, z: b.right.z }, timer: round(b.timer), landing: { x: b.landing.x, z: b.landing.z }, arms: b.arms.map((a) => ({ side: a.side, s: round(a.s), box: maze.armBox(b, a) })) })),
            belts: maze.belts.map((b) => ({ minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ, alongX: b.alongX, back: b.back, phase: b.phase, timer: round(b.timer), landing: { x: b.landing.x, z: b.landing.z }, red: { x: round(b.redPosition?.x ?? 0), z: round(b.redPosition?.z ?? 0) } })),
            geysers: maze.geysers.map((g) => ({ minX: g.minX, maxX: g.maxX, minZ: g.minZ, maxZ: g.maxZ, phase: g.phase, timer: round(g.timer), waiting: g.waiting, rise: round(g.rise) })),
            trapdoors: (maze.trapdoors ?? []).map((t) => ({ minX: t.minX, maxX: t.maxX, minZ: t.minZ, maxZ: t.maxZ, phase: t.phase, timer: round(t.timer), open: round(t.open) })),
            buttonDoor: maze.buttonDoor ? { pressed: maze.buttonDoor.pressed, open: round(maze.buttonDoor.open), solid: maze.buttonDoor.solid, button: { x: maze.buttonDoor.button.x, z: maze.buttonDoor.button.z }, minX: maze.buttonDoor.minX, maxX: maze.buttonDoor.maxX, minZ: maze.buttonDoor.minZ, maxZ: maze.buttonDoor.maxZ } : null,
            buttonDoors: (maze.buttonDoors ?? []).map((d) => ({ pressed: d.pressed, open: round(d.open), solid: d.solid, button: { x: d.button.x, z: d.button.z }, minX: d.minX, maxX: d.maxX, minZ: d.minZ, maxZ: d.maxZ })),
            spinWall: maze.spinWall ? { minX: maze.spinWall.minX, maxX: maze.spinWall.maxX, minZ: maze.spinWall.minZ, maxZ: maze.spinWall.maxZ, spansX: maze.spinWall.spansX, center: { x: maze.spinWall.center.x, z: maze.spinWall.center.z }, angle: round(maze.spinWall.angle), spinning: !!maze.spinWall.spin, time: round(maze.spinWall.spin?.time ?? 0) } : null,
            spinning: !!player.spinning,
            spaceDoor: maze.spaceDoor ? { phase: maze.spaceDoor.phase, shut: round(maze.spaceDoor.shut), solid: maze.spaceDoor.solid } : null,
            platform: maze.platform ? platformState(maze.platform) : null,
            platforms: maze.platforms.map(platformState),
            // Pirate Ship World: the cannons (phase 'empty' | 'fuse'), and the camera's height (it drops when you fall into the sea)
            cannons: maze.platforms.flatMap((p) => p.cannons ?? []).map((c) => ({ x: c.center.x, z: c.center.z, phase: c.phase, time: round(c.time), mustLeave: c.mustLeave, landing: { x: c.landing.x, z: c.landing.z } })),
            eyeY: round(player.camera.position.y),
            spikeRows: maze.spikeRows.map((r) => ({ x: r.position.x, z: r.position.z, spansX: r.spansX })),
            door: { x: maze.doorPosition.x, z: maze.doorPosition.z },
            // Level 100: which room the player is in (0-8, in path order)
            room: maze.active ?? null,
            start: { x: start.x, z: start.z, yaw: round(maze.getStartYaw()) },
            buddy: buddyState(game.getBuddy?.()),
        };
    }

    // Replace the maze with a new layout (same format as levels.js)
    // Dinosaur World's baby triceratops: where he is, what he's doing, and the lost rule
    function buddyState(b) {
        if (!b) return null;
        return {
            mode: b.mode, x: round(b.position.x), z: round(b.position.z), onHead: b.onHead, visible: b.model.group.visible,
            egg: b.egg.group.visible, furthest: b.furthest, wrongWays: b.wrongWays, lostTime: round(b.lostTime), sinceAsk: round(b.sinceAsk),
            helpFrom: b.helpFrom, path: b.path.map(([i, j]) => [i, j]),
        };
    }

    function loadLayout(rows, name = 'Custom', index = -1) {
        // Level 100's rooms come along with its own layout
        const rooms = rows === LEVELS[index]?.layout ? LEVELS[index].rooms : undefined;
        game.loadLevel({ name, layout: rows, theme: LEVELS[index]?.theme, spikeRadius: LEVELS[index]?.spikeRadius, spike2Radius: LEVELS[index]?.spike2Radius, rooms }, index);
        layout = rows.slice();
        document.getElementById('level').textContent = name;
        restore();
        return state();
    }

    function restore() {
        game.playAgain();
        time = 0;
        hooks.emit('reset');
        game.render();
        return state();
    }

    function text() {
        const out = [];
        for (const el of document.querySelectorAll('#level, #message, #menu .panel:not([hidden]) h1, #menu .panel:not([hidden]) .item, #ui, #controls')) {
            if (el.closest('[hidden]')) continue;
            const s = el.innerText.trim();
            if (s) out.push(s);
        }
        return out;
    }

    window.__game = {
        name: 'mazle',
        version: 1,
        ready: false,
        dt: DT,
        step(n = 1) {
            for (let i = 0; i < n; i++) hooks.advance(DT);
            game.render();
            return state();
        },
        render() {
            game.render();
        },
        setRealtime(on) {
            hooks.realtime = !!on;
        },
        state,
        setInput(next = {}) {
            input = { ...next };
            applyInput();
        },
        clearInput() {
            input = {};
            applyInput();
        },
        events,
        clearEvents() {
            events.length = 0;
        },
        time() {
            return round(time);
        },
        teleport({ x, z, yaw } = {}) {
            const player = game.getPlayer();
            const pos = player.position.clone();
            if (x !== undefined) pos.x = x;
            if (z !== undefined) pos.z = z;
            const look = new THREE.Euler(0, 0, 0, 'YXZ').setFromQuaternion(player.camera.quaternion);
            player.resetTo(pos, yaw !== undefined ? yaw : look.y);
            game.render();
            return state();
        },
        restore,
        // The maze itself (for browser tests that look inside it)
        maze: () => game.getMaze(),
        text,
        loadLayout,
    };

    // ?test=1&level=<index> picks a level from levels.js
    const wanted = Number(params.get('level'));
    if (params.has('level') && LEVELS[wanted] && wanted !== 0) {
        loadLayout(LEVELS[wanted].layout, LEVELS[wanted].name, wanted);
    }

    game.render();
    window.__game.ready = true;
    hooks.emit('start');
    return hooks;
}

function round(v) {
    return Math.round(v * 1e6) / 1e6;
}

function platformState(p) {
    return { at: round(p.at), target: round(p.target), riding: p.riding, alongX: p.alongX, speed: p.speed, gap: { ...p.gap }, bubble: p.bubble, push: round(p.push), pushing: p.pushing, startAt: p.startAt, span: p.span, balloon: p.balloon, carpet: p.carpet, phase: p.phase, time: round(p.time ?? 0), lift: round(p.lift ?? 0), view: p.view ?? null, plank: p.plank ?? 0 };
}

function currentState(c) {
    return { minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ, dir: vec(c.dir), target: { x: c.target.x, z: c.target.z } };
}

function vec(v) {
    return { x: round(v.x), y: round(v.y), z: round(v.z) };
}

function clamp(v) {
    return Math.max(-1, Math.min(1, v));
}
