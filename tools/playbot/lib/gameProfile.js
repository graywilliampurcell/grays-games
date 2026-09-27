// Game profiles (Phase 4), in the template shape from knowledge/kid-game-patterns.md.
//
// - Our game: numbers from bot runs (play.json from the bots, checks.json from the automatic checks,
//   claude.json if judged) + key screenshots + a judge call for the qualitative fields.
//   Cached in profiles/<game>.json (rebuilt when the run or its inputs change, or with refresh).
// - Comparable games: from a saved human-speed session file (profiles/comparables/<slug>.session.{md,txt,json})
//   when one exists, else from Claude's knowledge (seeded with knowledge/comparables.md).
//   Cached in profiles/comparables/<slug>.json and reused.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PLAYBOT_DIR } from './config.js';
import { judge } from './judge.js';
import { gameTextBlock } from './claudeChecks.js';

export const PROFILES_DIR = resolve(PLAYBOT_DIR, 'profiles');
export const COMPARABLES_DIR = resolve(PROFILES_DIR, 'comparables');
const KNOWLEDGE_DIR = resolve(PLAYBOT_DIR, 'knowledge');

export const PROFILE_FIELDS = [
  'onboarding', 'controls', 'core_loop', 'goals_and_rewards', 'difficulty_curve', 'game_feel',
  'art_and_audio', 'session_length', 'usability', 'accessibility', 'ads_and_purchases', 'notes',
];

const profileProps = () => ({
  genre: { type: 'string' },
  web_playable: { type: 'string' },
  ...Object.fromEntries(PROFILE_FIELDS.map((f) => [f, { type: 'string' }])),
});

export const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-').slice(0, 60) || 'game';

export function readKnowledge(name) {
  const p = join(KNOWLEDGE_DIR, name);
  return existsSync(p) ? readFileSync(p, 'utf8') : '';
}

/** Shrink a big JSON (bot output) for a prompt: short strings, first N array items, max length. */
export function condenseJson(value, { maxLen = 9000, maxItems = 15, maxStr = 200 } = {}) {
  const walk = (v, depth) => {
    if (Array.isArray(v)) {
      const items = v.slice(0, maxItems).map((x) => walk(x, depth + 1));
      if (v.length > maxItems) items.push(`… ${v.length - maxItems} more`);
      return items;
    }
    if (v && typeof v === 'object') {
      if (depth > 6) return '{…}';
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, depth + 1)]));
    }
    if (typeof v === 'string' && v.length > maxStr) return `${v.slice(0, maxStr)}…`;
    if (typeof v === 'number' && !Number.isInteger(v)) return Math.round(v * 1000) / 1000;
    return v;
  };
  let s = JSON.stringify(walk(value, 0));
  if (s.length > maxLen) s = `${s.slice(0, maxLen)}… (truncated)`;
  return s;
}

