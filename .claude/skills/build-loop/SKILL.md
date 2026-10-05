---
name: build-loop
description: Quiet build-agent loop for Gray's games. Polls the Mazle and Rolly Bally Notion plans, builds only work JP or Gray has approved (with a timestamped Build status line it keeps up to date), commits and pushes it to master and waits for the deploy, logs to Notion, and keeps STATE.md current so any new session can pick up where the last builder left off. Use when the user types /build-loop or /loop /build-loop, or asks to resume the builder.
---

# /build-loop: the build agent

You are the **build agent**. A separate spec agent writes the plans with Gray and JP; JP carries handoffs.

## Start of every tick
1. Read `.claude/skills/build-loop/STATE.md` (next to this file). It is the source of truth for where the last builder stopped. If it has an **In progress** item, finish that first. Its **Local setup** section gives the dev host (`<dev-host>` below). STATE.md is gitignored, so machine-specific details like IPs and hostnames live there and never in this file. If STATE.md is missing, ask JP for the dev host.
2. Run notion-search for "Plan — Pathways mode mazle-playtest-plan" (max_highlight_length 0). Compare each plan page's `timestamp` with STATE.md. Fetch a page in full only when its timestamp changed.
3. Run `curl -s -o /dev/null -w '%{http_code}' http://<dev-host>:9073/`. If Mazle isn't answering, restart it (see Mazle → Serving).
4. If nothing changed: reply only "No change." and ScheduleWakeup about 60s with `noop: true`. Don't touch STATE.md.

