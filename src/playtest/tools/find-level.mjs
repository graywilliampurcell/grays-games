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
//   node tools/find-level.mjs level17    # Level 17 rules (a moving-platform gap, a space door, a slippery spot, a path spike)
//   node tools/find-level.mjs level18    # Level 18 rules (Level 17's plus a spike row in a straight dead end)
//   node tools/find-level.mjs level19    # Level 19 rules (Level 18's with the spike row hidden round a corner, like Level 9's)
//   node tools/find-level.mjs level20    # Level 20 rules (Level 18's with a second path spike instead of the door)
//   node tools/find-level.mjs level21    # Level 21 rules (Jungle World: 7 x 7, Level 11's hidden bush, a platform gap)
//   node tools/find-level.mjs level22 7  # Level 22 rules (Level 21's plus a big bush blocking a straight dead end)
//   node tools/find-level.mjs level23 7  # Level 23 rules (Level 21's with two river gaps)
//   node tools/find-level.mjs level24 6  # Level 24 rules (three river gaps, the big bush and the hidden bush)
//   node tools/find-level.mjs level25 7  # Level 25 rules (three river gaps and a bush on the path)
//   node tools/find-level.mjs level26 6  # Level 26 rules (three river gaps, a bush on the path and the hidden bush)
//   node tools/find-level.mjs level27 7  # Level 27 rules (Level 25's; the middle leaf is fast)
//   node tools/find-level.mjs level28 5  # Level 28 rules (Level 27's with 3-cell dead ends; two fast leaves)
//   node tools/find-level.mjs level29 4  # Level 29 rules (Level 26's with 3-cell dead ends; all leaves fast)
//   node tools/find-level.mjs level30 4  # Level 30 rules (Level 29's plus the big bush)
//   node tools/find-level.mjs level31 8  # Level 31 rules (Moon World: 8 x 8, Level 11's hidden crater, no gap)
//   node tools/find-level.mjs level32 8  # Level 32 rules (Level 31's plus a crater on the path, like Level 25's bush)
//   node tools/find-level.mjs level35 8  # Level 35 rules (Level 32's plus Level 33's big crater in a straight dead end)
//   node tools/find-level.mjs level36 8  # Level 36 rules (Level 33's path crater plus a giant crater: a 3-cell platform gap, no big crater)
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
// Level 17 rules (Iteration 29): 6 x 6, 6 dead ends each 2 cells deep, no
// spike row. A gap for the moving platform ('O', no floor) right across two
// plain path cells g and g + 1 and the opening between them, with the path
// running straight from g - 1 to g + 2 so the far side shows from the near
// edge. Plus a space door ('G') in a straight stretch, one slippery spot ('I')
// and one spike ('X') on the path like Level 14's. The spacing rule covers all
// four (both gap cells count). Starts in a row Level 16 doesn't.
//
// Level 18 rules (Iteration 30): Level 17's, plus a spike row ('Y') just inside
// the opening of a straight dead end, visible from the path, like Level 15's.
// The spacing rule covers all five (the dead end counted from the path cell it
// opens off). The door is not right by the start or the exit (path cells 25-80%
// of the way). Starts in a row Level 17 doesn't.
//
// Level 19 rules (Iteration 31): Level 18's, except the spike row hides like
// Level 9's: in a dead end 3 cells deep that runs straight for two cells and
// then turns, with the row in the middle of the cell right after the turn, out of sight of
// the path and the dead end's opening. That dead end opens off one of the
// first 3 path cells. The other 5 dead ends are 2 cells deep. Starts in a row
// Level 18 doesn't.
//
// Level 20 rules (Iteration 32): Level 18's, but no space door; instead a
// second spike on the path ('Z', the tighter squeeze) in a plain straight path
// cell like the first. The spacing rule covers all five: the gap, the slippery
// spot, both path spikes and the blocked dead end's opening. Starts in a row
// Level 19 doesn't.
//
// Level 21 rules (Iteration 34, Jungle World): 7 x 7, dead ends 2 cells deep,
// and the thorny bush ('X') hidden like Level 11's spike: at the end of a dead
// end 3 cells deep with one turn, branching off within the first 3 path
// cells, out of sight of the whole path. Plus a platform gap ('O') like Level
// 17's, at least 2 path cells from the bush dead end's opening. No doors, no
// slippery spots, no spike on the path.
//
// Level 22 rules (Iteration 36): Level 21's, plus a big bush ('Y', like the
// spike rows of Levels 5-8) just inside the opening of a straight 2-cell dead
// end, visible from the path. The spacing rule covers all three: at least 2
// path cells between the gap, the hidden bush's dead-end opening and the big
// bush's dead-end opening. A clearly different layout from every other level.
//
// Level 23 rules (Iteration 38): Level 21's (hidden bush, 2-cell dead ends, no
// big bush), but two platform gaps ('O'), each over two plain path cells in a
// straight stretch of its own (the path turns somewhere between them). The
// spacing rule covers all three: at least 2 path cells between the two gaps
// and between each gap and the hidden bush's dead-end opening. A clearly
// different layout from every other level.
//
// Level 24 rules (Iteration 39): Level 23's with three gaps instead of two,
// plus Level 22's big bush ('Y') just inside the opening of a straight 2-cell
// dead end, visible from the path. The spacing rule covers all five: the
// three gaps and both bush dead ends' openings.
//
// Level 25 rules (Iteration 40): 7 x 7, every dead end 2 cells deep, no
// hidden bush and no big bush. A small bush ('X') on the path like Level 14's
// spike (a plain cell with two straight path cells in and one out, in the
// middle part of the path), plus three gaps like Level 24's. The spacing rule
// covers all four: at least 2 path cells between any two of them.
//
// Level 26 rules (Iteration 41): Level 24's three gaps and hidden bush, no big
// bush, plus a small bush on the path ('Z', with its own plate size) in a
// plain cell with two straight path cells in and one out. The spacing rule
// covers all five: the gaps, the path bush and the hidden bush's opening.
//
// Level 27 rules (Iteration 42): Level 25's. One gap's blocks are written as
// 'F' instead of 'O' (the fast leaf: the second one along the path), and it
// starts in a new row (not Level 25's); otherwise the search is the same.
//
// Levels 28-30 (Iterations 43-45): every dead end 3 cells deep. Level 28 is
// Level 27's with the first and third leaves fast ('F'). Level 29 is Level
// 26's (hidden bush too) with all three leaves fast. Level 30 is Level 29's
// plus Level 24's big bush ('Y') just inside a straight dead end; the spacing
// rule covers all six (three gaps, the path bush, both bush openings).
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
const TARGET = { level5: 'Level 5', level6: 'Level 6', level7: 'Level 7', level8: 'Level 8', level9: 'Level 9', level10: 'Level 10', level11: 'Level 11', level12: 'Level 12', level13: 'Level 13', level14: 'Level 14', level15: 'Level 15', level16: 'Level 16', level17: 'Level 17', level18: 'Level 18', level19: 'Level 19', level20: 'Level 20', level21: 'Level 21', level22: 'Level 22', level23: 'Level 23', level24: 'Level 24', level25: 'Level 25', level26: 'Level 26', level27: 'Level 27', level28: 'Level 28', level29: 'Level 29', level30: 'Level 30', level31: 'Level 31', level32: 'Level 32', level33: 'Level 33', level34: 'Level 34', level35: 'Level 35', level36: 'Level 36' }[process.argv[2]];
const EXISTING = new Set(LEVELS.filter((l) => l.name !== TARGET).map((l) => shape(l.layout)));
// Level 8 on: also clearly different (at least MIN_DIFFERENT blocks of wall
// changed against every earlier level) and the spike row somewhere new
const MIN_DIFFERENT = 24;
const OTHERS = LEVELS.filter((l) => l.name !== TARGET).map((l) => shape(l.layout));
const OTHER_ROWS = new Set(LEVELS.filter((l) => l.name !== TARGET).flatMap((l) => l.layout.flatMap((r, z) => [...r].map((ch, x) => (ch === 'Y' ? `${x},${z}` : null)).filter(Boolean))));
const differentEnough = (layoutShape) => OTHERS.every((o) => [...o].filter((ch, k) => ch !== layoutShape[k]).length >= MIN_DIFFERENT);

