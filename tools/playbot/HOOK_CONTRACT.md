# window.__game test hook contract

Every game exposes `window.__game` **only** when the page URL has `?test=1`.
Without `?test=1` the game must behave exactly as before (no gameplay change).
Test-only code lives in its own module (e.g. `js/testHooks.js`) and is wired in
with a few lines from the game's entry point.

In test mode the simulation is driven by the bot: the game's
requestAnimationFrame loop keeps **drawing**, but does not advance the
simulation unless realtime mode is on.

```js
window.__game = {
  name: 'mazle' | 'rolly-bally',
  version: 1,                 // contract version
  ready: true,                // set once the game is fully loaded & playable
  dt: 1/60,                   // fixed step length in seconds

  step(n = 1),                // advance n fixed steps synchronously, then render once; returns state()
  render(),                   // draw one frame now (for screenshots)
  setRealtime(on),            // true: RAF loop steps with real dt (for frame-rate runs); default false
  state(),                    // plain JSON-serialisable snapshot (game-specific fields, see below)
  setInput(input),            // replace the current input (game-specific shape, see below); persists until changed
  clearInput(),
  events,                     // array of { t, type, ...details }, t = simulated seconds since load/restore
  clearEvents(),
  time(),                     // simulated seconds
  teleport(...),              // game-specific
  restore(),                  // back to a clean start of the current level/mode (clears nothing in events unless stated)
  text(),                     // array of visible UI strings (menus, messages, HUD) for text checks
};
```

Common `state()` fields: `{ t, pos:{x,y,z}, vel:{x,y,z}, won:bool, frozen:bool, level|mode }`.
Common event types: `start`, `win`, `fail` (with `reason`), `reset`, `respawn`, `message` (with `text`).

## Mazle (`src/playtest`, Level 1 from `levels.js`)
- `state()`: `t, pos, vel, yaw, pitch, escaped, frozen, level:{index,name}, grid:string[] (layout rows),
  cellSize (world units per layout char), spike:{x,z}, door:{x,z}, start:{x,z,yaw}`
- `setInput({ forward, back, left, right, turnLeft, turnRight, lookDx, lookDy, joystick:{x,y} })` — booleans are
  held keys (left/right = strafe, exactly like the arrow keys); `lookDx/lookDy` = mouse-look pixels applied once per step.
- `teleport({x,z,yaw})` wraps `resetTo()`; `restore()` wraps `playAgain()`.
- events: `spike`, `escape`, `message`.
- test mode skips the pointer-lock request.

## Rolly Bally (`src/rolly-bally`)
- Wraps the existing `window.rollyBally` (from `?debug=1`), its seeded RNG and URL params
  (`?mode=race&seed=…`, `?mode=test-track`, `?gallery=1`).
- `state()`: `t, pos, vel, mode, seed, onGround?, lap/progress (race), stars (playground), fell?`
- `setInput({ x, y, jump })` — the same move vector the joystick/keys/gamepad feed.
- events: `fall`/`respawn`, `checkpoint`, `finish`, `star`, `message`.
