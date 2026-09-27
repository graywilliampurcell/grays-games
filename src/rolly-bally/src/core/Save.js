// Persistent progress in localStorage under one key. All storage access is
// wrapped in try/catch: private mode / blocked storage just means no saving.

import { STARTER_SKIN_IDS } from '../ball/skinData.js';

export const SAVE_KEY = 'rolly-bally:v1';

export function defaultSave() {
  return {
    settings: { sound: true },
    skins: { unlocked: STARTER_SKIN_IDS.slice(), selected: STARTER_SKIN_IDS[0] },
    // bestCups[difficulty] = 'gold' | 'silver' | 'bronze' | 'ribbon'
    bestCups: {},
    stars: { total: 0 },
    seriesCompleted: 0,
  };
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Deep-merge `patch` over `base` (arrays and scalars replace). Returns a new object. */
export function deepMerge(base, patch) {
  if (!isPlainObject(base) || !isPlainObject(patch)) return patch === undefined ? base : patch;
  const out = { ...base };
  for (const key of Object.keys(patch)) {
    out[key] = isPlainObject(base[key]) && isPlainObject(patch[key])
      ? deepMerge(base[key], patch[key])
      : patch[key];
  }
  return out;
}

function defaultStorage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

export class Save {
  /** @param {Storage|null} storage defaults to localStorage */
  constructor(storage = defaultStorage()) {
    this.storage = storage;
    this.listeners = new Set();
    this.data = this._load();
  }

  _load() {
    try {
      const raw = this.storage && this.storage.getItem(SAVE_KEY);
      if (raw) return deepMerge(defaultSave(), JSON.parse(raw));
    } catch {
      // corrupt or unavailable: fall through to defaults
    }
    return defaultSave();
  }

  _write() {
    try {
      if (this.storage) this.storage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      // quota / private mode: keep playing in memory
    }
    for (const fn of this.listeners) fn(this.data);
  }

  /** The current save object. Treat as read-only; change it via update(). */
  get() {
    return this.data;
  }

  /**
   * update(patchObject) deep-merges; update(fn) lets you mutate a draft copy
   * (or return a replacement). Persists immediately.
   */
  update(patchOrFn) {
    if (typeof patchOrFn === 'function') {
      const draft = structuredClone(this.data);
      const result = patchOrFn(draft);
      this.data = deepMerge(defaultSave(), result === undefined ? draft : result);
    } else {
      this.data = deepMerge(this.data, patchOrFn);
    }
    this._write();
    return this.data;
  }

  /** Wipe all progress (grown-up menu only). */
  reset() {
    this.data = defaultSave();
    this._write();
    return this.data;
  }

  /** Subscribe to changes. Returns an unsubscribe function. */
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
