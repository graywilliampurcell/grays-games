---
name: playtest
description: Run the playbot game tester on one of Gray's games (Mazle, Rolly Bally) for chosen age brackets and publish the tester report as a Notion child page with key screenshots attached. Use when the user types /playtest <game> or asks for a tester report / playtest review of a game.
---

# /playtest <game>

Runs `playbot review` (smoke, automatic checks, bots and kid personas, solver video, Claude
content and rubric checks, comparison) and turns its `report.md` into a Notion page:
"Tester report — YYYY-MM-DD · <Game>". Plan of record: Notion "2026-09-27-game-tester-bot-plan"
(https://app.notion.com/p/3e862b14e6ba816f8074cce7a7f12672), Part 2.

Hard rules:
- **Never write to a game's plan page.** Read it only. The report is a new *child* page under it.
- Videos stay local; only the key screenshots are uploaded.
- Don't start anything on ports 9073/9074 (JP's dev servers). Always run playbot with
  `PLAYBOT_HOST=127.0.0.1 PLAYBOT_PORT=9180`.
- Run shell commands from the repo root; source nvm first (`source ~/.nvm/nvm.sh`, Node 24).

Notion MCP tools used (load them first with ToolSearch
`select:mcp__claude_ai_Notion__notion-fetch,mcp__claude_ai_Notion__notion-search,mcp__claude_ai_Notion__notion-create-pages,mcp__claude_ai_Notion__notion-update-page,mcp__claude_ai_Notion__notion-create-file-upload,mcp__claude_ai_Notion__notion-create-attachment`):
`mcp__claude_ai_Notion__notion-fetch`, `mcp__claude_ai_Notion__notion-search`,
`mcp__claude_ai_Notion__notion-create-pages`, `mcp__claude_ai_Notion__notion-update-page`,
`mcp__claude_ai_Notion__notion-create-file-upload`, `mcp__claude_ai_Notion__notion-create-attachment`.

## Steps

### a. Resolve the game

`<game>` must be a key of `games` in `tools/playbot/playbot.config.json` (`mazle`, `rolly-bally`;
accept "Rolly Bally"/"rolly" → `rolly-bally`). If missing or unknown, ask which one. Then:

```sh
source ~/.nvm/nvm.sh && node tools/playbot/bin/playbot.js reports-parent <game>
```

It prints JSON: `parent: "plan"` with the plan page `url` (Mazle), or `parent: "fallback"` with
the "Game tester reports" page `url`, or `create: true` with `underUrl` (Research) when that page
does not exist yet (Rolly Bally, first time).

### b. Read the game's plan (read only) and its Tester profile

