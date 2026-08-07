<script lang="ts">
	interface Props {
		currentHealth: number;
		maxHealth: number;
		playerColor: string;
	}

	let { currentHealth, maxHealth, playerColor }: Props = $props();

	const percentage = $derived((currentHealth / maxHealth) * 100);

	// Color changes based on how hurt the player is
	const barColor = $derived(() => {
		if (percentage <= 25) return '#FF0000'; // Low health = red
		if (percentage <= 50) return '#FFA500'; // Half health = orange
		return playerColor; // Full health = player color
	});

	// Format health display (handle half-hearts like 12.5)
	const healthDisplay = $derived(() => {
		if (currentHealth % 1 === 0) {
			return `${currentHealth} / ${maxHealth}`;
		}
		return `${currentHealth.toFixed(1)} / ${maxHealth}`;
	});
</script>

<div class="health-bar-container">
	<div
		class="health-bar-fill"
		style="width: {percentage}%; background: {barColor()}"
	></div>
	<span class="health-text">{healthDisplay()}</span>
</div>

<style>
	.health-bar-container {
		position: relative;
		width: 100%;
		height: 20px;
		background: rgba(0, 0, 0, 0.4);
		border-radius: 10px;
		overflow: hidden;
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.health-bar-fill {
		height: 100%;
		transition: width 0.3s ease, background 0.3s ease;
		border-radius: 10px;
	}

	.health-text {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		font-weight: bold;
		color: white;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
	}
</style>
