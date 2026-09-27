// node --test test/bots.test.mjs — pure parts of the bots (no browser).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseLayout, findBlockPath, blockDistances, pathToWaypoints, segmentClear, lineOfSight, positionValid,
  cellGraph, analyzeLayout, iteration1Layout, iteration1Layouts, polylineLength,
} from '../lib/bots/mazeGrid.js';
import { loadCarver, loadLevels } from '../lib/bots/carver.js';
import { wrap, yawTo } from '../lib/bots/mazle.js';
import { moveFor } from '../lib/bots/rolly.js';
import { makeRng } from '../lib/bots/rng.js';
import { persona, parseBrackets, BRACKETS } from '../lib/bots/personas.js';

// 2 x 2 corridor cells (corridor 3): start top-left, door east of bottom-right, spike top-right (dead end)
const SMALL = [
  '#########',
  '#       #',
  '# S   X #',
  '#       #',
  '#   #####',
  '#       #',
  '#       D',
  '#       #',
  '#########',
];

test('parseLayout finds start, spike, door and its inside face', () => {
  const g = parseLayout(SMALL);
  assert.equal(g.w, 9);
  assert.equal(g.h, 9);
  assert.deepEqual([g.start.bx, g.start.bz], [2, 2]);
  assert.deepEqual([g.spike.bx, g.spike.bz], [6, 2]);
  assert.deepEqual(g.door.block, { x: 8, z: 6 });
  assert.deepEqual(g.door.face, { x: 8, z: 6.5 });
  assert.deepEqual(g.door.inside, { x: 7, z: 6 });
  assert.ok(g.isWall(8, 6)); // the door block is solid
  assert.ok(g.isWall(-1, 0)); // outside is wall
});

test('A* finds a path to the door and keeps off the spike', () => {
  const g = parseLayout(SMALL);
  const path = findBlockPath(g, { x: 2, z: 2 }, g.door.inside);
  assert.ok(path);
  assert.deepEqual(path[0], { x: 2, z: 2 });
  assert.deepEqual(path.at(-1), { x: 7, z: 6 });
  for (let i = 1; i < path.length; i++) {
    assert.equal(Math.abs(path[i].x - path[i - 1].x) + Math.abs(path[i].z - path[i - 1].z), 1, '4-connected');
    assert.ok(g.isFloor(path[i].x, path[i].z));
  }
  assert.ok(path.every((b) => Math.hypot(b.x + 0.5 - g.spike.x, b.z + 0.5 - g.spike.z) > 1.4));
  // the goal is the spike: not allowed; a goal inside a wall: no path
  assert.equal(findBlockPath(g, { x: 2, z: 2 }, { x: 6, z: 2 }), null);
  assert.equal(findBlockPath(g, { x: 2, z: 2 }, { x: 5, z: 4 }), null);
  assert.ok(findBlockPath(g, { x: 2, z: 2 }, { x: 6, z: 2 }, { avoidSpike: false }));
});

test('BFS distances and waypoint pulling', () => {
  const g = parseLayout(SMALL);
  const d = blockDistances(g, { x: 2, z: 2 });
  assert.equal(d.get('2,2'), 0);
  assert.equal(d.get('3,2'), 1);
  assert.equal(d.get('5,4'), undefined); // wall
  assert.equal(d.get('7,6'), 9);
  const path = findBlockPath(g, { x: 2, z: 2 }, g.door.inside);
  const wps = pathToWaypoints(g, path, g.door.face);
  assert.ok(wps.length < path.length);
  for (let i = 1; i < wps.length - 1; i++) assert.ok(segmentClear(g, wps[i - 1], wps[i], 0.45));
  assert.ok(polylineLength(wps) <= path.length + 1);
});

test('collision test matches CollisionManager and line of sight stops at walls', () => {
  const g = parseLayout(SMALL);
  assert.ok(positionValid(g, 2.5, 2.5));
  assert.ok(!positionValid(g, 1.2, 2.5)); // radius 0.4 pokes into x = 0
  assert.ok(lineOfSight(g, { x: 1.5, z: 3.5 }, { x: 7.5, z: 3.5 }));
  assert.ok(!lineOfSight(g, { x: 2.5, z: 2.5 }, { x: 6.5, z: 6.5 }));
});

