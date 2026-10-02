# Mazle Touch Controls Plan

## Overview

Mazle is a mobile game, so touch has to be a first-class way to play, not an afterthought. This plan covers touch controls for phones and tablets (iPad is the first test device), starting with the map-only playtest in `/src/playtest/` and carrying forward into the full game.

It expands the one-line requirement in [PLAYTEST_MAP_ONLY.md](PLAYTEST_MAP_ONLY.md): "Touch controls for mobile (joystick overlay)".

## Goals

- A player with only a touchscreen can do everything a keyboard + mouse player can
- Movement and looking can happen at the same time (two thumbs)
- Controls feel responsive and natural, with no accidental page scrolling or zooming
- Controls stay out of the way of the view as much as possible
- Keyboard + mouse keeps working on computers; both can coexist

## Control Scheme

### Move: Virtual Joystick (Left Half)

- Touch anywhere on the **left half** of the screen to place the joystick under your thumb ("floating" joystick)
- Drag to move; the knob is clamped to the joystick's ring
- **Analog**: pushing partway moves slower, pushing to the edge moves at full speed
- Lifting the thumb hides the joystick and stops input (player slows down via friction)

### Look: Drag (Right Half)

- Touch and drag anywhere on the **right half** of the screen to turn and look up/down
- Look speed scales with how far the finger moves
- Looking up/down is clamped so the camera can't flip over

### Page Behavior

- No scrolling, pinch-zoom, double-tap zoom, text selection, or long-press callouts while playing

## Status

### Phase 1: Basic Touch Controls (Playtest) - Done, Needs Device Testing

- ✅ Floating analog joystick on the left half
- ✅ Drag to look on the right half
- ✅ Two-finger use (move and look at once)
- ✅ Page scroll/zoom/selection disabled
- ✅ Mouse look fixed and shares the same look code as touch
- ⬜ Tested on iPad
- ⬜ Tested on a phone (portrait and landscape)

### Phase 2: Feel and Tuning

- ⬜ Tune look sensitivity and joystick size on real devices
- ⬜ Dead zone in the joystick center so tiny thumb wobbles don't cause drifting
- ⬜ Optional smoothing on look input
- ⬜ Settings for look sensitivity and "invert look up/down"
- ⬜ Hide the keyboard help text on touch devices, show touch help instead
- ⬜ Keep controls clear of iPhone notches / home bar (safe areas)

### Phase 3: Full Game Actions

The full game ([PLAN.md](PLAN.md)) needs more than moving and looking. Each needs a touch control:

- ⬜ **Interact** button for levers, switches, and doors
- ⬜ **Gift a life** to a teammate (button or menu)
- ⬜ Chat / quick messages for teamwork
- ⬜ Pause / menu button
- ⬜ Decide whether jumping or crouching exist; if so, add buttons

Buttons go on the right side, near the thumb, without blocking the look area.

### Phase 4: Other Inputs

- ⬜ Gamepad support (left stick move, right stick look), as mentioned in PLAYTEST_MAP_ONLY.md
- ⬜ iPad with keyboard/trackpad attached works like a computer

## Open Questions

- Should the joystick be **floating** (appears where you touch, current choice) or **fixed** in the bottom-left corner?
- Should the look area be the **whole right half** (current choice) or only where there are no buttons?
- Is **portrait** play supported, or is the game landscape-only? Should we show a "rotate your device" message?
- Should tapping the right side do something (e.g. interact), or only dragging?
- Do we want **gyroscope** look (tilt the device to look around) as an option?

## Testing Checklist

- Walk forward, backward, strafe, and diagonally using only the joystick
- Walk slowly by pushing the joystick partway
- Look around 360° and up/down using only the right side
- Move and look at the same time
- Lift and re-place fingers quickly; controls never get "stuck"
- Page never scrolls, zooms, or selects text
- Rotate the device mid-game; everything still works
- Holds a smooth frame rate on the iPad

## Code

- `src/playtest/js/Player.js`: touch handling (`onTouchStart`, `onTouchMove`, `onTouchEnd`) and shared `look()` for mouse and touch
- `src/playtest/index.html`: joystick elements and styles, page scroll/zoom prevention
