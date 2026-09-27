import { describe, it, expect } from 'vitest';
import { normalizeRaceConfig, normalizePlaygroundConfig } from '../src/app/configs.js';
import { parseUrlParams } from '../src/app/params.js';

describe('configs', () => {
  it('normalizes race configs', () => {
    expect(normalizeRaceConfig({ difficulty: 9, races: 4, seed: 'x' })).toEqual({ difficulty: 5, races: 3, seed: 'x' });
    expect(normalizeRaceConfig({ difficulty: '2', races: '10', seed: 'y' })).toEqual({ difficulty: 2, races: 10, seed: 'y' });
    const d = normalizeRaceConfig();
    expect(d.difficulty).toBe(1);
    expect(typeof d.seed).toBe('string');
  });

  it('normalizes playground configs', () => {
    const c = normalizePlaygroundConfig({ size: 'huge', stuff: ['tunnels', 'nope', 'ramps'], seed: 's' });
    expect(c).toEqual({ size: 'medium', theme: 'grass', bumpiness: 'hilly', stuff: ['ramps', 'tunnels'], stars: 'some', seed: 's' });
  });

  it('parses URL params', () => {
    const r = parseUrlParams('?mode=race&d=3&n=5&seed=abc&debug=1');
    expect(r.debug).toBe(true);
    expect(r.mode).toBe('race');
    expect(r.config).toEqual({ difficulty: 3, races: 5, seed: 'abc' });

    const p = parseUrlParams('?mode=playground&size=large&theme=snow&bump=mountains&stuff=ramps,jumps&stars=lots&seed=z');
    expect(p.config).toEqual({ size: 'large', theme: 'snow', bumpiness: 'mountains', stuff: ['ramps', 'jumps'], stars: 'lots', seed: 'z' });

    expect(parseUrlParams('?gallery=1').mode).toBe('gallery');
    expect(parseUrlParams('').mode).toBeNull();
  });

  it('?race=K becomes config.startRace for that run only', () => {
    const p = parseUrlParams('?mode=race&d=2&n=5&race=3&seed=s');
    expect(p.config.startRace).toBe(3);
    // Survives the host's second normalize; clamps to the series length.
    expect(normalizeRaceConfig(p.config).startRace).toBe(3);
    expect(normalizeRaceConfig({ races: 3, startRace: 9 }).startRace).toBe(3);
    // Race setup configs never carry it.
    expect(normalizeRaceConfig({ difficulty: 2, races: 5 })).not.toHaveProperty('startRace');
  });
});