test('cell graph and analysis of a tiny maze', () => {
  const g = parseLayout(SMALL);
  const cg = cellGraph(g);
  assert.equal(cg.cols, 2);
  assert.equal(cg.rows, 2);
  const links = (i, j) => cg.links[i][j].map((c) => `${c.i},${c.j}`).sort();
  assert.deepEqual(links(0, 0), ['0,1', '1,0']);
  assert.deepEqual(links(1, 0), ['0,0']);
  assert.deepEqual(links(0, 1), ['0,0', '1,1']);
  assert.deepEqual(cg.cellOf(6.5, 6.5), { i: 1, j: 1 });
  assert.deepEqual(cg.center({ i: 1, j: 1 }), { x: 6.5, z: 6.5 });
  assert.equal(cellGraph(parseLayout(['####', '#S #', '####'])), null); // not a corridor-cell layout
});

test('analyzeLayout on Level 1 matches levels.js notes (7x7, path 34, 8 dead ends, depth <= 3, spike 3 from start)', async () => {
  const carver = await loadCarver();
  const [level1] = await loadLevels();
  const a = analyzeLayout(level1.layout, carver.analyzeMaze);
  assert.equal(a.solvable, true);
  assert.equal(a.cells.cols, 7);
  assert.equal(a.cells.perfectMaze, true);
  assert.equal(a.cells.solutionLength, 34);
  assert.equal(a.cells.deadEnds, 8);
  assert.ok(a.cells.maxBranchDepth <= 3);
  assert.equal(a.cells.spike.inDeadEnd, true);
  assert.equal(a.cells.spike.onSolution, false);
  assert.equal(a.cells.spike.fromStart, 3);
  assert.ok(a.optimalPathLength > 80 && a.optimalPathLength < 140);
});

test('Iteration 1 layouts: 12x12, west start, east door, spike 3-6 cells from start in a dead end', async () => {
  const carver = await loadCarver();
  const list = iteration1Layouts(carver, 3);
  assert.equal(list.length, 3);
  for (const l of list) {
    assert.equal(l.layout.length, 49);
    assert.equal(l.layout[0].length, 49);
    const a = analyzeLayout(l.layout, carver.analyzeMaze);
    assert.equal(a.cells.startCell.i, 0);
    assert.equal(a.cells.exitCell.i, 11);
    assert.equal(a.cells.perfectMaze, true);
    assert.ok(a.cells.spike.inDeadEnd && !a.cells.spike.onSolution);
    assert.ok(a.cells.spike.fromStart >= 3 && a.cells.spike.fromStart <= 6);
    assert.equal(a.cells.deadEnds, l.deadEnds);
  }
  // deterministic by seed
  assert.deepEqual(iteration1Layout(carver, list[0].seed).layout, list[0].layout);
});

test('heading helpers: yaw -PI/2 faces +x, wrap to [-PI, PI)', () => {
  assert.ok(Math.abs(yawTo(1, 0) - -Math.PI / 2) < 1e-9);
  assert.ok(Math.abs(yawTo(0, -1)) < 1e-9);
  assert.ok(Math.abs(wrap(3 * Math.PI) - -Math.PI) < 1e-9 || Math.abs(wrap(3 * Math.PI) - Math.PI) < 1e-9);
  assert.ok(Math.abs(wrap(0.5 + 2 * Math.PI) - 0.5) < 1e-9);
});

test('Rolly Bally move vector: forward along forward, x along its right', () => {
  const f = { x: 0, z: -1 }; // facing -z, right is +x
  assert.deepEqual(moveFor(0, -1, f), { x: 0, y: 1 });
  assert.deepEqual(moveFor(1, 0, f), { x: 1, y: 0 });
  assert.deepEqual(moveFor(0, 1, f, 0.5), { x: 0, y: -0.5 });
});

test('seeded rng repeats and personas load from rubric.yaml', () => {
  const a = makeRng(42);
  const b = makeRng(42);
  const xs = Array.from({ length: 5 }, () => a.next());
  assert.deepEqual(xs, Array.from({ length: 5 }, () => b.next()));
  const g = Array.from({ length: 2000 }, () => a.gauss());
  const m = g.reduce((s, x) => s + x, 0) / g.length;
  const sd = Math.sqrt(g.reduce((s, x) => s + (x - m) ** 2, 0) / g.length);
  assert.ok(Math.abs(m) < 0.1 && Math.abs(sd - 1) < 0.1);
  assert.deepEqual(parseBrackets('5-7,8-10'), ['5-7', '8-10']);
  assert.deepEqual(parseBrackets(), BRACKETS);
  assert.throws(() => parseBrackets('3-5'));
  const p = persona('5-7');
  assert.equal(p.reaction_ms, 600);
  assert.deepEqual(p.session_minutes, [5, 10]);
  assert.equal(p.stuck_s, 20);
});
