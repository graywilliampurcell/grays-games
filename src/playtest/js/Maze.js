import * as THREE from 'three';

// Which way the door faces (turning it to face into the maze), and which way
// the player should face at the start to be looking toward the door's side
const EDGES = {
    east: { doorYaw: -Math.PI / 2, startYaw: -Math.PI / 2 },
    west: { doorYaw: Math.PI / 2, startYaw: Math.PI / 2 },
    north: { doorYaw: 0, startYaw: 0 },
    south: { doorYaw: Math.PI, startYaw: Math.PI },
};

const DEFAULT_THEME = { wall: 0x8a8f96, floor: 0x90ee90, sky: 0x87ceeb };

// How far from the door the player stands after quitting at it: just outside
// the distance that counts as walking into the door
const DOOR_APPROACH_DISTANCE = 1.7;

// A soft, blotchy cotton-candy texture: a base color with fluffy lighter
// and darker puffs. Tall canvases suit the tall wall faces.
function fluffTexture(color, width, height, seed) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext('2d');
    const base = new THREE.Color(color);
    g.fillStyle = `#${base.getHexString()}`;
    g.fillRect(0, 0, width, height);
    let r = seed;
    const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    const light = base.clone().lerp(new THREE.Color(0xffffff), 0.45);
    const dark = base.clone().multiplyScalar(0.85);
    for (let i = 0; i < (width * height) / 90; i++) {
        const x = random() * width;
        const y = random() * height;
        const radius = 4 + random() * 14;
        const tint = random() < 0.6 ? light : dark;
        const puff = g.createRadialGradient(x, y, 0, x, y, radius);
        puff.addColorStop(0, `rgba(${tint.r * 255 | 0},${tint.g * 255 | 0},${tint.b * 255 | 0},0.55)`);
        puff.addColorStop(1, `rgba(${tint.r * 255 | 0},${tint.g * 255 | 0},${tint.b * 255 | 0},0)`);
        g.fillStyle = puff;
        g.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// Space World walls: deep blue with lots of little stars that glow, so the
// walls stand out against the dark sky
function starTexture(width, height, seed) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext('2d');
    g.fillStyle = '#1c2153';
    g.fillRect(0, 0, width, height);
    let r = seed;
    const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    const colors = ['255,255,255', '255,240,170', '170,220,255', '255,200,240'];
    for (let i = 0; i < (width * height) / 60; i++) {
        const x = random() * width;
        const y = random() * height;
        const radius = 1 + random() * (random() < 0.1 ? 5 : 2.2);
        const c = colors[Math.floor(random() * colors.length)];
        const glow = g.createRadialGradient(x, y, 0, x, y, radius * 2.2);
        glow.addColorStop(0, `rgba(${c},1)`);
        glow.addColorStop(0.35, `rgba(${c},0.8)`);
        glow.addColorStop(1, `rgba(${c},0)`);
        g.fillStyle = glow;
        g.fillRect(x - radius * 2.2, y - radius * 2.2, radius * 4.4, radius * 4.4);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// Space World floor: grey metal plates with seams and rivets
function metalTexture(size) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const g = canvas.getContext('2d');
    g.fillStyle = '#8c939c';
    g.fillRect(0, 0, size, size);
    const plate = size / 2;
    for (let px = 0; px < 2; px++) {
        for (let pz = 0; pz < 2; pz++) {
            const x = px * plate;
            const z = pz * plate;
            const shade = g.createLinearGradient(x, z, x + plate, z + plate);
            shade.addColorStop(0, 'rgba(255,255,255,0.12)');
            shade.addColorStop(1, 'rgba(0,0,0,0.12)');
            g.fillStyle = shade;
            g.fillRect(x, z, plate, plate);
            g.strokeStyle = '#5d636b';
            g.lineWidth = 3;
            g.strokeRect(x + 1.5, z + 1.5, plate - 3, plate - 3);
            g.fillStyle = '#c3c9d1';
            for (const [rx, rz] of [[8, 8], [plate - 8, 8], [8, plate - 8], [plate - 8, plate - 8]]) {
                g.beginPath();
                g.arc(x + rx, z + rz, 2.5, 0, Math.PI * 2);
                g.fill();
            }
        }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// A planet or moon for the sky: a base color with blobs (land, craters)
function planetTexture(base, blobs, seed) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const g = canvas.getContext('2d');
    g.fillStyle = base;
    g.fillRect(0, 0, 256, 128);
    let r = seed;
    const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 40; i++) {
        const color = blobs[Math.floor(random() * blobs.length)];
        g.fillStyle = color;
        g.beginPath();
        g.ellipse(random() * 256, 14 + random() * 100, 6 + random() * 22, 4 + random() * 14, random() * Math.PI, 0, Math.PI * 2);
        g.fill();
    }
    return new THREE.CanvasTexture(canvas);
}

// A maze built from a fixed layout (see js/levels.js).
// Block (x, z) spans [x, x+1) x [z, z+1) in the world.
export const SPIKE_RADIUS = 0.75; // the normal spike plate's radius
const SPIKE_ROW_WIDTH = 3; // a spike row covers the whole 3-block corridor
const SPIKE_ROW_DEPTH = 0.9;

// Space doors (Level 12 on): open about 3 s, closed about 3 s, sliding takes a moment
const SPACE_DOOR_OPEN_TIME = 3;
const SPACE_DOOR_CLOSED_TIME = 3;
const SPACE_DOOR_SLIDE_TIME = 0.7;
// Solid like a wall once it's this far shut (or more)
const SPACE_DOOR_SOLID_FROM = 0.25;
const SPACE_DOOR_LIGHTS = { open: 0x3dff6e, moving: 0xffc83d, closed: 0xff3d3d };

// A shiny, icy strip for slippery spots (Level 13 on)
function iceTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const g = canvas.getContext('2d');
    const base = g.createLinearGradient(0, 0, 128, 128);
    base.addColorStop(0, '#bff4ff');
    base.addColorStop(0.5, '#7fdcff');
    base.addColorStop(1, '#c9f7ff');
    g.fillStyle = base;
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = 3;
    for (const [x, z, len] of [[14, 30, 40], [60, 18, 50], [30, 80, 46], [80, 70, 36], [20, 112, 30], [92, 108, 28]]) {
        g.beginPath();
        g.moveTo(x, z);
        g.lineTo(x + len, z - len * 0.45);
        g.stroke();
    }
    return new THREE.CanvasTexture(canvas);
}

