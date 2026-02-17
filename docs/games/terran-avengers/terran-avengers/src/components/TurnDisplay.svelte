<script lang="ts">
	import type { Player } from '$lib/types';
	import { SHAPE_SYMBOLS } from '$lib/playerConfig';

	interface Props {
		currentPlayer: Player | null;
		onEndTurn: () => void;
	}

	let { currentPlayer, onEndTurn }: Props = $props();
</script>

<div class="turn-display">
	{#if currentPlayer}
		<div class="current-turn" style="--player-color: {currentPlayer.config.color}">
			<span class="player-icon">{SHAPE_SYMBOLS[currentPlayer.config.shape]}</span>
			<span class="turn-text">Player {currentPlayer.id}'s Turn</span>
		</div>

		<div class="actions-remaining">
			{#if currentPlayer.actionsRemaining > 0}
				<span class="actions">{currentPlayer.actionsRemaining} action remaining</span>
			{:else}
				<span class="no-actions">No actions remaining</span>
			{/if}
		</div>

		<button class="end-turn-btn" onclick={onEndTurn}>End Turn</button>
	{/if}
</div>

<style>
	.turn-display {
		background: rgba(0, 0, 0, 0.7);
		border-radius: 12px;
		padding: 20px;
		color: white;
		min-width: 200px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
	}

	.current-turn {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 20px;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		border: 2px solid var(--player-color);
	}

	.player-icon {
		color: var(--player-color);
		font-size: 1.5rem;
	}

	.turn-text {
		font-size: 1.1rem;
		font-weight: bold;
		color: var(--player-color);
	}

	.actions-remaining {
		font-size: 0.9rem;
	}

	.actions {
		color: #a8e6a1;
	}

	.no-actions {
		color: #ff6b6b;
	}

	.end-turn-btn {
		padding: 12px 32px;
		background: #4a90e2;
		border: none;
		border-radius: 8px;
		color: white;
		font-size: 1rem;
		font-weight: bold;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.end-turn-btn:hover {
		background: #3a7bc8;
		transform: translateY(-1px);
	}

	.end-turn-btn:active {
		transform: translateY(0);
	}
</style>
