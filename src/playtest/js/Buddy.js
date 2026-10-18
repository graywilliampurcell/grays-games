import * as THREE from 'three';

// The baby triceratops buddy (Dinosaur World, Level 111 on; plan Section 2).
//
// In Level 111 he hatches from an egg next to the start square about
// HATCH_DELAY seconds after the level starts (the 111 switch; with it Off he's
// already standing there). Then he follows the player about one corridor
// cell behind, walking along the way the player walked. He never blocks the
// player, can't be hurt and never sets anything off (spikes, pits, doors):
// he's only something to look at. He rides along on the long-neck's head.
//
// Help when really lost (Gray's design; starting rule Gray will judge): when
// the player has gone into wrong ways LOST_WRONG_WAYS times, or LOST_TIME
// seconds have passed, without getting further along the correct path than
// before, the game asks "Do you need help, or do you want to keep going?".
// Help me! makes him trot ahead and lead the way back to the correct path
// and along it toward the door, about LEAD cells ahead, waiting whenever the
// player stops, until the player is HELP_CELLS cells further along than
// before; then he follows again. No, I'm good: it can ask again, but never
// sooner than ASK_AGAIN seconds after the last time.

const CELL = 4; // a corridor cell plus its wall, in blocks
const FOLLOW_DISTANCE = 3.6; // about one corridor cell behind
const SPEED = 9.5; // a little faster than the player can walk, so he keeps up
const LEAD = 2 * CELL; // about 2 cells ahead while helping
const STEP = 0.25; // how far the player walks between trail points
export const HATCH_DELAY = 2; // seconds after the start before the egg wobbles
const WOBBLE_TIME = 0.8;
const POP_TIME = 0.35;
export const LOST_WRONG_WAYS = 3;
export const LOST_TIME = 60;
export const ASK_AGAIN = 60;
export const HELP_CELLS = 5;

export class Buddy {
    constructor(maze, layout) {
        this.maze = maze;
        this.root = new THREE.Group();
        maze.root.add(this.root);
        this.model = this.makeTriceratops();
        this.root.add(this.model.group);
        this.egg = this.makeEgg();
        this.root.add(this.egg.group);
        this.findCorrectPath(layout);
        this.mode = 'follow'; // egg | follow | help | wait (just finished helping: waits for the player to pass)
        this.position = new THREE.Vector3();
        this.heading = 0;
        this.walk = 0;
        this.trail = [];
        this.s = 0;
        this.onHead = false;
        // The lost rule
        this.furthest = 0;
        this.wrongWays = 0;
        this.lostTime = 0;
        this.sinceAsk = ASK_AGAIN;
        this.lastCell = null;
        this.helpFrom = 0;
    }

    // ---- The maze as corridor cells ----

    // The correct path as a list of corridor cells from the start's cell to
    // the door's, and every cell's place on it (pathIndex; -1 = a wrong way)
    findCorrectPath(layout) {
        this.cols = Math.floor((layout[0].length - 1) / CELL);
        this.rows = Math.floor((layout.length - 1) / CELL);
        const open = (x, z) => layout[z]?.[x] !== undefined && layout[z][x] !== '#' && layout[z][x] !== 'D';
        this.links = (i, j) => {
            const out = [];
            const cx = CELL * i + 2;
            const cz = CELL * j + 2;
            if (i + 1 < this.cols && open(cx + 2, cz)) out.push([i + 1, j]);
            if (i > 0 && open(cx - 2, cz)) out.push([i - 1, j]);
            if (j + 1 < this.rows && open(cx, cz + 2)) out.push([i, j + 1]);
            if (j > 0 && open(cx, cz - 2)) out.push([i, j - 1]);
            return out;
        };
        const start = this.cellOf(this.maze.getStartPosition());
        const d = this.maze.doorBlock;
        const door = this.cellOf(new THREE.Vector3(Math.min(Math.max(d.x, 1), layout[0].length - 2) + 0.5, 0, Math.min(Math.max(d.z, 1), layout.length - 2) + 0.5));
        this.doorCell = door;
        const route = this.route(start, door);
        this.path = route;
        this.pathIndex = new Map(route.map((c, k) => [`${c[0]},${c[1]}`, k]));
    }

