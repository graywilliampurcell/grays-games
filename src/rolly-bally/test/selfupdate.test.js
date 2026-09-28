// U0 self-update: version comparison, when checks run, and never reloading
// in the middle of a game.
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  newerBuild, reloadUrl, createUpdateChecker, startSelfUpdate, UPDATE_CHECK_MS,
} from '../src/app/selfUpdate.js';

const LOCAL = { version: '0.1.0', build: 'aaaaaaa' };

function memorySession() {
  const m = new Map();
  return { get: (k) => (m.has(k) ? m.get(k) : null), set: (k, v) => m.set(k, v) };
}

function checker({ remote = { version: '0.1.0', build: 'bbbbbbb' }, busy = false, session = memorySession() } = {}) {
  const calls = { reload: [], pending: [] };
  let isBusy = busy;
  let live = remote;
  const c = createUpdateChecker({
    local: LOCAL,
    session,
    href: () => 'https://example.test/games/rolly-bally/?debug=1',
    fetchVersion: async () => (live instanceof Error ? Promise.reject(live) : live),
    isBusy: () => isBusy,
    reload: (url) => calls.reload.push(url),
    onPending: (b) => calls.pending.push(b),
  });
  return { c, calls, setBusy: (b) => { isBusy = b; }, setLive: (r) => { live = r; } };
}

describe('newerBuild', () => {
  it('reports a different live build', () => {
    expect(newerBuild({ version: '0.1.0', build: 'bbbbbbb' }, LOCAL)).toBe('bbbbbbb');
  });
  it('ignores the same build, missing/bad data, and dev builds', () => {
    expect(newerBuild({ build: 'aaaaaaa' }, LOCAL)).toBe(null);
    for (const r of [null, undefined, 'x', {}, { build: '' }, { build: 42 }]) expect(newerBuild(r, LOCAL)).toBe(null);
    expect(newerBuild({ build: 'bbbbbbb' }, { version: '0.1.0', build: 'dev' })).toBe(null);
  });
});

describe('reloadUrl', () => {
  it('adds ?u=<build> and keeps other params', () => {
    expect(reloadUrl('https://x.test/g/?debug=1', 'bbb')).toBe('https://x.test/g/?debug=1&u=bbb');
    expect(reloadUrl('https://x.test/g/?u=old', 'new')).toBe('https://x.test/g/?u=new');
  });
});

describe('update checker', () => {
  it('reloads right away when no game is in progress', async () => {
    const { c, calls } = checker();
    expect(await c.check()).toBe('bbbbbbb');
    expect(calls.reload).toEqual(['https://example.test/games/rolly-bally/?debug=1&u=bbbbbbb']);
    expect(calls.pending).toEqual([]);
  });

  it('never reloads mid-game: waits, flags it once, reloads after the game', async () => {
    const t = checker({ busy: true });
    await t.c.check();
    await t.c.check();
    expect(t.calls.reload).toEqual([]);
    expect(t.calls.pending).toEqual(['bbbbbbb']);
    expect(t.c.pending).toBe('bbbbbbb');
    t.setBusy(false);
    await t.c.check();
    expect(t.calls.reload).toHaveLength(1);
  });

  it('the Home "New version!" button always reloads to the new build', async () => {
    const t = checker({ busy: true });
    await t.c.check();
    t.c.reloadNow();
    expect(t.calls.reload).toEqual(['https://example.test/games/rolly-bally/?debug=1&u=bbbbbbb']);
  });

  it('reloads for a build at most once per session (no reload loop on a stale cache)', async () => {
    const session = memorySession();
    const first = checker({ session });
    await first.c.check();
    expect(first.calls.reload).toHaveLength(1);
    // After the reload the page is somehow still old: don't reload again, offer the button.
    const second = checker({ session });
    await second.c.check();
    expect(second.calls.reload).toEqual([]);
    expect(second.c.pending).toBe('bbbbbbb');
  });

  it('does nothing when up to date or the check fails', async () => {
    const t = checker({ remote: { build: 'aaaaaaa' } });
    expect(await t.c.check()).toBe(null);
    t.setLive(new Error('offline'));
    expect(await t.c.check()).toBe(null);
    t.setLive(null);
    expect(await t.c.check()).toBe(null);
    expect(t.calls.reload).toEqual([]);
  });
});

describe('startSelfUpdate timing', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function stubBrowser() {
    const listeners = {};
    const doc = {
      baseURI: 'https://example.test/games/rolly-bally/',
      visibilityState: 'visible',
      addEventListener: (type, fn) => { listeners[type] = fn; },
    };
    const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ version: '0.1.0', build: 'aaaaaaa' }) }));
    vi.stubGlobal('document', doc);
    vi.stubGlobal('window', { location: { href: doc.baseURI, replace: vi.fn() }, addEventListener: () => {} });
    vi.stubGlobal('sessionStorage', { getItem: () => null, setItem: () => {} });
    vi.stubGlobal('fetch', fetch);
    return { listeners, fetch, doc };
  }

  it('checks on launch, on return to the foreground, and every 5 minutes, uncached', async () => {
    vi.useFakeTimers();
    const { listeners, fetch, doc } = stubBrowser();
    const app = { version: '0.1.0', build: 'aaaaaaa', router: { current: { name: 'home' } } };
    expect(startSelfUpdate(app)).not.toBe(null);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = fetch.mock.calls[0];
    expect(String(url)).toBe('https://example.test/games/rolly-bally/version.json');
    expect(opts).toEqual({ cache: 'no-store' });

    listeners.visibilitychange();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(2);
    doc.visibilityState = 'hidden';
    listeners.visibilitychange();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(2); // going to the background doesn't check

    expect(UPDATE_CHECK_MS).toBe(5 * 60 * 1000);
    await vi.advanceTimersByTimeAsync(UPDATE_CHECK_MS);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('is off on the dev server', () => {
    stubBrowser();
    expect(startSelfUpdate({ version: '0.1.0', build: 'dev' })).toBe(null);
  });
});
