// Race mode (plan §3.4): a series of N generated races against 2–3 AI balls.
//   countdown 3-2-1-GO → race (checkpoints, boosts, falls → respawn) →
//   finish banner + confetti → medal + finishing order → ▶ next race → ...
//   → trophy (medal per race + cup) → 🏠 home.
// Config {difficulty, races, seed}; race i uses raceSeed(seed, i), so a URL
// seed (?mode=race&d=3&n=5&seed=…) reproduces the whole series.
// Debug (?debug=1): R respawn, N next piece, G regenerate (a fresh emoji
// series seed, same race number). URL ?race=K starts at race K.

import './race.css';
import { Ball } from '../ball/Ball.js';
import { ChaseCamera } from '../core/ChaseCamera.js';
import { RaceSim } from './RaceSim.js';
import { RaceHud } from './RaceHud.js';
import { buildScenery } from './Scenery.js';
import { showRaceResult, showTrophy } from './Results.js';
import { randomEmojiSeed } from '../core/Rng.js';
import { getDifficulty, medalForPlace, cupForPlaces, raceSeed, RACE_TUNING } from './difficulty.js';

const COUNTDOWN = [
  { t: 0.5, text: '3' },
  { t: 1.5, text: '2' },
  { t: 2.5, text: '1' },
  { t: 3.5, text: 'GO!' },
];

export default class RaceMode {
  async start(ctx, config) {
    this.ctx = ctx;
    this.config = config;
    this.level = getDifficulty(config.difficulty);
    this.races = config.races;
    this.skin = ctx.save.get().skins?.selected || 'red';
    this.medals = [];
    this.places = [];
    this.panel = null;
    this.fade = 0;
    this._frame = 0;
    this._aiFrac = [];

    this.ball = new Ball({ physics: ctx.physics, scene: ctx.scene, position: { x: 0, y: 1, z: 0 }, skin: this.skin });
    this.ball.onLand = (impact) => {
      if (this.state === 'racing') ctx.audio.play('thump', { volume: Math.min(0.6, impact / 18), pitch: 1.6 });
    };
    this.cam = new ChaseCamera(ctx.camera, { mode: 'track' });
    this.hud = new RaceHud(ctx.ui, { races: this.races });

    // config.startRace only comes from a ?race=K URL (see params.js), so it
    // applies to that one run, not to series started later from Race setup.
    const first = Math.min(this.races, Math.max(1, Math.round(Number(config.startRace)) || 1)) - 1;
    this._startRace(first);

    const d = ctx.debug;
    d.watch('race', () => `${this.index + 1}/${this.races} d${this.level.level}`);
    d.watch('seed', () => this.seed);
    d.watch('piece', () => this.sim && `${this.sim.track.pieceAt(this.sim.s).id}`);
    d.watch('s', () => this.sim && `${this.sim.s.toFixed(0)}/${this.sim.length.toFixed(0)}`);
    d.watch('place', () => this.sim?.currentPlace());
    d.watch('speed', () => this.ball.groundSpeed);
    d.watch('ai', () => this.sim?.racers.map((r) => r.s.toFixed(0)).join(' '));
    d.watch('falls', () => this.sim?.falls);
  }

  // ------------------------------------------------------------ series flow

  _startRace(index, seedOverride = null) {
    const { ctx } = this;
    this._closePanel();
    this.sim?.dispose();
    this.scenery?.dispose();
    this.index = index;
    this.seed = seedOverride || raceSeed(this.config.seed, index);
    this.sim = new RaceSim({
      physics: ctx.physics,
      scene: ctx.scene,
      difficulty: this.level.level,
      seed: this.seed,
      skin: this.skin,
      ball: this.ball,
      onEvent: (name, data) => this._onSimEvent(name, data),
    });
    this.scenery = buildScenery(ctx.scene, this.sim.track, this.seed);
    this.state = 'countdown';
    this.stateT = 0;
    this.countStep = 0;
    this.fade = 0;
    this.cam.snap(this.ball.getPosition(), this.sim.forward);
    this.hud.setupRace({
      playerSkin: this.skin,
      aiSkins: this.sim.racers.map((r) => r.skin),
      raceIndex: index,
      medals: this.medals,
    });
  }

  _onSimEvent(name, data) {
    const { audio } = this.ctx;
    switch (name) {
      case 'checkpoint':
        this.hud.checkpoint();
        audio.play('beep', { pitch: 1.5, volume: 0.7 });
        break;
      case 'boost':
        this.hud.boost();
        audio.play('whoosh');
        break;
      case 'bumper':
        audio.play('boing', { volume: 0.5, pitch: 1.3 });
        break;
      case 'hazard':
        audio.play('thump');
        break;
      case 'respawn':
        this.cam.snap(data.position, data.forward);
        audio.play('boing');
        break;
      case 'finish':
        this._onFinish(data.place);
        break;
      default:
        break;
    }
  }

  _onFinish(place) {
    const medal = medalForPlace(place);
    this.places[this.index] = place;
    this.medals[this.index] = medal;
    this.state = 'finished';
    this.stateT = 0;
    this.hud.setPlace(place);
    this.hud.finish();
    this.ctx.audio.play('confetti');
    this.ctx.events.emit('raceFinished', {
      difficulty: this.level.level,
      raceIndex: this.index,
      races: this.races,
      place,
      medal,
    });
  }

