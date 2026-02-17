<script lang="ts">
	import {
		gameState,
		currentPlayer,
		validMoves,
		setPlayerCount,
		startGame,
		movePlayer,
		endTurn
	} from '$lib/gameState';
	import { generateBoard } from '$lib/hexUtils';
	import GameBoard from '../components/GameBoard.svelte';
	import PlayerSelect from '../components/PlayerSelect.svelte';
	import TurnDisplay from '../components/TurnDisplay.svelte';

	// Initialize board tiles for display before game starts
	let preGameTiles = $state(generateBoard());

	// Regenerate pre-game tiles when needed
	function regeneratePreGameBoard() {
		preGameTiles = generateBoard();
	}

	// Handle start game
	function handleStartGame() {
		startGame();
	}

	// Handle tile click for movement
	function handleTileClick(coord: { q: number; r: number }) {
		movePlayer(coord);
	}

	// Handle end turn
	function handleEndTurn() {
		endTurn();
	}

	// Handle player count change
	function handlePlayerCountChange(count: number) {
		setPlayerCount(count);
	}
</script>

<svelte:head>
	<title>Terran Avengers</title>
</svelte:head>

<main class="game-container">
	<h1 class="game-title">Terran Avengers</h1>

	<div class="game-layout">
		<!-- Left panel: Player selection (before game) or empty space -->
		<div class="side-panel left-panel">
			{#if !$gameState.gameStarted}
				<PlayerSelect
					selectedCount={$gameState.playerCount}
					onchange={handlePlayerCountChange}
				/>
			{/if}
		</div>

		<!-- Center: Game board -->
		<div class="board-panel">
			<GameBoard
				tiles={$gameState.gameStarted ? $gameState.tiles : preGameTiles}
				players={$gameState.players}
				currentPlayerIndex={$gameState.currentPlayerIndex}
				gameStarted={$gameState.gameStarted}
				validMoves={$validMoves}
				onTileClick={handleTileClick}
				onStartClick={handleStartGame}
			/>
		</div>

		<!-- Right panel: Turn display (during game) -->
		<div class="side-panel right-panel">
			{#if $gameState.gameStarted}
				<TurnDisplay currentPlayer={$currentPlayer} onEndTurn={handleEndTurn} />
			{/if}
		</div>
	</div>
</main>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
		min-height: 100vh;
		font-family:
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			Roboto,
			Oxygen,
			Ubuntu,
			sans-serif;
	}

	.game-container {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 20px;
		box-sizing: border-box;
	}

	.game-title {
		color: #ffffff;
		font-size: 2.5rem;
		margin: 0 0 20px 0;
		text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
	}

	.game-layout {
		display: flex;
		align-items: flex-start;
		justify-content: center;
		gap: 30px;
		width: 100%;
		max-width: 1200px;
	}

	.side-panel {
		width: 220px;
		min-height: 300px;
		display: flex;
		flex-direction: column;
	}

	.left-panel {
		align-items: flex-end;
	}

	.right-panel {
		align-items: flex-start;
	}

	.board-panel {
		flex-shrink: 0;
	}
</style>
