// Unified input → move vector {x, y} in [-1, 1].
//   x: +1 = steer right, y: +1 = forward (away from the camera).
// Sources: relative virtual joystick (touch/mouse drag anywhere), WASD/arrows,
// Gamepad left stick. The strongest source wins per frame.
// Two-finger drag accumulates a "look" delta (pixels) for the camera.
//
// Touches that start on UI controls (button, a, input, [data-ui], .ui-block)
// are ignored so HUD buttons never also steer the ball.

const JOY_RADIUS = 60; // px of drag for full deflection
const DEADZONE = 0.12;

const IGNORE_SELECTOR = 'button, a, input, select, textarea, label, [data-ui], .ui-block';

function clampLen(x, y, max = 1) {
  const len = Math.hypot(x, y);
  if (len <= max) return { x, y };
  return { x: (x / len) * max, y: (y / len) * max };
}

export class Input {
  /**
   * @param {object} opts
   * @param {HTMLElement} opts.joystickParent element the joystick ring is drawn into
   * @param {EventTarget} [opts.target=window] where pointer events are listened for
   */
  constructor({ joystickParent = document.body, target = window } = {}) {
    this.target = target;
    this.enabled = true;
    this.keys = new Set();
    this.pointers = new Map(); // pointerId -> {x, y, startX, startY}
    this.joyId = null; // pointerId driving the joystick
    this.joy = { x: 0, y: 0 };
    this.look = { dx: 0, dy: 0 };
    this.move = { x: 0, y: 0 };
    this.source = 'none'; // 'touch' | 'keys' | 'gamepad' | 'none'
    this.lastTouchTime = 0;

    this.ring = document.createElement('div');
    this.ring.className = 'joy-ring';
    this.knob = document.createElement('div');
    this.knob.className = 'joy-knob';
    this.ring.appendChild(this.knob);
    this.ring.style.display = 'none';
    joystickParent.appendChild(this.ring);

    this._onDown = this._onDown.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onUp = this._onUp.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlur = () => this.reset();

    target.addEventListener('pointerdown', this._onDown, { passive: false });
    window.addEventListener('pointermove', this._onMove, { passive: false });
    window.addEventListener('pointerup', this._onUp);
    window.addEventListener('pointercancel', this._onUp);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
  }

  /** Enable/disable steering input (e.g. during countdown or results). */
  setEnabled(on) {
    this.enabled = on;
    if (!on) this.reset();
  }

  /** Forget all held keys/fingers and hide the joystick. */
  reset() {
    this.keys.clear();
    this.pointers.clear();
    this.joyId = null;
    this.joy = { x: 0, y: 0 };
    this.look = { dx: 0, dy: 0 };
    this.move = { x: 0, y: 0 };
    this.ring.style.display = 'none';
  }

  // ------------------------------------------------------------ pointer