    // The corridor cell a point is in (a point in the wall gap between two
    // cells counts as the cell before it)
    cellOf(point) {
        const i = Math.min(this.cols - 1, Math.max(0, Math.floor((point.x - 1) / CELL)));
        const j = Math.min(this.rows - 1, Math.max(0, Math.floor((point.z - 1) / CELL)));
        return [i, j];
    }

    cellCenter([i, j]) {
        return new THREE.Vector3(CELL * i + 2.5, 0, CELL * j + 2.5);
    }

    // The shortest way through the corridors from one cell to another
    route(from, to) {
        const key = (c) => `${c[0]},${c[1]}`;
        const back = new Map([[key(from), null]]);
        const todo = [from];
        while (todo.length) {
            const c = todo.shift();
            if (key(c) === key(to)) break;
            for (const n of this.links(c[0], c[1])) {
                if (back.has(key(n))) continue;
                back.set(key(n), c);
                todo.push(n);
            }
        }
        const out = [];
        for (let c = to; c; c = back.get(key(c))) out.unshift(c);
        return out[0] && key(out[0]) === key(from) ? out : [from];
    }

    // How far along the correct path a point is (-1 in a wrong way)
    pathPlace(point) {
        const [i, j] = this.cellOf(point);
        return this.pathIndex.get(`${i},${j}`) ?? -1;
    }

    // ---- Where he is ----

    // The spot next to the start square: a little to the side of the start
    // and ahead, so he (or the egg) is in view at the start
    besideStart() {
        const start = this.maze.getStartPosition();
        const yaw = this.maze.getStartYaw();
        const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
        const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
        // As far ahead as the floor allows (up to about half a cell), so it's
        // easy to see from the start
        const floor = (q) => [[0, 0], [0.35, 0], [-0.35, 0], [0, 0.35], [0, -0.35]].every(([ox, oz]) => this.maze.grid[Math.floor(q.x + ox)]?.[Math.floor(q.z + oz)] === 0);
        for (const ahead of [2.4, 2, 1.6, 1.3]) {
            const spot = start.clone().addScaledVector(forward, ahead).addScaledVector(side, 0.6);
            if (floor(spot) && !this.maze.overGap?.(spot)) return spot;
        }
        return start.clone().addScaledVector(forward, 1.1).addScaledVector(side, 0.75);
    }

    // The level starts: the egg by the start (hatch), or the buddy standing there
    start(hatch) {
        const spot = this.besideStart();
        this.furthest = 0;
        this.wrongWays = 0;
        this.lostTime = 0;
        this.sinceAsk = ASK_AGAIN;
        this.lastCell = null;
        this.mode = 'follow';
        this.stand(spot);
        if (hatch) {
            this.mode = 'egg';
            this.eggTime = 0;
            this.egg.group.visible = true;
            this.egg.group.position.copy(spot);
            this.egg.shell.position.set(0, 0, 0);
            this.egg.shell.rotation.set(0, 0, 0);
            this.egg.top.position.set(0, 0, 0);
            this.egg.top.rotation.set(0, 0, 0);
            this.egg.top.userData.v = null;
            this.egg.bottom.visible = true;
            this.egg.top.visible = true;
            this.egg.shell.visible = true;
            this.model.group.visible = false;
        }
    }

    // Stand still at a spot, with the trail starting there
    stand(spot) {
        this.mode = this.mode === 'egg' ? 'egg' : 'follow';
        if (this.mode !== 'egg') {
            this.egg.group.visible = false;
            this.model.group.visible = true;
            this.model.group.scale.setScalar(1);
        }
        this.position.copy(spot);
        this.trail = [{ x: spot.x, z: spot.z, s: 0 }];
        this.s = 0;
        this.onHead = false;
        this.heading = this.maze.getStartYaw();
        this.show();
    }

