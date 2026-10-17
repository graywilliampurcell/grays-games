// Searches for Level 100's layout (the Everything World finale) and prints it
// as a js/levels.js layout plus the rooms and dangers along the path.
//
//   node tools/find-level100.mjs [first seed] [seeds]   # Level 100 = node tools/find-level100.mjs 1 20000
//
// One 14 x 14 maze in 9 rooms, a 3 x 3 grid like a tic-tac-toe board:
// columns 5 / 4 / 5 cells wide, rows 4 / 5 / 5 cells tall. The correct path
// starts on the west edge in the Cotton Candy room and visits the rooms in
// order (Cotton Candy, Space, Jungle in the top row heading east; Moon,
// Underwater, Candy in the middle row heading west; Volcano, Ice, Robot
// Factory in the bottom row heading east), entering each once, and ends at
// the golden door on the east edge of the Robot Factory room. Each room's
// wrong ways stay inside it (so they look like it) and are all 3 cells deep.
// Each room has exactly one danger on its part of the path, with every cell
// it needs inside the room:
//   Cotton Candy: the spike on the path ('X'), path straight from 2 cells before
//   Space: the space door ('G', between two cells), path straight 4 cells
//   Jungle: a 2-cell river with a giant leaf ('O'), straight 4 cells
//   Moon: a 3-cell giant crater with a hover platform ('O'), straight 5 cells
//   Underwater: a 3-cell crack crossed in a bubble ('O'), straight 5 cells
//   Candy: a 3-cell chocolate river ('O') with a marshmallow bank each side,
//          straight 5 cells (Level 100 only: 3 cells, not 4)
//   Volcano: a lava geyser ('K'), path straight from 2 cells before
//   Ice: a snowman's 4-cell hallway ('N', 'M', 'P' in the cell before it)
//   Robot Factory: a 3-cell robot-arm belt ('A', 'R') with 1 floor cell
//          before and after it, in a 5-cell straight hallway (Level 100 only)
// Spacing: at least 2 path cells between any two dangers. Each room's danger
// map is in ROOMS below; Level 100's Maze gets them per room (js/levels.js
// rooms).
import { mulberry32, analyzeMaze, toLayout } from '../js/mazeCarver.js';

const FIRST_SEED = Number(process.argv[2] ?? 1);
const SEEDS = Number(process.argv[3] ?? 2000);
const COLS = 14;
const ROWS = 14;
const COL_EDGES = [0, 5, 9, 14];
const ROW_EDGES = [0, 4, 9, 14];
const DEPTH = 3;
// Rooms in path order: [column, row, name, danger]
const ROOMS = [
    [0, 0, 'Cotton Candy', 'spike'],
    [1, 0, 'Space', 'door'],
    [2, 0, 'Jungle', 'river'],
    [2, 1, 'Moon', 'crater'],
    [1, 1, 'Underwater', 'bubble'],
    [0, 1, 'Candy', 'chocolate'],
    [0, 2, 'Volcano', 'geyser'],
    [1, 2, 'Ice', 'snowman'],
    [2, 2, 'Robot Factory', 'armBelt'],
];
const GAP_CELLS = { river: 2, crater: 3, bubble: 3, chocolate: 3 };
const SNOWMAN_CELLS = 4;
const ARM_BELT_CELLS = 3;

const key = (c) => `${c.i},${c.j}`;
const DIRECTIONS = [{ di: 1, dj: 0 }, { di: -1, dj: 0 }, { di: 0, dj: 1 }, { di: 0, dj: -1 }];
const inside = ({ i, j }) => i >= 0 && i < COLS && j >= 0 && j < ROWS;
const neighbours = (c) => DIRECTIONS.map(({ di, dj }) => ({ i: c.i + di, j: c.j + dj })).filter(inside);
const step = (p, q) => `${q.i - p.i},${q.j - p.j}`;
const shuffle = (list, random) => {
    for (let k = list.length - 1; k > 0; k--) {
        const r = Math.floor(random() * (k + 1));
        [list[k], list[r]] = [list[r], list[k]];
    }
    return list;
};
const band = (edges, v) => edges.findIndex((e, n) => v >= e && v < edges[n + 1]);
// Which room (index in ROOMS) a cell is in
const roomOf = (c) => ROOMS.findIndex(([ci, rj]) => ci === band(COL_EDGES, c.i) && rj === band(ROW_EDGES, c.j));
const ROOM_OF = [];
for (let i = 0; i < COLS; i++) {
    ROOM_OF[i] = [];
    for (let j = 0; j < ROWS; j++) ROOM_OF[i][j] = roomOf({ i, j });
}
const room = (c) => ROOM_OF[c.i][c.j];
const roomCells = (r) => {
    const out = [];
    for (let i = 0; i < COLS; i++) for (let j = 0; j < ROWS; j++) if (ROOM_OF[i][j] === r) out.push({ i, j });
    return out;
};

