# Rolly Bally — architecture contract

The spec is `docs/games/rolly-bally/PLAN.md`. This file is how the parallel
agents' code fits together without talking to each other. If you need to
break a rule here, don't: work around it in your own files and tell the
orchestrator.

## 1. Ownership

| Area | Owner | Files |
|---|---|---|
| Core / shared (stable, don't edit) | Core (orchestrator after M1) | `src/core/*`, `src/ball/Ball.js`, `src/voxel/*`, `src/app/*`, `src/debug/*`, `src/main.js`, `src/test-track/*`, `index.html`, `vite.config.js`, `package.json` |
| Race | **Race agent** | `src/track/**` (pieces, `Catalog.js`, `TrackBuilder.js`, `TrackGenerator.js`, `hazards/`), `src/race/**` (`RaceMode.js`, `AiRacer.js`, `RaceHud.js`, `Results.js`, `difficulty.js`), `src/track-gallery/**` (`GalleryMode.js`), tests `test/track-*.test.js`, `test/race-*.test.js` |
| Playground | **Playground agent** | `src/playground/**` (`PlaygroundMode.js`, `TerrainGenerator.js`, `Features.js`, `Stars.js`), tests `test/playground-*.test.js` |
| UI | **UI agent** | `src/ui/**` (screens, icons, `styles.css`, unlock/progress logic), `src/ball/skins.js`, `src/ball/skinData.js`, tests `test/ui-*.test.js` |

Placeholders you replace: `src/race/RaceMode.js`, `src/playground/PlaygroundMode.js`,
`src/track-gallery/GalleryMode.js` (currently re-export the test track), and
`src/ui/screens/Home.js` + `src/ui/screens/index.js` (UI agent).

Need a new npm dependency? Don't add it; ask the orchestrator. Need a change
in a core file? Adapt in your own module and report it.

## 2. Boot and the `app` object

`src/main.js` awaits Rapier (`initRapier()`, behind the rolling-ball loader in
`index.html`), then builds one shared `app`:

```js
app = {
  save,     // Save          (src/core/Save.js)
  events,   // Events        (src/core/Events.js) app-wide event bus, see §7
  audio,    // Audio         (src/core/Audio.js)
  input,    // Input         (src/core/Input.js)
  debug,    // DebugOverlay  (src/debug/DebugOverlay.js)
  params,   // parseUrlParams(location.search): {debug, mode, config, raw}
  router,   // Router        (src/app/Router.js)
  game,     // Game          (src/app/Game.js) scene host
  version,  // package.json version string
}
```

Then: `router.register('play', ...)` (core), `registerScreens(router, app)` and
`startScreen(params)` from `src/ui/screens/index.js` (UI agent). If the URL has
`?mode=` (or `?gallery=1`) main goes straight to
`router.go('play', {mode, config, returnTo: 'home'})`.

With `?debug=1`, `window.rollyBally = app`.

DOM (index.html):

```
<canvas id="game">                 full-screen WebGL canvas
<div id="ui">
  <div id="mode-ui">               Game host puts each mode's HUD root here (ctx.ui)
  <div id="screen">                Router renders screens here (menus on top of the game)
<div id="loader">, <div id="rotate-hint">   boot + portrait hint (index.html only)
```

## 3. Router and screens

A screen is any object with:

```js
mount(root: HTMLElement, params: object, app) : void | Promise<void>
unmount() : void | Promise<void>
```

Register with a factory (fresh instance per visit):
`router.register('race-setup', () => new RaceSetupScreen())`.
Navigate with `router.go(name, params)` (returns a promise; navigations are serialized;
the previous screen is unmounted and `#screen` emptied first).

Screen names (UI agent registers all but `play`):

| name | params | owner |
|---|---|---|
| `home` | – | UI |
| `race-setup` | – | UI |
| `playground-setup` | – | UI |
| `skins` | – | UI ("My Balls") |
| `settings` | – | UI (grown-up menu, reached by 1 s long-press on the gear) |
| `play` | `{mode, config, returnTo?='home', returnParams?={}}` | core (`src/app/PlayScreen.js`) |

Starting a game from a setup screen:

```js
import { normalizeRaceConfig } from '../../app/configs.js';
app.router.go('play', { mode: 'race', config: normalizeRaceConfig({ difficulty, races, seed }), returnTo: 'race-setup' });
app.router.go('play', { mode: 'playground', config: normalizePlaygroundConfig({...}), returnTo: 'playground-setup' });
```

When the mode exits (Home button or `ctx.onExit()`), the play screen goes to
`returnTo` with `returnParams`. If a mode's `start()` throws, it falls back to `returnTo`/home.

Menu screens render a full-screen `<div class="rb-screen">` (opaque sky
background) into `root`. The `play` screen renders nothing; the canvas shows.

## 4. Modes

### 4.1 Registry

`src/app/modes.js` maps names to lazy imports; the module's **default export
is a class constructed with no arguments**:

```js
'test-track' → src/test-track/TestTrackMode.js
'race'       → src/race/RaceMode.js
'playground' → src/playground/PlaygroundMode.js
'gallery'    → src/track-gallery/GalleryMode.js
```

### 4.2 Interface

```js
export default class RaceMode {
  async start(ctx, config) {}   // build world, ball, HUD. Awaited before the loop starts.
  update(dt) {}                 // fixed 1/60 s step. Apply forces, move kinematics. DON'T step physics.
  postStep(dt) {}               // optional: after physics.step (read contacts/positions)
  render(alpha, frameDt) {}     // once per frame: interpolate meshes, update camera/HUD
  dispose() {}                  // remove YOUR listeners/timers/objects you created outside ctx
  // optional debug hooks (hotkeys with ?debug=1):
  respawn() {}                  // R
  nextPiece() {}                // N
  regenerate() {}               // G (new seed / rebuild)
}
```

Per fixed step the host does: `input.update(); mode.update(dt); physics.step(dt); mode.postStep?.(dt)`.
Per frame: `mode.render(alpha, frameDt); renderer.render(scene, camera); debug.frame()`.
Max 3 fixed steps per frame; backlog is dropped. Loop pauses when the tab is hidden.

### 4.3 `ctx`

Built fresh by `Game.runMode()` for each run:

```js
ctx = {
  THREE,               // the three.js namespace (same instance as `import * as THREE from 'three'`)
  renderer,            // THREE.WebGLRenderer (pixelRatio ≤ 2, shadows off, sRGB output)
  scene,               // fresh THREE.Scene per run, with default lights (hemi + sun) and sky/fog already applied
  camera,              // shared THREE.PerspectiveCamera (fov 60 landscape / 75 portrait, near 0.1, far 400)
  physics,             // fresh Physics (Rapier world) per run; host disposes it after dispose()
  input,               // shared Input; enabled while a mode runs
  audio,               // shared Audio
  save,                // shared Save (read freely; see §7 for what modes may write)
  events,              // shared app Events bus (§7)
  debug,               // DebugOverlay (no-op unless ?debug=1)
  router,              // Router (rarely needed; prefer ctx.onExit)
  params,              // parsed URL params ({debug, mode, config, raw})
  rng,                 // new Rng(config.seed): use it (or rng.fork('x')) for EVERYTHING generated
  ui,                  // HTMLElement (div.mode-ui) for this mode's HUD; host removes it on stop
  hud: { homeButton }, // the shared Home button already placed top-left in ctx.ui
  modeName,            // 'race' | 'playground' | ...
  config,              // normalized config (same object passed to start)
  onExit,              // () => void : leave the mode (idempotent)
}
```

Host cleanup after `mode.dispose()`: removes `ctx.ui`, disposes every
geometry/material/texture in `ctx.scene`, frees the physics world, resets input.
So modes only need to clean up things outside those (window listeners, timers,
rAFs, audio loops, cached textures).

`scene` sky: playground runs get `applySky(scene, config.theme)`, all others the
`'race'` palette. Override with `applySky(scene, palette, {near, far})` from `voxel/BlockMesh.js`.

## 5. Configs (`src/app/configs.js`)

Always pass configs through the normalizers (fill defaults, clamp, make a seed).

```js
// race
{ difficulty: 1|2|3|4|5, races: 1|3|5|10, seed: string,
  startRace?: 2..races }                     // only from the URL (?race=K); never from Race setup
// playground
{ size: 'small'|'medium'|'large',            // 64² / 128² / 192² blocks
  theme: 'grass'|'snow',
  bumpiness: 'flat'|'hilly'|'mountains',
  stuff: Array<'ramps'|'jumps'|'bouncePads'|'tunnels'|'bumpers'>,  // any subset, canonical order
  stars: 'none'|'some'|'lots',
  seed: string }
// test-track / gallery
{ seed: string, ...extra }                    // gallery also gets {piece} from ?piece=
```

Constants exported: `RACE_COUNTS, PLAYGROUND_SIZES, PLAYGROUND_THEMES,
PLAYGROUND_BUMPINESS, PLAYGROUND_STUFF, PLAYGROUND_STARS`.
Seeds are strings; the UI shows/rolls 4-emoji seeds (`randomEmojiSeed()`), the URL
may pass any string. `?mode=race&d=3&n=5&seed=…`,
`?mode=playground&size=&theme=&bump=&stuff=a,b&stars=&seed=…`, `?gallery=1&piece=hammer`.

Known deviation from plan §4.5: the piece gallery (`?gallery=1` / `?mode=gallery`)
and `?mode=test-track` open without `?debug=1`. They are harmless dev pages
(not reachable from any in-app button), and keeping them ungated keeps the
headless smoke/screenshot scripts simple. `?debug=1` still gates the overlay
and the R/N/G hotkeys.

Seeds in the UI: the Playground setup shows the current world code plus the
last 6 worlds played (`save.ui.recentWorlds`, tap to restore); the pause card
shows the running mode's seed; the Race trophy panel shows the series seed.
Race setup still rolls a fresh series seed per Go (not remembered).

## 6. HUD and CSS

- Mode HUD = DOM appended to `ctx.ui`. `#mode-ui` has `pointer-events: none`;
  `button`, `.ui-block` and `[data-ui]` inside it get `pointer-events: auto`, and
  Input ignores touches that START on those, so HUD buttons never steer.
  Non-interactive HUD (position badge, star counter, banners) should stay
  pointer-events none so dragging over them still steers.
- The Home button is added by the host (top-left, 72 px, 1 s hold with a filling
  ring). Don't add another. Hide it if needed: `ctx.hud.homeButton.hidden = true`.
  Holding it pauses the game (`Game.pause()`: no `update`/`render`, input off)
  and shows the UI's pause overlay (big 🏠 Home / ▶ Play). `ctx.onExit()` still
  leaves immediately.
- Kid-first: every control is an icon/picture; text is decoration only
  (`.rb-caption`). Touch targets ≥ 64 px (`--rb-touch-min`). No text-only dead ends.
- In-mode overlays (race results, series trophy) are DOM inside `ctx.ui`; the
  "continue" affordance is a big icon button (e.g. ▶ play icon), tap anywhere is OK too.
- Shared stylesheet `src/ui/styles.css` (imported once by main.js; UI agent owns
  it but must keep these tokens/classes stable):
  - colors `--rb-red --rb-orange --rb-yellow --rb-green --rb-blue --rb-purple --rb-pink --rb-cyan --rb-white --rb-ink --rb-sky`
  - medals `--rb-gold --rb-silver --rb-bronze --rb-ribbon`
  - shape `--rb-radius --rb-radius-sm --rb-border --rb-shadow --rb-shadow-pressed`
  - sizes `--rb-touch-min --rb-btn-big --rb-btn-chip --rb-btn-hud --rb-gap`, font `--rb-font`
  - safe areas `--rb-safe-top/right/bottom/left`
  - classes `.rb-screen .rb-row .rb-btn (.rb-btn--big|--chip|--round, .rb-btn--red|blue|green|orange|purple|pink|yellow|white, .selected / [aria-pressed=true]) .rb-caption .hud-banner .rb-pop .hidden`
- Mode-specific CSS: put it next to your module (e.g. `src/race/race.css`) and
  `import './race.css'` from your mode; prefix classes (`race-…`, `pg-…`) to avoid clashes.
- Inline SVG icons: `src/ui/icons/` (UI agent). Modes may keep private icons in
  their own folders. `src/app/icons.js` has `ICONS.home/rotate/play/ball`.

## 7. Events and saved progress

`ctx.events` (= `app.events`) is an app-wide bus: `events.on(name, fn) → off()`,
`events.emit(name, payload)`.

Modes **emit**; the UI agent's progress module (e.g. `src/ui/progress.js`,
subscribed once at boot from `registerScreens`) is the **only writer** of
progress fields in Save and decides unlocks.