export class Maze {
    // spikeRadius: how far the spike's plate reaches from its middle (0.75 normally;
    // Level 3's spike on the path is smaller so there's room to walk round it)
    // golden: the finale's door (Level 10) is gold instead of brown
    constructor(scene, layout, theme = DEFAULT_THEME, { wallHeight = 4, spikeRadius = SPIKE_RADIUS, golden = false } = {}) {
        this.spikeRadius = spikeRadius;
        this.golden = golden;
        this.scene = scene;
        this.theme = theme;
        // Everything this maze adds to the scene, so it can be taken away again
        this.root = new THREE.Group();
        this.height = wallHeight;
        this.depth = layout.length;
        this.width = layout[0].length;

        // grid[x][z]: 1 = wall, 0 = floor
        this.grid = [];
        // Rows of spikes right across a corridor ('Y', Level 5 on): no way past
        this.spikeRows = [];
        // Blocks of the space door ('G'), if the level has one
        const doorBlocks = [];
        // Blocks of slippery floor ('I'), keyed "x,z"
        this.slipperyBlocks = new Set();
        for (let x = 0; x < this.width; x++) {
            this.grid[x] = [];
            for (let z = 0; z < this.depth; z++) {
                const ch = layout[z][x];
                this.grid[x][z] = ch === '#' || ch === 'D' ? 1 : 0;
                const center = new THREE.Vector3(x + 0.5, 0, z + 0.5);
                if (ch === 'S') this.startPosition = center;
                if (ch === 'X') this.spikePosition = center;
                if (ch === 'Y') this.spikeRows.push({ position: center, x, z });
                if (ch === 'D') this.doorBlock = { x, z };
                if (ch === 'G') doorBlocks.push({ x, z });
                if (ch === 'I') this.slipperyBlocks.add(`${x},${z}`);
            }
        }
        if (doorBlocks.length) {
            // shut: 0 = all the way open, 1 = all the way closed. It starts open.
            this.spaceDoor = { blocks: doorBlocks, shut: 0, phase: 'open', timer: SPACE_DOOR_OPEN_TIME, solid: false };
        }

        // A row spans the corridor it sits in: across x when the corridor runs
        // along z (walls two blocks to either side in x), otherwise across z
        for (const row of this.spikeRows) {
            row.spansX = this.grid[row.x - 2]?.[row.z] === 1 && this.grid[row.x + 2]?.[row.z] === 1;
        }

        // Collision data: [x][z][y], same wall value at every height
        this.mazeData = this.grid.map((col) => col.map((v) => new Array(this.height).fill(v)));
    }

