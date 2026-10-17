import * as THREE from 'three';
import { Maze } from './Maze.js';

// Level 100, the Everything World finale: one maze in 9 rooms, each in its
// own world's look (levels.js `rooms`). It's built as one Maze per room, all
// from the same layout: each keeps only the danger letters inside its own
// room, wears its room's theme, and is only drawn inside its room (clipping
// planes at the middle of the walls between rooms). Things in the sky (planets,
// birds, gears, auroras...) aren't clipped: only the sky of the room the
// player is in shows. All the rooms share one collision map, so the space
// door and the snowman are solid for everyone. Game code talks to it like a
// single Maze.

// Every layout letter that belongs to one danger (not 'S', 'D' or walls)
const DANGER_LETTERS = /[XZYGIOFWVCHQKNMPTBLAR]/;
// The Maze methods that add things to the sky (they all add to maze.root)
const SKY_METHODS = ['addSpaceSky', 'addJungleSky', 'addMoonSky', 'addSeaLife', 'addCandySky', 'addIceSky', 'addGearSky'];

export class RoomMaze {
    // level.rooms: [{ theme, music, x: [from, to], z: [from, to] }] in path
    // order; x and z are block ranges (the first and last rooms in each
    // direction reach the maze's edge). options as for Maze.
    constructor(scene, level, options) {
        this.scene = scene;
        this.rooms = level.rooms;
        const roomAt = (x, z) => this.rooms.findIndex((r) => x >= r.x[0] && x < r.x[1] && z >= r.z[0] && z < r.z[1]);
        this.roomAt = (point) => roomAt(point.x, point.z);
        this.mazes = this.rooms.map((room, r) => {
            const layout = level.layout.map((row, z) => [...row].map((ch, x) => (DANGER_LETTERS.test(ch) && roomAt(x + 0.5, z + 0.5) !== r ? ' ' : ch)).join(''));
            return new Maze(scene, layout, room.theme, options);
        });
        // One collision map for all the rooms (the snowman's is the one with him in it)
        this.mazeData = (this.mazes.find((m) => m.snowmen.length) ?? this.mazes[0]).mazeData;
        for (const m of this.mazes) m.mazeData = this.mazeData;
        this.active = 0;
        this.width = this.mazes[0].width;
        this.depth = this.mazes[0].depth;
        this.height = this.mazes[0].height;
    }

    build() {
        this.mazes.forEach((maze, r) => {
            // Catch what each sky method adds
            const sky = [];
            for (const name of SKY_METHODS) {
                const add = maze[name];
                maze[name] = function (...args) {
                    const before = new Set(this.root.children);
                    const result = add.apply(this, args);
                    for (const o of this.root.children) if (!before.has(o)) sky.push(o);
                    return result;
                };
            }
            maze.build();
            maze.skyGroup = new THREE.Group();
            for (const o of sky) maze.skyGroup.add(o);
            maze.root.add(maze.skyGroup);
            // Everything else is only drawn inside the room
            const room = this.rooms[r];
            const planes = [];
            if (room.x[0] > 0) planes.push(new THREE.Plane(new THREE.Vector3(1, 0, 0), -room.x[0]));
            if (room.x[1] < this.width) planes.push(new THREE.Plane(new THREE.Vector3(-1, 0, 0), room.x[1]));
            if (room.z[0] > 0) planes.push(new THREE.Plane(new THREE.Vector3(0, 0, 1), -room.z[0]));
            if (room.z[1] < this.depth) planes.push(new THREE.Plane(new THREE.Vector3(0, 0, -1), room.z[1]));
            maze.clipPlanes = planes;
            this.clip(maze, maze.root);
        });
        this.showSky();
    }

    // Clip every material under `object` (not the sky) to its maze's room
    clip(maze, object) {
        object.traverse((o) => {
            if (o === maze.skyGroup || isInside(o, maze.skyGroup)) return;
            const materials = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
            for (const m of materials) {
                if (m.clippingPlanes === maze.clipPlanes) continue;
                m.clippingPlanes = maze.clipPlanes;
                m.clipShadows = true;
                m.needsUpdate = true;
            }
        });
    }

    showSky() {
        this.mazes.forEach((m, r) => { m.skyGroup.visible = r === this.active; });
    }

    // Which room the player is in; true when it just changed
    updateRoom(point) {
        const r = this.roomAt(point);
        if (r < 0 || r === this.active) return false;
        this.active = r;
        this.showSky();
        return true;
    }

    get room() { return this.rooms[this.active]; }
    get theme() { return this.rooms[this.active].theme; }
    get music() { return this.rooms[this.active].music; }
    get activeMaze() { return this.mazes[this.active]; }

