// Searches for a Dinosaur World level layout (Levels 111-120) that fits
// its rules, and prints it as a js/levels.js layout. Made from
// find-desert-level.mjs (Levels 101-110), at 11 x 11.
//
//   SEEDS=1000 node tools/find-dino-level.mjs level111 26 6601   # the sneaky bone spike + a long-neck ride
//   SEEDS=1000 node tools/find-dino-level.mjs level112 26 1       # a tail swish + a path bone spike
//   SEEDS=1000 node tools/find-dino-level.mjs level113 26 1       # the fossil hunt + a long-neck ride
//   SEEDS=1000 node tools/find-dino-level.mjs level114 26 1       # a big bone spike + a tail swish + a long-neck ride
//   SEEDS=1000 node tools/find-dino-level.mjs level115 26 1       # two tail swishes + the sneaky bone spike
//
// Arguments: rule, [dead ends], [first seed]; SEEDS=n sets how many seeds to
// try. Run many first seeds in parallel.
//
// Layout letters (see js/Maze.js): as in find-desert-level.mjs. Dinosaur
// World reads 'X' as a bone spike, 'O' as the long-neck's pit and 'H' as
// a tail swish (its push leaves you at 'Q'), and 'f' as a fossil (the
// fossil hunt: one in the last cell of each of 3 wrong ways).
//
// Rules for every level: 11 x 11, one solution path from the west edge to
// the east edge, start and door on opposite edges, a layout clearly
// different from every other level. Spacing: at least 2 path cells between
// any two obstacles on the path and between them and every obstacle dead
// end's opening. Dead ends are 2 deep (the sneaky bone spike's is 3) in
// Levels 111-116, 3 deep from Level 117 on.
import { mulberry32, analyzeMaze, toLayout } from '../js/mazeCarver.js';
import { LEVELS } from '../js/levels.js';

const RULES = {
    // Welcome to Dinosaur World: the sneaky bone spike ('X') and one 3-cell
    // pit crossed on the long-neck's head ('O')
    level111: { name: 'Level 111', depth: 2, deadEnds: 26, sneaky: true, platforms: 1, platformCells: 3, prunePairs: true, placeTries: 20 },
    // The first tail swish ('H', with 'Q' where its push leaves you: the
    // middle of the path cell before it) and a path bone spike ('X')
    level112: { name: 'Level 112', depth: 2, deadEnds: 26, pathCane: true, vents: 1, prunePairs: true, placeTries: 20 },
    // The first fossil hunt: 3 fossils ('f'), each in the last cell of its
    // own wrong way (one off each third of the path), and one 3-cell pit
    // crossed on the long-neck's head ('O')
    level113: { name: 'Level 113', depth: 2, deadEnds: 26, fossils: 3, platforms: 1, platformCells: 3, prunePairs: true, placeTries: 20 },
    // The big bone spike ('Y', filling a straight wrong way's opening in
    // plain view), one tail swish ('H' + 'Q') and one 3-cell pit crossed on
    // the long-neck's head ('O')
    level114: { name: 'Level 114', depth: 2, deadEnds: 26, bigCane: true, vents: 1, platforms: 1, platformCells: 3, prunePairs: true, placeTries: 20 },
    // Two tail swishes ('H' + 'Q' each, own straight stretch) and the sneaky
    // bone spike ('X')
    level115: { name: 'Level 115', depth: 2, deadEnds: 26, sneaky: true, vents: 2, ownStretch: true, prunePairs: true, placeTries: 20 },
};
const rule = RULES[process.argv[2]];
if (!rule) {
    console.error(`Usage: node tools/find-dino-level.mjs <${Object.keys(RULES).join('|')}> [dead ends] [first seed]`);
    process.exit(1);
}
const DEAD_ENDS = Number(process.argv[3] ?? rule.deadEnds);
const FIRST_SEED = Number(process.argv[4] ?? 1);
const COLS = 11;
const ROWS = 11;
const GAP_CELLS = 5; // the tire's gap is 5 corridor cells long
const BELT_CELLS = 4; // a backward belt is 4 corridor cells long, after one floor cell
const SNOWMAN_CELLS = 4; // a snowman's hallway is 4 corridor cells long
const ARM_BELT_CELLS = 6; // a robot-arm belt is 6 corridor cells long, in the middle of its hallway
const DEPTH = rule.depth;
const PLATFORM_CELLS = rule.platformCells ?? 2; // a platform gap's length in corridor cells
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