| event | emitted by | payload |
|---|---|---|
| `raceFinished` | race | `{ difficulty, raceIndex /*0-based*/, races, place /*1..4*/, medal }` |
| `seriesComplete` | race | `{ difficulty, races, medals: medal[], cup }` |
| `starCollected` | playground | `{ sessionStars /*count this run*/ }` (one event per star) |
| `skinUnlocked` | UI progress | `{ skinId }` (UI shows a toast/celebration; held while a race is on screen so it doesn't cover the trophy — it pops up on Home) |

`medal`/`cup` ∈ `'gold'|'silver'|'bronze'|'ribbon'` (place 1/2/3/4+).
Cup rule (race computes): average place ≤ 1.5 → gold, ≤ 2.5 → silver, ≤ 3.5 → bronze, else ribbon.
Rank for "best": gold > silver > bronze > ribbon.

Unlock rules (UI progress): each `seriesComplete` → `seriesCompleted += 1` and
unlock the next skin in `UNLOCK_ORDER`; `bestCups[difficulty]` keeps the best
cup; each `starCollected` → `stars.total += 1`, and every 50 total stars
unlocks the next skin.

Save schema (`localStorage['rolly-bally:v1']`, `src/core/Save.js`):

```js
{
  settings: { sound: true },
  skins: { unlocked: ['red','blue','yellow','green','soccer','stripes'], selected: 'red' },
  bestCups: { /* [difficulty]: 'gold'|'silver'|'bronze'|'ribbon' */ },
  stars: { total: 0 },
  seriesCompleted: 0,
  ui: { race, playground, newSkins, recentWorlds },   // UI-only: remembered setups, recent Playground worlds + "new ball" badges (added/repaired by src/ui/progress.js migrateSave)
}
```

API: `save.get()` (read-only view), `save.update(patch | draft => void)`
(deep-merges / mutate a draft, persists), `save.reset()`, `save.subscribe(fn) → off`.
Modes read `save.get().skins.selected` for the ball skin and may write nothing
else. Add new fields only in `defaultSave()` (core) — ask the orchestrator.

## 8. Core APIs

Conventions: y up, 1 unit = 1 m, ball radius 0.5, gravity −20 m/s².
**Yaw 0 faces −Z**; `forward(yaw) = (−sin yaw, 0, −cos yaw)`, `right(yaw) = (cos yaw, 0, −sin yaw)`,
positive yaw turns left. Positions are `{x,y,z}` (THREE.Vector3 fine), rotations
are quaternions `{x,y,z,w}` (THREE.Quaternion fine).

### Rng — `src/core/Rng.js`
```js
new Rng(seed: string|number)
rng.next() → [0,1)    rng.range(min,max) → [min,max)    rng.int(min,max) → inclusive
rng.chance(p) → bool  rng.pick(arr)  rng.shuffle(arr) → new array
rng.weighted([{item, weight}]) | rng.weighted(items, item => weight)   // undefined if all 0
rng.fork(label) → independent Rng (use per subsystem: 'track', 'ai', 'stars'…)
mulberry32(uint) → () => float    hashString(str) → uint32
encodeEmojiSeed(int24) → '🍎🐶🚀⚽'   decodeEmojiSeed(str) → int|null   isEmojiSeed(str)
randomEmojiSeed() → string        SEED_EMOJI (64)
```
Never use `Math.random()` for generated content.

### Physics — `src/core/Physics.js`
```js
await initRapier()                      // done by main.js
physics.RAPIER / physics.world          // raw Rapier access when needed
physics.addFixedCuboid({position, halfExtents, rotation|yaw, friction, restitution, sensor, events, tag, data, onCollide}) → {body, collider}
physics.addFixedTrimesh(vertices, indices, {position, rotation|yaw, friction, …}) → {body, collider}
     // Float32Array xyz…, Uint32Array; CCW seen from outside; FIX_INTERNAL_EDGES on
physics.addHeightfield({nx, nz, heights, sizeX, sizeZ, position, friction, …}) → {body, collider}
     // heights.length = (nx+1)*(nz+1), heights[ix*(nz+1)+iz]; centered on position (x,z); y added
physics.addSensorCuboid({position, halfExtents, rotation|yaw, tag, data, onCollide}) → {body, collider}
physics.addKinematic({position, rotation|yaw, shapes:[{type:'cuboid', halfExtents, offset?, rotation?} | {type:'ball', radius, offset?} | {type:'cylinder', halfHeight, radius, offset?, rotation?}], friction, restitution, tag, data, onCollide, events}) → {body, colliders}
     // animate in update(): body.setNextKinematicTranslation(v) / setNextKinematicRotation(q)
physics.addDynamicBall({position, radius, mass=1, friction, restitution, linearDamping, angularDamping, ccd=true, tag, data}) → {body, collider}
physics.register(collider, {tag, data, onCollide})   physics.info(collider) → {tag, data, onCollide}|null
physics.raycast(origin, dir, maxDist, {solid=true, excludeBody, excludeSensors=true}) → {collider, toi, point, normal}|null
physics.remove(body)                    // body + its colliders
physics.step(dt)                        // HOST ONLY
```
`onCollide({self, other, otherInfo, started})` fires for sensors and colliders
created with `events: true`, on contact start (`started=true`) and end. Use
`otherInfo?.tag === 'ball'` (the player's collider is tagged `'ball'`, `data` = the Ball).
Callbacks run inside `physics.step`; don't remove bodies there — set a flag and
act in `postStep`/`update`. Scene queries (raycasts) reflect the last step.

### Ball — `src/ball/Ball.js`
```js
const ball = new Ball({physics, scene, position, skin = save.get().skins.selected, tuning?, shadow = true})
ball.update(dt, input.getMove(), forwardVec3)   // in mode.update, before the step
ball.render(alpha, frameDt)                     // in mode.render (mesh interp, pop anim, blob shadow)
ball.setTuning({speedCap, accel, airControl, turnAssist, capDrag, autoRoll, cruise, slow, lateral})
     // defaults DEFAULT_TUNING: speedCap 8, accel 14, airControl .35, autoRoll false, cruise .7, slow .3
     // autoRoll: forward drives to speedCap*cruise; stick up → speedCap, down → speedCap*slow
ball.boost(strength = 8, dir?, duration = 1.5)  // impulse + 1.5× cap for duration
ball.push(impulse)                              // bounce pads / bumpers
ball.respawn(pos, dir?)                         // at rest + pop-in; call camera.snap and audio 'boing' yourself
ball.setFrozen(bool)                            // countdown / results (body disabled)
ball.setSkin(id)
ball.getPosition(out?) / ball.getVelocity(out?) // physics state (Vector3)
ball.position / ball.velocity                   // render-interpolated (valid after render)
ball.speed / ball.groundSpeed / ball.isGrounded() / ball.groundNormal
ball.onRespawn = (pos, dir) => {}
ball.onLand = (impactSpeed) => {}                // after a real drop/jump (≥ 0.2 s airborne, > 4 m/s down); modes play a soft 'thump'
ball.dust                                       // Dust (src/fx/Dust.js): landing puff, dust.setColor(c) per theme
ball.body / ball.collider / ball.mesh / ball.radius
ball.dispose()
BALL_RADIUS = 0.5, DEFAULT_TUNING
```
Mass 1, friction 0.8, restitution 0.2, angular damping 0.6, CCD on. "Forward"
passed to update: Race = track tangent (ChaseCamera 'track'); Playground =
`cam.getForward()` (camera-relative).

Non-player balls (AI racers): kinematic body via
`physics.addKinematic({shapes:[{type:'ball', radius: 0.5}]})` + mesh from
`makeBallGeometry()` / `makeSkinMaterial(skinId)` in `ball/skins.js`.

### Skins — `src/ball/skinData.js` (pure data) and `src/ball/skins.js` (three.js)
```js
SKINS: [{id, name, pattern, colors, starter?}]   STARTER_SKIN_IDS (6)   UNLOCK_ORDER   getSkin(id)
makeSkinTexture(id) (cached)  makeSkinMaterial(id)  makeBallGeometry(r)  makeSkinPreviewMesh(id)
drawSkinIcon(id, size) → <canvas> (2D picture for DOM buttons, no WebGL)
```

### ChaseCamera — `src/core/ChaseCamera.js`
```js
const cam = new ChaseCamera(ctx.camera, {mode: 'track'|'free', distance=7, height=3.2, lookHeight=.6, lookAhead=3, posSharpness=8, turnSharpness=3, autoOrbit=.12, lookSensitivity=.006})
cam.setForward(v)            // track mode target direction (y ignored)
cam.addLook(dx, dy)          // pass ctx.input.consumeLook() each frame
cam.update(frameDt, {position: ball.position, velocity: ball.velocity})   // in render()
cam.snap(position, forward?) // after spawn/respawn
cam.getForward(out?)         // horizontal unit forward (use for camera-relative steering)
cam.setMode(mode)
```

### Input — `src/core/Input.js`
```js
input.getMove() → {x, y}     // x right, y forward, each in [-1,1] (polled by host each step)
input.consumeLook() → {dx, dy}  // two-finger drag px since last call
input.isActive()  input.source ('touch'|'keys'|'gamepad'|'none')
input.setEnabled(bool)       // e.g. false during countdown/results (host re-enables per run)
input.reset()
```
Joystick = touch or mouse drag anywhere (ring + knob drawn under the finger).

### BlockMesh — `src/voxel/BlockMesh.js`
```js
const blocks = new BlockMesh({palette: 'grass'|'snow'|'race'|object, jitter = 0.05})
blocks.addBox(center, size, colorKey, {rotation|yaw, jitter}?)
blocks.addBoxMinMax(min, max, colorKey, opts?)
blocks.addWedge(center, size, colorKey, {rotation|yaw}?)  // ramp: low at local −z, high at +z
scene.add(blocks.build())    // ≤ 2 draw calls (boxes + wedges); rebuild = build() again
blocks.dispose()
PALETTES, getPalette(p), makeWedgeGeometry(), makeDefaultLights(), applySky(scene, palette, {near, far})
```
colorKey = palette key, CSS color or hex number. Palette keys: common
`red orange yellow green blue purple pink cyan white black gray wood`; grass/snow
`sky fog grass grassDark dirt stone sand water leaves trunk wall rail pad` (+ snow `snow ice`);
race `sky fog track trackAlt edge rail railPost start finish finishDark checkpoint boost hazard metal bumper platform pillar`.
Moving things (hammers etc.) are regular meshes; build them with any geometry
but keep the flat-shaded voxel look (`MeshLambertMaterial({flatShading: true})`).
Budget: < 30 draw calls in Race, < 50 in Playground large.

### Audio — `src/core/Audio.js`
`audio.play(name, {volume = 1, pitch = 1}?)`, names: `boing whoosh pop sparkle thump beep go fanfare confetti click unlock`.
Silent until the first touch; respects `save.settings.sound`. Don't create your own AudioContext.

### Effects — `src/fx/`
`Dust` (one InstancedMesh of little blocks: `puff(pos, power)`, `update(dt)`),
`confetti(parent, n)` (DOM burst, returns cancel). Race keeps its own
confetti in `RaceHud`; the race backdrop clouds are `src/race/Scenery.js`.

### Debug — `src/debug/DebugOverlay.js`
`ctx.debug.set(key, value)`, `ctx.debug.watch(key, () => value)` (re-read each
refresh). Keys ≤ 5 chars look best. fps/draw calls are built in. Hotkeys R/N/G
call your optional `respawn/nextPiece/regenerate`.

### Test-track helpers — `src/test-track/pathBuilder.js`
Race agent may reuse (import, don't edit): `buildStrips(segments)`,
`roadTrimesh(strips)`, `buildPath({physics, blocks, strips})`, `nearestStrip(strips, p, hint)`,
`forwardOf(yaw)`, `stripRotation(strip)`.

## 9. Tests

Vitest, node environment, files `test/**/*.test.js`, run `npm test`.
Rapier works in node (`await initRapier()` in `beforeAll`; call `physics.step()`
once before raycasts). Keep generators pure (no DOM/three renderer) so they're
testable: e.g. `TrackGenerator.generate({difficulty, seed}) → pieceList`,
`TerrainGenerator.generate(config) → {heights, features, spawn}`. Test determinism
(same seed ⇒ deep-equal output) and rule invariants. Name files by owner prefix (§1).

## 10. Gotchas

- iPad Safari first: no hover-only UI, no fullscreen API, test landscape at 1180×820.
- Never punish: no game over, no lives, no timers that end a run. Fall → fade → respawn with 'boing'.
- `ctx.camera` is shared across runs; the host resets fov/near/far and position at each start.
- Anything allocated per frame in `update/render` hurts iPad: reuse vectors.
- Don't `import` from another agent's folder except the public APIs listed here.
