# Rolly Bally — Development Plan

> Mirror of the Notion page "Plan — Rolly Bally v1 (implementer plan)" (Research / 2026-09-27-rolly-bally).
> Approved by JP 2026-09-27 with these resolutions: device = iPad (Safari); one branch (`master`), GitHub Actions builds and deploys `docs/` + the built game, Pages source = Actions; race against 2–3 AI balls; sound ON by default; pin a current three.js release; bright primary-color art; the Mazle `build-playtest.yml` is folded into `deploy-site.yml`.

A single-player, browser-based rolling-ball game for a 4-year-old who loves Going Balls but finds its later levels too hard. Two modes: **Playground** (generate a blocky world and roll around exploring) and **Race** (a configurable series of Going-Balls-style tracks with arcade-racer presentation).

Lives in `github.com/graywilliampurcell/grays-games`: source in `src/rolly-bally/` (Vite app, like the Mazle playtest). A GitHub Actions workflow builds it and deploys the whole site (`docs/` + the built game at `games/rolly-bally/`) to GitHub Pages. One branch (`master`); no build output is committed; no deploy branch.

Primary device: **iPad (Safari)**, landscape, touch-first. All numbers below are starting values to tune in playtests with Gray, not requirements.

---

## 1. Design pillars
1. **Never punishing.** No lives, no timers that end a run, no ads, no game over. Falling off just puts you back on the track at the last checkpoint with a fun "boing."
2. **Playable without reading.** Every screen works with big icons and pictures; text is decoration for grown-ups.
3. **Difficulty is a dial, not a wall.** A parent sets the level; level 1 is impossible to fall off; level 5 approaches real Going Balls.
4. **Going Balls feel.** Weighty ball, momentum, ramps that launch you, hammers that thump. Physics does the fun.
5. **Blocky world.** Minecraft-style voxel look, consistent with Mazle. Chunky, bright, readable at a glance.
6. **Always finish.** In Race the player always crosses the line and always gets a celebration; placement changes the trophy, not whether you get one.

## 2. Non-goals (v1)
Multiplayer, accounts, cloud save, ads, IAP, level editor, story, voice-over, more than two playground themes, mobile-native packaging.

---

## 3. Player experience

