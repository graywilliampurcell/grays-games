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

// A maze built from a fixed layout (see js/levels.js).
// Block (x, z) spans [x, x+1) x [z, z+1) in the world.
export class Maze {
    constructor(scene, layout, theme = DEFAULT_THEME, { wallHeight = 4 } = {}) {
        this.scene = scene;
        this.theme = theme;
        // Everything this maze adds to the scene, so it can be taken away again
        this.root = new THREE.Group();
        this.height = wallHeight;
        this.depth = layout.length;
        this.width = layout[0].length;

        // grid[x][z]: 1 = wall, 0 = floor
        this.grid = [];
        for (let x = 0; x < this.width; x++) {
            this.grid[x] = [];
            for (let z = 0; z < this.depth; z++) {
                const ch = layout[z][x];
                this.grid[x][z] = ch === '#' || ch === 'D' ? 1 : 0;
                const center = new THREE.Vector3(x + 0.5, 0, z + 0.5);
                if (ch === 'S') this.startPosition = center;
                if (ch === 'X') this.spikePosition = center;
                if (ch === 'D') this.doorBlock = { x, z };
            }
        }

        // Collision data: [x][z][y], same wall value at every height
        this.mazeData = this.grid.map((col) => col.map((v) => new Array(this.height).fill(v)));
    }

    build() {
        this.renderMaze();
        this.createDoor();
        this.createSpike();
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
        const wallMaterial = fluffy
            ? new THREE.MeshStandardMaterial({ map: fluffTexture(this.theme.wall, 128, 512, 7), roughness: 1, emissive: this.theme.wall, emissiveIntensity: 0.15 })
            : new THREE.MeshStandardMaterial({ color: this.theme.wall });
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
        if (fluffy) {
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
            new THREE.MeshStandardMaterial({ color: 0x3b2410 })
        );
        frame.position.set(0, (doorHeight + 0.15) / 2, 0.02);
        door.add(frame);

        const panel = new THREE.Mesh(
            new THREE.BoxGeometry(doorWidth, doorHeight, 0.12),
            new THREE.MeshStandardMaterial({ color: 0x7a4a22, roughness: 0.8 })
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

        const coneGeometry = new THREE.ConeGeometry(0.12, 0.6, 10);
        const offsets = [[0, 0], [0.35, 0.2], [-0.35, 0.2], [0.2, -0.35], [-0.2, -0.35], [0, 0.42]];
        for (const [ox, oz] of offsets) {
            const cone = new THREE.Mesh(coneGeometry, metal);
            cone.position.set(ox, 0.38, oz);
            cone.castShadow = true;
            spike.add(cone);
        }

        spike.position.copy(this.spikePosition);
        this.root.add(spike);
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
