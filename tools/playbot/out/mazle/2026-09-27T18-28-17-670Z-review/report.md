# Tester report — 2026-09-27 · Mazle
## Needs a human decision {color="orange"}
- [ ] **R16 Kids always have control**: Claude says <span color="red">**FAIL**</span>. No screenshot (menu, playing, failing, or winning) shows any pause, mute, or quit/home control, and the automatic check confirms "Playing screen has no visible pause, mute, quit controls"; failing itself only costs a little progress (back to level start), but the missing controls break the rule.
	Fingerprint `0b08429f7156`, screenshot `keyshots/playing-walk.png`. Decide with:
	`node tools/playbot/bin/playbot.js decide mazle tools/playbot/out/mazle/2026-09-27T18-28-17-670Z-review/claude.json 0b08429f7156 <pass|warn|fail|ignore> --note "why"`
A saved decision is reused by later runs (tools/playbot/judgments/), so the same question is not asked again.
## Summary
<callout icon="⛔" color="red_bg">
	**Overall: FAIL** (strictest chosen bracket: 5-7). Brackets: 5-7 Early readers = **FAIL**.
</callout>
- FAIL: always-true rule R16 (Kids always have control) broken per Claude (until a person clears it)
- **5-7**: FAIL: automatic checks: 1 fail, 4 warn; WARN: Claude rubric (advisory): 4 check(s) not met
- Brackets chosen by: user (--brackets). Tester profile: none (brackets asked at review time; comparables picked by Claude).
- Policy: the strictest chosen bracket sets the result; an always-true rule fail is a FAIL; AI verdicts are advisory (at most WARN) except on the always-true rules, where a Claude fail holds until a person clears it.
- Steps: smoke ok (2s), checks ok (48s), play ok (49s), video ok (17s), judge-rules ok (78s), compare ok (164s).
- Smoke test: passed (1 URL(s), hook ready).
- Claude judge: claude-sonnet-5, 72s, $0.398 (rules + rubric); comparison $0.599.
## Always-true rules
Checked on every review, whatever the bracket. **Auto** = automatic checks (no AI), **Claude** = judged on the key screenshots and all game text.
<table header-row="true" fit-page-width="true">
	<tr><td>Rule</td><td>Auto</td><td>Claude</td><td>Result</td><td>Notes</td></tr>
	<tr><td>**R01** No blood</td><td><span color="green">**PASS**</span></td><td><span color="green">**PASS**</span></td><td>**PASS**</td><td>–</td></tr>
	<tr><td>**R02** No weapons or guns</td><td><span color="green">**PASS**</span></td><td><span color="green">**PASS**</span></td><td>**PASS**</td><td>–</td></tr>
	<tr><td>**R03** No bashing or breaking of living things</td><td>–</td><td><span color="green">**PASS**</span></td><td>**PASS**</td><td>–</td></tr>
	<tr><td>**R04** No injury or death shown</td><td><span color="green">**PASS**</span></td><td><span color="green">**PASS**</span></td><td>**PASS**</td><td>–</td></tr>
	<tr><td>**R05** No harm to animals or creatures</td><td><span color="green">**PASS**</span></td><td><span color="green">**PASS**</span></td><td>**PASS**</td><td>–</td></tr>
	<tr><td>**R06** No scary content</td><td>–</td><td><span color="green">**PASS**</span></td><td>**PASS**</td><td>–</td></tr>
	<tr><td>**R07** No meanness</td><td><span color="green">**PASS**</span></td><td><span color="green">**PASS**</span></td><td>**PASS**</td><td>–</td></tr>
	<tr><td>**R08** No stereotypes</td><td>–</td><td><span color="green">**PASS**</span></td><td>**PASS**</td><td>–</td></tr>
	<tr><td>**R09** No romance, sexual content, drugs, alcohol, tobacco or vaping</td><td><span color="green">**PASS**</span></td><td><span color="green">**PASS**</span></td><td>**PASS**</td><td>–</td></tr>
	<tr><td>**R10** No bad language</td><td><span color="green">**PASS**</span></td><td><span color="green">**PASS**</span></td><td>**PASS**</td><td>–</td></tr>
	<tr><td>**R11** No dangerous stunts a kid could copy</td><td>–</td><td><span color="green">**PASS**</span></td><td>**PASS**</td><td>–</td></tr>
	<tr><td>**R12** No gambling or casino-style mechanics</td><td><span color="green">**PASS**</span></td><td><span color="green">**PASS**</span></td><td>**PASS**</td><td>–</td></tr>
	<tr><td>**R13** No money, ads or data</td><td><span color="green">**PASS**</span></td><td><span color="green">**PASS**</span></td><td>**PASS**</td><td>–</td></tr>
	<tr><td>**R14** No manipulative design</td><td><span color="green">**PASS**</span></td><td><span color="green">**PASS**</span></td><td>**PASS**</td><td>–</td></tr>
	<tr><td>**R15** Safe for the senses</td><td><span color="gray">**INFO**</span></td><td><span color="green">**PASS**</span></td><td>**PASS**</td><td>–</td></tr>
	<tr color="red_bg"><td>**R16** Kids always have control</td><td><span color="orange">**WARN**</span></td><td><span color="red">**FAIL**</span></td><td>**FAIL**</td><td>auto: Playing screen has no visible pause, mute, quit controls · Claude: No screenshot (menu, playing, failing, or winning) shows any pause, mute, or quit/home control, and the automatic check confirms "Playing screen has no visible pause, mute, quit controls"; failing it… · screenshot keyshots/playing-walk.png</td></tr>
