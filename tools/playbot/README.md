# playbot

Local game tester bot for Gray's games. Phase 0: build + serve + headless smoke test + LLM judge.

```sh
source ~/.nvm/nvm.sh          # Node 24
cd tools/playbot
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci   # uses the cached chromium-headless-shell-1243
                                            # (elsewhere: npx playwright install chromium-headless-shell)

npm run smoke -- rolly-bally          # or: node bin/playbot.js smoke mazle
node bin/playbot.js judge-test out/mazle/<ts>/test-1-ready.png
```

`smoke <game>` builds the game (`vite build --base ./ --minify false` into `.cache/builds/<game>`),
serves it at `http://<host>:<port>/<game>/` with a built-in static server, opens every
`smokeUrls` entry in headless Chromium (WebGL via SwiftShader), waits for `window.__game.ready`
(see `HOOK_CONTRACT.md`; without the hook it falls back to canvas + 3 s and warns), steps 60 frames,
takes screenshots and fails on console errors, page errors, failed requests or WebGL context loss.
Results: `out/<game>/<timestamp>/smoke.json` + PNGs.

Flags: `--build=false` (reuse cached build), `--dist <dir>` (serve a given build), `--url <baseUrl>`
(test an already running server), `--timeout <ms>`, `--headed`, `--out <dir>`, `--verbose`.

Config: `playbot.config.json`. Env overrides: `PLAYBOT_HOST`, `PLAYBOT_PORT` (busy port -> next free one),
`PLAYBOT_JUDGE_PROVIDER`, `PLAYBOT_JUDGE_MODEL`.

Judge (`lib/judge.js`): `judge({ prompt, images, schema })` returns `{ value, ... }` with `value`
validated against the schema. Provider `claude-code` runs `claude -p` (reads images with its Read tool);
`anthropic-api` calls the Messages API with `ANTHROPIC_API_KEY`.

Modules in `lib/`: `config.js`, `build.js`, `server.js`, `browser.js`, `smoke.js`, `judge.js`.
`playwright` is pinned to 1.63.0 because it expects chromium-headless-shell revision 1243.

## Automatic checks (Phase 3, no AI)

```sh
node bin/playbot.js checks mazle --brackets 5-7          # all checks, one bracket column
node bin/playbot.js checks rolly-bally                   # all four brackets (default)
node bin/playbot.js checks rolly-bally --ci              # = --only network,links-out,input-fields,permissions,word-scan (~10 s)
node bin/playbot.js decide mazle out/mazle/<ts>/checks.json <fingerprint> ignore --note "why"   # save a human decision
npm test                                                 # unit tests (node --test)
```

Writes `out/<game>/<ts>/checks.json` (findings + per-bracket summary) and PNGs, prints a table
(one column per bracket) and exits 1 when the overall result is FAIL. Overall = strictest: any
`fail` in a chosen bracket or on an always-true rule → FAIL, else any `warn` → WARN. Every non-pass
finding has `evidence.screenshot`. Also takes the smoke flags (`--build=false`, `--url`, ...) plus
`--idle <s>` (default 60) and `--play <s>` (default 5).

Targets: each game's `checks.flows` in `playbot.config.json` (taps from page load to playing, e.g.
Rolly Bally Home → Playground → Go) plus every `smokeUrls` entry. Each target runs in a 1024×768
touch context (tablet, CSS px): DOM checks on every screen, then `PLAY_S` simulated seconds of random
input (canvas sampled every 1/60 s step), then `restore()` and up to 60 s idle.

