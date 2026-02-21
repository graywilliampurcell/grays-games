import { writable, derived, get } from 'svelte/store';
import type { GameState, Player, HexCoordinate, Tile, Job, JobType, GroomateRole } from './types';
import { PLAYER_CONFIGS } from './playerConfig';
import { generateBoard, getNeighbors, coordsEqual, getStartingPosition } from './hexUtils';
import { JOBS, getStartingInventory, getJobCount } from './jobConfig';

// Initial game state
const initialState: GameState = {
	tiles: [],
	players: [],
	currentPlayerIndex: 0,
	gameStarted: false,
	playerCount: 3,
	phase: 'player_count_select',
	jobSelectPlayerIndex: 0
};

// Create the main game state store
export const gameState = writable<GameState>(initialState);

// Derived store for current player (during playing phase)
export const currentPlayer = derived(gameState, ($state) => {
	if ($state.players.length === 0) return null;
	return $state.players[$state.currentPlayerIndex];
});

// Derived store for currently selecting player (during job_select phase)
export const jobSelectingPlayer = derived(gameState, ($state) => {
	if ($state.phase !== 'job_select' || $state.players.length === 0) return null;
	if ($state.jobSelectPlayerIndex >= $state.players.length) return null;
	return $state.players[$state.jobSelectPlayerIndex];
});

// Derived store for available jobs (jobs not at max count)
export const availableJobs = derived(gameState, ($state) => {
	const selectedJobs = $state.players.map(p => p.job);
	return Object.values(JOBS).filter(job => {
		const count = getJobCount(selectedJobs, job.id);
		return count < job.maxCount;
	});
});

// Derived store for valid move tiles (neighbors of current player)
export const validMoves = derived(gameState, ($state) => {
	if (!$state.gameStarted || $state.phase !== 'playing' || $state.players.length === 0) return [];

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
	if (count < 3 || count > 6) return;
	gameState.update((state) => ({
		...state,
		playerCount: count
	}));
}

// Start job selection phase (called after player count is selected and START is pressed)
export function startJobSelection(): void {
	gameState.update((state) => {
		// Generate the board
		const tiles = generateBoard();

		// Create initial player shells without jobs (they'll pick jobs next)
		const players: Player[] = PLAYER_CONFIGS.slice(0, state.playerCount).map((config) => ({
			id: config.id,
			config,
			position: { q: 0, r: 0 },
			actionsRemaining: 0,
			job: null,
			health: 0,
			maxHealth: 0,
			inventory: [],
			orb: null,
			hasBook: false,
			groomateRole: null
		}));

		return {
			...state,
			tiles,
			players,
			phase: 'job_select',
			jobSelectPlayerIndex: 0
		};
	});
}

// Select a job for the current player in job selection phase
export function selectJob(jobType: JobType): boolean {
	const state = get(gameState);
	if (state.phase !== 'job_select') return false;

	const job = JOBS[jobType];

	// Check if job is still available
	const selectedJobs = state.players.map(p => p.job);
	const currentCount = getJobCount(selectedJobs, jobType);
	if (currentCount >= job.maxCount) return false;

	gameState.update((s) => {
		const updatedPlayers = s.players.map((p, idx) => {
			if (idx === s.jobSelectPlayerIndex) {
				const inventory = getStartingInventory(job);
				return {
					...p,
					job,
					health: job.startingHealth,
					maxHealth: job.startingHealth,
					inventory,
					orb: job.startingOrb,
					hasBook: job.canHaveBook,
					groomateRole: null
				};
			}
			return p;
		});

		const nextPlayerIndex = s.jobSelectPlayerIndex + 1;
		const allPlayersSelected = nextPlayerIndex >= s.players.length;

		if (allPlayersSelected) {
			// Check if we need groomate RPS
			const groomateCount = getJobCount(updatedPlayers.map(p => p.job), 'groomate');

			if (groomateCount === 2) {
				return {
					...s,
					players: updatedPlayers,
					phase: 'groomate_rps',
					jobSelectPlayerIndex: nextPlayerIndex
				};
			} else if (groomateCount === 1) {
				// Single groomate gets 'both' role
				const playersWithRoles = updatedPlayers.map((p, idx) => {
					if (p.job?.id === 'groomate') {
						return { ...p, groomateRole: 'both' as GroomateRole, actionsRemaining: idx === 0 ? 4 : 0 };
					}
					return { ...p, actionsRemaining: idx === 0 ? 4 : 0 };
				});
				return {
					...s,
					players: playersWithRoles,
					phase: 'playing',
					gameStarted: true,
					currentPlayerIndex: 0,
					jobSelectPlayerIndex: nextPlayerIndex
				};
			} else {
				// No groomates, start playing
				const playersWithActions = updatedPlayers.map((p, idx) => ({
					...p,
					actionsRemaining: idx === 0 ? 4 : 0
				}));
				return {
					...s,
					players: playersWithActions,
					phase: 'playing',
					gameStarted: true,
					currentPlayerIndex: 0,
					jobSelectPlayerIndex: nextPlayerIndex
				};
			}
		}

		return {
			...s,
			players: updatedPlayers,
			jobSelectPlayerIndex: nextPlayerIndex
		};
	});

	return true;
}

// Types for RPS
export type RPSChoice = 'rock' | 'paper' | 'scissors';

// Resolve groomate rock-paper-scissors
export function resolveGroomateRPS(player1Choice: RPSChoice, player2Choice: RPSChoice): void {
	gameState.update((state) => {
		if (state.phase !== 'groomate_rps') return state;

		const groomates = state.players
			.map((p, idx) => ({ player: p, index: idx }))
			.filter(({ player }) => player.job?.id === 'groomate');

		if (groomates.length !== 2) return state;

		// Determine winner
		let winnerIndex: number;
		let loserIndex: number;

		if (player1Choice === player2Choice) {
			// Tie - player 1 becomes fighter by default
			winnerIndex = groomates[0].index;
			loserIndex = groomates[1].index;
		} else if (
			(player1Choice === 'rock' && player2Choice === 'scissors') ||
			(player1Choice === 'paper' && player2Choice === 'rock') ||
			(player1Choice === 'scissors' && player2Choice === 'paper')
		) {
			winnerIndex = groomates[0].index;
			loserIndex = groomates[1].index;
		} else {
			winnerIndex = groomates[1].index;
			loserIndex = groomates[0].index;
		}

		const updatedPlayers = state.players.map((p, idx) => {
			if (idx === winnerIndex) {
				return { ...p, groomateRole: 'fighter' as GroomateRole };
			} else if (idx === loserIndex) {
				return { ...p, groomateRole: 'collector' as GroomateRole };
			}
			return p;
		});

		// Reset actions for first player's turn
		const playersWithActions = updatedPlayers.map((p, idx) =>
			idx === 0 ? { ...p, actionsRemaining: 4 } : p
		);

		return {
			...state,
			players: playersWithActions,
			phase: 'playing',
			gameStarted: true,
			currentPlayerIndex: 0
		};
	});
}

// Get groomate players (for RPS screen)
export function getGroomates(): Player[] {
	const state = get(gameState);
	return state.players.filter(p => p.job?.id === 'groomate');
}

// Start the game (legacy - now we use startJobSelection instead)
// This is kept for backwards compatibility but now redirects to job selection flow
export function startGame(): void {
	startJobSelection();
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
			idx === nextPlayerIndex ? { ...p, actionsRemaining: 4 } : p
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
		playerCount: get(gameState).playerCount,
		phase: 'player_count_select',
		jobSelectPlayerIndex: 0
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
