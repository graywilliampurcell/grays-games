// U1: the grown-up menu's "Check for updates" button (checkNow + its message).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createUpdateChecker, UPDATING_DELAY_MS } from '../src/app/selfUpdate.js';
import { updateMessage } from '../src/ui/screens/Settings.js';

const LOCAL = { version: '0.1.0', build: '4452089' };

function make(fetchVersion, session = { get: () => '9633d46', set() {} }) {
  const reloads = [];
  const c = createUpdateChecker({
    local: LOCAL,
    session,
    href: () => 'https://example.test/games/rolly-bally/',
    fetchVersion,
    isBusy: () => false,
    reload: (url) => reloads.push(url),
  });
  return { c, reloads };
}

afterEach(() => vi.useRealTimers());

describe('check for updates', () => {
  it('newer build: says Updating… then reloads onto it', async () => {
    vi.useFakeTimers();
    const fetchVersion = vi.fn(async () => ({ version: '0.1.0', build: '9633d46' }));
    // Even if this build was already auto-reloaded once this session: a person asked.
    const { c, reloads } = make(fetchVersion);
    const r = await c.checkNow();
    expect(r).toEqual({ status: 'updating', build: '9633d46' });
    expect(updateMessage(r)).toBe('Updating…');
    expect(reloads).toEqual([]);
    vi.advanceTimersByTime(UPDATING_DELAY_MS);
    expect(reloads).toEqual(['https://example.test/games/rolly-bally/?u=9633d46']);
    expect(fetchVersion).toHaveBeenCalledTimes(1);
  });

  it('same build: Up to date with the version and build code', async () => {
    const { c, reloads } = make(async () => ({ version: '0.1.0', build: '4452089' }));
    const r = await c.checkNow();
    expect(r).toEqual({ status: 'current', version: '0.1.0', build: '4452089' });
    expect(updateMessage(r)).toBe('Up to date · 0.1.0 · 4452089');
    expect(reloads).toEqual([]);
  });

  it("fetch fails or version.json is bad: Can't check right now", async () => {
    for (const fetchVersion of [
      async () => { throw new Error('offline'); },
      async () => null, // HTTP error
      async () => ({}),
      async () => ({ build: '' }),
    ]) {
      const { c, reloads } = make(fetchVersion);
      const r = await c.checkNow();
      expect(r).toEqual({ status: 'error' });
      expect(updateMessage(r)).toBe("Can't check right now, try again.");
      expect(reloads).toEqual([]);
    }
  });

  it('says Checking… while waiting', () => {
    expect(updateMessage(null)).toBe('Checking…');
  });
});
