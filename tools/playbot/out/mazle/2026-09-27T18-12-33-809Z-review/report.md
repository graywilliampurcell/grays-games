# Tester report — 2026-09-27 · Mazle
## Needs a human decision {color="orange"}
- [ ] **R16 Kids always have control**: Claude says <span color="red">**FAIL**</span>. The playing screen (e.g. playing-walk.png) shows only an FPS/position readout and a controls help box, with no visible pause, mute or quit/home button anywhere during play, matching the automatic pause-mute-quit check failure; failing itself only costs a little progress (back to level start), which is fine.
	Fingerprint `0b08429f7156`, screenshot `keyshots/playing-walk.png`. Decide with:
	`node tools/playbot/bin/playbot.js decide mazle tools/playbot/out/mazle/2026-09-27T18-12-33-809Z-review/claude.json 0b08429f7156 <pass|warn|fail|ignore> --note "why"`
A saved decision is reused by later runs (tools/playbot/judgments/), so the same question is not asked again.
## Summary
<callout icon="⛔" color="red_bg">
	**Overall: FAIL** (strictest chosen bracket: 5-7). Brackets: 5-7 Early readers = **FAIL**.
</callout>
- FAIL: always-true rule R16 (Kids always have control) broken per Claude (until a person clears it)
- **5-7**: FAIL: automatic checks: 1 fail, 4 warn; WARN: Claude rubric (advisory): 3 check(s) not met
- Brackets chosen by: user (--brackets). Tester profile: none (brackets asked at review time; comparables picked by Claude).
- Policy: the strictest chosen bracket sets the result; an always-true rule fail is a FAIL; AI verdicts are advisory (at most WARN) except on the always-true rules, where a Claude fail holds until a person clears it.
- Steps: smoke ok (2s), checks ok (44s), play ok (49s), video ok (18s), judge-rules ok (59s), compare ok.
- Smoke test: passed (1 URL(s), hook ready).
- Claude judge: claude-sonnet-5, 53s, $0.396 (rules + rubric); comparison $0.276.
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
	<tr color="red_bg"><td>**R16** Kids always have control</td><td><span color="orange">**WARN**</span></td><td><span color="red">**FAIL**</span></td><td>**FAIL**</td><td>auto: Playing screen has no visible pause, mute, quit controls · Claude: The playing screen (e.g. playing-walk.png) shows only an FPS/position readout and a controls help box, with no visible pause, mute or quit/home button anywhere during play, matching the automatic pau… · screenshot keyshots/playing-walk.png</td></tr>