| check | rule / rubric | how |
|---|---|---|
| `network` | R13 | every request; other origins fail, named when on the EasyList/EasyPrivacy host list (`data/tracker-domains.txt`, regenerate with `npm run update-trackers`); analytics globals (`gtag`, `dataLayer`, `fbq`, `_paq`, ...); third-party cookies |
| `permissions` | R13 | init script wraps geolocation, notifications, camera/mic, clipboard, sensors, storage access, devices, push, credentials |
| `links-out` / `input-fields` | R13 | `<a href>`/forms/iframes to other origins, `target=_blank`, `window.open`, popups, navigations; email/tel/password or personal-looking inputs fail, other text inputs warn |
| `touch-targets` | touch-target | tappable DOM elements' `min(width, height)` vs 76/57/44/44 px |
| `reading-level` | reading | `__game.text()` + DOM text: words per instruction, Flesch-Kincaid grade |
| `flashing` | R15 | WCAG 2.3.1 general + saturated-red flashes on the canvas, per 1/3-screen window (see `lib/checks/flashing.js`); evidence is a contact sheet of the worst second |
| `loudness` | R15, spoken-instructions | Web Audio destination tap: peak/RMS dBFS, sudden ≥20 dB jumps within 100 ms; "no audio" also fails spoken instructions where the rubric requires them |
| `axe` | (contrast) | `@axe-core/playwright`, WCAG 2.x A/AA, canvas excluded; advisory warn |
| `taps-to-play` | taps-to-play | taps in the flow until `playing` (a JS expression over `s = __game.state()`) holds |
| `hint-timing` | hint-when-stuck | idle, watch events and new text for hint-like wording; screenshots at 10/20/45/60 s |
| `pause-mute-quit` | R16 | visible controls by label/text/class; evidence for Claude |
| `countdown-timers` | R14, time-pressure | clock/"time left" text, numbers counting down, timer-like state fields |
| `word-scan` | R01–R14 | `lib/wordscan.js` over game text and the game's `checks.scanPaths` |

Human decisions: `lib/judgments.js` stores one JSON per decision in
`judgments/<game>/<rule-or-check>/<fingerprint>.json`; later runs apply them (the finding keeps
`judgment.originalStatus`). `lib/rules.js` loads `rules.yaml`/`rubric.yaml`; `lib/review.js` has
`aggregate(findings, brackets)` and the table formatter.

Limits: only the canvas is sampled for flashing (not DOM overlays); in test mode the game is stepped
slower than real time while frames are sampled, so sounds are spread out more than in real play;
pause/mute/quit controls are found, not pressed; visual-only hints are left to Claude via the screenshots.

## Bots and kid UX numbers (Phase 2)

```sh
node bin/playbot.js play mazle                        # solver, monkey, explorer, kid personas (all brackets), fps
node bin/playbot.js play mazle --layout iteration1 --bots solver,monkey,explorer
node bin/playbot.js play rolly-bally --bots kids --brackets 5-7 --seeds 5
node bin/playbot.js play mazle --bots monkey --seed 7  # reproduce one monkey run
node bin/playbot.js calibrate mazle                   # kid personas: Iteration 1 (12x12) vs Iteration 2 (Level 1)
node --test test/bots.test.mjs test/metrics.test.mjs
```

`play` writes `out/<game>/<ts>/play.json` + heatmap PNGs; `calibrate` writes `out/mazle/<ts>-calibrate/`.
Flags: `--bots solver,monkey,explorer,kids,fps`, `--brackets`, `--seeds N` (kid/monkey seeds), `--seed N`,
`--layout level1|iteration1`, `--browsers N --per-browser M` (default 8 x 2), plus the smoke flags
(`--build=false`, `--url`, `--dist`, `--out`).

Code: `lib/bots/` (`mazle.js`, `rolly.js`, `mazeGrid.js` layout geometry + A* + cell graph + Iteration 1
layouts, `personas.js`, `session.js` browser pool / fps probe, `play.js`, `cli.js`) and `lib/metrics.js`
(run recorder, summaries, verdicts, PNG heatmaps).

- **Solver** — Mazle: A* over layout blocks (away from the spike), waypoints followed with turn keys + forward;
  layout numbers from `mazeCarver.analyzeMaze`. Rolly Bally: follows `ahead` centreline points (test-track, races d=1..5).
- **Monkey** — seeded random held inputs; after every step checks finite numbers, in bounds / not in a wall
  (Mazle), not below the world for > 8 s (Rolly Bally), page errors, soft-locks (no movement for 3–4 s while
  pushing, then tries 8 directions).
- **Explorer** — light Go-Explore (teleport to an archived block/bin favouring the frontier, random roll-out):
  coverage, floor never reached (with the spike/door explained), cells it kept failing to leave.
