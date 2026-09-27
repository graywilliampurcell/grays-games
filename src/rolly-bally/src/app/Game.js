// Game "scene host": owns the renderer, camera, loop and shared services, and
// runs one mode at a time. Each run gets a fresh THREE.Scene, Physics world,
// Rng and HUD root; everything is torn down on stop. See CONTRACT.md §Modes.

import * as THREE from 'three';
import { Loop } from '../core/Loop.js';
import { Physics } from '../core/Physics.js';
import { Rng } from '../core/Rng.js';
import { makeDefaultLights, applySky } from '../voxel/BlockMesh.js';
import { loadMode } from './modes.js';
import { normalizeConfig } from './configs.js';
import { createHomeButton } from './HomeButton.js';
import { showReloadButton } from './reloadButton.js';

export class Game {
  /**
   * @param {object} opts
   * @param {HTMLCanvasElement} opts.canvas
   * @param {HTMLElement} opts.hudRoot container for mode HUDs (#mode-ui)
   * @param {object} opts.app shared services: {router, save, audio, input, events, debug, params}
   */
  constructor({ canvas, hudRoot, app }) {
    this.app = app;
    this.hudRoot = hudRoot;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
    this.scene = null;
    this.physics = null;
    this.mode = null;
    this.ctx = null;
    this.running = false;
    this.paused = false;

    this.loop = new Loop({
      update: (dt) => this._update(dt),
      render: (alpha, frameDt) => this._render(alpha, frameDt),
    });

    this._resize = this._resize.bind(this);
    window.addEventListener('resize', this._resize);
    window.addEventListener('orientationchange', this._resize);
    this._resize();

    this._onVisibility = () => {
      if (!this.running || this.contextLost) return;
      if (document.hidden) this.loop.stop();
      else this.loop.start();
    };
    document.addEventListener('visibilitychange', this._onVisibility);

    this._onKey = this._onKey.bind(this);
    window.addEventListener('keydown', this._onKey);

    // iPad Safari can drop the WebGL context (backgrounding, memory
    // pressure). Rebuilding every scene resource is not worth it here: stop
    // and offer a big reload button instead of a frozen/black canvas.
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      console.warn('[game] WebGL context lost');
      this.contextLost = true;
      this.loop.stop();
      showReloadButton();
    });
  }

  _resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    // Portrait / narrow: widen the view so the track still fits.
    this.camera.fov = this.camera.aspect < 1 ? 75 : 60;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Start mode `name` with `config`. `onExit` is called when the mode (or the
   * Home button) asks to leave; the play screen passes one that navigates away.
   */
  async runMode(name, config, { onExit } = {}) {
    await this.stopMode();
    const { save, audio, input, events, debug, router, params } = this.app;
    const cfg = normalizeConfig(name, config);
    const mode = await loadMode(name);

    const scene = new THREE.Scene();
    scene.add(makeDefaultLights());
    applySky(scene, name === 'playground' ? cfg.theme || 'grass' : 'race');
    const physics = new Physics();
    const ui = document.createElement('div');
    ui.className = 'mode-ui';
    ui.dataset.mode = name;
    this.hudRoot.appendChild(ui);

    let exited = false;
    const exit = () => {
      if (exited) return;
      exited = true;
      if (onExit) onExit();
    };
    // Holding Home pauses and shows the pause overlay (UI's app.showPause);
    // without one it exits straight away.
    const homeButton = createHomeButton(() => this.pause());
    ui.appendChild(homeButton);

    this.camera.position.set(0, 5, 10);
    this.camera.lookAt(0, 0, 0);
    this.camera.fov = this.camera.aspect < 1 ? 75 : 60;
    this.camera.near = 0.1;
    this.camera.far = 400;
    this.camera.updateProjectionMatrix();

    this.scene = scene;
    this.physics = physics;
    this.mode = mode;
    this._exit = exit;
    this.ctx = {
      THREE,
      renderer: this.renderer,
      scene,
      camera: this.camera,
      physics,
      input,
      audio,
      save,
      events,
      debug,
      router,
      params,
      rng: new Rng(cfg.seed),
      ui,
      hud: { homeButton },
      modeName: name,
      config: cfg,
      onExit: exit,
    };
    input.reset();
    input.setEnabled(true);
    debug.clearFields();

    await mode.start(this.ctx, cfg);
    this.running = true;
    if (!this.contextLost) this.loop.start();
    return mode;
  }

  /** Pause the running mode and show the pause overlay (Home held 1 s). */
  pause() {
    if (!this.ctx || this.paused) return;
    const exit = this._exit;
    if (!this.app.showPause) {
      exit();
      return;
    }
    const { input } = this.app;
    const inputWas = input.enabled;
    this.paused = true;
    input.setEnabled(false);
    this._closePause = this.app.showPause({
      root: this.ctx.ui,
      // The mode's current seed (regenerate may have changed it).
      seed: this.mode.config?.seed || this.ctx.config.seed,
      resume: () => {
        this._closePause = null;
        this.paused = false;
        input.reset();
        input.setEnabled(inputWas);
      },
      exit: () => {
        this._closePause = null;
        exit();
      },
    });
  }

  /** Stop and dispose the current mode, its scene, physics and HUD. */
  async stopMode() {
    this.loop.stop();
    this.running = false;
    this.paused = false;
    if (this._closePause) this._closePause();
    this._closePause = null;
    this._exit = null;
    const { mode, ctx, scene, physics } = this;
    this.mode = null;
    this.ctx = null;
    this.scene = null;
    this.physics = null;
    if (mode) {
      try {
        await mode.dispose();
      } catch (err) {
        console.error('[game] mode.dispose failed', err);
      }
    }
    if (ctx) ctx.ui.remove();
    if (scene) disposeScene(scene);
    if (physics) physics.dispose();
    this.app.input.setEnabled(false);
    this.app.debug.clearFields();
    // Clear the last frame so menus don't sit on top of a frozen game.
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.clear();
  }

  _update(dt) {
    if (!this.mode || this.paused) return;
    this.app.input.update();
    this.mode.update(dt);
    if (!this.physics || this.physics.disposed) return; // mode exited mid-update
    this.physics.step(dt);
    if (this.mode.postStep) this.mode.postStep(dt);
  }

  _render(alpha, frameDt) {
    if (!this.mode || !this.scene) return;
    // Paused: keep drawing the frozen scene but don't advance the mode's
    // animations/timers (countdowns etc. live in render()).
    if (!this.paused) this.mode.render(alpha, frameDt);
    if (!this.scene) return;
    this.renderer.render(this.scene, this.camera);
    this.app.debug.frame(frameDt, this.renderer);
  }

  _onKey(e) {
    if (!this.mode || !this.app.debug.enabled || e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === 'r' && this.mode.respawn) this.mode.respawn();
    else if (k === 'n' && this.mode.nextPiece) this.mode.nextPiece();
    else if (k === 'g' && this.mode.regenerate) this.mode.regenerate();
  }
}

/** Dispose every geometry/material/texture reachable from a scene. */
export function disposeScene(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      for (const v of Object.values(m)) {
        // Skin textures are cached/shared; they are small, so leave them.
        if (v && v.isTexture && !v.userData?.shared) v.dispose();
      }
      m.dispose();
    }
    if (o.isInstancedMesh) o.dispose();
  });
  root.clear();
}
