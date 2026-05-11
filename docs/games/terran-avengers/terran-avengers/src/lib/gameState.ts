import { writable, derived, get } from 'svelte/store';
import type {
	GameState,
	Player,
	HexCoordinate,
	Tile,
	Job,
	JobType,
	GroomateRole,
	ResourceId,
	TradeState,
	InventoryItem
} from './types';
import { PLAYER_CONFIGS } from './playerConfig';
import { generateBoard, getNeighbors, coordsEqual, getStartingPosition, hexDistance } from './hexUtils';
import { JOBS, getStartingInventory, getJobCount } from './jobConfig';
import { canMine, addResource } from './mineRules';

// Initial game state
const initialState: GameState = {
	tiles: [],
	players: [],
	currentPlayerIndex: 0,
	gameStarted: false,
	playerCount: 3,
	phase: 'player_count_select',
	jobSelectPlayerIndex: 0,
	trade: null,
	makerModalOpen: false
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
		jobSelectPlayerIndex: 0,
		trade: null,
		makerModalOpen: false
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

// ========== Phase 3: Mine, Make, Trade ==========

// Derived store: what resource (if any) the active player can mine on their current tile.
export const activeMineYield = derived(gameState, ($state) => {
	if ($state.phase !== 'playing' || $state.players.length === 0) return null;
	const player = $state.players[$state.currentPlayerIndex];
	const tile = $state.tiles.find((t) => coordsEqual(t.coord, player.position));
	if (!tile) return null;
	return canMine(player, tile);
});

// Derived store: players within trade range (distance <= 1) of the active player.
export const tradePartners = derived(gameState, ($state) => {
	if ($state.phase !== 'playing' || $state.players.length === 0) return [] as Player[];
	const active = $state.players[$state.currentPlayerIndex];
	return $state.players.filter(
		(p) => p.id !== active.id && hexDistance(p.position, active.position) <= 1
	);
});

// Mine action: adds 1 resource to active player's inventory, costs 1 action.
export function mineAction(): boolean {
	const state = get(gameState);
	if (state.phase !== 'playing') return false;
	const player = state.players[state.currentPlayerIndex];
	if (!player || player.actionsRemaining <= 0) return false;

	const tile = state.tiles.find((t) => coordsEqual(t.coord, player.position));
	if (!tile) return false;

	const yieldResource = canMine(player, tile);
	if (!yieldResource) return false;

	gameState.update((s) => ({
		...s,
		players: s.players.map((p, idx) =>
			idx === s.currentPlayerIndex
				? {
						...p,
						inventory: addResource(p.inventory, yieldResource),
						actionsRemaining: p.actionsRemaining - 1
				  }
				: p
		)
	}));
	return true;
}

// Make: open the maker workshop modal. Costs 0 actions to open;
// committing a recipe (Phase 4+) is what would consume the action.
export function openMakerModal(): boolean {
	const state = get(gameState);
	if (state.phase !== 'playing') return false;
	const player = state.players[state.currentPlayerIndex];
	if (!player || player.job?.id !== 'maker') return false;
	gameState.update((s) => ({ ...s, makerModalOpen: true }));
	return true;
}

export function closeMakerModal(): void {
	gameState.update((s) => ({ ...s, makerModalOpen: false }));
}

// ========== Trade lifecycle ==========

export function startTrade(): boolean {
	const state = get(gameState);
	if (state.phase !== 'playing') return false;
	const active = state.players[state.currentPlayerIndex];
	if (!active || active.actionsRemaining <= 0) return false;

	const partners = state.players.filter(
		(p) => p.id !== active.id && hexDistance(p.position, active.position) <= 1
	);
	if (partners.length === 0) return false;
	if (active.inventory.length === 0) return false;

	const trade: TradeState = {
		step: 'choosing_offer',
		activePlayerId: active.id,
		partnerIds: partners.map((p) => p.id),
		offerItemId: null,
		requestedResource: null,
		responses: {},
		currentPartnerIndex: 0,
		acceptedPartnerId: null
	};
	gameState.update((s) => ({ ...s, trade }));
	return true;
}

// Active player commits their offer + optional request, advances to partner responses.
export function submitTradeOffer(offerItemId: string, requestedResource: ResourceId | null): boolean {
	const state = get(gameState);
	if (!state.trade || state.trade.step !== 'choosing_offer') return false;

	gameState.update((s) => {
		if (!s.trade) return s;
		return {
			...s,
			trade: {
				...s.trade,
				offerItemId,
				requestedResource,
				step: 'collecting_offers_player',
				currentPartnerIndex: 0
			}
		};
	});
	return true;
}

// A partner submits their counter-offer (an inventory item id) or null to pass.
export function submitPartnerResponse(partnerId: number, itemId: string | null): boolean {
	const state = get(gameState);
	if (!state.trade) return false;
	if (state.trade.step !== 'collecting_offers_player') return false;
	if (!state.trade.partnerIds.includes(partnerId)) return false;

	gameState.update((s) => {
		if (!s.trade) return s;
		const responses = { ...s.trade.responses, [partnerId]: itemId };
		const nextIndex = s.trade.currentPartnerIndex + 1;
		const allResponded = nextIndex >= s.trade.partnerIds.length;

		// If everyone passed, end the trade with no action consumed.
		if (allResponded) {
			const anyOffered = Object.values(responses).some((v) => v !== null);
			if (!anyOffered) {
				return { ...s, trade: null };
			}
			return {
				...s,
				trade: {
					...s.trade,
					responses,
					step: 'choosing_response',
					currentPartnerIndex: nextIndex
				}
			};
		}

		return {
			...s,
			trade: {
				...s.trade,
				responses,
				currentPartnerIndex: nextIndex
			}
		};
	});
	return true;
}

// Active player accepts one partner's offer. Items swap; 1 action consumed.
export function acceptTrade(partnerId: number): boolean {
	const state = get(gameState);
	if (!state.trade || state.trade.step !== 'choosing_response') return false;
	const partnerItemId = state.trade.responses[partnerId];
	if (!partnerItemId) return false;
	const offerItemId = state.trade.offerItemId;
	if (!offerItemId) return false;

	gameState.update((s) => {
		if (!s.trade) return s;
		const activeId = s.trade.activePlayerId;
		const players = s.players.map((p) => {
			if (p.id === activeId) {
				const giving = p.inventory.find((i) => i.id === offerItemId);
				if (!giving) return p;
				const newInv = removeOne(p.inventory, offerItemId);
				const partnerItem = s.players
					.find((pp) => pp.id === partnerId)
					?.inventory.find((i) => i.id === partnerItemId);
				const finalInv = partnerItem ? addItem(newInv, partnerItem) : newInv;
				return {
					...p,
					inventory: finalInv,
					actionsRemaining: p.actionsRemaining - 1
				};
			}
			if (p.id === partnerId) {
				const receivingFromActive = s.players
					.find((pp) => pp.id === activeId)
					?.inventory.find((i) => i.id === offerItemId);
				const newInv = removeOne(p.inventory, partnerItemId);
				const finalInv = receivingFromActive ? addItem(newInv, receivingFromActive) : newInv;
				return { ...p, inventory: finalInv };
			}
			return p;
		});
		return { ...s, players, trade: null };
	});
	return true;
}

// Active player rejects all offers. No action consumed.
export function rejectAllTrades(): void {
	gameState.update((s) => ({ ...s, trade: null }));
}

// Active player cancels the trade before sending the offer. No action consumed.
export function cancelTrade(): void {
	gameState.update((s) => ({ ...s, trade: null }));
}

// ========== Inventory helpers ==========

function removeOne(inventory: InventoryItem[], itemId: string): InventoryItem[] {
	const idx = inventory.findIndex((i) => i.id === itemId);
	if (idx < 0) return inventory;
	const item = inventory[idx];
	if (item.quantity > 1) {
		return inventory.map((i, n) => (n === idx ? { ...i, quantity: i.quantity - 1 } : i));
	}
	return inventory.filter((_, n) => n !== idx);
}

function addItem(inventory: InventoryItem[], item: InventoryItem): InventoryItem[] {
	const existing = inventory.find((i) => i.id === item.id && i.type === item.type);
	if (existing) {
		return inventory.map((i) => (i === existing ? { ...i, quantity: i.quantity + 1 } : i));
	}
	return [...inventory, { ...item, quantity: 1 }];
}
