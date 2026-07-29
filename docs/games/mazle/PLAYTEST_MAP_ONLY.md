# Mazle Map Playtest Plan

## Overview

This playtest version is designed to test **map navigation and movement mechanics only**. Players can walk around a single maze map with no other game mechanics, UI elements, or distractions.

## Scope

### What IS Included

- **3D first-person or third-person movement** through a maze
- **Camera/player controls** (WASD or arrow keys for movement, mouse for camera rotation)
- **Collision detection** (walls, floors, boundaries)
- **Simple maze layout** with walls, open spaces, and corridors
- **Pixelated Minecraft-style graphics**

### What IS NOT Included

- Player selection or customization
- Level system or level progression
- Lives, health, or damage
- Booby traps or hazards
- Checkpoints
- Levers, switches, or interactive elements
- Doors or locked passages
- Hidden passages or secrets
- NPCs or other players
- UI elements (HUD, minimap, stats)
- Livers or collectibles
- Exit trigger or win condition
- Sound or music
- Multiplayer networking

## User Experience Flow

1. **Launch Application**
   - Application loads directly into the map
   - No menu, splash screen, or login

2. **Spawn Location**
   - Player spawns at a defined starting position in the maze
   - Camera is ready to control immediately

3. **Exploration**
   - Player uses controls to move freely around the map
   - Player can walk into any open corridor or chamber
   - Player cannot pass through walls or obstacles
   - Camera follows the player naturally

4. **Map Boundaries**
   - Player cannot move outside the map bounds
   - Invisible walls prevent falling off edges

## Technical Requirements

### Movement Controls

- **Forward/Back**: W/Up Arrow or Gamepad Stick
- **Left/Right Strafe**: A/D or Left/Right Arrow
- **Look Around**: Mouse movement (or gamepad right stick)
- **Alternative**: Touch controls for mobile (joystick overlay)

### Camera System

- First-person or third-person perspective (user's choice to implement)
- Smooth camera rotation
- Camera collision to prevent clipping through walls

### Collision System

- **Capsule collider** around player character
- Collision with all wall geometry
- Prevent player from getting stuck in terrain

### Performance

- Target 60 FPS on mobile devices
- Efficient voxel rendering (only render visible blocks)
- Minimal draw calls

## Map Design

- **Single maze** to test navigation
- **Varied terrain**: corridors, chambers, slopes, bridges
- **No traps or hazards** (safe to walk anywhere)
- **Clear visual distinction** between walkable and non-walkable areas
- **Pixelated aesthetic** consistent with final game vision

## Testing Goals

- Verify movement feels responsive and natural
- Confirm collision detection works properly
- Ensure camera doesn't clip through geometry
- Test performance on target devices
- Validate maze layout is navigable
- Identify any movement bugs or physics issues

## Success Criteria

- ✅ Player can move smoothly in all directions
- ✅ Player cannot pass through walls
- ✅ Camera responds naturally to input
- ✅ No collision glitches or stuck spots
- ✅ Maintains 60 FPS on target devices
- ✅ Maze is fully explorable from start position
- ✅ Visual feedback is clear (pixelated graphics render correctly)

## Deliverables

- Standalone web application (single HTML file or simple server)
- No backend required (runs locally)
- Works on mobile browsers and tablets
- Source code in `/src/playtest/` directory

## Future Iterations

After map playtest validation, add:
1. **Multiplayer** - Multiple players on same map
2. **Basic interactables** - Doors, levers (no logic, just animations)
3. **Checkpoints** - Visual markers only
4. **Traps** - Visual/audio feedback only
5. **Win condition** - Reaching an exit area