</table>
## Age brackets
- **5-7 Early readers**: 5 words or fewer per instruction plus audio, simple controls, soft failing, 5–10 min sessions.
Cells: automatic result / AI (advisory) result. Rubric numbers are starting points we tune after watching Gray play.
<table header-row="true" header-column="true" fit-page-width="true">
	<tr><td>Check</td><td>5-7</td></tr>
	<tr><td>Smallest touch target</td><td>auto <span color="gray">**INFO**</span></td></tr>
	<tr><td>Reading needed</td><td>auto <span color="orange">**WARN**</span> 3 instruction(s) over 5 words; longest "Controls: W/↑ Forward \| S/↓ Back A/← Strafe Left \| D/→ Strafe Right M…<br>AI <span color="orange">**WARN**</span> The always-visible Controls panel is \~24 words ('W/↑ Forward \| S/↓ Back A/← Strafe Left \| D/→ Strafe Right Mo…</td></tr>
	<tr><td>Spoken, replayable instructions</td><td>auto <span color="red">**FAIL**</span> No audio at all, so no spoken instructions (required for 5-7)<br>AI <span color="red">**FAIL**</span> Source report shows 0 audio files, no speechSynthesis, and no WebAudio use, so none of the on-screen text (co…</td></tr>
	<tr><td>Time pressure</td><td>AI <span color="green">**PASS**</span></td></tr>
	<tr><td>Failing</td><td>AI <span color="green">**PASS**</span></td></tr>
	<tr><td>Hint when stuck</td><td>auto <span color="orange">**WARN**</span> No text/event hint within 60 s idle (want ≤ 20 s)</td></tr>
	<tr><td>Taps until playing</td><td>auto <span color="green">**PASS**</span></td></tr>
	<tr><td>Things on screen at once</td><td>AI <span color="green">**PASS**</span></td></tr>
	<tr><td>Scariness</td><td>AI <span color="green">**PASS**</span></td></tr>
	<tr><td>Contrast</td><td>AI <span color="orange">**WARN**</span> Most text (white/light-grey on solid dark HUD boxes, dark 'Level 1' text on sky blue, white message text on r…</td></tr>
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
- Frame rate at real speed with the CPU 4× slower (tablet-like, software WebGL): 38.5 fps, p95 frame 66.7 ms → ok.
- Heatmaps (local): `heatmap-explorer-level-1.png`, `heatmap-kids-5-7-level-1.png`.
## Comparison with popular kids' games
Comparable games, **picked by Claude for this run** (no Tester profile):
- **PBS KIDS mazes**: Onboarding style (spoken goal + replay-voice vs. mazle's 25-word text box), idle hints, and how failure is handled for pre-readers (Same character-led simple-maze genre aimed squarely at the 5-7 bracket, and it does the exact things mazle's automatic checks flagged as missing: audio-first instructions and hints when idle) · profile source: general-knowledge-not-played
- **ABCya logic and path puzzles**: Grade-banded difficulty framing and instruction wording length against mazle's flat single-maze difficulty and 25-word Controls box (Directly comparable maze/path-puzzle genre with instructions and difficulty explicitly graded for early-elementary readers, useful for judging whether mazle's text is age-appropriate) · profile source: general-knowledge-not-played
- **Pac-Man**: Constant audio feedback on every action/pickup versus mazle's total silence, and pacing of danger feedback (Classic maze-chase game where sound reinforces every event; mazle has zero audio anywhere, making this the sharpest reference point for what audio feedback could add (chase tension itself is not a model to copy for 5-7)) · profile source: general-knowledge-not-played
- **Monument Valley**: Wordless onboarding, affordance highlighting, and no-fail/low-stakes design versus mazle's reading-dependent instructions and instant reset-to-start on hazard hit (Best-in-class example of teaching a spatial navigation puzzle without any reading, which is precisely the gap the automatic checks found in mazle for this age bracket) · profile source: general-knowledge-not-played
Mazle passes the low-stakes/no-monetization bar cleanly for 5-7 year olds, but the automatic checks are right that it's built like a tool for testing, not a game for pre-readers: a 25-word text-only Controls box, total silence, no hints when a child gets lost, and no on-screen pause/mute/quit make it inaccessible without adult reading help. PBS KIDS mazes and Monument Valley both show that the same maze-navigation goal can be taught and supported with zero required reading, and Pac-Man shows how much a few short sounds add to a currently-silent game. Fixing spoken onboarding, idle hints, basic sound, and a visible exit control would close most of the gap without changing mazle's core loop or art style.
Ranked by how much it matters for the chosen brackets:
1. **[HIGH] onboarding** (vs PBS KIDS mazes, Monument Valley; 5-7)
	- They do: PBS KIDS mazes has a known character speak the goal aloud with a replay-voice button so nothing depends on reading; Monument Valley teaches the whole navigation mechanic wordlessly, with glowing handles showing what to do, so zero words appear before the child's first input.
	- We do: Mazle opens straight into play with an always-on 25-word Controls text box (5x over the 5-word/5-7 reading threshold) and no spoken alternative; 0 taps before play, but the instructions require reading, which the automatic checks flagged as a fail for this bracket.
	- Suggestion: Add a 3-4 word spoken line via Web Speech API's speechSynthesis at level start (e.g. 'Find the door!'), and shrink the Controls box to arrow-key icons instead of sentences so it doesn't require reading at all.
2. **[HIGH] usability** (vs PBS KIDS mazes; 5-7)
	- They do: PBS KIDS mazes gives a gentle nudge (voice line or highlight) if a child pauses too long, built specifically for pre-readers who get stuck easily.
	- We do: Mazle's automatic checks found no visible hint within 20s of idling and a hard fail at 60s+; the kid-persona runs had 2 stuck episodes on average and one run took 168s to finish versus a 22.7s solver time.
	- Suggestion: After \~15s with no forward progress, briefly pulse or glow the wall opening that leads toward the door so the child has a visual nudge without any text.
3. **[HIGH] usability** (vs ABCya logic and path puzzles, Monument Valley; 5-7)
	- They do: ABCya breaks its content into short, discrete puzzles with clear stopping points between them, and Monument Valley gives each chapter a natural stopping point, so a child (or parent) always has an obvious place to step away.
	- We do: Mazle is a single continuous level with no pause, mute, or quit control anywhere on the playing screen, which the automatic checks flagged directly.
	- Suggestion: Add one small, always-visible icon button (no text) in a corner that pauses the maze and returns to the start/replay screen, so a parent or child can exit mid-level without losing track of what's happening.
4. **[HIGH] art and audio** (vs Pac-Man, PBS KIDS mazes; 5-7)
	- They do: Pac-Man plays a distinct sound on every dot eaten and every ghost event, and PBS KIDS mazes has full voice-over and music throughout, so feedback is constant and audio-first.
	- We do: Mazle has 0 audio files and no WebAudio or speechSynthesis anywhere in the source; the spike hit is a silent instant reset with only a red text toast.
	- Suggestion: Add 2-3 short oscillator-based WebAudio tones with no external files needed: a soft thud when the spike is hit and a cheerful chime when the door is reached.
5. **[MEDIUM] goals and rewards** (vs ABCya logic and path puzzles, PBS KIDS mazes; 5-7)
	- They do: ABCya gives level progress plus simple praise on completion, and PBS KIDS mazes has the character celebrate and sometimes awards stickers or collectibles.
	- We do: Mazle's only reward is a text screen reading 'You found the way out!' with a Play again button — no stars, collectibles, or celebration animation.
	- Suggestion: Add a 1-2 second celebration on finish (the door swings open, a small confetti burst, a cheerful chime) before showing the Play again button.
6. **[MEDIUM] difficulty curve** (vs ABCya logic and path puzzles, PBS KIDS mazes; 5-7)
	- They do: ABCya explicitly grades difficulty by age/grade band, and PBS KIDS mazes keeps paths very short and gentle so kids almost never get lost.
	- We do: Mazle's 7x7-cell maze is flat and untuned for age: the solver finishes in 22.7s, but the 5-7 persona ranged 45-168s with 2 stuck episodes, so nearly all the difficulty comes from getting lost rather than the single hazard.
	- Suggestion: For the 5-7 bracket, shrink the maze to roughly 4x4-5x5 cells, or lay a faint trail of collectible dots along the correct path so a lost child has a visible thread to follow.
7. **[MEDIUM] accessibility** (vs PBS KIDS mazes, ABCya logic and path puzzles; 5-7)
	- They do: PBS KIDS mazes and ABCya use large, solid-background UI elements built for early readers, so buttons stay high-contrast regardless of the scene behind them.
	- We do: The automatic check flagged mazle's brown 'Play again' button as borderline contrast because it sits directly over the shifting 3D background.
	- Suggestion: Give the 'Play again' button a solid high-contrast panel (e.g. a white or dark rounded rectangle) behind it so its contrast never depends on the 3D scene.
8. **[LOW] game feel** (vs Pac-Man, Monument Valley; 5-7)
	- They do: Pac-Man and Monument Valley both give tight, instant feedback (sound and/or motion) on every relevant event, with no perceptible jank.
	- We do: Mazle runs at 38.5 FPS average on a software renderer with p95 frame time of 66.7ms and a 550ms max spike, and the spike hit has no juice at all — just an instant reset and a text toast.
	- Suggestion: Add a brief screen-flash plus the new hit sound on spike contact, and check whether hardware rendering can be forced (avoiding the SwiftShader fallback) to cut the worst frame spikes.
9. **[LOW] ads and purchases** (vs ABCya logic and path puzzles, Monument Valley; 5-7)
	- They do: ABCya shows ads on its free tier (removable only via paid subscription), while Monument Valley is paid up-front but still ad-free.
	- We do: Mazle has no ads, no IAP prompts, and confirmed same-origin-only network traffic with no analytics or trackers.
	- Suggestion: Keep mazle ad- and tracker-free as features are added; if analytics are ever needed, log same-origin only rather than adding a third-party SDK.
- Kid-game patterns present: Instant retry; Natural stopping points.
- Patterns missing: Show, don't tell (onboarding by doing); Hints when stuck; Sound on every tap / celebration on every success; Collectibles and stars; Guide character; Gentle difficulty ramp; Juice / game feel.
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
- Run directory: `tools/playbot/out/mazle/2026-09-27T18-12-33-809Z-review`
- Solver video: `tools/playbot/out/mazle/2026-09-27T18-12-33-809Z-review/video/solver.webm`
- `smoke.json`
- `checks.json`
- `play.json`
- `claude.json`
- `compare.json`
- `report.json`
