<script lang="ts">
	import type { Tile, Player, HexCoordinate, BiomeType } from '$lib/types';
	import { hexToPixel, HEX_SIZE, coordsEqual } from '$lib/hexUtils';
	import { getPlayerOffsets, SHAPE_SYMBOLS } from '$lib/playerConfig';
	import HexTile from './HexTile.svelte';
	import PlayerToken from './PlayerToken.svelte';

	interface Props {
		tiles: Tile[];
		players: Player[];
		currentPlayerIndex: number;
		gameStarted: boolean;
		validMoves: HexCoordinate[];
		onTileClick: (coord: HexCoordinate) => void;
		onStartClick: () => void;
	}

	let {
		tiles,
		players,
		currentPlayerIndex,
		gameStarted,
		validMoves,
		onTileClick,
		onStartClick
	}: Props = $props();

	// SVG dimensions - calculate based on board size
	const SVG_WIDTH = 500;
	const SVG_HEIGHT = 450;
	const CENTER_X = SVG_WIDTH / 2;
	const CENTER_Y = SVG_HEIGHT / 2;

	// Token size for players
	const TOKEN_SIZE = 12;

	// Track hovered tile for tooltip
	let hoveredTile = $state<{ coord: HexCoordinate; biome: BiomeType; x: number; y: number } | null>(null);

	// Check if a coordinate is a valid move
	function isValidMove(coord: HexCoordinate): boolean {
		return validMoves.some((m) => coordsEqual(m, coord));
	}

	// Check if current player is on this tile
	function isCurrentPlayerTile(coord: HexCoordinate): boolean {
		if (!gameStarted || players.length === 0) return false;
		const currentPlayer = players[currentPlayerIndex];
		return coordsEqual(currentPlayer.position, coord);
	}

	// Get players on a specific tile
	function getPlayersOnTile(coord: HexCoordinate): Player[] {
		return players.filter((p) => coordsEqual(p.position, coord));
	}

	// Get pixel position for a tile
	function getTilePosition(coord: HexCoordinate): { x: number; y: number } {
		return hexToPixel(coord.q, coord.r, HEX_SIZE, CENTER_X, CENTER_Y);
	}

	// Format biome name for display
	function getBiomeName(biome: BiomeType): string {
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
	}

	// Get players on hovered tile
	const hoveredTilePlayers = $derived(
		hoveredTile ? getPlayersOnTile(hoveredTile.coord) : []
	);
</script>

<div class="game-board-container">
	<svg width={SVG_WIDTH} height={SVG_HEIGHT} class="game-board">
		<!-- Render all hex tiles -->
		{#each tiles as tile (tile.coord.q + ',' + tile.coord.r)}
			{@const pos = getTilePosition(tile.coord)}
			{@const isCenterTile = tile.coord.q === 0 && tile.coord.r === 0}
			<HexTile
				coord={tile.coord}
				biome={tile.biome}
				x={pos.x}
				y={pos.y}
				isValidMove={isValidMove(tile.coord)}
				isCurrentPlayerTile={isCurrentPlayerTile(tile.coord)}
				showStart={!gameStarted && isCenterTile}
				onclick={() => {
					if (!gameStarted && isCenterTile) {
						onStartClick();
					} else if (isValidMove(tile.coord)) {
						onTileClick(tile.coord);
					}
				}}
				onhover={(hovered) => {
					if (hovered && !(!gameStarted && isCenterTile)) {
						hoveredTile = { coord: tile.coord, biome: tile.biome, x: pos.x, y: pos.y };
					} else if (!hovered && hoveredTile?.coord.q === tile.coord.q && hoveredTile?.coord.r === tile.coord.r) {
						hoveredTile = null;
					}
				}}
			/>
		{/each}

		<!-- Render players on tiles -->
		{#if gameStarted}
			{#each tiles as tile (tile.coord.q + ',' + tile.coord.r + '-players')}
				{@const pos = getTilePosition(tile.coord)}
				{@const tilePlayers = getPlayersOnTile(tile.coord)}
				{@const offsets = getPlayerOffsets(tilePlayers.length, TOKEN_SIZE)}

				{#each tilePlayers as player, idx (player.id)}
					{@const offset = offsets[idx] || { x: 0, y: 0 }}
					<PlayerToken
						x={pos.x + offset.x}
						y={pos.y + offset.y}
						config={player.config}
						size={TOKEN_SIZE}
						isCurrentPlayer={player.id === players[currentPlayerIndex]?.id}
						orb={player.orb}
					/>
				{/each}
			{/each}
		{/if}

		<!-- Tooltip layer (rendered last so it's always on top) -->
		{#if hoveredTile}
			<foreignObject
				x={hoveredTile.x - 70}
				y={hoveredTile.y - HEX_SIZE - 55}
				width="140"
				height="60"
				class="tooltip-container"
			>
				<div class="tooltip">
					<div class="biome-name">{getBiomeName(hoveredTile.biome)}</div>
					{#if hoveredTilePlayers.length > 0}
						<div class="players-list">
							{#each hoveredTilePlayers as player}
								<span class="player-badge" style="color: {player.config.color}">
									{SHAPE_SYMBOLS[player.config.shape]} P{player.id}
								</span>
							{/each}
						</div>
					{/if}
				</div>
			</foreignObject>
		{/if}
	</svg>
</div>

<style>
	.game-board-container {
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.game-board {
		background: #1a1a2e;
		border-radius: 16px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
	}

	.tooltip-container {
		pointer-events: none;
		overflow: visible;
	}

	.tooltip {
		background: rgba(0, 0, 0, 0.95);
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 6px;
		padding: 6px 10px;
		text-align: center;
		color: white;
		font-size: 11px;
		white-space: nowrap;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
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
