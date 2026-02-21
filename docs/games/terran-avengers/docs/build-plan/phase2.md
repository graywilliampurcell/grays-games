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
Select player count → Each player picks a job → Press START → Move around board
```

---

### Jobs (6 total)

```typescript
type JobType = 'miner' | 'wood_maker' | 'maker' | 'groomate' | 'crewmate' | 'none';

interface Job {
  id: JobType;
  displayName: string;
  description: string;
  startingHealth: number;
  startingOrb: OrbType | null;
  canHaveBook: boolean;
}

const JOBS: Record<JobType, Job> = {
  miner: {
    id: 'miner',
    displayName: 'Miner',
    description: 'Goes underground to find valuable stones and crystals.',
    startingHealth: 25,
    startingOrb: 'stone_orb',
    canHaveBook: true
  },
  wood_maker: {
    id: 'wood_maker',
    displayName: 'Wood Maker',
    description: 'Mines trees for wood, leaves, bark and sticks.',
    startingHealth: 12.5,
    startingOrb: 'wood_orb',
    canHaveBook: true
  },
  maker: {
    id: 'maker',
    displayName: 'Maker',
    description: 'Crafts items for the whole team using resources others bring.',
    startingHealth: 5,
    startingOrb: null,
    canHaveBook: true
  },
  groomate: {
    id: 'groomate',
    displayName: 'Groomate',
    description: 'No fixed job. Finds food and orbs for the team.',
    startingHealth: 10,
    startingOrb: null,
    canHaveBook: false
  },
  crewmate: {
    id: 'crewmate',
    displayName: 'Crewmate',
    description: 'Starts on the Prairie. Chops plants and gathers resources.',
    startingHealth: 10,
    startingOrb: null,
    canHaveBook: true
  },
  none: {
    id: 'none',
    displayName: 'No Job',
    description: 'Finds stuff from other players and does their own thing.',
    startingHealth: 10,
    startingOrb: null,
    canHaveBook: false
  }
};
```

---

### Job Selection Screen

**Rules:**
- Happens AFTER player count is selected, BEFORE the START button
- Each player picks one at a time in order (Player 1 picks, then Player 2, etc.)
- No two players can pick the same job
- Once a job is picked it grays out for other players
- Groomate and "No Job" are always available (multiple players can pick them)

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
│  [Crewmate]   [No Job]              │
│  HP: 10 ❤️    HP: 10 ❤️             │
│  No Orb       No Orb               │
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
  phase: 'job_select' | 'playing'; // NEW - tracks which screen we're on
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
  | 'player_count_select'   // Pick how many players (3-5)
  | 'job_select'            // Each player picks a job one at a time
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
      // When all players have picked → move to 'playing'
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
        ├── JobSelect.svelte  ← NEW (job selection screen)
        ├── PlayerPanel.svelte ← NEW (side panel showing player status)
        └── HealthBar.svelte  ← NEW (health bar component)
```

---

### Phase 2 Deliverables Checklist

When Phase 2 is complete, the game should have:

- [ ] Job selection screen appears after player count is chosen
- [ ] Players pick jobs one at a time in order
- [ ] Already-taken jobs are grayed out (except Groomate and No Job)
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
- [ ] All Phase 1 functionality still works

---

### DO NOT BUILD IN PHASE 2

Save these for later phases:
- What jobs actually DO (mining, making, crafting) → Phase 3
- Actual damage or health loss → Phase 5 (monsters)
- Using the book or orbs in gameplay → Phase 4+
- Trading between players → Phase 3

---
