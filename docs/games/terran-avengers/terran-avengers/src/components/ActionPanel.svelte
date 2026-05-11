<script lang="ts">
	import type { Player, ResourceId } from '$lib/types';
	import { RESOURCE_DISPLAY } from '$lib/mineRules';

	interface Props {
		activePlayer: Player;
		mineYield: ResourceId | null;
		canTrade: boolean;
		onMine: () => void;
		onMake: () => void;
		onTrade: () => void;
	}

	let { activePlayer, mineYield, canTrade, onMine, onMake, onTrade }: Props = $props();

	const isMaker = $derived(activePlayer.job?.id === 'maker');
	const hasActions = $derived(activePlayer.actionsRemaining > 0);
	const mineDisabled = $derived(!mineYield || !hasActions);
	const makeDisabled = $derived(!isMaker || !hasActions);
	// Books are not tradeable, so they don't count toward "has something to offer".
	const tradeableInventoryCount = $derived(
		activePlayer.inventory.filter((i) => i.type !== 'book').length
	);
	const tradeDisabled = $derived(!canTrade || !hasActions || tradeableInventoryCount === 0);
</script>

<div class="action-panel">
	<div class="title">Actions</div>

	<button
		class="action-btn mine-btn"
		disabled={mineDisabled}
		onclick={onMine}
		title={mineYield
			? `Mine 1 ${RESOURCE_DISPLAY[mineYield].name} from this tile`
			: 'You cannot mine this biome'}
	>
		<span class="icon">{mineYield ? RESOURCE_DISPLAY[mineYield].icon : '⛏️'}</span>
		<span class="label">Mine</span>
		{#if mineYield}
			<span class="hint">+1 {RESOURCE_DISPLAY[mineYield].name}</span>
		{/if}
	</button>

	<button
		class="action-btn make-btn"
		disabled={makeDisabled}
		onclick={onMake}
		title={isMaker ? 'Open the Maker workshop' : 'Only the Maker can craft'}
	>
		<span class="icon">🛠️</span>
		<span class="label">Make</span>
	</button>

	<button
		class="action-btn trade-btn"
		disabled={tradeDisabled}
		onclick={onTrade}
		title={canTrade
			? 'Offer a trade to nearby players'
			: 'No players within 1 tile to trade with'}
	>
		<span class="icon">🤝</span>
		<span class="label">Trade</span>
	</button>
</div>

<style>
	.action-panel {
		background: rgba(0, 0, 0, 0.7);
		border-radius: 12px;
		padding: 12px;
		color: white;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.title {
		font-weight: bold;
		font-size: 0.9rem;
		color: rgba(255, 255, 255, 0.7);
		margin-bottom: 4px;
	}

	.action-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 8px;
		color: white;
		font-size: 0.85rem;
		font-weight: bold;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.action-btn:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.16);
		border-color: rgba(255, 255, 255, 0.4);
	}

	.action-btn:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.icon {
		font-size: 1.1rem;
	}

	.label {
		flex: 1;
		text-align: left;
	}

	.hint {
		color: rgba(168, 230, 161, 0.9);
		font-size: 0.75rem;
		font-weight: normal;
	}
</style>