    dispose() {
        for (const m of this.mazes) m.dispose();
    }

    update(dt) {
        for (const m of this.mazes) m.update(dt);
        // Things made while playing (robot arms, snowballs) are clipped too
        for (const m of this.mazes) {
            for (const belt of m.armBelts) for (const arm of belt.arms) if (arm.object && !arm.clipped) { this.clip(m, arm.object); arm.clipped = true; }
        }
    }

    // ---- One answer from the room that has it ----
    owner(list, item) { return this.mazes.find((m) => m[list].includes(item)); }
    first(fn) {
        for (const m of this.mazes) {
            const v = fn(m);
            if (v !== null && v !== undefined && v !== false) return v;
        }
        return null;
    }
    all(fn) { return this.mazes.flatMap(fn); }

    get mazeDataShared() { return this.mazeData; }
    getMazeData() { return this.mazeData; }
    get doorPosition() { return this.mazes[this.mazes.length - 1].doorPosition; }
    getStartPosition() { return this.mazes[0].getStartPosition(); }
    getStartYaw() { return this.mazes[0].getStartYaw(); }
    getDoorApproach() { return this.mazes[this.mazes.length - 1].getDoorApproach(); }
    get spikePosition() { return this.first((m) => m.spikePosition); }
    get spike2Position() { return this.first((m) => m.spike2Position); }
    get spaceDoor() { return this.first((m) => m.spaceDoor); }
    get currents() { return this.all((m) => m.currents); }
    get current() { return this.currents[0] ?? null; }
    get vents() { return this.all((m) => m.vents); }
    get geysers() { return this.all((m) => m.geysers); }
    get snowmen() { return this.all((m) => m.snowmen); }
    get thinIce() { return this.all((m) => m.thinIce); }
    get belts() { return this.all((m) => m.belts); }
    get armBelts() { return this.all((m) => m.armBelts); }
    get armBeltSpeed() { return this.mazes[0].armBeltSpeed; }
    get platforms() { return this.all((m) => m.platforms); }
    get platform() { return this.platforms[0] ?? null; }
    get spikeRows() { return this.all((m) => m.spikeRows); }
    get landing() { return this.first((m) => m.landing); }

    updateSpaceDoor(dt, position, radius) { for (const m of this.mazes) m.updateSpaceDoor(dt, position, radius); }
    onSlipperySpot(point) { return this.mazes.some((m) => m.onSlipperySpot(point)); }
    inCurrent(point) { return this.first((m) => m.inCurrent(point)); }
    cameFromCurrentDeadEnd(from, c) { return this.owner('currents', c).cameFromCurrentDeadEnd(from, c); }
    ventAudible(v, point, radius) { return this.owner('vents', v).ventAudible(v, point, radius); }
    snowmanHearing(s, point, radius) { return this.owner('snowmen', s).snowmanHearing(s, point, radius); }
    armBox(belt, arm) { return this.owner('armBelts', belt).armBox(belt, arm); }
    armBeltAt(point) { return this.first((m) => m.armBeltAt(point)); }
    updateVents(...a) { return this.all((m) => m.updateVents(...a)); }
    updateGeysers(...a) { return this.all((m) => m.updateGeysers(...a)); }
    updateSnowmen(...a) { return this.all((m) => m.updateSnowmen(...a)); }
    updateBelts(...a) { return this.all((m) => m.updateBelts(...a)); }
    updateArmBelts(...a) { return this.all((m) => m.updateArmBelts(...a)); }
    updateThinIce(...a) { return this.all((m) => m.updateThinIce(...a)); }
    onCaramel(point) { return this.mazes.some((m) => m.onCaramel(point)); }
    marshmallowAt(point) { return this.first((m) => m.marshmallowAt(point)); }
    updatePlatform(dt, position, velocity, radius) {
        let event = null;
        for (const m of this.mazes) event = m.updatePlatform(dt, position, velocity, radius) ?? event;
        return event;
    }
    rideLift() {
        for (const m of this.mazes) {
            const lift = m.rideLift();
            if (lift !== null) return lift;
        }
        return null;
    }
    touchesSpike(point, margin) { return this.mazes.some((m) => m.touchesSpike(point, margin)); }
    fallsIntoGap(point) { return this.mazes.some((m) => m.fallsIntoGap(point)); }
    overGap(point) { return this.mazes.some((m) => m.overGap(point)); }
    platformStartEdge(point) { return this.mazes.find((m) => m.overGap(point)).platformStartEdge(point); }
    resetPlatform() { for (const m of this.mazes) m.resetPlatform(); }
}

function isInside(o, group) {
    for (let p = o.parent; p; p = p.parent) if (p === group) return true;
    return false;
}
