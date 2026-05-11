## TERRAN AVENGERS - PHASE 4: Maker Viability (Subtypes, Tools, Recipes)

### What's Being Added
Phase 4 makes the Maker actually do something. It introduces resource **subtypes** (titanium, iron, fern, etc. — no more generic "metal"), adds **tool requirements** for most mining, ships the first set of **Maker recipes** (alloys + tools), and adds a new **Make-request** flow so any player adjacent to the Maker can ask for a craft.

This phase deliberately stops short of: spells, books-as-inputs (upgraded spells), crystals + Cave, spawn blocks, Forest practice area, specific crops (bacon / kidney beans / white beans), monsters, and tool *strength* effects. Those become Phase 5+.

---

### What Players Will See & Do
1. Mining always returns a **specific subtype** rolled on a D6 (e.g., +1 titanium, not +1 metal).
2. Most mining now requires a tool. Mountain needs a pickaxe; Crop needs a hoe; Plants need sheers; Wood can be mined bare-handed (or with axe/pickaxe).
3. Inventory shows specific subtypes everywhere — `🪨 titanium × 2`, `🌿 fern × 1` — no generic `metal` line.
4. The Maker has a populated **recipes** list. Pressing **Make** on the Maker's own turn opens the Maker workshop with real recipes (alloys + tools).
5. Any player whose hex is within 1 of the Maker's hex sees an extra **Make** option in their action panel. Pressing it sends a craft request to the Maker, who can **Accept** or **Decline**. On Accept, the requester's inputs are spent immediately and they receive the output immediately; the Maker incurs an action **debt** that's paid out of their next turn.
6. The Trade modal now requires picking a specific subtype when offering or requesting metal/wood/plant (the deferred rule from Phase 3 lands here).

---

### Resource Subtypes

```typescript
// Replaces the Phase 3 ResourceId.
type MetalId =
  | 'titanium' | 'iron' | 'aluminum' | 'tin'   // mined
  | 'brass'    | 'steel';                       // made (alloys)

type WoodId   = 'leaves' | 'inside_wood' | 'bark' | 'sticks';
type PlantId  = 'fern' | 'ivy';
type FoodId   = 'food';   // crops stay generic until specific-crops phase

type ResourceId = MetalId | WoodId | PlantId | FoodId;
```

**Notes:**
- "Hardwood" is intentionally not modeled in Phase 4. Defer.
- Food stays generic — specific crops (bacon, kidney beans, white beans) ship in a later phase.
- The trade rule documented at the end of Phase 3 ("when you trade metal you have to say the specific metal") activates now and applies to all subtyped resources, not just metal. The trade modal must surface metal/wood/plant as their concrete subtypes.

---

### Mine Action — Subtypes via D6

**Rule:** Mine costs 1 action. Job + biome gating from Phase 3 is unchanged. New: tool requirements (see below) and a D6 roll on success that picks the subtype. Yield is always +1 of the rolled subtype.

#### Per-Biome D6 Tables

| Biome    | Roll → Subtype                                                         |
|----------|------------------------------------------------------------------------|
| Mountain | 1 = titanium · 2 = iron · 3 = iron · 4 = aluminum · 5 = tin · 6 = tin |
| Forest (wood mine) | 1 = inside_wood · 2 = bark · 3 = bark · 4 = sticks · 5 = sticks · 6 = leaves |
| Forest (ivy mine, requires iron sheers) | always 1 ivy, no roll                          |
| Prairie  | always 1 fern, no roll *(requires bronze sheers)*                      |
| Crop     | always 1 food, no roll                                                 |

Distribution intent: rare metals/woods roll lower, common roll higher. Tune later.

#### Branching in Forest

The Wood Maker in Forest now has **two** Mine variants in the action panel:
- **Mine Wood** — bare-handed OK; with axe/pickaxe also OK
- **Mine Ivy** — requires iron sheers in inventory

Showing both as separate buttons (or one Mine button that opens a "what do you want to mine?" picker if multiple branches are available) is a UI choice; recommend two separate buttons for discoverability.

```typescript
type MineTarget =
  | { kind: 'random_subtype'; biome: BiomeType; resource: 'metal' | 'wood' | 'plant' | 'food'; tableId: string }
  | { kind: 'fixed'; biome: BiomeType; resource: ResourceId };

interface MineOption {
  id: string;                     // 'mine_wood', 'mine_ivy', etc.
  label: string;                  // 'Mine Wood'
  job: JobType;
  biome: BiomeType;
  toolRequirement: ToolRequirement | null;
  target: MineTarget;
}
```

