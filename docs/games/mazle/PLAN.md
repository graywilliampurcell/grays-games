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
   - Tracks individual progress without competitive rankings.
   - **Stat Tracked**:
     - **Levels Completed**: The total number of levels successfully completed by the player.

---

## Visual Design and Aesthetics

### 3D Pixelated Graphics (Minecraft-Style)

Mazle features a **3D pixelated art style** similar to Minecraft, creating an immersive yet charming environment for cooperative gameplay.

#### Key Design Elements

1. **Voxel-Based World**:
   - All maze structures, obstacles, and environmental elements are built from cubic voxels (3D pixels).
   - This creates a consistent, blocky aesthetic throughout the game world.
   - Voxels enable efficient rendering and provide a nostalgic, retro-gaming feel.

2. **Player Models**:
   - Players are rendered as **pixelated humanoid characters** in a Minecraft-like style.
   - The default character is an old man wearing a **white tank top and blue jeans**.
   - Unlockable skins maintain the pixelated aesthetic while allowing visual customization.
   - Each player is distinguished by a **unique colored outline or nametag** for easy identification in multiplayer sessions.

3. **Environmental Palette**:
   - **Maze walls**: Stone-textured blocks in shades of gray and brown.
   - **Floors**: Varied textures (stone, dirt, wood) to distinguish different areas.
   - **Checkpoints**: Bright green-colored blocks for high visibility and clear identification.
   - **Levers and switches**: Detailed pixelated mechanisms that are visually distinct.
   - **Booby traps**: Distinctive colored blocks (e.g., red or dark purple) to create tension and warning.
   - **Exit**: A prominent gold or bright color-coded structure to guide players.

4. **Lighting and Atmosphere**:
   - Ambient lighting creates clear sightlines within the 3D maze.
   - Each level may have distinct lighting conditions (torchlight, daylight, etc.) to create variety and atmosphere.
   - Shadows are simplified to maintain performance across devices.

5. **Animation Style**:
   - Player movement is smooth and responsive while maintaining the pixelated visual style.
   - Interactions (lever pulls, trap triggers, checkpoint activation) have clear, snappy animations.
   - Particle effects (dust, sparks) are pixelated to match the overall aesthetic.

6. **Performance Considerations**:
   - The pixelated style reduces the need for high-resolution textures and detailed models.
   - Efficient rendering of voxel-based environments allows smooth gameplay on mobile devices and across WebRTC P2P connections.
   - Level complexity can be scaled through voxel density without significant performance impact.

---

## Technical Specification

### Overview
Mazle uses a **peer-to-peer (P2P) architecture** powered by **WebRTC** for real-time communication between players. A **Node.js WebSocket signaling server** facilitates the initial connection setup, but does not store game state. All game state is tracked and synchronized by the game clients themselves.

### Architecture

1. **Signaling Server**:
   - **Technology**: Node.js WebSocket server (hosted separately, outside this repository).
   - **Purpose**: Facilitates the initial peer-to-peer connection setup by exchanging WebRTC session descriptions and ICE candidates between clients.
   - **Configuration**: Users provide the signaling server URL when launching the game.
   - **State**: The signaling server is **stateless** and does not persist any game data.

2. **Game Clients**:
   - **Technology**: Web-based (browser) application using WebRTC Data Channels for P2P communication.
   - **Responsibilities**:
     - Establish WebRTC connections with other players in the session.
     - Manage and synchronize **all game state** (player positions, lives, booby trap locations, lever states, etc.).
     - Handle game logic (checkpoint activation, life loss, level completion).
     - Render the maze and player interactions in real-time using 3D pixelated graphics.

3. **Game State Management**:
   - **Decentralized**: Each client maintains a copy of the game state.
   - **Synchronization**: Players exchange state updates via WebRTC Data Channels.
   - **Authority**: Game state is **collaborative**—all players contribute to maintaining consistency (no central server arbitration).

### Session and Room Management

1. **Session Flow**:
   - **Step 1**: User enters the **signaling server URL**.
   - **Step 2**: User either:
     - **Creates a new room** (generates a unique room code).
     - **Joins an existing room** by entering a room URL or code.
   - **Step 3** (For room creator): After creating a room, the user can share via:
     - **QR Code**: Encodes the signaling server URL and room code.
     - **URL**: Direct link containing both the signaling server URL and room code.
   - **Step 4** (For joining players): Players scan the QR code or visit the shared URL, which automatically populates the signaling server URL and room code. They join the game directly.

2. **Room Identification**:
   - Rooms are identified by a **unique room code**.
   - The room code is embedded in shared URLs and QR codes for easy distribution.

3. **Player Discovery**:
   - When a player joins a room, the signaling server facilitates peer-to-peer connection negotiation with other players already in that room.
   - Direct WebRTC connections are established between all players in the session.

### Communication Protocol

1. **Signaling Phase** (via WebSocket):
   - Exchange of WebRTC **Session Descriptions (SDP)**.
   - Exchange of **ICE Candidates** (network route information).
   - Once WebRTC connections are established, the signaling server is no longer needed.

2. **Game State Synchronization** (via WebRTC Data Channels):
   - **Player position updates**: Real-time movement data.
   - **Life changes**: When a player loses or gains a life.
   - **Checkpoint activation**: When a checkpoint is reached.
   - **Lever/switch state**: Activation status of interactive elements.
   - **Booby trap triggers**: When a trap is hit.
   - **Liver collection**: When items are picked up.
   - **Level completion**: When all players reach the exit.

### Data Persistence

- **No Backend Storage**: The signaling server does not store any game data.
- **Client-Side State**: All game progress and state is maintained by the game clients.
- **Session Persistence**: Players remain connected via WebRTC as long as the game session is active. If a player disconnects, the session may be paused or terminated depending on game rules.

### Configuration

- **User-Provided Signaling Server URL**: Players specify the WebSocket signaling server URL when launching the game.
- **Dynamic Room Management**: Room codes are generated client-side and shared via QR codes or URLs.

---

### To be outlined
This section will cover additional technical details, including:
- Specific WebRTC data channel message formats
- Conflict resolution strategies for state synchronization
- 3D rendering engine selection (Three.js, Babylon.js, or custom voxel renderer)
- Mobile responsiveness and performance optimization
- Security considerations (data encryption, player validation)

(Technical details will be added as the development progresses.)