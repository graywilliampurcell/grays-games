<script lang="ts">
	import type { Player } from '$lib/types';
	import { SHAPE_SYMBOLS } from '$lib/playerConfig';
	import { ORB_DISPLAY } from '$lib/jobConfig';
	import HealthBar from './HealthBar.svelte';

	interface Props {
		players: Player[];
		currentPlayerIndex: number;
		onEndTurn: () => void;
	}

	let { players, currentPlayerIndex, onEndTurn }: Props = $props();

	function getGroomateRoleDisplay(role: string | null): string {
		if (!role) return '';
		switch (role) {
			case 'fighter': return 'Fighter';
			case 'collector': return 'Collector';
			case 'both': return 'Fighter & Collector';
			default: return '';
		}
	}
</script>

<div class="player-panels">
	{#each players as player, idx}
		{@const isCurrentTurn = idx === currentPlayerIndex}
		<div
			class="player-panel"
			class:current-turn={isCurrentTurn}
			style="--player-color: {player.config.color}"
		>
			<div class="panel-header">
				<span class="player-icon">{SHAPE_SYMBOLS[player.config.shape]}</span>
				<span class="player-name">Player {player.id}</span>
				{#if isCurrentTurn}
					<span class="turn-indicator">Your Turn</span>
				{/if}
			</div>

			{#if player.job}
				<div class="job-info">
					<span class="job-name">{player.job.displayName}</span>
					{#if player.groomateRole}
						<span class="groomate-role">({getGroomateRoleDisplay(player.groomateRole)})</span>
					{/if}
				</div>

				<div class="health-section">
					<HealthBar
						currentHealth={player.health}
						maxHealth={player.maxHealth}
						playerColor={player.config.color}
					/>
				</div>

				<div class="stats">
					{#if player.orb}
						<div class="stat-row">
							<span class="stat-icon">{ORB_DISPLAY[player.orb].icon}</span>
							<span class="stat-text">{ORB_DISPLAY[player.orb].name}</span>
						</div>
					{/if}

					{#if player.hasBook}
						<div class="stat-row">
							<span class="stat-icon">📖</span>
							<span class="stat-text">Has Book</span>
						</div>
					{/if}

					<div class="stat-row actions">
						<span class="stat-label">Actions:</span>
						<span class="stat-value" class:no-actions={player.actionsRemaining === 0}>
							{player.actionsRemaining}
						</span>
					</div>
				</div>
			{/if}

			{#if isCurrentTurn}
				<button class="end-turn-btn" onclick={onEndTurn}>
					End Turn
				</button>
			{/if}
		</div>
	{/each}
</div>

<style>
	.player-panels {
		display: flex;
		flex-direction: column;
		gap: 12px;
		max-height: calc(100vh - 200px);
		overflow-y: auto;
	}

	.player-panel {
		background: rgba(0, 0, 0, 0.7);
		border-radius: 12px;
		padding: 12px;
		color: white;
		border: 2px solid transparent;
		transition: all 0.2s ease;
	}

	.player-panel.current-turn {
		border-color: var(--player-color);
		box-shadow: 0 0 15px rgba(255, 255, 255, 0.1);
	}

	.panel-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;
	}

	.player-icon {
		font-size: 1.2rem;
		color: var(--player-color);
	}

	.player-name {
		font-weight: bold;
		color: var(--player-color);
		flex: 1;
	}

	.turn-indicator {
		font-size: 0.7rem;
		background: var(--player-color);
		color: white;
		padding: 2px 8px;
		border-radius: 10px;
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 0.8; }
		50% { opacity: 1; }
	}

	.job-info {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 8px;
		font-size: 0.85rem;
	}

	.job-name {
		color: rgba(255, 255, 255, 0.9);
	}

	.groomate-role {
		color: rgba(255, 255, 255, 0.6);
		font-size: 0.75rem;
	}

	.health-section {
		margin-bottom: 8px;
	}

	.stats {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 0.8rem;
	}

	.stat-row {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.stat-icon {
		font-size: 0.9rem;
	}

	.stat-text {
		color: rgba(255, 255, 255, 0.8);
	}

	.stat-row.actions {
		margin-top: 4px;
		padding-top: 4px;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
	}

	.stat-label {
		color: rgba(255, 255, 255, 0.6);
	}

	.stat-value {
		color: #a8e6a1;
		font-weight: bold;
	}

	.stat-value.no-actions {
		color: #ff6b6b;
	}

	.end-turn-btn {
		width: 100%;
		margin-top: 10px;
		padding: 8px 16px;
		background: #4a90e2;
		border: none;
		border-radius: 8px;
		color: white;
		font-size: 0.9rem;
		font-weight: bold;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.end-turn-btn:hover {
		background: #3a7bc8;
	}
</style>
