# Mazle Development Plan

## Functional Specification

### Overview
Mazle is a cooperative multiplayer mobile game that allows up to **10 players** to navigate a maze together. The goal is to reach the exit by solving puzzles, avoiding challenges, and utilizing teamwork.

### Gameplay Features

1. **Lives and Gifting**:
   - **Individual Lives**:
     - Each player has their own pool of lives, starting with **three lives** at the beginning of a level.
     - The maximum number of lives a player can have is **three**; lives cannot exceed this limit.
   - **Gifting Lives**:
     - Players can **gift lives** to teammates if they have **more than one life remaining**.
     - Players with only one life left cannot gift lives.
     - Gifted lives are instantly added to the recipient's pool, provided their total does not exceed three.

2. **Livers (Live-ers)**:
   - **Functionality**:
     - Livers are negative pickups that remove lives from the player upon collection:
       - **One Liver**: Removes 1 life.
       - **Two Livers**: Removes 2 lives.
       - **Three Livers**: Removes 3 lives.
   - **Reset Behavior**:
     - The state of livers (whether collected or not) **persists** after clearing a level.
     - Livers are only **reset** if a player loses **all three lives**, causing a full level reset.

3. **Booby Traps**:
   - **Randomized Placement**:
     - Booby traps are **randomly placed** at the start of a level and remain stationary until the level is cleared or reset.
     - Upon clearing or resetting the level, traps are reset and re-randomized.
   - **Activation**:
     - Booby traps trigger upon contact, and players receive no prior warning.
     - Triggering a trap causes the player to:
       - **Lose one life.**
       - Respawn at the most recent **checkpoint** (if one exists) or the **beginning of the level**.

4. **Checkpoints**:
   - Checkpoints have a distinct **green floor** and notify players with a popup saying "Checkpoint Activated."
   - Checkpoints allow players to respawn after losing a life, provided they have lives remaining.
   - If all lives are lost, the respawn point defaults to the beginning of the level.

5. **Level Completion and Reset Rules**:
   - For a level to be completed:
     - **All players** must reach the exit.
   - Upon level completion:
     - **Booby traps** are reset and randomized for the next attempt.
     - **Livers** retain their current state unless the level is reset due to a player losing all lives.
     - All **doors, levers, and switches** are reset to their original state.

6. **Levers and Switches**:
   - **Level Progression**:
     - **Levels 1–20**: Levers and switches are **not collaborative**. A single player can activate them for the group.
     - **Levels 21 and Beyond**: Levers and switches become **collaborative**, requiring participation from **half the players (rounded down)** to activate.
   - **Reset Behavior**:
     - Levers and switches reset when the level is restarted or completed.
   
7. **Customization**:
   - **Default Skin**:
     - All players begin as an old man in a **white tank top and blue jeans.**
   - **Unlockable Skins**:
     - Players can earn skins through gameplay progression.
     - Unlocked skins can be equipped at will, allowing players to switch between the default and earned skins.

8. **Player Stats**:
   - Tracks individual progress but avoids competitive rankings. Stats include:
     - Lives gifted.
     - Livers collected.
     - Mazes completed.
     - Booby traps triggered.
     - Number of times revived or respawned.

---

## Technical Specification

### To be outlined
This section will cover the technical details of the game, including:
- Backend architecture
- Multiplayer implementation
- Rendering and game engine selection
- Data handling for levels, character skins, and interactive elements

(Technical details will be added as the development progresses.)