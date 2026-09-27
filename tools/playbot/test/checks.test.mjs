import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analyzeFlashes, transitions, maxInWindow } from '../lib/checks/flashing.js';
import { fkGrade, syllables, wordsOf, classifyStrings, evaluateReading } from '../lib/checks/reading-level.js';
import { analyzeLoudness } from '../lib/checks/loudness.js';
import { detectTimers, timerStateKeys } from '../lib/checks/countdown-timers.js';
import { classifyInput } from '../lib/checks/links-out.js';
import { classifyRequests, matchTracker } from '../lib/checks/network.js';
import { classifyControls } from '../lib/checks/pause-mute-quit.js';
import { isHint, firstHint } from '../lib/checks/hint-timing.js';
import { evaluateTouchTargets } from '../lib/checks/touch-targets.js';
import { finding } from '../lib/checks/util.js';
import { aggregate, formatTable } from '../lib/review.js';
import { applyJudgments, listJudgments, saveJudgment } from '../lib/judgments.js';
import { loadRubric, parseBrackets } from '../lib/rules.js';
import { extractDomains } from '../scripts/update-trackers.mjs';

// ---------------------------------------------------------------- flashing

/**
 * Frames on a 6×6 grid (windows: 2×2 blocks = 1/3 × 1/3 of the screen; local 1×1).
 * `lum(i, x, y)` → luminance of block (x, y) in frame i; red: saturated-red blocks with red value lum*100.
 */
function frames(n, lum, { red = false } = {}) {
  return Array.from({ length: n }, (_, i) => {
    const L = []; const R = []; const S = [];
    for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) {
      const v = lum(i, x, y);
      L.push(v); R.push(red ? v * 100 : 0); S.push(red ? 0.95 : 0.33);
    }
    return { gw: 6, gh: 6, L, R, S };
  });
}
const patch = (f) => (i, x, y) => (x < 2 && y < 2 ? f(i) : 0.3); // a 1/3 × 1/3 area
const square = (period) => (i) => (Math.floor(i / period) % 2 ? 0.9 : 0.1);

test('transitions: hysteresis counts one transition per swing, ignores small wiggles', () => {
  const slowFade = [0, 0.02, 0.04, 0.06, 0.08, 0.1, 0.12, 0.14];
  assert.equal(transitions(slowFade).length, 1);
  assert.equal(transitions([0.5, 0.55, 0.5, 0.55, 0.5]).length, 0);
  const sq = [0, 1, 0, 1, 0];
  const tr = transitions(sq);
  assert.equal(tr.length, 4);
  assert.deepEqual(tr.map((t) => t.dir), [1, -1, 1, -1]);
  assert.ok(tr.every((t) => t.counted));
});

test('transitions: both sides brighter than 0.8 do not count (WCAG darker-image rule)', () => {
  const tr = transitions([0.85, 1, 0.85, 1, 0.85]);
  assert.equal(tr.length, 4);
  assert.ok(tr.every((t) => !t.counted));
});

test('maxInWindow counts counted transitions in a 60-frame window', () => {
  const tr = [5, 10, 20, 64, 70, 200].map((frame) => ({ frame, counted: true }));
  assert.deepEqual(maxInWindow(tr, 60), { count: 4, start: 5 });
});

test('analyzeFlashes: 10 Hz flicker over a 1/3 × 1/3 area fails', () => {
  const a = analyzeFlashes(frames(120, patch(square(3))));
  assert.equal(a.general.maxFlashesPerSecond, 10);
  assert.deepEqual(a.general.worstWindow, { x: 0, y: 0, w: 2 / 6, h: 2 / 6 });
  assert.equal(a.status, 'fail');
});

test('analyzeFlashes: 2 flashes/s passes; a steady image passes', () => {
  const slow = analyzeFlashes(frames(180, patch(square(15))));
  assert.equal(slow.general.maxFlashesPerSecond, 2);
  assert.equal(slow.status, 'pass');
  const still = analyzeFlashes(frames(60, () => 0.4));
  assert.equal(still.status, 'pass');
  assert.equal(still.general.maxTransitionsPerSecond, 0);
});