// For rule.prune: every patch of unused cells the path's head can no longer
// reach must already have a multiple of 3 cells, and the patches it can
// reach must hold the rest of the path and touch the east edge
function stillSplits(used, head, remaining) {
    const seen = new Set(used);
    const next = new Set(neighbours(head).map(key));
    let room = 0;
    let east = false;
    for (let i = 0; i < COLS; i++) for (let j = 0; j < ROWS; j++) {
        if (seen.has(`${i},${j}`)) continue;
        let size = 0;
        let reachable = false;
        let touchesEast = false;
        const stack = [{ i, j }];
        seen.add(`${i},${j}`);
        while (stack.length) {
            const c = stack.pop();
            size++;
            if (next.has(key(c))) reachable = true;
            if (c.i === COLS - 1) touchesEast = true;
            for (const n of neighbours(c)) if (!seen.has(key(n))) { seen.add(key(n)); stack.push(n); }
        }
        if (reachable) { room += size; east ||= touchesEast; } else if (size % 3 !== 0) return false;
    }
    return room >= remaining && (east || head.i === COLS - 1);
}

// For rule.prunePairs (2-deep dead ends): every patch of unused cells the
// path's head can no longer reach must already have an even number of cells
// (or, once, an odd one touching the path's first 3 cells for the sneaky
// dead end), and the patches it can reach must hold the rest of the path
function stillPairs(used, head, remaining, path) {
    const seen = new Set(used);
    const next = new Set(neighbours(head).map(key));
    const early = new Set(path.slice(0, 3).map(key));
    let room = 0;
    let east = false;
    let odd = 0;
    for (let i = 0; i < COLS; i++) for (let j = 0; j < ROWS; j++) {
        if (seen.has(`${i},${j}`)) continue;
        let size = 0;
        let reachable = false;
        let touchesEast = false;
        let nearStart = false;
        const stack = [{ i, j }];
        seen.add(`${i},${j}`);
        while (stack.length) {
            const c = stack.pop();
            size++;
            if (next.has(key(c))) reachable = true;
            if (c.i === COLS - 1) touchesEast = true;
            for (const n of neighbours(c)) {
                if (early.has(key(n))) nearStart = true;
                if (!seen.has(key(n))) { seen.add(key(n)); stack.push(n); }
            }
        }
        if (reachable) { room += size; east ||= touchesEast; } else if (size % 2 === 1 && (!rule.sneaky || !nearStart || ++odd > 1)) return false;
    }
    return room >= remaining && (east || head.i === COLS - 1);
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
        if (rule.prune && !stillSplits(used, last, PATH_LENGTH - path.length)) return false;
        if (rule.prunePairs && path.length >= 3 && !stillPairs(used, last, PATH_LENGTH - path.length, path)) return false;
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
    const out = { rivers: [], belts: [], armBelts: [], platforms: [], slippery: [], caramel: [] };
    // Platform gaps (Level 17's): PLATFORM_CELLS plain path cells from g,
    // straight from g - 1 to g + PLATFORM_CELLS, in the middle part of the path
    const last = PLATFORM_CELLS - 1;
    for (let r = 0; r < (rule.platforms ?? 0); r++) {
        const options = [];
        for (let g = 2; g < path.length - 2 - PLATFORM_CELLS; g++) if ([...Array(PLATFORM_CELLS).keys()].every((d) => plain(g + d)) && g >= path.length * 0.25 && g + last <= path.length * 0.8 && fits([g, g + last])) options.push(g);
        if (options.length === 0) return null;
        const g = options[Math.floor(random() * options.length)];
        out.platforms.push(g);
        spans.push([g, g + last]);
    }
    // The space door (Level 12's): the wall gap between path cells d and
    // d + 1, path straight from d - 1 to d + 2, not by the start or the exit
    if (rule.spaceDoor) {
        const options = [];
        for (let d = 1; d < path.length - 2; d++) {
            const dir = step(path[d], path[d + 1]);
            if (d < path.length * 0.25 || d > path.length * 0.8) continue;
            if (step(path[d - 1], path[d]) === dir && step(path[d + 1], path[d + 2]) === dir && fits([d, d + 1])) options.push(d);
        }
        if (options.length === 0) return null;
        out.door = options[Math.floor(random() * options.length)];
        spans.push([out.door, out.door + 1]);
    }
    // The button door: the wall gap between path cells d and d + 1, path
    // straight from d - 1 to d + 2, not by the start or the exit; its button
    // is in the last cell of a 2-deep wrong way branching off the path at
    // most 16 cells before the door (so it can be reached without passing it)
    // (rule.buttonDoors: how many, each with its own button and wrong way)
    out.buttonDoors = [];
    for (let n = 0; n < (rule.buttonDoor ? rule.buttonDoors ?? 1 : 0); n++) {
        const options = [];
        const [low, high] = (rule.buttonDoors ?? 1) > 1 ? [0.2, 0.85] : [0.3, 0.8];
        for (let d = 1; d < path.length - 2; d++) {
            const dir = step(path[d], path[d + 1]);
            if (d < path.length * low || d > path.length * high) continue;
            if (step(path[d - 1], path[d]) !== dir || step(path[d + 1], path[d + 2]) !== dir || !fits([d, d + 1])) continue;
            hung.chains.forEach((chain, c) => {
                const at = hung.roots[c];
                if (chain.length === DEPTH && at < d && at >= d - 10 && chain !== out.bigCane?.chain && out.buttonDoors.every((b) => b.chain !== chain)) options.push({ door: d, chain, at });
            });
        }
        if (options.length === 0) return null;
        const o = options[Math.floor(random() * options.length)];
        out.buttonDoors.push(o);
        spans.push([o.door, o.door + 1]);
    }
    out.buttonDoors.sort((a, b) => a.door - b.door);
    // The fossil hunt: each fossil in the last cell of its own spike-free
    // wrong way, one wrong way branching off each part of the path (the
    // first third, the middle third, the last third for 3 fossils)
    out.fossils = [];
    for (let n = 0; n < (rule.fossils ?? 0); n++) {
        const options = [];
        const [low, high] = [path.length * n / rule.fossils, path.length * (n + 1) / rule.fossils];
        hung.chains.forEach((chain, c) => {
            const at = hung.roots[c];
            if (chain.length === DEPTH && at >= low && at < high && chain !== hung.sneaky?.chain && chain !== out.bigCane?.chain
                && out.buttonDoors.every((b) => b.chain !== chain)) options.push({ chain, at });
        });
        if (options.length === 0) return null;
        out.fossils.push(options[Math.floor(random() * options.length)]);
    }
    out.buttonDoor = out.buttonDoors[0];
    // The spinning secret wall: the wall gap between path cells w and w + 1,
    // with the path straight from w - 1 to w + 2 and nothing branching off
    // cells w and w + 1, so from either side the corridor seems to end at it
    if (rule.spinWall) {
        const options = [];
        for (let w = 2; w < path.length - 3; w++) {
            if (w < path.length * 0.25 || w > path.length * 0.85) continue;
            if (plain(w) && plain(w + 1) && fits([w, w + 1])) options.push(w);
        }
        if (options.length === 0) return null;
        out.spinWall = options[Math.floor(random() * options.length)];
        spans.push([out.spinWall, out.spinWall + 1]);
    }
    // Slippery spots (Level 13's): a plain path cell, kept well away from the
    // door (at least 6 path cells between)
    for (let n = 0; n < (rule.slippery ?? 0); n++) {
        const options = [];
        for (let k = 1; k < path.length - 1; k++) {
            if (!plain(k) || !fits([k, k])) continue;
            if (out.door !== undefined && (k <= out.door ? out.door - k : k - out.door - 1) < 7) continue;
            options.push(k);
        }
        if (options.length === 0) return null;
        const k = options[Math.floor(random() * options.length)];
        out.slippery.push(k);
        spans.push([k, k]);
    }
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
    // The big spike: a straight dead end (all DEPTH cells in a line from its opening)
    if (rule.bigCane) {
        const options = hung.chains.map((chain, c) => ({ chain, at: hung.roots[c] }))
            .filter(({ chain, at }) => out.buttonDoors.every((b) => b.chain !== chain) && out.fossils.every((f) => f.chain !== chain) && chain.every((cell, n) => step(n === 0 ? path[at] : chain[n - 1], cell) === step(path[at], chain[0])) && fits([at, at]));
        if (options.length === 0) return null;
        out.bigCane = options[Math.floor(random() * options.length)];
        spans.push([out.bigCane.at, out.bigCane.at]);
    }
    // The water current (Level 41's): path cell k with the path straight
    // through it and exactly one dead end (2 cells, not the big urchin's)
    // branching off sideways, in the middle part of the path
    if (rule.current) {
        const options = [];
        for (let k = 2; k < path.length - 2; k++) {
            if (step(path[k - 1], path[k]) !== step(path[k], path[k + 1]) || links[path[k].i][path[k].j].length !== 3) continue;
            if (k < path.length * 0.2 || k > path.length * 0.8 || !fits([k, k])) continue;
            const c = hung.chains.findIndex((chain, n) => hung.roots[n] === k);
            if (c < 0 || hung.chains[c].length !== 2 || hung.chains[c] === out.bigCane?.chain) continue;
            options.push({ index: k, into: hung.chains[c][0] });
        }
        if (options.length === 0) return null;
        out.current = options[Math.floor(random() * options.length)];
        spans.push([out.current.index, out.current.index]);
    }
    // Steam vents (Level 61's): a plain cell k with the path straight from
    // k - 2 to k + 1; a puff pushes you back into cell k - 1, so that cell
    // must be free of any other obstacle too
    out.vents = [];
    // Two tails each in their own straight stretch: the path turns
    // somewhere between them
    const turnBetween = (a, b) => {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        for (let i = lo; i < hi; i++) if (step(path[i - 1], path[i]) !== step(path[i], path[i + 1])) return true;
        return false;
    };
    for (let v = 0; v < (rule.vents ?? 0); v++) {
        const options = [];
        for (let k = 3; k < path.length - 2; k++) {
            if (plain(k) && plain(k - 1) && step(path[k - 2], path[k - 1]) === step(path[k - 1], path[k]) && fits([k - 1, k])
                && (!rule.ownStretch || out.vents.every((j) => turnBetween(j, k)))) options.push(k);
        }
        if (options.length === 0) return null;
        const k = options[Math.floor(random() * options.length)];
        out.vents.push(k);
        spans.push([k - 1, k]);
    }
    // Lava geysers (Level 63's) and trapdoors (Level 104's): a plain cell in
    // a straight stretch
    out.geysers = [];
    for (let v = 0; v < (rule.geysers ?? rule.trapdoors ?? 0); v++) {
        const options = [];
        for (let k = 3; k < path.length - 2; k++) {
            if (plain(k) && step(path[k - 2], path[k - 1]) === step(path[k - 1], path[k]) && fits([k, k])) options.push(k);
        }
        if (options.length === 0) return null;
        const k = options[Math.floor(random() * options.length)];
        out.geysers.push(k);
        spans.push([k, k]);
    }
    // Level 105's order along the path: a trapdoor, the button's wrong way,
    // then the other trapdoor
    if (rule.order) {
        const [first, second] = [...out.geysers].sort((a, b) => a - b);
        if (!(first < out.buttonDoor.at && out.buttonDoor.at < second)) return null;
    }
    // Level 110's order along the path: carpet, trapdoor, trapdoor, carpet,
    // spinning wall, then rule.finaleOrder wrong ways branching off after it
    if (rule.finaleOrder) {
        const [p0, p1] = [...out.platforms].sort((a, b) => a - b);
        const [t0, t1] = [...out.geysers].sort((a, b) => a - b);
        if (!(p0 < t0 && t1 < p1 && p1 < out.spinWall)) return null;
        if (hung.roots.filter((at) => at > out.spinWall + 1).length < rule.finaleOrder) return null;
    }
    // Snowmen (Level 72's): a hallway h .. h + SNOWMAN_CELLS - 1 with only
    // the path through it, straight all the way, and the path turning out of
    // its last cell
    out.snowmen = [];
    for (let s = 0; s < (rule.snowmen ?? 0); s++) {
        const options = [];
        const end = SNOWMAN_CELLS - 1;
        for (let h = 2; h + end + 1 < path.length - 1; h++) {
            const cells = [...Array(SNOWMAN_CELLS).keys()].map((d) => h + d);
            if (!cells.every(only)) continue;
            if (!cells.slice(1).every((n) => step(path[n - 1], path[n]) === step(path[h], path[h + 1]))) continue;
            if (step(path[h + end], path[h + end + 1]) === step(path[h], path[h + 1])) continue;
            if (fits([h, h + end])) options.push(h);
        }
        if (options.length === 0) return null;
        const h = options[Math.floor(random() * options.length)];
        out.snowmen.push(h);
        spans.push([h, h + end]);
    }
    // Thin ice on the path (Level 73's): a plain cell, the path straight
    // from n - 2 to n + 2
    out.thinIce = [];
    for (let t = 0; t < (rule.thinIce ?? 0); t++) {
        const options = [];
        for (let n = 3; n < path.length - 3; n++) {
            if (plain(n) && step(path[n - 2], path[n - 1]) === step(path[n - 1], path[n]) && step(path[n + 1], path[n + 2]) === step(path[n], path[n + 1]) && fits([n, n])) options.push(n);
        }
        if (options.length === 0) return null;
        const n = options[Math.floor(random() * options.length)];
        out.thinIce.push(n);
        spans.push([n, n]);
    }
    // Caramel spots (Level 52's): plain path cells
    for (let n = 0; n < (rule.caramelPath ?? 0); n++) {
        const options = [];
        for (let c = 2; c < path.length - 2; c++) if (plain(c) && fits([c, c])) options.push(c);
        if (options.length === 0) return null;
        const c = options[Math.floor(random() * options.length)];
        out.caramel.push(c);
        spans.push([c, c]);
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
        if (t > 0 && (rule.armBelts || rule.relink)) hung = link(path, hung.sneaky, hung.chains, onPath, random);
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
if (placed.current) {
    const cell = path[placed.current.index];
    for (const b of gapBlocks([cell])) put(b, 'W');
    put([4 * placed.current.into.i + 2, 4 * placed.current.into.j + 2], 'V');
}
const platformOrder = [...placed.platforms].sort((a, b) => a - b);
for (const g of placed.platforms) for (const b of gapBlocks([path[g], path[g + PLATFORM_CELLS - 1]])) put(b, (rule.fast ?? []).includes(platformOrder.indexOf(g)) ? 'F' : 'O');
for (const c of placed.caramel) for (const b of gapBlocks([path[c]])) put(b, 'C');
for (const k of placed.vents) {
    for (const b of gapBlocks([path[k]])) put(b, 'H');
    put([4 * path[k - 1].i + 2, 4 * path[k - 1].j + 2], 'Q');
}
for (const k of placed.geysers) for (const b of gapBlocks([path[k]])) put(b, 'K');
for (const n of placed.thinIce) for (const b of gapBlocks([path[n]])) put(b, 'T');
for (const h of placed.snowmen) {
    for (const b of gapBlocks([...Array(SNOWMAN_CELLS).keys()].map((d) => path[h + d]))) put(b, 'N');
    const end = path[h + SNOWMAN_CELLS - 1];
    const [dx, dz] = step(path[h], path[h + 1]).split(',').map(Number);
    const [tx, tz] = step(end, path[h + SNOWMAN_CELLS]).split(',').map(Number);
    // The row against the end wall, and the two blocks of it away from the turn
    const ex = dx > 0 ? 4 * end.i + 3 : dx < 0 ? 4 * end.i + 1 : null;
    const ez = dz > 0 ? 4 * end.j + 3 : dz < 0 ? 4 * end.j + 1 : null;
    for (const c of [2, tx + tz > 0 ? 1 : 3]) {
        if (ex !== null) put([ex, 4 * end.j + c], 'M');
        else put([4 * end.i + c, ez], 'M');
    }
    put([4 * path[h - 1].i + 2, 4 * path[h - 1].j + 2], 'P');
}
for (const k of placed.slippery) {
    const cell = path[k];
    for (const d of [1, 2, 3]) put(cell.i !== path[k + 1].i ? [4 * cell.i + 2, 4 * cell.j + d] : [4 * cell.i + d, 4 * cell.j + 2], 'I');
}
if (placed.door !== undefined) {
    const a = path[placed.door];
    const b = path[placed.door + 1];
    for (const d of [1, 2, 3]) put(a.i !== b.i ? [4 * Math.max(a.i, b.i), 4 * a.j + d] : [4 * a.i + d, 4 * Math.max(a.j, b.j)], 'G');
}
placed.buttonDoors.forEach((door, n) => {
    const a = path[door.door];
    const b = path[door.door + 1];
    for (const d of [1, 2, 3]) put(a.i !== b.i ? [4 * Math.max(a.i, b.i), 4 * a.j + d] : [4 * a.i + d, 4 * Math.max(a.j, b.j)], n ? 'j' : 'J');
    const end = door.chain[door.chain.length - 1];
    put([4 * end.i + 2, 4 * end.j + 2], n ? 'u' : 'U');
});
for (const { chain } of placed.fossils) {
    const end = chain[chain.length - 1];
    put([4 * end.i + 2, 4 * end.j + 2], 'f');
}
if (placed.spinWall !== undefined) {
    const a = path[placed.spinWall];
    const b = path[placed.spinWall + 1];
    for (const d of [1, 2, 3]) put(a.i !== b.i ? [4 * Math.max(a.i, b.i), 4 * a.j + d] : [4 * a.i + d, 4 * Math.max(a.j, b.j)], 'E');
}
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
console.log(`\n${rule.name}: seed ${best.seed}, 11x11, start row ${best.startCell.j} west, door row ${best.exitCell.j} east, ` +
    `path ${best.solution.length} cells, ${best.deadEnds.length} dead ends (depths ${best.deadEnds.map((d) => d.depth).join(',')})`);
if (hung.sneaky) console.log(`sneaky spike: dead end off path cell ${hung.sneaky.index + 1}, bone spike in cell ${key(hung.sneaky.s)}`);
platformOrder.forEach((g, n) => console.log(`platform gap${(rule.fast ?? []).includes(n) ? ' (fast)' : ''}: path cells ${g + 1}-${g + PLATFORM_CELLS} (${key(path[g])} ${key(path[g + PLATFORM_CELLS - 1])}), crossed heading ${dir(g)}`));
if (placed.door !== undefined) console.log(`space door: between path cells ${placed.door + 1} and ${placed.door + 2} (${key(path[placed.door])} -> ${key(path[placed.door + 1])}), heading ${dir(placed.door + 1)}`);
placed.slippery.forEach((k) => console.log(`slippery spot: path cell ${k + 1} (${key(path[k])}), heading ${dir(k)}`));
placed.rivers.forEach((g) => console.log(`gap: path cells ${g + 1}-${g + GAP_CELLS}, crossed heading ${dir(g)}`));
placed.belts.forEach(({ h, e, b }) => console.log(`belt: hallway path cells ${h + 1}-${e + 1} heading ${dir(h + 1)}, belt on path cells ${b + 1}-${b + BELT_CELLS}, fling to cell ${key(path[h])}`));
placed.armBelts.forEach(({ h, e, b }) => console.log(`arm belt: hallway path cells ${h + 1}-${e + 1} heading ${dir(h + 1)}, belt on path cells ${b + 1}-${b + ARM_BELT_CELLS}, push to cell ${key(path[b - 1])}`));
placed.vents.forEach((k) => console.log(`steam vent: path cell ${k + 1} (${key(path[k])}), heading ${dir(k)}, pushes back into path cell ${k}`));
placed.geysers.forEach((k) => console.log(`${rule.trapdoors ? 'trapdoor' : 'lava geyser'}: path cell ${k + 1} (${key(path[k])}), heading ${dir(k)}`));
placed.snowmen.forEach((h) => console.log(`snowman: hallway path cells ${h + 1}-${h + SNOWMAN_CELLS} heading ${dir(h + 1)}, path turns ${dir(h + SNOWMAN_CELLS)} out of its last cell`));
placed.thinIce.forEach((n) => console.log(`thin ice: path cell ${n + 1} (${key(path[n])}), heading ${dir(n)}`));
if (placed.caramel.length) console.log(`caramel on the path: cells ${[...placed.caramel].sort((a, b) => a - b).map((c) => `${c + 1} (${key(path[c])}, heading ${dir(c)})`).join(', ')}`);
if (placed.pathCane !== undefined) console.log(`path spike: path cell ${placed.pathCane + 1} (${key(path[placed.pathCane])}), heading ${dir(placed.pathCane)}`);
if (placed.current) console.log(`water current: path cell ${placed.current.index + 1} (${key(path[placed.current.index])}), heading ${dir(placed.current.index)}, shoves into ${key(placed.current.into)}`);
if (placed.bigCane) console.log(`big spike: dead end off path cell ${placed.bigCane.at + 1}, first cell ${key(placed.bigCane.chain[0])}`);
placed.buttonDoors.forEach((door, n) => console.log(`button door ${n ? 'j' : 'J'}: between path cells ${door.door + 1} and ${door.door + 2} (${key(path[door.door])} -> ${key(path[door.door + 1])}), heading ${dir(door.door + 1)}; button ${n ? 'u' : 'U'} wrong way off path cell ${door.at + 1} (${key(path[door.at])}), button in ${key(door.chain[door.chain.length - 1])}`));
if (placed.spinWall !== undefined) console.log(`spinning wall: between path cells ${placed.spinWall + 1} and ${placed.spinWall + 2} (${key(path[placed.spinWall])} -> ${key(path[placed.spinWall + 1])}), heading ${dir(placed.spinWall + 1)}`);
if (rule.finaleOrder) console.log(`wrong ways after the spinning wall: off path cells ${hung.roots.filter((at) => at > placed.spinWall + 1).sort((a, b) => a - b).map((at) => at + 1).join(', ')}`);
placed.fossils.forEach(({ chain, at }, n) => console.log(`fossil ${n + 1}: wrong way off path cell ${at + 1} (${key(path[at])}), fossil in ${key(chain[chain.length - 1])}`));
