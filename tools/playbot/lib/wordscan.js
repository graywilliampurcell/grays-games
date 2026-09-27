// wordscan.js — dependency-free scan of game text, asset names and code for
// words that point at always-true rule problems (rules.yaml): weapons, blood,
// kill/death, gambling, purchases, ads, tracking, pressure, meanness, etc.
//
// A hit is evidence, not a verdict: the harness passes UI hits to the Claude
// judge (with context) and lists code hits as info.
//
// Severity by where the word was found:
//   ui     — visible game text (HTML text, JSON/MD/TXT, strings you pass in)  → warn
//   string — string literals inside JS/TS (often UI text, sometimes not)      → warn
//   asset  — asset file names (png, mp3, glb, ...)                            → warn
//   code   — identifiers and comments (e.g. `killTween`, `// dead zone`)       → info
//
// Matching is case-insensitive on word boundaries, after splitting camelCase,
// snake_case and kebab-case, so `killTween` finds "kill" but "skill",
// "alphabet" and "screenshot" find nothing.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

// rule id (rules.yaml) → words/phrases. Phrases use single spaces; they also
// match across -, _ and camelCase (e.g. "loot box" matches lootBox, loot-box).
export const WORD_LISTS = {
  R01: ['blood', 'bloody', 'bleed', 'bleeding', 'gore', 'gory'],
  R02: ['gun', 'guns', 'pistol', 'rifle', 'shotgun', 'sniper', 'bullet', 'bullets', 'ammo',
        'weapon', 'weapons', 'sword', 'swords', 'knife', 'knives', 'dagger', 'grenade', 'bomb',
        'bombs', 'blaster', 'shoot', 'shooting', 'cannon'],
  R04: ['kill', 'kills', 'killed', 'killing', 'dead', 'death', 'die', 'died', 'dies', 'dying',
        'murder', 'corpse', 'you died', 'wound', 'wounded'],
  R05: ['hunt', 'hunting', 'hunter'],
  R07: ['loser', 'stupid', 'dumb', 'idiot', 'bad at this', 'you suck'],
  R09: ['beer', 'wine', 'alcohol', 'drunk', 'cigarette', 'cigarettes', 'vape', 'vaping',
        'drugs', 'weed'],
  R12: ['gamble', 'gambling', 'casino', 'slot machine', 'slots', 'jackpot', 'lottery',
        'loot box', 'lootbox', 'spin the wheel', 'prize wheel', 'wager', 'betting', 'roulette',
        'poker', 'blackjack', 'gacha', 'mystery box'],
  R13: ['buy', 'purchase', 'purchases', 'checkout', 'price', 'subscribe', 'subscription',
        'in app', 'shop', 'ad', 'ads', 'advert', 'advertisement', 'sponsored', 'watch an ad',
        'adsense', 'admob', 'doubleclick', 'interstitial', 'rewarded video',
        'analytics', 'tracking', 'tracker', 'gtag', 'google analytics', 'googletagmanager',
        'fbq', 'facebook pixel', 'mixpanel', 'hotjar', 'sign in', 'log in', 'email',
        'password'],
  R14: ['streak', 'daily reward', 'come back tomorrow', 'limited time', 'hurry', 'energy refill'],
};

// Phrases that are fine even though they contain a flagged word. A hit that
// falls inside an allowed phrase is dropped. Callers can add more.
export const DEFAULT_ALLOW = [
  'dead end', 'dead ends', 'dead zone', 'deadzone', // maze analysis, joystick dead zone
  'price is right',
];

