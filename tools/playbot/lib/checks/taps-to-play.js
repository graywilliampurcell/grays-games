// taps-to-play (rubric "taps-to-play"): taps from page load to "playing", using the
// per-game flows in playbot.config.json:
//   "checks": { "flows": [ { "name", "url", "taps": [{ "tap": "<selector>", "label"? }], "playing": "<JS expr over s = __game.state()>" } ] }
// Each tap is a real touch tap (hasTouch context) on the element's centre.

/** Evaluate a `playing` expression against a state snapshot. Pure. */
export function isPlaying(expr, s) {
  if (!expr) return true;
  // eslint-disable-next-line no-new-func
  return !!new Function('s', `return (${expr});`)(s);
}

/** @param {{target, flow, taps, reached, error?, screenshot, playingShot}[]} flows */
export function evaluateTapsToPlay(flows, { brackets, rubric, finding }) {
  const out = [];
  for (const f of flows) {
    if (!f.reached) {
      out.push(finding({ check: 'taps-to-play', rubricCheck: 'taps-to-play', status: 'warn', target: f.target,
        summary: `Flow "${f.flow.name}" did not reach playing after ${f.taps.length} tap(s)${f.error ? `: ${f.error}` : ''}`,
        screenshot: f.screenshot, key: `${f.flow.name}:unreached`, details: f }));
      continue;
    }
    const n = f.taps.length;
    for (const b of brackets) {
      const max = rubric.threshold('taps-to-play', b).max_taps_to_play;
      if (max === undefined || max === null) continue;
      const ok = n <= max;
      out.push(finding({ check: 'taps-to-play', rubricCheck: 'taps-to-play', bracket: b, status: ok ? 'pass' : (rubric.severity('taps-to-play', b) === 'fail' ? 'fail' : 'warn'), target: f.target,
        summary: `"${f.flow.name}": ${n} tap(s) to play (max ${max})${n ? ` via ${f.taps.map((t) => t.label ?? t.tap).join(' → ')}` : ''}${f.flow.note ? `; ${f.flow.note}` : ''}`,
        screenshot: ok ? undefined : (f.tapShots?.[0] ?? f.screenshot), key: `${f.flow.name}:${n}`, details: { taps: f.taps, tapShots: f.tapShots, playingShot: f.playingShot, max } }));
    }
  }
  return out;
}