test('analyzeFlashes: 4 flashes/s is over the 3/s limit', () => {
  const a = analyzeFlashes(frames(120, patch(square(7.5))));
  assert.ok(a.general.maxTransitionsPerSecond >= 7);
  assert.equal(a.status, 'fail');
});

test('analyzeFlashes: a small flickering spot is only a warn', () => {
  const a = analyzeFlashes(frames(120, (i, x, y) => (x === 5 && y === 5 ? square(3)(i) : 0.3)));
  assert.equal(a.status, 'warn');
  assert.ok(a.local.maxFlashesPerSecond >= 9);
  assert.ok(a.general.maxFlashesPerSecond <= 3);
});

test('analyzeFlashes: panning over a high-contrast pattern is not a flash', () => {
  // a checkerboard moving one block per frame: every block alternates, but each 1/3 area keeps its mean
  const a = analyzeFlashes(frames(120, (i, x, y) => ((x + y + i) % 2 ? 0.7 : 0.1)));
  assert.equal(a.general.maxTransitionsPerSecond, 0);
  assert.equal(a.mean.maxTransitionsPerSecond, 0);
  assert.equal(a.status, 'warn'); // local 1×1 windows do see it: evidence, not a failure
});

test('analyzeFlashes: saturated red flicker is counted separately', () => {
  // luminance swing too small for a general flash (0.05 ↔ 0.12), red value swings by 7 → 30 ... use 0.05 ↔ 0.45 on red
  const a = analyzeFlashes(frames(120, patch((i) => (Math.floor(i / 3) % 2 ? 0.45 : 0.05)), { red: true }));
  assert.ok(a.red.maxFlashesPerSecond >= 9);
  assert.equal(a.status, 'fail');
});

// ---------------------------------------------------------------- reading level

test('syllables and words', () => {
  assert.equal(syllables('cat'), 1);
  assert.equal(syllables('table'), 2);
  assert.equal(syllables('banana'), 3);
  assert.equal(syllables('instruction'), 3);
  assert.deepEqual(wordsOf('Tap the ball! 3 2 1 ⭐'), ['Tap', 'the', 'ball']);
});

test('Flesch-Kincaid grade', () => {
  // 6 words, 1 sentence, 6 syllables → 0.39*6 + 11.8*1 − 15.59 = −1.45
  assert.equal(fkGrade(['The cat sat on the mat.']), -1.4);
  assert.ok(fkGrade(['Navigate the labyrinthine corridors to discover the concealed exit.']) > 12);
  assert.equal(fkGrade(['3 2 1']), null);
});

test('classifyStrings: instructions are 2+ words, one-word labels are separate', () => {
  const { instructions, labels } = classifyStrings(['Race', 'Find the door!', 'Find the door!', '42']);
  assert.deepEqual(labels, ['Race']);
  assert.equal(instructions.length, 1);
  assert.equal(instructions[0].words, 3);
});

test('evaluateReading applies per-bracket thresholds', () => {
  const rubric = loadRubric();
  const texts = [{ text: 'Roll the ball to the big red flag to win', screen: 's', screenshot: 'a.png' }];
  const f = evaluateReading(texts, { brackets: ['2-4', '5-7', '8-10'], rubric, audio: false });
  const by = Object.fromEntries(f.map((x) => [x.bracket, x]));
  assert.equal(by['2-4'].status, 'fail');
  assert.equal(by['5-7'].status, 'warn');
  assert.equal(by['5-7'].evidence.screenshot, 'a.png');
  assert.equal(by['8-10'].status, 'pass');
});

// ---------------------------------------------------------------- loudness

test('analyzeLoudness: sudden loud jump fails, steady sound passes', () => {
  const quiet = Array.from({ length: 20 }, (_, i) => ({ t: i * 25, peak: 0.02, rms: 0.01 }));
  const bang = [...quiet, { t: 500, peak: 1, rms: 0.7 }];
  const a = analyzeLoudness(bang);
  assert.equal(a.status, 'fail');
  assert.equal(a.jumps.length, 1);
  assert.ok(a.jumps[0].jumpDb >= 20);
  const steady = Array.from({ length: 40 }, (_, i) => ({ t: i * 25, peak: 0.2, rms: 0.08 }));
  assert.equal(analyzeLoudness(steady).status, 'pass');
  assert.equal(analyzeLoudness([]).activeSamples, 0);
});

