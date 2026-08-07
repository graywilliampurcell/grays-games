<script lang="ts">
	import type { Player } from '$lib/types';
	import type { RPSChoice } from '$lib/gameState';
	import { SHAPE_SYMBOLS } from '$lib/playerConfig';

	interface Props {
		groomates: Player[];
		onResolve: (player1Choice: RPSChoice, player2Choice: RPSChoice) => void;
	}

	let { groomates, onResolve }: Props = $props();

	type GameState = 'player1_choosing' | 'player2_choosing' | 'reveal';

	let currentState = $state<GameState>('player1_choosing');
	let player1Choice = $state<RPSChoice | null>(null);
	let player2Choice = $state<RPSChoice | null>(null);
	let winner = $state<number | null>(null);

	const choices: { value: RPSChoice; icon: string; label: string }[] = [
		{ value: 'rock', icon: '🪨', label: 'Rock' },
		{ value: 'paper', icon: '📄', label: 'Paper' },
		{ value: 'scissors', icon: '✂️', label: 'Scissors' }
	];

	function handleChoice(choice: RPSChoice) {
		if (currentState === 'player1_choosing') {
			player1Choice = choice;
			currentState = 'player2_choosing';
		} else if (currentState === 'player2_choosing') {
			player2Choice = choice;
			currentState = 'reveal';
			determineWinner();
		}
	}

	function determineWinner() {
		if (!player1Choice || !player2Choice) return;

		if (player1Choice === player2Choice) {
			winner = 0; // Tie - player 1 wins by default
		} else if (
			(player1Choice === 'rock' && player2Choice === 'scissors') ||
			(player1Choice === 'paper' && player2Choice === 'rock') ||
			(player1Choice === 'scissors' && player2Choice === 'paper')
		) {
			winner = 0;
		} else {
			winner = 1;
		}
	}

	function startGame() {
		if (player1Choice && player2Choice) {
			onResolve(player1Choice, player2Choice);
		}
	}

	$effect(() => {
		if (currentState === 'reveal' && winner !== null) {
			// Auto-proceed after a delay
			const timeout = setTimeout(startGame, 2000);
			return () => clearTimeout(timeout);
		}
	});
</script>

<div class="rps-container">
	<h2 class="title">Groomate Showdown!</h2>
	<p class="subtitle">Two Groomates must battle to decide their roles</p>

	<div class="players-display">
		<div class="player-side" style="--player-color: {groomates[0].config.color}">
			<span class="player-icon">{SHAPE_SYMBOLS[groomates[0].config.shape]}</span>
			<span class="player-label">Player {groomates[0].id}</span>
			{#if currentState !== 'player1_choosing' && player1Choice}
				<div class="choice-display">
					{choices.find(c => c.value === player1Choice)?.icon}
				</div>
			{/if}
		</div>

		<div class="vs">VS</div>

		<div class="player-side" style="--player-color: {groomates[1].config.color}">
			<span class="player-icon">{SHAPE_SYMBOLS[groomates[1].config.shape]}</span>
			<span class="player-label">Player {groomates[1].id}</span>
			{#if currentState === 'reveal' && player2Choice}
				<div class="choice-display">
					{choices.find(c => c.value === player2Choice)?.icon}
				</div>
			{/if}
		</div>
	</div>

	{#if currentState !== 'reveal'}
		<div class="choosing-info">
			<h3>
				{#if currentState === 'player1_choosing'}
					Player {groomates[0].id}: Make your choice!
				{:else}
					Player {groomates[1].id}: Make your choice!
				{/if}
			</h3>
			<p class="hint">(Don't let the other player see!)</p>
		</div>

		<div class="choices">
			{#each choices as choice}
				<button class="choice-btn" onclick={() => handleChoice(choice.value)}>
					<span class="choice-icon">{choice.icon}</span>
					<span class="choice-label">{choice.label}</span>
				</button>
			{/each}
		</div>
	{:else}
		<div class="result">
			{#if winner === 0 && player1Choice === player2Choice}
				<p class="tie-text">It's a tie! Player {groomates[0].id} wins by default.</p>
			{:else if winner !== null}
				<p class="winner-text">
					Player {groomates[winner].id} wins!
				</p>
			{/if}

			<div class="roles-assignment">
				<div class="role" style="--player-color: {groomates[winner ?? 0].config.color}">
					<span class="role-icon">⚔️</span>
					<span>Player {groomates[winner ?? 0].id}</span>
					<span class="role-label">Fighter</span>
					<span class="role-desc">Fights monsters</span>
				</div>
				<div class="role" style="--player-color: {groomates[winner === 0 ? 1 : 0].config.color}">
					<span class="role-icon">💎</span>
					<span>Player {groomates[winner === 0 ? 1 : 0].id}</span>
					<span class="role-label">Collector</span>
					<span class="role-desc">Collects orbs</span>
				</div>
			</div>

			<p class="starting-text">Starting game...</p>
		</div>
	{/if}
</div>

<style>
	.rps-container {
		background: rgba(0, 0, 0, 0.9);
		border-radius: 16px;
		padding: 32px;
		color: white;
		text-align: center;
		max-width: 600px;
		margin: 0 auto;
	}

	.title {
		margin: 0 0 8px 0;
		font-size: 2rem;
		color: #ffd93d;
	}

	.subtitle {
		margin: 0 0 24px 0;
		color: rgba(255, 255, 255, 0.7);
	}

	.players-display {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 32px;
		margin-bottom: 24px;
	}

	.player-side {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 16px;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 12px;
		border: 2px solid var(--player-color);
		min-width: 120px;
	}

	.player-icon {
		font-size: 2rem;
		color: var(--player-color);
	}

	.player-label {
		font-weight: bold;
		color: var(--player-color);
	}

	.choice-display {
		font-size: 2.5rem;
		margin-top: 8px;
	}

	.vs {
		font-size: 1.5rem;
		font-weight: bold;
		color: #ff6b6b;
	}

	.choosing-info h3 {
		margin: 0 0 8px 0;
		font-size: 1.2rem;
	}

	.hint {
		margin: 0 0 16px 0;
		font-size: 0.85rem;
		color: rgba(255, 255, 255, 0.5);
		font-style: italic;
	}

	.choices {
		display: flex;
		gap: 16px;
		justify-content: center;
	}

	.choice-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 20px 32px;
		background: rgba(255, 255, 255, 0.1);
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-radius: 12px;
		cursor: pointer;
		transition: all 0.2s ease;
		color: white;
	}

	.choice-btn:hover {
		background: rgba(255, 255, 255, 0.2);
		border-color: #4a90e2;
		transform: scale(1.05);
	}

	.choice-icon {
		font-size: 2.5rem;
	}

	.choice-label {
		font-size: 0.9rem;
		font-weight: bold;
	}

	.result {
		margin-top: 16px;
	}

	.tie-text,
	.winner-text {
		font-size: 1.3rem;
		margin: 0 0 24px 0;
		color: #a8e6a1;
	}

	.roles-assignment {
		display: flex;
		gap: 24px;
		justify-content: center;
		margin-bottom: 24px;
	}

	.role {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 16px 24px;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 12px;
		border: 2px solid var(--player-color);
	}

	.role-icon {
		font-size: 1.5rem;
	}

	.role-label {
		font-weight: bold;
		color: var(--player-color);
		font-size: 1.1rem;
	}

	.role-desc {
		font-size: 0.8rem;
		color: rgba(255, 255, 255, 0.6);
	}

	.starting-text {
		color: rgba(255, 255, 255, 0.6);
		font-style: italic;
		animation: pulse 1s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 0.6; }
		50% { opacity: 1; }
	}
</style>
