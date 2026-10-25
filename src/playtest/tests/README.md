# Mazle level tests

Browser checks for each Mazle level, written by the build agent as it built them.
They drive the real game through the `?test=1` hooks (`window.__game`, `window.__sound`).

- `levels/l<level>.mjs`: the main checks for one level; `l<level><suffix>.mjs` or `l<level>-<what>.mjs` are extra checks for the same level.
- `generic/*.mjs`: older shared harnesses that take a level number (`node generic/volcano.mjs 66`). They need the game served on `MAZLE_URL` (default `http://127.0.0.1:9173`).
- `stale/`: checks from levels before 111 that no longer match the game (an asserted label or layout changed later). Kept for reference; the runner skips them.
- `playwright.mjs`: shared setup. Playwright comes from `tools/playbot`, so run `npm ci` there first.

Run from `src/playtest` after a build:

```
npx vite build --base ./ --minify esbuild --outDir dist
npm run test:levels -- l150 l149     # matching files only
JOBS=4 npm run test:levels           # everything, four at a time
```

The runner serves `dist/` on `MAZLE_PORT` (default 9173). A test passes when it exits 0 and prints no line starting with `FAIL`. Screenshots go to `tests/shots/` (gitignored).