    build() {
        this.renderMaze();
        this.createDoor();
        if (this.spikePosition) this.createSpike();
        if (this.spaceDoor) this.createSpaceDoor();
        if (this.slipperyBlocks.size) this.createSlipperySpots();
        for (const row of this.spikeRows) this.createSpikeRow(row);
        this.scene.add(this.root);
    }

    // Remove the maze from the scene and free its memory
    dispose() {
        this.scene.remove(this.root);
        this.root.traverse((o) => {
            o.geometry?.dispose();
            const materials = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
            for (const m of materials) {
                m.map?.dispose();
                m.dispose();
            }
        });
    }

    renderMaze() {
        // One tall box per wall column, drawn as a single instanced mesh
        let count = 0;
        for (let x = 0; x < this.width; x++) {
            for (let z = 0; z < this.depth; z++) if (this.grid[x][z] === 1) count++;
        }

        const fluffy = this.theme.fluffy;
        const space = this.theme.space;
        let wallMaterial;
        if (space) {
            const stars = starTexture(128, 512, 5);
            wallMaterial = new THREE.MeshStandardMaterial({ map: stars, emissiveMap: stars, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.9 });
        } else if (fluffy) {
            wallMaterial = new THREE.MeshStandardMaterial({ map: fluffTexture(this.theme.wall, 128, 512, 7), roughness: 1, emissive: this.theme.wall, emissiveIntensity: 0.15 });
        } else {
            wallMaterial = new THREE.MeshStandardMaterial({ color: this.theme.wall });
        }
        const wallGeometry = new THREE.BoxGeometry(1, this.height, 1);
        const walls = new THREE.InstancedMesh(wallGeometry, wallMaterial, count);
        const matrix = new THREE.Matrix4();
        let n = 0;
        for (let x = 0; x < this.width; x++) {
            for (let z = 0; z < this.depth; z++) {
                if (this.grid[x][z] === 1) {
                    matrix.makeTranslation(x + 0.5, this.height / 2, z + 0.5);
                    walls.setMatrixAt(n++, matrix);
                }
            }
        }
        walls.castShadow = true;
        walls.receiveShadow = true;
        this.root.add(walls);

        if (fluffy) this.addPuffs(count);

        // Floor
        let floorMaterial;
        if (space) {
            const map = metalTexture(128);
            map.repeat.set(this.width / 2, this.depth / 2);
            floorMaterial = new THREE.MeshStandardMaterial({ map, roughness: 0.45, metalness: 0.35 });
        } else if (fluffy) {
            const map = fluffTexture(this.theme.floor, 256, 256, 3);
            map.repeat.set(this.width / 4, this.depth / 4);
            floorMaterial = new THREE.MeshStandardMaterial({ map, roughness: 1 });
        } else {
            floorMaterial = new THREE.MeshStandardMaterial({ color: this.theme.floor });
        }
        const floorGeometry = new THREE.BoxGeometry(this.width, 0.2, this.depth);
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.position.set(this.width / 2, -0.1, this.depth / 2);
        floor.receiveShadow = true;
        this.root.add(floor);

        if (space) this.addSpaceSky();
    }

