// node --test test/metrics.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import {
  median, mean, range, RunRecorder, summarizeRuns, difficultyVerdict, trackVerdict, encodePNG, heatmapPNG,
  crc32, mergeDwell, fmtS,
} from '../lib/metrics.js';

test('stats: median counts Infinity (never won) as a value', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([1, Infinity, Infinity]), Infinity);
  assert.equal(median([]), null);
  assert.equal(mean([1, 2, Infinity]), 1.5);
  assert.deepEqual(range([5, 1, Infinity, 3]), [1, 5]);
  assert.equal(fmtS(Infinity), 'never');
  assert.equal(fmtS(75), '1m15s');
});

test('RunRecorder: dwell, path length, wins and stuck spots', () => {
  const rec = new RunRecorder({ binOf: (p) => `${Math.floor(p.x)},${Math.floor(p.z)}`, cellOf: (p) => `${Math.floor(p.x / 4)}`, stuckAfterS: 10 });
  let t = 0;
  // walk 8 units in 4 s (cells 0 and 1), then stand still in cell 1 for 15 s, then move to cell 2 and win
  for (; t <= 4; t += 0.5) rec.sample({ x: t * 2, z: 0.5 }, t);
  for (; t <= 19; t += 0.5) rec.sample({ x: 7.5, z: 0.5 }, t);
  rec.sample({ x: 9, z: 0.5 }, 19.5);
  rec.fail(5, 'spike');
  rec.win(19.5);
  const run = rec.finish(19.5);
  assert.equal(run.won, true);
  assert.equal(run.timeToWin, 19.5);
  assert.equal(run.fails, 1);
  assert.deepEqual(run.failReasons, { spike: 1 });
  assert.equal(run.cellsVisited, 3);
  assert.ok(Math.abs(run.pathLength - 10) < 0.01); // 8 out, 0.5 back, 1.5 on
  assert.equal(run.stuck.length, 1);
  assert.equal(run.stuck[0].cell, '1');
  assert.ok(run.stuck[0].seconds >= 15);
  const dwellTotal = Object.values(run.dwell).reduce((s, v) => s + v, 0);
  assert.ok(Math.abs(dwellTotal - 19.5) < 0.01);
});

test('RunRecorder: an open no-progress window is flushed at the end (gave up)', () => {
  const rec = new RunRecorder({ binOf: () => 'a', stuckAfterS: 5 });
  for (let t = 0; t <= 8; t += 1) rec.sample({ x: 0, z: 0 }, t);
  const run = rec.finish(8);
  assert.equal(run.won, false);
  assert.equal(run.timeToWin, null);
  assert.equal(run.stuck.length, 1);
});

const fakeRun = (won, t, extra = {}) => ({ won, timeToWin: won ? t : null, simSeconds: t, fails: 1, bumps: 6, pathLength: 200, cellsVisited: 10, stuck: [], ...extra });

test('summarizeRuns and the difficulty verdict', () => {
  const runs = [fakeRun(true, 60), fakeRun(true, 120), fakeRun(false, 600, { quit: true, stuck: [{ cell: '2,3', seconds: 60 }] }), fakeRun(true, 90)];
  const s = summarizeRuns(runs, { capS: 600, optimalLength: 100 });
  assert.equal(s.runs, 4);
  assert.equal(s.winRate, 0.75);
  assert.equal(s.medianTimeToWin, 105);
  assert.equal(s.quits, 1);
  assert.equal(s.retryRate, round3(4 / 7));
  assert.equal(s.pathVsOptimal, 2);
  assert.equal(s.stuckSpots.length, 0); // one run only; needs 2
  const v = difficultyVerdict(s, [5, 10]);
  assert.equal(v.verdict, 'ok');
  const hard = summarizeRuns([fakeRun(false, 600), fakeRun(false, 600), fakeRun(true, 30)], { capS: 600 });
  assert.equal(hard.medianTimeToWin, Infinity);
  assert.equal(difficultyVerdict(hard, [5, 10]).verdict, 'too hard');
  const easy = summarizeRuns([fakeRun(true, 10), fakeRun(true, 12)], { capS: 600 });
  assert.equal(difficultyVerdict(easy, [5, 10]).verdict, 'too easy');
  assert.equal(trackVerdict(summarizeRuns([fakeRun(true, 60)], { capS: 300 })).verdict, 'ok');
  assert.equal(trackVerdict(summarizeRuns([fakeRun(true, 60, { fails: 10 })], { capS: 300 })).verdict, 'too hard');
});

const round3 = (v) => Math.round(v * 1000) / 1000;

test('mergeDwell adds maps', () => {
  assert.deepEqual(mergeDwell([{ a: 1, b: 2 }, { b: 3 }, undefined]), { a: 1, b: 5 });
});

test('PNG encoder writes a valid PNG', () => {
  assert.equal(crc32(Buffer.from('IEND')), 0xae426082);
  const w = 3;
  const h = 2;
  const px = new Uint8Array(w * h * 4).map((_, i) => i);
  const png = encodePNG(w, h, px);
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(png.readUInt32BE(16), w);
  assert.equal(png.readUInt32BE(20), h);
  // IDAT round-trips to filter byte + raw rows
  const idatLen = png.readUInt32BE(33);
  assert.equal(png.subarray(37, 41).toString(), 'IDAT');
  const raw = inflateSync(png.subarray(41, 41 + idatLen));
  assert.equal(raw.length, h * (w * 4 + 1));
  assert.equal(raw[0], 0);
  assert.deepEqual([...raw.subarray(1, 5)], [0, 1, 2, 3]);
  // chunk CRCs are right
  const ihdrCrc = png.readUInt32BE(29);
  assert.equal(ihdrCrc, crc32(png.subarray(12, 29)));
});

test('heatmapPNG has the right size', () => {
  const png = heatmapPNG({ cols: 4, rows: 3, scale: 5, value: (i, j) => i + j, base: (i) => (i === 0 ? [0, 0, 0] : null), markers: [{ i: 1, j: 1, color: [0, 0, 255] }] });
  assert.equal(png.readUInt32BE(16), 20);
  assert.equal(png.readUInt32BE(20), 15);
});
