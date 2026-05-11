<script lang="ts">
	import type { JobType, ResourceId } from '$lib/types';
	import {
		gameState,
		currentPlayer,
		validMoves,
		jobSelectingPlayer,
		activeMineYield,
		tradePartners,
		setPlayerCount,
		startGame,
		movePlayer,
		endTurn,
		selectJob,
		resolveGroomateRPS,
		getGroomates,
		mineAction,
		openMakerModal,
		closeMakerModal,
		startTrade,
		submitTradeOffer,
		submitPartnerResponse,
		acceptTrade,
		rejectAllTrades,
		cancelTrade,
		type RPSChoice
	} from '$lib/gameState';
	import { generateBoard } from '$lib/hexUtils';
	import GameBoard from '../components/GameBoard.svelte';
	import PlayerSelect from '../components/PlayerSelect.svelte';
	import TurnDisplay from '../components/TurnDisplay.svelte';
	import JobSelect from '../components/JobSelect.svelte';
	import GroomateRPS from '../components/GroomateRPS.svelte';
	import PlayerPanel from '../components/PlayerPanel.svelte';
	import ActionPanel from '../components/ActionPanel.svelte';
	import MakerModal from '../components/MakerModal.svelte';
	import TradeModal from '../components/TradeModal.svelte';

	// Initialize board tiles for display before game starts
	let preGameTiles = $state(generateBoard());

	// Regenerate pre-game tiles when needed
	function regeneratePreGameBoard() {
		preGameTiles = generateBoard();
	}

	// Handle start game (now triggers job selection)
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

	// Handle job selection
	function handleSelectJob(jobType: JobType) {
		selectJob(jobType);
	}

	// Handle groomate RPS resolution
	function handleGroomateRPS(player1Choice: RPSChoice, player2Choice: RPSChoice) {
		resolveGroomateRPS(player1Choice, player2Choice);
	}

	// Get groomates for RPS screen
	const groomates = $derived(getGroomates());
</script>

<svelte:head>
	<title>Terran Avengers</title>
</svelte:head>

<main class="game-container">
	<h1 class="game-title">Terran Avengers</h1>

	{#if $gameState.phase === 'job_select' && $jobSelectingPlayer}
		<!-- Job Selection Phase -->
		<JobSelect
			currentPlayer={$jobSelectingPlayer}
			allPlayers={$gameState.players}
			onSelectJob={handleSelectJob}
		/>
	{:else if $gameState.phase === 'groomate_rps'}
		<!-- Groomate Rock-Paper-Scissors Phase -->
		<GroomateRPS
			groomates={groomates}
			onResolve={handleGroomateRPS}
		/>
	{:else}
		<!-- Normal game layout (player_count_select or playing) -->
		<div class="game-layout">
			<!-- Left panel: Player selection (before game) or Player panels (during game) -->
			<div class="side-panel left-panel">
				{#if $gameState.phase === 'player_count_select'}
					<PlayerSelect
						selectedCount={$gameState.playerCount}
						onchange={handlePlayerCountChange}
					/>
				{:else if $gameState.phase === 'playing'}
					<PlayerPanel
						players={$gameState.players}
						currentPlayerIndex={$gameState.currentPlayerIndex}
						onEndTurn={handleEndTurn}
					/>
				{/if}
			</div>

			<!-- Center: Game board -->
			<div class="board-panel">
				<GameBoard
					tiles={$gameState.phase === 'playing' ? $gameState.tiles : preGameTiles}
					players={$gameState.players}
					currentPlayerIndex={$gameState.currentPlayerIndex}
					gameStarted={$gameState.phase === 'playing'}
					validMoves={$validMoves}
					onTileClick={handleTileClick}
					onStartClick={handleStartGame}
				/>
			</div>

			<!-- Right panel: action buttons during play -->
			<div class="side-panel right-panel">
				{#if $gameState.phase === 'playing' && $currentPlayer}
					<ActionPanel
						activePlayer={$currentPlayer}
						mineYield={$activeMineYield}
						canTrade={$tradePartners.length > 0}
						onMine={mineAction}
						onMake={openMakerModal}
						onTrade={startTrade}
					/>
				{/if}
			</div>
		</div>

		{#if $gameState.makerModalOpen}
			<MakerModal onClose={closeMakerModal} />
		{/if}

		{#if $gameState.trade}
			<TradeModal
				trade={$gameState.trade}
				players={$gameState.players}
				onSubmitOffer={(offerItemId, requestedResource) =>
					submitTradeOffer(offerItemId, requestedResource)}
				onSubmitResponse={(partnerId, itemId) => submitPartnerResponse(partnerId, itemId)}
				onAccept={(partnerId) => acceptTrade(partnerId)}
				onRejectAll={rejectAllTrades}
				onCancel={cancelTrade}
			/>
		{/if}
	{/if}
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