    // Space World sky: Earth and the Moon far away (they stay put, so which
    // side they're on depends on where you look), and meteors, comets and
    // rocket ships that fly by high overhead. Just to look at: no dangers.
    addSpaceSky() {
        const cx = this.width / 2;
        const cz = this.depth / 2;
        const earth = new THREE.Mesh(
            new THREE.SphereGeometry(45, 32, 20),
            new THREE.MeshBasicMaterial({ map: planetTexture('#2f6fd6', ['#3fa34d', '#57b85f', '#e8eef5', '#2a8a3d'], 9), fog: false })
        );
        earth.position.set(cx - 170, 270, cz - 230);
        this.root.add(earth);
        const moon = new THREE.Mesh(
            new THREE.SphereGeometry(16, 24, 16),
            new THREE.MeshBasicMaterial({ map: planetTexture('#c9ccd2', ['#9ea3ab', '#b3b7be', '#878c94'], 4), fog: false })
        );
        moon.position.set(cx + 190, 220, cz + 150);
        this.root.add(moon);

        this.flyers = [];
        const kinds = ['meteor', 'comet', 'rocket', 'meteor', 'comet', 'rocket', 'meteor'];
        kinds.forEach((kind, k) => {
            const flyer = this.makeFlyer(kind);
            this.root.add(flyer.object);
            this.flyers.push(flyer);
            this.launchFlyer(flyer, k / kinds.length);
        });
    }

