// Progress + unlocks (the only writer of progress fields in Save; see
// CONTRACT.md §7). Pure functions do the math so they're easy to test; the
// Progress class wires them to the app event bus.
//
// Unlock rule (plan §3.7): skins unlock in UNLOCK_ORDER, one per completed
// Race series plus one per 50 Playground stars. The unlocked list is the
// starters + the first N of UNLOCK_ORDER (N = earned count), unioned with
// whatever the save already had so nothing ever gets re-locked.
//
// UI-only fields live under save.ui (not in core defaultSave; Save keeps
// unknown fields):
//   ui.race       last Race setup   {difficulty, races}
//   ui.playground last Playground setup {size, theme, bumpiness, stuff, stars, seed}
//   ui.pathways   last Pathways setup (same shape, Pathways stuff/stars)
//   ui.newSkins   unlocked skins not yet seen in My Balls (for "new" badges)
//   ui.recentWorlds  last RECENT_WORLDS Playground setups played (newest
//                 first, one per seed) so an earlier world can be found again

import { SKINS, STARTER_SKIN_IDS, UNLOCK_ORDER } from '../ball/skinData.js';
import { normalizeRaceConfig, normalizePlaygroundConfig, normalizePathwaysConfig } from '../app/configs.js';
import { defaultSave } from '../core/Save.js';

export const STARS_PER_SKIN = 50;
export const RECENT_WORLDS = 6;
export const CUPS = ['ribbon', 'bronze', 'silver', 'gold']; // worst → best
const SKIN_IDS = SKINS.map((s) => s.id);

const toCount = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : 0);

/** True if cup `a` is better than cup `b` (b may be missing). */
export function isBetterCup(a, b) {
  return CUPS.indexOf(a) > CUPS.indexOf(b);
}

/** Number of UNLOCK_ORDER skins earned so far. */
export function earnedUnlocks(data) {
  return toCount(data.seriesCompleted) + Math.floor(toCount(data.stars?.total) / STARS_PER_SKIN);
}

/** Skin ids that should be unlocked for this save, in catalog order. */
export function unlockedSkinsFor(data) {
  const set = new Set(STARTER_SKIN_IDS);
  for (const id of UNLOCK_ORDER.slice(0, earnedUnlocks(data))) set.add(id);
  for (const id of data.skins?.unlocked || []) if (SKIN_IDS.includes(id)) set.add(id);
  return SKIN_IDS.filter((id) => set.has(id));
}

/**
 * Clean up a save loaded from storage (old versions, hand edits, bad values).
 * Returns a new object; never throws.
 */
export function migrateSave(input) {
  const base = defaultSave();
  const d = input && typeof input === 'object' ? structuredClone(input) : {};
  const out = { ...base, ...d };

  out.settings = { ...base.settings, ...(d.settings || {}) };
  out.settings.sound = out.settings.sound !== false;
  out.seriesCompleted = toCount(d.seriesCompleted);
  out.stars = { ...base.stars, ...(d.stars || {}), total: toCount(d.stars?.total) };

  const cups = {};
  for (const [k, v] of Object.entries(d.bestCups || {})) {
    const diff = Number(k);
    if (Number.isInteger(diff) && diff >= 1 && diff <= 5 && CUPS.includes(v)) cups[diff] = v;
  }
  out.bestCups = cups;

  const unlocked = unlockedSkinsFor({ ...out, skins: { unlocked: Array.isArray(d.skins?.unlocked) ? d.skins.unlocked : [] } });
  const selected = unlocked.includes(d.skins?.selected) ? d.skins.selected : STARTER_SKIN_IDS[0];
  out.skins = { ...(d.skins || {}), unlocked, selected };

  const ui = d.ui && typeof d.ui === 'object' ? d.ui : {};
  out.ui = {
    race: raceSetupFrom(ui.race),
    playground: playgroundSetupFrom(ui.playground),
    pathways: pathwaysSetupFrom(ui.pathways),
    newSkins: Array.isArray(ui.newSkins) ? ui.newSkins.filter((id) => unlocked.includes(id)) : [],
    recentWorlds: recentWorldsFrom(ui.recentWorlds),
  };
  return out;
}

/** Remembered Race setup (no seed: each Go gets a fresh track). */
export function raceSetupFrom(v) {
  const c = normalizeRaceConfig(v || {});
  return { difficulty: c.difficulty, races: c.races };
}

/** Remembered Playground setup (keeps the seed so a favorite world sticks). */
export function playgroundSetupFrom(v) {
  return normalizePlaygroundConfig(v || {});
}

/** Remembered Pathways setup (keeps the seed, like Playground). */
export function pathwaysSetupFrom(v) {
  return normalizePathwaysConfig(v || {});
}

/** Remembered recent Playground worlds: valid setups, unique seeds, newest first. */
export function recentWorldsFrom(v) {
  if (!Array.isArray(v)) return [];
  const seen = new Set();
  const out = [];
  for (const w of v) {
    if (!w || typeof w !== 'object' || typeof w.seed !== 'string' || !w.seed) continue;
    if (seen.has(w.seed)) continue;
    seen.add(w.seed);
    out.push(playgroundSetupFrom(w));
    if (out.length >= RECENT_WORLDS) break;
  }
  return out;
}