// ---------------------------------------------------------------- DOM helpers

test('countdown detection: 3 → 2 → 1 is a countdown, a static 1 2 3 list is not', () => {
  const down = detectTimers([{ t: 0, texts: ['3'] }, { t: 0.5, texts: ['3'] }, { t: 1, texts: ['2'] }, { t: 1.5, texts: ['1'] }]);
  assert.ok(down.some((h) => h.kind === 'counting-down'));
  const list = detectTimers([{ t: 0, texts: ['1', '2', '3'] }, { t: 0.5, texts: ['1', '2', '3'] }, { t: 1, texts: ['1', '2', '3'] }]);
  assert.deepEqual(list, []);
  assert.ok(detectTimers([{ t: 0, texts: ['Time left 0:45'] }]).length >= 1);
  assert.deepEqual(timerStateKeys({ race: { state: 'countdown', timeLeft: 3 } }).map((k) => k.key), ['race.state', 'race.timeLeft']);
});

test('classifyInput: personal-data fields fail, a free-text box warns', () => {
  assert.equal(classifyInput({ type: 'email' }), 'fail');
  assert.equal(classifyInput({ type: 'text', name: 'first_name' }), 'fail');
  assert.equal(classifyInput({ type: 'text', placeholder: 'How old are you? (age)' }), 'fail');
  assert.equal(classifyInput({ type: 'text', name: 'worldCode', placeholder: 'World code' }), 'warn');
});

test('network: third-party and tracker hosts', () => {
  const set = new Set(['google-analytics.com', 'doubleclick.net']);
  assert.equal(matchTracker('www.google-analytics.com', set), 'google-analytics.com');
  assert.equal(matchTracker('example.com', set), null);
  const c = classifyRequests([
    { url: 'http://h:1/game/a.js' }, { url: 'data:image/png;base64,xx' },
    { url: 'https://www.google-analytics.com/g/collect?x=1', type: 'ping' }, { url: 'https://fonts.example.org/f.woff2' },
  ], 'http://h:1', set);
  assert.equal(c.sameOrigin, 1);
  assert.equal(c.local, 1);
  assert.deepEqual(c.thirdParty.map((t) => [t.host, t.tracker]), [['www.google-analytics.com', 'google-analytics.com'], ['fonts.example.org', null]]);
});

test('extractDomains keeps only domain-anchored rules', () => {
  const d = extractDomains(['||ads.example.com^', '||t.example.net^$third-party', '||x.com/path', '||y.com^$domain=z.com', '! comment', '||q.org^$script,~third-party'].join('\n'));
  assert.deepEqual([...d].sort(), ['ads.example.com', 't.example.net']);
});

test('classifyControls finds pause, mute and quit by label/class', () => {
  const c = classifyControls([
    { label: 'Home (hold)', title: '', text: '', id: '', cls: 'rb-btn hud-home' },
    { label: '', title: '', text: '', id: 'mute-btn', cls: '' },
    { label: 'Pause', title: '', text: '', id: '', cls: '' },
  ]);
  assert.equal(c.quit.length, 1);
  assert.equal(c.mute.length, 1);
  assert.equal(c.pause.length, 1);
});

test('hints: hint-like text and events', () => {
  assert.ok(isHint({ text: 'Try turning left!' }));
  assert.ok(isHint({ type: 'hint', text: '' }));
  assert.ok(!isHint({ text: 'GO!' }));
  assert.ok(!isHint({ text: '12' }));
  assert.equal(firstHint([{ t: 30, text: 'Find the door' }, { t: 5, text: 'GO!' }, { t: 12, text: 'Tap to jump' }]).t, 12);
});