---

### Tool Requirements

| Action          | Tool needed                            | Notes                                              |
|-----------------|----------------------------------------|----------------------------------------------------|
| Mountain mining | **Pickaxe** (any metal variant)        |                                                    |
| Forest wood mining | None / axe / pickaxe (any of these) | Bare hands allowed for wood. Hardwood deferred.    |
| Forest ivy mining  | **Iron sheers**                     | Iron sheers specifically; other sheers don't mine ivy. |
| Prairie plant mining | **Bronze sheers**                  | Bronze sheers specifically.                         |
| Crop mining     | **Hoe** (any metal variant)             |                                                    |

```typescript
type ToolKind = 'pickaxe' | 'axe' | 'hoe' | 'rake' | 'sheers' | 'sword';

interface ToolRequirement {
  kind: ToolKind;
  metal?: MetalId;       // present for sheers (iron/bronze); absent for "any metal" tools
}
```

**Notes:**
- Strength differences between metal variants are **deferred**. In Phase 4, an iron pickaxe and a tin pickaxe are functionally identical for unlocking mining; they're just two separate items.
- Sheers are the exception: iron sheers specifically unlock ivy; bronze sheers specifically unlock fern. Other sheers metals don't unlock either yet.
- The Mine button is disabled (with a tooltip naming the missing tool) when the active player lacks the required tool.

---

### Tool & Alloy Recipes

Phase 4 ships two recipe families: **alloys** (combine base metals into brass/steel) and **tools** (combine metal + wood into a tool item).

#### Tools that come in metal variants
**Sheers**, **Pickaxe**, **Axe** — separate item per metal, separate recipe per metal.

#### Tools that are generic (one recipe, output works regardless of metal used)
**Rake**, **Hoe**, **Sword** — the recipe accepts any metal and produces a single generic tool item.

#### Recipe Catalog (Phase 4 starter set)

```typescript
interface Recipe {
  id: string;
  displayName: string;
  inputs: { resource: ResourceId; quantity: number }[];
  output: { itemId: string; quantity: number };
}

const RECIPES: Recipe[] = [
  // ── Alloys ────────────────────────────────────────────────────
  { id: 'brass', displayName: 'Brass',
    inputs: [{ resource: 'tin', quantity: 1 }, { resource: 'aluminum', quantity: 1 }],
    output: { itemId: 'brass', quantity: 1 } },

  { id: 'steel', displayName: 'Steel',
    inputs: [{ resource: 'iron', quantity: 1 }, { resource: 'titanium', quantity: 1 }],
    output: { itemId: 'steel', quantity: 1 } },

  // ── Sheers (per-metal) ────────────────────────────────────────
  { id: 'iron_sheers',   displayName: 'Iron Sheers',
    inputs: [{ resource: 'iron',  quantity: 1 }, { resource: 'sticks', quantity: 1 }],
    output: { itemId: 'iron_sheers', quantity: 1 } },

  { id: 'brass_sheers',  displayName: 'Bronze Sheers',
    inputs: [{ resource: 'brass', quantity: 1 }, { resource: 'sticks', quantity: 1 }],
    output: { itemId: 'brass_sheers', quantity: 1 } },

  // ── Pickaxes (per-metal) ──────────────────────────────────────
  { id: 'tin_pickaxe',      displayName: 'Tin Pickaxe',
    inputs: [{ resource: 'tin',      quantity: 1 }, { resource: 'sticks', quantity: 1 }],
    output: { itemId: 'tin_pickaxe', quantity: 1 } },

  { id: 'iron_pickaxe',     displayName: 'Iron Pickaxe',
    inputs: [{ resource: 'iron',     quantity: 1 }, { resource: 'sticks', quantity: 1 }],
    output: { itemId: 'iron_pickaxe', quantity: 1 } },

  { id: 'steel_pickaxe',    displayName: 'Steel Pickaxe',
    inputs: [{ resource: 'steel',    quantity: 1 }, { resource: 'sticks', quantity: 1 }],
    output: { itemId: 'steel_pickaxe', quantity: 1 } },

  // ── Axes (per-metal) ──────────────────────────────────────────
  { id: 'iron_axe',  displayName: 'Iron Axe',
    inputs: [{ resource: 'iron',  quantity: 1 }, { resource: 'sticks', quantity: 1 }],
    output: { itemId: 'iron_axe', quantity: 1 } },

  { id: 'steel_axe', displayName: 'Steel Axe',
    inputs: [{ resource: 'steel', quantity: 1 }, { resource: 'sticks', quantity: 1 }],
    output: { itemId: 'steel_axe', quantity: 1 } },

  // ── Generic tools (one recipe, accepts any metal) ─────────────
  // The "any metal" input is modeled with a wildcard pattern in code; see notes below.
  { id: 'rake',  displayName: 'Rake',
    inputs: [{ resource: '*metal', quantity: 1 }, { resource: 'sticks', quantity: 1 }],
    output: { itemId: 'rake', quantity: 1 } },

  { id: 'hoe',   displayName: 'Hoe',
    inputs: [{ resource: '*metal', quantity: 1 }, { resource: 'sticks', quantity: 1 }],
    output: { itemId: 'hoe', quantity: 1 } },

  { id: 'sword', displayName: 'Sword',
    inputs: [{ resource: '*metal', quantity: 1 }, { resource: 'sticks', quantity: 1 }],
    output: { itemId: 'sword', quantity: 1 } },
];
```

