import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTesterProfile, resolveReviewSetup } from '../lib/testerProfile.js';
import { loadRubric, parseBrackets } from '../lib/rules.js';

const KNOWN = ['2-4', '5-7', '8-10', '11-13'];

test('parses a Tester profile with nested comparable bullets', () => {
  const md = '# Mazle\n## Tester profile\n- **Age brackets:** 5–7, 8–10\n- **Genre:** first-person maze\n' +
    '- **Comparable games:**\n\t- PBS KIDS mazes: onboarding and voice-over\n\t- Pac-Man: feedback and pacing\n' +
    '- **Focus:** the spike is allowed on purpose\n## Build log\n- Genre: not this one\n';
  const p = parseTesterProfile(md, { knownBrackets: KNOWN });
  assert.equal(p.found, true);
  assert.deepEqual(p.brackets, ['5-7', '8-10']);
  assert.equal(p.genre, 'first-person maze');
  assert.deepEqual(p.comparables, [
    { title: 'PBS KIDS mazes', compare: 'onboarding and voice-over' },
    { title: 'Pac-Man', compare: 'feedback and pacing' },
  ]);
  assert.equal(p.focus, 'the spike is allowed on purpose');
});

test('parses inline comparables and a bold-line heading', () => {
  const p = parseTesterProfile('**Tester profile**\n- Age brackets: 2–4\n- Comparable games: A Maze Race: pacing; Monument Valley — wordless onboarding\n# Next\n');
  assert.deepEqual(p.brackets, ['2-4']);
  assert.deepEqual(p.comparables.map((c) => c.title), ['A Maze Race', 'Monument Valley']);
});

test('missing profile: brackets must come from the user, Claude picks comparables', () => {
  const rubric = loadRubric();
  const none = parseTesterProfile('# Plan\nno profile here');
  assert.equal(none.found, false);
  assert.throws(() => resolveReviewSetup({ profile: none, parseBrackets, rubric, gameName: 'x' }), /--brackets/);
  const s = resolveReviewSetup({ profile: none, bracketsFlag: '5-7', parseBrackets, rubric, gameName: 'x' });
  assert.deepEqual(s.brackets, ['5-7']);
  assert.equal(s.comparables.mode, 'claude-picks');
});

test('--brackets overrides the profile defaults', () => {
  const rubric = loadRubric();
  const p = parseTesterProfile('## Tester profile\n- Age brackets: 5-7\n- Comparable games: Pac-Man: pacing\n', { knownBrackets: KNOWN });
  const s = resolveReviewSetup({ profile: p, bracketsFlag: '8-10', parseBrackets, rubric, gameName: 'x' });
  assert.deepEqual(s.brackets, ['8-10']);
  assert.equal(s.comparables.mode, 'tester-profile');
});