test('touch targets: per-bracket thresholds from the rubric', () => {
  const rubric = loadRubric();
  const screens = [{ target: 't', label: 'home', screenshot: 's.png', boxShot: 'box.png', viewport: { width: 1024, height: 768 },
    targets: [{ el: 'button', label: 'Race', size: 120, width: 200, height: 120 }, { el: 'button', label: 'Gear', size: 50, width: 50, height: 50 }] }];
  const f = evaluateTouchTargets(screens, { brackets: ['2-4', '5-7', '8-10'], rubric });
  const by = Object.fromEntries(f.map((x) => [x.bracket, x]));
  assert.equal(by['2-4'].status, 'fail');
  assert.equal(by['5-7'].status, 'warn');
  assert.equal(by['8-10'].status, 'pass');
  assert.equal(by['2-4'].evidence.screenshot, 'box.png');
});

// ---------------------------------------------------------------- review + judgments

test('parseBrackets validates against the rubric', () => {
  const rubric = loadRubric();
  assert.deepEqual(parseBrackets('5–7, 8-10', rubric), ['5-7', '8-10']);
  assert.deepEqual(parseBrackets(undefined, rubric), ['2-4', '5-7', '8-10', '11-13']);
  assert.throws(() => parseBrackets('3-5', rubric), /Unknown bracket/);
});

test('aggregate: strictest chosen bracket decides; unchosen brackets are ignored', () => {
  const fs = [
    finding({ check: 'touch-targets', bracket: '2-4', status: 'fail', summary: 'tiny', screenshot: 'a.png' }),
    finding({ check: 'touch-targets', bracket: '5-7', status: 'warn', summary: 'small', screenshot: 'a.png' }),
    finding({ check: 'touch-targets', bracket: '8-10', status: 'pass', summary: 'ok' }),
    finding({ check: 'network', rule: 'R13', status: 'pass', summary: 'clean' }),
    finding({ check: 'loudness', rule: 'R15', status: 'info', summary: 'no audio' }),
  ];
  const a = aggregate(fs, ['5-7', '8-10']);
  assert.equal(a.overall, 'WARN');
  assert.equal(a.brackets['5-7'].status, 'WARN');
  assert.equal(a.brackets['8-10'].status, 'PASS');
  assert.equal(aggregate(fs, ['2-4', '8-10']).overall, 'FAIL');
  assert.equal(aggregate(fs, ['8-10']).overall, 'PASS');
  // An always-true rule failure fails every bracket.
  const withRule = [...fs, finding({ check: 'network', rule: 'R13', status: 'fail', summary: 'tracker', screenshot: 'b.png' })];
  const b = aggregate(withRule, ['8-10']);
  assert.equal(b.overall, 'FAIL');
  assert.equal(b.brackets['8-10'].status, 'FAIL');
  assert.equal(b.rules.R13, 'fail');
  assert.equal(b.alwaysTrueFails.length, 1);
  assert.match(formatTable(withRule, ['8-10']), /network\s+R13/);
});

test('judgments: saved decision is applied to the same finding next time', () => {
  const dir = mkdtempSync(join(tmpdir(), 'judgments-'));
  const f = finding({ check: 'input-fields', rule: 'R13', status: 'warn', summary: 'Free-text input', key: 'input:world-code', screenshot: 'x.png' });
  saveJudgment('rolly-bally', f, { decision: 'ignore', note: 'local seed code, never sent' }, dir);
  const again = [finding({ check: 'input-fields', rule: 'R13', status: 'warn', summary: 'Free-text input (reworded)', key: 'input:world-code', screenshot: 'y.png' })];
  assert.equal(applyJudgments(again, 'rolly-bally', dir), 1);
  assert.equal(again[0].status, 'info');
  assert.equal(again[0].judgment.originalStatus, 'warn');
  assert.equal(applyJudgments([finding({ ...f, key: 'other' })], 'rolly-bally', dir), 0);
  assert.equal(listJudgments('rolly-bally', dir).length, 1);
  assert.equal(listJudgments({ game: 'rolly-bally' }, dir)[0].reason, 'local seed code, never sent');
});
