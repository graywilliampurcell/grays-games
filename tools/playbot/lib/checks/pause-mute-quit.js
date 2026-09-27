// pause-mute-quit (R16 "kids always have control"): on each playing screen, look
// for DOM controls that pause, mute and quit/go home (by aria-label, title, text,
// class/id and icon glyphs). Missing controls are warn: evidence for Claude, who
// makes the R16 call. Only finds controls; it does not press them. Keyboard-only
// shortcuts (e.g. Esc) are invisible to this check.

export const PATTERNS = {
  pause: /\bpaus(e|ed|ing)\b|⏸|\bresume\b/i,
  mute: /\b(un)?mute[d]?\b|\bsound\b|\baudio\b|\bvolume\b|\bmusic\b|\bspeaker\b|🔇|🔈|🔉|🔊/i,
  quit: /\bquit\b|\bhome\b|\bexit\b|\bback\b|\bmenu\b|\bclose\b|\bleave\b|\bstop\b|\bgive up\b|⌂|🏠|✕|×/i,
};

function controlsInPage() {
  const sel = 'button, a[href], [role=button], [role=link], [role=switch], [aria-label], [title], [onclick]';
  const out = [];
  for (const el of document.querySelectorAll(sel)) {
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if (getComputedStyle(el).pointerEvents === 'none') continue;
    const cls = typeof el.className === 'string' ? el.className : (el.className?.baseVal ?? '');
    out.push({
      tag: el.tagName.toLowerCase(), id: el.id, cls,
      label: el.getAttribute('aria-label') || '', title: el.getAttribute('title') || '',
      text: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40),
      rect: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) },
    });
  }
  return out;
}

export async function findControls(page) {
  return page.evaluate(controlsInPage).catch(() => []);
}

/** Classify controls. Pure. → {pause:[...], mute:[...], quit:[...]} */
export function classifyControls(controls) {
  const res = { pause: [], mute: [], quit: [] };
  for (const c of controls) {
    const hay = [c.label, c.title, c.text, c.id, c.cls.replace(/[-_]/g, ' ')].join(' ');
    for (const [kind, re] of Object.entries(PATTERNS)) if (re.test(hay)) res[kind].push(c);
  }
  return res;
}

/** @param {{target, controls, screenshot, label}[]} playing  one entry per playing screen */
export function evaluatePauseMuteQuit(playing, { finding }) {
  const out = [];
  for (const p of playing) {
    const found = classifyControls(p.controls);
    const missing = Object.keys(found).filter((k) => !found[k].length);
    const describe = (k) => found[k].map((c) => c.label || c.title || c.text || c.id || c.cls).slice(0, 3).join(', ');
    out.push(finding({ check: 'pause-mute-quit', rule: 'R16', status: missing.length ? 'warn' : 'pass', target: p.target,
      summary: missing.length
        ? `Playing screen has no visible ${missing.join(', ')} control${missing.length > 1 ? 's' : ''}` +
          `${Object.keys(found).filter((k) => found[k].length).map((k) => `; ${k}: ${describe(k)}`).join('')}`
        : `pause: ${describe('pause')}; mute: ${describe('mute')}; quit: ${describe('quit')}`,
      screenshot: missing.length ? p.screenshot : undefined, key: `${p.target}:${missing.join(',')}`,
      details: { found, missing, controlsSeen: p.controls.length, note: 'Found by label/text/class only; not pressed. Keyboard shortcuts are not detected.' } }));
  }
  return out;
}
