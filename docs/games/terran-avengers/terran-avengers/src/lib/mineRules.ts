import type { JobType, BiomeType, ResourceId, Player, Tile, InventoryItem } from './types';

export interface MineRule {
	job: JobType;
	biome: BiomeType;
	yields: ResourceId;
}

// Phase 3 mining rules. No tools required at this phase.
// Subtypes (titanium vs iron, fern vs ivy, etc.) come in Phase 4.
export const MINE_RULES: MineRule[] = [
	{ job: 'miner', biome: 'mountain', yields: 'metal' },
	{ job: 'wood_maker', biome: 'forest', yields: 'wood' },
	{ job: 'wood_maker', biome: 'prairie', yields: 'plant' },
	{ job: 'crewmate', biome: 'prairie', yields: 'plant' },
	// Crop biome is open to all jobs except Maker.
	{ job: 'miner', biome: 'crop', yields: 'food' },
	{ job: 'wood_maker', biome: 'crop', yields: 'food' },
	{ job: 'crewmate', biome: 'crop', yields: 'food' },
	{ job: 'groomate', biome: 'crop', yields: 'food' }
];

export const RESOURCE_DISPLAY: Record<ResourceId, { icon: string; name: string }> = {
	metal: { icon: '⛏️', name: 'metal' },
	wood: { icon: '🪵', name: 'wood' },
	plant: { icon: '🌱', name: 'plant' },
	food: { icon: '🍞', name: 'food' }
};

export function canMine(player: Player, tile: Tile): ResourceId | null {
	if (!player.job) return null;
	const rule = MINE_RULES.find((r) => r.job === player.job!.id && r.biome === tile.biome);
	return rule ? rule.yields : null;
}

// Add 1 of the given resource to inventory, stacking with an existing entry.
export function addResource(inventory: InventoryItem[], resource: ResourceId): InventoryItem[] {
	const existing = inventory.find((i) => i.id === resource && i.type === 'resource');
	if (existing) {
		return inventory.map((i) =>
			i === existing ? { ...i, quantity: i.quantity + 1 } : i
		);
	}
	return [
		...inventory,
		{
			id: resource,
			name: RESOURCE_DISPLAY[resource].name,
			type: 'resource',
			quantity: 1
		}
	];
}
