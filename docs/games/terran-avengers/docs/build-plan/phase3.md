## TERRAN AVENGERS - PHASE 3: Actions (Mine, Make, Trade)

### What's Being Added
Phase 3 turns the jobs from Phase 2 into something players actually *do*. Players can now spend actions to **Mine** resources from the right biome (with a job restriction), the Maker has a **Make** screen (framework only — no recipes ship in this phase), and any active player can **Trade** with nearby players using a broadcast offer system.

This phase deliberately stops short of: tool requirements, the metal/plant/wood subtype taxonomy, crystals, spells, spawn blocks, crops, and the practice area. Those become Phase 4+.

---

### What Players Will See & Do
1. The active player's panel shows three new action buttons: **Mine**, **Make**, **Trade**
2. **Mine** is enabled only when the player's job + current biome match (see table below). Pressing it consumes 1 action and adds a generic resource to inventory.
3. **Make** is enabled only for the Maker. Pressing it opens a modal with an empty recipe list (placeholder for Phase 4).
4. **Trade** is always enabled on the active player's turn. Pressing it opens a trade modal where the active player picks an item they'll give and (optionally) names a specific item they want back. Every other player within 1 hex of the active player gets to submit a counter-offer or pass. The active player accepts one offer or rejects all.
5. Inventory contents are visible in each player's side panel.

---

### Mine Action

**Rule:** Mine costs 1 action. It is enabled only when the active player's job and current biome match the table below. No tools are required in Phase 3.

| Job        | Biome    | Yields (per Mine) |
|------------|----------|-------------------|
| Miner      | Mountain | 1 metal           |
| Wood Maker | Forest   | 1 wood            |
| Wood Maker | Prairie  | 1 plant           |
| Crewmate   | Prairie  | 1 plant           |
| *Any*      | Crop     | 1 food            |

**Notes:**
- Maker cannot mine.
- Lake, Field, and Cave have no mining in Phase 3 (cave mining = crystals, deferred to Phase 4).
- All resources in Phase 3 are generic (`metal`, `wood`, `plant`, `food`). Subtypes (titanium vs iron, fern vs ivy, etc.) arrive when recipes need them.
- Mining always succeeds in Phase 3 (no dice rolls). Random yields come later.

```typescript
type ResourceId = 'metal' | 'wood' | 'plant' | 'food';

interface MineRule {
  job: JobType;
  biome: BiomeType;
  yields: ResourceId;
}

const MINE_RULES: MineRule[] = [
  { job: 'miner',      biome: 'mountain', yields: 'metal' },
  { job: 'wood_maker', biome: 'forest',   yields: 'wood'  },
  { job: 'wood_maker', biome: 'prairie',  yields: 'plant' },
  { job: 'crewmate',   biome: 'prairie',  yields: 'plant' },
  // Crop biome is open to all jobs:
  { job: 'miner',      biome: 'crop',     yields: 'food'  },
  { job: 'wood_maker', biome: 'crop',     yields: 'food'  },
  { job: 'crewmate',   biome: 'crop',     yields: 'food'  },
  { job: 'groomate',   biome: 'crop',     yields: 'food'  },
];

function canMine(player: Player, tile: Tile): ResourceId | null {
  const rule = MINE_RULES.find(
    r => r.job === player.job?.id && r.biome === tile.biome
  );
  return rule ? rule.yields : null;
}
```

**UI:** The Mine button on the action panel is enabled iff `canMine(activePlayer, currentTile)` returns a resource. On press, the resource is added to inventory and `actionsRemaining` decreases by 1.

---

### Make Action (Framework Only)

**Rule:** Make costs 1 action. Only the Maker can press it.

In Phase 3, pressing Make opens a modal that lists available recipes — but the recipe list is empty. The modal shows a "No recipes yet" message and a Close button. Closing the modal does **not** consume the action.

This phase exists to wire up the UI, the action button, the modal scaffolding, and the recipe data structure so that Phase 4 can drop in real recipes without restructuring.

```typescript
interface Recipe {
  id: string;
  displayName: string;
  inputs: { resource: ResourceId; quantity: number }[];
  output: { itemId: string; quantity: number };
}

const RECIPES: Recipe[] = []; // intentionally empty in Phase 3
```

**UI Layout:**
```
┌─────────────────────────────────────┐
│           MAKER WORKSHOP            │
│                                     │
│      No recipes available yet.      │
│         (Coming in Phase 4)         │
│                                     │
│              [ Close ]              │
└─────────────────────────────────────┘
```