  _onDown(e) {
    if (!this.enabled) return;
    if (e.target instanceof Element && e.target.closest(IGNORE_SELECTOR)) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY });
    if (e.pointerType === 'touch') this.lastTouchTime = performance.now();
    if (this.pointers.size === 1) {
      this.joyId = e.pointerId;
      this.joy = { x: 0, y: 0 };
      this.ring.style.display = 'block';
      this.ring.style.left = `${e.clientX}px`;
      this.ring.style.top = `${e.clientY}px`;
      this.knob.style.transform = 'translate(-50%, -50%)';
    } else {
      // Second finger: switch to camera look, park the joystick.
      this.joyId = null;
      this.joy = { x: 0, y: 0 };
      this.ring.style.display = 'none';
    }
  }

  _onMove(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (this.pointers.size >= 2) {
      // Average motion of all fingers → look delta.
      this.look.dx += dx / this.pointers.size;
      this.look.dy += dy / this.pointers.size;
      return;
    }
    if (e.pointerId === this.joyId) {
      let ox = p.x - p.startX;
      let oy = p.y - p.startY;
      // Relative joystick: if you drag past the rim, the ring follows the finger.
      const len = Math.hypot(ox, oy);
      if (len > JOY_RADIUS) {
        p.startX = p.x - (ox / len) * JOY_RADIUS;
        p.startY = p.y - (oy / len) * JOY_RADIUS;
        ox = p.x - p.startX;
        oy = p.y - p.startY;
        this.ring.style.left = `${p.startX}px`;
        this.ring.style.top = `${p.startY}px`;
      }
      this.joy = clampLen(ox / JOY_RADIUS, -oy / JOY_RADIUS);
      this.knob.style.transform = `translate(calc(-50% + ${ox}px), calc(-50% + ${oy}px))`;
    }
  }

  _onUp(e) {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);
    if (e.pointerId === this.joyId || this.pointers.size === 0) {
      this.joyId = null;
      this.joy = { x: 0, y: 0 };
      this.ring.style.display = 'none';
    }
    // Back to one finger after a two-finger look: that finger steers again.
    if (this.pointers.size === 1 && this.joyId === null) {
      const [id, p] = this.pointers.entries().next().value;
      this.joyId = id;
      p.startX = p.x;
      p.startY = p.y;
      this.joy = { x: 0, y: 0 };
      this.ring.style.display = 'block';
      this.ring.style.left = `${p.x}px`;
      this.ring.style.top = `${p.y}px`;
      this.knob.style.transform = 'translate(-50%, -50%)';
    }
  }

  // ------------------------------------------------------------ keyboard

  _onKeyDown(e) {
    if (e.target instanceof Element && e.target.closest('input, textarea')) return;
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    this.keys.add(k);
  }

  _onKeyUp(e) {
    this.keys.delete(e.key.toLowerCase());
  }

  _keyVector() {
    const k = this.keys;
    const x = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
    const y = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
    return clampLen(x, y);
  }

  // ------------------------------------------------------------ gamepad

  _gamepadVector() {
    if (!navigator.getGamepads) return { x: 0, y: 0 };
    for (const gp of navigator.getGamepads()) {
      if (!gp || !gp.connected || gp.axes.length < 2) continue;
      let x = gp.axes[0];
      let y = -gp.axes[1];
      // D-pad (standard mapping buttons 12-15) as a fallback.
      const b = gp.buttons;
      if (b[12]?.pressed) y = 1;
      if (b[13]?.pressed) y = -1;
      if (b[14]?.pressed) x = -1;
      if (b[15]?.pressed) x = 1;
      if (Math.hypot(x, y) > DEADZONE) return clampLen(x, y);
    }
    return { x: 0, y: 0 };
  }

  // ------------------------------------------------------------ polling

  /** Call once per fixed update (the Game host does). Returns the move vector. */
  update() {
    if (!this.enabled) {
      this.move = { x: 0, y: 0 };
      this.source = 'none';
      return this.move;
    }
    const candidates = [
      ['touch', this.joy],
      ['keys', this._keyVector()],
      ['gamepad', this._gamepadVector()],
    ];
    let best = { x: 0, y: 0 };
    let source = 'none';
    let bestLen = DEADZONE;
    for (const [name, v] of candidates) {
      const len = Math.hypot(v.x, v.y);
      if (len > bestLen) {
        best = v;
        bestLen = len;
        source = name;
      }
    }
    this.move = { x: best.x, y: best.y };
    this.source = source;
    return this.move;
  }

  /** Latest move vector {x, y} (does not poll). */
  getMove() {
    return this.move;
  }

  /** True while a finger/mouse is steering, a key is held or a stick is pushed. */
  isActive() {
    return this.source !== 'none';
  }

  /** Two-finger look delta in pixels since the last call; resets it. */
  consumeLook() {
    const l = this.look;
    this.look = { dx: 0, dy: 0 };
    return l;
  }

  dispose() {
    this.target.removeEventListener('pointerdown', this._onDown);
    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerup', this._onUp);
    window.removeEventListener('pointercancel', this._onUp);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    this.ring.remove();
  }
}
