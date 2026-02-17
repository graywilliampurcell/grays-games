import { writable, derived, get } from 'svelte/store';
import type { GameState, Player, HexCoordinate, Tile } from './types';
import { PLAYER_CONFIGS } from './playerConfig';
import { generateBoard, getNeighbors, coordsEqual, getStartingPosition } from './hexUtils';

// Initial game state
const initialState: GameState = {
	tiles: [],
	players: [],
	currentPlayerIndex: 0,
	gameStarted: false,
	playerCount: 3
};

// Create the main game state store
export const gameState = writable<GameState>(initialState);

// Derived store for current player
export const currentPlayer = derived(gameState, ($state) => {
	if ($state.players.length === 0) return null;
	return $state.players[$state.currentPlayerIndex];
});

// Derived store for valid move tiles (neighbors of current player)
export const validMoves = derived(gameState, ($state) => {
	if (!$state.gameStarted || $state.players.length === 0) return [];

	const player = $state.players[$state.currentPlayerIndex];
	if (player.actionsRemaining <= 0) return [];

	const neighbors = getNeighbors(player.position);

	// Filter to only tiles that exist on the board
	return neighbors.filter((neighbor) =>
		$state.tiles.some((tile) => coordsEqual(tile.coord, neighbor))
	);
});

// Set player count (before game starts)
export function setPlayerCount(count: number): void {
	if (count < 3 || count > 5) return;
	gameState.update((state) => ({
		...state,
		playerCount: count
	}));
}

// Start the game
export function startGame(): void {
	gameState.update((state) => {
		// Generate the board
		const tiles = generateBoard();

		// Create players at center tile
		const startPos = getStartingPosition();
		const players: Player[] = PLAYER_CONFIGS.slice(0, state.playerCount).map((config) => ({
			id: config.id,
			config,
			position: { ...startPos },
			actionsRemaining: 1
		}));

		return {
			...state,
			tiles,
			players,
			currentPlayerIndex: 0,
			gameStarted: true
		};
	});
}

// Move current player to a new position
export function movePlayer(targetCoord: HexCoordinate): boolean {
	const state = get(gameState);

	if (!state.gameStarted) return false;

	const player = state.players[state.currentPlayerIndex];
	if (!player || player.actionsRemaining <= 0) return false;

	// Check if target is a valid move
	const neighbors = getNeighbors(player.position);
	const isValidMove = neighbors.some(
		(n) =>
			coordsEqual(n, targetCoord) && state.tiles.some((tile) => coordsEqual(tile.coord, targetCoord))
	);

	if (!isValidMove) return false;

	// Update player position and decrease actions
	gameState.update((s) => ({
		...s,
		players: s.players.map((p, idx) =>
			idx === s.currentPlayerIndex
				? { ...p, position: { ...targetCoord }, actionsRemaining: p.actionsRemaining - 1 }
				: p
		)
	}));

	return true;
}

// End current player's turn
export function endTurn(): void {
	gameState.update((state) => {
		if (!state.gameStarted) return state;

		// Move to next player
		const nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;

		// Reset actions for all players when it's their turn
		const players = state.players.map((p, idx) =>
			idx === nextPlayerIndex ? { ...p, actionsRemaining: 1 } : p
		);

		return {
			...state,
			players,
			currentPlayerIndex: nextPlayerIndex
		};
	});
}

// Reset game to initial state
export function resetGame(): void {
	gameState.set({
		...initialState,
		playerCount: get(gameState).playerCount
	});
}

// Check if a move to the target coordinate is valid for the current player
export function canMoveTo(targetCoord: HexCoordinate): boolean {
	const state = get(gameState);
	if (!state.gameStarted || state.players.length === 0) return false;

	const player = state.players[state.currentPlayerIndex];
	if (player.actionsRemaining <= 0) return false;

	// Check if target tile exists on board
	const tileExists = state.tiles.some((t) => coordsEqual(t.coord, targetCoord));
	if (!tileExists) return false;

	// Check if target is adjacent
	const neighbors = getNeighbors(player.position);
	return neighbors.some((n) => coordsEqual(n, targetCoord));
}

// Get players on a specific tile
export function getPlayersOnTile(coord: HexCoordinate): Player[] {
	const state = get(gameState);
	return state.players.filter((p) => coordsEqual(p.position, coord));
}
