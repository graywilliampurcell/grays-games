// reading-level: all visible text (window.__game.text() + DOM text on every screen)
// against rubric "reading":
//   2-4   no reading: any instruction (a string of 2+ words) is a miss
//   5-7   ≤ 5 words per instruction
//   8-10  Flesch-Kincaid grade ≤ 3
//   11-13 Flesch-Kincaid grade ≤ 6
// Single-word labels (e.g. "Race") are listed but not counted as instructions.
import { finding, missStatus } from './util.js';

/** Words = tokens containing a letter (numbers, emoji and symbols are not words). */
export function wordsOf(text) {
  return String(text).split(/[\s/|]+/).map((w) => w.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '')).filter((w) => /\p{L}/u.test(w));
}

/** Heuristic English syllable count (vowel groups, silent e, -le, min 1). */
export function syllables(word) {
  let w = String(word).toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|[^laeiouy]ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const groups = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

/**
 * Flesch-Kincaid grade level. `sentences` is an array of strings (each one a
 * sentence or UI line); strings are further split on . ! ?
 * FK = 0.39 * (words / sentences) + 11.8 * (syllables / words) − 15.59
 */
export function fkGrade(sentences) {
  const list = (Array.isArray(sentences) ? sentences : [sentences])
    .flatMap((s) => String(s).split(/[.!?]+(?:\s|$)/)).map((s) => s.trim()).filter((s) => wordsOf(s).length);
  const words = list.flatMap(wordsOf);
  if (!words.length) return null;
  const syl = words.reduce((a, w) => a + syllables(w), 0);
  const grade = 0.39 * (words.length / list.length) + 11.8 * (syl / words.length) - 15.59;
  return Math.round(grade * 10) / 10;
}

/** Split collected strings into instructions (2+ words) and labels (1 word). Pure. */
export function classifyStrings(strings) {
  const uniq = [...new Set(strings.map((s) => String(s).replace(/\s+/g, ' ').trim()).filter(Boolean))];
  const instructions = [];
  const labels = [];
  for (const s of uniq) {
    const n = wordsOf(s).length;
    if (n >= 2) instructions.push({ text: s, words: n, grade: fkGrade([s]) });
    else if (n === 1) labels.push(s);
  }
  return { instructions, labels };
}

/**
 * @param {{text, screen, screenshot}[]} texts  every string seen, with where it was seen
 */
export function evaluateReading(texts, { brackets, rubric, audio }) {
  const shotOf = new Map();
  for (const t of texts) if (!shotOf.has(t.text) && t.screenshot) shotOf.set(t.text, { screenshot: t.screenshot, screen: t.screen });
  const { instructions, labels } = classifyStrings(texts.map((t) => t.text));
  const grade = fkGrade(instructions.map((i) => i.text));
  const longest = [...instructions].sort((a, b) => b.words - a.words);
  const hardest = [...instructions].filter((i) => i.grade !== null).sort((a, b) => b.grade - a.grade);
  const base = { instructions: instructions.length, labels, fkGrade: grade, longest: longest.slice(0, 8), hardest: hardest.slice(0, 8), audioPresent: audio };
  const where = (s) => shotOf.get(s?.text) ?? {};
  const out = [];
  for (const b of brackets) {
    const th = rubric.threshold('reading', b);
    let miss = null;
    let summary;
    if (th.max_words_per_instruction === 0 || th.reading_required === false) {
      if (instructions.length) {
        miss = longest[0];
        summary = `${instructions.length} instruction(s) need reading (pre-readers: none); e.g. "${miss.text}" (${miss.words} words)`;
      } else summary = `No instructions to read (${labels.length} one-word labels)`;
    } else if (th.max_words_per_instruction) {
      const over = instructions.filter((i) => i.words > th.max_words_per_instruction);
      if (over.length) {
        miss = longest[0];
        summary = `${over.length} instruction(s) over ${th.max_words_per_instruction} words; longest "${miss.text}" (${miss.words} words)`;
      } else summary = `All instructions ≤ ${th.max_words_per_instruction} words (longest ${longest[0]?.words ?? 0})`;
      if (th.audio_with_text) summary += audio ? '; game has audio (whether it speaks is for Claude/a person)' : '; no audio at all, so no spoken support';
    } else if (th.max_reading_grade) {
      if (grade !== null && grade > th.max_reading_grade) {
        miss = hardest[0];
        summary = `Reading grade ${grade} > ${th.max_reading_grade} (Flesch-Kincaid over ${instructions.length} instructions); hardest "${miss?.text}" (grade ${miss?.grade})`;
      } else summary = `Reading grade ${grade ?? 'n/a'} ≤ ${th.max_reading_grade} (Flesch-Kincaid over ${instructions.length} instructions)`;
    } else continue;
    const w = where(miss);
    out.push(finding({ check: 'reading-level', rubricCheck: 'reading', bracket: b, status: miss ? missStatus(rubric, 'reading', b) : 'pass',
      summary, screenshot: miss ? w.screenshot : undefined, key: miss ? miss.text : 'ok',
      details: { ...base, threshold: th, example: miss ? { ...miss, screen: w.screen } : null } }));
  }
  return out;
}
