// word-scan: lib/wordscan.js over the text seen in the game (window.__game.text()
// + DOM text on every screen) and over the game's source (index.html, src, public).
// UI/string/asset hits are warn (evidence for Claude, per rule); code-only hits
// (identifiers, comments) are info.
import { existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { scanFiles, scanText } from '../wordscan.js';
import { REPO_ROOT } from '../config.js';

/** Default source paths for a game: its config `checks.scanPaths`, else the whole game dir. */
export function sourcePaths(game) {
  const list = game.checks?.scanPaths ?? ['.'];
  return list.map((p) => resolve(game.absDir, p)).filter((p) => existsSync(p));
}

/**
 * @param {{text, screen, screenshot}[]} texts  game text seen during the run
 * @param {object} game
 */
export function evaluateWordScan(texts, game, { finding, allow = [] }) {
  const shotOf = new Map();
  for (const t of texts) if (!shotOf.has(t.text)) shotOf.set(t.text, t);
  const uniq = [...shotOf.values()];
  const uiHits = scanText(uniq.map((t) => ({ text: t.text, where: `screen ${t.screen}`, kind: 'ui' })), { allow });
  const fileHits = scanFiles(sourcePaths(game), { allow: [...allow, ...(game.checks?.wordAllow ?? [])] })
    .map((h) => ({ ...h, where: h.where.startsWith('/') ? relative(REPO_ROOT, h.where) : h.where }));
  const fallbackShot = texts.find((t) => t.screenshot)?.screenshot;
  const out = [];
  const group = (hits) => {
    const m = new Map();
    for (const h of hits) {
      const k = `${h.rule}|${h.kind}`;
      const e = m.get(k) ?? { rule: h.rule, kind: h.kind, severity: h.severity, words: new Set(), hits: [] };
      e.words.add(h.word);
      e.hits.push(h);
      m.set(k, e);
    }
    return [...m.values()];
  };
  for (const g of group(uiHits)) {
    const first = g.hits[0];
    const src = uniq.find((t) => first.where === `screen ${t.screen}` && t.text.toLowerCase().includes(first.word.split(' ')[0])) ?? uniq[0];
    out.push(finding({ check: 'word-scan', rule: g.rule, status: 'warn',
      summary: `Game text uses ${[...g.words].map((w) => `"${w}"`).join(', ')} (${g.hits.length} hit(s)), e.g. "${first.context}"`,
      screenshot: src?.screenshot ?? fallbackShot, key: `ui:${g.rule}:${[...g.words].sort().join(',')}`,
      details: { kind: 'ui', hits: g.hits.slice(0, 30) } }));
  }
  for (const g of group(fileHits)) {
    const status = g.severity === 'warn' ? 'warn' : 'info';
    out.push(finding({ check: 'word-scan', rule: g.rule, status,
      summary: `Source ${g.kind} hits: ${[...g.words].slice(0, 8).map((w) => `"${w}"`).join(', ')} (${g.hits.length}), e.g. ${g.hits[0].where}: ${g.hits[0].context}`,
      screenshot: status === 'info' ? undefined : fallbackShot, key: `file:${g.rule}:${g.kind}:${[...g.words].sort().join(',')}`,
      details: { kind: g.kind, hits: g.hits.slice(0, 40), total: g.hits.length } }));
  }
  if (!out.some((f) => f.status !== 'info')) {
    out.push(finding({ check: 'word-scan', status: 'pass',
      summary: `No flagged words in ${uniq.length} game strings or in visible/source strings (${fileHits.length} code-only hits are info)`, key: 'clean',
      details: { strings: uniq.length, paths: sourcePaths(game).map((p) => relative(REPO_ROOT, p)) } }));
  }
  return out;
}
