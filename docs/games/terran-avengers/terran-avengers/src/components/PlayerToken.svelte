<script lang="ts">
	import type { PlayerConfig, PlayerShape } from '$lib/types';

	interface Props {
		x: number;
		y: number;
		config: PlayerConfig;
		size?: number;
		isCurrentPlayer?: boolean;
	}

	let { x, y, config, size = 12, isCurrentPlayer = false }: Props = $props();

	const borderWidth = 2;
	const borderColor = '#FFFFFF';

	// Calculate shape-specific values
	const triangleHeight = $derived(size * 1.732);
	const trianglePoints = $derived(
		`${x},${y - triangleHeight * 0.6} ${x - size},${y + triangleHeight * 0.4} ${x + size},${y + triangleHeight * 0.4}`
	);

	const squareHalfSize = $derived(size * 0.85);

	const diamondPoints = $derived(
		`${x},${y - size} ${x + size},${y} ${x},${y + size} ${x - size},${y}`
	);

	const starPoints = $derived(() => {
		const points: string[] = [];
		for (let i = 0; i < 10; i++) {
			const radius = i % 2 === 0 ? size : size * 0.4;
			const angle = (Math.PI / 5) * i - Math.PI / 2;
			points.push(`${x + radius * Math.cos(angle)},${y + radius * Math.sin(angle)}`);
		}
		return points.join(' ');
	});
</script>

<g class="player-token" class:current-player={isCurrentPlayer}>
	{#if config.shape === 'circle'}
		<circle
			cx={x}
			cy={y}
			r={size}
			fill={config.color}
			stroke={borderColor}
			stroke-width={borderWidth}
			opacity="0.95"
		/>
	{:else if config.shape === 'triangle'}
		<polygon
			points={trianglePoints}
			fill={config.color}
			stroke={borderColor}
			stroke-width={borderWidth}
			opacity="0.95"
		/>
	{:else if config.shape === 'square'}
		<rect
			x={x - squareHalfSize}
			y={y - squareHalfSize}
			width={squareHalfSize * 2}
			height={squareHalfSize * 2}
			fill={config.color}
			stroke={borderColor}
			stroke-width={borderWidth}
			opacity="0.95"
		/>
	{:else if config.shape === 'diamond'}
		<polygon
			points={diamondPoints}
			fill={config.color}
			stroke={borderColor}
			stroke-width={borderWidth}
			opacity="0.95"
		/>
	{:else if config.shape === 'star'}
		<polygon
			points={starPoints()}
			fill={config.color}
			stroke={borderColor}
			stroke-width={borderWidth}
			opacity="0.95"
		/>
	{/if}

	<!-- Current player indicator (pulsing ring) -->
	{#if isCurrentPlayer}
		<circle
			cx={x}
			cy={y}
			r={size + 5}
			fill="none"
			stroke={config.color}
			stroke-width="2"
			class="pulse-ring"
		/>
	{/if}
</g>

<style>
	.player-token {
		pointer-events: none;
	}

	.pulse-ring {
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 0.3;
			transform-origin: center;
		}
		50% {
			opacity: 0.8;
		}
	}
</style>
