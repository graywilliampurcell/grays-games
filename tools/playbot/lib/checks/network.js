// network: every request must stay on the game's own origin (rule R13: no money,
// ads or data). Third-party hosts fail; EasyList/EasyPrivacy tracker hosts are
// named as such. Analytics globals (gtag, dataLayer, fbq, _paq, ...) also fail.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PLAYBOT_DIR } from '../config.js';
import { finding } from './util.js';

let trackerSet = null;
export function loadTrackers(path = resolve(PLAYBOT_DIR, 'data', 'tracker-domains.txt')) {
  if (trackerSet) return trackerSet;
  const set = new Set();
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const d = line.trim();
      if (d && !d.startsWith('#')) set.add(d);
    }
  } catch { /* no list: every third-party request still fails */ }
  trackerSet = set;
  return set;
}

/** The tracker-list entry that matches host (itself or a parent domain), or null. */
export function matchTracker(host, set = loadTrackers()) {
  const parts = String(host).toLowerCase().replace(/\.$/, '').split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    const d = parts.slice(i).join('.');
    if (set.has(d)) return d;
  }
  return null;
}

const LOCAL_SCHEMES = new Set(['data:', 'blob:', 'about:', 'chrome-extension:']);

/** Classify requests against the game origin. Pure. */
export function classifyRequests(requests, gameOrigin, set = loadTrackers()) {
  const thirdParty = new Map(); // host → {host, tracker, count, urls, types, targets}
  let sameOrigin = 0;
  let local = 0;
  for (const r of requests) {
    let u;
    try { u = new URL(r.url); } catch { continue; }
    if (LOCAL_SCHEMES.has(u.protocol)) { local++; continue; }
    if (u.origin === gameOrigin) { sameOrigin++; continue; }
    const host = u.hostname;
    let e = thirdParty.get(host);
    if (!e) {
      e = { host, tracker: matchTracker(host, set), count: 0, urls: [], types: new Set(), targets: new Set() };
      thirdParty.set(host, e);
    }
    e.count++;
    if (e.urls.length < 5) e.urls.push(r.url);
    if (r.type) e.types.add(r.type);
    if (r.target) e.targets.add(r.target);
  }
  return {
    sameOrigin, local,
    thirdParty: [...thirdParty.values()].map((e) => ({ ...e, types: [...e.types], targets: [...e.targets] })),
  };
}

export const ANALYTICS_GLOBALS = ['gtag', 'dataLayer', 'ga', '_gaq', 'google_tag_manager', 'fbq', '_fbq', '_paq', 'Matomo', 'Piwik',
  'mixpanel', 'amplitude', 'heap', 'hj', '_hjSettings', '_hsq', 'plausible', 'clarity', 'posthog', 'Intercom', 'FS', 'LogRocket',
  'adsbygoogle', 'googletag', 'pbjs', 'apstag', '__cmp', '__tcfapi', 'Sentry', 'newrelic', 'NREUM', 'analytics'];

/** Runs in the page: which analytics globals exist? */
export async function readAnalyticsGlobals(page) {
  return page.evaluate((names) => names.filter((n) => {
    try {
      if (!(n in window)) return false;
      const v = window[n];
      // `analytics` is a common word; only count it when it looks like a Segment client.
      if (n === 'analytics') return v && typeof v.track === 'function';
      return v !== undefined && v !== null;
    } catch { return false; }
  }), ANALYTICS_GLOBALS).catch(() => []);
}

/**
 * Post-run evaluation.
 * @param {{requests, websockets, popups, navigations}} net  merged recording
 * @param {string} gameOrigin
 * @param {{target, globals:string[], screenshot, cookies?}[]} pages  per target: analytics globals found + a screenshot
 */
export function evaluateNetwork({ net, gameOrigin, pages = [] }) {
  const out = [];
  const shot = pages.find((p) => p.screenshot)?.screenshot ?? null;
  const cls = classifyRequests(net.requests, gameOrigin);
  for (const tp of cls.thirdParty) {
    const shotFor = pages.find((p) => tp.targets.includes(p.target))?.screenshot ?? shot;
    out.push(finding({
      check: 'network', rule: 'R13', status: 'fail',
      summary: tp.tracker
        ? `Request to known tracker/ad host ${tp.host} (list entry ${tp.tracker}), ${tp.count}x`
        : `Request to third-party host ${tp.host}, ${tp.count}x (not the game's own server)`,
      screenshot: shotFor, key: tp.host,
      details: tp,
    }));
  }
  for (const ws of net.websockets ?? []) {
    let origin = null;
    try { origin = new URL(ws.url.replace(/^ws/, 'http')).origin; } catch { /* ignore */ }
    if (origin === gameOrigin) continue;
    out.push(finding({ check: 'network', rule: 'R13', status: 'fail', summary: `WebSocket to ${ws.url}`, screenshot: shot, key: `ws:${ws.url}`, details: ws }));
  }
  for (const p of pages) {
    if (p.globals?.length) {
      out.push(finding({
        check: 'network', rule: 'R13', status: 'fail', target: p.target,
        summary: `Analytics/ad globals present: ${p.globals.join(', ')}`,
        screenshot: p.screenshot ?? shot, key: `globals:${p.globals.join(',')}`, details: { globals: p.globals },
      }));
    }
    const third = (p.cookies ?? []).filter((c) => !gameOrigin.includes(c.domain.replace(/^\./, '')));
    if (third.length) {
      out.push(finding({
        check: 'network', rule: 'R13', status: 'fail', target: p.target,
        summary: `Third-party cookies set: ${third.map((c) => `${c.name}@${c.domain}`).join(', ')}`,
        screenshot: p.screenshot ?? shot, key: `cookies:${third.map((c) => c.domain).join(',')}`, details: { cookies: third },
      }));
    } else if (p.cookies?.length) {
      out.push(finding({
        check: 'network', rule: 'R13', status: 'info', target: p.target,
        summary: `First-party cookies set: ${p.cookies.map((c) => c.name).join(', ')}`,
        screenshot: p.screenshot, key: `fp-cookies:${p.target}`, details: { cookies: p.cookies },
      }));
    }
  }
  if (!out.some((f) => f.status === 'fail')) {
    out.push(finding({
      check: 'network', rule: 'R13', status: 'pass',
      summary: `All ${cls.sameOrigin} requests stayed on ${gameOrigin} (${cls.local} data:/blob:); no analytics globals`,
      details: { sameOrigin: cls.sameOrigin, local: cls.local, trackerListSize: loadTrackers().size },
      key: 'clean',
    }));
  }
  return out;
}
