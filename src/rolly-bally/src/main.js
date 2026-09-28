// Boot: load Rapier (behind the rolling-ball loader), build shared services,
// register screens, then open the start screen (or the mode in the URL).

import './ui/styles.css';
import { initRapier } from './core/Physics.js';
import { Input } from './core/Input.js';
import { Audio } from './core/Audio.js';
import { Save } from './core/Save.js';
import { Events } from './core/Events.js';
import { DebugOverlay } from './debug/DebugOverlay.js';
import { Router } from './app/Router.js';
import { Game } from './app/Game.js';
import { PlayScreen } from './app/PlayScreen.js';
import { parseUrlParams } from './app/params.js';
import { registerScreens, startScreen } from './ui/screens/index.js';
import { showReloadButton } from './app/reloadButton.js';
import { startSelfUpdate } from './app/selfUpdate.js';

// iOS Safari ignores user-scalable=no; block pinch/double-tap zoom here.
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
}
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
document.addEventListener('contextmenu', (e) => e.preventDefault());

async function boot() {
  const params = parseUrlParams(window.location.search);
  const loader = document.getElementById('loader');

  await initRapier();

  const uiRoot = document.getElementById('ui');
  const save = new Save();
  const events = new Events();
  const audio = new Audio({ save });
  const input = new Input({ joystickParent: uiRoot });
  input.setEnabled(false);
  const debug = new DebugOverlay({ enabled: params.debug, parent: document.body });

  const app = { save, events, audio, input, debug, params, router: null, game: null, version: __APP_VERSION__, build: __APP_BUILD__ };
  app.router = new Router(document.getElementById('screen'), app);
  app.game = new Game({ canvas: document.getElementById('game'), hudRoot: document.getElementById('mode-ui'), app });
  app.router.register('play', () => new PlayScreen());
  registerScreens(app.router, app);

  if (params.debug || params.test) window.rollyBally = app; // poke around from the console
  // ?test=1: bot hook window.__game (test-only module, not loaded otherwise).
  const testHooks = params.test ? (await import('./debug/testHooks.js')).installTestHooks(app) : null;

  if (loader) loader.classList.add('hidden');
  setTimeout(() => loader && loader.remove(), 600);

  if (params.mode) {
    await app.router.go('play', { mode: params.mode, config: params.config, returnTo: 'home' });
  } else {
    const start = startScreen(params);
    await app.router.go(start.name, start.params || {});
  }
  testHooks?.markReady();
  // Self-update: Home-Screen launches never refetch on their own (U0).
  if (!params.test) app.update = startSelfUpdate(app);
}

boot().catch((err) => {
  console.error(err);
  const loader = document.getElementById('loader');
  if (loader) loader.classList.add('error');
  // Never a dead end: a big tappable "start again" arrow.
  showReloadButton();
});
