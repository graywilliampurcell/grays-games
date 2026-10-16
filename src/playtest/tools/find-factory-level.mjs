// Searches for a Robot Factory World level layout (Levels 81-90) that fits
// its rules, and prints it as a js/levels.js layout. Made from
// find-ice-level.mjs (Levels 71-80), at 13 x 13.
//
//   SEEDS=3000 node tools/find-factory-level.mjs level81 32 21001  # the sneaky zapper + one tire ride over a 5-cell gap (Level 81 = seed 21456)
//   SEEDS=3000 node tools/find-factory-level.mjs level82 32 6001   # the sneaky zapper + one backward belt (Level 82 = seed 6810)
//   SEEDS=3000 node tools/find-factory-level.mjs level83 30 1      # a path zapper + one backward belt (Level 83 = seed 79)
//   SEEDS=3000 node tools/find-factory-level.mjs level84 30 15001  # a robot-arm belt + one tire ride + the sneaky zapper (Level 84 = seed 16106)
//   SEEDS=3000 node tools/find-factory-level.mjs level85 28 18001  # the big zapper + one backward belt (Level 85 = seed 18354)
//   SEEDS=3000 node tools/find-factory-level.mjs level86 30 1      # a path zapper + one tire ride + one backward belt (Level 86)
//
// Arguments: rule, [dead ends], [first seed]; SEEDS=n sets how many seeds to
// try. Good mazes are rare at 13 x 13, so run many first seeds in parallel.
//
// Layout letters (see js/Maze.js): 'S' start, 'D' door, 'X' the sneaky
// zapper, 'F' a 5-cell gap crossed on the flattened tire (a fast platform,
// Level 27's speed), 'B' a backward belt (4 corridor cells, counting the
// gap in the wall before its first cell), 'L' the middle of the first cell
// of the belt's straight hallway, on the start's side (where the belt flings
// you), 'X' the zapper on the path when there is no sneaky one ('Z' when
// there is), 'Y' the big zapper filling a straight dead end's opening, 'A'
// a robot-arm belt (6 corridor cells, counting the gap in the wall before
// its first cell; it carries you forward), 'R' the middle of the floor cell
// just before it (where an arm pushes you).
//
// Rules for every level: 13 x 13, one solution path from the west edge to the
// east edge, start and door on opposite edges, a layout clearly different
// from every other level. Spacing: at least 2 path cells between any two
// obstacles on the path (a gap counts as its 5 cells, a belt as its whole
// hallway) and between them and every obstacle dead end's opening. Dead ends
// are 2 deep. Gaps sit on plain cells (only the path goes through them) in a
// straight stretch visible on approach. The sneaky zapper: a dead end 3
// cells deep with one 90 degree turn, leaving the path in its first 3 cells,
// the zapper in its last cell, out of sight of the whole path. A belt's
// hallway: plain path cells in a straight line, the path turning into its
// first cell and out of its last; the belt is 4 cells of it, with at least
// one floor cell of the hallway before it and one after it (Gray,
// 2026-10-16), close to the start, in the middle or close to the end. A
// robot-arm belt's hallway is the same kind of straight hallway; the belt is
// 6 cells of it in the middle (as many floor cells before it as after it,
// give or take one, and at least one each side).
import { mulberry32, analyzeMaze, toLayout } from '../js/mazeCarver.js';
import { LEVELS } from '../js/levels.js';

const RULES = {
    level81: { name: 'Level 81', depth: 2, deadEnds: 30, sneaky: true, gaps: 1 },
    level82: { name: 'Level 82', depth: 2, deadEnds: 30, sneaky: true, belts: 1 },
    level83: { name: 'Level 83', depth: 2, deadEnds: 30, pathCane: true, belts: 1, placeTries: 20 },
    // straight: how often the path keeps going straight when it can (a long
    // straight hallway for the arm belt is rare otherwise)
    level84: { name: 'Level 84', depth: 2, deadEnds: 30, sneaky: true, gaps: 1, armBelts: 1, straight: 0.5, placeTries: 40 },
    level85: { name: 'Level 85', depth: 2, deadEnds: 30, bigCane: true, belts: 1, placeTries: 20 },
    level86: { name: 'Level 86', depth: 2, deadEnds: 28, pathCane: true, gaps: 1, belts: 1, placeTries: 200 },
};
const rule = RULES[process.argv[2]];
if (!rule) {
    console.error(`Usage: node tools/find-factory-level.mjs <${Object.keys(RULES).join('|')}> [dead ends] [first seed]`);
    process.exit(1);
}
const DEAD_ENDS = Number(process.argv[3] ?? rule.deadEnds);
const FIRST_SEED = Number(process.argv[4] ?? 1);
const COLS = 13;
const ROWS = 13;
const GAP_CELLS = 5; // the tire's gap is 5 corridor cells long
const BELT_CELLS = 4; // a backward belt is 4 corridor cells long, after one floor cell
const ARM_BELT_CELLS = 6; // a robot-arm belt is 6 corridor cells long, in the middle of its hallway
const DEPTH = rule.depth;
const PATH_LENGTH = COLS * ROWS - DEAD_ENDS * DEPTH - (rule.sneaky ? 3 : 0);
const SEEDS = Number(process.env.SEEDS ?? 4000);
const STEPS_PER_SEED = 200000;

