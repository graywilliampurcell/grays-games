## TERRAN AVENGERS - PHASE 2: Jobs & Health

### What's Being Added
Phase 2 adds player identity. Each player picks a job at the start of the game, which gives them different health, a starting orb companion, and special abilities that will be used in later phases.

---

### What Players Will See & Do
1. After selecting player count (already built), players now also pick a job before the game starts
2. Each player's health bar appears on screen next to their token info
3. Each job has a unique health amount
4. The Miner gets a Stone Orb companion shown next to them
5. The Wood Maker gets a Wood Orb companion shown next to them
6. The job panel shows each player's name, color, shape, job, and health

---

### New Game Flow

```
OLD FLOW (Phase 1):
Select player count → Press START → Move around board

NEW FLOW (Phase 2):
Select player count (3-6) → Each player picks a job → [Groomate RPS if 2 Groomates] → Press START → Move around board
```

---

### Jobs (5 total)

```typescript
type JobType = 'miner' | 'wood_maker' | 'maker' | 'groomate' | 'crewmate';

interface Job {
  id: JobType;
  displayName: string;
  description: string;
  startingHealth: number;
  startingOrb: OrbType | null;
  canHaveBook: boolean;
  maxCount: number;  // Maximum players who can pick this job
}

const JOBS: Record<JobType, Job> = {
  miner: {
    id: 'miner',
    displayName: 'Miner',
    description: 'Goes underground to find valuable stones and crystals.',
    startingHealth: 25,
    startingOrb: 'stone_orb',
    canHaveBook: true,
    maxCount: 1
  },
  wood_maker: {
    id: 'wood_maker',
    displayName: 'Wood Maker',
    description: 'Mines trees for wood, leaves, bark and sticks.',
    startingHealth: 12.5,
    startingOrb: 'wood_orb',
    canHaveBook: true,
    maxCount: 1
  },
  maker: {
    id: 'maker',
    displayName: 'Maker',
    description: 'Crafts items for the whole team using resources others bring.',
    startingHealth: 5,
    startingOrb: null,
    canHaveBook: true,
    maxCount: 1
  },
  groomate: {
    id: 'groomate',
    displayName: 'Groomate',
    description: 'Fights monsters and collects orbs. If 2 groomates, they play rock-paper-scissors to decide roles.',
    startingHealth: 10,
    startingOrb: null,
    canHaveBook: false,
    maxCount: 2
  },
  crewmate: {
    id: 'crewmate',
    displayName: 'Crewmate',
    description: 'Helps find food for the team. Does not fight.',
    startingHealth: 10,
    startingOrb: null,
    canHaveBook: true,
    maxCount: 1
  }
};
```

---

### Job Selection Screen

**Rules:**
- Happens AFTER player count is selected (3-6 players), BEFORE the START button
- Each player picks one at a time in order (Player 1 picks, then Player 2, etc.)
- Each job has a maximum number of players who can pick it:
  - Miner: 1
  - Wood Maker: 1
  - Maker: 1
  - Groomate: 2
  - Crewmate: 1
- Once a job reaches its max count, it grays out for other players

**UI Layout:**
```
┌─────────────────────────────────────┐
│       PLAYER 1 - Pick Your Job      │
│         Ruby Player ● (Red)         │
│                                     │
│  [Miner]      [Wood Maker]          │
│  HP: 25 ❤️    HP: 12.5 ❤️           │
│  🪨 Stone Orb  🌿 Wood Orb           │
│                                     │
│  [Maker]      [Groomate]            │
│  HP: 5 ❤️     HP: 10 ❤️             │
│  No Orb       No Orb               │
│                                     │
│  [Crewmate]                         │
│  HP: 10 ❤️                          │
│  No Orb                             │
└─────────────────────────────────────┘
```

---

### Groomate Role Assignment

When there are 2 Groomates, they play rock-paper-scissors to determine their roles:

**Rules:**
- If only 1 Groomate: They do both jobs (fight monsters AND collect orbs)
- If 2 Groomates: Play rock-paper-scissors at game start
  - **Winner:** Fights monsters (that is all they do)
  - **Loser:** Collects orbs for the team

