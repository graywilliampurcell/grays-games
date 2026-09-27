import { describe, it, expect } from 'vitest';
import { addRecentWorld, recentWorldsFrom, migrateSave, resetProgressData, RECENT_WORLDS } from '../src/ui/progress.js';

const world = (seed, extra = {}) => ({ size: 'small', theme: 'snow', bumpiness: 'flat', stuff: ['ramps'], stars: 'lots', seed, ...extra });

describe('recent Playground worlds', () => {
  it('keeps newest first, one per seed, at most RECENT_WORLDS', () => {
    let list = [];
    for (let i = 0; i < RECENT_WORLDS + 3; i++) list = addRecentWorld(list, world(`s${i}`));
    expect(list).toHaveLength(RECENT_WORLDS);
    expect(list[0].seed).toBe(`s${RECENT_WORLDS + 2}`);
    list = addRecentWorld(list, world('s5', { theme: 'grass' }));
    expect(list[0]).toMatchObject({ seed: 's5', theme: 'grass' });
    expect(list.filter((w) => w.seed === 's5')).toHaveLength(1);
  });

  it('drops junk entries', () => {
    expect(recentWorldsFrom('nope')).toEqual([]);
    expect(recentWorldsFrom([null, { seed: '' }, { size: 'huge', seed: 'a' }])).toEqual([
      expect.objectContaining({ seed: 'a', size: 'medium' }),
    ]);
  });

  it('survives migrate and progress reset', () => {
    const data = migrateSave({ ui: { recentWorlds: [world('x'), world('y')] } });
    expect(data.ui.recentWorlds.map((w) => w.seed)).toEqual(['x', 'y']);
    expect(resetProgressData(data).ui.recentWorlds.map((w) => w.seed)).toEqual(['x', 'y']);
  });
});
