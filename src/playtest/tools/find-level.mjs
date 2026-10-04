// Searches for a maze that fits a level's rules, and prints it as a layout
// to paste into js/levels.js.
//
//   node tools/find-level.mjs [5]        # Level 1 rules, 5 (or 4) short dead ends
//   node tools/find-level.mjs level2     # Level 2 rules
//   node tools/find-level.mjs level3     # Level 3 rules
//   node tools/find-level.mjs level4     # Level 4 rules (Level 3's, new start row)
//   node tools/find-level.mjs level5     # Level 5 rules (path spike + a dead end blocked by a spike row)
//   node tools/find-level.mjs level6     # Level 6 rules (Level 5's, new layout and start row)
//   node tools/find-level.mjs level7     # Level 7 rules (Level 6's with 3 dead ends 3 cells deep)
//   node tools/find-level.mjs level8     # Level 8 rules (Level 7's, new layout and start row)
//   node tools/find-level.mjs level9     # Level 9 rules (the spike row hidden round a dead end's corner)
//   node tools/find-level.mjs level10    # Level 10 rules (Level 8's again: a visible spike row, new layout)
//   node tools/find-level.mjs level11    # Level 11 rules (Space World: 6 x 6, Level 2's dead ends, Level 1's hidden spike)
//   node tools/find-level.mjs level12    # Level 12 rules (6 x 6, 2-cell dead ends, no spikes, a space door on the path)
//   node tools/find-level.mjs level13    # Level 13 rules (Level 12's plus a slippery spot on the path, away from the door)
//   node tools/find-level.mjs level14    # Level 14 rules (Level 12's plus a spike on the path, away from the door)
//   node tools/find-level.mjs level15    # Level 15 rules (no door; slippery spot + path spike + a spike row in a straight dead end)
//   node tools/find-level.mjs level16    # Level 16 rules (Level 15's with two slippery spots and a space door)
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
// Level 4 rules (Iteration 16): the same as Level 3, starting in a row none of
// Levels 1-3 start in, so the layout is new. (Its narrower gap is the spike's
// size in js/levels.js, not the layout.)
//
// Level 5 rules (Iteration 17): Level 3's, plus a second spike: a row of
// spikes ('Y') across the whole corridor just inside the opening of a
// straight dead end that branches off the path, so going in always touches
// it, you can see it from the path, and it never reaches into the path.
//
// Level 12 rules (Iteration 24): 6 x 6, 6 dead ends each 2 cells deep, no
// spikes, and one space door ('G' across the gap between two path cells) in a
// straight stretch near the middle of the path, so you see it coming. Starts in
// a different row from Level 11.
//
// Level 13 rules (Iteration 25): Level 12's, plus one slippery spot ('I', a
// one-block strip right across the corridor) in the middle of a plain, straight
// path cell, with at least 2 path cells between it and the door. Starts in a
// row neither Level 11 nor Level 12 starts in.
//
// Level 14 rules (Iteration 26): Level 12's, plus one spike ('X') in the
// middle of a plain path cell with straight path in (two cells) and out, so you
// see it coming, and at least 2 path cells between it and the door (the
// obstacle-spacing rule). Starts in a row none of Levels 11-13 start in.
//
// Level 15 rules (Iteration 27): 6 x 6, 6 dead ends each 2 cells deep, no
// space door. One slippery spot ('I') in a plain straight path cell, one spike
// ('X') on the path like Level 14's, and a spike row ('Y') just inside the
// opening of a straight dead end, visible from the path. Spacing rule: at
// least 2 path cells between the slippery spot, the path spike and the path
// cell the blocked dead end opens off. Starts in a row Level 14 doesn't.
//
// Level 16 rules (Iteration 28): Level 15's, plus a second slippery spot and a
// space door ('G') in a straight stretch, with at least 2 dead ends branching
// off the path after the door (so reaching it doesn't give the rest away). The
// spacing rule covers all five: both slippery spots, the path spike, the
// blocked dead end's opening and the door. Starts in a row Level 15 doesn't.
//
// Every cell not on the path belongs to a dead end, so for Level 1 the path
// covers 25 - 5 - 3 = 17 cells (Level 2: 25 - 8 - 3 = 14). The search lays a
// random path of that length and keeps it if the cells it leaves over can be
// hung off it that way.
import { mulberry32, analyzeMaze, toLayout } from '../js/mazeCarver.js';
import { LEVELS } from '../js/levels.js';

