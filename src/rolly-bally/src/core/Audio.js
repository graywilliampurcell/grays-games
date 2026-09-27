// Tiny synthesized sound effects via WebAudio (no asset files).
// iOS Safari only allows audio after a user gesture, so the context is
// created/resumed on the first pointerdown/keydown. Respects save.settings.sound.
//
// audio.play(name, {volume, pitch}) where name is one of SOUNDS.

export const SOUNDS = [
  'boing', 'whoosh', 'pop', 'sparkle', 'thump', 'beep', 'go', 'fanfare', 'confetti', 'click', 'unlock',
];

export class Audio {
  /** @param {{save?: {get(): any}}} opts */
  constructor({ save = null } = {}) {
    this.save = save;
    this.ctx = null;
    this.master = null;
    this._unlock = this._unlock.bind(this);
    window.addEventListener('pointerdown', this._unlock, true);
    window.addEventListener('keydown', this._unlock, true);
    window.addEventListener('touchend', this._unlock, true);
    // Try to recover after the app comes back; a later tap is the reliable unlock on iOS.
    this._onVisible = () => {
      if (!document.hidden && this.ctx) this._unlock();
    };
    document.addEventListener('visibilitychange', this._onVisible);
    window.addEventListener('pageshow', this._onVisible);
  }

  get enabled() {
    try {
      return this.save ? this.save.get().settings.sound !== false : true;
    } catch {
      return true;
    }
  }

  _unlock() {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
      }
      // iOS Safari uses the non-standard 'interrupted' state after locking,
      // backgrounding or a call, so resume whenever we're not running.
      if (this.ctx.state !== 'running') this.ctx.resume()?.catch?.(() => {});
    } catch {
      // no audio available; stay silent
    }
  }

  // ---------------------------------------------------------- primitives

  _tone({ type = 'sine', freq = 440, to = null, start = 0, dur = 0.2, vol = 0.5, attack = 0.005 }) {
    const c = this.ctx;
    const t0 = c.currentTime + start;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq * this._pitch, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to * this._pitch), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol * this._vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  _noise({ start = 0, dur = 0.3, vol = 0.4, filter = 'bandpass', freq = 1200, to = null, q = 1 }) {
    const c = this.ctx;
    const t0 = c.currentTime + start;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = filter;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t0);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol * this._vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  // ---------------------------------------------------------- sounds

  /** Play a named effect. Unknown names and muted/locked audio are no-ops. */
  play(name, { volume = 1, pitch = 1 } = {}) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    this._vol = volume;
    this._pitch = pitch;
    try {
      switch (name) {
        case 'boing':
          this._tone({ type: 'triangle', freq: 180, to: 520, dur: 0.12, vol: 0.5 });
          this._tone({ type: 'triangle', freq: 520, to: 260, start: 0.1, dur: 0.25, vol: 0.4 });
          break;
        case 'whoosh':
          this._noise({ dur: 0.45, vol: 0.5, freq: 400, to: 3000, q: 2 });
          break;
        case 'pop':
          this._tone({ type: 'sine', freq: 600, to: 1200, dur: 0.08, vol: 0.5 });
          break;
        case 'sparkle':
          [1318, 1760, 2093, 2637].forEach((f, i) => this._tone({ type: 'sine', freq: f, start: i * 0.05, dur: 0.18, vol: 0.25 }));
          break;
        case 'thump':
          this._tone({ type: 'sine', freq: 120, to: 45, dur: 0.25, vol: 0.8 });
          this._noise({ dur: 0.12, vol: 0.3, filter: 'lowpass', freq: 600 });
          break;
        case 'beep':
          this._tone({ type: 'square', freq: 660, dur: 0.18, vol: 0.25 });
          break;
        case 'go':
          this._tone({ type: 'square', freq: 1320, dur: 0.5, vol: 0.28 });
          break;
        case 'fanfare':
          [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.4]].forEach(([f, s], i) =>
            this._tone({ type: 'square', freq: f, start: s, dur: i === 3 ? 0.6 : 0.14, vol: 0.2 }));
          break;
        case 'confetti':
          for (let i = 0; i < 6; i++) this._noise({ start: i * 0.04, dur: 0.08, vol: 0.25, freq: 2500 + i * 400, q: 4 });
          break;
        case 'click':
          this._tone({ type: 'triangle', freq: 900, dur: 0.05, vol: 0.3 });
          break;
        case 'unlock':
          [784, 988, 1175, 1568].forEach((f, i) => this._tone({ type: 'triangle', freq: f, start: i * 0.09, dur: 0.3, vol: 0.3 }));
          break;
        default:
          break;
      }
    } catch {
      // never let sound break the game
    }
  }

  dispose() {
    window.removeEventListener('pointerdown', this._unlock, true);
    window.removeEventListener('keydown', this._unlock, true);
    window.removeEventListener('touchend', this._unlock, true);
    document.removeEventListener('visibilitychange', this._onVisible);
    window.removeEventListener('pageshow', this._onVisible);
    if (this.ctx) this.ctx.close()?.catch?.(() => {});
  }
}
