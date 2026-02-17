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
