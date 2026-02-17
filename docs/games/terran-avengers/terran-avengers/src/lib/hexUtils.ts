import type { HexCoordinate, Tile, BiomeType } from './types';

// Hex size (center to corner) in pixels
export const HEX_SIZE = 35;

// For flat-top hexagons:
// Width (flat edge to flat edge) = size * 2
// Height (corner to corner) = size * sqrt(3)
export const HEX_WIDTH = HEX_SIZE * 2; // 70
export const HEX_HEIGHT = HEX_SIZE * Math.sqrt(3); // ~60.62

// Biome colors
export const BIOME_COLORS: Record<BiomeType, string> = {
	prairie: '#D4A574',
	forest: '#2D5016',
	field: '#A8E6A1',
	crop: '#FFD93D',
	lake: '#4A90E2',
	mountain: '#8B8B8B',
	cave: '#2C1810'
};

// Biome styles with text colors for visibility
export function getBiomeStyle(biome: BiomeType): { fill: string; textColor: string } {
	const styles: Record<BiomeType, { fill: string; textColor: string }> = {
		prairie: { fill: '#D4A574', textColor: '#000000' },
		forest: { fill: '#2D5016', textColor: '#FFFFFF' },
		field: { fill: '#A8E6A1', textColor: '#000000' },
		crop: { fill: '#FFD93D', textColor: '#000000' },
		lake: { fill: '#4A90E2', textColor: '#FFFFFF' },
		mountain: { fill: '#8B8B8B', textColor: '#FFFFFF' },
		cave: { fill: '#2C1810', textColor: '#FFFFFF' }
	};
	return styles[biome];
}

// Convert hex coordinate to pixel position (flat-top orientation)
export function hexToPixel(
	q: number,
	r: number,
	size: number,
	centerX: number,
	centerY: number
): { x: number; y: number } {
	const x = centerX + size * ((3 / 2) * q);
	const y = centerY + size * ((Math.sqrt(3) / 2) * q + Math.sqrt(3) * r);
	return { x, y };
}

// Get the 6 neighbors of a hex coordinate (flat-top)
export function getNeighbors(coord: HexCoordinate): HexCoordinate[] {
	const directions = [
		{ q: 1, r: 0 }, // E
		{ q: 1, r: -1 }, // NE
		{ q: 0, r: -1 }, // NW
		{ q: -1, r: 0 }, // W
		{ q: -1, r: 1 }, // SW
		{ q: 0, r: 1 } // SE
	];

	return directions.map((dir) => ({
		q: coord.q + dir.q,
		r: coord.r + dir.r
	}));
}

// Check if two coordinates are equal
export function coordsEqual(a: HexCoordinate, b: HexCoordinate): boolean {
	return a.q === b.q && a.r === b.r;
}

// Generate all hex coordinates in ring order (for board generation)
export function generateHexCoordinates(): HexCoordinate[] {
	const coords: HexCoordinate[] = [];

	// Ring 0: center
	coords.push({ q: 0, r: 0 });

	// Rings 1-3
	for (let ring = 1; ring <= 3; ring++) {
		// Start at "top" of ring and walk around
		let q = 0;
		let r = -ring;

		// 6 directions to walk around the ring
		const directions = [
			{ q: 1, r: 0 }, // SE
			{ q: 0, r: 1 }, // S
			{ q: -1, r: 1 }, // SW
			{ q: -1, r: 0 }, // NW
			{ q: 0, r: -1 }, // N
			{ q: 1, r: -1 } // NE
		];

		for (const dir of directions) {
			for (let step = 0; step < ring; step++) {
				coords.push({ q, r });
				q += dir.q;
				r += dir.r;
			}
		}
	}

	return coords;
}