**Wildcard inputs (`*metal`):** generic tools accept any single metal subtype as the metal input. In code, model this as a special input matcher rather than a real resource ID:

```typescript
type RecipeInput =
  | { kind: 'exact';    resource: ResourceId;             quantity: number }
  | { kind: 'anyOf';    resources: readonly ResourceId[]; quantity: number }; // *metal = anyOf([titanium, iron, aluminum, tin, brass, steel])
```

The Make UI for a wildcard input shows a dropdown so the player picks which subtype to consume.

**Starter set rationale:** ship enough recipes to bootstrap mining (you need an iron pickaxe to mine iron, etc.) without exploding the catalog. Tin/aluminum pickaxes and bronze pickaxes can be added later if needed; the Phase 4 set above lets a fresh game reach every other recipe.

---

### Make Action

Phase 4 has **two** entry points to Make.

#### A) Maker self-Make (extends Phase 3)

When the Maker is the active player and presses **Make**, the modal shows all `RECIPES`. Each recipe shows whether its inputs are satisfied by the Maker's own inventory; only satisfied recipes have an enabled **Craft** button.

- Crafting consumes 1 of the Maker's current actions.
- Inputs are removed from the Maker's inventory; output is added to the Maker's inventory.

#### B) Make request from an adjacent player (NEW)

Any player whose hex is within 1 of the Maker's hex (same range rule as Trade) sees a **Make** button on their own action panel during their own turn. Pressing it opens a modal listing recipes whose inputs are satisfied by the **requester's** inventory.

The requester picks a recipe and submits the request. The Maker is shown a prompt:

```
┌───────────────────────────────────────┐
│         CRAFT REQUEST                 │
│                                       │
│  ● P3 (Crewmate) asks you to craft:   │
│     🛠️ Iron Sheers                    │
│                                       │
│  Inputs (from P3): 1 iron, 1 sticks   │
│  Costs you: 1 action from next turn   │
│                                       │
│      [ Decline ]      [ Accept ]      │
└───────────────────────────────────────┘
```

**On Accept:**
- The requester's 1 action is consumed (already debited when they pressed Make).
- The recipe's inputs are removed from the requester's inventory immediately.
- The output is added to the requester's inventory immediately.
- The Maker's `actionDebt` increases by 1.

**On Decline:**
- 0 actions consumed for either player.
- 0 inputs leave the requester.
- The requester's "Make" press refunds the action it had reserved.

#### Maker action debt

A new player field `actionDebt: number` tracks pending Maker actions owed.

