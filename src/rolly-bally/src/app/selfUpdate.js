// Self-update check. A Home-Screen launch on iPad keeps the old page resident
// and never sees a new deploy, so the game asks the server which build is
// live (version.json, written by the build next to index.html) on launch,
// whenever it comes back to the foreground, and every few minutes.
//
// When the live build differs from the running one:
//   - no game in progress -> reload right away (quietly);
//   - a game in progress  -> remember it; the Home screen shows a big
//     "New version!" button, and the next check outside a game reloads.
// The reload adds ?u=<build> so Safari can't hand back a cached index.html,
// and each build is reloaded for at most once per session so a stale cache
// can never cause a reload loop. No service worker.
//
// The grown-up menu's "Check for updates" button (U1) calls checkNow():
// check right away and say what happened (updating / up to date / can't check).

export const UPDATE_CHECK_MS = 5 * 60 * 1000;
export const UPDATING_DELAY_MS = 700; // long enough to read "Updating…" before the reload
const RELOADED_KEY = 'rolly-bally:reloadedFor';

/** Pure: the live build to switch to, or null if none/unknown/same. */
export function newerBuild(remote, local) {
  if (!remote || typeof remote !== 'object') return null;
  const build = typeof remote.build === 'string' ? remote.build : '';
  if (!build || !local?.build || local.build === 'dev') return null;
  return build === local.build ? null : build;
}

/** Pure: the reload URL for `build`, keeping the other query params. */
export function reloadUrl(href, build) {
  const url = new URL(href);
  url.searchParams.set('u', build);
  return url.toString();
}

/**
 * @param {object} o
 * @param {{version:string, build:string}} o.local  the running build
 * @param {() => Promise<object|null>} o.fetchVersion  live version.json (null on failure)
 * @param {() => boolean} o.isBusy  true while a game is in progress
 * @param {(url:string) => void} o.reload
 * @param {() => void} [o.onPending]  called once when an update waits for the game to end
 * @param {{get(k:string):string|null, set(k:string, v:string):void}} [o.session]
 * @param {() => string} [o.href]
 */
export function createUpdateChecker({ local, fetchVersion, isBusy, reload, onPending = () => {}, session, href }) {
  const state = { pending: null, checking: false };

  async function check() {
    if (state.checking) return state.pending;
    state.checking = true;
    try {
      const remote = await fetchVersion().catch(() => null);
      const build = newerBuild(remote, local);
      if (!build) return null;
      if (!isBusy() && session?.get(RELOADED_KEY) !== build) {
        session?.set(RELOADED_KEY, build);
        reload(reloadUrl(href ? href() : window.location.href, build));
        return build;
      }
      if (state.pending !== build) {
        state.pending = build;
        onPending(build);
      }
      return build;
    } finally {
      state.checking = false;
    }
  }

  /**
   * "Check for updates": fetch now and report
   *   {status: 'updating', build}            newer build live; reloads after UPDATING_DELAY_MS
   *   {status: 'current', version, build}    the running build is the live one
   *   {status: 'error'}                      couldn't fetch / read version.json
   * A tap always reloads for a newer build (no once-per-session guard: a person asked).
   */
  async function checkNow() {
    let remote = null;
    try {
      remote = await fetchVersion();
    } catch {
      remote = null;
    }
    if (!remote || typeof remote.build !== 'string' || !remote.build) return { status: 'error' };
    const build = newerBuild(remote, local);
    if (!build) return { status: 'current', version: local.version, build: local.build };
    const url = reloadUrl(href ? href() : window.location.href, build);
    setTimeout(() => reload(url), UPDATING_DELAY_MS);
    return { status: 'updating', build };
  }

  /** The Home screen's "New version!" button: always reloads. */
  function reloadNow() {
    const build = state.pending || local.build;
    reload(reloadUrl(href ? href() : window.location.href, build));
  }

  return {
    check,
    checkNow,
    reloadNow,
    get pending() { return state.pending; },
  };
}

/** A checker wired to the browser (fetch, sessionStorage, location). */
export function browserChecker(app) {
  const session = {
    get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* private mode */ } },
  };
  return createUpdateChecker({
    local: { version: app.version, build: app.build },
    session,
    fetchVersion: async () => {
      const res = await fetch(new URL('version.json', document.baseURI), { cache: 'no-store' });
      return res.ok ? res.json() : null;
    },
    isBusy: () => app.router?.current?.name === 'play',
    reload: (url) => window.location.replace(url),
    onPending: () => app.events?.emit('updatePending'),
  });
}

/** Wire the checker to the browser: launch, foreground, and a timer. */
export function startSelfUpdate(app) {
  if (!app.build || app.build === 'dev') return null; // dev server: nothing to compare
  const checker = browserChecker(app);
  checker.check();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checker.check();
  });
  window.addEventListener('pageshow', (e) => { if (e.persisted) checker.check(); });
  setInterval(() => checker.check(), UPDATE_CHECK_MS);
  return checker;
}
