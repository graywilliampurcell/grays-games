// Tester profile READER (Phase 4). Never writes profiles.
//
// A game's plan may have a "Tester profile" section:
//   - Age brackets: 5–7, 8–10
//   - Genre: first-person maze
//   - Comparable games: 2–4 titles, and what to compare in each, either inline
//       "PBS KIDS mazes: onboarding and voice-over; Pac-Man: feedback and pacing"
//     or as nested bullets
//       - PBS KIDS mazes: onboarding and voice-over
//   - Focus: anything this game especially cares about, or anything allowed on purpose
//
// Node can't call the Notion MCP, so the /playtest skill fetches the plan page and saves its markdown
// to a file (or the user passes --profile <file.md>). This module parses that markdown.
import { readFileSync } from 'node:fs';

const FIELD_ALIASES = {
  brackets: /^(age\s*brackets?|brackets?|ages?)$/i,
  genre: /^genre$/i,
  comparables: /^(comparable\s*games?|comparables?|compare\s*(with|against|to))$/i,
  focus: /^(focus|allowed\s+on\s+purpose)$/i,
};

/** Strip Notion/markdown decoration from one line. */
function clean(s) {
  return String(s)
    .replace(/<[^>]+>/g, '')          // notion tags
    .replace(/\*\*|__|`/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Find the "Tester profile" section and return its raw lines (until the next heading of the same or higher level). */
export function findTesterProfileSection(markdown) {
  const lines = String(markdown).split(/\r?\n/);
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    const h = /^(#{1,6})\s+(.*)$/.exec(t);
    const title = h ? clean(h[2]) : /^\*\*(.+?)\*\*:?\s*$/.test(t) ? clean(t) : null;
    if (title && /^tester\s+profile\b/i.test(title.replace(/^[^\w]+/, ''))) {
      start = i + 1;
      level = h ? h[1].length : 7; // bold-line "heading" ends at any real heading
      break;
    }
  }
  if (start < 0) return null;
  const out = [];
  for (let i = start; i < lines.length; i++) {
    const h = /^\s*(#{1,6})\s+/.exec(lines[i]);
    if (h && h[1].length <= level) break;
    if (level === 7 && /^\s*(#{1,6})\s+/.test(lines[i])) break;
    if (/^\s*---\s*$/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out;
}

/** "5–7, 8-10 and 11–13" → ['5-7','8-10','11-13'] (only known brackets when `known` is given). */
export function parseBracketList(s, known) {
  const found = [...String(s).replace(/[–—]/g, '-').matchAll(/(\d{1,2})\s*-\s*(\d{1,2})/g)].map((m) => `${Number(m[1])}-${Number(m[2])}`);
  const uniq = [...new Set(found)];
  return known ? uniq.filter((b) => known.includes(b)) : uniq;
}

function parseComparableItem(s) {
  const t = clean(s).replace(/^[-*•]\s*/, '');
  if (!t) return null;
  // "Title: what" | "Title — what" | "Title (what)"
  let m = /^(.+?)\s*(?::|—|–| - )\s*(.+)$/.exec(t);
  if (m) return { title: m[1].replace(/^["“]|["”]$/g, '').trim(), compare: m[2].trim() };
  m = /^(.+?)\s*\((.+)\)$/.exec(t);
  if (m) return { title: m[1].trim(), compare: m[2].trim() };
  return { title: t, compare: '' };
}

/**
 * Parse a plan page's markdown. Returns
 * { found, brackets, genre, comparables: [{title, compare}], focus, raw, warnings }.
 */
export function parseTesterProfile(markdown, { knownBrackets } = {}) {
  const section = findTesterProfileSection(markdown);
  const res = { found: false, brackets: [], genre: null, comparables: [], focus: null, raw: null, warnings: [] };
  if (!section) return res;
  res.found = true;
  res.raw = section.join('\n').trim();

  let current = null; // field whose nested bullets we're collecting
  let currentIndent = -1;
  const append = (field, value) => {
    const v = clean(value);
    if (!v) return;
    if (field === 'brackets') res.brackets.push(...parseBracketList(v, knownBrackets));
    else if (field === 'genre') res.genre = res.genre ? `${res.genre}; ${v}` : v;
    else if (field === 'focus') res.focus = res.focus ? `${res.focus}; ${v}` : v;
    else if (field === 'comparables') {
      // Inline lists separated by ";" (commas are too common inside "what to compare").
      const parts = v.split(/\s*;\s*/).filter(Boolean);
      for (const p of parts) { const c = parseComparableItem(p); if (c) res.comparables.push(c); }
    }
  };

  for (const line of section) {
    if (!line.trim()) continue;
    const indent = line.replace(/\t/g, '    ').search(/\S/);
    const body = line.trim().replace(/^[-*•]\s+|^\d+[.)]\s+/, '');
    const m = /^(?:\*\*|__)?([^:*_]{2,40}?)(?:\*\*|__)?\s*:\s*(?:\*\*|__)?\s*(.*)$/.exec(body);
    const key = m ? clean(m[1]) : null;
    const field = key ? Object.keys(FIELD_ALIASES).find((f) => FIELD_ALIASES[f].test(key)) : null;
    if (field) {
      current = field;
      currentIndent = indent;
      append(field, m[2]);
      continue;
    }
    if (current && indent > currentIndent) {
      if (current === 'comparables') { const c = parseComparableItem(body); if (c) res.comparables.push(c); }
      else append(current, body);
      continue;
    }
    current = null;
  }
  res.brackets = [...new Set(res.brackets)];
  if (!res.brackets.length) res.warnings.push('Tester profile has no age brackets');
  if (!res.comparables.length) res.warnings.push('Tester profile lists no comparable games');
  return res;
}

export function readTesterProfile(file, opts) {
  return { ...parseTesterProfile(readFileSync(file, 'utf8'), opts), source: file };
}

/**
 * Decide brackets + comparables for a run.
 *   --brackets from the user always wins; else the profile's brackets (pre-selected defaults);
 *   no profile and no --brackets → error (brackets must come from the user).
 *   comparables: the profile's list, else mode "claude-picks" (Claude picks 2–4 for this run, named in the report).
 */
export function resolveReviewSetup({ profile, bracketsFlag, parseBrackets, rubric, gameName, planPage }) {
  let brackets;
  let bracketsFrom;
  if (bracketsFlag && bracketsFlag !== true) {
    brackets = parseBrackets(bracketsFlag, rubric);
    bracketsFrom = 'user (--brackets)';
  } else if (profile?.found && profile.brackets.length) {
    brackets = profile.brackets;
    bracketsFrom = 'Tester profile';
  } else {
    const list = rubric.bracketIds.map((b) => `  ${b}  ${rubric.brackets[b].label}: ${String(rubric.brackets[b].description).trim()}`).join('\n');
    throw new Error(`No Tester profile brackets for ${gameName}${planPage ? ` (plan: ${planPage})` : ''}. ` +
      `Pick one or more age brackets with --brackets, e.g. --brackets 5-7\n${list}`);
  }
  const comparables = profile?.found && profile.comparables.length
    ? { mode: 'tester-profile', list: profile.comparables }
    : { mode: 'claude-picks', list: [] };
  return {
    brackets, bracketsFrom, comparables,
    genre: profile?.genre ?? null, focus: profile?.focus ?? null,
    profileFound: !!profile?.found, profileSource: profile?.source ?? null,
    profileWarnings: profile?.warnings ?? [],
  };
}