    // Sent back to the start (Ouch!): he's there too, next to the start
    // square (an egg still hatching keeps hatching)
    backToStart() {
        if (this.mode === 'egg') return;
        if (this.mode === 'help' || this.mode === 'wait') this.mode = 'follow';
        this.stand(this.besideStart());
    }

    // Coming back to a saved spot (Continue): he's standing right behind you
    placeNear(position, yaw) {
        this.mode = 'follow';
        const back = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
        let spot = position.clone().addScaledVector(back, 1.5);
        if (!this.clearLine(position, spot)) spot = position.clone();
        this.stand(spot);
        this.furthest = Math.max(0, this.pathPlace(position));
    }

    // ---- Every step ----

    // player: { position, radius }. Returns the things that happened this
    // step: 'wobble', 'crack' (the egg cracks open), 'hatch' (he pops out
    // with a happy squeak)
    update(dt, player) {
        const events = [];
        if (this.mode === 'egg') {
            this.updateEgg(dt, events);
            this.recordTrail(player.position);
            return events;
        }
        this.recordTrail(player.position);
        const before = this.position.clone();
        // On the long-neck's head with the player
        const p = this.maze.gapAt?.(player.position);
        if (p?.longNeck) {
            this.rideHead(p, player.position, dt);
        } else {
            if (this.onHead) this.stepOffHead(player.position);
            if (this.mode === 'help') this.updateHelp(dt, player.position);
            else if (this.mode === 'wait') this.updateWait(dt, player.position);
            else this.updateFollow(dt, player.position);
        }
        const moved = Math.hypot(this.position.x - before.x, this.position.z - before.z);
        if (moved > 0.002) this.heading = Math.atan2(-(this.position.x - before.x), -(this.position.z - before.z));
        else if (this.mode !== 'help') this.faceToward(player.position, dt);
        this.walk += moved * 3.2;
        this.show(dt);
        return events;
    }

    updateEgg(dt, events) {
        const t = (this.eggTime += dt);
        const egg = this.egg;
        if (t >= HATCH_DELAY && t - dt < HATCH_DELAY) events.push('wobble');
        if (t >= HATCH_DELAY && t < HATCH_DELAY + WOBBLE_TIME) {
            const k = (t - HATCH_DELAY) / WOBBLE_TIME;
            egg.shell.rotation.z = Math.sin(t * 28) * 0.28 * (0.4 + k);
            egg.shell.rotation.x = Math.cos(t * 23) * 0.12 * k;
        }
        const crackAt = HATCH_DELAY + WOBBLE_TIME;
        if (t >= crackAt && t - dt < crackAt) {
            events.push('crack', 'hatch');
            egg.shell.rotation.set(0, 0, 0);
            egg.top.userData.v = new THREE.Vector3(0.6, 3.2, 0.3);
            this.model.group.visible = true;
            this.model.group.scale.setScalar(0.01);
        }
        if (t >= crackAt) {
            // The top of the shell pops off and tumbles down beside him
            const v = egg.top.userData.v;
            if (v && egg.top.visible) {
                v.y -= 9.8 * dt;
                egg.top.position.addScaledVector(v, dt);
                egg.top.rotation.z -= dt * 6;
                if (egg.top.position.y < -0.3) {
                    egg.top.position.y = -0.3;
                    v.set(0, 0, 0);
                }
            }
            // He pops out, a little too big for a moment, then his own size
            const k = Math.min(1, (t - crackAt) / POP_TIME);
            this.model.group.scale.setScalar(Math.max(0.01, k * (1 + 0.3 * Math.sin(k * Math.PI))));
            this.model.group.position.copy(this.position);
            this.model.group.position.y = Math.sin(Math.min(1, k) * Math.PI) * 0.35;
            // The bits of shell fade away after a little while
            if (t > crackAt + 1.6) egg.group.visible = false;
            if (t > crackAt + POP_TIME + 0.15) {
                this.mode = 'follow';
                this.model.group.position.y = 0;
            }
        }
    }

