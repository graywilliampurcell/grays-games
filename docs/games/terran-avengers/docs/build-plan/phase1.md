## TERRAN AVENGERS - PHASE 1: Basic Movement & Board

### What Players Will See & Do:
1. A hexagonal game board with 7 different colored biomes (37 tiles, radius 3)
2. Player count selector (3-5 players) before starting the game
3. Player tokens (different jewel colors + unique shapes) on the board
4. Click on a tile next to your player to move there
5. See whose turn it is
6. Press "End Turn" button to pass turn to next player

### Visual Design:
- **Layout:** Board centered on page, controls on either side
- **Board:** Flat-top hexagons arranged in a hex pattern (radius 3, 37 tiles total)
- **Biomes:** Each biome gets a color:
  - Crop: Yellow/Gold (#FFD93D)
  - Field: Light Green (#A8E6A1)
  - Forest: Dark Green (#2D5016)
  - Mountain: Gray (#8B8B8B)
  - Cave: Dark Brown/Black (#2C1810)
  - Lake: Blue (#4A90E2)
  - Prairie: Tan/Beige (#D4A574)
- **Players:** Jewel-toned colored shapes (see Player Configuration below)
- **Multiple Players on Same Tile:** Visually offset from each other (arranged in cluster)
- **UI:**
  - Pre-game: Player count selector (3-5 players)
  - Center tile: "START" button (disappears after pressed)
  - Top: "Player 1's Turn" (changes color with current player)
  - Bottom: "End Turn" button
  - Controls positioned on either side of centered board

### Game Rules to Code:
1. Players take turns (Player 1 → Player 2 → Player 3 → etc.)
2. On your turn, click an adjacent tile to move there (costs 1 action)
3. You get 1 action per turn (for now)
4. Can't jump over tiles - must be next to where you are
5. Multiple players CAN be on same tile (visually offset)
6. Click "End Turn" button to pass turn (NO auto-pass after moving)
7. All players start at center tile (Lake zone)

---

## PLAYER COLORS + SHAPES CONFIGURATION

### Player Configuration

```typescript
type PlayerShape = 'circle' | 'triangle' | 'square' | 'diamond' | 'star';

interface PlayerConfig {
  id: number;
  name: string;
  color: string;
  shape: PlayerShape;
  displayName: string;
}

const PLAYER_CONFIGS: PlayerConfig[] = [
  {
    id: 1,
    name: 'player1',
    color: '#E63946',      // Ruby Red
    shape: 'circle',
    displayName: 'Ruby Player (Red Circle)'
  },
  {
    id: 2,
    name: 'player2',
    color: '#457B9D',      // Sapphire Blue
    shape: 'triangle',
    displayName: 'Sapphire Player (Blue Triangle)'
  },
  {
    id: 3,
    name: 'player3',
    color: '#2A9D8F',      // Emerald Green
    shape: 'square',
    displayName: 'Emerald Player (Green Square)'
  },
  {
    id: 4,
    name: 'player4',
    color: '#F4A261',      // Amber Orange
    shape: 'diamond',
    displayName: 'Amber Player (Orange Diamond)'
  },
  {
    id: 5,
    name: 'player5',
    color: '#9B59B6',      // Amethyst Purple
    shape: 'star',
    displayName: 'Amethyst Player (Purple Star)'
  }
];
```

### Player Display Helper

```typescript
function getPlayerDisplayInfo(player: Player): {
  color: string;
  shape: string;
  icon: string;
  name: string;
} {
  const shapeSymbols = {
    circle: '●',
    triangle: '▲',
    square: '■',
    diamond: '♦',
    star: '★'
  };

  return {
    color: player.config.color,
    shape: player.config.shape,
    icon: shapeSymbols[player.config.shape],
    name: player.config.displayName
  };
}
```

### Multiple Players on Same Tile - Offset Positions

```typescript
// When multiple players are on the same tile, offset them visually
function getPlayerOffsets(playerCount: number, tokenSize: number): {x: number, y: number}[] {
  const offset = tokenSize * 0.6;

  switch (playerCount) {
    case 1:
      return [{x: 0, y: 0}];
    case 2:
      return [{x: -offset/2, y: 0}, {x: offset/2, y: 0}];
    case 3:
      return [
        {x: 0, y: -offset/2},
        {x: -offset/2, y: offset/2},
        {x: offset/2, y: offset/2}
      ];
    case 4:
      return [
        {x: -offset/2, y: -offset/2},
        {x: offset/2, y: -offset/2},
        {x: -offset/2, y: offset/2},
        {x: offset/2, y: offset/2}
      ];
    case 5:
      return [
        {x: 0, y: -offset},
        {x: -offset, y: 0},
        {x: offset, y: 0},
        {x: -offset/2, y: offset},
        {x: offset/2, y: offset}
      ];
    default:
      return [{x: 0, y: 0}];
  }
}
```

---

## BIOME LAYOUT IMPLEMENTATION RULES

### Board Specifications

**Total Tiles:** 37 hexagonal tiles arranged in rings (formula: 3r² + 3r + 1 where r=3)
- Ring 0 (center): 1 tile
- Ring 1: 6 tiles
- Ring 2: 12 tiles
- Ring 3: 18 tiles
- **Total: 1 + 6 + 12 + 18 = 37 tiles**

**Hexagon Geometry (Flat-Top Orientation):**
- Hex size (center to corner): 35 pixels
- Hex width (flat edge to flat edge): 35 × 2 = 70 pixels
- Hex height (corner to corner): 35 × √3 ≈ 60.62 pixels
- Horizontal spacing: 70 × 3/4 = 52.5 pixels
- Vertical spacing: 60.62 pixels

**Flat-Top Hex to Pixel Conversion:**
```typescript
function hexToPixel(q: number, r: number, size: number): {x: number, y: number} {
  const x = size * (3/2 * q);
  const y = size * (Math.sqrt(3)/2 * q + Math.sqrt(3) * r);
  return {x, y};
}
```

### Biome Types (7 total)

```typescript
type BiomeType = 'prairie' | 'forest' | 'field' | 'crop' | 'lake' | 'mountain' | 'cave';

const BIOME_COLORS: Record<BiomeType, string> = {
  prairie: '#D4A574',
  forest: '#2D5016',
  field: '#A8E6A1',
  crop: '#FFD93D',
  lake: '#4A90E2',
  mountain: '#8B8B8B',
  cave: '#2C1810'
};
```

### Layout Algorithm: Wedge Zones with Lake Center

**Zone Structure:**
- Lake zone: 7 tiles (center + ring 1) - ALWAYS lake
- 6 outer wedge zones: 5 tiles each (30 tiles from rings 2 and 3)
- Biomes assigned sequentially to create wedge-shaped zones

**Zone Sizes:**
```typescript
const LAKE_ZONE_SIZE = 7;  // center + ring 1
const OUTER_ZONE_SIZE = 5; // each of the 6 outer biomes
// Total: 7 + (6 × 5) = 37 tiles
```

**Generate Board Layout:**

```typescript
function generateBoard(): Tile[] {
  // 1. Generate all 37 hex coordinates in ring order
  const allCoords = generateHexCoordinates();

  // 2. Lake zone is ALWAYS the first 7 (center + ring 1)
  const lakeCoords = allCoords.slice(0, 7);

  // 3. Remaining 30 tiles for outer zones
  const outerCoords = allCoords.slice(7);

  // 4. Shuffle the 6 non-lake biomes
  const otherBiomes: BiomeType[] = ['prairie', 'forest', 'field', 'crop', 'mountain', 'cave'];
  shuffle(otherBiomes);

  // 5. Build tile array
  const tiles: Tile[] = [];

  // Assign lake zone
  lakeCoords.forEach(coord => {
    tiles.push({ coord, biome: 'lake' });
  });

  // Assign outer zones (5 tiles each, creates wedge shapes)
  let coordIndex = 0;
  otherBiomes.forEach(biome => {
    for (let i = 0; i < 5; i++) {
      tiles.push({
        coord: outerCoords[coordIndex],
        biome
      });
      coordIndex++;
    }
  });

  return tiles;
}
```

**Generate Hex Coordinates (Ring Order):**

```typescript
function generateHexCoordinates(): HexCoordinate[] {
  const coords: HexCoordinate[] = [];

  // Ring 0: center
  coords.push({q: 0, r: 0});

  // Rings 1-3
  for (let ring = 1; ring <= 3; ring++) {
    // Start at "top" of ring and walk around
    let q = 0;
    let r = -ring;

    // 6 directions to walk around the ring
    const directions = [
      {q: 1, r: 0},   // SE
      {q: 0, r: 1},   // S
      {q: -1, r: 1},  // SW
      {q: -1, r: 0},  // NW
      {q: 0, r: -1},  // N
      {q: 1, r: -1}   // NE
    ];

    for (const dir of directions) {
      for (let step = 0; step < ring; step++) {
        coords.push({q, r});
        q += dir.q;
        r += dir.r;
      }
    }
  }

  return coords;
}
```

### Key Rules for Implementation

**RULE 1: Lake Zone is Sacred**
- Lake zone MUST always be the center 7 tiles (ring 0 + ring 1)
- Players ALWAYS start at center tile (0, 0)
- This never changes between games

**RULE 2: Wedge Zones**
- The 6 outer biomes form wedge-shaped zones
- Tiles are assigned sequentially in ring order
- Shuffling biomes randomizes which biome gets which wedge

**RULE 3: Zone Sizes**
- Lake: exactly 7 tiles (center + ring 1)
- Other zones: exactly 5 tiles each
- Total: 7 + (6 × 5) = 37 tiles

**RULE 4: Neighbor Calculation (Flat-Top)**
```typescript
function getNeighbors(coord: HexCoordinate): HexCoordinate[] {
  const directions = [
    {q: 1, r: 0},   // E
    {q: 1, r: -1},  // NE
    {q: 0, r: -1},  // NW
    {q: -1, r: 0},  // W
    {q: -1, r: 1},  // SW
    {q: 0, r: 1}    // SE
  ];

  return directions.map(dir => ({
    q: coord.q + dir.q,
    r: coord.r + dir.r
  }));
}

function coordsEqual(a: HexCoordinate, b: HexCoordinate): boolean {
  return a.q === b.q && a.r === b.r;
}
```

**RULE 5: Starting Position**
```typescript
function getStartingPosition(): HexCoordinate {
  return {q: 0, r: 0}; // Center tile (Lake zone)
}
```

### Rendering Rules

**Biome Colors with Text Visibility:**
```typescript
function getBiomeStyle(biome: BiomeType): { fill: string, textColor: string } {
  const styles: Record<BiomeType, { fill: string, textColor: string }> = {
    prairie:  { fill: '#D4A574', textColor: '#000000' },
    forest:   { fill: '#2D5016', textColor: '#FFFFFF' },
    field:    { fill: '#A8E6A1', textColor: '#000000' },
    crop:     { fill: '#FFD93D', textColor: '#000000' },
    lake:     { fill: '#4A90E2', textColor: '#FFFFFF' },
    mountain: { fill: '#8B8B8B', textColor: '#FFFFFF' },
    cave:     { fill: '#2C1810', textColor: '#FFFFFF' }
  };
  return styles[biome];
}
```

**START Button:**
- Displayed on center Lake tile before game begins
- Disappears when pressed
- Triggers player spawn at center tile

### Validation Rules

```typescript
function validateBoard(tiles: Tile[]): boolean {
  // Check 1: Exactly 37 tiles
  if (tiles.length !== 37) return false;

  // Check 2: Center tile is Lake
  const centerTile = tiles.find(t => t.coord.q === 0 && t.coord.r === 0);
  if (!centerTile || centerTile.biome !== 'lake') return false;

  // Check 3: Ring 1 is all Lake (6 tiles)
  const ring1Coords = [
    {q: 0, r: -1}, {q: 1, r: -1}, {q: 1, r: 0},
    {q: 0, r: 1}, {q: -1, r: 1}, {q: -1, r: 0}
  ];
  const ring1Tiles = tiles.filter(t =>
    ring1Coords.some(c => c.q === t.coord.q && c.r === t.coord.r)
  );
  if (ring1Tiles.length !== 6 || !ring1Tiles.every(t => t.biome === 'lake')) return false;

  // Check 4: All 7 biomes present
  const biomeSet = new Set(tiles.map(t => t.biome));
  if (biomeSet.size !== 7) return false;

  // Check 5: No duplicate positions
  const posSet = new Set(tiles.map(t => `${t.coord.q},${t.coord.r}`));
  if (posSet.size !== 37) return false;

  return true;
}
```

---

## TECHNICAL PLAN

### Tech Stack:
- **Framework:** SvelteKit
- **Runtime:** Bun
- **Rendering:** SVG (flat-top hexagons)

### Project Setup:
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
│   │   ├── gameState.ts      # Game state management
│   │   └── playerConfig.ts   # Player colors/shapes config
│   ├── components/
│   │   ├── HexTile.svelte    # Single hexagon tile
│   │   ├── PlayerToken.svelte # Player token (shapes)
│   │   ├── GameBoard.svelte  # The whole board
│   │   ├── TurnDisplay.svelte # Shows whose turn
│   │   └── PlayerSelect.svelte # Player count selector
│   └── routes/
│       └── +page.svelte       # Main game page
└── package.json
```

---

## KEY TYPES

```typescript
export type BiomeType = 'crop' | 'field' | 'forest' | 'mountain' | 'cave' | 'lake' | 'prairie';

export type PlayerShape = 'circle' | 'triangle' | 'square' | 'diamond' | 'star';

export interface HexCoordinate {
  q: number;
  r: number;
}

export interface Tile {
  coord: HexCoordinate;
  biome: BiomeType;
}

export interface PlayerConfig {
  id: number;
  name: string;
  color: string;
  shape: PlayerShape;
  displayName: string;
}

export interface Player {
  id: number;
  config: PlayerConfig;
  position: HexCoordinate;
  actionsRemaining: number;
}

export interface GameState {
  tiles: Tile[];
  players: Player[];
  currentPlayerIndex: number;
  gameStarted: boolean;
  playerCount: number;
}
```

---

## PHASE 1 DELIVERABLES CHECKLIST

When Phase 1 is complete, the game should have:
- [ ] Player count selector (3-5 players) before game starts
- [ ] START button on center tile (disappears after pressed)
- [ ] Board centered on page with controls on either side
- [ ] Hexagonal board with 37 flat-top tiles (radius 3)
- [ ] 7 biomes with Lake always in center zone (7 tiles)
- [ ] Other 6 biomes randomized in wedge zones each game
- [ ] Player tokens with jewel colors + unique shapes
- [ ] All players start at center tile
- [ ] Multiple players on same tile visually offset
- [ ] Click adjacent tile to move (only if it's your turn)
- [ ] Turn indicator showing current player (with their color/shape)
- [ ] "End Turn" button that works (NO auto-pass)
- [ ] Can't move to non-adjacent tiles
- [ ] Can't move when out of actions
- [ ] Visual feedback when hovering valid moves
- [ ] Board validation passes all checks
- [ ] White borders on all player tokens for visibility

---
