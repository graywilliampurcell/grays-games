// Searches for a maze that fits a level's rules, and prints it as a layout
// to paste into js/levels.js.
//
//   node tools/find-level.mjs [5]        # Level 1 rules, 5 (or 4) short dead ends
//   node tools/find-level.mjs level2     # Level 2 rules
//   node tools/find-level.mjs level3     # Level 3 rules
//
// Level 1 rules (from the Mazle plan, iteration 4): 5 x 5 corridors, start
// on the west edge and door on the east edge, exactly one path to the door,
// 4-5 dead ends exactly 1 cell deep (the end wall is visible from the
// junction), plus the spike dead end, which is 3 cells deep with one 90°
// turn so the spike can't be seen from the junction. It branches off within
// the first 3 cells of the path, so the spike is 3-6 cells from the start.
//
// Level 2 rules (plan Section 2): the same, except about 4 dead ends that are
// each 2 cells deep, and a different layout from Level 1.
//
// Level 3 rules (plan Section 2, Iteration 11): about 4 dead ends each 2 cells
// deep and no spike dead end. The spike is ON the path instead, in the middle
// of a plain corridor cell (no dead end branching off it) in a straight stretch
// near the middle of the path, so you see it coming and walk round it. Start
// row different from Levels 1 and 2.
//
// Every cell not on the path belongs to a dead end, so for Level 1 the path
// covers 25 - 5 - 3 = 17 cells (Level 2: 25 - 8 - 3 = 14). The search lays a
// random path of that length and keeps it if the cells it leaves over can be
// hung off it that way.
import { mulberry32, analyzeMaze, toLayout } from '../js/mazeCarver.js';

const COLS = 5;
const ROWS = 5;
const LEVEL2 = process.argv[2] === 'level2';
const LEVEL3 = process.argv[2] === 'level3';
const SHORT_DEAD_ENDS = LEVEL2 || LEVEL3 ? 4 : Number(process.argv[2] ?? 5); // Level 1: 4 or 5 per the plan
const SHORT_DEPTH = LEVEL2 || LEVEL3 ? 2 : 1; // how deep each of those dead ends is
const SPIKE_DEPTH = LEVEL3 ? 0 : 3; // Level 3's spike is on the path, not in a dead end
const SPIKE_BRANCH_WITHIN = 3; // the spike dead end leaves the path in its first 3 cells
const PATH_LENGTH = COLS * ROWS - SHORT_DEAD_ENDS * SHORT_DEPTH - SPIKE_DEPTH;
// Earlier levels' start rows; each new level starts somewhere new
const LEVEL1_START_ROW = 3;
const LEVEL2_START_ROW = 2;
const SEEDS = 2000;
const STEPS_PER_SEED = 200000;

const DIRECTIONS = [
    { di: 1, dj: 0 },
    { di: -1, dj: 0 },
    { di: 0, dj: 1 },
    { di: 0, dj: -1 },
];
const key = (c) => `${c.i},${c.j}`;
const inside = ({ i, j }) => i >= 0 && i < COLS && j >= 0 && j < ROWS;
const neighbours = (c) => DIRECTIONS.map(({ di, dj }) => ({ i: c.i + di, j: c.j + dj })).filter(inside);
const shuffle = (list, random) => {
    for (let k = list.length - 1; k > 0; k--) {
        const r = Math.floor(random() * (k + 1));
        [list[k], list[r]] = [list[r], list[k]];
    }
    return list;
};

