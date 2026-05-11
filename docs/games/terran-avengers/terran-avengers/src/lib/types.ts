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

// Phase 2: Job types
export type JobType = 'miner' | 'wood_maker' | 'maker' | 'groomate' | 'crewmate';

export type OrbType = 'stone_orb' | 'wood_orb';

export type ItemType = 'orb' | 'tool' | 'resource' | 'food' | 'spell' | 'book';

export type GroomateRole = 'fighter' | 'collector' | 'both';

export interface Job {
	id: JobType;
	displayName: string;
	description: string;
	startingHealth: number;
	startingOrb: OrbType | null;
	canHaveBook: boolean;
	maxCount: number;
}

export interface InventoryItem {
	id: string;
	name: string;
	type: ItemType;
	quantity: number;
}

export interface Player {
	id: number;
	config: PlayerConfig;
	position: HexCoordinate;
	actionsRemaining: number;
	// Phase 2 additions
	job: Job | null;
	health: number;
	maxHealth: number;
	inventory: InventoryItem[];
	orb: OrbType | null;
	hasBook: boolean;
	groomateRole: GroomateRole | null;
}

export type GamePhase = 'player_count_select' | 'job_select' | 'groomate_rps' | 'playing';

// Phase 3: Resource and recipe types
export type ResourceId = 'metal' | 'wood' | 'plant' | 'food';

export interface Recipe {
	id: string;
	displayName: string;
	inputs: { resource: ResourceId; quantity: number }[];
	output: { itemId: string; itemName: string; quantity: number };
}

// Phase 3: Trade lifecycle
export type TradePhaseStep =
	| 'choosing_offer'
	| 'collecting_offers'
	| 'collecting_offers_player'
	| 'choosing_response'
	| 'complete';

export interface TradeState {
	step: TradePhaseStep;
	activePlayerId: number;
	partnerIds: number[];
	offerItemId: string | null;
	requestedResource: ResourceId | null;
	responses: Record<number, string | null>; // partnerId -> inventoryItemId or null (pass)
	currentPartnerIndex: number; // which partner is currently entering their counter-offer
	acceptedPartnerId: number | null;
}

export interface GameState {
	tiles: Tile[];
	players: Player[];
	currentPlayerIndex: number;
	gameStarted: boolean;
	playerCount: number;
	// Phase 2 additions
	phase: GamePhase;
	jobSelectPlayerIndex: number;
	// Phase 3 additions
	trade: TradeState | null;
	makerModalOpen: boolean;
}