// Fisher-Yates shuffle
function shuffle<T>(array: T[]): T[] {
	const result = [...array];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

// Generate ring coordinates grouped by wedge direction
// Each wedge contains tiles from the same "slice" of the board
function generateRingByWedge(ring: number): HexCoordinate[][] {
	const wedges: HexCoordinate[][] = [[], [], [], [], [], []];

	// Start at "top" of ring and walk around
	let q = 0;
	let r = -ring;

	// 6 directions to walk around the ring
	const directions = [
		{ q: 1, r: 0 }, // Direction 0
		{ q: 0, r: 1 }, // Direction 1
		{ q: -1, r: 1 }, // Direction 2
		{ q: -1, r: 0 }, // Direction 3
		{ q: 0, r: -1 }, // Direction 4
		{ q: 1, r: -1 } // Direction 5
	];

	for (let dirIndex = 0; dirIndex < 6; dirIndex++) {
		const dir = directions[dirIndex];
		for (let step = 0; step < ring; step++) {
			wedges[dirIndex].push({ q, r });
			q += dir.q;
			r += dir.r;
		}
	}

	return wedges;
}

// Generate the game board with biomes - ensuring contiguous wedge zones
export function generateBoard(): Tile[] {
	const tiles: Tile[] = [];

	// 1. Center tile (ring 0) - always Lake
	tiles.push({ coord: { q: 0, r: 0 }, biome: 'lake' });

	// 2. Ring 1 - always Lake (6 tiles)
	const ring1Wedges = generateRingByWedge(1);
	for (const wedge of ring1Wedges) {
		for (const coord of wedge) {
			tiles.push({ coord, biome: 'lake' });
		}
	}

	// 3. Get ring 2 and ring 3 grouped by wedge
	const ring2Wedges = generateRingByWedge(2); // 6 wedges, 2 tiles each
	const ring3Wedges = generateRingByWedge(3); // 6 wedges, 3 tiles each

	// 4. Combine ring 2 and ring 3 tiles for each wedge (2 + 3 = 5 tiles per wedge)
	const outerWedges: HexCoordinate[][] = [];
	for (let i = 0; i < 6; i++) {
		outerWedges.push([...ring2Wedges[i], ...ring3Wedges[i]]);
	}

	// 5. Shuffle the 6 non-lake biomes
	const otherBiomes: BiomeType[] = ['prairie', 'forest', 'field', 'crop', 'mountain', 'cave'];
	const shuffledBiomes = shuffle(otherBiomes);

	// 6. Assign each biome to a wedge (contiguous tiles)
	for (let wedgeIndex = 0; wedgeIndex < 6; wedgeIndex++) {
		const biome = shuffledBiomes[wedgeIndex];
		for (const coord of outerWedges[wedgeIndex]) {
			tiles.push({ coord, biome });
		}
	}

	return tiles;
}

// Check if all tiles of a given biome form a contiguous region
export function isBiomeContiguous(tiles: Tile[], biome: BiomeType): boolean {
	const biomeTiles = tiles.filter((t) => t.biome === biome);
	if (biomeTiles.length === 0) return true;
	if (biomeTiles.length === 1) return true;

	// BFS to check connectivity
	const visited = new Set<string>();
	const queue: HexCoordinate[] = [biomeTiles[0].coord];
	visited.add(`${biomeTiles[0].coord.q},${biomeTiles[0].coord.r}`);

	while (queue.length > 0) {
		const current = queue.shift()!;
		const neighbors = getNeighbors(current);

		for (const neighbor of neighbors) {
			const key = `${neighbor.q},${neighbor.r}`;
			if (visited.has(key)) continue;

			// Check if this neighbor is a tile of the same biome
			const neighborTile = biomeTiles.find((t) => coordsEqual(t.coord, neighbor));
			if (neighborTile) {
				visited.add(key);
				queue.push(neighbor);
			}
		}
	}

	// All tiles of this biome should be visited
	return visited.size === biomeTiles.length;
}

// Check if all biomes form contiguous regions
export function areAllBiomesContiguous(tiles: Tile[]): boolean {
	const biomes: BiomeType[] = ['prairie', 'forest', 'field', 'crop', 'mountain', 'cave', 'lake'];
	return biomes.every((biome) => isBiomeContiguous(tiles, biome));
}

// Validate board passes all checks
export function validateBoard(tiles: Tile[]): boolean {
	// Check 1: Exactly 37 tiles
	if (tiles.length !== 37) return false;

	// Check 2: Center tile is Lake
	const centerTile = tiles.find((t) => t.coord.q === 0 && t.coord.r === 0);
	if (!centerTile || centerTile.biome !== 'lake') return false;

	// Check 3: Ring 1 is all Lake (6 tiles)
	const ring1Coords = [
		{ q: 0, r: -1 },
		{ q: 1, r: -1 },
		{ q: 1, r: 0 },
		{ q: 0, r: 1 },
		{ q: -1, r: 1 },
		{ q: -1, r: 0 }
	];
	const ring1Tiles = tiles.filter((t) =>
		ring1Coords.some((c) => c.q === t.coord.q && c.r === t.coord.r)
	);
	if (ring1Tiles.length !== 6 || !ring1Tiles.every((t) => t.biome === 'lake')) return false;

	// Check 4: All 7 biomes present
	const biomeSet = new Set(tiles.map((t) => t.biome));
	if (biomeSet.size !== 7) return false;

	// Check 5: No duplicate positions
	const posSet = new Set(tiles.map((t) => `${t.coord.q},${t.coord.r}`));
	if (posSet.size !== 37) return false;

	// Check 6: All biomes form contiguous regions
	if (!areAllBiomesContiguous(tiles)) return false;

	return true;
}

// Get the starting position (center tile)
export function getStartingPosition(): HexCoordinate {
	return { q: 0, r: 0 };
}

// Generate SVG points for a flat-top hexagon centered at (cx, cy)
export function getHexagonPoints(cx: number, cy: number, size: number): string {
	const points: string[] = [];
	for (let i = 0; i < 6; i++) {
		// Flat-top: start at 0 degrees (right side)
		const angle = (Math.PI / 3) * i;
		const x = cx + size * Math.cos(angle);
		const y = cy + size * Math.sin(angle);
		points.push(`${x},${y}`);
	}
	return points.join(' ');
}