// Level 11 (Space World): 6 x 6, dead ends 2 cells deep like Level 2 and a
// hidden spike trail like Level 1 (3 cells, one turn, out of sight of the path)
const LEVEL22 = process.argv[2] === 'level22'; // Level 21's plus a big bush blocking a straight dead end
const LEVEL24 = process.argv[2] === 'level24' || process.argv[2] === 'level30'; // three river gaps, the big bush and the hidden bush
const LEVEL30 = process.argv[2] === 'level30'; // Jungle finale: three fast gaps, path bush, big bush, hidden bush
const LEVEL26 = ['level26', 'level29', 'level30'].includes(process.argv[2]); // three river gaps, a bush on the path and the hidden bush
const LEVEL23 = process.argv[2] === 'level23' || LEVEL24 || LEVEL26; // Level 21's with two (Level 24: three) river gaps
const LEVEL25 = ['level25', 'level27', 'level28'].includes(process.argv[2]);
const DEEP = ['level28', 'level29', 'level30'].includes(process.argv[2]); // dead ends 3 cells deep
// Which gaps get a fast leaf ('F'): 0 = first along the path, 1 = second, 2 = third
const FAST = { level27: [1], level28: [0, 2], level29: [0, 1, 2], level30: [0, 1, 2] }[process.argv[2]] ?? []; // three river gaps and a bush on the path
const GAP_COUNT = LEVEL24 || LEVEL25 || LEVEL26 ? 3 : 2;
const LEVEL21 = process.argv[2] === 'level21' || LEVEL22 || LEVEL23; // Jungle World: 7 x 7, Level 11's hidden bush plus a platform gap
const LEVEL35 = process.argv[2] === 'level35'; // Level 32's plus Level 33's big crater in a straight dead end ('Y')
const LEVEL32 = process.argv[2] === 'level32' || LEVEL35; // Level 31's plus a small crater on the path ('Z'), a new layout
const LEVEL31 = process.argv[2] === 'level31' || LEVEL32;
const LEVEL34 = process.argv[2] === 'level34'; // Level 33's again with a new layout (and a tighter path crater in levels.js)
const LEVEL36 = process.argv[2] === 'level36'; // Moon World: a crater on the path plus a giant crater (a 3-cell platform gap), no big crater
const LEVEL33 = process.argv[2] === 'level33' || LEVEL34 || LEVEL36; // Moon World 8 x 8: a crater on the path plus the big crater in a straight dead end, no hidden crater // Moon World: 8 x 8, Level 11's hidden crater, no platform gap
const LEVEL11 = process.argv[2] === 'level11' || LEVEL21 || LEVEL31;
// Level 12: 6 x 6 with 2-cell dead ends again, no spikes, a space door on the path
const LEVEL13 = process.argv[2] === 'level13'; // Level 12's plus a slippery spot
const LEVEL14 = process.argv[2] === 'level14'; // Level 12's plus a spike on the path
const LEVEL16 = process.argv[2] === 'level16'; // Level 15's plus a second slippery spot and a space door
const LEVEL19 = process.argv[2] === 'level19'; // Level 18's with the spike row hidden round a corner
const LEVEL20 = process.argv[2] === 'level20'; // Level 18's with a second path spike instead of the door
const LEVEL18 = process.argv[2] === 'level18' || LEVEL20; // Level 17's plus a spike row in a straight dead end
const LEVEL17 = process.argv[2] === 'level17' || LEVEL18 || LEVEL19; // a moving-platform gap, a space door, a slippery spot, a path spike
const LEVEL15 = process.argv[2] === 'level15' || LEVEL16; // slippery spot, path spike, spike row in a dead end
const LEVEL12 = process.argv[2] === 'level12' || LEVEL13 || LEVEL14;
const COLS = LEVEL31 || LEVEL33 ? 8 : LEVEL21 || LEVEL25 ? 7 : LEVEL11 || LEVEL12 || LEVEL15 || LEVEL17 ? 6 : 5;
const ROWS = LEVEL31 || LEVEL33 ? 8 : LEVEL21 || LEVEL25 ? 7 : LEVEL11 || LEVEL12 || LEVEL15 || LEVEL17 ? 6 : 5;
const LEVEL2 = process.argv[2] === 'level2';
const LEVEL3 = ['level3', 'level4', 'level5', 'level6', 'level7', 'level8', 'level9', 'level10'].includes(process.argv[2]); // spike on the path
const LEVEL4 = process.argv[2] === 'level4';
const LEVEL5 = ['level5', 'level6', 'level7', 'level8', 'level9', 'level10'].includes(process.argv[2]); // plus a spike row in a dead end
const LEVEL6 = process.argv[2] === 'level6';
const LEVEL7 = ['level7', 'level8', 'level9', 'level10'].includes(process.argv[2]); // longer wrong ways: 3 dead ends 3 cells deep
const LEVEL8 = ['level8', 'level9', 'level10'].includes(process.argv[2]); // clearly new layout and spike-row spot
const LEVEL9 = process.argv[2] === 'level9'; // the spike row hidden just round a dead end's corner
const LEVEL10 = process.argv[2] === 'level10'; // the finale: a visible spike row again
const SHORT_DEAD_ENDS = LEVEL21 || LEVEL25 || LEVEL31 || LEVEL33 ? Number(process.argv[3] ?? 8) : LEVEL19 ? 5 : LEVEL11 || LEVEL12 || LEVEL15 || LEVEL17 ? 6 : LEVEL7 ? 3 : LEVEL2 || LEVEL3 ? 4 : Number(process.argv[2] ?? 5); // Level 1: 4 or 5 per the plan
const SHORT_DEPTH = DEEP ? 3 : LEVEL25 || LEVEL33 || LEVEL11 || LEVEL12 || LEVEL15 || LEVEL17 || (!LEVEL7 && (LEVEL2 || LEVEL3)) ? 2 : LEVEL7 ? 3 : 1; // how deep each of those dead ends is
const SPIKE_DEPTH = LEVEL19 ? 3 : LEVEL25 || LEVEL33 || LEVEL3 || LEVEL12 || LEVEL15 || LEVEL17 ? 0 : 3; // Level 3's spike is on the path, not in a dead end
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
const LEVEL16_START_ROW = 0;
const LEVEL17_START_ROW = 3;
const LEVEL18_START_ROW = 4;
const LEVEL19_START_ROW = 1;
const SEEDS = LEVEL19 ? 40000 : 2000; // Level 19 has many more rules to meet
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
    const roots = chains.map((chain) => pathNeighbour(chain[0]));
    chains.forEach((chain, c) => {
        link(chain[0], roots[c]);
        for (let k = 1; k < chain.length; k++) link(chain[k - 1], chain[k]);
    });
    return { links, spikeCell: s, junctionIndex: path.findIndex((c) => key(c) === key(junction)), chains, roots };
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
        return { links, spikeCell: spike, spikeIndex: k, blocker, chains, roots };
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

