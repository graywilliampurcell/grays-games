// Race difficulty ladder (plan §3.5) as data, plus the tunables the race,
// the generator and the AI read. Pure: no three.js, no DOM.
//
// Starting values to tune in playtests with Gray. The column comments point
// at the plan's table; everything below the table is our own tuning.

// ------------------------------------------------------------ tunables

/** Race-wide knobs (tune these first). */
export const RACE_TUNING = {
  checkpointSpacing: 20, // m between checkpoint gates (plan: 20 at all levels)
  aiSpeedFraction: 0.85, // plan's opponent speed (× speed cap); levels override (aiSpeed) after tuning
  aiSkillSpread: 0.04, // each opponent's speed varies by ±this (seeded)
  aiAccel: 5, // m/s² opponents speed up at the start
  aiCatchUp: 1.12, // max speed multiplier when the player is far ahead
  aiMinFraction: 0.45, // rubber-banding never slows an opponent below this × base
  aiWobble: 0.25, // lateral wobble amplitude (fraction of the safe lane)
  mercyFalls: 3, // the 3rd fall in a row at one checkpoint respawns at the next one (always finish)
  stuckTime: 5, // s without progress at an auto-roll level (wedged) → treated as a fall
  respawnDelay: 1, // s after falling before the ball pops back at the checkpoint
  fallDepth: 2.5, // m below the road that counts as falling
  finishBannerTime: 2.4, // s of finish banner + confetti before the results panel
  tapDelay: 1.2, // s before a results/trophy panel accepts a tap (no accidental skips)
};

// ------------------------------------------------------------ ladder

/**
 * One entry per level (index 0 = level 1).
 *   width, rails, gaps, hazards, speedCap, autoRoll, opponents, length: plan §3.5
 *   hazardSpeed   multiplies every moving hazard's speed (L3 "slow hammers")
 *   cruise        auto-roll speed with the stick centered (× speedCap)
 *   aiSpeed       opponent base speed (× speedCap); level 1 is slower than the player
 *   leadCap       m an opponent may lead the player before it slows to match
 *   aiMinFraction optional per-level override of RACE_TUNING.aiMinFraction
 *   behindCap     m the player may lead before opponents speed up (mildly)
 *   maxChallengeRun  hazards/gaps allowed back to back (1 = never two in a row)
 *   rampRise      m height of ramp pieces
 *   pieces        allow-list: piece id → weight for the generator
 */
