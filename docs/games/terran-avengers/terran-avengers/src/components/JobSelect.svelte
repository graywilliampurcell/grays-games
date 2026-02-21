<script lang="ts">
	import type { Player, Job, JobType } from '$lib/types';
	import { JOBS, JOB_LIST, ORB_DISPLAY, getJobCount } from '$lib/jobConfig';
	import { SHAPE_SYMBOLS } from '$lib/playerConfig';

	interface Props {
		currentPlayer: Player;
		allPlayers: Player[];
		onSelectJob: (jobType: JobType) => void;
	}

	let { currentPlayer, allPlayers, onSelectJob }: Props = $props();

	// Get selected jobs from all players
	const selectedJobs = $derived(allPlayers.map(p => p.job));

	// Check if a job is available
	function isJobAvailable(jobType: JobType): boolean {
		const job = JOBS[jobType];
		const count = getJobCount(selectedJobs, jobType);
		return count < job.maxCount;
	}

	// Get remaining slots for a job
	function getRemainingSlots(jobType: JobType): number {
		const job = JOBS[jobType];
		const count = getJobCount(selectedJobs, jobType);
		return job.maxCount - count;
	}
</script>

<div class="job-select">
	<div class="header">
		<h2>Player {currentPlayer.id} - Pick Your Job</h2>
		<div class="player-info" style="--player-color: {currentPlayer.config.color}">
			<span class="player-icon">{SHAPE_SYMBOLS[currentPlayer.config.shape]}</span>
			<span class="player-name">{currentPlayer.config.displayName}</span>
		</div>
	</div>

	<div class="jobs-grid">
		{#each JOB_LIST as jobType}
			{@const job = JOBS[jobType]}
			{@const available = isJobAvailable(jobType)}
			{@const remaining = getRemainingSlots(jobType)}
			<button
				class="job-card"
				class:disabled={!available}
				disabled={!available}
				onclick={() => available && onSelectJob(jobType)}
			>
				<div class="job-header">
					<h3 class="job-name">{job.displayName}</h3>
					{#if job.maxCount > 1}
						<span class="slots-badge">{remaining}/{job.maxCount}</span>
					{/if}
				</div>

				<p class="job-description">{job.description}</p>

				<div class="job-stats">
					<div class="stat">
						<span class="stat-label">HP:</span>
						<span class="stat-value health">{job.startingHealth}</span>
					</div>

					<div class="stat">
						<span class="stat-label">Orb:</span>
						{#if job.startingOrb}
							<span class="stat-value orb">
								{ORB_DISPLAY[job.startingOrb].icon} {ORB_DISPLAY[job.startingOrb].name}
							</span>
						{:else}
							<span class="stat-value no-orb">None</span>
						{/if}
					</div>

					<div class="stat">
						<span class="stat-label">Book:</span>
						<span class="stat-value" class:has-book={job.canHaveBook} class:no-book={!job.canHaveBook}>
							{job.canHaveBook ? 'Yes' : 'No'}
						</span>
					</div>
				</div>

				{#if !available}
					<div class="unavailable-overlay">
						<span>Taken</span>
					</div>
				{/if}
			</button>
		{/each}
	</div>
</div>

<style>
	.job-select {
		background: rgba(0, 0, 0, 0.85);
		border-radius: 16px;
		padding: 24px;
		color: white;
		max-width: 700px;
		margin: 0 auto;
	}

	.header {
		text-align: center;
		margin-bottom: 24px;
	}

	h2 {
		margin: 0 0 12px 0;
		font-size: 1.5rem;
	}

	.player-info {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		padding: 8px 16px;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		border: 2px solid var(--player-color);
	}

	.player-icon {
		color: var(--player-color);
		font-size: 1.3rem;
	}

	.player-name {
		font-size: 0.95rem;
		color: var(--player-color);
	}

	.jobs-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 16px;
	}

	.jobs-grid .job-card:last-child:nth-child(odd) {
		grid-column: 1 / -1;
		max-width: 50%;
		justify-self: center;
	}

	.job-card {
		position: relative;
		background: rgba(255, 255, 255, 0.08);
		border: 2px solid rgba(255, 255, 255, 0.2);
		border-radius: 12px;
		padding: 16px;
		cursor: pointer;
		transition: all 0.2s ease;
		text-align: left;
		color: white;
	}

	.job-card:not(.disabled):hover {
		background: rgba(255, 255, 255, 0.15);
		border-color: #4a90e2;
		transform: translateY(-2px);
	}

	.job-card.disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.job-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
	}

	.job-name {
		margin: 0;
		font-size: 1.1rem;
		color: #fff;
	}

	.slots-badge {
		background: #4a90e2;
		padding: 2px 8px;
		border-radius: 10px;
		font-size: 0.75rem;
	}

	.job-description {
		margin: 0 0 12px 0;
		font-size: 0.85rem;
		color: rgba(255, 255, 255, 0.7);
		line-height: 1.4;
	}

	.job-stats {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.stat {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.85rem;
	}

	.stat-label {
		color: rgba(255, 255, 255, 0.6);
		min-width: 40px;
	}

	.stat-value {
		font-weight: bold;
	}

	.stat-value.health {
		color: #ff6b6b;
	}

	.stat-value.orb {
		color: #a8e6a1;
	}

	.stat-value.no-orb {
		color: rgba(255, 255, 255, 0.4);
	}

	.stat-value.has-book {
		color: #ffd93d;
	}

	.stat-value.no-book {
		color: rgba(255, 255, 255, 0.4);
	}

	.unavailable-overlay {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.2rem;
		font-weight: bold;
		color: #ff6b6b;
	}
</style>
