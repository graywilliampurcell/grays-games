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

// Candy World's river: flowing melted chocolate, darker and lighter swirls
// that run across the texture's v (like waterTexture's streaks)
function meltedChocolateTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const g = canvas.getContext('2d');
    const base = g.createLinearGradient(0, 0, 128, 0);
    base.addColorStop(0, '#4a2412');
    base.addColorStop(0.5, '#6b3a1e');
    base.addColorStop(1, '#4a2412');
    g.fillStyle = base;
    g.fillRect(0, 0, 128, 128);
    g.lineWidth = 3;
    for (const [x, y, len, light] of [[10, 10, 34, 1], [70, 30, 30, 0], [30, 60, 38, 1], [90, 80, 26, 0], [15, 100, 30, 0], [60, 112, 34, 1], [104, 4, 22, 1], [46, 20, 24, 0]]) {
        g.strokeStyle = light ? 'rgba(160,100,60,0.75)' : 'rgba(40,18,8,0.7)';
        g.beginPath();
        g.moveTo(x, y);
        g.bezierCurveTo(x + 6, y + len / 3, x - 6, y + (2 * len) / 3, x, y + len);
        g.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// Candy World's caramel: golden and glossy, with darker swirls and shiny highlights
function caramelTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const g = canvas.getContext('2d');
    const base = g.createRadialGradient(64, 64, 10, 64, 64, 90);
    base.addColorStop(0, '#f6b73c');
    base.addColorStop(1, '#c9821a');
    g.fillStyle = base;
    g.fillRect(0, 0, 128, 128);
    g.lineWidth = 4;
    g.strokeStyle = 'rgba(150,80,10,0.55)';
    for (const [x, y, r] of [[30, 34, 16], [90, 40, 20], [52, 92, 22], [104, 100, 12]]) {
        g.beginPath();
        g.arc(x, y, r, 0.3, 4.4);
        g.stroke();
    }
    g.fillStyle = 'rgba(255,240,190,0.75)';
    for (const [x, y, rx, ry] of [[40, 22, 12, 4], [86, 70, 16, 5], [24, 84, 9, 3], [100, 18, 7, 3]]) {
        g.beginPath();
        g.ellipse(x, y, rx, ry, -0.5, 0, Math.PI * 2);
        g.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
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

// Candy World walls: giant gumdrops stacked in rows, every color, each one
// round on top with a sugary sparkle. A 1 x 4 wall face is 128 x 512.
const GUMDROP_COLORS = ['#ff3b6b', '#ff9a1f', '#ffd60a', '#3ddc5a', '#2fa8ff', '#a64dff', '#ff5fd2'];
function gumdropTexture(width, height, seed) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext('2d');
    g.fillStyle = '#f7c6e0';
    g.fillRect(0, 0, width, height);
    let r = seed;
    const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    const drop = width / 2;
    for (let row = 0; row * drop < height; row++) {
        const shift = row % 2 ? drop / 2 : 0;
        // Two gumdrops per row; the ones hanging over an edge repeat on the
        // other side in the same color, so the texture wraps without a seam
        const rowColors = [0, 1].map(() => GUMDROP_COLORS[Math.floor(random() * GUMDROP_COLORS.length)]);
        for (let col = -1; col <= 2; col++) {
            const x = col * drop + shift;
            const bottom = height - row * drop;
            const color = rowColors[(col + 2) % 2];
            const w = drop - 4;
            const left = x + 2;
            // A dome: flat bottom, round top
            g.beginPath();
            g.moveTo(left, bottom - 2);
            g.lineTo(left, bottom - drop * 0.42);
            g.bezierCurveTo(left, bottom - drop * 1.02, left + w, bottom - drop * 1.02, left + w, bottom - drop * 0.42);
            g.lineTo(left + w, bottom - 2);
            g.closePath();
            const shade = g.createLinearGradient(left, bottom - drop, left + w, bottom);
            shade.addColorStop(0, 'rgba(255,255,255,0.35)');
            shade.addColorStop(0.5, 'rgba(255,255,255,0)');
            shade.addColorStop(1, 'rgba(0,0,0,0.18)');
            g.fillStyle = color;
            g.fill();
            g.fillStyle = shade;
            g.fill();
            // A shiny spot near the top
            g.fillStyle = 'rgba(255,255,255,0.55)';
            g.beginPath();
            g.ellipse(left + w * 0.32, bottom - drop * 0.66, w * 0.09, drop * 0.06, -0.5, 0, Math.PI * 2);
            g.fill();
            // Sugar crystals
            g.fillStyle = 'rgba(255,255,255,0.8)';
            for (let k = 0; k < 14; k++) {
                const sx = left + 4 + random() * (w - 8);
                const sy = bottom - 4 - random() * drop * 0.7;
                g.fillRect(sx, sy, 1.5, 1.5);
            }
        }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// Candy World floor: a big chocolate bar, square pieces with raised edges and
// grooves between them (one texture is 2 x 2 squares)
function chocolateTexture(size) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const g = canvas.getContext('2d');
    g.fillStyle = '#3d2012';
    g.fillRect(0, 0, size, size);
    const piece = size / 2;
    const edge = piece * 0.12;
    for (let px = 0; px < 2; px++) {
        for (let pz = 0; pz < 2; pz++) {
            const x = px * piece + 2;
            const z = pz * piece + 2;
            const s = piece - 4;
            // Light top and left bevels, dark bottom and right ones
            g.fillStyle = '#8a5434';
            g.beginPath();
            g.moveTo(x, z); g.lineTo(x + s, z); g.lineTo(x + s - edge, z + edge); g.lineTo(x + edge, z + edge); g.lineTo(x + edge, z + s - edge); g.lineTo(x, z + s);
            g.closePath();
            g.fill();
            g.fillStyle = '#4a2716';
            g.beginPath();
            g.moveTo(x + s, z); g.lineTo(x + s, z + s); g.lineTo(x, z + s); g.lineTo(x + edge, z + s - edge); g.lineTo(x + s - edge, z + s - edge); g.lineTo(x + s - edge, z + edge);
            g.closePath();
            g.fill();
            const top = g.createLinearGradient(x, z, x + s, z + s);
            top.addColorStop(0, '#74442a');
            top.addColorStop(1, '#5e3520');
            g.fillStyle = top;
            g.fillRect(x + edge, z + edge, s - edge * 2, s - edge * 2);
        }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// Red and white candy-cane stripes, slanting so they wind round a stick
function candyStripeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const g = canvas.getContext('2d');
    g.fillStyle = '#fffafa';
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#e8132f';
    for (let k = -2; k < 4; k++) {
        g.beginPath();
        g.moveTo(k * 32, 64); g.lineTo(k * 32 + 14, 64); g.lineTo(k * 32 + 14 + 64, 0); g.lineTo(k * 32 + 64, 0);
        g.closePath();
        g.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
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
// Dinosaur World: how far down the long-neck's pit floor is
const LONG_NECK_FLOOR = -12;
// Pirate Ship World (Level 121 on): the sea, far below the deck; every water
// gap is a hole in the deck all the way down to it
export const SEA_LEVEL = -9;
// Sky World (Level 131 on): the clouds, far below the floating island; every
// gap is a hole in the island down to them
export const CLOUD_LEVEL = -18;
const ISLAND_DEPTH = 3; // how thick the island's rock is at a gap's edge
// The rainbow bridge (Level 131 on): it spans the whole gap and keeps its own
// cycle (it never waits for you): solid RAINBOW_SOLID s, then fading
// RAINBOW_FADE s (flickering as a warning, still solid), then gone
// RAINBOW_GONE s, then solid again. It never goes while any part of you is on
// it: it stays (still flickering) until you're off, then carries on.
// Thick fog (Sky World, Level 134 on): it closes in fully once you're this
// far inside either end of its stretch
export const FOG_EDGE = 1;
export const RAINBOW_SOLID = 4;
export const RAINBOW_FADE = 1;
export const RAINBOW_GONE = 3;
// Mushroom Forest World (Level 141 on): the mushroom cap ride. The cap is
// round, PLATFORM_LENGTH across (CAP_RADIUS = half that), so acid shows
// round it in the 3-wide corridor; it reaches CAP_OVERHANG over the edge
// it waits at. It goes only once your middle is within CAP_RING of its
// middle (a ring about a third of the corridor across). It sets you down
// CAP_LANDING past the far edge. The acid is ACID_DEPTH below the floor.
export const CAP_RADIUS = 1.2;
export const CAP_RING = 0.5;
const CAP_OVERHANG = 0.4;
const CAP_LANDING = 1.0;
const ACID_DEPTH = 3;
// Mushroom Forest World's sleepy mushroom ('z', Level 143 on): a blue cap as
// wide as Level 53's squeeze spike (so the same gaps each side). You touch
// it when your middle comes within SLEEPY_TOUCH of its middle (like touching
// a spike); it's solid, so your middle never gets closer than SLEEPY_SOLID.
const SLEEPY_RADIUS = 0.64;
const SLEEPY_TOUCH = SLEEPY_RADIUS + 0.25;
const SLEEPY_SOLID = SLEEPY_TOUCH - 0.03;
// Its "Zzz" bubbles: this many float up from the cap, each taking this long
const ZZZ_COUNT = 3;
const ZZZ_TIME = 2.4;
// The bright firefly ('e', Level 144 on): one big firefly hovering
// FIREFLY_HEIGHT above the floor in the middle of the last cell of a straight
// hallway on the path (no collision; you walk right under it). It blinks on
// a fixed cycle, dim FIREFLY_DIM_TIME then bright FIREFLY_BRIGHT_TIME, over
// and over (starting values Gray will judge), counted in game time so it
// freezes while paused. It's "in your eyes" while it's bright, within
// FIREFLY_VIEW_ANGLE of straight ahead and no wall is in between (main.js
// sends you back to the start after about a second of that).
export const FIREFLY_DIM_TIME = 3;
export const FIREFLY_BRIGHT_TIME = 2;
export const FIREFLY_VIEW_ANGLE = 15; // degrees
const FIREFLY_HEIGHT = 2.3;
const FIREFLY_FADE = 0.15; // how long it takes to brighten or dim (looks only)
// The trench bounce (Level 142 on): a trench ('b' blocks, 4 corridor cells
// long, full corridor width) with acid TRENCH_DEPTH down. Two giant bouncy
// mushrooms stand in the acid, one near each edge (their middles
// TRENCH_CAP_FROM_EDGE in from it), their caps TRENCH_CAP_RADIUS across
// (the middle half of the 3-wide corridor) and well below the floor: the
// one on the start's side lower (TRENCH_CAP_LOW), the other TRENCH_CAP_HIGH.
// Walk off an edge with your middle over the middle half of the corridor's
// width (TRENCH_AIM) and you drop onto the nearer cap (TRENCH_DROP_TIME),
// which bounces you in one arc onto the other cap (TRENCH_BOUNCE_1), which
// bounces you in one arc onto the floor TRENCH_LANDING past the far edge
// (TRENCH_BOUNCE_2): about 2.5 s for both bounces (starting value Gray will
// judge). Off the middle half you miss and fall in the acid.
const TRENCH_DEPTH = 4;
export const TRENCH_CAP_RADIUS = 0.75;
export const TRENCH_AIM = 0.5;
const TRENCH_CAP_FROM_EDGE = 1.3;
const TRENCH_CAP_LOW = -2.2;
const TRENCH_CAP_HIGH = -1.3;
export const TRENCH_DROP_TIME = 0.45;
export const TRENCH_BOUNCE_1 = 1.35;
export const TRENCH_BOUNCE_2 = 1.15;
const TRENCH_HOP_1 = 3.2;
const TRENCH_HOP_2 = 2.3;
const TRENCH_LANDING = 1.0;
const MUSHROOM_GLOWS = [0x5ff2d8, 0xc79bff, 0xb8ff6a, 0xffa860, 0x7fc8ff];
const RAINBOW_COLORS = [0xff3b3b, 0xff9a1f, 0xffe03a, 0x3ddc5a, 0x2fa8ff, 0x4b5cff, 0xa64dff];
// The cannon ride (Level 121 on): a big cannon on each side of a 4-cell
// water gap, aimed across. Fully inside one, its fuse fizzes for
// CANNON_FUSE s, then it fires you over the gap in one arc (CANNON_FLIGHT s,
// CANNON_HEIGHT high at the top) into the other cannon: you always land safely.
export const CANNON_FUSE = 1;
export const CANNON_FLIGHT = 1.5;
export const CANNON_HEIGHT = 5;
const CANNON_REACH = 2.2; // a cannon's middle, back from the gap's edge
const CANNON_INSIDE = 0.85; // your middle this close to its middle (along and across) is inside it
const CANNON_RADIUS = 1.1;
const CANNON_LENGTH = 2.8;
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
// Candy World's crossing (Level 52 on): a chocolate river with one bouncy
// marshmallow on each bank, right at the edge in the middle of the corridor
// (open river edge either side of it). Stepping on one bounces you over the
// river in one arc and lands you safely on the far bank, clear of the edge
// and of the marshmallow there.
const MARSHMALLOW_RADIUS = 0.7;
const MARSHMALLOW_FROM_EDGE = 0.8; // its middle, back from the river's edge
const MARSHMALLOW_STEP = MARSHMALLOW_RADIUS + 0.15; // your middle this close to its middle counts as stepping on
const BOUNCE_LANDING = 2.2; // where you land, past the far edge
// Volcano World's crossing (Level 62 on): a hot-air balloon over a 4-cell
// lava gap. Its basket is the gap's width and PLATFORM_LENGTH long, resting
// at one edge. Fully inside it for BALLOON_WAIT and the burner fires: it
// rises BALLOON_HEIGHT straight up, crosses at the top, and comes straight
// down at the far edge (about 6 s in all), then lets you out onto the floor.
const BALLOON_WAIT = 1.0;
const BALLOON_RISE_TIME = 2.0;
const BALLOON_CROSS_TIME = 2.0;
const BALLOON_DOWN_TIME = 2.0;
const BALLOON_HEIGHT = 24; // six times the walls' height
// Where it lets you out: your middle this far past the far edge
const BALLOON_LANDING = 0.75;
// The ash cloud at the top: it thickens over the last part of the rise and
// clears over the first part of the way down (fractions of those times)
const BALLOON_CLOUD_FADE = 0.25;

// Volcano World's lava: bright orange and yellow swirls with dark crust
function lavaTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const g = canvas.getContext('2d');
    g.fillStyle = '#ff6a00';
    g.fillRect(0, 0, 128, 128);
    let r = 71;
    const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 60; k++) {
        const x = random() * 128;
        const y = random() * 128;
        const size = 6 + random() * 18;
        const blob = g.createRadialGradient(x, y, 0, x, y, size);
        const hot = random() < 0.6;
        blob.addColorStop(0, hot ? 'rgba(255,236,120,0.9)' : 'rgba(120,20,0,0.7)');
        blob.addColorStop(1, hot ? 'rgba(255,160,0,0)' : 'rgba(80,10,0,0)');
        g.fillStyle = blob;
        for (const dx of [-128, 0, 128]) for (const dy of [-128, 0, 128]) {
            g.save();
            g.translate(dx, dy);
            g.fillRect(x - size, y - size, size * 2, size * 2);
            g.restore();
        }
    }
    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    return map;
}

// The balloon: wide stripes of red, orange and yellow from top to bottom
function balloonTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const g = canvas.getContext('2d');
    const colors = ['#e8321e', '#ff9a1f', '#ffd93a', '#ff9a1f'];
    for (let k = 0; k < 16; k++) {
        g.fillStyle = colors[k % colors.length];
        g.fillRect(k * 16, 0, 16, 64);
    }
    return new THREE.CanvasTexture(canvas);
}

// The basket: woven wicker
function wickerTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const g = canvas.getContext('2d');
    g.fillStyle = '#9a6a35';
    g.fillRect(0, 0, 64, 64);
    for (let y = 0; y < 64; y += 8) {
        for (let x = 0; x < 64; x += 8) {
            g.fillStyle = (x + y) % 16 === 0 ? '#b7844a' : '#7a4f24';
            g.fillRect(x + 1, y + 1, 6, 6);
        }
    }
    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(3, 1);
    return map;
}

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

// Volcano World walls: shiny black volcano rock with glowing orange cracks.
// The same canvas is the glow map, so only the cracks (and a faint sheen) glow.
function volcanoRockTexture(width, height, seed) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext('2d');
    g.fillStyle = '#0d0b0c';
    g.fillRect(0, 0, width, height);
    let r = seed;
    const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    // Glassy, slightly lighter streaks in the black rock
    for (let i = 0; i < (width * height) / 700; i++) {
        const x = random() * width;
        const y = random() * height;
        const radius = 6 + random() * 18;
        const sheen = g.createRadialGradient(x, y, 0, x, y, radius);
        sheen.addColorStop(0, 'rgba(70,62,66,0.35)');
        sheen.addColorStop(1, 'rgba(70,62,66,0)');
        g.fillStyle = sheen;
        g.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    // Jagged cracks: a wide dim orange glow with a thin bright yellow core
    for (let c = 0; c < (width * height) / 5000; c++) {
        const points = [[random() * width, random() * height]];
        let angle = random() * Math.PI * 2;
        for (let k = 0; k < 6 + random() * 8; k++) {
            angle += (random() - 0.5) * 1.6;
            const [x, y] = points[points.length - 1];
            points.push([x + Math.cos(angle) * (6 + random() * 12), y + Math.sin(angle) * (6 + random() * 12)]);
        }
        for (const [w, color] of [[6, 'rgba(255,80,0,0.35)'], [2.5, 'rgba(255,120,10,0.9)'], [1, 'rgba(255,220,90,1)']]) {
            g.strokeStyle = color;
            g.lineWidth = w;
            g.lineJoin = 'round';
            g.beginPath();
            points.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y)));
            g.stroke();
        }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// Volcano World floor: cooled lava, black with swirly grey ripples and a few
// faint dark red veins
function cooledLavaTexture(size, seed) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const g = canvas.getContext('2d');
    g.fillStyle = '#141012';
    g.fillRect(0, 0, size, size);
    let r = seed;
    const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    g.lineCap = 'round';
    for (let k = 0; k < 70; k++) {
        const x = random() * size;
        const y = random() * size;
        const radius = 6 + random() * 26;
        const start = random() * Math.PI * 2;
        g.strokeStyle = random() < 0.15 ? 'rgba(110,20,10,0.55)' : `rgba(${60 + random() * 40 | 0},${55 + random() * 30 | 0},${58 + random() * 30 | 0},0.6)`;
        g.lineWidth = 1 + random() * 3;
        // A swirl: an arc that winds inward
        g.beginPath();
        for (let t = 0; t < 1; t += 0.02) {
            const a = start + t * Math.PI * 3;
            const rr = radius * (1 - t * 0.7);
            const px = x + Math.cos(a) * rr;
            const py = y + Math.sin(a) * rr;
            if (t) g.lineTo(px, py); else g.moveTo(px, py);
        }
        g.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// A glowing hot coal's skin: dark charcoal with bright orange-yellow cracks
function coalTexture() {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const g = canvas.getContext('2d');
    g.fillStyle = '#ff6a10';
    g.fillRect(0, 0, size, size);
    let r = 53;
    const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    // Dark charcoal plates with glowing seams between them
    for (let k = 0; k < 60; k++) {
        const x = random() * size;
        const y = random() * size;
        const w = 10 + random() * 22;
        const h = 8 + random() * 18;
        g.fillStyle = `rgb(${24 + random() * 20 | 0},${16 + random() * 10 | 0},${14 + random() * 8 | 0})`;
        g.beginPath();
        g.ellipse(x, y, w / 2, h / 2, random() * Math.PI, 0, Math.PI * 2);
        g.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// A soft white puff, for steam
function puffTexture() {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const g = canvas.getContext('2d');
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.5, 'rgba(240,240,240,0.45)');
    grad.addColorStop(1, 'rgba(230,230,230,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
}

// A steam vent's timer (Volcano World, Level 61 on): quiet, then a warning
// (wisps and a hiss), then a puff that pushes you back one square
const VENT_QUIET_TIME = 3;
const VENT_WARNING_TIME = 1;
const VENT_PUFF_TIME = 0.5;
// A big wave (Pirate Ship World) uses the vent's cycle: calm VENT_QUIET_TIME,
// warning VENT_WARNING_TIME (the wave rises over the rail), splash
// VENT_PUFF_TIME (it sweeps across the cell); the deck stays wet for
// WAVE_DRY_TIME afterwards. A second wave runs WAVE_OFFSET out of step.
export const WAVE_TIMES = { calm: VENT_QUIET_TIME, warning: VENT_WARNING_TIME, splash: VENT_PUFF_TIME };
const WAVE_DRY_TIME = 0.8;
const WAVE_OFFSET = 2.2;
// The rocking ship (Pirate Ship World, Level 124 on): every ROCK_EVERY
// seconds the ship tips gently to one side (north or south, alternating) for
// ROCK_TIP_TIME and back. During a tip you slide ROCK_SLIDE toward the low
// side (a quarter of a 3-block corridor cell), stopping at walls, unless
// you're within ROCK_SAFE of a water gap, a spike or a wave.
export const ROCK_EVERY = 8;
export const ROCK_TIP_TIME = 1.5;
const ROCK_CALM_TIME = ROCK_EVERY - ROCK_TIP_TIME;
export const ROCK_ANGLE = 0.07; // radians at the most (about 4 degrees)
export const ROCK_SLIDE = 0.75;
const ROCK_SAFE = 3; // one corridor cell

// A tail swish's cycle (Dinosaur World, Level 112 on; 'H' blocks under the
// dino theme): the tail is lifted high above the walls for TAIL_LIFTED_TIME
// (the cell is clear), then swishes for TAIL_SWISH_TIME: it drops low at one
// wall, sweeps across the cell to the other wall and lifts again, the
// opposite way each time. A second tail runs TAIL_OFFSET seconds out of step.
export const TAIL_LIFTED_TIME = 2;
export const TAIL_SWISH_TIME = 1;
const TAIL_OFFSET = 1.5;
const TAIL_DROP = 0.2; // share of the swish spent dropping (and lifting again)
const TAIL_THICK = 0.4; // how far the low tail reaches either side of its line
// A slow propeller (Sky World, Level 135 on; 'H' blocks under the sky
// theme): a giant airship propeller across its corridor cell, its hub above
// the middle of the hallway and its blades sweeping down across the whole
// corridor, turning once every PROPELLER_TURN_TIME (starting value; Gray
// will judge). Below the wall tops the blades slide into slots in the side
// walls, so they never poke into the next corridor. A blade that touches you
// pushes you one square back toward the start (to its 'Q').
export const PROPELLER_TURN_TIME = 8;
export const PROPELLER_BLADES = 2;
export const PROPELLER_HUB = 3; // the hub's height (the walls are 4 high; you're 1.8 tall)
export const PROPELLER_LENGTH = 2.95; // from the hub's middle to a blade's tip (just above the floor)
export const PROPELLER_BLADE_REACH = 0.3; // how far a blade reaches either side of its middle line
export const PROPELLER_DEPTH = 0.2; // how far a blade reaches along the hallway either side of its plane

// A lava geyser's timer (Volcano World, Level 63 on), like Level 12's space
// door: erupting, then quiet. It never starts erupting while you're in its
// cell; it waits until you've left. Its column shoots up over GEYSER_RISE
// seconds and sinks back over GEYSER_SINK at the end; GEYSER_BUBBLE is how
// long before an eruption the hole starts to bubble and glow brighter.
const GEYSER_QUIET_TIME = 3;
const GEYSER_ERUPT_TIME = 3;
const GEYSER_RISE = 0.25;
const GEYSER_SINK = 0.3;
const GEYSER_BUBBLE = 1;
const GEYSER_OFFSET = 1.5;

// A trapdoor's timer (Desert Pyramid World, Level 104 on; 'K' blocks under
// the desert theme): closed (plain floor) for TRAPDOOR_CLOSED_TIME, then a
// TRAPDOOR_WARNING_TIME warning (it shakes, sand trickles through its edges
// and it rumbles), then open (a dark hole) for TRAPDOOR_OPEN_TIME, round and
// round on its own. Unlike a lava geyser it doesn't wait: it can open right
// under you. Its two flaps swing down over TRAPDOOR_SWING seconds. A second
// trapdoor runs TRAPDOOR_OFFSET seconds out of step with the first.
export const TRAPDOOR_CLOSED_TIME = 3;
export const TRAPDOOR_WARNING_TIME = 1;
export const TRAPDOOR_OPEN_TIME = 2;
const TRAPDOOR_SWING = 0.2;
const TRAPDOOR_OFFSET = 1.5;

// Ice World's crossing (Level 71 on): a sled hanging from a zip line over a
// 3-cell icy crack. It's the crack's width and PLATFORM_LENGTH long, resting
// at one edge. As soon as you're fully on it, it zooms across in SLED_TIME
// (you can look around but not steer or step off), then sets you down on the
// floor SLED_LANDING past the far edge and rests there.
const SLED_TIME = 1.5;
// Desert Pyramid World's crossing (Level 102 on): a flying carpet over a
// 3-cell sand pit. It runs on its own fixed cycle that never waits for you:
// it rests at one edge CARPET_REST_TIME, crosses in CARPET_CROSS_TIME, rests
// at the other edge, crosses back, and so on. Only if you're partly on it
// when a rest ends does it keep resting, till you're fully on or fully off.
const CARPET_REST_TIME = 2;
const CARPET_CROSS_TIME = 2;
// A second carpet in the same level (Levels 109-110) runs CARPET_OFFSET
// seconds out of step with the first, so the two cycles don't match.
const CARPET_OFFSET = 1;
const SLED_LANDING = 1.0;
const ZIP_LINE_HEIGHT = 3.6; // the zip line, just under the tops of the walls (4)

// Ice World's snowman (Level 72 on): he stands against the end wall of a
// straight hallway and throws a snowball down it every SNOWMAN_THROW_TIME
// seconds. The snowball fills the hallway's width and flies toward the start
// at SNOWBALL_SPEED until it reaches the hallway's first cell, then it's gone.
// SNOWBALL_REACH is how far its front and back reach from its middle along
// the hallway. It starts just in front of him, so the part of the last cell
// beside him (at the turn) is never reached: the safe spot. The arm he throws
// with comes up SNOWMAN_WINDUP seconds before each throw.
const SNOWMAN_THROW_TIME = 2.5;
const SNOWBALL_SPEED = 14;
const SNOWBALL_REACH = 1.2;
const SNOWBALL_RADIUS = 1.3;
const SNOWMAN_WINDUP = 0.5;
// With two snowmen (Level 79 on), every second one throws SNOWMAN_OFFSET
// seconds out of step, so their timers run on their own
const SNOWMAN_OFFSET = 1.25;
const snowmanStartTimer = (index) => SNOWMAN_THROW_TIME - (index % 2) * SNOWMAN_OFFSET;

// Ice World's thin ice (Level 73 on): one corridor cell of dark, cracked ice
// on the path. Once any part of you has been on it for THIN_ICE_TIME seconds
// in a row it breaks (back to the start); stepping off starts the count again.
// The cracks spread and turn whiter as the count goes up, so you can see it
// is about to go.
const THIN_ICE_TIME = 2.0;

// Thin ice: dark blue-green ice you can see down into, with frosty white
// edges and white cracks running out from the middle (`more` = the extra
// cracks that appear as it's about to break, on a see-through canvas)
function thinIceTexture(more) {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const g = canvas.getContext('2d');
    let r = more ? 71 : 37;
    const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    if (!more) {
        const deep = g.createRadialGradient(size / 2, size / 2, 10, size / 2, size / 2, size * 0.75);
        deep.addColorStop(0, '#123e66');
        deep.addColorStop(0.6, '#2a6f9e');
        deep.addColorStop(1, '#bfe6f7');
        g.fillStyle = deep;
        g.fillRect(0, 0, size, size);
        // Bubbles frozen in the ice
        for (let k = 0; k < 40; k++) {
            g.fillStyle = `rgba(220,245,255,${0.2 + random() * 0.4})`;
            g.beginPath();
            g.arc(random() * size, random() * size, 1 + random() * 3, 0, Math.PI * 2);
            g.fill();
        }
        // Frosty rim
        g.strokeStyle = 'rgba(255,255,255,0.9)';
        g.lineWidth = 8;
        g.strokeRect(4, 4, size - 8, size - 8);
    }
    // Cracks: jagged white lines from near the middle out toward the edges,
    // with little side branches
    const cracks = more ? 14 : 9;
    for (let k = 0; k < cracks; k++) {
        const angle = (k / cracks) * Math.PI * 2 + random() * 0.6;
        let x = size / 2 + (random() - 0.5) * 30;
        let y = size / 2 + (random() - 0.5) * 30;
        g.strokeStyle = more ? 'rgba(255,255,255,0.95)' : 'rgba(240,250,255,0.9)';
        g.lineWidth = more ? 3 : 4.5;
        g.beginPath();
        g.moveTo(x, y);
        const steps = more ? 6 : 5;
        for (let s = 0; s < steps; s++) {
            const a = angle + (random() - 0.5) * 0.9;
            x += Math.cos(a) * size * 0.08;
            y += Math.sin(a) * size * 0.08;
            g.lineTo(x, y);
            if (random() < 0.4) {
                const b = a + (random() < 0.5 ? 1 : -1) * (0.6 + random() * 0.6);
                g.lineTo(x + Math.cos(b) * size * 0.05, y + Math.sin(b) * size * 0.05);
                g.moveTo(x, y);
            }
        }
        g.stroke();
    }
    return new THREE.CanvasTexture(canvas);
}

// Ice World walls: frosty blue ice blocks, stacked like bricks, that glow
// blue but can't be seen through. The same canvas is the glow map.
function iceBlockTexture(width, height, seed) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext('2d');
    let r = seed;
    const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    const rowHeight = width / 2;
    for (let y = 0, row = 0; y < height; y += rowHeight, row++) {
        for (let x = (row % 2) * -width / 2; x < width; x += width) {
            // Each block: a frosty blue, lighter toward its middle
            const shade = 0.85 + random() * 0.3;
            const grad = g.createLinearGradient(x, y, x + width, y + rowHeight);
            grad.addColorStop(0, `rgb(${70 * shade | 0},${150 * shade | 0},${225 * shade | 0})`);
            grad.addColorStop(0.5, `rgb(${120 * shade | 0},${195 * shade | 0},${250 * shade | 0})`);
            grad.addColorStop(1, `rgb(${60 * shade | 0},${135 * shade | 0},${215 * shade | 0})`);
            g.fillStyle = grad;
            g.fillRect(x, y, width, rowHeight);
            // Bright frosty seams round each block
            g.strokeStyle = 'rgba(225,248,255,0.9)';
            g.lineWidth = 3;
            g.strokeRect(x + 1.5, y + 1.5, width - 3, rowHeight - 3);
        }
    }
    // Frost speckles and a few thin cracks inside the ice
    for (let k = 0; k < (width * height) / 60; k++) {
        g.fillStyle = `rgba(235,250,255,${0.25 + random() * 0.5})`;
        g.fillRect(random() * width, random() * height, 1.5, 1.5);
    }
    g.strokeStyle = 'rgba(230,250,255,0.5)';
    g.lineWidth = 1;
    for (let c = 0; c < (width * height) / 3000; c++) {
        let x = random() * width;
        let y = random() * height;
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 4; k++) {
            x += (random() - 0.5) * 30;
            y += (random() - 0.5) * 30;
            g.lineTo(x, y);
        }
        g.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// Ice World floor: crunchy white snow with little patches of ice (just for
// looks: they aren't slippery)
function snowTexture(size, seed) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const g = canvas.getContext('2d');
    g.fillStyle = '#eef4fb';
    g.fillRect(0, 0, size, size);
    let r = seed;
    const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    // Crunchy bumps: soft blue-gray shadows and bright sparkles
    for (let k = 0; k < size * 6; k++) {
        const x = random() * size;
        const y = random() * size;
        g.fillStyle = random() < 0.5 ? `rgba(160,180,205,${0.2 + random() * 0.3})` : 'rgba(255,255,255,0.9)';
        g.beginPath();
        g.arc(x, y, 0.6 + random() * 1.6, 0, Math.PI * 2);
        g.fill();
    }
    // Ice patches: pale blue, shiny, with a white glint
    for (let k = 0; k < 5; k++) {
        const x = 20 + random() * (size - 40);
        const y = 20 + random() * (size - 40);
        const w = 10 + random() * 18;
        const h = 6 + random() * 12;
        const a = random() * Math.PI;
        g.fillStyle = 'rgba(150,215,245,0.85)';
        g.beginPath();
        g.ellipse(x, y, w, h, a, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.9)';
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(x - w * 0.4, y + h * 0.1);
        g.lineTo(x + w * 0.2, y - h * 0.3);
        g.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// The northern lights: soft green curtains that fade to purple at the top,
// and fade out at the bottom and the ends
function auroraTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const g = canvas.getContext('2d');
    const color = g.createLinearGradient(0, 128, 0, 0);
    color.addColorStop(0, 'rgba(60,255,150,0)');
    color.addColorStop(0.15, 'rgba(60,255,150,0.85)');
    color.addColorStop(0.55, 'rgba(90,230,170,0.6)');
    color.addColorStop(0.8, 'rgba(170,90,255,0.55)');
    color.addColorStop(1, 'rgba(170,90,255,0)');
    g.fillStyle = color;
    g.fillRect(0, 0, 256, 128);
    // Light streaks running up and down, and fading out at the ends
    g.globalCompositeOperation = 'destination-in';
    const ends = g.createLinearGradient(0, 0, 256, 0);
    ends.addColorStop(0, 'rgba(0,0,0,0)');
    ends.addColorStop(0.2, 'rgba(0,0,0,1)');
    ends.addColorStop(0.8, 'rgba(0,0,0,1)');
    ends.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = ends;
    g.fillRect(0, 0, 256, 128);
    g.globalCompositeOperation = 'source-over';
    let r = 19;
    const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 40; k++) {
        const x = 30 + random() * 196;
        g.fillStyle = `rgba(200,255,220,${0.05 + random() * 0.12})`;
        g.fillRect(x, 10 + random() * 30, 1 + random() * 3, 70 + random() * 30);
    }
    return new THREE.CanvasTexture(canvas);
}

// The crack's icy sides: glowing pale blue at the top, deeper blue further
// down, fading into dark blue (CRACK_DEPTH down, matching its far end, so no
// bottom is ever seen), with jagged facets in the ice
const CRACK_DEPTH = 60;
const CRACK_DEEP = 0x061a3a;
function crackIceTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 512;
    const g = canvas.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#c8f6ff');
    grad.addColorStop(0.02, '#4cc8ff');
    grad.addColorStop(0.1, '#1a62c4');
    grad.addColorStop(0.3, '#0b2f6e');
    grad.addColorStop(1, '#061a3a');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 512);
    let r = 29;
    const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 70; k++) {
        const y = random() * 512;
        const fade = 1 - y / 512;
        g.strokeStyle = `rgba(210,250,255,${0.5 * fade})`;
        g.lineWidth = 1;
        g.beginPath();
        let x = random() * 64;
        g.moveTo(x, y);
        for (let s = 0; s < 3; s++) {
            x += (random() - 0.5) * 30;
            g.lineTo(x, y + (random() - 0.3) * 40);
        }
        g.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    return texture;
}

// The sled: bright red wood
function sledTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const g = canvas.getContext('2d');
    g.fillStyle = '#c62828';
    g.fillRect(0, 0, 64, 64);
    for (let x = 0; x < 64; x += 16) {
        g.fillStyle = '#8e1b1b';
        g.fillRect(x, 0, 2, 64);
    }
    for (let k = 0; k < 30; k++) {
        g.fillStyle = 'rgba(255,140,120,0.25)';
        g.fillRect(Math.random() * 64, Math.random() * 64, 6, 1);
    }
    return new THREE.CanvasTexture(canvas);
}

// ---- Robot Factory World (Levels 81-90) ----

// Robot Factory World walls: rusty orange metal plates with rivets along
// their seams, rust streaks, and pipes running along them (painted on; the
// little puffs of steam from the pipes are added in addFactorySteam)
function rustyMetalTexture(width, height, seed) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext('2d');
    g.fillStyle = '#b5582a';
    g.fillRect(0, 0, width, height);
    let r = seed;
    const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    // Rust blotches, darker and lighter
    for (let i = 0; i < (width * height) / 260; i++) {
        const x = random() * width;
        const y = random() * height;
        const radius = 3 + random() * 14;
        const dark = random() < 0.6;
        const blotch = g.createRadialGradient(x, y, 0, x, y, radius);
        blotch.addColorStop(0, dark ? 'rgba(90,35,12,0.45)' : 'rgba(230,130,60,0.35)');
        blotch.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = blotch;
        g.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    // Rust running down in streaks
    for (let i = 0; i < width / 6; i++) {
        const x = random() * width;
        const y = random() * height;
        const grad = g.createLinearGradient(x, y, x, y + 40);
        grad.addColorStop(0, 'rgba(110,40,10,0.45)');
        grad.addColorStop(1, 'rgba(110,40,10,0)');
        g.fillStyle = grad;
        g.fillRect(x, y, 1.5 + random() * 2, 40);
    }
    // Plate seams with rivets
    const plate = 64;
    for (let y = 0; y < height; y += plate) {
        g.fillStyle = 'rgba(50,20,8,0.8)';
        g.fillRect(0, y, width, 2);
        for (let x = 6; x < width; x += 16) {
            g.fillStyle = 'rgba(60,24,8,0.9)';
            g.beginPath();
            g.arc(x, y + 7, 2.4, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = 'rgba(255,190,130,0.6)';
            g.beginPath();
            g.arc(x - 0.6, y + 6.4, 1, 0, Math.PI * 2);
            g.fill();
        }
    }
    g.fillStyle = 'rgba(50,20,8,0.8)';
    g.fillRect(0, 0, 2, height);
    // Pipes running along the wall: round-looking bands with a shine on top
    for (const [y, size, color] of [[height * 0.3, 14, [120, 120, 124]], [height * 0.62, 10, [150, 80, 40]], [height * 0.8, 8, [96, 98, 104]]]) {
        const grad = g.createLinearGradient(0, y - size / 2, 0, y + size / 2);
        const [cr, cg, cb] = color;
        grad.addColorStop(0, `rgb(${cr * 0.5},${cg * 0.5},${cb * 0.5})`);
        grad.addColorStop(0.3, `rgb(${Math.min(255, cr * 1.6)},${Math.min(255, cg * 1.6)},${Math.min(255, cb * 1.6)})`);
        grad.addColorStop(0.7, `rgb(${cr},${cg},${cb})`);
        grad.addColorStop(1, `rgb(${cr * 0.35},${cg * 0.35},${cb * 0.35})`);
        g.fillStyle = grad;
        g.fillRect(0, y - size / 2, width, size);
        // Joints (collars) along each pipe
        g.fillStyle = 'rgba(40,30,25,0.7)';
        for (let x = 20; x < width; x += 48) g.fillRect(x, y - size / 2 - 1.5, 4, size + 3);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// Robot Factory World floor: steel grating. One tile is one maze cell
// (4 units) with 3 x 3 big square holes, each about a quarter of a cell
// (1 unit) wide, between bars a third of a unit thick. The holes are
// see-through (alpha), so the machines whirring far below show through them.
// They're only for looking: the floor is still solid, so nothing falls
// through and walking is unchanged.
const GRATE_HOLES = 3;
function grateTexture(size) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const g = canvas.getContext('2d');
    g.clearRect(0, 0, size, size);
    const step = size / GRATE_HOLES; // one hole + one bar
    const bar = step * 0.25; // 1/3 unit of a 4/3 unit step -> 1 unit holes
    // Bars centred on k * step, drawn once more past the edge so the tile wraps
    const strips = (width, color) => {
        g.fillStyle = color;
        for (let k = 0; k <= GRATE_HOLES; k++) {
            const at = k * step - width / 2;
            g.fillRect(at, 0, width, size);
            g.fillRect(0, at, size, width);
        }
    };
    strips(bar, '#3e4247');
    strips(bar * 0.7, '#70767d');
    strips(bar * 0.2, '#a3a9b0');
    // Little bolts where the bars cross
    g.fillStyle = '#2d3034';
    for (let i = 0; i <= GRATE_HOLES; i++) {
        for (let j = 0; j <= GRATE_HOLES; j++) {
            g.beginPath();
            g.arc(i * step, j * step, bar * 0.22, 0, Math.PI * 2);
            g.fill();
        }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// The machine hall far under the grating: dark machine housings, belts and
// a few small blinking status lights (just to look at)
function machineFloorTexture(size, seed) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const g = canvas.getContext('2d');
    g.fillStyle = '#121418';
    g.fillRect(0, 0, size, size);
    let r = seed;
    const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 40; k++) {
        const w = 10 + random() * 40;
        const h = 10 + random() * 40;
        const x = random() * size;
        const y = random() * size;
        g.fillStyle = random() < 0.5 ? '#23272d' : '#1b1e23';
        g.fillRect(x, y, w, h);
        g.strokeStyle = '#2f343b';
        g.lineWidth = 1;
        g.strokeRect(x, y, w, h);
    }
    for (let k = 0; k < 30; k++) {
        g.fillStyle = ['#ff8a1f', '#3dff6e', '#ff3d3d', '#ffd23a'][k % 4];
        g.fillRect(random() * size, random() * size, 2, 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// The side walls of the big gap: dark steel with yellow-and-black hazard
// stripes just under the floor's edge, fading to black far down
function pitWallTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 512;
    const g = canvas.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#4a4e55');
    grad.addColorStop(0.5, '#24272c');
    grad.addColorStop(1, '#0d0e10');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 512);
    for (let x = -64; x < 128; x += 16) {
        g.fillStyle = '#f2c230';
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x + 8, 0);
        g.lineTo(x + 8 + 12, 12);
        g.lineTo(x + 12, 12);
        g.fill();
    }
    for (let y = 30; y < 512; y += 40) {
        g.fillStyle = 'rgba(0,0,0,0.4)';
        g.fillRect(0, y, 64, 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    return texture;
}

// The flattened tire's rubber: black with a chunky tread pattern
function treadTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 32;
    const g = canvas.getContext('2d');
    g.fillStyle = '#1c1c1e';
    g.fillRect(0, 0, 256, 32);
    g.fillStyle = '#323236';
    for (let x = 0; x < 256; x += 16) {
        g.fillRect(x, 4, 7, 10);
        g.fillRect(x + 8, 18, 7, 10);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// A gear's flat shape: teeth round the rim, a round hole in the middle and
// a ring of lightening holes
function gearShape(radius, teeth) {
    const shape = new THREE.Shape();
    const inner = radius * 0.86;
    for (let k = 0; k < teeth; k++) {
        const a = (k / teeth) * Math.PI * 2;
        const w = (Math.PI * 2) / teeth;
        const pts = [[inner, a], [radius, a + w * 0.15], [radius, a + w * 0.45], [inner, a + w * 0.6]];
        pts.forEach(([d, t], n) => {
            const x = Math.cos(t) * d;
            const y = Math.sin(t) * d;
            if (k === 0 && n === 0) shape.moveTo(x, y);
            else shape.lineTo(x, y);
        });
    }
    shape.closePath();
    const hub = new THREE.Path();
    hub.absarc(0, 0, radius * 0.18, 0, Math.PI * 2, true);
    shape.holes.push(hub);
    for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const hole = new THREE.Path();
        hole.absarc(Math.cos(a) * radius * 0.52, Math.sin(a) * radius * 0.52, radius * 0.16, 0, Math.PI * 2, true);
        shape.holes.push(hole);
    }
    return shape;
}

// The flattened tire (Level 81 on) moves at Level 27's fast-leaf speed
// (FAST_PLATFORM_SPEED, from an 'F' gap)
const PISTON_PERIOD = 1.6; // the machines under the gap: one pump up and down

// A backward belt's timer (Level 82; Gray, 2026-10-16): off and quiet
// (BELT_QUIET_TIME, or the level's beltQuiet), then the warning for
// BELT_WARNING_TIME (lights blink twice, two siren swells; still off), then
// on for BELT_ON_TIME
const BELT_QUIET_TIME = 4;
const BELT_WARNING_TIME = 2;
const BELT_ON_TIME = 3;
// With two backward belts (Level 89 on), every second one starts its cycle
// BELT_OFFSET seconds later (half a cycle), so the two belts' timers are
// independent and don't warn or run in step
const BELT_OFFSET = 3.5;
const BELT_SHOW_SPEED = 6; // how fast the belt's ridges race by while it's on (texture repeats per second)

// A robot-arm belt (Level 84; Gray, 2026-10-16; starting values Gray will
// judge): it carries you forward at ARM_BELT_SPEED (about 125% of walking,
// which is about 7.5 a second); an arm ARM_LENGTH long on one half of the
// belt appears at the far end every ARM_INTERVAL seconds (the first one
// ARM_FIRST_TIME after the level starts), alternating right and left, and
// slides back at ARM_SPEED (about walking speed); it is gone ARM_GONE from
// the belt's start end. ARM_GAP: the sliver down the middle line no arm
// covers.
const ARM_BELT_SPEED = 9.3;
const ARM_LENGTH = 3;
const ARM_INTERVAL = 3;
const ARM_FIRST_TIME = 1;
const ARM_SPEED = 7.5;
const ARM_GONE = 0.4;
const ARM_GAP = 0.1;
const ARM_APPEAR_TIME = 0.25;
// With two arm belts (Level 88 on), every second one starts ARM_OFFSET
// seconds later, so the two belts' arms don't come in step
const ARM_OFFSET = 1.5;

// The belt's rubber: dark, with raised ridges across it
function beltTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const g = canvas.getContext('2d');
    g.fillStyle = '#222326';
    g.fillRect(0, 0, 64, 64);
    for (let y = 0; y < 64; y += 16) {
        g.fillStyle = '#3a3c41';
        g.fillRect(0, y, 64, 6);
        g.fillStyle = '#4c4f55';
        g.fillRect(0, y, 64, 2);
    }
    g.fillStyle = 'rgba(242,194,48,0.85)';
    g.fillRect(0, 0, 4, 64);
    g.fillRect(60, 0, 4, 64);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
}


// ---- Desert Pyramid World (Levels 101-110) ----

// A button door (Desert Pyramid World, Level 101 on) slides down into the
// floor this fast once its button is pressed (starting value Gray will
// judge); you can walk through once it's this far open
const BUTTON_DOOR_OPEN_TIME = 1;
const BUTTON_DOOR_PASSABLE_FROM = 0.8;
// The button: a round stone plate this wide; any part of you on it presses it
const BUTTON_RADIUS = 0.6;
const BUTTON_HEIGHT = 0.1; // how far it sticks up before it's pressed
const BUTTON_SINK_TIME = 0.15;
// The fossil hunt (Dinosaur World, Level 113 on): each fossil's look, how
// close any part of you has to come to pick one up, and how long the
// door's padlock takes to pop off
const FOSSIL_KINDS = ['skull', 'shell', 'footprint'];
const FOSSIL_RADIUS = 0.45;
const FOSSIL_HEIGHT = 0.85;
const LOCK_POP_TIME = 0.7;
// The spinning secret wall (Level 103 on) turns around this fast (starting
// value Gray will judge), carrying you to its other side
export const SPIN_WALL_TIME = 1;
// Walking into it: this close to its face, pushing toward it
const SPIN_WALL_TOUCH = 0.08;

// A little picture carved in stone, like ancient Egyptian writing, drawn at
// (x, y) about `s` pixels tall: an eye, a bird, an ankh, water, a beetle, a
// reed, a snake, a sun. Dark cut lines with a light edge, like a carving.
function carveGlyph(g, kind, x, y, s) {
    g.save();
    g.translate(x, y);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const [dx, dy, color] of [[0.8, 0.8, 'rgba(255,236,190,0.55)'], [0, 0, 'rgba(110,70,25,0.8)']]) {
        g.save();
        g.translate(dx, dy);
        g.strokeStyle = color;
        g.fillStyle = color;
        g.lineWidth = Math.max(1.2, s / 9);
        g.beginPath();
        if (kind === 0) { // eye
            g.ellipse(0, 0, s * 0.45, s * 0.2, 0, 0, Math.PI * 2);
            g.moveTo(s * 0.08, 0);
            g.arc(0, 0, s * 0.08, 0, Math.PI * 2);
            g.moveTo(-s * 0.1, s * 0.2);
            g.quadraticCurveTo(-s * 0.15, s * 0.45, s * 0.05, s * 0.45);
            g.stroke();
        } else if (kind === 1) { // bird
            g.moveTo(-s * 0.3, s * 0.4);
            g.lineTo(-s * 0.1, s * 0.1);
            g.quadraticCurveTo(-s * 0.15, -s * 0.3, s * 0.1, -s * 0.35);
            g.lineTo(s * 0.3, -s * 0.3);
            g.moveTo(-s * 0.1, s * 0.1);
            g.quadraticCurveTo(s * 0.35, s * 0.05, s * 0.2, -s * 0.15);
            g.moveTo(0, s * 0.15);
            g.lineTo(0, s * 0.45);
            g.stroke();
        } else if (kind === 2) { // ankh
            g.ellipse(0, -s * 0.25, s * 0.14, s * 0.2, 0, 0, Math.PI * 2);
            g.moveTo(-s * 0.3, 0);
            g.lineTo(s * 0.3, 0);
            g.moveTo(0, -s * 0.05);
            g.lineTo(0, s * 0.45);
            g.stroke();
        } else if (kind === 3) { // water
            for (const row of [-0.2, 0.15]) {
                g.moveTo(-s * 0.4, row * s);
                for (let k = 1; k <= 8; k++) g.lineTo(-s * 0.4 + (k * s * 0.8) / 8, row * s + (k % 2 ? -s * 0.08 : s * 0.08));
            }
            g.stroke();
        } else if (kind === 4) { // beetle
            g.ellipse(0, s * 0.05, s * 0.2, s * 0.28, 0, 0, Math.PI * 2);
            g.moveTo(s * 0.12, -s * 0.3);
            g.arc(0, -s * 0.3, s * 0.12, 0, Math.PI * 2);
            for (const side of [-1, 1]) {
                g.moveTo(side * s * 0.2, -s * 0.05);
                g.lineTo(side * s * 0.4, -s * 0.2);
                g.moveTo(side * s * 0.2, s * 0.2);
                g.lineTo(side * s * 0.4, s * 0.38);
            }
            g.stroke();
        } else if (kind === 5) { // reed
            g.moveTo(0, s * 0.45);
            g.lineTo(0, -s * 0.2);
            g.moveTo(0, -s * 0.2);
            g.quadraticCurveTo(s * 0.25, -s * 0.3, s * 0.05, -s * 0.48);
            g.moveTo(0, s * 0.1);
            g.lineTo(-s * 0.15, -s * 0.05);
            g.stroke();
        } else if (kind === 6) { // snake
            g.moveTo(-s * 0.4, s * 0.3);
            g.bezierCurveTo(-s * 0.1, s * 0.5, -s * 0.2, -s * 0.1, s * 0.1, 0);
            g.bezierCurveTo(s * 0.35, s * 0.1, s * 0.3, -s * 0.35, s * 0.1, -s * 0.38);
            g.stroke();
        } else { // sun
            g.arc(0, 0, s * 0.2, 0, Math.PI * 2);
            for (let k = 0; k < 8; k++) {
                const a = (k * Math.PI) / 4;
                g.moveTo(Math.cos(a) * s * 0.3, Math.sin(a) * s * 0.3);
                g.lineTo(Math.cos(a) * s * 0.44, Math.sin(a) * s * 0.44);
            }
            g.stroke();
        }
        g.restore();
    }
    g.restore();
}

// Desert Pyramid World walls: big sandy-yellow stone blocks with carved
// pictures, like ancient Egyptian writing, in rows on some of the blocks
function sandstoneTexture(width, height, seed) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext('2d');
    g.fillStyle = '#d9b46a';
    g.fillRect(0, 0, width, height);
    let r = seed;
    const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    const rows = 4;
    const rowH = height / rows;
    for (let row = 0; row < rows; row++) {
        const y = row * rowH;
        const offset = row % 2 ? width / 2 : 0;
        for (let x = -width; x < width * 2; x += width) {
            const bx = x + offset;
            // Each block a slightly different sandy shade
            const shade = random() * 30 - 15;
            g.fillStyle = `rgb(${217 + shade},${180 + shade},${106 + shade * 0.6})`;
            g.fillRect(bx + 1.5, y + 1.5, width - 3, rowH - 3);
            // Weathered spots
            for (let k = 0; k < 40; k++) {
                g.fillStyle = random() < 0.5 ? 'rgba(160,115,55,0.18)' : 'rgba(255,235,180,0.18)';
                g.fillRect(bx + random() * width, y + random() * rowH, 1 + random() * 3, 1 + random() * 2);
            }
        }
        // Mortar lines: the long joint under the row and the joints between blocks
        g.fillStyle = 'rgba(120,85,40,0.75)';
        g.fillRect(0, y, width, 2);
        g.fillRect(offset % width, y, 2, rowH);
        if (offset) g.fillRect(0, y, 2, rowH);
        // Carved pictures on about every other block
        if (random() < 0.75) {
            for (let k = 0; k < 2; k++) for (let m = 0; m < 2; m++) carveGlyph(g, Math.floor(random() * 8), (width * (k + 0.5)) / 2, y + (rowH * (m + 0.5)) / 2, rowH * 0.3);
        }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// Dinosaur World walls (Level 111 on): big mossy gray-brown rocks piled at
// the bottom with giant green fern fronds growing up over them to the top.
// Tall canvases suit the tall wall faces.
function fernRockTexture(width, height, seed) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext('2d');
    g.fillStyle = '#2f5a24';
    g.fillRect(0, 0, width, height);
    let r = seed;
    const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    // Big rocks: piled along the bottom, and a few up among the ferns
    const rocks = ['#7d7468', '#8c8274', '#6e665b', '#958a7a', '#7a6f5f'];
    const rock = (x, y, w, h) => {
        g.fillStyle = rocks[Math.floor(random() * rocks.length)];
        g.beginPath();
        g.ellipse(x, y, w, h, (random() - 0.5) * 0.5, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.12)';
        g.beginPath();
        g.ellipse(x - w * 0.25, y - h * 0.35, w * 0.5, h * 0.3, 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = 'rgba(40,30,20,0.45)';
        g.lineWidth = 2;
        g.beginPath();
        g.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
        g.stroke();
        // A little moss on top
        g.fillStyle = 'rgba(90,140,50,0.55)';
        g.beginPath();
        g.ellipse(x + (random() - 0.5) * w * 0.4, y - h * 0.8, w * 0.45, h * 0.18, 0, 0, Math.PI * 2);
        g.fill();
    };
    // Fern fronds: a curving stem with leaflets on both sides, getting smaller to the tip
    const greens = ['#3f8f2f', '#4fa83a', '#2e7a26', '#5cb847', '#367f2b'];
    const frond = (x, y, length, angle) => {
        g.strokeStyle = '#2a5a1c';
        g.fillStyle = greens[Math.floor(random() * greens.length)];
        g.lineWidth = 2;
        let px = x;
        let py = y;
        let a = angle;
        const steps = 12;
        for (let s = 0; s < steps; s++) {
            const seg = length / steps;
            const nx = px + Math.cos(a) * seg;
            const ny = py + Math.sin(a) * seg;
            g.beginPath();
            g.moveTo(px, py);
            g.lineTo(nx, ny);
            g.stroke();
            const leaf = (1 - s / steps) * length * 0.22 + 2;
            for (const side of [-1, 1]) {
                const la = a + side * 1.1;
                g.beginPath();
                g.ellipse(nx + Math.cos(la) * leaf * 0.5, ny + Math.sin(la) * leaf * 0.5, leaf * 0.55, leaf * 0.18, la, 0, Math.PI * 2);
                g.fill();
            }
            px = nx;
            py = ny;
            a += 0.06;
        }
    };
    for (let k = 0; k < (width * height) / 1400; k++) {
        const x = random() * width;
        const y = height * (0.4 + random() * 0.38);
        frond(x, y, 50 + random() * 70, -Math.PI / 2 + (random() - 0.5) * 1.6);
    }
    // The rocks in front of the ferns' feet
    for (let k = 0; k < 14; k++) rock(random() * width, height * (0.7 + random() * 0.32), 32 + random() * 30, 26 + random() * 20);
    for (let k = 0; k < 3; k++) rock(random() * width, height * (0.15 + random() * 0.4), 22 + random() * 16, 18 + random() * 12);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// Dinosaur World floor: brown dirt with pebbles and huge three-toed
// dinosaur footprints pressed into it (just for looks)
function dinoDirtTexture(size, seed) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const g = canvas.getContext('2d');
    g.fillStyle = '#8f6a44';
    g.fillRect(0, 0, size, size);
    let r = seed;
    const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    const browns = ['#7f5c3a', '#9e7a50', '#73532f', '#a8845a', '#6a4c2c'];
    for (let i = 0; i < size * size / 24; i++) {
        g.fillStyle = browns[Math.floor(random() * browns.length)];
        const d = 1 + random() * 3;
        g.fillRect(random() * size, random() * size, d, d);
    }
    for (let i = 0; i < 40; i++) {
        g.fillStyle = random() < 0.5 ? '#b09a80' : '#6f6458';
        g.beginPath();
        g.ellipse(random() * size, random() * size, 2 + random() * 4, 2 + random() * 3, random() * 3, 0, Math.PI * 2);
        g.fill();
    }
    // Footprints: a round heel and three long toes, pressed in (dark inside, a light rim)
    const footprint = (x, y, s, angle) => {
        g.save();
        g.translate(x, y);
        g.rotate(angle);
        for (const [fill, grow] of [['rgba(220,190,150,0.35)', 1.12], ['#5a3f24', 1]]) {
            g.fillStyle = fill;
            g.beginPath();
            g.ellipse(0, s * 0.25, s * 0.32 * grow, s * 0.3 * grow, 0, 0, Math.PI * 2);
            g.fill();
            for (const toe of [-0.5, 0, 0.5]) {
                g.save();
                g.rotate(toe);
                g.beginPath();
                g.ellipse(0, -s * 0.38, s * 0.11 * grow, s * 0.42 * grow, 0, 0, Math.PI * 2);
                g.fill();
                g.restore();
            }
        }
        g.restore();
    };
    for (let k = 0; k < 3; k++) {
        const x = size * (0.2 + random() * 0.6);
        const y = size * (0.2 + random() * 0.6);
        footprint(x, y, size * 0.16, random() * Math.PI * 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// Pirate Ship World floor (Level 121 on): a wooden ship's deck, long planks
// with dark seams, wood grain, staggered plank ends and little nail heads
function deckTexture(size, seed) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const g = canvas.getContext('2d');
    let r = seed;
    const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    const woods = ['#b07a45', '#a5703e', '#ba854f', '#9c6a3a', '#b37d48'];
    const rows = 8;
    const h = size / rows;
    for (let row = 0; row < rows; row++) {
        const y = row * h;
        // Each plank row has one or two plank ends, in different places
        const ends = [random() * size];
        if (random() < 0.5) ends.push((ends[0] + size / 2) % size);
        ends.sort((a, b) => a - b);
        const cuts = [0, ...ends, size];
        for (let k = 0; k < cuts.length - 1; k++) {
            g.fillStyle = woods[Math.floor(random() * woods.length)];
            g.fillRect(cuts[k], y, cuts[k + 1] - cuts[k], h);
        }
        // Grain: thin wavy darker lines along the plank
        for (let k = 0; k < 4; k++) {
            g.strokeStyle = `rgba(90,55,25,${0.18 + random() * 0.18})`;
            g.lineWidth = 1;
            const gy = y + 3 + random() * (h - 6);
            g.beginPath();
            for (let x = 0; x <= size; x += 8) g.lineTo(x, gy + Math.sin(x * 0.05 + k * 2 + row) * 1.2);
            g.stroke();
        }
        // A knot now and then
        if (random() < 0.5) {
            g.fillStyle = 'rgba(80,45,20,0.55)';
            g.beginPath();
            g.ellipse(random() * size, y + h / 2, 4 + random() * 3, 2.2, 0, 0, Math.PI * 2);
            g.fill();
        }
        // The seam between plank rows, and the plank ends with a nail on each side
        g.fillStyle = '#4a2e16';
        g.fillRect(0, y, size, 2);
        for (const x of ends) {
            g.fillRect(x - 1, y, 2, h);
            g.fillStyle = '#2b2b2b';
            for (const dx of [-5, 5]) for (const dy of [h * 0.3, h * 0.7]) g.fillRect(x + dx - 1.5, y + dy - 1.5, 3, 3);
            g.fillStyle = '#4a2e16';
        }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// Pirate Ship World walls: stacked wooden crates and barrels, with the
// ship's rail along the top (one wall block = width x height pixels,
// the top of the canvas is the top of the wall)
function crateWallTexture(width, height, seed) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext('2d');
    let r = seed;
    const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    g.fillStyle = '#5a3a1e';
    g.fillRect(0, 0, width, height);
    const crate = (x, y, w, h) => {
        const tone = ['#b8864e', '#a8773f', '#c4945a', '#9f6f3a'][Math.floor(random() * 4)];
        g.fillStyle = tone;
        g.fillRect(x + 2, y + 2, w - 4, h - 4);
        // Boards across
        g.strokeStyle = 'rgba(70,40,15,0.5)';
        g.lineWidth = 2;
        for (let k = 1; k < 4; k++) {
            g.beginPath();
            g.moveTo(x + 2, y + (h * k) / 4);
            g.lineTo(x + w - 2, y + (h * k) / 4);
            g.stroke();
        }
        // The frame and the diagonal brace
        g.strokeStyle = '#6e4622';
        g.lineWidth = 9;
        g.strokeRect(x + 6, y + 6, w - 12, h - 12);
        g.beginPath();
        g.moveTo(x + 8, y + h - 8);
        g.lineTo(x + w - 8, y + 8);
        g.stroke();
        g.fillStyle = '#2b2b2b';
        for (const [nx, ny] of [[10, 10], [w - 10, 10], [10, h - 10], [w - 10, h - 10]]) g.fillRect(x + nx - 2, y + ny - 2, 4, 4);
    };
    const barrel = (x, y, w, h) => {
        g.fillStyle = '#3a2410';
        g.fillRect(x, y, w, h);
        const grad = g.createLinearGradient(x, 0, x + w, 0);
        grad.addColorStop(0, '#6b4220');
        grad.addColorStop(0.5, '#a8713c');
        grad.addColorStop(1, '#6b4220');
        g.fillStyle = grad;
        g.beginPath();
        g.ellipse(x + w / 2, y + h / 2, w / 2 - 3, h / 2 - 2, 0, 0, Math.PI * 2);
        g.fill();
        // Staves and iron hoops
        g.strokeStyle = 'rgba(60,35,15,0.6)';
        g.lineWidth = 2;
        for (let k = 1; k < 5; k++) {
            g.beginPath();
            g.moveTo(x + (w * k) / 5, y + 6);
            g.lineTo(x + (w * k) / 5, y + h - 6);
            g.stroke();
        }
        g.fillStyle = '#444046';
        for (const f of [0.22, 0.78]) g.fillRect(x + 6, y + h * f - 4, w - 12, 8);
    };
    // The rail along the top: a top bar on little posts
    const railH = height / 8;
    g.fillStyle = '#7a4c24';
    g.fillRect(0, 0, width, railH * 0.35);
    for (let x = 8; x < width; x += 32) g.fillRect(x, 0, 12, railH);
    g.fillStyle = 'rgba(255,230,180,0.25)';
    g.fillRect(0, 0, width, 4);
    // Crates and barrels stacked up below it
    const block = width;
    for (let y = railH; y < height - 2; y += block) {
        if (random() < 0.3) barrel(0, y, width, Math.min(block, height - y));
        else crate(0, y, width, Math.min(block, height - y));
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// The sea all round the ship (Pirate Ship World): deep blue with lighter
// wave crests
function seaTexture(size, seed) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const g = canvas.getContext('2d');
    g.fillStyle = '#1d6fa8';
    g.fillRect(0, 0, size, size);
    let r = seed;
    const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 60; k++) {
        const x = random() * size;
        const y = random() * size;
        const w = 8 + random() * 22;
        g.strokeStyle = `rgba(${random() < 0.5 ? '200,235,255' : '120,190,235'},${0.35 + random() * 0.35})`;
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x - w / 2, y);
        g.quadraticCurveTo(x, y - 4, x + w / 2, y);
        g.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// Sky World walls (Level 131 on): old gray stone blocks with green moss
// creeping over them, thickest along the top (one wall block = width x
// height pixels, the top of the canvas is the top of the wall)
function mossyStoneTexture(width, height, seed) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext('2d');
    let r = seed;
    const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    g.fillStyle = '#5d6168';
    g.fillRect(0, 0, width, height);
    const stones = ['#8a8f96', '#7d828a', '#959aa0', '#878c90', '#9ea29f'];
    const rowH = 32;
    for (let y = 0, row = 0; y < height; y += rowH, row++) {
        let x = row % 2 ? -width / 4 : 0;
        while (x < width) {
            const w = width * (0.35 + random() * 0.3);
            g.fillStyle = stones[Math.floor(random() * stones.length)];
            g.fillRect(x + 2, y + 2, w - 4, rowH - 4);
            // a little speckle and a crack now and then
            for (let k = 0; k < 14; k++) {
                g.fillStyle = `rgba(${random() < 0.5 ? '255,255,255' : '40,40,40'},0.12)`;
                g.fillRect(x + 2 + random() * (w - 6), y + 3 + random() * (rowH - 6), 2, 2);
            }
            if (random() < 0.25) {
                g.strokeStyle = 'rgba(40,42,46,0.6)';
                g.lineWidth = 1;
                g.beginPath();
                const cx = x + w * random();
                g.moveTo(cx, y + 3);
                g.lineTo(cx + 4 - random() * 8, y + rowH / 2);
                g.lineTo(cx + 4 - random() * 8, y + rowH - 3);
                g.stroke();
            }
            x += w;
        }
    }
    // Moss: soft green blobs, thick along the top, thinner further down
    for (let k = 0; k < 260; k++) {
        const y = Math.pow(random(), 2.2) * height;
        const x = random() * width;
        const size = 3 + random() * 9 * (1 - y / height);
        g.fillStyle = `rgba(${70 + random() * 40},${130 + random() * 50},${40 + random() * 30},${0.55 + random() * 0.35})`;
        g.beginPath();
        g.ellipse(x, y, size, size * 0.7, random() * 3, 0, Math.PI * 2);
        g.fill();
    }
    // a few drips of moss running down the cracks
    for (let k = 0; k < 10; k++) {
        const x = random() * width;
        g.fillStyle = 'rgba(80,140,50,0.6)';
        g.fillRect(x, 0, 2 + random() * 3, 20 + random() * 120);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// Mushroom Forest World walls: tall pale mushroom stems side by side, with
// soft vertical fibres and little glowing specks (it's night, so the stems
// glow a little themselves)
function mushroomStemTexture(width, height, seed) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext('2d');
    let r = seed;
    const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    const grad = g.createLinearGradient(0, 0, width, 0);
    grad.addColorStop(0, '#cbbd9e');
    grad.addColorStop(0.5, '#efe4c8');
    grad.addColorStop(1, '#cbbd9e');
    g.fillStyle = grad;
    g.fillRect(0, 0, width, height);
    // Fibres running up the stem
    for (let k = 0; k < 90; k++) {
        const x = random() * width;
        g.strokeStyle = `rgba(${random() < 0.5 ? '120,100,70' : '255,250,235'},${0.15 + random() * 0.2})`;
        g.lineWidth = 1 + random() * 1.5;
        g.beginPath();
        g.moveTo(x, 0);
        g.bezierCurveTo(x + random() * 6 - 3, height / 3, x + random() * 6 - 3, (2 * height) / 3, x + random() * 4 - 2, height);
        g.stroke();
    }
    // A frilly ring (like a real mushroom stem's) part way up
    const ringY = height * 0.28;
    g.fillStyle = 'rgba(250,244,226,0.9)';
    g.fillRect(0, ringY, width, 10);
    for (let x = 0; x < width; x += 8) {
        g.beginPath();
        g.arc(x + 4, ringY + 10, 4, 0, Math.PI);
        g.fill();
    }
    // Glowing specks: teal, lilac and lime
    const glows = ['rgba(120,255,230,0.9)', 'rgba(210,150,255,0.9)', 'rgba(190,255,110,0.9)'];
    for (let k = 0; k < 40; k++) {
        g.fillStyle = glows[Math.floor(random() * glows.length)];
        g.beginPath();
        g.arc(random() * width, random() * height, 1 + random() * 2, 0, Math.PI * 2);
        g.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// Mushroom Forest World floor: soft green moss, darker and lighter clumps
// with a few tiny glowing dots
function mossTexture(size, seed) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const g = canvas.getContext('2d');
    g.fillStyle = '#3f7a32';
    g.fillRect(0, 0, size, size);
    let r = seed;
    const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 500; k++) {
        const x = random() * size;
        const y = random() * size;
        const rad = 2 + random() * 7;
        const shade = random() * 50 - 25;
        g.fillStyle = `rgba(${60 + shade},${125 + shade},${45 + shade * 0.5},0.55)`;
        for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
            g.beginPath();
            g.arc(x + dx, y + dy, rad, 0, Math.PI * 2);
            g.fill();
        }
    }
    for (let k = 0; k < 30; k++) {
        g.fillStyle = random() < 0.5 ? 'rgba(200,255,120,0.9)' : 'rgba(140,255,230,0.8)';
        g.fillRect(random() * size, random() * size, 1.5, 1.5);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// Acid: bright glowing green with lighter swirls and bubbles
function acidTexture() {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const g = canvas.getContext('2d');
    g.fillStyle = '#39e52a';
    g.fillRect(0, 0, size, size);
    let r = 53;
    const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 60; k++) {
        const x = random() * size;
        const y = random() * size;
        const rad = 3 + random() * 12;
        const grad = g.createRadialGradient(x, y, 0, x, y, rad);
        grad.addColorStop(0, random() < 0.5 ? 'rgba(200,255,120,0.9)' : 'rgba(20,150,20,0.6)');
        grad.addColorStop(1, 'rgba(60,230,40,0)');
        g.fillStyle = grad;
        for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) g.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2);
    }
    for (let k = 0; k < 25; k++) {
        g.strokeStyle = 'rgba(230,255,180,0.8)';
        g.lineWidth = 1;
        g.beginPath();
        g.arc(random() * size, random() * size, 1 + random() * 2.5, 0, Math.PI * 2);
        g.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// Sky World floor: soft green grass with darker and lighter tufts and a few
// tiny white and yellow flowers
function grassTexture(size, seed) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const g = canvas.getContext('2d');
    g.fillStyle = '#5fae3e';
    g.fillRect(0, 0, size, size);
    let r = seed;
    const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < size * size / 6; k++) {
        const shade = random() * 50 - 25;
        g.strokeStyle = `rgba(${80 + shade},${160 + shade},${50 + shade * 0.5},0.7)`;
        g.lineWidth = 1;
        const x = random() * size;
        const y = random() * size;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + random() * 2 - 1, y - 2 - random() * 3);
        g.stroke();
    }
    for (let k = 0; k < 26; k++) {
        g.fillStyle = random() < 0.6 ? '#ffffff' : '#ffe14a';
        const x = random() * size;
        const y = random() * size;
        for (const [dx, dy] of [[-1.5, 0], [1.5, 0], [0, -1.5], [0, 1.5]]) {
            g.beginPath();
            g.arc(x + dx, y + dy, 1.2, 0, Math.PI * 2);
            g.fill();
        }
        g.fillStyle = '#f2b400';
        g.fillRect(x - 0.7, y - 0.7, 1.4, 1.4);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// Sky World: the sea of clouds far below the island, soft white puffs on
// pale blue
function cloudSeaTexture(size, seed) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const g = canvas.getContext('2d');
    g.fillStyle = '#cfe9ff';
    g.fillRect(0, 0, size, size);
    let r = seed;
    const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 90; k++) {
        const x = random() * size;
        const y = random() * size;
        const rad = 8 + random() * 26;
        const grad = g.createRadialGradient(x, y, 0, x, y, rad);
        grad.addColorStop(0, 'rgba(255,255,255,0.95)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad;
        // drawn wrapped, so the texture tiles without seams
        for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) g.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// Desert Pyramid World floor: golden sand with little wavy ripples (just
// for looks)
function desertSandTexture(size, seed) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const g = canvas.getContext('2d');
    g.fillStyle = '#e8bf6a';
    g.fillRect(0, 0, size, size);
    let r = seed;
    const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < (size * size) / 8; i++) {
        const shade = random() * 40 - 20;
        g.fillStyle = `rgba(${232 + shade},${190 + shade},${106 + shade},0.5)`;
        g.fillRect(random() * size, random() * size, 1 + random() * 1.5, 1 + random() * 1.5);
    }
    // Ripples: a light crest and a shadow just under it
    for (let y = 6; y < size; y += 16) {
        for (const [dy, color] of [[0, 'rgba(255,230,160,0.55)'], [2.5, 'rgba(170,120,50,0.35)']]) {
            g.strokeStyle = color;
            g.lineWidth = 2;
            g.beginPath();
            for (let x = 0; x <= size; x += 4) g.lineTo(x, y + dy + Math.sin((x / size) * Math.PI * 6 + y * 0.7) * 3);
            g.stroke();
        }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// A trapdoor flap: old wooden planks (across the flap) with dark gaps and
// grain lines
function woodPlankTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const g = canvas.getContext('2d');
    let r = 131;
    const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    const planks = 5;
    for (let k = 0; k < planks; k++) {
        const x = (k * 128) / planks;
        const shade = Math.floor(random() * 30);
        g.fillStyle = `rgb(${150 + shade},${100 + shade},${55 + shade / 2})`;
        g.fillRect(x, 0, 128 / planks, 128);
        g.strokeStyle = 'rgba(80,45,15,0.35)';
        g.lineWidth = 1;
        for (let l = 0; l < 5; l++) {
            const lx = x + 3 + random() * (128 / planks - 6);
            g.beginPath();
            for (let y = 0; y <= 128; y += 8) g.lineTo(lx + Math.sin(y * 0.08 + l) * 1.5, y);
            g.stroke();
        }
        g.fillStyle = '#3a2410';
        g.fillRect(x, 0, 2, 128);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// The button door's face: one big carved stone slab with a border, an eye
// at the top and rows of pictures under it
function doorSlabTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 320;
    const g = canvas.getContext('2d');
    g.fillStyle = '#c99a4e';
    g.fillRect(0, 0, 256, 320);
    let r = 211;
    const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 900; k++) {
        g.fillStyle = random() < 0.5 ? 'rgba(130,85,35,0.18)' : 'rgba(255,230,170,0.18)';
        g.fillRect(random() * 256, random() * 320, 1 + random() * 3, 1 + random() * 2);
    }
    g.strokeStyle = 'rgba(100,62,22,0.85)';
    g.lineWidth = 6;
    g.strokeRect(12, 12, 232, 296);
    g.strokeStyle = 'rgba(255,230,170,0.5)';
    g.lineWidth = 2;
    g.strokeRect(18, 18, 220, 284);
    carveGlyph(g, 0, 128, 70, 110);
    for (let row = 0; row < 3; row++) for (let k = 0; k < 4; k++) carveGlyph(g, (row * 4 + k + 1) % 8, 50 + k * 52, 150 + row * 55, 40);
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

// A fossil tablet's face (the fossil hunt): pale stone with a spiral shell
// or a three-toed dinosaur footprint pressed into it
function fossilTabletTexture(kind) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const g = canvas.getContext('2d');
    g.fillStyle = '#d9c9a0';
    g.fillRect(0, 0, 128, 128);
    for (let k = 0; k < 60; k++) {
        g.fillStyle = `rgba(120, 95, 60, ${0.08 + Math.random() * 0.1})`;
        g.beginPath();
        g.arc(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 3, 0, Math.PI * 2);
        g.fill();
    }
    g.strokeStyle = '#6b4e2a';
    g.fillStyle = '#7a5a32';
    g.lineCap = 'round';
    if (kind === 'shell') {
        // A spiral, with little ribs across it
        g.lineWidth = 6;
        g.beginPath();
        for (let a = 0; a < Math.PI * 6; a += 0.1) {
            const r = 4 + a * 2.7;
            const x = 64 + Math.cos(a) * r;
            const y = 64 + Math.sin(a) * r;
            if (a === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.stroke();
        g.lineWidth = 2;
        for (let a = 1; a < Math.PI * 6; a += 0.45) {
            const r = 4 + a * 2.7;
            g.beginPath();
            g.moveTo(64 + Math.cos(a) * (r - 5), 64 + Math.sin(a) * (r - 5));
            g.lineTo(64 + Math.cos(a) * (r + 5), 64 + Math.sin(a) * (r + 5));
            g.stroke();
        }
    } else {
        // A three-toed footprint: a round heel and three pointed toes
        g.beginPath();
        g.ellipse(64, 84, 18, 16, 0, 0, Math.PI * 2);
        g.fill();
        for (const a of [-0.55, 0, 0.55]) {
            g.save();
            g.translate(64, 78);
            g.rotate(a);
            g.beginPath();
            g.moveTo(-9, 0);
            g.quadraticCurveTo(-7, -40, 0, -52);
            g.quadraticCurveTo(7, -40, 9, 0);
            g.closePath();
            g.fill();
            g.restore();
        }
    }
    return new THREE.CanvasTexture(canvas);
}

// A soft round glow fading out to nothing (a fossil's halo)
function glowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const g = canvas.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.35)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
}

// The shortest distance between two line segments in a plane (0 if they cross)
function segmentDistance2D(p1, p2, q1, q2) {
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const d1 = cross(q1, q2, p1);
    const d2 = cross(q1, q2, p2);
    const d3 = cross(p1, p2, q1);
    const d4 = cross(p1, p2, q2);
    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return 0;
    const toSegment = (pt, a, b) => {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = dx * dx + dy * dy;
        const t = len ? Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / len)) : 0;
        return Math.hypot(pt.x - a.x - t * dx, pt.y - a.y - t * dy);
    };
    return Math.min(toSegment(p1, q1, q2), toSegment(p2, q1, q2), toSegment(q1, p1, p2), toSegment(q2, p1, p2));
}

export class Maze {
    // spikeRadius: how far the spike's plate reaches from its middle (0.75 normally;
    // Level 3's spike on the path is smaller so there's room to walk round it)
    // golden: the finale's door (Level 10) is gold instead of brown
    // spike2Radius: the second path spike's ('Z', Level 20) plate, the tighter squeeze
    // beltQuiet: how long a backward belt stays off and quiet before its
    // warning (Level 82: BELT_QUIET_TIME)
    // armInterval: how often each robot-arm belt sends an arm (one number,
    // or one per arm belt in layout order; ARM_INTERVAL normally)
    constructor(scene, layout, theme = DEFAULT_THEME, { wallHeight = 4, spikeRadius = SPIKE_RADIUS, spike2Radius = spikeRadius, golden = false, beltQuiet = BELT_QUIET_TIME, armInterval = ARM_INTERVAL, plank = 0, rocking = false } = {}) {
        this.beltQuietTime = beltQuiet;
        // Pirate Ship World: the whole ship rocks from side to side (Level 124 on)
        this.rocking = rocking ? { phase: 'calm', timer: ROCK_CALM_TIME, side: 1, angle: 0, tip: 0 } : null;
        // Pirate Ship World: every water gap is walked on a plank this fraction of the corridor wide (0 = cannon rides)
        this.plank = plank;
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
        // Blocks of sticky caramel ('C', Candy World, Level 52 on), keyed "x,z"
        this.caramelBlocks = new Set();
        // Sleepy mushrooms ('z', Mushroom Forest World, Level 143 on): the
        // middle of the corridor cell each stands in
        this.sleepyPositions = [];
        this.sleepies = [];
        // Bright fireflies ('e', Mushroom Forest World, Level 144 on): the
        // middle of the corridor cell each hovers over
        this.fireflyPositions = [];
        this.fireflies = [];
        // Blocks with no floor ('O'), crossed on moving platforms (one per gap);
        // 'F' is the same but its platform is a fast one (Level 27 on); in
        // Pirate Ship World a level with both kinds walks the plank over its
        // 'F' gaps and rides the cannons over its 'O' gaps (Level 127 on)
        const gapBlocks = [];
        // Water currents ('W' blocks, one corridor cell each; Level 41, two in
        // Level 49) and where each one's shove ends ('V', next to its cell)
        const currentBlocks = [];
        const currentTargets = [];
        // Steam vents ('H' blocks, one corridor cell each; Volcano World) and
        // where each one's puff pushes you ('Q', the middle of the cell before
        // it on the way from the start)
        const ventBlocks = [];
        const ventTargets = [];
        // Lava geysers ('K' blocks, one corridor cell each; Volcano World)
        const geyserBlocks = [];
        // Snowmen (Ice World): each one's hallway ('N' blocks), the snowman
        // himself ('M', two solid blocks against its end wall) and where a hit
        // in the hallway's first cell pushes you ('P', the cell before it)
        const hallBlocks = [];
        const snowmanBlocks = [];
        const hallTargets = [];
        // Thin ice ('T' blocks, one corridor cell each; Ice World, Level 73 on)
        const thinIceBlocks = [];
        // Backward belts ('B' blocks; Robot Factory World, Level 82 on) and
        // where each one flings you ('L', the first cell of its hallway)
        const beltBlocks = [];
        const beltLandings = [];
        // Robot-arm belts ('A' blocks; Level 84 on) and where an arm pushes
        // you ('R', the floor cell just before the belt)
        const armBlocks = [];
        const armLandings = [];
        // A button door ('J' blocks, the wall gap between two path cells;
        // Desert Pyramid World, Level 101 on) and its button ('U', the middle
        // of the last cell of a wrong way). A second button door in the same
        // level (Level 108) uses 'j' and its button 'u'.
        const buttonDoorBlocks = [[], []];
        const buttonPositions = [null, null];
        // A spinning secret wall ('E' blocks, the wall gap between two path
        // cells; Desert Pyramid World, Level 103 on)
        const spinBlocks = [];
        // Fossils ('f', the middle of the last cell of a wrong way; Dinosaur
        // World's fossil hunt, Level 113 on)
        const fossilPositions = [];
        // Windy hallways ('<', '>', '^', 'v' blocks: the wind blows west,
        // east, north or south along them; Sky World, Level 132 on)
        const windBlocks = { '<': [], '>': [], '^': [], 'v': [] };
        // A cloud trampoline ('k', the middle of the corridor cell it fills;
        // Sky World, Level 133 on): it bounces you over the plain wall at
        // the cell's far end (the side opposite its one opening)
        const trampolineCells = [];
        // Thick fog ('g' blocks: a straight stretch of the correct path;
        // Sky World, Level 134 on)
        const fogBlocks = [];
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
                if (ch === 'C') this.caramelBlocks.add(`${x},${z}`);
                if (ch === 'z') this.sleepyPositions.push(center);
                if (ch === 'e') this.fireflyPositions.push(center);
                if (ch === 'O' || ch === 'F') gapBlocks.push({ x, z, fast: ch === 'F' });
                if (ch === 'b') gapBlocks.push({ x, z, trench: true });
                if (ch === 'W') currentBlocks.push({ x, z });
                if (ch === 'V') currentTargets.push(center);
                if (ch === 'H') ventBlocks.push({ x, z });
                if (ch === 'Q') ventTargets.push(center);
                if (ch === 'K') geyserBlocks.push({ x, z });
                if (ch === 'N') hallBlocks.push({ x, z });
                if (ch === 'M') snowmanBlocks.push({ x, z });
                if (ch === 'P') hallTargets.push(center);
                if (ch === 'T') thinIceBlocks.push({ x, z });
                if (ch === 'B') beltBlocks.push({ x, z });
                if (ch === 'L') beltLandings.push(center);
                if (ch === 'A') armBlocks.push({ x, z });
                if (ch === 'R') armLandings.push(center);
                if (ch === 'J') buttonDoorBlocks[0].push({ x, z });
                if (ch === 'U') buttonPositions[0] = center;
                if (ch === 'j') buttonDoorBlocks[1].push({ x, z });
                if (ch === 'u') buttonPositions[1] = center;
                if (ch === 'E') spinBlocks.push({ x, z });
                if (ch === 'f') fossilPositions.push(center);
                if (windBlocks[ch]) windBlocks[ch].push({ x, z });
                if (ch === 'k') trampolineCells.push({ x, z });
                if (ch === 'g') fogBlocks.push({ x, z });
            }
        }
        this.currents = [];
        for (const blocks of currentTargets.length ? groupBlocks(currentBlocks) : []) {
            const xs = blocks.map((b) => b.x);
            const zs = blocks.map((b) => b.z);
            const c = {
                minX: Math.min(...xs), maxX: Math.max(...xs) + 1,
                minZ: Math.min(...zs), maxZ: Math.max(...zs) + 1,
            };
            c.center = new THREE.Vector3((c.minX + c.maxX) / 2, 0, (c.minZ + c.maxZ) / 2);
            // Its target is the nearest 'V' (the middle of the next cell over)
            const target = currentTargets.reduce((a, b) => (b.distanceTo(c.center) < a.distanceTo(c.center) ? b : a));
            // Which way it pushes: straight from its middle toward the target
            const d = target.clone().sub(c.center);
            c.dir = Math.abs(d.x) > Math.abs(d.z) ? new THREE.Vector3(Math.sign(d.x), 0, 0) : new THREE.Vector3(0, 0, Math.sign(d.z));
            c.target = target.clone();
            this.currents.push(c);
        }
        this.current = this.currents[0] ?? null;
        this.vents = [];
        for (const blocks of ventTargets.length ? groupBlocks(ventBlocks) : []) {
            const xs = blocks.map((b) => b.x);
            const zs = blocks.map((b) => b.z);
            const v = {
                minX: Math.min(...xs), maxX: Math.max(...xs) + 1,
                minZ: Math.min(...zs), maxZ: Math.max(...zs) + 1,
                phase: 'quiet', timer: VENT_QUIET_TIME,
            };
            v.center = new THREE.Vector3((v.minX + v.maxX) / 2, 0, (v.minZ + v.maxZ) / 2);
            v.target = ventTargets.reduce((a, b) => (b.distanceTo(v.center) < a.distanceTo(v.center) ? b : a)).clone();
            v.blocks = new Set(blocks.map((b) => `${b.x},${b.z}`));
            this.vents.push(v);
        }
        // Each vent splits the maze in two: its start side (every block you can
        // reach from the start without stepping on the vent) and its exit side
        // (everything else). A vent goes silent once you're past it.
        for (const v of this.vents) v.startSide = this.reachableAvoiding(v.blocks);
        // Dinosaur World reads 'H' as a tail swish instead (Level 112 on),
        // each on its own cycle; its push leaves you at its 'Q' like a vent's
        this.tails = [];
        if (this.theme.dino) {
            this.tails = this.vents.map((v, index) => this.setUpTail(v, index));
            this.vents = [];
        }
        // Sky World reads 'H' as a slow propeller instead (Level 135 on); a
        // blade's push leaves you at its 'Q' like a tail's
        this.propellers = [];
        if (this.theme.skyland) {
            this.propellers = this.vents.map((v, index) => {
                const t = this.setUpTail(v, index);
                return {
                    minX: t.minX, maxX: t.maxX, minZ: t.minZ, maxZ: t.maxZ, center: t.center, target: t.target, alongX: t.alongX,
                    // the blades start level with the hub (the hallway clear), each turn the same way
                    angle: Math.PI / 2 + index * 0.9, touching: false,
                };
            });
            this.vents = [];
        }
        // Pirate Ship World reads 'H' as a big wave (Level 123 on): the same
        // calm / warning / splash cycle and push back to its 'Q' as a steam
        // vent, but a wave rises over the ship's rail and sweeps the cell
        if (this.theme.pirate) {
            for (const [index, v] of this.vents.entries()) {
                const t = this.setUpTail(v, index);
                Object.assign(v, { wave: true, alongX: t.alongX, lo: t.lo, hi: t.hi, out: t.out });
                // A second wave runs WAVE_OFFSET seconds out of step
                v.timer -= (index % 2) * WAVE_OFFSET;
            }
        }
        // Each geyser keeps its own timer; with two (Level 64) the second starts
        // GEYSER_OFFSET seconds out of step, so they don't go off together
        this.geysers = groupBlocks(geyserBlocks).map((blocks, index) => {
            const xs = blocks.map((b) => b.x);
            const zs = blocks.map((b) => b.z);
            const g = {
                minX: Math.min(...xs), maxX: Math.max(...xs) + 1,
                minZ: Math.min(...zs), maxZ: Math.max(...zs) + 1,
                phase: 'quiet', timer: GEYSER_QUIET_TIME - (index % 2) * GEYSER_OFFSET, waiting: false, rise: 0,
            };
            g.center = new THREE.Vector3((g.minX + g.maxX) / 2, 0, (g.minZ + g.maxZ) / 2);
            return g;
        });
        // Desert Pyramid World uses 'K' for its trapdoors instead (Level 104 on),
        // each on its own timer
        this.trapdoors = [];
        if (this.theme.desert) {
            this.trapdoors = this.geysers.map((g, index) => ({
                minX: g.minX, maxX: g.maxX, minZ: g.minZ, maxZ: g.maxZ, center: g.center,
                phase: 'closed', timer: TRAPDOOR_CLOSED_TIME - (index % 2) * TRAPDOOR_OFFSET, open: 0,
            }));
            this.geysers = [];
        }
        // Each thin ice cell keeps its own count of how long you've stood on it
        this.thinIce = groupBlocks(thinIceBlocks).map((blocks) => {
            const xs = blocks.map((b) => b.x);
            const zs = blocks.map((b) => b.z);
            const t = { minX: Math.min(...xs), maxX: Math.max(...xs) + 1, minZ: Math.min(...zs), maxZ: Math.max(...zs) + 1, time: 0 };
            t.center = new THREE.Vector3((t.minX + t.maxX) / 2, 0, (t.minZ + t.maxZ) / 2);
            return t;
        });
        this.snowmen = groupBlocks([...hallBlocks, ...snowmanBlocks]).map((blocks, index) => this.setUpSnowman(blocks, snowmanBlocks, hallTargets, index));
        // How you hear each snowman (Gray, 2026-10-16): how far every floor
        // block is from his hallway along the corridors, and, like a steam
        // vent, his start side (every block reachable from the start without
        // entering the last cell of his hallway, where he stands)
        for (const sm of this.snowmen) {
            sm.steps = this.stepsFrom(sm.blocks);
            sm.startSide = this.reachableAvoiding(sm.lastCell);
        }
        this.belts = beltLandings.length ? groupBlocks(beltBlocks).map((blocks) => this.setUpBelt(blocks, beltLandings)) : [];
        this.belts.forEach((belt, index) => { belt.timer += (index % 2) * BELT_OFFSET; });
        this.armBeltSpeed = ARM_BELT_SPEED;
        this.armBelts = armLandings.length ? groupBlocks(armBlocks).map((blocks) => this.setUpArmBelt(blocks, armLandings)) : [];
        this.armBelts.forEach((belt, index) => {
            belt.interval = Array.isArray(armInterval) ? armInterval[index] ?? ARM_INTERVAL : armInterval;
            belt.timer = ARM_FIRST_TIME + (index % 2) * ARM_OFFSET;
        });
        // Each separate gap (a group of touching 'O' blocks) gets its own platform (Level 23 has two)
        this.plankGapsMarked = gapBlocks.some((b) => b.fast);
        this.platforms = groupBlocks(gapBlocks).map((blocks) => this.setUpPlatform(blocks));
        // Two rainbow bridges (Level 139 on) keep their own cycles: each later
        // one starts where the one before it is about to vanish, so they're
        // never solid and gone at the same moments
        this.platforms.filter((p) => p.rainbow).forEach((p, n) => {
            if (n % 2 === 1) Object.assign(p, { rainbowPhase: 'gone', rainbowTime: 0 });
        });
        this.platforms.filter((p) => p.carpet).forEach((p, index) => {
            p.time = (index % 2) * CARPET_OFFSET;
        });
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
        // A snowman is solid, like a wall (bumping into him isn't an Ouch)
        for (const s of this.snowmen) for (const { x, z } of s.solid) this.mazeData[x][z].fill(1);
        // Button doors start shut, solid like a wall
        this.buttonDoors = [];
        buttonDoorBlocks.forEach((blocks, index) => {
            const button = buttonPositions[index];
            if (!blocks.length || !button) return;
            const xs = blocks.map((b) => b.x);
            const zs = blocks.map((b) => b.z);
            const door = {
                blocks, button, pressed: false, open: 0, sink: 0, solid: false,
                minX: Math.min(...xs), maxX: Math.max(...xs) + 1, minZ: Math.min(...zs), maxZ: Math.max(...zs) + 1,
            };
            this.buttonDoors.push(door);
            this.setButtonDoorSolid(door, true);
        });
        // The fossil hunt: 3 fossils, each its own look, in the order they're
        // found reading the layout; the exit door stays locked until all are
        // collected
        // Each windy hallway: its blocks' box and the way the wind blows
        this.winds = [];
        for (const [ch, dir] of [['<', [-1, 0]], ['>', [1, 0]], ['^', [0, -1]], ['v', [0, 1]]]) {
            for (const blocks of groupBlocks(windBlocks[ch])) {
                const xs = blocks.map((b) => b.x);
                const zs = blocks.map((b) => b.z);
                this.winds.push({
                    minX: Math.min(...xs), maxX: Math.max(...xs) + 1,
                    minZ: Math.min(...zs), maxZ: Math.max(...zs) + 1,
                    dir: { x: dir[0], z: dir[1] },
                    blocks: new Set(blocks.map((b) => `${b.x},${b.z}`)),
                    bits: [],
                });
            }
        }
        this.trampolines = [];
        for (const { x, z } of trampolineCells) {
            const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dz]) => this.grid[x + 2 * dx]?.[z + 2 * dz] === 0);
            if (open.length !== 1) continue;
            const dir = { x: -open[0][0], z: -open[0][1] };
            this.trampolines.push({
                x, z, dir,
                center: new THREE.Vector3(x + 0.5, 0, z + 0.5),
                landing: new THREE.Vector3(x + 0.5 + 4 * dir.x, 0, z + 0.5 + 4 * dir.z),
                squish: 0,
                bouncing: null,
                view: false,
            });
        }
        // Each thick fog stretch: its blocks' box, and which way it runs
        this.fogs = groupBlocks(fogBlocks).map((blocks) => {
            const xs = blocks.map((b) => b.x);
            const zs = blocks.map((b) => b.z);
            const f = { minX: Math.min(...xs), maxX: Math.max(...xs) + 1, minZ: Math.min(...zs), maxZ: Math.max(...zs) + 1 };
            f.alongX = f.maxX - f.minX > f.maxZ - f.minZ;
            f.center = new THREE.Vector3((f.minX + f.maxX) / 2, 0, (f.minZ + f.maxZ) / 2);
            return f;
        });
        this.fossils = fossilPositions.map((position, index) => ({ position, kind: FOSSIL_KINDS[index % FOSSIL_KINDS.length], collected: false, t: index * 1.3 }));
        this.doorLock = null;
        // The spinning wall is solid like any wall (walking into it spins it)
        if (spinBlocks.length) {
            const xs = spinBlocks.map((b) => b.x);
            const zs = spinBlocks.map((b) => b.z);
            const w = { blocks: spinBlocks, minX: Math.min(...xs), maxX: Math.max(...xs) + 1, minZ: Math.min(...zs), maxZ: Math.max(...zs) + 1, angle: 0, spin: null };
            w.spansX = w.maxX - w.minX > 1; // the wall runs along x (you walk through it along z)
            w.center = new THREE.Vector3((w.minX + w.maxX) / 2, 0, (w.minZ + w.maxZ) / 2);
            w.across = spinBlocks.length;
            for (const { x, z } of spinBlocks) this.mazeData[x][z].fill(1);
            this.spinWall = w;
        }
    }

    // One snowman's hallway (Ice World): `blocks` are its 'N' and 'M' blocks.
    // Along the hallway, u runs from 0 at its entrance (the start's end) to
    // `length` at the end wall behind him; across it, v runs from 0 to its width.
    setUpSnowman(blocks, snowmanBlocks, targets, index = 0) {
        const xs = blocks.map((b) => b.x);
        const zs = blocks.map((b) => b.z);
        const s = {
            minX: Math.min(...xs), maxX: Math.max(...xs) + 1,
            minZ: Math.min(...zs), maxZ: Math.max(...zs) + 1,
            index, timer: snowmanStartTimer(index), balls: [],
        };
        const mine = new Set(blocks.map((b) => `${b.x},${b.z}`));
        s.solid = snowmanBlocks.filter((b) => mine.has(`${b.x},${b.z}`));
        s.alongX = s.maxX - s.minX > s.maxZ - s.minZ;
        const lo = s.alongX ? s.minX : s.minZ;
        const hi = s.alongX ? s.maxX : s.maxZ;
        const solidAlong = s.solid[0][s.alongX ? 'x' : 'z'] + 0.5;
        // He's at the high end when his blocks are nearer it
        s.sign = Math.abs(solidAlong - hi) < Math.abs(solidAlong - lo) ? 1 : -1;
        s.entrance = s.sign > 0 ? lo : hi;
        s.length = hi - lo;
        s.width = s.alongX ? s.maxZ - s.minZ : s.maxX - s.minX;
        // Its 'P' is the one nearest its entrance (with two snowmen, the
        // other one's can be nearer its middle)
        const entry = this.hallPoint(s, 0, s.width / 2);
        s.target = targets.reduce((a, b) => (b.distanceTo(entry) < a.distanceTo(entry) ? b : a)).clone();
        // His middle, and the way he faces (toward the start)
        s.center = new THREE.Vector3(
            s.solid.reduce((t, b) => t + b.x + 0.5, 0) / s.solid.length, 0,
            s.solid.reduce((t, b) => t + b.z + 0.5, 0) / s.solid.length);
        s.facing = s.alongX ? new THREE.Vector3(-s.sign, 0, 0) : new THREE.Vector3(0, 0, -s.sign);
        // His front, and where a snowball starts and ends (its middle)
        s.front = s.length - 1;
        s.startU = s.front - SNOWBALL_REACH;
        s.endU = SNOWBALL_REACH;
        // How long a snowball rolls if nothing stops it
        s.flight = (s.startU - s.endU) / SNOWBALL_SPEED;
        // His hallway's blocks, and those of its last cell (his cell)
        s.blocks = new Set(blocks.map((b) => `${b.x},${b.z}`));
        const lastCell = Math.floor((s.length - 1) / 4);
        s.lastCell = new Set(blocks
            .filter((b) => Math.floor(this.hallCoords(s, { x: b.x + 0.5, z: b.z + 0.5 }).u / 4) === lastCell)
            .map((b) => `${b.x},${b.z}`));
        return s;
    }

    // Hallway coordinates (u along from the entrance, v across) of a point
    hallCoords(s, point) {
        const along = s.alongX ? point.x : point.z;
        const across = s.alongX ? point.z - s.minZ : point.x - s.minX;
        return { u: (along - s.entrance) * s.sign, v: across };
    }

    // The world point at hallway coordinates (u, v)
    hallPoint(s, u, v) {
        const along = s.entrance + u * s.sign;
        return s.alongX ? new THREE.Vector3(along, 0, s.minZ + v) : new THREE.Vector3(s.minX + v, 0, along);
    }

    // Where a snowball hit pushes you: straight back to the middle of the
    // path cell before the one you're in, keeping to the same side of the
    // hallway (clear of its walls); from its first cell, to the middle of the
    // cell before the hallway
    snowballPush(s, point) {
        const { u, v } = this.hallCoords(s, point);
        const cell = Math.floor(Math.max(0, Math.min(s.length - 0.01, u)) / 4);
        if (cell === 0) return s.target.clone();
        return this.hallPoint(s, 4 * (cell - 1) + 1.5, Math.max(0.5, Math.min(s.width - 0.5, v)));
    }

    // Run every snowman's timer (only while playing), fly the snowballs, and
    // say what happened: [{ snowman, event: 'throw' | 'hit', target }]. A hit
    // means a snowball touched part of the player (a circle `radius` round
    // `point`); the snowball is gone and `target` is where to push them.
    updateSnowmen(dt, point, radius) {
        const events = [];
        for (const s of this.snowmen) {
            s.timer -= dt;
            if (s.timer <= 0) {
                s.timer += SNOWMAN_THROW_TIME;
                const ball = { u: s.startU, spin: 0 };
                s.balls.push(ball);
                events.push({ snowman: s, event: 'throw', ball });
            }
            const here = point ? this.hallCoords(s, point) : null;
            for (const ball of s.balls) {
                ball.u -= SNOWBALL_SPEED * dt;
                ball.spin += (SNOWBALL_SPEED * dt) / SNOWBALL_RADIUS;
                if (ball.u <= s.endU) ball.gone = true;
                if (!ball.gone && here) {
                    const du = Math.max(ball.u - SNOWBALL_REACH - here.u, 0, here.u - ball.u - SNOWBALL_REACH);
                    const dv = Math.max(-here.v, 0, here.v - s.width);
                    if (Math.hypot(du, dv) < radius) {
                        ball.gone = true;
                        events.push({ snowman: s, event: 'hit', ball, target: this.snowballPush(s, point) });
                    }
                }
            }
            s.balls = s.balls.filter((b) => !b.gone);
            this.showSnowman(s);
        }
        return events;
    }

    // Count how long the player (a circle `radius` round `point`) has been on
    // each thin ice cell, and say which ones just broke: [{ ice, event: 'break' }].
    // Stepping off starts the count again.
    updateThinIce(dt, point, radius) {
        const events = [];
        for (const t of this.thinIce) {
            const on = !!point && this.inGeyser(t, point, radius);
            t.time = on ? t.time + dt : 0;
            if (t.time >= THIN_ICE_TIME) {
                t.time = 0;
                events.push({ ice: t, event: 'break' });
            }
            this.showThinIce(t);
        }
        return events;
    }

    // Back to the start: every thin ice cell whole again
    resetThinIce() {
        for (const t of this.thinIce) {
            t.time = 0;
            this.showThinIce(t);
        }
    }

    // Thin ice: a slab of dark cracked ice over its cell, and a second layer of
    // cracks that shows up (and the ice sags and shivers) as the count goes up
    createThinIce(t) {
        const sizeX = t.maxX - t.minX;
        const sizeZ = t.maxZ - t.minZ;
        const slab = new THREE.Mesh(
            new THREE.BoxGeometry(sizeX + 0.004, 0.05, sizeZ + 0.004),
            new THREE.MeshStandardMaterial({ map: thinIceTexture(false), roughness: 0.05, metalness: 0.3, emissive: 0x0b3a66, emissiveIntensity: 0.35 }),
        );
        slab.position.set(t.center.x, 0.025, t.center.z);
        slab.receiveShadow = true;
        const cracks = new THREE.Mesh(
            new THREE.PlaneGeometry(sizeX, sizeZ),
            new THREE.MeshBasicMaterial({ map: thinIceTexture(true), transparent: true, opacity: 0, depthWrite: false }),
        );
        cracks.rotation.x = -Math.PI / 2;
        cracks.position.set(t.center.x, 0.056, t.center.z);
        this.root.add(slab, cracks);
        t.slab = slab;
        t.cracks = cracks;
        this.showThinIce(t);
    }

    showThinIce(t) {
        if (!t.slab) return;
        const k = Math.min(1, t.time / THIN_ICE_TIME);
        t.cracks.material.opacity = k;
        const shiver = k > 0.5 ? Math.sin(t.time * 60) * 0.006 * k : 0;
        t.slab.position.y = 0.025 - 0.02 * k + shiver;
        t.cracks.position.y = t.slab.position.y + 0.031;
    }

    // Back to the start: no snowballs in the air, timers start again
    resetSnowmen() {
        for (const s of this.snowmen) {
            s.timer = snowmanStartTimer(s.index);
            s.balls = [];
            this.showSnowman(s);
        }
    }

    build() {
        this.renderMaze();
        this.createDoor();
        if (this.spikePosition) this.createSpike(this.spikePosition, this.spikeRadius);
        if (this.spike2Position) this.createSpike(this.spike2Position, this.spike2Radius);
        if (this.spaceDoor) this.createSpaceDoor();
        if (this.slipperyBlocks.size) this.createSlipperySpots();
        if (this.caramelBlocks.size) this.createCaramelSpots();
        this.sleepies = this.sleepyPositions.map((position) => this.createSleepyMushroom(position));
        this.fireflies = this.fireflyPositions.map((position, n) => this.createFirefly(position, n));
        for (const p of this.platforms) this.createPlatform(p);
        for (const row of this.spikeRows) this.createSpikeRow(row);
        for (const c of this.currents) this.createCurrent(c);
        for (const v of this.vents) this.createVent(v);
        for (const t of this.tails) this.createTail(t);
        for (const p of this.propellers) this.createPropeller(p);
        for (const g of this.geysers) this.createGeyser(g);
        for (const t of this.trapdoors) this.createTrapdoor(t);
        for (const s of this.snowmen) this.createSnowman(s);
        for (const t of this.thinIce) this.createThinIce(t);
        for (const belt of this.belts) this.createBelt(belt);
        for (const belt of this.armBelts) this.createArmBelt(belt);
        for (const door of this.buttonDoors) this.createButtonDoor(door);
        if (this.spinWall) this.createSpinWall();
        for (const f of this.fossils) this.createFossil(f);
        for (const w of this.winds) this.createWind(w);
        for (const t of this.trampolines) this.createTrampoline(t);
        for (const f of this.fogs) this.createFog(f);
        this.scene.add(this.root);
    }

    // Remove the maze from the scene and free its memory
    dispose() {
        this.scene.remove(this.root);
        if (this.cloud) {
            this.scene.remove(this.cloud);
            this.cloud.geometry.dispose();
            this.cloud.material.dispose();
        }
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
        const sweets = this.theme.sweets;
        const volcano = this.theme.volcano;
        const ice = this.theme.ice;
        const factory = this.theme.factory;
        const desert = this.theme.desert;
        const dino = this.theme.dino;
        const pirate = this.theme.pirate;
        const skyland = this.theme.skyland;
        const mushroom = this.theme.mushroom;
        let wallMaterial;
        if (mushroom) {
            const stems = mushroomStemTexture(128, 512, 157);
            wallMaterial = new THREE.MeshStandardMaterial({ map: stems, emissiveMap: stems, emissive: 0xffffff, emissiveIntensity: 0.18, roughness: 0.85 });
        } else if (skyland) {
            wallMaterial = new THREE.MeshStandardMaterial({ map: mossyStoneTexture(128, 512, 149), roughness: 0.95, emissive: 0x1c2418, emissiveIntensity: 0.3 });
        } else if (pirate) {
            wallMaterial = new THREE.MeshStandardMaterial({ map: crateWallTexture(128, 512, 127), roughness: 0.85, emissive: 0x2a1808, emissiveIntensity: 0.3 });
        } else if (dino) {
            wallMaterial = new THREE.MeshStandardMaterial({ map: fernRockTexture(128, 512, 113), roughness: 0.95, emissive: 0x1a2a10, emissiveIntensity: 0.35 });
        } else if (desert) {
            wallMaterial = new THREE.MeshStandardMaterial({ map: sandstoneTexture(128, 512, 83), roughness: 0.9, emissive: 0x3a2808, emissiveIntensity: 0.3 });
        } else if (factory) {
            const metal = rustyMetalTexture(128, 512, 71);
            wallMaterial = new THREE.MeshStandardMaterial({ map: metal, roughness: 0.55, metalness: 0.45, emissiveMap: metal, emissive: 0xffffff, emissiveIntensity: 0.25 });
        } else if (ice) {
            const blocks = iceBlockTexture(128, 512, 47);
            wallMaterial = new THREE.MeshStandardMaterial({ map: blocks, emissiveMap: blocks, emissive: 0x4aa8ff, emissiveIntensity: 0.55, roughness: 0.15, metalness: 0.1 });
        } else if (volcano) {
            const rock = volcanoRockTexture(128, 512, 37);
            wallMaterial = new THREE.MeshStandardMaterial({ map: rock, emissiveMap: rock, emissive: 0xffffff, emissiveIntensity: 0.85, roughness: 0.18, metalness: 0.35 });
        } else if (sweets) {
            wallMaterial = new THREE.MeshStandardMaterial({ map: gumdropTexture(128, 512, 31), roughness: 0.45, emissive: 0x401028, emissiveIntensity: 0.25 });
        } else if (underwater) {
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
        this.wallMaterial = wallMaterial;
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
        if (sweets) this.addGumdropTops(count);
        if (mushroom) this.addMushroomTops(count);

        // Floor
        let floorMaterial;
        if (mushroom) {
            const map = mossTexture(256, 163);
            map.repeat.set(this.width / 8, this.depth / 8);
            floorMaterial = new THREE.MeshStandardMaterial({ map, roughness: 1 });
        } else if (skyland) {
            const map = grassTexture(256, 151);
            map.repeat.set(this.width / 8, this.depth / 8);
            floorMaterial = new THREE.MeshStandardMaterial({ map, roughness: 1 });
        } else if (pirate) {
            const map = deckTexture(256, 139);
            map.repeat.set(this.width / 8, this.depth / 8);
            floorMaterial = new THREE.MeshStandardMaterial({ map, roughness: 0.85 });
        } else if (dino) {
            const map = dinoDirtTexture(256, 127);
            map.repeat.set(this.width / 8, this.depth / 8);
            floorMaterial = new THREE.MeshStandardMaterial({ map, roughness: 1 });
        } else if (desert) {
            const map = desertSandTexture(256, 89);
            map.repeat.set(this.width / 8, this.depth / 8);
            floorMaterial = new THREE.MeshStandardMaterial({ map, roughness: 1 });
        } else if (factory) {
            // See-through grating: the holes are cut out (alphaTest), so the
            // machine hall below shows through them
            const map = grateTexture(256);
            map.repeat.set(this.width / 4, this.depth / 4);
            floorMaterial = new THREE.MeshStandardMaterial({ map, alphaTest: 0.5, roughness: 0.5, metalness: 0.6, side: THREE.DoubleSide });
        } else if (ice) {
            const map = snowTexture(256, 53);
            map.repeat.set(this.width / 8, this.depth / 8);
            // A soft blue glow so the snow in the walls' shadows looks cold blue, not gray
            floorMaterial = new THREE.MeshStandardMaterial({ map, roughness: 0.9, emissiveMap: map, emissive: 0x7f9cc8, emissiveIntensity: 0.4 });
        } else if (volcano) {
            const map = cooledLavaTexture(256, 43);
            map.repeat.set(this.width / 6, this.depth / 6);
            floorMaterial = new THREE.MeshStandardMaterial({ map, roughness: 0.4, metalness: 0.1 });
        } else if (sweets) {
            const map = chocolateTexture(128);
            map.repeat.set(this.width / 2, this.depth / 2);
            floorMaterial = new THREE.MeshStandardMaterial({ map, roughness: 0.55 });
        } else if (underwater) {
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
            floorMaterial.map?.repeat.set(factory ? 0.25 : dino || pirate || skyland || mushroom ? 0.125 : 0.5, factory ? 0.25 : dino || pirate || skyland || mushroom ? 0.125 : 0.5);
            // The gap's edges (the floor's cut sides) are dark, so they don't look like a ledge
            floor = new THREE.Mesh(geometry, [floorMaterial, new THREE.MeshBasicMaterial({ color: jungle ? 0x3b2414 : moon ? 0x4a4a4f : underwater ? 0x6b5a3e : sweets ? 0x2b160c : volcano ? 0x2a0a04 : ice ? 0x9fe6ff : factory ? 0x2a2c30 : desert ? 0x8a6428 : dino ? 0x4a3420 : pirate ? 0x3a2210 : skyland ? 0x5a3d22 : mushroom ? 0x2a1e2a : 0x0b0e18 })]);
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
        if (sweets) this.addCandySky();
        if (volcano) this.addAsh();
        if (ice) this.addIceSky();
        if (desert) this.addDesertSky();
        if (dino) this.addDinoSky();
        if (pirate) this.addPirateSky();
        if (skyland) this.addSkyIsland();
        if (mushroom) this.addMushroomSky();
        if (factory) {
            this.addMachineHall();
            this.addFactorySteam(count);
            this.addGearSky();
        }
    }

    // ---- Backward belts (Robot Factory World, Level 82 on) ----

    // One backward belt: its 'B' blocks (4 corridor cells, full width) and
    // the 'L' it flings you to (the middle of the first cell of its straight
    // hallway, on the start's side). "Backward" is toward the start: found by
    // walking the floor from the start without stepping on the belt, like a
    // platform's start edge.
    setUpBelt(blocks, landings) {
        const xs = blocks.map((b) => b.x);
        const zs = blocks.map((b) => b.z);
        const belt = {
            minX: Math.min(...xs), maxX: Math.max(...xs) + 1,
            minZ: Math.min(...zs), maxZ: Math.max(...zs) + 1,
            phase: 'quiet', timer: this.beltQuietTime, time: 0, slide: 0,
        };
        belt.center = new THREE.Vector3((belt.minX + belt.maxX) / 2, 0, (belt.minZ + belt.maxZ) / 2);
        belt.alongX = belt.maxX - belt.minX > belt.maxZ - belt.minZ;
        belt.landing = landings.reduce((a, b) => (b.distanceTo(belt.center) < a.distanceTo(belt.center) ? b : a)).clone();
        // The start's side is the end the landing is on
        belt.back = belt.alongX ? Math.sign(belt.landing.x - belt.center.x) : Math.sign(belt.landing.z - belt.center.z);
        return belt;
    }

    // Is any part of the player (a circle of `radius`) on the belt?
    onBelt(belt, point, radius) {
        return point.x + radius > belt.minX && point.x - radius < belt.maxX && point.z + radius > belt.minZ && point.z - radius < belt.maxZ;
    }

    // Run every belt's cycle (called every game step, so it stops while
    // paused): off and quiet, then the warning (still off), then on. While
    // it's on, anyone touching it is flung back. Returns events:
    // { belt, event: 'warning' | 'on' | 'off' | 'fling' }.
    updateBelts(dt, point, radius) {
        const events = [];
        for (const belt of this.belts) {
            belt.time += dt;
            belt.timer -= dt;
            if (belt.timer <= 0) {
                if (belt.phase === 'quiet') {
                    Object.assign(belt, { phase: 'warning', timer: belt.timer + BELT_WARNING_TIME });
                    events.push({ belt, event: 'warning' });
                } else if (belt.phase === 'warning') {
                    Object.assign(belt, { phase: 'on', timer: belt.timer + BELT_ON_TIME });
                    events.push({ belt, event: 'on' });
                } else {
                    Object.assign(belt, { phase: 'quiet', timer: belt.timer + this.beltQuietTime });
                    events.push({ belt, event: 'off' });
                }
            }
            if (belt.phase === 'on') {
                belt.slide += dt * BELT_SHOW_SPEED;
                if (this.onBelt(belt, point, radius)) events.push({ belt, event: 'fling' });
            }
            this.showBelt(belt);
        }
        return events;
    }

    // The belt: a dark rubber belt with raised ridges between two rollers,
    // metal rails along both walls, and on each side a yellow warning light
    // on the wall at each end; on the left side (facing along the belt from
    // the start's side) a big red siren light next to the near yellow one
    createBelt(belt) {
        const group = new THREE.Group();
        const length = belt.alongX ? belt.maxX - belt.minX : belt.maxZ - belt.minZ;
        const width = belt.alongX ? belt.maxZ - belt.minZ : belt.maxX - belt.minX;
        // Built along z (the belt's long side, +z = away from the start), then turned
        const map = beltTexture();
        map.repeat.set(1, length / 2);
        belt.map = map;
        const surface = new THREE.Mesh(new THREE.BoxGeometry(width - 0.1, 0.06, length), new THREE.MeshStandardMaterial({ map, roughness: 0.9 }));
        surface.position.y = 0.01;
        surface.receiveShadow = true;
        group.add(surface);
        const steel = new THREE.MeshStandardMaterial({ color: 0x8a9098, metalness: 0.7, roughness: 0.35 });
        for (const end of [-1, 1]) {
            const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, width - 0.1, 12), steel);
            roller.rotation.z = Math.PI / 2;
            roller.position.set(0, 0.04, end * (length / 2 - 0.05));
            group.add(roller);
        }
        const yellowOff = 0x1a1606;
        belt.yellows = [];
        for (const side of [-1, 1]) {
            const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, length), steel);
            rail.position.set(side * (width / 2 - 0.04), 0.07, 0);
            group.add(rail);
            for (const end of [-1, 1]) {
                const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), new THREE.MeshStandardMaterial({ color: 0x3a3214, emissive: yellowOff, emissiveIntensity: 1, roughness: 0.4 }));
                lamp.scale.x = 0.6;
                lamp.position.set(side * (width / 2 - 0.02), 2.3, end * (length / 2 - 0.6));
                group.add(lamp);
                // A glow round it while it's lit
                const halo = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.35, depthWrite: false }));
                halo.position.copy(lamp.position);
                halo.visible = false;
                group.add(halo);
                lamp.userData.halo = halo;
                const plate = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.46, 0.46), steel);
                plate.position.set(side * (width / 2 + 0.02), 2.3, end * (length / 2 - 0.6));
                group.add(plate);
                belt.yellows.push(lamp);
            }
        }
        // Facing +z (away from the start) the left is -x... unless the turn
        // below mirrors it, so pick the side after turning (see `left`)
        const towardEnd = new THREE.Vector3(0, 0, 1);
        const turn = belt.alongX ? (belt.back > 0 ? -Math.PI / 2 : Math.PI / 2) : (belt.back > 0 ? Math.PI : 0);
        towardEnd.applyAxisAngle(new THREE.Vector3(0, 1, 0), turn);
        // Left of facing direction d (x, z) with yaw 0 facing -z is (d.z, -d.x)
        const leftWorld = new THREE.Vector3(towardEnd.z, 0, -towardEnd.x);
        const leftLocal = leftWorld.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -turn);
        const leftSide = Math.sign(leftLocal.x) || -1;
        const red = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 12), new THREE.MeshStandardMaterial({ color: 0x3a0c0c, emissive: 0x200404, emissiveIntensity: 1, roughness: 0.4 }));
        red.scale.x = 0.6;
        red.position.set(leftSide * (width / 2 - 0.02), 2.3, -(length / 2 - 0.6) + 0.75);
        group.add(red);
        const redHalo = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0, depthWrite: false }));
        redHalo.position.copy(red.position);
        group.add(redHalo);
        belt.redHalo = redHalo;
        const redPlate = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.8, 0.8), steel);
        redPlate.position.set(leftSide * (width / 2 + 0.02), 2.3, -(length / 2 - 0.6) + 0.75);
        group.add(redPlate);
        belt.red = red;
        belt.redPosition = new THREE.Vector3();
        group.rotation.y = turn;
        group.position.copy(belt.center);
        this.root.add(group);
        group.updateMatrixWorld(true);
        red.getWorldPosition(belt.redPosition);
        belt.object = group;
        this.showBelt(belt);
    }

    // Lights and belt movement for the belt's current phase
    showBelt(belt) {
        if (!belt.object) return;
        // Warning: the yellow lights blink twice (on for the first half of
        // each second) and the red siren light swells with the siren
        const warn = belt.phase === 'warning';
        const into = warn ? BELT_WARNING_TIME - belt.timer : 0;
        const blink = warn && into % 1 < 0.5;
        for (const lamp of belt.yellows) {
            lamp.material.emissive.setHex(blink ? 0xffd23a : 0x1a1606);
            lamp.userData.halo.visible = blink;
        }
        const swell = warn ? Math.sin((into % 1) * Math.PI) : 0;
        belt.red.material.emissive.setRGB(0.12 + 0.88 * swell, 0.02 + 0.12 * swell, 0.02 + 0.12 * swell);
        belt.redHalo.material.opacity = 0.45 * swell;
        belt.redHalo.visible = swell > 0.01;
        // On: the ridges race backward, toward the start (-z in the belt's
        // own frame; the top face's v runs the other way to z)
        belt.map.offset.y = -belt.slide;
    }

    // ---- Robot-arm belts (Robot Factory World, Level 84 on) ----

    // One robot-arm belt: its 'A' blocks (6 corridor cells, full width) and
    // the 'R' an arm pushes you back to (the floor cell just before it).
    // "Forward" is away from that cell, toward the exit.
    setUpArmBelt(blocks, landings) {
        const xs = blocks.map((b) => b.x);
        const zs = blocks.map((b) => b.z);
        const belt = {
            minX: Math.min(...xs), maxX: Math.max(...xs) + 1,
            minZ: Math.min(...zs), maxZ: Math.max(...zs) + 1,
            arms: [], timer: ARM_FIRST_TIME, side: 1, slide: 0,
        };
        belt.center = new THREE.Vector3((belt.minX + belt.maxX) / 2, 0, (belt.minZ + belt.maxZ) / 2);
        belt.alongX = belt.maxX - belt.minX > belt.maxZ - belt.minZ;
        belt.length = belt.alongX ? belt.maxX - belt.minX : belt.maxZ - belt.minZ;
        belt.width = belt.alongX ? belt.maxZ - belt.minZ : belt.maxX - belt.minX;
        belt.landing = landings.reduce((a, b) => (b.distanceTo(belt.center) < a.distanceTo(belt.center) ? b : a)).clone();
        // Unit vectors: forward along the belt (toward the exit), and to its right
        const back = belt.alongX ? Math.sign(belt.landing.x - belt.center.x) : Math.sign(belt.landing.z - belt.center.z);
        belt.forward = belt.alongX ? new THREE.Vector3(-back, 0, 0) : new THREE.Vector3(0, 0, -back);
        // Facing d (yaw 0 faces -z), the left is (d.z, -d.x), so the right is (-d.z, d.x)
        belt.right = new THREE.Vector3(-belt.forward.z, 0, belt.forward.x);
        return belt;
    }

    // Is the middle of the player on this belt (so it carries them)?
    onArmBelt(belt, point) {
        return point.x > belt.minX && point.x < belt.maxX && point.z > belt.minZ && point.z < belt.maxZ;
    }

    // The arm belt under the player's middle, if any
    armBeltAt(point) {
        return this.armBelts.find((belt) => this.onArmBelt(belt, point)) ?? null;
    }

    // Where an arm is: `s` = how far its start-side end is from the belt's
    // start end, `side` = 1 for the right half, -1 for the left. Returns its
    // rectangle on the floor.
    armBox(belt, arm) {
        const c = belt.center;
        const along = -belt.length / 2 + arm.s + ARM_LENGTH / 2; // middle of the arm along the belt
        const across = arm.side * (belt.width / 4 + ARM_GAP / 2); // middle of its half, a sliver off the middle line
        const half = { along: ARM_LENGTH / 2, across: belt.width / 4 - ARM_GAP / 2 };
        const x = c.x + belt.forward.x * along + belt.right.x * across;
        const z = c.z + belt.forward.z * along + belt.right.z * across;
        const hx = belt.alongX ? half.along : half.across;
        const hz = belt.alongX ? half.across : half.along;
        return { minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz, x, z };
    }

    // Run every arm belt (called every game step, so the arms stop while
    // paused): the belt keeps running forward; a new arm appears at the far
    // end every ARM_INTERVAL seconds, on alternating halves (right, left,
    // right, ...), slides back toward the start at ARM_SPEED, and is gone
    // just before the start end. An arm touching the player pushes them off
    // the belt. Returns events: { belt, event: 'arm' | 'push' }.
    updateArmBelts(dt, point, radius) {
        const events = [];
        for (const belt of this.armBelts) {
            belt.slide += dt * ARM_BELT_SPEED;
            belt.timer -= dt;
            if (belt.timer <= 0) {
                belt.timer += belt.interval;
                belt.arms.push({ s: belt.length - ARM_LENGTH, side: belt.side, age: 0 });
                belt.side = -belt.side;
                events.push({ belt, event: 'arm' });
            }
            for (const arm of belt.arms) {
                arm.age += dt;
                arm.s -= ARM_SPEED * dt;
            }
            belt.arms = belt.arms.filter((arm) => {
                if (arm.s > ARM_GONE) return true;
                arm.object?.parent?.remove(arm.object);
                return false;
            });
            for (const arm of belt.arms) {
                const box = this.armBox(belt, arm);
                const nx = Math.max(box.minX, Math.min(point.x, box.maxX));
                const nz = Math.max(box.minZ, Math.min(point.z, box.maxZ));
                if ((point.x - nx) ** 2 + (point.z - nz) ** 2 < radius * radius) events.push({ belt, arm, event: 'push' });
            }
            this.showArmBelt(belt);
        }
        return events;
    }

    // The arm belt: a dark rubber belt with ridges (like the backward belt,
    // but running forward all the time) between rollers, with steel rails
    // and a yellow arrow strip down the middle line
    createArmBelt(belt) {
        const group = new THREE.Group();
        const { length, width } = belt;
        // Built along z (+z = forward, toward the exit), then turned
        const map = beltTexture();
        map.repeat.set(1, length / 2);
        belt.map = map;
        const surface = new THREE.Mesh(new THREE.BoxGeometry(width - 0.1, 0.06, length), new THREE.MeshStandardMaterial({ map, roughness: 0.9 }));
        surface.position.y = 0.01;
        surface.receiveShadow = true;
        group.add(surface);
        const steel = new THREE.MeshStandardMaterial({ color: 0x8a9098, metalness: 0.7, roughness: 0.35 });
        for (const end of [-1, 1]) {
            const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, width - 0.1, 12), steel);
            roller.rotation.z = Math.PI / 2;
            roller.position.set(0, 0.04, end * (length / 2 - 0.05));
            group.add(roller);
        }
        for (const side of [-1, 1]) {
            const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, length), steel);
            rail.position.set(side * (width / 2 - 0.04), 0.07, 0);
            group.add(rail);
        }
        // Little yellow arrows painted on the walls' rails, pointing forward
        const arrow = new THREE.MeshStandardMaterial({ color: 0xf2c230, emissive: 0x5a4300, emissiveIntensity: 0.6 });
        for (let k = 0; k < Math.floor(length / 4); k++) {
            for (const side of [-1, 1]) {
                const shape = new THREE.Shape();
                shape.moveTo(-0.18, 0);
                shape.lineTo(0.18, 0);
                shape.lineTo(0, 0.3);
                shape.closePath();
                const mark = new THREE.Mesh(new THREE.ShapeGeometry(shape), arrow);
                mark.rotation.x = -Math.PI / 2;
                mark.rotation.z = Math.PI;
                mark.position.set(side * (width / 2 - 0.04), 0.15, -length / 2 + 2 + k * 4);
                group.add(mark);
            }
        }
        // +z (local) must point forward
        const turn = Math.atan2(belt.forward.x, belt.forward.z);
        group.rotation.y = turn;
        group.position.copy(belt.center);
        this.root.add(group);
        belt.object = group;
        belt.steel = steel;
        this.showArmBelt(belt);
    }

    // One robot arm, lying flat: a metal hand with three claw fingers at the
    // start-side end (the end coming at you), a forearm, an elbow joint, an
    // upper arm, and at the broken end a torn shoulder with sparking wires
    // (just for looks; the whole thing pushes you). Built with +z forward.
    createArm(belt, arm) {
        const group = new THREE.Group();
        const metal = new THREE.MeshStandardMaterial({ color: 0xb8bec6, metalness: 0.5, roughness: 0.4, emissive: 0x3a3e45, emissiveIntensity: 1 });
        const dark = new THREE.MeshStandardMaterial({ color: 0x6a7079, metalness: 0.5, roughness: 0.5, emissive: 0x1e2126, emissiveIntensity: 1 });
        const across = belt.width / 2 - ARM_GAP; // how wide the arm's half is
        const L = ARM_LENGTH;
        // Hand (start-side end, local z = -L/2): a palm and three fingers
        const palm = new THREE.Mesh(new THREE.BoxGeometry(across * 0.8, 0.3, 0.5), metal);
        palm.position.set(0, 0.2, -L / 2 + 0.55);
        group.add(palm);
        for (const f of [-1, 0, 1]) {
            const finger = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.45), dark);
            finger.position.set(f * across * 0.33, 0.14, -L / 2 + 0.2);
            finger.rotation.y = f * 0.25;
            group.add(finger);
        }
        // Forearm, elbow, upper arm: chunky cylinders lying along the belt
        const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, L * 0.38, 12), metal);
        fore.rotation.x = Math.PI / 2;
        fore.position.set(0, 0.28, -L / 2 + 0.8 + L * 0.19);
        group.add(fore);
        const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.33, 14, 10), dark);
        elbow.position.set(0, 0.3, -L / 2 + 0.8 + L * 0.38);
        group.add(elbow);
        const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, L * 0.3, 12), metal);
        upper.rotation.x = Math.PI / 2;
        upper.position.set(0, 0.32, L / 2 - 0.15 - L * 0.15);
        group.add(upper);
        // The broken end: a jagged torn rim and dangling wires
        const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 8), dark);
        rim.rotation.x = Math.PI / 2;
        rim.position.set(0, 0.32, L / 2 - 0.12);
        group.add(rim);
        const wireColors = [0xd83a2a, 0x2a7ad8, 0xf2c230];
        wireColors.forEach((color, k) => {
            const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6), new THREE.MeshStandardMaterial({ color }));
            wire.rotation.x = Math.PI / 2 + (k - 1) * 0.4;
            wire.rotation.z = (k - 1) * 0.5;
            wire.position.set((k - 1) * 0.12, 0.3 + (k - 1) * 0.05, L / 2 + 0.05);
            group.add(wire);
        });
        // Sparks flickering at the wires' ends
        const sparkGeometry = new THREE.BufferGeometry();
        sparkGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(10 * 3), 3));
        const sparks = new THREE.Points(sparkGeometry, new THREE.PointsMaterial({ color: 0xfff6a0, size: 0.09 }));
        group.add(sparks);
        const glow = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), new THREE.MeshBasicMaterial({ color: 0x8fe0ff, transparent: true, opacity: 0.5, depthWrite: false }));
        glow.position.set(0, 0.3, L / 2 + 0.25);
        group.add(glow);
        group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        arm.object = group;
        arm.sparks = sparks;
        arm.glow = glow;
        this.root.add(group);
    }

    // Belt ridges race forward; arms slide (and pop up as they appear)
    showArmBelt(belt) {
        if (!belt.object) return;
        belt.map.offset.y = belt.slide / 2;
        const turn = Math.atan2(belt.forward.x, belt.forward.z);
        for (const arm of belt.arms) {
            if (!arm.object) this.createArm(belt, arm);
            const box = this.armBox(belt, arm);
            arm.object.position.set(box.x, 0, box.z);
            arm.object.rotation.y = turn;
            // It drops onto the belt as it appears, and sinks away as it goes
            const grow = Math.min(1, arm.age / ARM_APPEAR_TIME);
            const fade = Math.min(1, Math.max(0, (arm.s - ARM_GONE) / 0.6));
            arm.object.scale.setScalar(Math.max(0.01, Math.min(grow, fade)));
            const sp = arm.sparks.geometry.attributes.position;
            for (let k = 0; k < sp.count; k++) sp.setXYZ(k, (Math.random() - 0.5) * 0.5, 0.3 + (Math.random() - 0.3) * 0.4, ARM_LENGTH / 2 + 0.15 + Math.random() * 0.35);
            sp.needsUpdate = true;
            arm.glow.material.opacity = 0.25 + Math.random() * 0.4;
        }
    }

    // ---- Robot Factory World (Level 81 on) ----

    // The machine hall under the grating: a dark floor of machines about 3
    // below, with gears lying flat and whirring round. Seen only through the
    // grating's little holes; just to look at. Cut away under each big gap
    // (the gap has its own deep pit).
    addMachineHall() {
        const margin = 2;
        const outline = new THREE.Shape([new THREE.Vector2(-margin, -margin), new THREE.Vector2(this.width + margin, -margin), new THREE.Vector2(this.width + margin, this.depth + margin), new THREE.Vector2(-margin, this.depth + margin)]);
        for (const { gap: g } of this.platforms) {
            outline.holes.push(new THREE.Path([new THREE.Vector2(g.minX, g.minZ), new THREE.Vector2(g.minX, g.maxZ), new THREE.Vector2(g.maxX, g.maxZ), new THREE.Vector2(g.maxX, g.minZ)]));
        }
        const geometry = new THREE.ShapeGeometry(outline);
        geometry.rotateX(Math.PI / 2);
        const map = machineFloorTexture(256, 89);
        map.repeat.set(1 / 12, 1 / 12);
        const hall = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide }));
        hall.position.y = -3;
        this.root.add(hall);
        // Whirring gears, lying flat
        const inGap = (x, z) => this.platforms.some(({ gap: g }) => x > g.minX - 1.6 && x < g.maxX + 1.6 && z > g.minZ - 1.6 && z < g.maxZ + 1.6);
        const gearGeometry = new THREE.ExtrudeGeometry(gearShape(1.3, 14), { depth: 0.25, bevelEnabled: false });
        gearGeometry.rotateX(-Math.PI / 2);
        const gearMaterial = new THREE.MeshStandardMaterial({ color: 0x5a5f66, metalness: 0.7, roughness: 0.4, emissive: 0x1a1c20, emissiveIntensity: 1 });
        const brass = new THREE.MeshStandardMaterial({ color: 0x8a6a3a, metalness: 0.7, roughness: 0.45, emissive: 0x20160a, emissiveIntensity: 1 });
        this.hallGears = [];
        let r = 97;
        const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
        const count = Math.round((this.width * this.depth) / 45);
        for (let k = 0; k < count; k++) {
            const x = random() * this.width;
            const z = random() * this.depth;
            if (inGap(x, z)) continue;
            const gear = new THREE.Mesh(gearGeometry, k % 3 === 0 ? brass : gearMaterial);
            const size = 0.6 + random() * 0.8;
            gear.scale.set(size, 1, size);
            gear.position.set(x, -2.9 + random() * 0.6, z);
            gear.userData.speed = (random() < 0.5 ? -1 : 1) * (1.5 + random() * 3);
            this.root.add(gear);
            this.hallGears.push(gear);
        }
    }

    // Little puffs of steam from the pipes on the walls (decoration only:
    // they go straight through you and never push). Each puff comes out of a
    // pipe on a wall face, drifts up and out a little and is gone, over and
    // over, each on its own beat.
    addFactorySteam() {
        let r = 101;
        const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
        const faces = [];
        for (let x = 1; x < this.width - 1; x++) for (let z = 1; z < this.depth - 1; z++) {
            if (this.grid[x][z] !== 1) continue;
            for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (this.grid[x + dx]?.[z + dz] === 0) faces.push({ x, z, dx, dz });
        }
        const emitters = [];
        const wanted = Math.round((this.width * this.depth) / 20);
        for (let k = 0; k < wanted && faces.length; k++) {
            const f = faces.splice(Math.floor(random() * faces.length), 1)[0];
            emitters.push({ ...f, y: this.height * (random() < 0.5 ? 0.7 : 0.38), phase: random() });
        }
        const PER = 5;
        const positions = new Float32Array(emitters.length * PER * 3);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({ color: 0xf4f4f4, size: 0.9, map: puffTexture(), transparent: true, opacity: 0.75, depthWrite: false });
        this.wallSteam = { points: new THREE.Points(geometry, material), emitters, per: PER, time: 0 };
        this.root.add(this.wallSteam.points);
        this.updateFactorySteam(0);
    }

    updateFactorySteam(dt) {
        const w = this.wallSteam;
        w.time += dt;
        const pos = w.points.geometry.attributes.position;
        w.emitters.forEach((e, n) => {
            for (let k = 0; k < w.per; k++) {
                // Puffs come in little bursts: each one lives 1.2 s of every 3 s
                const t = ((w.time / 3 + e.phase + k * 0.08) % 1) * 3;
                const alive = t < 1.2;
                const out = 0.5 + 0.05 + (alive ? t * 0.35 : 0);
                const up = alive ? t * 0.6 : -50;
                pos.setXYZ(n * w.per + k, e.x + 0.5 + e.dx * out, e.y + up, e.z + 0.5 + e.dz * out);
            }
        });
        pos.needsUpdate = true;
    }

    // The sky: giant gears turning slowly, high up all round (just to look at)
    addGearSky() {
        const cx = this.width / 2;
        const cz = this.depth / 2;
        let r = 107;
        const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
        this.skyGears = [];
        const steel = new THREE.MeshStandardMaterial({ color: 0x7d838c, metalness: 0.6, roughness: 0.45, emissive: 0x2a2d33, emissiveIntensity: 1, fog: false });
        const bronze = new THREE.MeshStandardMaterial({ color: 0x9a7438, metalness: 0.6, roughness: 0.5, emissive: 0x3a2a12, emissiveIntensity: 1, fog: false });
        for (let k = 0; k < 9; k++) {
            const radius = 18 + random() * 26;
            const geometry = new THREE.ExtrudeGeometry(gearShape(radius, 16 + Math.round(radius / 3)), { depth: 3, bevelEnabled: false });
            geometry.translate(0, 0, -1.5);
            const gear = new THREE.Mesh(geometry, k % 2 ? bronze : steel);
            const holder = new THREE.Group();
            const a = (k / 9) * Math.PI * 2 + random() * 0.4;
            const d = 90 + random() * 90;
            holder.position.set(cx + Math.cos(a) * d, 70 + random() * 80, cz + Math.sin(a) * d);
            holder.lookAt(cx, 0, cz);
            holder.add(gear);
            gear.userData.speed = (k % 2 ? 1 : -1) * (0.05 + random() * 0.08);
            this.root.add(holder);
            this.skyGears.push(gear);
        }
        // One huge gear right overhead
        const top = new THREE.Mesh(new THREE.ExtrudeGeometry(gearShape(60, 36), { depth: 4, bevelEnabled: false }), steel);
        const holder = new THREE.Group();
        holder.position.set(cx, 170, cz);
        holder.lookAt(cx, 0, cz);
        holder.add(top);
        top.userData.speed = 0.03;
        this.root.add(holder);
        this.skyGears.push(top);
    }

    // Everything in Robot Factory World that moves just for looks (every frame)
    updateFactory(dt) {
        this.factoryTime = (this.factoryTime ?? 0) + dt;
        for (const gear of this.hallGears || []) gear.rotation.y += gear.userData.speed * dt;
        for (const gear of this.skyGears || []) gear.rotation.z += gear.userData.speed * dt;
        if (this.wallSteam) this.updateFactorySteam(dt);
        for (const z of this.zappers || []) this.updateZapper(z, dt);
        for (const p of this.platforms) {
            for (const piston of p.pistons || []) {
                const t = ((this.factoryTime / PISTON_PERIOD + piston.phase) % 1) * Math.PI * 2;
                piston.rod.position.y = piston.low + (Math.sin(t) * 0.5 + 0.5) * piston.travel;
            }
        }
    }

    // A zapper (Robot Factory World's spike): two copper posts on a hazard
    // plate with electricity crackling between them, sparks flying and a blue
    // glow. Touching it works like a spike (its plate is radius).
    createZapper(position, radius) {
        const group = new THREE.Group();
        const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.75, 0.08, 24), new THREE.MeshStandardMaterial({ color: 0x2c2f34, metalness: 0.6, roughness: 0.5 }));
        plate.position.y = 0.04;
        group.add(plate);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.05, 6, 32), new THREE.MeshStandardMaterial({ color: 0xf2c230, emissive: 0x6a5000, emissiveIntensity: 0.6 }));
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.09;
        group.add(ring);
        const copper = new THREE.MeshStandardMaterial({ color: 0xc8743a, metalness: 0.8, roughness: 0.3 });
        const coilMaterial = new THREE.MeshStandardMaterial({ color: 0x9fe8ff, emissive: 0x40c8ff, emissiveIntensity: 1.2 });
        const tops = [];
        for (const side of [-1, 1]) {
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.95, 10), copper);
            post.position.set(side * 0.38, 0.55, 0);
            post.castShadow = true;
            group.add(post);
            for (let k = 0; k < 4; k++) {
                const coil = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 6, 16), copper);
                coil.rotation.x = Math.PI / 2;
                coil.position.set(side * 0.38, 0.35 + k * 0.14, 0);
                group.add(coil);
            }
            const ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), coilMaterial);
            ball.position.set(side * 0.38, 1.08, 0);
            group.add(ball);
            tops.push(ball.position.clone());
        }
        // Two crackling arcs between the posts' tops, redrawn every frame:
        // each is a zigzag of short glowing bars
        const arcs = [0, 1].map((k) => {
            const material = new THREE.MeshBasicMaterial({ color: k ? 0xffffff : 0x8fe0ff });
            const bars = [];
            for (let n = 0; n < 8; n++) {
                const bar = new THREE.Mesh(new THREE.BoxGeometry(k ? 0.025 : 0.045, k ? 0.025 : 0.045, 1), material);
                group.add(bar);
                bars.push(bar);
            }
            return bars;
        });
        const sparkGeometry = new THREE.BufferGeometry();
        sparkGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(16 * 3), 3));
        const sparks = new THREE.Points(sparkGeometry, new THREE.PointsMaterial({ color: 0xfff6a0, size: 0.07 }));
        group.add(sparks);
        const glow = new THREE.Mesh(new THREE.CircleGeometry(0.95, 24), new THREE.MeshBasicMaterial({ color: 0x40c8ff, transparent: true, opacity: 0.3, depthWrite: false }));
        glow.rotation.x = -Math.PI / 2;
        glow.position.y = 0.1;
        group.add(glow);
        group.scale.set(radius / SPIKE_RADIUS, 1, radius / SPIKE_RADIUS);
        group.position.copy(position);
        group.position.y = 0;
        // Face the posts across the corridor it stands in
        const x = Math.floor(position.x);
        const z = Math.floor(position.z);
        if (this.grid[x]?.[z - 2] === 1 && this.grid[x]?.[z + 2] === 1) group.rotation.y = Math.PI / 2;
        this.root.add(group);
        this.zappers = this.zappers || [];
        const zapper = { arcs, sparks, glow, tops, time: 0 };
        this.zappers.push(zapper);
        this.updateZapper(zapper, 0);
    }

    updateZapper(zapper, dt) {
        zapper.time += dt;
        const [a, b] = zapper.tops;
        for (const bars of zapper.arcs) {
            const points = [];
            for (let k = 0; k <= bars.length; k++) {
                const t = k / bars.length;
                const jitter = k === 0 || k === bars.length ? 0 : 0.14;
                points.push(new THREE.Vector3(a.x + (b.x - a.x) * t, a.y + Math.sin(t * Math.PI) * 0.12 + (Math.random() - 0.5) * jitter, (Math.random() - 0.5) * jitter));
            }
            bars.forEach((bar, k) => {
                const from = points[k];
                const to = points[k + 1];
                bar.position.copy(from).add(to).multiplyScalar(0.5);
                bar.scale.z = from.distanceTo(to);
                bar.lookAt(bar.parent ? bar.parent.localToWorld(to.clone()) : to);
            });
        }
        const sp = zapper.sparks.geometry.attributes.position;
        for (let k = 0; k < sp.count; k++) {
            const from = k % 2 ? a : b;
            sp.setXYZ(k, from.x + (Math.random() - 0.5) * 0.5, from.y + (Math.random() - 0.4) * 0.5, (Math.random() - 0.5) * 0.5);
        }
        sp.needsUpdate = true;
        zapper.glow.material.opacity = 0.2 + Math.random() * 0.25;
    }

    // The big gap (Level 81): deep steel sides with hazard stripes, and far
    // below, giant machines with pistons pumping up and down (just to look
    // at; falling in sends you back to the start)
    createMachinePit(p) {
        const g = p.gap;
        const cx = (g.minX + g.maxX) / 2;
        const cz = (g.minZ + g.maxZ) / 2;
        const group = new THREE.Group();
        const depth = 16;
        const w = g.maxX - g.minX;
        const d = g.maxZ - g.minZ;
        for (const [len, x, z, turn] of [[w, cx, g.minZ, 0], [w, cx, g.maxZ, 0], [d, g.minX, cz, Math.PI / 2], [d, g.maxX, cz, Math.PI / 2]]) {
            const map = pitWallTexture();
            map.repeat.set(len / 3, 1);
            const side = new THREE.Mesh(new THREE.PlaneGeometry(len, depth), new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide }));
            side.position.set(x, -0.2 - depth / 2, z);
            side.rotation.y = turn;
            group.add(side);
        }
        const bottomY = -0.2 - depth;
        const floorMap = machineFloorTexture(128, 113);
        floorMap.repeat.set(w / 8, d / 8);
        const bottom = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: floorMap }));
        bottom.rotation.x = -Math.PI / 2;
        bottom.position.set(cx, bottomY + 0.01, cz);
        group.add(bottom);
        // Yellow-and-black hazard edges where the grating stops
        const width = p.alongX ? d : w;
        const yellow = new THREE.MeshStandardMaterial({ color: 0xf2c230, emissive: 0x5a4400, emissiveIntensity: 0.6 });
        for (const end of [0, p.span]) {
            const strip = new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, 0.14), yellow);
            if (p.alongX) {
                strip.rotation.y = Math.PI / 2;
                strip.position.set(g.minX + end + (end ? 0.07 : -0.07), 0.02, cz);
            } else {
                strip.position.set(cx, 0.02, g.minZ + end + (end ? 0.07 : -0.07));
            }
            group.add(strip);
        }
        // The machines: a row of big housings along the gap, each with a
        // chrome piston pumping up and down out of it, out of step with its
        // neighbours, and a few blinking lights
        const housing = new THREE.MeshStandardMaterial({ color: 0x3a3f46, metalness: 0.5, roughness: 0.6, emissive: 0x111316, emissiveIntensity: 1 });
        const chrome = new THREE.MeshStandardMaterial({ color: 0xd0d6de, metalness: 0.9, roughness: 0.2, emissive: 0x30343a, emissiveIntensity: 1 });
        const capMaterial = new THREE.MeshStandardMaterial({ color: 0xf2c230, emissive: 0xb08a10, emissiveIntensity: 0.8 });
        const lamp = new THREE.MeshBasicMaterial({ color: 0xff8a1f });
        p.pistons = [];
        const n = Math.max(2, Math.floor(p.span / 3));
        for (let k = 0; k < n; k++) {
            const along = (k + 0.5) * (p.span / n);
            const across = width / 2 + (k % 2 ? 0.35 : -0.35);
            const x = p.alongX ? g.minX + along : g.minX + across;
            const z = p.alongX ? g.minZ + across : g.minZ + along;
            const box = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3, 2.2), housing);
            box.position.set(x, bottomY + 1.5, z);
            group.add(box);
            const light = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.05), lamp);
            light.position.set(x, bottomY + 2.4, z + 1.13);
            group.add(light);
            const rod = new THREE.Group();
            const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 8, 16), chrome);
            shaft.position.y = -4;
            rod.add(shaft);
            const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.5, 20), capMaterial);
            rod.add(cap);
            rod.position.set(x, 0, z);
            group.add(rod);
            p.pistons.push({ rod, low: bottomY + 3.2, travel: 5.5, phase: k / n + (k % 2) * 0.5 });
        }
        this.root.add(group);
    }

    // The flattened tire (Level 81): a big black tire lying flat, squashed,
    // with its tread on the outside and a gray metal wheel in the middle. It
    // works exactly like Level 36's hover disc, at Level 27's fast-leaf speed.
    createTire(p) {
        const g = p.gap;
        const width = p.alongX ? g.maxZ - g.minZ : g.maxX - g.minX;
        const outer = Math.min(width - 0.1, PLATFORM_LENGTH + 0.3) / 2;
        const tube = 0.42;
        const group = new THREE.Group();
        const map = treadTexture();
        map.repeat.set(6, 1);
        const rubber = new THREE.MeshStandardMaterial({ map, color: 0xffffff, roughness: 0.95 });
        const tire = new THREE.Mesh(new THREE.TorusGeometry(outer - tube, tube, 14, 48), rubber);
        tire.rotation.x = Math.PI / 2;
        tire.scale.z = 0.42; // squashed flat (the torus's thickness is its z before turning)
        tire.position.y = -0.16;
        tire.castShadow = true;
        tire.receiveShadow = true;
        group.add(tire);
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(outer - tube * 1.4, outer - tube * 1.4, 0.16, 32), new THREE.MeshStandardMaterial({ color: 0x5c6168, metalness: 0.4, roughness: 0.6 }));
        wheel.position.y = -0.1;
        wheel.receiveShadow = true;
        group.add(wheel);
        const nut = new THREE.MeshStandardMaterial({ color: 0x4a4f56, metalness: 0.8, roughness: 0.3 });
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 16), nut);
        hub.position.y = 0;
        group.add(hub);
        for (let k = 0; k < 5; k++) {
            const a = (k / 5) * Math.PI * 2;
            const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 8), nut);
            bolt.position.set(Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4);
            group.add(bolt);
        }
        this.root.add(group);
        p.object = group;
    }

    // Volcano World sky: ash falling all the time like snowflakes over the
    // whole maze. Just to look at: it goes straight through you.
    // Ice World uses it for snowflakes: white, bigger, falling a bit slower.
    addAsh({ color = 0xb0a8a6, size = 0.14, fall = 1 } = {}) {
        const count = 1800;
        const spread = Math.max(this.width, this.depth) + 40;
        const positions = new Float32Array(count * 3);
        let r = 61;
        const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
        for (let k = 0; k < count; k++) {
            positions[k * 3] = this.width / 2 + (random() - 0.5) * spread;
            positions[k * 3 + 1] = random() * 30;
            positions[k * 3 + 2] = this.depth / 2 + (random() - 0.5) * spread;
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({ color, size, map: puffTexture(), transparent: true, depthWrite: false, fog: false });
        this.ash = new THREE.Points(geometry, material);
        this.ash.userData.time = 0;
        this.ash.userData.fall = fall;
        this.root.add(this.ash);
    }

    updateAsh(dt) {
        const a = this.ash;
        a.userData.time += dt;
        const p = a.geometry.attributes.position;
        for (let k = 0; k < p.count; k++) {
            let y = p.getY(k) - dt * (0.9 + (k % 7) * 0.08) * a.userData.fall;
            if (y < 0) y += 30;
            p.setY(k, y);
            p.setX(k, p.getX(k) + Math.sin(a.userData.time * 0.8 + k) * dt * 0.25);
        }
        p.needsUpdate = true;
        for (const coal of this.coals || []) coal.material.emissiveIntensity = 0.9 + 0.3 * Math.sin(a.userData.time * 2.2 + coal.userData.phase);
    }

    // Ice World sky (Level 71 on): a dark night sky with stars, green and
    // purple northern lights slowly waving high up, snowy owls flying by and
    // snowflakes falling over the maze. Just to look at: snow and owls go
    // straight through you.
    addIceSky() {
        const cx = this.width / 2;
        const cz = this.depth / 2;
        let r = 83;
        const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
        const stars = [];
        for (let k = 0; k < 600; k++) {
            const a = random() * Math.PI * 2;
            const up = 0.15 + random() * 0.85;
            const d = 380;
            stars.push(cx + Math.cos(a) * d * Math.sqrt(1 - up * up), d * up, cz + Math.sin(a) * d * Math.sqrt(1 - up * up));
        }
        const starGeometry = new THREE.BufferGeometry();
        starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
        this.root.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, fog: false })));
        // The northern lights: tall wavy curtains all round the sky
        const map = auroraTexture();
        this.auroras = [];
        for (let k = 0; k < 6; k++) {
            const geometry = new THREE.PlaneGeometry(220, 70, 48, 1);
            const material = new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
            const curtain = new THREE.Mesh(geometry, material);
            const a = (k / 6) * Math.PI * 2 + random() * 0.5;
            const d = 170 + random() * 60;
            curtain.position.set(cx + Math.cos(a) * d, 95 + random() * 40, cz + Math.sin(a) * d);
            curtain.lookAt(cx, curtain.position.y - 30, cz);
            curtain.userData = { base: Float32Array.from(geometry.attributes.position.array), phase: random() * 6 };
            this.root.add(curtain);
            this.auroras.push(curtain);
        }
        this.flyers = [];
        for (let k = 0; k < 4; k++) {
            const flyer = this.makeFlyer('owl');
            this.root.add(flyer.object);
            this.flyers.push(flyer);
            this.launchFlyer(flyer, k / 4);
        }
        this.addAsh({ color: 0xffffff, size: 0.22, fall: 0.7 });
    }

    // The northern lights ripple slowly (called every frame)
    updateAuroras(dt) {
        for (const curtain of this.auroras) {
            const u = curtain.userData;
            u.phase += dt * 0.35;
            const pos = curtain.geometry.attributes.position;
            for (let k = 0; k < pos.count; k++) {
                const x = u.base[k * 3];
                pos.setZ(k, Math.sin(x * 0.04 + u.phase) * 14 + Math.sin(x * 0.11 - u.phase * 1.7) * 4);
            }
            pos.needsUpdate = true;
            curtain.material.opacity = 0.65 + 0.2 * Math.sin(u.phase * 0.8);
        }
    }

    // Candy World: a big gumdrop sitting on top of each wall block, every color
    addGumdropTops(wallCount) {
        const material = new THREE.MeshStandardMaterial({ roughness: 0.4 });
        const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), material, wallCount);
        const matrix = new THREE.Matrix4();
        const color = new THREE.Color();
        let r = 17;
        const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
        let n = 0;
        for (let x = 0; x < this.width; x++) {
            for (let z = 0; z < this.depth; z++) {
                if (this.grid[x][z] !== 1) continue;
                const size = 0.5 + random() * 0.12;
                matrix.makeScale(size, size * (1.1 + random() * 0.3), size);
                matrix.setPosition(x + 0.5, this.height, z + 0.5);
                drops.setMatrixAt(n, matrix);
                drops.setColorAt(n++, color.set(GUMDROP_COLORS[Math.floor(random() * GUMDROP_COLORS.length)]));
            }
        }
        this.root.add(drops);
    }

    // Candy World sky: fluffy pink, blue and white cotton candy clouds
    // drifting high up, and bunches of balloons floating by lower down.
    // Just to look at: no dangers, nothing to bump into.
    addCandySky() {
        this.flyers = [];
        const kinds = ['cloud', 'balloon', 'cloud', 'balloon', 'cloud', 'balloon', 'cloud', 'balloon', 'cloud'];
        kinds.forEach((kind, k) => {
            const flyer = this.makeCandyFlyer(kind, k);
            this.root.add(flyer.object);
            this.flyers.push(flyer);
            this.launchFlyer(flyer, k / kinds.length);
        });
    }

    makeCandyFlyer(kind, k) {
        const group = new THREE.Group();
        const basic = (color) => new THREE.MeshBasicMaterial({ color, fog: false });
        if (kind === 'cloud') {
            // Cotton candy: a puffy lump of soft balls
            const color = [0xffb3d9, 0xb3e0ff, 0xfff0fa, 0xffc8e6][k % 4];
            const material = basic(color);
            const ball = new THREE.SphereGeometry(1, 14, 10);
            for (let b = 0; b < 7; b++) {
                const puff = new THREE.Mesh(ball, material);
                const size = 3 + ((b * 37) % 5) * 0.6;
                puff.scale.setScalar(size);
                puff.position.set((b - 3) * 3.2, Math.sin(b * 1.7) * 1.4 + (b % 3 === 1 ? 1.5 : 0), Math.cos(b * 2.3) * 2);
                group.add(puff);
            }
        } else {
            // A bunch of three balloons on strings
            const colors = [0xff3b6b, 0xffd60a, 0x2fa8ff, 0x3ddc5a, 0xa64dff, 0xff9a1f];
            const string = new THREE.LineBasicMaterial({ color: 0xffffff, fog: false });
            for (let b = 0; b < 3; b++) {
                const color = colors[(k + b * 2) % colors.length];
                const balloon = new THREE.Group();
                const body = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshStandardMaterial({ color, roughness: 0.3, emissive: color, emissiveIntensity: 0.35, fog: false }));
                body.scale.set(1, 1.2, 1);
                const knot = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.35, 8), basic(color));
                knot.position.y = -1.3;
                balloon.add(body, knot);
                const top = new THREE.Vector3((b - 1) * 1.6, 1.2 + (b % 2) * 0.9, (b - 1) * 0.5);
                balloon.position.copy(top);
                group.add(balloon);
                const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([top.clone().setY(top.y - 1.45), new THREE.Vector3(0, -4.5, 0)]), string);
                group.add(line);
            }
        }
        const object = new THREE.Group();
        object.add(group);
        return { kind, object, velocity: new THREE.Vector3(), life: 0, bob: Math.random() * 6 };
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
        } else if (kind === 'owl') {
            // A snowy owl flying along +x: round white body and head, big
            // yellow eyes, wide white wings with a few gray speckles
            const white = basic(0xf7f9fc);
            const body = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), white);
            body.scale.set(1.3, 0.8, 0.85);
            const head = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 12), white);
            head.position.set(1.3, 0.35, 0);
            group.add(body, head);
            for (const side of [-1, 1]) {
                const eye = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), basic(0xffd21f));
                eye.position.set(1.9, 0.5, side * 0.3);
                const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), basic(0x111111));
                pupil.position.set(2.05, 0.5, side * 0.3);
                group.add(eye, pupil);
            }
            const beak = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 8), basic(0x333333));
            beak.rotation.z = -Math.PI / 2;
            beak.position.set(2.05, 0.25, 0);
            group.add(beak);
            const wings = [];
            for (const side of [-1, 1]) {
                const pivot = new THREE.Group();
                const wing = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 2.6), white);
                wing.position.z = side * 1.3;
                pivot.add(wing);
                for (const [sx, sz] of [[0.3, 1.0], [-0.3, 1.7], [0.1, 2.3]]) {
                    const speck = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.11, 0.25), basic(0x8a8f99));
                    speck.position.set(sx, 0, side * sz);
                    pivot.add(speck);
                }
                pivot.userData.side = side;
                group.add(pivot);
                wings.push(pivot);
            }
            group.scale.setScalar(1.1);
            const object = new THREE.Group();
            object.add(group);
            return { kind, object, velocity: new THREE.Vector3(), life: 0, wings, flap: Math.random() * 6 };
        } else if (kind === 'gull') {
            const wings = this.makeGull(group, basic);
            group.scale.setScalar(1.1);
            const object = new THREE.Group();
            object.add(group);
            return { kind, object, velocity: new THREE.Vector3(), life: 0, wings, flap: Math.random() * 6 };
        } else if (kind === 'ptero') {
            const wings = this.makePterodactyl(group, basic);
            group.scale.setScalar(1.3);
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
        const speeds = { cloud: 2.5, balloon: 3.5, rocket: 14, comet: 18, meteor: 26, parrot: 11, toucan: 9, owl: 8, butterfly: 4, turtle: 3, whale: 4, manta: 5, school: 6, ptero: 7, gull: 8, lowcloud: 2, kite: 4 };
        const speed = speeds[flyer.kind];
        // Sea animals swim slowly over the reef, not too high (Underwater World)
        // Candy World's clouds and balloons drift slowly, like birds
        const bird = ['parrot', 'toucan', 'owl', 'turtle', 'whale', 'manta', 'school', 'cloud', 'balloon', 'ptero', 'gull', 'lowcloud', 'kite'].includes(flyer.kind);
        const butterfly = flyer.kind === 'butterfly';
        const span = butterfly ? 70 : bird ? 160 : 260;
        const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
        const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar((Math.random() - 0.5) * (butterfly ? 30 : bird ? 60 : 120));
        // (Sky World: clouds drift by under the floating island, kites fly over it)
        const height = flyer.kind === 'lowcloud' ? CLOUD_LEVEL + 4 + Math.random() * 9 : flyer.kind === 'kite' ? 14 + Math.random() * 12 :
            flyer.kind === 'cloud' ? 34 + Math.random() * 16 : flyer.kind === 'balloon' ? 12 + Math.random() * 14 :
            flyer.kind === 'whale' ? 26 + Math.random() * 10 : butterfly ? 6 + Math.random() * 5 : bird ? 10 + Math.random() * 14 : 30 + Math.random() * 45;
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
        if (this.ash) this.updateAsh(dt);
        // Pirate Ship World: the sea moves gently, the cannons spark and smoke, splashes fall back
        if (this.seaMap) this.seaMap.offset.x = (this.seaMap.offset.x + dt * 0.01) % 1;
        // Sky World: the clouds below drift, the rainbows sparkle, the storm clouds' bolts flicker
        if (this.cloudMap) this.cloudMap.offset.x = (this.cloudMap.offset.x + dt * 0.004) % 1;
        if (this.theme.skyland) this.updateSkyLooks(dt);
        if (this.theme.mushroom) this.updateMushroomLooks(dt);
        if (this.fogs?.length) this.updateFogs(dt);
        if (this.theme.pirate) {
            this.showCannons(dt);
            this.updateSplashes(dt);
        }
        if (this.theme.factory) this.updateFactory(dt);
        if (this.camels) this.placeCamels(dt);
        if (this.auroras) this.updateAuroras(dt);
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
                // (pterodactyls glide, with slow gentle flaps too)
                const sea = ['turtle', 'whale', 'manta', 'ptero', 'gull'].includes(flyer.kind);
                if (sea) flyer.flap -= dt * 4.5; // slow, gentle strokes
                for (const wing of flyer.wings) {
                    if (wing.userData.whaleTail) wing.rotation.z = Math.sin(flyer.flap) * 0.3;
                    else wing.rotation.x = wing.userData.side * Math.sin(flyer.flap) * (butterfly ? 0.9 : sea ? 0.45 : 0.6);
                }
                if (butterfly) flyer.object.position.y += Math.sin(flyer.flap * 0.5) * dt * 1.2;
            }
            // Balloons bob gently up and down
            if (flyer.kind === 'balloon') {
                flyer.bob += dt;
                flyer.object.position.y += Math.sin(flyer.bob * 1.3) * dt * 0.8;
            }
            flyer.life -= dt;
            if (flyer.life <= 0) this.launchFlyer(flyer);
        }
        for (const p of this.platforms) {
            // Marshmallows squish when bounced on, then puff back up
            for (const pad of p.pads) {
                if (!pad.object) continue;
                pad.squish = Math.max(0, pad.squish - dt * 2.5);
                const q = Math.sin(pad.squish * Math.PI) * 0.5 + pad.squish * 0.2;
                pad.object.scale.set(1 + q * 0.4, 1 - q, 1 + q * 0.4);
            }
            if (!p.river) continue;
            // Each river rushes along, and fish jump now and then
            const r = p.river;
            r.map.offset[r.flowAxis] -= dt * 0.9;
            for (const fish of r.fish || []) this.updateFish(fish, p, dt);
        }
        if (this.surface) this.surface.material.map.offset.x += dt * 0.02;
        for (const c of this.currents) if (c.streaks) this.updateCurrent(c, dt);
        for (const p of this.platforms) {
            // Anglerfish lights drifting far down in the crack
            for (const fish of p.anglers || []) {
                fish.time += dt;
                fish.object.position.set(fish.x + Math.sin(fish.time * fish.speed) * fish.range, fish.y + Math.sin(fish.time * 0.7 + fish.phase) * 0.6, fish.z);
                fish.glow.material.opacity = 0.35 + 0.25 * Math.sin(fish.time * 2.1 + fish.phase);
            }
        }
        for (const p of this.platforms) if (p.lava) this.updateLava(p, dt);
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
        // The fossil hunt: a big padlock on the door until all 3 fossils are found
        if (this.fossils?.length) {
            const lock = this.createDoorLock();
            lock.position.set(0, 1.15, 0.3);
            door.add(lock);
            this.doorLock = { object: lock, pop: null };
        }
    }

    // A small cluster of metal spikes on the floor, its plate `radius` across from the middle
    createSpike(position, radius) {
        if (this.theme.jungle) return this.createBush(position, radius);
        if (this.theme.moon) return this.createCrater(position, radius);
        if (this.theme.underwater) return this.createUrchin(position, radius);
        if (this.theme.sweets) return this.createCandyCane(position, radius);
        if (this.theme.volcano) return this.createHotCoal(position, radius);
        if (this.theme.ice) return this.createIcicle(position, radius);
        if (this.theme.factory) return this.createZapper(position, radius);
        if (this.theme.desert) return this.createCactus(position, radius);
        if (this.theme.dino) return this.createBoneSpike(position, radius);
        if (this.theme.pirate) return this.createSplinterSpike(position, radius);
        if (this.theme.skyland) return this.createStormCloud(position, radius);
        if (this.theme.mushroom) return this.createOuchMushroom(position, radius);
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

    // Candy World's spike: pointy broken candy canes, three striped pieces
    // sticking up with sharp snapped-off tips, and the broken-off hook lying
    // beside them. As wide as a spike's plate; touching it works the same.
    createCandyCane(position, radius) {
        const cane = new THREE.Group();
        const map = candyStripeTexture();
        map.repeat.set(1, 2);
        const striped = new THREE.MeshStandardMaterial({ map, roughness: 0.3, emissive: 0x3a0008, emissiveIntensity: 0.2 });
        const sugar = new THREE.MeshStandardMaterial({ color: 0xfff4f4, roughness: 0.25 });
        const pieces = [[0, 0, 0.85, 0], [0.34, 0.2, 0.6, 0.25], [-0.32, 0.22, 0.7, -0.22], [0.05, -0.36, 0.55, 0.18]];
        for (const [ox, oz, h, lean] of pieces) {
            const stick = new THREE.Group();
            const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, h, 14), striped);
            body.position.y = h / 2;
            // The snapped-off end: a jagged sharp point
            const tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.32, 5), sugar);
            tip.position.y = h + 0.15;
            tip.rotation.y = ox * 3;
            body.castShadow = tip.castShadow = true;
            stick.add(body, tip);
            stick.position.set(ox, 0, oz);
            stick.rotation.set(lean * 0.6, 0, -lean);
            cane.add(stick);
        }
        // The broken-off hook on the floor
        const hook = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.08, 10, 20, Math.PI), striped);
        hook.rotation.x = -Math.PI / 2;
        hook.position.set(-0.25, 0.08, -0.3);
        cane.add(hook);
        cane.scale.set(radius / SPIKE_RADIUS, 1, radius / SPIKE_RADIUS);
        cane.position.copy(position);
        cane.position.y = 0;
        this.root.add(cane);
    }

    // Volcano World's spike: a giant glowing hot coal (one big lump and two
    // small ones), as wide as a spike's plate. Touching it works the same.
    createHotCoal(position, radius) {
        const group = new THREE.Group();
        const map = coalTexture();
        this.coals = this.coals || [];
        const lumps = [[0, 0, 0.42, 0.5], [0.42, 0.22, 0.2, 0.2], [-0.3, -0.4, 0.18, 0.15]];
        lumps.forEach(([ox, oz, size, h], n) => {
            const geometry = new THREE.IcosahedronGeometry(1, 1);
            // Lumpy, like a real coal
            const pos = geometry.attributes.position;
            for (let k = 0; k < pos.count; k++) {
                const wobble = 0.82 + 0.3 * Math.abs(Math.sin(k * 12.9898 + n * 78.233));
                pos.setXYZ(k, pos.getX(k) * wobble, pos.getY(k) * wobble, pos.getZ(k) * wobble);
            }
            geometry.computeVertexNormals();
            const material = new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: 1, roughness: 0.8 });
            const lump = new THREE.Mesh(geometry, material);
            lump.scale.set(size, h * 0.9, size);
            lump.position.set(ox, h * 0.55, oz);
            lump.castShadow = true;
            // Each lump glows brighter and dimmer on its own (see updateAsh)
            lump.userData.phase = n * 1.7;
            this.coals.push(lump);
            group.add(lump);
        });
        // A warm glow on the floor around it
        const glow = new THREE.Mesh(new THREE.CircleGeometry(0.85, 24), new THREE.MeshBasicMaterial({ color: 0xff5a00, transparent: true, opacity: 0.35, depthWrite: false }));
        glow.rotation.x = -Math.PI / 2;
        glow.position.y = 0.02;
        group.add(glow);
        group.scale.set(radius / SPIKE_RADIUS, 1, radius / SPIKE_RADIUS);
        group.position.copy(position);
        group.position.y = 0;
        this.root.add(group);
    }

    // An icicle (Ice World, Level 71 on): an igloo arch of ice bricks over
    // the corridor, wall to wall, with one big icicle hanging from its top
    // low enough to see clearly (its tip about knee high) and a few little
    // ones beside it. Touching it works like a spike (its plate is radius).
    createIcicle(position, radius) {
        const group = new THREE.Group();
        const x = Math.floor(position.x);
        const z = Math.floor(position.z);
        // The arch spans the corridor: across x when the corridor runs along z
        const runsAlongZ = this.grid[x - 2]?.[z] === 1 && this.grid[x + 2]?.[z] === 1;
        const half = 1.5; // half the corridor's width (3 blocks)
        const legHeight = 2.1;
        const brick = (shade) => new THREE.MeshStandardMaterial({ color: new THREE.Color(0.82 * shade, 0.93 * shade, 1), emissive: 0x3a8ad0, emissiveIntensity: 0.35, roughness: 0.25 });
        const shades = [1, 0.93, 0.97, 0.9, 1.02];
        // The legs: bricks stacked up against each wall
        let n = 0;
        for (const side of [-1, 1]) {
            for (let y = 0; y < legHeight; y += 0.35) {
                const b = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.32, 0.55), brick(shades[n++ % shades.length]));
                b.position.set(side * (half - 0.14), y + 0.17, 0);
                group.add(b);
            }
        }
        // The arch: bricks round a half circle, wall to wall
        const archRadius = half - 0.14;
        const bricks = 11;
        for (let k = 0; k < bricks; k++) {
            const a = ((k + 0.5) / bricks) * Math.PI;
            const b = new THREE.Mesh(new THREE.BoxGeometry(0.28, (Math.PI * archRadius) / bricks - 0.03, 0.55), brick(shades[n++ % shades.length]));
            b.position.set(Math.cos(a) * archRadius, legHeight + Math.sin(a) * archRadius, 0);
            b.rotation.z = a;
            group.add(b);
        }
        // The icicles: see-through-ish glowing pale blue, pointing down
        const iceMaterial = new THREE.MeshStandardMaterial({ color: 0xd8f6ff, emissive: 0x6fd0ff, emissiveIntensity: 0.6, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.92 });
        const top = legHeight + archRadius - 0.12;
        const tipHeight = 0.55;
        const big = new THREE.Mesh(new THREE.ConeGeometry(0.34, top - tipHeight, 14), iceMaterial);
        big.rotation.x = Math.PI;
        big.position.y = (top + tipHeight) / 2;
        big.castShadow = true;
        group.add(big);
        for (const [ox, len] of [[-0.55, 0.9], [0.5, 0.7], [-0.95, 0.5], [0.9, 0.45]]) {
            const y = legHeight + Math.sqrt(Math.max(0, archRadius * archRadius - ox * ox)) - 0.12;
            const small = new THREE.Mesh(new THREE.ConeGeometry(0.12, len, 10), iceMaterial);
            small.rotation.x = Math.PI;
            small.position.set(ox, y - len / 2, 0);
            group.add(small);
        }
        // A frosty blue patch on the snow under it, as wide as its plate
        const frost = new THREE.Mesh(new THREE.CircleGeometry(0.85, 24), new THREE.MeshBasicMaterial({ color: 0x7fd6ff, transparent: true, opacity: 0.4, depthWrite: false }));
        frost.rotation.x = -Math.PI / 2;
        frost.position.y = 0.02;
        frost.scale.setScalar(radius / SPIKE_RADIUS);
        group.add(frost);
        // The group's x is across the arch
        if (!runsAlongZ) group.rotation.y = Math.PI / 2;
        group.position.set(position.x, 0, position.z);
        this.root.add(group);
    }

    // A steam vent (Volcano World): a grate of dark slots in a rocky rim
    // across its whole corridor cell, with steam that wisps up as a warning
    // and then blasts up in a big puff.
    createVent(v) {
        if (v.wave) return this.createWave(v);
        const sizeX = v.maxX - v.minX;
        const sizeZ = v.maxZ - v.minZ;
        const group = new THREE.Group();
        group.position.set(v.center.x, 0, v.center.z);
        const rim = new THREE.Mesh(new THREE.BoxGeometry(sizeX - 0.1, 0.05, sizeZ - 0.1), new THREE.MeshStandardMaterial({ color: 0x4a4446, roughness: 0.7, metalness: 0.4 }));
        rim.position.y = 0.025;
        group.add(rim);
        const slot = new THREE.MeshBasicMaterial({ color: 0x050303 });
        for (let k = 0; k < 6; k++) {
            const bar = new THREE.Mesh(new THREE.BoxGeometry(sizeX * 0.8, 0.02, 0.22), slot);
            bar.position.set(0, 0.055, -sizeZ * 0.4 + (k + 0.5) * (sizeZ * 0.8) / 6);
            group.add(bar);
        }
        // A faint orange glow deep inside the slots
        const glow = new THREE.Mesh(new THREE.PlaneGeometry(sizeX * 0.8, sizeZ * 0.8), new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.12, depthWrite: false }));
        glow.rotation.x = -Math.PI / 2;
        glow.position.y = 0.06;
        group.add(glow);
        // Steam puffs, reused over and over
        const map = puffTexture();
        v.steam = [];
        for (let k = 0; k < 48; k++) {
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, opacity: 0 }));
            sprite.visible = false;
            group.add(sprite);
            v.steam.push({ sprite, life: 0, span: 1, vy: 0, size: 1, x: 0, z: 0 });
        }
        v.sizeX = sizeX;
        v.sizeZ = sizeZ;
        v.group = group;
        this.root.add(group);
    }

    launchSteam(v, big) {
        const free = v.steam.find((s) => s.life <= 0);
        if (!free) return;
        free.x = (Math.random() - 0.5) * v.sizeX * 0.8;
        free.z = (Math.random() - 0.5) * v.sizeZ * 0.8;
        free.span = free.life = big ? 0.7 + Math.random() * 0.5 : 0.8 + Math.random() * 0.4;
        free.vy = big ? 6 + Math.random() * 3 : 0.8 + Math.random() * 0.5;
        free.size = big ? 1.2 + Math.random() * 0.8 : 0.35 + Math.random() * 0.25;
        free.peak = big ? 0.85 : 0.45;
        free.y = 0.1;
        free.sprite.visible = true;
    }

    // Run every vent's timer (only while playing), animate its steam, and say
    // what happened: [{ vent, event: 'warning' | 'puff' | 'push' }]. A push
    // means part of the player (a circle `radius` round `point`) is on the
    // vent while it puffs.
    updateVents(dt, point, radius) {
        const events = [];
        for (const v of this.vents) {
            v.timer -= dt;
            if (v.timer <= 0) {
                if (v.phase === 'quiet') {
                    v.phase = 'warning';
                    v.timer += VENT_WARNING_TIME;
                    events.push({ vent: v, event: 'warning' });
                } else if (v.phase === 'warning') {
                    v.phase = 'puff';
                    v.timer += VENT_PUFF_TIME;
                    events.push({ vent: v, event: 'puff' });
                    for (let k = 0; k < 24; k++) this.launchSteam(v, true);
                } else {
                    v.phase = 'quiet';
                    v.timer += VENT_QUIET_TIME;
                }
            }
            if (v.wave) this.showWave(v, dt);
            if (v.phase === 'warning' && Math.random() < dt * 14) this.launchSteam(v, false);
            if (v.phase === 'puff' && Math.random() < dt * 40) this.launchSteam(v, true);
            for (const s of v.steam) {
                if (s.life <= 0) continue;
                s.life -= dt;
                s.y += s.vy * dt;
                const t = 1 - s.life / s.span;
                s.sprite.position.set(s.x, s.y, s.z);
                s.sprite.scale.setScalar(s.size * (0.6 + t));
                s.sprite.material.opacity = s.peak * Math.sin(Math.PI * Math.min(1, t));
                if (s.life <= 0) s.sprite.visible = false;
            }
            if (v.phase === 'puff' && point && this.onVent(v, point, radius)) events.push({ vent: v, event: 'push' });
        }
        return events;
    }

    // A big wave (Pirate Ship World): a short stretch of ship's rail on top of
    // the outer wall beside the cell, a darker wet patch on the deck, and a
    // curling blue wave with a white foamy crest that rises from the sea
    // behind the rail as a warning and then sweeps across the cell.
    createWave(v) {
        const H = this.height;
        const width = v.hi - v.lo;
        const length = v.alongX ? v.maxX - v.minX : v.maxZ - v.minZ;
        const mid = v.alongX ? v.center.x : v.center.z;
        const railFace = v.out < 0 ? v.lo : v.hi;
        const at = (across, along, y) => (v.alongX ? new THREE.Vector3(along, y, across) : new THREE.Vector3(across, y, along));
        // The wave's frame: x from the rail into the cell, y up, z along
        const frame = new THREE.Group();
        frame.position.copy(at(railFace, mid, 0));
        if (v.alongX) frame.rotation.y = -Math.PI / 2;
        frame.scale.x = -v.out;
        this.root.add(frame);
        // The rail: posts and a top bar along the wall top, a bit past the cell
        const wood = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.8, emissive: 0x1a0d04, emissiveIntensity: 0.3 });
        const railLength = length + 2;
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, railLength), wood);
        bar.position.set(-0.5, H + 0.75, 0);
        frame.add(bar);
        const low = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, railLength), wood);
        low.position.set(-0.5, H + 0.35, 0);
        frame.add(low);
        for (let k = 0; k <= 5; k++) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.8, 0.16), wood);
            post.position.set(-0.5, H + 0.4, -railLength / 2 + (k * railLength) / 5);
            frame.add(post);
        }
        // The wet patch on the deck (darker and shinier just after a splash)
        v.wetMaterial = new THREE.MeshBasicMaterial({ color: 0x5fb4e8, transparent: true, opacity: 0.18, depthWrite: false });
        const wet = new THREE.Mesh(new THREE.PlaneGeometry(width, length), v.wetMaterial);
        wet.rotation.x = -Math.PI / 2;
        wet.position.set(width / 2, 0.03, 0);
        frame.add(wet);
        // The wave: a curling crest profile (x across, y up; 1 high), pulled
        // out along the cell, a little longer than it so it fills the cell
        const shape = new THREE.Shape();
        shape.moveTo(-1.6, 0);
        shape.lineTo(-1.6, 0.55);
        shape.quadraticCurveTo(-1.3, 0.95, -0.25, 1);
        shape.quadraticCurveTo(0.55, 1.02, 0.85, 0.78);
        shape.quadraticCurveTo(0.5, 0.8, 0.38, 0.58);
        shape.quadraticCurveTo(0.22, 0.25, 0.7, 0);
        shape.lineTo(-1.6, 0);
        const waveLength = length + 0.8;
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: waveLength, bevelEnabled: false, curveSegments: 10 });
        geometry.translate(0, 0, -waveLength / 2);
        const water = new THREE.MeshStandardMaterial({ color: 0x1f7fc4, roughness: 0.25, metalness: 0.1, emissive: 0x0b3b66, emissiveIntensity: 0.5, transparent: true, opacity: 0.88, side: THREE.DoubleSide });
        v.waveMesh = new THREE.Mesh(geometry, water);
        // The white foam along the crest and the curling lip
        const foamShape = new THREE.Shape();
        foamShape.moveTo(-0.6, 0.97);
        foamShape.quadraticCurveTo(0.55, 1.08, 0.88, 0.8);
        foamShape.quadraticCurveTo(0.6, 0.86, 0.45, 0.66);
        foamShape.quadraticCurveTo(0.2, 0.9, -0.6, 0.9);
        const foamGeometry = new THREE.ExtrudeGeometry(foamShape, { depth: waveLength + 0.02, bevelEnabled: false, curveSegments: 8 });
        foamGeometry.translate(0, 0.005, -(waveLength + 0.02) / 2);
        const foam = new THREE.Mesh(foamGeometry, new THREE.MeshStandardMaterial({ color: 0xf4fbff, roughness: 0.6, emissive: 0x9fc8e0, emissiveIntensity: 0.4, side: THREE.DoubleSide }));
        v.waveMesh.add(foam);
        v.waveMesh.visible = false;
        frame.add(v.waveMesh);
        // Spray, reused over and over
        const map = puffTexture();
        v.spray = [];
        for (let k = 0; k < 40; k++) {
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, color: 0xe8f6ff, transparent: true, depthWrite: false, opacity: 0 }));
            sprite.visible = false;
            frame.add(sprite);
            v.spray.push({ sprite, life: 0, span: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, size: 1 });
        }
        v.steam = [];
        v.width = width;
        v.length = length;
        v.wet = 0;
        v.frame = frame;
        this.showWave(v, 0);
    }

    // Where the wave is in its cycle: hidden while calm; while warning it
    // rises from behind the rail until its crest stands well over it; while
    // splashing it sweeps across the cell to the far wall, sinking as it goes
    showWave(v, dt) {
        if (!v.waveMesh) return;
        const H = this.height;
        const top = H + 2;
        let offset = 0;
        let height = 0;
        if (v.phase === 'warning') {
            const u = Math.min(1, Math.max(0, 1 - v.timer / VENT_WARNING_TIME));
            const e = u * u * (3 - 2 * u);
            offset = -1.8 + 1.1 * e;
            height = top * (0.4 + 0.6 * e);
            if (Math.random() < dt * 10) this.launchSpray(v, offset + 0.6, height * 0.95, false);
        } else if (v.phase === 'puff') {
            const u = Math.min(1, Math.max(0, 1 - v.timer / VENT_PUFF_TIME));
            offset = -0.7 + (v.width + 1.0) * u;
            height = top * (1 - 0.82 * u);
            v.wet = 1;
            if (Math.random() < dt * 60) this.launchSpray(v, offset + 0.7, height * 0.9, true);
        } else {
            v.wet = Math.max(0, v.wet - dt / WAVE_DRY_TIME);
        }
        v.waveMesh.visible = height > 0;
        v.waveMesh.position.x = offset;
        v.waveMesh.scale.y = Math.max(0.01, height);
        v.wetMaterial.opacity = 0.18 + 0.5 * v.wet;
        for (const s of v.spray) {
            if (s.life <= 0) continue;
            s.life -= dt;
            s.vy -= 9 * dt;
            s.x += s.vx * dt;
            s.y = Math.max(0.1, s.y + s.vy * dt);
            const t = 1 - s.life / s.span;
            s.sprite.position.set(s.x, s.y, s.z);
            s.sprite.scale.setScalar(s.size * (0.6 + t));
            s.sprite.material.opacity = 0.8 * Math.sin(Math.PI * Math.min(1, t));
            if (s.life <= 0) s.sprite.visible = false;
        }
    }

    launchSpray(v, x, y, big) {
        const free = v.spray.find((s) => s.life <= 0);
        if (!free) return;
        free.x = x + (Math.random() - 0.3) * 0.5;
        free.y = y;
        free.z = (Math.random() - 0.5) * v.length;
        free.vx = big ? 2 + Math.random() * 2 : 0.5 + Math.random();
        free.vy = big ? 1 + Math.random() * 2 : 0.5 + Math.random();
        free.span = free.life = big ? 0.5 + Math.random() * 0.3 : 0.6 + Math.random() * 0.3;
        free.size = big ? 0.8 + Math.random() * 0.6 : 0.4 + Math.random() * 0.3;
        free.sprite.visible = true;
    }

    // Every floor block reachable from the start without entering `avoid`
    // (a set of "x,z" keys), as a set of "x,z" keys
    reachableAvoiding(avoid) {
        const seen = new Set();
        const sx = Math.floor(this.startPosition.x);
        const sz = Math.floor(this.startPosition.z);
        const todo = [[sx, sz]];
        seen.add(`${sx},${sz}`);
        while (todo.length) {
            const [x, z] = todo.pop();
            for (const [nx, nz] of [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]]) {
                const key = `${nx},${nz}`;
                if (nx < 0 || nz < 0 || nx >= this.width || nz >= this.depth) continue;
                if (seen.has(key) || avoid.has(key) || this.grid[nx][nz] !== 0) continue;
                seen.add(key);
                todo.push([nx, nz]);
            }
        }
        return seen;
    }

    // Floor steps (in blocks, along the corridors) from the nearest of the
    // `from` blocks (a set of "x,z" keys) to every floor block: a Map
    stepsFrom(from) {
        const steps = new Map();
        let todo = [];
        for (const key of from) {
            steps.set(key, 0);
            todo.push(key.split(',').map(Number));
        }
        for (let n = 1; todo.length; n++) {
            const next = [];
            for (const [x, z] of todo) {
                for (const [nx, nz] of [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]]) {
                    const key = `${nx},${nz}`;
                    if (nx < 0 || nz < 0 || nx >= this.width || nz >= this.depth) continue;
                    if (steps.has(key) || this.grid[nx][nz] !== 0) continue;
                    steps.set(key, n);
                    next.push([nx, nz]);
                }
            }
            todo = next;
        }
        return steps;
    }

    // How a snowman sounds from where the player (a circle `radius` round
    // `point`) is: `cells`, how many corridor cells away from his hallway
    // they are (0 inside it), and `past`, true once they're entirely on his
    // exit side (past him, like a steam vent)
    snowmanHearing(s, point, radius) {
        const steps = s.steps.get(`${Math.floor(point.x)},${Math.floor(point.z)}`);
        let past = true;
        for (let x = Math.floor(point.x - radius); x <= Math.floor(point.x + radius) && past; x++) {
            for (let z = Math.floor(point.z - radius); z <= Math.floor(point.z + radius); z++) {
                const key = `${x},${z}`;
                if (!s.startSide.has(key) && !s.lastCell.has(key)) continue;
                const dx = Math.max(x - point.x, 0, point.x - (x + 1));
                const dz = Math.max(z - point.z, 0, point.z - (z + 1));
                if (Math.hypot(dx, dz) < radius) { past = false; break; }
            }
        }
        return { cells: steps === undefined ? Infinity : steps / 4, past };
    }

    // Can you hear this vent? Yes while any part of the player (a circle
    // `radius` round `point`) is on its start side or on the vent itself; no
    // once the player is entirely past it, on its exit side.
    ventAudible(v, point, radius) {
        for (let x = Math.floor(point.x - radius); x <= Math.floor(point.x + radius); x++) {
            for (let z = Math.floor(point.z - radius); z <= Math.floor(point.z + radius); z++) {
                const key = `${x},${z}`;
                if (!v.startSide.has(key) && !v.blocks.has(key)) continue;
                const dx = Math.max(x - point.x, 0, point.x - (x + 1));
                const dz = Math.max(z - point.z, 0, point.z - (z + 1));
                if (Math.hypot(dx, dz) < radius) return true;
            }
        }
        return false;
    }

    // Is any part of a circle `radius` round `point` on this vent?
    onVent(v, point, radius) {
        const dx = Math.max(v.minX - point.x, 0, point.x - v.maxX);
        const dz = Math.max(v.minZ - point.z, 0, point.z - v.maxZ);
        return Math.hypot(dx, dz) < radius;
    }

    // A tail swish's corridor cell (from a vent's blocks and target): which
    // way the path runs through it, and which side wall the long-neck stands
    // behind (an outer wall of the maze if the cell has one, so he stands
    // outside the maze; otherwise the side away from the middle)
    setUpTail(v, index) {
        const d = v.center.clone().sub(v.target);
        const alongX = Math.abs(d.x) > Math.abs(d.z);
        const [lo, hi] = alongX ? [v.minZ, v.maxZ] : [v.minX, v.maxX];
        const size = alongX ? this.depth : this.width;
        let out;
        if (lo - 1 <= 0) out = -1;
        else if (hi >= size - 1) out = 1;
        else out = (lo + hi) / 2 < size / 2 ? -1 : 1;
        const t = {
            minX: v.minX, maxX: v.maxX, minZ: v.minZ, maxZ: v.maxZ, center: v.center, target: v.target, blocks: v.blocks,
            alongX, lo, hi, out,
            phase: 'lifted', timer: TAIL_LIFTED_TIME - (index % 2) * TAIL_OFFSET,
            // where the tail's line is across the cell, and how low it is (0 lifted, 1 down)
            from: out, s: 0, low: 0, hit: false, startSide: v.startSide,
        };
        t.s = this.tailSideAt(t, t.from);
        return t;
    }

    // The tail's line next to one side wall (-1 the lo wall, 1 the hi wall)
    tailSideAt(t, side) {
        return side < 0 ? t.lo + 0.45 : t.hi - 0.45;
    }

    // A world point from (across, along, up) for a tail's cell
    tailPoint(t, across, along, y) {
        return t.alongX ? new THREE.Vector3(along, y, across) : new THREE.Vector3(across, y, along);
    }

    // A tail swish (Dinosaur World): a friendly long-neck standing behind one
    // side wall of the cell, his back, neck and head showing above the wall
    // top, and his long tail reaching over the wall into the cell
    createTail(t) {
        const H = this.height;
        const skin = new THREE.MeshStandardMaterial({ color: 0x7bbf52, roughness: 0.8, emissive: 0x1a3010, emissiveIntensity: 0.35 });
        const spot = new THREE.MeshStandardMaterial({ color: 0x5a9a3a, roughness: 0.8 });
        const dark = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4 });
        const wallAcross = t.out < 0 ? t.lo - 0.5 : t.hi + 0.5;
        const bodyAcross = wallAcross + t.out * 0.15;
        const mid = t.alongX ? t.center.x : t.center.z;
        // Which way along the corridor the start side is: his tail end is that
        // way and his neck and head the other way, looking back at the player
        const back = t.alongX ? Math.sign(t.target.x - t.center.x) : Math.sign(t.target.z - t.center.z);
        const group = new THREE.Group();
        const place = (mesh, across, along, y) => {
            mesh.position.copy(this.tailPoint(t, across, along, y));
            group.add(mesh);
            return mesh;
        };
        // His back: a big rounded hump just above the wall top
        const trunk = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), skin);
        trunk.scale.set(t.alongX ? 2.2 : 0.75, 1.1, t.alongX ? 0.75 : 2.2);
        place(trunk, bodyAcross, mid - back * 0.6, H + 0.4);
        for (const [a, y, r] of [[-0.6, 0.85, 0.28], [0.4, 0.95, 0.32], [1.4, 0.8, 0.26]]) {
            const d = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), spot);
            d.scale.y = 0.5;
            place(d, bodyAcross, mid - back * a, H + 0.4 + y);
        }
        // His neck curving up from the front of his back, and his friendly head
        const neckBase = this.tailPoint(t, bodyAcross, mid - back * 2.2, H + 0.7);
        const headAt = this.tailPoint(t, bodyAcross - t.out * 0.3, mid - back * 3.4, H + 3.6);
        const neckCurve = new THREE.QuadraticBezierCurve3(neckBase, this.tailPoint(t, bodyAcross, mid - back * 3.4, H + 1.5), headAt);
        group.add(new THREE.Mesh(this.taperedTube(neckCurve, 0.55, 0.35, 16), skin));
        const head = new THREE.Group();
        const skull = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), skin);
        skull.scale.set(1, 0.8, 1.35);
        head.add(skull);
        for (const side of [-1, 1]) {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff }));
            eye.position.set(side * 0.38, 0.15, -0.2);
            const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), dark);
            pupil.position.set(side * 0.47, 0.17, -0.25);
            head.add(eye, pupil);
        }
        const smile = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.03, 6, 16, Math.PI * 0.7), dark);
        smile.rotation.set(0, 0, Math.PI + Math.PI * 0.15);
        smile.position.set(0, -0.12, -0.66);
        head.add(smile);
        head.position.copy(headAt);
        // Looking along the corridor, toward the start side
        const look = this.tailPoint(t, 0, back, 0);
        head.rotation.y = Math.atan2(-look.x, -look.z);
        group.add(head);
        t.head = head;
        t.headY = headAt.y;
        // The tail: one tapered tube from his hip over the wall, rebuilt as it moves
        t.hip = { across: wallAcross + t.out * 0.1, along: mid + back * 1.1, y: H + 0.7 };
        t.tail = new THREE.Mesh(new THREE.BufferGeometry(), skin);
        t.tail.castShadow = true;
        group.add(t.tail);
        t.mid = mid;
        t.back = back;
        t.group = group;
        this.root.add(group);
        this.showTail(t);
    }

    // A tube along `curve` that narrows from radius r0 to r1
    taperedTube(curve, r0, r1, segments = 24, radial = 8) {
        const geometry = new THREE.TubeGeometry(curve, segments, 1, radial, false);
        const pos = geometry.attributes.position;
        const v = new THREE.Vector3();
        for (let i = 0; i <= segments; i++) {
            const c = curve.getPointAt(i / segments);
            const r = r0 + (r1 - r0) * (i / segments);
            for (let j = 0; j <= radial; j++) {
                const n = i * (radial + 1) + j;
                v.fromBufferAttribute(pos, n).sub(c).multiplyScalar(r).add(c);
                pos.setXYZ(n, v.x, v.y, v.z);
            }
        }
        geometry.computeVertexNormals();
        return geometry;
    }

    // Draw the tail where it is now: from the hip up over the wall, then down
    // to its line (t.s across the cell), its end lying along the corridor
    // close to the floor when it's down (t.low 1) or held high when lifted
    showTail(t) {
        const H = this.height;
        const tipY = H + 2.2 + (0.5 - (H + 2.2)) * t.low;
        const h = t.hip;
        const m = t.mid;
        const b = t.back;
        const points = [
            this.tailPoint(t, h.across, h.along, h.y),
            this.tailPoint(t, h.across + (t.s - h.across) * 0.45, m + b * 1.3, H + 1.4 + 0.4 * (1 - t.low)),
            this.tailPoint(t, t.s, m + b * 1.0, tipY + (H + 0.8 - tipY) * 0.55),
            this.tailPoint(t, t.s, m + b * 0.5, tipY + 0.1),
            this.tailPoint(t, t.s, m - b * 1.2, tipY),
        ];
        const curve = new THREE.CatmullRomCurve3(points);
        t.drawnS = t.s;
        t.drawnLow = t.low;
        t.tail.geometry.dispose();
        t.tail.geometry = this.taperedTube(curve, 0.55, 0.16, 32, 10);
    }

    // Run every tail's cycle (only while playing), move the tails, and say
    // what happened: [{ tail, event: 'swish' | 'push' }]. A push means the
    // low tail touched part of the player (a circle `radius` round `point`);
    // it happens once per swish.
    updateTails(dt, point, radius) {
        const events = [];
        for (const t of this.tails) {
            t.timer -= dt;
            if (t.timer <= 0) {
                if (t.phase === 'lifted') {
                    Object.assign(t, { phase: 'swish', timer: t.timer + TAIL_SWISH_TIME, hit: false });
                    events.push({ tail: t, event: 'swish' });
                } else {
                    Object.assign(t, { phase: 'lifted', timer: t.timer + TAIL_LIFTED_TIME, from: -t.from, low: 0 });
                    t.s = this.tailSideAt(t, t.from);
                }
            }
            if (t.phase === 'swish') {
                const u = Math.min(1, 1 - t.timer / TAIL_SWISH_TIME);
                const a = this.tailSideAt(t, t.from);
                const z = this.tailSideAt(t, -t.from);
                if (u < TAIL_DROP) {
                    t.low = u / TAIL_DROP;
                    t.s = a;
                } else if (u > 1 - TAIL_DROP) {
                    t.low = (1 - u) / TAIL_DROP;
                    t.s = z;
                } else {
                    const f = (u - TAIL_DROP) / (1 - 2 * TAIL_DROP);
                    t.low = 1;
                    t.s = a + (z - a) * f * f * (3 - 2 * f);
                }
                if (!t.hit && point && t.low > 0.6 && this.tailTouches(t, point, radius)) {
                    t.hit = true;
                    events.push({ tail: t, event: 'push' });
                }
            }
            if (t.head) {
                t.bob = (t.bob ?? t.lo) + dt;
                t.head.position.y = t.headY + Math.sin(t.bob * 1.7) * 0.08;
                if (t.drawnS !== t.s || t.drawnLow !== t.low) this.showTail(t);
            }
        }
        return events;
    }

    // Does the low tail (its line t.s across the cell, along the whole cell)
    // touch a circle `radius` round `point`?
    tailTouches(t, point, radius) {
        const across = t.alongX ? point.z : point.x;
        const along = t.alongX ? point.x : point.z;
        const [a0, a1] = t.alongX ? [t.minX, t.maxX] : [t.minZ, t.maxZ];
        return Math.abs(across - t.s) < TAIL_THICK + radius && along > a0 - radius && along < a1 + radius;
    }

    // A slow propeller (Sky World): a giant wooden airship propeller with
    // brass tips on a brass hub, its engine pod held up on two struts from
    // the wall tops just past it (on the door side), turning slowly in the
    // plane across the hallway
    createPropeller(p) {
        const group = new THREE.Group();
        group.position.set(p.center.x, PROPELLER_HUB, p.center.z);
        // The group's x is across the hallway, its z along it (toward the door)
        const towardDoor = p.alongX ? Math.sign(p.center.x - p.target.x) : Math.sign(p.center.z - p.target.z);
        group.rotation.y = p.alongX ? (towardDoor > 0 ? Math.PI / 2 : -Math.PI / 2) : (towardDoor > 0 ? 0 : Math.PI);
        const brass = new THREE.MeshStandardMaterial({ color: 0xd4a72c, metalness: 0.25, roughness: 0.35, emissive: 0x3a2a05, emissiveIntensity: 0.4 });
        const metal = new THREE.MeshStandardMaterial({ color: 0x8a8d93, metalness: 0.3, roughness: 0.45 });
        const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.55, side: THREE.DoubleSide });
        const tipBrass = brass.clone();
        tipBrass.side = THREE.DoubleSide;
        // Below the wall tops, hide any part of a blade inside or past the
        // side walls (the slots in the walls the blades slide into)
        const across = p.alongX ? p.center.z : p.center.x;
        const slotted = (m) => {
            m.onBeforeCompile = (shader) => {
                shader.uniforms.slotAcross = { value: across };
                shader.uniforms.slotTop = { value: this.height };
                shader.vertexShader = shader.vertexShader
                    .replace('#include <common>', '#include <common>\nvarying vec3 vSlotWorld;')
                    .replace('#include <project_vertex>', '#include <project_vertex>\nvSlotWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
                shader.fragmentShader = shader.fragmentShader
                    .replace('#include <common>', '#include <common>\nvarying vec3 vSlotWorld;\nuniform float slotAcross;\nuniform float slotTop;')
                    .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\nif (abs(${p.alongX ? 'vSlotWorld.z' : 'vSlotWorld.x'} - slotAcross) > 1.5 && vSlotWorld.y < slotTop) discard;`);
            };
            m.customProgramCacheKey = () => `slot-${p.alongX ? 'z' : 'x'}`;
            return m;
        };
        slotted(wood);
        slotted(tipBrass);
        // The blades (turning in the spin group's x-y plane; one points straight
        // down at angle 0): a long rounded paddle, widest two thirds out
        const spin = new THREE.Group();
        const shape = new THREE.Shape();
        const L = PROPELLER_LENGTH;
        shape.moveTo(-0.16, 0.2);
        shape.bezierCurveTo(-0.42, L * 0.45, -0.46, L * 0.8, -0.24, L - 0.06);
        shape.quadraticCurveTo(0, L + 0.02, 0.24, L - 0.06);
        shape.bezierCurveTo(0.46, L * 0.8, 0.42, L * 0.45, 0.16, 0.2);
        shape.lineTo(-0.16, 0.2);
        const bladeGeometry = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 16 });
        bladeGeometry.translate(0, 0, -0.06);
        bladeGeometry.rotateX(Math.PI); // pointing down (-y)
        const tipShape = new THREE.Shape();
        tipShape.moveTo(-0.3, L - 0.42);
        tipShape.lineTo(0.3, L - 0.42);
        tipShape.bezierCurveTo(0.34, L - 0.25, 0.3, L - 0.1, 0.24, L - 0.06);
        tipShape.quadraticCurveTo(0, L + 0.02, -0.24, L - 0.06);
        tipShape.bezierCurveTo(-0.3, L - 0.1, -0.34, L - 0.25, -0.3, L - 0.42);
        const tipGeometry = new THREE.ExtrudeGeometry(tipShape, { depth: 0.22, bevelEnabled: false, curveSegments: 12 });
        tipGeometry.translate(0, 0, -0.11);
        tipGeometry.rotateX(Math.PI);
        for (let b = 0; b < PROPELLER_BLADES; b++) {
            const arm = new THREE.Group();
            arm.rotation.z = (b * 2 * Math.PI) / PROPELLER_BLADES;
            const blade = new THREE.Mesh(bladeGeometry, wood);
            blade.rotation.y = 0.25; // a little pitch, like a real propeller
            const tip = new THREE.Mesh(tipGeometry, tipBrass);
            tip.rotation.y = 0.25;
            arm.add(blade, tip);
            spin.add(arm);
        }
        // The hub: a brass drum with a pointed nose cone toward the start
        const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.36, 20), brass);
        drum.rotation.x = Math.PI / 2;
        const nose = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.5, 20), brass);
        nose.rotation.x = -Math.PI / 2;
        nose.position.z = -0.43;
        spin.add(drum, nose);
        for (let b = 0; b < 6; b++) {
            const bolt = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), metal);
            const a = (b * Math.PI) / 3;
            bolt.position.set(Math.cos(a) * 0.22, Math.sin(a) * 0.22, -0.19);
            spin.add(bolt);
        }
        group.add(spin);
        // The engine pod behind the hub (door side) and its two struts up to the wall tops
        const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.3, 1.5, 20), metal);
        pod.rotation.x = Math.PI / 2;
        pod.position.z = 0.95;
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 6, 20), brass);
        band.position.z = 0.22;
        group.add(pod, band);
        for (const side of [-1, 1]) {
            const from = new THREE.Vector3(side * 0.3, 0.2, 1.1);
            const to = new THREE.Vector3(side * 1.9, this.height - PROPELLER_HUB + 0.05, 1.1);
            const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, from.distanceTo(to), 8), metal);
            strut.position.copy(from).add(to).multiplyScalar(0.5);
            strut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
            const foot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.4), metal);
            foot.position.set(side * 2, this.height - PROPELLER_HUB + 0.04, 1.1);
            group.add(strut, foot);
        }
        // Dark slots in the side walls' faces where the blades go in
        for (const side of [-1, 1]) {
            const slot = new THREE.Mesh(new THREE.PlaneGeometry(0.34, this.height), new THREE.MeshBasicMaterial({ color: 0x1c1a17 }));
            slot.position.set(side * 1.49, this.height / 2 - PROPELLER_HUB, 0);
            slot.rotation.y = -side * Math.PI / 2;
            group.add(slot);
        }
        p.spin = spin;
        p.group = group;
        // Our spin turns the blades the same way the hit test does: across = sin, up = -cos
        p.sign = group.rotation.y === 0 || group.rotation.y === -Math.PI / 2 ? 1 : -1;
        this.root.add(group);
        this.placePropeller(p);
    }

    placePropeller(p) {
        if (p.spin) p.spin.rotation.z = p.angle * (p.sign ?? 1);
    }

    // Turn every propeller (only while playing) and say what happened:
    // [{ propeller, event: 'push' }] when a blade starts touching the player
    // (a standing body `radius` round `point`, `height` tall)
    updatePropellers(dt, point, radius, height) {
        const events = [];
        for (const p of this.propellers) {
            p.angle = (p.angle + (dt * 2 * Math.PI) / PROPELLER_TURN_TIME) % (2 * Math.PI);
            this.placePropeller(p);
            const touching = !!point && this.propellerTouches(p, point, radius, height);
            if (touching && !p.touching) events.push({ propeller: p, event: 'push' });
            p.touching = touching;
        }
        return events;
    }

    // Does a blade touch a standing body (radius round point, height tall)?
    // In the propeller's plane: the body is the line from (a, 0) to (a, height)
    // across the hallway, a blade the line from the hub out to its tip.
    propellerTouches(p, point, radius, height = 1.8) {
        const along = p.alongX ? point.x - p.center.x : point.z - p.center.z;
        if (Math.abs(along) > PROPELLER_DEPTH + radius) return false;
        const a = p.alongX ? point.z - p.center.z : point.x - p.center.x;
        for (let b = 0; b < PROPELLER_BLADES; b++) {
            const angle = p.angle + (b * 2 * Math.PI) / PROPELLER_BLADES;
            const tip = { x: Math.sin(angle) * PROPELLER_LENGTH, y: PROPELLER_HUB - Math.cos(angle) * PROPELLER_LENGTH };
            if (segmentDistance2D({ x: 0, y: PROPELLER_HUB }, tip, { x: a, y: 0 }, { x: a, y: height }) < PROPELLER_BLADE_REACH + radius) return true;
        }
        return false;
    }

    // How far a point is from the nearest propeller (for its hum), or Infinity
    propellerDistance(point) {
        let best = Infinity;
        for (const p of this.propellers) best = Math.min(best, Math.hypot(point.x - p.center.x, point.z - p.center.z));
        return best;
    }

    // The tail swish whose cell a point is in, or null
    tailAt(point) {
        return this.tails.find((t) => point.x >= t.minX && point.x < t.maxX && point.z >= t.minZ && point.z < t.maxZ) ?? null;
    }

    // A lava geyser (Volcano World): a glowing hole of bubbling lava across its
    // whole corridor cell in a rocky rim. When it erupts, a column of lava
    // shoots up well above the walls, with blobs flying off the top.
    createGeyser(g) {
        const sizeX = g.maxX - g.minX;
        const sizeZ = g.maxZ - g.minZ;
        const group = new THREE.Group();
        group.position.set(g.center.x, 0, g.center.z);
        const rim = new THREE.Mesh(new THREE.BoxGeometry(sizeX - 0.05, 0.08, sizeZ - 0.05), new THREE.MeshStandardMaterial({ color: 0x2a1d1a, roughness: 0.9 }));
        rim.position.y = 0.04;
        group.add(rim);
        const map = lavaTexture();
        const pool = new THREE.Mesh(new THREE.PlaneGeometry(sizeX * 0.82, sizeZ * 0.82), new THREE.MeshBasicMaterial({ map, color: 0xffffff }));
        pool.rotation.x = -Math.PI / 2;
        pool.position.y = 0.085;
        group.add(pool);
        // The column: an outer orange skin and a brighter yellow core
        const height = this.height * 2.2;
        const radius = Math.min(sizeX, sizeZ) * 0.42;
        const column = new THREE.Group();
        const columnMap = lavaTexture();
        columnMap.repeat.set(2, 3);
        const outer = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.8, radius, height, 20, 1, true), new THREE.MeshBasicMaterial({ map: columnMap, side: THREE.DoubleSide }));
        outer.position.y = height / 2;
        column.add(outer);
        const core = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.45, radius * 0.6, height * 1.04, 12), new THREE.MeshBasicMaterial({ color: 0xffe066 }));
        core.position.y = height * 0.52;
        column.add(core);
        column.visible = false;
        group.add(column);
        // Blobs of lava flung off the top, reused over and over
        const blobMaterial = new THREE.MeshBasicMaterial({ color: 0xffa020 });
        const blobGeometry = new THREE.SphereGeometry(0.22, 8, 6);
        g.blobs = [];
        for (let k = 0; k < 24; k++) {
            const mesh = new THREE.Mesh(blobGeometry, blobMaterial);
            mesh.visible = false;
            group.add(mesh);
            g.blobs.push({ mesh, life: 0, v: new THREE.Vector3() });
        }
        Object.assign(g, { group, pool, column, columnMap, poolMap: map, height });
        this.root.add(group);
        this.showGeyser(g, 0);
    }

    // Run every geyser's timer (only while playing) and animate it, and say
    // what happened: [{ geyser, event: 'erupt' | 'hit' }]. A hit means part of
    // the player (a circle `radius` round `point`) is in an erupting geyser.
    updateGeysers(dt, point, radius) {
        const events = [];
        for (const g of this.geysers) {
            const inCell = !!point && this.inGeyser(g, point, radius);
            g.timer -= dt;
            if (g.phase === 'quiet') {
                // Its time is up, but never while you're in it: it waits for you to leave
                g.waiting = g.timer <= 0 && inCell;
                if (g.timer <= 0 && !inCell) {
                    Object.assign(g, { phase: 'erupt', timer: GEYSER_ERUPT_TIME, waiting: false });
                    events.push({ geyser: g, event: 'erupt' });
                }
            } else if (g.timer <= 0) {
                Object.assign(g, { phase: 'quiet', timer: GEYSER_QUIET_TIME });
            }
            if (g.phase === 'erupt') {
                const t = GEYSER_ERUPT_TIME - g.timer;
                g.rise = Math.min(1, t / GEYSER_RISE, Math.max(0, g.timer) / GEYSER_SINK);
            } else {
                g.rise = 0;
            }
            if (g.phase === 'erupt' && inCell) events.push({ geyser: g, event: 'hit' });
            this.showGeyser(g, dt);
        }
        return events;
    }

    showGeyser(g, dt) {
        if (!g.group) return;
        const t = performance.now() / 1000;
        g.poolMap.offset.set(Math.sin(t * 0.3) * 0.1, t * 0.05);
        g.columnMap.offset.y = -t * 1.6;
        // The hole bubbles brighter just before it erupts and while erupting
        const soon = g.phase === 'erupt' || (g.timer < GEYSER_BUBBLE);
        const flicker = 0.85 + 0.15 * Math.sin(t * (soon ? 22 : 5));
        g.pool.material.color.setScalar(soon ? flicker : 0.55 * flicker);
        g.column.visible = g.rise > 0;
        g.column.scale.set(0.9 + 0.1 * Math.sin(t * 30), Math.max(0.001, g.rise), 0.9 + 0.1 * Math.cos(t * 27));
        const top = g.height * g.rise;
        for (const b of g.blobs) {
            if (b.life <= 0 && g.rise >= 1 && Math.random() < dt * 12) {
                b.life = 0.6 + Math.random() * 0.5;
                b.mesh.position.set((Math.random() - 0.5) * 0.6, top, (Math.random() - 0.5) * 0.6);
                b.v.set((Math.random() - 0.5) * 3, 2 + Math.random() * 3, (Math.random() - 0.5) * 3);
            }
            if (b.life > 0) {
                b.life -= dt;
                b.v.y -= 14 * dt;
                b.mesh.position.addScaledVector(b.v, dt);
                // Keep them over the hole so they never land on the floor around it
                b.mesh.position.x = Math.max(-1, Math.min(1, b.mesh.position.x));
                b.mesh.position.z = Math.max(-1, Math.min(1, b.mesh.position.z));
                if (b.mesh.position.y < 0) b.life = 0;
            }
            b.mesh.visible = b.life > 0;
        }
    }

    // A big snowman (Ice World): three snowballs, coal eyes and buttons, a
    // carrot nose, a red scarf, a black top hat and stick arms. He faces down
    // his hallway; his right arm comes up just before each throw.
    createSnowman(s) {
        const group = new THREE.Group();
        // Pressed back against the end wall a little
        group.position.copy(s.center).addScaledVector(s.facing, -0.2);
        group.rotation.y = Math.atan2(s.facing.x, s.facing.z);
        const snow = new THREE.MeshStandardMaterial({ color: 0xf6f9ff, emissive: 0x9fb4d8, emissiveIntensity: 0.25, roughness: 0.9 });
        const coal = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.6 });
        const stick = new THREE.MeshStandardMaterial({ color: 0x5b3a1f, roughness: 0.9 });
        const parts = [[0.95, 0.85], [0.72, 2.1], [0.5, 3.0]];
        for (const [r, y] of parts) {
            const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), snow);
            ball.position.y = y;
            group.add(ball);
        }
        for (const side of [-1, 1]) {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), coal);
            eye.position.set(side * 0.17, 3.12, 0.44);
            group.add(eye);
        }
        for (const y of [1.85, 2.15, 2.45]) {
            const button = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), coal);
            button.position.set(0, y, Math.sqrt(Math.max(0, 0.72 ** 2 - (y - 2.1) ** 2)) + 0.02);
            group.add(button);
        }
        const nose = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.45, 10), new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.7 }));
        nose.rotation.x = Math.PI / 2;
        nose.position.set(0, 3.0, 0.68);
        group.add(nose);
        const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.1, 8, 20), new THREE.MeshStandardMaterial({ color: 0xd0263a, roughness: 0.8 }));
        scarf.rotation.x = Math.PI / 2;
        scarf.position.y = 2.6;
        group.add(scarf);
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 20), coal);
        brim.position.y = 3.42;
        const top = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.45, 20), coal);
        top.position.y = 3.66;
        group.add(brim, top);
        // Stick arms from the middle ball: the left one still, the right one throws
        const arms = [];
        for (const side of [-1, 1]) {
            const shoulder = new THREE.Group();
            shoulder.position.set(side * 0.65, 2.25, 0);
            const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.1, 6), stick);
            arm.position.y = 0.55;
            shoulder.add(arm);
            shoulder.rotation.z = -side * 1.0;
            group.add(shoulder);
            arms.push(shoulder);
        }
        this.root.add(group);
        // The snowballs he throws (one in the air at a time; a spare just in case)
        const ballMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xa8bce0, emissiveIntensity: 0.3, roughness: 0.95 });
        s.ballMeshes = [0, 1].map(() => {
            const mesh = new THREE.Mesh(new THREE.SphereGeometry(SNOWBALL_RADIUS, 18, 12), ballMaterial);
            // A few lumps of packed snow, so you can see it tumble
            for (const [x, y, z] of [[1, 0.3, 0], [-0.6, 0.7, 0.4], [0, -0.8, 0.6], [0.2, 0.5, -0.85], [-0.7, -0.4, -0.5], [0.5, -0.3, 0.8]]) {
                const lump = new THREE.Mesh(new THREE.SphereGeometry(SNOWBALL_RADIUS * 0.3, 10, 8), ballMaterial);
                lump.position.set(x, y, z).normalize().multiplyScalar(SNOWBALL_RADIUS * 0.92);
                mesh.add(lump);
            }
            mesh.visible = false;
            this.root.add(mesh);
            return mesh;
        });
        Object.assign(s, { group, throwArm: arms[1] });
        this.showSnowman(s);
    }

    showSnowman(s) {
        if (!s.group) return;
        // The throwing arm comes up before a throw and swings down after it
        const sinceThrow = SNOWMAN_THROW_TIME - s.timer;
        const windup = Math.max(0, 1 - s.timer / SNOWMAN_WINDUP);
        const swing = Math.max(0, 1 - sinceThrow / 0.25);
        s.throwArm.rotation.z = -1.0 + 1.9 * Math.max(windup, swing);
        s.throwArm.rotation.x = windup > 0 ? -0.6 * windup : 0.9 * swing;
        s.ballMeshes.forEach((mesh, k) => {
            const ball = s.balls[k];
            mesh.visible = !!ball;
            if (!ball) return;
            const p = this.hallPoint(s, ball.u, s.width / 2);
            mesh.position.set(p.x, SNOWBALL_RADIUS + 0.05, p.z);
            // It grows to full size as it leaves his hands
            mesh.scale.setScalar(Math.min(1, 0.4 + 0.6 * (s.startU - ball.u) / 2));
            // It tumbles toward the start
            if (s.alongX) mesh.rotation.set(0, 0, ball.spin * s.sign);
            else mesh.rotation.set(-ball.spin * s.sign, 0, 0);
        });
    }

    // A trapdoor (Desert Pyramid World, Level 104 on): a square of two
    // wooden flaps with iron straps and a ring, set flush in the sand floor
    // across its whole corridor cell inside a sandstone frame, over a deep
    // dark hole. While it warns, the flaps shake and sand trickles down
    // through the cracks round its edges; when it opens the flaps swing down
    // into the dark.
    createTrapdoor(t) {
        const sizeX = t.maxX - t.minX;
        const sizeZ = t.maxZ - t.minZ;
        const group = new THREE.Group();
        group.position.set(t.center.x, 0, t.center.z);
        // The hole: black at the bottom, with dark sandstone sides going down
        const hole = new THREE.Group();
        const black = new THREE.Mesh(new THREE.PlaneGeometry(sizeX - 0.1, sizeZ - 0.1), new THREE.MeshBasicMaterial({ color: 0x050302 }));
        black.rotation.x = -Math.PI / 2;
        black.position.y = 0.006;
        hole.add(black);
        const sideMaterial = new THREE.MeshBasicMaterial({ color: 0x2a1a0c, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
        for (const [w, x, z, ry] of [[sizeX - 0.1, 0, -(sizeZ - 0.1) / 2, 0], [sizeX - 0.1, 0, (sizeZ - 0.1) / 2, 0], [sizeZ - 0.1, -(sizeX - 0.1) / 2, 0, Math.PI / 2], [sizeZ - 0.1, (sizeX - 0.1) / 2, 0, Math.PI / 2]]) {
            // A thin dark band just inside each edge, so the hole looks deep
            const band = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.35), sideMaterial);
            band.rotation.set(-Math.PI / 2, 0, ry);
            band.position.set(x * 0.9, 0.008, z * 0.9);
            hole.add(band);
        }
        group.add(hole);
        // The sandstone frame round it
        const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x9a7038, roughness: 0.95 });
        for (const [w, d, x, z] of [[sizeX, 0.1, 0, -sizeZ / 2 + 0.05], [sizeX, 0.1, 0, sizeZ / 2 - 0.05], [0.1, sizeZ, -sizeX / 2 + 0.05, 0], [0.1, sizeZ, sizeX / 2 - 0.05, 0]]) {
            const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), frameMaterial);
            bar.position.set(x, 0.025, z);
            group.add(bar);
        }
        // Two flaps, hinged on opposite sides, meeting in the middle
        const wood = woodPlankTexture();
        const flapMaterial = new THREE.MeshStandardMaterial({ map: wood, color: 0xc89a60, roughness: 0.85 });
        const iron = new THREE.MeshStandardMaterial({ color: 0x3a3430, metalness: 0.6, roughness: 0.5 });
        const flapW = sizeX - 0.2;
        const flapD = (sizeZ - 0.2) / 2 - 0.02;
        t.flaps = [-1, 1].map((side) => {
            const hinge = new THREE.Group();
            hinge.position.set(0, 0.03, side * (sizeZ / 2 - 0.1));
            const flap = new THREE.Mesh(new THREE.BoxGeometry(flapW, 0.05, flapD), flapMaterial);
            flap.position.z = -side * flapD / 2;
            hinge.add(flap);
            for (const sx of [-0.3, 0.3]) {
                const strap = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, flapD * 0.9), iron);
                strap.position.set(sx * flapW, 0.035, -side * flapD / 2);
                hinge.add(strap);
            }
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 6, 14), iron);
            ring.rotation.x = Math.PI / 2;
            ring.position.set(0, 0.04, -side * (flapD - 0.18));
            hinge.add(ring);
            group.add(hinge);
            return { hinge, side };
        });
        // Trickling sand: grains that fall from the floor round its edges and
        // through the crack in the middle while it warns
        const grains = 90;
        const positions = new Float32Array(grains * 3);
        const sandGeometry = new THREE.BufferGeometry();
        sandGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        t.sand = new THREE.Points(sandGeometry, new THREE.PointsMaterial({ color: 0xe8c078, size: 0.06 }));
        t.sand.visible = false;
        t.grains = [];
        for (let k = 0; k < grains; k++) {
            // Where along the edges (or the middle crack) it falls
            const edge = k % 5;
            const u = (Math.random() - 0.5);
            const x = edge === 0 ? -sizeX / 2 + 0.12 : edge === 1 ? sizeX / 2 - 0.12 : u * (sizeX - 0.3);
            const z = edge === 2 ? -sizeZ / 2 + 0.12 : edge === 3 ? sizeZ / 2 - 0.12 : edge === 4 ? 0 : u * (sizeZ - 0.3);
            t.grains.push({ x, z: edge < 2 ? u * (sizeZ - 0.3) : z, y: Math.random() * 0.14, speed: 0.15 + Math.random() * 0.2 });
        }
        group.add(t.sand);
        t.group = group;
        this.root.add(group);
        this.showTrapdoor(t, 0);
    }

    // Run every trapdoor's timer (only while playing) and animate it, and say
    // what happened: [{ trapdoor, event: 'warning' | 'open' | 'fall' }]. A
    // fall means the player's center (`point`) is over an open trapdoor.
    updateTrapdoors(dt, point) {
        const events = [];
        for (const t of this.trapdoors) {
            t.timer -= dt;
            if (t.timer <= 0) {
                if (t.phase === 'closed') {
                    Object.assign(t, { phase: 'warning', timer: t.timer + TRAPDOOR_WARNING_TIME });
                    events.push({ trapdoor: t, event: 'warning' });
                } else if (t.phase === 'warning') {
                    Object.assign(t, { phase: 'open', timer: t.timer + TRAPDOOR_OPEN_TIME });
                    events.push({ trapdoor: t, event: 'open' });
                } else {
                    Object.assign(t, { phase: 'closed', timer: t.timer + TRAPDOOR_CLOSED_TIME });
                }
            }
            if (t.phase === 'open') t.open = Math.min(1, (TRAPDOOR_OPEN_TIME - t.timer) / TRAPDOOR_SWING, Math.max(0, t.timer) / TRAPDOOR_SWING);
            else t.open = 0;
            if (t.phase === 'open' && point && this.overTrapdoor(t, point)) events.push({ trapdoor: t, event: 'fall' });
            this.showTrapdoor(t, dt);
        }
        return events;
    }

    // Is a point (the player's center) over this trapdoor's cell?
    overTrapdoor(t, point) {
        return point.x > t.minX && point.x < t.maxX && point.z > t.minZ && point.z < t.maxZ;
    }

    showTrapdoor(t, dt) {
        if (!t.group) return;
        const time = performance.now() / 1000;
        const warning = t.phase === 'warning';
        // Shut, the flaps lie flat; open, they hang straight down into the hole
        for (const { hinge, side } of t.flaps) {
            const shake = warning ? 0.025 * Math.sin(time * 55 + side * 1.7) : 0;
            hinge.rotation.x = -side * (t.open * Math.PI / 2 * 0.98) + shake;
            hinge.position.y = 0.03 + (warning ? 0.012 * Math.abs(Math.sin(time * 40 + side)) : 0);
            hinge.visible = true;
        }
        // Sand trickles down while it warns (and a moment after it opens)
        t.sand.visible = warning || (t.phase === 'open' && t.open < 1);
        if (t.sand.visible) {
            const positions = t.sand.geometry.attributes.position.array;
            t.grains.forEach((g, k) => {
                g.y -= g.speed * dt;
                if (g.y < -0.02) g.y = 0.1 + Math.random() * 0.04;
                positions[3 * k] = g.x + (warning ? 0.01 * Math.sin(time * 50 + k) : 0);
                positions[3 * k + 1] = g.y;
                positions[3 * k + 2] = g.z;
            });
            t.sand.geometry.attributes.position.needsUpdate = true;
        }
    }

    // Is any part of a circle `radius` round `point` in this geyser's cell?
    inGeyser(g, point, radius) {
        const dx = Math.max(g.minX - point.x, 0, point.x - g.maxX);
        const dz = Math.max(g.minZ - point.z, 0, point.z - g.maxZ);
        return Math.hypot(dx, dz) < radius;
    }

    // The water current (Level 41): swirling sand streaks rushing across its
    // cell the way it pushes, and bubbles streaming the same way. Both carry on
    // a little into the side dead end so you can see where it sends you.
    createCurrent(c) {
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
            this.placeBubble(bubble, c);
            c.bubbles.push(bubble);
        }
    }

    placeBubble(bubble, c) {
        const across = new THREE.Vector3(-c.dir.z, 0, c.dir.x);
        const half = (c.maxX - c.minX) / 2;
        bubble.start = c.center.clone().addScaledVector(c.dir, -half).addScaledVector(across, (Math.random() - 0.5) * 2.6);
        bubble.start.y = 0.1 + Math.random() * 1.2;
        bubble.speed = 3 + Math.random() * 2;
        bubble.wobble = Math.random() * 6;
    }

    updateCurrent(c, dt) {
        c.streaks.material.map.offset.x -= dt * 1.4; // the streaks rush the way it pushes
        const reach = (c.maxX - c.minX) + 1.5; // across the cell and a bit into the dead end
        for (const b of c.bubbles) {
            b.t += (dt * b.speed) / reach;
            if (b.t >= 1) {
                b.t -= 1;
                this.placeBubble(b, c);
            }
            b.wobble += dt * 5;
            const across = new THREE.Vector3(-c.dir.z, 0, c.dir.x);
            b.mesh.position.copy(b.start).addScaledVector(c.dir, b.t * reach).addScaledVector(across, Math.sin(b.wobble) * 0.15);
            b.mesh.position.y = b.start.y + b.t * 1.6;
        }
    }

    // The water current whose cell this point is inside, if any
    inCurrent(point) {
        return this.currents.find((c) => point.x > c.minX && point.x < c.maxX && point.z > c.minZ && point.z < c.maxZ) ?? null;
    }

    // Did someone walking from `from` into the current come from its dead end
    // (the side it pushes toward)? Then it lets them back out without a shove.
    cameFromCurrentDeadEnd(from, c) {
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
        if (this.theme.underwater) return this.createBigUrchin(row);
        if (this.theme.sweets) return this.createBigCandyCane(row);
        if (this.theme.volcano) return this.createBigHotCoal(row);
        if (this.theme.ice) return this.createBigIcicle(row);
        if (this.theme.factory) return this.createBigZapper(row);
        if (this.theme.desert) return this.createBigCactus(row);
        if (this.theme.dino) return this.createBigBoneSpike(row);
        if (this.theme.pirate) return this.createBigSplinterSpike(row);
        if (this.theme.skyland) return this.createBigStormCloud(row);
        if (this.theme.mushroom) return this.createBigOuchMushroom(row);
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

    // Candy World's spike row (Level 53): a big broken candy cane right across
    // the corridor, as wide as the corridor and as deep as a spike row: a
    // fence of thick striped pieces with sharp snapped-off tips, and one giant
    // cane in the middle whose hook arches over the top, so there's no way past
    createBigCandyCane(row) {
        const group = new THREE.Group();
        const map = candyStripeTexture();
        map.repeat.set(1, 3);
        const striped = new THREE.MeshStandardMaterial({ map, roughness: 0.3, emissive: 0x3a0008, emissiveIntensity: 0.2 });
        const sugar = new THREE.MeshStandardMaterial({ color: 0xfff4f4, roughness: 0.25 });
        // [x across the corridor, z along it, height, lean]
        const pieces = [[-1.25, 0.18, 0.9, 0.2], [-0.85, -0.16, 1.25, -0.15], [-0.45, 0.2, 1.0, 0.1],
            [0.45, -0.18, 1.1, -0.1], [0.85, 0.16, 1.35, 0.15], [1.25, -0.14, 0.95, -0.2]];
        for (const [x, z, h, lean] of pieces) {
            const stick = new THREE.Group();
            const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, h, 16), striped);
            body.position.y = h / 2;
            const tip = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.42, 5), sugar);
            tip.position.y = h + 0.2;
            tip.rotation.y = x * 2;
            body.castShadow = tip.castShadow = true;
            stick.add(body, tip);
            stick.position.set(x, 0, z);
            stick.rotation.set(lean * 0.5, 0, -lean);
            group.add(stick);
        }
        // The giant cane in the middle, whole, its hook curling over the fence
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.1, 18), striped);
        pole.position.set(0, 1.05, 0);
        pole.castShadow = true;
        group.add(pole);
        const hook = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.2, 14, 28, Math.PI), striped);
        hook.position.set(0.5, 2.1, 0);
        hook.castShadow = true;
        group.add(hook);
        const end = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.45, 6), sugar);
        end.position.set(1.0, 1.9, 0);
        end.rotation.z = Math.PI;
        group.add(end);
        if (!row.spansX) group.rotation.y = Math.PI / 2;
        group.position.copy(row.position);
        group.position.y = 0;
        this.root.add(group);
    }

    // Volcano World's spike row (Level 64): a big hot coal right across the
    // corridor, as wide as the corridor and as deep as a spike row: one giant
    // glowing coal in the middle with smaller coals piled against it at both
    // sides, so there's no way past
    createBigHotCoal(row) {
        const group = new THREE.Group();
        const map = coalTexture();
        this.coals = this.coals || [];
        // [x across the corridor, z along it, half-width, height]
        const lumps = [[0, 0, 0.62, 1.3], [-0.95, 0.08, 0.42, 0.85], [0.95, -0.06, 0.42, 0.9],
            [-1.3, -0.12, 0.22, 0.45], [1.3, 0.12, 0.22, 0.5], [-0.45, -0.2, 0.25, 0.4], [0.5, 0.22, 0.24, 0.45]];
        lumps.forEach(([x, z, size, h], n) => {
            const geometry = new THREE.IcosahedronGeometry(1, 1);
            const pos = geometry.attributes.position;
            for (let k = 0; k < pos.count; k++) {
                const wobble = 0.82 + 0.3 * Math.abs(Math.sin(k * 12.9898 + n * 41.37));
                pos.setXYZ(k, pos.getX(k) * wobble, pos.getY(k) * wobble, pos.getZ(k) * wobble);
            }
            geometry.computeVertexNormals();
            const material = new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: 1, roughness: 0.8 });
            const lump = new THREE.Mesh(geometry, material);
            // Never deeper than the row (the lumps are about 1.1 x their size)
            lump.scale.set(size, h / 2, Math.min(size, 0.36));
            lump.position.set(x, h * 0.45, z);
            lump.castShadow = true;
            lump.userData.phase = n * 1.3;
            this.coals.push(lump);
            group.add(lump);
        });
        // A warm glow on the floor under it
        const glow = new THREE.Mesh(new THREE.PlaneGeometry(SPIKE_ROW_WIDTH, SPIKE_ROW_DEPTH + 0.6), new THREE.MeshBasicMaterial({ color: 0xff5a00, transparent: true, opacity: 0.35, depthWrite: false }));
        glow.rotation.x = -Math.PI / 2;
        glow.position.y = 0.02;
        group.add(glow);
        if (!row.spansX) group.rotation.y = Math.PI / 2;
        group.position.copy(row.position);
        group.position.y = 0;
        this.root.add(group);
    }

    // Ice World's spike row (Level 74): the icicle arch. An igloo arch of ice
    // bricks wall to wall, as deep as a spike row, with a curtain of icicles
    // hanging from it all the way across: long ones nearly to the snow in the
    // middle and at the sides, so there's no way past
    createBigIcicle(row) {
        const group = new THREE.Group();
        const half = SPIKE_ROW_WIDTH / 2;
        const legHeight = 2.1;
        const brick = (shade) => new THREE.MeshStandardMaterial({ color: new THREE.Color(0.82 * shade, 0.93 * shade, 1), emissive: 0x3a8ad0, emissiveIntensity: 0.35, roughness: 0.25 });
        const shades = [1, 0.93, 0.97, 0.9, 1.02];
        let n = 0;
        for (const side of [-1, 1]) {
            for (let y = 0; y < legHeight; y += 0.35) {
                const b = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.32, 0.7), brick(shades[n++ % shades.length]));
                b.position.set(side * (half - 0.14), y + 0.17, 0);
                group.add(b);
            }
        }
        const archRadius = half - 0.14;
        const bricks = 11;
        for (let k = 0; k < bricks; k++) {
            const a = ((k + 0.5) / bricks) * Math.PI;
            const b = new THREE.Mesh(new THREE.BoxGeometry(0.28, (Math.PI * archRadius) / bricks - 0.03, 0.7), brick(shades[n++ % shades.length]));
            b.position.set(Math.cos(a) * archRadius, legHeight + Math.sin(a) * archRadius, 0);
            b.rotation.z = a;
            group.add(b);
        }
        // The curtain: two staggered rows of icicles across the whole arch
        const iceMaterial = new THREE.MeshStandardMaterial({ color: 0xd8f6ff, emissive: 0x6fd0ff, emissiveIntensity: 0.6, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.92 });
        const count = 9;
        for (const [dz, shift] of [[-0.16, 0], [0.16, 0.5]]) {
            for (let k = 0; k < count; k++) {
                const ox = -half + 0.32 + ((k + shift) / (count - 0.5)) * (2 * half - 0.64);
                const y = legHeight + Math.sqrt(Math.max(0, archRadius * archRadius - ox * ox)) - 0.1;
                const tip = 0.15 + 0.25 * Math.abs(Math.sin(k * 2.3 + shift * 5));
                const len = y - tip;
                const icicle = new THREE.Mesh(new THREE.ConeGeometry(0.17, len, 10), iceMaterial);
                icicle.rotation.x = Math.PI;
                icicle.position.set(ox, y - len / 2, dz);
                icicle.castShadow = true;
                group.add(icicle);
            }
        }
        // A frosty blue strip on the snow under it
        const frost = new THREE.Mesh(new THREE.PlaneGeometry(SPIKE_ROW_WIDTH, SPIKE_ROW_DEPTH + 0.4), new THREE.MeshBasicMaterial({ color: 0x7fd6ff, transparent: true, opacity: 0.4, depthWrite: false }));
        frost.rotation.x = -Math.PI / 2;
        frost.position.y = 0.02;
        group.add(frost);
        if (!row.spansX) group.rotation.y = Math.PI / 2;
        group.position.copy(row.position);
        group.position.y = 0;
        this.root.add(group);
    }

    // Robot Factory World's spike row (Level 85): the big zapper. A fence of
    // four tall copper posts wall to wall on a hazard plate, as deep as a
    // spike row, with electricity crackling between every pair of posts at
    // two heights, sparks flying and a blue glow, so there's no way past.
    // Its arcs flicker with the small zappers (this.zappers).
    createBigZapper(row) {
        const group = new THREE.Group();
        const half = SPIKE_ROW_WIDTH / 2;
        const plate = new THREE.Mesh(new THREE.BoxGeometry(SPIKE_ROW_WIDTH, 0.08, SPIKE_ROW_DEPTH), new THREE.MeshStandardMaterial({ color: 0x2c2f34, metalness: 0.6, roughness: 0.5 }));
        plate.position.y = 0.04;
        group.add(plate);
        // Yellow hazard edges along both sides of the plate
        const yellow = new THREE.MeshStandardMaterial({ color: 0xf2c230, emissive: 0x6a5000, emissiveIntensity: 0.6 });
        for (const side of [-1, 1]) {
            const edge = new THREE.Mesh(new THREE.BoxGeometry(SPIKE_ROW_WIDTH, 0.03, 0.08), yellow);
            edge.position.set(0, 0.095, side * (SPIKE_ROW_DEPTH / 2 - 0.06));
            group.add(edge);
        }
        const copper = new THREE.MeshStandardMaterial({ color: 0xc8743a, metalness: 0.8, roughness: 0.3 });
        const coilMaterial = new THREE.MeshStandardMaterial({ color: 0x9fe8ff, emissive: 0x40c8ff, emissiveIntensity: 1.2 });
        const height = 1.55;
        const xs = [-half + 0.14, -0.45, 0.45, half - 0.14];
        for (const x of xs) {
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, height, 10), copper);
            post.position.set(x, height / 2 + 0.08, 0);
            post.castShadow = true;
            group.add(post);
            for (let k = 0; k < 7; k++) {
                const coil = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 6, 16), copper);
                coil.rotation.x = Math.PI / 2;
                coil.position.set(x, 0.3 + k * 0.18, 0);
                group.add(coil);
            }
            const ball = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), coilMaterial);
            ball.position.set(x, height + 0.14, 0);
            group.add(ball);
        }
        const glow = new THREE.Mesh(new THREE.PlaneGeometry(SPIKE_ROW_WIDTH, SPIKE_ROW_DEPTH + 0.6), new THREE.MeshBasicMaterial({ color: 0x40c8ff, transparent: true, opacity: 0.3, depthWrite: false }));
        glow.rotation.x = -Math.PI / 2;
        glow.position.y = 0.1;
        group.add(glow);
        // Between each pair of posts, at the top and halfway up: two
        // crackling arcs and a few sparks (the same as a small zapper's)
        this.zappers = this.zappers || [];
        for (let k = 0; k + 1 < xs.length; k++) {
            for (const y of [height + 0.14, 0.85]) {
                const tops = [new THREE.Vector3(xs[k], y, 0), new THREE.Vector3(xs[k + 1], y, 0)];
                const arcs = [0, 1].map((n) => {
                    const material = new THREE.MeshBasicMaterial({ color: n ? 0xffffff : 0x8fe0ff });
                    const bars = [];
                    for (let b = 0; b < 8; b++) {
                        const bar = new THREE.Mesh(new THREE.BoxGeometry(n ? 0.025 : 0.045, n ? 0.025 : 0.045, 1), material);
                        group.add(bar);
                        bars.push(bar);
                    }
                    return bars;
                });
                const sparkGeometry = new THREE.BufferGeometry();
                sparkGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(10 * 3), 3));
                const sparks = new THREE.Points(sparkGeometry, new THREE.PointsMaterial({ color: 0xfff6a0, size: 0.07 }));
                group.add(sparks);
                this.zappers.push({ arcs, sparks, glow, tops, time: 0 });
            }
        }
        if (!row.spansX) group.rotation.y = Math.PI / 2;
        group.position.copy(row.position);
        group.position.y = 0;
        this.root.add(group);
        group.updateMatrixWorld(true);
        for (const z of this.zappers.slice(-6)) this.updateZapper(z, 0);
    }

    // Underwater World's spike row (Level 43): a big urchin right across the
    // corridor, as wide as the corridor and as deep as a spike row: one wide
    // spiky purple body with two smaller urchins snuggled in at its sides,
    // so there's no way past
    createBigUrchin(row) {
        const group = new THREE.Group();
        const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x5b1f8a, roughness: 0.6, emissive: 0x2a0844, emissiveIntensity: 0.4 });
        const spine = new THREE.MeshStandardMaterial({ color: 0x9b4fd6, roughness: 0.4, emissive: 0x3a0f66, emissiveIntensity: 0.5 });
        const spineGeometry = new THREE.ConeGeometry(0.04, 0.6, 5);
        // [x, radius along the corridor's width, height scale]
        for (const [x, r, tall] of [[0, 0.62, 1], [-1.05, 0.4, 0.85], [1.05, 0.4, 0.85]]) {
            const centerY = r * 0.8 * tall;
            const body = new THREE.Mesh(new THREE.SphereGeometry(r, 22, 14), bodyMaterial);
            body.scale.set(1, 0.8 * tall, Math.min(1, (SPIKE_ROW_DEPTH / 2) / r + 0.15));
            body.position.set(x, centerY, 0);
            body.castShadow = true;
            group.add(body);
            const count = Math.round(r * 150);
            for (let k = 0; k < count; k++) {
                const y = 1 - (k / (count - 1)) * 1.3;
                const flat = Math.sqrt(Math.max(0, 1 - y * y));
                const a = k * 2.39996;
                const dir = new THREE.Vector3(Math.cos(a) * flat, y, Math.sin(a) * flat).normalize();
                const s = new THREE.Mesh(spineGeometry, spine);
                s.position.set(x, centerY, 0).addScaledVector(dir, r * 0.85 + 0.3);
                s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
                group.add(s);
            }
        }
        if (!row.spansX) group.rotation.y = Math.PI / 2;
        group.position.copy(row.position);
        group.position.y = 0;
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
        const low = this.theme.mushroom ? -CAP_OVERHANG : 0;
        const high = span - PLATFORM_LENGTH - low;
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
        const chocolate = !!this.theme.sweets;
        const balloon = !!this.theme.volcano;
        const sled = !!this.theme.ice;
        const carpet = !!this.theme.desert;
        const longNeck = !!this.theme.dino;
        // Pirate Ship World: walk the plank (a level with a plank width) or ride the cannons;
        // when the level marks its plank gaps ('F'), only those are planks
        const plank = this.theme.pirate && this.plank > 0 && (!this.plankGapsMarked || blocks.some((b) => b.fast)) ? this.plank : 0;
        const cannon = !!this.theme.pirate && !plank;
        // Sky World: a rainbow bridge that comes and goes on its own cycle
        const rainbow = !!this.theme.skyland;
        // Mushroom Forest World: a mushroom cap ride (it reaches a little over each edge it waits at)
        // Mushroom Forest World: a trench bounce ('b' blocks, Level 142 on);
        // its start's side mushroom is the lower one
        const trench = blocks.some((b) => b.trench);
        const trenchCaps = trench ? [
            { along: TRENCH_CAP_FROM_EDGE, top: lowSideReached ? TRENCH_CAP_LOW : TRENCH_CAP_HIGH, squish: 0 },
            { along: span - TRENCH_CAP_FROM_EDGE, top: lowSideReached ? TRENCH_CAP_HIGH : TRENCH_CAP_LOW, squish: 0 },
        ] : [];
        const cap = !!this.theme.mushroom && !trench;
        const width = alongX ? gap.maxZ - gap.minZ : gap.maxX - gap.minX;
        // Pirate Ship World: a cannon on each side, aimed across, and where its shot lands (inside the other)
        const cannons = cannon ? [-CANNON_REACH, span + CANNON_REACH].map((along) => {
            const at = alongX ? new THREE.Vector3(gap.minX + along, 0, gap.minZ + width / 2) : new THREE.Vector3(gap.minX + width / 2, 0, gap.minZ + along);
            const sign = along < 0 ? 1 : -1;
            return { center: at, aim: alongX ? new THREE.Vector3(sign, 0, 0) : new THREE.Vector3(0, 0, sign), phase: 'empty', time: 0, mustLeave: false, smoke: 0, recoil: 0 };
        }) : [];
        if (cannon) {
            cannons[0].other = cannons[1];
            cannons[1].other = cannons[0];
            cannons[0].landing = cannons[1].center.clone();
            cannons[1].landing = cannons[0].center.clone();
        }
        // Candy World: the marshmallow on each bank, and where its bounce lands
        const pads = chocolate ? [
            { along: -MARSHMALLOW_FROM_EDGE, landing: span + BOUNCE_LANDING },
            { along: span + MARSHMALLOW_FROM_EDGE, landing: -BOUNCE_LANDING },
        ].map(({ along, landing }) => {
            const at = (a) => (alongX ? new THREE.Vector3(gap.minX + a, 0, gap.minZ + width / 2) : new THREE.Vector3(gap.minX + width / 2, 0, gap.minZ + a));
            return { center: at(along), landing: at(landing), squish: 0 };
        }) : [];
        return {
            gap, alongX, span, low, high, startAt,
            chocolate, // Candy World: a chocolate river crossed by bouncing on a marshmallow
            pads,
            balloon, // Volcano World: a lava gap crossed in a hot-air balloon, high above the maze
            sled, // Ice World: an icy crack crossed on a sled hanging from a zip line
            carpet, // Desert Pyramid World: a sand pit crossed on a flying carpet that keeps its own cycle
            longNeck, // Dinosaur World: a pit crossed on a long-neck dinosaur's head (moves like the hover platform)
            cannon, // Pirate Ship World: a water gap crossed by being fired from a cannon
            plank, // Pirate Ship World: a water gap crossed on a fixed plank this fraction of the corridor wide
            cannons,
            rainbow, // Sky World: a rainbow bridge across the gap, solid / fading / gone on its own cycle
            cap, // Mushroom Forest World: a round mushroom cap that carries you once you stand in the ring round its stem
            trench, // Mushroom Forest World: a trench bounce (two bouncy mushrooms in an acid trench)
            trenchCaps, // trench: its two mushrooms' caps, at the low end and the high end
            ride: null, // trench: the drop and bounces while they carry you
            acidDepth: trench ? TRENCH_DEPTH : ACID_DEPTH,
            rainbowPhase: 'solid', // rainbow: 'solid' | 'fading' | 'gone'
            rainbowTime: 0, // rainbow: seconds into its phase
            held: false, // rainbow: kept from going because you're on it
            phase: 'rest', // sled: 'rest' | 'zip' (carrying you) | 'float' (empty, coming to you); balloon: 'rest' | 'wait' (you're in, the burner's about to fire) | 'rise' | 'cross' | 'down' | 'float' (empty, coming to you)
            time: 0, // balloon: seconds into the phase
            lift: 0, // balloon: how high it is
            view: null, // balloon: what you can see ('corridor' | 'cloud' | null = everything)
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
        this.resetSnowmen();
        this.resetThinIce();
        for (const p of this.platforms) {
            // The plank never moves; the rainbow keeps its cycle
            if (p.plank || p.rainbow) continue;
            // The trench bounce: whatever bounce was going on stops
            if (p.trench) {
                Object.assign(p, { ride: null, riding: false });
                continue;
            }
            // The cannons: empty, fuses out
            if (p.cannon) {
                for (const c of p.cannons) Object.assign(c, { phase: 'empty', time: 0, mustLeave: false });
                continue;
            }
            // The flying carpet keeps its cycle (a reset to the start doesn't change it)
            if (p.carpet) {
                p.riding = false;
                continue;
            }
            Object.assign(p, { at: p.startAt, target: p.startAt, riding: false, wait: 0, mustLeave: false, push: 0, pushing: false, phase: 'rest', time: 0, lift: 0 });
            if (p.balloon) this.setRideView(p, null, 0);
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
        // The chocolate river: anywhere in it (the bounce carries you over it)
        if (p.chocolate) return true;
        // The water gap: anywhere in it (the cannon fires you over it)
        if (p.cannon) return true;
        // The rainbow bridge: only while it's gone (it spans the whole gap)
        if (p.rainbow) return p.rainbowPhase === 'gone';
        // The trench: never while the mushrooms bounce you (see updateTrench)
        if (p.trench) return !p.riding;
        // The mushroom cap: never while it carries you; otherwise your middle off the round cap
        if (p.cap) {
            if (p.riding) return false;
            const c = this.capCentre(p);
            return Math.hypot(point.x - c.x, point.z - c.z) > CAP_RADIUS;
        }
        // The plank: anywhere off it (your middle past either side of it)
        if (p.plank) {
            const { across, width } = this.gapCoords(point, p);
            return Math.abs(across - width / 2) > (width * p.plank) / 2;
        }
        // The balloon: never while it's in the air with you in it
        if (p.balloon && ['rise', 'cross', 'down'].includes(p.phase)) return false;
        // The sled: never while it's zooming you across
        if (p.sled && p.phase === 'zip') return false;
        // The carpet: never while it's carrying you; stepping into the pit
        // while it's flying (you can only get on while it rests) is a fall
        if (p.carpet && p.phase === 'cross') return !p.riding;
        const { along } = this.gapCoords(point, p);
        return along < p.at || along > p.at + PLATFORM_LENGTH;
    }

    // Where to stand on the start's side, just before the gap this point is
    // over, facing across it (used to save the spot while on a platform)
    platformStartEdge(point) {
        const p = (point && this.gapAt(point)) || this.platform;
        const g = p.gap;
        // (Candy World: back from the marshmallow, so it doesn't bounce you at once)
        const back = p.chocolate ? MARSHMALLOW_FROM_EDGE + MARSHMALLOW_STEP + 0.6 : p.cannon ? CANNON_REACH + CANNON_INSIDE + 1.4 : 1;
        const before = p.startAt === p.low ? -back : p.span + back;
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
        this.eventPlatform = null; // which platform the event came from (two rainbows have their own cycles)
        for (const p of this.platforms) {
            const e = this.updateOnePlatform(p, dt, position, velocity, radius);
            if (e) [event, this.eventPlatform] = [e, p];
        }
        return event;
    }

    // Run one platform.
    // It waits at an edge; once the player is fully on it sets off and carries
    // them to the other edge, keeping them on board until it stops. When it's
    // empty and the player comes to the edge it isn't at, it floats over to
    // them. Returns 'depart' or 'arrive' when that happens.
    updateOnePlatform(p, dt, position, velocity, radius) {
        if (p.bubble) return this.updateBubble(p, dt, position, velocity, radius);
        if (p.chocolate) return null; // nothing moves: the marshmallows bounce you (see marshmallowAt)
        if (p.trench) return null; // the mushrooms bounce you over (see updateTrench)
        if (p.cannon) return null; // the cannons fire you over (see updateCannons)
        if (p.plank) return null; // the plank never moves
        if (p.rainbow) return this.updateRainbow(p, dt, position, radius);
        if (p.cap) return this.updateCap(p, dt, position, velocity, radius);
        if (p.balloon) return this.updateBalloon(p, dt, position, velocity, radius);
        if (p.sled) return this.updateSled(p, dt, position, velocity, radius);
        if (p.carpet) return this.updateCarpet(p, dt, position, velocity, radius);
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

    // Run one balloon (Volcano World, Level 62 on). It rests at one edge of
    // the lava gap. Once you're fully inside its basket it waits
    // BALLOON_WAIT (step out and it doesn't go), then its burner fires and it
    // carries you: straight up, across at the top, straight down at the far
    // edge. You can look around but can't move till it lets you out onto the
    // floor; then it rests there. It works the same from either side. If it's
    // empty and you come to the edge it isn't at, it floats over to you.
    // Returns 'board', 'cancel', 'depart' (the burner fires) or 'land' (main.js
    // then walks you out to this.landing).
    updateBalloon(p, dt, position, velocity, radius) {
        const g = p.gap;
        const { along, across, width } = this.gapCoords(position, p);
        const inRange = across >= 0 && across < width;
        const fullyOn = inRange && along - radius >= p.at && along + radius <= p.at + PLATFORM_LENGTH;
        const touching = inRange && along + radius > p.at && along - radius < p.at + PLATFORM_LENGTH;
        const ease = (t) => t * t * (3 - 2 * t);
        // Held where you stood in the basket while it carries you
        const hold = () => {
            const a = p.at + p.offset;
            if (p.alongX) position.set(g.minX + a, position.y, g.minZ + p.across);
            else position.set(g.minX + p.across, position.y, g.minZ + a);
            velocity.set(0, 0, 0);
        };
        let event = null;
        p.time += dt;
        p.burn = Math.max(0, (p.burn ?? 0) - dt);
        if (p.phase === 'rest') {
            p.time = 0;
            // Just let out: you have to step off before it will carry you again
            if (p.mustLeave && !touching) p.mustLeave = false;
            if (fullyOn && !p.mustLeave) {
                Object.assign(p, { phase: 'wait', riding: true });
                event = 'board';
            } else if (!touching && inRange) {
                // Empty: float over to whichever edge the player comes to
                if (p.at !== p.low && along < 0 && along > -PLATFORM_CALL_DISTANCE) Object.assign(p, { phase: 'float', target: p.low });
                if (p.at !== p.high && along > p.span && along < p.span + PLATFORM_CALL_DISTANCE) Object.assign(p, { phase: 'float', target: p.high });
            }
        } else if (p.phase === 'float') {
            p.at = p.target > p.at ? Math.min(p.target, p.at + p.speed * dt) : Math.max(p.target, p.at - p.speed * dt);
            if (p.at === p.target) Object.assign(p, { phase: 'rest', time: 0 });
        } else if (p.phase === 'wait') {
            if (!fullyOn) {
                Object.assign(p, { phase: 'rest', riding: false, time: 0 });
                event = 'cancel';
            } else if (p.time >= BALLOON_WAIT) {
                Object.assign(p, { phase: 'rise', time: 0, offset: along - p.at, across, from: p.at, target: p.at === p.low ? p.high : p.low, burn: 0.8 });
                event = 'depart';
                hold();
            }
        } else if (p.phase === 'rise') {
            const t = Math.min(1, p.time / BALLOON_RISE_TIME);
            p.lift = BALLOON_HEIGHT * ease(t);
            if (Math.random() < dt * 3) p.burn = 0.5;
            if (t >= 1) Object.assign(p, { phase: 'cross', time: 0 });
            hold();
        } else if (p.phase === 'cross') {
            const t = Math.min(1, p.time / BALLOON_CROSS_TIME);
            p.at = p.from + (p.target - p.from) * ease(t);
            if (t >= 1) Object.assign(p, { phase: 'down', time: 0, at: p.target });
            hold();
        } else if (p.phase === 'down') {
            const t = Math.min(1, p.time / BALLOON_DOWN_TIME);
            p.lift = BALLOON_HEIGHT * (1 - ease(t));
            hold();
            if (t >= 1) {
                // Down at the far edge: out you get, onto the floor just past it
                const out = p.at === p.high ? p.span + BALLOON_LANDING : -BALLOON_LANDING;
                this.landing = p.alongX ? new THREE.Vector3(g.minX + out, 0, g.minZ + width / 2) : new THREE.Vector3(g.minX + width / 2, 0, g.minZ + out);
                Object.assign(p, { phase: 'rest', riding: false, time: 0, lift: 0, mustLeave: true });
                event = 'land';
            }
        }
        // What you can see: in the air only the gap's corridor (glowing), and
        // at the top nothing at all (a thick ash cloud)
        let view = null;
        let cloud = 0;
        if (p.phase === 'rise') {
            view = 'corridor';
            cloud = Math.max(0, (p.time / BALLOON_RISE_TIME - (1 - BALLOON_CLOUD_FADE)) / BALLOON_CLOUD_FADE);
        } else if (p.phase === 'cross') {
            view = 'cloud';
            cloud = 1;
        } else if (p.phase === 'down') {
            view = 'corridor';
            cloud = Math.max(0, 1 - p.time / BALLOON_DOWN_TIME / BALLOON_CLOUD_FADE);
        }
        this.setRideView(p, view, cloud, position);
        this.showPlatform(p);
        return event;
    }

    // Run one sled (Ice World, Level 71 on). It hangs from the zip line at
    // one edge of the crack. As soon as you're fully on it, it zooms across
    // (SLED_TIME, starting and stopping smoothly); you can look around but
    // can't steer, step off or fall. At the far edge it sets you down on the
    // floor (main.js walks you out to this.landing) and rests there. It works
    // the same from either side. If it's empty and you come to the edge it
    // isn't at, it zips over to you and waits.
    // Returns 'depart' (it zooms off with you) or 'land'.
    updateSled(p, dt, position, velocity, radius) {
        const g = p.gap;
        const { along, across, width } = this.gapCoords(position, p);
        const inRange = across >= 0 && across < width;
        const fullyOn = inRange && along - radius >= p.at && along + radius <= p.at + PLATFORM_LENGTH;
        const touching = inRange && along + radius > p.at && along - radius < p.at + PLATFORM_LENGTH;
        const ease = (t) => t * t * (3 - 2 * t);
        const hold = () => {
            const a = p.at + p.offset;
            if (p.alongX) position.set(g.minX + a, position.y, g.minZ + p.across);
            else position.set(g.minX + p.across, position.y, g.minZ + a);
            velocity.set(0, 0, 0);
        };
        let event = null;
        p.time += dt;
        if (p.phase === 'rest') {
            p.time = 0;
            // Just set down: you have to step off before it will carry you again
            if (p.mustLeave && !touching) p.mustLeave = false;
            if (fullyOn && !p.mustLeave) {
                // Hop on and it zooms right away
                Object.assign(p, { phase: 'zip', riding: true, time: 0, offset: along - p.at, across, from: p.at, target: p.at === p.low ? p.high : p.low });
                event = 'depart';
                hold();
            } else if (!touching && inRange) {
                // Empty: zip over to whichever edge the player comes to
                if (p.at !== p.low && along < 0 && along > -PLATFORM_CALL_DISTANCE) Object.assign(p, { phase: 'float', target: p.low });
                if (p.at !== p.high && along > p.span && along < p.span + PLATFORM_CALL_DISTANCE) Object.assign(p, { phase: 'float', target: p.high });
            }
        } else if (p.phase === 'float') {
            p.at = p.target > p.at ? Math.min(p.target, p.at + p.speed * dt) : Math.max(p.target, p.at - p.speed * dt);
            if (p.at === p.target) Object.assign(p, { phase: 'rest', time: 0 });
        } else if (p.phase === 'zip') {
            const t = Math.min(1, p.time / SLED_TIME);
            p.at = p.from + (p.target - p.from) * ease(t);
            hold();
            if (t >= 1) {
                // Across: off you get, onto the floor just past the edge
                const out = p.at === p.high ? p.span + SLED_LANDING : -SLED_LANDING;
                this.landing = p.alongX ? new THREE.Vector3(g.minX + out, 0, g.minZ + width / 2) : new THREE.Vector3(g.minX + width / 2, 0, g.minZ + out);
                Object.assign(p, { phase: 'rest', riding: false, time: 0, mustLeave: true, at: p.target });
                event = 'land';
            }
        }
        // The sled tips forward a little as it speeds up and swings back as it stops
        if (p.object) {
            const swing = p.phase === 'zip' ? Math.sin(Math.min(1, p.time / SLED_TIME) * Math.PI * 2) * 0.04 * Math.sign(p.target - p.from) : 0;
            p.sledBody.rotation.x = swing;
        }
        this.showPlatform(p);
        return event;
    }

    // Run one flying carpet (Desert Pyramid World, Level 102 on). It rests
    // at one edge of the sand pit for CARPET_REST_TIME, then crosses in
    // CARPET_CROSS_TIME (starting and stopping smoothly), rests at the other
    // edge, crosses back, and so on, whether or not you're on it. If you're
    // fully on when a rest ends, it carries you: you can look around but
    // can't steer, step off or fall. If you're only partly on, it keeps
    // resting till you're fully on or fully off. At the far edge you step
    // off yourself; stay on and it carries you back. Returns 'depart' (it
    // flies off with you), 'arrive' (it's across with you) or null.
    updateCarpet(p, dt, position, velocity, radius) {
        const g = p.gap;
        const { along, across, width } = this.gapCoords(position, p);
        const inRange = across >= 0 && across < width;
        const fullyOn = inRange && along - radius >= p.at && along + radius <= p.at + PLATFORM_LENGTH;
        const touching = inRange && along + radius > p.at && along - radius < p.at + PLATFORM_LENGTH;
        const ease = (t) => t * t * (3 - 2 * t);
        const hold = () => {
            const a = p.at + p.offset;
            if (p.alongX) position.set(g.minX + a, position.y, g.minZ + p.across);
            else position.set(g.minX + p.across, position.y, g.minZ + a);
            velocity.set(0, 0, 0);
        };
        let event = null;
        p.time += dt;
        p.clock = (p.clock ?? 0) + dt;
        if (p.phase === 'rest') {
            // On the resting carpet you can't walk off its pit end into the
            // pit; you step off at the edge it's resting at
            if (touching) {
                const lo = p.at === p.low ? -Infinity : p.at + radius;
                const hi = p.at === p.low ? p.at + PLATFORM_LENGTH - radius : Infinity;
                const clamped = Math.max(lo, Math.min(hi, along));
                if (clamped !== along) {
                    if (p.alongX) {
                        position.x += clamped - along;
                        velocity.x = 0;
                    } else {
                        position.z += clamped - along;
                        velocity.z = 0;
                    }
                }
            }
            // Partly on when the rest ends: keep resting till you're fully on or off
            if (p.time >= CARPET_REST_TIME && !(touching && !fullyOn)) {
                Object.assign(p, { phase: 'cross', time: 0, from: p.at, target: p.at === p.low ? p.high : p.low });
                if (fullyOn) {
                    Object.assign(p, { riding: true, offset: along - p.at, across });
                    event = 'depart';
                    hold();
                }
            }
        } else if (p.phase === 'cross') {
            const t = Math.min(1, p.time / CARPET_CROSS_TIME);
            p.at = p.from + (p.target - p.from) * ease(t);
            if (p.riding) hold();
            if (t >= 1) {
                p.at = p.target;
                Object.assign(p, { phase: 'rest', time: 0 });
                if (p.riding) {
                    p.riding = false;
                    event = 'arrive';
                }
            }
        }
        this.showPlatform(p);
        return event;
    }

    // How high the balloon you're riding is (null when you're not in the air in one)
    // (the sled zooming you across counts too, at no height: you can only look)
    rideLift() {
        const p = this.platforms.find((q) => (q.balloon && ['rise', 'cross', 'down'].includes(q.phase)) || (q.sled && q.phase === 'zip') || (q.carpet && q.riding));
        return p ? p.lift : null;
    }

    // Show only what the ride lets you see. view: null = the whole maze as
    // normal; 'corridor' = only the balloon, the lava and the gap's corridor
    // (from the cell before the gap to the cell after it), glowing; 'cloud' =
    // the ash cloud. cloud: how thick the ash cloud round your head is (0-1).
    setRideView(p, view, cloud, position) {
        if (!view && !p.view) return; // nothing to change (and leave another balloon's ride alone)
        if (view !== p.view) {
            if (view && !this.savedVisible) {
                this.savedVisible = new Map(this.root.children.map((o) => [o, o.visible]));
                for (const o of this.root.children) o.visible = false;
            }
            if (!view && this.savedVisible) {
                for (const [o, visible] of this.savedVisible) o.visible = visible;
                this.savedVisible = null;
            }
            const corridor = view === 'corridor';
            for (const m of p.basketMaterials ?? []) Object.assign(m, { transparent: !!view, opacity: view ? 0.25 : 1, depthWrite: !view });
            for (const o of [p.object, p.lava?.group, p.corridor]) if (o) o.visible = corridor || (!view && o !== p.corridor);
            p.view = view;
        }
        if (!this.cloud && cloud > 0) {
            this.cloud = new THREE.Mesh(new THREE.SphereGeometry(3, 24, 16), new THREE.MeshBasicMaterial({
                color: 0x3a2c28, transparent: true, opacity: 0, side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false,
            }));
            this.cloud.renderOrder = 999;
            this.scene.add(this.cloud);
        }
        if (this.cloud) {
            this.cloud.visible = cloud > 0;
            this.cloud.material.opacity = Math.min(1, cloud);
            this.cloud.material.transparent = cloud < 1;
            if (position) this.cloud.position.set(position.x, position.y + 1.6 + p.lift, position.z);
        }
    }

    // The lava gap (Volcano World): bright, bubbling lava far below, with
    // black rock sides down to it and a glowing edge where the path drops away
    createLavaPit(p) {
        const g = p.gap;
        const cx = (g.minX + g.maxX) / 2;
        const cz = (g.minZ + g.maxZ) / 2;
        const surfaceY = -2.2;
        const group = new THREE.Group();
        const map = lavaTexture();
        map.repeat.set((g.maxX - g.minX) / 4, (g.maxZ - g.minZ) / 4);
        const lava = new THREE.Mesh(new THREE.PlaneGeometry(g.maxX - g.minX, g.maxZ - g.minZ), new THREE.MeshBasicMaterial({ map, fog: false }));
        lava.rotation.x = -Math.PI / 2;
        lava.position.set(cx, surfaceY, cz);
        group.add(lava);
        // Rock sides, lit orange from below
        const rock = new THREE.MeshStandardMaterial({ color: 0x1a0d0a, roughness: 0.5, emissive: 0x5a1400, emissiveIntensity: 0.6 });
        const depth = -surfaceY - 0.2;
        for (const [w, d, x, z] of [
            [g.maxX - g.minX, 0.05, cx, g.minZ], [g.maxX - g.minX, 0.05, cx, g.maxZ],
            [0.05, g.maxZ - g.minZ, g.minX, cz], [0.05, g.maxZ - g.minZ, g.maxX, cz],
        ]) {
            const side = new THREE.Mesh(new THREE.BoxGeometry(w, depth, d), rock);
            side.position.set(x, -0.2 - depth / 2, z);
            group.add(side);
        }
        // A glowing orange edge where the floor stops
        const width = p.alongX ? g.maxZ - g.minZ : g.maxX - g.minX;
        const edge = new THREE.MeshBasicMaterial({ color: 0xff7a1a });
        for (const end of [0, p.span]) {
            const strip = new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, 0.12), edge);
            if (p.alongX) {
                strip.rotation.y = Math.PI / 2;
                strip.position.set(g.minX + end + (end ? 0.06 : -0.06), 0.02, cz);
            } else {
                strip.position.set(cx, 0.02, g.minZ + end + (end ? 0.06 : -0.06));
            }
            group.add(strip);
        }
        // Bubbles that swell up and pop
        const bubbleMaterial = new THREE.MeshBasicMaterial({ color: 0xffb02e, fog: false });
        const bubbles = [];
        for (let k = 0; k < 10; k++) {
            const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), bubbleMaterial);
            group.add(mesh);
            const bubble = { mesh, life: Math.random() * 1.5, span: 1 };
            bubbles.push(bubble);
        }
        this.root.add(group);
        p.lava = { group, map, bubbles, surfaceY };
        for (const b of bubbles) this.placeLavaBubble(p, b);
    }

    placeLavaBubble(p, b) {
        const g = p.gap;
        b.mesh.position.set(g.minX + 0.4 + Math.random() * (g.maxX - g.minX - 0.8), p.lava.surfaceY, g.minZ + 0.4 + Math.random() * (g.maxZ - g.minZ - 0.8));
        b.span = b.life = 0.8 + Math.random() * 1.2;
        b.size = 0.5 + Math.random() * 0.9;
    }

    // The lava slowly churns, its bubbles swell and pop, and the balloon's
    // burner flickers (called every frame)
    updateLava(p, dt) {
        const lava = p.lava;
        lava.time = (lava.time ?? 0) + dt;
        lava.map.offset.set(Math.sin(lava.time * 0.3) * 0.08, lava.time * 0.03);
        for (const b of lava.bubbles) {
            b.life -= dt;
            if (b.life <= 0) this.placeLavaBubble(p, b);
            const t = 1 - b.life / b.span;
            b.mesh.scale.setScalar(Math.max(0.01, b.size * t));
        }
        if (p.flame) {
            const roar = (p.burn ?? 0) > 0 ? 1.8 : 0.6;
            p.flame.scale.set(1, roar * (0.85 + 0.3 * Math.random()), 1);
            p.flame.material.opacity = (p.burn ?? 0) > 0 ? 0.95 : 0.7;
        }
    }

    // The hot-air balloon: a wicker basket the gap's width (you step into
    // it), ropes up to a burner, and a big round red, orange and yellow
    // striped balloon, high enough to clear the walls
    createBalloon(p) {
        const g = p.gap;
        const width = p.alongX ? g.maxZ - g.minZ : g.maxX - g.minX;
        const group = new THREE.Group();
        const wicker = new THREE.MeshStandardMaterial({ map: wickerTexture(), roughness: 0.9 });
        const w = width - 0.2;
        const l = PLATFORM_LENGTH - 0.1;
        const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, l), wicker);
        floor.position.y = -0.06;
        group.add(floor);
        const sideHeight = 1.0;
        for (const [sx, sz, bx, bz] of [[w, 0.08, 0, l / 2], [w, 0.08, 0, -l / 2], [0.08, l, w / 2, 0], [0.08, l, -w / 2, 0]]) {
            const side = new THREE.Mesh(new THREE.BoxGeometry(sx, sideHeight, sz), wicker);
            side.position.set(bx, sideHeight / 2, bz);
            group.add(side);
        }
        const rim = new THREE.MeshStandardMaterial({ color: 0x5a3416, roughness: 0.8 });
        // In the air the basket goes see-through, so you can look down at the corridor below
        p.basketMaterials = [wicker, rim];
        for (const [sx, sz, bx, bz] of [[w + 0.1, 0.14, 0, l / 2], [w + 0.1, 0.14, 0, -l / 2], [0.14, l + 0.1, w / 2, 0], [0.14, l + 0.1, -w / 2, 0]]) {
            const top = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.1, sz), rim);
            top.position.set(bx, sideHeight, bz);
            group.add(top);
        }
        // The burner and its flame
        const burnerY = 4.1;
        const burner = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.3, 12), new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.8, roughness: 0.3 }));
        burner.position.y = burnerY;
        group.add(burner);
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.9, 12), new THREE.MeshBasicMaterial({ color: 0xffa020, transparent: true, opacity: 0.7, fog: false }));
        flame.geometry.translate(0, 0.45, 0);
        flame.position.y = burnerY + 0.15;
        group.add(flame);
        p.flame = flame;
        // Ropes from the basket's corners up to the balloon
        const rope = new THREE.MeshBasicMaterial({ color: 0x2a1a10 });
        const envelopeY = 6.9;
        for (const [cx, cz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
            const a = new THREE.Vector3(cx * (w / 2 - 0.05), sideHeight, cz * (l / 2 - 0.05));
            const b = new THREE.Vector3(cx * 0.9, envelopeY - 2.2, cz * 0.9);
            const line = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, a.distanceTo(b), 5), rope);
            line.position.copy(a).add(b).multiplyScalar(0.5);
            line.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
            group.add(line);
        }
        // The balloon itself: round on top, narrowing toward the burner
        const envelope = new THREE.Mesh(new THREE.SphereGeometry(2.3, 32, 24), new THREE.MeshStandardMaterial({ map: balloonTexture(), roughness: 0.6, emissive: 0x401000, emissiveIntensity: 0.4 }));
        envelope.scale.set(1, 1.15, 1);
        envelope.position.y = envelopeY;
        group.add(envelope);
        const skirt = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.55, 1.2, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0xd8401a, roughness: 0.7, side: THREE.DoubleSide }));
        skirt.position.y = envelopeY - 2.5;
        group.add(skirt);
        // The group's z is the gap's long side; turn it when the gap runs along x
        if (p.alongX) group.rotation.y = Math.PI / 2;
        this.root.add(group);
        p.object = group;
    }

    // The gap's corridor as you see it from the balloon: from the cell
    // before the gap to the cell after it, walls and floor glowing bright
    // orange. Hidden except while the balloon is in the air.
    createRideCorridor(p) {
        const g = p.gap;
        const width = p.alongX ? g.maxZ - g.minZ : g.maxX - g.minX;
        const walls = [];
        const floors = [];
        for (let a = -5; a < p.span + 5; a++) {
            for (let c = -1; c <= width; c++) {
                const x = p.alongX ? g.minX + a : g.minX + c;
                const z = p.alongX ? g.minZ + c : g.minZ + a;
                const wall = this.grid[x]?.[z];
                if (wall === undefined) continue;
                if (wall === 1) walls.push([x, z]);
                else if (!(a >= 0 && a < p.span && c >= 0 && c < width)) floors.push([x, z]);
            }
        }
        const group = new THREE.Group();
        const matrix = new THREE.Matrix4();
        const wallMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, this.height, 1), new THREE.MeshBasicMaterial({ color: 0xff8a2a, fog: false }), walls.length);
        walls.forEach(([x, z], k) => wallMesh.setMatrixAt(k, matrix.makeTranslation(x + 0.5, this.height / 2, z + 0.5)));
        group.add(wallMesh);
        // Darker wall tops so the corridor's shape shows from above
        const topMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.001, 0.05, 1.001), new THREE.MeshBasicMaterial({ color: 0x7a1e04, fog: false }), walls.length);
        walls.forEach(([x, z], k) => topMesh.setMatrixAt(k, matrix.makeTranslation(x + 0.5, this.height + 0.03, z + 0.5)));
        group.add(topMesh);
        const floorMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.05, 1), new THREE.MeshBasicMaterial({ color: 0xffd36a, fog: false }), floors.length);
        floors.forEach(([x, z], k) => floorMesh.setMatrixAt(k, matrix.makeTranslation(x + 0.5, 0.03, z + 0.5)));
        group.add(floorMesh);
        group.visible = false;
        this.root.add(group);
        p.corridor = group;
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
        if (p.trench) {
            this.createAcidPit(p);
            this.createTrenchMushrooms(p);
            return;
        }
        if (p.cap) {
            this.createAcidPit(p);
            this.createMushroomCap(p);
            this.showPlatform(p);
            return;
        }
        if (p.rainbow) {
            this.createSkyHole(p);
            this.createRainbow(p);
            this.showRainbow(p);
            return;
        }
        if (p.cannon) {
            this.createSeaHole(p);
            this.createCannons(p);
            return;
        }
        if (p.plank) {
            this.createSeaHole(p);
            this.createPlank(p);
            return;
        }
        if (this.theme.factory) {
            this.createMachinePit(p);
            this.createTire(p);
            this.showPlatform(p);
            return;
        }
        if (p.sled) {
            this.createIceCrack(p);
            this.createSled(p);
            this.showPlatform(p);
            return;
        }
        if (p.carpet) {
            this.createSandPit(p);
            this.createCarpet(p);
            this.showPlatform(p);
            return;
        }
        if (p.longNeck) {
            this.createDinoPit(p);
            this.createLongNeck(p);
            this.showPlatform(p);
            return;
        }
        if (p.balloon) {
            this.createLavaPit(p);
            this.createBalloon(p);
            this.createRideCorridor(p);
            this.showPlatform(p);
            return;
        }
        if (p.chocolate) {
            this.createChocolateRiver(p);
            this.createMarshmallows(p);
            return;
        }
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

    // Desert Pyramid World (Level 102 on): the sand pit. Sandstone walls go
    // straight down to golden sand far below, with a few stones lying on it.
    createSandPit(p) {
        const g = p.gap;
        const cx = (g.minX + g.maxX) / 2;
        const cz = (g.minZ + g.maxZ) / 2;
        const sizeX = g.maxX - g.minX;
        const sizeZ = g.maxZ - g.minZ;
        const bottomY = -12;
        const depth = -bottomY - 0.2;
        let r = 53;
        const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
        for (const [w, d, x, z, along] of [
            [sizeX, 0.05, cx, g.minZ, sizeX], [sizeX, 0.05, cx, g.maxZ, sizeX],
            [0.05, sizeZ, g.minX, cz, sizeZ], [0.05, sizeZ, g.maxX, cz, sizeZ],
        ]) {
            const map = sandstoneTexture(128, 512, 97);
            map.repeat.set(along / 4, depth / 4);
            const wall = new THREE.Mesh(new THREE.BoxGeometry(w, depth, d),
                new THREE.MeshStandardMaterial({ map, color: 0x9a7038, roughness: 0.95 }));
            wall.position.set(x, -0.2 - depth / 2, z);
            this.root.add(wall);
        }
        const sandMap = desertSandTexture(256, 61);
        sandMap.repeat.set(sizeX / 4, sizeZ / 4);
        const bottom = new THREE.Mesh(new THREE.PlaneGeometry(sizeX, sizeZ),
            new THREE.MeshStandardMaterial({ map: sandMap, color: 0xe0b060, roughness: 1, emissive: 0x3a2808, emissiveIntensity: 0.5 }));
        bottom.rotation.x = -Math.PI / 2;
        bottom.position.set(cx, bottomY, cz);
        this.root.add(bottom);
        const stone = new THREE.MeshStandardMaterial({ color: 0xb08850, roughness: 1, flatShading: true });
        for (let k = 0; k < 8; k++) {
            const size = 0.15 + random() * 0.3;
            const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), stone);
            rock.position.set(g.minX + 0.3 + random() * (sizeX - 0.6), bottomY + size * 0.4, g.minZ + 0.3 + random() * (sizeZ - 0.6));
            rock.rotation.set(random() * 3, random() * 3, random() * 3);
            this.root.add(rock);
        }
    }

    // The flying carpet: a deep red rug with a golden border, a pattern of
    // golden diamonds, and golden tassels on its two ends. It's the pit's
    // width and PLATFORM_LENGTH long (its z is the pit's long side).
    createCarpet(p) {
        const g = p.gap;
        const width = p.alongX ? g.maxZ - g.minZ : g.maxX - g.minX;
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const c = canvas.getContext('2d');
        c.fillStyle = '#8e1424';
        c.fillRect(0, 0, 128, 128);
        c.strokeStyle = '#f2c14e';
        c.lineWidth = 8;
        c.strokeRect(6, 6, 116, 116);
        c.lineWidth = 2;
        c.strokeRect(16, 16, 96, 96);
        c.fillStyle = '#1f3a8a';
        c.fillRect(18, 18, 92, 92);
        c.fillStyle = '#f2c14e';
        for (const [x, y, s] of [[64, 64, 22], [36, 36, 9], [92, 36, 9], [36, 92, 9], [92, 92, 9]]) {
            c.beginPath();
            c.moveTo(x, y - s);
            c.lineTo(x + s, y);
            c.lineTo(x, y + s);
            c.lineTo(x - s, y);
            c.closePath();
            c.fill();
        }
        c.fillStyle = '#8e1424';
        c.beginPath();
        c.moveTo(64, 52);
        c.lineTo(76, 64);
        c.lineTo(64, 76);
        c.lineTo(52, 64);
        c.closePath();
        c.fill();
        const map = new THREE.CanvasTexture(canvas);
        const group = new THREE.Group();
        const geometry = new THREE.PlaneGeometry(width - 0.2, PLATFORM_LENGTH, 6, 12);
        geometry.rotateX(-Math.PI / 2);
        const cloth = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map, roughness: 0.9, side: THREE.DoubleSide, emissive: 0x2a0a0a, emissiveIntensity: 0.4 }));
        cloth.receiveShadow = true;
        cloth.castShadow = true;
        group.add(cloth);
        p.cloth = cloth;
        p.clothBase = Array.from({ length: geometry.attributes.position.count }, (_, k) => geometry.attributes.position.getY(k));
        const gold = new THREE.MeshStandardMaterial({ color: 0xf2c14e, metalness: 0.4, roughness: 0.4 });
        for (const side of [-1, 1]) {
            for (let k = 0; k < 7; k++) {
                const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.22, 6), gold);
                tassel.rotation.x = Math.PI / 2;
                tassel.position.set(-(width - 0.4) / 2 + (k * (width - 0.4)) / 6, 0, side * (PLATFORM_LENGTH / 2 + 0.1));
                group.add(tassel);
            }
        }
        if (p.alongX) group.rotation.y = Math.PI / 2;
        this.root.add(group);
        p.object = group;
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

    // The icy crack (Ice World): its sides are glowing blue ice going down
    // and down, getting deeper blue, with no bottom ever in sight; a glowing
    // pale blue edge where the snow stops. Over it, the zip line: a bar of ice
    // bricks across the corridor just past each end, with a steel cable
    // between them down the corridor's middle.
    createIceCrack(p) {
        const g = p.gap;
        const cx = (g.minX + g.maxX) / 2;
        const cz = (g.minZ + g.maxZ) / 2;
        const group = new THREE.Group();
        const map = crackIceTexture();
        const sides = new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide, fog: false });
        const w = g.maxX - g.minX;
        const d = g.maxZ - g.minZ;
        for (const [len, x, z, turn] of [[w, cx, g.minZ, 0], [w, cx, g.maxZ, 0], [d, g.minX, cz, Math.PI / 2], [d, g.maxX, cz, Math.PI / 2]]) {
            const side = new THREE.Mesh(new THREE.PlaneGeometry(len, CRACK_DEPTH), sides);
            side.position.set(x, -0.2 - CRACK_DEPTH / 2, z);
            side.rotation.y = turn;
            group.add(side);
        }
        // Far down it's all the same dark blue as the sides' far end, so
        // there's no bottom to see
        const deep = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color: CRACK_DEEP, fog: false }));
        deep.rotation.x = -Math.PI / 2;
        deep.position.set(cx, -0.2 - CRACK_DEPTH + 0.01, cz);
        group.add(deep);
        // A glowing edge where the snow stops
        const width = p.alongX ? d : w;
        const edge = new THREE.MeshBasicMaterial({ color: 0xaaf0ff });
        for (const end of [0, p.span]) {
            const strip = new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, 0.12), edge);
            if (p.alongX) {
                strip.rotation.y = Math.PI / 2;
                strip.position.set(g.minX + end + (end ? 0.06 : -0.06), 0.02, cz);
            } else {
                strip.position.set(cx, 0.02, g.minZ + end + (end ? 0.06 : -0.06));
            }
            group.add(strip);
        }
        // The zip line. Built along z (the gap's long side), turned when the gap runs along x
        const zip = new THREE.Group();
        const bar = new THREE.MeshStandardMaterial({ color: 0xdff3ff, emissive: 0x3a8ad0, emissiveIntensity: 0.35, roughness: 0.25 });
        const reach = p.span / 2 + 0.5; // the bars sit just past each end of the crack
        for (const end of [-1, 1]) {
            const beam = new THREE.Mesh(new THREE.BoxGeometry(width, 0.3, 0.4), bar);
            beam.position.set(0, ZIP_LINE_HEIGHT + 0.15, end * reach);
            zip.add(beam);
        }
        const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, reach * 2, 8), new THREE.MeshStandardMaterial({ color: 0x9aa4ae, metalness: 0.8, roughness: 0.3 }));
        cable.rotation.x = Math.PI / 2;
        cable.position.y = ZIP_LINE_HEIGHT;
        zip.add(cable);
        if (p.alongX) zip.rotation.y = Math.PI / 2;
        zip.position.set(cx, 0, cz);
        group.add(zip);
        this.root.add(group);
    }

    // The sled: a red wooden sled the crack's width (you step onto it), with
    // runners curling up at both ends, hanging by four ropes from a pulley
    // that rolls along the zip line
    createSled(p) {
        const g = p.gap;
        const width = p.alongX ? g.maxZ - g.minZ : g.maxX - g.minX;
        const group = new THREE.Group();
        const body = new THREE.Group();
        const wood = new THREE.MeshStandardMaterial({ map: sledTexture(), roughness: 0.7 });
        const w = width - 0.2;
        const l = PLATFORM_LENGTH - 0.1;
        const deck = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, l), wood);
        deck.position.y = -0.06;
        body.add(deck);
        // Low rails along the sides
        for (const side of [-1, 1]) {
            const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, l), wood);
            rail.position.set(side * (w / 2 - 0.04), 0.15, 0);
            body.add(rail);
        }
        // Shiny runners underneath, curling up at both ends
        const metal = new THREE.MeshStandardMaterial({ color: 0xc8d0d8, metalness: 0.3, roughness: 0.35 });
        for (const side of [-0.35, 0.35]) {
            const runner = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, l - 0.3), metal);
            runner.position.set(side * w, -0.3, 0);
            body.add(runner);
            for (const end of [-1, 1]) {
                const curl = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 6, 12, Math.PI), metal);
                curl.rotation.y = Math.PI / 2;
                curl.rotation.z = end > 0 ? -Math.PI / 2 : Math.PI / 2;
                curl.position.set(side * w, -0.14, end * ((l - 0.3) / 2));
                body.add(curl);
            }
            for (const at of [-0.6, 0.6]) {
                const strut = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.24, 0.05), metal);
                strut.position.set(side * w, -0.18, at);
                body.add(strut);
            }
        }
        // The pulley on the zip line, and ropes from the sled's corners up to it
        const pulley = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 14), metal);
        pulley.rotation.z = Math.PI / 2;
        pulley.position.y = ZIP_LINE_HEIGHT;
        const hanger = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.35, 0.1), metal);
        hanger.position.y = ZIP_LINE_HEIGHT - 0.25;
        body.add(pulley, hanger);
        const rope = new THREE.MeshBasicMaterial({ color: 0x5a3a1e });
        const knot = new THREE.Vector3(0, ZIP_LINE_HEIGHT - 0.42, 0);
        for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
            const a = new THREE.Vector3(sx * (w / 2 - 0.05), 0.3, sz * (l / 2 - 0.05));
            const line = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, a.distanceTo(knot), 5), rope);
            line.position.copy(a).add(knot).multiplyScalar(0.5);
            line.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), knot.clone().sub(a).normalize());
            body.add(line);
        }
        // It swings from the zip line (see updateSled)
        const pivot = new THREE.Group();
        pivot.position.y = ZIP_LINE_HEIGHT;
        body.position.y = -ZIP_LINE_HEIGHT;
        pivot.add(body);
        group.add(pivot);
        // The group's z is the gap's long side; turn it when the gap runs along x
        if (p.alongX) group.rotation.y = Math.PI / 2;
        this.root.add(group);
        p.object = group;
        p.sledBody = pivot;
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
    // Candy World (Level 52 on): a river of melted chocolate flowing across
    // the path, with dark chocolate banks down to it and a crumbly edge
    createChocolateRiver(p) {
        const g = p.gap;
        const cx = (g.minX + g.maxX) / 2;
        const cz = (g.minZ + g.maxZ) / 2;
        const surfaceY = -0.7;
        const map = meltedChocolateTexture();
        const sizeX = g.maxX - g.minX + 6;
        const sizeZ = g.maxZ - g.minZ + 6;
        map.repeat.set(sizeX / 3, sizeZ / 3);
        const river = new THREE.Mesh(new THREE.PlaneGeometry(sizeX, sizeZ), new THREE.MeshStandardMaterial({ map, roughness: 0.25, metalness: 0.1, emissive: 0x2a1206, emissiveIntensity: 0.6 }));
        river.rotation.x = -Math.PI / 2;
        river.position.set(cx, surfaceY, cz);
        this.root.add(river);
        if (!p.alongX) {
            map.center.set(0.5, 0.5);
            map.rotation = Math.PI / 2;
        }
        const bankMaterial = new THREE.MeshStandardMaterial({ color: 0x2b160c, roughness: 0.6 });
        const depth = -surfaceY - 0.2;
        for (const [w, d, x, z] of [
            [g.maxX - g.minX, 0.05, cx, g.minZ], [g.maxX - g.minX, 0.05, cx, g.maxZ],
            [0.05, g.maxZ - g.minZ, g.minX, cz], [0.05, g.maxZ - g.minZ, g.maxX, cz],
        ]) {
            const bank = new THREE.Mesh(new THREE.BoxGeometry(w, depth, d), bankMaterial);
            bank.position.set(x, -0.2 - depth / 2, z);
            this.root.add(bank);
        }
        // A light chocolate trim where the path drops away, so the edge shows
        const trim = new THREE.MeshStandardMaterial({ color: 0xc58a5a, roughness: 0.5 });
        const width = p.alongX ? g.maxZ - g.minZ : g.maxX - g.minX;
        for (const end of [0, p.span]) {
            const strip = new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, 0.14), trim);
            if (p.alongX) {
                strip.rotation.y = Math.PI / 2;
                strip.position.set(g.minX + end + (end ? 0.07 : -0.07), 0.02, cz);
            } else {
                strip.position.set(cx, 0.02, g.minZ + end + (end ? 0.07 : -0.07));
            }
            this.root.add(strip);
        }
        p.river = { map, flowAxis: 'y', waterY: surfaceY, fish: [] };
    }

    // The two bouncy marshmallows: soft, puffy, pinkish-white rounded pads
    createMarshmallows(p) {
        const material = new THREE.MeshStandardMaterial({ color: 0xfff4f8, roughness: 0.9, emissive: 0xffd6e8, emissiveIntensity: 0.25 });
        const dust = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
        for (const pad of p.pads) {
            const group = new THREE.Group();
            const body = new THREE.Mesh(new THREE.CylinderGeometry(MARSHMALLOW_RADIUS, MARSHMALLOW_RADIUS * 0.96, 0.4, 28), material);
            body.position.y = 0.2;
            const top = new THREE.Mesh(new THREE.SphereGeometry(MARSHMALLOW_RADIUS, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2), material);
            top.scale.y = 0.35;
            top.position.y = 0.4;
            group.add(body, top);
            // A few sugar-dust specks on top
            for (let k = 0; k < 7; k++) {
                const a = k * 2.4;
                const r = 0.15 + (k % 3) * 0.15;
                const speck = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), dust);
                speck.position.set(Math.cos(a) * r, 0.4 + 0.35 * MARSHMALLOW_RADIUS * Math.sqrt(1 - (r / MARSHMALLOW_RADIUS) ** 2), Math.sin(a) * r);
                group.add(speck);
            }
            group.position.copy(pad.center);
            group.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
            this.root.add(group);
            pad.object = group;
        }
    }

    // Sticky caramel spots: a glossy golden puddle over each caramel cell,
    // with a few gooey blobs on top
    createCaramelSpots() {
        const material = new THREE.MeshStandardMaterial({ map: caramelTexture(), roughness: 0.15, metalness: 0.15, emissive: 0x6a3a00, emissiveIntensity: 0.35 });
        const geometry = new THREE.BoxGeometry(1.002, 0.04, 1.002);
        for (const k of this.caramelBlocks) {
            const [x, z] = k.split(',').map(Number);
            const patch = new THREE.Mesh(geometry, material);
            patch.position.set(x + 0.5, 0.02, z + 0.5);
            patch.receiveShadow = true;
            this.root.add(patch);
        }
        const blobMaterial = new THREE.MeshStandardMaterial({ color: 0xe0961f, roughness: 0.1, metalness: 0.2, emissive: 0x5a2e00, emissiveIntensity: 0.3 });
        let r = 53;
        const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
        for (const k of this.caramelBlocks) {
            if (random() < 0.4) continue;
            const [x, z] = k.split(',').map(Number);
            const size = 0.12 + random() * 0.14;
            const blob = new THREE.Mesh(new THREE.SphereGeometry(size, 12, 8), blobMaterial);
            blob.scale.y = 0.4;
            blob.position.set(x + 0.2 + random() * 0.6, 0.04, z + 0.2 + random() * 0.6);
            this.root.add(blob);
        }
    }

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
        // The flying carpet hovers just over the floor, bobbing gently
        const y = p.balloon ? p.lift : p.carpet ? 0.06 + 0.04 * Math.sin((p.clock ?? 0) * 3) : 0;
        if (p.carpet && p.cloth) {
            // Its cloth ripples a little, more while it flies
            const pos = p.cloth.geometry.attributes.position;
            const base = p.clothBase;
            const amount = p.phase === 'cross' ? 0.05 : 0.02;
            for (let k = 0; k < pos.count; k++) pos.setY(k, base[k] + amount * Math.sin((p.clock ?? 0) * 6 + pos.getZ(k) * 2.5));
            pos.needsUpdate = true;
        }
        if (p.alongX) p.object.position.set(g.minX + middle, y, (g.minZ + g.maxZ) / 2);
        else p.object.position.set((g.minX + g.maxX) / 2, y, g.minZ + middle);
        if (p.longNeck) this.showLongNeck(p);
    }

    // The marshmallow this point is standing on (Candy World), if any
    marshmallowAt(point) {
        for (const p of this.platforms) {
            for (const pad of p.pads) if (Math.hypot(point.x - pad.center.x, point.z - pad.center.z) < MARSHMALLOW_STEP) return pad;
        }
        return null;
    }

    // How deep into thick fog this point is: 0 outside, rising to 1 once
    // it's FOG_EDGE inside either end of the stretch (inside its box)
    fogAt(point) {
        let most = 0;
        for (const f of this.fogs ?? []) {
            if (point.x < f.minX || point.x > f.maxX || point.z < f.minZ || point.z > f.maxZ) continue;
            const depth = f.alongX ? Math.min(point.x - f.minX, f.maxX - point.x) : Math.min(point.z - f.minZ, f.maxZ - point.z);
            most = Math.max(most, Math.min(1, depth / FOG_EDGE));
        }
        return most;
    }

    // A thick fog stretch (Sky World): from outside, a white fog bank
    // filling the corridor up over the walls' tops, with soft puffs drifting
    // slowly in it. Inside it, main.js closes the scene's fog in around you.
    createFog(f) {
        let r = 11 + f.minX * 29 + f.minZ * 13;
        const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
        const sizeX = f.maxX - f.minX;
        const sizeZ = f.maxZ - f.minZ;
        const tall = this.height + 0.4;
        // The bank: white and nearly solid from outside. Only its outside
        // faces are drawn, so from inside it's the scene's fog you see.
        const bank = new THREE.Mesh(new THREE.BoxGeometry(sizeX, tall, sizeZ), new THREE.MeshBasicMaterial({ color: 0xeef1f4, transparent: true, opacity: 0.9, depthWrite: false }));
        bank.position.set(f.center.x, tall / 2, f.center.z);
        bank.renderOrder = 3;
        this.root.add(bank);
        // Puffs, inside and billowing up over the top and out of the ends a little
        const count = Math.round(sizeX * sizeZ * 3);
        const positions = new Float32Array(count * 3);
        f.puffs = [];
        for (let n = 0; n < count; n++) {
            const p = {
                x: f.minX - 0.3 + random() * (sizeX + 0.6),
                y: 0.3 + random() * (tall + 0.5),
                z: f.minZ - 0.3 + random() * (sizeZ + 0.6),
                phase: random() * 6.3, speed: 0.3 + random() * 0.4,
            };
            f.puffs.push(p);
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        f.points = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, map: puffTexture(), transparent: true, opacity: 0.85, depthWrite: false }));
        f.points.renderOrder = 4;
        f.time = 0;
        this.root.add(f.points);
        this.placeFog(f);
    }

    // The fog's puffs drift slowly to and fro (called every frame)
    updateFogs(dt) {
        for (const f of this.fogs) {
            f.time += dt;
            this.placeFog(f);
        }
    }

    placeFog(f) {
        const positions = f.points.geometry.attributes.position;
        f.puffs.forEach((p, n) => {
            const a = p.phase + f.time * p.speed;
            positions.setXYZ(n, p.x + Math.sin(a) * 0.35, p.y + Math.sin(a * 0.7) * 0.15, p.z + Math.cos(a * 0.8) * 0.35);
        });
        positions.needsUpdate = true;
    }

    // The windy hallway this point is in, or null
    windAt(point) {
        const k = `${Math.floor(point.x)},${Math.floor(point.z)}`;
        return this.winds.find((w) => w.blocks.has(k)) ?? null;
    }

    // How far a point is from a windy hallway (0 inside it)
    windDistance(w, point) {
        const dx = Math.max(w.minX - point.x, 0, point.x - w.maxX);
        const dz = Math.max(w.minZ - point.z, 0, point.z - w.maxZ);
        return Math.hypot(dx, dz);
    }

    // A windy hallway (Sky World): thin white streaks of wind rushing along
    // it at different heights, and little leaves tumbling along the floor and
    // through the air, all fading in at the upwind end and out at the other
    createWind(w) {
        let r = 7 + w.minX * 31 + w.minZ * 17;
        const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
        const alongX = w.dir.x !== 0;
        const length = alongX ? w.maxX - w.minX : w.maxZ - w.minZ;
        const across = alongX ? [w.minZ, w.maxZ] : [w.minX, w.maxX];
        const leafColors = [0x6fbf3a, 0x9bd14a, 0xd8c24a, 0x4f9a2c, 0xe09a3a];
        const streaks = Math.round(length * 2.2);
        const leaves = Math.round(length * 1.0);
        for (let n = 0; n < streaks + leaves; n++) {
            const leaf = n >= streaks;
            const material = new THREE.MeshBasicMaterial({
                color: leaf ? leafColors[n % leafColors.length] : 0xffffff,
                transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
            });
            const size = leaf ? 0.14 + random() * 0.08 : 0.5 + random() * 0.9;
            const geometry = leaf ? new THREE.PlaneGeometry(size, size * 0.6) : new THREE.BoxGeometry(alongX ? size : 0.035, 0.035, alongX ? 0.035 : size);
            const mesh = new THREE.Mesh(geometry, material);
            mesh.renderOrder = 2;
            this.root.add(mesh);
            w.bits.push({
                mesh, leaf,
                t: random(), // how far along the hallway, 0 (upwind end) to 1
                side: across[0] + 0.15 + random() * (across[1] - across[0] - 0.3),
                height: leaf ? 0.05 + random() * 1.4 : 0.25 + random() * 2.6,
                speed: (leaf ? 3 + random() * 1.5 : 6 + random() * 3) / length,
                spin: random() * 6, bob: random() * 6,
                peak: leaf ? 0.95 : 0.45 + random() * 0.3,
            });
        }
        this.placeWind(w, 0);
    }

    // Move the wind's streaks and leaves along (the game step, so they stop while paused)
    updateWinds(dt) {
        for (const w of this.winds) this.placeWind(w, dt);
    }

    placeWind(w, dt) {
        const alongX = w.dir.x !== 0;
        const sign = alongX ? w.dir.x : w.dir.z;
        const [lo, hi] = alongX ? [w.minX, w.maxX] : [w.minZ, w.maxZ];
        for (const b of w.bits) {
            b.t = (b.t + b.speed * dt) % 1;
            b.spin += dt * 7;
            b.bob += dt * 3;
            const a = sign > 0 ? lo + b.t * (hi - lo) : hi - b.t * (hi - lo);
            const y = b.leaf ? Math.max(0.04, b.height + Math.sin(b.bob) * 0.25) : b.height;
            if (alongX) b.mesh.position.set(a, y, b.side);
            else b.mesh.position.set(b.side, y, a);
            if (b.leaf) b.mesh.rotation.set(b.spin, b.spin * 0.7, b.spin * 0.4);
            b.mesh.material.opacity = b.peak * Math.min(1, b.t * 6, (1 - b.t) * 6);
        }
    }

    // Is this point on sticky caramel?
    onCaramel(point) {
        return this.caramelBlocks.has(`${Math.floor(point.x)},${Math.floor(point.z)}`);
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

    // ---- Desert Pyramid World (Level 101 on) ----

    // A bright blue sky with a hot sun, and real pyramids and camels far
    // away in the desert. Decoration only: far outside the maze, nothing to
    // bump into.
    addDesertSky() {
        const cx = this.width / 2;
        const cz = this.depth / 2;
        const sun = new THREE.Mesh(new THREE.SphereGeometry(16, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff6c0, fog: false }));
        sun.position.set(cx + 70, 95, cz - 210);
        this.root.add(sun);
        for (const [size, opacity] of [[26, 0.35], [40, 0.15]]) {
            const glow = new THREE.Mesh(new THREE.SphereGeometry(size, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffd860, transparent: true, opacity, fog: false, depthWrite: false }));
            glow.position.copy(sun.position);
            this.root.add(glow);
        }
        // Rolling dunes on the horizon all round
        const duneMaterial = new THREE.MeshStandardMaterial({ color: 0xe0b464, roughness: 1, fog: false });
        let r = 131;
        const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
        for (let k = 0; k < 18; k++) {
            const a = (k / 18) * Math.PI * 2 + random() * 0.2;
            const d = 200 + random() * 60;
            const dune = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), duneMaterial);
            dune.scale.set(60 + random() * 40, 8 + random() * 10, 30 + random() * 20);
            dune.position.set(cx + Math.cos(a) * d, -2, cz + Math.sin(a) * d);
            dune.rotation.y = -a;
            this.root.add(dune);
        }
        // Pyramids: sandy stone with a shady side, the biggest with a golden tip
        const stone = new THREE.MeshStandardMaterial({ color: 0xd8ad62, roughness: 0.95, flatShading: true, fog: false });
        const gold = new THREE.MeshStandardMaterial({ color: 0xffd34a, metalness: 0.7, roughness: 0.3, emissive: 0x6a4a00, emissiveIntensity: 0.6, fog: false });
        for (const [a, d, size] of [[Math.PI + 0.03, 230, 90], [Math.PI - 0.09, 285, 60], [-Math.PI / 2 + 0.05, 240, 80], [-Math.PI / 2 - 0.1, 290, 50], [0.04, 250, 72], [Math.PI / 2 + 0.06, 260, 76]]) {
            const pyramid = new THREE.Mesh(new THREE.ConeGeometry(size, size * 0.95, 4), stone);
            pyramid.position.set(cx + Math.cos(a) * d, size * 0.45, cz + Math.sin(a) * d);
            pyramid.rotation.y = Math.PI / 4 + a;
            this.root.add(pyramid);
            if (size >= 72) {
                const tip = new THREE.Mesh(new THREE.ConeGeometry(size * 0.12, size * 0.12 * 0.95, 4), gold);
                tip.position.set(pyramid.position.x, size * 0.9, pyramid.position.z);
                tip.rotation.y = pyramid.rotation.y;
                this.root.add(tip);
            }
        }
        // A camel caravan walking slowly along the dunes far away
        this.camels = [];
        const fur = new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 1, fog: false });
        // ...on top of a long dune, so they show over the maze's walls
        const ridge = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), duneMaterial);
        ridge.scale.set(70, 11, 26);
        ridge.position.set(cx + Math.cos(Math.PI - 0.06) * 165, -2, cz + Math.sin(Math.PI - 0.06) * 165);
        ridge.rotation.y = Math.PI / 2 + 0.06;
        this.root.add(ridge);
        for (let k = 0; k < 4; k++) {
            const camel = this.makeCamel(fur);
            camel.scale.setScalar(2.4);
            camel.userData.angle = Math.PI - 0.12 + k * 0.06;
            camel.userData.distance = 165;
            camel.userData.step = k * 1.3;
            camel.userData.home = camel.userData.angle;
            this.root.add(camel);
            this.camels.push(camel);
        }
        this.placeCamels(0);
    }

    // One camel, about 5 units tall: a body with a hump, a long neck and
    // head, and four legs that swing as it walks
    makeCamel(fur) {
        const camel = new THREE.Group();
        const part = (geometry, x, y, z) => {
            const m = new THREE.Mesh(geometry, fur);
            m.position.set(x, y, z);
            camel.add(m);
            return m;
        };
        part(new THREE.SphereGeometry(1, 14, 10), 0, 3.2, 0).scale.set(1.9, 0.9, 0.8);
        part(new THREE.SphereGeometry(0.8, 14, 10), 0, 4.1, 0).scale.set(1, 0.9, 0.8);
        part(new THREE.CylinderGeometry(0.25, 0.35, 2, 8), 2.0, 4.0, 0).rotation.z = -0.6;
        part(new THREE.SphereGeometry(0.4, 10, 8), 2.7, 4.9, 0).scale.set(1.5, 0.8, 0.8);
        camel.userData.legs = [[-1.1, 0.35], [-1.1, -0.35], [1.1, 0.35], [1.1, -0.35]].map(([x, z], k) => {
            const hip = new THREE.Group();
            hip.position.set(x, 2.8, z);
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 2.8, 6), fur);
            leg.position.y = -1.4;
            hip.add(leg);
            hip.userData.phase = k % 3 ? 0 : Math.PI;
            camel.add(hip);
            return hip;
        });
        return camel;
    }

    placeCamels(dt) {
        const cx = this.width / 2;
        const cz = this.depth / 2;
        for (const camel of this.camels) {
            const u = camel.userData;
            // Back and forth along the ridge, slowly
            u.time = (u.time ?? 0) + dt;
            u.angle = u.home + Math.sin(u.time * 0.03) * 0.1;
            u.step += dt * 2.2;
            const a = u.angle;
            camel.position.set(cx + Math.cos(a) * u.distance, 8.5, cz + Math.sin(a) * u.distance);
            // Facing the way it's walking along the ridge
            camel.rotation.y = -a - Math.PI / 2 + (Math.cos(u.time * 0.03) < 0 ? Math.PI : 0);
            for (const hip of u.legs) hip.rotation.z = Math.sin(u.step + hip.userData.phase) * 0.35;
        }
    }

    // Desert Pyramid World's spike: a prickly green cactus (a tall column
    // with two arms, little spines all over) in a small mound of sand, as
    // wide as a spike's plate. Touching it works the same as a spike.
    createCactus(position, radius, tall = 1) {
        const cactus = new THREE.Group();
        const green = new THREE.MeshStandardMaterial({ color: 0x3f8f3a, roughness: 0.7, emissive: 0x0f2a0c, emissiveIntensity: 0.5 });
        const spineMaterial = new THREE.MeshStandardMaterial({ color: 0xfff2c8, roughness: 0.5 });
        const spineGeometry = new THREE.ConeGeometry(0.018, 0.14, 4);
        const addSpines = (part, r, h, count) => {
            for (let k = 0; k < count; k++) {
                const a = k * 2.39996;
                const y = -h / 2 + ((k + 0.5) / count) * h;
                const dir = new THREE.Vector3(Math.cos(a), 0.25, Math.sin(a)).normalize();
                const spine = new THREE.Mesh(spineGeometry, spineMaterial);
                spine.position.set(Math.cos(a) * r, y, Math.sin(a) * r).addScaledVector(dir, 0.05);
                spine.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
                part.add(spine);
            }
        };
        const column = (r, h) => {
            const g = new THREE.Group();
            const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 12), green);
            body.castShadow = true;
            const top = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), green);
            top.position.y = h / 2;
            g.add(body, top);
            addSpines(g, r, h, Math.round(h * 60));
            return g;
        };
        const trunk = column(0.24, 1.3);
        trunk.position.y = 0.65;
        cactus.add(trunk);
        // Two arms, each an elbow out to the side then up
        for (const [side, y, h] of [[1, 0.6, 0.45], [-1, 0.85, 0.35]]) {
            const out = column(0.13, 0.3);
            out.rotation.z = -side * Math.PI / 2;
            out.position.set(side * 0.36, y, 0);
            const up = column(0.13, h);
            up.position.set(side * 0.5, y + h / 2, 0);
            cactus.add(out, up);
        }
        // A little pink flower on top
        const flower = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshStandardMaterial({ color: 0xff6fa8, emissive: 0x5a1030, emissiveIntensity: 0.5 }));
        flower.position.y = 1.55;
        cactus.add(flower);
        // A mound of sand round its foot, as wide as the plate
        const mound = new THREE.Mesh(new THREE.SphereGeometry(SPIKE_RADIUS, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd9a955, roughness: 1 }));
        mound.scale.y = 0.18;
        cactus.add(mound);
        cactus.scale.set(radius / SPIKE_RADIUS, tall, radius / SPIKE_RADIUS);
        cactus.position.copy(position);
        cactus.position.y = 0;
        this.root.add(cactus);
        return cactus;
    }

    // Desert Pyramid World's spike row (Level 104 on): a big cactus right
    // across the corridor, wall to wall, as deep as a spike row: one tall
    // cactus in the middle with a shorter one tucked in at each side, all on
    // one long mound of sand, so there's no way past
    createBigCactus(row) {
        const across = row.spansX ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
        for (const [offset, radius, tall] of [[0, 0.62, 1.55], [-1.05, 0.42, 1.05], [1.05, 0.42, 1.15]]) {
            const cactus = this.createCactus(row.position.clone().addScaledVector(across, offset), radius, tall);
            // Turn it so its arms reach along the row, toward the walls
            if (!row.spansX) cactus.rotation.y = Math.PI / 2;
        }
        const mound = new THREE.Mesh(new THREE.BoxGeometry(SPIKE_ROW_WIDTH, 0.12, SPIKE_ROW_DEPTH), new THREE.MeshStandardMaterial({ color: 0xd9a955, roughness: 1 }));
        mound.position.copy(row.position);
        mound.position.y = 0.06;
        if (!row.spansX) mound.rotation.y = Math.PI / 2;
        this.root.add(mound);
    }

    // The button door: a carved stone slab filling the wall gap between two
    // path cells (solid like a wall while shut), with a stone frame, and its
    // button: a round stone plate in the floor with a carved sun, a gold rim
    // and a soft glow, so it can be spotted.
    createButtonDoor(door) {
        const spansX = door.maxX - door.minX > 1; // the gap runs along x (the door faces z)
        const across = door.blocks.length;
        const group = new THREE.Group();
        group.position.set((door.minX + door.maxX) / 2, 0, (door.minZ + door.maxZ) / 2);
        if (!spansX) group.rotation.y = Math.PI / 2;
        this.root.add(group);
        const slider = new THREE.Group();
        const face = new THREE.MeshStandardMaterial({ map: doorSlabTexture(), roughness: 0.85, emissive: 0x3a2808, emissiveIntensity: 0.35 });
        const side = new THREE.MeshStandardMaterial({ color: 0xb98a44, roughness: 0.9 });
        const slab = new THREE.Mesh(new THREE.BoxGeometry(across, this.height, 0.8), [side, side, side, side, face, face]);
        slab.position.y = this.height / 2;
        slab.castShadow = true;
        slider.add(slab);
        group.add(slider);
        // Stone posts each side and a lintel over the top
        const frame = new THREE.MeshStandardMaterial({ color: 0xa8783a, roughness: 0.9 });
        for (const sx of [-1, 1]) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, this.height + 0.3, 1.05), frame);
            post.position.set(sx * (across / 2 + 0.05), (this.height + 0.3) / 2, 0);
            group.add(post);
        }
        const lintel = new THREE.Mesh(new THREE.BoxGeometry(across + 0.5, 0.35, 1.1), frame);
        lintel.position.y = this.height + 0.15;
        group.add(lintel);
        door.slider = slider;

        const plate = new THREE.Group();
        const sunMap = (() => {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = 128;
            const g = canvas.getContext('2d');
            g.fillStyle = '#c9a060';
            g.fillRect(0, 0, 128, 128);
            carveGlyph(g, 7, 64, 64, 100);
            return new THREE.CanvasTexture(canvas);
        })();
        const top = new THREE.MeshStandardMaterial({ map: sunMap, roughness: 0.8, emissive: 0x2a1a04, emissiveIntensity: 0.4 });
        const stoneSide = new THREE.MeshStandardMaterial({ color: 0xa88850, roughness: 0.9 });
        const button = new THREE.Mesh(new THREE.CylinderGeometry(BUTTON_RADIUS, BUTTON_RADIUS, BUTTON_HEIGHT, 28), [stoneSide, top, stoneSide]);
        button.position.y = BUTTON_HEIGHT / 2;
        plate.add(button);
        const rim = new THREE.Mesh(
            new THREE.RingGeometry(BUTTON_RADIUS + 0.02, BUTTON_RADIUS + 0.14, 32),
            new THREE.MeshStandardMaterial({ color: 0xffcf3a, metalness: 0.7, roughness: 0.3, emissive: 0xa06a00, emissiveIntensity: 0.8 })
        );
        rim.rotation.x = -Math.PI / 2;
        rim.position.y = 0.012;
        plate.add(rim);
        plate.position.set(door.button.x, 0, door.button.z);
        this.root.add(plate);
        door.buttonMesh = button;
        this.showButtonDoor(door);
    }

    // The spinning secret wall: a block of wall that looks like the others,
    // except for a big golden beetle carved on both faces that glows softly,
    // so it can be spotted by looking carefully. It turns on its middle.
    createSpinWall() {
        const w = this.spinWall;
        const across = w.across;
        const pixels = 128 * across;
        // The face: the walls' sandstone blocks, with the beetle in the middle
        const face = document.createElement('canvas');
        face.width = pixels;
        face.height = 512;
        const g = face.getContext('2d');
        const stone = sandstoneTexture(128, 512, 83).image;
        for (let k = 0; k < across; k++) g.drawImage(stone, k * 128, 0);
        const glow = document.createElement('canvas');
        glow.width = pixels;
        glow.height = 512;
        const e = glow.getContext('2d');
        // (the stone glows as faintly as the other walls)
        e.fillStyle = 'rgb(17,12,2)';
        e.fillRect(0, 0, pixels, 512);
        const beetle = (ctx, fill, line) => {
            const s = 190;
            ctx.save();
            ctx.translate(pixels / 2, 280);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.fillStyle = fill;
            ctx.strokeStyle = line;
            ctx.lineWidth = 9;
            // Six legs
            ctx.beginPath();
            for (const side of [-1, 1]) {
                ctx.moveTo(side * s * 0.18, -s * 0.05);
                ctx.lineTo(side * s * 0.42, -s * 0.2);
                ctx.lineTo(side * s * 0.48, -s * 0.32);
                ctx.moveTo(side * s * 0.2, s * 0.08);
                ctx.lineTo(side * s * 0.46, s * 0.1);
                ctx.moveTo(side * s * 0.18, s * 0.22);
                ctx.lineTo(side * s * 0.4, s * 0.42);
                ctx.lineTo(side * s * 0.44, s * 0.52);
            }
            ctx.stroke();
            // Body, head and the two front feelers holding up a sun
            ctx.beginPath();
            ctx.ellipse(0, s * 0.1, s * 0.22, s * 0.3, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.ellipse(0, -s * 0.27, s * 0.13, s * 0.09, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-s * 0.08, -s * 0.33);
            ctx.lineTo(-s * 0.16, -s * 0.48);
            ctx.moveTo(s * 0.08, -s * 0.33);
            ctx.lineTo(s * 0.16, -s * 0.48);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, -s * 0.6, s * 0.13, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            // The line down its back between the wings
            ctx.beginPath();
            ctx.moveTo(0, -s * 0.16);
            ctx.lineTo(0, s * 0.38);
            ctx.strokeStyle = 'rgba(90,50,0,0.8)';
            ctx.lineWidth = 5;
            ctx.stroke();
            ctx.restore();
        };
        // A dark cut round the beetle, like a carving, then the gold
        g.save();
        g.translate(3, 3);
        beetle(g, 'rgba(100,60,20,0.8)', 'rgba(100,60,20,0.8)');
        g.restore();
        beetle(g, '#ffcf3a', '#c88a10');
        beetle(e, '#e0a020', '#a06a00');
        const faceMap = new THREE.CanvasTexture(face);
        const glowMap = new THREE.CanvasTexture(glow);
        const faceMaterial = new THREE.MeshStandardMaterial({ map: faceMap, emissiveMap: glowMap, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.85 });
        const side = new THREE.MeshStandardMaterial({ map: sandstoneTexture(128, 512, 83), roughness: 0.9, emissive: 0x3a2808, emissiveIntensity: 0.3 });
        const group = new THREE.Group();
        group.position.copy(w.center);
        this.root.add(group);
        const turner = new THREE.Group();
        group.add(turner);
        // The box faces +z and -z when the wall runs along x
        const slab = new THREE.Mesh(new THREE.BoxGeometry(across, this.height, 0.98), [side, side, side, side, faceMaterial, faceMaterial]);
        slab.position.y = this.height / 2;
        slab.castShadow = true;
        turner.add(slab);
        if (!w.spansX) group.rotation.y = Math.PI / 2;
        w.turner = turner;
    }

    // Walking into the spinning wall: the player's middle is in front of it,
    // within touching distance of its face, and they're pushing toward it.
    // Returns which side they're on (+1 or -1 along the way through), or 0.
    spinWallTouch(position, radius, direction) {
        const w = this.spinWall;
        if (!w || w.spin) return 0;
        const along = w.spansX ? position.x - w.center.x : position.z - w.center.z;
        const through = w.spansX ? position.z - w.center.z : position.x - w.center.x;
        const push = w.spansX ? direction.z : direction.x;
        if (Math.abs(along) > w.across / 2) return 0;
        if (Math.abs(through) > 0.5 + radius + SPIN_WALL_TOUCH) return 0;
        const side = Math.sign(through) || 1;
        return push * side < -0.5 ? side : 0;
    }

    // Start a spin: the wall turns around once (half a turn), carrying the
    // player from `side` to the other side. They keep looking the same way,
    // so at the end they face away from the wall.
    startSpin(position, side, radius) {
        const w = this.spinWall;
        const rel = position.clone().sub(w.center);
        rel.y = 0;
        const normal = w.spansX ? new THREE.Vector3(0, 0, side) : new THREE.Vector3(side, 0, 0);
        w.spin = { time: 0, from: rel, to: normal.clone().multiplyScalar(0.5 + radius + 0.05), normal, start: w.angle };
    }

    // One game step of a spin (so it stops while paused). Returns where the
    // player is, and `done` with the cell middle beyond the wall to step to.
    updateSpinWall(dt) {
        const w = this.spinWall;
        const sp = w?.spin;
        if (!sp) return null;
        sp.time = Math.min(SPIN_WALL_TIME, sp.time + dt);
        const t = sp.time / SPIN_WALL_TIME;
        const eased = t * t * (3 - 2 * t);
        const theta = Math.PI * eased;
        w.angle = sp.start + theta;
        if (w.turner) w.turner.rotation.y = w.angle;
        // Slide up against the middle of the face first, then turn with it
        const rel = sp.from.clone().lerp(sp.to, Math.min(1, t * 4));
        const c = Math.cos(theta);
        const s = Math.sin(theta);
        const turned = new THREE.Vector3(rel.x * c + rel.z * s, 0, -rel.x * s + rel.z * c);
        const position = w.center.clone().add(turned);
        if (sp.time < SPIN_WALL_TIME) return { position, done: false };
        w.spin = null;
        w.angle %= Math.PI * 2;
        // Step off into the middle of the cell on the far side
        const step = w.center.clone().addScaledVector(sp.normal, -2);
        return { position, done: true, step };
    }

    // The cloud trampoline (Sky World, Level 133 on): a soft, puffy white
    // cloud filling the floor of its corridor cell, a little bluish
    // underneath, bobbing gently. Plus what you see from the air while it
    // bounces you (hidden till then): just its cell, the wall and the
    // landing cell beyond.
    createTrampoline(t) {
        const group = new THREE.Group();
        group.position.copy(t.center);
        const puff = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xe8f0ff, emissiveIntensity: 0.35 });
        const shade = new THREE.MeshStandardMaterial({ color: 0xc8d8f0, roughness: 1, emissive: 0x8090b0, emissiveIntensity: 0.2 });
        const cushion = new THREE.Group();
        const base = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.25, 0.22, 32), shade);
        base.position.y = 0.11;
        cushion.add(base);
        let r = 71;
        const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
        for (let k = 0; k < 22; k++) {
            const a = k * 2.39996;
            const d = k === 0 ? 0 : Math.min(1.05, 0.25 * Math.sqrt(k) + random() * 0.15);
            const size = 0.42 + random() * 0.2 - d * 0.08;
            const ball = new THREE.Mesh(new THREE.SphereGeometry(size, 18, 12), puff);
            ball.scale.y = 0.55;
            ball.position.set(Math.cos(a) * d, 0.24 + random() * 0.08, Math.sin(a) * d);
            cushion.add(ball);
        }
        group.add(cushion);
        group.traverse((o) => { o.receiveShadow = true; });
        this.root.add(group);
        t.object = group;
        t.cushion = cushion;
        // The view from the air: the two cells and the walls round them
        const lo = { x: Math.min(t.x, t.x + 4 * t.dir.x) - 2, z: Math.min(t.z, t.z + 4 * t.dir.z) - 2 };
        const hi = { x: Math.max(t.x, t.x + 4 * t.dir.x) + 2, z: Math.max(t.z, t.z + 4 * t.dir.z) + 2 };
        const walls = [];
        for (let x = lo.x; x <= hi.x; x++) for (let z = lo.z; z <= hi.z; z++) if (this.grid[x]?.[z] === 1) walls.push([x, z]);
        const view = new THREE.Group();
        const wallMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, this.height, 1), this.wallMaterial, walls.length);
        const matrix = new THREE.Matrix4();
        walls.forEach(([x, z], k) => wallMesh.setMatrixAt(k, matrix.makeTranslation(x + 0.5, this.height / 2, z + 0.5)));
        view.add(wallMesh);
        const map = grassTexture(256, 151);
        map.wrapS = map.wrapT = THREE.RepeatWrapping;
        map.repeat.set((hi.x - lo.x + 1) / 8, (hi.z - lo.z + 1) / 8);
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(hi.x - lo.x + 1, hi.z - lo.z + 1), new THREE.MeshStandardMaterial({ map, roughness: 1 }));
        floor.rotation.x = -Math.PI / 2;
        floor.position.set((lo.x + hi.x + 1) / 2, 0.001, (lo.z + hi.z + 1) / 2);
        floor.receiveShadow = true;
        view.add(floor);
        view.visible = false;
        this.root.add(view);
        t.viewGroup = view;
    }

    // The first cloud trampoline (most levels with one have just one)
    get trampoline() {
        return this.trampolines?.[0] ?? null;
    }

    // Standing on a cloud trampoline: your middle is inside its cell (gives
    // that trampoline, or null)
    onTrampoline(point) {
        return (this.trampolines ?? []).find((t) => Math.abs(point.x - t.center.x) < 1.5 && Math.abs(point.z - t.center.z) < 1.5) ?? null;
    }

    // In the air over the trampoline's wall, only its cell, the wall and the
    // landing cell show (so nobody can see the maze from above); on landing
    // everything shows again
    setTrampolineView(on, t = (this.trampolines ?? []).find((x) => x.view)) {
        if (!t || t.view === on) return;
        if (on) {
            t.saved = new Map(this.root.children.map((o) => [o, o.visible]));
            for (const o of this.root.children) o.visible = false;
            t.object.visible = true;
            t.viewGroup.visible = true;
        } else {
            for (const [o, visible] of t.saved ?? []) o.visible = visible;
            t.saved = null;
            t.viewGroup.visible = false;
        }
        t.view = on;
        // A rainbow bridge shows (or not) for where it is in its cycle now
        if (!on) for (const p of this.platforms) if (p.rainbowObject) this.showRainbow(p);
    }

    // One game step: the cloud squishes down when bounced on, then puffs
    // back up, and bobs a little
    updateTrampoline(dt) {
        for (const t of this.trampolines ?? []) this.updateOneTrampoline(t, dt);
    }

    updateOneTrampoline(t, dt) {
        t.squish = Math.max(0, t.squish - dt * 2);
        t.clock = (t.clock ?? 0) + dt;
        if (!t.cushion) return;
        const q = Math.sin(t.squish * Math.PI) * 0.6 + t.squish * 0.3;
        t.cushion.scale.set(1 + q * 0.15, 1 - q * 0.6, 1 + q * 0.15);
        t.cushion.position.y = 0.03 * Math.sin(t.clock * 1.7);
    }

    // Sent back to the start (or a level loading): no spin in progress
    resetSpinWall() {
        if (this.spinWall) this.spinWall.spin = null;
    }

    // The first button door (most levels have just one)
    get buttonDoor() {
        return this.buttonDoors?.[0];
    }

    // Shut (solid) or open (walk-through) a button door's blocks
    setButtonDoorSolid(door, solid) {
        if (door.solid === solid) return;
        door.solid = solid;
        for (const { x, z } of door.blocks) this.mazeData[x][z].fill(solid ? 1 : 0);
    }

    // Each game step (so it stops while paused): any part of the player on
    // a button presses it (it sinks with a click) and its own door slides
    // down into the floor. It stays open until the player is sent back to
    // the start. Returns what happened: 'press', then 'open' when it's open.
    updateButtonDoor(dt, point, radius) {
        const events = [];
        this.buttonDoors.forEach((door) => {
            if (!door.pressed && Math.hypot(point.x - door.button.x, point.z - door.button.z) < BUTTON_RADIUS + radius) {
                door.pressed = true;
                events.push('press');
            }
            if (door.pressed) {
                door.sink = Math.min(1, door.sink + dt / BUTTON_SINK_TIME);
                if (door.open < 1) {
                    door.open = Math.min(1, door.open + dt / BUTTON_DOOR_OPEN_TIME);
                    if (door.open === 1) events.push('open');
                }
                if (door.open >= BUTTON_DOOR_PASSABLE_FROM) this.setButtonDoorSolid(door, false);
            }
            this.showButtonDoor(door);
        });
        return events;
    }

    // Sent back to the start: every door shuts again and its button pops back up
    resetButtonDoor() {
        for (const door of this.buttonDoors) {
            Object.assign(door, { pressed: false, open: 0, sink: 0 });
            this.setButtonDoorSolid(door, true);
            this.showButtonDoor(door);
        }
    }

    // Loading a saved spot: the doors whose buttons were pressed are already
    // open (saved as button: true for the first door, button2: true for the
    // second)
    setButtonPressed(progress = { button: true }) {
        this.buttonDoors.forEach((door, index) => {
            if (!(index === 0 ? progress.button : progress.button2)) return;
            Object.assign(door, { pressed: true, open: 1, sink: 1 });
            this.setButtonDoorSolid(door, false);
            this.showButtonDoor(door);
        });
    }

    showButtonDoor(door) {
        if (!door.slider) return;
        door.slider.position.y = -door.open * (this.height + 0.05);
        door.slider.visible = door.open < 1;
        door.buttonMesh.position.y = BUTTON_HEIGHT / 2 - door.sink * (BUTTON_HEIGHT - 0.02);
    }

    // Is a point within `margin` of any spike? (The round spike counts from the
    // edge of its plate; a row counts across its whole width.)
    // ---- Pirate Ship World (Level 121 on) ----

    // The sky and the sea: a bright sun, the sea all round the ship far
    // below the deck (gently moving), the ship's wooden hull down to it,
    // tall masts with big sails standing up out of the crate walls, and
    // seagulls gliding by. Decoration only: nothing up there touches you.
    // ---- Sky World (Level 131 on) ----

    // A floating island high in the sky: the sun, a sea of clouds far below
    // (seen past the island's edges and down every gap), puffy clouds
    // drifting by under the island, the island's rocky underside, and birds
    // and kites flying by (just to look at, nothing to bump into)
    addSkyIsland() {
        const cx = this.width / 2;
        const cz = this.depth / 2;
        const sun = new THREE.Mesh(new THREE.SphereGeometry(14, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff6c4, fog: false }));
        sun.position.set(cx - 140, 120, cz - 170);
        this.root.add(sun);
        const map = cloudSeaTexture(256, 241);
        map.repeat.set(30, 30);
        const sea = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshBasicMaterial({ map, fog: false }));
        sea.rotation.x = -Math.PI / 2;
        sea.position.set(cx, CLOUD_LEVEL, cz);
        this.root.add(sea);
        this.cloudMap = map;
        // The island's underside: rough brown rock under the whole maze,
        // narrowing to a point far below (a four-sided cone, its rim on the
        // maze's edges), with a grassy lip round the edge
        const rock = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 1, flatShading: true });
        const under = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(this.width, this.depth) / 2 + 0.6, 16, 4, 5, true), rock);
        const pos = under.geometry.attributes.position;
        for (let k = 0; k < pos.count; k++) {
            const y = pos.getY(k);
            if (y < -7.9 || y > 7.9) continue; // the rim stays on the maze's edge
            const wobble = 1 + 0.1 * Math.sin(k * 12.9898 + y);
            pos.setX(k, pos.getX(k) * wobble);
            pos.setZ(k, pos.getZ(k) * wobble);
        }
        under.geometry.computeVertexNormals();
        under.rotation.set(Math.PI, Math.PI / 4, 0);
        under.position.set(cx, -8.2, cz);
        this.root.add(under);
        const lipMaterial = new THREE.MeshStandardMaterial({ color: 0x4f9a33, roughness: 1 });
        for (const [w, d, x, z] of [
            [this.width + 1.2, 0.6, cx, -0.3], [this.width + 1.2, 0.6, cx, this.depth + 0.3],
            [0.6, this.depth + 1.2, -0.3, cz], [0.6, this.depth + 1.2, this.width + 0.3, cz],
        ]) {
            const lip = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, d), lipMaterial);
            lip.position.set(x, -0.2, z);
            this.root.add(lip);
        }
        // Puffy white clouds drifting slowly by under the island (and a few high above)
        this.flyers = [];
        const kinds = ['lowcloud', 'bird', 'kite', 'lowcloud', 'bird', 'lowcloud', 'kite', 'bird', 'lowcloud', 'cloud', 'bird', 'lowcloud'];
        kinds.forEach((kind, k) => {
            const flyer = kind === 'lowcloud' || kind === 'cloud' ? this.makeSkyCloud(kind, k) : kind === 'kite' ? this.makeKite(k) : this.makeFlyer('gull');
            if (kind === 'bird') flyer.kind = 'gull';
            this.root.add(flyer.object);
            this.flyers.push(flyer);
            this.launchFlyer(flyer, k / kinds.length);
        });
    }

    // A soft white cloud: a lump of puffy balls
    makeSkyCloud(kind, k) {
        const group = new THREE.Group();
        const material = new THREE.MeshBasicMaterial({ color: [0xffffff, 0xf4f8ff, 0xeef4fb][k % 3], fog: false });
        const ball = new THREE.SphereGeometry(1, 14, 10);
        for (let b = 0; b < 7; b++) {
            const puff = new THREE.Mesh(ball, material);
            puff.scale.setScalar(3 + ((b * 37) % 5) * 0.7);
            puff.scale.y *= 0.7;
            puff.position.set((b - 3) * 3.4, Math.sin(b * 1.7) * 1.2 + (b % 3 === 1 ? 1.2 : 0), Math.cos(b * 2.3) * 2.2);
            group.add(puff);
        }
        const object = new THREE.Group();
        object.add(group);
        return { kind, object, velocity: new THREE.Vector3(), life: 0 };
    }

    // A diamond kite with a ribbon tail of bows, bobbing on the wind
    makeKite(k) {
        const group = new THREE.Group();
        const colors = [[0xff3b6b, 0xffd60a], [0x2fa8ff, 0xff9a1f], [0x3ddc5a, 0xa64dff]][k % 3];
        const half = (a, b, color) => new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([a, b, new THREE.Vector2(0, -2.8), new THREE.Vector2(0, 2.2)])), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, fog: false }));
        group.add(half(new THREE.Vector2(0, 2.2), new THREE.Vector2(1.3, 0), colors[0]).translateZ(0.01));
        group.add(half(new THREE.Vector2(0, 2.2), new THREE.Vector2(-1.3, 0), colors[1]));
        const frame = new THREE.LineBasicMaterial({ color: 0x5a3d22, fog: false });
        group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 2.2, 0.02), new THREE.Vector3(0, -2.8, 0.02), new THREE.Vector3(-1.3, 0, 0.02), new THREE.Vector3(1.3, 0, 0.02)]), frame));
        const tail = [];
        for (let b = 0; b < 5; b++) {
            const bow = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 4), new THREE.MeshBasicMaterial({ color: colors[b % 2], fog: false }));
            bow.rotation.z = Math.PI / 2;
            bow.position.set(0, -3.4 - b * 0.9, 0);
            group.add(bow);
            tail.push(bow);
        }
        group.rotation.y = Math.PI / 2; // face sideways to its path (models point along +x)
        group.rotation.z = -0.25;
        const object = new THREE.Group();
        object.add(group);
        return { kind: 'kite', object, velocity: new THREE.Vector3(), life: 0, bob: k, tail };
    }

    // Sky World's spike: a little dark storm cloud floating low, with
    // pointy yellow lightning bolts poking down to the floor, as wide as a
    // spike's plate. Touching it works the same as a spike.
    createStormCloud(position, radius) {
        const spike = new THREE.Group();
        const cloud = new THREE.MeshStandardMaterial({ color: 0x4a4f5c, roughness: 1, emissive: 0x15171d, emissiveIntensity: 0.5 });
        const ball = new THREE.SphereGeometry(1, 14, 10);
        for (const [x, y, z, s] of [[0, 1.25, 0, 0.5], [0.38, 1.18, 0.12, 0.38], [-0.36, 1.2, 0.18, 0.4], [0.1, 1.2, -0.38, 0.38], [-0.2, 1.42, -0.12, 0.34], [0.24, 1.4, 0.3, 0.3]]) {
            const puff = new THREE.Mesh(ball, cloud);
            puff.scale.set(s, s * 0.8, s);
            puff.position.set(x, y, z);
            puff.castShadow = true;
            spike.add(puff);
        }
        // Lightning bolts: flat yellow zigzags from under the cloud down to the floor
        const bolt = new THREE.MeshBasicMaterial({ color: 0xffe24a, side: THREE.DoubleSide });
        const bolts = [];
        for (const [x, z, turn] of [[0, 0, 0], [0.4, 0.1, 1.1], [-0.36, 0.22, 2.2], [0.05, -0.4, 0.6], [-0.22, -0.26, 1.8]]) {
            const shape = new THREE.Shape([
                new THREE.Vector2(-0.07, 1.05), new THREE.Vector2(0.09, 1.05), new THREE.Vector2(0.02, 0.68), new THREE.Vector2(0.12, 0.68),
                new THREE.Vector2(-0.04, 0.3), new THREE.Vector2(0.05, 0.3), new THREE.Vector2(-0.06, 0), new THREE.Vector2(-0.08, 0.38),
                new THREE.Vector2(-0.16, 0.38), new THREE.Vector2(-0.06, 0.74), new THREE.Vector2(-0.16, 0.74),
            ]);
            const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), bolt);
            mesh.position.set(x, 0.02, z);
            mesh.rotation.y = turn;
            spike.add(mesh);
            bolts.push(mesh);
        }
        // A faint glow on the floor under it
        const glow = new THREE.Mesh(new THREE.CircleGeometry(SPIKE_RADIUS, 20), new THREE.MeshBasicMaterial({ color: 0xfff3a0, transparent: true, opacity: 0.35 }));
        glow.rotation.x = -Math.PI / 2;
        glow.position.y = 0.01;
        spike.add(glow);
        spike.scale.set(radius / SPIKE_RADIUS, 1, radius / SPIKE_RADIUS);
        spike.position.copy(position);
        spike.position.y = 0;
        this.root.add(spike);
        (this.stormClouds ||= []).push({ bolts, glow, time: Math.random() * 5 });
        return spike;
    }

    // A gap's hole in the island (Level 131 on): rough earth and rock sides
    // go down ISLAND_DEPTH, and below that you see the clouds far, far below
    createSkyHole(p) {
        const g = p.gap;
        const cx = (g.minX + g.maxX) / 2;
        const cz = (g.minZ + g.maxZ) / 2;
        const sizeX = g.maxX - g.minX;
        const sizeZ = g.maxZ - g.minZ;
        const earth = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 1, side: THREE.DoubleSide });
        for (const [w, d, x, z] of [
            [sizeX, 0.05, cx, g.minZ], [sizeX, 0.05, cx, g.maxZ],
            [0.05, sizeZ, g.minX, cz], [0.05, sizeZ, g.maxX, cz],
        ]) {
            const wall = new THREE.Mesh(new THREE.BoxGeometry(w, ISLAND_DEPTH, d), earth);
            wall.position.set(x, -0.2 - ISLAND_DEPTH / 2, z);
            this.root.add(wall);
        }
        // Grass tufts hanging over each edge, so the edge shows from far off
        const grass = new THREE.MeshStandardMaterial({ color: 0x3f8a2a, roughness: 1 });
        const width = p.alongX ? sizeZ : sizeX;
        for (const end of [0, p.span]) {
            const strip = new THREE.Mesh(new THREE.BoxGeometry(width, 0.3, 0.12), grass);
            if (p.alongX) {
                strip.rotation.y = Math.PI / 2;
                strip.position.set(g.minX + end, -0.36, cz);
            } else {
                strip.position.set(cx, -0.36, g.minZ + end);
            }
            this.root.add(strip);
        }
    }

    // The rainbow bridge: seven bright stripes side by side, running the
    // length of the gap, the whole corridor wide, resting on both edges,
    // glowing softly, with little sparkles floating over it. It flickers
    // while fading and is gone (see-through, nothing there) while gone.
    createRainbow(p) {
        const g = p.gap;
        const width = p.alongX ? g.maxZ - g.minZ : g.maxX - g.minX;
        const length = p.span + 0.4;
        const group = new THREE.Group();
        const materials = [];
        const stripe = width / RAINBOW_COLORS.length;
        RAINBOW_COLORS.forEach((color, k) => {
            const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, roughness: 0.4, transparent: true, opacity: 0.92 });
            const band = new THREE.Mesh(new THREE.BoxGeometry(stripe, 0.12, length), material);
            band.position.set(-width / 2 + stripe * (k + 0.5), -0.06, 0);
            band.receiveShadow = true;
            group.add(band);
            materials.push(material);
        });
        // A soft glow under it
        const glowMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, depthWrite: false });
        const glow = new THREE.Mesh(new THREE.PlaneGeometry(width + 0.6, length + 0.6), glowMaterial);
        glow.rotation.x = -Math.PI / 2;
        glow.position.y = -0.2;
        group.add(glow);
        materials.push(glowMaterial);
        // Sparkles
        const sparkles = [];
        const sparkleMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
        for (let k = 0; k < 14; k++) {
            const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.06), sparkleMaterial);
            s.position.set((Math.random() - 0.5) * width, 0.2 + Math.random() * 0.8, (Math.random() - 0.5) * length);
            group.add(s);
            sparkles.push({ mesh: s, phase: Math.random() * 6 });
        }
        materials.push(sparkleMaterial);
        group.position.set((g.minX + g.maxX) / 2, 0, (g.minZ + g.maxZ) / 2);
        if (p.alongX) group.rotation.y = Math.PI / 2;
        this.root.add(group);
        p.object = null; // (nothing moves)
        p.rainbowObject = { group, materials, sparkles, opacity: materials.map((m) => m.opacity) };
    }

    // Run one rainbow bridge's cycle (a game step, so it stops while paused).
    // Returns 'appear', 'fade' or 'vanish' when that happens.
    updateRainbow(p, dt, position, radius) {
        const { along, across, width } = this.gapCoords(position, p);
        // Any part of you on it (or over the gap at all)
        const on = across >= -radius && across < width + radius && along + radius > 0 && along - radius < p.span;
        let event = null;
        p.rainbowTime += dt;
        p.held = false;
        if (p.rainbowPhase === 'solid' && p.rainbowTime >= RAINBOW_SOLID) {
            Object.assign(p, { rainbowPhase: 'fading', rainbowTime: p.rainbowTime - RAINBOW_SOLID });
            event = 'fade';
        }
        if (p.rainbowPhase === 'fading' && p.rainbowTime >= RAINBOW_FADE) {
            if (on) {
                // Never goes while you're on it: it waits for you to be off
                p.rainbowTime = RAINBOW_FADE;
                p.held = true;
            } else {
                Object.assign(p, { rainbowPhase: 'gone', rainbowTime: p.rainbowTime - RAINBOW_FADE });
                event = 'vanish';
            }
        }
        if (p.rainbowPhase === 'gone' && p.rainbowTime >= RAINBOW_GONE) {
            Object.assign(p, { rainbowPhase: 'solid', rainbowTime: p.rainbowTime - RAINBOW_GONE });
            event = 'appear';
        }
        this.showRainbow(p);
        return event;
    }

    // Draw the rainbow for its phase: solid, flickering, or gone
    showRainbow(p) {
        const r = p.rainbowObject;
        if (!r) return;
        r.group.visible = p.rainbowPhase !== 'gone' && !(this.trampolines ?? []).some((t) => t.view);
        let k = 1;
        if (p.rainbowPhase === 'fading') {
            // Flickering, faster and fainter toward the end
            const t = p.rainbowTime;
            k = (Math.floor(t * (6 + t * 8)) % 2 ? 0.35 : 1) * (1 - 0.3 * Math.min(1, t / RAINBOW_FADE));
        }
        r.materials.forEach((m, n) => { m.opacity = r.opacity[n] * k; });
    }

    // Sparkles over each rainbow, and the storm clouds' bolts flickering (just looks, every frame)
    updateSkyLooks(dt) {
        for (const p of this.platforms) {
            for (const s of p.rainbowObject?.sparkles ?? []) {
                s.phase += dt * 2;
                s.mesh.position.y = 0.2 + ((s.phase * 0.15) % 1);
                s.mesh.rotation.y += dt * 3;
                s.mesh.scale.setScalar(0.6 + 0.4 * Math.sin(s.phase * 2));
            }
        }
        for (const c of this.stormClouds || []) {
            c.time += dt;
            const flash = (c.time % 2.3) < 0.12 || ((c.time + 0.9) % 3.1) < 0.08;
            for (const b of c.bolts) b.material.color.setHex(flash ? 0xffffff : 0xffe24a);
            c.glow.material.opacity = flash ? 0.6 : 0.3;
        }
        for (const flyer of this.flyers || []) {
            if (flyer.kind !== 'kite') continue;
            flyer.bob += dt;
            flyer.object.position.y += Math.sin(flyer.bob * 1.6) * dt * 1.2;
            flyer.tail.forEach((bow, n) => { bow.position.x = Math.sin(flyer.bob * 3 + n * 0.8) * 0.25 * n; });
        }
    }

    // ---- Mushroom Forest World (Levels 141-150) ----

    // Glowing mushroom caps on top of the walls: one round cap on most wall
    // columns, in soft glowing teal, lilac, lime and orange, so the walls
    // read as giant mushrooms (stems below, caps on top)
    addMushroomTops(wallCount) {
        const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const caps = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), material, wallCount);
        const matrix = new THREE.Matrix4();
        const color = new THREE.Color();
        let r = 41;
        const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
        let n = 0;
        for (let x = 0; x < this.width; x++) {
            for (let z = 0; z < this.depth; z++) {
                if (this.grid[x][z] !== 1) continue;
                const size = 0.62 + random() * 0.25;
                matrix.makeScale(size, size * (0.45 + random() * 0.25), size);
                matrix.setPosition(x + 0.5, this.height - 0.05, z + 0.5);
                caps.setMatrixAt(n, matrix);
                caps.setColorAt(n++, color.set(MUSHROOM_GLOWS[Math.floor(random() * MUSHROOM_GLOWS.length)]));
            }
        }
        caps.count = n;
        this.root.add(caps);
    }

    // The night sky: stars all round, and glowing spores floating slowly up
    // and drifting over the maze (just to look at: nothing to bump into)
    addMushroomSky() {
        const cx = this.width / 2;
        const cz = this.depth / 2;
        const positions = [];
        let r = 211;
        const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
        for (let i = 0; i < 1400; i++) {
            const a = random() * Math.PI * 2;
            const y = 0.05 + random() * 0.95;
            const flat = Math.sqrt(1 - y * y);
            positions.push(cx + Math.cos(a) * flat * 400, y * 400, cz + Math.sin(a) * flat * 400);
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        this.root.add(new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, sizeAttenuation: false, fog: false })));
        // A pale moon
        const moon = new THREE.Mesh(new THREE.SphereGeometry(16, 24, 16), new THREE.MeshBasicMaterial({ color: 0xf4f0d8, fog: false }));
        moon.position.set(cx + 150, 130, cz - 190);
        this.root.add(moon);
        // The spores: soft glowing dots
        const count = Math.round(this.width * this.depth / 6);
        const spores = new Float32Array(count * 3);
        this.spores = [];
        for (let k = 0; k < count; k++) {
            const s = { x: random() * this.width, y: random() * 9, z: random() * this.depth, rise: 0.15 + random() * 0.25, phase: random() * 6, sway: 0.2 + random() * 0.3 };
            this.spores.push(s);
            spores.set([s.x, s.y, s.z], k * 3);
        }
        const sporeGeometry = new THREE.BufferGeometry();
        sporeGeometry.setAttribute('position', new THREE.BufferAttribute(spores, 3));
        this.sporePoints = new THREE.Points(sporeGeometry, new THREE.PointsMaterial({ color: 0xc8ff8a, size: 0.14, map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        this.root.add(this.sporePoints);
    }

    // The spores float up slowly, swaying, and start again low down at the top
    updateMushroomLooks(dt) {
        if (this.sporePoints) {
            const pos = this.sporePoints.geometry.attributes.position;
            this.spores.forEach((s, k) => {
                s.phase += dt;
                s.y += s.rise * dt;
                if (s.y > 9) s.y = 0.2;
                pos.setXYZ(k, s.x + Math.sin(s.phase * 0.7) * s.sway, s.y, s.z + Math.cos(s.phase * 0.5) * s.sway);
            });
            pos.needsUpdate = true;
        }
        for (const p of this.platforms) {
            if (p.acidMap) p.acidMap.offset.x = (p.acidMap.offset.x + dt * 0.05) % 1;
            if (p.capRing) {
                // The ring round the stem glows brighter and softer, gently
                p.capClock = (p.capClock ?? 0) + dt;
                p.capRing.material.opacity = 0.75 + 0.25 * Math.sin(p.capClock * 3);
            }
            for (const b of p.acidBubbles ?? []) {
                b.time += dt;
                const t = (b.time % b.every) / b.every;
                b.mesh.scale.setScalar(t < 0.8 ? 0.4 + t : 0.01);
            }
        }
        // The sleepy mushrooms' Zzz bubbles float up, swaying, growing and fading
        for (const m of this.sleepies) {
            m.clock += dt;
            m.zzz.forEach((z, n) => {
                const t = ((m.clock + (n * ZZZ_TIME) / ZZZ_COUNT) % ZZZ_TIME) / ZZZ_TIME;
                z.position.set(Math.sin(t * Math.PI * 2 + n) * 0.25, 1.05 + t * 1.6, Math.cos(t * Math.PI * 2 + n) * 0.1);
                z.scale.setScalar(0.22 + t * 0.3);
                z.material.opacity = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
            });
        }
    }

    // The sleepy mushroom: a blue cap with pale spots on a cream stem, with
    // little "Zzz" bubbles floating up from it. It's solid (you go round it);
    // touching it isn't an Ouch, it makes you sleepy (main.js).
    createSleepyMushroom(position) {
        const radius = SLEEPY_RADIUS;
        const group = new THREE.Group();
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.3, radius * 0.38, 0.75, 14), new THREE.MeshStandardMaterial({ color: 0xf2e6c8, roughness: 0.8 }));
        stem.position.y = 0.375;
        stem.castShadow = true;
        group.add(stem);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3f73ee, roughness: 0.45, emissive: 0x0c2a7a, emissiveIntensity: 0.6 }));
        cap.scale.y = 0.6;
        cap.position.y = 0.7;
        cap.castShadow = true;
        group.add(cap);
        const under = new THREE.Mesh(new THREE.CircleGeometry(radius, 24), new THREE.MeshStandardMaterial({ color: 0xe8d8b0, side: THREE.DoubleSide }));
        under.rotation.x = Math.PI / 2;
        under.position.y = 0.7;
        group.add(under);
        // Pale blue spots on the cap
        const spot = new THREE.MeshStandardMaterial({ color: 0xcfe0ff, roughness: 0.6 });
        const spotGeometry = new THREE.SphereGeometry(1, 8, 6);
        for (const [a, up] of [[0, 1.2], [1.3, 0.75], [2.6, 0.7], [3.9, 0.8], [5.2, 0.72], [0.65, 0.35], [3.25, 0.4]]) {
            const sp = new THREE.Mesh(spotGeometry, spot);
            const sz = radius * 0.12;
            sp.scale.set(sz, sz * 0.5, sz);
            const tilt = Math.min(up, Math.PI / 2) * 0.9;
            const ring = Math.cos(Math.PI / 2 - tilt);
            sp.position.set(Math.cos(a) * radius * ring, 0.7 + radius * 0.6 * Math.sin(Math.PI / 2 - tilt), Math.sin(a) * radius * ring);
            group.add(sp);
        }
        // The Zzz bubbles: round pale-blue bubbles with a Z in each
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 64;
        const c = canvas.getContext('2d');
        c.fillStyle = 'rgba(200, 222, 255, 0.55)';
        c.beginPath();
        c.arc(32, 32, 29, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        c.lineWidth = 3;
        c.stroke();
        c.fillStyle = '#1d3f9a';
        c.font = 'bold 40px sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText('Z', 32, 34);
        const map = new THREE.CanvasTexture(canvas);
        const zzz = [];
        for (let n = 0; n < ZZZ_COUNT; n++) {
            const z = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false }));
            group.add(z);
            zzz.push(z);
        }
        group.position.set(position.x, 0, position.z);
        this.root.add(group);
        return { position: new THREE.Vector3(position.x, 0, position.z), group, zzz, clock: 0 };
    }

    // Is this point touching a sleepy mushroom?
    touchesSleepy(point) {
        return this.sleepies.some((m) => Math.hypot(point.x - m.position.x, point.z - m.position.z) < SLEEPY_TOUCH);
    }

    // Sleepy mushrooms are solid: push a point that got too close back out
    // (straight away from the mushroom's middle). Returns true if it moved.
    pushOutOfSleepy(point) {
        let moved = false;
        for (const m of this.sleepies) {
            const dx = point.x - m.position.x;
            const dz = point.z - m.position.z;
            const d = Math.hypot(dx, dz);
            if (d >= SLEEPY_SOLID) continue;
            const ux = d > 1e-6 ? dx / d : 1;
            const uz = d > 1e-6 ? dz / d : 0;
            point.x = m.position.x + ux * SLEEPY_SOLID;
            point.z = m.position.z + uz * SLEEPY_SOLID;
            moved = true;
        }
        return moved;
    }

    // The big Ouch mushroom (Mushroom Forest World's spike row, Level 144 on):
    // one big poisonous mushroom (not three little ones), its cap as wide as
    // the corridor and its stem taller than you, filling a dead end's opening
    createBigOuchMushroom(row) {
        const group = this.createOuchMushroom(row.position, SPIKE_ROW_WIDTH / 2 - 0.05);
        // a taller, thicker stem; the cap and its spots sit on top of it
        const [stem, ...rest] = group.children;
        const taller = 2.4;
        stem.scale.set(1.15, taller, 1.15);
        stem.position.y *= taller;
        for (const part of rest) part.position.y += 0.75 * (taller - 1);
        return group;
    }

    // ---- Bright fireflies (Mushroom Forest World, Level 144 on) ----

    // A big firefly: a little black body with see-through wings and a glowing
    // tail, inside a soft glow that's small and dim, then big and dazzling
    createFirefly(position, n) {
        const group = new THREE.Group();
        const black = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.6 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), black);
        body.scale.set(0.09, 0.08, 0.2);
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), black);
        head.position.z = -0.2;
        group.add(head);
        const wingMaterial = new THREE.MeshBasicMaterial({ color: 0xd8e4ff, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });
        const wings = [];
        for (const side of [-1, 1]) {
            const wing = new THREE.Mesh(new THREE.CircleGeometry(0.16, 12), wingMaterial);
            wing.scale.set(0.6, 1, 1);
            wing.rotation.x = -Math.PI / 2;
            wing.position.set(side * 0.13, 0.07, -0.02);
            group.add(wing);
            wings.push({ wing, side });
        }
        const tail = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff27a }));
        tail.scale.set(0.085, 0.075, 0.12);
        tail.position.z = 0.2;
        group.add(tail);
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xfff6a8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
        group.add(glow);
        // its light on the floor and walls round it
        const pool = new THREE.Mesh(new THREE.CircleGeometry(1.5, 32), new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0xfff2a0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        pool.rotation.x = -Math.PI / 2;
        pool.position.set(position.x, 0.03, position.z);
        this.root.add(pool);
        const center = new THREE.Vector3(position.x, FIREFLY_HEIGHT, position.z);
        group.position.copy(center);
        this.root.add(group);
        const f = { position: center, group, glow, tail, wings, pool, time: 0, bright: false, shine: 0, clock: n * 1.7 };
        this.showFirefly(f);
        return f;
    }

    // Moves every firefly's cycle on by dt (the game step, so it stops while
    // paused). Returns the fireflies that just turned bright or dim.
    updateFireflies(dt) {
        const events = [];
        const cycle = FIREFLY_DIM_TIME + FIREFLY_BRIGHT_TIME;
        for (const f of this.fireflies) {
            f.time = (f.time + dt) % cycle;
            f.clock += dt;
            const bright = f.time >= FIREFLY_DIM_TIME;
            if (bright !== f.bright) events.push({ firefly: f, event: bright ? 'bright' : 'dim' });
            f.bright = bright;
            const most = dt / FIREFLY_FADE;
            f.shine += Math.max(-most, Math.min(most, (bright ? 1 : 0) - f.shine));
            this.showFirefly(f);
        }
        return events;
    }

    showFirefly(f) {
        const s = f.shine;
        f.glow.scale.setScalar(0.9 + s * 3.6);
        f.glow.material.opacity = 0.45 + s * 0.55;
        f.tail.material.color.setRGB(0.75 + s * 0.25, 0.7 + s * 0.3, 0.25 + s * 0.6);
        f.pool.material.opacity = 0.15 + s * 0.75;
        f.pool.scale.setScalar(0.6 + s * 0.9);
        // it hovers, bobbing a little and turning slowly; its wings flutter
        f.group.position.y = f.position.y + Math.sin(f.clock * 1.6) * 0.08;
        f.group.rotation.y = Math.sin(f.clock * 0.4) * 0.6;
        for (const { wing, side } of f.wings) wing.rotation.z = side * (0.3 + Math.sin(f.clock * 40) * 0.35);
    }

    // The bright firefly that's in your eyes right now (bright, within
    // FIREFLY_VIEW_ANGLE of where the camera faces, no wall in between), or null
    fireflyInEyes(camera) {
        if (!this.fireflies.length) return null;
        const eye = camera.getWorldPosition(new THREE.Vector3());
        const facing = camera.getWorldDirection(new THREE.Vector3());
        const cos = Math.cos((FIREFLY_VIEW_ANGLE * Math.PI) / 180);
        for (const f of this.fireflies) {
            if (!f.bright) continue;
            const to = f.group.position.clone().sub(eye);
            const d = to.length();
            if (d < 1e-6 || to.dot(facing) / d < cos) continue;
            if (this.wallBetween(eye, f.group.position)) continue;
            return f;
        }
        return null;
    }

    // Is there a wall (or the door) between these two points, seen from above?
    wallBetween(a, b) {
        const d = Math.hypot(b.x - a.x, b.z - a.z);
        const n = Math.ceil(d / 0.05);
        for (let k = 1; k < n; k++) {
            const x = Math.floor(a.x + ((b.x - a.x) * k) / n);
            const z = Math.floor(a.z + ((b.z - a.z) * k) / n);
            if (this.grid[x]?.[z] !== 0) return true;
        }
        return false;
    }

    // The Ouch mushroom (the spike): a red cap with white spots on a cream
    // stem, as wide as the level's spike. Touching it works the same as a spike.
    createOuchMushroom(position, radius) {
        const group = new THREE.Group();
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.3, radius * 0.38, 0.75, 14), new THREE.MeshStandardMaterial({ color: 0xf2e6c8, roughness: 0.8 }));
        stem.position.y = 0.375;
        stem.castShadow = true;
        group.add(stem);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xe8303a, roughness: 0.45, emissive: 0x5a0808, emissiveIntensity: 0.5 }));
        cap.scale.y = 0.6;
        cap.position.y = 0.7;
        cap.castShadow = true;
        group.add(cap);
        // The cap's flat underside
        const under = new THREE.Mesh(new THREE.CircleGeometry(radius, 24), new THREE.MeshStandardMaterial({ color: 0xe8d8b0, side: THREE.DoubleSide }));
        under.rotation.x = Math.PI / 2;
        under.position.y = 0.7;
        group.add(under);
        // White spots on the cap
        const spot = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
        const spotGeometry = new THREE.SphereGeometry(1, 8, 6);
        for (const [a, up] of [[0, 1.2], [1.1, 0.75], [2.2, 0.7], [3.3, 0.8], [4.4, 0.72], [5.5, 0.78], [0.55, 0.35], [2.75, 0.4], [4.9, 0.35]]) {
            const s = new THREE.Mesh(spotGeometry, spot);
            const sz = radius * 0.13;
            s.scale.set(sz, sz * 0.5, sz);
            // a point on the cap's dome
            const tilt = Math.min(up, Math.PI / 2) * 0.9;
            const ring = Math.cos(Math.PI / 2 - tilt);
            s.position.set(Math.cos(a) * radius * ring, 0.7 + radius * 0.6 * Math.sin(Math.PI / 2 - tilt), Math.sin(a) * radius * ring);
            group.add(s);
        }
        group.position.copy(position);
        group.position.y = 0;
        this.root.add(group);
        return group;
    }

    // The mushroom cap ride's acid gap: dark earthy sides go down ACID_DEPTH
    // to a pool of bright, glowing green acid, bubbling now and then
    createAcidPit(p) {
        const g = p.gap;
        const depth = p.acidDepth ?? ACID_DEPTH;
        const cx = (g.minX + g.maxX) / 2;
        const cz = (g.minZ + g.maxZ) / 2;
        const sizeX = g.maxX - g.minX;
        const sizeZ = g.maxZ - g.minZ;
        const earth = new THREE.MeshStandardMaterial({ color: 0x3a2a3a, roughness: 1, side: THREE.DoubleSide });
        for (const [w, d, x, z] of [
            [sizeX, 0.05, cx, g.minZ], [sizeX, 0.05, cx, g.maxZ],
            [0.05, sizeZ, g.minX, cz], [0.05, sizeZ, g.maxX, cz],
        ]) {
            const wall = new THREE.Mesh(new THREE.BoxGeometry(w, depth, d), earth);
            wall.position.set(x, -0.2 - depth / 2, z);
            this.root.add(wall);
        }
        const map = acidTexture();
        map.repeat.set(sizeX / 3, sizeZ / 3);
        const acid = new THREE.Mesh(new THREE.PlaneGeometry(sizeX, sizeZ), new THREE.MeshBasicMaterial({ map }));
        acid.rotation.x = -Math.PI / 2;
        acid.position.set(cx, -depth, cz);
        this.root.add(acid);
        p.acidMap = map;
        // A green glow rising off the acid, seen from above
        const haze = new THREE.Mesh(new THREE.PlaneGeometry(sizeX, sizeZ), new THREE.MeshBasicMaterial({ color: 0x7dff5a, transparent: true, opacity: 0.18, depthWrite: false }));
        haze.rotation.x = -Math.PI / 2;
        haze.position.set(cx, -depth * 0.45, cz);
        this.root.add(haze);
        // Bubbles that swell and pop
        let r = 71;
        const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
        const bubble = new THREE.MeshBasicMaterial({ color: 0xc8ff8a });
        p.acidBubbles = [];
        for (let k = 0; k < 8; k++) {
            const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), bubble);
            mesh.position.set(g.minX + random() * sizeX, -depth, g.minZ + random() * sizeZ);
            this.root.add(mesh);
            p.acidBubbles.push({ mesh, time: random() * 3, every: 1.5 + random() * 2 });
        }
        // A lime glow along each edge, so the gap shows from far off
        const edge = new THREE.MeshBasicMaterial({ color: 0x9dff6a });
        const width = p.alongX ? sizeZ : sizeX;
        for (const end of [0, p.span]) {
            const strip = new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, 0.1), edge);
            if (p.alongX) {
                strip.rotation.y = Math.PI / 2;
                strip.position.set(g.minX + end + (end ? 0.05 : -0.05), 0.01, cz);
            } else {
                strip.position.set(cx, 0.01, g.minZ + end + (end ? 0.05 : -0.05));
            }
            this.root.add(strip);
        }
    }

    // The mushroom cap ride: a big round orange-brown cap (CAP_RADIUS),
    // its top level with the floor, with cream gills underneath and its thick
    // stem in the middle reaching straight down into the acid. A glowing
    // yellow ring round the middle (over the stem, CAP_RING) shows where to
    // stand to make it go.
    createMushroomCap(p) {
        const group = new THREE.Group();
        const top = new THREE.Mesh(new THREE.CylinderGeometry(CAP_RADIUS, CAP_RADIUS * 0.96, 0.2, 48), new THREE.MeshStandardMaterial({ color: 0xc8742c, roughness: 0.7, emissive: 0x3a1a06, emissiveIntensity: 0.5 }));
        top.position.y = -0.06; // its top just over the floor, so it sits over the edge strip
        top.receiveShadow = true;
        group.add(top);
        // A paler rim, so the cap's round edge shows against the acid
        const rim = new THREE.Mesh(new THREE.TorusGeometry(CAP_RADIUS - 0.04, 0.06, 8, 64), new THREE.MeshStandardMaterial({ color: 0xf0b070, roughness: 0.6 }));
        rim.rotation.x = Math.PI / 2;
        rim.position.y = 0.02;
        group.add(rim);
        // Light speckles on top
        const speck = new THREE.MeshStandardMaterial({ color: 0xf6d6a0, roughness: 0.7 });
        for (let k = 0; k < 9; k++) {
            const a = k * 2.4;
            const d = 0.7 + (k % 3) * 0.13;
            const s = new THREE.Mesh(new THREE.CircleGeometry(0.08 + (k % 2) * 0.04, 10), speck);
            s.rotation.x = -Math.PI / 2;
            s.position.set(Math.cos(a) * d, 0.045, Math.sin(a) * d);
            group.add(s);
        }
        // The gills: a shallow cream dome under the cap
        const gills = new THREE.Mesh(new THREE.SphereGeometry(CAP_RADIUS * 0.96, 32, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xe8d8b0, roughness: 0.9 }));
        gills.scale.y = 0.3;
        gills.position.y = -0.18;
        group.add(gills);
        // The stem, straight down into the acid
        const stemLength = ACID_DEPTH + 0.6;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, stemLength, 16), new THREE.MeshStandardMaterial({ color: 0xf2e6c8, roughness: 0.8 }));
        stem.position.y = -0.2 - stemLength / 2;
        group.add(stem);
        // The glowing yellow ring round the stem, and a soft glow inside it
        const ring = new THREE.Mesh(new THREE.TorusGeometry(CAP_RING, 0.045, 8, 48), new THREE.MeshBasicMaterial({ color: 0xffe040, transparent: true }));
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.06;
        group.add(ring);
        const inside = new THREE.Mesh(new THREE.CircleGeometry(CAP_RING, 32), new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0.3, depthWrite: false }));
        inside.rotation.x = -Math.PI / 2;
        inside.position.y = 0.05;
        group.add(inside);
        this.root.add(group);
        p.object = group;
        p.capRing = ring;
    }

    // A point on the trench's middle line (world x, z), `along` from its low end
    trenchPoint(p, along) {
        const g = p.gap;
        return p.alongX ? { x: g.minX + along, z: (g.minZ + g.maxZ) / 2 } : { x: (g.minX + g.maxX) / 2, z: g.minZ + along };
    }

    // The trench bounce's two giant bouncy mushrooms: a thick cream stem
    // from the acid up to a big round purple cap (TRENCH_CAP_RADIUS) with
    // glowing pink spots and a glowing rim, so it shows from the edge above
    createTrenchMushrooms(p) {
        const depth = p.acidDepth ?? ACID_DEPTH;
        const stemMaterial = new THREE.MeshStandardMaterial({ color: 0xf2e6c8, roughness: 0.8 });
        const capMaterial = new THREE.MeshStandardMaterial({ color: 0x9a4fe0, roughness: 0.5, emissive: 0x3a1066, emissiveIntensity: 0.7 });
        const rimMaterial = new THREE.MeshBasicMaterial({ color: 0xff9ae8 });
        const spotMaterial = new THREE.MeshBasicMaterial({ color: 0xffd0f4 });
        const gillMaterial = new THREE.MeshStandardMaterial({ color: 0xe8d8b0, roughness: 0.9 });
        for (const c of p.trenchCaps) {
            const at = this.trenchPoint(p, c.along);
            const group = new THREE.Group();
            group.position.set(at.x, c.top, at.z);
            const stemLength = depth + c.top + 0.2;
            const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.36, stemLength, 16), stemMaterial);
            stem.position.y = -0.2 - stemLength / 2;
            group.add(stem);
            // The cap: a squashed dome whose top is the bounce spot; it squishes when you land
            const cap = new THREE.Group();
            const dome = new THREE.Mesh(new THREE.SphereGeometry(TRENCH_CAP_RADIUS, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), capMaterial);
            dome.scale.y = 0.35;
            dome.position.y = -0.26;
            cap.add(dome);
            const gills = new THREE.Mesh(new THREE.CircleGeometry(TRENCH_CAP_RADIUS, 32), gillMaterial);
            gills.rotation.x = Math.PI / 2;
            gills.position.y = -0.26;
            cap.add(gills);
            const rim = new THREE.Mesh(new THREE.TorusGeometry(TRENCH_CAP_RADIUS - 0.03, 0.04, 8, 48), rimMaterial);
            rim.rotation.x = Math.PI / 2;
            rim.position.y = -0.25;
            cap.add(rim);
            for (let k = 0; k < 7; k++) {
                const a = k * 0.9 + 0.3;
                const d = k === 0 ? 0 : 0.42;
                const spot = new THREE.Mesh(new THREE.CircleGeometry(0.08, 10), spotMaterial);
                spot.rotation.x = -Math.PI / 2;
                spot.position.set(Math.cos(a) * d, k === 0 ? 0.005 : -0.06, Math.sin(a) * d);
                cap.add(spot);
            }
            group.add(cap);
            this.root.add(group);
            c.object = cap;
        }
    }

    // Run one trench bounce (called every game step after the player has
    // moved; `free` = nothing else is moving the player). Walking off an edge
    // (your middle over the trench) with your middle over the middle half of
    // the corridor's width drops you onto the nearer mushroom's cap, which
    // bounces you onto the other cap, which bounces you onto the floor past
    // the far edge. You can't steer or fall meanwhile. Walking off nearer a
    // wall, nothing catches you (fallsIntoGap: into the acid). Returns
    // 'drop', 'bounce' (on each cap) or 'land'; while it carries you,
    // p.rideAt is where you are ({ x, z, y }: y how far your feet are above
    // the floor, below it in the trench).
    updateTrench(p, dt, position, free) {
        let event = null;
        if (!p.ride && free) {
            const { along, across, width } = this.gapCoords(position, p);
            if (along >= 0 && along < p.span && across >= 0 && across < width && Math.abs(across - width / 2) <= (width * TRENCH_AIM) / 2) {
                const fromLow = along < p.span / 2;
                const [first, second] = fromLow ? p.trenchCaps : [...p.trenchCaps].reverse();
                const spot = (c) => ({ ...this.trenchPoint(p, c.along), y: c.top });
                const land = { ...this.trenchPoint(p, fromLow ? p.span + TRENCH_LANDING : -TRENCH_LANDING), y: 0 };
                p.ride = {
                    leg: 0,
                    time: 0,
                    legs: [
                        { from: { x: position.x, z: position.z, y: 0 }, to: spot(first), length: TRENCH_DROP_TIME, fall: true, onto: first },
                        { from: spot(first), to: spot(second), length: TRENCH_BOUNCE_1, hop: TRENCH_HOP_1, onto: second },
                        { from: spot(second), to: land, length: TRENCH_BOUNCE_2, hop: TRENCH_HOP_2 },
                    ],
                    dir: fromLow ? 1 : -1,
                };
                p.riding = true;
                event = 'drop';
            }
        }
        if (p.ride) {
            const r = p.ride;
            r.time += dt;
            while (p.ride && r.time >= r.legs[r.leg].length) {
                const leg = r.legs[r.leg];
                r.time -= leg.length;
                if (leg.onto) {
                    leg.onto.squish = 1;
                    event = 'bounce';
                }
                r.leg++;
                if (r.leg >= r.legs.length) {
                    p.rideAt = { ...leg.to };
                    p.ride = null;
                    p.riding = false;
                    event = 'land';
                }
            }
            if (p.ride) {
                const leg = r.legs[r.leg];
                const t = r.time / leg.length;
                const y = leg.fall ? leg.from.y + (leg.to.y - leg.from.y) * t * t : leg.from.y + (leg.to.y - leg.from.y) * t + leg.hop * 4 * t * (1 - t);
                p.rideAt = { x: leg.from.x + (leg.to.x - leg.from.x) * t, z: leg.from.z + (leg.to.z - leg.from.z) * t, y };
            }
        }
        // A cap squishes down when you land on it and springs back
        for (const c of p.trenchCaps) {
            c.squish = Math.max(0, c.squish - dt * 3);
            if (c.object) {
                const s = c.squish;
                c.object.scale.set(1 + 0.15 * s, 1 - 0.45 * s, 1 + 0.15 * s);
            }
        }
        return event;
    }

    // The middle of a mushroom cap (world x, z), where its stem is
    capCentre(p) {
        const g = p.gap;
        const middle = p.at + PLATFORM_LENGTH / 2;
        return p.alongX ? { x: g.minX + middle, z: (g.minZ + g.maxZ) / 2 } : { x: (g.minX + g.maxX) / 2, z: g.minZ + middle };
    }

    // Run one mushroom cap ride. It waits at an edge, reaching a little over
    // it. It sets off only once your middle is inside the yellow ring round
    // its stem (anywhere else on it, it just waits, and you can walk off its
    // edge into the acid). After PLATFORM_WAIT it carries you to the other
    // edge at Level 17's platform speed, and you can't leave it or fall off
    // while it moves; there it sets you down on the floor past the edge
    // ('land': main.js walks you out to this.landing). Empty, it floats over
    // to whichever edge you come to. Returns 'depart' or 'land'.
    updateCap(p, dt, position, velocity, radius) {
        const { along, across, width } = this.gapCoords(position, p);
        const inRange = across >= 0 && across < width;
        let centre = this.capCentre(p);
        const distance = Math.hypot(position.x - centre.x, position.z - centre.z);
        const touching = distance < CAP_RADIUS + radius;
        let event = null;
        if (p.mustLeave && !touching) p.mustLeave = false;
        if (!p.riding && p.at === p.target && distance <= CAP_RING && !p.mustLeave) {
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
                    // Set down on the floor just past the edge it came to
                    const g = p.gap;
                    const out = p.at === p.high ? p.span + CAP_LANDING : -CAP_LANDING;
                    this.landing = p.alongX ? new THREE.Vector3(g.minX + out, 0, (g.minZ + g.maxZ) / 2) : new THREE.Vector3((g.minX + g.maxX) / 2, 0, g.minZ + out);
                    event = 'land';
                }
            }
            // Keep you on the cap while it's carrying you (or about to)
            centre = this.capCentre(p);
            const dx = position.x - centre.x;
            const dz = position.z - centre.z;
            const d = Math.hypot(dx, dz);
            const reach = CAP_RADIUS - radius;
            if ((p.riding || event === 'land') && d > reach) {
                position.x = centre.x + (dx / d) * reach;
                position.z = centre.z + (dz / d) * reach;
                velocity.x = 0;
                velocity.z = 0;
            }
        } else if (!touching && p.at === p.target && inRange) {
            // Empty: float over to whichever edge you come to
            if (p.at !== p.low && along < 0 && along > -PLATFORM_CALL_DISTANCE) p.target = p.low;
            if (p.at !== p.high && along > p.span && along < p.span + PLATFORM_CALL_DISTANCE) p.target = p.high;
        } else if (!p.riding && p.at !== p.target) {
            p.at = p.target > p.at ? Math.min(p.target, p.at + p.speed * dt) : Math.max(p.target, p.at - p.speed * dt);
        }
        this.showPlatform(p);
        return event;
    }

    addPirateSky() {
        const cx = this.width / 2;
        const cz = this.depth / 2;
        const sun = new THREE.Mesh(new THREE.SphereGeometry(14, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff3b0, fog: false }));
        sun.position.set(cx + 120, 110, cz - 180);
        this.root.add(sun);
        // The sea, out to the horizon (and under the ship, seen through every water gap)
        const map = seaTexture(256, 211);
        map.repeat.set(160, 160);
        const sea = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshStandardMaterial({ map, roughness: 0.35, metalness: 0.1, emissive: 0x0a3050, emissiveIntensity: 0.6 }));
        sea.rotation.x = -Math.PI / 2;
        sea.position.set(cx, SEA_LEVEL, cz);
        this.root.add(sea);
        this.seaMap = map;
        // The hull: dark wooden sides from the deck's edge down into the sea,
        // a little wider than the maze, with a pointed bow at the east end
        const hullMap = deckTexture(256, 223);
        hullMap.repeat.set(6, 1.5);
        const hull = new THREE.MeshStandardMaterial({ map: hullMap, color: 0x8a5a30, roughness: 0.9 });
        const drop = -SEA_LEVEL + 2;
        for (const [w, d, x, z] of [
            [this.width + 1, 0.5, cx, -0.25], [this.width + 1, 0.5, cx, this.depth + 0.25],
            [0.5, this.depth + 1, -0.25, cz], [0.5, this.depth + 1, this.width + 0.25, cz],
        ]) {
            const side = new THREE.Mesh(new THREE.BoxGeometry(w, drop, d), hull);
            side.position.set(x, -0.2 - drop / 2 + 0.2, z);
            this.root.add(side);
        }
        // (a flat wedge: its shape's (x, y) is the world's (x, z), extruded down to the sea)
        const bowShape = new THREE.Shape([new THREE.Vector2(this.width + 0.5, -0.5), new THREE.Vector2(this.width + 16, cz), new THREE.Vector2(this.width + 0.5, this.depth + 0.5)]);
        const bowGeometry = new THREE.ExtrudeGeometry(bowShape, { depth: drop, bevelEnabled: false });
        bowGeometry.rotateX(Math.PI / 2);
        const bow = new THREE.Mesh(bowGeometry, hull);
        bow.position.y = -0.25;
        this.root.add(bow);
        // Masts with sails, each standing in a wall block along the middle of the ship
        const wood = new THREE.MeshStandardMaterial({ color: 0x7a4c24, roughness: 0.85 });
        const canvas = new THREE.MeshStandardMaterial({ color: 0xf4ead2, roughness: 0.95, side: THREE.DoubleSide, emissive: 0x403828, emissiveIntensity: 0.3 });
        const flag = new THREE.MeshBasicMaterial({ color: 0xd93a3a, side: THREE.DoubleSide });
        for (const f of [0.22, 0.5, 0.78]) {
            const spot = this.nearestWallBlock(this.width * f, cz);
            if (!spot) continue;
            const mast = new THREE.Group();
            const height = f === 0.5 ? 30 : 25;
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, height, 12), wood);
            pole.position.y = height / 2;
            mast.add(pole);
            for (const [y, w, h] of [[height * 0.42, 14, 7], [height * 0.72, 11, 5.5]]) {
                const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, w + 1, 8), wood);
                yard.rotation.x = Math.PI / 2;
                yard.position.y = y + h / 2;
                mast.add(yard);
                // The sail billows out a little in the wind
                const geometry = new THREE.PlaneGeometry(w, h, 12, 6);
                const pos = geometry.attributes.position;
                for (let k = 0; k < pos.count; k++) {
                    const u = pos.getX(k) / w;
                    const v = pos.getY(k) / h;
                    pos.setZ(k, 1.4 * Math.cos(u * Math.PI) * (0.6 + 0.4 * Math.cos(v * Math.PI)));
                }
                geometry.computeVertexNormals();
                const sail = new THREE.Mesh(geometry, canvas);
                sail.rotation.y = Math.PI / 2;
                sail.position.set(0.6, y, 0);
                mast.add(sail);
            }
            const nest = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.9, 0.9, 14, 1, true), wood);
            nest.material = wood.clone();
            nest.material.side = THREE.DoubleSide;
            nest.position.y = height * 0.9;
            mast.add(nest);
            const pennant = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(3, -0.5), new THREE.Vector2(0, -1)])), flag);
            pennant.position.set(0, height + 0.8, 0);
            mast.add(pennant);
            mast.traverse((o) => { o.castShadow = false; });
            mast.position.set(spot.x + 0.5, 0, spot.z + 0.5);
            this.root.add(mast);
        }
        this.flyers = [];
        for (let k = 0; k < 7; k++) {
            const flyer = this.makeFlyer('gull');
            this.root.add(flyer.object);
            this.flyers.push(flyer);
            this.launchFlyer(flyer, k / 7);
        }
    }

    // The wall block nearest a point (x, z), if any
    nearestWallBlock(x, z) {
        let best = null;
        for (let i = 0; i < this.width; i++) {
            for (let j = 0; j < this.depth; j++) {
                if (this.grid[i][j] !== 1) continue;
                const d = Math.hypot(i + 0.5 - x, j + 0.5 - z);
                if (!best || d < best.d) best = { x: i, z: j, d };
            }
        }
        return best;
    }

    // A seagull gliding along +x: a white body, gray-topped wings that flap
    // slowly, a yellow beak
    makeGull(group, basic) {
        const white = basic(0xffffff);
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.7, 14, 10), white);
        body.scale.set(1.6, 0.6, 0.6);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), white);
        head.position.set(1.2, 0.25, 0);
        const beak = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 8), basic(0xffc93c));
        beak.rotation.z = -Math.PI / 2;
        beak.position.set(1.8, 0.2, 0);
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.5), basic(0xdadde2));
        tail.position.set(-1.2, 0.05, 0);
        group.add(body, head, beak, tail);
        for (const side of [-1, 1]) {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), basic(0x222222));
            eye.position.set(1.45, 0.38, side * 0.28);
            group.add(eye);
        }
        const wings = [];
        for (const side of [-1, 1]) {
            const pivot = new THREE.Group();
            const shape = new THREE.Shape([new THREE.Vector2(0.5, 0), new THREE.Vector2(-0.6, 0), new THREE.Vector2(-1.1, 3.4), new THREE.Vector2(-0.4, 3.6)]);
            const wing = new THREE.Mesh(new THREE.ShapeGeometry(shape), basic(0xc9ced6, { side: THREE.DoubleSide }));
            wing.rotation.x = side * Math.PI / 2;
            pivot.add(wing);
            pivot.userData.side = side;
            group.add(pivot);
            wings.push(pivot);
        }
        return wings;
    }

    // Pirate Ship World's spike: broken deck planks with pointy splinters
    // sticking up, as wide as a spike's plate. Touching them works the same
    // as a spike.
    createSplinterSpike(position, radius) {
        const spike = new THREE.Group();
        const wood = new THREE.MeshStandardMaterial({ color: 0x9a6634, roughness: 0.8, emissive: 0x2a1606, emissiveIntensity: 0.35 });
        const raw = new THREE.MeshStandardMaterial({ color: 0xe8c48a, roughness: 0.7 });
        // The broken board they stick out of
        const board = new THREE.Mesh(new THREE.CylinderGeometry(SPIKE_RADIUS, SPIKE_RADIUS * 1.05, 0.1, 7), new THREE.MeshStandardMaterial({ color: 0x6e4420, roughness: 0.9, flatShading: true }));
        board.position.y = 0.05;
        spike.add(board);
        for (const [x, z, h, w, lean, turn] of [[0, 0, 1.2, 0.22, 0.05, 0.3], [0.36, 0.14, 0.85, 0.18, 0.4, 1.2], [-0.32, 0.24, 0.95, 0.2, -0.35, -0.6], [-0.08, -0.4, 0.8, 0.16, 0.32, 2.1], [0.24, -0.3, 0.7, 0.15, -0.38, 0.9], [-0.42, -0.12, 0.6, 0.13, -0.45, 2.6]]) {
            const piece = new THREE.Group();
            const shaft = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.07), wood);
            shaft.position.y = h / 2;
            shaft.castShadow = true;
            // A jagged, pale, freshly broken point
            const point = new THREE.Mesh(new THREE.ConeGeometry(w * 0.6, 0.32, 4), raw);
            point.scale.z = 0.35;
            point.position.y = h + 0.14;
            piece.add(shaft, point);
            // and a little side splinter
            const sliver = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.3, 4), raw);
            sliver.position.set(w * 0.4, h * 0.6, 0);
            sliver.rotation.z = -0.6;
            piece.add(sliver);
            piece.position.set(x, 0.08, z);
            piece.rotation.set(lean * 0.6, turn, lean);
            spike.add(piece);
        }
        spike.scale.set(radius / SPIKE_RADIUS, 1, radius / SPIKE_RADIUS);
        spike.position.copy(position);
        spike.position.y = 0;
        this.root.add(spike);
        return spike;
    }

    // A water gap's hole in the deck (Level 121 on): dark wooden sides go
    // straight down to the sea far below (the sea itself is addPirateSky's)
    createSeaHole(p) {
        const g = p.gap;
        const cx = (g.minX + g.maxX) / 2;
        const cz = (g.minZ + g.maxZ) / 2;
        const sizeX = g.maxX - g.minX;
        const sizeZ = g.maxZ - g.minZ;
        const depth = -SEA_LEVEL + 1;
        for (const [w, d, x, z, along] of [
            [sizeX, 0.05, cx, g.minZ, sizeX], [sizeX, 0.05, cx, g.maxZ, sizeX],
            [0.05, sizeZ, g.minX, cz, sizeZ], [0.05, sizeZ, g.maxX, cz, sizeZ],
        ]) {
            const map = deckTexture(256, 233);
            map.repeat.set(along / 6, depth / 6);
            map.center.set(0.5, 0.5);
            map.rotation = Math.PI / 2;
            const wall = new THREE.Mesh(new THREE.BoxGeometry(w, depth, d), new THREE.MeshStandardMaterial({ map, color: 0x9a7050, roughness: 1, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: 0.25 }));
            wall.position.set(x, -0.2 - depth / 2, z);
            this.root.add(wall);
        }
        // A painted white line round the hole's edge, so it shows from far off
        const trim = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.6 });
        const width = p.alongX ? sizeZ : sizeX;
        for (const end of [0, p.span]) {
            const strip = new THREE.Mesh(new THREE.BoxGeometry(width, 0.04, 0.16), trim);
            if (p.alongX) {
                strip.rotation.y = Math.PI / 2;
                strip.position.set(g.minX + end + (end ? 0.08 : -0.08), 0.02, cz);
            } else {
                strip.position.set(cx, 0.02, g.minZ + end + (end ? 0.08 : -0.08));
            }
            this.root.add(strip);
        }
    }

    // Walk the plank (Level 122 on): one long wooden board straight across the
    // water gap down the middle of the corridor, p.plank of its width, its
    // ends resting on the deck. Darker edges and a row of nails at each end,
    // and two thin beams under it, so it reads as a plank from far off.
    createPlank(p) {
        const g = p.gap;
        const width = (p.alongX ? g.maxZ - g.minZ : g.maxX - g.minX) * p.plank;
        const length = p.span + 0.8;
        const group = new THREE.Group();
        const map = deckTexture(256, 977);
        map.wrapS = map.wrapT = THREE.RepeatWrapping;
        map.repeat.set(0.18, length / 6);
        const board = new THREE.Mesh(new THREE.BoxGeometry(width, 0.14, length), new THREE.MeshStandardMaterial({ map, color: 0xd09a62, roughness: 0.9 }));
        board.position.y = -0.045;
        board.castShadow = board.receiveShadow = true;
        group.add(board);
        const dark = new THREE.MeshStandardMaterial({ color: 0x5a3519, roughness: 1 });
        for (const side of [-1, 1]) {
            const edge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, length), dark);
            edge.position.set(side * (width / 2 - 0.03), -0.04, 0);
            group.add(edge);
            const beam = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, length - 0.2), dark);
            beam.position.set(side * width * 0.3, -0.21, 0);
            group.add(beam);
        }
        const nail = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.8, roughness: 0.35 });
        for (const end of [-1, 1]) {
            for (let k = 0; k < 3; k++) {
                const head = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 10), nail);
                head.position.set((k - 1) * width * 0.3, 0.035, end * (length / 2 - 0.2));
                group.add(head);
            }
        }
        const cx = (g.minX + g.maxX) / 2;
        const cz = (g.minZ + g.maxZ) / 2;
        group.position.set(cx, 0, cz);
        if (p.alongX) group.rotation.y = Math.PI / 2;
        this.root.add(group);
        p.object = null; // (nothing to move)
        p.plankObject = group;
    }

    // Where a fall into the water starts (Pirate Ship World): beside a plank,
    // a little further out from it, so you see the plank go by as you fall
    // and never fall through it
    waterFallSpot(point) {
        const p = this.gapAt(point);
        if (!p?.plank) return { x: point.x, z: point.z };
        const { across, width } = this.gapCoords(point, p);
        const half = (width * p.plank) / 2;
        const side = across < width / 2 ? -1 : 1;
        const out = Math.min(width / 2 - 0.3, Math.max(Math.abs(across - width / 2), half + 0.4));
        const at = width / 2 + side * out;
        return p.alongX ? { x: point.x, z: p.gap.minZ + at } : { x: p.gap.minX + at, z: point.z };
    }

    // The two big cannons, one on each side of the gap at its edge, aimed
    // across it: a wide iron barrel (big enough to climb right into, open at
    // the back like a circus cannon) on a wooden carriage with big wheels, a
    // brass ring at the mouth, a fuse on top that sparks while it fizzes,
    // and puffs of smoke when it fires
    createCannons(p) {
        const iron = new THREE.MeshStandardMaterial({ color: 0x3b3d44, metalness: 0.6, roughness: 0.4, emissive: 0x16171c, emissiveIntensity: 0.6, side: THREE.DoubleSide });
        const brass = new THREE.MeshStandardMaterial({ color: 0xd4a640, metalness: 0.7, roughness: 0.35 });
        const wood = new THREE.MeshStandardMaterial({ color: 0x7a4c24, roughness: 0.85 });
        const smokeMaterial = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 1, transparent: true, opacity: 0.8, depthWrite: false });
        for (const c of p.cannons) {
            const group = new THREE.Group();
            // Everything is built aimed along -z (the mouth toward -z), then turned to face the gap
            const barrel = new THREE.Group();
            const tube = new THREE.Mesh(new THREE.CylinderGeometry(CANNON_RADIUS, CANNON_RADIUS * 0.94, CANNON_LENGTH, 32, 1, true), iron);
            tube.rotation.x = Math.PI / 2;
            barrel.add(tube);
            for (const [z, r, color] of [[-CANNON_LENGTH / 2, 0.16, brass], [CANNON_LENGTH / 2, 0.12, iron], [-CANNON_LENGTH * 0.15, 0.08, iron], [CANNON_LENGTH * 0.2, 0.08, iron]]) {
                const ring = new THREE.Mesh(new THREE.TorusGeometry(CANNON_RADIUS + 0.04, r, 10, 36), color);
                ring.position.z = z;
                barrel.add(ring);
            }
            // The fuse on top near the back, and its spark
            const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), new THREE.MeshStandardMaterial({ color: 0x3a2a1a }));
            fuse.position.set(0, CANNON_RADIUS + 0.25, CANNON_LENGTH * 0.3);
            fuse.rotation.x = -0.4;
            const spark = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd040 }));
            spark.position.set(0, CANNON_RADIUS + 0.5, CANNON_LENGTH * 0.3 + 0.1);
            spark.visible = false;
            barrel.add(fuse, spark);
            barrel.position.y = CANNON_RADIUS + 0.12;
            barrel.rotation.x = 0.12; // the mouth tipped up a little
            group.add(barrel);
            // The carriage: two wooden sides with big wheels
            for (const side of [-1, 1]) {
                const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, CANNON_LENGTH * 0.8), wood);
                cheek.position.set(side * (CANNON_RADIUS + 0.12), 0.45, 0.1);
                group.add(cheek);
                for (const z of [-CANNON_LENGTH * 0.28, CANNON_LENGTH * 0.32]) {
                    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.14, 16), wood);
                    wheel.rotation.z = Math.PI / 2;
                    wheel.position.set(side * (CANNON_RADIUS + 0.22), 0.45, z);
                    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.18, 10), brass);
                    hub.rotation.z = Math.PI / 2;
                    hub.position.copy(wheel.position);
                    group.add(wheel, hub);
                }
            }
            // Smoke puffs at the mouth (hidden until it fires)
            const smoke = [];
            for (let k = 0; k < 7; k++) {
                const puff = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 10), smokeMaterial.clone());
                puff.visible = false;
                puff.userData.offset = new THREE.Vector3((Math.random() - 0.5) * 1.6, CANNON_RADIUS + (Math.random() - 0.2) * 1.2, -CANNON_LENGTH / 2 - 0.3 - Math.random() * 1.4);
                group.add(puff);
                smoke.push(puff);
            }
            group.traverse((o) => { if (o.isMesh) o.castShadow = o.material !== smokeMaterial; });
            group.position.copy(c.center);
            // Turn it so its mouth (-z) points across the gap
            group.rotation.y = Math.atan2(-c.aim.x, -c.aim.z);
            this.root.add(group);
            Object.assign(c, { object: group, barrel, spark, smoke });
        }
    }

    // Run the cannons (called every game step). Fully inside a cannon its
    // fuse fizzes (and you can't walk on out of its mouth); step back out
    // before it fires and nothing happens; after
    // CANNON_FUSE it fires (main.js sends you over the gap to c.landing, the
    // other cannon, which won't fire again till you've stepped out of it).
    // Returns a list of { cannon, event }: 'load' (the fuse starts), 'cancel'
    // or 'fire'. flying: a cannon has you in the air.
    updateCannons(dt, position, flying = false) {
        const events = [];
        // (Nothing changes while a cannon has you in the air)
        if (flying) return events;
        for (const p of this.platforms) {
            if (!p.cannon) continue;
            for (const c of p.cannons) {
                // While its fuse fizzes you can't walk on out of its mouth
                // into the water (only back out the way you came)
                if (c.phase === 'fuse') {
                    const ahead = (position.x - c.center.x) * c.aim.x + (position.z - c.center.z) * c.aim.z;
                    const side = Math.abs((position.x - c.center.x) * c.aim.z - (position.z - c.center.z) * c.aim.x);
                    const most = CANNON_INSIDE - 0.02;
                    if (ahead > most && ahead < most + 1 && side <= CANNON_INSIDE) {
                        position.x -= c.aim.x * (ahead - most);
                        position.z -= c.aim.z * (ahead - most);
                    }
                }
                const inside = Math.abs(position.x - c.center.x) <= CANNON_INSIDE && Math.abs(position.z - c.center.z) <= CANNON_INSIDE;
                if (c.mustLeave) {
                    if (!inside) c.mustLeave = false;
                } else if (c.phase === 'empty') {
                    if (inside) {
                        Object.assign(c, { phase: 'fuse', time: 0 });
                        events.push({ cannon: c, event: 'load' });
                    }
                } else if (c.phase === 'fuse') {
                    if (!inside) {
                        Object.assign(c, { phase: 'empty', time: 0 });
                        events.push({ cannon: c, event: 'cancel' });
                    } else {
                        c.time += dt;
                        if (c.time >= CANNON_FUSE) {
                            Object.assign(c, { phase: 'empty', time: 0, smoke: 1, recoil: 1 });
                            c.other.mustLeave = true;
                            events.push({ cannon: c, event: 'fire' });
                            return events; // (you're off: leave the other cannon waiting for you)
                        }
                    }
                }
            }
        }
        return events;
    }

    // The cannons' looks (every frame): the fuse's flickering spark, the
    // barrel kicking back when it fires, and its smoke puffing out and fading
    showCannons(dt) {
        for (const p of this.platforms) {
            if (!p.cannon) continue;
            for (const c of p.cannons) {
                if (!c.object) continue;
                c.spark.visible = c.phase === 'fuse';
                if (c.spark.visible) c.spark.scale.setScalar(0.7 + Math.random() * 0.7);
                c.recoil = Math.max(0, (c.recoil ?? 0) - dt * 2.5);
                c.barrel.position.z = 0.35 * Math.sin(c.recoil * Math.PI / 2);
                c.smoke = Math.max(0, (c.smoke ?? 0) - dt / 1.4);
                const t = 1 - c.smoke;
                for (const puff of c.smoke ? c.object.children.filter((o) => o.userData.offset) : []) {
                    puff.visible = c.smoke > 0;
                    puff.position.copy(puff.userData.offset).multiplyScalar(1 + t * 1.5);
                    puff.position.y = puff.userData.offset.y + t * 1.5;
                    puff.scale.setScalar(0.5 + t * 2);
                    puff.material.opacity = 0.85 * c.smoke;
                }
                if (!c.smoke) for (const puff of c.object.children) if (puff.userData.offset) puff.visible = false;
            }
        }
    }

    // A big splash in the sea where you fell in (Level 121 on): white spray
    // shooting up and falling back, and a foamy ring spreading out
    splashAt(x, z) {
        const group = new THREE.Group();
        const white = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
        const drops = [];
        for (let k = 0; k < 70; k++) {
            const drop = new THREE.Mesh(new THREE.SphereGeometry(0.1 + Math.random() * 0.2, 6, 5), white);
            const a = Math.random() * Math.PI * 2;
            const out = 0.8 + Math.random() * 3;
            drops.push({ mesh: drop, velocity: new THREE.Vector3(Math.cos(a) * out, 3 + Math.random() * 4, Math.sin(a) * out) });
            group.add(drop);
        }
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 1, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
        ring.rotation.x = -Math.PI / 2;
        group.add(ring);
        group.position.set(x, SEA_LEVEL + 0.05, z);
        this.root.add(group);
        this.splashes = (this.splashes ?? []).concat([{ group, drops, ring, time: 0 }]);
    }

    // Move the splashes along (every frame); each one goes away after a while
    updateSplashes(dt) {
        if (!this.splashes?.length) return;
        for (const s of this.splashes) {
            s.time += dt;
            for (const d of s.drops) {
                d.velocity.y -= 12 * dt;
                d.mesh.position.addScaledVector(d.velocity, dt);
                d.mesh.visible = d.mesh.position.y > -0.2;
            }
            s.ring.scale.setScalar(1 + s.time * 4);
            s.ring.material.opacity = Math.max(0, 0.8 - s.time * 0.5);
        }
        for (const s of this.splashes.filter((q) => q.time > 2)) this.root.remove(s.group);
        this.splashes = this.splashes.filter((q) => q.time <= 2);
    }

    // ---- Dinosaur World (Level 111 on) ----

    // The sky: a soft sun, rolling green hills with fern trees far away all
    // round, and friendly pterodactyls gliding by high up. Decoration only:
    // nothing up there touches you.
    addDinoSky() {
        const cx = this.width / 2;
        const cz = this.depth / 2;
        const sun = new THREE.Mesh(new THREE.SphereGeometry(14, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff3b0, fog: false }));
        sun.position.set(cx - 90, 110, cz - 200);
        this.root.add(sun);
        const hill = new THREE.MeshStandardMaterial({ color: 0x5f9a3e, roughness: 1, fog: false });
        const trunk = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 1, fog: false });
        const leaves = new THREE.MeshStandardMaterial({ color: 0x3f8a2f, roughness: 1, fog: false });
        let r = 151;
        const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
        for (let k = 0; k < 16; k++) {
            const a = (k / 16) * Math.PI * 2 + random() * 0.2;
            const d = 190 + random() * 60;
            const mound = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), hill);
            mound.scale.set(50 + random() * 40, 14 + random() * 14, 30 + random() * 20);
            mound.position.set(cx + Math.cos(a) * d, -2, cz + Math.sin(a) * d);
            mound.rotation.y = -a;
            this.root.add(mound);
        }
        // Tall fern trees: a trunk with a crown of drooping fronds
        for (let k = 0; k < 22; k++) {
            const a = random() * Math.PI * 2;
            const d = 120 + random() * 50;
            const h = 14 + random() * 10;
            const tree = new THREE.Group();
            const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1, h, 8), trunk);
            stem.position.y = h / 2;
            tree.add(stem);
            for (let f = 0; f < 7; f++) {
                const frond = new THREE.Mesh(new THREE.ConeGeometry(1.4, 9, 5), leaves);
                frond.position.y = h;
                frond.rotation.set(0, (f / 7) * Math.PI * 2, 0);
                frond.rotateX(1.9);
                frond.translateY(-4.5);
                tree.add(frond);
            }
            tree.position.set(cx + Math.cos(a) * d, 0, cz + Math.sin(a) * d);
            this.root.add(tree);
        }
        this.flyers = [];
        for (let k = 0; k < 6; k++) {
            const flyer = this.makeFlyer('ptero');
            this.root.add(flyer.object);
            this.flyers.push(flyer);
            this.launchFlyer(flyer, k / 6);
        }
    }

    // A friendly pterodactyl gliding along +x: a small round body, a head
    // with a long beak and a crest, and big leathery wings that flap slowly
    makePterodactyl(group, basic) {
        const skin = basic(0xd9894a);
        const wingSkin = basic(0xb8643a, { side: THREE.DoubleSide });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 10), skin);
        body.scale.set(1.6, 0.7, 0.7);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), skin);
        head.position.set(1.7, 0.35, 0);
        const beak = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.8, 8), basic(0xf2c27a));
        beak.rotation.z = -Math.PI / 2;
        beak.position.set(2.8, 0.25, 0);
        const crest = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.4, 6), skin);
        crest.rotation.z = Math.PI / 2 + 0.4;
        crest.position.set(1.0, 0.75, 0);
        group.add(body, head, beak, crest);
        for (const side of [-1, 1]) {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), basic(0x222222));
            eye.position.set(2.0, 0.5, side * 0.38);
            group.add(eye);
        }
        const wings = [];
        for (const side of [-1, 1]) {
            const pivot = new THREE.Group();
            const shape = new THREE.Shape([new THREE.Vector2(0.8, 0), new THREE.Vector2(-1.2, 0), new THREE.Vector2(-0.6, 4.6), new THREE.Vector2(0.3, 4.9)]);
            const wing = new THREE.Mesh(new THREE.ShapeGeometry(shape), wingSkin);
            // The shape's y is the wing's span: turn it out along ±z, flat
            wing.rotation.x = side * Math.PI / 2;
            pivot.add(wing);
            pivot.userData.side = side;
            group.add(pivot);
            wings.push(pivot);
        }
        return wings;
    }

    // Dinosaur World's spike: pointy fossil bones (cream-colored, a bit
    // knobbly) sticking up out of a little mound of dirt, as wide as a
    // spike's plate. Touching them works the same as a spike.
    createBoneSpike(position, radius) {
        const spike = new THREE.Group();
        const bone = new THREE.MeshStandardMaterial({ color: 0xf1e6c8, roughness: 0.6, emissive: 0x2a2416, emissiveIntensity: 0.4 });
        const tip = new THREE.MeshStandardMaterial({ color: 0xfffaf0, roughness: 0.4 });
        for (const [x, z, h, lean] of [[0, 0, 1.25, 0], [0.38, 0.12, 0.85, 0.35], [-0.32, 0.26, 0.95, -0.3], [-0.1, -0.4, 0.8, 0.3], [0.22, -0.3, 0.7, -0.35]]) {
            const piece = new THREE.Group();
            const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.12, h, 8), bone);
            shaft.position.y = h / 2;
            shaft.castShadow = true;
            const point = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.14, 8), tip);
            point.position.y = h + 0.06;
            // A knobbly joint at the bottom and a little bump halfway up
            const knob = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), bone);
            knob.scale.set(1.2, 0.7, 1);
            knob.position.y = 0.06;
            const bump = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), bone);
            bump.position.y = h * 0.45;
            piece.add(shaft, point, knob, bump);
            piece.position.set(x, 0, z);
            piece.rotation.set(lean * 0.6, 0, lean);
            spike.add(piece);
        }
        const mound = new THREE.Mesh(new THREE.SphereGeometry(SPIKE_RADIUS, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x7a5634, roughness: 1 }));
        mound.scale.y = 0.16;
        spike.add(mound);
        spike.scale.set(radius / SPIKE_RADIUS, 1, radius / SPIKE_RADIUS);
        spike.position.copy(position);
        spike.position.y = 0;
        this.root.add(spike);
        return spike;
    }

    // The big bone spike (Level 114 on): a thicket of big pointy fossil
    // bones filling a straight wrong way's opening wall to wall, on a dirt
    // mound, tallest in the middle
    createBigBoneSpike(row) {
        const across = row.spansX ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
        for (const [offset, radius, tall] of [[0, 0.66, 1.45], [-1.05, 0.46, 1.1], [1.05, 0.46, 1.2]]) {
            const spike = this.createBoneSpike(row.position.clone().addScaledVector(across, offset), radius);
            spike.scale.y = tall;
            spike.rotation.y = offset * 0.9;
        }
        const mound = new THREE.Mesh(new THREE.BoxGeometry(SPIKE_ROW_WIDTH, 0.12, SPIKE_ROW_DEPTH), new THREE.MeshStandardMaterial({ color: 0x7a5634, roughness: 1 }));
        mound.position.copy(row.position);
        mound.position.y = 0.06;
        if (!row.spansX) mound.rotation.y = Math.PI / 2;
        this.root.add(mound);
    }

    // The big splinter spike (Level 124 on): a pile of big broken deck planks
    // with pointy splinters filling a straight wrong way's opening wall to
    // wall, tallest in the middle, on a heap of broken boards
    // A big storm-cloud spike (Sky World, Level 134 on): three storm clouds
    // side by side across the dead end's opening, the middle one biggest,
    // under one wide dark cloud, their lightning bolts poking down to the floor
    createBigStormCloud(row) {
        const across = row.spansX ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
        for (const [offset, radius, tall] of [[0, 0.66, 1.3], [-1.02, 0.47, 1.15], [1.02, 0.47, 1.2]]) {
            const cloud = this.createStormCloud(row.position.clone().addScaledVector(across, offset), radius);
            cloud.scale.y = tall;
        }
        const dark = new THREE.MeshStandardMaterial({ color: 0x3e4350, roughness: 1, emissive: 0x111318, emissiveIntensity: 0.5 });
        const ball = new THREE.SphereGeometry(1, 14, 10);
        for (const [a, y, b, size] of [[-1.1, 1.95, 0.05, 0.5], [-0.4, 2.05, -0.1, 0.6], [0.4, 2.0, 0.12, 0.58], [1.1, 1.92, -0.05, 0.48], [0, 2.3, 0, 0.45]]) {
            const puff = new THREE.Mesh(ball, dark);
            puff.scale.set(size, size * 0.75, size);
            puff.position.copy(row.position).addScaledVector(across, a);
            puff.position.y = y;
            if (row.spansX) puff.position.z += b; else puff.position.x += b;
            puff.castShadow = true;
            this.root.add(puff);
        }
    }

    createBigSplinterSpike(row) {
        const across = row.spansX ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
        for (const [offset, radius, tall, turn] of [[0, 0.66, 1.5, 0.4], [-1.02, 0.47, 1.15, 1.7], [1.02, 0.47, 1.25, -0.9]]) {
            const spike = this.createSplinterSpike(row.position.clone().addScaledVector(across, offset), radius);
            spike.scale.y = tall;
            spike.rotation.y = turn;
        }
        const heap = new THREE.Mesh(new THREE.BoxGeometry(SPIKE_ROW_WIDTH, 0.12, SPIKE_ROW_DEPTH), new THREE.MeshStandardMaterial({ color: 0x5e3a1c, roughness: 1 }));
        heap.position.copy(row.position);
        heap.position.y = 0.06;
        if (!row.spansX) heap.rotation.y = Math.PI / 2;
        this.root.add(heap);
        // a few loose broken boards lying across the heap
        const board = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.9 });
        for (const [a, b, turn] of [[-0.8, 0.15, 0.5], [0.6, -0.2, -0.4], [0.1, 0.25, 1.3]]) {
            const piece = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.2), board);
            piece.position.copy(row.position).addScaledVector(across, a);
            piece.position.y = 0.15;
            if (row.spansX) piece.position.z += b; else piece.position.x += b;
            piece.rotation.y = turn;
            this.root.add(piece);
        }
    }

    // ---- The rocking ship (Pirate Ship World, Level 124 on) ----

    // Moves the ship's rocking on by dt (the game step, so it stops while
    // paused). Returns 'tip' when a tip starts. rocking.angle is how far the
    // ship leans right now (toward +z when side is 1) and rocking.tip how far
    // through the current tip it is (0 to 1).
    updateRocking(dt) {
        const r = this.rocking;
        if (!r) return null;
        let event = null;
        r.timer -= dt;
        if (r.timer <= 0) {
            if (r.phase === 'calm') {
                r.phase = 'tip';
                r.timer += ROCK_TIP_TIME;
                event = 'tip';
            } else {
                r.phase = 'calm';
                r.timer += ROCK_CALM_TIME;
                r.side = -r.side;
            }
        }
        r.tip = r.phase === 'tip' ? Math.min(1, Math.max(0, 1 - r.timer / ROCK_TIP_TIME)) : 0;
        r.angle = r.phase === 'tip' ? ROCK_ANGLE * Math.sin(Math.PI * r.tip) : 0;
        return event;
    }

    // How far you slide toward the low side this step (along z), as the
    // ship tips: the slide follows the lean, ROCK_SLIDE over the whole tip
    rockSlide(dt) {
        const r = this.rocking;
        if (!r || r.phase !== 'tip') return 0;
        // speed follows sin(pi t), whose average over the tip is 2/pi
        const speed = (ROCK_SLIDE / ROCK_TIP_TIME) * (Math.PI / 2) * Math.sin(Math.PI * r.tip);
        return r.side * speed * dt;
    }

    // You don't slide near anything dangerous: within one corridor cell of a
    // water gap (which covers a plank and the cannons), a spike or a wave
    rockSafeAt(point) {
        const near = (box) => Math.max(box.minX - point.x, 0, point.x - box.maxX) ** 2 + Math.max(box.minZ - point.z, 0, point.z - box.maxZ) ** 2 < ROCK_SAFE ** 2;
        if (this.platforms.some((p) => near(p.gap))) return false;
        if (this.vents.some((v) => near(v))) return false;
        if (this.touchesSpike(point, ROCK_SAFE)) return false;
        return true;
    }

    // The long-neck's pit (Level 111 on): rocky dirt walls go straight down
    // to a dirt-and-rock floor far below
    createDinoPit(p) {
        const g = p.gap;
        const cx = (g.minX + g.maxX) / 2;
        const cz = (g.minZ + g.maxZ) / 2;
        const sizeX = g.maxX - g.minX;
        const sizeZ = g.maxZ - g.minZ;
        const bottomY = LONG_NECK_FLOOR;
        const depth = -bottomY - 0.2;
        let r = 61;
        const random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
        for (const [w, d, x, z, along] of [
            [sizeX, 0.05, cx, g.minZ, sizeX], [sizeX, 0.05, cx, g.maxZ, sizeX],
            [0.05, sizeZ, g.minX, cz, sizeZ], [0.05, sizeZ, g.maxX, cz, sizeZ],
        ]) {
            const map = fernRockTexture(128, 512, 131);
            map.repeat.set(along / 4, depth / 4);
            const wall = new THREE.Mesh(new THREE.BoxGeometry(w, depth, d),
                new THREE.MeshStandardMaterial({ map, roughness: 1, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: 0.35 }));
            wall.position.set(x, -0.2 - depth / 2, z);
            this.root.add(wall);
        }
        const dirt = dinoDirtTexture(256, 67);
        dirt.repeat.set(sizeX / 6, sizeZ / 6);
        const bottom = new THREE.Mesh(new THREE.PlaneGeometry(sizeX, sizeZ),
            new THREE.MeshStandardMaterial({ map: dirt, roughness: 1, emissive: 0x2a1a0a, emissiveIntensity: 0.5 }));
        bottom.rotation.x = -Math.PI / 2;
        bottom.position.set(cx, bottomY, cz);
        this.root.add(bottom);
        const stone = new THREE.MeshStandardMaterial({ color: 0x8a8070, roughness: 1, flatShading: true });
        for (let k = 0; k < 10; k++) {
            const size = 0.15 + random() * 0.35;
            const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), stone);
            rock.position.set(g.minX + 0.3 + random() * (sizeX - 0.6), bottomY + size * 0.4, g.minZ + 0.3 + random() * (sizeZ - 0.6));
            rock.rotation.set(random() * 3, random() * 3, random() * 3);
            this.root.add(rock);
        }
    }

    // The long-neck: a friendly long-necked plant-eating dinosaur standing on
    // the pit floor in the middle of the pit, its long neck reaching up to its
    // big flat head, which rests level with the floor and works like the
    // hover platform (p.object, PLATFORM_LENGTH long, the pit's width). Its
    // body, legs, feet and tail are down on the pit floor; the neck follows
    // the head as it swings across (showLongNeck).
    createLongNeck(p) {
        const g = p.gap;
        const width = p.alongX ? g.maxZ - g.minZ : g.maxX - g.minX;
        const skin = new THREE.MeshStandardMaterial({ color: 0x7bbf52, roughness: 0.8, emissive: 0x1a3010, emissiveIntensity: 0.35 });
        const belly = new THREE.MeshStandardMaterial({ color: 0xd8e8a0, roughness: 0.8 });
        const spot = new THREE.MeshStandardMaterial({ color: 0x5a9a3a, roughness: 0.8 });
        const dark = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4 });
        // The head (its z is the pit's long side): a flat top you stand on,
        // rounded sides, big friendly eyes on the sides and a smile at its snout
        const head = new THREE.Group();
        const top = new THREE.Mesh(new THREE.BoxGeometry(width - 0.15, 0.5, PLATFORM_LENGTH), skin);
        top.position.y = -0.25;
        top.receiveShadow = true;
        head.add(top);
        for (const side of [-1, 1]) {
            const cheek = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, PLATFORM_LENGTH, 12), skin);
            cheek.rotation.x = Math.PI / 2;
            cheek.position.set(side * (width / 2 - 0.2), -0.3, 0);
            head.add(cheek);
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshStandardMaterial({ color: 0xffffff }));
            eye.position.set(side * (width / 2 - 0.02), -0.3, -0.3);
            const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), dark);
            pupil.position.set(side * (width / 2 + 0.12), -0.28, -0.3);
            head.add(eye, pupil);
        }
        // Looking down at the head: two big friendly eyes at its back
        // corners, two nostrils and a smile at its snout (the low end)
        for (const side of [-1, 1]) {
            const brow = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), skin);
            brow.scale.y = 0.45;
            brow.position.set(side * (width / 2 - 0.45), 0, PLATFORM_LENGTH / 2 - 0.4);
            const ball = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshStandardMaterial({ color: 0xffffff }));
            ball.position.set(side * (width / 2 - 0.45), 0.1, PLATFORM_LENGTH / 2 - 0.5);
            const dot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), dark);
            dot.position.set(side * (width / 2 - 0.45), 0.2, PLATFORM_LENGTH / 2 - 0.62);
            const nostril = new THREE.Mesh(new THREE.CircleGeometry(0.07, 10), dark);
            nostril.rotation.x = -Math.PI / 2;
            nostril.position.set(side * 0.3, 0.006, -PLATFORM_LENGTH / 2 + 0.3);
            head.add(brow, ball, dot, nostril);
        }
        const smile = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.04, 6, 24, Math.PI * 0.7), dark);
        smile.rotation.set(-Math.PI / 2, 0, Math.PI + Math.PI * 0.15);
        smile.position.set(0, 0.006, -PLATFORM_LENGTH / 2 + 0.75);
        head.add(smile);
        const chin = new THREE.Mesh(new THREE.BoxGeometry(width - 0.5, 0.4, PLATFORM_LENGTH - 0.3), belly);
        chin.position.y = -0.65;
        head.add(chin);
        for (const [x, z] of [[-0.6, 0.5], [0.5, -0.4], [0.1, 0.8], [-0.3, -0.7]]) {
            const s = new THREE.Mesh(new THREE.CircleGeometry(0.18, 12), spot);
            s.rotation.x = -Math.PI / 2;
            s.position.set(x, 0.005, z);
            head.add(s);
        }
        if (p.alongX) head.rotation.y = Math.PI / 2;
        this.root.add(head);
        p.object = head;

        // The body on the pit floor (its z along the pit too)
        const body = new THREE.Group();
        const floorY = LONG_NECK_FLOOR;
        const trunk = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), skin);
        trunk.scale.set(1.25, 1.6, 3);
        trunk.position.y = floorY + 4.2;
        trunk.castShadow = true;
        const tummy = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), belly);
        tummy.scale.set(1.1, 1.1, 2.5);
        tummy.position.y = floorY + 3.6;
        body.add(trunk, tummy);
        for (const [x, z] of [[-0.75, -1.6], [0.75, -1.6], [-0.75, 1.6], [0.75, 1.6]]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 3.4, 10), skin);
            leg.position.set(x, floorY + 1.7, z);
            const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.62, 0.3, 12), spot);
            foot.position.set(x, floorY + 0.15, z);
            body.add(leg, foot);
        }
        // A long tail curling along the pit floor
        const tail = new THREE.Mesh(new THREE.ConeGeometry(0.7, 5, 12), skin);
        tail.rotation.x = Math.PI / 2 + 0.55;
        tail.position.set(0, floorY + 2.2, 4.4);
        body.add(tail);
        for (const [y, z, s] of [[5.7, -1.2, 0.35], [5.85, 0, 0.4], [5.7, 1.2, 0.35]]) {
            const d = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), spot);
            d.scale.y = 0.5;
            d.position.set(0, floorY + y, z);
            body.add(d);
        }
        const mid = new THREE.Vector3(g.minX + (g.maxX - g.minX) / 2, 0, g.minZ + (g.maxZ - g.minZ) / 2);
        body.position.set(mid.x, 0, mid.z);
        // Its chest faces the start's end of the pit
        body.rotation.y = (p.alongX ? Math.PI / 2 : 0) + (p.startAt === p.low ? Math.PI : 0);
        this.root.add(body);
        // The neck: one long tube from the shoulders up to the underside of
        // the head, re-aimed every time the head moves
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.75, 1, 14, 1, true), skin);
        neck.castShadow = true;
        this.root.add(neck);
        p.neck = neck;
        const toward = p.startAt === p.low ? -1 : 1;
        p.shoulder = mid.clone();
        p.shoulder.y = floorY + 5;
        if (p.alongX) p.shoulder.x += toward * 2.2;
        else p.shoulder.z += toward * 2.2;
    }

    // Aim the long-neck's neck from its shoulders to the middle of its head
    showLongNeck(p) {
        if (!p.neck) return;
        const end = p.object.position.clone();
        end.y -= 0.6;
        const dir = end.clone().sub(p.shoulder);
        const length = dir.length();
        p.neck.position.copy(p.shoulder).addScaledVector(dir, 0.5);
        p.neck.scale.set(1, length, 1);
        p.neck.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    }

    touchesSpike(point, margin) {
        if (this.spikePosition && Math.hypot(point.x - this.spikePosition.x, point.z - this.spikePosition.z) < this.spikeRadius + margin) return true;
        if (this.spike2Position && Math.hypot(point.x - this.spike2Position.x, point.z - this.spike2Position.z) < this.spike2Radius + margin) return true;
        return this.spikeRows.some((row) => {
            const across = row.spansX ? point.x - row.position.x : point.z - row.position.z;
            const along = row.spansX ? point.z - row.position.z : point.x - row.position.x;
            return Math.abs(across) < SPIKE_ROW_WIDTH / 2 + margin && Math.abs(along) < SPIKE_ROW_DEPTH / 2 + margin;
        });
    }

    // ---- The fossil hunt (Dinosaur World, Level 113 on) ----

    // A fossil floating a little above the dirt, slowly turning, with a
    // soft warm glow round it so it can be spotted down its wrong way:
    // a little dinosaur skull, a spiral shell or a three-toed footprint
    createFossil(f) {
        const group = new THREE.Group();
        group.position.set(f.position.x, 0, f.position.z);
        const spin = new THREE.Group();
        spin.position.y = FOSSIL_HEIGHT;
        spin.scale.setScalar(1.3);
        group.add(spin);
        const bone = new THREE.MeshStandardMaterial({ color: 0xeedfb8, roughness: 0.7, emissive: 0xb88a3a, emissiveIntensity: 0.55 });
        const dark = new THREE.MeshStandardMaterial({ color: 0x4a3420, roughness: 0.9 });
        if (f.kind === 'skull') {
            // Round head, long snout, two eye holes, a row of little teeth
            const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 14), bone);
            head.scale.set(1, 0.9, 1.05);
            spin.add(head);
            const snout = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), bone);
            snout.scale.set(0.85, 0.7, 1.6);
            snout.position.set(0, -0.06, 0.25);
            spin.add(snout);
            for (const sx of [-1, 1]) {
                const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), dark);
                eye.position.set(sx * 0.12, 0.05, 0.14);
                spin.add(eye);
            }
            for (let k = 0; k < 5; k++) {
                const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.07, 6), bone);
                tooth.rotation.x = Math.PI;
                tooth.position.set(-0.08 + k * 0.04, -0.16, 0.3 + (k % 2) * 0.01);
                spin.add(tooth);
            }
        } else {
            // A round (shell) or oval (footprint) stone tablet standing up,
            // the fossil pressed into both faces
            const map = fossilTabletTexture(f.kind);
            const face = new THREE.MeshStandardMaterial({ map, roughness: 0.75, emissive: 0xb88a3a, emissiveIntensity: 0.45, emissiveMap: map });
            const edge = new THREE.MeshStandardMaterial({ color: 0xc8b48a, roughness: 0.85, emissive: 0x6a4a1a, emissiveIntensity: 0.3 });
            const tablet = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.09, 28), [edge, face, face]);
            tablet.rotation.x = Math.PI / 2;
            if (f.kind === 'footprint') tablet.scale.set(0.85, 1, 1.2);
            spin.add(tablet);
        }
        // The soft glow: a warm halo that always faces you
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffd98a, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending }));
        halo.scale.set(1.8, 1.8, 1);
        halo.position.y = FOSSIL_HEIGHT;
        group.add(halo);
        // A little glowing ring on the dirt under it
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.42, 28), new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.45, depthWrite: false }));
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.02;
        group.add(ring);
        this.root.add(group);
        f.object = group;
        f.spin = spin;
        this.showFossil(f);
    }

    showFossil(f) {
        if (!f.object) return;
        f.object.visible = !f.collected;
        f.spin.rotation.y = f.t * 0.9;
        f.spin.position.y = FOSSIL_HEIGHT + Math.sin(f.t * 2) * 0.06;
    }

    // A big brass padlock, its shackle through a loop on the door
    createDoorLock() {
        const lock = new THREE.Group();
        const brass = new THREE.MeshStandardMaterial({ color: 0xd9a520, metalness: 0.6, roughness: 0.35, emissive: 0x5a3c00, emissiveIntensity: 0.4 });
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.4, 0.16), brass);
        lock.add(body);
        const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 10, 20, Math.PI), new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.8, roughness: 0.3 }));
        shackle.position.y = 0.2;
        lock.add(shackle);
        for (const sx of [-1, 1]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.08, 8), shackle.material);
            leg.position.set(sx * 0.14, 0.2, 0);
            lock.add(leg);
        }
        const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 12), new THREE.MeshStandardMaterial({ color: 0x2a1a08 }));
        hole.rotation.x = Math.PI / 2;
        hole.position.set(0, -0.04, 0.085);
        lock.add(hole);
        const slot = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.08, 0.02), hole.material);
        slot.position.set(0, -0.1, 0.085);
        lock.add(slot);
        // A little bone pressed into the lock, so it's clearly the fossil lock
        const boneMat = new THREE.MeshStandardMaterial({ color: 0xf2e6c6, roughness: 0.7, emissive: 0x6a5020, emissiveIntensity: 0.3 });
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.2, 8), boneMat);
        shaft.rotation.z = Math.PI / 2;
        shaft.position.set(0, 0.08, 0.085);
        lock.add(shaft);
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
            const knob = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), boneMat);
            knob.position.set(sx * 0.1, 0.08 + sy * 0.018, 0.085);
            lock.add(knob);
        }
        return lock;
    }

    // Is the exit door still locked (a fossil hunt with fossils left to find)?
    get fossilsLocked() {
        return (this.fossils?.length ?? 0) > 0 && this.fossils.some((f) => !f.collected);
    }

    // How many fossils have been found, out of how many
    get fossilCount() {
        return { found: (this.fossils ?? []).filter((f) => f.collected).length, of: this.fossils?.length ?? 0 };
    }

    // Each game step (so it stops while paused): the fossils turn and bob;
    // any part of the player reaching one picks it up. Returns what
    // happened: { event: 'collect', fossil }, then { event: 'unlock' } when
    // the last one is found (the padlock pops off).
    updateFossils(dt, point, radius) {
        const events = [];
        for (const f of this.fossils ?? []) {
            f.t += dt;
            if (!f.collected && point && Math.hypot(point.x - f.position.x, point.z - f.position.z) < FOSSIL_RADIUS + radius) {
                f.collected = true;
                events.push({ event: 'collect', fossil: f });
                if (!this.fossilsLocked) {
                    if (this.doorLock) this.doorLock.pop = 0;
                    events.push({ event: 'unlock' });
                }
            }
            this.showFossil(f);
        }
        const lock = this.doorLock;
        if (lock && lock.pop !== null && lock.object.visible) {
            // The padlock springs off the door, flips and drops away, then is gone
            lock.pop = Math.min(1, lock.pop + dt / LOCK_POP_TIME);
            const u = lock.pop;
            lock.object.position.set(0, 1.15 + 0.9 * u - 1.6 * u * u, 0.3 + 0.9 * u);
            lock.object.rotation.x = -u * Math.PI * 1.5;
            const s = 1 - Math.max(0, u - 0.6) / 0.4;
            lock.object.scale.setScalar(Math.max(0.01, s));
            if (u >= 1) lock.object.visible = false;
        }
        return events;
    }

    // Which fossils have been found (their numbers), for saving the spot
    collectedFossils() {
        return (this.fossils ?? []).flatMap((f, n) => (f.collected ? [n] : []));
    }

    // Loading a saved spot (or starting the level again): exactly these
    // fossils are found; with all of them found the door is already unlocked
    setFossils(found = []) {
        for (const [n, f] of (this.fossils ?? []).entries()) {
            f.collected = Array.isArray(found) && found.includes(n);
            this.showFossil(f);
        }
        if (this.doorLock) {
            const open = !this.fossilsLocked;
            this.doorLock.pop = open ? 1 : null;
            Object.assign(this.doorLock.object, { visible: !open });
            this.doorLock.object.position.set(0, 1.15, 0.3);
            this.doorLock.object.rotation.set(0, 0, 0);
            this.doorLock.object.scale.setScalar(1);
        }
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