// Every patch of a room's cells not on the path must split into 3-cell pieces
function roomSplits(r, used) {
    const seen = new Set();
    for (const c of roomCells(r)) {
        if (used.has(key(c)) || seen.has(key(c))) continue;
        let size = 0;
        const stack = [c];
        seen.add(key(c));
        while (stack.length) {
            const d = stack.pop();
            size++;
            for (const n of neighbours(d)) if (room(n) === r && !used.has(key(n)) && !seen.has(key(n))) { seen.add(key(n)); stack.push(n); }
        }
        if (size % DEPTH !== 0) return false;
    }
    return true;
}

// Cover a room's leftover cells with 3-cell chains whose first cell touches
// one of the room's path cells that may have a branch (not a danger's)
function splitRoom(r, onPath, noBranch, random) {
    const cells = roomCells(r).filter((c) => !onPath.has(key(c)));
    const left = new Set(cells.map(key));
    const byKey = new Map(cells.map((c) => [key(c), c]));
    const rootsOf = (c) => neighbours(c).filter((n) => onPath.has(key(n)) && room(n) === r && !noBranch.has(key(n)));
    let budget = 4000;
    const chains = [];
    function chainsWith(first) {
        const out = [];
        const walk = (chain) => {
            if (chain.length === DEPTH) {
                if (chain.some((c) => key(c) === first) && rootsOf(chain[0]).length) out.push(chain.slice());
                return;
            }
            for (const n of neighbours(chain[chain.length - 1])) {
                if (left.has(key(n)) && !chain.some((c) => key(c) === key(n))) {
                    chain.push(byKey.get(key(n)));
                    walk(chain);
                    chain.pop();
                }
            }
        };
        for (const k of left) walk([byKey.get(k)]);
        return out;
    }
    function cover() {
        if (left.size === 0) return true;
        if (--budget < 0) return false;
        const first = left.values().next().value;
        for (const chain of shuffle(chainsWith(first), random)) {
            for (const c of chain) left.delete(key(c));
            chains.push(chain);
            if (cover()) return true;
            chains.pop();
            for (const c of chain) left.add(key(c));
        }
        return false;
    }
    if (!cover()) return null;
    return chains.map((chain) => ({ chain, root: shuffle(rootsOf(chain[0]), random)[0] }));
}

// Where room r's danger can go on the path (path indexes from..to, all in
// the room). Returns { span, cells (no branches), ... } options.
function dangerOptions(r, path, from, to) {
    const kind = ROOMS[r][3];
    const inRoom = (n) => n >= from && n <= to;
    const straight = (a, b) => { // path straight from a to b (indexes)
        for (let n = a + 1; n < b; n++) if (step(path[n - 1], path[n]) !== step(path[n], path[n + 1])) return false;
        return true;
    };
    const out = [];
    const range = (a, b) => [...Array(b - a + 1).keys()].map((d) => a + d);
    for (let k = from; k <= to; k++) {
        if (kind === 'spike' || kind === 'geyser') {
            // Plain cell k, the path straight from k - 2 to k + 1
            if (k < 2 || !inRoom(k - 2) || !inRoom(k + 1) || !straight(k - 2, k + 1)) continue;
            out.push({ kind, at: k, span: [k, k], noBranch: [k] });
        } else if (kind === 'door') {
            // The wall gap between k and k + 1, the path straight from k - 1 to k + 2
            if (!inRoom(k - 1) || !inRoom(k + 2) || !straight(k - 1, k + 2)) continue;
            out.push({ kind, at: k, span: [k, k + 1], noBranch: [] });
        } else if (GAP_CELLS[kind]) {
            // A gap of plain cells k .. k + n - 1, straight from k - 1 to k + n
            const n = GAP_CELLS[kind];
            if (!inRoom(k - 1) || !inRoom(k + n) || !straight(k - 1, k + n)) continue;
            out.push({ kind, at: k, span: [k, k + n - 1], noBranch: range(k, k + n - 1) });
        } else if (kind === 'snowman') {
            // A straight hallway k .. k + 3 with only the path through it, the
            // cell before it in the room, and the path turning out of its last cell
            const e = k + SNOWMAN_CELLS - 1;
            if (!inRoom(k - 1) || !inRoom(e) || e + 1 >= path.length) continue;
            if (!straight(k, e) || step(path[e], path[e + 1]) === step(path[e - 1], path[e])) continue;
            out.push({ kind, at: k, span: [k, e], noBranch: range(k, e) });
        } else if (kind === 'armBelt') {
            // A straight 5-cell hallway k .. k + 4, the path turning into it and
            // out of it; the belt is its middle 3 cells
            const e = k + ARM_BELT_CELLS + 1;
            if (!inRoom(k) || !inRoom(e) || k < 1 || e + 1 >= path.length) continue;
            if (!straight(k, e)) continue;
            if (step(path[k - 1], path[k]) === step(path[k], path[k + 1])) continue;
            if (step(path[e], path[e + 1]) === step(path[e - 1], path[e])) continue;
            out.push({ kind, at: k + 1, hall: [k, e], span: [k, e], noBranch: range(k, e) });
        }
    }
    return out;
}