```typescript
type GroomateRole = 'fighter' | 'collector' | 'both';

interface GroomatePlayer extends Player {
  groomateRole: GroomateRole;
}

// Determine groomate roles after job selection
function assignGroomateRoles(players: Player[]): void {
  const groomates = players.filter(p => p.job?.id === 'groomate');

  if (groomates.length === 1) {
    groomates[0].groomateRole = 'both';
  } else if (groomates.length === 2) {
    // Rock-paper-scissors happens here
    // Winner gets 'fighter', loser gets 'collector'
  }
}
```

**Rock-Paper-Scissors UI:**
```
┌─────────────────────────────────────┐
│     GROOMATE SHOWDOWN!              │
│                                     │
│  Player 1 vs Player 2               │
│                                     │
│  [🪨 Rock]  [📄 Paper]  [✂️ Scissors] │
│                                     │
│  Winner: Fights monsters            │
│  Loser: Collects orbs               │
└─────────────────────────────────────┘
```

---

### Updated Types

```typescript
// Add to existing types.ts

type OrbType = 'stone_orb' | 'wood_orb';

interface Job {
  id: JobType;
  displayName: string;
  description: string;
  startingHealth: number;
  startingOrb: OrbType | null;
  canHaveBook: boolean;
}

type GroomateRole = 'fighter' | 'collector' | 'both';

// Update existing Player interface
interface Player {
  id: number;
  config: PlayerConfig;       // already exists - color/shape
  position: HexCoordinate;    // already exists
  actionsRemaining: number;   // already exists
  job: Job | null;            // NEW - player's chosen job
  health: number;             // NEW - current health
  maxHealth: number;          // NEW - starting/max health
  inventory: InventoryItem[]; // NEW - items player is carrying
  orb: OrbType | null;        // NEW - starting orb companion
  hasBook: boolean;           // NEW - whether player has their book
  groomateRole: GroomateRole | null; // NEW - only for Groomates
}

// NEW - inventory item
interface InventoryItem {
  id: string;
  name: string;
  type: ItemType;
  quantity: number;
}

type ItemType = 'orb' | 'tool' | 'resource' | 'food' | 'spell' | 'book';

// Update existing GameState
interface GameState {
  tiles: Tile[];              // already exists
  players: Player[];          // already exists (now has more fields)
  currentPlayerIndex: number; // already exists
  gameStarted: boolean;       // already exists
  playerCount: number;        // already exists
  phase: 'job_select' | 'groomate_rps' | 'playing'; // NEW - tracks which screen we're on
  jobSelectPlayerIndex: number;    // NEW - which player is currently picking a job
}
```

---

### Health Bar Display

**Rules:**
- Show health bar for each player in the side panel
- Health bar color matches the player's jewel color
- Show as both a bar AND a number (e.g. "25 / 25")
- When health drops to 0, player is shown as eliminated
- Half-heart values (12.5) should display as "12.5" not rounded

```typescript
function renderHealthBar(
  currentHealth: number,
  maxHealth: number,
  playerColor: string
): string {
  const percentage = (currentHealth / maxHealth) * 100;

  // Color changes based on how hurt the player is
  let barColor = playerColor;         // Full health = player color
  if (percentage <= 50) barColor = '#FFA500'; // Half health = orange
  if (percentage <= 25) barColor = '#FF0000'; // Low health = red

  return `
    <div class="health-bar-container">
      <div class="health-bar-fill"
           style="width: ${percentage}%; background: ${barColor}">
      </div>
      <span class="health-text">${currentHealth} / ${maxHealth}</span>
    </div>
  `;
}
```

---

### Player Panel (Side UI)

Each player gets a panel on the side of the board showing:

```
┌─────────────────────┐
│ ● Ruby Player        │
│ Job: Miner           │
│ ❤️ ████████░░ 25/25  │
│ Orb: 🪨 Stone Orb    │
│ 📖 Has Book          │
│ Actions: 1           │
└─────────────────────┘
```

```typescript
// New component: PlayerPanel.svelte
// Shows for each player:
// - Their shape + color icon
// - Their display name
// - Their job name
// - Health bar
// - Orb (if they have one)
// - Book indicator (if they have one)
// - Actions remaining
// - Highlight border when it's their turn
```

---

### Starting Inventory

When the game starts (after job selection), each player receives:

