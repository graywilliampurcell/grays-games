// hint-timing (rubric "hint-when-stuck"): after restore() the player is left idle
// (no input) for up to IDLE_S simulated seconds (window.__game.step). We watch the
// event log and the visible text (window.__game.text() + DOM) for something that
// looks like a hint. Time to first hint is compared with hint_within_s per bracket.
// Visual-only hints (a glowing arrow) are not detected: screenshots at each
// bracket's deadline go in the evidence for Claude.

export const IDLE_S = 60;

export const HINT_RE = /\b(tap|press|click|swipe|drag|tilt|roll|move|push|hold|jump|try|find|follow|look|this way|that way|use|help|hint|where|arrow|steer|reach|get to|collect|go to|walk|turn|exit|door|way out)\b/i;

/** Pure: is this new text / event a hint? */
export function isHint({ type, text }) {
  if (type && /hint|tutorial|help|tip/i.test(type)) return true;
  if (!text) return false;
  if (!/\p{L}/u.test(text)) return false;
  return HINT_RE.test(text);
}

/**
 * Pure: first hint from observations [{t, source:'event'|'text', type?, text}].
 * @returns {{t, text, source}|null}
 */
export function firstHint(observations) {
  return observations.filter(isHint).sort((a, b) => a.t - b.t)[0] ?? null;
}

/**
 * @param {{target, observations, idleSeconds, firstHint, screenshots:{[s]: png}, screenshot}[]} pages
 */
export function evaluateHints(pages, { brackets, rubric, finding }) {
  const out = [];
  for (const p of pages) {
    const hint = p.firstHint;
    for (const b of brackets) {
      const within = rubric.threshold('hint-when-stuck', b).hint_within_s;
      const shotAt = (s) => {
        const keys = Object.keys(p.screenshots ?? {}).map(Number).sort((x, y) => x - y);
        const k = keys.find((x) => x >= s) ?? keys[keys.length - 1];
        return k !== undefined ? p.screenshots[k] : p.screenshot;
      };
      const base = { idleSeconds: p.idleSeconds, firstHint: hint, within, newText: p.observations.filter((o) => !isHint(o)).slice(0, 15), screenshots: p.screenshots };
      if (!within) {
        out.push(finding({ check: 'hint-timing', rubricCheck: 'hint-when-stuck', bracket: b, status: 'info', target: p.target,
          summary: hint ? `First hint after ${hint.t.toFixed(1)} s idle ("${hint.text}"); hints optional for ${b}` : `No hint in ${p.idleSeconds} s idle; hints optional for ${b}`,
          key: `${p.target}:optional`, details: base }));
      } else if (!hint && p.idleSeconds < within) {
        out.push(finding({ check: 'hint-timing', rubricCheck: 'hint-when-stuck', bracket: b, status: 'info', target: p.target,
          summary: `No hint in ${p.idleSeconds} s idle, but that is shorter than the ${within} s limit (run with a longer --idle)`,
          key: `${p.target}:short`, details: base }));
      } else if (hint && hint.t <= within) {
        out.push(finding({ check: 'hint-timing', rubricCheck: 'hint-when-stuck', bracket: b, status: 'pass', target: p.target,
          summary: `Hint after ${hint.t.toFixed(1)} s idle ≤ ${within} s: "${hint.text}"`, key: `${p.target}:ok`, details: base }));
      } else {
        const status = rubric.severity('hint-when-stuck', b) === 'fail' ? 'fail' : 'warn';
        out.push(finding({ check: 'hint-timing', rubricCheck: 'hint-when-stuck', bracket: b, status, target: p.target,
          summary: hint ? `First hint only after ${hint.t.toFixed(1)} s idle (want ≤ ${within} s): "${hint.text}"` : `No text/event hint within ${p.idleSeconds} s idle (want ≤ ${within} s)`,
          screenshot: shotAt(within), key: `${p.target}:${hint ? 'late' : 'none'}`, details: base }));
      }
    }
  }
  return out;
}