---

### Trade Action

**Rule:** Trade is initiated by the active player only. It costs 1 action *only if a trade is accepted*. If the active player rejects all offers, or no in-range player makes any offer, no action is consumed.

#### Trade Range

A player is "in range" if their hex is the active player's hex OR a hex adjacent to it (distance ≤ 1 in axial hex coordinates). The 6 hex neighbors plus the current tile.

```typescript
function hexDistance(a: HexCoordinate, b: HexCoordinate): number {
  // Standard axial-coordinate hex distance
  return (Math.abs(a.q - b.q)
        + Math.abs(a.q + a.r - b.q - b.r)
        + Math.abs(a.r - b.r)) / 2;
}

function tradePartners(active: Player, all: Player[]): Player[] {
  return all.filter(p =>
    p.id !== active.id &&
    hexDistance(p.position, active.position) <= 1
  );
}
```

#### Trade Flow

1. Active player presses **Trade**. If no other players are in range, the button is disabled.
2. Active player picks one item from their inventory to **offer**.
3. Active player optionally picks a **requested item** by name (or leaves it open as "any offer").
4. The offer is broadcast to every in-range player simultaneously.
5. Each in-range player may either:
   - Submit one item from their inventory as a counter-offer, OR
   - Pass (no offer)
6. The active player sees all submitted offers and either:
   - **Accepts one** → items swap, 1 action consumed, trade ends
   - **Rejects all** → no swap, **0 actions consumed**, trade ends
7. If every in-range player passed, the trade ends with **0 actions consumed**.

**Important:** Even if the active player named a specific requested item, in-range players can still counter with whatever they want. The "requested item" is just a hint, not a constraint. The active player remains free to accept anything they like.

**Books are not tradeable.** A player's book never appears as a selectable item in the offer or counter-offer lists. If a player's only inventory item is a book, the Trade button is disabled (treat them as having nothing to offer).

```typescript
type TradePhase =
  | 'idle'
  | 'choosing_offer'    // active picks what to give + optional request
  | 'collecting_offers' // partners submit counter-offers or pass
  | 'choosing_response' // active reviews offers, accepts one or rejects all
  | 'complete';

interface TradeState {
  phase: TradePhase;
  activePlayerId: number;
  partnerIds: number[];                    // players in range when trade started
  offer: InventoryItem | null;             // what active player gives
  requestedItem: ResourceId | null;        // optional hint; not binding
  responses: Record<number, InventoryItem | null>; // partnerId → offered item or null (pass)
  accepted: number | null;                 // partnerId of accepted offer, or null
}
```

**UI Layout — Active Player's Offer Screen:**
```
┌───────────────────────────────────────┐
│              TRADE                    │
│                                       │
│  You will give:                       │
│   ( ) 1 wood    ( ) 1 plant           │
│   ( ) 1 metal   ( ) 1 food            │
│                                       │
│  You'd like (optional):               │
│   [▼ any item       ]                 │
│                                       │
│  Trading with: ● P2  ▲ P3             │
│                                       │
│       [ Cancel ]   [ Send Offer ]     │
└───────────────────────────────────────┘
```

**UI Layout — Partner Response Screen (each in-range player):**
```
┌───────────────────────────────────────┐
│  P1 offers you: 1 wood                │
│  They'd like: 1 metal                 │
│                                       │
│  Your counter-offer:                  │
│   ( ) 1 plant   ( ) 1 food            │
│   ( ) 1 metal   ( ) Pass              │
│                                       │
│             [ Submit ]                │
└───────────────────────────────────────┘
```

**UI Layout — Active Player's Decision Screen:**
```
┌───────────────────────────────────────┐
│        OFFERS RECEIVED                │
│                                       │
│  ● P2 offers: 1 metal      [ Accept ] │
│  ▲ P3 offers: 1 food       [ Accept ] │
│  ■ P4: passed                         │
│                                       │
│           [ Reject All ]              │
└───────────────────────────────────────┘
```

**Cancellation:** If the active player closes the trade modal during `choosing_offer`, no action is consumed. Once offers have been broadcast, the active player must either accept one or reject all (rejection is free).

---

### Inventory Display

Each player's side panel (built in Phase 2) gains an inventory section:

```
┌─────────────────────┐
│ ● Ruby Player        │
│ Job: Wood Maker      │
│ ❤️ ████████░░ 12/12  │
│ Orb: 🌿 Wood Orb     │
│ 📖 Has Book          │
│ Inventory:           │
│   🪵 wood × 2        │
│   🌱 plant × 1       │
│ Actions: 3           │
└─────────────────────┘
```

