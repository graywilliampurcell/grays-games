// Debug overlay (only with ?debug=1): fps, draw calls, ball speed, plus any
// fields a mode registers. When disabled every method is a cheap no-op, so
// modes can call ctx.debug.set(...) unconditionally.
//
//   ctx.debug.set('piece', 'hammer #4');           // static value
//   ctx.debug.watch('ai', () => ais.map(...).join()); // re-read every frame

export class DebugOverlay {
  constructor({ enabled = false, parent = document.body } = {}) {
    this.enabled = enabled;
    this.fields = new Map(); // key -> value | () => value
    this._frames = 0;
    this._acc = 0;
    this.fps = 0;
    if (!enabled) return;
    this.el = document.createElement('pre');
    this.el.className = 'debug-overlay';
    this.el.hidden = true; // shown once a mode renders frames
    parent.appendChild(this.el);
  }

  set(key, value) {
    if (this.enabled) this.fields.set(key, value);
  }

  watch(key, fn) {
    if (this.enabled) this.fields.set(key, fn);
  }

  remove(key) {
    this.fields.delete(key);
  }

  /** Drop all mode-registered fields (host calls this between modes). */
  clearFields() {
    this.fields.clear();
    if (this.el) {
      this.el.textContent = '';
      this.el.hidden = true;
    }
  }

  /** Called once per rendered frame by the Game host. */
  frame(dt, renderer) {
    if (!this.enabled) return;
    this._frames++;
    this._acc += dt;
    if (this._acc < 0.25) return;
    this.fps = Math.round(this._frames / this._acc);
    this._frames = 0;
    this._acc = 0;
    const lines = [
      `fps   ${this.fps}`,
      `calls ${renderer.info.render.calls}  tris ${renderer.info.render.triangles}`,
    ];
    for (const [k, v] of this.fields) {
      let val = v;
      try {
        if (typeof v === 'function') val = v();
      } catch (err) {
        val = `! ${err.message}`;
      }
      if (typeof val === 'number') val = val.toFixed(2);
      lines.push(`${k.padEnd(5)} ${val}`);
    }
    lines.push('R respawn  N next  G regen');
    this.el.textContent = lines.join('\n');
    this.el.hidden = false;
  }

  dispose() {
    if (this.el) this.el.remove();
  }
}