### 3.1 Home screen
Full-screen, landscape. Three big picture buttons: **Playground** (rolling hills icon), **Race** (checkered flag), **My Balls** (ball skin picker). A small gear in a corner opens the grown-up settings (long-press, 1 s, so Gray doesn't open it by accident): sound on/off, reset progress (with confirm), version.

### 3.2 Controls (both modes)
- **Touch (primary):** touch anywhere and drag — a relative virtual joystick appears under the finger. Drag direction = steering force. Release = coast.
- **Keyboard:** WASD / arrow keys. **Gamepad:** left stick (Gamepad API).
- **Race auto-roll:** at difficulty 1–3 the ball is driven forward automatically (Going Balls' "autostart" idea); the player only steers left/right and can push forward for a speed boost or pull back to slow. At 4–5 forward is fully manual.
- Camera: third-person chase, above and behind, smoothed. In Race it follows the track direction; in Playground it follows the ball's velocity direction with slow auto-orbit, plus optional two-finger drag to look around.
- Kid-proofing: `touch-action: none`, no pull-to-refresh, no pinch zoom, orientation hint if portrait. iPad: `apple-mobile-web-app-capable` + icon meta so "Add to Home Screen" gives a full-screen, no-Safari-chrome launch; Safari has no fullscreen API on iPhone/iPad so this is the fullscreen path.

### 3.3 Playground mode
1. **Setup screen** (all picture chips, tap to toggle; any combination is valid):
   - **Size:** small / medium / large (64², 128², 192² blocks)
   - **World:** grass / snow (v1: two themes)
   - **Bumpiness:** flat / hilly / mountains
   - **Stuff** (multi-select): ramps, jumps, bounce pads, tunnels, spinning bumpers
   - **Stars:** none / some / lots
   - **Dice button** — re-rolls the seed; the seed shows as 4 emoji so a favorite world can be found again.
   - **Go!**
2. **Play:** spawn on a flat pad in the middle. Roll anywhere. Stars pop and sparkle when collected; a star counter with no goal. Falling off the world edge or into a hole → fade, respawn at the nearest safe pad. No end state; **Home** button (top-left, small) with a 1 s long-press.
3. **Generation** (seeded, deterministic): value-noise heightmap quantized to 0.5-block steps so it looks voxel but rolls smoothly; slopes steeper than one step get auto-ramp wedges; features are placed on flat spots; a low block wall or a soft edge around the border; guaranteed flat spawn pad and reachable feature placement (flood-fill check).

### 3.4 Race mode
Arcade-racer presentation (Need-for-Speed-style energy, not simulation): countdown **3-2-1-GO**, a big position badge (1st/2nd/3rd with medal colors), boost pads with a whoosh, checkpoint gates, finish banner, confetti, then a results screen.
1. **Setup screen:** **Difficulty** 1–5 (five big buttons with a picture of what the track looks like) and **Races** 1 / 3 / 5 / 10 levels. **Go!**
2. **A race:** one generated Going-Balls-style track. Player + 2–3 AI balls start on a wide pad. Player always starts in front. Checkpoints every ~20 m; falling off → respawn at the last checkpoint after 1 s, opponents don't wait but do slow down (see AI). Cross the finish → placement fanfare (gold/silver/bronze; 4th still gets a ribbon), then **Next race** starts after a tap.
3. **Series results:** trophy screen showing medals per race and a total cup. Tap → Home. Series results are saved (best cups per difficulty) and shown on the Race setup screen.
4. **AI opponents:** kinematic balls that follow the track's center spline at a target speed with a little lateral wobble; they roll through hazards on a scripted safe path (they cannot fall). **Rubber-banding:** if an opponent is more than `lead_cap` ahead of the player it slows to match; if the player is far ahead it speeds up mildly. This keeps the race close without ever making the player lose by a mile. Target: player finishes 1st ~60% of the time at each difficulty's intended skill; tune in playtests.

### 3.5 Difficulty ladder (starting values; 1 unit = 1 m, ball radius 0.5)

| Level | Name | Path width | Guard rails | Gaps | Hazards | Speed cap | Auto-roll | Opponents | Track length |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Rolling Hills | 8 | full length | none | none | 6 m/s | yes | 2 (slower than player) | 120 m |
| 2 | Bumpy Road | 6 | full | none | static bumpers | 7 | yes | 2 | 150 m |
| 3 | Sky Road | 5 | on curves only | small, always bridged | slow hammers | 8 | yes | 3 | 180 m |
| 4 | Hammer Time | 4 | none | small (jump or bridge) | hammers, wrecking balls | 10 | no | 3 | 220 m |
| 5 | Going Big | 3 | none | real jumps, boost pad before | hammers, wrecking balls, spinners, moving platforms | 12 | no | 3 | 260 m |

Checkpoint spacing 20 m at all levels. Opponent base speed = 85% of the player's speed cap.

### 3.6 Track piece kit (Race)
Data-driven catalog; each piece has an entry/exit transform, a center spline, physics colliders and a voxel mesh. v1 pieces:
straight, gentle curve L/R, sharp curve L/R, uphill ramp, downhill ramp, launch ramp + landing, gap (bridged / open), narrow beam, wide pad (start), finish gate, checkpoint gate, boost pad, static bumper, swinging hammer (kinematic, sinusoidal), wrecking ball (kinematic pendulum across the path), spinner (rotating bar), moving platform (slides sideways across a gap).

The generator picks pieces from the difficulty's allow-list, chains them with weighted randomness, enforces rules (no two hazards in a row at ≤3, a checkpoint before every gap, a launch ramp only with a boost pad before it at 5), and validates that the AI path is continuous.

### 3.7 Ball skins
Start with 6 blocky balls (solid colors, a soccer pattern, a striped one). Every Race series completed unlocks one; Playground stars unlock one per 50. No currency, no purchases.

---

## 4. Technical specification

### 4.1 Stack
- **three.js** (current release, pinned in this game's own `package.json`)
- **Rapier** `@dimforge/rapier3d-compat` — fixed timestep 1/60 s, up to 3 sub-steps to catch up; ball is a dynamic sphere (mass 1, friction 0.8, restitution 0.2 — tune), track pieces are fixed colliders (cuboids/trimeshes), hazards are kinematic position-based bodies, terrain is a heightfield collider.
- **Vite** build with `base: './'`, output to `src/rolly-bally/dist/` (git-ignored). Deployed by GitHub Actions — see 4.6.
- **Vitest** for pure logic (generators, difficulty tables, PRNG, spline math).
- Saved state in `localStorage` under one key `rolly-bally:v1` (settings, unlocked skins, best cups, star totals). Never cleared except from the grown-up menu.

### 4.2 Repo layout
```
src/rolly-bally/
  index.html
  package.json  vite.config.js  README.md  .gitignore
  src/
    main.js                # boot, screen router
    core/
      Loop.js              # rAF loop, fixed-step accumulator
      Physics.js           # Rapier world wrapper, body registry
      Input.js             # touch joystick, keyboard, gamepad → {x, y}
      ChaseCamera.js
      Audio.js             # tiny synthesized sfx via WebAudio (no assets to start)
      Save.js              # localStorage
      Rng.js               # mulberry32 + string seed → emoji seed
    ball/
      Ball.js              # body + mesh + controller (auto-roll, speed cap)
      skins.js
    track/
      pieces/              # one module per piece: geometry, colliders, spline
      Catalog.js
      TrackBuilder.js      # chain pieces → meshes + bodies + spline
      TrackGenerator.js    # difficulty rules → piece list (seeded)
      hazards/             # Hammer, WreckingBall, Spinner, MovingPlatform
    race/
      RaceMode.js  AiRacer.js  RaceHud.js  Results.js  difficulty.js
    playground/
      TerrainGenerator.js  PlaygroundMode.js  Features.js  Stars.js
    ui/
      screens/ Home.js RaceSetup.js PlaygroundSetup.js Pause.js
      icons/               # inline SVG
    voxel/
      BlockMesh.js         # InstancedMesh block renderer, palette per theme
  test/                    # vitest: generators, rules, determinism
docs/games/rolly-bally/PLAN.md           # this document
docs/index.html                          # add "Play Rolly Bally 🎱" link
.github/workflows/deploy-site.yml        # builds the game, assembles the site, deploys to Pages (4.6)
```

### 4.3 Rendering
- All blocks via `InstancedMesh` per material (aim: < 50 draw calls in Playground large, < 30 in Race).
- Flat-shaded, palette-based materials; no textures in v1 (voxel look comes from geometry + per-face shade).
- **Target 60 fps on iPad Safari**; `renderer.setPixelRatio(min(devicePixelRatio, 2))`; shadows off by default.

### 4.4 Determinism & seeds
- Every generated thing (track, terrain, feature placement, AI wobble) comes from `Rng(seed)`; the physics step is fixed, so a seed reproduces a track exactly. Seeds are shown as 4 emoji and accepted in the URL (`?mode=race&d=3&n=5&seed=…`) for quick repro.

### 4.5 Debug tools (hidden behind `?debug=1`)
- Piece gallery page: every track piece rendered alone with its spline and colliders.
- Overlays: fps, draw calls, ball speed, current piece, AI positions.
- Hotkeys: `R` respawn, `N` next piece, `G` regenerate with new seed.

### 4.6 Build & deploy (GitHub Actions)
One-time repo setting: **Settings → Pages → Source: GitHub Actions**. After that the site is published only by the workflow, so it must run on every push to `master`.

`.github/workflows/deploy-site.yml`:
1. `on: push` to `master` + `workflow_dispatch` (+ `pull_request`: build & test only); permissions `pages: write`, `id-token: write`.
2. Checkout; `actions/setup-node` (Node 20, npm cache).
3. `npm ci && npm test && npm run build` in `src/rolly-bally` (a failing test blocks deploy).
4. Assemble: `mkdir _site && cp -r docs/. _site/ && cp -r src/rolly-bally/dist/. _site/games/rolly-bally/`.
5. `actions/upload-pages-artifact` (path `_site`) → `actions/deploy-pages`.

The Mazle playtest (`src/playtest`) is folded in as a best-effort step (it must never block the site deploy) published at `games/mazle/playtest/`; `build-playtest.yml` is deleted.

---

## 5. Milestones
| # | Milestone | Scope | Done when |
|---|---|---|---|
| M0 | Scaffold & deploy | `src/rolly-bally` with three + Rapier + Vite; ball rolls on a flat pad; touch/keys/gamepad; `deploy-site.yml`; link on `docs/index.html` | Existing games still load at their old URLs; Rolly Bally opens on the iPad with the ball rolling under a finger |
| M1 | Ball feel & camera | Tuned ball, chase camera, respawn on fall, hand-built test track (straight, curve, ramp, narrow, gap); debug overlays | Gray can steer a width-8 railed path unaided |
| M2 | Track kit | Piece catalog + builder + all v1 hazards; piece gallery page; vitest for catalog invariants | Every piece renders, collides and has a valid spline; hammers/wrecking balls move the ball plausibly |
| M3 | Race mode | Generator with difficulty rules, AI racers with rubber-banding, HUD, countdown, checkpoints, results, series, Race setup screen, save best cups | Gray completes a 3-race series at difficulty 1 and 2; difficulty 5 feels like Going Balls |
| M4 | Playground mode | Terrain generator, setup screen, features, stars, respawn, emoji seeds | Gray explores for 10 min without help or getting stuck |
| M5 | Home, skins, persistence, grown-up menu | All screens navigable by icons; skins + unlocks; reset progress | Full loop from Home works with no keyboard |
| M6 | Polish | Synth sfx, particles, snow theme, celebrations, small fixes | Gray asks to play it again |

## 6. Testing
- **Unit (vitest):** PRNG determinism; generator produces the same piece list for a seed; every generated track obeys its difficulty rules; terrain flood-fill reaches all features; difficulty table sanity.
- **Manual checklist per milestone:** phone, tablet, laptop; touch/keys/gamepad; rotate orientation; reload keeps progress; no way to reach a text-only dead end.

## 7. Risks
- **Rapier WASM load** adds ~1–2 MB and an async init; show a rolling-ball loader.
- **Camera on narrow sections** is Going Balls' own weak spot.
- **Terrain heightfield vs. voxel steps:** if 0.5-block steps feel bumpy, fall back to a smooth heightfield with a voxel-looking shell mesh.