const apart = (a, b) => a[1] + 3 <= b[0] || b[1] + 3 <= a[0];

// Lay the path room by room (backtracking), hanging each finished room's
// wrong ways and placing its danger before going on
function search(random) {
    const startJ = Math.floor(random() * (ROW_EDGES[1] - ROW_EDGES[0]));
    const path = [{ i: 0, j: startJ }];
    const used = new Set([key(path[0])]);
    const rooms = []; // per room: { from, to, danger, chains }
    let steps = 0;
    // Extend the path inside room r (it's at path[path.length - 1], in r)
    function walk(r, from) {
        if (++steps > 300000) return false;
        const last = path[path.length - 1];
        // Try finishing the room here: the last room ends on the east edge;
        // the others step into the next room
        const finishes = [];
        if (r === ROOMS.length - 1) {
            if (last.i === COLS - 1) finishes.push(null);
        } else {
            for (const n of neighbours(last)) if (room(n) === r + 1 && !used.has(key(n))) finishes.push(n);
        }
        if (finishes.length && random() < 0.6 && tryFinish(r, from, finishes)) return true;
        const options = shuffle(neighbours(last).filter((n) => room(n) === r && !used.has(key(n))), random);
        // Prefer going straight, so long straight dangers fit
        if (path.length > 1 && random() < 0.55) {
            const ahead = { i: 2 * last.i - path[path.length - 2].i, j: 2 * last.j - path[path.length - 2].j };
            const k = options.findIndex((c) => key(c) === key(ahead));
            if (k > 0) options.unshift(options.splice(k, 1)[0]);
        }
        for (const next of options) {
            path.push(next);
            used.add(key(next));
            if (walk(r, from)) return true;
            path.pop();
            used.delete(key(next));
        }
        if (finishes.length && tryFinish(r, from, finishes)) return true;
        return false;
    }
    function tryFinish(r, from, finishes) {
        if (!roomSplits(r, used)) return false;
        const to = path.length - 1;
        // The danger needs to know the next cell too (turns out of hallways)
        for (const next of shuffle(finishes.slice(), random)) {
            if (next) {
                path.push(next);
                used.add(key(next));
            }
            const dangers = shuffle(dangerOptions(r, path, from, to), random)
                .filter((d) => rooms.every((o) => apart(o.danger.span, d.span)));
            for (const danger of dangers.slice(0, 6)) {
                const onPath = new Set(path.slice(from, to + 1).map(key));
                const hung = splitRoom(r, onPath, new Set(danger.noBranch.map((n) => key(path[n]))), random);
                if (!hung) continue;
                rooms.push({ from, to, danger, chains: hung });
                if (!next || walk(r + 1, path.length - 1)) return true;
                rooms.pop();
            }
            if (next) {
                path.pop();
                used.delete(key(next));
            }
        }
        return false;
    }
    return walk(0, 0) ? { path, rooms } : null;
}

// "As many wrong ways as fit sensibly": of all the seeds tried, keep the
// maze whose emptiest room has the most wrong ways, then the most in all
const score = ({ rooms }) => Math.min(...rooms.map((o) => o.chains.length)) * 1000 + rooms.reduce((t, o) => t + o.chains.length, 0);
let best = null;
for (let seed = FIRST_SEED; seed < FIRST_SEED + SEEDS; seed++) {
    const random = mulberry32(seed);
    const found = search(random);
    if (found && (!best || score(found) > score(best))) best = { seed, ...found };
}
if (!best) {
    console.error('No maze found.');
    process.exit(1);
}

