// touch-targets: size of every tappable DOM element (CSS px at the tablet
// viewport, 1024×768 by default) against rubric "touch-target"
// min_touch_target_px per bracket (76 / 57 / 44 / 44). The size of a target is
// min(width, height) of its bounding box. The canvas itself is excluded (the game
// world is judged by Claude / the personas, not here).
import { finding, missStatus, shotWithBoxes } from './util.js';

function measureInPage() {
  const sel = 'button, a[href], [role=button], [role=link], [role=checkbox], [role=tab], [role=menuitem], [role=switch], [role=slider], input:not([type=hidden]), select, textarea, summary, label[for], [onclick], [tabindex]:not([tabindex="-1"])';
  const set = new Set(document.querySelectorAll(sel));
  // Elements styled as clickable (cursor:pointer) that are not inside another target.
  for (const el of document.querySelectorAll('body *')) {
    if (el.tagName === 'CANVAS' || set.has(el)) continue;
    if (getComputedStyle(el).cursor === 'pointer' && !el.parentElement?.closest(sel) && getComputedStyle(el.parentElement || document.body).cursor !== 'pointer') set.add(el);
  }
  const out = [];
  for (const el of set) {
    if (el.tagName === 'CANVAS' || el.id === '__playbot_boxes') continue;
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
    const cs = getComputedStyle(el);
    if (cs.pointerEvents === 'none' || el.disabled) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.bottom <= 0 || r.right <= 0 || r.top >= innerHeight || r.left >= innerWidth) continue;
    // Skip targets nested inside another (bigger) target: the outer one is what a finger hits.
    const outer = el.parentElement?.closest(sel);
    if (outer && set.has(outer)) continue;
    const label = (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
    out.push({
      el: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${cls ? `.${cls}` : ''}`,
      label, x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height),
      size: Math.round(Math.min(r.width, r.height)),
    });
  }
  return { targets: out, viewport: { width: innerWidth, height: innerHeight }, dpr: devicePixelRatio };
}

/**
 * Measure the current screen; screenshot small targets (below `maxThreshold`) outlined.
 * @returns {{label, target, targets, viewport, boxShot, screenshot}}
 */
export async function measureTouchTargets(page, { outDir, name, maxThreshold = 76 }) {
  const m = await page.evaluate(measureInPage).catch(() => ({ targets: [], viewport: null }));
  const small = m.targets.filter((t) => t.size < maxThreshold);
  let boxShot = null;
  if (small.length) {
    boxShot = await shotWithBoxes(page, outDir, `${name}-touch-targets`,
      small.map((t) => ({ x: t.x, y: t.y, width: t.width, height: t.height, label: `${t.size}px` })));
  }
  return { ...m, boxShot };
}

/**
 * @param {{target, label, targets, viewport, boxShot, screenshot}[]} screens
 */
export function evaluateTouchTargets(screens, { brackets, rubric }) {
  const all = screens.flatMap((s) => s.targets.map((t) => ({ ...t, screen: `${s.target}:${s.label}`, boxShot: s.boxShot, screenshot: s.screenshot })));
  // Dedupe the same element seen on several screens (same el+label+size).
  const uniq = [...new Map(all.map((t) => [`${t.el}|${t.label}|${t.width}x${t.height}`, t])).values()];
  const out = [];
  if (!uniq.length) {
    for (const b of brackets) {
      out.push(finding({ check: 'touch-targets', rubricCheck: 'touch-target', bracket: b, status: 'info',
        summary: 'No tappable DOM elements found (game is canvas-only on these screens)', screenshot: screens[0]?.screenshot, key: 'none',
        details: { screens: screens.map((s) => `${s.target}:${s.label}`) } }));
    }
    return out;
  }
  const smallest = uniq.reduce((a, t) => (t.size < a.size ? t : a));
  for (const b of brackets) {
    const min = rubric.threshold('touch-target', b).min_touch_target_px;
    if (!min) continue;
    const bad = uniq.filter((t) => t.size < min).sort((a, c) => a.size - c.size);
    if (!bad.length) {
      out.push(finding({ check: 'touch-targets', rubricCheck: 'touch-target', bracket: b, status: 'pass',
        summary: `All ${uniq.length} tappable elements ≥ ${min}px (smallest ${smallest.size}px: ${smallest.label || smallest.el})`, key: 'ok',
        details: { min, count: uniq.length, smallest } }));
      continue;
    }
    out.push(finding({ check: 'touch-targets', rubricCheck: 'touch-target', bracket: b, status: missStatus(rubric, 'touch-target', b),
      summary: `${bad.length}/${uniq.length} tappable elements under ${min}px; smallest ${bad[0].size}px (${bad[0].label || bad[0].el} on ${bad[0].screen})`,
      screenshot: bad[0].boxShot ?? bad[0].screenshot, key: bad.map((t) => `${t.el}|${t.label}`).join(','),
      details: { min, viewport: screens[0]?.viewport, offenders: bad.map(({ boxShot, screenshot, ...t }) => ({ ...t, screenshot: boxShot ?? screenshot })) } }));
  }
  return out;
}
