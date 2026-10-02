// Music and sound effects (plan Section 5). Everything is made in the browser:
// the music and the crowd cheer are synthesized with Web Audio, and "Ouch!" is
// spoken by the device's own voice (with a synthesized "ow" if it has none).
//
// Browsers only allow sound after the player touches or presses something, so
// nothing plays until the first key press or tap.

const SFX_LEVEL = 0.8;
const MUSIC_LEVEL = SFX_LEVEL / 2; // music about half as loud as the sound effects
const TEMPO = 104; // beats per minute
const EIGHTH = 60 / TEMPO / 2;

// Note number -> frequency (69 = A4)
const hz = (n) => 440 * 2 ** ((n - 69) / 12);

// The music: 8 bars of steady eighth notes ("dun dun dun dun"), D minor,
// with a tiptoeing melody on top. null = rest.
const D2 = 38, C2 = 36, Bb1 = 34, A1 = 33;
const BASS_BARS = [D2, D2, Bb1, A1, D2, D2, Bb1, C2];
const MELODY = [
    // bar 1-4
    62, null, 65, null, 64, null, 61, null,
    62, null, null, null, 57, null, null, null,
    58, null, 62, null, 61, null, 64, null,
    62, null, null, null, null, null, null, null,
    // bar 5-8: same sneaky idea, a little higher
    69, null, 70, null, 69, null, 68, null,
    69, null, null, null, 65, null, null, null,
    67, null, 65, null, 64, null, 61, null,
    62, null, null, null, null, null, null, null,
];

export class Sound {
    // settings: { music: bool, sfx: bool }; onEvent(name) is told every time a sound starts
    constructor(settings, onEvent = () => {}) {
        this.settings = settings;
        this.onEvent = onEvent;
        this.ctx = null;
        this.musicWanted = false;
        this.musicStep = 0;
        this.nextNoteTime = 0;
        this.timer = null;

        const unlock = () => this.unlock();
        for (const type of ['keydown', 'pointerdown', 'touchend']) {
            window.addEventListener(type, unlock, { capture: true });
        }
        // Go quiet while the game is in the background
        document.addEventListener('visibilitychange', () => {
            if (!this.ctx) return;
            if (document.hidden) this.ctx.suspend();
            else this.ctx.resume();
        });
    }

