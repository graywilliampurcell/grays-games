// The 'play' screen: hosts a game mode on the shared canvas.
//   router.go('play', { mode: 'race', config: {...}, returnTo: 'race-setup' })
// returnTo (default 'home') is where the Home button / ctx.onExit() goes.

export class PlayScreen {
  async mount(root, params, app) {
    this.app = app;
    root.classList.add('screen--play');
    const returnTo = params.returnTo || 'home';
    const returnParams = params.returnParams || {};
    try {
      await app.game.runMode(params.mode, params.config, {
        onExit: () => app.router.go(returnTo, returnParams),
      });
    } catch (err) {
      console.error('[play] mode failed to start', err);
      // Never strand a kid on a dead screen: fall back to home.
      app.router.go(app.router.has(returnTo) ? returnTo : 'home');
    }
  }

  async unmount() {
    await this.app.game.stopMode();
  }
}