export const DIFFICULTIES = [
  {
    level: 1,
    name: 'Rolling Hills',
    width: 8,
    rails: 'full',
    gaps: 'none',
    hazards: [],
    speedCap: 6,
    autoRoll: true,
    opponents: 2,
    length: 120,
    hazardSpeed: 0,
    cruise: 0.85,
    aiSpeed: 0.65, // "slower than player"
    leadCap: 3,
    behindCap: 12,
    maxChallengeRun: 0,
    rampRise: 2,
    pieces: {
      straight: 3,
      'curve-gentle-left': 2,
      'curve-gentle-right': 2,
      'ramp-up': 1.5,
      'ramp-down': 1.5,
    },
  },
  {
    level: 2,
    name: 'Bumpy Road',
    width: 6,
    rails: 'full',
    gaps: 'none',
    hazards: ['bumpers'],
    speedCap: 7,
    autoRoll: true,
    opponents: 2,
    length: 150,
    hazardSpeed: 0,
    cruise: 0.85,
    aiSpeed: 0.8, // tuned for ~60% wins (plan: 0.85)
    leadCap: 5,
    behindCap: 12,
    maxChallengeRun: 1,
    rampRise: 2.5,
    pieces: {
      straight: 3,
      'curve-gentle-left': 2,
      'curve-gentle-right': 2,
      'curve-sharp-left': 1,
      'curve-sharp-right': 1,
      'ramp-up': 1.2,
      'ramp-down': 1.2,
      bumpers: 2.5,
    },
  },
  {
    level: 3,
    name: 'Sky Road',
    width: 5,
    rails: 'curves',
    gaps: 'bridged',
    hazards: ['bumpers', 'hammer'],
    speedCap: 8,
    autoRoll: true,
    opponents: 3,
    length: 180,
    hazardSpeed: 0.6, // slow hammers
    cruise: 0.85,
    aiSpeed: 0.66, // tuned (plan: 0.85)
    leadCap: 6,
    behindCap: 12,
    maxChallengeRun: 1,
    rampRise: 3,
    pieces: {
      straight: 2.5,
      'curve-gentle-left': 1.5,
      'curve-gentle-right': 1.5,
      'curve-sharp-left': 1,
      'curve-sharp-right': 1,
      'ramp-up': 1,
      'ramp-down': 1,
      boost: 1,
      bumpers: 1.5,
      hammer: 2,
      'gap-bridged': 1.5,
    },
  },
  {
    level: 4,
    name: 'Hammer Time',
    width: 4,
    rails: 'none',
    gaps: 'small',
    hazards: ['hammer', 'wrecking-ball'],
    speedCap: 10,
    autoRoll: false,
    opponents: 3,
    length: 220,
    hazardSpeed: 0.85,
    cruise: 0.85,
    aiSpeed: 0.74, // tuned (plan: 0.85)
    leadCap: 8,
    behindCap: 14,
    maxChallengeRun: 2,
    rampRise: 3,
    pieces: {
      straight: 2,
      'curve-gentle-left': 1.2,
      'curve-gentle-right': 1.2,
      'curve-sharp-left': 1,
      'curve-sharp-right': 1,
      'ramp-up': 1,
      'ramp-down': 1,
      boost: 1,
      hammer: 2,
      'wrecking-ball': 2,
      'gap-bridged': 1,
      'gap-open': 1.5,
      beam: 1,
    },
  },
  {
    level: 5,
    name: 'Going Big',
    width: 3,
    rails: 'none',
    gaps: 'jumps',
    hazards: ['hammer', 'wrecking-ball', 'spinner', 'moving-platform'],
    speedCap: 12,
    autoRoll: false,
    opponents: 3,
    length: 260,
    hazardSpeed: 1,
    cruise: 0.85,
    aiSpeed: 0.6, // tuned (plan: 0.85)
    // Falls dominate at L5, so opponents wait more (tight lead, slow crawl
    // while the player respawns) instead of lowering base speed further.
    // Headless bot (scratch sim, 60 races): mid skill 10% → 23% wins,
    // high skill 30% → 37%. Still below the plan's ~60%: confirm with Gray.
    leadCap: 5,
    aiMinFraction: 0.1,
    behindCap: 16,
    maxChallengeRun: 3,
    rampRise: 3,
    pieces: {
      straight: 1.5,
      'curve-gentle-left': 1,
      'curve-gentle-right': 1,
      'curve-sharp-left': 1,
      'curve-sharp-right': 1,
      'ramp-up': 0.8,
      'ramp-down': 0.8,
      boost: 0.8,
      hammer: 1.5,
      'wrecking-ball': 1.5,
      spinner: 1.5,
      'moving-platform': 1.2,
      'gap-open': 1.2,
      launch: 1.2,
      beam: 1.2,
    },
  },
];

/** Settings for a level (clamped to 1..5). */
export function getDifficulty(level) {
  const l = Math.min(5, Math.max(1, Math.round(Number(level)) || 1));
  return DIFFICULTIES[l - 1];
}

// ------------------------------------------------------------ medals

export const MEDALS = ['gold', 'silver', 'bronze', 'ribbon'];

/** Place 1..4+ → medal. */
export function medalForPlace(place) {
  return MEDALS[Math.min(3, Math.max(0, Math.round(place) - 1))];
}

/**
 * Series cup from the places (CONTRACT §7): average place ≤ 1.5 gold,
 * ≤ 2.5 silver, ≤ 3.5 bronze, else ribbon.
 */
export function cupForPlaces(places) {
  if (!places.length) return 'ribbon';
  const avg = places.reduce((a, b) => a + b, 0) / places.length;
  if (avg <= 1.5) return 'gold';
  if (avg <= 2.5) return 'silver';
  if (avg <= 3.5) return 'bronze';
  return 'ribbon';
}

/** Same rule from medals (gold = 1st ... ribbon = 4th). */
export function cupForMedals(medals) {
  return cupForPlaces(medals.map((m) => MEDALS.indexOf(m) + 1 || 4));
}

/** Seed for race i (0-based) of a series; the URL seed reproduces the whole series. */
export function raceSeed(seriesSeed, index) {
  return `${seriesSeed}/race${index + 1}`;
}
