<script lang="ts">
	import { RECIPES } from '$lib/recipes';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();
</script>

<div
	class="modal-backdrop"
	onclick={onClose}
	onkeydown={(e) => e.key === 'Escape' && onClose()}
	role="presentation"
>
	<div
		class="modal"
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => e.stopPropagation()}
		role="dialog"
		aria-label="Maker Workshop"
		tabindex="-1"
	>
		<h2 class="title">Maker Workshop</h2>

		{#if RECIPES.length === 0}
			<div class="empty-state">
				<div class="empty-icon">🛠️</div>
				<p class="empty-text">No recipes available yet.</p>
				<p class="empty-subtext">(Coming in Phase 4)</p>
			</div>
		{:else}
			<ul class="recipe-list">
				{#each RECIPES as recipe}
					<li>{recipe.displayName}</li>
				{/each}
			</ul>
		{/if}

		<button class="close-btn" onclick={onClose}>Close</button>
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
		padding: 28px;
		min-width: 340px;
		max-width: 480px;
		color: white;
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
	}

	.title {
		text-align: center;
		margin: 0 0 20px 0;
		font-size: 1.4rem;
	}

	.empty-state {
		text-align: center;
		padding: 24px 0;
	}

	.empty-icon {
		font-size: 3rem;
		margin-bottom: 12px;
		opacity: 0.7;
	}

	.empty-text {
		font-size: 1rem;
		margin: 0 0 6px 0;
	}

	.empty-subtext {
		color: rgba(255, 255, 255, 0.5);
		font-size: 0.85rem;
		margin: 0;
	}

	.recipe-list {
		list-style: none;
		padding: 0;
		margin: 0 0 16px 0;
	}

	.close-btn {
		width: 100%;
		margin-top: 16px;
		padding: 10px;
		background: #4a90e2;
		border: none;
		border-radius: 8px;
		color: white;
		font-weight: bold;
		font-size: 0.95rem;
		cursor: pointer;
		transition: background 0.2s ease;
	}

	.close-btn:hover {
		background: #3a7bc8;
	}
</style>