    // Remember where the player has walked (a point every STEP)
    recordTrail(point) {
        const last = this.trail[this.trail.length - 1];
        const d = Math.hypot(point.x - last.x, point.z - last.z);
        if (d < STEP) return;
        this.trail.push({ x: point.x, z: point.z, s: last.s + d });
        // Forget the trail far behind him
        while (this.trail.length > 2 && this.trail[1].s < this.s - 2) this.trail.shift();
    }

    trailLength() {
        return this.trail[this.trail.length - 1].s;
    }

    // The point `s` along a list of points ({ x, z, s })
    pointAt(points, s) {
        if (s <= points[0].s) return new THREE.Vector3(points[0].x, 0, points[0].z);
        for (let k = 1; k < points.length; k++) {
            const a = points[k - 1];
            const b = points[k];
            if (s <= b.s) {
                const f = (s - a.s) / Math.max(1e-6, b.s - a.s);
                return new THREE.Vector3(a.x + (b.x - a.x) * f, 0, a.z + (b.z - a.z) * f);
            }
        }
        const z = points[points.length - 1];
        return new THREE.Vector3(z.x, 0, z.z);
    }

    // Following: about one cell behind the player along the way they walked.
    // When he can walk straight to the player (same corridor, nothing in
    // between) and that's shorter, he takes the short way.
    updateFollow(dt, playerPosition) {
        const behind = this.trailLength() - this.s;
        const straight = Math.hypot(playerPosition.x - this.position.x, playerPosition.z - this.position.z);
        if (behind > straight + 0.75 && straight < 2.5 * CELL && this.clearLine(this.position, playerPosition)) {
            this.trail = [{ x: this.position.x, z: this.position.z, s: 0 }, { x: playerPosition.x, z: playerPosition.z, s: straight }];
            this.s = 0;
        }
        const want = Math.max(this.trail[0].s, this.trailLength() - FOLLOW_DISTANCE);
        this.s = want > this.s ? Math.min(want, this.s + SPEED * dt) : Math.max(want, this.s - SPEED * dt);
        this.position.copy(this.pointAt(this.trail, this.s));
    }

    // Can he walk in a straight line from a to b? (Floor all the way, with
    // room for his body, and no pit)
    clearLine(a, b) {
        const length = Math.hypot(b.x - a.x, b.z - a.z);
        const n = Math.max(1, Math.ceil(length / 0.2));
        for (let k = 0; k <= n; k++) {
            const x = a.x + ((b.x - a.x) * k) / n;
            const z = a.z + ((b.z - a.z) * k) / n;
            for (const [ox, oz] of [[0, 0], [0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]]) {
                if (this.maze.grid[Math.floor(x + ox)]?.[Math.floor(z + oz)] !== 0) return false;
            }
            if (this.maze.overGap?.(new THREE.Vector3(x, 0, z))) return false;
        }
        return true;
    }

    // Riding the long-neck: he stands on its head beside the player
    rideHead(p, playerPosition, dt) {
        const head = p.object.position;
        const across = p.alongX ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
        const side = (playerPosition.x - head.x) * across.x + (playerPosition.z - head.z) * across.z > 0 ? -1 : 1;
        const spot = new THREE.Vector3(head.x, 0, head.z).addScaledVector(across, side * 0.8);
        if (!this.onHead) {
            // A quick hop on
            this.hop = 0;
            this.hopFrom = this.position.clone();
        }
        this.onHead = true;
        this.hop = Math.min(1, (this.hop ?? 1) + dt / 0.3);
        this.position.lerpVectors(this.hopFrom ?? spot, spot, this.hop);
        if (this.hop >= 1) this.hopFrom = spot.clone();
        this.trail = [{ x: this.position.x, z: this.position.z, s: 0 }];
        this.s = 0;
    }

    // The player stepped off the head: he follows from where he stood on it
    stepOffHead(playerPosition) {
        this.onHead = false;
        this.trail = [{ x: this.position.x, z: this.position.z, s: 0 }];
        const d = Math.hypot(playerPosition.x - this.position.x, playerPosition.z - this.position.z);
        this.trail.push({ x: playerPosition.x, z: playerPosition.z, s: d });
        this.s = 0;
        if (this.mode === 'help') this.helpS = this.project(this.guide, this.position, 0, Infinity);
    }