// Every other level's walls, so the new one is clearly different
const shape = (rows) => rows.map((r) => r.replace(/[^#]/g, ' ')).join('\n');
const OTHERS = LEVELS.filter((l) => l.name !== rule.name).map((l) => shape(l.layout));
const MIN_DIFFERENT = 24;
const differentEnough = (s) => OTHERS.every((o) => o.length !== s.length || [...o].filter((ch, k) => ch !== s[k]).length >= MIN_DIFFERENT);
// Start somewhere new: not in the row the level before this one starts in
const previous = LEVELS[LEVELS.findIndex((l) => l.name === rule.name) - 1] ?? LEVELS[LEVELS.length - 1];
const PREVIOUS_START_ROW = Math.floor(previous.layout.findIndex((r) => r.includes('S')) / 4);

const DIRECTIONS = [{ di: 1, dj: 0 }, { di: -1, dj: 0 }, { di: 0, dj: 1 }, { di: 0, dj: -1 }];
const key = (c) => `${c.i},${c.j}`;
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

// 3-deep dead ends only fit when every patch of cells left over from the path
// can be cut into 3-cell pieces, so a 3-deep level keeps searching for a path
// whose leftover patches all have a multiple of 3 cells
function leftoverSplits(used) {
    const seen = new Set(used);
    for (let i = 0; i < COLS; i++) for (let j = 0; j < ROWS; j++) {
        if (seen.has(`${i},${j}`)) continue;
        let size = 0;
        const stack = [{ i, j }];
        seen.add(`${i},${j}`);
        while (stack.length) {
            const c = stack.pop();
            size++;
            for (const n of neighbours(c)) if (!seen.has(key(n))) { seen.add(key(n)); stack.push(n); }
        }
        if (size % 3 !== 0) return false;
    }
    return true;
}

// 2-deep dead ends only fit when every patch of cells left over from the
// path has an even number of cells, except the one holding the sneaky
// zapper's 3-cell dead end (odd, and touching one of the path's first 3 cells)
function leftoverPairs(used, path) {
    const seen = new Set(used);
    const early = new Set(path.slice(0, 3).map(key));
    let odd = 0;
    for (let i = 0; i < COLS; i++) for (let j = 0; j < ROWS; j++) {
        if (seen.has(`${i},${j}`)) continue;
        let size = 0;
        let nearStart = false;
        const stack = [{ i, j }];
        seen.add(`${i},${j}`);
        while (stack.length) {
            const c = stack.pop();
            size++;
            for (const n of neighbours(c)) {
                if (early.has(key(n))) nearStart = true;
                if (!seen.has(key(n))) { seen.add(key(n)); stack.push(n); }
            }
        }
        if (size % 2 === 1) {
            if (!rule.sneaky || !nearStart || ++odd > 1) return false;
        }
    }
    return true;
}

// Random self-avoiding walk of exactly PATH_LENGTH cells, west edge to east edge
function layPath(random) {
    const start = { i: 0, j: Math.floor(random() * ROWS) };
    const path = [start];
    const used = new Set([key(start)]);
    let steps = 0;
    function extend() {
        if (++steps > STEPS_PER_SEED) return false;
        const last = path[path.length - 1];
        if (path.length === PATH_LENGTH) return last.i === COLS - 1 && (DEPTH === 3 ? leftoverSplits(used) : leftoverPairs(used, path));
        if (COLS - 1 - last.i > PATH_LENGTH - path.length) return false;
        const options = path.length === 1 ? [{ i: 1, j: start.j }] : shuffle(neighbours(last), random);
        if (rule.straight && path.length > 1 && random() < rule.straight) {
            const ahead = { i: 2 * last.i - path[path.length - 2].i, j: 2 * last.j - path[path.length - 2].j };
            const k = options.findIndex((c) => key(c) === key(ahead));
            if (k > 0) options.unshift(options.splice(k, 1)[0]);
        }
        for (const next of options) {
            if (used.has(key(next))) continue;
            path.push(next);
            used.add(key(next));
            if (extend()) return true;
            path.pop();
            used.delete(key(next));
        }
        return false;
    }
    return extend() ? path : null;
}

// Cover the leftover cells with chains DEPTH cells long whose first cell
// touches the path (backtracking, with a budget)
function splitIntoDeadEnds(cells, onPath, random) {
    const left = new Set(cells.map(key));
    const byKey = new Map(cells.map((c) => [key(c), c]));
    const touchesPath = (c) => neighbours(c).some((n) => onPath.has(key(n)));
    let budget = 20000;
    function chainsFrom(start) {
        const out = [];
        const walk = (chain) => {
            if (chain.length === DEPTH) return out.push(chain.slice());
            for (const n of neighbours(chain[chain.length - 1])) {
                if (left.has(key(n)) && !chain.some((c) => key(c) === key(n))) {
                    chain.push(byKey.get(key(n)));
                    walk(chain);
                    chain.pop();
                }
            }
        };
        walk([start]);
        return out;
    }
    const chains = [];
    function cover() {
        if (left.size === 0) return true;
        if (--budget < 0) return false;
        const first = left.values().next().value;
        const options = [];
        for (const k of left) {
            if (!touchesPath(byKey.get(k))) continue;
            for (const chain of chainsFrom(byKey.get(k))) if (chain.some((c) => key(c) === first)) options.push(chain);
        }
        for (const chain of shuffle(options, random)) {
            for (const c of chain) left.delete(key(c));
            chains.push(chain);
            if (cover()) return true;
            chains.pop();
            for (const c of chain) left.add(key(c));
        }
        return false;
    }
    return cover() ? chains : null;
}

// Can the 'X' be seen from anywhere on the given path cells?
function spikeVisible(rows, pathCells) {
    const isWall = (x, z) => rows[Math.floor(z)]?.[Math.floor(x)] === '#' || rows[Math.floor(z)]?.[Math.floor(x)] === 'D' || rows[Math.floor(z)]?.[Math.floor(x)] === undefined;
    const z0 = rows.findIndex((r) => r.includes('X'));
    const x0 = rows[z0].indexOf('X');
    const targets = [];
    for (const fa of [-0.2, 0.5, 1.2]) for (const fb of [-0.2, 0.5, 1.2]) targets.push([x0 + fa, z0 + fb]);
    const viewpoints = [];
    for (const c of pathCells) for (const fx of [1.45, 2, 2.5, 3, 3.55]) for (const fz of [1.45, 2, 2.5, 3, 3.55]) viewpoints.push([4 * c.i + fx, 4 * c.j + fz]);
    const clear = ([ax, az], [bx, bz]) => {
        const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.05);
        for (let k = 1; k < n; k++) if (isWall(ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n)) return false;
        return true;
    };
    return viewpoints.some((v) => targets.some((t) => clear(v, t)));
}

// Hang the leftover cells off the path: the sneaky dead end (if any) and the
// rest as DEPTH-deep dead ends, each rooted at a random path neighbour
function hang(path, random) {
    const onPath = new Map(path.map((c, index) => [key(c), index]));
    const leftover = [];
    for (let i = 0; i < COLS; i++) for (let j = 0; j < ROWS; j++) if (!onPath.has(`${i},${j}`)) leftover.push({ i, j });
    const isLeftover = new Set(leftover.map(key));
    let sneaky = null;
    let rest = leftover;
    if (rule.sneaky) {
        const options = [];
        for (let index = 0; index < 3; index++) {
            const junction = path[index];
            for (const a of neighbours(junction).filter((n) => isLeftover.has(key(n)))) {
                for (const b of neighbours(a).filter((n) => isLeftover.has(key(n)))) {
                    for (const s of neighbours(b).filter((n) => isLeftover.has(key(n)) && key(n) !== key(a))) {
                        const turns = (step(junction, a) !== step(a, b) ? 1 : 0) + (step(a, b) !== step(b, s) ? 1 : 0);
                        if (turns === 1) options.push({ index, junction, a, b, s });
                    }
                }
            }
        }
        // Try each sneaky dead end until the rest splits into dead ends
        let chains = null;
        for (const option of shuffle(options, random).slice(0, 24)) {
            const branch = new Set([option.a, option.b, option.s].map(key));
            chains = splitIntoDeadEnds(leftover.filter((c) => !branch.has(key(c))), onPath, random);
            if (chains) {
                sneaky = option;
                break;
            }
        }
        if (!chains) return null;
        return link(path, sneaky, chains, onPath, random);
    }
    const chains = splitIntoDeadEnds(rest, onPath, random);
    if (!chains) return null;
    return link(path, sneaky, chains, onPath, random);
}

function link(path, sneaky, chains, onPath, random) {
    const roots = chains.map((chain) => shuffle(neighbours(chain[0]).filter((n) => onPath.has(key(n))), random)[0]);
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
    if (sneaky) {
        link(sneaky.junction, sneaky.a);
        link(sneaky.a, sneaky.b);
        link(sneaky.b, sneaky.s);
    }
    chains.forEach((chain, c) => {
        link(chain[0], roots[c]);
        for (let k = 1; k < chain.length; k++) link(chain[k - 1], chain[k]);
    });
    return { links, sneaky, chains, roots: roots.map((r) => onPath.get(key(r))) };
}

// Place the path obstacles: gaps and belts, with the spacing rule. Each
// obstacle is a span [from, to] of path indexes; two spans need at least 2
// path cells between.
function place(path, hung, random) {
    const { links } = hung;
    const plain = (n) => n > 0 && n < path.length - 1 && links[path[n].i][path[n].j].length === 2 && step(path[n - 1], path[n]) === step(path[n], path[n + 1]);
    const only = (n) => links[path[n].i][path[n].j].length === 2;
    const apart = (a, b) => a[1] + 3 <= b[0] || b[1] + 3 <= a[0];
    const spans = [];
    if (hung.sneaky) spans.push([hung.sneaky.index, hung.sneaky.index]);
    const fits = (span) => spans.every((s) => apart(s, span));
    const out = { rivers: [], belts: [], armBelts: [] };
    // Gaps: GAP_CELLS plain cells (so the path runs straight from g - 1 to g + GAP_CELLS)
    const cells = [...Array(GAP_CELLS).keys()];
    for (let r = 0; r < (rule.gaps ?? 0); r++) {
        const options = [];
        for (let g = 3; g < path.length - GAP_CELLS - 1; g++) if (cells.every((d) => plain(g + d)) && fits([g, g + GAP_CELLS - 1])) options.push(g);
        if (options.length === 0) return null;
        const g = options[Math.floor(random() * options.length)];
        out.rivers.push(g);
        spans.push([g, g + GAP_CELLS - 1]);
    }
    // Belts: a hallway h .. e, straight, only the path through it, the path
    // turning into h and out of e; the belt is cells b .. b + BELT_CELLS - 1
    // with h < b and b + BELT_CELLS - 1 < e
    for (let n = 0; n < (rule.belts ?? 0); n++) {
        const options = [];
        for (let h = 2; h < path.length - 2; h++) {
            const dir = step(path[h], path[h + 1]);
            if (step(path[h - 1], path[h]) === dir || !only(h)) continue;
            let e = h + 1;
            while (e + 1 < path.length - 1 && only(e) && step(path[e], path[e + 1]) === dir) e++;
            if (!only(e) || e - h + 1 < BELT_CELLS + 2) continue;
            if (!fits([h, e])) continue;
            for (let b = h + 1; b + BELT_CELLS - 1 < e; b++) options.push({ h, e, b });
        }
        if (options.length === 0) return null;
        const o = options[Math.floor(random() * options.length)];
        out.belts.push(o);
        spans.push([o.h, o.e]);
    }
    // Robot-arm belts: a hallway h .. e like a backward belt's; the belt is
    // cells b .. b + ARM_BELT_CELLS - 1 in its middle
    for (let n = 0; n < (rule.armBelts ?? 0); n++) {
        const options = [];
        for (let h = 2; h < path.length - 2; h++) {
            const dir = step(path[h], path[h + 1]);
            if (step(path[h - 1], path[h]) === dir || !only(h)) continue;
            let e = h + 1;
            while (e + 1 < path.length - 1 && only(e) && step(path[e], path[e + 1]) === dir) e++;
            if (!only(e) || e - h + 1 < ARM_BELT_CELLS + 2) continue;
            if (!fits([h, e])) continue;
            for (let b = h + 1; b + ARM_BELT_CELLS - 1 < e; b++) {
                const before = b - h;
                const after = e - (b + ARM_BELT_CELLS - 1);
                if (Math.abs(before - after) <= 1) options.push({ h, e, b });
            }
        }
        if (options.length === 0) return null;
        const o = options[Math.floor(random() * options.length)];
        out.armBelts.push(o);
        spans.push([o.h, o.e]);
    }
    // The zapper on the path: plain, with the path straight from k - 2 to
    // k + 1 (visible on approach), in the middle part of the path
    if (rule.pathCane) {
        const options = [];
        for (let k = Math.ceil(path.length * 0.3); k <= Math.floor(path.length * 0.8); k++) {
            if (plain(k) && step(path[k - 2], path[k - 1]) === step(path[k - 1], path[k]) && fits([k, k])) options.push(k);
        }
        if (options.length === 0) return null;
        out.pathCane = options[Math.floor(random() * options.length)];
        spans.push([out.pathCane, out.pathCane]);
    }
    // The big zapper: a straight dead end (all DEPTH cells in a line from its opening)
    if (rule.bigCane) {
        const options = hung.chains.map((chain, c) => ({ chain, at: hung.roots[c] }))
            .filter(({ chain, at }) => chain.every((cell, n) => step(n === 0 ? path[at] : chain[n - 1], cell) === step(path[at], chain[0])) && fits([at, at]));
        if (options.length === 0) return null;
        out.bigCane = options[Math.floor(random() * options.length)];
        spans.push([out.bigCane.at, out.bigCane.at]);
    }
    return out;
}

// The big zapper's block: the dead end's first block in from the opening, across its middle
function rowBlock(from, cell) {
    const di = cell.i - from.i;
    const dj = cell.j - from.j;
    return [di === 0 ? 4 * cell.i + 2 : 4 * cell.i + (di > 0 ? 1 : 3), dj === 0 ? 4 * cell.j + 2 : 4 * cell.j + (dj > 0 ? 1 : 3)];
}

function gapBlocks(cells) {
    const out = [];
    const x0 = 4 * Math.min(...cells.map((c) => c.i)) + 1;
    const z0 = 4 * Math.min(...cells.map((c) => c.j)) + 1;
    const x1 = 4 * Math.max(...cells.map((c) => c.i)) + 3;
    const z1 = 4 * Math.max(...cells.map((c) => c.j)) + 3;
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) out.push([x, z]);
    return out;
}
let best = null;
const why = {};
const fail = (k) => { why[k] = (why[k] ?? 0) + 1; };
for (let seed = FIRST_SEED; seed < FIRST_SEED + SEEDS && !best; seed++) {
    const random = mulberry32(seed);
    const path = layPath(random);
    if (!path || path[0].j === PREVIOUS_START_ROW) { fail('path'); continue; }
    let hung = hang(path, random);
    if (!hung) { fail('hang'); continue; }
    const startCell = path[0];
    const exitCell = path[path.length - 1];
    const onPath = new Map(path.map((c, index) => [key(c), index]));
    // Placing is random, so a crowded level can ask for many tries; with
    // armBelts, each try also hangs the dead ends off new path cells (so a
    // long hallway can be left clear)
    for (let t = 0; t < (rule.placeTries ?? 1) && !best; t++) {
        if (t > 0 && rule.armBelts) hung = link(path, hung.sneaky, hung.chains, onPath, random);
        const { solution, deadEnds, maxBranchDepth } = analyzeMaze(hung.links, startCell, exitCell);
        if (solution.length !== PATH_LENGTH || deadEnds.length !== DEAD_ENDS + (rule.sneaky ? 1 : 0)) { fail('count'); break; }
        if (maxBranchDepth !== (rule.sneaky ? Math.max(3, DEPTH) : DEPTH)) { fail('depth'); break; }
        if (!deadEnds.every((d) => d.depth === DEPTH || (rule.sneaky && d.depth === 3))) break;
        const placed = place(path, hung, random);
        if (!placed) { fail('place'); continue; }
        const plainLayout = toLayout(hung.links, { startCell, exitCell, spikeCell: hung.sneaky?.s });
        if (!differentEnough(shape(plainLayout))) { fail('same'); continue; }
        if (hung.sneaky && spikeVisible(plainLayout, solution)) { fail('visible'); continue; }
        best = { seed, path, hung, placed, solution, deadEnds, startCell, exitCell };
    }
}
if (!best) {
    console.error('No maze found; loosen the rules.', JSON.stringify(why));
    process.exit(1);
}

const { path, hung, placed } = best;
const layout = toLayout(hung.links, { startCell: best.startCell, exitCell: best.exitCell, spikeCell: hung.sneaky ? hung.sneaky.s : placed.pathCane !== undefined ? path[placed.pathCane] : null }).map((r) => r.split(''));
const put = ([x, z], ch) => { layout[z][x] = ch; };
if (hung.sneaky && placed.pathCane !== undefined) put([4 * path[placed.pathCane].i + 2, 4 * path[placed.pathCane].j + 2], 'Z');
if (placed.bigCane) put(rowBlock(path[placed.bigCane.at], placed.bigCane.chain[0]), 'Y');
for (const g of placed.rivers) for (const b of gapBlocks([...Array(GAP_CELLS).keys()].map((d) => path[g + d]))) put(b, 'F');
for (const { h, b: first } of placed.belts) {
    const belt = [...Array(BELT_CELLS).keys()].map((d) => path[first + d]);
    // The belt, plus the gap in the wall between the cell before it and the belt
    for (const b of gapBlocks(belt)) put(b, 'B');
    const before = path[first - 1];
    const [dx, dz] = step(before, path[first]).split(',').map(Number);
    for (const c of [1, 2, 3]) put(dx ? [4 * before.i + (dx > 0 ? 4 : 0), 4 * before.j + c] : [4 * before.i + c, 4 * before.j + (dz > 0 ? 4 : 0)], 'B');
    put([4 * path[h].i + 2, 4 * path[h].j + 2], 'L');
}
for (const { b: first } of placed.armBelts) {
    const belt = [...Array(ARM_BELT_CELLS).keys()].map((d) => path[first + d]);
    for (const b of gapBlocks(belt)) put(b, 'A');
    const before = path[first - 1];
    const [dx, dz] = step(before, path[first]).split(',').map(Number);
    for (const c of [1, 2, 3]) put(dx ? [4 * before.i + (dx > 0 ? 4 : 0), 4 * before.j + c] : [4 * before.i + c, 4 * before.j + (dz > 0 ? 4 : 0)], 'A');
    put([4 * before.i + 2, 4 * before.j + 2], 'R');
}

console.log(layout.map((row) => `        '${row.join('')}',`).join('\n'));
const dir = (n) => ({ '1,0': 'east', '-1,0': 'west', '0,1': 'south', '0,-1': 'north' })[step(path[n - 1], path[n])];
console.log(`\n${rule.name}: seed ${best.seed}, 13x13, start row ${best.startCell.j} west, door row ${best.exitCell.j} east, ` +
    `path ${best.solution.length} cells, ${best.deadEnds.length} dead ends (depths ${best.deadEnds.map((d) => d.depth).join(',')})`);
if (hung.sneaky) console.log(`sneaky zapper: dead end off path cell ${hung.sneaky.index + 1}, zapper in cell ${key(hung.sneaky.s)}`);
placed.rivers.forEach((g) => console.log(`gap: path cells ${g + 1}-${g + GAP_CELLS}, crossed heading ${dir(g)}`));
placed.belts.forEach(({ h, e, b }) => console.log(`belt: hallway path cells ${h + 1}-${e + 1} heading ${dir(h + 1)}, belt on path cells ${b + 1}-${b + BELT_CELLS}, fling to cell ${key(path[h])}`));
placed.armBelts.forEach(({ h, e, b }) => console.log(`arm belt: hallway path cells ${h + 1}-${e + 1} heading ${dir(h + 1)}, belt on path cells ${b + 1}-${b + ARM_BELT_CELLS}, push to cell ${key(path[b - 1])}`));
if (placed.pathCane !== undefined) console.log(`path zapper: path cell ${placed.pathCane + 1} (${key(path[placed.pathCane])}), heading ${dir(placed.pathCane)}`);
if (placed.bigCane) console.log(`big zapper: dead end off path cell ${placed.bigCane.at + 1}, first cell ${key(placed.bigCane.chain[0])}`);
