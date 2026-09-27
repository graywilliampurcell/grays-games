#!/usr/bin/env node
// Regenerates data/tracker-domains.txt from EasyList + EasyPrivacy.
//
// Keeps only the domain-anchored rules (`||example.com^`, optionally with
// request-type options like $third-party,script) and drops everything with a
// path, wildcards, `domain=` restrictions or `~` exclusions. The result is a
// plain list of host names: a request whose host is one of these, or a
// subdomain of one, is a known ad/tracker host.
//
// Lists: https://easylist.to/ (EasyList authors, dual-licensed GPLv3 / CC BY-SA 3.0).
//
// Usage: node scripts/update-trackers.mjs   (needs network; run it every few months)
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '..', 'data', 'tracker-domains.txt');
const LISTS = {
  easyprivacy: 'https://easylist.to/easylist/easyprivacy.txt',
  easylist: 'https://easylist.to/easylist/easylist.txt',
};
const OK_OPTIONS = new Set(['third-party', '3p', 'script', 'image', 'ping', 'xmlhttprequest', 'subdocument', 'media', 'websocket', 'other', 'all']);
// Well-known analytics/ad hosts that the lists only block by path (so the
// domain-only extraction misses them). Always included.
const EXTRA = [
  'connect.facebook.net', 'analytics.google.com', 'google-analytics.com', 'googletagmanager.com',
  'googlesyndication.com', 'googleadservices.com', 'doubleclick.net', 'app-measurement.com',
  'api.segment.io', 'cdn.segment.com', 'api.mixpanel.com', 'cdn.mxpnl.com', 'api.amplitude.com',
  'cdn.amplitude.com', 'static.hotjar.com', 'script.hotjar.com', 'plausible.io', 'clarity.ms',
  'unityads.unity3d.com', 'ads.unity3d.com', 'applovin.com', 'adcolony.com', 'chartboost.com',
];
const RULE = /^\|\|([a-z0-9][a-z0-9.-]*\.[a-z]{2,})\^(?:\$(.*))?$/;

/** Extract domain-only block rules from Adblock Plus filter text. Exported for tests. */
export function extractDomains(text) {
  const out = new Set();
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const m = RULE.exec(line);
    if (!m) continue;
    if (m[2] && !m[2].split(',').every((o) => OK_OPTIONS.has(o))) continue;
    out.add(m[1]);
  }
  return out;
}

async function main() {
  const all = new Map(); // domain -> list name
  const versions = [];
  for (const [name, url] of Object.entries(LISTS)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    const text = await res.text();
    versions.push(`${name} ${/^! Version: (\S+)/m.exec(text)?.[1] ?? '?'}`);
    for (const d of extractDomains(text)) if (!all.has(d)) all.set(d, name);
  }
  for (const d of EXTRA) if (!all.has(d)) all.set(d, 'extra');
  // Drop domains already covered by a parent domain in the list.
  const domains = [...all.keys()].filter((d) => {
    const parts = d.split('.');
    for (let i = 1; i < parts.length - 1; i++) if (all.has(parts.slice(i).join('.'))) return false;
    return true;
  }).sort();
  const header = [
    '# Ad and tracker host names (domain-only rules) from EasyPrivacy + EasyList.',
    '# Plus a few hand-picked hosts (EXTRA in the script).\n# Source: https://easylist.to/ (dual-licensed GPLv3 / CC BY-SA 3.0, EasyList authors).',
    `# Generated ${new Date().toISOString()} by scripts/update-trackers.mjs from: ${versions.join(', ')}`,
    `# ${domains.length} domains; a host matches if it equals an entry or is a subdomain of one.`,
  ];
  writeFileSync(OUT, `${header.join('\n')}\n${domains.join('\n')}\n`);
  console.log(`wrote ${domains.length} domains to ${OUT}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
