<script lang="ts">
	import type { BiomeType, HexCoordinate, Player } from '$lib/types';
	import { getBiomeStyle, getHexagonPoints, HEX_SIZE } from '$lib/hexUtils';
	import { SHAPE_SYMBOLS } from '$lib/playerConfig';

	interface Props {
		coord: HexCoordinate;
		biome: BiomeType;
		x: number;
		y: number;
		isValidMove?: boolean;
		isCurrentPlayerTile?: boolean;
		showStart?: boolean;
		playersOnTile?: Player[];
		onclick?: () => void;
	}

	let {
		coord,
		biome,
		x,
		y,
		isValidMove = false,
		isCurrentPlayerTile = false,
		showStart = false,
		playersOnTile = [],
		onclick
	}: Props = $props();

	const style = $derived(getBiomeStyle(biome));
	const points = $derived(getHexagonPoints(x, y, HEX_SIZE));

	let isHovered = $state(false);

	// Format biome name for display
	const biomeName = $derived(() => {
		const names: Record<BiomeType, string> = {
			prairie: 'Prairie',
			forest: 'Forest',
			field: 'Field',
			crop: 'Crop',
			lake: 'Lake',
			mountain: 'Mountain',
			cave: 'Cave'
		};
		return names[biome];
	});
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<g
	class="hex-tile"
	class:valid-move={isValidMove}
	class:current-tile={isCurrentPlayerTile}
	class:clickable={isValidMove || showStart}
	role={isValidMove || showStart ? 'button' : 'img'}
	aria-label={isValidMove || showStart ? `${biome} tile - click to ${showStart ? 'start game' : 'move here'}` : `${biome} tile`}
	tabindex={isValidMove || showStart ? 0 : -1}
	onmouseenter={() => (isHovered = true)}
	onmouseleave={() => (isHovered = false)}
	onclick={onclick}
	onkeydown={(e) => {
		if ((e.key === 'Enter' || e.key === ' ') && onclick) {
			onclick();
		}
	}}
>
	<!-- Main hexagon -->
	<polygon
		{points}
		fill={style.fill}
		stroke={isValidMove && isHovered ? '#FFFFFF' : '#333333'}
		stroke-width={isValidMove && isHovered ? 3 : 1.5}
		opacity={isValidMove && isHovered ? 1 : 0.95}
	/>

	<!-- Valid move indicator (subtle glow) -->
	{#if isValidMove}
		<polygon {points} fill="none" stroke="#FFFFFF" stroke-width="2" opacity="0.5" />
	{/if}

	<!-- START button on center tile before game starts -->
	{#if showStart}
		<g class="start-button">
			<circle cx={x} cy={y} r={HEX_SIZE * 0.6} fill="#E63946" stroke="#FFFFFF" stroke-width="2" />
			<text
				{x}
				{y}
				text-anchor="middle"
				dominant-baseline="central"
				fill="#FFFFFF"
				font-size="12"
				font-weight="bold"
			>
				START
			</text>
		</g>
	{/if}

	<!-- Tooltip on hover -->
	{#if isHovered && !showStart}
		<foreignObject x={x - 70} y={y - HEX_SIZE - 55} width="140" height="60" class="tooltip-container">
			<div class="tooltip">
				<div class="biome-name">{biomeName()}</div>
				{#if playersOnTile.length > 0}
					<div class="players-list">
						{#each playersOnTile as player}
							<span class="player-badge" style="color: {player.config.color}">
								{SHAPE_SYMBOLS[player.config.shape]} P{player.id}
							</span>
						{/each}
					</div>
				{/if}
			</div>
		</foreignObject>
	{/if}
</g>

<style>
	.hex-tile {
		cursor: default;
		transition: opacity 0.15s ease;
	}

	.hex-tile.clickable {
		cursor: pointer;
	}

	.hex-tile.valid-move polygon {
		filter: brightness(1.1);
	}

	.start-button {
		cursor: pointer;
	}

	.start-button:hover circle {
		fill: #c92a38;
	}

	.tooltip-container {
		pointer-events: none;
		overflow: visible;
	}

	.tooltip {
		background: rgba(0, 0, 0, 0.9);
		border: 1px solid rgba(255, 255, 255, 0.3);
		border-radius: 6px;
		padding: 6px 10px;
		text-align: center;
		color: white;
		font-size: 11px;
		white-space: nowrap;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
	}

	.biome-name {
		font-weight: bold;
		margin-bottom: 2px;
	}

	.players-list {
		display: flex;
		gap: 6px;
		justify-content: center;
		flex-wrap: wrap;
	}

	.player-badge {
		font-weight: bold;
		font-size: 10px;
	}
</style>