// Level 17: hang the dead ends, then place the platform gap (path cells g and
// g + 1, straight from g - 1 to g + 2, neither with a dead end off it), the
// space door (between d and d + 1, in a straight stretch), the slippery spot
// and the path spike, with at least 2 path cells between any two of them.
function hangLevel17(path, random) {
    const onPath = new Set(path.map(key));
    const leftover = [];
    for (let i = 0; i < COLS; i++) {
        for (let j = 0; j < ROWS; j++) if (!onPath.has(`${i},${j}`)) leftover.push({ i, j });
    }
    const step = (p, q) => `${q.i - p.i},${q.j - p.j}`;
    // Level 19: the hidden spike-row dead end, root (path cell 0-2) -> a -> b -> c,
    // straight from the root to b and turning once at b, the same shape as Level
    // 9's (turning at a leaves c in sight of the opening); every other leftover
    // cell in 2-cell dead ends
    let hidden = null;
    let chains;
    if (LEVEL19) {
        const isLeftover = new Set(leftover.map(key));
        const choices = [];
        for (let k = 0; k < 3; k++) {
            for (const a of neighbours(path[k]).filter((n) => isLeftover.has(key(n)))) {
                const b = { i: 2 * a.i - path[k].i, j: 2 * a.j - path[k].j };
                if (!isLeftover.has(key(b))) continue;
                for (const c of neighbours(b).filter((n) => isLeftover.has(key(n)) && step(a, b) !== step(b, n))) {
                    const used = new Set([key(a), key(b), key(c)]);
                    const rest = splitIntoDeadEnds(leftover.filter((x) => !used.has(key(x))), onPath, random);
                    if (rest) choices.push({ k, a, b, c, rest });
                }
            }
        }
        if (choices.length === 0) return null;
        const pick = choices[Math.floor(random() * choices.length)];
        hidden = { chain: [pick.a, pick.b, pick.c], from: path[pick.k], rowFrom: pick.b, rowCell: pick.c, middle: true, at: pick.k };
        chains = pick.rest;
    } else {
        chains = splitIntoDeadEnds(leftover, onPath, random);
        if (!chains) return null;
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
    if (hidden) {
        link(hidden.from, hidden.chain[0]);
        link(hidden.chain[0], hidden.chain[1]);
        link(hidden.chain[1], hidden.chain[2]);
    }
    const roots = chains.map((chain) => shuffle(neighbours(chain[0]).filter((n) => onPath.has(key(n))), random)[0]);
    chains.forEach((chain, c) => {
        link(chain[0], roots[c]);
        for (let n = 1; n < chain.length; n++) link(chain[n - 1], chain[n]);
    });
    const plain = (k) => k > 0 && k < path.length - 1 && links[path[k].i][path[k].j].length === 2 && step(path[k - 1], path[k]) === step(path[k], path[k + 1]);
    // Level 18: straight dead ends (path cell -> first -> last in a line) for the spike row
    const index = new Map(path.map((c, k) => [key(c), k]));
    const blockers = LEVEL18
        ? chains.map((chain, c) => ({ chain, from: roots[c], rowFrom: roots[c], rowCell: chain[0], at: index.get(key(roots[c])) }))
            .filter(({ chain, from }) => chain.every((cell, n) => step(n === 0 ? from : chain[n - 1], cell) === step(from, chain[0])))
        : hidden ? [hidden] : [null];
    const gaps = [];
    for (let g = 2; g < path.length - 3; g++) if (plain(g) && plain(g + 1) && g >= path.length * 0.25 && g + 1 <= path.length * 0.8) gaps.push(g);
    // Level 20 has no door (null: nothing to keep away from)
    const doors = LEVEL20 ? [null] : [];
    for (let d = 1; d < path.length - 2 && !LEVEL20; d++) {
        const dir = step(path[d], path[d + 1]);
        // Levels 18-19: not right by the start or the exit
        if ((LEVEL18 || LEVEL19) && (d < path.length * 0.25 || d > path.length * 0.8)) continue;
        if (step(path[d - 1], path[d]) === dir && step(path[d + 1], path[d + 2]) === dir) doors.push(d);
    }
    const spikes = [];
    for (let k = 2; k < path.length - 1; k++) {
        if (plain(k) && step(path[k - 2], path[k - 1]) === step(path[k - 1], path[k]) && k >= path.length * 0.25 && k <= path.length * 0.75) spikes.push(k);
    }
    const slips = [];
    for (let k = 1; k < path.length - 1; k++) if (plain(k)) slips.push(k);
    const apart = (a, b) => Math.abs(a - b) >= 3; // at least 2 path cells between
    const fromDoor = (c, d) => d === null || (c <= d ? d - c : c - d - 1) >= 3;
    const fromGap = (c, g) => apart(c, g) && apart(c, g + 1);
    const options = [];
    for (const g of gaps) for (const d of doors) {
        if (!fromDoor(g, d) || !fromDoor(g + 1, d)) continue;
        for (const s of spikes) {
            if (!fromDoor(s, d) || !fromGap(s, g)) continue;
            for (const p of slips) {
                if (!fromDoor(p, d) || !fromGap(p, g) || !apart(p, s)) continue;
                for (const b of blockers) {
                    if (b && (!fromDoor(b.at, d) || !fromGap(b.at, g) || !apart(b.at, s) || !apart(b.at, p))) continue;
                    // Level 20: the second path spike, after the first, kept away from all the rest
                    for (const s2 of LEVEL20 ? spikes : [null]) {
                        if (s2 !== null && (s2 <= s || !apart(s2, s) || !fromGap(s2, g) || !apart(s2, p) || (b && !apart(s2, b.at)))) continue;
                        options.push({ gapIndex: g, doorIndex: d, spikeIndex: s, slipperyIndex: p, blocker: b, spikeIndex2: s2 });
                    }
                }
            }
        }
    }
    if (options.length === 0) return null;
    return { links, ...options[Math.floor(random() * options.length)] };
}

// The platform gap's blocks: all of its path cells (two, or Level 36's three
// in a line) and the openings between them
function gapBlocks(...cells) {
    const out = [];
    const x0 = 4 * Math.min(...cells.map((c) => c.i)) + 1;
    const z0 = 4 * Math.min(...cells.map((c) => c.j)) + 1;
    const x1 = 4 * Math.max(...cells.map((c) => c.i)) + 3;
    const z1 = 4 * Math.max(...cells.map((c) => c.j)) + 3;
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) out.push([x, z]);
    return out;
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

// Level 23 on: every way to put `count` gaps on the path, each over two plain
// path cells g and g + 1 with the path straight from g - 1 to g + 2, from path
// cell `first` on, at least 2 path cells apart and with a turn between each two
function gapSets(path, links, first, count) {
    const step = (p, q) => `${q.i - p.i},${q.j - p.j}`;
    const plain = (k) => k > 0 && k < path.length - 1 && links[path[k].i][path[k].j].length === 2 && step(path[k - 1], path[k]) === step(path[k], path[k + 1]);
    const turnBetween = (a, b) => { for (let k = a; k < b; k++) if (step(path[k - 1], path[k]) !== step(path[k], path[k + 1])) return true; return false; };
    const singles = [];
    for (let g = first; g < path.length - 3; g++) if (plain(g) && plain(g + 1)) singles.push(g);
    const sets = [];
    const grow = (set) => {
        if (set.length === count) return sets.push(set);
        const last = set[set.length - 1];
        for (const g of singles) if (last === undefined || (g >= last + 4 && turnBetween(last + 2, g - 1))) grow([...set, g]);
    };
    grow([]);
    return sets;
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
    if (LEVEL17) {
        if (path[0].j === (LEVEL20 ? LEVEL19_START_ROW : LEVEL19 ? LEVEL18_START_ROW : LEVEL18 ? LEVEL17_START_ROW : LEVEL16_START_ROW)) continue;
        const hung = hangLevel17(path, random);
        if (!hung) continue;
        const startCell = path[0];
        const exitCell = path[path.length - 1];
        const { solution, deadEnds, maxBranchDepth } = analyzeMaze(hung.links, startCell, exitCell);
        // Level 19: one more dead end, the hidden one, 3 cells deep
        const ok = solution.length === PATH_LENGTH &&
            deadEnds.length === SHORT_DEAD_ENDS + (LEVEL19 ? 1 : 0) &&
            deadEnds.filter((d) => d.depth !== SHORT_DEPTH).every((d) => LEVEL19 && d.depth === SPIKE_DEPTH) &&
            deadEnds.filter((d) => d.depth === SPIKE_DEPTH && LEVEL19).length === (LEVEL19 ? 1 : 0) &&
            maxBranchDepth === (LEVEL19 ? SPIKE_DEPTH : SHORT_DEPTH);
        // Level 19: the row must be out of sight from the whole path and the dead end's opening
        if (ok && LEVEL19 && rowVisible(toLayout(hung.links, { startCell, exitCell }), hung.blocker, solution)) continue;
        const candidateShape = shape(toLayout(hung.links, { startCell, exitCell }));
        if (ok && !EXISTING.has(candidateShape) && differentEnough(candidateShape)) {
            best = { seed, links: hung.links, startCell, exitCell, spikeCell: path[hung.spikeIndex], solution, deadEnds, spikeIndex: hung.spikeIndex,
                slippery: [path[hung.slipperyIndex], path[hung.slipperyIndex + 1]], slipperyIndex: hung.slipperyIndex,
                door: hung.doorIndex === null ? null : [path[hung.doorIndex], path[hung.doorIndex + 1]], doorIndex: hung.doorIndex,
                gap: [path[hung.gapIndex], path[hung.gapIndex + 1]], gapIndex: hung.gapIndex, blocker: hung.blocker,
                spikeCell2: hung.spikeIndex2 === null ? null : path[hung.spikeIndex2], spikeIndex2: hung.spikeIndex2 };
        }
        continue;
    }
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
    // Level 33: every leftover cell a 2-cell dead end, a crater on the path
    // ('X', path straight from k - 2 to k + 1) and the big crater ('Y') just
    // inside a straight dead end, its opening at least 2 path cells from the
    // path crater; a new start row (Levels 31 and 32 start in rows 3 and 2)
    if (LEVEL33) {
        if (path[0].j === 3 || path[0].j === 2) continue;
        if (LEVEL34 && path[0].j === 1) continue; // Level 33 starts in row 1
        if (LEVEL36 && [1, 4, 7].includes(path[0].j)) continue; // Levels 33-35 start in rows 1, 4, 7
        const hung = hangPathSpike(path, random);
        if (!hung) continue;
        const startCell = path[0];
        const exitCell = path[path.length - 1];
        const { solution, deadEnds, maxBranchDepth } = analyzeMaze(hung.links, startCell, exitCell);
        const ok = solution.length === PATH_LENGTH &&
            deadEnds.length === SHORT_DEAD_ENDS &&
            deadEnds.every((d) => d.depth === SHORT_DEPTH) &&
            maxBranchDepth === SHORT_DEPTH;
        if (!ok || !differentEnough(shape(toLayout(hung.links, { startCell, exitCell })))) continue;
        const step = (p, q) => `${q.i - p.i},${q.j - p.j}`;
        const indexOf = (c) => path.findIndex((p) => key(p) === key(c));
        // Level 36: the giant crater, a platform gap over three plain path
        // cells g, g + 1, g + 2 with the path straight from g - 1 to g + 3,
        // at least 2 path cells from the path crater; no big crater
        if (LEVEL36) {
            const k = hung.spikeIndex;
            const plain = (n) => n > 0 && n < path.length - 1 && hung.links[path[n].i][path[n].j].length === 2 && step(path[n - 1], path[n]) === step(path[n], path[n + 1]);
            const gaps = [];
            for (let g = 3; g < path.length - 4; g++) {
                if (plain(g) && plain(g + 1) && plain(g + 2) && (k <= g - 3 || k >= g + 5)) gaps.push(g);
            }
            if (gaps.length === 0) continue;
            const g = gaps[Math.floor(random() * gaps.length)];
            best = { seed, links: hung.links, startCell, exitCell, spikeCell: hung.spikeCell, solution, deadEnds, spikeIndex: k,
                gap: [path[g], path[g + 1], path[g + 2]], gapIndex: g };
            continue;
        }
        const blockers = hung.chains.map((chain, c) => ({ chain, from: hung.roots[c], rowFrom: hung.roots[c], rowCell: chain[0], at: indexOf(hung.roots[c]) }))
            .filter(({ chain, from, at }) => chain.length === 2 && step(from, chain[0]) === step(chain[0], chain[1]) && Math.abs(at - hung.spikeIndex) - 1 >= 2);
        if (blockers.length === 0) continue;
        best = { seed, links: hung.links, startCell, exitCell, spikeCell: hung.spikeCell, solution, deadEnds, spikeIndex: hung.spikeIndex,
            blocker: blockers[Math.floor(random() * blockers.length)] };
        continue;
    }
    if (LEVEL25) {
        if (path[0].j === 3) continue; // Levels 22-24 all start in row 3
        if (process.argv[2] === 'level27' && path[0].j === 4) continue; // and Level 25 in row 4
        const hung = hangPathSpike(path, random);
        if (!hung) continue;
        const startCell = path[0];
        const exitCell = path[path.length - 1];
        const { solution, deadEnds, maxBranchDepth } = analyzeMaze(hung.links, startCell, exitCell);
        const ok = solution.length === PATH_LENGTH &&
            deadEnds.length === SHORT_DEAD_ENDS &&
            deadEnds.every((d) => d.depth === SHORT_DEPTH) &&
            maxBranchDepth === SHORT_DEPTH;
        if (!ok || !differentEnough(shape(toLayout(hung.links, { startCell, exitCell })))) continue;
        const k = hung.spikeIndex;
        const sets = gapSets(path, hung.links, 1, GAP_COUNT).filter((set) => set.every((g) => k <= g - 3 || k >= g + 4));
        if (sets.length === 0) continue;
        const [g1, g2, g3] = sets[Math.floor(random() * sets.length)];
        best = { seed, links: hung.links, startCell, exitCell, spikeCell: hung.spikeCell, solution, deadEnds, spikeIndex: k,
            gap: [path[g1], path[g1 + 1]], gapIndex: g1, gap2: [path[g2], path[g2 + 1]], gapIndex2: g2, gap3: [path[g3], path[g3 + 1]], gapIndex3: g3 };
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

    // Level 32: a crater on the path in plain path cell k, the path straight
    // from k - 2 to k + 1 (seen coming), at least 2 path cells from the hidden
    // crater's dead-end opening; a new start row and a clearly new layout
    if (LEVEL32) {
        if (path[0].j === 3 || !differentEnough(shape(toLayout(hung.links, { startCell, exitCell })))) continue;
        if (LEVEL35 && [1, 2, 4].includes(path[0].j)) continue; // Levels 31-34 start in rows 3, 2, 1, 4
        const step = (p, q) => `${q.i - p.i},${q.j - p.j}`;
        const plain = (k) => hung.links[path[k].i][path[k].j].length === 2;
        const craters = [];
        for (let k = 2; k < path.length - 2; k++) {
            const d = step(path[k - 1], path[k]);
            if (plain(k) && step(path[k - 2], path[k - 1]) === d && step(path[k], path[k + 1]) === d && Math.abs(k - hung.junctionIndex) - 1 >= 2 &&
                k >= path.length * 0.25 && k <= path.length * 0.8) craters.push(k);
        }
        if (craters.length === 0) continue;
        const k = craters[Math.floor(random() * craters.length)];
        Object.assign(hung, { spikeCell2: path[k], spikeIndex2: k });
        // Level 35: the big crater ('Y') just inside a straight 2-cell dead
        // end, its opening at least 2 path cells from the path crater and from
        // the hidden crater's opening
        if (LEVEL35) {
            const indexOf = (c) => path.findIndex((p) => key(p) === key(c));
            const options = hung.chains.map((chain, c) => ({ chain, from: hung.roots[c], rowFrom: hung.roots[c], rowCell: chain[0], at: indexOf(hung.roots[c]) }))
                .filter(({ chain, from, at }) => chain.length === 2 && step(from, chain[0]) === step(chain[0], chain[1]) &&
                    Math.abs(at - k) - 1 >= 2 && Math.abs(at - hung.junctionIndex) - 1 >= 2);
            if (options.length === 0) continue;
            hung.blocker = options[Math.floor(random() * options.length)];
        }
    }

    // Level 21: a platform gap over two plain path cells g and g + 1, the path
    // straight from g - 1 to g + 2, at least 2 path cells from the bush dead end's opening
    let gapIndex;
    if (LEVEL21) {
        const step = (p, q) => `${q.i - p.i},${q.j - p.j}`;
        const plain = (k) => k > 0 && k < path.length - 1 && hung.links[path[k].i][path[k].j].length === 2 && step(path[k - 1], path[k]) === step(path[k], path[k + 1]);
        const gaps = [];
        for (let g = hung.junctionIndex + 3; g < path.length - 3; g++) {
            if (plain(g) && plain(g + 1) && g >= path.length * 0.25 && g + 1 <= path.length * 0.8) gaps.push(g);
        }
        if (gaps.length === 0) continue;
        gapIndex = gaps[Math.floor(random() * gaps.length)];
    }

    // Level 22: the big bush in a straight 2-cell dead end, its opening at
    // least 2 path cells from the hidden bush's opening and from the gap
    let blocker = null;
    if (LEVEL22) {
        if (!differentEnough(shape(toLayout(hung.links, { startCell, exitCell })))) continue;
        const step = (p, q) => `${q.i - p.i},${q.j - p.j}`;
        const indexOf = (c) => path.findIndex((p) => key(p) === key(c));
        const apart = (a, b) => Math.abs(a - b) - 1 >= 2;
        const fromGap = (a, g) => a <= g - 3 || a >= g + 4;
        const blockers = hung.chains.map((chain, c) => ({ chain, from: hung.roots[c], rowFrom: hung.roots[c], rowCell: chain[0], at: indexOf(hung.roots[c]) }))
            .filter(({ chain, from }) => chain.length === 2 && step(from, chain[0]) === step(chain[0], chain[1]));
        const options = [];
        for (const b of blockers) {
            if (!apart(b.at, hung.junctionIndex)) continue;
            for (let g = hung.junctionIndex + 3; g < path.length - 3; g++) {
                const plain = (k) => k > 0 && k < path.length - 1 && hung.links[path[k].i][path[k].j].length === 2 && step(path[k - 1], path[k]) === step(path[k], path[k + 1]);
                if (plain(g) && plain(g + 1) && g >= path.length * 0.25 && g + 1 <= path.length * 0.8 && fromGap(b.at, g)) options.push({ b, g });
            }
        }
        if (options.length === 0) continue;
        const pick = options[Math.floor(random() * options.length)];
        blocker = pick.b;
        gapIndex = pick.g;
    }

    // Level 23: GAP_COUNT gaps, each over two plain path cells g and g + 1
    // with the path straight from g - 1 to g + 2, a turn somewhere between
    // each two, and at least 2 path cells between them and from the hidden
    // bush's opening. Level 24: plus the big bush in a straight 2-cell dead
    // end, its opening at least 2 path cells from all of them.
    let gapIndex2 = null;
    let gapIndex3 = null;
    if (LEVEL23) {
        if (!differentEnough(shape(toLayout(hung.links, { startCell, exitCell })))) continue;
        const step = (p, q) => `${q.i - p.i},${q.j - p.j}`;
        const indexOf = (c) => path.findIndex((p) => key(p) === key(c));
        const sets = gapSets(path, hung.links, hung.junctionIndex + 3, GAP_COUNT);
        // Opening at path cell a is at least 2 path cells from the gap over g, g + 1, and from the hidden bush's opening
        const fromGap = (a, g) => a <= g - 3 || a >= g + 4;
        const options = [];
        // Level 24: the big bush in a straight dead end; Level 26: the bush on
        // the path in plain path cell k, the path straight from k - 2 to k + 1
        const blockers = !LEVEL24 ? [null] : hung.chains.map((chain, c) => ({ chain, from: hung.roots[c], rowFrom: hung.roots[c], rowCell: chain[0], at: indexOf(hung.roots[c]) }))
            .filter(({ chain, from, at }) => chain.length === SHORT_DEPTH && chain.every((c, n) => step(n === 0 ? from : chain[n - 1], c) === step(from, chain[0])) && Math.abs(at - hung.junctionIndex) - 1 >= 2);
        const bushes = [];
        if (LEVEL26) {
            const plain = (k) => hung.links[path[k].i][path[k].j].length === 2;
            for (let k = 2; k < path.length - 2; k++) {
                const d = step(path[k - 1], path[k]);
                if (plain(k) && step(path[k - 2], path[k - 1]) === d && step(path[k], path[k + 1]) === d && Math.abs(k - hung.junctionIndex) - 1 >= 2) bushes.push(k);
            }
        } else {
            bushes.push(undefined);
        }
        for (const set of sets) {
            for (const b of blockers) {
                if (b && !set.every((g) => fromGap(b.at, g))) continue;
                for (const k of bushes) {
                    if (k !== undefined && !set.every((g) => k <= g - 3 || k >= g + 4)) continue;
                    if (k !== undefined && b && Math.abs(k - b.at) - 1 < 2) continue;
                    options.push({ set, b, k });
                }
            }
        }
        if (options.length === 0) continue;
        const pick = options[Math.floor(random() * options.length)];
        [gapIndex, gapIndex2, gapIndex3 = null] = pick.set;
        blocker = pick.b;
        if (pick.k !== undefined) Object.assign(hung, { spikeCell2: path[pick.k], spikeIndex2: pick.k });
    }

    best = { seed, links: hung.links, startCell, exitCell, spikeCell: hung.spikeCell, solution, deadEnds, spike };
    if (LEVEL21) Object.assign(best, { gap: [path[gapIndex], path[gapIndex + 1]], gapIndex });
    if (gapIndex2 !== null) Object.assign(best, { gap2: [path[gapIndex2], path[gapIndex2 + 1]], gapIndex2 });
    if (gapIndex3 !== null) Object.assign(best, { gap3: [path[gapIndex3], path[gapIndex3 + 1]], gapIndex3 });
    if (blocker) best.blocker = blocker;
    if (LEVEL35) best.blocker = hung.blocker;
    if (hung.spikeCell2) Object.assign(best, { spikeCell2: hung.spikeCell2, spikeIndex2: hung.spikeIndex2 });
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
if (best.spikeCell2) {
    // The second path spike ('Z') in the middle of its cell, like toLayout's 'X'
    const row = layout[4 * best.spikeCell2.j + 2].split('');
    row[4 * best.spikeCell2.i + 2] = 'Z';
    layout[4 * best.spikeCell2.j + 2] = row.join('');
}
for (const gap of [best.gap, best.gap2, best.gap3].filter(Boolean)) {
    for (const [x, z] of gapBlocks(...gap)) {
        const row = layout[z].split('');
        row[x] = FAST.includes([best.gap, best.gap2, best.gap3].indexOf(gap)) ? 'F' : 'O'; // Level 27 on: fast leaves
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
    (best.spikeCell2 ? `second spike in path cell ${best.spikeIndex2 + 1}, ` : '') +
    (best.gap ? `platform gap over path cells ${best.gapIndex + 1}-${best.gapIndex + best.gap.length}, ` : '') +
    (best.gap2 ? `second platform gap over path cells ${best.gapIndex2 + 1}-${best.gapIndex2 + 2}, ` : '') +
    (best.gap3 ? `third platform gap over path cells ${best.gapIndex3 + 1}-${best.gapIndex3 + 2}, ` : '') +
    (best.door ? `space door between path cells ${best.doorIndex + 1} and ${best.doorIndex + 2}` : best.spike ? `spike ${best.spike.fromStart} cells from start` : '') +
    (best.blocker ? `, spike row in the dead end at ${best.blocker.rowCell.i},${best.blocker.rowCell.j}` : '') +
    (best.blocker?.at !== undefined ? ` (opening off path cell ${best.blocker.at + 1})` : ''));
