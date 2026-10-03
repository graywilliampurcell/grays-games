// Music and sound effects (plan Section 5). Everything is made in the browser:
// the music and the crowd cheer are synthesized with Web Audio, and "Ouch!" is
// spoken by the device's own voice (with a synthesized "ow" if it has none).
//
// Browsers only allow sound after the player touches or presses something, so
// nothing plays until the first key press or tap.

const SFX_LEVEL = 0.8;
const MUSIC_LEVEL = SFX_LEVEL / 2; // music about half as loud as the sound effects
const CHEER_LEVEL = 1.4; // inside the sound-effects level

// Note number -> frequency (69 = A4)
const hz = (n) => 440 * 2 ** ((n - 69) / 12);

// Each level has its own tune (plan Section 5, Iteration 8): happy on Level 1,
// a little sneakier each level after. A tune is 8 bars of eighth notes:
//   bars:   each bar's bass note and whether its chord is major or minor
//   bass:   what the bass plays on each eighth of a bar, as steps above the bar's
//           note (null = rest, 'lead-in' = one step below the next bar's note)
//   stabs:  eighths with a short chord on top (the bouncy "oom-PAH")
//   melody: one note per eighth (null = rest)
const TUNES = {
    // Level 1: cheerful and bouncy, C major
    happy: {
        tempo: 128,
        bars: [[36, 'maj'], [41, 'maj'], [43, 'maj'], [36, 'maj'], [45, 'min'], [41, 'maj'], [43, 'maj'], [36, 'maj']],
        bass: [0, null, 7, null, 0, null, 7, null],
        bassLength: 0.2,
        stabs: [2, 6],
        stabLevel: 0.07,
        ticks: false,
        melody: [
            72, null, 67, null, 64, 67, 72, null,
            77, null, 76, null, 74, null, 72, null,
            71, null, 74, null, 79, null, 77, 74,
            76, null, 72, null, 72, null, null, null,
            69, null, 72, null, 76, null, 74, 72,
            77, null, 76, 74, 72, null, 69, null,
            71, 72, 74, null, 79, null, 74, null,
            72, null, null, null, null, null, null, null,
        ],
        lead: { wave: 'square', level: 0.15, length: 0.15, brightness: 2600 },
    },
    // Level 2: still happy (G major), with a tiny bit of sneaky: tiptoeing
    // short notes, little creeping half-steps, and one darker bar
    happySneaky: {
        tempo: 116,
        bars: [[43, 'maj'], [43, 'maj'], [36, 'maj'], [38, 'maj'], [43, 'maj'], [40, 'min'], [36, 'min'], [38, 'maj']],
        bass: [0, null, 12, null, 0, null, 12, 'lead-in'],
        bassLength: 0.14,
        stabs: [2, 6],
        stabLevel: 0.045,
        ticks: true,
        melody: [
            67, null, 71, null, 74, null, 73, 74,
            79, null, 78, null, 74, null, null, null,
            76, null, 72, null, 76, 75, 76, null,
            78, null, 74, null, 69, null, null, null,
            67, null, 71, null, 74, null, 79, null,
            76, null, 79, null, 83, null, 81, null,
            75, null, 72, null, 67, null, 75, 74,
            74, null, 73, null, 74, null, null, null,
        ],
        lead: { wave: 'square', level: 0.15, length: 0.11, brightness: 1800 },
    },
    // Level 3: happy (F major) but sneakier than Level 2: shorter tiptoe notes,
    // more creeping half-steps, a lead-in on every bar, and one darker bar
    happySneakier: {
        tempo: 112,
        bars: [[41, 'maj'], [41, 'maj'], [46, 'maj'], [36, 'maj'], [41, 'maj'], [38, 'min'], [37, 'maj'], [36, 'maj']],
        bass: [0, null, 0, null, 7, null, 0, 'lead-in'],
        bassLength: 0.12,
        stabs: [2, 6],
        stabLevel: 0.04,
        ticks: true,
        melody: [
            65, null, 69, null, 72, null, 71, 72,
            77, null, 76, null, 72, null, null, null,
            74, null, 70, null, 74, 73, 74, null,
            76, null, 72, null, 67, null, 66, 67,
            65, null, 69, null, 72, null, 77, null,
            74, null, 77, null, 81, null, 79, null,
            77, null, 73, null, 68, null, 77, 76,
            72, null, 71, null, 72, null, null, null,
        ],
        lead: { wave: 'square', level: 0.15, length: 0.1, brightness: 1600 },
    },
    // Iteration 6's sneaky "dun dun dun dun" tune, D minor. Not on any level
    // yet; kept for Levels 31-40.
    sneaky: {
        tempo: 104,
        bars: [[38, 'min'], [38, 'min'], [34, 'maj'], [33, 'maj'], [38, 'min'], [38, 'min'], [34, 'maj'], [36, 'maj']],
        bass: [0, 0, 0, 0, 0, 0, 0, 0],
        bassLength: 0.22,
        stabs: [],
        ticks: true,
        melody: [
            62, null, 65, null, 64, null, 61, null,
            62, null, null, null, 57, null, null, null,
            58, null, 62, null, 61, null, 64, null,
            62, null, null, null, null, null, null, null,
            69, null, 70, null, 69, null, 68, null,
            69, null, null, null, 65, null, null, null,
            67, null, 65, null, 64, null, 61, null,
            62, null, null, null, null, null, null, null,
        ],
        lead: { wave: 'square', level: 0.16, length: 0.16, brightness: 1400 },
    },
};

