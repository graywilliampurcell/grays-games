// Music and sound effects (plan Section 5). Everything is made in the browser:
// the music is synthesized with Web Audio, and "Ouch!" and the "Woo hoo! Yay!"
// cheer are spoken by the device's own voice on computers with a keyboard and
// mouse. On touch screens (iPads, and computers played by touch, the ones that
// show the touch circles) the game makes those voice sounds itself with Web
// Audio, like the music (Iteration 33): there the device voice stayed silent.
// If the device voice doesn't start, or reports an error, the game's own voice
// sound plays instead, so there's always something to hear.
//
// Browsers only allow sound after the player touches or presses something, so
// nothing plays until the first key press or tap.

const SFX_LEVEL = 0.8;
const MUSIC_LEVEL = SFX_LEVEL / 2; // music about half as loud as the sound effects
const MUSIC_LOOKAHEAD = 0.4; // seconds of music booked ahead
const CHEER_LEVEL = 1.4; // the no-voice fallback shouts, inside the sound-effects level
// How long the device voice gets to start before the game's own voice sound plays instead
const SPEECH_START_TIMEOUT = 700;

// iPad, iPhone (iPads also call themselves a Mac, but with a touch screen)
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
// ?voice=game forces the game's own voice sounds, for testing on a computer
const FORCE_GAME_VOICE = new URLSearchParams(window.location.search).get('voice') === 'game';
// Use the device's speaking voice? Not on touch screens (see the top of this
// file): the same check that shows the touch circles (main.js), or an iPad.
function useSpeech() {
    if (!window.speechSynthesis || IS_IOS || FORCE_GAME_VOICE) return false;
    return !window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}

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
    // Level 18, the platform and the big spike: a happy hopscotch tune
    // (A-flat major, quick) whose hook skips in on the off-beats, hop-hop-
    // jump, with one sneaky chromatic step in the middle, on a short square
    // lead over a bouncing bass.
    hopscotch: {
        tempo: 138,
        bars: [[44, 'maj'], [37, 'maj'], [39, 'maj'], [44, 'maj'], [41, 'min'], [37, 'maj'], [39, 'maj'], [44, 'maj']],
        bass: [0, null, null, 12, 0, null, 7, null],
        bassLength: 0.12,
        stabs: [3, 7],
        stabLevel: 0.03,
        ticks: true,
        melody: [
            null, 72, null, 75, 80, null, 75, null,
            null, 73, null, 77, 80, null, 77, null,
            null, 75, null, 79, 82, null, 87, null,
            84, null, 80, null, 75, null, null, null,
            null, 77, null, 80, 84, null, 83, 84,
            85, null, 80, null, 77, null, 73, null,
            75, 79, 82, null, 87, null, 82, null,
            80, null, 75, null, 68, null, null, null,
        ],
        lead: { wave: 'square', level: 0.13, length: 0.09, brightness: 2800 },
    },
    // Level 19, the sneaky big spike in space: a happy hide-and-seek tune
    // (F-sharp major) whose hook goes "peek-a-BOO", three quick notes up and
    // a hush, then a little answer, with one sneaky note in the middle, on a
    // soft round lead over a rocking bass.
    peekaboo: {
        tempo: 124,
        bars: [[42, 'maj'], [35, 'maj'], [37, 'maj'], [42, 'maj'], [39, 'min'], [35, 'maj'], [37, 'maj'], [42, 'maj']],
        bass: [0, null, 7, null, 0, null, 7, 12],
        bassLength: 0.15,
        stabs: [2, 6],
        stabLevel: 0.03,
        ticks: false,
        melody: [
            73, 75, 78, null, null, null, 78, 75,
            71, 75, 78, null, null, null, 83, null,
            73, 77, 80, null, 85, null, 80, null,
            78, null, 73, null, 70, null, null, null,
            75, 78, 82, null, null, null, 81, 82,
            83, null, 78, null, 75, null, 71, null,
            73, 77, 80, null, 85, null, 87, null,
            90, null, 85, null, 78, null, null, null,
        ],
        lead: { wave: 'sine', level: 0.32, length: 0.18, brightness: 6000 },
    },
    // Level 20, the Space World finale: a big, happy space fanfare (D-flat
    // major) that leaps up in bright calls like a trumpet, climbs to a high
    // finish, with one sneaky note before the last climb, on a bright square
    // lead over a marching octave bass.
    galaxy: {
        tempo: 140,
        bars: [[37, 'maj'], [42, 'maj'], [44, 'maj'], [37, 'maj'], [46, 'min'], [42, 'maj'], [44, 'maj'], [37, 'maj']],
        bass: [0, null, 12, null, 7, null, 12, null],
        bassLength: 0.15,
        stabs: [2, 6],
        stabLevel: 0.035,
        ticks: true,
        melody: [
            68, null, 68, 73, null, 77, 80, null,
            78, null, 78, 82, null, 85, 82, null,
            80, 82, 80, 77, 75, null, 72, null,
            73, null, 77, null, 80, null, 85, null,
            82, null, 81, 82, 85, null, 82, null,
            78, null, 82, null, 85, null, 90, null,
            87, null, 84, null, 80, 84, 87, null,
            85, null, null, null, 73, null, null, null,
        ],
        lead: { wave: 'square', level: 0.12, length: 0.14, brightness: 4500 },
    },
    // Level 21, welcome to Jungle World: a happy, bouncy marimba-style tune
    // (B major) with a jungle-call hook that hops up and tumbles down, one
    // sneaky note in the middle, on a short wooden-sounding lead over a
    // drum-like bass.
    jungle: {
        tempo: 122,
        bars: [[35, 'maj'], [40, 'maj'], [42, 'maj'], [35, 'maj'], [44, 'min'], [40, 'maj'], [42, 'maj'], [35, 'maj']],
        bass: [0, null, 7, 0, null, 7, 12, null],
        bassLength: 0.12,
        stabs: [2, 6],
        stabLevel: 0.03,
        ticks: true,
        melody: [
            71, 75, 78, 75, 83, null, 78, null,
            76, 80, 83, 80, 88, null, 83, null,
            78, 82, 85, null, 83, 82, 78, null,
            83, null, 78, null, 75, null, null, null,
            80, 83, 87, 83, 86, 87, null, null,
            88, null, 83, null, 80, null, 76, null,
            78, 82, 85, 82, 90, null, 85, null,
            83, null, 78, 75, 71, null, null, null,
        ],
        lead: { wave: 'triangle', level: 0.32, length: 0.12, brightness: 3800 },
    },
    // Level 22, the big bush: a happy tune that tiptoes through the leaves
    // (E major, a little slower than Level 21's), its hook a quick rustle
    // (step down and back) before a hop up, on a soft round lead over an
    // off-beat creeping bass. A tiny bit sneakier than Level 21's.
    thicket: {
        tempo: 114,
        bars: [[40, 'maj'], [44, 'min'], [45, 'maj'], [47, 'maj'], [40, 'maj'], [37, 'min'], [42, 'min'], [47, 'maj']],
        bass: [0, null, null, 7, null, 0, 7, null],
        bassLength: 0.14,
        stabs: [3, 7],
        stabLevel: 0.03,
        ticks: false,
        melody: [
            76, null, 75, 76, null, 80, null, null,
            80, null, 79, 80, null, 83, null, null,
            81, null, 80, 81, 85, null, 83, 81,
            78, null, 75, null, 71, null, null, null,
            76, null, 75, 76, null, 80, null, 83,
            85, null, 83, null, 80, null, 76, null,
            78, 81, 85, null, 83, null, 78, null,
            80, null, 75, null, 76, null, null, null,
        ],
        lead: { wave: 'sine', level: 0.34, length: 0.14, brightness: 4200 },
    },
    // Level 23, two rivers: a happy, flowing tune (A major, between Levels 21
    // and 22 in speed) whose hook ripples up like water before a sneaky
    // chromatic step back, on a mellow plucked lead over a rolling bass. A
    // tiny bit sneakier than Level 22's.
    rapids: {
        tempo: 118,
        bars: [[45, 'maj'], [42, 'min'], [38, 'maj'], [40, 'maj'], [45, 'maj'], [37, 'min'], [35, 'min'], [40, 'maj']],
        bass: [0, 7, 12, 7, 0, null, 7, 'lead-in'],
        bassLength: 0.11,
        stabs: [2, 6],
        stabLevel: 0.025,
        ticks: false,
        melody: [
            69, 71, 73, null, 76, null, 73, null,
            73, null, 72, 73, 78, null, null, null,
            74, 76, 78, null, 81, null, 78, null,
            76, null, 75, 76, 71, null, null, null,
            69, 71, 73, null, 76, 78, 81, null,
            80, null, 76, null, 73, null, 68, null,
            74, 73, 71, null, 74, null, 78, null,
            76, null, 75, null, 76, null, null, null,
        ],
        lead: { wave: 'sawtooth', level: 0.14, length: 0.13, brightness: 2400 },
    },
    // Level 24, three rivers and two bushes: a happy, adventurous tune
    // (F major, a touch quicker than Level 23's) whose hook is a hop-hop-leap
    // with a sneaky flattened note slipping in before the climb, on a bright
    // bell-like lead over a galloping bass. A tiny bit sneakier than Level 23's.
    canopy: {
        tempo: 120,
        bars: [[41, 'maj'], [46, 'maj'], [38, 'min'], [36, 'maj'], [41, 'maj'], [45, 'min'], [46, 'maj'], [36, 'maj']],
        bass: [0, 0, 7, null, 0, 0, 12, 'lead-in'],
        bassLength: 0.1,
        stabs: [3, 7],
        stabLevel: 0.03,
        ticks: true,
        melody: [
            72, 72, 77, null, 76, null, 72, null,
            74, 74, 79, null, 77, null, 74, null,
            75, null, 74, 72, 69, null, 74, 77,
            79, null, 76, null, 72, null, null, null,
            72, 72, 77, null, 81, null, 79, 77,
            76, null, 72, null, 69, null, 72, null,
            74, 77, 82, null, 81, 79, 77, null,
            79, null, 78, 79, 84, null, null, null,
        ],
        lead: { wave: 'triangle', level: 0.3, length: 0.1, brightness: 6000 },
    },
    // Level 25, the squeeze-past bush: a happy tune that edges sideways
    // (G major, a little slower and more careful than Level 24's), its hook a
    // tiptoe of repeated notes that slides round a sneaky chromatic corner,
    // on a reedy lead over a swinging bass. A tiny bit sneakier than Level 24's.
    vines: {
        tempo: 110,
        bars: [[43, 'maj'], [40, 'min'], [36, 'maj'], [38, 'maj'], [43, 'maj'], [47, 'min'], [36, 'maj'], [38, 'maj']],
        bass: [0, null, 7, 12, null, 7, 0, null],
        bassLength: 0.15,
        stabs: [2, 6],
        stabLevel: 0.03,
        ticks: true,
        melody: [
            67, 67, 67, null, 68, 69, 71, null,
            72, null, 71, 69, 67, null, 64, null,
            72, 72, 72, null, 73, 74, 76, null,
            74, null, 72, null, 69, null, null, null,
            71, 71, 71, null, 70, 71, 74, null,
            79, null, 78, 76, 74, null, 71, null,
            72, 74, 76, null, 79, null, 76, 72,
            74, null, 73, null, 74, null, null, null,
        ],
        lead: { wave: 'square', level: 0.13, length: 0.12, brightness: 2200 },
    },
    // Level 26, a tighter squeeze: a happy tune that creeps on its toes (A
    // major with a sly borrowed F major chord, a touch slower than Level 25's),
    // its hook two quick pickup notes that land on a held high note and then
    // sneak down by half steps, on a round sine-ish lead over a walking bass.
    // A tiny bit sneakier than Level 25's.
    bramble: {
        tempo: 106,
        bars: [[45, 'maj'], [41, 'maj'], [45, 'maj'], [40, 'maj'], [42, 'min'], [41, 'maj'], [38, 'maj'], [40, 'maj']],
        bass: [0, null, 4, null, 7, null, 4, 'lead-in'],
        bassLength: 0.18,
        stabs: [1, 5],
        stabLevel: 0.025,
        ticks: true,
        melody: [
            null, 73, 76, 81, null, 80, 79, null,
            77, null, null, 76, 72, null, 69, null,
            null, 73, 76, 81, null, 83, 81, null,
            80, null, 76, null, 71, null, null, null,
            78, 78, null, 81, 78, null, 73, null,
            77, null, 76, 74, 72, null, 69, 72,
            74, null, 78, 81, 86, null, 85, 83,
            80, null, 76, null, 81, null, null, null,
        ],
        lead: { wave: 'sine', level: 0.34, length: 0.16, brightness: 3000 },
    },
    // Level 27, the first fast leaf: a happy, scampering tune (E major, quicker
    // than Level 26's so it feels like a dash across the water), its hook a
    // fast run up that lands on a sly flat-seventh note before scurrying home,
    // on a bright plucky lead over a skipping bass. A tiny bit sneakier than
    // Level 26's.
    zoom: {
        tempo: 128,
        bars: [[40, 'maj'], [38, 'maj'], [45, 'maj'], [40, 'maj'], [37, 'min'], [38, 'maj'], [45, 'maj'], [47, 'maj']],
        bass: [0, 12, null, 7, 0, 12, null, 'lead-in'],
        bassLength: 0.08,
        stabs: [2, 6],
        stabLevel: 0.03,
        ticks: true,
        melody: [
            64, 66, 68, 71, 74, null, 71, null,
            74, null, 73, 71, 69, null, null, 66,
            69, null, 73, null, 76, 74, 73, null,
            71, 68, 64, null, 68, null, null, null,
            64, 66, 68, 71, 74, null, 76, 74,
            74, 73, 71, null, 69, null, 74, null,
            73, null, 69, null, 76, null, 81, 80,
            78, null, 75, null, 76, null, null, null,
        ],
        lead: { wave: 'triangle', level: 0.32, length: 0.07, brightness: 7000 },
    },
    // Level 28, two fast leaves: a happy, jumpy tune (B-flat major, about as
    // quick as Level 27's), its hook big leaps up and down like hopping from
    // leaf to leaf, then a sneaky tiptoe down through a minor chord, on a
    // bright square lead over a bouncing octave bass. A tiny bit sneakier
    // than Level 27's.
    leap: {
        tempo: 126,
        bars: [[46, 'maj'], [43, 'min'], [39, 'maj'], [41, 'maj'], [46, 'maj'], [38, 'min'], [39, 'min'], [41, 'maj']],
        bass: [0, 12, 0, 12, 0, 12, 7, 'lead-in'],
        bassLength: 0.07,
        stabs: [2, 6],
        stabLevel: 0.025,
        ticks: true,
        melody: [
            70, null, 82, null, 77, null, 70, 74,
            79, null, 70, null, 74, 72, 70, null,
            67, null, 79, null, 75, null, 67, 70,
            72, 70, 69, null, 65, null, null, null,
            70, null, 82, null, 77, null, 81, 82,
            77, null, 74, null, 69, 70, 74, null,
            75, null, 74, 72, 70, null, 66, 67,
            69, null, 72, null, 77, null, null, null,
        ],
        lead: { wave: 'square', level: 0.12, length: 0.09, brightness: 3600 },
    },
    // Level 29, three fast leaves: a happy but sly tune (F major leaning on
    // D minor, quick like Level 28's), its hook a sneaky three-note pattern
    // that climbs in steps and keeps landing somewhere unexpected, on a
    // buzzy saw lead over a stop-start bass. A tiny bit sneakier than
    // Level 28's.
    scamper: {
        tempo: 124,
        bars: [[41, 'maj'], [38, 'min'], [46, 'maj'], [36, 'maj'], [38, 'min'], [45, 'min'], [46, 'maj'], [36, 'maj']],
        bass: [0, null, null, 0, 7, null, 12, null],
        bassLength: 0.1,
        stabs: [3, 7],
        stabLevel: 0.025,
        ticks: true,
        melody: [
            72, 69, 65, 74, 70, 67, 76, null,
            74, null, 69, null, 72, null, null, null,
            70, 67, 62, 74, 70, 65, 77, null,
            76, 74, 72, null, 67, null, null, null,
            69, 65, 62, 72, 69, 65, 74, null,
            76, null, 72, null, 69, 71, 72, null,
            74, 70, 65, 77, 74, 70, 81, null,
            79, null, 76, null, 77, null, null, null,
        ],
        lead: { wave: 'sawtooth', level: 0.1, length: 0.08, brightness: 2600 },
    },
    // Level 30, the Jungle World finale: happy but sneaky (E minor, lifting
    // to big bright major chords). A sneaky jungle-call creep ("E-G . F#-E .
    // B") answered by a joyful climbing fanfare that ends high, on a bright
    // reedy lead over a drum-like bouncing bass.
    junglefinale: {
        tempo: 132,
        bars: [[40, 'min'], [40, 'min'], [36, 'maj'], [38, 'maj'], [43, 'maj'], [38, 'maj'], [36, 'maj'], [35, 'maj']],
        bass: [0, null, 7, 0, null, 7, 12, 'lead-in'],
        bassLength: 0.12,
        stabs: [2, 6],
        stabLevel: 0.04,
        ticks: true,
        melody: [
            64, 67, null, 66, 64, null, 59, null,
            64, 67, null, 66, 64, null, 71, null,
            72, null, 76, null, 79, null, 84, null,
            81, 79, 78, null, 74, null, null, 71,
            79, null, 83, 86, 91, null, 86, null,
            90, null, 86, null, 81, 83, 86, null,
            84, null, 79, null, 76, 79, 84, null,
            83, null, 87, null, 88, null, null, null,
        ],
        lead: { wave: 'square', level: 0.12, length: 0.13, brightness: 4200 },
    },
    // Level 31, welcome to Moon World: happy but sneaky, a little sneakier than
    // Level 30 (A minor). A low tiptoeing creep ("A . C . B . G#") like
    // someone sneaking through the moon base, answered by bright bleepy
    // computer-like runs, on a soft round lead over a sparse, floaty bass.
    moonbase: {
        tempo: 112,
        bars: [[45, 'min'], [45, 'min'], [41, 'maj'], [43, 'maj'], [45, 'min'], [38, 'min'], [41, 'maj'], [40, 'maj']],
        bass: [0, null, null, 12, null, 7, null, null],
        bassLength: 0.2,
        stabs: [4],
        stabLevel: 0.03,
        ticks: true,
        melody: [
            57, null, 60, null, 59, null, 56, null,
            57, null, null, 64, null, null, 69, null,
            72, null, 69, 72, 77, null, 76, null,
            74, null, 71, null, 67, null, null, null,
            57, null, 60, null, 59, null, 56, null,
            62, null, null, 65, null, null, 69, null,
            77, 76, 74, 72, 74, null, 76, null,
            80, null, 76, null, 71, null, null, null,
        ],
        lead: { wave: 'sine', level: 0.36, length: 0.22, brightness: 5000 },
    },
    // Level 32, the squeeze-past crater: happy but sneaky, a tiny bit sneakier
    // than Level 31 (E minor with a sneaky F). A hushed repeated-note "E E . F
    // . E" peek, like someone checking round a crater's rim, answered by
    // bouncy climbing hops, on a soft plucky triangle lead over a stop-start bass.
    craterhop: {
        tempo: 116,
        bars: [[40, 'min'], [41, 'maj'], [40, 'min'], [43, 'maj'], [40, 'min'], [41, 'maj'], [36, 'maj'], [35, 'maj']],
        bass: [0, null, 0, null, 7, null, null, 'lead-in'],
        bassLength: 0.14,
        stabs: [3, 7],
        stabLevel: 0.03,
        ticks: true,
        melody: [
            64, 64, null, 65, null, 64, null, null,
            65, null, 69, null, 72, null, 69, null,
            64, 64, null, 67, null, 64, null, null,
            71, null, 74, null, 79, null, 74, 71,
            76, null, 76, 77, null, 76, null, 72,
            77, null, 81, null, 84, null, 81, null,
            79, 76, 72, null, 76, 79, 84, null,
            83, null, 78, null, 75, null, 71, null,
        ],
        lead: { wave: 'triangle', level: 0.3, length: 0.12, brightness: 3200 },
    },
    // Level 33, the big crater: happy but sneaky, a tiny bit sneakier than
    // Level 32 (G minor). A creeping chromatic slide down "G . F# F . D",
    // like tiptoeing past the edge of a big hole, then a cheeky hop back up,
    // on a quiet hollow square lead over a walking bass.
    craterdrop: {
        tempo: 120,
        bars: [[43, 'min'], [43, 'min'], [39, 'maj'], [38, 'maj'], [43, 'min'], [36, 'min'], [39, 'maj'], [38, 'maj']],
        bass: [0, null, 3, null, 7, null, 5, 'lead-in'],
        bassLength: 0.13,
        stabs: [2, 6],
        stabLevel: 0.03,
        ticks: true,
        melody: [
            67, null, 66, 65, null, 62, null, null,
            67, null, 66, 65, null, 62, 70, null,
            75, null, 74, null, 70, null, 67, null,
            69, null, 66, null, 62, null, null, null,
            79, null, 78, 77, null, 74, null, null,
            72, null, 75, null, 79, null, 84, null,
            82, 79, 75, null, 79, null, 82, null,
            81, null, 78, null, 74, 78, 81, null,
        ],
        lead: { wave: 'square', level: 0.11, length: 0.12, brightness: 2600 },
    },
    // Level 34, a tighter squeeze on the moon: happy but sneaky, a tiny bit
    // sneakier than Level 33 (C minor). Opens with a sudden octave jump and a
    // quick tiptoe back down "C . C' B . G", like peeking over a crater's rim
    // and ducking, then a sly zig-zag climb, on a thin reedy lead over a
    // bouncy offbeat bass.
    craterpeek: {
        tempo: 124,
        bars: [[36, 'min'], [36, 'min'], [41, 'min'], [43, 'maj'], [36, 'min'], [44, 'maj'], [41, 'min'], [43, 'maj']],
        bass: [null, 0, null, 7, null, 0, 5, 'lead-in'],
        bassLength: 0.12,
        stabs: [1, 5],
        stabLevel: 0.03,
        ticks: true,
        melody: [
            60, null, null, 72, 71, null, 67, null,
            60, null, null, 72, 71, null, 67, 63,
            65, 68, 67, 70, 68, 72, null, null,
            71, null, 67, null, 62, null, 59, null,
            72, null, null, 84, 83, null, 79, null,
            80, 79, 75, 79, 80, null, 84, null,
            77, 80, 79, 75, 72, null, 68, null,
            67, 71, 74, null, 71, null, null, null,
        ],
        lead: { wave: 'sawtooth', level: 0.08, length: 0.1, brightness: 2200 },
    },
    // Level 35, three craters: happy but sneaky, a tiny bit sneakier than
    // Level 34 (F# minor with a sneaky G). Opens with three quick knocks
    // "F# F# F#" then a hush and a sly half-step "G F#", like counting three
    // craters on tiptoe, then a skipping climb, on a bright bell-like square
    // lead over a stop-start bass.
    cratertrio: {
        tempo: 128,
        bars: [[42, 'min'], [43, 'maj'], [42, 'min'], [37, 'maj'], [42, 'min'], [38, 'maj'], [40, 'maj'], [37, 'maj']],
        bass: [0, null, null, 0, null, 7, null, 'lead-in'],
        bassLength: 0.11,
        stabs: [2, 6],
        stabLevel: 0.03,
        ticks: true,
        melody: [
            66, 66, 66, null, null, 67, 66, null,
            67, 67, 67, null, null, 71, 67, null,
            66, 66, 66, null, 69, 73, 78, null,
            77, null, 73, null, 68, null, null, null,
            78, 78, 78, null, null, 79, 78, null,
            74, null, 78, 81, null, 78, 74, null,
            76, 80, 83, null, 80, null, 76, null,
            77, null, 73, 70, 68, null, null, null,
        ],
        lead: { wave: 'square', level: 0.09, length: 0.09, brightness: 3400 },
    },
    // Level 36, the first hover platform: happy but sneaky, a tiny bit
    // sneakier than Level 35 (B minor). Opens with a long held note that
    // floats up "B . . . D F# B'", like a hover disc lifting off, then a sly
    // slide down through the sneaky G, on a soft glassy triangle lead over a
    // bass that hangs back on the off-beats.
    hoverdisc: {
        tempo: 132,
        bars: [[47, 'min'], [43, 'maj'], [47, 'min'], [42, 'maj'], [47, 'min'], [40, 'maj'], [43, 'maj'], [42, 'maj']],
        bass: [0, null, null, 7, null, 7, 0, 'lead-in'],
        bassLength: 0.12,
        stabs: [3, 7],
        stabLevel: 0.03,
        ticks: true,
        melody: [
            71, null, null, null, 74, 78, 83, null,
            82, null, 79, null, 78, null, null, null,
            71, null, null, null, 74, 78, 81, null,
            80, 78, 77, null, 78, null, null, null,
            83, null, null, null, 81, 79, 78, null,
            76, null, 79, 83, null, 79, 76, null,
            79, 83, 86, null, 83, null, 79, null,
            78, null, 73, 70, 71, null, null, null,
        ],
        lead: { wave: 'triangle', level: 0.3, length: 0.18, brightness: 5000 },
    },
    // Level 37, the platform and the sneaky crater: happy but sneaky, a tiny
    // bit sneakier than Level 36 (C# minor, a touch faster). Opens on a
    // tiptoeing "G# . G# G G# . . C#'" that keeps slipping a half step down
    // and back, like creeping past a crater, on a soft square lead over a
    // bass that sneaks in late.
    craterdive: {
        tempo: 136,
        bars: [[49, 'min'], [45, 'maj'], [49, 'min'], [44, 'maj'], [42, 'min'], [45, 'maj'], [44, 'maj'], [49, 'min']],
        bass: [0, null, null, 0, null, 7, null, 'lead-in'],
        bassLength: 0.1,
        stabs: [3, 7],
        stabLevel: 0.03,
        ticks: true,
        melody: [
            68, null, 68, 67, 68, null, null, 73,
            72, null, 69, null, 68, null, null, null,
            64, null, 64, 63, 64, null, null, 69,
            68, 67, 66, null, 68, null, null, null,
            66, null, 69, null, 73, null, 72, 73,
            76, null, 73, null, 69, null, 66, null,
            68, null, 72, null, 75, 72, 68, null,
            67, 68, 61, null, 61, null, null, null,
        ],
        lead: { wave: 'square', level: 0.085, length: 0.08, brightness: 3000 },
    },
    // Level 38, two hover platforms: happy but sneaky, a tiny bit sneakier
    // than Level 37 (E-flat minor, a touch faster). Opens with two little
    // octave hops "Bb . Bb' . Bb . Bb' A'", one for each hover disc, that
    // slip a half step down at the end, on a thin buzzy sawtooth lead over a
    // bass that only plays on the off-beats.
    twinhover: {
        tempo: 140,
        bars: [[51, 'min'], [47, 'maj'], [51, 'min'], [46, 'maj'], [44, 'min'], [47, 'maj'], [46, 'maj'], [51, 'min']],
        bass: [null, 0, null, null, null, 7, null, 'lead-in'],
        bassLength: 0.09,
        stabs: [3, 7],
        stabLevel: 0.03,
        ticks: true,
        melody: [
            70, null, 82, null, 70, null, 82, 81,
            78, null, 75, null, 71, null, null, null,
            63, null, 75, null, 63, null, 75, 74,
            74, null, 70, null, 65, null, null, null,
            68, null, 71, null, 75, null, 74, 75,
            78, null, 75, null, 71, null, 68, null,
            70, null, 74, null, 77, 74, 70, null,
            69, 70, 63, null, 63, null, null, null,
        ],
        lead: { wave: 'sawtooth', level: 0.06, length: 0.07, brightness: 2600 },
    },
    // Level 39, longer wrong ways on the moon: happy but sneaky, a tiny bit
    // sneakier than Level 38 (G-sharp minor, a touch faster). Opens with a
    // slow creep up four half steps "G# A A# B . . D#", like tiptoeing down
    // a long wrong way, then does it again a step higher, on a hollow square
    // lead over a bass that drags behind the beat.
    longway: {
        tempo: 144,
        bars: [[56, 'min'], [52, 'maj'], [59, 'maj'], [54, 'maj'], [56, 'min'], [49, 'min'], [51, 'maj'], [56, 'min']],
        bass: [0, null, 7, null, null, 0, null, 'lead-in'],
        bassLength: 0.09,
        stabs: [3, 6],
        stabLevel: 0.03,
        ticks: true,
        melody: [
            68, 69, 70, 71, null, null, 75, null,
            76, null, 75, 76, 71, null, null, null,
            71, 72, 73, 74, null, null, 78, null,
            78, null, 77, 78, 73, null, null, null,
            80, null, 75, null, 71, null, 75, 80,
            76, null, 73, null, 68, null, 73, 76,
            75, 74, 75, 78, 82, null, 79, null,
            80, 79, 68, null, 68, null, null, null,
        ],
        lead: { wave: 'square', level: 0.08, length: 0.08, brightness: 2200 },
    },
    // Level 40, the Moon World finale: happy but sneaky, and big. G minor, a
    // bright bell-like triangle lead. Opens with a sneaky octave hop "G G' .
    // D . B-flat A" (nothing like Level 31's low tiptoe), then climbs to a
    // triumphant high D, like a rocket lifting off from the moon base.
    moonfinale: {
        tempo: 138,
        bars: [[43, 'min'], [43, 'min'], [39, 'maj'], [41, 'maj'], [43, 'min'], [39, 'maj'], [38, 'maj'], [38, 'maj']],
        bass: [0, null, 12, 7, 0, null, 12, 'lead-in'],
        bassLength: 0.11,
        stabs: [2, 6],
        stabLevel: 0.04,
        ticks: true,
        melody: [
            67, 79, null, 74, null, 70, 69, null,
            67, 79, null, 74, null, 70, 72, null,
            70, null, 75, null, 79, null, 82, null,
            81, 79, 77, null, 72, null, 77, null,
            79, null, 82, null, 86, null, 82, 79,
            82, null, 79, null, 75, 79, 82, null,
            81, null, 78, null, 74, 78, 81, null,
            86, null, 81, 78, 74, null, null, null,
        ],
        lead: { wave: 'triangle', level: 0.14, length: 0.14, brightness: 4600 },
    },
    // Level 42, the first bubble ride: way more sneaky than happy, sneakier
    // than Level 41's. F minor, slow-ish and creeping ("F . A-flat . G G-flat
    // F"), with a soft round sine lead and little high "bloop" notes that pop
    // up like bubbles; one short bright bubble climb in the middle is its
    // only bit of happy.
    bubbletrap: {
        tempo: 108,
        bars: [[41, 'min'], [41, 'min'], [37, 'maj'], [36, 'maj'], [41, 'min'], [46, 'min'], [37, 'maj'], [36, 'maj']],
        bass: [0, null, null, 7, 0, null, null, 'lead-in'],
        bassLength: 0.16,
        stabs: [],
        ticks: true,
        melody: [
            65, null, 68, null, 67, 66, 65, null,
            60, null, null, 72, null, 77, null, null,
            68, null, 73, null, 72, 71, 70, null,
            72, null, null, 64, null, 76, null, null,
            65, null, 68, null, 67, 66, 65, null,
            70, null, 73, null, 77, null, 82, null,
            73, 72, 70, 68, 67, null, 64, null,
            65, null, null, null, 77, null, null, null,
        ],
        lead: { wave: 'sine', level: 0.3, length: 0.13, brightness: 2400 },
    },
    // Level 43, urchins and the bubble: E-flat minor, slower and lower than
    // Level 42's. A tiptoeing half-step creep (E-flat, D, E-flat) that keeps
    // stopping to listen, a spiky tritone poke (A against E-flat) like
    // brushing an urchin, and a long hush before each phrase. No happy climb.
    urchinprowl: {
        tempo: 100,
        bars: [[39, 'min'], [39, 'min'], [38, 'maj'], [39, 'min'], [42, 'maj'], [39, 'min'], [44, 'min'], [38, 'maj']],
        bass: [0, null, null, null, 1, 0, null, 'lead-in'],
        bassLength: 0.2,
        stabs: [],
        ticks: true,
        melody: [
            63, null, 62, 63, null, null, null, null,
            66, null, 65, 66, null, null, 69, null,
            63, null, 62, 63, null, null, 58, null,
            57, null, null, 58, null, null, null, null,
            66, null, 65, 66, null, null, 70, null,
            69, null, null, 63, null, null, null, null,
            68, 66, null, 64, 63, null, 62, null,
            63, null, null, null, 51, null, null, null,
        ],
        lead: { wave: 'triangle', level: 0.32, length: 0.12, brightness: 1600 },
    },
    // Level 44, the tighter squeeze: C-sharp minor, slower and lower still
    // than Level 43's. Single held notes that slide down by half steps like
    // holding your breath to squeeze past, a low dark bass pulse, a sour
    // flat-second (D against C-sharp) poke, and longer silences. No climb at all.
    urchinsqueeze: {
        tempo: 92,
        bars: [[37, 'min'], [37, 'min'], [38, 'maj'], [37, 'min'], [33, 'maj'], [37, 'min'], [38, 'maj'], [36, 'maj']],
        bass: [0, null, 0, null, null, null, null, 'lead-in'],
        bassLength: 0.24,
        stabs: [],
        ticks: true,
        melody: [
            61, null, null, null, 60, null, null, null,
            61, null, null, 62, null, null, null, null,
            56, null, null, 55, null, 56, null, null,
            null, null, null, null, 49, null, null, null,
            64, null, 63, null, 62, null, 61, null,
            null, null, 62, 61, null, null, null, null,
            56, null, 55, null, 54, null, 53, null,
            49, null, null, null, null, null, 50, null,
        ],
        lead: { wave: 'triangle', level: 0.3, length: 0.16, brightness: 1200 },
    },
    // Level 45, two bubbles: B-flat minor, slower and darker than Level 44's.
    // Every little phrase comes twice, the second time an octave lower and
    // softer, like an echo from a second bubble deep down; a creeping
    // half-step wobble (B-flat, A, B-flat), a sour E (the tritone) poke, a
    // slow two-note low bass heartbeat, and long held hushes. No happy at all.
    twinbubble: {
        tempo: 86,
        bars: [[46, 'min'], [46, 'min'], [45, 'maj'], [46, 'min'], [42, 'maj'], [46, 'min'], [40, 'maj'], [45, 'maj']],
        bass: [0, null, null, 0, null, null, null, 'lead-in'],
        bassLength: 0.28,
        stabs: [],
        ticks: true,
        melody: [
            70, null, 69, 70, null, null, null, null,
            58, null, 57, 58, null, null, null, null,
            null, null, 64, null, null, null, 65, null,
            null, null, 52, null, null, null, 53, null,
            73, null, null, 72, null, null, 70, null,
            61, null, null, 60, null, null, 58, null,
            69, null, null, null, 64, null, null, null,
            46, null, null, null, null, null, null, null,
        ],
        lead: { wave: 'sine', level: 0.3, length: 0.18, brightness: 1000 },
    },
    // Level 46, big urchin, tighter squeeze: E minor, the slowest yet. It
    // opens on two bars of tiptoeing low staccato pairs (no held notes), then
    // a stuck, creeping three-note figure that keeps sliding a half step lower
    // like squeezing sideways past spines, a sour B-flat (the tritone), a
    // soft muffled square lead and a single low heartbeat bass. No happy at all.
    urchintight: {
        tempo: 80,
        bars: [[40, 'min'], [40, 'min'], [41, 'maj'], [40, 'min'], [36, 'maj'], [40, 'min'], [41, 'maj'], [39, 'maj']],
        bass: [0, null, null, null, 0, null, null, 'lead-in'],
        bassLength: 0.3,
        stabs: [],
        ticks: true,
        melody: [
            52, 52, null, null, 53, 53, null, null,
            52, 52, null, null, 51, 51, null, null,
            64, 65, 64, null, 63, 64, 63, null,
            62, 63, 62, null, null, null, 58, null,
            null, null, 52, null, 53, null, 52, null,
            59, null, null, null, 58, null, null, null,
            64, 65, 64, null, 63, 64, 63, null,
            null, null, 58, null, null, null, 40, null,
        ],
        lead: { wave: 'square', level: 0.2, length: 0.11, brightness: 900 },
    },
    // Level 47, two sneaky urchins: C# minor, slower still than Level 46's.
    // A low, whispered two-note creep, then the same sour figure twice, the
    // second time an octave down and later, like a second urchin waiting
    // round another corner; a held tritone (G natural) at the end of each
    // half, a dull muted triangle lead, ticking and a lone heartbeat bass.
    twourchins: {
        tempo: 74,
        bars: [[37, 'min'], [37, 'min'], [38, 'maj'], [37, 'min'], [33, 'maj'], [37, 'min'], [38, 'maj'], [36, 'maj']],
        bass: [0, null, null, null, null, 0, null, 'lead-in'],
        bassLength: 0.35,
        stabs: [],
        ticks: true,
        melody: [
            49, null, 50, null, null, null, 49, null,
            null, null, 48, null, 49, null, null, null,
            61, 62, 61, null, null, null, 55, null,
            null, null, null, null, null, null, null, null,
            null, null, 49, 50, 49, null, null, null,
            null, null, null, null, 43, null, null, null,
            null, null, 49, 50, 49, null, null, null,
            null, null, 43, null, null, null, 37, null,
        ],
        lead: { wave: 'triangle', level: 0.24, length: 0.13, brightness: 800 },
    },
    // Level 48, deeper wrong ways: D minor, the slowest yet (68 bpm). It
    // opens on a low chromatic slide sinking step by step down from D, like
    // walking deeper and deeper into a wrong way, then a long silence; then a
    // high sour three-note sting (with the tritone A-flat) that answers it,
    // and the slide again, lower. A muffled sawtooth lead, ticking and a lone
    // heartbeat bass. Sneakier than Level 47's.
    deepwrong: {
        tempo: 68,
        bars: [[38, 'min'], [38, 'min'], [39, 'maj'], [38, 'min'], [34, 'maj'], [38, 'min'], [39, 'maj'], [37, 'maj']],
        bass: [0, null, null, null, null, null, 0, 'lead-in'],
        bassLength: 0.4,
        stabs: [],
        ticks: true,
        melody: [
            50, null, 49, null, 48, null, 47, null,
            46, null, null, null, null, null, null, null,
            null, null, null, null, 62, 63, 56, null,
            null, null, null, null, null, null, null, null,
            45, null, 44, null, 43, null, 42, null,
            41, null, null, null, null, null, null, null,
            null, null, 62, 63, 56, null, null, null,
            null, null, null, null, 38, null, null, null,
        ],
        lead: { wave: 'sawtooth', level: 0.18, length: 0.16, brightness: 600 },
    },
    // Level 49, two currents, two bubbles: B minor, slower again (64 bpm).
    // A low swaying half-step pair that rocks back and forth like being
    // pushed by a current, then the same sway a tritone higher (F natural),
    // like the second current further on, each followed by a long hush; a
    // single high sour drip near the end of each half, a dark muffled square
    // lead, ticking and a lone heartbeat bass. Sneakier than Level 48's.
    twocurrents: {
        tempo: 64,
        bars: [[35, 'min'], [35, 'min'], [36, 'maj'], [35, 'min'], [31, 'maj'], [35, 'min'], [36, 'maj'], [34, 'maj']],
        bass: [0, null, null, null, null, null, null, 'lead-in'],
        bassLength: 0.45,
        stabs: [],
        ticks: true,
        melody: [
            47, 48, 47, 48, 47, null, null, null,
            null, null, null, null, null, null, 66, null,
            null, null, null, null, null, null, null, null,
            53, 54, 53, 54, 53, null, null, null,
            null, null, null, null, null, null, null, null,
            47, 48, 47, null, null, null, 46, null,
            null, null, null, null, 65, null, null, null,
            null, null, null, null, null, null, 35, null,
        ],
        lead: { wave: 'square', level: 0.17, length: 0.18, brightness: 500 },
    },
    // Level 50, the Underwater World finale: the sneakiest tune of the
    // world. A-flat minor, the slowest yet (58 bpm). It opens with a low
    // line that sinks one half step at a time, like going down into deep
    // water, then a long hush broken by two quiet high pings far apart, like
    // a sonar; the second half sinks again from higher up and ends on a
    // single deep thump. A soft muffled triangle lead, ticking and a lone
    // heartbeat bass. Sneakier than Level 49's.
    underwaterfinale: {
        tempo: 58,
        bars: [[32, 'min'], [31, 'maj'], [32, 'min'], [28, 'maj'], [32, 'min'], [31, 'maj'], [28, 'maj'], [32, 'min']],
        bass: [0, null, null, null, 0, null, null, 'lead-in'],
        bassLength: 0.5,
        stabs: [],
        ticks: true,
        melody: [
            56, null, null, 55, null, null, 54, null,
            53, null, null, null, null, null, null, null,
            null, null, null, null, 80, null, null, null,
            null, null, null, null, null, null, 80, null,
            61, null, null, 60, null, null, 59, null,
            58, null, null, null, null, null, 56, null,
            null, null, null, null, 79, null, null, null,
            null, null, null, null, null, null, 32, null,
        ],
        lead: { wave: 'triangle', level: 0.2, length: 0.22, brightness: 420 },
    },
    // Level 51, welcome to Candy World: just sneaky, no happy. G minor at
    // 96 bpm. Short plucky tiptoe notes creep up a half step at a time (G,
    // A-flat, A, B-flat) and freeze, then a quick "snap!" jump down an
    // octave like a candy cane breaking; the second half sneaks back down
    // the other way and ends on a low hush. A bright, crunchy square lead,
    // ticking and a stop-start bass.
    candysneak: {
        tempo: 96,
        bars: [[43, 'min'], [43, 'min'], [44, 'maj'], [38, 'maj'], [43, 'min'], [39, 'maj'], [38, 'maj'], [43, 'min']],
        bass: [0, null, 0, null, null, null, 7, null],
        bassLength: 0.12,
        stabs: [],
        ticks: true,
        melody: [
            67, null, 68, null, 69, null, 70, null,
            null, null, null, null, 58, 58, null, null,
            68, null, 69, null, 70, null, 71, null,
            null, null, 72, null, 60, null, null, null,
            74, null, 73, null, 72, null, 71, null,
            70, null, null, null, 63, 63, null, null,
            69, null, 68, null, 67, null, 66, null,
            67, null, null, null, null, null, 55, null,
        ],
        lead: { wave: 'square', level: 0.15, length: 0.09, brightness: 2600 },
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
            // Speech must first be used during a tap, so say nothing now
            // (not on touch screens, which use the game's own voice sounds)
            if (useSpeech()) {
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

    // Say lines with the device's speaking voice. Returns false if it can't
    // (a touch screen, or no voices). If the voice reports an error or hasn't
    // started after a moment, fallback() plays the game's own voice sound
    // instead, so there's always something to hear.
    speak(lines, rate, fallback) {
        const speech = window.speechSynthesis;
        const voices = useSpeech() ? speech.getVoices() : [];
        if (voices.length === 0) return false;
        const english = voices.filter((v) => v.lang?.startsWith('en'));
        const voice = english.find((v) => v.default) || english[0] || voices[0];
        // A voice that's stuck mid-sentence would hold up the new words
        if (speech.speaking || speech.pending) speech.cancel();
        let settled = false;
        const giveUp = () => {
            if (settled) return;
            settled = true;
            speech.cancel();
            fallback();
        };
        lines.forEach(([words, pitch], n) => {
            const say = new SpeechSynthesisUtterance(words);
            say.voice = voice;
            say.rate = rate;
            say.pitch = pitch;
            say.volume = SFX_LEVEL;
            if (n === 0) {
                say.onstart = () => { settled = true; };
                // Cut off by newer words (another spike, the door): nothing to make up for
                say.onerror = (e) => {
                    if (e.error === 'interrupted' || e.error === 'canceled') settled = true;
                    else giveUp();
                };
            }
            speech.speak(say);
        });
        setTimeout(giveUp, SPEECH_START_TIMEOUT);
        return true;
    }

    // The game's own voice sounds play through Web Audio, which may need waking first
    playOwnVoice(play) {
        if (!this.ctx) return;
        this.wake();
        play(this.ctx.currentTime + 0.02);
    }

    // A voice says "Ouch!" (the spike)
    ouch() {
        if (!this.settings.sfx) return;
        this.onEvent('ouch');
        const own = () => this.playOwnVoice((t) => this.syntheticOuch(t));
        if (!this.speak([['Ouch!', 1.3]], 1.1, own)) own();
    }

    // The game's own "Ouch!": a voice-like "ow" and a soft "ch" at the end
    syntheticOuch(t) {
        this.syntheticOw(t);
        const ch = this.ctx.createBiquadFilter();
        ch.type = 'bandpass';
        ch.frequency.value = 3800;
        ch.Q.value = 1.2;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t + 0.4);
        g.gain.exponentialRampToValueAtTime(0.35, t + 0.45);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.62);
        this.noiseSource(t + 0.4, 0.25).connect(ch).connect(g).connect(this.sfxBus);
    }

    // A voice-like "ow": a buzzy tone through vowel filters sliding from "ah" to "oo"
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
    // says "Ouch!" (Iteration 13: no clapping or crowd). iPads (and devices with
    // no speaking voice) get the game's own voice-like "woo hoo" and "yay".
    // long: a world's finale (Levels 10 and 20) gets an extra-long cheer
    cheer({ long = false } = {}) {
        if (!this.settings.sfx) return;
        this.onEvent('cheer');
        const lines = long
            ? [['Woo hoo!', 1.4], ['Yay!', 1.7], ['Woo hoo!', 1.5], ['Yaaay!', 1.8], ['Woo hoo! Yay!', 1.6]]
            : [['Woo hoo!', 1.4], ['Yay!', 1.7]];
        const own = () => this.playOwnVoice((t) => this.syntheticCheer(t, long));
        if (!this.speak(lines, long ? 1.0 : 1.15, own)) own();
    }

    // The game's own cheer: "woo hoo!" then "yay!" (the finale: three times over)
    syntheticCheer(t, long) {
        const out = this.ctx.createGain();
        out.gain.value = CHEER_LEVEL;
        out.connect(this.sfxBus);
        const place = (node) => node.connect(out);
        const words = long ? ['woo', 'hoo', 'yay', 'woo', 'hoo', 'yay', 'woo', 'hoo', 'yay'] : ['woo', 'hoo', 'yay'];
        const gaps = { woo: 0.42, hoo: 0.75, yay: 0.8 };
        for (const word of words) {
            this.shout(t, word, word === 'yay' ? 330 : word === 'hoo' ? 320 : 300, 0, place);
            t += gaps[word];
        }
    }

    // One shouted "yay!" or "woo!": a voice-like buzz through vowel filters
    shout(t, word, base, pan, place) {
        const ctx = this.ctx;
        const yay = word === 'yay';
        // "hoo": a "woo" that starts with a breathy "h"
        if (word === 'hoo') {
            const h = ctx.createBiquadFilter();
            h.type = 'bandpass';
            h.frequency.value = 1400;
            h.Q.value = 0.8;
            const hg = ctx.createGain();
            hg.gain.setValueAtTime(0.0001, t);
            hg.gain.exponentialRampToValueAtTime(0.25, t + 0.04);
            hg.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
            this.noiseSource(t, 0.15).connect(h).connect(hg);
            place(hg, pan);
            t += 0.06;
        }
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
