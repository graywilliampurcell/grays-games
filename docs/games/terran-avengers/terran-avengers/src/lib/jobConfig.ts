import type { Job, JobType, OrbType, InventoryItem } from './types';

export const JOBS: Record<JobType, Job> = {
	miner: {
		id: 'miner',
		displayName: 'Miner',
		description: 'Goes underground to find valuable stones and crystals.',
		startingHealth: 25,
		startingOrb: 'stone_orb',
		canHaveBook: true,
		maxCount: 1
	},
	wood_maker: {
		id: 'wood_maker',
		displayName: 'Wood Maker',
		description: 'Mines trees for wood, leaves, bark and sticks.',
		startingHealth: 12.5,
		startingOrb: 'wood_orb',
		canHaveBook: true,
		maxCount: 1
	},
	maker: {
		id: 'maker',
		displayName: 'Maker',
		description: 'Crafts items for the whole team using resources others bring.',
		startingHealth: 5,
		startingOrb: null,
		canHaveBook: true,
		maxCount: 1
	},
	groomate: {
		id: 'groomate',
		displayName: 'Groomate',
		description: 'Fights monsters and collects orbs. If 2 groomates, they play rock-paper-scissors to decide roles.',
		startingHealth: 10,
		startingOrb: null,
		canHaveBook: false,
		maxCount: 2
	},
	crewmate: {
		id: 'crewmate',
		displayName: 'Crewmate',
		description: 'Helps find food for the team. Does not fight.',
		startingHealth: 10,
		startingOrb: null,
		canHaveBook: true,
		maxCount: 1
	}
};

export const JOB_LIST: JobType[] = ['miner', 'wood_maker', 'maker', 'groomate', 'crewmate'];

export const ORB_DISPLAY: Record<OrbType, { icon: string; color: string; name: string; description: string }> = {
	stone_orb: {
		icon: '🪨',
		color: '#A0A0A0',
		name: 'Stone Orb',
		description: 'Elemental pet that fights off monsters. Given to Miner because they are always in darkness.'
	},
	wood_orb: {
		icon: '🌿',
		color: '#8B4513',
		name: 'Wood Orb',
		description: 'Given to Wood Maker. Works best for the person it was made for.'
	}
};

export function getStartingInventory(job: Job): InventoryItem[] {
	const inventory: InventoryItem[] = [];

	// Give book to eligible players
	if (job.canHaveBook) {
		inventory.push({
			id: 'book_1',
			name: 'Book',
			type: 'book',
			quantity: 1
		});
	}

	// Give starting orb to eligible players
	if (job.startingOrb) {
		inventory.push({
			id: job.startingOrb,
			name: job.startingOrb === 'stone_orb' ? 'Stone Orb' : 'Wood Orb',
			type: 'orb',
			quantity: 1
		});
	}

	return inventory;
}

export function getJobCount(selectedJobs: (Job | null)[], jobType: JobType): number {
	return selectedJobs.filter(j => j?.id === jobType).length;
}

export function isJobAvailable(selectedJobs: (Job | null)[], jobType: JobType): boolean {
	const job = JOBS[jobType];
	const currentCount = getJobCount(selectedJobs, jobType);
	return currentCount < job.maxCount;
}
