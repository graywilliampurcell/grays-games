// countdown-timers (R14 "no countdown pressure"; rubric "time-pressure"): scan the
// text samples taken while playing (window.__game.text() + DOM text, every 0.5 s)
// and state() for timer patterns: clock readouts (0:45), "time left", "hurry",
// numbers that count down between samples, and state fields named like timers.
// Evidence only (warn); Claude/a person decides whether it is pressure.

export const TEXT_PATTERNS = [
  { id: 'clock', re: /\b\d{1,2}:\d{2}(?:[.:]\d{1,3})?\b/ },
  { id: 'time-words', re: /\b(time left|time's up|times up|time up|seconds? left|hurry|countdown|out of time|timer|time limit|limited time)\b/i },
  { id: 'seconds', re: /\b\d+(?:\.\d+)?\s?(?:s|sec|secs|seconds)\b/i },
];

const STATE_KEYS = /(timer|timeleft|time_left|countdown|remaining_?time|deadline)/i;

/** Pure: find timer-like strings. samples: [{t, texts:string[]}] */
export function detectTimers(samples) {
  const hits = [];
  const seen = new Set();
  for (const s of samples) {
    for (const text of s.texts) {
      for (const p of TEXT_PATTERNS) {
        if (p.re.test(text) && !seen.has(`${p.id}|${text}`)) {
          seen.add(`${p.id}|${text}`);
          hits.push({ kind: p.id, text, t: s.t });
        }
      }
    }
  }
  // Countdown: a short numeric-only string whose value goes down across ≥ 3 consecutive samples.
  const nums = samples.map((s) => ({ t: s.t, v: s.texts.filter((x) => /^\d{1,3}$/.test(x.trim())).map(Number) }));
  let run = 0;
  for (let i = 1; i < nums.length; i++) {
    const prev = nums[i - 1].v;
    const cur = nums[i].v;
    if (cur.join() === prev.join()) continue; // unchanged since the last sample (sampled every 0.5 s)
    // A number that disappeared was replaced by the number one below it (3 → 2), not a static list (1 2 3).
    const down = cur.some((v) => prev.some((u) => v === u - 1 && !cur.includes(u)));
    run = down ? run + 1 : 0;
    if (run === 2) hits.push({ kind: 'counting-down', text: `… → ${prev.join(',')} → ${cur.join(',')}`, t: nums[i].t });
  }
  return hits;
}

/** Pure: timer-like keys in a state() snapshot (recursively, depth ≤ 3). */
export function timerStateKeys(state, path = '', depth = 0, out = []) {
  if (!state || typeof state !== 'object' || depth > 3) return out;
  for (const [k, v] of Object.entries(state)) {
    const p = path ? `${path}.${k}` : k;
    if (STATE_KEYS.test(k) || (k === 'state' && v === 'countdown')) out.push({ key: p, value: typeof v === 'object' ? JSON.stringify(v)?.slice(0, 80) : v });
    else if (v && typeof v === 'object' && !Array.isArray(v)) timerStateKeys(v, p, depth + 1, out);
  }
  return out;
}

/** @param {{target, samples:[{t, texts}], states:[object], screenshot, shotAt?:(t)=>string}[]} pages */
export function evaluateCountdowns(pages, { finding }) {
  const out = [];
  for (const p of pages) {
    const hits = detectTimers(p.samples);
    const keys = [...new Map(p.states.flatMap((s) => timerStateKeys(s)).map((k) => [k.key, k])).values()];
    if (!hits.length && !keys.length) {
      out.push(finding({ check: 'countdown-timers', rule: 'R14', rubricCheck: 'time-pressure', status: 'pass', target: p.target,
        summary: `No countdown or timer text/state seen in ${p.samples.length} samples`, key: `${p.target}:none` }));
      continue;
    }
    const shot = hits.length ? (p.shotNear?.(hits[0].t) ?? p.screenshot) : p.screenshot;
    out.push(finding({ check: 'countdown-timers', rule: 'R14', rubricCheck: 'time-pressure', status: 'warn', target: p.target,
      summary: `Timer-like UI: ${[...hits.map((h) => `${h.kind} "${h.text}"`), ...keys.map((k) => `state ${k.key}=${k.value}`)].slice(0, 5).join('; ')}`,
      screenshot: shot, key: `${p.target}:${hits.map((h) => h.kind).join(',')}:${keys.map((k) => k.key).join(',')}`,
      details: { hits: hits.slice(0, 30), stateKeys: keys } }));
  }
  return out;
}
