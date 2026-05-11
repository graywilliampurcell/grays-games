<script lang="ts">
	import type { Player, TradeState, ResourceId, InventoryItem } from '$lib/types';
	import { SHAPE_SYMBOLS } from '$lib/playerConfig';
	import { RESOURCE_DISPLAY } from '$lib/mineRules';

	interface Props {
		trade: TradeState;
		players: Player[];
		onSubmitOffer: (offerItemId: string, requestedResource: ResourceId | null) => void;
		onSubmitResponse: (partnerId: number, itemId: string | null) => void;
		onAccept: (partnerId: number) => void;
		onRejectAll: () => void;
		onCancel: () => void;
	}

	let { trade, players, onSubmitOffer, onSubmitResponse, onAccept, onRejectAll, onCancel }: Props =
		$props();

	const activePlayer = $derived(players.find((p) => p.id === trade.activePlayerId)!);
	const partners = $derived(
		trade.partnerIds.map((id) => players.find((p) => p.id === id)!).filter(Boolean)
	);
	const currentResponder = $derived(
		trade.step === 'collecting_offers_player' && trade.currentPartnerIndex < partners.length
			? partners[trade.currentPartnerIndex]
			: null
	);

	let selectedOfferId = $state<string | null>(null);
	let requestedResource = $state<ResourceId | null>(null);

	let selectedResponseId = $state<string | null>(null);

	const RESOURCES: ResourceId[] = ['metal', 'wood', 'plant', 'food'];

	function handleSendOffer() {
		if (!selectedOfferId) return;
		onSubmitOffer(selectedOfferId, requestedResource);
	}

	function handleSendResponse() {
		if (!currentResponder) return;
		onSubmitResponse(currentResponder.id, selectedResponseId);
		selectedResponseId = null;
	}

	function handlePass() {
		if (!currentResponder) return;
		onSubmitResponse(currentResponder.id, null);
		selectedResponseId = null;
	}

	function itemLabel(item: InventoryItem): string {
		if (item.type === 'resource') {
			const r = item.id as ResourceId;
			return `${RESOURCE_DISPLAY[r].icon} ${RESOURCE_DISPLAY[r].name} × ${item.quantity}`;
		}
		return `${item.name} × ${item.quantity}`;
	}

	function findItem(player: Player, itemId: string): InventoryItem | undefined {
		return player.inventory.find((i) => i.id === itemId);
	}

	function offerSummary(): string {
		if (!trade.offerItemId) return '';
		const item = findItem(activePlayer, trade.offerItemId);
		return item ? itemLabel({ ...item, quantity: 1 }) : '';
	}
</script>

<div
	class="modal-backdrop"
	onclick={trade.step === 'choosing_offer' ? onCancel : undefined}
	onkeydown={(e) => e.key === 'Escape' && trade.step === 'choosing_offer' && onCancel()}
	role="presentation"
