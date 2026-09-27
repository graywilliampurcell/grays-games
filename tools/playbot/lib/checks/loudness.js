// loudness (R15 "no sudden loud sounds"). The init script (instrument.js) routes
// every AudioContext destination connection through gain → analyser and samples
// peak / RMS about every 25 ms (≈46 ms windows) in real time; HTMLMediaElement.play
// calls are logged too. Levels are dBFS (0 = full scale).
//
//   fail: a jump of ≥ JUMP_DB within JUMP_MS to an RMS ≥ LOUD_FAIL_DB
//   warn: a jump of ≥ JUMP_DB within JUMP_MS to an RMS ≥ LOUD_WARN_DB,
//         or peaks at full scale (clipping, ≥ CLIP_DB),
//         or a moment ≥ JUMP_DB louder than the game's typical (median) level
//   info: no audio at all (also feeds the "spoken instructions" rubric check)

export const JUMP_DB = 20;
export const JUMP_MS = 100;
export const LOUD_FAIL_DB = -10;
export const LOUD_WARN_DB = -20;
export const CLIP_DB = -0.5;
export const FLOOR_DB = -60;
export const ACTIVE_DB = -50;

export const toDb = (x) => Math.max(FLOOR_DB, 20 * Math.log10(Math.max(1e-9, x)));

/**
 * Pure analysis of samples [{t (ms), peak, rms, ctx?}].
 * @returns {{samples, activeSamples, maxPeakDb, maxRmsDb, medianActiveRmsDb, jumps:[{t, fromDb, toDb, jumpDb}], clipping, status, reasons}}
 */
export function analyzeLoudness(samples) {
  const s = [...samples].sort((a, b) => a.t - b.t).map((x) => ({ ...x, peakDb: toDb(x.peak), rmsDb: toDb(x.rms) }));
  const active = s.filter((x) => x.rmsDb > ACTIVE_DB);
  const sortedActive = active.map((x) => x.rmsDb).sort((a, b) => a - b);
  const median = sortedActive.length ? sortedActive[Math.floor(sortedActive.length / 2)] : null;
  const jumps = [];
  let j = 0;
  for (let i = 0; i < s.length; i++) {
    while (s[j].t < s[i].t - JUMP_MS) j++;
    let min = Infinity;
    for (let k = j; k < i; k++) if (s[k].rmsDb < min) min = s[k].rmsDb;
    if (min === Infinity) continue;
    const jump = s[i].rmsDb - min;
    if (jump >= JUMP_DB && s[i].rmsDb >= LOUD_WARN_DB) {
      const last = jumps[jumps.length - 1];
      if (last && s[i].t - last.t < 250) { if (s[i].rmsDb > last.toDb) Object.assign(last, { toDb: round(s[i].rmsDb), jumpDb: round(jump) }); continue; }
      jumps.push({ t: Math.round(s[i].t), fromDb: round(min), toDb: round(s[i].rmsDb), jumpDb: round(jump) });
    }
  }
  const maxPeakDb = s.length ? Math.max(...s.map((x) => x.peakDb)) : null;
  const maxRmsDb = s.length ? Math.max(...s.map((x) => x.rmsDb)) : null;
  const clipping = s.filter((x) => x.peakDb >= CLIP_DB).length;
  const spikes = median === null ? [] : active.filter((x) => x.rmsDb - median >= JUMP_DB).map((x) => ({ t: Math.round(x.t), rmsDb: round(x.rmsDb) }));
  const reasons = [];
  let status = 'pass';
  const loud = jumps.filter((x) => x.toDb >= LOUD_FAIL_DB);
  if (loud.length) { status = 'fail'; reasons.push(`${loud.length} sudden jump(s) of ≥${JUMP_DB} dB within ${JUMP_MS} ms to ≥${LOUD_FAIL_DB} dBFS RMS`); }
  if (jumps.length > loud.length) { if (status === 'pass') status = 'warn'; reasons.push(`${jumps.length - loud.length} sudden jump(s) to ≥${LOUD_WARN_DB} dBFS RMS`); }
  if (clipping) { if (status === 'pass') status = 'warn'; reasons.push(`${clipping} window(s) peaking at full scale (clipping)`); }
  if (spikes.length) { if (status === 'pass') status = 'warn'; reasons.push(`${spikes.length} window(s) ≥${JUMP_DB} dB above the typical level (${round(median)} dBFS)`); }
  return {
    samples: s.length, activeSamples: active.length, maxPeakDb: round(maxPeakDb), maxRmsDb: round(maxRmsDb),
    medianActiveRmsDb: round(median), jumps: jumps.slice(0, 20), spikes: spikes.slice(0, 20), clipping, status, reasons,
  };
}

function round(v) { return v === null || v === undefined ? v : Math.round(v * 10) / 10; }

/**
 * @param {{target, audioContexts, audio, media, screenshot}[]} pages
 */
export function evaluateLoudness(pages, { brackets, rubric, finding }) {
  const out = [];
  let anyAudio = false;
  for (const p of pages) {
    const a = analyzeLoudness(p.audio ?? []);
    const hasAudio = a.activeSamples > 0 || (p.media ?? []).length > 0;
    anyAudio ||= hasAudio;
    if (!hasAudio) {
      out.push(finding({ check: 'loudness', rule: 'R15', status: 'info', target: p.target,
        summary: p.audioContexts ? `Audio context created but silent during the run (${a.samples} samples)` : 'No audio (no AudioContext output, no media playback)',
        screenshot: p.screenshot, key: `${p.target}:silent`, details: { ...a, audioContexts: p.audioContexts, media: p.media } }));
      continue;
    }
    out.push(finding({ check: 'loudness', rule: 'R15', status: a.status, target: p.target,
      summary: `Peak ${a.maxPeakDb} dBFS, max RMS ${a.maxRmsDb} dBFS, typical ${a.medianActiveRmsDb} dBFS` + (a.reasons.length ? `; ${a.reasons.join('; ')}` : '; no sudden jumps'),
      screenshot: a.status === 'pass' ? undefined : p.screenshot, key: `${p.target}:level`,
      details: { ...a, audioContexts: p.audioContexts, media: (p.media ?? []).slice(0, 20),
        note: 'Levels are measured at the Web Audio destination before the device volume; test mode steps the game, so sounds play at roughly real-time pace.' } }));
  }
  // Spoken instructions: with no audio at all they are certainly missing.
  for (const b of brackets) {
    const th = rubric.threshold('spoken-instructions', b);
    if (!th.spoken_instructions) continue;
    const need = th.spoken_instructions;
    if (anyAudio) {
      out.push(finding({ check: 'loudness', rubricCheck: 'spoken-instructions', bracket: b, status: 'info',
        summary: `Game plays audio; whether instructions are spoken and replayable is for Claude/a person (${need} for ${b})`, key: 'audio', details: { need } }));
    } else {
      const status = need === 'optional' ? 'info' : need === 'recommended' ? 'warn' : (rubric.severity('spoken-instructions', b) === 'fail' ? 'fail' : 'warn');
      out.push(finding({ check: 'loudness', rubricCheck: 'spoken-instructions', bracket: b, status,
        summary: `No audio at all, so no spoken instructions (${need} for ${b})`, screenshot: pages[0]?.screenshot, key: 'no-audio', details: { need } }));
    }
  }
  return out;
}