    faceToward(point, dt) {
        const want = Math.atan2(-(point.x - this.position.x), -(point.z - this.position.z));
        let d = want - this.heading;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.heading += Math.max(-dt * 4, Math.min(dt * 4, d));
    }

    // ---- The lost rule ----

    // Call every step while playing. Returns true when it's time to ask
    // "Do you need help, or do you want to keep going?"
    updateLost(dt, playerPosition) {
        const cell = this.cellOf(playerPosition);
        const place = this.pathIndex.get(`${cell[0]},${cell[1]}`) ?? -1;
        const was = this.lastCell;
        const wasPlace = was ? this.pathIndex.get(`${was[0]},${was[1]}`) ?? -1 : -1;
        this.lastCell = cell;
        this.sinceAsk += dt;
        if (place > this.furthest) {
            // Further along the correct path than ever: not lost
            this.furthest = place;
            this.wrongWays = 0;
            this.lostTime = 0;
            if (this.mode === 'help' && this.furthest >= this.helpFrom + HELP_CELLS) this.stopHelping();
            return false;
        }
        if (this.mode === 'egg' || this.mode === 'help') return false;
        // Into a wrong way, from the correct path
        if (was && place < 0 && wasPlace >= 0) this.wrongWays++;
        this.lostTime += dt;
        if ((this.wrongWays >= LOST_WRONG_WAYS || this.lostTime >= LOST_TIME) && this.sinceAsk >= ASK_AGAIN) {
            this.wrongWays = 0;
            this.lostTime = 0;
            this.sinceAsk = 0;
            return true;
        }
        return false;
    }

    // ---- Helping ----

    // Help me!: lead the way from where the player is back to the correct
    // path and along it toward the door
    startHelping(playerPosition) {
        if (this.mode === 'egg') return;
        this.mode = 'help';
        this.helpFrom = this.furthest;
        const from = this.cellOf(playerPosition);
        const cells = this.route(from, this.doorCell);
        // From him, along the trail to the player, then cell by cell to the door
        const points = [];
        const add = (x, z) => {
            const last = points[points.length - 1];
            const d = last ? Math.hypot(x - last.x, z - last.z) : 0;
            if (last && d < 0.01) return;
            points.push({ x, z, s: last ? last.s + d : 0 });
        };
        for (const t of this.trail.filter((q) => q.s >= this.s)) add(t.x, t.z);
        add(playerPosition.x, playerPosition.z);
        for (const c of cells) {
            const m = this.cellCenter(c);
            add(m.x, m.z);
        }
        // ...and into the door
        const door = this.maze.doorPosition;
        add(door.x, door.z);
        if (points.length < 2) add(this.position.x + 0.01, this.position.z);
        this.guide = points;
        this.helpS = 0;
        this.playerS = this.project(points, playerPosition, 0, Infinity);
        // Where he waits before each pit on the way (just before its edge)
        this.pitStops = [];
        let inPit = false;
        const end = points[points.length - 1].s;
        for (let s = 0; s <= end; s += 0.2) {
            const over = !!this.maze.gapAt?.(this.pointAt(points, s));
            if (over && !inPit) this.pitStops.push({ stop: Math.max(0, s - 1.2), after: s });
            inPit = over;
        }
        // ...and before each tail swish (Level 112 on), until the player gets there
        this.tailStops = [];
        let inTail = false;
        for (let s = 0; s <= end; s += 0.2) {
            const over = !!this.maze.tailAt?.(this.pointAt(points, s));
            if (over && !inTail) this.tailStops.push({ stop: Math.max(0, s - 1.2), after: s });
            inTail = over;
        }
    }

