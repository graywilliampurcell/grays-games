// Maze carving and analysis with no rendering, used by tools/find-level.mjs
// to design fixed levels. The game itself loads levels from js/levels.js.

// Small seeded random number generator, so a search is repeatable
export function mulberry32(seed) {
    return function () {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const DIRECTIONS = [
    { di: 1, dj: 0 },
    { di: -1, dj: 0 },
    { di: 0, dj: 1 },
    { di: 0, dj: -1 },
];

const key = (c) => `${c.i},${c.j}`;

// "Growing tree" algorithm: a perfect maze (exactly one path between any two
// cells). newestBias near 1 gives long winding corridors; near 0 gives many
// short branches. Returns links[i][j] = list of cells that cell opens onto.
export function carveMaze(cols, rows, random, newestBias = 0.75) {
    const links = [];
    const visited = [];
    for (let i = 0; i < cols; i++) {
        links[i] = [];
        visited[i] = [];
        for (let j = 0; j < rows; j++) {
            links[i][j] = [];
            visited[i][j] = false;
        }
    }

    const active = [{ i: 0, j: 0 }];
    visited[0][0] = true;
    while (active.length > 0) {
        const index = random() < newestBias
            ? active.length - 1
            : Math.floor(random() * active.length);
        const cell = active[index];

        const options = DIRECTIONS
            .map(({ di, dj }) => ({ i: cell.i + di, j: cell.j + dj }))
            .filter(({ i, j }) => i >= 0 && i < cols && j >= 0 && j < rows && !visited[i][j]);

        if (options.length === 0) {
            active.splice(index, 1);
            continue;
        }

        const next = options[Math.floor(random() * options.length)];
        visited[next.i][next.j] = true;
        links[cell.i][cell.j].push(next);
        links[next.i][next.j].push(cell);
        active.push(next);
    }
    return links;
}

// Breadth-first search from one or more cells: distance and previous cell for every cell
export function walkFrom(links, starts) {
    const dist = links.map((col) => col.map(() => Infinity));
    const prev = links.map((col) => col.map(() => null));
    const queue = [];
    for (const s of starts) {
        dist[s.i][s.j] = 0;
        queue.push(s);
    }
    while (queue.length > 0) {
        const cell = queue.shift();
        for (const n of links[cell.i][cell.j]) {
            if (dist[n.i][n.j] === Infinity) {
                dist[n.i][n.j] = dist[cell.i][cell.j] + 1;
                prev[n.i][n.j] = cell;
                queue.push(n);
            }
        }
    }
    return { dist, prev };
}

// Facts about a maze with a given start and exit: the correct path, and every
// dead end off it with its distance from the start and how deep its branch runs
export function analyzeMaze(links, startCell, exitCell) {
    const cols = links.length;
    const rows = links[0].length;
    const fromStart = walkFrom(links, [startCell]);

    const solution = [];
    for (let c = exitCell; c; c = fromStart.prev[c.i][c.j]) solution.unshift(c);
    const onPath = new Set(solution.map(key));

    // How far each cell is from the correct path (0 = on it)
    const fromPath = walkFrom(links, solution);

    const deadEnds = [];
    let maxBranchDepth = 0;
    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            maxBranchDepth = Math.max(maxBranchDepth, fromPath.dist[i][j]);
            if (links[i][j].length === 1 && !onPath.has(`${i},${j}`)) {
                deadEnds.push({ i, j, fromStart: fromStart.dist[i][j], depth: fromPath.dist[i][j] });
            }
        }
    }
    deadEnds.sort((a, b) => a.fromStart - b.fromStart);
    return { solution, deadEnds, maxBranchDepth };
}

// Block map, one string per row (z), one character per block (x):
//   '#' wall, ' ' floor, 'S' start, 'X' spike, 'D' door (in the outer wall)
// Each cell is `corridor` blocks wide with 1-block walls between cells.
export function toLayout(links, { corridor = 3, startCell, exitCell, spikeCell }) {
    const cols = links.length;
    const rows = links[0].length;
    const step = corridor + 1;
    const width = cols * step + 1;
    const depth = rows * step + 1;
    const grid = [];
    for (let z = 0; z < depth; z++) grid[z] = new Array(width).fill('#');

    const origin = (c) => ({ x: 1 + c.i * step, z: 1 + c.j * step });
    const middle = (c) => ({ x: origin(c).x + Math.floor(corridor / 2), z: origin(c).z + Math.floor(corridor / 2) });

    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            const { x: x0, z: z0 } = origin({ i, j });
            for (let x = x0; x < x0 + corridor; x++) {
                for (let z = z0; z < z0 + corridor; z++) grid[z][x] = ' ';
            }
            for (const n of links[i][j]) {
                if (n.i === i + 1) {
                    for (let z = z0; z < z0 + corridor; z++) grid[z][x0 + corridor] = ' ';
                } else if (n.j === j + 1) {
                    for (let x = x0; x < x0 + corridor; x++) grid[z0 + corridor][x] = ' ';
                }
            }
        }
    }

    const s = middle(startCell);
    grid[s.z][s.x] = 'S';
    const x = middle(spikeCell);
    grid[x.z][x.x] = 'X';
    // Door goes in the outer wall next to the exit cell, on the east edge
    const d = middle(exitCell);
    grid[d.z][width - 1] = 'D';

    return grid.map((row) => row.join(''));
}
