// Comparison (Phase 4): our game's profile vs. comparable games' profiles + the kid-game patterns list,
// ranked by how much each point matters for the chosen age brackets.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { judge } from './judge.js';
import { readKnowledge } from './gameProfile.js';

const PRIORITY = { high: 0, medium: 1, low: 2 };
export const AREAS = [
  'onboarding', 'controls', 'core loop', 'goals and rewards', 'difficulty curve', 'game feel',
  'art and audio', 'session length', 'usability', 'accessibility', 'ads and purchases',
];

const schema = {
  type: 'object',
  required: ['summary', 'items', 'patterns'],
  properties: {
    summary: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        required: ['area', 'compared_with', 'they_do', 'we_do', 'suggestion', 'matters_for_brackets', 'priority'],
        properties: {
          area: { type: 'string', enum: AREAS },
          compared_with: { type: 'array', items: { type: 'string' } },
          they_do: { type: 'string' },
          we_do: { type: 'string' },
          suggestion: { type: 'string' },
          matters_for_brackets: { type: 'array', items: { type: 'string' } },
          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
      },
    },
    patterns: {
      type: 'object',
      required: ['present', 'missing', 'avoid_seen'],
      properties: {
        present: { type: 'array', items: { type: 'object', required: ['pattern', 'evidence'], properties: { pattern: { type: 'string' }, evidence: { type: 'string' } } } },
        missing: { type: 'array', items: { type: 'object', required: ['pattern', 'suggestion'], properties: { pattern: { type: 'string' }, suggestion: { type: 'string' }, matters_for_brackets: { type: 'array', items: { type: 'string' } } } } },
        avoid_seen: { type: 'array', items: { type: 'object', required: ['pattern', 'evidence'], properties: { pattern: { type: 'string' }, evidence: { type: 'string' } } } },
      },
    },
  },
};

/**
 * @param {object} o
 * @param {object} o.ourProfile    from buildGameProfile()
 * @param {object} o.comparables   from getComparableProfiles()
 * @param {object} o.setup         from resolveReviewSetup()
 */
export async function runCompare({ game, runDir, setup, ourProfile, comparables, config, model, provider, log = console.error }) {
  const patterns = readKnowledge('kid-game-patterns.md').split('## Game profile template')[0];
  const comps = comparables.picks.map((p) => ({ title: p.title, compare: p.compare, why: p.why, source: p.source, profile: p.profile }));
  const prompt = `You compare a kids' web game with popular kids' games and give the developer (a parent building games for his young kid) specific, actionable suggestions.

Our game: "${game}". Chosen age brackets: ${setup.brackets.join(', ')} (rank by what matters most for these; the youngest is strictest).
${setup.genre ? `Genre: ${setup.genre}.\n` : ''}${setup.focus ? `Focus / allowed on purpose (respect it; don't suggest removing what is allowed on purpose): ${setup.focus}\n` : ''}
Our game's profile (source: ${ourProfile.source}):
${JSON.stringify(ourProfile.profile, null, 1)}

Comparable games (${comparables.picks.length}; ${setup.comparables.mode === 'tester-profile' ? 'from the game\'s Tester profile' : 'picked by Claude for this run'}). Each has "compare" = what to compare in it:
${JSON.stringify(comps, null, 1)}

Kid-game patterns (proven mechanics and patterns to avoid):
${patterns.trim()}

Wording: nothing dies in these games; call failure messages "fail" or "spike" messages, never "death".
Hard constraints (always-true content rules): never suggest ads, purchases, loot boxes, streaks, countdown pressure, energy timers, chat, accounts, weapons, injury, or anything else those patterns-to-avoid list. A comparable game's monetisation is only something to NOT copy.

Produce:
1. "items": 6–12 comparison points "they do X, we do Y, suggestion". Each names the comparable game(s) in "compared_with" (titles exactly as above) and says what they do concretely, what our game does now (use the numbers from our profile), and ONE specific change for our game that fits a small three.js web game (e.g. "add a 3-word spoken line 'Find the door!' when Level 1 starts", not "improve onboarding"). "matters_for_brackets" lists the chosen brackets it matters for. "priority" = high/medium/low for the chosen brackets. Order the list from most to least important.
2. "patterns": which kid-game patterns are present in our game (with evidence), which are missing (with a suggestion), and any patterns-to-avoid seen (evidence).
3. "summary": 2–3 sentences.`;
  const t0 = Date.now();
  const res = await judge({ prompt, schema, config, model, provider });
  const seconds = Math.round((Date.now() - t0) / 1000);
  log(`[compare] ${game}: ${res.value.items.length} items (${seconds}s, $${(res.costUsd ?? 0).toFixed(3)})`);

  // Rank: priority first, Claude's order within a priority.
  const items = res.value.items
    .map((it, i) => ({ ...it, _i: i }))
    .sort((a, b) => PRIORITY[a.priority] - PRIORITY[b.priority] || a._i - b._i)
    .map(({ _i, ...it }, rank) => ({ rank: rank + 1, ...it }));
  return {
    game,
    runDir,
    createdAt: new Date().toISOString(),
    brackets: setup.brackets,
    bracketsFrom: setup.bracketsFrom,
    testerProfile: setup.profileFound ? { source: setup.profileSource, genre: setup.genre, focus: setup.focus } : null,
    comparablesMode: setup.comparables.mode,
    comparablesNote: setup.comparables.mode === 'claude-picks'
      ? `No Tester profile: Claude picked these comparable games for this run: ${comparables.picks.map((p) => p.title).join(', ')}.`
      : `Comparable games from the Tester profile: ${comparables.picks.map((p) => p.title).join(', ')}.`,
    comparables: comparables.picks.map((p) => ({ title: p.title, compare: p.compare, why: p.why, source: p.source, profilePath: p.path })),
    summary: res.value.summary,
    items,
    patterns: res.value.patterns,
    judge: { provider: res.provider, model: res.model, seconds, costUsd: res.costUsd ?? 0 },
  };
}

export function writeCompare(runDir, result) {
  writeFileSync(join(runDir, 'compare.json'), JSON.stringify(result, null, 2));
}

export function formatCompare(res) {
  const out = [];
  out.push(`Comparison for ${res.game} (${res.brackets.join(', ')}; brackets from ${res.bracketsFrom})`);
  out.push(res.comparablesNote);
  for (const c of res.comparables) out.push(`  - ${c.title} [${c.source}]: ${c.compare}${c.why ? ` — ${c.why}` : ''}`);
  out.push('');
  out.push(res.summary);
  out.push('');
  for (const it of res.items) {
    out.push(`${it.rank}. [${it.priority.toUpperCase()}] ${it.area} (vs ${it.compared_with.join(', ')}; ${it.matters_for_brackets.join(', ')})`);
    out.push(`   They do: ${it.they_do}`);
    out.push(`   We do:   ${it.we_do}`);
    out.push(`   Suggest: ${it.suggestion}`);
  }
  out.push('');
  out.push(`Patterns present: ${res.patterns.present.map((p) => p.pattern).join('; ') || 'none'}`);
  out.push(`Patterns missing: ${res.patterns.missing.map((p) => p.pattern).join('; ') || 'none'}`);
  if (res.patterns.avoid_seen.length) out.push(`Avoid-patterns seen: ${res.patterns.avoid_seen.map((p) => `${p.pattern} (${p.evidence})`).join('; ')}`);
  if (res.cost) out.push(`\nTime ${res.cost.seconds}s, cost $${res.cost.costUsd}`);
  return out.join('\n');
}
