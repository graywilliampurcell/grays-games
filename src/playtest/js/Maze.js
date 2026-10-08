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

// Underwater World walls: a colorful coral reef. Lumpy blobs and branching
// fingers of coral in pink, orange, purple and yellow over a warm base.
function coralTexture(width, height, seed) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext('2d');
    g.fillStyle = '#e8665a';
    g.fillRect(0, 0, width, height);
    let r = seed;
    const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    const colors = ['#ff6f91', '#ff9a3c', '#b45cd6', '#ffd23f', '#ff5e5e', '#f78fb3', '#ff8a65', '#9c6ade'];
    // Lumpy brain-coral blobs with a darker groove pattern
    for (let i = 0; i < 70; i++) {
        const x = random() * width;
        const y = random() * height;
        const size = 8 + random() * 18;
        g.fillStyle = colors[Math.floor(random() * colors.length)];
        g.beginPath();
        g.ellipse(x, y, size, size * (0.7 + random() * 0.5), random() * Math.PI, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = 'rgba(90,20,40,0.35)';
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(x, y, size * 0.55, random() * 3, random() * 3 + 3);
        g.stroke();
    }
    // Branching coral fingers growing up
    for (let i = 0; i < 26; i++) {
        let x = random() * width;
        let y = height * (0.3 + random() * 0.7);
        g.strokeStyle = colors[Math.floor(random() * colors.length)];
        g.lineCap = 'round';
        const branch = (bx, by, len, angle, w) => {
            if (len < 4) return;
            const ex = bx + Math.cos(angle) * len;
            const ey = by - Math.sin(angle) * len;
            g.lineWidth = w;
            g.beginPath();
            g.moveTo(bx, by);
            g.lineTo(ex, ey);
            g.stroke();
            branch(ex, ey, len * 0.7, angle + 0.5, w * 0.75);
            branch(ex, ey, len * 0.7, angle - 0.5, w * 0.75);
        };
        branch(x, y, 14 + random() * 12, Math.PI / 2, 5);
    }
    // Little bright polyps dotted all over
    for (let i = 0; i < 260; i++) {
        g.fillStyle = `rgba(255,${200 + Math.floor(random() * 55)},${150 + Math.floor(random() * 100)},0.8)`;
        g.beginPath();
        g.arc(random() * width, random() * height, 1 + random() * 1.5, 0, Math.PI * 2);
        g.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// Underwater World floor: soft white sand with ripples, seashells and starfish
function sandTexture(size, seed) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const g = canvas.getContext('2d');
    g.fillStyle = '#f2e6c9';
    g.fillRect(0, 0, size, size);
    let r = seed;
    const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < size * size / 10; i++) {
        const shade = 215 + Math.floor(random() * 35);
        g.fillStyle = `rgba(${shade},${shade - 12},${shade - 40},0.5)`;
        g.fillRect(random() * size, random() * size, 1 + random() * 1.5, 1 + random() * 1.5);
    }
    // Soft ripples in the sand
    g.strokeStyle = 'rgba(200,180,140,0.35)';
    g.lineWidth = 2;
    for (let y = 8; y < size; y += 22) {
        g.beginPath();
        for (let x = 0; x <= size; x += 8) g.lineTo(x, y + Math.sin((x / size) * Math.PI * 4 + y) * 4);
        g.stroke();
    }
    // Seashells: little fans with ridges
    for (let i = 0; i < 5; i++) {
        const x = 16 + random() * (size - 32);
        const y = 16 + random() * (size - 32);
        g.save();
        g.translate(x, y);
        g.rotate(random() * Math.PI * 2);
        g.fillStyle = ['#fff4ea', '#ffd9c7', '#f7c6d9'][i % 3];
        g.beginPath();
        g.moveTo(0, 6);
        g.arc(0, 0, 9, Math.PI * 1.1, Math.PI * 1.9);
        g.closePath();
        g.fill();
        g.strokeStyle = 'rgba(170,110,90,0.7)';
        g.lineWidth = 1;
        for (let k = -3; k <= 3; k++) {
            g.beginPath();
            g.moveTo(0, 6);
            g.lineTo(Math.sin(k * 0.3) * 9, -Math.cos(k * 0.3) * 9);
            g.stroke();
        }
        g.restore();
    }
    // Starfish: orange and red five-armed stars
    for (let i = 0; i < 3; i++) {
        const x = 20 + random() * (size - 40);
        const y = 20 + random() * (size - 40);
        const turn = random() * Math.PI;
        g.fillStyle = i % 2 ? '#ff7043' : '#e53935';
        g.beginPath();
        for (let k = 0; k < 10; k++) {
            const rad = k % 2 ? 4 : 12;
            const a = turn + (k * Math.PI) / 5;
            g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
        }
        g.closePath();
        g.fill();
        g.fillStyle = 'rgba(255,230,180,0.8)';
        for (let k = 0; k < 5; k++) {
            const a = turn + (k * 2 * Math.PI) / 5;
            g.beginPath();
            g.arc(x + Math.cos(a) * 6, y + Math.sin(a) * 6, 1, 0, Math.PI * 2);
            g.fill();
        }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// A water current's floor: streaks of swirling sand, drawn along +x (the push
// direction); the texture scrolls so the streaks rush the way it pushes
function currentTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const g = canvas.getContext('2d');
    g.clearRect(0, 0, 128, 128);
    let r = 5;
    const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 26; i++) {
        const x = random() * 128;
        const y = random() * 128;
        const len = 20 + random() * 30;
        g.strokeStyle = `rgba(${random() < 0.5 ? '255,255,255' : '214,196,150'},${0.45 + random() * 0.4})`;
        g.lineWidth = 1.5 + random() * 2;
        g.beginPath();
        g.moveTo(x, y);
        g.bezierCurveTo(x + len * 0.3, y - 6, x + len * 0.6, y + 6, x + len, y);
        g.stroke();
    }
    // Chevrons pointing the way it pushes
    g.strokeStyle = 'rgba(255,255,255,0.75)';
    g.lineWidth = 4;
    for (const y of [32, 96]) {
        g.beginPath();
        g.moveTo(52, y - 14);
        g.lineTo(70, y);
        g.lineTo(52, y + 14);
        g.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// Moon World walls: shiny metal panels with seams, rivets and a glowing blue
// light strip, like the inside of a secret high-tech base
function moonWallTexture(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext('2d');
    const shine = g.createLinearGradient(0, 0, width, 0);
    shine.addColorStop(0, '#8d97a3');
    shine.addColorStop(0.35, '#dfe5ec');
    shine.addColorStop(0.55, '#b6bfca');
    shine.addColorStop(1, '#7f8893');
    g.fillStyle = shine;
    g.fillRect(0, 0, width, height);
    // Fine brushed-metal streaks
    let r = 11;
    const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < height; i += 2) {
        g.fillStyle = `rgba(255,255,255,${random() * 0.08})`;
        g.fillRect(0, i, width, 1);
    }
    // Panels: seams and rivets
    const panel = height / 4;
    for (let p = 0; p < 4; p++) {
        const y = p * panel;
        g.strokeStyle = '#4e5660';
        g.lineWidth = 3;
        g.strokeRect(2, y + 2, width - 4, panel - 4);
        g.fillStyle = '#eef2f6';
        for (const [rx, ry] of [[9, 9], [width - 9, 9], [9, panel - 9], [width - 9, panel - 9]]) {
            g.beginPath();
            g.arc(rx, y + ry, 2.5, 0, Math.PI * 2);
            g.fill();
        }
    }
    // A glowing blue light strip along each panel's top
    g.fillStyle = '#5fd0ff';
    for (let p = 0; p < 4; p += 2) g.fillRect(14, p * panel + 16, width - 28, 4);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// Moon World floor: gray moon dust, speckled, with boot footprints here and there
function moonDustTexture(size, seed) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const g = canvas.getContext('2d');
    g.fillStyle = '#7f7f82';
    g.fillRect(0, 0, size, size);
    let r = seed;
    const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < size * size / 8; i++) {
        const shade = 100 + Math.floor(random() * 60);
        g.fillStyle = `rgba(${shade},${shade},${shade + 3},0.5)`;
        g.fillRect(random() * size, random() * size, 1 + random() * 2, 1 + random() * 2);
    }
    // Footprints: a few trails of left-right boot prints
    for (let trail = 0; trail < 3; trail++) {
        let x = random() * size;
        let y = random() * size;
        const angle = random() * Math.PI * 2;
        for (let step = 0; step < 5; step++) {
            const side = step % 2 ? 1 : -1;
            const px = x + Math.cos(angle + Math.PI / 2) * side * 5;
            const py = y + Math.sin(angle + Math.PI / 2) * side * 5;
            g.save();
            g.translate(((px % size) + size) % size, ((py % size) + size) % size);
            g.rotate(angle + Math.PI / 2);
            g.fillStyle = 'rgba(70,70,74,0.55)';
            g.beginPath();
            g.ellipse(0, -3, 4, 6, 0, 0, Math.PI * 2);
            g.ellipse(0, 7, 3.2, 3.5, 0, 0, Math.PI * 2);
            g.fill();
            g.strokeStyle = 'rgba(50,50,54,0.5)';
            g.lineWidth = 1;
            for (let k = -6; k <= 6; k += 3) {
                g.beginPath();
                g.moveTo(-3, k * 0.6 - 3);
                g.lineTo(3, k * 0.6 - 3);
                g.stroke();
            }
            g.restore();
            x += Math.cos(angle) * 16;
            y += Math.sin(angle) * 16;
        }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// A crater seen from above: dark in the middle, shading out to the dust
function craterTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const g = canvas.getContext('2d');
    const hole = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    hole.addColorStop(0, '#0b0b0d');
    hole.addColorStop(0.45, '#1e1e22');
    hole.addColorStop(0.8, '#55555a');
    hole.addColorStop(1, '#7c7c80');
    g.fillStyle = hole;
    g.beginPath();
    g.arc(64, 64, 64, 0, Math.PI * 2);
    g.fill();
    return new THREE.CanvasTexture(canvas);
}

// Rough gray rock for a giant crater's sides and bottom
function rockTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const g = canvas.getContext('2d');
    g.fillStyle = '#6e6e73';
    g.fillRect(0, 0, 128, 128);
    let r = 77;
    const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 160; k++) {
        const v = 70 + Math.floor(random() * 70);
        g.fillStyle = `rgb(${v},${v},${v + 4})`;
        g.beginPath();
        g.ellipse(random() * 128, random() * 128, 2 + random() * 9, 1 + random() * 5, random() * Math.PI, 0, Math.PI * 2);
        g.fill();
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
// Underwater World's ride (Level 42 on): a giant clear bubble over a zigzag
// crack. It's solid until you get in: push into its side (hold walk toward
// it) for this long in all, and you're inside. Stopping early keeps the time
// pushed so far; only being sent back to the start clears it.
const BUBBLE_PUSH_TIME = 2.0;
const BUBBLE_RADIUS = 1.4; // about the corridor's width (3)
// How far the crack's zigzag ends reach in from the gap's ends, so the floor
// before and after the crack is always solid
const CRACK_TOOTH = 0.7;

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
        // A water current ('W' blocks, one corridor cell; Level 41) and where its shove ends ('V')
        const currentBlocks = [];
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
                if (ch === 'W') currentBlocks.push({ x, z });
                if (ch === 'V') this.currentTarget = center;
            }
        }
        if (currentBlocks.length && this.currentTarget) {
            const xs = currentBlocks.map((b) => b.x);
            const zs = currentBlocks.map((b) => b.z);
            const c = {
                minX: Math.min(...xs), maxX: Math.max(...xs) + 1,
                minZ: Math.min(...zs), maxZ: Math.max(...zs) + 1,
            };
            c.center = new THREE.Vector3((c.minX + c.maxX) / 2, 0, (c.minZ + c.maxZ) / 2);
            // Which way it pushes: straight from its middle toward the target
            const d = this.currentTarget.clone().sub(c.center);
            c.dir = Math.abs(d.x) > Math.abs(d.z) ? new THREE.Vector3(Math.sign(d.x), 0, 0) : new THREE.Vector3(0, 0, Math.sign(d.z));
            c.target = this.currentTarget.clone();
            this.current = c;
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
        if (this.current) this.createCurrent();
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
        const moon = this.theme.moon;
        const underwater = this.theme.underwater;
        let wallMaterial;
        if (underwater) {
            wallMaterial = new THREE.MeshStandardMaterial({ map: coralTexture(128, 512, 29), roughness: 0.85, emissive: 0x401018, emissiveIntensity: 0.35 });
        } else if (moon) {
            wallMaterial = new THREE.MeshStandardMaterial({ map: moonWallTexture(128, 512), roughness: 0.3, metalness: 0.45, emissive: 0x1a2430, emissiveIntensity: 0.6 });
        } else if (jungle) {
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
        if (underwater) this.addCoralTops(count);

        // Floor
        let floorMaterial;
        if (underwater) {
            const map = sandTexture(256, 41);
            map.repeat.set(this.width / 6, this.depth / 6);
            floorMaterial = new THREE.MeshStandardMaterial({ map, roughness: 1 });
        } else if (moon) {
            const map = moonDustTexture(256, 23);
            map.repeat.set(this.width / 6, this.depth / 6);
            floorMaterial = new THREE.MeshStandardMaterial({ map, roughness: 1 });
        } else if (jungle) {
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
            for (const { gap: g, crack } of this.platforms) {
                // Underwater World's crack has zigzag ends
                if (crack) {
                    outline.holes.push(new THREE.Path(crack));
                    continue;
                }
                outline.holes.push(new THREE.Path([new THREE.Vector2(g.minX, g.minZ), new THREE.Vector2(g.minX, g.maxZ), new THREE.Vector2(g.maxX, g.maxZ), new THREE.Vector2(g.maxX, g.minZ)]));
            }
            const geometry = new THREE.ExtrudeGeometry(outline, { depth: 0.2, bevelEnabled: false });
            geometry.rotateX(Math.PI / 2);
            floorMaterial.map?.repeat.set(0.5, 0.5);
            // The gap's edges (the floor's cut sides) are dark, so they don't look like a ledge
            floor = new THREE.Mesh(geometry, [floorMaterial, new THREE.MeshBasicMaterial({ color: jungle ? 0x3b2414 : moon ? 0x4a4a4f : underwater ? 0x6b5a3e : 0x0b0e18 })]);
        } else {
            const floorGeometry = new THREE.BoxGeometry(this.width, 0.2, this.depth);
            floor = new THREE.Mesh(floorGeometry, floorMaterial);
            floor.position.set(this.width / 2, -0.1, this.depth / 2);
        }
        floor.receiveShadow = true;
        this.root.add(floor);

        if (space) this.addSpaceSky();
        if (jungle) this.addJungleSky();
        if (moon) {
            this.addMoonSky();
            this.addCameras();
        }
        if (underwater) this.addSeaLife();
    }

    // Underwater World: knobbly coral growing along the tops of the walls, in
    // all the reef's colors
    addCoralTops(wallCount) {
        const colors = [0xff6f91, 0xff9a3c, 0xb45cd6, 0xffd23f, 0xff5e5e, 0x4dd0e1];
        const material = new THREE.MeshStandardMaterial({ roughness: 0.8 });
        const knobs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), material, wallCount);
        const matrix = new THREE.Matrix4();
        const color = new THREE.Color();
        let r = 13;
        const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
        let n = 0;
        for (let x = 0; x < this.width; x++) {
            for (let z = 0; z < this.depth; z++) {
                if (this.grid[x][z] !== 1) continue;
                const size = 0.4 + random() * 0.25;
                matrix.makeScale(size, size * (0.8 + random() * 0.8), size);
                matrix.setPosition(x + 0.5 + (random() - 0.5) * 0.3, this.height + size * 0.3, z + 0.5 + (random() - 0.5) * 0.3);
                knobs.setMatrixAt(n, matrix);
                knobs.setColorAt(n++, color.setHex(colors[Math.floor(random() * colors.length)]));
            }
        }
        this.root.add(knobs);
    }

    // Underwater World: open water above, with big gentle animals (turtles,
    // whales, manta rays) and schools of little colorful fish swimming by.
    // Just to look at: no dangers. Sunbeams shimmer down from the surface.
    addSeaLife() {
        const cx = this.width / 2;
        const cz = this.depth / 2;
        // Bright surface far above, so looking up feels like being under the sea
        const surface = new THREE.Mesh(
            new THREE.PlaneGeometry(900, 900),
            new THREE.MeshBasicMaterial({ map: waterTexture(), color: 0x9fe3ff, transparent: true, opacity: 0.55, fog: false, side: THREE.DoubleSide })
        );
        surface.material.map.repeat.set(30, 30);
        surface.rotation.x = Math.PI / 2;
        surface.position.set(cx, 120, cz);
        this.root.add(surface);
        this.surface = surface;
        this.flyers = [];
        const kinds = ['turtle', 'school', 'whale', 'manta', 'school', 'turtle', 'manta', 'school'];
        kinds.forEach((kind, k) => {
            const flyer = this.makeSeaAnimal(kind);
            this.root.add(flyer.object);
            this.flyers.push(flyer);
            this.launchFlyer(flyer, k / kinds.length);
        });
    }

    // One sea animal, modelled swimming along +x. Fins and tails flap in update.
    makeSeaAnimal(kind) {
        const group = new THREE.Group();
        const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
        const wings = [];
        if (kind === 'turtle') {
            const shell = new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 10), mat(0x5d8a3a));
            shell.scale.set(1.2, 0.45, 1);
            const belly = new THREE.Mesh(new THREE.SphereGeometry(1.3, 14, 8), mat(0xd8c98a));
            belly.scale.set(1.15, 0.25, 0.95);
            belly.position.y = -0.2;
            const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 8), mat(0x8fb35a));
            head.position.set(2, 0, 0);
            group.add(shell, belly, head);
            for (const side of [-1, 1]) {
                for (const front of [true, false]) {
                    const pivot = new THREE.Group();
                    pivot.position.set(front ? 0.9 : -1, -0.1, side * 0.9);
                    const flipper = new THREE.Mesh(new THREE.BoxGeometry(front ? 0.7 : 0.5, 0.1, front ? 1.4 : 0.8), mat(0x8fb35a));
                    flipper.position.z = side * (front ? 0.7 : 0.4);
                    pivot.add(flipper);
                    pivot.userData.side = side;
                    group.add(pivot);
                    wings.push(pivot);
                }
            }
        } else if (kind === 'whale') {
            const body = new THREE.Mesh(new THREE.SphereGeometry(3, 20, 14), mat(0x3d5a80));
            body.scale.set(2.4, 0.9, 1);
            const belly = new THREE.Mesh(new THREE.SphereGeometry(2.8, 18, 10), mat(0xc9d6e3));
            belly.scale.set(2.2, 0.6, 0.85);
            belly.position.y = -0.8;
            const tail = new THREE.Group();
            tail.position.x = -6.8;
            const fluke = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.25, 4.2), mat(0x3d5a80));
            fluke.position.x = -0.8;
            tail.add(fluke);
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), mat(0x111111));
            eye.position.set(5.2, 0.2, 1.6);
            group.add(body, belly, tail, eye);
            tail.userData.whaleTail = true;
            wings.push(tail);
        } else if (kind === 'manta') {
            const body = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), mat(0x263238));
            body.scale.set(1.6, 0.3, 1);
            group.add(body);
            for (const side of [-1, 1]) {
                const pivot = new THREE.Group();
                pivot.position.z = side * 0.8;
                const wing = new THREE.Mesh(new THREE.ConeGeometry(1.5, 3.2, 3), mat(0x37474f));
                wing.rotation.x = side * Math.PI / 2;
                wing.scale.set(1, 1, 0.12);
                wing.position.z = side * 1.5;
                pivot.add(wing);
                pivot.userData.side = side;
                group.add(pivot);
                wings.push(pivot);
            }
            const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.02, 3, 6), mat(0x263238));
            tail.rotation.z = Math.PI / 2;
            tail.position.x = -2.8;
            group.add(tail);
            group.scale.setScalar(1.4);
        } else {
            // A school of little colorful fish swimming together
            const colors = [0xffd23f, 0xff6f3c, 0x4dd0e1, 0xff5e9c, 0x7cff6b];
            const color = colors[Math.floor(Math.random() * colors.length)];
            for (let k = 0; k < 14; k++) {
                const fish = new THREE.Group();
                const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 6), new THREE.MeshBasicMaterial({ color }));
                body.scale.set(1.6, 0.8, 0.5);
                const tail = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.35, 4), new THREE.MeshBasicMaterial({ color }));
                tail.rotation.z = Math.PI / 2;
                tail.position.x = -0.6;
                fish.add(body, tail);
                fish.position.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 2.5, (Math.random() - 0.5) * 4);
                group.add(fish);
            }
        }
        const object = new THREE.Group();
        object.add(group);
        return { kind, object, velocity: new THREE.Vector3(), life: 0, wings, flap: Math.random() * 6 };
    }

    // Moon World sky: black, full of stars, with the Earth hanging big and blue
    // (it stays put, so which side it's on depends on where you look)
    addMoonSky() {
        const cx = this.width / 2;
        const cz = this.depth / 2;
        const positions = [];
        let r = 101;
        const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
        for (let i = 0; i < 1500; i++) {
            // Points on the upper part of a big sphere round the maze
            const a = random() * Math.PI * 2;
            const y = 0.05 + random() * 0.95;
            const flat = Math.sqrt(1 - y * y);
            positions.push(cx + Math.cos(a) * flat * 400, y * 400, cz + Math.sin(a) * flat * 400);
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        const stars = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false }));
        this.root.add(stars);
        const earth = new THREE.Mesh(
            new THREE.SphereGeometry(75, 40, 24),
            new THREE.MeshBasicMaterial({ map: planetTexture('#2f6fd6', ['#3fa34d', '#57b85f', '#e8eef5', '#2a8a3d', '#e8eef5'], 9), fog: false })
        );
        earth.position.set(cx - 170, 150, cz - 230);
        this.root.add(earth);
        // A soft blue glow round the Earth
        const glow = new THREE.Mesh(
            new THREE.SphereGeometry(82, 32, 20),
            new THREE.MeshBasicMaterial({ color: 0x6fb6ff, transparent: true, opacity: 0.18, fog: false, side: THREE.BackSide })
        );
        glow.position.copy(earth.position);
        this.root.add(glow);
    }

    // Moon World: security cameras high on the walls, turning slowly side to
    // side as if they're watching the player. Decoration only, no danger.
    addCameras() {
        this.cameras = [];
        const body = new THREE.MeshStandardMaterial({ color: 0xf2f4f7, metalness: 0.3, roughness: 0.35 });
        const dark = new THREE.MeshStandardMaterial({ color: 0x2b2f36, metalness: 0.5, roughness: 0.4 });
        const lens = new THREE.MeshStandardMaterial({ color: 0x0d1a2a, emissive: 0x2a6cff, emissiveIntensity: 0.6, roughness: 0.1 });
        const led = new THREE.MeshBasicMaterial({ color: 0xff3030 });
        let r = 7;
        const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
        const isWall = (x, z) => this.grid[x]?.[z] !== 0;
        // Look at the middle of each corridor cell (4 blocks apart, middle at 2)
        // and put a camera on some of the walls right next to it
        for (let x = 2; x < this.width - 1; x += 4) {
            for (let z = 2; z < this.depth - 1; z += 4) {
                if (isWall(x, z)) continue;
                const sides = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dz]) => isWall(x + 2 * dx, z + 2 * dz) && !isWall(x + dx, z + dz));
                if (sides.length === 0 || random() > 0.4) continue;
                const [dx, dz] = sides[Math.floor(random() * sides.length)];
                const mount = new THREE.Group();
                // On the wall's face, facing into the corridor
                mount.position.set(x + 0.5 + dx * 1.5, this.height - 0.7, z + 0.5 + dz * 1.5);
                mount.rotation.y = Math.atan2(-dx, -dz);
                const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.2), dark);
                bracket.position.z = 0.1;
                mount.add(bracket);
                const pivot = new THREE.Group();
                pivot.position.z = 0.25;
                const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 8), dark);
                arm.rotation.x = Math.PI / 2;
                pivot.add(arm);
                const head = new THREE.Group();
                head.position.set(0, -0.08, 0.2);
                head.rotation.x = 0.35; // tilted down toward the floor
                const box = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.55), body);
                const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 16), lens);
                eye.rotation.x = Math.PI / 2;
                eye.position.z = 0.29;
                const light = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), led);
                light.position.set(0.09, 0.13, 0.22);
                head.add(box, eye, light);
                pivot.add(head);
                mount.add(pivot);
                this.root.add(mount);
                this.cameras.push({ pivot, light, phase: random() * Math.PI * 2, speed: 0.5 + random() * 0.3, time: 0 });
            }
        }
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
        const speeds = { rocket: 14, comet: 18, meteor: 26, parrot: 11, toucan: 9, butterfly: 4, turtle: 3, whale: 4, manta: 5, school: 6 };
        const speed = speeds[flyer.kind];
        // Sea animals swim slowly over the reef, not too high (Underwater World)
        const bird = ['parrot', 'toucan', 'turtle', 'whale', 'manta', 'school'].includes(flyer.kind);
        const butterfly = flyer.kind === 'butterfly';
        const span = butterfly ? 70 : bird ? 160 : 260;
        const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
        const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar((Math.random() - 0.5) * (butterfly ? 30 : bird ? 60 : 120));
        const height = flyer.kind === 'whale' ? 26 + Math.random() * 10 : butterfly ? 6 + Math.random() * 5 : bird ? 10 + Math.random() * 14 : 30 + Math.random() * 45;
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
        for (const cam of this.cameras || []) {
            cam.time += dt;
            cam.pivot.rotation.y = Math.sin(cam.time * cam.speed + cam.phase) * 0.7;
            cam.light.visible = (cam.time + cam.phase) % 1.2 < 0.6;
        }
        for (const flyer of this.flyers || []) {
            flyer.object.position.addScaledVector(flyer.velocity, dt);
            // Birds and butterflies flap their wings (butterflies quicker, with a flutter)
            if (flyer.wings) {
                const butterfly = flyer.kind === 'butterfly';
                flyer.flap += dt * (butterfly ? 14 : 7);
                const sea = ['turtle', 'whale', 'manta'].includes(flyer.kind);
                if (sea) flyer.flap -= dt * 4.5; // slow, gentle strokes
                for (const wing of flyer.wings) {
                    if (wing.userData.whaleTail) wing.rotation.z = Math.sin(flyer.flap) * 0.3;
                    else wing.rotation.x = wing.userData.side * Math.sin(flyer.flap) * (butterfly ? 0.9 : sea ? 0.45 : 0.6);
                }
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
        if (this.surface) this.surface.material.map.offset.x += dt * 0.02;
        if (this.current?.streaks) this.updateCurrent(dt);
        for (const p of this.platforms) {
            // Anglerfish lights drifting far down in the crack
            for (const fish of p.anglers || []) {
                fish.time += dt;
                fish.object.position.set(fish.x + Math.sin(fish.time * fish.speed) * fish.range, fish.y + Math.sin(fish.time * 0.7 + fish.phase) * 0.6, fish.z);
                fish.glow.material.opacity = 0.35 + 0.25 * Math.sin(fish.time * 2.1 + fish.phase);
            }
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
        if (this.theme.moon) return this.createCrater(position, radius);
        if (this.theme.underwater) return this.createUrchin(position, radius);
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

    // Underwater World's spike: a spiky purple sea urchin, as wide as a spike's
    // plate. Touching it works the same as a spike.
    createUrchin(position, radius) {
        const urchin = new THREE.Group();
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 18, 12), new THREE.MeshStandardMaterial({ color: 0x5b1f8a, roughness: 0.6, emissive: 0x2a0844, emissiveIntensity: 0.4 }));
        body.scale.y = 0.8;
        body.position.y = 0.3;
        body.castShadow = true;
        urchin.add(body);
        const spine = new THREE.MeshStandardMaterial({ color: 0x9b4fd6, roughness: 0.4, emissive: 0x3a0f66, emissiveIntensity: 0.5 });
        const spineGeometry = new THREE.ConeGeometry(0.03, 0.55, 5);
        // Spines poking out all over, evenly spread (a golden-angle spiral)
        for (let k = 0; k < 70; k++) {
            const y = 1 - (k / 69) * 1.3; // mostly the top and sides, not into the sand
            const flat = Math.sqrt(Math.max(0, 1 - y * y));
            const a = k * 2.39996;
            const dir = new THREE.Vector3(Math.cos(a) * flat, y, Math.sin(a) * flat).normalize();
            const s = new THREE.Mesh(spineGeometry, spine);
            s.position.set(0, 0.3, 0).addScaledVector(dir, 0.27 + 0.27);
            s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
            urchin.add(s);
        }
        urchin.scale.set(radius / SPIKE_RADIUS, 1, radius / SPIKE_RADIUS);
        urchin.position.copy(position);
        urchin.position.y = 0;
        this.root.add(urchin);
    }

    // The water current (Level 41): swirling sand streaks rushing across its
    // cell the way it pushes, and bubbles streaming the same way. Both carry on
    // a little into the side dead end so you can see where it sends you.
    createCurrent() {
        const c = this.current;
        const map = currentTexture();
        const sizeX = c.maxX - c.minX;
        const sizeZ = c.maxZ - c.minZ;
        const streaks = new THREE.Mesh(
            new THREE.PlaneGeometry(1, 1),
            new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false })
        );
        streaks.rotation.x = -Math.PI / 2;
        // The texture's +x is the push direction
        streaks.rotation.z = -Math.atan2(c.dir.z, c.dir.x);
        const alongX = c.dir.x !== 0;
        streaks.scale.set(alongX ? sizeX : sizeZ, alongX ? sizeZ : sizeX, 1);
        streaks.position.set(c.center.x, 0.02, c.center.z);
        this.root.add(streaks);
        c.streaks = streaks;
        // A faint swirl of water over the whole cell
        const haze = new THREE.Mesh(
            new THREE.BoxGeometry(sizeX, this.height * 0.8, sizeZ),
            new THREE.MeshBasicMaterial({ color: 0xbfefff, transparent: true, opacity: 0.12, depthWrite: false })
        );
        haze.position.set(c.center.x, this.height * 0.4, c.center.z);
        this.root.add(haze);
        // Bubbles: each starts somewhere in the cell, streams the push way
        // while rising, and starts again when it's gone a cell and a bit
        c.bubbles = [];
        const bubbleMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, roughness: 0.1, metalness: 0.2, emissive: 0x6fd6ff, emissiveIntensity: 0.3 });
        for (let k = 0; k < 40; k++) {
            const b = new THREE.Mesh(new THREE.SphereGeometry(0.06 + Math.random() * 0.08, 8, 6), bubbleMaterial);
            this.root.add(b);
            const bubble = { mesh: b, t: Math.random() };
            this.placeBubble(bubble);
            c.bubbles.push(bubble);
        }
    }

    placeBubble(bubble) {
        const c = this.current;
        const across = new THREE.Vector3(-c.dir.z, 0, c.dir.x);
        const half = (c.maxX - c.minX) / 2;
        bubble.start = c.center.clone().addScaledVector(c.dir, -half).addScaledVector(across, (Math.random() - 0.5) * 2.6);
        bubble.start.y = 0.1 + Math.random() * 1.2;
        bubble.speed = 3 + Math.random() * 2;
        bubble.wobble = Math.random() * 6;
    }

    updateCurrent(dt) {
        const c = this.current;
        c.streaks.material.map.offset.x -= dt * 1.4; // the streaks rush the way it pushes
        const reach = (c.maxX - c.minX) + 1.5; // across the cell and a bit into the dead end
        for (const b of c.bubbles) {
            b.t += (dt * b.speed) / reach;
            if (b.t >= 1) {
                b.t -= 1;
                this.placeBubble(b);
            }
            b.wobble += dt * 5;
            const across = new THREE.Vector3(-c.dir.z, 0, c.dir.x);
            b.mesh.position.copy(b.start).addScaledVector(c.dir, b.t * reach).addScaledVector(across, Math.sin(b.wobble) * 0.15);
            b.mesh.position.y = b.start.y + b.t * 1.6;
        }
    }

    // Is this point inside the water current's cell?
    inCurrent(point) {
        const c = this.current;
        return !!c && point.x > c.minX && point.x < c.maxX && point.z > c.minZ && point.z < c.maxZ;
    }

    // Did someone walking from `from` into the current come from its dead end
    // (the side it pushes toward)? Then it lets them back out without a shove.
    cameFromCurrentDeadEnd(from) {
        const c = this.current;
        return from.clone().sub(c.center).dot(c.dir) > (c.maxX - c.minX) / 2 - 0.01;
    }

    // Moon World's spike: a small crater in the moon dust, `radius` across from
    // the middle, with a raised dusty rim. Stepping into it works like a spike.
    createCrater(position, radius) {
        const crater = new THREE.Group();
        const hole = new THREE.Mesh(new THREE.CircleGeometry(radius, 40), new THREE.MeshStandardMaterial({ map: craterTexture(), roughness: 1 }));
        hole.rotation.x = -Math.PI / 2;
        hole.position.y = 0.012;
        hole.receiveShadow = true;
        crater.add(hole);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, Math.min(0.14, radius * 0.18), 10, 40), new THREE.MeshStandardMaterial({ color: 0x88888c, roughness: 1 }));
        rim.rotation.x = -Math.PI / 2;
        rim.scale.z = 0.6; // a low rim (z is up once it's turned flat)
        rim.castShadow = true;
        crater.add(rim);
        crater.position.copy(position);
        crater.position.y = 0;
        this.root.add(crater);
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
        if (this.theme.moon) return this.createBigCrater(row);
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

    // Moon World's spike row (Level 33): a big crater right across the
    // corridor, as wide as the corridor and as deep as a spike row, with a
    // raised dusty rim and a few rocks round its edge
    createBigCrater(row) {
        const group = new THREE.Group();
        const across = SPIKE_ROW_WIDTH / 2 - 0.05;
        const along = SPIKE_ROW_DEPTH / 2 + 0.05;
        const hole = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshStandardMaterial({ map: craterTexture(), roughness: 1 }));
        hole.rotation.x = -Math.PI / 2;
        hole.scale.set(across, along, 1);
        hole.position.y = 0.012;
        hole.receiveShadow = true;
        group.add(hole);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.1, 10, 56), new THREE.MeshStandardMaterial({ color: 0x88888c, roughness: 1 }));
        rim.rotation.x = -Math.PI / 2;
        rim.scale.set(across, along, 0.9);
        rim.castShadow = true;
        group.add(rim);
        const rock = new THREE.MeshStandardMaterial({ color: 0x77777b, roughness: 1 });
        for (const [x, z, size] of [[-1.25, 0.42, 0.09], [-0.4, -0.55, 0.07], [0.55, 0.52, 0.08], [1.3, -0.3, 0.06]]) {
            const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), rock);
            stone.position.set(x, size * 0.6, z);
            stone.castShadow = true;
            group.add(stone);
        }
        if (!row.spansX) group.rotation.y = Math.PI / 2;
        group.position.copy(row.position);
        group.position.y = 0;
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
        const bubble = !!this.theme.underwater;
        return {
            gap, alongX, span, low, high, startAt,
            bubble, // Underwater World: a bubble you push into, over a zigzag crack
            push: 0, // bubble: seconds pushed into it so far
            pushing: false, // bubble: being pushed into this step
            crack: bubble ? this.crackOutline(gap, alongX, span) : null,
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
            Object.assign(p, { at: p.startAt, target: p.startAt, riding: false, wait: 0, mustLeave: false, push: 0, pushing: false });
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

    // The crack's outline (world x, z): the gap's rectangle with zigzag,
    // lightning-bolt ends that reach in from each end up to CRACK_TOOTH, so
    // the floor before and after it stays whole. Its long sides run along the
    // corridor's walls.
    crackOutline(g, alongX, span) {
        const width = alongX ? g.maxZ - g.minZ : g.maxX - g.minX;
        const near = [0.12, 0.66, 0.2, 0.7, 0.05, 0.58, 0.15];
        const far = [0.6, 0.08, 0.68, 0.18, 0.62, 0.1, 0.5];
        const point = (along, across) => (alongX ? new THREE.Vector2(g.minX + along, g.minZ + across) : new THREE.Vector2(g.minX + across, g.minZ + along));
        const out = [];
        near.forEach((t, k) => out.push(point(t * CRACK_TOOTH / 0.7, (k / (near.length - 1)) * width)));
        for (let k = far.length - 1; k >= 0; k--) out.push(point(span - far[k] * CRACK_TOOTH / 0.7, (k / (far.length - 1)) * width));
        return out;
    }

    // Is this point (world x, z) inside the crack's outline?
    inCrack(point, p) {
        const poly = p.crack;
        let inside = false;
        for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
            const pa = poly[a];
            const pb = poly[b];
            if ((pa.y > point.z) !== (pb.y > point.z) && point.x < ((pb.x - pa.x) * (point.z - pa.y)) / (pb.y - pa.y) + pa.x) inside = !inside;
        }
        return inside;
    }

    // Would a player standing here fall? (Over a gap with no platform under them)
    fallsIntoGap(point) {
        const p = this.gapAt(point);
        if (!p) return false;
        // The bubble: never while inside it; otherwise inside the zigzag crack
        if (p.bubble) return !p.riding && this.inCrack(point, p);
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
        if (p.bubble) return this.updateBubble(p, dt, position, velocity, radius);
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

    // Run one bubble (Underwater World, Level 42 on). It rests at one edge of
    // the crack and is solid from that side: walking into it pushes against
    // it, and BUBBLE_PUSH_TIME of pushing in all gets you inside (it stretches
    // more the longer you push). Then it carries you across at the platform
    // speed, holding you in its middle, lets you out on the far edge and
    // rests there. It works the same from either side. If it's empty and you
    // come to the other edge, it floats over to you (like the platforms).
    // Returns 'enter', 'depart' or 'arrive' when that happens.
    updateBubble(p, dt, position, velocity, radius) {
        const g = p.gap;
        const { along, across, width } = this.gapCoords(position, p);
        const inRange = across > -radius && across < width + radius;
        const setAlong = (value) => {
            if (p.alongX) {
                position.x = g.minX + value;
                velocity.x = 0;
            } else {
                position.z = g.minZ + value;
                velocity.z = 0;
            }
        };
        let event = null;
        p.pushing = false;
        if (p.riding) {
            if (p.wait > 0) {
                p.wait -= dt;
            } else {
                if (p.at === (p.target === p.high ? p.low : p.high)) event = 'depart';
                p.at = p.target > p.at ? Math.min(p.target, p.at + p.speed * dt) : Math.max(p.target, p.at - p.speed * dt);
            }
            // Held in the bubble's middle while it carries you
            const middle = p.at + PLATFORM_LENGTH / 2;
            setAlong(middle);
            if (p.alongX) {
                position.z = g.minZ + width / 2;
                velocity.z = 0;
            } else {
                position.x = g.minX + width / 2;
                velocity.x = 0;
            }
            if (p.at === p.target) {
                // Out onto the far edge, just clear of the bubble
                setAlong(p.at === p.high ? middle + BUBBLE_RADIUS + radius + 0.05 : middle - BUBBLE_RADIUS - radius - 0.05);
                Object.assign(p, { riding: false, mustLeave: false });
                event = 'arrive';
            }
        } else if (p.at === p.target) {
            const middle = p.at + PLATFORM_LENGTH / 2;
            const fromLow = p.at === p.low;
            // The bubble's outside, from the side it rests at: you can't walk into it
            const face = fromLow ? middle - BUBBLE_RADIUS - radius : middle + BUBBLE_RADIUS + radius;
            const into = fromLow ? along > face + 1e-6 && along < middle : along < face - 1e-6 && along > middle;
            if (inRange && into) {
                setAlong(face);
                p.pushing = true;
                p.push = Math.min(BUBBLE_PUSH_TIME, p.push + dt);
                if (p.push >= BUBBLE_PUSH_TIME) {
                    // Inside! The time pushed is used up
                    Object.assign(p, { riding: true, wait: PLATFORM_WAIT, push: 0, target: fromLow ? p.high : p.low });
                    setAlong(middle);
                    event = 'enter';
                }
            } else if (inRange) {
                // Empty: float over to the other edge if the player comes to it
                if (fromLow && along > p.span && along < p.span + PLATFORM_CALL_DISTANCE) p.target = p.high;
                if (!fromLow && along < 0 && along > -PLATFORM_CALL_DISTANCE) p.target = p.low;
            }
        } else {
            p.at = p.target > p.at ? Math.min(p.target, p.at + p.speed * dt) : Math.max(p.target, p.at - p.speed * dt);
        }
        this.showPlatform(p);
        return event;
    }

    // The gap's look: dark sky below (with a few far stars), a glowing strip
    // along each edge, and the shiny metal platform with glowing trim and
    // little thruster lights underneath
    createPlatform(p) {
        if (p.bubble) {
            this.createCrack(p);
            this.createBubble(p);
            this.showPlatform(p);
            return;
        }
        if (this.theme.moon) {
            this.createGiantCrater(p);
            this.createHoverDisc(p);
            this.showPlatform(p);
            return;
        }
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

    // Moon World (Level 36 on): a giant crater under the gap, with steep gray
    // rock sides going down to a rocky bottom far below, and rough rims where
    // the path drops away
    createGiantCrater(p) {
        const g = p.gap;
        const cx = (g.minX + g.maxX) / 2;
        const cz = (g.minZ + g.maxZ) / 2;
        const sizeX = g.maxX - g.minX;
        const sizeZ = g.maxZ - g.minZ;
        const bottomY = -7;
        let r = 41;
        const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
        const map = rockTexture();
        const side = new THREE.MeshStandardMaterial({ map, color: 0x9a9aa0, roughness: 1, emissive: 0x16161a, emissiveIntensity: 1 });
        const depth = -bottomY - 0.2;
        for (const [w, d, x, z, along] of [
            [sizeX, 0.05, cx, g.minZ, sizeX], [sizeX, 0.05, cx, g.maxZ, sizeX],
            [0.05, sizeZ, g.minX, cz, sizeZ], [0.05, sizeZ, g.maxX, cz, sizeZ],
        ]) {
            const m = side.clone();
            m.map = map.clone();
            m.map.needsUpdate = true;
            m.map.repeat.set(along / 2, depth / 2);
            const wall = new THREE.Mesh(new THREE.BoxGeometry(w, depth, d), m);
            wall.position.set(x, -0.2 - depth / 2, z);
            this.root.add(wall);
        }
        // The bottom: dusty gray rock, darker in the middle, with boulders
        const bottomMap = rockTexture();
        bottomMap.repeat.set(sizeX / 2, sizeZ / 2);
        const bottom = new THREE.Mesh(new THREE.PlaneGeometry(sizeX, sizeZ),
            new THREE.MeshStandardMaterial({ map: bottomMap, color: 0x8a8a90, roughness: 1, emissive: 0x141418, emissiveIntensity: 1 }));
        bottom.rotation.x = -Math.PI / 2;
        bottom.position.set(cx, bottomY, cz);
        this.root.add(bottom);
        const boulder = new THREE.MeshStandardMaterial({ color: 0x77777c, roughness: 1, emissive: 0x18181c, emissiveIntensity: 1, flatShading: true });
        for (let k = 0; k < 12; k++) {
            const size = 0.15 + random() * 0.35;
            const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), boulder);
            stone.position.set(g.minX + 0.3 + random() * (sizeX - 0.6), bottomY + size * 0.5, g.minZ + 0.3 + random() * (sizeZ - 0.6));
            stone.rotation.set(random() * 3, random() * 3, random() * 3);
            this.root.add(stone);
        }
        // Rough rock rims at the two ends, where the path drops away
        const rim = new THREE.MeshStandardMaterial({ color: 0x8c8c90, roughness: 1, flatShading: true });
        const width = p.alongX ? sizeZ : sizeX;
        for (const end of [0, p.span]) {
            for (let k = 0; k < 6; k++) {
                const size = 0.07 + random() * 0.07;
                const lump = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), rim);
                const across = 0.25 + (k + random() * 0.5) * ((width - 0.5) / 6);
                const along = end + (end ? 0.12 : -0.12);
                if (p.alongX) lump.position.set(g.minX + along, 0.02, g.minZ + across);
                else lump.position.set(g.minX + across, 0.02, g.minZ + along);
                this.root.add(lump);
            }
        }
    }

    // Underwater World (Level 42 on): the crack in the sea floor. Its sides
    // follow the zigzag outline straight down into the dark, so deep that no
    // bottom shows; only the small lights of glowing anglerfish far below.
    createCrack(p) {
        const poly = p.crack;
        const depth = 60;
        // Dark rock sides: dark brown just under the sand, going black within a
        // few steps down, then black all the way
        const positions = [];
        const colors = [];
        const bands = [[-0.2, new THREE.Color(0x2b2418)], [-3.5, new THREE.Color(0x020406)], [-depth, new THREE.Color(0x000000)]];
        for (let k = 0; k < poly.length; k++) {
            const a = poly[k];
            const b = poly[(k + 1) % poly.length];
            for (let n = 0; n < bands.length - 1; n++) {
                const [y0, c0] = bands[n];
                const [y1, c1] = bands[n + 1];
                for (const [x, y, z, c] of [[a.x, y0, a.y, c0], [b.x, y0, b.y, c0], [b.x, y1, b.y, c1], [a.x, y0, a.y, c0], [b.x, y1, b.y, c1], [a.x, y1, a.y, c1]]) {
                    positions.push(x, y, z);
                    colors.push(c.r, c.g, c.b);
                }
            }
        }
        const sides = new THREE.BufferGeometry();
        sides.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        sides.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        this.root.add(new THREE.Mesh(sides, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false })));
        // A black floor far, far down, so the water's blue haze doesn't show through
        const g = p.gap;
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(g.maxX - g.minX + 2, g.maxZ - g.minZ + 2), new THREE.MeshBasicMaterial({ color: 0x000000, fog: false }));
        floor.rotation.x = -Math.PI / 2;
        floor.position.set((g.minX + g.maxX) / 2, -depth + 0.5, (g.minZ + g.maxZ) / 2);
        this.root.add(floor);
        // Anglerfish: a dim body with a bright little lure light and a soft glow
        let r = 57;
        const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
        const width = p.alongX ? g.maxZ - g.minZ : g.maxX - g.minX;
        p.anglers = [];
        for (let k = 0; k < 6; k++) {
            const object = new THREE.Group();
            const body = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), new THREE.MeshBasicMaterial({ color: 0x0d1a22, fog: false }));
            body.scale.set(1.3, 0.9, 0.9);
            object.add(body);
            const lure = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: k % 2 ? 0xfff2a0 : 0xa8fff4, fog: false }));
            lure.position.set(0.55, 0.4, 0);
            object.add(lure);
            const glow = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), new THREE.MeshBasicMaterial({ color: k % 2 ? 0xfff2a0 : 0xa8fff4, transparent: true, opacity: 0.4, depthWrite: false, fog: false }));
            glow.position.copy(lure.position);
            object.add(glow);
            const along = 1 + random() * (p.span - 2);
            const across = 0.6 + random() * (width - 1.2);
            const x = p.alongX ? g.minX + along : g.minX + across;
            const z = p.alongX ? g.minZ + across : g.minZ + along;
            const y = -14 - random() * 30;
            object.position.set(x, y, z);
            object.rotation.y = random() * Math.PI * 2;
            this.root.add(object);
            p.anglers.push({ object, glow, x, y, z, time: random() * 10, speed: 0.2 + random() * 0.3, range: 0.4 + random() * 0.4, phase: random() * 6 });
        }
    }

    // Underwater World's ride: a giant clear bubble with a soft blue tint,
    // shiny highlights and a thin rim. It rests at the crack's edge, its
    // bottom at the sea floor.
    createBubble(p) {
        const group = new THREE.Group();
        const ball = new THREE.Group();
        const skin = new THREE.Mesh(new THREE.SphereGeometry(BUBBLE_RADIUS, 40, 28), new THREE.MeshPhysicalMaterial({
            color: 0xcff4ff, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1, clearcoat: 1,
            emissive: 0x4fb6d8, emissiveIntensity: 0.25, side: THREE.DoubleSide, depthWrite: false,
        }));
        ball.add(skin);
        // A slightly bigger back-facing shell gives it a visible edge
        const rim = new THREE.Mesh(new THREE.SphereGeometry(BUBBLE_RADIUS * 1.02, 40, 28), new THREE.MeshBasicMaterial({
            color: 0xe8fbff, transparent: true, opacity: 0.18, side: THREE.BackSide, depthWrite: false,
        }));
        ball.add(rim);
        const shine = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false });
        for (const [x, y, z, size] of [[-0.55, 0.6, -0.8, 0.22], [-0.35, 0.85, -0.6, 0.1], [0.7, -0.3, 0.75, 0.12]]) {
            const glint = new THREE.Mesh(new THREE.SphereGeometry(size, 12, 8), shine);
            glint.scale.set(1, 0.55, 0.4);
            glint.position.set(x, y, z);
            ball.add(glint);
        }
        ball.position.y = BUBBLE_RADIUS;
        group.add(ball);
        // The ball's z is the gap's long side; turn it when the gap runs along x
        if (p.alongX) group.rotation.y = Math.PI / 2;
        this.root.add(group);
        p.object = group;
        p.ball = ball;
    }

    // Moon World's platform: a round floating metal disc with a glowing ring
    // and a soft glow underneath. It still carries the player over the gap's
    // full width and PLATFORM_LENGTH along it, like every other platform.
    createHoverDisc(p) {
        const g = p.gap;
        const width = p.alongX ? g.maxZ - g.minZ : g.maxX - g.minX;
        const radius = Math.min(width - 0.1, PLATFORM_LENGTH + 0.3) / 2;
        const group = new THREE.Group();
        const disc = new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius * 0.92, 0.22, 48),
            new THREE.MeshStandardMaterial({ color: 0xd9dee6, metalness: 0.75, roughness: 0.2, emissive: 0x6a7686, emissiveIntensity: 0.6 })
        );
        disc.position.y = -0.11;
        disc.receiveShadow = true;
        group.add(disc);
        const glow = new THREE.MeshStandardMaterial({ color: 0x7fe9ff, emissive: 0x2fd8ff, emissiveIntensity: 1 });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(radius - 0.06, 0.05, 8, 64), glow);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.01;
        group.add(ring);
        const inner = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.45, 0.035, 8, 48), glow);
        inner.rotation.x = Math.PI / 2;
        inner.position.y = 0.01;
        group.add(inner);
        // The hover glow underneath
        const under = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.7, 32),
            new THREE.MeshBasicMaterial({ color: 0x8fe8ff, transparent: true, opacity: 0.55, fog: false, side: THREE.DoubleSide }));
        under.rotation.x = Math.PI / 2;
        under.position.y = -0.25;
        group.add(under);
        this.root.add(group);
        p.object = group;
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
        let middle = p.at + PLATFORM_LENGTH / 2;
        if (p.bubble) {
            // Pushed into, it squashes in where you push and bulges out wider
            // and taller, more the longer you've pushed (it keeps the stretch
            // when you stop, since the push time is kept). The pushed side
            // stays where it is.
            const q = p.riding || p.at !== p.target ? 0 : p.push / BUBBLE_PUSH_TIME;
            const squash = 1 - 0.4 * q;
            // A little wobble while you're pushing
            const wobble = p.pushing ? 1 + 0.035 * Math.sin(performance.now() / 55) : 1;
            const bulge = wobble / Math.sqrt(squash);
            const shift = BUBBLE_RADIUS * (1 - squash);
            middle += p.at === p.low ? -shift : shift;
            p.ball.scale.set(bulge, bulge, squash); // the ball's z is the gap's long side
            p.ball.position.y = BUBBLE_RADIUS * bulge;
        }
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
