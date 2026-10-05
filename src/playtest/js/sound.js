// Music and sound effects (plan Section 5). Everything is made in the browser:
// the music and the crowd cheer are synthesized with Web Audio, and "Ouch!" is
// spoken by the device's own voice (with a synthesized "ow" if it has none).
//
// Browsers only allow sound after the player touches or presses something, so
// nothing plays until the first key press or tap.

const SFX_LEVEL = 0.8;
const MUSIC_LEVEL = SFX_LEVEL / 2; // music about half as loud as the sound effects
const MUSIC_LOOKAHEAD = 0.4; // seconds of music booked ahead
const CHEER_LEVEL = 1.4; // the no-voice fallback shouts, inside the sound-effects level

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
    // Level 3 (Iteration 13): a different tune you can tell from Level 2's
    // straight away. Faster, a xylophone-like lead instead of a buzzy one, a
    // rocking bass, and a hook of bouncy repeated notes ("da-da, da-da, da")
    // that keeps coming back. D major with a sneaky flat-seven chord (C).
    happySneakier: {
        tempo: 132,
        bars: [[38, 'maj'], [38, 'maj'], [36, 'maj'], [38, 'maj'], [43, 'maj'], [43, 'maj'], [45, 'maj'], [38, 'maj']],
        bass: [0, null, 7, null, 12, null, 7, null],
        bassLength: 0.14,
        stabs: [],
        ticks: true,
        melody: [
            69, 69, null, 67, 69, null, 66, null,
            62, null, null, null, 66, null, 69, null,
            72, 72, null, 71, 72, null, 67, null,
            69, null, 66, null, 62, null, null, null,
            71, 71, null, 69, 71, null, 74, null,
            76, null, 74, null, 71, null, 67, null,
            73, null, 76, null, 73, null, 69, null,
            74, null, null, null, null, null, null, null,
        ],
        lead: { wave: 'triangle', level: 0.3, length: 0.12, brightness: 5000 },
    },
    // Level 4: a whistled tiptoe tune (F major), a little sneakier than Level 3.
    // Every phrase starts after a little pause with a "wobble" (up, down a
    // half-step, back up), over a sparse "boom ... ba" bass with soft
    // off-beat chords. Pure, whistle-like lead and a slower 108 bpm, so it
    // sounds unlike Levels 1-3 from the first notes.
    tiptoe: {
        tempo: 108,
        bars: [[41, 'maj'], [41, 'maj'], [38, 'min'], [38, 'min'], [46, 'maj'], [36, 'maj'], [41, 'maj'], [36, 'maj']],
        bass: [0, null, null, null, 7, null, null, 'lead-in'],
        bassLength: 0.18,
        stabs: [3, 7],
        stabLevel: 0.04,
        ticks: true,
        melody: [
            null, null, 81, 80, 81, null, 77, null,
            72, null, null, null, 74, null, 76, null,
            null, null, 77, 76, 77, null, 74, null,
            69, null, null, null, null, null, null, null,
            null, null, 77, 76, 77, null, 82, null,
            79, null, 76, null, 72, null, 76, null,
            null, null, 81, 80, 81, null, 84, null,
            79, null, null, null, 76, null, 72, null,
        ],
        lead: { wave: 'sine', level: 0.4, length: 0.2, brightness: 8000 },
    },
    // Level 5: a little brassy march (B-flat major), only a little sneakier
    // than Level 4. Each phrase is a low call, "bum, ba-ba, BAAH", answered
    // higher up, with one darker bar (E-flat minor). Steady march bass and
    // off-beat "chicks", no ticking, on a brass-like lead.
    march: {
        tempo: 120,
        bars: [[46, 'maj'], [46, 'maj'], [39, 'maj'], [46, 'maj'], [43, 'min'], [39, 'min'], [41, 'maj'], [46, 'maj']],
        bass: [0, null, 0, null, 0, null, 0, null],
        bassLength: 0.16,
        stabs: [1, 5],
        stabLevel: 0.04,
        ticks: false,
        melody: [
            58, null, 58, 58, 70, null, null, null,
            74, 72, 70, null, 72, null, null, null,
            63, null, 63, 63, 75, null, null, null,
            74, 72, 70, null, 67, null, null, null,
            62, null, 62, 62, 74, null, null, null,
            73, 70, 66, null, 70, null, null, null,
            65, null, 65, 65, 77, null, 75, 74,
            70, null, null, null, null, null, null, null,
        ],
        lead: { wave: 'sawtooth', level: 0.13, length: 0.22, brightness: 1500 },
    },
    // Level 6: a creeping tune (G major), a tiny bit sneakier than Level 5.
    // The melody is low and muffled and creeps up by half-steps ("da-dum,
    // da-da-dum"), each bar answered by a short fall, with bright little
    // chords on top to keep it happy, slow half-note bass and soft ticking.
    creep: {
        tempo: 112,
        bars: [[43, 'maj'], [43, 'maj'], [36, 'maj'], [36, 'maj'], [40, 'min'], [36, 'maj'], [38, 'maj'], [43, 'maj']],
        bass: [0, null, null, null, 0, null, null, null],
        bassLength: 0.3,
        stabs: [2, 6],
        stabLevel: 0.045,
        ticks: true,
        melody: [
            54, 55, null, 57, 58, 59, null, null,
            62, null, 59, null, 55, null, null, null,
            54, 55, null, 57, 58, 59, null, null,
            64, null, 60, null, 57, null, null, null,
            59, 60, null, 62, 63, 64, null, null,
            67, null, 64, null, 60, null, null, null,
            61, 62, null, 64, 65, 66, null, null,
            67, null, null, null, 55, null, null, null,
        ],
        lead: { wave: 'square', level: 0.17, length: 0.14, brightness: 900 },
    },
    // Level 7: a bouncy shuffle (A major), a tiny bit sneakier than Level 6.
    // It opens by falling from a high note, then long-short "dum ... da-dum
    // ... da" steps on a plucky marimba-like lead,
    // chords on the beat and the bass on the off-beats, with one sneaky
    // F major bar.
    shuffle: {
        tempo: 126,
        bars: [[45, 'maj'], [45, 'maj'], [38, 'maj'], [45, 'maj'], [41, 'maj'], [38, 'maj'], [40, 'maj'], [45, 'maj']],
        bass: [null, 0, null, 7, null, 0, null, 7],
        bassLength: 0.14,
        stabs: [0, 4],
        stabLevel: 0.04,
        ticks: false,
        melody: [
            81, null, null, 76, 73, null, null, 76,
            81, null, null, 78, 76, null, null, null,
            74, null, null, 78, 81, null, null, 78,
            76, null, null, 73, 69, null, null, null,
            72, null, null, 77, 81, null, null, 77,
            78, null, null, 74, 69, null, null, null,
            71, null, null, 74, 76, null, null, 80,
            81, null, null, null, null, null, null, null,
        ],
        lead: { wave: 'triangle', level: 0.36, length: 0.16, brightness: 3000 },
    },
    // Level 8: "ding ... ding ... ding" (D major), a tiny bit sneakier than
    // Level 7. Every bar is in a 3-3-2 rhythm: high repeated notes on a bright
    // blip, answered by a fall, a rocking 3-3-2 bass, soft ticking and one
    // sneaky G minor bar.
    ding: {
        tempo: 118,
        bars: [[38, 'maj'], [38, 'maj'], [43, 'maj'], [43, 'min'], [38, 'maj'], [47, 'min'], [40, 'maj'], [45, 'maj']],
        bass: [0, null, null, 7, null, null, 12, null],
        bassLength: 0.18,
        stabs: [],
        ticks: true,
        melody: [
            81, null, null, 81, null, null, 81, null,
            79, null, null, 78, null, null, 76, 74,
            79, null, null, 79, null, null, 79, null,
            77, null, null, 74, null, null, 70, null,
            81, null, null, 81, null, null, 81, null,
            83, null, null, 81, null, null, 78, 74,
            80, null, null, 76, null, null, 71, null,
            73, null, null, 76, null, null, 81, null,
        ],
        lead: { wave: 'square', level: 0.18, length: 0.09, brightness: 4000 },
    },
    // Level 9: call and echo (G major), a tiny bit sneakier than Level 8.
    // Each bar calls two high notes and a soft echo answers them an octave
    // lower, like someone sneaking up behind you, on a round ocarina-like
    // lead; slow, sparse bass and a couple of minor chords.
    echo: {
        tempo: 104,
        bars: [[43, 'maj'], [40, 'min'], [36, 'maj'], [38, 'maj'], [43, 'maj'], [40, 'min'], [45, 'min'], [38, 'maj']],
        bass: [0, null, null, null, null, null, 7, null],
        bassLength: 0.3,
        stabs: [4],
        stabLevel: 0.04,
        ticks: true,
        melody: [
            79, null, 74, null, 67, null, 62, null,
            76, null, 71, null, 64, null, 59, null,
            76, null, 72, null, 64, null, 60, null,
            78, null, 81, null, 66, null, 69, null,
            83, null, 79, null, 71, null, 67, null,
            79, null, 76, null, 67, null, 64, null,
            76, null, 72, null, 64, null, 60, null,
            74, null, 78, null, 81, null, null, null,
        ],
        lead: { wave: 'sine', level: 0.3, length: 0.25, brightness: 8000 },
    },
    // Level 10, the cotton candy finale: happy but sneaky (A minor, lifting
    // to happy major chords). A sneaky wiggle ("E-F . E-C . A") and creeping
    // half-step climbs, answered by big bright happy arpeggios, on a bright
    // buzzy lead with a bouncy bass and lead-ins.
    finale: {
        tempo: 120,
        bars: [[45, 'min'], [45, 'min'], [41, 'maj'], [43, 'maj'], [36, 'maj'], [45, 'min'], [38, 'maj'], [40, 'maj']],
        bass: [0, null, 7, null, 0, null, 7, 'lead-in'],
        bassLength: 0.14,
        stabs: [2, 6],
        stabLevel: 0.04,
        ticks: true,
        melody: [
            76, 77, null, 76, 72, null, 69, null,
            71, 72, 73, 74, 76, null, null, null,
            77, null, 81, null, 84, null, 81, null,
            79, null, 83, null, 86, null, null, null,
            84, 83, null, 84, 79, null, 76, null,
            72, 73, 74, 75, 76, null, null, null,
            78, null, 81, null, 78, null, 74, null,
            80, null, 83, null, 80, null, 76, null,
        ],
        lead: { wave: 'sawtooth', level: 0.1, length: 0.12, brightness: 2500 },
    },
    // Level 11, welcome to Space World: a happy twinkly tune (E major). A
    // bright little chime runs up and down each chord without stopping, like
    // twinkling stars, over long, slow bass notes and soft chords.
    twinkle: {
        tempo: 132,
        bars: [[40, 'maj'], [37, 'min'], [45, 'maj'], [47, 'maj'], [40, 'maj'], [44, 'min'], [45, 'maj'], [47, 'maj']],
        bass: [0, null, null, null, 7, null, null, null],
        bassLength: 0.4,
        stabs: [0],
        stabLevel: 0.035,
        ticks: false,
        melody: [
            76, 80, 83, 88, 83, 80, 76, 80,
            73, 76, 80, 85, 80, 76, 73, 76,
            69, 73, 76, 81, 76, 73, 69, 73,
            71, 75, 78, 83, 78, 75, 71, 75,
            76, 80, 83, 88, 83, 80, 76, 80,
            68, 71, 75, 80, 75, 71, 68, 71,
            69, 73, 76, 81, 76, 73, 69, 73,
            71, 75, 78, 83, 86, 83, 78, 75,
        ],
        lead: { wave: 'square', level: 0.1, length: 0.08, brightness: 6000 },
    },
    // Level 12, learning space doors: a happy, bouncy "boing" tune (F major).
    // Every bar starts with a jump up an octave and back ("low-HIGH . mid-HIGH"),
    // like hopping in low gravity, on a soft round lead over a skipping bass.
    orbit: {
        tempo: 112,
        bars: [[41, 'maj'], [38, 'min'], [46, 'maj'], [48, 'maj'], [41, 'maj'], [45, 'min'], [46, 'maj'], [48, 'maj']],
        bass: [0, null, null, 7, null, 12, null, null],
        bassLength: 0.2,
        stabs: [2, 6],
        stabLevel: 0.035,
        ticks: false,
        melody: [
            65, 77, null, 72, 77, null, 69, null,
            62, 74, null, 69, 74, null, 65, null,
            70, 82, null, 77, 74, null, 70, null,
            72, null, 76, null, 79, null, 84, null,
            65, 77, null, 72, 77, null, 81, null,
            69, 81, null, 76, 72, null, 69, null,
            70, 74, 77, 82, 77, 74, null, null,
            79, null, 76, null, 72, null, null, null,
        ],
        lead: { wave: 'triangle', level: 0.32, length: 0.2, brightness: 4500 },
    },
    // Level 13, learning slippery spots: a happy gliding waltz (G major, 3
    // beats to a bar played as 6 eighths + a held note). Long notes that swoop
    // up and slide back down, like skating on ice, on a smooth whistle lead
    // over an "oom-pah-pah" bass.
    skate: {
        tempo: 150,
        bars: [[43, 'maj'], [43, 'maj'], [36, 'maj'], [38, 'maj'], [43, 'maj'], [40, 'min'], [36, 'maj'], [38, 'maj']],
        bass: [0, null, null, 7, null, 12, null, null],
        bassLength: 0.25,
        stabs: [3, 5],
        stabLevel: 0.03,
        ticks: false,
        melody: [
            71, null, null, 74, 79, null, null, null,
            78, 76, 74, null, 71, null, null, null,
            72, null, null, 76, 79, null, 84, null,
            83, 81, 78, null, 74, null, null, null,
            71, null, null, 74, 79, null, 83, null,
            84, 83, 79, null, 76, null, null, null,
            76, 79, 84, null, 81, 79, 76, null,
            74, null, 78, null, 81, null, null, null,
        ],
        lead: { wave: 'sine', level: 0.34, length: 0.35, brightness: 7000 },
    },
    // Level 14, spikes are back: a happy robot march (A major) with just a
    // touch of sneak. Busy "bip-bip" repeated notes that step up, then a
    // quick sneaky slide down a half step, on a buzzy, blippy lead over a
    // steady bass and off-beat chords.
    robot: {
        tempo: 126,
        bars: [[45, 'maj'], [45, 'maj'], [38, 'maj'], [40, 'maj'], [45, 'maj'], [42, 'min'], [38, 'maj'], [40, 'maj']],
        bass: [0, null, 0, null, 7, null, 0, null],
        bassLength: 0.12,
        stabs: [1, 5],
        stabLevel: 0.035,
        ticks: true,
        melody: [
            69, 69, null, 73, 73, null, 76, null,
            81, null, 80, 79, 76, null, null, null,
            74, 74, null, 78, 78, null, 81, null,
            83, null, 82, 81, 80, null, null, null,
            81, 81, null, 76, 76, null, 73, null,
            78, null, 77, 76, 73, null, null, null,
            74, null, 78, null, 81, null, 86, null,
            83, null, 80, null, 76, null, null, null,
        ],
        lead: { wave: 'square', level: 0.14, length: 0.06, brightness: 3200 },
    },
    // Level 15, slippery spots are back: a happy, bouncy tune (B-flat major)
    // with a "boing-boing" hook that bounces down and springs back up, and
    // a little sneaky chromatic wiggle, on a bright plucky lead over a
    // jumpy octave bass.
    bounce: {
        tempo: 120,
        bars: [[46, 'maj'], [43, 'min'], [39, 'maj'], [41, 'maj'], [46, 'maj'], [43, 'min'], [39, 'maj'], [41, 'maj']],
        bass: [0, 12, null, 0, 12, null, 7, null],
        bassLength: 0.12,
        stabs: [2, 6],
        stabLevel: 0.035,
        ticks: true,
        melody: [
            82, null, 77, null, 74, 77, 82, null,
            79, null, 74, null, 70, 74, 79, null,
            75, 76, 77, null, 79, null, 82, null,
            81, null, 77, null, 72, null, null, null,
            82, null, 77, null, 74, 77, 82, null,
            86, null, 82, null, 79, 82, 86, null,
            87, null, 86, 84, 82, null, 79, null,
            81, null, 84, null, 82, null, null, null,
        ],
        lead: { wave: 'triangle', level: 0.3, length: 0.1, brightness: 6000 },
    },
    // Level 16, four things to watch out for: a happy "blast-off" tune (C
    // major) that climbs a rising arpeggio each bar like a rocket taking off,
    // with a sneaky dip into a minor chord in the middle, on a bright sawtooth
    // lead over a driving eighth-note bass.
    rocket: {
        tempo: 128,
        bars: [[36, 'maj'], [41, 'maj'], [43, 'maj'], [36, 'maj'], [45, 'min'], [41, 'maj'], [43, 'maj'], [43, 'maj']],
        bass: [0, 0, 12, 0, 0, 0, 12, 0],
        bassLength: 0.1,
        stabs: [4],
        stabLevel: 0.03,
        ticks: false,
        melody: [
            60, 64, 67, 72, null, 76, 79, null,
            65, 69, 72, 77, null, 81, null, null,
            67, 71, 74, 79, null, 83, 86, null,
            84, null, 79, null, 76, null, 72, null,
            69, 72, 76, 81, null, 76, 72, null,
            77, null, 76, null, 74, null, 72, null,
            71, 74, 79, 83, 86, null, 83, null,
            79, null, 74, null, 71, 74, 79, null,
        ],
        lead: { wave: 'sawtooth', level: 0.1, length: 0.1, brightness: 3500 },
    },
    // Level 17, the first moving platform: a happy, floaty tune (E-flat
    // major) whose hook leaps up an octave and hovers there with a little
    // dip, like riding a floating platform, with one sneaky chromatic
    // neighbour note in the middle, on a soft triangle lead over a gently
    // rocking bass.
    float: {
        tempo: 112,
        bars: [[39, 'maj'], [44, 'maj'], [46, 'maj'], [39, 'maj'], [36, 'min'], [44, 'maj'], [46, 'maj'], [39, 'maj']],
        bass: [0, null, 7, null, 12, null, 7, null],
        bassLength: 0.2,
        stabs: [2, 6],
        stabLevel: 0.03,
        ticks: false,
        melody: [
            63, 75, null, 74, 75, null, 70, null,
            68, 80, null, 79, 80, null, 75, null,
            70, 82, null, 81, 82, null, 77, 74,
            75, null, null, null, 70, null, 67, null,
            72, 84, null, 83, 84, null, 79, null,
            80, null, 79, null, 77, null, 75, null,
            74, 77, 82, null, 86, null, 82, null,
            87, null, null, null, 75, null, null, null,
        ],
        lead: { wave: 'triangle', level: 0.3, length: 0.25, brightness: 5500 },
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
            // iPad: a sound has to start during the tap that switches sound on.
            // Since the main menu (which is quiet) that first tap plays nothing,
            // so play one silent sample now.
            const blip = this.ctx.createBufferSource();
            blip.buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
            blip.connect(this.ctx.destination);
            blip.start();
            // iPad: if the speaking voice ("Ouch!", the cheer) or another app
            // interrupts the music, start it again as soon as it's allowed
            this.ctx.addEventListener('statechange', () => this.wake());
            // iPad: speech must first be used during a tap, so say nothing now
            if (window.speechSynthesis) {
                const hush = new SpeechSynthesisUtterance(' ');
                hush.volume = 0;
                window.speechSynthesis.speak(hush);
            }
        }
        this.wake();
        if (this.musicWanted && !this.timer) this.startScheduler();
    }

    // Get sound going again if it stopped: 'suspended', or iPad's 'interrupted'
    // (the speaking voice or another app took over). Not while in the background.
    wake() {
        if (this.ctx && this.ctx.state !== 'running' && this.ctx.state !== 'closed' && !document.hidden) {
            this.ctx.resume().catch(() => {});
        }
    }

    applySettings() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        this.sfxBus.gain.setTargetAtTime(this.settings.sfx ? SFX_LEVEL : 0, now, 0.03);
        this.musicBus.gain.setTargetAtTime(this.settings.music ? MUSIC_LEVEL : 0, now, 0.1);
    }

    // ---- Music ----

    // Called from the tap or key press that starts a level, so the first notes
    // are booked right away, inside that tap (the iPad needs that)
    startMusic() {
        if (!this.timer) this.musicStep = 0; // a level's tune starts from its beginning
        this.musicWanted = true;
        if (!this.ctx) return;
        this.wake();
        this.startScheduler();
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
        this.nextNoteTime = this.ctx.currentTime + 0.05;
        this.onEvent('music');
        this.bookNotes();
        this.timer = setInterval(() => this.bookNotes(), 25);
    }

    // Look ahead and book the notes that fall inside that window. The window is
    // generous (0.4 s) so a busy moment, like a level loading, doesn't leave gaps.
    // Notes that are already late are skipped, not played silently.
    bookNotes() {
        const now = this.ctx.currentTime;
        if (this.ctx.state !== 'running') this.wake();
        const tune = this.tune;
        const steps = tune.bars.length * 8;
        const stepLength = 60 / tune.tempo / 2;
        while (this.nextNoteTime < now) {
            this.musicStep = (this.musicStep + 1) % steps;
            this.nextNoteTime += stepLength;
        }
        while (this.nextNoteTime < now + MUSIC_LOOKAHEAD) {
            this.playStep(tune, this.musicStep % steps, this.nextNoteTime);
            this.musicStep = (this.musicStep + 1) % steps;
            this.nextNoteTime += stepLength;
        }
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

    // Reaching the door: a voice says "Woo hoo!" and "Yay!", like the voice that
    // says "Ouch!" (Iteration 13: no clapping or crowd). Devices with no
    // speaking voice get two short voice-like shouts instead.
    // long: the finale (Level 10) gets an extra-long cheer
    cheer({ long = false } = {}) {
        if (!this.settings.sfx) return;
        this.onEvent('cheer');
        const speech = window.speechSynthesis;
        const voices = speech?.getVoices() || [];
        if (speech && voices.length > 0) {
            const english = voices.filter((v) => v.lang?.startsWith('en'));
            const voice = english.find((v) => v.default) || english[0] || voices[0];
            speech.cancel();
            const lines = long
                ? [['Woo hoo!', 1.4], ['Yay!', 1.7], ['Woo hoo!', 1.5], ['Yaaay!', 1.8], ['Woo hoo! Yay!', 1.6]]
                : [['Woo hoo!', 1.4], ['Yay!', 1.7]];
            for (const [words, pitch] of lines) {
                const say = new SpeechSynthesisUtterance(words);
                say.voice = voice;
                say.rate = long ? 1.0 : 1.15;
                say.pitch = pitch;
                say.volume = SFX_LEVEL;
                speech.speak(say);
            }
        } else if (this.ctx) {
            const t = this.ctx.currentTime + 0.02;
            const out = this.ctx.createGain();
            out.gain.value = CHEER_LEVEL;
            out.connect(this.sfxBus);
            const place = (node) => node.connect(out);
            const words = long ? ['woo', 'yay', 'woo', 'yay', 'woo', 'yay'] : ['woo', 'yay'];
            words.forEach((word, n) => this.shout(t + n * 0.7, word, word === 'woo' ? 300 : 320, 0, place));
        }
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
