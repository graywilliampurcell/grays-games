## TERRAN AVENGERS - PHASE 1: Basic Movement & Board

### What Players Will See & Do:
1. A hexagonal game board with 7 different colored biomes
2. 2-4 player tokens (different colors/shapes) on the board
3. Click on a tile next to your player to move there
4. See whose turn it is
5. Pass turn to next player

### Visual Design:
- **Board:** Hexagons arranged in a pattern (maybe 5-7 tiles across)
- **Biomes:** Each biome gets a color:
  - Crop: Yellow/Gold
  - Field: Light Green
  - Forest: Dark Green
  - Mountain: Gray
  - Cave: Dark Brown/Black
  - Lake: Blue
  - Prairie: Tan/Beige
- **Players:** Simple colored circles or triangles on top of tiles
- **UI:** 
  - Top: "Player 1's Turn" (changes color with current player)
  - Bottom: "End Turn" button

### Game Rules to Code:
1. Players take turns (Player 1 → Player 2 → Player 3 → etc.)
2. On your turn, click an adjacent tile to move there (costs 1 action)
3. You get 1 action per turn (for now)
4. Can't jump over tiles - must be next to where you are
5. Multiple players CAN be on same tile
6. After moving, turn automatically passes OR click "End Turn"

---

## TECHNICAL PLAN FOR CODING AGENT

### Recommended Tech Stack:
**Framework:** Svelte + SvelteKit (or React if you prefer)
- Svelte is simpler and faster than React
- Great for game UI that updates frequently
- Easy to learn

**Runtime:** Bun
- Fast TypeScript support built-in
- Works great with Svelte/React

**Rendering:** HTML Canvas or SVG
- SVG is easier for hexagons and clicking
- Canvas is faster but more code

**My recommendation:** **SvelteKit + Bun + SVG**

### Project Setup Commands:
```bash
bun create svelte@latest terran-avengers
cd terran-avengers
bun install
bun run dev
```

### File Structure:
```
terran-avengers/
├── src/
│   ├── lib/
│   │   ├── types.ts          # TypeScript types
│   │   ├── hexUtils.ts       # Hexagon math helpers
│   │   └── gameState.ts      # Game state management
│   ├── components/
│   │   ├── HexTile.svelte    # Single hexagon tile
│   │   ├── Player.svelte     # Player token
│   │   ├── GameBoard.svelte  # The whole board
│   │   └── TurnDisplay.svelte # Shows whose turn
│   └── routes/
│       └── +page.svelte       # Main game page
└── package.json
```

---

## KEY CODE PIECES NEEDED

### 1. TypeScript Types (`src/lib/types.ts`)
```typescript
export type BiomeType = 'crop' | 'field' | 'forest' | 'mountain' | 'cave' | 'lake' | 'prairie';

export interface HexCoordinate {
  q: number;  // column
  r: number;  // row
  // Using "axial coordinates" for hex grid
}

export interface Tile {
  coord: HexCoordinate;
  biome: BiomeType;
}

export interface Player {
  id: number;
  color: string;
  position: HexCoordinate;
  actionsRemaining: number;
}

export interface GameState {
  tiles: Tile[];
  players: Player[];
  currentPlayerIndex: number;
}
```

### 2. Hexagon Math (`src/lib/hexUtils.ts`)
**Functions needed:**
- `getNeighbors(coord: HexCoordinate): HexCoordinate[]` - Returns 6 adjacent hexes
- `coordsEqual(a: HexCoordinate, b: HexCoordinate): boolean` - Check if same tile
- `hexToPixel(coord: HexCoordinate, size: number): {x: number, y: number}` - Convert hex coord to screen position
- `generateHexBoard(radius: number): HexCoordinate[]` - Create circular/hex-shaped board

**Reference:** Use "axial coordinates" system (search: "hexagonal grids axial coordinates")

### 3. Game State Management (`src/lib/gameState.ts`)
```typescript
import { writable } from 'svelte/store';

export const gameState = writable<GameState>({
  tiles: [], // Initialize with board
  players: [
    { id: 1, color: '#FF6B6B', position: {q: 0, r: 0}, actionsRemaining: 1 },
    { id: 2, color: '#4ECDC4', position: {q: 1, r: 0}, actionsRemaining: 1 }
  ],
  currentPlayerIndex: 0
});

export function movePlayer(playerId: number, newPosition: HexCoordinate) {
  // Update player position
  // Decrease actionsRemaining
}

export function endTurn() {
  // Move to next player
  // Reset actionsRemaining to 1
}
```

### 4. Hex Tile Component (`src/components/HexTile.svelte`)
```typescript
<script lang="ts">
  export let coord: HexCoordinate;
  export let biome: BiomeType;
  export let isClickable: boolean = false;
  export let onClick: () => void;

  const biomeColors = {
    crop: '#FFD93D',
    field: '#A8E6A1',
    forest: '#2D5016',
    mountain: '#8B8B8B',
    cave: '#2C1810',
    lake: '#4A90E2',
    prairie: '#D4A574'
  };

  // Calculate pixel position
  // Draw hexagon as SVG polygon
  // Add click handler if isClickable
</script>
```

### 5. Game Logic - Movement Validation
```typescript
function canMoveTo(player: Player, targetCoord: HexCoordinate, tiles: Tile[]): boolean {
  // Check if player has actions remaining
  if (player.actionsRemaining <= 0) return false;
  
  // Check if target tile exists on board
  const tileExists = tiles.some(t => coordsEqual(t.coord, targetCoord));
  if (!tileExists) return false;
  
  // Check if target is adjacent (neighbor)
  const neighbors = getNeighbors(player.position);
  const isAdjacent = neighbors.some(n => coordsEqual(n, targetCoord));
  
  return isAdjacent;
}
```

---

## PHASE 1 DELIVERABLES CHECKLIST

When Phase 1 is complete, the game should have:
- [ ] Hexagonal board with 7+ tiles in different biomes
- [ ] 2-4 player tokens shown on board
- [ ] Click adjacent tile to move (only if it's your turn)
- [ ] Turn indicator showing current player
- [ ] "End Turn" button that works
- [ ] Players can be on same tile
- [ ] Can't move to non-adjacent tiles
- [ ] Can't move when out of actions
- [ ] Visual feedback when hovering valid moves

---

