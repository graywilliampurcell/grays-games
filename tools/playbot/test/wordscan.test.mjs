import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanText, scanFiles } from '../lib/wordscan.js';

const words = (hits) => hits.map((h) => h.word);

test('flags UI text on word boundaries as warn', () => {
  const hits = scanText(['You died! Buy more lives for $0.99', 'Spin the wheel for a prize']);
  assert.deepEqual(words(hits).sort(), ['<price>', 'buy', 'died', 'spin the wheel', 'you died'].sort());
  assert.ok(hits.every((h) => h.severity === 'warn' && h.kind === 'ui'));
  const died = hits.find((h) => h.word === 'died');
  assert.equal(died.rule, 'R04');
  assert.equal(died.where, 'text[0]');
  assert.match(died.context, /You died!/);
});

test('no hits for kind text, spikes, or words that merely contain a flagged word', () => {
  assert.deepEqual(scanText(['Ouch! Oops, try again', 'Watch out for the spike', 'skill alphabet screenshot address shadow', 'dead end ahead']), []);
});

test('allowlist suppresses matching phrases', () => {
  assert.equal(scanText(['Fire the cannon of confetti']).length, 1);
  assert.deepEqual(scanText(['Fire the cannon of confetti'], { allow: ['cannon of confetti'] }), []);
});

test('code identifiers are info, string literals are warn', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wordscan-'));
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'main.js'), [
    'function killTween(t) { t.stop(); } // don\'t leave dead tweens',
    'const deadEnds = analyzeMaze(grid).deadEnds;',
    'showMessage("You were killed");',
  ].join('\n'));
  writeFileSync(join(dir, 'index.html'), '<button title="Buy gems">Play</button>\n<p>Game over</p>\n<script>const msg = \'loser\';</script>');
  writeFileSync(join(dir, 'assets', 'sword-pickup.png'), '');
  mkdirSync(join(dir, 'node_modules'));
  writeFileSync(join(dir, 'node_modules', 'x.js'), 'kill()');

  const hits = scanFiles([dir]);
  const byWord = Object.fromEntries(hits.map((h) => [h.word + ':' + h.kind, h]));
  assert.equal(byWord['kill:code'].severity, 'info');
  assert.equal(byWord['dead:code'].severity, 'info');         // "dead tweens" in a comment
  assert.equal(byWord['killed:string'].severity, 'warn');
  assert.match(byWord['killed:string'].where, /main\.js:3$/);
  assert.equal(byWord['buy:ui'].rule, 'R13');                  // title attribute
  assert.equal(byWord['loser:string'].rule, 'R07');            // inline <script>
  assert.match(byWord['loser:string'].where, /index\.html:3$/);
  assert.equal(byWord['sword:asset'].rule, 'R02');
  assert.ok(!hits.some((h) => h.where.includes('node_modules')));
  assert.ok(!hits.some((h) => /dead ?end/i.test(h.context) && h.word === 'dead' && h.where.endsWith(':2')));
});
