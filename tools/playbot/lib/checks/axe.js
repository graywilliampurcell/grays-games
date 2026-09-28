// axe: accessibility of the DOM menus/HUD (canvas excluded) with @axe-core/playwright,
// WCAG 2.x A/AA rules. Violations are advisory (warn); color-contrast also feeds the
// rubric "contrast" check.
import AxeBuilderMod from '@axe-core/playwright';
import { finding } from './util.js';

const AxeBuilder = AxeBuilderMod.default ?? AxeBuilderMod;
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** Run axe on the current screen. Returns {violations:[{id, impact, help, helpUrl, nodes:[{target, html, summary}]}], passes, error?} */
export async function runAxe(page) {
  try {
    const res = await new AxeBuilder({ page }).withTags(TAGS).exclude('canvas').exclude('#__playbot_boxes').analyze();
    return {
      violations: res.violations.map((v) => ({
        id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl,
        nodes: v.nodes.slice(0, 10).map((n) => ({ target: n.target.join(' '), html: n.html.slice(0, 200), summary: n.failureSummary?.slice(0, 300) })),
        count: v.nodes.length,
      })),
      passes: res.passes.length,
      incomplete: res.incomplete.map((v) => v.id),
    };
  } catch (err) {
    return { violations: [], passes: 0, error: String(err.message ?? err) };
  }
}

/** @param {{target, label, axe, screenshot}[]} screens */
export function evaluateAxe(screens) {
  const byRule = new Map();
  const errors = [];
  for (const s of screens) {
    if (!s.axe) continue;
    if (s.axe.error) errors.push(`${s.target}:${s.label}: ${s.axe.error}`);
    for (const v of s.axe.violations) {
      const e = byRule.get(v.id) ?? { ...v, screens: [], screenshot: s.screenshot, total: 0 };
      e.screens.push(`${s.target}:${s.label}`);
      e.total += v.count;
      byRule.set(v.id, e);
    }
  }
  const out = [];
  for (const v of byRule.values()) {
    out.push(finding({ check: 'axe', rubricCheck: v.id === 'color-contrast' ? 'contrast' : undefined, status: 'warn',
      summary: `axe ${v.id} (${v.impact}): ${v.help}; ${v.total} element(s) on ${v.screens.length} screen(s)`,
      screenshot: v.screenshot, key: v.id, details: v }));
  }
  if (errors.length) out.push(finding({ check: 'axe', status: 'warn', summary: `axe failed on ${errors.length} screen(s)`, screenshot: screens[0]?.screenshot, key: 'error', details: { errors } }));
  if (!out.length) out.push(finding({ check: 'axe', status: 'pass', summary: `No WCAG A/AA violations in the DOM on ${screens.filter((s) => s.axe).length} screen(s)`, key: 'clean' }));
  return out;
}
