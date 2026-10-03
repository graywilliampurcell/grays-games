// Updates (plan Section 7): reloading always gets the newest build, and the
// game notices when a newer build goes live while it's open.
//
// The build writes version.json ({ version, build }) next to index.html. The
// game compares that file's build with its own (VERSION, baked in at build
// time). The query strings make sure neither the browser nor the web host
// hands back an old copy.

const CHECK_EVERY = 60 * 1000; // look for a new build about once a minute
const TRIED_KEY = 'mazle.reloadedFor'; // the build we already reloaded for this tab

// current: { version, build }. onNewer({ version, build }) is called when a
// newer build is live; the game shows the "new version" box.
// Does nothing on the dev server ('dev') or in test mode.
export function startUpdateChecks(current, onNewer, { enabled = true } = {}) {
    if (!enabled || !current.build || current.build === 'dev' || current.build === 'unknown') return;

    let first = true;
    async function check() {
        let live;
        try {
            const response = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
            if (!response.ok) return;
            live = await response.json();
        } catch {
            return; // offline or the host is slow: try again next time
        }
        if (!live.build || live.build === current.build) return;
        // Right after the page opens nothing is in progress, so go straight to
        // the newest build. Only once per build, and only when the tab can
        // remember that, so a slow host can never cause a reload loop.
        if (first && readTried() !== live.build && writeTried(live.build)) {
            reloadInto(live.build);
            return;
        }
        onNewer(live);
    }

    check().finally(() => {
        first = false;
    });
    setInterval(check, CHECK_EVERY);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) check();
    });
}

// Reload into the newest build. ?v=<build> is new for every build, so the
// page itself can't come from an old copy either.
export function reloadInto(build) {
    if (build) writeTried(build); // so the fresh page doesn't reload a second time
    const url = new URL(window.location.href);
    url.searchParams.set('v', build || String(Date.now()));
    window.location.replace(url.toString());
}

function readTried() {
    try {
        return sessionStorage.getItem(TRIED_KEY);
    } catch {
        return null;
    }
}

// Returns whether the tab could remember it
function writeTried(build) {
    try {
        sessionStorage.setItem(TRIED_KEY, build);
        return sessionStorage.getItem(TRIED_KEY) === build;
    } catch {
        return false;
    }
}