/** Pure: put `world` at the front of the recent list. */
export function addRecentWorld(list, world) {
  return recentWorldsFrom([world, ...(Array.isArray(list) ? list : [])]);
}

/** Apply newly-earned unlocks to a draft; returns the ids that were added. */
function grantUnlocks(draft) {
  const before = new Set(draft.skins.unlocked);
  draft.skins.unlocked = unlockedSkinsFor(draft);
  const added = draft.skins.unlocked.filter((id) => !before.has(id));
  if (added.length) {
    const seen = new Set(draft.ui?.newSkins || []);
    draft.ui = { ...(draft.ui || {}), newSkins: [...seen, ...added.filter((id) => !seen.has(id))] };
  }
  return added;
}

/** Pure: a finished Race series. Returns {data, unlocked: skinId[]}. */
export function applySeriesComplete(data, { difficulty, cup } = {}) {
  const draft = structuredClone(data);
  draft.seriesCompleted = toCount(draft.seriesCompleted) + 1;
  const d = Math.min(5, Math.max(1, Math.round(Number(difficulty)) || 1));
  if (CUPS.includes(cup) && isBetterCup(cup, draft.bestCups?.[d])) {
    draft.bestCups = { ...(draft.bestCups || {}), [d]: cup };
  }
  const unlocked = grantUnlocks(draft);
  return { data: draft, unlocked };
}

/** Pure: `n` Playground stars collected. Returns {data, unlocked: skinId[]}. */
export function applyStars(data, n = 1) {
  const draft = structuredClone(data);
  draft.stars = { ...(draft.stars || {}), total: toCount(draft.stars?.total) + toCount(n) };
  const unlocked = grantUnlocks(draft);
  return { data: draft, unlocked };
}

/**
 * What the next locked skin needs, for the My Balls hint picture.
 * Returns null when everything is unlocked, else
 * {skinId, starsHave (0..49 toward the next), starsNeed (= STARS_PER_SKIN)}.
 */
export function nextUnlockHint(data) {
  const unlocked = new Set(data.skins?.unlocked || []);
  const skinId = UNLOCK_ORDER.find((id) => !unlocked.has(id));
  if (!skinId) return null;
  return { skinId, starsHave: toCount(data.stars?.total) % STARS_PER_SKIN, starsNeed: STARS_PER_SKIN };
}

/** Wipe progress but keep grown-up settings and the remembered setups. */
export function resetProgressData(data) {
  const fresh = defaultSave();
  fresh.settings = { ...fresh.settings, ...(data.settings || {}) };
  fresh.ui = {
    race: raceSetupFrom(data.ui?.race),
    playground: playgroundSetupFrom(data.ui?.playground),
    pathways: pathwaysSetupFrom(data.ui?.pathways),
    newSkins: [],
    recentWorlds: recentWorldsFrom(data.ui?.recentWorlds),
  };
  return fresh;
}

/**
 * Event wiring. Created once at boot (registerScreens). Listens for mode
 * events, writes Save, and emits `skinUnlocked` for each new skin.
 */
export class Progress {
  constructor({ save, events }) {
    this.save = save;
    this.events = events;
    // Normalize whatever was in storage once at boot.
    save.update(() => migrateSave(save.get()));
    this._offs = [
      events.on('seriesComplete', (p) => this._apply(applySeriesComplete(save.get(), p || {}))),
      events.on('starCollected', () => this._apply(applyStars(save.get(), 1))),
    ];
  }

  _apply({ data, unlocked }) {
    this.save.update(() => data);
    for (const skinId of unlocked) this.events.emit('skinUnlocked', { skinId });
  }

  selectSkin(id) {
    if (!this.save.get().skins.unlocked.includes(id)) return false;
    this.save.update({ skins: { selected: id } });
    return true;
  }

  markSkinsSeen() {
    if ((this.save.get().ui?.newSkins || []).length) this.save.update({ ui: { newSkins: [] } });
  }

  setRaceSetup(v) {
    this.save.update({ ui: { race: raceSetupFrom(v) } });
  }

  setPlaygroundSetup(v) {
    this.save.update({ ui: { playground: playgroundSetupFrom(v) } });
  }

  setPathwaysSetup(v) {
    this.save.update({ ui: { pathways: pathwaysSetupFrom(v) } });
  }

  /** Remember a Playground world that was played (Go). */
  rememberWorld(v) {
    this.save.update((d) => {
      d.ui = { ...(d.ui || {}), recentWorlds: addRecentWorld(d.ui?.recentWorlds, v) };
    });
  }

  setSound(on) {
    this.save.update({ settings: { sound: !!on } });
  }

  resetProgress() {
    const fresh = resetProgressData(this.save.get());
    this.save.reset();
    this.save.update(() => fresh);
  }

  dispose() {
    for (const off of this._offs) off();
  }
}