// Walls only, so a new level (Level 5 on) can't repeat an existing level's maze
const shape = (rows) => rows.map((r) => r.replace(/[^#]/g, ' ')).join('\n');
// (every level except the one being made, so re-running a level's command finds it again)
const TARGET = { level5: 'Level 5', level6: 'Level 6', level7: 'Level 7', level8: 'Level 8', level9: 'Level 9', level10: 'Level 10', level11: 'Level 11', level12: 'Level 12', level13: 'Level 13', level14: 'Level 14', level15: 'Level 15', level16: 'Level 16' }[process.argv[2]];
const EXISTING = new Set(LEVELS.filter((l) => l.name !== TARGET).map((l) => shape(l.layout)));
// Level 8 on: also clearly different (at least MIN_DIFFERENT blocks of wall
// changed against every earlier level) and the spike row somewhere new
const MIN_DIFFERENT = 24;
const OTHERS = LEVELS.filter((l) => l.name !== TARGET).map((l) => shape(l.layout));
const OTHER_ROWS = new Set(LEVELS.filter((l) => l.name !== TARGET).flatMap((l) => l.layout.flatMap((r, z) => [...r].map((ch, x) => (ch === 'Y' ? `${x},${z}` : null)).filter(Boolean))));
const differentEnough = (layoutShape) => OTHERS.every((o) => [...o].filter((ch, k) => ch !== layoutShape[k]).length >= MIN_DIFFERENT);

// Level 11 (Space World): 6 x 6, dead ends 2 cells deep like Level 2 and a
// hidden spike trail like Level 1 (3 cells, one turn, out of sight of the path)
const LEVEL11 = process.argv[2] === 'level11';
// Level 12: 6 x 6 with 2-cell dead ends again, no spikes, a space door on the path
const LEVEL13 = process.argv[2] === 'level13'; // Level 12's plus a slippery spot
const LEVEL14 = process.argv[2] === 'level14'; // Level 12's plus a spike on the path
const LEVEL16 = process.argv[2] === 'level16'; // Level 15's plus a second slippery spot and a space door
const LEVEL15 = process.argv[2] === 'level15' || LEVEL16; // slippery spot, path spike, spike row in a dead end
const LEVEL12 = process.argv[2] === 'level12' || LEVEL13 || LEVEL14;
const COLS = LEVEL11 || LEVEL12 || LEVEL15 ? 6 : 5;
const ROWS = LEVEL11 || LEVEL12 || LEVEL15 ? 6 : 5;
const LEVEL2 = process.argv[2] === 'level2';
const LEVEL3 = ['level3', 'level4', 'level5', 'level6', 'level7', 'level8', 'level9', 'level10'].includes(process.argv[2]); // spike on the path
const LEVEL4 = process.argv[2] === 'level4';
const LEVEL5 = ['level5', 'level6', 'level7', 'level8', 'level9', 'level10'].includes(process.argv[2]); // plus a spike row in a dead end
const LEVEL6 = process.argv[2] === 'level6';
const LEVEL7 = ['level7', 'level8', 'level9', 'level10'].includes(process.argv[2]); // longer wrong ways: 3 dead ends 3 cells deep
const LEVEL8 = ['level8', 'level9', 'level10'].includes(process.argv[2]); // clearly new layout and spike-row spot
const LEVEL9 = process.argv[2] === 'level9'; // the spike row hidden just round a dead end's corner
const LEVEL10 = process.argv[2] === 'level10'; // the finale: a visible spike row again
const SHORT_DEAD_ENDS = LEVEL11 || LEVEL12 || LEVEL15 ? 6 : LEVEL7 ? 3 : LEVEL2 || LEVEL3 ? 4 : Number(process.argv[2] ?? 5); // Level 1: 4 or 5 per the plan
const SHORT_DEPTH = LEVEL11 || LEVEL12 || LEVEL15 || (!LEVEL7 && (LEVEL2 || LEVEL3)) ? 2 : LEVEL7 ? 3 : 1; // how deep each of those dead ends is
const SPIKE_DEPTH = LEVEL3 || LEVEL12 || LEVEL15 ? 0 : 3; // Level 3's spike is on the path, not in a dead end
const SPIKE_BRANCH_WITHIN = 3; // the spike dead end leaves the path in its first 3 cells
const PATH_LENGTH = COLS * ROWS - SHORT_DEAD_ENDS * SHORT_DEPTH - SPIKE_DEPTH;
// Earlier levels' start rows; each new level starts somewhere new
const LEVEL1_START_ROW = 3;
const LEVEL2_START_ROW = 2;
const LEVEL3_START_ROW = 4;
const LEVEL4_START_ROW = 0;
const LEVEL5_START_ROW = 4;
const LEVEL6_START_ROW = 0;
const LEVEL7_START_ROW = 4;
const LEVEL8_START_ROW = 1;
const LEVEL9_START_ROW = 4;
const LEVEL11_START_ROW = 3;
const LEVEL12_START_ROW = 1;
const LEVEL13_START_ROW = 5;
const LEVEL14_START_ROW = 4;
const LEVEL15_START_ROW = 3;
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
    if (SHORT_DEPTH > 2) return splitIntoLongDeadEnds(cells, onPath, random);
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

// Dead ends 3 or more cells deep (Level 7 on): backtrack, each time covering the
// first cell left with some chain of SHORT_DEPTH cells whose first cell touches the path
function splitIntoLongDeadEnds(cells, onPath, random) {
    const left = new Set(cells.map(key));
    const byKey = new Map(cells.map((c) => [key(c), c]));
    const touchesPath = (c) => neighbours(c).some((n) => onPath.has(key(n)));
    // Every chain of SHORT_DEPTH free cells that runs from `start` without crossing itself
    function chainsFrom(start) {
        const out = [];
        const walk = (chain) => {
            if (chain.length === SHORT_DEPTH) return out.push(chain.slice());
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
        // Level 5: a straight dead end (path cell -> first -> last in a line) for the spike row
        let blocker = null;
        if (LEVEL5) {
            const options = LEVEL9
                // Level 9: the dead end turns at its first cell, then runs straight; the
                // row sits in the cell right after the turn, so neither the path nor the
                // opening can see it. It branches off within the first 3 path cells.
                ? chains.flatMap((chain, c) => {
                    const from = roots[c];
                    const dirs = chain.map((cell, n) => step(n === 0 ? from : chain[n - 1], cell));
                    const turns = dirs.slice(1).map((d, n) => (d !== dirs[n] ? n + 1 : -1)).filter((n) => n > 0);
                    if (turns.length !== 1 || path.findIndex((p) => key(p) === key(from)) > 2) return [];
                    const t = turns[0]; // the first cell after the turn
                    return [{ chain, from, rowFrom: chain[t - 1], rowCell: chain[t], middle: true }];
                })
                : chains.map((chain, c) => ({ chain, from: roots[c], rowFrom: roots[c], rowCell: chain[0] }))
                    .filter(({ chain, from }) => chain.every((c, n) => step(n === 0 ? from : chain[n - 1], c) === step(from, chain[0])));
            if (options.length === 0) continue;
            blocker = options[Math.floor(random() * options.length)];
        }
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
        return { links, spikeCell: spike, spikeIndex: k, blocker };
    }
    return null;
}

// Level 12: every leftover cell becomes a 2-cell dead end (no spike), and the
// space door goes between two path cells k and k+1 in the middle part of the
// path, with the path running straight through it (k-1, k, k+1, k+2 in a line)
function hangDoor(path, random) {
    const onPath = new Set(path.map(key));
    const leftover = [];
    for (let i = 0; i < COLS; i++) {
        for (let j = 0; j < ROWS; j++) if (!onPath.has(`${i},${j}`)) leftover.push({ i, j });
    }
    const chains = splitIntoDeadEnds(leftover, onPath, random);
    if (!chains) return null;
    const step = (p, q) => `${q.i - p.i},${q.j - p.j}`;
    const candidates = [];
    for (let k = Math.ceil(path.length * 0.35); k <= Math.floor(path.length * 0.65); k++) {
        const d = step(path[k], path[k + 1]);
        if (step(path[k - 1], path[k]) === d && step(path[k + 1], path[k + 2]) === d) candidates.push(k);
    }
    if (candidates.length === 0) return null;
    const doorIndex = candidates[Math.floor(random() * candidates.length)];
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
    for (const chain of chains) {
        link(chain[0], shuffle(neighbours(chain[0]).filter((n) => onPath.has(key(n))), random)[0]);
        for (let n = 1; n < chain.length; n++) link(chain[n - 1], chain[n]);
    }
    return { links, doorIndex };
}

// Level 13: a path cell for the slippery spot: straight through (no turn, no
// dead end off it) and at least 2 path cells away from the door between path
// cells doorIndex and doorIndex + 1. Returns its index on the path, or -1.
// Level 14 (spike): also two straight cells leading in, and in the middle part of the path.
function slipperyIndex(path, links, doorIndex, random, spike = false) {
    const step = (p, q) => `${q.i - p.i},${q.j - p.j}`;
    const options = [];
    for (let k = spike ? 2 : 1; k < path.length - 1; k++) {
        const between = k <= doorIndex ? doorIndex - k : k - doorIndex - 2;
        if (between < 2) continue;
        if (step(path[k - 1], path[k]) !== step(path[k], path[k + 1])) continue;
        if (spike && (step(path[k - 2], path[k - 1]) !== step(path[k - 1], path[k]) || k < path.length * 0.25 || k > path.length * 0.75)) continue;
        if (links[path[k].i][path[k].j].length !== 2) continue;
        options.push(k);
    }
    return options.length ? options[Math.floor(random() * options.length)] : -1;
}

// Level 15: no door. Hang the dead ends, then place the slippery spot, the path
// spike and the spike-row dead end with at least 2 path cells between any two
// of them (for the dead end, counted from the path cell it opens off).
function hangLevel15(path, random) {
    const onPath = new Set(path.map(key));
    const leftover = [];
    for (let i = 0; i < COLS; i++) {
        for (let j = 0; j < ROWS; j++) if (!onPath.has(`${i},${j}`)) leftover.push({ i, j });
    }
    const chains = splitIntoDeadEnds(leftover, onPath, random);
    if (!chains) return null;
    const index = new Map(path.map((c, k) => [key(c), k]));
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
    for (let n = 1; n < path.length; n++) link(path[n - 1], path[n]);
    chains.forEach((chain, c) => {
        link(chain[0], roots[c]);
        for (let n = 1; n < chain.length; n++) link(chain[n - 1], chain[n]);
    });
    const step = (p, q) => `${q.i - p.i},${q.j - p.j}`;
    const plain = (k) => k > 0 && k < path.length - 1 && links[path[k].i][path[k].j].length === 2 && step(path[k - 1], path[k]) === step(path[k], path[k + 1]);
    const spikes = [];
    for (let k = 2; k < path.length - 1; k++) {
        if (plain(k) && step(path[k - 2], path[k - 1]) === step(path[k - 1], path[k]) && k >= path.length * 0.25 && k <= path.length * 0.75) spikes.push(k);
    }
    const slips = [];
    for (let k = 1; k < path.length - 1; k++) if (plain(k)) slips.push(k);
    // Straight dead ends (path cell -> first -> last in a line) for the spike row
    const blockers = chains.map((chain, c) => ({ chain, from: roots[c], rowFrom: roots[c], rowCell: chain[0], at: index.get(key(roots[c])) }))
        .filter(({ chain, from }) => chain.every((cell, n) => step(n === 0 ? from : chain[n - 1], cell) === step(from, chain[0])));
    const apart = (a, b) => Math.abs(a - b) >= 3; // at least 2 path cells between
    const options = [];
    if (LEVEL16) {
        // The door sits between path cells d and d + 1, in a straight stretch, with
        // at least 2 dead ends opening off path cells after it; cell c is far
        // enough from it with at least 2 path cells between c and the gap
        const rootAt = roots.map((r) => index.get(key(r)));
        const doors = [];
        for (let d = 1; d < path.length - 2; d++) {
            const dir = step(path[d], path[d + 1]);
            if (step(path[d - 1], path[d]) !== dir || step(path[d + 1], path[d + 2]) !== dir) continue;
            if (rootAt.filter((k) => k > d).length >= 2) doors.push(d);
        }
        const fromDoor = (c, d) => (c <= d ? d - c : c - d - 1) >= 3;
        for (const d of shuffle(doors, random)) for (const b of shuffle(blockers.slice(), random)) {
            if (!fromDoor(b.at, d)) continue;
            for (const s of shuffle(spikes.slice(), random)) {
                if (!fromDoor(s, d) || !apart(s, b.at)) continue;
                for (const p of slips) for (const q of slips) {
                    if (q <= p || !apart(p, q) || ![p, q].every((c) => fromDoor(c, d) && apart(c, s) && apart(c, b.at))) continue;
                    options.push({ spikeIndex: s, slipperyIndex: p, slipperyIndex2: q, blocker: b, doorIndex: d });
                }
                if (options.length) break;
            }
            if (options.length) break;
        }
    } else {
        for (const s of spikes) for (const p of slips) for (const b of blockers) {
            if (apart(s, p) && apart(s, b.at) && apart(p, b.at)) options.push({ spikeIndex: s, slipperyIndex: p, blocker: b });
        }
    }
    if (options.length === 0) return null;
    return { links, ...options[Math.floor(random() * options.length)] };
}

// The slippery strip's three blocks: across the middle of its cell, at right
// angles to the way the path runs through it
function slipperyBlocks(cell, next) {
    if (cell.i !== next.i) return [1, 2, 3].map((d) => [4 * cell.i + 2, 4 * cell.j + d]);
    return [1, 2, 3].map((d) => [4 * cell.i + d, 4 * cell.j + 2]);
}

// The space door's three blocks: the wall gap between path cells a and b
function doorBlocks(a, b) {
    if (a.i !== b.i) {
        const x = 4 * Math.max(a.i, b.i);
        return [1, 2, 3].map((d) => [x, 4 * a.j + d]);
    }
    const z = 4 * Math.max(a.j, b.j);
    return [1, 2, 3].map((d) => [4 * a.i + d, z]);
}

// The spike row's block: the dead end's first block in from the opening, across its middle
function rowBlock(blocker) {
    if (!blocker) return null;
    const { rowCell: cell, rowFrom: from, middle } = blocker;
    const di = cell.i - from.i;
    const dj = cell.j - from.j;
    // Normally the cell's first block in from the opening; Level 9's hidden row
    // sits one block further in, in the middle of the cell just round the corner
    const x = di === 0 || middle ? 4 * cell.i + 2 : 4 * cell.i + (di > 0 ? 1 : 3);
    const z = dj === 0 || middle ? 4 * cell.j + 2 : 4 * cell.j + (dj > 0 ? 1 : 3);
    return `${x},${z}`;
}

// Level 9: can the spike row be seen from anywhere on the correct path or
// from the dead end's opening? Straight sight lines over the block map, from
// sample points all over each path cell and the opening, to points all over
// the row's block; a line is blocked if it passes through any wall block.
function rowVisible(rows, blocker, solution) {
    const isWall = (x, z) => rows[Math.floor(z)]?.[Math.floor(x)] !== ' ' && !'SXDY'.includes(rows[Math.floor(z)]?.[Math.floor(x)]);
    const [rx, rz] = rowBlock(blocker).split(',').map(Number);
    const targets = [];
    // The row's own three blocks, across its corridor
    const spansX = blocker.rowCell.j !== blocker.rowFrom.j;
    for (const d of [-1, 0, 1]) for (const fa of [0.1, 0.5, 0.9]) for (const fb of [0.1, 0.5, 0.9]) {
        targets.push(spansX ? [rx + d + fa, rz + fb] : [rx + fa, rz + d + fb]);
    }
    const usable = targets.filter(([x, z]) => !isWall(x, z));
    const viewpoints = [];
    for (const c of solution) for (const fx of [1.45, 2, 2.5, 3, 3.55]) for (const fz of [1.45, 2, 2.5, 3, 3.55]) viewpoints.push([4 * c.i + fx, 4 * c.j + fz]);
    // the opening between the path and the dead end
    const { from, chain } = blocker;
    const ox = 4 * from.i + 2.5 + (chain[0].i - from.i) * 2;
    const oz = 4 * from.j + 2.5 + (chain[0].j - from.j) * 2;
    for (const d of [-1.4, -0.7, 0, 0.7, 1.4]) viewpoints.push(chain[0].i !== from.i ? [ox, oz + d] : [ox + d, oz]);
    const clear = ([ax, az], [bx, bz]) => {
        const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.05);
        for (let k = 1; k < n; k++) if (isWall(ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n)) return false;
        return true;
    };
    return viewpoints.some((v) => usable.some((t) => clear(v, t)));
}

// Can the spike ('X') be seen from anywhere on the given path cells?
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

let best = null;
for (let seed = 1; seed <= SEEDS && !best; seed++) {
    const random = mulberry32(seed);
    const path = layPath(random);
    if (!path) continue;
    if (LEVEL2 && path[0].j === LEVEL1_START_ROW) continue; // start somewhere new
    if (LEVEL3 && (path[0].j === LEVEL1_START_ROW || path[0].j === LEVEL2_START_ROW)) continue;
    if (LEVEL4 && path[0].j === LEVEL3_START_ROW) continue;
    if (LEVEL5 && !LEVEL6 && path[0].j === LEVEL4_START_ROW) continue; // a new layout; only Level 4's start is ruled out
    if (LEVEL6 && path[0].j === LEVEL5_START_ROW) continue;
    if (LEVEL7 && !LEVEL8 && path[0].j === LEVEL6_START_ROW) continue;
    if (LEVEL8 && !LEVEL9 && !LEVEL10 && path[0].j === LEVEL7_START_ROW) continue;
    if (LEVEL10 && path[0].j === LEVEL9_START_ROW) continue;
    if (LEVEL9 && path[0].j === LEVEL8_START_ROW) continue;
    if (LEVEL15) {
        if (path[0].j === (LEVEL16 ? LEVEL15_START_ROW : LEVEL14_START_ROW)) continue;
        const hung = hangLevel15(path, random);
        if (!hung) continue;
        const startCell = path[0];
        const exitCell = path[path.length - 1];
        const { solution, deadEnds, maxBranchDepth } = analyzeMaze(hung.links, startCell, exitCell);
        const ok = solution.length === PATH_LENGTH &&
            deadEnds.length === SHORT_DEAD_ENDS &&
            deadEnds.every((d) => d.depth === SHORT_DEPTH) &&
            maxBranchDepth === SHORT_DEPTH;
        const candidateShape = shape(toLayout(hung.links, { startCell, exitCell }));
        if (ok && !EXISTING.has(candidateShape) && differentEnough(candidateShape)) {
            best = { seed, links: hung.links, startCell, exitCell, spikeCell: path[hung.spikeIndex], solution, deadEnds, spikeIndex: hung.spikeIndex,
                slippery: [path[hung.slipperyIndex], path[hung.slipperyIndex + 1]], slipperyIndex: hung.slipperyIndex, blocker: hung.blocker };
            if (LEVEL16) {
                Object.assign(best, {
                    slippery2: [path[hung.slipperyIndex2], path[hung.slipperyIndex2 + 1]], slipperyIndex2: hung.slipperyIndex2,
                    door: [path[hung.doorIndex], path[hung.doorIndex + 1]], doorIndex: hung.doorIndex,
                });
            }
        }
        continue;
    }
    if (LEVEL12) {
        if (path[0].j === LEVEL11_START_ROW || ((LEVEL13 || LEVEL14) && path[0].j === LEVEL12_START_ROW)) continue;
        if (LEVEL14 && path[0].j === LEVEL13_START_ROW) continue;
        const hung = hangDoor(path, random);
        if (!hung) continue;
        const slippery = LEVEL13 ? slipperyIndex(path, hung.links, hung.doorIndex, random) : -1;
        if (LEVEL13 && slippery < 0) continue;
        const spikeAt = LEVEL14 ? slipperyIndex(path, hung.links, hung.doorIndex, random, true) : -1;
        if (LEVEL14 && spikeAt < 0) continue;
        const startCell = path[0];
        const exitCell = path[path.length - 1];
        const { solution, deadEnds, maxBranchDepth } = analyzeMaze(hung.links, startCell, exitCell);
        const ok = solution.length === PATH_LENGTH &&
            deadEnds.length === SHORT_DEAD_ENDS &&
            deadEnds.every((d) => d.depth === SHORT_DEPTH) &&
            maxBranchDepth === SHORT_DEPTH;
        const candidateShape = shape(toLayout(hung.links, { startCell, exitCell }));
        if (ok && !EXISTING.has(candidateShape) && differentEnough(candidateShape)) {
            if (LEVEL14) {
                best = { seed, links: hung.links, startCell, exitCell, spikeCell: path[spikeAt], solution, deadEnds, door: [path[hung.doorIndex], path[hung.doorIndex + 1]], doorIndex: hung.doorIndex, spikeIndex: spikeAt };
                continue;
            }
            best = { seed, links: hung.links, startCell, exitCell, solution, deadEnds, door: [path[hung.doorIndex], path[hung.doorIndex + 1]], doorIndex: hung.doorIndex,
                slippery: LEVEL13 ? [path[slippery], path[slippery + 1]] : null, slipperyIndex: slippery };
        }
        continue;
    }
    const hung = LEVEL3 ? hangPathSpike(path, random) : hangDeadEnds(path, random);
    if (!hung) continue;

    // Level 11: the spike must be out of sight from everywhere on the path
    if (LEVEL11) {
        const rows = toLayout(hung.links, { startCell: path[0], exitCell: path[path.length - 1], spikeCell: hung.spikeCell });
        if (spikeVisible(rows, path)) continue;
    }

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
        const candidateShape = shape(toLayout(hung.links, { startCell, exitCell, spikeCell: hung.spikeCell }));
        if (LEVEL9 && hung.blocker && rowVisible(toLayout(hung.links, { startCell, exitCell, spikeCell: hung.spikeCell }), hung.blocker, solution)) continue;
        const isNew = !EXISTING.has(candidateShape) && (!LEVEL8 || (differentEnough(candidateShape) && !OTHER_ROWS.has(rowBlock(hung.blocker))));
        if (ok && (isNew || !LEVEL5)) best = { seed, links: hung.links, startCell, exitCell, spikeCell: hung.spikeCell, solution, deadEnds, spike: { fromStart: hung.spikeIndex }, blocker: hung.blocker };
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
if (LEVEL5 && EXISTING.has(shape(layout))) {
    console.error('Found only a maze that is already a level; loosen the rules.');
    process.exit(1);
}
if (best.blocker) {
    const [x, z] = rowBlock(best.blocker).split(',').map(Number);
    const row = layout[z].split('');
    row[x] = 'Y';
    layout[z] = row.join('');
}
for (const strip of [best.slippery, best.slippery2].filter(Boolean)) {
    for (const [x, z] of slipperyBlocks(...strip)) {
        const row = layout[z].split('');
        row[x] = 'I';
        layout[z] = row.join('');
    }
}
if (best.door) {
    for (const [x, z] of doorBlocks(...best.door)) {
        const row = layout[z].split('');
        row[x] = 'G';
        layout[z] = row.join('');
    }
}
console.log(layout.map((row) => `        '${row}',`).join('\n'));
console.log(`\nseed ${best.seed}: ${COLS}x${ROWS}, path ${best.solution.length} cells, ` +
    `${best.deadEnds.length} dead ends (depths ${best.deadEnds.map((d) => d.depth).join(',')}), ` +
    (best.slippery ? `slippery spot in path cell ${best.slipperyIndex + 1}, ` : '') +
    (best.slippery2 ? `second slippery spot in path cell ${best.slipperyIndex2 + 1}, ` : '') +
    (best.spikeIndex !== undefined ? `spike in path cell ${best.spikeIndex + 1}, ` : '') +
    (best.door ? `space door between path cells ${best.doorIndex + 1} and ${best.doorIndex + 2}` : best.spike ? `spike ${best.spike.fromStart} cells from start` : '') +
    (best.blocker ? `, spike row in the dead end at ${best.blocker.rowCell.i},${best.blocker.rowCell.j}` : '') +
    (best.blocker?.at !== undefined ? ` (opening off path cell ${best.blocker.at + 1})` : ''));
