// Shared helpers for the automatic checks.
import { createHash } from 'node:crypto';
import { join } from 'node:path';

export const STATUS_ORDER = { pass: 0, info: 1, warn: 2, fail: 3 };

export function worst(statuses) {
  let w = 'pass';
  for (const s of statuses) if ((STATUS_ORDER[s] ?? 0) > STATUS_ORDER[w]) w = s;
  return w;
}

export function slug(s) {
  return String(s).replace(/^\?/, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60) || 'root';
}

export function hash(s) {
  return createHash('sha1').update(String(s)).digest('hex').slice(0, 12);
}

/**
 * Build a finding. `key` (stable across runs) becomes the fingerprint used by judgments/.
 * @returns {{check, rule?, rubricCheck?, bracket?, status, summary, evidence:{screenshot?, details}, fingerprint, target?}}
 */
export function finding({ check, rule, rubricCheck, bracket, status, summary, screenshot, details, key, target }) {
  const f = { check, status, summary };
  if (rule) f.rule = rule;
  if (rubricCheck) f.rubricCheck = rubricCheck;
  if (bracket) f.bracket = bracket;
  if (target) f.target = target;
  f.evidence = { ...(screenshot ? { screenshot } : {}), details: details ?? {} };
  f.fingerprint = hash([check, rule ?? '', rubricCheck ?? '', bracket ?? '', key ?? summary].join('|'));
  return f;
}

/** Status for a missed per-bracket threshold, from the rubric's severity ('human' → warn). */
export function missStatus(rubric, checkId, bracket) {
  const s = rubric.severity(checkId, bracket);
  return s === 'fail' ? 'fail' : 'warn';
}

/** Returns shot(label) → relative PNG path in outDir. */
export function makeShooter(page, outDir, prefix) {
  const taken = new Map();
  return async function shot(label, opts = {}) {
    const name = `${prefix}-${slug(label)}.png`;
    if (taken.has(name) && !opts.force) return taken.get(name);
    try {
      await page.screenshot({ path: join(outDir, name), timeout: 15000, ...opts.screenshot });
      taken.set(name, name);
      return name;
    } catch {
      return null;
    }
  };
}

/**
 * Screenshot with outlines drawn around the given rectangles (CSS px), for evidence.
 * rects: [{x,y,width,height,label?}]
 */
export async function shotWithBoxes(page, outDir, name, rects, color = '#ff00ff') {
  const file = `${slug(name)}.png`;
  try {
    await page.evaluate(({ rects, color }) => {
      const layer = document.createElement('div');
      layer.id = '__playbot_boxes';
      layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647';
      for (const r of rects) {
        const d = document.createElement('div');
        d.style.cssText = `position:fixed;left:${r.x}px;top:${r.y}px;width:${r.width}px;height:${r.height}px;` +
          `outline:3px solid ${color};background:${color}22;box-sizing:border-box`;
        if (r.label) {
          const t = document.createElement('span');
          t.textContent = r.label;
          t.style.cssText = `position:absolute;left:0;top:-16px;font:bold 11px sans-serif;color:#fff;background:${color};padding:0 3px;white-space:nowrap`;
          d.append(t);
        }
        layer.append(d);
      }
      document.body.append(layer);
    }, { rects, color });
    await page.screenshot({ path: join(outDir, file), timeout: 15000 });
    return file;
  } catch {
    return null;
  } finally {
    await page.evaluate(() => document.getElementById('__playbot_boxes')?.remove()).catch(() => {});
  }
}

/** Seeded PRNG (mulberry32). */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A random "kid mashing the controls" input for the game's setInput() shape.
 * kind: 'mazle' (held keys) | 'joystick' ({x,y,jump}).
 */
export function randomInput(kind, rand) {
  if (kind === 'mazle') {
    const turn = rand();
    return { forward: rand() < 0.7, back: rand() < 0.1, turnLeft: turn < 0.3, turnRight: turn > 0.7, left: rand() < 0.1, right: rand() < 0.1 };
  }
  return { x: rand() * 2 - 1, y: -(0.3 + rand() * 0.7), jump: rand() < 0.05 };
}

/** Collect visible UI strings from the DOM (text nodes + aria-label/title/alt/placeholder). Runs in the page. */
export function domTextInPage() {
  const out = [];
  const seen = new Set();
  const push = (s, el) => {
    const v = String(s || '').replace(/\s+/g, ' ').trim();
    if (!v || seen.has(v)) return;
    seen.add(v);
    out.push(v);
  };
  const visible = (el) => {
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  };
  const walk = (el) => {
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'svg'].includes(el.tagName)) return;
    if (el.id === '__playbot_boxes') return;
    if (!visible(el)) return;
    for (const a of ['aria-label', 'title', 'alt', 'placeholder']) if (el.hasAttribute?.(a)) push(el.getAttribute(a), el);
    let own = '';
    for (const n of el.childNodes) {
      if (n.nodeType === 3) own += n.textContent;
      else if (n.nodeType === 1) {
        if (own.trim()) { push(own, el); own = ''; }
        walk(n);
      }
    }
    if (own.trim()) push(own, el);
  };
  if (document.body) walk(document.body);
  return out;
}
