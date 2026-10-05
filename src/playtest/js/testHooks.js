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
            sliding: !!player.slide,
            spaceDoor: maze.spaceDoor ? { phase: maze.spaceDoor.phase, shut: round(maze.spaceDoor.shut), solid: maze.spaceDoor.solid } : null,
            platform: maze.platform ? { at: round(maze.platform.at), target: round(maze.platform.target), riding: maze.platform.riding, alongX: maze.platform.alongX, gap: { ...maze.platform.gap } } : null,
            spikeRows: maze.spikeRows.map((r) => ({ x: r.position.x, z: r.position.z, spansX: r.spansX })),
            door: { x: maze.doorPosition.x, z: maze.doorPosition.z },
            start: { x: start.x, z: start.z, yaw: round(maze.getStartYaw()) },
        };
    }

    // Replace the maze with a new layout (same format as levels.js)
    function loadLayout(rows, name = 'Custom', index = -1) {
        game.loadLevel({ name, layout: rows, theme: LEVELS[index]?.theme, spikeRadius: LEVELS[index]?.spikeRadius }, index);
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

function vec(v) {
    return { x: round(v.x), y: round(v.y), z: round(v.z) };
}

function clamp(v) {
    return Math.max(-1, Math.min(1, v));
}