    // How far along the points the closest point to `point` is, looking only
    // between `from` and `to`
    project(points, point, from, to) {
        let best = from;
        let bestD = Infinity;
        for (let k = 1; k < points.length; k++) {
            const a = points[k - 1];
            const b = points[k];
            if (b.s < from || a.s > to) continue;
            const dx = b.x - a.x;
            const dz = b.z - a.z;
            const len2 = dx * dx + dz * dz || 1e-6;
            const f = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / len2));
            const d = Math.hypot(a.x + dx * f - point.x, a.z + dz * f - point.z);
            const s = a.s + (b.s - a.s) * f;
            if (d < bestD && s >= from && s <= to) {
                bestD = d;
                best = s;
            }
        }
        return best;
    }

    updateHelp(dt, playerPosition) {
        // How far along the way the player has got (never back)
        const near = this.project(this.guide, playerPosition, Math.max(0, this.playerS - 2), this.playerS + 16);
        const at = this.pointAt(this.guide, near);
        if (Math.hypot(at.x - playerPosition.x, at.z - playerPosition.z) < 2.2) this.playerS = Math.max(this.playerS, near);
        let want = this.playerS + LEAD;
        // He waits before a pit until the player gets there, and crosses with them
        for (const pit of this.pitStops) {
            if (this.helpS <= pit.stop + 0.01 && want > pit.stop) want = pit.stop;
        }
        // He waits before a tail swish until the player catches up, then crosses with them
        for (const tail of this.tailStops ?? []) {
            if (this.helpS <= tail.stop + 0.01 && this.playerS < tail.stop - 0.6 && want > tail.stop) want = tail.stop;
        }
        want = Math.min(want, this.guide[this.guide.length - 1].s - 1.2);
        this.helpS = want > this.helpS ? Math.min(want, this.helpS + SPEED * dt) : this.helpS;
        this.position.copy(this.pointAt(this.guide, this.helpS));
    }

    // Done helping: he goes back to following. He's ahead of the player, so
    // he waits where he is until the player catches up with him.
    stopHelping() {
        this.mode = 'wait';
        this.waitTime = 0;
    }

    updateWait(dt, playerPosition) {
        this.waitTime += dt;
        const d = Math.hypot(playerPosition.x - this.position.x, playerPosition.z - this.position.z);
        if (d < 1.6 || (d < 2.5 * CELL && this.clearLine(this.position, playerPosition) && this.waitTime > 1)) {
            this.mode = 'follow';
            this.trail = [{ x: this.position.x, z: this.position.z, s: 0 }, { x: playerPosition.x, z: playerPosition.z, s: d }];
            this.s = 0;
        } else if (this.waitTime > 8) {
            // The player went another way: he catches up
            this.mode = 'follow';
            this.stand(playerPosition.clone());
        }
    }

    // ---- How he looks ----

    show(dt = 0) {
        const g = this.model.group;
        if (this.mode === 'egg') return;
        g.position.copy(this.position);
        g.position.y = 0;
        g.rotation.y = this.heading;
        // Little legs stepping as he walks, and a happy bob
        const swing = Math.sin(this.walk) * 0.5;
        this.model.legs.forEach((leg, k) => { leg.rotation.x = (k === 0 || k === 3 ? swing : -swing); });
        this.model.body.position.y = 0.42 + Math.abs(Math.sin(this.walk)) * 0.03;
        this.model.tail.rotation.y = Math.sin((this.tailTime = (this.tailTime ?? 0) + dt) * 4) * 0.35;
    }

    // A baby triceratops about knee high: a round orange body, a big head
    // with a cream frill, three little horns and big friendly eyes, four
    // stubby legs and a short tail. He faces -z.
    makeTriceratops() {
        const group = new THREE.Group();
        const skin = new THREE.MeshStandardMaterial({ color: 0xf2a24e, roughness: 0.7, emissive: 0x3a1a00, emissiveIntensity: 0.3 });
        const cream = new THREE.MeshStandardMaterial({ color: 0xfff1cf, roughness: 0.6 });
        const frillColor = new THREE.MeshStandardMaterial({ color: 0x5fb8d8, roughness: 0.6, side: THREE.DoubleSide });
        const dark = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3 });
        const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
        const body = new THREE.Group();
        body.position.y = 0.42;
        group.add(body);
        const trunk = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), skin);
        trunk.scale.set(0.95, 0.85, 1.35);
        trunk.castShadow = true;
        body.add(trunk);
        const head = new THREE.Group();
        head.position.set(0, 0.08, -0.45);
        body.add(head);
        const skull = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), skin);
        skull.scale.set(1, 0.9, 1.1);
        head.add(skull);
        const snout = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), skin);
        snout.position.set(0, -0.05, -0.2);
        head.add(snout);
        const frill = new THREE.Mesh(new THREE.CircleGeometry(0.32, 20, 0, Math.PI), frillColor);
        frill.position.set(0, 0.05, 0.12);
        frill.rotation.x = -0.35;
        head.add(frill);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.035, 6, 20, Math.PI), cream);
        rim.position.copy(frill.position);
        rim.rotation.x = -0.35;
        head.add(rim);
        for (const [x, y, z, len, tilt] of [[0, 0.02, -0.3, 0.1, -1.3], [-0.1, 0.16, -0.12, 0.16, -0.9], [0.1, 0.16, -0.12, 0.16, -0.9]]) {
            const horn = new THREE.Mesh(new THREE.ConeGeometry(0.035, len, 8), cream);
            horn.position.set(x, y, z);
            horn.rotation.x = tilt;
            head.add(horn);
        }
        for (const side of [-1, 1]) {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), white);
            eye.position.set(side * 0.15, 0.06, -0.12);
            const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), dark);
            pupil.position.set(side * 0.19, 0.07, -0.15);
            head.add(eye, pupil);
        }
        const legs = [[-0.17, -0.22], [0.17, -0.22], [-0.17, 0.22], [0.17, 0.22]].map(([x, z]) => {
            const hip = new THREE.Group();
            hip.position.set(x, 0.3, z);
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.3, 8), skin);
            leg.position.y = -0.15;
            const foot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), cream);
            foot.scale.y = 0.5;
            foot.position.y = -0.29;
            hip.add(leg, foot);
            group.add(hip);
            return hip;
        });
        const tail = new THREE.Group();
        tail.position.set(0, 0.0, 0.38);
        const tailCone = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.42, 10), skin);
        tailCone.rotation.x = Math.PI / 2 + 0.3;
        tailCone.position.z = 0.18;
        tail.add(tailCone);
        body.add(tail);
        // A few darker spots on his back
        for (const [x, z] of [[0.08, 0.1], [-0.1, -0.05], [0.02, -0.18]]) {
            const spot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshStandardMaterial({ color: 0xd07a2a }));
            spot.position.set(x, 0.26, z);
            spot.scale.y = 0.4;
            body.add(spot);
        }
        return { group, body, legs, tail };
    }

    // A speckled egg a bit bigger than his head, in two halves (the top
    // pops off when he hatches)
    makeEgg() {
        const group = new THREE.Group();
        const shellMaterial = new THREE.MeshStandardMaterial({ color: 0xf6f0dc, roughness: 0.5, emissive: 0x2a2416, emissiveIntensity: 0.3 });
        const speck = new THREE.MeshStandardMaterial({ color: 0x8fbf6a, roughness: 0.6 });
        const shell = new THREE.Group();
        group.add(shell);
        const r = 0.3;
        const bottom = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), shellMaterial);
        bottom.scale.y = 1.35;
        bottom.position.y = r * 1.35;
        const top = new THREE.Group();
        const cap = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), shellMaterial);
        cap.scale.y = 1.35;
        cap.position.y = r * 1.35;
        top.add(cap);
        for (let k = 0; k < 7; k++) {
            const a = k * 2.4;
            const y = k % 2 ? 0.75 : 1.05;
            const s = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), speck);
            s.position.set(Math.cos(a) * r * 0.97, r * 1.35 + (y - 0.9) * r * 1.6, Math.sin(a) * r * 0.97);
            (y > 0.9 ? top : shell).add(s);
        }
        shell.add(bottom, top);
        group.visible = false;
        return { group, shell, top, bottom };
    }
}