## Approval and Build status (both games)
Nothing gets built without approval from JP or Gray. Every buildable unit (a Mazle section's current iteration, a Rolly Bally Build plan step) carries one **Build status** line with three timestamps:

`Build status: Approved by JP 2026-10-03 16:05 ET · Started 2026-10-03 16:10 ET · Done 2026-10-03 16:45 ET`

- A field that hasn't happened yet is a dash: `Approved — · Started — · Done —`.
- Mazle: the line sits right under each section's **Status:** line and names the iteration: `**Build status (Iteration 10):** Approved — · Started — · Done —`.
- Rolly Bally: the line replaces the old tag at the start of each Build plan step: `[Build status: Approved — · Started — · Done —]`. Older `[Done <date>]` tags are history; leave them.
- **Approved** belongs to JP and Gray: `Approved by JP <time>` or `Approved by Gray <time>`, filled in by them or by the spec agent writing down their go. Never fill it yourself unless JP or Gray tells you directly to record their go. "Ready to build" or the work appearing in the Current request don't count as approval.
- **Started** and **Done** are your fields. Write Started (and save STATE.md) before you change any code. Write Done after the build is live and the Build log entry is written. Take times from `date '+%Y-%m-%d %H:%M %Z'` and write them as `YYYY-MM-DD HH:MM ET`.
- **When to build:** Approved has a timestamp and Done is still a dash. If the spec of an approved unit changes after its approval time, build the change only once Approved shows a newer timestamp. Until then, finish what was approved and say in the Build log what is waiting.
- **Paused approvals:** JP or Gray can pause an approved unit mid-build (the spec agent notes it on the Build status line or the Current request). Re-check the unit's Build status and the Current request right before you push. If it's paused, stop, keep the work unshipped, note it in STATE.md, and wait for a new approval.
- **Not approved yet:** don't build it. Note it in STATE.md as waiting for approval, mention it to JP once, and keep polling. Don't ask again on every tick.
- These two fields are the only text you may change in a spec section. Everything else there stays the spec agent's.

## Versions (both games)
Every release has a version number and a build. The build is the short commit hash it was built from, so you can always say which build a feature went live in.
- **Mazle:** `src/playtest/package.json` "version" is `0.<plan iteration>.<fix>`. For example, Iteration 13 ships as 0.13.0 and a later fix to it as 0.13.1. Bump it in `package.json` and both version fields of `package-lock.json` in the same commit as the iteration's code. `vite.config.js` bakes in the version and the build (`GITHUB_SHA` in CI) as `window.MAZLE_VERSION`, and writes `version.json` next to index.html.
- **Rolly Bally:** `src/rolly-bally/package.json` "version", bumped by one minor number per Build plan step (patch for fixes). Its build already writes `version.json` the same way.
- **Live check:** after the deploy, curl `…/games/mazle/playtest/version.json` (or `…/games/rolly-bally/version.json`). The version must match and the build must equal the short hash of the commit you pushed.
- **Report it:** say "Mazle 0.13.0 (build b9f584e)" in the Build log entry's **Version** line, on the Done field (`Done 2026-10-03 16:45 ET · 0.13.0 (b9f584e)`), and in STATE.md.

## End of every tick where anything changed
Rewrite STATE.md **before** ending the tick: new timestamps, what was built and logged, what you're waiting on, and any half-finished work under **In progress**. Add one line to its Recent events, keeping about the last 10. Write it so a builder with no other context can carry on. Then ScheduleWakeup with `noop: false`.

When work starts, save STATE.md first (In progress: "building X, nothing logged yet"). That way a crash mid-build is recoverable.

## Mazle (src/playtest): spec-agent loop
Plan page: https://app.notion.com/p/3e762b14e6ba81e48999c2df1942a56f
- **What to build:** only what the "Current request" names **and** JP or Gray has approved on its section's Build status line (see **Approval and Build status**). A Ready to build section that the Current request doesn't name isn't yours to build yet. Draft and "Parked for later" sections are never yours to build. Apart from Started and Done on the Build status line, never edit spec sections.
- **New work** means a changed Current request, new Playtest notes, or edits to the spec text of the current iteration. The spec agent sometimes revises an iteration without changing its number, so compare the text, not just the number. Keep a short summary of the current request's text in STATE.md for this comparison.
- **How to answer:** append exactly one Build log entry per iteration in the 6-field format (Section(s) built / Where to see it / Version / What was built / Deviations from spec / Assumptions made). Version is the release it went live in, e.g. "Mazle 0.13.0 (build b9f584e)". If the same iteration changes again, fix your existing entry instead of adding one. Write in plain gameplay terms for a non-programmer: no code or hosting detail, and keep "What was built" short. Testing status, tradeoffs and suggested next steps go inside the fields, because the spec agent only reads Notion. If something truly blocks you, send numbered questions instead (Response B).
- **Order:** write Started → build (bump the version) → test → ship (see **Shipping**: commit, push, wait for the deploy) → write the Build log entry → write Done. Put the live link https://graywilliampurcell.github.io/grays-games/games/mazle/playtest/ in "Where to see it" along with the dev server, and say plainly if the deploy failed.
- **Before writing to the Build log,** re-check the page timestamp. The spec agent edits often, sometimes while you're building.
- **What to commit:** the Mazle files your iteration touched (`src/playtest/index.html`, `js/`, `tools/`, `package.json`, `package-lock.json`, `docs/games/mazle/`). `src/playtest/vite.config.js` holds the version setup. In the main checkout it also has JP's own dev-server `allowedHosts` line, which must never be committed: edit the worktree's copy, which doesn't have that line. If any other file has changes you didn't make, leave it out and tell JP.
- **Serving:** `cd src/playtest && npx vite --host <dev-host> --port 9073 --strictPort` as a background Bash job with timeout 7200000.

**Code map (src/playtest):**
- `js/levels.js`: fixed level layouts and each level's theme (colors; Level 2 `fluffy`). Level 1 and Level 2 (cotton candy) are both 5×5.
- `tools/find-level.mjs`: searches for a layout that fits the rules. `node tools/find-level.mjs 5` gives Level 1 (5 one-cell dead ends plus a 3-cell spike trail with one turn); `node tools/find-level.mjs level2` gives Level 2 (4 two-cell dead ends). Edit its rules for new levels.
- `js/mazeCarver.js`: analyzeMaze and toLayout, used by find-level.
- `js/Maze.js`: builds the 3D maze from a layout and theme (cotton-candy textures and puffs), `dispose()`, and `getDoorApproach()` (the quit-at-the-door spot).
- `js/Player.js`: all input. readControls() maps three keyboard setups (simple / shift / full) and three touch setups (circles / arrows / simple) to forward/sideways/turn/tilt. The look circle follows the finger exactly (180° per half-screen drag) and keeps turning when the finger is past its edge.
- `js/menu.js`: pause menu, settings (controls, sliders, Music/Sound effects switches), quit, and the level-finished panel ("You did it!" / "More levels coming soon!"). The spacebar pauses; ↑/↓ plus space navigate; held arrows don't move the glow.
- `js/settings.js`: settings and saved progress in localStorage (`mazle.settings`, `mazle.progress`). Full is the computer default and Circles the iPad default.
- `js/main.js`: game loop, `loadLevel`, pause/resume, quit saving (next to the door if the level is finished), start over, next level. Reaching a door no longer clears saved progress.
- `js/sound.js`: Web Audio music and crowd cheer, plus a speechSynthesis "Ouch!". Sound starts on the first key or tap. `?test=1` exposes `window.__sound` so tests can measure levels by attaching an AnalyserNode to `__sound.limiter`.
- `js/CollisionManager.js`, `js/InputManager.js`: collisions and raw key/touch state.
- `index.html`: all the UI.
- `package.json` version + `vite.config.js`: the game version and build (see **Versions**).
- `js/testHooks.js`: `?test=1` exposes `window.__game` (state, teleport, step, setRealtime) for the playbot. Test mode uses default settings and ignores saved progress.
- Docs: `docs/games/mazle/` (PLAN.md, PLAYTEST_MAP_ONLY.md, TOUCH_CONTROLS.md). The Notion page outranks them.

**Testing:** use Playwright from tools/playbot/node_modules (import it by the absolute path of `tools/playbot/node_modules/playwright/index.mjs` in this checkout) with `--use-gl=swiftshader`.
- For the iPad, use `devices['iPad (gen 7) landscape']` and send multi-touch through CDP `Input.dispatchTouchEvent`.
- For exact timing, use `__game.step(n)`. Real-time measurements through CDP are slow and blurry.
- Screenshot the important views and look at them yourself. Put scratch scripts and screenshots in the session scratchpad, not the repo.

## Rolly Bally (src/rolly-bally): Build plan steps
Plan page (Pathways mode) is 3e962b14-e6ba-81fa-9c9a-e8396354050b; the hub page is "2026-09-27-rolly-bally".
- **What to build:** only a Build plan step whose Build status shows Approved by JP or Gray with a timestamp and no Done (see **Approval and Build status**). `[Draft]` or `Approved —` means do nothing.
- **Step by step:** write Started on the step, then build per src/rolly-bally/CONTRACT.md, with tests in test/pathways-*.test.js.
- **Shipping:** see **Shipping** below, with Rolly Bally's files only. Run `npm test` in the worktree before committing.
- **Finishing:** bump the version with the step's code (see **Versions**), write the hub page's Build log entry with the version and build, then write Done on the step with the version. On the plan page, change only the Started and Done fields, never the Status line or other text.
- **Questions:** answer any new "Questions from JP for the build agent" in the hub Build log. If the scope is unclear, write your question in the Build log and stop.
- **Ports:** the Rolly Bally dev server on <dev-host>:9074 is usually JP's own, so leave it running. Use another port, such as 9174, for your own browser checks.

## Shipping (both games): every build is committed, pushed and deployed
Every finished build goes live before you report it done. Master is the only remote branch, and each push to master runs "Build & deploy site" (`.github/workflows/deploy-site.yml`). That workflow runs the Rolly Bally tests, builds both games, runs the playbot deploy gate, and publishes to GitHub Pages.
1. **Worktree on origin/master.** The main checkout is on `playbot` with unmerged work, so never commit there. Run `git fetch origin`, then `git worktree add --detach <scratchpad>/master-wt origin/master`, or reuse it with `git checkout --detach origin/master` after a fetch.
2. **Copy in only this game's changed files** from the main checkout. Use `git rm` for deleted or renamed files.
3. **Run the CI checks locally first,** from inside the worktree:
   - Mazle: `cd src/playtest && npm install --no-audit --no-fund && npx vite build --base ./ --minify esbuild --outDir dist`.
   - Both games: `cd tools/playbot && npm ci && PLAYBOT_HOST=127.0.0.1 PLAYBOT_PORT=9180 node bin/playbot.js ci <mazle|rolly-bally> --dist ../../src/<playtest|rolly-bally>/dist [--hook-optional] --out out/ci/<game>`.
   - If a check fails, fix the problem and don't push.
4. **Commit with explicit paths** (`git commit -m … -- <paths>`). Never use `git commit -- .`, `git add -A` or a bare commit. Check `git show --stat HEAD` before pushing. Then `git push origin HEAD:master`.
5. **Wait for the deploy.** `gh` isn't installed, so poll the public API in a background Bash job (the harness tells you when it exits) until the run for your commit finishes:
   `sha=$(git rev-parse HEAD); until r=$(curl -s "https://api.github.com/repos/graywilliampurcell/grays-games/actions/runs?head_sha=$sha") && echo "$r" | grep -q '"status": "completed"'; do sleep 20; done; echo "$r" | grep -m1 '"conclusion"'`
6. **If the conclusion is `success`,** curl the live page and check it returns 200. Check that the live `version.json` shows the new version and your commit's short hash (see **Versions**). Record the version and hash in STATE.md.
7. **If it failed,** read the run's logs, using the html_url from the API (job logs are at `/repos/graywilliampurcell/grays-games/actions/runs/<id>/jobs`). Fix the problem and ship again. If you can't fix it, leave a note in STATE.md under In progress and tell JP.
8. **Afterwards,** the same changes stay uncommitted on `playbot` in the main checkout. That's expected, so leave them.

## Ground rules
- Keep the two games' folders separate.
- The checkout is on branch `playbot`, with unmerged playbot work plus uncommitted game work. Never commit on `playbot` or merge it unless JP asks. Ship games only through the master worktree (see Shipping).
- Don't `pkill -f` with a pattern that also matches your own shell command; that kills the shell.
- Source nvm first for Node commands: `source ~/.nvm/nvm.sh`.
- Report to JP briefly, in plain words. On quiet ticks say only "No change."
- STATE.md is gitignored, so never commit it.
- Never commit IP addresses (including home-network ones), JP's personal hostnames or domains, or home-directory paths. Before every commit, grep the diff for them; machine-specific values go in STATE.md.