    // Called on every key press or tap: the first one switches sound on
    unlock() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            this.ctx = new AudioContext();
            // Soft limiter so nothing is ever loud enough to hurt
            this.limiter = this.ctx.createDynamicsCompressor();
            this.limiter.threshold.value = -10;
            this.limiter.ratio.value = 12;
            this.limiter.connect(this.ctx.destination);
            this.sfxBus = this.ctx.createGain();
            this.sfxBus.connect(this.limiter);
            this.musicBus = this.ctx.createGain();
            this.musicBus.connect(this.limiter);
            this.noise = this.makeNoise();
            this.applySettings();
            // iPad: speech must first be used during a tap, so say nothing now
            if (window.speechSynthesis) {
                const hush = new SpeechSynthesisUtterance(' ');
                hush.volume = 0;
                window.speechSynthesis.speak(hush);
            }
        }
        if (this.ctx.state === 'suspended' && !document.hidden) this.ctx.resume();
        if (this.musicWanted && !this.timer) this.startScheduler();
    }

    applySettings() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        this.sfxBus.gain.setTargetAtTime(this.settings.sfx ? SFX_LEVEL : 0, now, 0.03);
        this.musicBus.gain.setTargetAtTime(this.settings.music ? MUSIC_LEVEL : 0, now, 0.1);
    }

    // ---- Music ----

    startMusic() {
        this.musicWanted = true;
        if (this.ctx) this.startScheduler();
    }

    stopMusic() {
        this.musicWanted = false;
        clearInterval(this.timer);
        this.timer = null;
    }

    startScheduler() {
        if (this.timer) return;
        this.nextNoteTime = this.ctx.currentTime + 0.1;
        this.onEvent('music');
        // Look a little ahead and book the notes that fall inside that window
        this.timer = setInterval(() => {
            while (this.nextNoteTime < this.ctx.currentTime + 0.2) {
                this.playStep(this.musicStep, this.nextNoteTime);
                this.musicStep = (this.musicStep + 1) % (BASS_BARS.length * 8);
                this.nextNoteTime += EIGHTH;
            }
        }, 25);
    }

    playStep(step, t) {
        const bar = Math.floor(step / 8);
        const beat = step % 8;
        // Steady bass: every eighth note, a little stronger on the beat
        this.pluck(hz(BASS_BARS[bar]), t, beat % 2 === 0 ? 0.55 : 0.4, 0.22, 'triangle', 500);
        // Tiptoe melody
        const m = MELODY[step % MELODY.length];
        if (m !== null) this.pluck(hz(m), t, 0.16, 0.16, 'square', 1400);
        // Soft tick on the off-beats
        if (beat % 2 === 1) this.tick(t);
    }

    pluck(freq, t, level, length, wave, brightness) {
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        osc.type = wave;
        osc.frequency.value = freq;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(brightness, t);
        filter.frequency.exponentialRampToValueAtTime(brightness / 4, t + length);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(level, t + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
        osc.connect(filter).connect(gain).connect(this.musicBus);
        osc.start(t);
        osc.stop(t + length + 0.02);
    }

    tick(t) {
        const src = this.noiseSource(t, 0.05);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 7000;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
        src.connect(filter).connect(gain).connect(this.musicBus);
    }

    // ---- Sound effects ----

    // A voice says "Ouch!" (the spike)
    ouch() {
        if (!this.settings.sfx) return;
        this.onEvent('ouch');
        const speech = window.speechSynthesis;
        const voices = speech?.getVoices() || [];
        if (speech && voices.length > 0) {
            speech.cancel();
            const say = new SpeechSynthesisUtterance('Ouch!');
            const english = voices.filter((v) => v.lang?.startsWith('en'));
            say.voice = english.find((v) => v.default) || english[0] || voices[0];
            say.rate = 1.1;
            say.pitch = 1.3;
            say.volume = SFX_LEVEL;
            speech.speak(say);
        } else if (this.ctx) {
            this.syntheticOw(this.ctx.currentTime + 0.01);
        }
    }

    // A voice-like "ow" for devices with no speaking voice: a buzzy tone
    // through vowel filters sliding from "ah" to "oo"
    syntheticOw(t) {
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.linearRampToValueAtTime(340, t + 0.08);
        osc.frequency.exponentialRampToValueAtTime(190, t + 0.45);
        const out = ctx.createGain();
        out.gain.setValueAtTime(0.0001, t);
        out.gain.exponentialRampToValueAtTime(0.7, t + 0.03);
        out.gain.setValueAtTime(0.7, t + 0.25);
        out.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        for (const [from, to, level] of [[800, 350, 1], [1200, 650, 0.5]]) {
            const formant = ctx.createBiquadFilter();
            formant.type = 'bandpass';
            formant.Q.value = 8;
            formant.frequency.setValueAtTime(from, t);
            formant.frequency.exponentialRampToValueAtTime(to, t + 0.4);
            const g = ctx.createGain();
            g.gain.value = level;
            osc.connect(formant).connect(g).connect(out);
        }
        out.connect(this.sfxBus);
        osc.start(t);
        osc.stop(t + 0.55);
    }

    // Lots of people clapping and shouting "yay!" (reaching the door)
    cheer() {
        if (!this.settings.sfx || !this.ctx) return;
        this.onEvent('cheer');
        const ctx = this.ctx;
        const t0 = ctx.currentTime + 0.02;
        const length = 3.5;
        const rand = (a, b) => a + Math.random() * (b - a);

        const crowd = ctx.createGain();
        crowd.gain.setValueAtTime(0.0001, t0);
        crowd.gain.exponentialRampToValueAtTime(1.7, t0 + 0.25);
        crowd.gain.setValueAtTime(1.7, t0 + length - 1.2);
        crowd.gain.exponentialRampToValueAtTime(0.0001, t0 + length);
        crowd.connect(this.sfxBus);

        // Crowd roar: noise shaped like a room full of voices
        const roar = this.noiseSource(t0, length);
        const roarFilter = ctx.createBiquadFilter();
        roarFilter.type = 'bandpass';
        roarFilter.frequency.value = 900;
        roarFilter.Q.value = 0.8;
        const roarGain = ctx.createGain();
        roarGain.gain.value = 0.35;
        roar.connect(roarFilter).connect(roarGain).connect(crowd);

        // Shouting voices: each one a "yaaay" that slides up then down
        for (let v = 0; v < 16; v++) {
            const start = t0 + rand(0, 0.6);
            const dur = rand(0.8, 2.2);
            const base = rand(170, 420);
            const osc = ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(base, start);
            osc.frequency.exponentialRampToValueAtTime(base * rand(1.3, 1.7), start + dur * 0.35);
            osc.frequency.exponentialRampToValueAtTime(base * rand(0.9, 1.1), start + dur);
            const wobble = ctx.createOscillator();
            wobble.frequency.value = rand(5, 7);
            const wobbleDepth = ctx.createGain();
            wobbleDepth.gain.value = base * 0.03;
            wobble.connect(wobbleDepth).connect(osc.frequency);
            const voice = ctx.createGain();
            voice.gain.setValueAtTime(0.0001, start);
            voice.gain.exponentialRampToValueAtTime(0.07, start + 0.08);
            voice.gain.exponentialRampToValueAtTime(0.0001, start + dur);
            for (const [from, to] of [[750, 600], [1150, 1900]]) {
                const formant = ctx.createBiquadFilter();
                formant.type = 'bandpass';
                formant.Q.value = 5;
                formant.frequency.setValueAtTime(from, start);
                formant.frequency.linearRampToValueAtTime(to, start + dur);
                osc.connect(formant).connect(voice);
            }
            voice.connect(crowd);
            osc.start(start);
            wobble.start(start);
            osc.stop(start + dur + 0.05);
            wobble.stop(start + dur + 0.05);
        }

        // Clapping: a dozen people, each clapping a little faster or slower
        for (let p = 0; p < 12; p++) {
            const gap = rand(0.17, 0.26);
            const tone = rand(900, 2200);
            for (let t = t0 + rand(0, gap); t < t0 + length - 0.4; t += gap * rand(0.9, 1.1)) {
                const clap = this.noiseSource(t, 0.08);
                const filter = ctx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.value = tone;
                filter.Q.value = 1.2;
                const g = ctx.createGain();
                g.gain.setValueAtTime(0.0001, t);
                g.gain.exponentialRampToValueAtTime(rand(0.25, 0.45), t + 0.002);
                g.gain.exponentialRampToValueAtTime(0.0001, t + rand(0.03, 0.06));
                clap.connect(filter).connect(g).connect(crowd);
            }
        }
    }

    // ---- Helpers ----

    makeNoise() {
        const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        return buffer;
    }

    noiseSource(t, length) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noise;
        src.loop = length > 2;
        src.start(t, Math.random() * 1.5);
        src.stop(t + length);
        return src;
    }
}
