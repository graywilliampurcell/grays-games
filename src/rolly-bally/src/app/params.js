// URL parameters for quick repro / debugging.
//   ?mode=race&d=3&n=5&seed=🍎🐶🚀⚽   (+ &race=K: start at race K)
//   ?mode=playground&size=large&theme=snow&bump=mountains&stuff=ramps,jumps&stars=lots&seed=abc
//   ?mode=test-track
//   ?gallery=1            (track piece gallery; same as ?mode=gallery; works
//                          without ?debug=1 on purpose, see CONTRACT.md)
//   ?debug=1              (debug overlay + R/N/G hotkeys)

import { normalizeConfig } from './configs.js';

/**
 * @param {string} search location.search
 * @returns {{debug:boolean, mode:string|null, config:object|null, raw:Object<string,string>}}
 */
export function parseUrlParams(search) {
  const q = new URLSearchParams(search);
  const raw = Object.fromEntries(q.entries());
  const debug = q.get('debug') === '1' || q.get('debug') === 'true';
  let mode = q.get('mode');
  if (!mode && (q.get('gallery') === '1' || q.get('gallery') === 'true')) mode = 'gallery';
  if (!mode) return { debug, mode: null, config: null, raw };

  const seed = q.get('seed') || undefined;
  let config;
  if (mode === 'race') {
    config = { difficulty: q.get('d') ?? q.get('difficulty'), races: q.get('n') ?? q.get('races'), seed };
    // Debug: start the series at race K. Only this URL-launched run sees it.
    if (q.get('race')) config.startRace = q.get('race');
  } else if (mode === 'playground') {
    const stuff = q.get('stuff');
    config = {
      size: q.get('size') || undefined,
      theme: q.get('theme') || undefined,
      bumpiness: q.get('bump') || q.get('bumpiness') || undefined,
      stuff: stuff === null ? undefined : stuff.split(',').filter(Boolean),
      stars: q.get('stars') || undefined,
      seed,
    };
  } else {
    config = { seed, piece: q.get('piece') || undefined };
  }
  return { debug, mode, config: normalizeConfig(mode, config), raw };
}