const { path, rooms } = best;
const links = [];
for (let i = 0; i < COLS; i++) {
    links[i] = [];
    for (let j = 0; j < ROWS; j++) links[i][j] = [];
}
const link = (p, q) => {
    links[p.i][p.j].push(q);
    links[q.i][q.j].push(p);
};
for (let k = 1; k < path.length; k++) link(path[k - 1], path[k]);
for (const { chains } of rooms) for (const { chain, root } of chains) {
    link(root, chain[0]);
    for (let k = 1; k < chain.length; k++) link(chain[k - 1], chain[k]);
}
const startCell = path[0];
const exitCell = path[path.length - 1];
const { solution, deadEnds, maxBranchDepth } = analyzeMaze(links, startCell, exitCell);
if (solution.length !== path.length || maxBranchDepth !== DEPTH || !deadEnds.every((d) => d.depth === DEPTH)) {
    console.error('Bad maze', solution.length, path.length, maxBranchDepth);
    process.exit(1);
}
const spike = rooms[0].danger;
const layout = toLayout(links, { startCell, exitCell, spikeCell: path[spike.at] }).map((r) => r.split(''));
const put = ([x, z], ch) => { layout[z][x] = ch; };
function gapBlocks(cells) {
    const out = [];
    const x0 = 4 * Math.min(...cells.map((c) => c.i)) + 1;
    const z0 = 4 * Math.min(...cells.map((c) => c.j)) + 1;
    const x1 = 4 * Math.max(...cells.map((c) => c.i)) + 3;
    const z1 = 4 * Math.max(...cells.map((c) => c.j)) + 3;
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) out.push([x, z]);
    return out;
}
for (const { danger: d } of rooms) {
    if (GAP_CELLS[d.kind]) for (const b of gapBlocks([path[d.span[0]], path[d.span[1]]])) put(b, 'O');
    if (d.kind === 'geyser') for (const b of gapBlocks([path[d.at]])) put(b, 'K');
    if (d.kind === 'door') {
        const a = path[d.at];
        const b = path[d.at + 1];
        for (const n of [1, 2, 3]) put(a.i !== b.i ? [4 * Math.max(a.i, b.i), 4 * a.j + n] : [4 * a.i + n, 4 * Math.max(a.j, b.j)], 'G');
    }
    if (d.kind === 'snowman') {
        const h = d.at;
        for (const b of gapBlocks([path[h], path[h + SNOWMAN_CELLS - 1]])) put(b, 'N');
        const end = path[h + SNOWMAN_CELLS - 1];
        const [dx, dz] = step(path[h], path[h + 1]).split(',').map(Number);
        const [tx, tz] = step(end, path[h + SNOWMAN_CELLS]).split(',').map(Number);
        const ex = dx > 0 ? 4 * end.i + 3 : dx < 0 ? 4 * end.i + 1 : null;
        const ez = dz > 0 ? 4 * end.j + 3 : dz < 0 ? 4 * end.j + 1 : null;
        for (const c of [2, tx + tz > 0 ? 1 : 3]) {
            if (ex !== null) put([ex, 4 * end.j + c], 'M');
            else put([4 * end.i + c, ez], 'M');
        }
        put([4 * path[h - 1].i + 2, 4 * path[h - 1].j + 2], 'P');
    }
    if (d.kind === 'armBelt') {
        const first = d.at;
        for (const b of gapBlocks([path[first], path[first + ARM_BELT_CELLS - 1]])) put(b, 'A');
        const before = path[first - 1];
        const [dx, dz] = step(before, path[first]).split(',').map(Number);
        for (const c of [1, 2, 3]) put(dx ? [4 * before.i + (dx > 0 ? 4 : 0), 4 * before.j + c] : [4 * before.i + c, 4 * before.j + (dz > 0 ? 4 : 0)], 'A');
        put([4 * before.i + 2, 4 * before.j + 2], 'R');
    }
}

console.log(layout.map((row) => `        '${row.join('')}',`).join('\n'));
const dir = (n) => ({ '1,0': 'east', '-1,0': 'west', '0,1': 'south', '0,-1': 'north' })[step(path[n - 1], path[n])];
console.log(`\nLevel 100: seed ${best.seed}, start row ${startCell.j} west, door row ${exitCell.j} east, path ${path.length} cells, ${deadEnds.length} dead ends (all ${DEPTH} deep)`);
rooms.forEach(({ from, to, danger: d, chains }, r) => {
    const [ci, rj, name] = ROOMS[r];
    const w = COL_EDGES[ci + 1] - COL_EDGES[ci];
    const h = ROW_EDGES[rj + 1] - ROW_EDGES[rj];
    console.log(`${name} room ${w}x${h}: path cells ${from + 1}-${to + 1}, ${chains.length} dead ends; ${d.kind} on path cells ${d.span[0] + 1}-${d.span[1] + 1} heading ${dir(Math.max(1, d.span[0] + (d.kind === 'door' ? 1 : 0)))}`);
});