>
	<div
		class="modal"
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => e.stopPropagation()}
		role="dialog"
		aria-label="Trade"
		tabindex="-1"
	>
		<!-- Step 1: Active player picks what to offer + optional request -->
		{#if trade.step === 'choosing_offer'}
			<h2 class="title">Trade</h2>
			<p class="subtitle">
				<span style="color: {activePlayer.config.color}">
					{SHAPE_SYMBOLS[activePlayer.config.shape]} P{activePlayer.id}
				</span>
				, what will you offer?
			</p>

			<div class="section">
				<div class="section-label">You will give:</div>
				{#if activePlayer.inventory.length === 0}
					<p class="empty">You have nothing to offer.</p>
				{:else}
					<div class="option-grid">
						{#each activePlayer.inventory as item}
							<label class="option" class:selected={selectedOfferId === item.id}>
								<input
									type="radio"
									name="offer"
									value={item.id}
									bind:group={selectedOfferId}
								/>
								<span>{itemLabel(item)}</span>
							</label>
						{/each}
					</div>
				{/if}
			</div>

			<div class="section">
				<div class="section-label">You'd like (optional):</div>
				<select bind:value={requestedResource} class="select">
					<option value={null}>any item</option>
					{#each RESOURCES as r}
						<option value={r}>{RESOURCE_DISPLAY[r].icon} {RESOURCE_DISPLAY[r].name}</option>
					{/each}
				</select>
			</div>

			<div class="section">
				<div class="section-label">Trading with:</div>
				<div class="partners-list">
					{#each partners as partner}
						<span class="partner-chip" style="color: {partner.config.color}">
							{SHAPE_SYMBOLS[partner.config.shape]} P{partner.id}
						</span>
					{/each}
				</div>
			</div>

			<div class="actions-row">
				<button class="btn-secondary" onclick={onCancel}>Cancel</button>
				<button class="btn-primary" disabled={!selectedOfferId} onclick={handleSendOffer}>
					Send Offer
				</button>
			</div>
		{/if}

		<!-- Step 2: Each partner submits a counter-offer -->
		{#if trade.step === 'collecting_offers_player' && currentResponder}
			<h2 class="title">Counter-Offer</h2>
			<p class="subtitle">
				<span style="color: {currentResponder.config.color}">
					{SHAPE_SYMBOLS[currentResponder.config.shape]} P{currentResponder.id}
				</span>
				, your response.
			</p>

			<div class="offer-summary">
				<div>
					<span style="color: {activePlayer.config.color}">
						{SHAPE_SYMBOLS[activePlayer.config.shape]} P{activePlayer.id}
					</span>
					offers you: <strong>{offerSummary()}</strong>
				</div>
				{#if trade.requestedResource}
					<div class="requested">
						They'd like: {RESOURCE_DISPLAY[trade.requestedResource].icon}
						{RESOURCE_DISPLAY[trade.requestedResource].name}
						<span class="hint">(but you can offer anything)</span>
					</div>
				{/if}
			</div>

			<div class="section">
				<div class="section-label">Your counter-offer:</div>
				{#if currentResponder.inventory.length === 0}
					<p class="empty">You have nothing to offer.</p>
				{:else}
					<div class="option-grid">
						{#each currentResponder.inventory as item}
							<label class="option" class:selected={selectedResponseId === item.id}>
								<input
									type="radio"
									name="response"
									value={item.id}
									bind:group={selectedResponseId}
								/>
								<span>{itemLabel(item)}</span>
							</label>
						{/each}
					</div>
				{/if}
			</div>

			<div class="actions-row">
				<button class="btn-secondary" onclick={handlePass}>Pass</button>
				<button class="btn-primary" disabled={!selectedResponseId} onclick={handleSendResponse}>
					Submit
				</button>
			</div>
		{/if}

		<!-- Step 3: Active player accepts one or rejects all -->
		{#if trade.step === 'choosing_response'}
			<h2 class="title">Offers Received</h2>
			<p class="subtitle">
				<span style="color: {activePlayer.config.color}">
					{SHAPE_SYMBOLS[activePlayer.config.shape]} P{activePlayer.id}
				</span>
				, you offered <strong>{offerSummary()}</strong>
			</p>

			<div class="responses">
				{#each partners as partner}
					{@const responseId = trade.responses[partner.id]}
					{@const responseItem = responseId ? findItem(partner, responseId) : null}
					<div class="response-row">
						<span class="who" style="color: {partner.config.color}">
							{SHAPE_SYMBOLS[partner.config.shape]} P{partner.id}
						</span>
						{#if responseItem}
							<span class="response-item">offers {itemLabel({ ...responseItem, quantity: 1 })}</span>
							<button class="btn-accept" onclick={() => onAccept(partner.id)}>Accept</button>
						{:else}
							<span class="passed">passed</span>
						{/if}
					</div>
				{/each}
			</div>

			<div class="actions-row">
				<button class="btn-secondary" onclick={onRejectAll}>Reject All</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}

	.modal {
		background: #1a1a2e;
		border: 2px solid rgba(255, 255, 255, 0.2);
		border-radius: 14px;
		padding: 24px;
		min-width: 380px;
		max-width: 520px;
		color: white;
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
	}

	.title {
		text-align: center;
		margin: 0 0 8px 0;
		font-size: 1.4rem;
	}

	.subtitle {
		text-align: center;
		margin: 0 0 16px 0;
		font-size: 0.9rem;
		color: rgba(255, 255, 255, 0.85);
	}

	.section {
		margin-bottom: 14px;
	}

	.section-label {
		font-size: 0.85rem;
		color: rgba(255, 255, 255, 0.7);
		margin-bottom: 6px;
	}

	.option-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
	}

	.option {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 10px;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.85rem;
		transition: all 0.15s ease;
	}

	.option:hover {
		background: rgba(255, 255, 255, 0.12);
	}

	.option.selected {
		background: rgba(74, 144, 226, 0.3);
		border-color: #4a90e2;
	}

	.option input {
		margin: 0;
	}

	.select {
		width: 100%;
		padding: 8px;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 6px;
		color: white;
		font-size: 0.9rem;
	}

	.partners-list {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.partner-chip {
		font-weight: bold;
		font-size: 0.9rem;
		padding: 2px 8px;
		background: rgba(255, 255, 255, 0.08);
		border-radius: 12px;
	}

	.empty {
		font-style: italic;
		color: rgba(255, 255, 255, 0.5);
		font-size: 0.85rem;
	}

	.offer-summary {
		background: rgba(255, 255, 255, 0.06);
		border-radius: 8px;
		padding: 12px;
		margin-bottom: 14px;
		font-size: 0.9rem;
	}

	.requested {
		margin-top: 6px;
		color: rgba(255, 255, 255, 0.85);
	}

	.hint {
		font-size: 0.75rem;
		color: rgba(255, 255, 255, 0.5);
		font-style: italic;
		margin-left: 4px;
	}

	.responses {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 16px;
	}

	.response-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px;
		background: rgba(255, 255, 255, 0.06);
		border-radius: 8px;
		font-size: 0.9rem;
	}

	.who {
		font-weight: bold;
	}

	.response-item {
		flex: 1;
	}

	.passed {
		flex: 1;
		font-style: italic;
		color: rgba(255, 255, 255, 0.5);
	}

	.actions-row {
		display: flex;
		gap: 10px;
		margin-top: 16px;
	}

	.btn-primary,
	.btn-secondary,
	.btn-accept {
		padding: 10px 18px;
		border: none;
		border-radius: 8px;
		color: white;
		font-weight: bold;
		font-size: 0.9rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.btn-primary {
		flex: 1;
		background: #4a90e2;
	}
	.btn-primary:hover:not(:disabled) {
		background: #3a7bc8;
	}
	.btn-primary:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.btn-secondary {
		flex: 1;
		background: rgba(255, 255, 255, 0.1);
	}
	.btn-secondary:hover {
		background: rgba(255, 255, 255, 0.2);
	}

	.btn-accept {
		background: #2d8a3e;
	}
	.btn-accept:hover {
		background: #226a30;
	}
</style>