const SEVERITY = { ui: 'warn', string: 'warn', asset: 'warn', code: 'info' };
const CODE_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.jsx', '.tsx']);
const HTML_EXT = new Set(['.html', '.htm']);
const TEXT_EXT = new Set(['.json', '.md', '.txt', '.yaml', '.yml', '.csv']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', '.vite']);

// Lowercase and split camelCase / snake_case / kebab-case into words. Splitting
// camelCase inserts characters, so keep a map from each output index back to
// the original index.
function normalize(text) {
  let out = '';
  const map = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const prev = text[i - 1];
    if (prev && /[a-z0-9]/.test(prev) && /[A-Z]/.test(c)) { out += ' '; map.push(i); }
    out += (c === '_' || c === '-') ? ' ' : c.toLowerCase();
    map.push(i);
  }
  return { out, map };
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function phraseRe(p) {
  const body = p.trim().split(/\s+/).map(escapeRe).join('[\\s]+');
  return new RegExp(`(?<![a-z0-9])${body}(?![a-z0-9])`, 'g');
}

const MATCHERS = Object.entries(WORD_LISTS).flatMap(([rule, words]) =>
  words.map((word) => ({ rule, word, re: phraseRe(word) })));
// Money amounts like "$0.99" or "£2".
MATCHERS.push({ rule: 'R13', word: '<price>', re: /[$£€]\s?\d/g });

function lineOf(text, index) {
  let n = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
}

function contextOf(text, start, end) {
  const a = Math.max(0, start - 30);
  const b = Math.min(text.length, end + 30);
  return ((a > 0 ? '…' : '') + text.slice(a, b) + (b < text.length ? '…' : ''))
    .replace(/\s+/g, ' ').trim();
}

// Core: scan one piece of text. `where(index)` turns an index into a location.
function scanOne(text, kind, where, allow) {
  if (!text) return [];
  const { out, map } = normalize(text);
  const allowed = [];
  for (const p of allow) {
    const re = phraseRe(p.toLowerCase().replace(/[-_]/g, ' '));
    for (const m of out.matchAll(re)) allowed.push([m.index, m.index + m[0].length]);
  }
  const hits = [];
  for (const { rule, word, re } of MATCHERS) {
    re.lastIndex = 0;
    for (const m of out.matchAll(re)) {
      const s = m.index;
      const e = s + m[0].length;
      if (allowed.some(([a, b]) => s >= a && e <= b)) continue;
      const os = map[s];
      const oe = map[e - 1] + 1;
      hits.push({
        rule, word, kind, severity: SEVERITY[kind],
        where: where(os), context: contextOf(text, os, oe),
      });
    }
  }
  return hits;
}

/**
 * Scan strings (visible game text by default).
 * @param {Array<string | {text: string, where?: string, kind?: 'ui'|'string'|'code'|'asset'}>|string} strings
 * @param {{allow?: string[]}} [opts] extra allowed phrases (added to DEFAULT_ALLOW)
 * @returns {Array<{rule, word, where, context, kind, severity}>}
 */
export function scanText(strings, opts = {}) {
  const allow = [...DEFAULT_ALLOW, ...(opts.allow ?? [])];
  const list = Array.isArray(strings) ? strings : [strings];
  return list.flatMap((item, i) => {
    const o = typeof item === 'string' ? { text: item } : item;
    const label = o.where ?? `text[${i}]`;
    return scanOne(o.text, o.kind ?? 'ui', () => label, allow);
  });
}

// Split JS/TS source into code (identifiers + comments) and string literals.
// Returns { code, strings: [{start, text}] } where `code` has the same length
// as `src` with string contents blanked out.
function splitJs(src) {
  const code = src.split('');
  const strings = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '/' && n === '/') { const j = src.indexOf('\n', i); i = j < 0 ? src.length : j; continue; }
    if (c === '/' && n === '*') { const j = src.indexOf('*/', i + 2); i = j < 0 ? src.length : j + 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < src.length && src[j] !== c) {
        if (src[j] === '\\') j++;
        else if (src[j] === '\n' && c !== '`') break;
        j++;
      }
      strings.push({ start: i + 1, text: src.slice(i + 1, j) });
      for (let k = i + 1; k < j && k < src.length; k++) if (src[k] !== '\n') code[k] = ' ';
      i = j + 1;
      continue;
    }
    i++;
  }
  return { code: code.join(''), strings };
}

function walk(p, out) {
  let st;
  try { st = statSync(p); } catch { return; }
  if (st.isDirectory()) {
    if (SKIP_DIRS.has(basename(p))) return;
    for (const name of readdirSync(p)) walk(join(p, name), out);
  } else out.push(p);
}

/**
 * Scan files and directories (recursively; skips node_modules, .git, dist).
 * JS/TS: identifiers and comments → code (info), string literals → string (warn).
 * HTML: <script> bodies as JS, other text/attributes → ui (warn).
 * JSON/MD/TXT/YAML/CSV → ui (warn). Anything else: only the file name → asset (warn).
 * @param {string[]|string} paths
 * @param {{allow?: string[]}} [opts]
 */
export function scanFiles(paths, opts = {}) {
  const allow = [...DEFAULT_ALLOW, ...(opts.allow ?? [])];
  const files = [];
  for (const p of Array.isArray(paths) ? paths : [paths]) walk(p, files);
  const hits = [];
  for (const file of files) {
    const ext = extname(file).toLowerCase();
    const name = basename(file, extname(file));
    hits.push(...scanOne(name, 'asset', () => `${file} (file name)`, allow));
    if (!CODE_EXT.has(ext) && !HTML_EXT.has(ext) && !TEXT_EXT.has(ext)) continue;
    const src = readFileSync(file, 'utf8');
    const at = (base = 0) => (idx) => `${file}:${lineOf(src, base + idx)}`;
    if (TEXT_EXT.has(ext)) { hits.push(...scanOne(src, 'ui', at(), allow)); continue; }
    if (CODE_EXT.has(ext)) { hits.push(...scanJs(src, 0, at, allow)); continue; }
    // HTML: pull out <script> bodies, blank them, then scan the rest as UI.
    let rest = src;
    for (const m of src.matchAll(/(<script\b[^>]*>)([\s\S]*?)<\/script>/gi)) {
      const start = m.index + m[1].length;
      hits.push(...scanJs(m[2], start, at, allow));
      rest = rest.slice(0, start) + m[2].replace(/[^\n]/g, ' ') + rest.slice(start + m[2].length);
    }
    // Visible attribute text counts as UI; the rest of each tag is blanked.
    const attrRe = /\b(?:alt|title|aria-label|placeholder|value)\s*=\s*"([^"]*)"/gi;
    rest = rest.replace(/<[^>]*>/g, (tag, off) => {
      for (const a of tag.matchAll(attrRe)) {
        const s = off + a.index + a[0].length - a[1].length - 1;
        hits.push(...scanOne(a[1], 'ui', () => `${file}:${lineOf(src, s)}`, allow));
      }
      return tag.replace(/[^\n]/g, ' ');
    });
    hits.push(...scanOne(rest, 'ui', at(), allow));
  }
  return hits;
}

function scanJs(src, base, at, allow) {
  const { code, strings } = splitJs(src);
  const hits = scanOne(code, 'code', at(base), allow);
  for (const s of strings) hits.push(...scanOne(s.text, 'string', at(base + s.start), allow));
  return hits;
}