If the game has a plan page (Mazle: https://app.notion.com/p/3e762b14e6ba81e48999c2df1942a56f),
fetch it with `mcp__claude_ai_Notion__notion-fetch` (`id` = the URL). Save the page text (the part
inside `<content>…</content>`) to a file in your scratchpad, e.g. `<scratchpad>/plan-<game>.md`,
with the Write tool. `playbot review --profile <file>` copies it into the run dir as `plan.md`.

Look for a section headed **Tester profile** (Age brackets, Genre, Comparable games, Focus).
If there is one, note its brackets (they are the pre-selection) and comparables. If not, say so:
the bot will ask for brackets and Claude will pick 2–4 comparable games for this run (named in
the report). Do not add a Tester profile to the plan; writing profiles is out of scope.

Games without a plan page (Rolly Bally): skip this step; no `--profile`.

### c. Pick the age brackets

Read the four brackets from `tools/playbot/rubric.yaml` (`brackets:`: id, `label`, `description`)
and ask with **AskUserQuestion**, `multiSelect: true`, one option per bracket:
label `"5–7 Early readers"`, description = the rubric description in one line. Mark the Tester
profile's brackets as pre-selected / "(Recommended)" when there is a profile. The user must pick
at least one. Pass them as `--brackets 5-7,8-10` (ASCII hyphen, comma-separated).

### d. Run the review (takes several minutes)

```sh
source ~/.nvm/nvm.sh && cd tools/playbot && \
  PLAYBOT_HOST=127.0.0.1 PLAYBOT_PORT=9180 node bin/playbot.js review <game> \
  --brackets <ids> [--profile <scratchpad>/plan-<game>.md] [--full]
```

Run it with Bash `run_in_background: true` and wait for the completion notification (don't
poll in a tight loop; don't start a second run). `--full` uses the review model and 5 seeds per
kid persona (slower, more expensive); use it only when the user asks for a full review.
Useful flags: `--ai=false` (no Claude steps), `--video=false`, `--seeds N`.

The last lines print the run dir. Everything is in `tools/playbot/out/<game>/<ts>-review/`:
`report.md`, `report.json`, `smoke.json`, `checks.json`, `play.json`, `claude.json`,
`compare.json`, `keyshots/`, `video/solver.webm`, heatmaps and check screenshots.
Read `report.json` (title, overall, needsHuman, screenshots, videos, steps). If a step shows
`"status": "error"` or `"not run"`, say so in the final message; the report already notes it.

### e. Create the Notion child page

Parent:
- Game with a plan page (`parent: "plan"`): that page. Use its page id (the 32-hex id at the end
  of the URL) as `parent: { "type": "page_id", "page_id": "<id>" }`.
- `parent: "fallback"` with a `url`: that "Game tester reports" page.
- `create: true`: first check it doesn't already exist: `mcp__claude_ai_Notion__notion-search`
  with `query: "Game tester reports"` and `page_url: <underUrl>` (Research,
  https://app.notion.com/p/3a862b14e6ba812f8f7bff0d365e0f23). If found, use it. Otherwise create
  it with `mcp__claude_ai_Notion__notion-create-pages`, `parent` = Research's page id,
  `pages: [{ "properties": { "title": "Game tester reports" }, "icon": "🧪",
  "content": "Tester reports from playbot for games that have no plan page yet. One child page per review." }]`,
  `allow_async: false`. Then record it (so it is created only once):
  `node tools/playbot/bin/playbot.js reports-parent <game> --set <new page url>`
  (this edits `reports.fallbackParent.url` in `tools/playbot/playbot.config.json`).

Page: `mcp__claude_ai_Notion__notion-create-pages` with that parent, `allow_async: false`, and one page:
- `properties.title` = `report.json` `title` (e.g. "Tester report — 2026-10-02 · Mazle"). If a
  page with the same title already exists under the parent (a second run that day), append
  " (2)", " (3)", …
- `icon`: "🤖"
- `content` = `report.md` **without its first line** (the `# title` heading; Notion shows the
  title itself), with the screenshot placeholders handled as in step f. The markdown is already
  Notion-flavoured (callout, tables, colour spans, escaped special characters); pass it as is.

Keep the returned page URL/id.

### f. Attach the key screenshots

`report.json.screenshots` lists at most 8 `{ file, path, caption, why }` (`path` absolute).
`report.md` has one placeholder line `[[screenshot: <file>]]` per screenshot, followed by a
caption line. For each screenshot, before creating the page (so it's one create call):

1. `mcp__claude_ai_Notion__notion-create-file-upload` with `filename` = the file's basename
   (e.g. `failing-spike.png`; omit `content_type`, it is inferred). It returns `upload_url`,
   `upload_headers` and the upload id.
2. Upload the file: one multipart POST with the file in the `file` form field and every returned
   header, e.g.
   `curl -sS -X POST "<upload_url>" -H "<Header>: <value>" … -F "file=@<path>"`
   (quote the URL; the URL is short-lived and single-use, so do this right after step 1). Files
   must be ≤ 20 MiB (screenshots are far smaller).
3. The upload response (and/or the tool result) has `markdown_source` and `suggested_markdown`.
   Replace the placeholder line with the image markdown: `![<caption>](<markdown_source>)`, or
   `suggested_markdown` as given when no source is shown.

If an upload fails, replace its placeholder with the text
`Screenshot not attached (local file: <path>)` and carry on. For an image that is already on a
public HTTPS URL (not the case for local runs), `mcp__claude_ai_Notion__notion-create-attachment`
with `source_url` + `filename` does the same in one call; for a file already uploaded by this
integration it takes `source_file_id`.

If the page was already created without the images, add them afterwards with
`mcp__claude_ai_Notion__notion-update-page`, `command: "update_content"`, replacing each
placeholder line (`old_str`) with the image markdown (`new_str`).

Videos (`report.json.videos`, `video/solver.webm`) are **not** uploaded; the report's
"Local files" section already names their paths.

### g. Tell the user

Reply with:
- the Notion page link and the overall result (PASS/WARN/FAIL, strictest bracket);
- the **Needs a human decision** list from `report.json.needsHuman`: rule, what Claude (or the
  automatic check) said, the screenshot, and the fingerprint;
- steps that errored or were not run;
- the local run dir and video path.

### h. Record the user's decisions

For each decision the user gives (e.g. "R16 is OK, the game is a prototype"), run the item's
`decide` command from `report.json.needsHuman` with the decision and their reason:

```sh
source ~/.nvm/nvm.sh && node tools/playbot/bin/playbot.js decide <game> <claude.json or checks.json path> <fingerprint> <pass|warn|fail|ignore> --note "<their words>"
```

- `pass` = it's fine; `ignore` = not applicable / false positive; `warn` = keep as a warning;
  `fail` = it really breaks the rule (fix the game).
- Decisions are saved under `tools/playbot/judgments/<game>/…` and reused by later runs, so the
  same question isn't asked again.
- If a Claude step errored in the run (`report.json.steps`), it can be re-run into the same run dir
  (`node tools/playbot/bin/playbot.js compare <game> --brackets <ids> --run <run dir>`, or
  `judge-rules`), then `node tools/playbot/bin/playbot.js report <game> --run <run dir>` re-renders
  `report.md`/`report.json` (also picks up saved decisions). Do this before step e when possible.
- Optionally add a short line under the report page's "Needs a human decision" heading with
  `mcp__claude_ai_Notion__notion-update-page` (`update_content`) saying what was decided. Never
  edit the game's plan page.