function readJsonIf(p) {
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

/** Bot numbers available for a run: play.json / checks.json / claude.json / smoke.json in the run dir. */
export function collectRunInputs(runDir) {
  const inputs = {};
  for (const name of ['play.json', 'checks.json', 'claude.json', 'smoke.json']) {
    const p = join(runDir, name);
    if (existsSync(p)) inputs[name] = { path: p, mtimeMs: statSync(p).mtimeMs, data: readJsonIf(p) };
  }
  return inputs;
}

function inputsSummary(inputs) {
  const parts = [];
  if (inputs['play.json']) parts.push(`Bot play results (play.json: solver/monkey/explorer/kid personas — time to first win, fails, stuck spots, fps):\n${condenseJson(inputs['play.json'].data)}`);
  else parts.push('No bot play results (play.json) for this run: say "not measured" for numbers you cannot see, and do not invent numbers.');
  if (inputs['checks.json']) parts.push(`Automatic checks (checks.json):\n${condenseJson(inputs['checks.json'].data, { maxLen: 6000 })}`);
  if (inputs['claude.json']) {
    const c = inputs['claude.json'].data;
    const brief = {
      result: c.result,
      rules_not_pass: (c.rules ?? []).filter((r) => r.verdict !== 'pass').map((r) => ({ rule: r.rule, verdict: r.verdict, reason: r.reason })),
      brackets: Object.fromEntries(Object.entries(c.bracketResults ?? {}).map(([b, br]) => [b, br.checks.map((x) => `${x.check}: ${x.verdict} — ${x.reason}`)])),
    };
    parts.push(`Claude content/rubric checks already made for this run (claude.json):\n${JSON.stringify(brief)}`);
  }
  if (inputs['smoke.json']) {
    const s = inputs['smoke.json'].data;
    parts.push(`Smoke test: ${s.passed ? 'passed' : 'failed'}; ${JSON.stringify((s.results ?? []).map((r) => ({ url: r.url, loadMs: r.loadMs, readyMs: r.readyMs, errors: r.errors?.length })))}`);
  }
  return parts.join('\n\n');
}

// ------------------------------------------------------------------ our game

export async function buildGameProfile({ game, runDir, keyshots, setup, config, model, provider, refresh = false, log = console.error }) {
  mkdirSync(PROFILES_DIR, { recursive: true });
  const cachePath = join(PROFILES_DIR, `${game}.json`);
  const inputs = collectRunInputs(runDir);
  const inputKey = Object.fromEntries(Object.entries(inputs).map(([k, v]) => [k, v.mtimeMs]));
  const cached = readJsonIf(cachePath);
  if (!refresh && cached && cached.runDir === runDir && JSON.stringify(cached.inputKey) === JSON.stringify(inputKey)) {
    log(`[profile] ${game}: reusing ${cachePath}`);
    return { ...cached, cached: true };
  }

  const { manifest, text, dir } = keyshots;
  const images = manifest.shots.map((s) => join(dir, s.file));
  const template = readKnowledge('kid-game-patterns.md').split('## Game profile template')[1] ?? '';
  const prompt = `You are describing the kids' web game "${game}" in a fixed "game profile" shape so it can be compared with popular kids' games.
Chosen age brackets: ${setup.brackets.join(', ')}.${setup.genre ? ` Genre (from its Tester profile): ${setup.genre}.` : ''}${setup.focus ? ` Focus: ${setup.focus}.` : ''}

Use ONLY the evidence below (screenshots from a bot run, the game's text, and the bot's measured numbers). Put real numbers in wherever the evidence has them (time to first win, fails, stuck spots, fps, words per instruction, taps to play, ...) and say "not measured" where it does not. Be concrete and short (1–3 sentences per field). Flag ads and purchases only.

Profile template:
${template.trim()}

Screenshots (read every one):
${manifest.shots.map((s) => `- ${s.file} [${s.screen}] ${s.description}`).join('\n')}

Game text:
${gameTextBlock(text, { maxSource: 150 })}

Bot numbers and checks:
${inputsSummary(inputs)}

Return the profile fields as JSON (genre, web_playable and every template field as a string).`;
  const schema = { type: 'object', required: ['genre', 'web_playable', ...PROFILE_FIELDS], properties: profileProps() };
  const t0 = Date.now();
  const res = await judge({ prompt, images, schema, config, model, provider });
  const seconds = Math.round((Date.now() - t0) / 1000);
  log(`[profile] ${game}: built (${seconds}s, $${(res.costUsd ?? 0).toFixed(3)})`);

  const numbers = {};
  if (inputs['play.json']) numbers.play = inputs['play.json'].data?.summary ?? inputs['play.json'].data?.metrics ?? null;
  const out = {
    game,
    source: inputs['play.json'] ? 'bot-run' : 'bot-run (key screenshots only; no play.json yet)',
    brackets: setup.brackets,
    profile: { game, source: inputs['play.json'] ? 'bot-run' : 'bot-run', brackets: setup.brackets, ...res.value },
    numbers,
    runDir,
    inputKey,
    inputs: Object.keys(inputs),
    builtAt: new Date().toISOString(),
    judge: { provider: res.provider, model: res.model, seconds, costUsd: res.costUsd ?? 0 },
  };
  writeFileSync(cachePath, JSON.stringify(out, null, 2));
  return { ...out, cached: false };
}

// ------------------------------------------------------------------ comparable games

function sessionFileFor(slug) {
  if (!existsSync(COMPARABLES_DIR)) return null;
  const f = readdirSync(COMPARABLES_DIR).find((n) => n.startsWith(`${slug}.session.`) || n.startsWith(`${slug}-session.`));
  return f ? join(COMPARABLES_DIR, f) : null;
}

export function loadCachedComparable(title) {
  const p = join(COMPARABLES_DIR, `${slugify(title)}.json`);
  return readJsonIf(p);
}

/**
 * Get profiles for comparable games.
 * @param {object} o
 * @param {'tester-profile'|'claude-picks'} o.mode
 * @param {{title, compare}[]} o.list  (tester-profile mode)
 * Returns { picks: [{title, compare, why, slug, source, profile, cached}], seconds, costUsd }.
 */
export async function getComparableProfiles({ mode, list = [], game, ourProfile, setup, config, model, provider, refresh = false, log = console.error }) {
  mkdirSync(COMPARABLES_DIR, { recursive: true });
  const cachedSlugs = existsSync(COMPARABLES_DIR)
    ? readdirSync(COMPARABLES_DIR).filter((n) => n.endsWith('.json') && !n.includes('.session.')).map((n) => n.replace(/\.json$/, ''))
    : [];
  const comparablesMd = readKnowledge('comparables.md');
  let picks = mode === 'tester-profile' ? list.map((c) => ({ ...c, why: 'listed in the game\'s Tester profile' })) : null;

  // Which profiles have to be made (or remade) now?
  const needProfile = (title) => refresh || !loadCachedComparable(title) || !!sessionFileFor(slugify(title)) && loadCachedComparable(title)?.source !== 'human-session';
  const sessions = {};
  const describeSessions = () => Object.entries(sessions).map(([t, s]) => `### Human-speed session notes for "${t}" (use these as the main source; source = human-session)\n${s}`).join('\n\n');

  const profileSchema = { type: ['object', 'null'], properties: profileProps() };
  const schema = {
    type: 'object',
    required: ['picks'],
    properties: {
      picks: {
        type: 'array',
        items: {
          type: 'object',
          required: ['title', 'compare', 'why', 'profile'],
          properties: { title: { type: 'string' }, compare: { type: 'string' }, why: { type: 'string' }, profile: profileSchema },
        },
      },
    },
  };

  let seconds = 0;
  let costUsd = 0;
  const toMake = picks ? picks.filter((p) => needProfile(p.title)) : null;
  for (const p of picks ?? []) { const s = sessionFileFor(slugify(p.title)); if (s) sessions[p.title] = readFileSync(s, 'utf8').slice(0, 8000); }

  if (!picks || toMake.length) {
    const ourBrief = JSON.stringify(ourProfile?.profile ?? {}).slice(0, 4000);
    const task = picks
      ? `Write game profiles for these comparable games: ${toMake.map((p) => `"${p.title}" (compare: ${p.compare || 'general'})`).join(', ')}. Return one pick per game with the same title and compare text.`
      : `This game has no Tester profile, so pick 2–4 comparable games for this run: popular games a child in the chosen brackets might know that are most useful to compare "${game}" against (same genre first, then games strong at what "${game}" most needs). Use the reference list below and your own knowledge. For each, say what to compare ("compare") and why it was picked ("why"). ` +
        `Profiles already cached (slugs: ${cachedSlugs.join(', ') || 'none'}): for a pick whose slug (lowercase, dashes) is in that list, set "profile" to null; otherwise write its profile.`;
    const prompt = `You help compare a kids' web game with popular kids' games.
Our game: "${game}". Chosen age brackets: ${setup.brackets.join(', ')}.${setup.genre ? ` Genre: ${setup.genre}.` : ''}
Our game's profile (from bot runs): ${ourBrief}

${task}

Profiles use the template fields (genre, web_playable, ${PROFILE_FIELDS.join(', ')}); 1–3 concrete sentences each. Unless session notes are given, the profile comes from your general knowledge: do not claim to have played it, and flag ads and purchases only. Use the reference profiles below when the game is listed there.

Reference list (knowledge/comparables.md):
${comparablesMd}
${Object.keys(sessions).length ? `\n${describeSessions()}\n` : ''}`;
    const t0 = Date.now();
    const res = await judge({ prompt, schema, config, model, provider });
    seconds += (Date.now() - t0) / 1000;
    costUsd += res.costUsd ?? 0;
    log(`[profile] comparables: ${res.value.picks.map((p) => p.title).join(', ')} (${Math.round(seconds)}s, $${costUsd.toFixed(3)})`);
    const made = new Map(res.value.picks.map((p) => [slugify(p.title), p]));
    if (!picks) {
      picks = res.value.picks.slice(0, 4).map(({ title, compare, why }) => ({ title, compare, why }));
      for (const p of picks) { const s = sessionFileFor(slugify(p.title)); if (s) sessions[p.title] = true; }
    }
    for (const [slug, p] of made) {
      if (!p.profile) continue;
      const src = sessions[p.title] ? 'human-session' : 'general-knowledge-not-played';
      const doc = {
        title: p.title, slug, source: src, profile: { game: p.title, source: src, ...p.profile },
        sessionFile: sessionFileFor(slug), madeAt: new Date().toISOString(), judge: { provider: res.provider, model: res.model },
      };
      writeFileSync(join(COMPARABLES_DIR, `${slug}.json`), JSON.stringify(doc, null, 2));
    }
  }

  // Claude picked a title it thought was cached but isn't (slug mismatch): make the missing ones now.
  if (mode === 'claude-picks' && picks.some((p) => !loadCachedComparable(p.title))) {
    const more = await getComparableProfiles({ mode: 'tester-profile', list: picks.filter((p) => !loadCachedComparable(p.title)), game, ourProfile, setup, config, model, provider, log });
    seconds += more.seconds;
    costUsd += more.costUsd;
  }

  const out = [];
  for (const p of picks) {
    const slug = slugify(p.title);
    const doc = loadCachedComparable(p.title);
    if (!doc) { log(`[profile] warn: no profile for "${p.title}"`); continue; }
    out.push({ ...p, slug, source: doc.source, profile: doc.profile, cachedAt: doc.madeAt, path: join(COMPARABLES_DIR, `${slug}.json`) });
  }
  return { picks: out, seconds: Math.round(seconds), costUsd: Math.round(costUsd * 1000) / 1000 };
}