  /** Finishing order for the podium: [{skin, me}] with the player at its place. */
  _finishOrder() {
    const ais = this.sim.racers
      .slice()
      .sort((a, b) => {
        if (a.finished !== b.finished) return a.finished ? -1 : 1;
        if (a.finished) return a.driver.finishTime - b.driver.finishTime;
        return b.s - a.s;
      })
      .map((r) => ({ skin: r.skin, me: false }));
    ais.splice(this.sim.place - 1, 0, { skin: this.skin, me: true });
    return ais;
  }

  _showResults() {
    const { ctx } = this;
    this.state = 'results';
    this.hud.setVisible(false);
    const place = this.sim.place;
    ctx.audio.play('fanfare', { pitch: place === 1 ? 1 : place === 2 ? 0.94 : 0.88 });
    const isLast = this.index >= this.races - 1;
    this.panel = showRaceResult(ctx.ui, {
      place,
      order: this._finishOrder(),
      medals: this.medals,
      races: this.races,
      isLast,
      tapDelay: RACE_TUNING.tapDelay,
      audio: ctx.audio,
      onNext: () => (isLast ? this._showTrophy() : this._startRace(this.index + 1)),
    });
    if (place === 1) this.hud.confetti(50, this.panel.el);
  }

  _showTrophy() {
    const { ctx } = this;
    this._closePanel();
    this.state = 'trophy';
    const medals = this.medals.filter(Boolean);
    const cup = cupForPlaces(this.places.filter(Boolean));
    ctx.events.emit('seriesComplete', { difficulty: this.level.level, races: this.races, medals, cup });
    ctx.audio.play('fanfare');
    ctx.audio.play('confetti');
    this.panel = showTrophy(ctx.ui, {
      medals,
      cup,
      seed: this.config.seed,
      tapDelay: RACE_TUNING.tapDelay,
      audio: ctx.audio,
      onDone: () => this._goHome(),
    });
    this.hud.confetti(90, this.panel.el);
  }

  _goHome() {
    const { router, onExit } = this.ctx;
    // Plan §3.4: the trophy goes Home (the Race setup shows the new best cup).
    if (router?.has?.('home')) router.go('home');
    else onExit();
  }

  _closePanel() {
    this.panel?.dispose();
    this.panel = null;
  }

  // ------------------------------------------------------------ loop

  update(dt) {
    this.stateT += dt;
    if (this.state === 'countdown') {
      const step = COUNTDOWN[this.countStep];
      if (step && this.stateT >= step.t) {
        this.countStep++;
        this.hud.countdown(step.text);
        if (step.text === 'GO!') {
          this.ctx.audio.play('go');
          this.sim.start();
          this.state = 'racing';
        } else {
          this.ctx.audio.play('beep');
        }
      }
    } else if (this.state === 'finished' && this.stateT >= RACE_TUNING.finishBannerTime) {
      this._showResults();
    }
    const move = this.state === 'racing' ? this.ctx.input.getMove() : null;
    this.sim.update(dt, move);
  }

  postStep(dt) {
    this.sim.postStep(dt);
  }

  render(alpha, frameDt) {
    const dt = Math.min(frameDt || 0, 0.1);
    const look = this.ctx.input.consumeLook();
    if (look.dx || look.dy) this.cam.addLook(look.dx, look.dy);
    const sim = this.sim;
    sim.render(alpha, frameDt);
    this.cam.setForward(sim.forward);
    this.cam.update(dt, { position: this.ball.position, velocity: this.ball.velocity });

    // Fall fade: up while falling, back down after the respawn.
    const target = sim.fallTimer > 0 ? 0.85 * (1 - sim.fallTimer / RACE_TUNING.respawnDelay) : 0;
    this.fade += (target - this.fade) * Math.min(1, dt * (target > this.fade ? 10 : 4));
    this.hud.setFade(this.fade < 0.01 ? 0 : this.fade);

    // HUD (DOM writes every other frame are plenty).
    if (this._frame++ % 2 === 0 && this.state !== 'results' && this.state !== 'trophy') {
      const len = sim.length;
      const ai = this._aiFrac;
      ai.length = sim.racers.length;
      for (let i = 0; i < ai.length; i++) ai[i] = sim.racers[i].s / len;
      this.hud.setProgress(sim.finished ? 1 : sim.s / len, ai);
      if (this.state === 'racing') this.hud.setPlace(sim.currentPlace());
    }
  }

  // ------------------------------------------------------------ debug hooks

  respawn() {
    if (this.state === 'racing' && !this.sim.finished) this.sim.respawn();
  }

  nextPiece() {
    if (this.state === 'racing' && !this.sim.finished) this.sim.skipToNextPiece();
  }

  regenerate() {
    // New emoji series seed (so the code can be typed back in); later races
    // in this series follow it too.
    this.config = { ...this.config, seed: randomEmojiSeed() };
    this._startRace(this.index);
  }

  dispose() {
    this._closePanel();
    this.hud?.dispose();
    this.sim?.dispose();
    this.sim = null;
    this.scenery?.dispose();
    this.ball?.dispose();
  }
}
