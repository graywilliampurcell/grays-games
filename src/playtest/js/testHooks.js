// Test-only hook for the playtest bot (see tools/playbot/HOOK_CONTRACT.md).
// Only active when the page URL has ?test=1; otherwise nothing here runs.
import * as THREE from 'three';
import { Maze } from './Maze.js';
import { LEVELS } from './levels.js';
import { CollisionManager } from './CollisionManager.js';

const params = new URLSearchParams(window.location.search);
export const TEST_MODE = params.get('test') === '1';

const DT = 1 / 60;
const TURN_SPEED = 2.5; // radians per second for turnLeft / turnRight
const MOUSE_SENSITIVITY = 0.003; // same as Player.onMouseMove

// Wires up window.__game. Returns null outside test mode, otherwise an object
// main.js uses to report events and (in realtime mode) advance the game.
export function installTestHooks(game) {
    if (!TEST_MODE) return null;

    let time = 0;
    let input = {};
    let levelIndex = 0;
    let levelName = LEVELS[0].name;
    let layout = LEVELS[0].layout;
    // Scene objects the current maze added (walls, floor, door, spike)
    let mazeObjects = game.getScene().children.filter((c) => c.isMesh || c.isGroup);
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
        for (const k of ['w', 's', 'a', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']) {
            keys[k] = false;
        }
        keys.w = !!input.forward;
        keys.s = !!input.back;
        keys.arrowleft = !!input.left;
        keys.arrowright = !!input.right;
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
            level: { index: levelIndex, name: levelName },
            grid: layout.slice(),
            cellSize: 1,
            spike: { x: maze.spikePosition.x, z: maze.spikePosition.z },
            door: { x: maze.doorPosition.x, z: maze.doorPosition.z },
            start: { x: start.x, z: start.z, yaw: round(maze.getStartYaw()) },
        };
    }

    // Replace the maze with a new layout (same format as levels.js)
    function loadLayout(rows, name = 'Custom', index = -1) {
        const scene = game.getScene();
        for (const obj of mazeObjects) {
            scene.remove(obj);
            obj.traverse((o) => {
                o.geometry?.dispose();
                const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
                mats.forEach((m) => m.dispose());
            });
        }
        const before = new Set(scene.children);
        const maze = new Maze(scene, rows);
        maze.build();
        mazeObjects = scene.children.filter((c) => !before.has(c));
        game.setMaze(maze, new CollisionManager(maze.getMazeData()));
        layout = rows.slice();
        levelName = name;
        levelIndex = index;
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
        for (const el of document.querySelectorAll('#level, #message, #escaped h1, #escaped button, #ui, #controls')) {
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
