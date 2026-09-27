// Minimal event emitter used for app-wide game events (see CONTRACT.md §Events).

export class Events {
  constructor() {
    this.handlers = new Map();
  }

  /** Subscribe; returns an unsubscribe function. */
  on(name, fn) {
    if (!this.handlers.has(name)) this.handlers.set(name, new Set());
    this.handlers.get(name).add(fn);
    return () => this.off(name, fn);
  }

  off(name, fn) {
    const set = this.handlers.get(name);
    if (set) set.delete(fn);
  }

  emit(name, payload) {
    const set = this.handlers.get(name);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[events] handler for "${name}" failed`, err);
      }
    }
  }
}
