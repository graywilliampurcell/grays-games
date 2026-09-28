// Screen registration (owned by the UI agent). main.js calls
// registerScreens(router, app) once, and startScreen(params) to pick the
// first screen when the URL doesn't name a mode.

import '../screens.css';
import { HomeScreen } from './Home.js';
import { RaceSetupScreen } from './RaceSetup.js';
import { PlaygroundSetupScreen } from './PlaygroundSetup.js';
import { PathwaysSetupScreen } from './PathwaysSetup.js';
import { SkinsScreen } from './Skins.js';
import { SettingsScreen } from './Settings.js';
import { showPause } from './Pause.js';
import { Progress } from '../progress.js';
import { Celebrate } from '../Celebrate.js';

export function registerScreens(router, app) {
  // Progress is the only writer of progress fields in Save (CONTRACT §7).
  app.progress = new Progress({ save: app.save, events: app.events });
  app.celebrate = new Celebrate({
    events: app.events,
    audio: app.audio,
    // Hold "New ball!" while a race runs so it doesn't cover the trophy;
    // the trophy button goes Home, where it pops up.
    hold: () => app.router.current?.name === 'play' && app.game?.ctx?.modeName === 'race',
  });
  // Game.pause() calls this when the in-game Home button is held.
  app.showPause = (opts) => showPause({ ...opts, app });

  router.register('home', () => new HomeScreen());
  router.register('race-setup', () => new RaceSetupScreen());
  router.register('playground-setup', () => new PlaygroundSetupScreen());
  router.register('pathways-setup', () => new PathwaysSetupScreen());
  router.register('skins', () => new SkinsScreen());
  router.register('settings', () => new SettingsScreen());
}

/** First screen when the URL has no ?mode= (?mode=test-track still works). */
export function startScreen() {
  return { name: 'home', params: {} };
}
