// Tiny screen router. A screen is an object (or class instance) with
//   mount(root: HTMLElement, params: object, app) : void | Promise<void>
//   unmount() : void
// Screens are registered by name with a factory so each visit gets a fresh one:
//   router.register('home', () => new HomeScreen());
//   router.go('home');
//   router.go('play', { mode: 'race', config: {...}, returnTo: 'race-setup' });

export class Router {
  /**
   * @param {HTMLElement} root container screens render into (#screen)
   * @param {object} app passed to every screen's mount (see main.js)
   */
  constructor(root, app) {
    this.root = root;
    this.app = app;
    this.factories = new Map();
    this.current = null; // { name, screen, params }
    this._nav = Promise.resolve();
  }

  register(name, factory) {
    this.factories.set(name, factory);
    return this;
  }

  has(name) {
    return this.factories.has(name);
  }

  /** Swap to screen `name`. Navigations are serialized. */
  go(name, params = {}) {
    this._nav = this._nav.then(() => this._go(name, params)).catch((err) => {
      console.error(`[router] failed to open "${name}"`, err);
    });
    return this._nav;
  }

  async _go(name, params) {
    const factory = this.factories.get(name);
    if (!factory) throw new Error(`Unknown screen "${name}"`);
    if (this.current) {
      try {
        await this.current.screen.unmount();
      } catch (err) {
        console.error('[router] unmount failed', err);
      }
      this.root.replaceChildren();
    }
    const screen = factory();
    this.current = { name, screen, params };
    this.root.dataset.screen = name;
    await screen.mount(this.root, params, this.app);
  }
}
