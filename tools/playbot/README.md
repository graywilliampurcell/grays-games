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