export class Sound {
    // settings: { music: bool, sfx: bool }; onEvent(name) is told every time a sound starts
    constructor(settings, onEvent = () => {}) {
        this.settings = settings;
        this.onEvent = onEvent;
        this.ctx = null;
        this.musicWanted = false;
        this.musicStep = 0;
        this.tune = TUNES.happy;
        this.tuneName = 'happy';
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

    // Switch to a level's tune (starts from its beginning)
    setTune(name) {
        const tune = TUNES[name] || TUNES.happy;
        if (tune === this.tune) return;
        this.tune = tune;
        this.tuneName = TUNES[name] ? name : 'happy';
        this.musicStep = 0;
        if (this.timer) this.onEvent('music');
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
                const tune = this.tune;
                this.playStep(tune, this.musicStep % (tune.bars.length * 8), this.nextNoteTime);
                this.musicStep = (this.musicStep + 1) % (tune.bars.length * 8);
                this.nextNoteTime += 60 / tune.tempo / 2;
            }
        }, 25);
    }

    playStep(tune, step, t) {
        const bar = Math.floor(step / 8);
        const beat = step % 8;
        const [root, chord] = tune.bars[bar];
        // Bass, a little stronger on the beat
        const b = tune.bass[beat];
        if (b !== null) {
            const note = b === 'lead-in' ? tune.bars[(bar + 1) % tune.bars.length][0] - 1 : root + b;
            this.pluck(hz(note), t, beat % 2 === 0 ? 0.55 : 0.4, tune.bassLength, 'triangle', 500);
        }
        // Chord stabs: three short soft notes together
        if (tune.stabs.includes(beat)) {
            for (const n of [0, chord === 'maj' ? 4 : 3, 7]) this.pluck(hz(root + 24 + n), t, tune.stabLevel, 0.1, 'triangle', 2400);
        }
        // Melody
        const m = tune.melody[step];
        const lead = tune.lead;
        if (m !== null) this.pluck(hz(m), t, lead.level, lead.length, lead.wave, lead.brightness);
        // Soft tick on the off-beats (tiptoeing)
        if (tune.ticks && beat % 2 === 1) this.tick(t);
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

    // A crowd clapping and cheering "yay!" and "woo!" (reaching the door).
    // Iteration 8: no steady noise underneath (it sounded like a waterfall).
    // A handful of people clap, each clap a short separate slap, and short
    // shouts pop up here and there. The device's own voice (if it has one)
    // shouts real words on top.
    cheer() {
        if (!this.settings.sfx || !this.ctx) return;
        this.onEvent('cheer');
        const ctx = this.ctx;
        const t0 = ctx.currentTime + 0.02;
        const length = 3.5;
        const rand = (a, b) => a + Math.random() * (b - a);

        const crowd = ctx.createGain();
        crowd.gain.setValueAtTime(CHEER_LEVEL, t0);
        crowd.gain.setValueAtTime(CHEER_LEVEL, t0 + length - 0.3);
        crowd.gain.exponentialRampToValueAtTime(0.0001, t0 + length);
        crowd.connect(this.sfxBus);
        const place = (node, pan) => {
            if (!ctx.createStereoPanner) return node.connect(crowd);
            const panner = ctx.createStereoPanner();
            panner.pan.value = pan;
            node.connect(panner).connect(crowd);
        };

        // Clapping: 7 people spread left to right, each at their own speed,
        // starting together and stopping one by one
        for (let p = 0; p < 7; p++) {
            const gap = rand(0.24, 0.34);
            const tone = rand(1000, 2000);
            const pan = rand(-0.8, 0.8);
            const stop = t0 + rand(2.9, 3.4);
            for (let t = t0 + rand(0, 0.25); t < stop; t += gap * rand(0.92, 1.08)) {
                this.clap(t, tone, rand(1.4, 2.4), pan, place);
            }
        }

        // Shouts: short "yay!"s and "woo!"s, a few at the start and more later
        for (let v = 0; v < 8; v++) {
            const start = t0 + (v < 3 ? rand(0, 0.4) : rand(0.4, 2.9));
            this.shout(start, Math.random() < 0.55 ? 'yay' : 'woo', rand(170, 400), rand(-0.9, 0.9), place);
        }

        // Real words from the device's voice
        const speech = window.speechSynthesis;
        const voices = speech?.getVoices() || [];
        if (speech && voices.length > 0) {
            const english = voices.filter((v) => v.lang?.startsWith('en'));
            const voice = english.find((v) => v.default) || english[0] || voices[0];
            speech.cancel();
            for (const [words, pitch] of [['Yay!', 1.7], ['Woo hoo!', 1.4]]) {
                const say = new SpeechSynthesisUtterance(words);
                say.voice = voice;
                say.rate = 1.2;
                say.pitch = pitch;
                say.volume = SFX_LEVEL;
                speech.speak(say);
            }
        }
    }

    // One clap: a sharp slap of noise that dies away in a few hundredths of a
    // second, with a tiny second slap right after (the other hand)
    clap(t, tone, level, pan, place) {
        const ctx = this.ctx;
        const src = this.noiseSource(t, 0.06);
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = tone;
        filter.Q.value = 1.8;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(level, t + 0.001);
        g.gain.exponentialRampToValueAtTime(level * 0.15, t + 0.004);
        g.gain.exponentialRampToValueAtTime(level * 0.7, t + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.022 + Math.random() * 0.01);
        src.connect(filter).connect(g);
        place(g, pan);
    }

    // One shouted "yay!" or "woo!": a voice-like buzz through vowel filters
    shout(t, word, base, pan, place) {
        const ctx = this.ctx;
        const yay = word === 'yay';
        const dur = yay ? 0.38 + Math.random() * 0.2 : 0.5 + Math.random() * 0.25;
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(base, t);
        if (yay) {
            // "yay!" jumps up and comes down at the end
            osc.frequency.exponentialRampToValueAtTime(base * 1.5, t + dur * 0.3);
            osc.frequency.exponentialRampToValueAtTime(base * 1.1, t + dur);
        } else {
            // "woo!" swoops up
            osc.frequency.exponentialRampToValueAtTime(base * 1.8, t + dur * 0.6);
            osc.frequency.exponentialRampToValueAtTime(base * 1.5, t + dur);
        }
        const wobble = ctx.createOscillator();
        wobble.frequency.value = 5 + Math.random() * 2;
        const wobbleDepth = ctx.createGain();
        wobbleDepth.gain.value = base * 0.025;
        wobble.connect(wobbleDepth).connect(osc.frequency);

        const voice = ctx.createGain();
        voice.gain.setValueAtTime(0.0001, t);
        voice.gain.exponentialRampToValueAtTime(0.09, t + 0.05);
        voice.gain.setValueAtTime(0.09, t + dur * 0.6);
        voice.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        // Vowel shapes (formants): "y-ay-ee" or "w-oo"
        const formants = yay
            ? [[280, 650, 480, 1], [2250, 1800, 2250, 0.6], [2900, 2600, 2900, 0.3]]
            : [[300, 330, 360, 1], [600, 800, 850, 0.5], [2300, 2400, 2400, 0.12]];
        for (const [from, mid, to, level] of formants) {
            const f = ctx.createBiquadFilter();
            f.type = 'bandpass';
            f.Q.value = 7;
            f.frequency.setValueAtTime(from, t);
            f.frequency.linearRampToValueAtTime(mid, t + dur * 0.25);
            f.frequency.linearRampToValueAtTime(to, t + dur);
            const g = ctx.createGain();
            g.gain.value = level * 3;
            osc.connect(f).connect(g).connect(voice);
        }
        place(voice, pan);
        osc.start(t);
        wobble.start(t);
        osc.stop(t + dur + 0.05);
        wobble.stop(t + dur + 0.05);
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
