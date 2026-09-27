// requestAnimationFrame loop with a fixed-step accumulator.
// update(dt) runs at a fixed 1/60 s (at most maxSubSteps per frame, so a
// long stall never spirals); render(alpha) runs once per frame with the
// interpolation factor between the last two fixed steps and the real frame dt.

export const FIXED_DT = 1 / 60;

export class Loop {
  constructor({ update, render, step = FIXED_DT, maxSubSteps = 3 } = {}) {
    this.update = update || (() => {});
    this.render = render || (() => {});
    this.step = step;
    this.maxSubSteps = maxSubSteps;
    this.accumulator = 0;
    this.running = false;
    this._last = 0;
    this._raf = 0;
    this._frame = this._frame.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._last = performance.now();
    this.accumulator = 0;
    this._raf = requestAnimationFrame(this._frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this._raf);
  }

  _frame(now) {
    if (!this.running) return;
    this._raf = requestAnimationFrame(this._frame);
    const frameDt = (now - this._last) / 1000;
    this._last = now;
    this.tick(frameDt);
  }

  /**
   * Advance by a real frame duration (seconds). Pure apart from the hooks,
   * so tests can drive it directly. Returns the number of fixed steps run.
   */
  tick(frameDt) {
    // Clamp negative/huge deltas (tab switch, debugger pause).
    const dt = Math.min(Math.max(frameDt, 0), 0.25);
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= this.step && steps < this.maxSubSteps) {
      this.update(this.step);
      this.accumulator -= this.step;
      steps++;
    }
    // Couldn't catch up: drop the backlog rather than slow-motion forever.
    if (steps === this.maxSubSteps && this.accumulator >= this.step) {
      this.accumulator = this.accumulator % this.step;
    }
    this.render(this.accumulator / this.step, dt);
    return steps;
  }
}