Empty inventory shows "—" or "(empty)".

---

### Updated Types

```typescript
// Add to existing types.ts

type ResourceId = 'metal' | 'wood' | 'plant' | 'food';

// Phase 2 already defined InventoryItem; reuse as-is. Phase 3 just populates it.

// Add to GameState:
interface GameState {
  // ...existing Phase 1 + Phase 2 fields...
  trade: TradeState | null;          // NEW - active trade, if any
  makerModalOpen: boolean;           // NEW - is the Make modal showing
}
```

---

### New Files Needed

```
terran-avengers/
└── src/
    ├── lib/
    │   ├── types.ts            ← UPDATE (add ResourceId, TradeState, Recipe)
    │   ├── gameState.ts        ← UPDATE (add mine/make/trade reducers)
    │   ├── mineRules.ts        ← NEW (MINE_RULES table + canMine helper)
    │   ├── recipes.ts          ← NEW (empty RECIPES array, Recipe type)
    │   └── hex.ts              ← UPDATE or NEW (hexDistance helper)
    └── components/
        ├── ActionPanel.svelte      ← NEW (Mine/Make/Trade buttons for active player)
        ├── MakerModal.svelte       ← NEW (empty-state recipe modal)
        ├── TradeModal.svelte       ← NEW (orchestrates all 3 trade phases)
        ├── TradeOffer.svelte       ← NEW (active player's offer screen)
        ├── TradeResponse.svelte    ← NEW (partner counter-offer screen)
        ├── TradeDecision.svelte    ← NEW (active player's accept/reject screen)
        ├── PlayerPanel.svelte      ← UPDATE (show inventory list)
        └── GameBoard.svelte        ← UPDATE (wire ActionPanel into the active player area)
```

---

### Phase 3 Deliverables Checklist

When Phase 3 is complete, the game should have:

- [ ] Active player's panel shows Mine, Make, and Trade buttons
- [ ] Mine button is enabled only when the player's job and biome combination is in MINE_RULES
- [ ] Pressing Mine adds 1 of the correct generic resource to the player's inventory
- [ ] Pressing Mine consumes 1 action
- [ ] Maker cannot mine in any biome
- [ ] Make button is enabled only for the Maker
- [ ] Pressing Make opens a modal that says "No recipes available yet"
- [ ] Closing the Make modal does NOT consume an action
- [ ] Trade button is disabled when no players are within 1 hex of the active player
- [ ] Trade modal lets active player pick one inventory item to offer
- [ ] Trade modal lets active player optionally name a requested item
- [ ] Each in-range player gets a response screen showing the offer
- [ ] Each in-range player can submit one counter-offer item or pass
- [ ] In-range players can counter with any item, regardless of what was requested
- [ ] Active player sees all submitted offers and can accept one or reject all
- [ ] Accepting an offer swaps the items between the two players and consumes 1 action
- [ ] Rejecting all offers consumes 0 actions
- [ ] No in-range player making an offer consumes 0 actions
- [ ] Cancelling the trade before sending the offer consumes 0 actions
- [ ] Books are excluded from the offer and counter-offer lists in the trade modal
- [ ] Trade button is disabled when the active player's only items are books
- [ ] Each player's side panel shows their inventory contents
- [ ] All Phase 1 and Phase 2 functionality still works

---

### DO NOT BUILD IN PHASE 3

Save these for later phases:
- Tool requirements for mining (rake, axe, hoe, pickaxe, sheers) → Phase 4
- Resource subtypes (titanium vs iron, fern vs ivy, types of wood) → Phase 4
  - **When metal subtypes land:** trading metal must specify the specific metal (titanium / iron / aluminum / tin / brass / steel). The trade UI must surface metal as its concrete subtype on both sides — no generic "metal" offers or requests once subtypes exist.
- Actual Maker recipes → Phase 4
- Crystals + penny flip in Cave → Phase 4
- Spells (D6 on stop) and upgraded spells → Phase 4
- Spawn blocks (3 hidden per tile) → Phase 4 or 5
- Forest practice area + chopping potential → Phase 4
- Crops (bacon, kidney beans, white beans) → Phase 4
- Monsters and damage → Phase 5
- Fallback when there are 0 Groomates or 0 Crewmates (open question — see chat) → revisit before Phase 5