```typescript
function getStartingInventory(job: Job): InventoryItem[] {
  const inventory: InventoryItem[] = [];

  // Give book to eligible players
  if (job.canHaveBook) {
    inventory.push({
      id: 'book_1',
      name: 'Book',
      type: 'book',
      quantity: 1
    });
  }

  // Give starting orb to eligible players
  if (job.startingOrb) {
    inventory.push({
      id: job.startingOrb,
      name: job.startingOrb === 'stone_orb' ? 'Stone Orb' : 'Wood Orb',
      type: 'orb',
      quantity: 1
    });
  }

  return inventory;
}
```

---

### Updated Game Flow (Full State Machine)

```typescript
type GamePhase =
  | 'player_count_select'   // Pick how many players (3-6)
  | 'job_select'            // Each player picks a job one at a time
  | 'groomate_rps'          // Rock-paper-scissors if 2 Groomates
  | 'playing';              // Main game loop

function handleGamePhase(state: GameState, action: GameAction): GameState {
  switch (state.phase) {
    case 'player_count_select':
      // Player sets count → move to job_select
      // (Already built in Phase 1)
      break;

    case 'job_select':
      // Current player picks a job
      // Move to next player's job selection
      // When all players have picked:
      //   - If 2 Groomates → move to 'groomate_rps'
      //   - Otherwise → move to 'playing'
      break;

    case 'groomate_rps':
      // Both Groomates play rock-paper-scissors
      // Winner becomes 'fighter', loser becomes 'collector'
      // Then move to 'playing'
      break;

    case 'playing':
      // Normal game loop
      // (Already built in Phase 1)
      break;
  }
}
```

---

### Orb Visual Display

Orbs are shown as small companion icons next to the player's token on the board AND in the side panel.

```typescript
const ORB_DISPLAY = {
  stone_orb: {
    icon: '🪨',
    color: '#A0A0A0',
    name: 'Stone Orb',
    description: 'Elemental pet that fights off monsters. Given to Miner because they are always in darkness.'
  },
  wood_orb: {
    icon: '🌿',
    color: '#8B4513',
    name: 'Wood Orb',
    description: 'Given to Wood Maker. Works best for the person it was made for.'
  }
};
```

**On-board display:** Small icon floats above the player token when they have an orb.

---

### New Files Needed

```
terran-avengers/
└── src/
    ├── lib/
    │   ├── types.ts          ← UPDATE (add Job, OrbType, InventoryItem)
    │   ├── gameState.ts      ← UPDATE (add job_select phase logic)
    │   └── jobConfig.ts      ← NEW (job definitions and starting inventory)
    └── components/
        ├── JobSelect.svelte      ← NEW (job selection screen)
        ├── GroomateRPS.svelte    ← NEW (rock-paper-scissors for 2 Groomates)
        ├── PlayerPanel.svelte    ← NEW (side panel showing player status)
        └── HealthBar.svelte      ← NEW (health bar component)
```

---

### Phase 2 Deliverables Checklist

When Phase 2 is complete, the game should have:

- [ ] Job selection screen appears after player count is chosen
- [ ] Players pick jobs one at a time in order
- [ ] Jobs gray out when max count is reached (Groomate allows 2, others allow 1)
- [ ] Each job shows its health, orb, and description on the selection screen
- [ ] Each player starts with correct health for their job
- [ ] Each player starts with their book (if eligible)
- [ ] Miner starts with Stone Orb in inventory
- [ ] Wood Maker starts with Wood Orb in inventory
- [ ] Health bar shows in side panel for each player
- [ ] Health bar changes color at 50% (orange) and 25% (red)
- [ ] Orb icon shows in side panel and above token on board
- [ ] Book indicator shows in side panel
- [ ] Player panel highlights when it's that player's turn
- [ ] Actions remaining shows in side panel
- [ ] If 2 Groomates, rock-paper-scissors screen appears after job selection
- [ ] Winner of rock-paper-scissors becomes the Fighter (fights monsters)
- [ ] Loser of rock-paper-scissors becomes the Collector (collects orbs)
- [ ] If only 1 Groomate, they get the "both" role automatically
- [ ] All Phase 1 functionality still works

---

### DO NOT BUILD IN PHASE 2

Save these for later phases:
- What jobs actually DO (mining, making, crafting) → Phase 3
- Actual damage or health loss → Phase 5 (monsters)
- Using the book or orbs in gameplay → Phase 4+
- Trading between players → Phase 3

---