- **Kid personas** — `rubric.yaml` personas + `PERSONA_EXTRAS` in `personas.js` (memory, straight bias, spike
  avoidance, race level: guesses, fixed before calibration). Mazle kid: no map, cell-to-cell with the turn keys,
  reaction delay, open-loop turn bursts with hold jitter, aim jitter, wrong turns, fading memory, walks to the
  door once it can see it, gives up after `give_up_after_s` without reaching a new cell. Time cap = the bracket's
  session max; "stuck" = no new cell for the bracket's hint time.
- **Verdict** (Mazle, per bracket): too hard if < 60% escape within the cap or the median time is over the session
  max; too easy if the median is under 10% of the session min. Rolly Bally: too hard if < 60% finish or > 3 falls/min.
- **Frame rate**: `setRealtime(true)`, CPU throttled 4x via CDP, 1024x768, 5 s. SwiftShader renders on the CPU,
  so this is a pessimistic number, not a real tablet.

Bot pages skip WebGL draw calls (`session.js`, `window.__pbSkipDraw`): the game code runs unchanged but
SwiftShader pixels cost ~5–7 ms a frame and bots only read state. Frame-rate runs draw normally.

## Review report, Notion and CI (Phase 5)

```sh
PLAYBOT_HOST=127.0.0.1 PLAYBOT_PORT=9180 node bin/playbot.js review mazle --brackets 5-7 [--profile plan.md] [--full]
PLAYBOT_HOST=127.0.0.1 node bin/playbot.js ci rolly-bally --dist ../../src/rolly-bally/dist      # no-AI deploy gate
PLAYBOT_HOST=127.0.0.1 node bin/playbot.js ci mazle --dist <dist> --hook-optional
node bin/playbot.js reports-parent rolly-bally [--set <notion url>]                             # where /playtest puts the report
node bin/playbot.js report mazle --run out/mazle/<ts>-review                                    # re-render report.md/json
```

`review` (`lib/reviewCommands.js`) builds and serves the game once and runs, into one run dir
`out/<game>/<ts>-review/`: smoke, all checks, `play` (solver, monkey, explorer, kid personas for the
chosen brackets, fps; 3 seeds, 5 with `--full`; marked "not run" if `lib/bots` can't load), a solver video
(`video/solver.webm`, Playwright `recordVideo`, local only; `lib/video.js`), `judge-rules` and `compare`
(Claude, one retry each since `claude -p` can time out; skip with `--ai=false`). Then `lib/report.js` writes:

- `report.md`: Notion-flavoured markdown. "Needs a human decision" first (Claude fails/unsures on always-true
  rules and automatic always-true fails, with fingerprints and the `playbot decide` command), Summary
  (PASS/WARN/FAIL), always-true rules table (R01–R16, auto + Claude), one column per bracket, stuck spots and
  difficulty (from `play.json`), comparison (and whether the comparables came from a Tester profile or were
  picked by Claude), key screenshots (`[[screenshot: <file>]]` placeholders for the skill), local paths.
- `report.json`: title, overall, per-bracket results, needsHuman (with `decide` commands), the ≤ 8
  screenshots to attach, video paths, step statuses.

Result policy: the strictest chosen bracket decides; an always-true rule fail (automatic, or Claude until a
person clears it) is FAIL; smoke errors and bot bugs are FAIL; other AI verdicts and "too hard" kid personas
are at most WARN.

The `/playtest <game>` skill (`.claude/skills/playtest/SKILL.md`) asks for brackets, runs `review`, and
creates the Notion child page (under the game's `planPage`, else under "Game tester reports" in Research,
recorded in `reports.fallbackParent.url`) with the screenshots uploaded.

`ci` is the deploy gate in `.github/workflows/deploy-site.yml`: smoke + solver + a 20 s monkey
(`--monkey-seconds`) + `checks --ci`, on an already built `--dist`. Chromium resolves only 127.0.0.1
(`--offline=false` to turn that off), so it never needs the network or Claude. Exits 1 on smoke errors,
bot failures or any failing red-flag check; writes `ci.json`. `--hook-optional`: a build without
`window.__game` gets smoke + red-flag checks only (solver/monkey skipped with a notice); without it a
missing hook fails.