// Random self-avoiding walk of exactly PATH_LENGTH cells from the west edge
// to the east edge (depth-first with backtracking, capped at a step budget)
function layPath(random) {
    const start = { i: 0, j: Math.floor(random() * ROWS) };
    const path = [start];
    const used = new Set([key(start)]);
    let steps = 0;

    function extend() {
        if (++steps > STEPS_PER_SEED) return false;
        const last = path[path.length - 1];
        if (path.length === PATH_LENGTH) return last.i === COLS - 1;
        // Prune: the walk can't reach the east edge in the cells it has left
        if (COLS - 1 - last.i > PATH_LENGTH - path.length) return false;
        // The player starts facing east, so the way on is straight ahead
        const options = path.length === 1 ? [{ i: 1, j: start.j }] : shuffle(neighbours(last), random);
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

// Split the leftover cells into dead ends SHORT_DEPTH cells deep: each one is
// a chain whose first cell touches the path. Returns a list of chains, or null.
function splitIntoDeadEnds(cells, onPath, random) {
    if (SHORT_DEPTH === 1) return cells.every((c) => neighbours(c).some((n) => onPath.has(key(n)))) ? cells.map((c) => [c]) : null;
    // Pairs only (SHORT_DEPTH 2): backtrack over the cells in order
    const left = new Set(cells.map(key));
    const byKey = new Map(cells.map((c) => [key(c), c]));
    const touchesPath = (c) => neighbours(c).some((n) => onPath.has(key(n)));
    const chains = [];
    function pair() {
        if (left.size === 0) return true;
        const first = byKey.get(left.values().next().value);
        left.delete(key(first));
        for (const other of shuffle(neighbours(first).filter((n) => left.has(key(n))), random)) {
            left.delete(key(other));
            for (const [root, tip] of shuffle([[first, other], [other, first]], random)) {
                if (!touchesPath(root)) continue;
                chains.push([root, tip]);
                if (pair()) return true;
                chains.pop();
            }
            left.add(key(other));
        }
        left.add(key(first));
        return false;
    }
    return pair() ? chains : null;
}

// Hang the leftover cells off the path: one 3-cell spike dead end with one
// turn, and the rest as dead ends SHORT_DEPTH cells deep
function hangDeadEnds(path, random) {
    const onPath = new Map(path.map((c, index) => [key(c), index]));
    const leftover = [];
    for (let i = 0; i < COLS; i++) {
        for (let j = 0; j < ROWS; j++) if (!onPath.has(`${i},${j}`)) leftover.push({ i, j });
    }
    const isLeftover = new Set(leftover.map(key));
    const pathNeighbour = (c) => shuffle(neighbours(c).filter((n) => onPath.has(key(n))), random)[0];

    // Spike dead end: junction (path cell 0-2) -> a -> b -> spike, with exactly one 90° turn
    const spikeOptions = [];
    for (let index = 0; index < SPIKE_BRANCH_WITHIN; index++) {
        const junction = path[index];
        for (const a of neighbours(junction).filter((n) => isLeftover.has(key(n)))) {
            for (const b of neighbours(a).filter((n) => isLeftover.has(key(n)))) {
                for (const s of neighbours(b).filter((n) => isLeftover.has(key(n)) && key(n) !== key(a))) {
                    const d1 = `${a.i - junction.i},${a.j - junction.j}`;
                    const d2 = `${b.i - a.i},${b.j - a.j}`;
                    const d3 = `${s.i - b.i},${s.j - b.j}`;
                    const turns = (d1 !== d2 ? 1 : 0) + (d2 !== d3 ? 1 : 0);
                    if (turns !== 1) continue;
                    const branch = new Set([key(a), key(b), key(s)]);
                    // Every other leftover cell must hang off the path as a short dead end
                    const rest = leftover.filter((c) => !branch.has(key(c)));
                    const chains = splitIntoDeadEnds(rest, onPath, random);
                    if (chains) spikeOptions.push({ junction, a, b, s, chains });
                }
            }
        }
    }
    if (spikeOptions.length === 0) return null;
    const { junction, a, b, s, chains } = spikeOptions[Math.floor(random() * spikeOptions.length)];

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
    link(junction, a);
    link(a, b);
    link(b, s);
    for (const chain of chains) {
        link(chain[0], pathNeighbour(chain[0]));
        for (let k = 1; k < chain.length; k++) link(chain[k - 1], chain[k]);
    }
    return { links, spikeCell: s };
}

// Level 3: hang every leftover cell off the path as a 2-cell dead end and put
// the spike on the path: a plain corridor cell (only the path goes through it)
// with at least two cells of straight path leading in and one straight out,
// in the middle part of the path
function hangPathSpike(path, random) {
    const onPath = new Set(path.map(key));
    const leftover = [];
    for (let i = 0; i < COLS; i++) {
        for (let j = 0; j < ROWS; j++) if (!onPath.has(`${i},${j}`)) leftover.push({ i, j });
    }
    const chains = splitIntoDeadEnds(leftover, onPath, random);
    if (!chains) return null;
    const step = (p, q) => `${q.i - p.i},${q.j - p.j}`;
    const candidates = [];
    for (let k = Math.ceil(path.length * 0.3); k <= Math.floor(path.length * 0.7); k++) {
        const d = step(path[k - 1], path[k]);
        if (step(path[k - 2], path[k - 1]) === d && step(path[k], path[k + 1]) === d) candidates.push(k);
    }
    for (const k of shuffle(candidates, random)) {
        const spike = path[k];
        // Each dead end must branch off a path cell other than the spike's
        const roots = chains.map((chain) => shuffle(neighbours(chain[0]).filter((n) => onPath.has(key(n)) && key(n) !== key(spike)), random)[0]);
        if (roots.some((r) => !r)) continue;
        const links = [];
        for (let i = 0; i < COLS; i++) {
            links[i] = [];
            for (let j = 0; j < ROWS; j++) links[i][j] = [];
        }
        const link = (p, q) => {
            links[p.i][p.j].push(q);
            links[q.i][q.j].push(p);
        };
        for (let n = 1; n < path.length; n++) link(path[n - 1], path[n]);
        chains.forEach((chain, c) => {
            link(chain[0], roots[c]);
            for (let n = 1; n < chain.length; n++) link(chain[n - 1], chain[n]);
        });
        return { links, spikeCell: spike, spikeIndex: k };
    }
    return null;
}

let best = null;
for (let seed = 1; seed <= SEEDS && !best; seed++) {
    const random = mulberry32(seed);
    const path = layPath(random);
    if (!path) continue;
    if (LEVEL2 && path[0].j === LEVEL1_START_ROW) continue; // start somewhere new
    if (LEVEL3 && (path[0].j === LEVEL1_START_ROW || path[0].j === LEVEL2_START_ROW)) continue;
    const hung = LEVEL3 ? hangPathSpike(path, random) : hangDeadEnds(path, random);
    if (!hung) continue;

    // Double-check the finished maze with the same analysis the old levels used
    const startCell = path[0];
    const exitCell = path[path.length - 1];
    const { solution, deadEnds, maxBranchDepth } = analyzeMaze(hung.links, startCell, exitCell);
    if (LEVEL3) {
        const ok = solution.length === PATH_LENGTH &&
            deadEnds.length === SHORT_DEAD_ENDS &&
            deadEnds.every((d) => d.depth === SHORT_DEPTH) &&
            maxBranchDepth === SHORT_DEPTH &&
            solution.some((c) => c.i === hung.spikeCell.i && c.j === hung.spikeCell.j);
        if (ok) best = { seed, links: hung.links, startCell, exitCell, spikeCell: hung.spikeCell, solution, deadEnds, spike: { fromStart: hung.spikeIndex } };
        continue;
    }
    const spike = deadEnds.find((d) => d.i === hung.spikeCell.i && d.j === hung.spikeCell.j);
    const short = deadEnds.filter((d) => d !== spike);
    const ok = solution.length === PATH_LENGTH &&
        deadEnds.length === SHORT_DEAD_ENDS + 1 &&
        short.every((d) => d.depth === SHORT_DEPTH) &&
        spike && spike.depth === SPIKE_DEPTH &&
        spike.fromStart >= 3 && spike.fromStart <= 6 &&
        maxBranchDepth === SPIKE_DEPTH;
    if (!ok) continue;

    best = { seed, links: hung.links, startCell, exitCell, spikeCell: hung.spikeCell, solution, deadEnds, spike };
}

if (!best) {
    console.error('No maze found; loosen the rules.');
    process.exit(1);
}

const layout = toLayout(best.links, best);
console.log(layout.map((row) => `        '${row}',`).join('\n'));
console.log(`\nseed ${best.seed}: ${COLS}x${ROWS}, path ${best.solution.length} cells, ` +
    `${best.deadEnds.length} dead ends (depths ${best.deadEnds.map((d) => d.depth).join(',')}), ` +
    `spike ${best.spike.fromStart} cells from start`);
