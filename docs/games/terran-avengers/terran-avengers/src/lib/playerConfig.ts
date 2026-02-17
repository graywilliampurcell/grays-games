import type { PlayerConfig, PlayerShape } from './types';

export const PLAYER_CONFIGS: PlayerConfig[] = [
	{
		id: 1,
		name: 'player1',
		color: '#E63946', // Ruby Red
		shape: 'circle',
		displayName: 'Ruby Player (Red Circle)'
	},
	{
		id: 2,
		name: 'player2',
		color: '#457B9D', // Sapphire Blue
		shape: 'triangle',
		displayName: 'Sapphire Player (Blue Triangle)'
	},
	{
		id: 3,
		name: 'player3',
		color: '#2A9D8F', // Emerald Green
		shape: 'square',
		displayName: 'Emerald Player (Green Square)'
	},
	{
		id: 4,
		name: 'player4',
		color: '#F4A261', // Amber Orange
		shape: 'diamond',
		displayName: 'Amber Player (Orange Diamond)'
	},
	{
		id: 5,
		name: 'player5',
		color: '#9B59B6', // Amethyst Purple
		shape: 'star',
		displayName: 'Amethyst Player (Purple Star)'
	}
];

export const SHAPE_SYMBOLS: Record<PlayerShape, string> = {
	circle: '●',
	triangle: '▲',
	square: '■',
	diamond: '♦',
	star: '★'
};

export function getPlayerDisplayInfo(config: PlayerConfig): {
	color: string;
	shape: PlayerShape;
	icon: string;
	name: string;
} {
	return {
		color: config.color,
		shape: config.shape,
		icon: SHAPE_SYMBOLS[config.shape],
		name: config.displayName
	};
}

// When multiple players are on the same tile, offset them visually
export function getPlayerOffsets(
	playerCount: number,
	tokenSize: number
): { x: number; y: number }[] {
	const offset = tokenSize * 0.6;

	switch (playerCount) {
		case 1:
			return [{ x: 0, y: 0 }];
		case 2:
			return [
				{ x: -offset / 2, y: 0 },
				{ x: offset / 2, y: 0 }
			];
		case 3:
			return [
				{ x: 0, y: -offset / 2 },
				{ x: -offset / 2, y: offset / 2 },
				{ x: offset / 2, y: offset / 2 }
			];
		case 4:
			return [
				{ x: -offset / 2, y: -offset / 2 },
				{ x: offset / 2, y: -offset / 2 },
				{ x: -offset / 2, y: offset / 2 },
				{ x: offset / 2, y: offset / 2 }
			];
		case 5:
			return [
				{ x: 0, y: -offset },
				{ x: -offset, y: 0 },
				{ x: offset, y: 0 },
				{ x: -offset / 2, y: offset },
				{ x: offset / 2, y: offset }
			];
		default:
			return [{ x: 0, y: 0 }];
	}
}
