<script lang="ts">
	import { PLAYER_CONFIGS, SHAPE_SYMBOLS } from '$lib/playerConfig';

	interface Props {
		selectedCount: number;
		onchange: (count: number) => void;
	}

	let { selectedCount, onchange }: Props = $props();

	const playerOptions = [3, 4, 5, 6];
</script>

<div class="player-select">
	<h3>Select Number of Players</h3>

	<div class="button-group">
		{#each playerOptions as count}
			<button
				class="player-count-btn"
				class:selected={selectedCount === count}
				onclick={() => onchange(count)}
			>
				{count} Players
			</button>
		{/each}
	</div>

	<div class="player-preview">
		<h4>Players:</h4>
		<div class="player-list">
			{#each PLAYER_CONFIGS.slice(0, selectedCount) as config}
				<div class="player-item" style="--player-color: {config.color}">
					<span class="player-icon">{SHAPE_SYMBOLS[config.shape]}</span>
					<span class="player-name">Player {config.id}</span>
				</div>
			{/each}
		</div>
	</div>

	<p class="instructions">Click START on the board to begin!</p>
</div>

<style>
	.player-select {
		background: rgba(0, 0, 0, 0.7);
		border-radius: 12px;
		padding: 20px;
		color: white;
		min-width: 200px;
	}

	h3 {
		margin: 0 0 16px 0;
		font-size: 1.1rem;
		text-align: center;
	}

	h4 {
		margin: 16px 0 8px 0;
		font-size: 0.9rem;
		opacity: 0.8;
	}

	.button-group {
		display: flex;
		gap: 8px;
		justify-content: center;
	}

	.player-count-btn {
		padding: 10px 16px;
		border: 2px solid #555;
		background: #333;
		color: white;
		border-radius: 8px;
		cursor: pointer;
		font-size: 0.9rem;
		transition: all 0.2s ease;
	}

	.player-count-btn:hover {
		border-color: #888;
		background: #444;
	}

	.player-count-btn.selected {
		border-color: #4a90e2;
		background: #4a90e2;
	}

	.player-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.player-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 10px;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 6px;
		border-left: 3px solid var(--player-color);
	}

	.player-icon {
		color: var(--player-color);
		font-size: 1.2rem;
	}

	.player-name {
		font-size: 0.85rem;
	}

	.instructions {
		margin: 16px 0 0 0;
		text-align: center;
		font-size: 0.85rem;
		opacity: 0.7;
	}
</style>