- At the start of the Maker's turn, set `actionsRemaining = max(0, baseActionsPerTurn - actionDebt)` and reset `actionDebt = 0`.
- Debt is uncapped — multiple accepted requests on the same external turn can drive `actionsRemaining` to 0 next turn. (Going **negative** is allowed mathematically but is clamped at 0 actions for the next turn; any leftover debt is **discarded**, not carried forward. This keeps the design simple: Maker can always say no if they don't want to overcommit.)

```typescript
interface Player {
  // ...existing fields...
  actionDebt: number;   // NEW; only meaningful for the Maker
}

interface CraftRequest {
  requesterId: number;
  recipeId: string;
  inputSelection: Record<string, ResourceId>; // for *metal wildcard inputs
}

interface GameState {
  // ...existing fields...
  pendingCraftRequest: CraftRequest | null;   // NEW
}
```

**Edge cases:**
- If the Maker is not in the game (≤0 Maker players), the requester's Make button is disabled. (Phase 2 enforced exactly one Maker, so this is theoretical until Phase 5 fallback work.)
- If the Maker moves out of range between request and response: Phase 4 simplification — the request is resolved using the Maker's position **at request time**. Maker still gets to Accept/Decline.
- If the requester's inventory changes between request submission and Maker's response (it can't, because turns are sequential), no special handling needed.
- If the Maker is the **requester** of their own Make: not possible via flow B; they use flow A on their own turn.

---

### Trade Modal Updates

The Phase 3 trade modal needs three changes:

1. **Subtypes everywhere.** The "you'd like (optional)" dropdown lists every concrete subtype (titanium, iron, ..., fern, ivy, sticks, ...) instead of generic resource categories. The offer list already shows each inventory item, so it gets subtypes for free as inventory items become subtyped.
2. **Books still excluded.** Phase 3 rule unchanged — books never appear in offer or counter-offer lists.
3. **Tools tradeable.** Tools are normal inventory items; they appear in offer / counter-offer lists by default. (No new code; just verify nothing accidentally filters them out.)

No new trade flow logic; only the data presented to the modal changes.

---

### Inventory Display

Each player's side panel shows inventory grouped by item, using subtype names directly:

```
┌─────────────────────┐
│ ● Ruby Player        │
│ Job: Wood Maker      │
│ ❤️ ████████░░ 12/12  │
│ Orb: 🌿 Wood Orb     │
│ 📖 Has Book          │
│ Inventory:           │
│   🪵 sticks × 2      │
│   🌿 leaves × 1      │
│   ⛏️ iron × 1        │
│   🛠️ Iron Sheers     │
│ Actions: 3           │
│ (Action debt: 1)     │  ← only shown for Maker, only if > 0
└─────────────────────┘
```

Subtypes get their own icons:
- Metals: `🟫 titanium`, `⚙️ iron`, `🔩 aluminum`, `🪙 tin`, `🟡 brass`, `⚒️ steel`
- Woods: `🍃 leaves`, `🪵 inside_wood`, `🌳 bark`, `🪄 sticks`
- Plants: `🌿 fern`, `🍀 ivy`
- Tools: per-tool icon (e.g., `🛠️` for sheers, `⛏️` for pickaxe, `🪓` for axe)

(Final icon choices are a polish detail — the requirement is "every subtype is visually distinguishable in the panel".)

---

### Updated Types

```typescript
// types.ts — replaces ResourceId

type MetalId  = 'titanium' | 'iron' | 'aluminum' | 'tin' | 'brass' | 'steel';
type WoodId   = 'leaves' | 'inside_wood' | 'bark' | 'sticks';
type PlantId  = 'fern' | 'ivy';
type FoodId   = 'food';
type ResourceId = MetalId | WoodId | PlantId | FoodId;

const METAL_IDS: readonly MetalId[]  = ['titanium','iron','aluminum','tin','brass','steel'] as const;
const WOOD_IDS:  readonly WoodId[]   = ['leaves','inside_wood','bark','sticks'] as const;
const PLANT_IDS: readonly PlantId[]  = ['fern','ivy'] as const;

type ToolKind = 'pickaxe' | 'axe' | 'hoe' | 'rake' | 'sheers' | 'sword';

interface ToolRequirement {
  kind: ToolKind;
  metal?: MetalId;
}

// gameState.ts — additions
interface Player {
  // ...existing fields...
  actionDebt: number;
}

interface GameState {
  // ...existing fields...
  pendingCraftRequest: CraftRequest | null;
}
```

---

### File Plan

```
terran-avengers/
└── src/
    ├── lib/
    │   ├── types.ts                ← UPDATE (subtype unions, ToolKind, ToolRequirement, CraftRequest, actionDebt)
    │   ├── mineRules.ts            ← UPDATE (replace MINE_RULES with MineOption[]; add per-biome D6 tables; add tool gating)
    │   ├── recipes.ts              ← UPDATE (populate RECIPES with alloys + tools; add wildcard input matcher)
    │   ├── tools.ts                ← NEW (helpers: hasTool, getToolForRecipe, isToolItem)
    │   ├── gameState.ts            ← UPDATE (new actions: requestCraft, acceptCraft, declineCraft; update mine to roll D6; refresh Maker turn-start to apply debt)
    │   └── recipes.test.ts         ← NEW (smoke test that every recipe is reachable from a fresh game)
    └── components/
        ├── ActionPanel.svelte      ← UPDATE (split Mine into branched options when biome has multiple targets; show "Make" button for adjacent-to-Maker players; tooltip explains missing tool)
        ├── MakerModal.svelte       ← UPDATE (real recipe list, satisfied/unsatisfied indicator, wildcard input dropdowns)
        ├── CraftRequestPrompt.svelte ← NEW (Maker's Accept/Decline modal)
        ├── TradeModal.svelte       ← UPDATE (subtype dropdown for "you'd like"; verify tools render correctly in offer list)
        └── PlayerPanel.svelte      ← UPDATE (subtype names + icons; show action debt on Maker)
```

---

### Phase 4 Deliverables Checklist

When Phase 4 is complete, the game should have:

#### Subtypes
- [ ] `ResourceId` is the union of metal/wood/plant/food subtypes — no generic `'metal' | 'wood' | 'plant'` anywhere
- [ ] Mining a Mountain tile yields a specific metal subtype rolled on D6 per the Mountain table
- [ ] Mining a Forest tile (wood branch) yields a specific wood subtype rolled on D6 per the Forest wood table
- [ ] Player inventory displays specific subtype names + icons; no generic "metal" / "wood" / "plant" lines remain

#### Tools & gating
- [ ] Mountain mining is disabled unless the active player holds a pickaxe of any metal
- [ ] Forest wood mining is enabled with axe, pickaxe, or no tool at all
- [ ] Forest ivy mining is enabled only with iron sheers and yields exactly 1 ivy per press
- [ ] Prairie mining is enabled only with bronze sheers and yields exactly 1 fern per press
- [ ] Crop mining is enabled only with a hoe of any metal
- [ ] Disabled Mine buttons show a tooltip naming the missing tool

#### Recipes & Maker self-Make
- [ ] Maker workshop modal lists every recipe in `RECIPES`
- [ ] Recipes whose inputs are not satisfied are clearly marked and the Craft button is disabled
- [ ] Wildcard `*metal` inputs render a dropdown so the player picks which metal to consume
- [ ] Crafting on the Maker's own turn consumes 1 action and swaps inputs/output in the Maker's inventory
- [ ] Brass = tin + aluminum; steel = iron + titanium; per-metal sheers/pickaxe/axe recipes exist for the metals listed
- [ ] Generic rake / hoe / sword recipes accept any metal and produce a single generic tool item

#### Make-request flow
- [ ] Players whose hex is within 1 of the Maker's hex see a **Make** button on their own action panel during their own turn
- [ ] Pressing **Make** as a non-Maker opens a modal listing recipes the requester's own inventory can satisfy
- [ ] Submitting a request shows the Maker an Accept / Decline prompt naming the requester, the recipe, and the inputs
- [ ] On Decline: 0 actions consumed for either player, 0 inputs leave the requester, no item produced
- [ ] On Accept: requester loses 1 action and the inputs immediately, gains the output immediately, and the Maker's `actionDebt` increments by 1
- [ ] At the start of the Maker's next turn, `actionsRemaining = max(0, baseActions - actionDebt)` and `actionDebt` resets to 0
- [ ] When the Maker has unpaid debt, the player panel shows it (e.g., `Action debt: 2`)

#### Trade rules carried over
- [ ] Trade modal "you'd like" dropdown lists subtype IDs, not generic resource categories
- [ ] Books are still excluded from offer and counter-offer lists (Phase 3 rule unchanged)

#### Regression
- [ ] All Phase 1, 2, and 3 features still work, including mining Crops, the existing trade flow, and the empty-state Maker modal for jobs other than Maker (now replaced with the populated workshop)

---

### DO NOT BUILD IN PHASE 4

Save these for later phases:
- **Spells** (D6 on stop, upgraded spells via book + spell traded to Maker) → Phase 5
- **Crystals + Cave** (penny flip mining) → Phase 5
- **Spawn blocks** (3 hidden per tile) → Phase 5 or 6
- **Forest practice area** (live plants returned to chop again) → Phase 5
- **Specific crops** (bacon / kidney beans / white beans replacing generic food) → Phase 5
- **Tool strength differentiation** (e.g., iron axe chops faster than tin axe; using stronger sheers pulls roots) → Phase 5+
- **Hardwood** as a separate wood subtype → Phase 5+
- **Orbs / potions / monsters** → Phase 6+
- **Fallback when there are 0 Groomates or 0 Crewmates** → revisit before Phase 5
- **Variable yields per Mine** (the original fern table's `6=fern, 5=half, 4=tiny...` size variants) — Phase 4 always yields exactly 1 unit; size variants come back when other mechanics need them.
