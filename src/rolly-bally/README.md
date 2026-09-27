# Rolly Bally

A rolling-ball game for Gray (Playground + Race). Plan: `docs/games/rolly-bally/PLAN.md`.
Architecture contract for contributors: [CONTRACT.md](./CONTRACT.md).

Vite + three.js + Rapier (`@dimforge/rapier3d-compat`) + Vitest, plain ES modules.

## Run / test / build

Node 22+ (via nvm: `source ~/.nvm/nvm.sh`).

```sh
npm install
npm run dev            # dev server (e.g. npm run dev -- --host 192.168.1.9 --port 9074)
npm test               # vitest
npm run build          # -> dist/ (relative base, deployable under any path)
npm run preview        # serve dist/
```

Deployed by `.github/workflows/deploy-site.yml` to `games/rolly-bally/` on GitHub Pages.
**One-time repo setting required:** Settings → Pages → Source: **GitHub Actions**
(before or with the first master push; otherwise the deploy job fails and the old
branch-served `docs/` site, which has no `games/rolly-bally/`, keeps serving).

## URL params

| Param | Example | Meaning |
|---|---|---|
| `mode` | `?mode=race&d=3&n=5&seed=🍎🐶🚀⚽` | Race: difficulty 1–5, races 1/3/5/10 |
| | `?mode=race&d=5&n=3&race=3` | Race: start at race K of the series |
| | `?mode=playground&size=large&theme=snow&bump=mountains&stuff=ramps,jumps&stars=lots` | Playground |
| | `?mode=test-track&auto=1` | Hand-built test track (auto-roll on) |
| `gallery` | `?gallery=1` | Track piece gallery (works without `?debug=1`; see CONTRACT.md) |
| `seed` | any string or 4 emoji | Deterministic generation |
| `debug` | `?debug=1` | Overlay (fps, draw calls, speed, mode fields) + hotkeys |

## Debug hotkeys (`?debug=1`)

- `R` respawn, `N` next piece, `G` regenerate with a new seed (race: new emoji series seed; test track: cycle feel presets d1–d5)
- `window.rollyBally` exposes the app object in the console.

## Controls

Touch/drag anywhere (virtual joystick), WASD / arrows, or a gamepad left stick.
Two-finger drag looks around. In-game Home button: press and hold 1 s → pause (big Home / Play buttons).
Grown-up menu: press and hold the gear on Home for 1 s.
