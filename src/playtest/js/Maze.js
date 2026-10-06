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

// Jungle World walls: thick green leaves of many shades, with vines hanging down
function leafTexture(width, height, seed) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext('2d');
    g.fillStyle = '#1d4f21';
    g.fillRect(0, 0, width, height);
    let r = seed;
    const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    const greens = ['#2e7d32', '#388e3c', '#43a047', '#1b5e20', '#66bb6a', '#558b2f'];
    for (let i = 0; i < (width * height) / 110; i++) {
        const x = random() * width;
        const y = random() * height;
        const len = 9 + random() * 14;
        const angle = random() * Math.PI * 2;
        g.save();
        g.translate(x, y);
        g.rotate(angle);
        g.fillStyle = greens[Math.floor(random() * greens.length)];
        g.beginPath();
        g.ellipse(0, 0, len, len * 0.42, 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = 'rgba(200,240,170,0.45)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(-len * 0.9, 0);
        g.lineTo(len * 0.9, 0);
        g.stroke();
        g.restore();
    }
    // Vines: wavy brownish-green lines from top to bottom
    for (let v = 0; v < 5; v++) {
        let x = random() * width;
        g.strokeStyle = v % 2 ? '#5d4a1f' : '#4f6b1f';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(x, 0);
        for (let y = 0; y <= height; y += 16) {
            x += (random() - 0.5) * 8;
            g.lineTo(x, y);
        }
        g.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// Jungle World floor: a brown dirt path with darker and lighter specks and pebbles
function dirtTexture(size, seed) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const g = canvas.getContext('2d');
    g.fillStyle = '#8b5a2b';
    g.fillRect(0, 0, size, size);
    let r = seed;
    const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    const browns = ['#7a4e24', '#9c6a38', '#6b4220', '#a77845', '#5e3a1c'];
    for (let i = 0; i < size * size / 20; i++) {
        g.fillStyle = browns[Math.floor(random() * browns.length)];
        const d = 1 + random() * 3;
        g.fillRect(random() * size, random() * size, d, d);
    }
    for (let i = 0; i < 14; i++) {
        g.fillStyle = random() < 0.5 ? '#9e9a92' : '#7d776d';
        g.beginPath();
        g.ellipse(random() * size, random() * size, 2 + random() * 3, 1.5 + random() * 2, random() * Math.PI, 0, Math.PI * 2);
        g.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// Rushing river water: blue with white streaks that run across the texture's v
function waterTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const g = canvas.getContext('2d');
    const base = g.createLinearGradient(0, 0, 128, 0);
    base.addColorStop(0, '#1565c0');
    base.addColorStop(0.5, '#1e88e5');
    base.addColorStop(1, '#1565c0');
    g.fillStyle = base;
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(255,255,255,0.6)';
    g.lineWidth = 2;
    for (const [x, y, len] of [[10, 10, 30], [70, 30, 26], [30, 60, 34], [90, 80, 22], [15, 100, 28], [60, 115, 30], [100, 5, 18]]) {
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + 4, y + len / 2, x, y + len);
        g.stroke();
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

// Moving platforms (Level 17 on): a shiny metal platform that carries the
// player across a gap with no floor. It's the gap's full width and this long.
const PLATFORM_LENGTH = 2.4;
const PLATFORM_SPEED = 6; // about walking speed (walking tops out near 7.5)
// A fast leaf ('F' blocks instead of 'O', Level 27 on) goes this much faster
const FAST_PLATFORM_SPEED = PLATFORM_SPEED * 1.3;
const PLATFORM_WAIT = 0.3; // a moment after the player is fully on before it sets off
// How close to an edge (from the floor side) counts as coming to it
const PLATFORM_CALL_DISTANCE = 2.5;

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

// Split blocks into groups that touch each other (side by side)
function groupBlocks(blocks) {
    const left = new Map(blocks.map((b) => [`${b.x},${b.z}`, b]));
    const groups = [];
    for (const first of blocks) {
        if (!left.has(`${first.x},${first.z}`)) continue;
        const group = [];
        const todo = [first];
        left.delete(`${first.x},${first.z}`);
        while (todo.length) {
            const b = todo.pop();
            group.push(b);
            for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const k = `${b.x + dx},${b.z + dz}`;
                if (left.has(k)) {
                    todo.push(left.get(k));
                    left.delete(k);
                }
            }
        }
        groups.push(group);
    }
    return groups;
}

export class Maze {
    // spikeRadius: how far the spike's plate reaches from its middle (0.75 normally;
    // Level 3's spike on the path is smaller so there's room to walk round it)
    // golden: the finale's door (Level 10) is gold instead of brown
    // spike2Radius: the second path spike's ('Z', Level 20) plate, the tighter squeeze
    constructor(scene, layout, theme = DEFAULT_THEME, { wallHeight = 4, spikeRadius = SPIKE_RADIUS, spike2Radius = spikeRadius, golden = false } = {}) {
        this.spikeRadius = spikeRadius;
        this.spike2Radius = spike2Radius;
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
        // Blocks with no floor ('O'), crossed on moving platforms (one per gap);
        // 'F' is the same but its platform is a fast one (Level 27 on)
        const gapBlocks = [];
        for (let x = 0; x < this.width; x++) {
            this.grid[x] = [];
            for (let z = 0; z < this.depth; z++) {
                const ch = layout[z][x];
                this.grid[x][z] = ch === '#' || ch === 'D' ? 1 : 0;
                const center = new THREE.Vector3(x + 0.5, 0, z + 0.5);
                if (ch === 'S') this.startPosition = center;
                if (ch === 'X') this.spikePosition = center;
                if (ch === 'Z') this.spike2Position = center;
                if (ch === 'Y') this.spikeRows.push({ position: center, x, z });
                if (ch === 'D') this.doorBlock = { x, z };
                if (ch === 'G') doorBlocks.push({ x, z });
                if (ch === 'I') this.slipperyBlocks.add(`${x},${z}`);
                if (ch === 'O' || ch === 'F') gapBlocks.push({ x, z, fast: ch === 'F' });
            }
        }
        // Each separate gap (a group of touching 'O' blocks) gets its own platform (Level 23 has two)
        this.platforms = groupBlocks(gapBlocks).map((blocks) => this.setUpPlatform(blocks));
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
        if (this.spikePosition) this.createSpike(this.spikePosition, this.spikeRadius);
        if (this.spike2Position) this.createSpike(this.spike2Position, this.spike2Radius);
        if (this.spaceDoor) this.createSpaceDoor();
        if (this.slipperyBlocks.size) this.createSlipperySpots();
        for (const p of this.platforms) this.createPlatform(p);
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
        const jungle = this.theme.jungle;
        let wallMaterial;
        if (jungle) {
            wallMaterial = new THREE.MeshStandardMaterial({ map: leafTexture(128, 512, 13), roughness: 0.95 });
        } else if (space) {
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
        if (jungle) {
            const map = dirtTexture(128, 17);
            map.repeat.set(this.width / 2, this.depth / 2);
            floorMaterial = new THREE.MeshStandardMaterial({ map, roughness: 1 });
        } else if (space) {
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
        let floor;
        if (this.platforms.length) {
            // A floor with a hole where each gap is: the shape's (x, y) is the
            // world's (x, z), and its UVs are world units, so the texture lines
            // up the same as on the plain floor
            const outline = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(this.width, 0), new THREE.Vector2(this.width, this.depth), new THREE.Vector2(0, this.depth)]);
            for (const { gap: g } of this.platforms) {
                outline.holes.push(new THREE.Path([new THREE.Vector2(g.minX, g.minZ), new THREE.Vector2(g.minX, g.maxZ), new THREE.Vector2(g.maxX, g.maxZ), new THREE.Vector2(g.maxX, g.minZ)]));
            }
            const geometry = new THREE.ExtrudeGeometry(outline, { depth: 0.2, bevelEnabled: false });
            geometry.rotateX(Math.PI / 2);
            floorMaterial.map?.repeat.set(0.5, 0.5);
            // The gap's edges (the floor's cut sides) are dark, so they don't look like a ledge
            floor = new THREE.Mesh(geometry, [floorMaterial, new THREE.MeshBasicMaterial({ color: jungle ? 0x3b2414 : 0x0b0e18 })]);
        } else {
            const floorGeometry = new THREE.BoxGeometry(this.width, 0.2, this.depth);
            floor = new THREE.Mesh(floorGeometry, floorMaterial);
            floor.position.set(this.width / 2, -0.1, this.depth / 2);
        }
        floor.receiveShadow = true;
        this.root.add(floor);

        if (space) this.addSpaceSky();
        if (jungle) this.addJungleSky();
    }

    // Jungle World sky: parrots, toucans and big bright butterflies flying by
    // overhead. Just to look at: no dangers.
    addJungleSky() {
        this.flyers = [];
        const kinds = ['parrot', 'butterfly', 'toucan', 'butterfly', 'parrot', 'butterfly', 'toucan'];
        kinds.forEach((kind, k) => {
            const flyer = this.makeFlyer(kind);
            this.root.add(flyer.object);
            this.flyers.push(flyer);
            this.launchFlyer(flyer, k / kinds.length);
        });
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
        } else if (kind === 'parrot' || kind === 'toucan') {
            // A bird flying along +x, wings out to the sides (they flap in update)
            const parrot = kind === 'parrot';
            const body = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), basic(parrot ? 0xe53935 : 0x212121));
            body.scale.set(1.4, 0.7, 0.7);
            const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), basic(parrot ? 0xe53935 : 0x212121));
            head.position.set(1.4, 0.3, 0);
            const beak = new THREE.Mesh(new THREE.ConeGeometry(parrot ? 0.25 : 0.4, parrot ? 0.6 : 1.6, 10), basic(parrot ? 0xfff176 : 0xff9800));
            beak.rotation.z = -Math.PI / 2;
            beak.position.set(parrot ? 2.1 : 2.6, 0.25, 0);
            const tail = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.6), basic(parrot ? 0x1e88e5 : 0x212121));
            tail.position.set(-1.9, -0.1, 0);
            group.add(body, head, beak, tail);
            if (!parrot) {
                const chest = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), basic(0xfff59d));
                chest.position.set(1.0, 0.0, 0);
                group.add(chest);
            }
            const wings = [];
            for (const side of [-1, 1]) {
                const pivot = new THREE.Group();
                const wing = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 2.2), basic(parrot ? 0x1e88e5 : 0x212121));
                wing.position.z = side * 1.1;
                const tip = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.11, 0.8), basic(parrot ? 0xfdd835 : 0xfafafa));
                tip.position.set(-0.1, 0, side * 1.9);
                pivot.add(wing, tip);
                pivot.userData.side = side;
                group.add(pivot);
                wings.push(pivot);
            }
            group.scale.setScalar(1.1);
            const object = new THREE.Group();
            object.add(group);
            return { kind, object, velocity: new THREE.Vector3(), life: 0, wings, flap: Math.random() * 6 };
        } else if (kind === 'butterfly') {
            const colors = [[0xff9800, 0x212121], [0x29b6f6, 0x0d47a1], [0xf06292, 0xffeb3b], [0xffeb3b, 0xff5722]];
            const [main, edge] = colors[Math.floor(Math.random() * colors.length)];
            const body = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8), basic(0x212121));
            body.rotation.z = Math.PI / 2;
            group.add(body);
            const wings = [];
            for (const side of [-1, 1]) {
                const pivot = new THREE.Group();
                const upper = new THREE.Mesh(new THREE.CircleGeometry(0.75, 20), basic(main, { side: THREE.DoubleSide }));
                upper.rotation.x = -Math.PI / 2;
                upper.position.set(0.25, 0, side * 0.75);
                const lower = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), basic(edge, { side: THREE.DoubleSide }));
                lower.rotation.x = -Math.PI / 2;
                lower.position.set(-0.35, 0.01, side * 0.55);
                pivot.add(upper, lower);
                pivot.userData.side = side;
                group.add(pivot);
                wings.push(pivot);
            }
            group.scale.setScalar(1.3);
            const object = new THREE.Group();
            object.add(group);
            return { kind, object, velocity: new THREE.Vector3(), life: 0, wings, flap: Math.random() * 6 };
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
        // Birds and butterflies fly lower and slower than things in space
        const speeds = { rocket: 14, comet: 18, meteor: 26, parrot: 11, toucan: 9, butterfly: 4 };
        const speed = speeds[flyer.kind];
        const bird = flyer.kind === 'parrot' || flyer.kind === 'toucan';
        const butterfly = flyer.kind === 'butterfly';
        const span = butterfly ? 70 : bird ? 160 : 260;
        const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
        const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar((Math.random() - 0.5) * (butterfly ? 30 : bird ? 60 : 120));
        const height = butterfly ? 6 + Math.random() * 5 : bird ? 12 + Math.random() * 14 : 30 + Math.random() * 45;
        const start = new THREE.Vector3(cx, height, cz).addScaledVector(dir, -span / 2).add(side);
        flyer.velocity.copy(dir).multiplyScalar(speed);
        flyer.velocity.y = flyer.kind === 'meteor' ? -2 : bird || butterfly ? 0 : (Math.random() - 0.5) * 2;
        flyer.life = span / speed;
        flyer.object.position.copy(start).addScaledVector(flyer.velocity, flyer.life * ahead);
        flyer.life *= 1 - ahead;
        flyer.object.lookAt(flyer.object.position.clone().add(flyer.velocity));
        flyer.object.rotateY(-Math.PI / 2); // models point along +x
    }

    // Move the things flying through the sky, and under the platform gap (called every frame)
    update(dt) {
        for (const flyer of this.flyers || []) {
            flyer.object.position.addScaledVector(flyer.velocity, dt);
            // Birds and butterflies flap their wings (butterflies quicker, with a flutter)
            if (flyer.wings) {
                const butterfly = flyer.kind === 'butterfly';
                flyer.flap += dt * (butterfly ? 14 : 7);
                for (const wing of flyer.wings) wing.rotation.x = wing.userData.side * Math.sin(flyer.flap) * (butterfly ? 0.9 : 0.6);
                if (butterfly) flyer.object.position.y += Math.sin(flyer.flap * 0.5) * dt * 1.2;
            }
            flyer.life -= dt;
            if (flyer.life <= 0) this.launchFlyer(flyer);
        }
        for (const p of this.platforms) {
            if (!p.river) continue;
            // Each river rushes along, and fish jump now and then
            const r = p.river;
            r.map.offset[r.flowAxis] -= dt * 0.9;
            for (const fish of r.fish) this.updateFish(fish, p, dt);
        }
        for (const flyer of this.gapFlyers || []) {
            flyer.object.position.addScaledVector(flyer.velocity, dt);
            flyer.life -= dt;
            if (flyer.life <= 0) this.launchGapFlyer(flyer);
        }
    }

    // Space World: smaller meteors, comets and rocket ships flying by in the open
    // space under the platform gap, mostly along it so they stay in view a while.
    // Just to look at: no dangers.
    addGapFlyers() {
        this.gapFlyers = [];
        const kinds = ['rocket', 'comet', 'meteor', 'rocket', 'comet'];
        kinds.forEach((kind, k) => {
            const flyer = this.makeFlyer(kind);
            flyer.object.scale.setScalar(0.4);
            this.root.add(flyer.object);
            this.gapFlyers.push(flyer);
            this.launchGapFlyer(flyer, k / kinds.length);
        });
    }

    // Send a gap flyer on a new path under the gap, `ahead` of the way along it (0-1)
    launchGapFlyer(flyer, ahead = 0) {
        const p = this.platform;
        const g = p.gap;
        const centre = new THREE.Vector3((g.minX + g.maxX) / 2, -4 - Math.random() * 10, (g.minZ + g.maxZ) / 2);
        const angle = (p.alongX ? 0 : Math.PI / 2) + (Math.random() - 0.5) * 0.7 + (Math.random() < 0.5 ? Math.PI : 0);
        const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
        const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar((Math.random() - 0.5) * 2);
        const span = 50;
        const speed = flyer.kind === 'rocket' ? 5 : flyer.kind === 'comet' ? 6.5 : 8;
        flyer.velocity.copy(dir).multiplyScalar(speed);
        flyer.life = span / speed;
        flyer.object.position.copy(centre).addScaledVector(dir, -span / 2).add(side).addScaledVector(flyer.velocity, flyer.life * ahead);
        flyer.life *= 1 - ahead;
        flyer.object.lookAt(flyer.object.position.clone().add(flyer.velocity));
        flyer.object.rotateY(-Math.PI / 2); // models point along +x
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

    // A small cluster of metal spikes on the floor, its plate `radius` across from the middle
    createSpike(position, radius) {
        if (this.theme.jungle) return this.createBush(position, radius);
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
        spike.scale.set(radius / SPIKE_RADIUS, 1, radius / SPIKE_RADIUS);
        spike.position.copy(position);
        this.root.add(spike);
    }

    // Jungle World's spike: a thorny bush with red berries, as wide as a spike's
    // plate. Touching the bush or its berries works the same as a spike.
    createBush(position, radius) {
        const bush = new THREE.Group();
        const leaves = [new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: 0x1b5e20, roughness: 0.9 })];
        const thorn = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.8 });
        const berry = new THREE.MeshStandardMaterial({ color: 0xe53935, roughness: 0.3, emissive: 0x7f0000, emissiveIntensity: 0.4 });
        let r = 31;
        const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
        const clumps = [[0, 0.45, 0, 0.42], [0.32, 0.32, 0.18, 0.32], [-0.3, 0.3, 0.2, 0.32], [0.18, 0.3, -0.32, 0.3], [-0.2, 0.32, -0.3, 0.3]];
        for (const [x, y, z, size] of clumps) {
            const ball = new THREE.Mesh(new THREE.SphereGeometry(size, 14, 10), leaves[Math.round(random())]);
            ball.position.set(x, y, z);
            ball.castShadow = true;
            bush.add(ball);
            // Thorns poking out all over, and a few red berries
            for (let k = 0; k < 6; k++) {
                const dir = new THREE.Vector3(random() - 0.5, random() * 0.8, random() - 0.5).normalize();
                const spikeTip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.2, 6), thorn);
                spikeTip.position.set(x, y, z).addScaledVector(dir, size + 0.06);
                spikeTip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
                bush.add(spikeTip);
            }
            for (let k = 0; k < 3; k++) {
                const dir = new THREE.Vector3(random() - 0.5, random() * 0.6 + 0.1, random() - 0.5).normalize();
                const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), berry);
                b.position.set(x, y, z).addScaledVector(dir, size);
                bush.add(b);
            }
        }
        bush.scale.set(radius / SPIKE_RADIUS, 1, radius / SPIKE_RADIUS);
        bush.position.copy(position);
        this.root.add(bush);
    }

    // A row of spikes right across a 3-block corridor, one block deep
    createSpikeRow(row) {
        if (this.theme.jungle) return this.createBigBush(row);
        const group = new THREE.Group();
        const metal = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.7, roughness: 0.35 });
        const base = new THREE.Mesh(
            new THREE.BoxGeometry(SPIKE_ROW_WIDTH, 0.08, SPIKE_ROW_DEPTH),
            new THREE.MeshStandardMaterial({ color: 0x4a4d52, metalness: 0.5, roughness: 0.6 })
        );
        base.position.y = 0.04;
        group.add(base);
        // Space World: a row of pointy glowing crystals, like the round space spike
        const space = this.theme.space;
        const crystal = new THREE.MeshStandardMaterial({ color: 0x9a7bff, emissive: 0x5a2fd6, emissiveIntensity: 0.6, roughness: 0.2, metalness: 0.1 });
        const coneGeometry = space ? new THREE.OctahedronGeometry(0.17, 0).scale(0.8, 2.4, 0.8) : new THREE.ConeGeometry(0.12, 0.6, 10);
        for (let k = 0; k < 7; k++) {
            for (const dz of [-0.22, 0.22]) {
                const cone = new THREE.Mesh(coneGeometry, space ? crystal : metal);
                cone.position.set(-1.29 + k * 0.43 + (dz > 0 ? 0.2 : 0), 0.38, dz);
                cone.castShadow = true;
                group.add(cone);
            }
        }
        if (!row.spansX) group.rotation.y = Math.PI / 2;
        group.position.copy(row.position);
        this.root.add(group);
    }

    // Jungle World's spike row (Level 22): a big thorny bush right across the
    // corridor, as wide as the corridor and as deep as a spike row, taller
    // than the little bush, with thorns and red berries all over
    createBigBush(row) {
        const group = new THREE.Group();
        const leaves = [new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: 0x1b5e20, roughness: 0.9 })];
        const thorn = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.8 });
        const berry = new THREE.MeshStandardMaterial({ color: 0xe53935, roughness: 0.3, emissive: 0x7f0000, emissiveIntensity: 0.4 });
        let r = 57;
        const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
        const clumps = [];
        // A bottom layer of five clumps across the corridor, then three on top
        for (let k = 0; k < 5; k++) clumps.push([-1.15 + k * 0.575, 0.42, (random() - 0.5) * 0.08, 0.42]);
        for (let k = 0; k < 3; k++) clumps.push([-0.75 + k * 0.75, 0.95, (random() - 0.5) * 0.08, 0.38]);
        for (const [x, y, z, size] of clumps) {
            const ball = new THREE.Mesh(new THREE.SphereGeometry(size, 14, 10), leaves[Math.round(random())]);
            ball.position.set(x, y, z);
            ball.castShadow = true;
            group.add(ball);
            for (let k = 0; k < 7; k++) {
                const dir = new THREE.Vector3(random() - 0.5, random() * 0.8, random() - 0.5).normalize();
                const spikeTip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.24, 6), thorn);
                spikeTip.position.set(x, y, z).addScaledVector(dir, size + 0.07);
                spikeTip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
                group.add(spikeTip);
            }
            for (let k = 0; k < 3; k++) {
                const dir = new THREE.Vector3(random() - 0.5, random() * 0.6 + 0.1, random() - 0.5).normalize();
                const b = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), berry);
                b.position.set(x, y, z).addScaledVector(dir, size);
                group.add(b);
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

    // The gap ('O' blocks, a rectangle right across a straight corridor) and
    // its platform. The platform slides along the gap's long side between its
    // two ends; `at` is how far its near end is from the gap's low end.
    setUpPlatform(blocks) {
        const xs = blocks.map((b) => b.x);
        const zs = blocks.map((b) => b.z);
        const gap = { minX: Math.min(...xs), maxX: Math.max(...xs) + 1, minZ: Math.min(...zs), maxZ: Math.max(...zs) + 1 };
        const alongX = gap.maxX - gap.minX > gap.maxZ - gap.minZ;
        const span = alongX ? gap.maxX - gap.minX : gap.maxZ - gap.minZ;
        const low = 0;
        const high = span - PLATFORM_LENGTH;
        // Which end is on the start's side: walk the floor from the start without crossing the gap
        const inGap = (x, z) => x >= gap.minX && x < gap.maxX && z >= gap.minZ && z < gap.maxZ;
        const seen = new Set();
        const todo = [[Math.floor(this.startPosition.x), Math.floor(this.startPosition.z)]];
        while (todo.length) {
            const [x, z] = todo.pop();
            if (seen.has(`${x},${z}`) || this.grid[x]?.[z] !== 0 || inGap(x, z)) continue;
            seen.add(`${x},${z}`);
            todo.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]);
        }
        const midX = Math.floor((gap.minX + gap.maxX) / 2);
        const midZ = Math.floor((gap.minZ + gap.maxZ) / 2);
        const lowSideReached = alongX ? seen.has(`${gap.minX - 1},${midZ}`) : seen.has(`${midX},${gap.minZ - 1}`);
        const startAt = lowSideReached ? low : high;
        return {
            gap, alongX, span, low, high, startAt,
            speed: blocks.some((b) => b.fast) ? FAST_PLATFORM_SPEED : PLATFORM_SPEED,
            at: startAt, target: startAt,
            riding: false, // the player is on board (and can't step off till it stops)
            wait: 0, // time left before it sets off with the player
            mustLeave: false, // just arrived: the player has to step off before it will carry them again
        };
    }

    // The first platform (Levels 17-22 have just one)
    get platform() {
        return this.platforms[0] ?? null;
    }

    // Every platform back to its start's side, empty (any reset to the start)
    resetPlatform() {
        for (const p of this.platforms) {
            Object.assign(p, { at: p.startAt, target: p.startAt, riding: false, wait: 0, mustLeave: false });
            this.showPlatform(p);
        }
    }

    // Position along the gap's long side, and across it, measured from the gap's low corner
    gapCoords(point, p) {
        const g = p.gap;
        return p.alongX
            ? { along: point.x - g.minX, across: point.z - g.minZ, width: g.maxZ - g.minZ }
            : { along: point.z - g.minZ, across: point.x - g.minX, width: g.maxX - g.minX };
    }

    // The platform whose gap this point is over (whether or not the platform is under it), if any
    gapAt(point) {
        return this.platforms.find((p) => {
            const { along, across, width } = this.gapCoords(point, p);
            return along >= 0 && along < p.span && across >= 0 && across < width;
        }) ?? null;
    }

    // Is this point over a gap (whether or not its platform is under it)?
    overGap(point) {
        return this.gapAt(point) !== null;
    }

    // Would a player standing here fall? (Over a gap with no platform under them)
    fallsIntoGap(point) {
        const p = this.gapAt(point);
        if (!p) return false;
        const { along } = this.gapCoords(point, p);
        return along < p.at || along > p.at + PLATFORM_LENGTH;
    }

    // Where to stand on the start's side, just before the gap this point is
    // over, facing across it (used to save the spot while on a platform)
    platformStartEdge(point) {
        const p = (point && this.gapAt(point)) || this.platform;
        const g = p.gap;
        const before = p.startAt === p.low ? -1 : p.span + 1;
        const dir = p.startAt === p.low ? 1 : -1;
        const position = p.alongX
            ? new THREE.Vector3(g.minX + before, 0, (g.minZ + g.maxZ) / 2)
            : new THREE.Vector3((g.minX + g.maxX) / 2, 0, g.minZ + before);
        // yaw 0 faces -z, PI/2 faces -x (see EDGES)
        const yaw = p.alongX ? (dir > 0 ? -Math.PI / 2 : Math.PI / 2) : dir > 0 ? Math.PI : 0;
        return { position, yaw };
    }

    // Run every platform (called every game step, after the player has moved).
    // Returns 'depart' or 'arrive' when that happens on any of them.
    updatePlatform(dt, position, velocity, radius) {
        let event = null;
        for (const p of this.platforms) event = this.updateOnePlatform(p, dt, position, velocity, radius) ?? event;
        return event;
    }

    // Run one platform.
    // It waits at an edge; once the player is fully on it sets off and carries
    // them to the other edge, keeping them on board until it stops. When it's
    // empty and the player comes to the edge it isn't at, it floats over to
    // them. Returns 'depart' or 'arrive' when that happens.
    updateOnePlatform(p, dt, position, velocity, radius) {
        const { along, across, width } = this.gapCoords(position, p);
        const inRange = across >= 0 && across < width;
        const fullyOn = inRange && along - radius >= p.at && along + radius <= p.at + PLATFORM_LENGTH;
        const touching = inRange && along + radius > p.at && along - radius < p.at + PLATFORM_LENGTH;
        let event = null;
        if (p.mustLeave && !touching) p.mustLeave = false;
        if (!p.riding && p.at === p.target && fullyOn && !p.mustLeave) {
            Object.assign(p, { riding: true, wait: PLATFORM_WAIT, target: p.at === p.low ? p.high : p.low });
        }
        if (p.riding) {
            if (p.wait > 0) {
                p.wait -= dt;
            } else {
                if (p.at === (p.target === p.high ? p.low : p.high)) event = 'depart';
                const before = p.at;
                p.at = p.target > p.at ? Math.min(p.target, p.at + p.speed * dt) : Math.max(p.target, p.at - p.speed * dt);
                if (p.alongX) position.x += p.at - before;
                else position.z += p.at - before;
                if (p.at === p.target) {
                    Object.assign(p, { riding: false, mustLeave: true });
                    event = 'arrive';
                }
            }
            // Keep the player on board while it's carrying them (or about to)
            const now = this.gapCoords(position, p).along;
            const lo = p.at + radius;
            const hi = p.at + PLATFORM_LENGTH - radius;
            if (p.riding || event === 'arrive') {
                const clamped = Math.max(lo, Math.min(hi, now));
                if (clamped !== now) {
                    if (p.alongX) {
                        position.x += clamped - now;
                        velocity.x = 0;
                    } else {
                        position.z += clamped - now;
                        velocity.z = 0;
                    }
                }
            }
        } else if (!touching && p.at === p.target && inRange) {
            // Empty: float over to whichever edge the player comes to
            if (p.at !== p.low && along < 0 && along > -PLATFORM_CALL_DISTANCE) p.target = p.low;
            if (p.at !== p.high && along > p.span && along < p.span + PLATFORM_CALL_DISTANCE) p.target = p.high;
        } else if (!p.riding && p.at !== p.target) {
            p.at = p.target > p.at ? Math.min(p.target, p.at + p.speed * dt) : Math.max(p.target, p.at - p.speed * dt);
        }
        this.showPlatform(p);
        return event;
    }

    // The gap's look: dark sky below (with a few far stars), a glowing strip
    // along each edge, and the shiny metal platform with glowing trim and
    // little thruster lights underneath
    createPlatform(p) {
        if (this.theme.jungle) {
            this.createRiver(p);
            this.createLeaf(p);
            this.showPlatform(p);
            return;
        }
        const g = p.gap;
        const width = p.alongX ? g.maxZ - g.minZ : g.maxX - g.minX;

        const stars = [];
        let r = 23;
        const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
        for (let k = 0; k < 220; k++) {
            stars.push(g.minX + random() * (g.maxX - g.minX), -4 - random() * 30, g.minZ + random() * (g.maxZ - g.minZ));
        }
        const starGeometry = new THREE.BufferGeometry();
        starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
        this.root.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xffffff, size: 0.15, fog: false })));
        if (this.theme.space) this.addGapFlyers();

        const edgeMaterial = new THREE.MeshStandardMaterial({ color: 0x5ff2ff, emissive: 0x2fd8ff, emissiveIntensity: 0.8 });
        for (const end of [0, p.span]) {
            const strip = new THREE.Mesh(new THREE.BoxGeometry(width, 0.04, 0.12), edgeMaterial);
            if (p.alongX) {
                strip.rotation.y = Math.PI / 2;
                strip.position.set(g.minX + end + (end ? 0.06 : -0.06), 0.02, (g.minZ + g.maxZ) / 2);
            } else {
                strip.position.set((g.minX + g.maxX) / 2, 0.02, g.minZ + end + (end ? 0.06 : -0.06));
            }
            this.root.add(strip);
        }

        const group = new THREE.Group();
        const deck = new THREE.Mesh(
            new THREE.BoxGeometry(width - 0.1, 0.25, PLATFORM_LENGTH),
            new THREE.MeshStandardMaterial({ color: 0xf2f6ff, metalness: 0.5, roughness: 0.15, emissive: 0x8a9ab8, emissiveIntensity: 0.75 })
        );
        deck.position.y = -0.12;
        deck.receiveShadow = true;
        group.add(deck);
        const trim = new THREE.MeshStandardMaterial({ color: 0x5ff2ff, emissive: 0x2fd8ff, emissiveIntensity: 0.9 });
        // Glowing trim right round the edge, and a glowing stripe down the middle
        for (const side of [-1, 1]) {
            const end = new THREE.Mesh(new THREE.BoxGeometry(width - 0.1, 0.06, 0.1), trim);
            end.position.set(0, 0.01, side * (PLATFORM_LENGTH / 2 - 0.05));
            group.add(end);
            const edge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, PLATFORM_LENGTH), trim);
            edge.position.set(side * (width / 2 - 0.1), 0.01, 0);
            group.add(edge);
        }
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, PLATFORM_LENGTH - 0.5), trim);
        stripe.position.y = 0.01;
        group.add(stripe);
        const thrust = new THREE.MeshBasicMaterial({ color: 0x8fe8ff, fog: false });
        for (const sx of [-0.8, 0.8]) for (const sz of [-0.7, 0.7]) {
            const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.05, 0.3, 12), thrust);
            jet.position.set(sx, -0.38, sz);
            group.add(jet);
        }
        // The group's z is the platform's long side; turn it when the gap runs along x
        if (p.alongX) group.rotation.y = Math.PI / 2;
        this.root.add(group);
        p.object = group;
        this.showPlatform(p);
    }

    // Jungle World: a river of rushing blue water below the gap, flowing across
    // the path, with muddy banks down to it and fish that jump now and then
    createRiver(p) {
        const g = p.gap;
        const cx = (g.minX + g.maxX) / 2;
        const cz = (g.minZ + g.maxZ) / 2;
        const waterY = -1.2;
        const map = waterTexture();
        // The plane reaches well past the gap so its edges never show
        const sizeX = g.maxX - g.minX + 6;
        const sizeZ = g.maxZ - g.minZ + 6;
        map.repeat.set(sizeX / 3, sizeZ / 3);
        const water = new THREE.Mesh(new THREE.PlaneGeometry(sizeX, sizeZ), new THREE.MeshBasicMaterial({ map }));
        water.rotation.x = -Math.PI / 2;
        water.position.set(cx, waterY, cz);
        this.root.add(water);
        // The streaks run along v; turn the texture so the water flows across the path
        if (!p.alongX) {
            map.center.set(0.5, 0.5);
            map.rotation = Math.PI / 2;
        }
        // Muddy banks round the gap, from the floor down to the water
        const mud = new THREE.MeshStandardMaterial({ color: 0x4e3020, roughness: 1 });
        const depth = -waterY - 0.2;
        for (const [w, d, x, z] of [
            [g.maxX - g.minX, 0.05, cx, g.minZ], [g.maxX - g.minX, 0.05, cx, g.maxZ],
            [0.05, g.maxZ - g.minZ, g.minX, cz], [0.05, g.maxZ - g.minZ, g.maxX, cz],
        ]) {
            // Only the two banks along the path's sides would show the river ending; keep them all for a tidy trench
            const bank = new THREE.Mesh(new THREE.BoxGeometry(w, depth, d), mud);
            bank.position.set(x, -0.2 - depth / 2, z);
            this.root.add(bank);
        }
        // Mossy edges where the path drops away
        const moss = new THREE.MeshStandardMaterial({ color: 0x33691e, roughness: 1 });
        const width = p.alongX ? g.maxZ - g.minZ : g.maxX - g.minX;
        for (const end of [0, p.span]) {
            const strip = new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, 0.14), moss);
            if (p.alongX) {
                strip.rotation.y = Math.PI / 2;
                strip.position.set(g.minX + end + (end ? 0.07 : -0.07), 0.02, cz);
            } else {
                strip.position.set(cx, 0.02, g.minZ + end + (end ? 0.07 : -0.07));
            }
            this.root.add(strip);
        }
        const fish = [0xff7043, 0xffca28, 0xb0bec5].map((color) => this.makeFish(color));
        // The streaks run along the texture's v whichever way it's turned, so it always scrolls along v
        p.river = { map, flowAxis: 'y', waterY, fish };
    }

    makeFish(color) {
        const group = new THREE.Group();
        const material = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.2 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.25, 14, 10), material);
        body.scale.set(1.6, 0.8, 0.6);
        const tail = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.3, 8), material);
        tail.rotation.z = Math.PI / 2;
        tail.position.x = -0.48;
        group.add(body, tail);
        group.visible = false;
        this.root.add(group);
        return { object: group, wait: 0.5 + Math.random() * 3, t: 0, dur: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), peak: 0 };
    }

    // A fish waits in the water, then jumps in an arc across the river and
    // splashes back down. It stays clear of the leaf. Just to look at.
    updateFish(fish, p, dt) {
        const g = p.gap;
        if (fish.dur === 0) {
            fish.wait -= dt;
            if (fish.wait > 0) return;
            // Somewhere along the gap that the leaf isn't over
            let along;
            for (let tries = 0; tries < 6; tries++) {
                along = 0.5 + Math.random() * (p.span - 1);
                if (along < p.at - 0.4 || along > p.at + PLATFORM_LENGTH + 0.4) break;
                along = null;
            }
            if (along === null) {
                fish.wait = 0.5;
                return;
            }
            const width = p.alongX ? g.maxZ - g.minZ : g.maxX - g.minX;
            const across = 0.3 + Math.random() * (width - 0.6);
            const dir = Math.random() < 0.5 ? -1 : 1;
            const at = (a, c) => (p.alongX ? new THREE.Vector3(g.minX + a, p.river.waterY, g.minZ + c) : new THREE.Vector3(g.minX + c, p.river.waterY, g.minZ + a));
            fish.from.copy(at(along, across - dir * 0.7));
            fish.to.copy(at(along, across + dir * 0.7));
            fish.dur = 0.9 + Math.random() * 0.4;
            fish.t = 0;
            fish.peak = 0.9 + Math.random() * 0.8;
            fish.object.visible = true;
        }
        fish.t += dt;
        const k = Math.min(1, fish.t / fish.dur);
        const pos = fish.from.clone().lerp(fish.to, k);
        pos.y += Math.sin(k * Math.PI) * fish.peak;
        fish.object.position.copy(pos);
        // Point along the arc: nose up on the way out, down on the way back in
        const heading = fish.to.clone().sub(fish.from).normalize();
        fish.object.rotation.set(0, Math.atan2(-heading.z, heading.x), Math.cos(k * Math.PI) * 0.9);
        if (k >= 1) {
            fish.dur = 0;
            fish.wait = 1 + Math.random() * 3;
            fish.object.visible = false;
        }
    }

    // Jungle World's platform: a giant green leaf with a pale middle vein and side veins
    createLeaf(p) {
        const g = p.gap;
        const width = p.alongX ? g.maxZ - g.minZ : g.maxX - g.minX;
        const group = new THREE.Group();
        const outline = new THREE.Shape();
        outline.absellipse(0, 0, (width - 0.05) / 2, PLATFORM_LENGTH / 2 + 0.15, 0, Math.PI * 2, false, 0);
        const geometry = new THREE.ExtrudeGeometry(outline, { depth: 0.12, bevelEnabled: false });
        geometry.rotateX(Math.PI / 2);
        const leaf = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x43a047, roughness: 0.6, emissive: 0x1b5e20, emissiveIntensity: 0.35 }));
        leaf.position.y = 0.02;
        leaf.receiveShadow = true;
        group.add(leaf);
        const vein = new THREE.MeshStandardMaterial({ color: 0xc5e1a5, roughness: 0.7 });
        const mid = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, PLATFORM_LENGTH + 0.1), vein);
        mid.position.y = 0.035;
        group.add(mid);
        for (const z of [-0.8, -0.3, 0.2, 0.7]) {
            for (const side of [-1, 1]) {
                const v = new THREE.Mesh(new THREE.BoxGeometry(width * 0.38, 0.025, 0.05), vein);
                v.position.set(side * width * 0.19, 0.035, z + 0.15);
                v.rotation.y = side * 0.5;
                group.add(v);
            }
        }
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0x558b2f }));
        stem.rotation.x = Math.PI / 2;
        stem.position.set(0, 0.02, PLATFORM_LENGTH / 2 + 0.35);
        group.add(stem);
        if (p.alongX) group.rotation.y = Math.PI / 2;
        this.root.add(group);
        p.object = group;
    }

    showPlatform(p) {
        if (!p?.object) return;
        const g = p.gap;
        const middle = p.at + PLATFORM_LENGTH / 2;
        if (p.alongX) p.object.position.set(g.minX + middle, 0, (g.minZ + g.maxZ) / 2);
        else p.object.position.set((g.minX + g.maxX) / 2, 0, g.minZ + middle);
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
        if (this.spike2Position && Math.hypot(point.x - this.spike2Position.x, point.z - this.spike2Position.z) < this.spike2Radius + margin) return true;
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
