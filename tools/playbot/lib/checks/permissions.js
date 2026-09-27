// permissions: any call to an API that prompts the user (location, notifications,
// camera/mic, clipboard, sensors, storage access, devices, push, credentials)
// fails R13. "(info)" APIs (pointer lock, fullscreen, permissions.query) are
// reported as info only.
import { finding } from './util.js';

/**
 * @param {{target, permissions:[{api, at, stack, name?}], screenshot}[]} pages
 */
export function evaluatePermissions(pages) {
  const out = [];
  const byApi = new Map();
  for (const p of pages) {
    for (const call of p.permissions ?? []) {
      const e = byApi.get(call.api) ?? { api: call.api, count: 0, targets: new Set(), stacks: new Set(), names: new Set(), screenshot: p.screenshot };
      e.count++;
      e.targets.add(p.target);
      if (call.stack && e.stacks.size < 3) e.stacks.add(call.stack);
      if (call.name) e.names.add(call.name);
      byApi.set(call.api, e);
    }
  }
  for (const e of byApi.values()) {
    const info = e.api.endsWith('(info)');
    out.push(finding({
      check: 'permissions', rule: 'R13', status: info ? 'info' : 'fail',
      summary: `${info ? 'Called' : 'Permission prompt requested'}: ${e.api}${e.names.size ? ` (${[...e.names].join(', ')})` : ''}, ${e.count}x`,
      screenshot: e.screenshot, key: e.api,
      details: { api: e.api, count: e.count, targets: [...e.targets], stacks: [...e.stacks], names: [...e.names] },
    }));
  }
  if (!out.some((f) => f.status === 'fail')) {
    out.push(finding({ check: 'permissions', rule: 'R13', status: 'pass', summary: 'No permission prompts requested', key: 'clean', details: { checkedTargets: pages.map((p) => p.target) } }));
  }
  return out;
}