    makeFlyer(kind) {
        const group = new THREE.Group();
        const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, fog: false, ...extra });
        if (kind === 'meteor') {
            const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4), basic(0xb07a4a));
            const trail = new THREE.Mesh(new THREE.ConeGeometry(1.1, 9, 10, 1, true), basic(0xff9a3c, { transparent: true, opacity: 0.55 }));
            trail.rotation.z = Math.PI / 2;
            trail.position.x = -5;
            group.add(rock, trail);
        } else if (kind === 'comet') {
            const head = new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 12), basic(0xdff4ff));
            const tail = new THREE.Mesh(new THREE.ConeGeometry(1.6, 16, 12, 1, true), basic(0x9fd8ff, { transparent: true, opacity: 0.4 }));
            tail.rotation.z = Math.PI / 2;
            tail.position.x = -8.5;
            group.add(head, tail);
        } else {
            const body = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 5, 14), basic(0xf2f2f2));
            const nose = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2, 14), basic(0xe23b3b));
            nose.position.y = 3.5;
            const flame = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.6, 12), basic(0xffb428));
            flame.rotation.z = Math.PI;
            flame.position.y = -3.8;
            group.add(body, nose, flame);
            for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
                const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.4, 1.2), basic(0xe23b3b));
                fin.position.set(Math.sin(a) * 0.95, -2, Math.cos(a) * 0.95);
                fin.rotation.y = a;
                group.add(fin);
            }
            group.rotation.z = -Math.PI / 2; // fly nose-first along x
        }
        const object = new THREE.Group();
        object.add(group);
        return { kind, object, velocity: new THREE.Vector3(), life: 0 };
    }

    // Send a flyer across the sky on a new path, `ahead` of the way along it (0-1)
    launchFlyer(flyer, ahead = 0) {
        const cx = this.width / 2;
        const cz = this.depth / 2;
        const angle = Math.random() * Math.PI * 2;
        const speed = flyer.kind === 'rocket' ? 14 : flyer.kind === 'comet' ? 18 : 26;
        const span = 260;
        const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
        const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar((Math.random() - 0.5) * 120);
        const start = new THREE.Vector3(cx, 30 + Math.random() * 45, cz).addScaledVector(dir, -span / 2).add(side);
        flyer.velocity.copy(dir).multiplyScalar(speed);
        flyer.velocity.y = flyer.kind === 'meteor' ? -2 : (Math.random() - 0.5) * 2;
        flyer.life = span / speed;
        flyer.object.position.copy(start).addScaledVector(flyer.velocity, flyer.life * ahead);
        flyer.life *= 1 - ahead;
        flyer.object.lookAt(flyer.object.position.clone().add(flyer.velocity));
        flyer.object.rotateY(-Math.PI / 2); // models point along +x
    }

    // Move the things flying through the sky (called every frame)
    update(dt) {
        if (!this.flyers) return;
        for (const flyer of this.flyers) {
            flyer.object.position.addScaledVector(flyer.velocity, dt);
            flyer.life -= dt;
            if (flyer.life <= 0) this.launchFlyer(flyer);
        }
    }

    // Cotton-candy puffs: soft balls along the tops of the walls and at their feet
    addPuffs(wallCount) {
        const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(this.theme.wall).lerp(new THREE.Color(0xffffff), 0.25),
            roughness: 1,
            emissive: this.theme.wall,
            emissiveIntensity: 0.2,
        });
        const puffs = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), material, wallCount * 2);
        const matrix = new THREE.Matrix4();
        let r = 11;
        const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
        let n = 0;
        for (let x = 0; x < this.width; x++) {
            for (let z = 0; z < this.depth; z++) {
                if (this.grid[x][z] !== 1) continue;
                const top = 0.55 + random() * 0.2;
                matrix.makeScale(top, top * 0.8, top);
                matrix.setPosition(x + 0.5 + (random() - 0.5) * 0.2, this.height + (random() - 0.5) * 0.2, z + 0.5 + (random() - 0.5) * 0.2);
                puffs.setMatrixAt(n++, matrix);
                const foot = 0.45 + random() * 0.15;
                matrix.makeScale(foot, foot * 0.6, foot);
                matrix.setPosition(x + 0.5, 0.05, z + 0.5);
                puffs.setMatrixAt(n++, matrix);
            }
        }
        this.root.add(puffs);
    }

    // Which outer edge the door is on
    doorEdge() {
        const { x, z } = this.doorBlock;
        if (x === this.width - 1) return 'east';
        if (x === 0) return 'west';
        if (z === 0) return 'north';
        return 'south';
    }

    // Brown door with a rusty knob and four windows, set into an outer wall
    createDoor() {
        const door = new THREE.Group();
        const doorWidth = 1.4;
        const doorHeight = 2.4;

        const frame = new THREE.Mesh(
            new THREE.BoxGeometry(doorWidth + 0.3, doorHeight + 0.15, 0.1),
            new THREE.MeshStandardMaterial(this.golden ? { color: 0xd9a520, metalness: 0.2, roughness: 0.4, emissive: 0x7a5200, emissiveIntensity: 0.4 } : { color: 0x3b2410 })
        );
        frame.position.set(0, (doorHeight + 0.15) / 2, 0.02);
        door.add(frame);

        const panel = new THREE.Mesh(
            new THREE.BoxGeometry(doorWidth, doorHeight, 0.12),
            new THREE.MeshStandardMaterial(this.golden
                ? { color: 0xffd23f, metalness: 0.25, roughness: 0.3, emissive: 0xb88a00, emissiveIntensity: 0.55 }
                : { color: 0x7a4a22, roughness: 0.8 })
        );
        panel.position.set(0, doorHeight / 2, 0.06);
        door.add(panel);

        // Four windows, 2 x 2, in the upper half
        const glass = new THREE.MeshStandardMaterial({
            color: 0xbfe6ff,
            emissive: 0x3a6f8f,
            roughness: 0.2,
        });
        const paneSize = 0.42;
        for (const px of [-0.25, 0.25]) {
            for (const py of [1.55, 2.05]) {
                const pane = new THREE.Mesh(new THREE.BoxGeometry(paneSize, paneSize, 0.02), glass);
                pane.position.set(px, py, 0.13);
                door.add(pane);
            }
        }

        // Rusty knob
        const knob = new THREE.Mesh(
            new THREE.SphereGeometry(0.08, 16, 12),
            new THREE.MeshStandardMaterial({ color: 0xa0461c, roughness: 1, metalness: 0.3 })
        );
        knob.position.set(0.5, 1.1, 0.2);
        door.add(knob);

        // Stand the door against the inside face of its wall, facing into the maze
        const { x, z } = this.doorBlock;
        const inside = {
            east: [x, z + 0.5],
            west: [x + 1, z + 0.5],
            north: [x + 0.5, z + 1],
            south: [x + 0.5, z],
        }[this.doorEdge()];
        this.doorPosition = new THREE.Vector3(inside[0], 0, inside[1]);
        door.position.copy(this.doorPosition);
        door.rotation.y = EDGES[this.doorEdge()].doorYaw;
        this.root.add(door);
    }

    // A small cluster of metal spikes on the floor
    createSpike() {
        const spike = new THREE.Group();
        const metal = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.7, roughness: 0.35 });

        const base = new THREE.Mesh(
            new THREE.CylinderGeometry(0.7, 0.75, 0.08, 20),
            new THREE.MeshStandardMaterial({ color: 0x4a4d52, metalness: 0.5, roughness: 0.6 })
        );
        base.position.y = 0.04;
        spike.add(base);

        // Space World: pointy glowing crystals instead of metal spikes (same size, same danger)
        const space = this.theme.space;
        const crystal = new THREE.MeshStandardMaterial({ color: 0x9a7bff, emissive: 0x5a2fd6, emissiveIntensity: 0.6, roughness: 0.2, metalness: 0.1 });
        const coneGeometry = space ? new THREE.OctahedronGeometry(0.17, 0).scale(0.8, 2.4, 0.8) : new THREE.ConeGeometry(0.12, 0.6, 10);
        const offsets = [[0, 0], [0.35, 0.2], [-0.35, 0.2], [0.2, -0.35], [-0.2, -0.35], [0, 0.42]];
        for (const [ox, oz] of offsets) {
            const cone = new THREE.Mesh(coneGeometry, space ? crystal : metal);
            cone.position.set(ox, 0.38, oz);
            cone.castShadow = true;
            spike.add(cone);
        }

        // Shrink (or grow) the whole cluster sideways to the level's spike size
        spike.scale.set(this.spikeRadius / SPIKE_RADIUS, 1, this.spikeRadius / SPIKE_RADIUS);
        spike.position.copy(this.spikePosition);
        this.root.add(spike);
    }

    // A row of spikes right across a 3-block corridor, one block deep
    createSpikeRow(row) {
        const group = new THREE.Group();
        const metal = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.7, roughness: 0.35 });
        const base = new THREE.Mesh(
            new THREE.BoxGeometry(SPIKE_ROW_WIDTH, 0.08, SPIKE_ROW_DEPTH),
            new THREE.MeshStandardMaterial({ color: 0x4a4d52, metalness: 0.5, roughness: 0.6 })
        );
        base.position.y = 0.04;
        group.add(base);
        const coneGeometry = new THREE.ConeGeometry(0.12, 0.6, 10);
        for (let k = 0; k < 7; k++) {
            for (const dz of [-0.22, 0.22]) {
                const cone = new THREE.Mesh(coneGeometry, metal);
                cone.position.set(-1.29 + k * 0.43 + (dz > 0 ? 0.2 : 0), 0.38, dz);
                cone.castShadow = true;
                group.add(cone);
            }
        }
        if (!row.spansX) group.rotation.y = Math.PI / 2;
        group.position.copy(row.position);
        this.root.add(group);
    }

    // A space door: a metal panel with a glowing stripe that slides down into
    // the floor to open and back up to close, a glowing frame round the gap,
    // and a light on top: green open, yellow moving, red closed
    createSpaceDoor() {
        const door = this.spaceDoor;
        const xs = door.blocks.map((b) => b.x);
        const zs = door.blocks.map((b) => b.z);
        const spansX = new Set(xs).size > 1; // the gap runs along x (the door faces z)
        const minX = Math.min(...xs);
        const minZ = Math.min(...zs);
        const across = door.blocks.length; // 3 blocks wide
        const cx = spansX ? minX + across / 2 : minX + 0.5;
        const cz = spansX ? minZ + 0.5 : minZ + across / 2;
        const group = new THREE.Group();
        group.position.set(cx, 0, cz);
        if (!spansX) group.rotation.y = Math.PI / 2;
        this.root.add(group);

        // Panel (and its stripes) in a group that slides down into the floor
        const slider = new THREE.Group();
        const panel = new THREE.Mesh(
            new THREE.BoxGeometry(across, this.height, 0.3),
            new THREE.MeshStandardMaterial({ color: 0xaeb6c2, metalness: 0.6, roughness: 0.35, emissive: 0x3a4454, emissiveIntensity: 0.6 })
        );
        panel.position.y = this.height / 2;
        panel.castShadow = true;
        slider.add(panel);
        const glow = new THREE.MeshStandardMaterial({ color: 0x5ff2ff, emissive: 0x2fd8ff, emissiveIntensity: 0.9 });
        for (const y of [0.9, 1.9]) {
            const stripe = new THREE.Mesh(new THREE.BoxGeometry(across - 0.3, 0.12, 0.34), glow);
            stripe.position.y = y;
            slider.add(stripe);
        }
        group.add(slider);

        // Glowing frame on the wall ends either side, and a bar across the top
        const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x5ff2ff, emissive: 0x2fd8ff, emissiveIntensity: 0.7 });
        for (const side of [-1, 1]) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, this.height, 0.5), frameMaterial);
            post.position.set(side * (across / 2 + 0.03), this.height / 2, 0);
            group.add(post);
        }
        const bar = new THREE.Mesh(new THREE.BoxGeometry(across + 0.2, 0.25, 0.5), new THREE.MeshStandardMaterial({ color: 0x5d636b, metalness: 0.6, roughness: 0.4 }));
        bar.position.y = this.height + 0.1;
        group.add(bar);
        const light = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshBasicMaterial({ color: SPACE_DOOR_LIGHTS.open }));
        light.position.y = this.height + 0.35;
        group.add(light);

        Object.assign(door, { slider, light, minX, minZ, maxX: Math.max(...xs) + 1, maxZ: Math.max(...zs) + 1 });
        this.showSpaceDoor();
    }

    // Slippery spots: a shiny, glowing icy patch on each slippery block
    createSlipperySpots() {
        const material = new THREE.MeshStandardMaterial({
            map: iceTexture(), metalness: 0.3, roughness: 0.05, emissive: 0x2a9fd0, emissiveIntensity: 0.45,
        });
        const geometry = new THREE.BoxGeometry(1.002, 0.03, 1.002);
        for (const k of this.slipperyBlocks) {
            const [x, z] = k.split(',').map(Number);
            const patch = new THREE.Mesh(geometry, material);
            patch.position.set(x + 0.5, 0.015, z + 0.5);
            patch.receiveShadow = true;
            this.root.add(patch);
        }
    }

    // Is this point on slippery floor?
    onSlipperySpot(point) {
        return this.slipperyBlocks.has(`${Math.floor(point.x)},${Math.floor(point.z)}`);
    }

    // Is a player of this radius overlapping the space door's gap?
    inSpaceDoorway(point, radius) {
        const d = this.spaceDoor;
        return point.x + radius > d.minX && point.x - radius < d.maxX && point.z + radius > d.minZ && point.z - radius < d.maxZ;
    }

    // Run the space door's open / shut cycle (called every game step, so it
    // stops while paused). It never shuts on the player: while they're in the
    // doorway it stays open, and if they step in as it closes it opens again.
    updateSpaceDoor(dt, playerPosition, playerRadius) {
        const door = this.spaceDoor;
        if (!door) return;
        // Same reach as the wall check, so standing right up against the shut door
        // doesn't count as being in the doorway
        const inDoorway = this.inSpaceDoorway(playerPosition, playerRadius);
        const slide = dt / SPACE_DOOR_SLIDE_TIME;
        if (door.phase === 'open') {
            door.timer -= dt;
            if (door.timer <= 0 && !inDoorway) door.phase = 'closing';
        } else if (door.phase === 'closing') {
            if (inDoorway) {
                door.phase = 'opening';
            } else {
                door.shut = Math.min(1, door.shut + slide);
                if (door.shut === 1) Object.assign(door, { phase: 'closed', timer: SPACE_DOOR_CLOSED_TIME });
            }
        } else if (door.phase === 'closed') {
            door.timer -= dt;
            if (door.timer <= 0) door.phase = 'opening';
        } else {
            door.shut = Math.max(0, door.shut - slide);
            if (door.shut === 0) Object.assign(door, { phase: 'open', timer: SPACE_DOOR_OPEN_TIME });
        }
        // Solid while mostly shut, but never while the player is in the gap
        const solid = door.shut >= SPACE_DOOR_SOLID_FROM && !inDoorway;
        if (solid !== door.solid) {
            door.solid = solid;
            for (const { x, z } of door.blocks) this.mazeData[x][z].fill(solid ? 1 : 0);
        }
        this.showSpaceDoor();
    }

    showSpaceDoor() {
        const door = this.spaceDoor;
        if (!door.slider) return;
        door.slider.position.y = -(1 - door.shut) * (this.height + 0.05);
        door.slider.visible = door.shut > 0;
        const color = door.phase === 'open' ? 'open' : door.phase === 'closed' ? 'closed' : 'moving';
        door.light.material.color.setHex(SPACE_DOOR_LIGHTS[color]);
    }

    // Is a point within `margin` of any spike? (The round spike counts from the
    // edge of its plate; a row counts across its whole width.)
    touchesSpike(point, margin) {
        if (this.spikePosition && Math.hypot(point.x - this.spikePosition.x, point.z - this.spikePosition.z) < this.spikeRadius + margin) return true;
        return this.spikeRows.some((row) => {
            const across = row.spansX ? point.x - row.position.x : point.z - row.position.z;
            const along = row.spansX ? point.z - row.position.z : point.x - row.position.x;
            return Math.abs(across) < SPIKE_ROW_WIDTH / 2 + margin && Math.abs(along) < SPIKE_ROW_DEPTH / 2 + margin;
        });
    }

    getStartPosition() {
        return this.startPosition.clone();
    }

    // Face toward the side of the maze the door is on
    getStartYaw() {
        return EDGES[this.doorEdge()].startYaw;
    }

    // Just in front of the door, facing it (where Quit leaves you after reaching it)
    getDoorApproach() {
        const inward = {
            east: [-1, 0],
            west: [1, 0],
            north: [0, 1],
            south: [0, -1],
        }[this.doorEdge()];
        const position = this.doorPosition.clone();
        position.x += inward[0] * DOOR_APPROACH_DISTANCE;
        position.z += inward[1] * DOOR_APPROACH_DISTANCE;
        return { position, yaw: EDGES[this.doorEdge()].startYaw };
    }

    getMazeData() {
        return this.mazeData;
    }
}