</table>
## Age brackets
- **5-7 Early readers**: 5 words or fewer per instruction plus audio, simple controls, soft failing, 5–10 min sessions.
Cells: automatic result / AI (advisory) result. Rubric numbers are starting points we tune after watching Gray play.
<table header-row="true" header-column="true" fit-page-width="true">
	<tr><td>Check</td><td>5-7</td></tr>
	<tr><td>Smallest touch target</td><td>auto <span color="gray">**INFO**</span></td></tr>
	<tr><td>Reading needed</td><td>auto <span color="orange">**WARN**</span> 3 instruction(s) over 5 words; longest "Controls: W/↑ Forward \| S/↓ Back A/← Strafe Left \| D/→ Strafe Right M…<br>AI <span color="orange">**WARN**</span> The controls help panel is one instruction block a child must parse, but it runs to roughly 30 words across f…</td></tr>
	<tr><td>Spoken, replayable instructions</td><td>auto <span color="red">**FAIL**</span> No audio at all, so no spoken instructions (required for 5-7)<br>AI <span color="red">**FAIL**</span> The source has 0 audio files, no speechSynthesis, no WebAudio, and no \<audio\> elements — every instruction (c…</td></tr>
	<tr><td>Time pressure</td><td>AI <span color="green">**PASS**</span></td></tr>
	<tr><td>Failing</td><td>AI <span color="orange">**WARN**</span> Failing is soft and non-violent: touching the spike just sends the player back to the start cell with the mes…</td></tr>
	<tr><td>Hint when stuck</td><td>auto <span color="orange">**WARN**</span> No text/event hint within 60 s idle (want ≤ 20 s)</td></tr>
	<tr><td>Taps until playing</td><td>auto <span color="green">**PASS**</span></td></tr>
	<tr><td>Things on screen at once</td><td>AI <span color="orange">**WARN**</span> During normal play there are already 3-4 competing panels: the FPS/Position debug box (top-left), the Control…</td></tr>
	<tr><td>Scariness</td><td>AI <span color="green">**PASS**</span></td></tr>
	<tr><td>Contrast</td><td>AI <span color="green">**PASS**</span></td></tr>
	<tr><td>Kid persona difficulty</td><td>Iteration 2 (Level 1): <span color="green">**PASS**</span> ok</td></tr>
	<tr><td>**Bracket result**</td><td>**FAIL**</td></tr>
</table>
## Stuck spots & difficulty
- Solver Level 1: won in 22.7s, path 0.99× optimal.
- Monkey: 3 run(s), 0 invariant violation(s), 0 soft-lock(s).
- Explorer Level 1: coverage 100%, 2 floor block(s) never reached, 0 stuck spot(s).
Kid personas (one per chosen bracket; slower reactions and shakier aim for younger brackets):
<table header-row="true" fit-page-width="true">
	<tr><td>Bracket</td><td>Level</td><td>Win rate</td><td>Median time to win</td><td>Fails / run</td><td>Retry rate</td><td>Stuck / run</td><td>Top stuck spots</td><td>Verdict</td></tr>
	<tr><td>5-7</td><td>Iteration 2 (Level 1)</td><td>100%</td><td>54.0s</td><td>0.33</td><td>25%</td><td>0.67</td><td>–</td><td><span color="green">**PASS**</span> ok: median time to win 54s within 5–10 min session, win rate 100%</td></tr>
</table>
- Frame rate at real speed with the CPU 4× slower (tablet-like, software WebGL): 37.6 fps, p95 frame 66.6 ms → ok.
- Heatmaps (local): `heatmap-explorer-level-1.png`, `heatmap-kids-5-7-level-1.png`.
## Comparison with popular kids' games
Comparable games, **picked by Claude for this run** (no Tester profile):
- **PBS KIDS mazes**: Onboarding style, spoken instructions, idle hints, and failure tone for a pre-reading 5-7 audience (Same core genre (character-led simple maze) but built specifically for pre-readers with full voice-over and idle hints — directly targets mazle's biggest flagged gaps (no audio, no idle-stuck hint, text-only controls panel).) · profile source: general-knowledge-not-played
- **ABCya logic games (maze and path puzzles)**: Grade/age-banded difficulty structure and instruction wording length (Same genre (path/maze puzzles) explicitly organized by school grade with short audio+text instructions, useful to benchmark mazle's 25-word controls panel and single-level, no-ramp structure against a graded difficulty model.) · profile source: general-knowledge-not-played
- **Monument Valley**: Wordless onboarding and no-fail, affordance-driven design (Not a kids-marketed game but the reference genre's best example of teaching a 3D path-finding game with zero reading required and no punishing fail state, contrasting with mazle's text-heavy controls overlay and spike-reset failure.) · profile source: general-knowledge-not-played
- **A Maze Race**: Maze-size progression and multi-level ramp versus a single fixed maze (Same core maze-navigation genre and web-playable like mazle, but structured as a sequence of growing mazes — useful contrast since mazle currently has only one level with no difficulty ramp beyond it.) · profile source: general-knowledge-not-played
Mazle already nails the fastest-win fundamentals for this genre — a single clear goal, instant low-cost retry, and a calm non-scary hazard shown by shape not color — but it is the only comparable game here with zero audio and a text-only, 25-word onboarding panel, both of which directly block pre-readers in the 5-7 bracket and fail the accessibility/usability checks (R16, idle-hint target, 5-word max). The highest-leverage fixes are small and fit a lightweight three.js game: a 3-6 word spoken instruction, a visible pause/mute/quit icon, an idle-stuck hint, and trimming the controls panel to icons. Lower-priority polish — a second/third maze for a difficulty ramp, a star on finish, and hiding the debug FPS/Position overlay — would round things out once the audio and reading gaps are closed.
Ranked by how much it matters for the chosen brackets:
1. **[HIGH] onboarding** (vs PBS KIDS mazes, ABCya logic games (maze and path puzzles); 5-7)
	- They do: PBS KIDS has a known character speak the goal aloud with a replay-voice button so nothing depends on reading; ABCya pairs a handful of words with audio narration scaled to grade level.
	- We do: Level 1 opens straight into play with a 25-word text-only controls overlay (WASD/arrows, strafe, mouse look, touch drag zones) that a 5-7 year old needs read to them, and there is no audio at all.
	- Suggestion: Add one speechSynthesis/WebAudio line, e.g. "Use the arrows, find the door!" (5 words), played once when Level 1 starts, with a small speaker-icon button to replay it, and shrink the on-screen text to match.
2. **[HIGH] usability** (vs PBS KIDS mazes, ABCya logic games (maze and path puzzles); 5-7)
	- They do: Both are built so a child can always get back out or replay instructions without help — PBS KIDS lets kids replay voice lines, and neither traps a child on the play screen.
	- We do: The playing screen has no visible pause/mute/quit control at all (automatic check: rule R16 fail); only developer debug panels are shown.
	- Suggestion: Add one icon-only button (top corner, \~48px touch target, no text) that pauses and offers "Home"/"Play again", satisfying R16 without adding any reading burden.
3. **[HIGH] usability** (vs PBS KIDS mazes; 5-7)
	- They do: PBS KIDS shows an idle hint — a nudge, glow, or voice line — if a child pauses too long, tuned for younger players.
	- We do: Automatic checks flag no in-play hint when stuck; a 60s+ idle period currently triggers nothing, versus the ≤20s target for this bracket.
	- Suggestion: After \~15s of no movement, glow or arrow-highlight the next correct corridor (reusing the maze solver already used by the bot), optionally paired with a short "this way!" audio line.
4. **[HIGH] accessibility** (vs ABCya logic games (maze and path puzzles), PBS KIDS mazes; 5-7)
	- They do: ABCya's Pre-K/K puzzles keep on-screen text to a handful of words backed by audio; PBS KIDS needs no reading at all.
	- We do: The controls panel is a 25-word block, five times the 5-word max for this bracket, shown as a permanent overlay for the whole level.
	- Suggestion: Replace the WASD/arrow text with 2-3 simple drag-direction icons (e.g. a hand-drag glyph over screen-left, an eye/look glyph over screen-right) and drop the keyboard-key text for the touch path used by this bracket.
5. **[MEDIUM] art and audio** (vs PBS KIDS mazes, ABCya logic games (maze and path puzzles); 5-7)
	- They do: Both use continuous light music/sound effects and voice-over throughout play, plus a cheer sound on success.
	- We do: 0 audio files, no WebAudio, no speechSynthesis — completely silent, including on the spike hit and the "You found the way out!" win screen.
	- Suggestion: Add two short WebAudio cues: a soft "boop" on spike contact paired with the existing instant reset, and a 1-2s cheer/chime when the door is reached on the win screen.
6. **[MEDIUM] difficulty curve** (vs A Maze Race; 5-7)
	- They do: A Maze Race ramps maze size gradually across many levels, each finishable in 1-3 minutes, giving kids repeated wins with rising challenge.
	- We do: Only one 29x29 maze exists (34-cell solution, 8 dead ends); kid-persona runs already win 100% in a median 53.95s with nowhere to go afterward.
	- Suggestion: Reuse mazeCarver.js/levels.js to generate 2-3 smaller follow-on mazes (e.g. 11x11, 15x15, 21x21) as Levels 2-3, keeping the same single-hazard rule, so a session has a natural next step instead of stopping after one level.
7. **[MEDIUM] goals and rewards** (vs ABCya logic games (maze and path puzzles), PBS KIDS mazes; 5-7)
	- They do: ABCya gives a checkmark/cheer/brief animation and unlocks the next puzzle on completion; PBS KIDS sometimes awards stickers.
	- We do: Winning shows only the text "You found the way out!" and a "Play again" button — no stars, points, collectibles, or unlocks.
	- Suggestion: Award one star automatically on every finish (never scored on speed or mistakes) and show it on the win screen, rewarding finishing rather than perfection.
8. **[MEDIUM] onboarding** (vs Monument Valley, PBS KIDS mazes; 5-7)
	- They do: Monument Valley teaches entirely wordlessly via glowing, tappable handles; PBS KIDS uses a character that points or speaks instead of showing text.
	- We do: Onboarding relies solely on a static 25-word text overlay rather than any in-play demonstration of the drag-to-move gesture.
	- Suggestion: On Level 1 only, play a 2-second animated hand/arrow glyph over the first corridor demonstrating the drag gesture before input is required, then fade it out.
9. **[LOW] accessibility** (vs PBS KIDS mazes; 5-7)
	- They do: PBS KIDS uses large touch targets and standard mobile-friendly viewport behavior that doesn't fight a parent trying to help.
	- We do: The page's meta-viewport disables pinch-zoom (axe moderate warning), preventing a parent from zooming in to help a child with any remaining text.
	- Suggestion: Remove user-scalable=no / maximum-scale=1 from the viewport meta tag so pinch-zoom works normally.
10. **[LOW] usability** (vs PBS KIDS mazes, ABCya logic games (maze and path puzzles); 5-7)
	- They do: Both show only child-relevant UI on the play screen (goal/progress), with no developer instrumentation visible to the player.
	- We do: A persistent debug FPS/Position box stays on screen alongside the controls and level-name panels, adding visual clutter with no value to a young player.
	- Suggestion: Gate the FPS/Position debug box behind a ?debug=1 query flag so it only appears for developers and the play screen stays uncluttered for kids.
- Kid-game patterns present: Clear goal; Instant retry; Natural stopping points; Forgiving/non-scary failure design (hazard shown by shape not color).
- Patterns missing: Sound on every tap / celebration on every success; Hints when stuck; Guide character; Show, don't tell (onboarding by doing); Collectibles and stars; Gentle difficulty ramp / natural progression across levels; Forgiving input.
## Key screenshots
8 screenshot(s), attached below.
[[screenshot: keyshots/playing-walk.png]]
`keyshots/playing-walk.png`: R16 Kids always have control: Claude fail
[[screenshot: keyshots/menu-start.png]]
`keyshots/menu-start.png`: menu: Initial view when Level 1 opens (Mazle has no menu; this is the first screen a child sees, with the controls help and level name).
[[screenshot: keyshots/failing-spike.png]]
`keyshots/failing-spike.png`: failing: Failing: right after touching the spike. The game sends the player back to the start and shows a message.
[[screenshot: keyshots/winning-escaped.png]]
`keyshots/winning-escaped.png`: winning: Winning: the escaped screen after reaching the door.
[[screenshot: level-1-load.png]]
`level-1-load.png`: spoken-instructions (5-7): No audio at all, so no spoken instructions (required for 5-7)
[[screenshot: heatmap-kids-5-7-level-1.png]]
`heatmap-kids-5-7-level-1.png`: heatmap: where the 5-7 kid persona spent time
[[screenshot: keyshots/playing-spike-ahead.png]]
`keyshots/playing-spike-ahead.png`: playing: Playing: standing a few cells from the floor spike hazard, looking at it.
[[screenshot: keyshots/failing-spike-later.png]]
`keyshots/failing-spike-later.png`: failing: Failing: one second after the spike, still at the start with the message.
## Local files
Videos and full outputs stay on the build machine; they are not uploaded.
- Run directory: `tools/playbot/out/mazle/2026-09-27T18-28-17-670Z-review`
- Solver video: `tools/playbot/out/mazle/2026-09-27T18-28-17-670Z-review/video/solver.webm`
- `smoke.json`
- `checks.json`
- `play.json`
- `claude.json`
- `compare.json`
- `plan.md`
