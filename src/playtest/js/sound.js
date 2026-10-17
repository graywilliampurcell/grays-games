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
const ROLL_LEVEL = 1.5; // a snowball rolling, close up: about as loud as a steam vent's hiss
const VENT_VOLUME = 0.75; // steam vents (hiss and puff), 3/4 of their first loudness
// Ice World's wintery jingles (sleigh bells and twinkles) play in the music,
// a little quieter than its sneaky melody (Gray, 2026-10-15)
const BELL_LEVEL = 0.06;
const TWINKLE_LEVEL = 0.09;
// Robot Factory World's clanks and beeps play in the music (the Music
// switch turns them off), a little under the melody
const CLANK_LEVEL = 0.07;
const BEEP_LEVEL = 0.05;
// Desert Pyramid World's hand drums and snake-charmer flute play in the
// music (the Music switch turns them off), in the background: quieter than
// the sneaky melody (and, being music, quieter than the sound effects)
const DRUM_LEVEL = 0.06;
const FLUTE_LEVEL = 0.035;
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
    // Level 52, the first marshmallow bounce: just sneaky. F minor at 84
    // bpm, slow and gooey. Long, sticky notes ooze back and forth a half
    // step (F, G-flat, F) like feet stuck in caramel, then one big "boing!"
    // leap up an octave and a tumble back down, like bouncing over the
    // chocolate river; the second half oozes lower and ends on a deep, quiet
    // low F. A soft, buzzy sawtooth lead, ticking and a slow, heavy bass.
    caramelcreep: {
        tempo: 84,
        bars: [[41, 'min'], [41, 'min'], [42, 'maj'], [41, 'min'], [37, 'maj'], [36, 'maj'], [42, 'maj'], [41, 'min']],
        bass: [0, null, null, null, 0, null, null, null],
        bassLength: 0.4,
        stabs: [],
        ticks: true,
        melody: [
            65, null, null, 66, null, null, 65, null,
            null, null, null, null, 64, null, 65, null,
            null, null, 66, null, null, 65, null, null,
            null, null, 77, null, 72, 68, 65, null,
            61, null, null, 62, null, null, 61, null,
            null, null, null, null, 60, null, 61, null,
            null, null, 66, null, 65, null, 64, null,
            null, null, null, null, 53, null, null, null,
        ],
        lead: { wave: 'sawtooth', level: 0.12, length: 0.3, brightness: 900 },
    },
    // Level 53, candy canes and the bounce: just sneaky. E minor at 108 bpm.
    // It opens with two quick low "crunch crunch" notes and a pause, like
    // stepping on candy, then a tight squeeze of notes a half step apart
    // (squeezing past the candy cane), then a sudden high "boing!" that
    // drops back like bouncing over the river. The second half crunches
    // higher and ends on a sour, unresolved low note. A hollow, short
    // triangle lead, ticking and a stomping bass on the off-beats.
    canecrunch: {
        tempo: 108,
        bars: [[40, 'min'], [40, 'min'], [36, 'maj'], [35, 'maj'], [40, 'min'], [41, 'maj'], [36, 'maj'], [35, 'maj']],
        bass: [null, 0, null, null, null, 0, 0, null],
        bassLength: 0.14,
        stabs: [],
        ticks: true,
        melody: [
            52, 52, null, null, null, null, 59, 60,
            59, 60, 59, null, null, null, null, null,
            52, 52, null, null, null, null, 76, null,
            71, null, 67, null, 64, null, null, null,
            55, 55, null, null, null, null, 63, 64,
            63, 64, 63, null, null, null, null, null,
            55, 55, null, null, 79, null, 75, null,
            null, null, 58, null, null, null, null, null,
        ],
        lead: { wave: 'triangle', level: 0.2, length: 0.11, brightness: 1600 },
    },
    // Level 54, the tighter squeeze: just sneaky. A minor at 100 bpm. It
    // opens with a tight, wriggling trill of notes a half step apart (A, B-flat,
    // A, G-sharp, A), like squeezing sideways past the candy cane, then one
    // long note that holds on and on, stuck like feet in caramel, then a
    // quick jump up and back down, a bounce over the river. The second half
    // wriggles higher and ends on a sly, unresolved B-flat. A thin, plucky
    // square lead, ticking and a creeping two-note bass.
    tightsqueeze: {
        tempo: 100,
        bars: [[45, 'min'], [45, 'min'], [46, 'maj'], [44, 'maj'], [45, 'min'], [41, 'maj'], [46, 'maj'], [44, 'maj']],
        bass: [0, null, 0, null, null, null, null, null],
        bassLength: 0.18,
        stabs: [],
        ticks: true,
        melody: [
            69, 70, 69, 68, 69, null, null, null,
            72, null, null, null, null, null, null, null,
            null, null, 64, null, 81, null, 76, 69,
            null, null, null, null, null, null, null, null,
            76, 77, 76, 75, 76, null, null, null,
            77, null, null, null, null, null, null, null,
            null, null, 69, null, 84, null, 80, 76,
            null, null, 70, null, null, null, null, null,
        ],
        lead: { wave: 'square', level: 0.13, length: 0.07, brightness: 1300 },
    },
    // Level 55, two bounces: just sneaky. B minor at 104 bpm. It opens with
    // two big boings, a low B jumping up a whole octave and dropping back,
    // twice, like the two marshmallow bounces, then a creeping slide down
    // in half steps (D, C-sharp, C, B), tiptoeing off to the hidden candy
    // cane. The second half bounces from higher up and ends hanging on a
    // sly, unresolved C. A buzzy, dark sawtooth lead, ticking and a
    // two-beat bass that hops like a ball.
    twobounce: {
        tempo: 104,
        bars: [[47, 'min'], [47, 'min'], [43, 'maj'], [42, 'maj'], [47, 'min'], [40, 'min'], [43, 'maj'], [42, 'maj']],
        bass: [0, null, null, 0, null, null, null, null],
        bassLength: 0.16,
        stabs: [],
        ticks: true,
        melody: [
            59, null, 71, null, 59, null, null, null,
            59, null, 71, null, 59, null, null, null,
            62, null, 61, null, 60, null, 59, null,
            null, null, null, null, null, null, null, null,
            64, null, 76, null, 64, null, null, null,
            66, null, 78, null, 66, null, null, null,
            67, null, 66, null, 65, null, 64, null,
            null, null, 60, null, null, null, null, null,
        ],
        lead: { wave: 'sawtooth', level: 0.11, length: 0.1, brightness: 1100 },
    },
    // Level 56, the even tighter squeeze: just sneaky. C-sharp minor at 92
    // bpm. It opens with three short, pinched notes squeezed close together
    // (C-sharp, D, C-sharp), a breath in, then a slow, careful step down
    // past the candy cane, then a big low thud, the big candy cane blocking
    // the way. The second half pinches tighter, a half step higher, and ends
    // on a nervous, unresolved D. A narrow, nasal square lead with a short
    // note, ticking and a bass that only plays on the thud.
    eventighter: {
        tempo: 92,
        bars: [[49, 'min'], [49, 'min'], [45, 'maj'], [44, 'maj'], [49, 'min'], [42, 'min'], [45, 'maj'], [44, 'maj']],
        bass: [null, null, null, null, 0, null, null, null],
        bassLength: 0.3,
        stabs: [],
        ticks: true,
        melody: [
            73, 74, 73, null, null, null, null, null,
            73, null, 71, null, 69, null, 68, null,
            null, null, null, null, 49, null, null, null,
            null, null, null, null, null, null, null, null,
            74, 75, 74, null, null, null, null, null,
            74, null, 72, null, 70, null, 69, null,
            null, null, null, null, 50, null, null, null,
            null, null, 62, null, null, null, null, null,
        ],
        lead: { wave: 'square', level: 0.12, length: 0.06, brightness: 1700 },
    },
    // Level 57, longer wrong ways: just sneaky. G minor at 88 bpm. It opens
    // with a long walk of five even steps up (G, A, B-flat, C, D), going a
    // long way, then a sudden step back down to where it started, the dead
    // end, then a sneaky low wobble. The second half walks a different way,
    // up from B-flat, turns back again and ends on a lost, unresolved A. A
    // soft, round triangle lead with longer notes, ticking and a slow bass.
    longwrongway: {
        tempo: 88,
        bars: [[43, 'min'], [43, 'min'], [39, 'maj'], [38, 'maj'], [46, 'maj'], [43, 'min'], [39, 'maj'], [38, 'maj']],
        bass: [0, null, null, null, 0, null, null, null],
        bassLength: 0.35,
        stabs: [],
        ticks: true,
        melody: [
            67, null, 69, null, 70, null, 72, null,
            74, null, null, null, 67, null, null, null,
            null, null, 55, 54, 55, null, null, null,
            null, null, null, null, null, null, null, null,
            70, null, 72, null, 74, null, 75, null,
            77, null, null, null, 70, null, null, null,
            null, null, 58, 57, 58, null, null, null,
            null, null, 69, null, null, null, null, null,
        ],
        lead: { wave: 'triangle', level: 0.26, length: 0.2, brightness: 1100 },
    },
    // Level 58, lots of caramel: just sneaky. E-flat minor at 76 bpm, the
    // slowest Candy World tune. It opens with heavy notes that stick and
    // drag, each one held and then sliding down a half step (E-flat to D,
    // G-flat to F), like feet pulling out of caramel, then three quick
    // notes as you get free, then stuck again on a long low note. The
    // second half drags higher and ends on a gooey, unresolved E. A thick,
    // dark sawtooth lead with long notes, ticking and a slow, heavy bass.
    caramelswamp: {
        tempo: 76,
        bars: [[39, 'min'], [39, 'min'], [35, 'maj'], [34, 'maj'], [39, 'min'], [42, 'maj'], [35, 'maj'], [34, 'maj']],
        bass: [0, null, null, null, null, null, 0, null],
        bassLength: 0.45,
        stabs: [],
        ticks: true,
        melody: [
            63, null, null, 62, 66, null, null, 65,
            null, null, 70, 68, 66, null, null, null,
            51, null, null, null, null, null, null, null,
            null, null, null, null, null, null, null, null,
            66, null, null, 65, 70, null, null, 69,
            null, null, 73, 71, 70, null, null, null,
            54, null, null, null, null, null, null, null,
            null, null, 64, null, null, null, null, null,
        ],
        lead: { wave: 'sawtooth', level: 0.12, length: 0.32, brightness: 750 },
    },
    // Level 59, bounces and caramel: just sneaky. F-sharp minor at 98 bpm.
    // It opens with a bounce (a low F-sharp leaping up an octave) that lands
    // in goo: the high note holds and sags down a half step, then another
    // bounce that sags the same way, then a quick tiptoe of four notes off
    // toward the hidden candy cane. The second half bounces from a fifth
    // higher, sags, tiptoes, and ends on a sneaky, unresolved G. A bright,
    // hollow square lead, ticking and a bass that bounces on two beats.
    gooeybounce: {
        tempo: 98,
        bars: [[42, 'min'], [42, 'min'], [38, 'maj'], [37, 'maj'], [42, 'min'], [47, 'min'], [38, 'maj'], [37, 'maj']],
        bass: [0, null, null, null, 0, 0, null, null],
        bassLength: 0.2,
        stabs: [],
        ticks: true,
        melody: [
            54, null, 66, null, null, 65, null, null,
            54, null, 66, null, null, 65, null, null,
            null, null, 69, 68, 66, 64, null, null,
            null, null, null, null, null, null, null, null,
            61, null, 73, null, null, 72, null, null,
            61, null, 73, null, null, 72, null, null,
            null, null, 76, 75, 73, 71, null, null,
            null, null, 67, null, null, null, null, null,
        ],
        lead: { wave: 'square', level: 0.12, length: 0.15, brightness: 2000 },
    },
    // Level 60, the Candy World finale: the sneakiest Candy World tune.
    // B-flat minor at 112 bpm. It opens with the squeeze trill (B-flat, B,
    // B-flat), then a bounce leap up an octave that sags into caramel, then a
    // creeping chromatic sneak down four half steps to a low thud, a bit of
    // every Candy World level at once. The second half does it all again a
    // fourth higher, faster and closer together, and ends hanging on a
    // sneaky, unresolved B. A sharp, biting sawtooth lead, ticking, a busy
    // off-beat bass and short stabs.
    candyfinale: {
        tempo: 112,
        bars: [[46, 'min'], [46, 'min'], [42, 'maj'], [41, 'maj'], [46, 'min'], [39, 'min'], [42, 'maj'], [41, 'maj']],
        bass: [0, null, 0, null, null, 0, null, 0],
        bassLength: 0.12,
        stabs: [],
        ticks: true,
        melody: [
            70, 71, 70, null, 58, null, 70, 69,
            null, null, 73, 72, 71, 70, null, null,
            46, null, null, null, null, null, null, null,
            null, null, null, null, null, null, null, null,
            75, 76, 75, null, 63, null, 75, 74,
            null, null, 78, 77, 76, 75, null, null,
            51, null, null, null, 51, null, null, null,
            null, null, 71, null, null, null, null, null,
        ],
        lead: { wave: 'sawtooth', level: 0.1, length: 0.08, brightness: 1800 },
    },
    // Level 61, welcome to Volcano World: just sneaky, no happy. F minor at
    // 92 bpm with the dark, flat second (G-flat) of a smouldering volcano.
    // Two low "blub blub" notes like lava bubbling, a slow creep up through
    // the flat second, then a sudden "pfff" of short high notes rising like a
    // puff of steam; the second half rumbles lower still and ends on a
    // hanging, unfinished G-flat. A warm triangle lead, ticking and a heavy,
    // slow bass.
    lavaprowl: {
        tempo: 92,
        bars: [[41, 'min'], [41, 'min'], [42, 'maj'], [41, 'min'], [37, 'maj'], [42, 'maj'], [36, 'maj'], [41, 'min']],
        bass: [0, null, null, 0, null, null, null, null],
        bassLength: 0.3,
        stabs: [],
        ticks: true,
        melody: [
            53, 53, null, null, 53, 53, null, null,
            54, null, null, 56, null, null, 54, null,
            null, null, null, null, 77, 78, 80, 82,
            null, null, null, null, null, null, null, null,
            48, 48, null, null, 48, 48, null, null,
            49, null, null, 51, null, null, 53, null,
            null, null, null, null, 72, 73, 75, 77,
            null, null, 66, null, null, null, null, null,
        ],
        lead: { wave: 'triangle', level: 0.2, length: 0.14, brightness: 900 },
    },
    // Level 62, the first balloon ride: just sneaky, no happy. B minor at
    // 98 bpm. Each phrase starts low and climbs in quick leaps like a balloon
    // going up (B, D, F#, B), hangs on one high note while it drifts, then
    // tiptoes back down by half steps (A#, A, G#) to land with a soft bump.
    // The second half climbs higher still, and ends floating on an
    // unfinished C#. A square lead, ticking and a light, bouncing bass.
    balloonsneak: {
        tempo: 98,
        bars: [[35, 'min'], [35, 'min'], [31, 'maj'], [30, 'maj'], [35, 'min'], [28, 'min'], [30, 'maj'], [30, 'maj']],
        bass: [0, null, 0, null, null, 0, null, null],
        bassLength: 0.18,
        stabs: [],
        ticks: true,
        melody: [
            59, 62, 66, 71, null, null, null, null,
            70, null, 69, null, 68, null, 66, null,
            55, 59, 62, 67, null, null, null, null,
            66, null, 65, null, 64, null, null, null,
            59, 62, 66, 71, 74, null, null, null,
            73, null, 72, null, 71, null, 67, null,
            54, 58, 61, 66, 73, null, null, null,
            null, null, 73, null, null, null, null, null,
        ],
        lead: { wave: 'square', level: 0.15, length: 0.12, brightness: 1150 },
    },
    // Level 63, the first lava geyser: just sneaky, no happy. C# minor at
    // 106 bpm. Each phrase waits on a low note ticking quietly three times,
    // like a geyser hole bubbling, then bursts straight up more than an
    // octave in a rush of fast notes and splashes back down in a tumble; the
    // second half waits longer and bursts higher, and ends hanging on a high,
    // unfinished D. A buzzy sawtooth lead, ticking and a low, thumping bass.
    geyserburst: {
        tempo: 106,
        bars: [[37, 'min'], [37, 'min'], [33, 'maj'], [32, 'maj'], [37, 'min'], [30, 'min'], [33, 'maj'], [32, 'maj']],
        bass: [0, null, null, null, 0, 0, null, null],
        bassLength: 0.2,
        stabs: [],
        ticks: true,
        melody: [
            49, null, 49, null, 49, null, null, null,
            52, 56, 61, 64, 68, null, 66, 63,
            61, null, null, null, 56, null, null, null,
            48, null, 48, null, 48, null, 48, null,
            49, null, 49, null, 49, null, 49, null,
            52, 56, 61, 64, 68, 73, 71, 68,
            64, null, 61, null, 56, null, null, null,
            null, null, 74, null, null, null, null, null,
        ],
        lead: { wave: 'sawtooth', level: 0.1, length: 0.1, brightness: 1300 },
    },
    // Level 64, two geysers: just sneaky, no happy. G minor at 112 bpm.
    // Two voices take turns like two geysers out of step: a low spurt of
    // three quick notes, then a high one answers from the other side, then
    // the low one again; a big hot coal sits under it all as a slow, heavy
    // two-note bass. The second half answers back and forth faster and ends
    // on a hanging, unfinished A-flat. A square lead, no ticking, a dull,
    // thudding bass.
    twingeysers: {
        tempo: 112,
        bars: [[43, 'min'], [43, 'min'], [44, 'maj'], [43, 'min'], [39, 'maj'], [44, 'maj'], [38, 'maj'], [43, 'min']],
        bass: [0, null, null, null, null, null, 0, null],
        bassLength: 0.45,
        stabs: [],
        ticks: false,
        melody: [
            55, 58, 62, null, null, null, null, null,
            null, null, null, null, 74, 79, 82, null,
            56, 58, 62, null, null, null, null, null,
            null, null, null, null, 75, 79, 80, null,
            55, 58, 62, null, 74, 79, 82, null,
            51, 55, 58, null, 70, 75, 79, null,
            50, 54, 57, null, 74, 78, 81, null,
            null, null, 68, null, null, null, null, null,
        ],
        lead: { wave: 'square', level: 0.14, length: 0.09, brightness: 1000 },
    },
    // Level 65, two balloons: just sneaky, no happy. C minor at 102 bpm.
    // Two slow climbs, like two balloons going up one after the other: a
    // low one rises and hangs, drifts down a step at a time, then a second
    // one rises from a little higher and drifts down too. The second half
    // climbs both at once, higher, and ends on a hanging, unfinished D.
    // A soft triangle lead over quiet ticking and a short, plucked bass.
    twoballoons: {
        tempo: 102,
        bars: [[36, 'min'], [36, 'min'], [32, 'maj'], [31, 'maj'], [36, 'min'], [29, 'min'], [32, 'maj'], [31, 'maj']],
        bass: [0, null, null, 0, null, null, 0, null],
        bassLength: 0.2,
        stabs: [],
        ticks: true,
        melody: [
            48, 51, 55, 60, 63, null, null, null,
            62, null, 60, null, 58, null, 55, null,
            56, 60, 63, 68, 72, null, null, null,
            71, null, 68, null, 67, null, null, null,
            60, 63, 67, 72, 75, null, 79, null,
            77, null, 75, null, 72, null, 68, null,
            56, 60, 63, 68, 72, 75, null, null,
            null, null, 74, null, null, null, null, null,
        ],
        lead: { wave: 'triangle', level: 0.16, length: 0.12, brightness: 1400 },
    },
    // Level 66, the squeeze-past coal: just sneaky, no happy. F minor at
    // 118 bpm. Each phrase creeps up to a note and then wiggles between it
    // and the note right next to it, as if squeezing sideways past something
    // hot, then slips on by with a quick little run; the geyser and the vent
    // are a sudden high jump and a short hiss of repeated notes. The second
    // half squeezes higher and ends on a hanging, unfinished G. A buzzy
    // sawtooth lead, no ticking, and a steady, walking bass.
    coalsqueeze: {
        tempo: 118,
        bars: [[41, 'min'], [41, 'min'], [37, 'maj'], [36, 'maj'], [41, 'min'], [34, 'min'], [37, 'maj'], [36, 'maj']],
        bass: [0, null, 0, null, 0, null, 0, null],
        bassLength: 0.18,
        stabs: [],
        ticks: false,
        melody: [
            53, null, 56, null, 60, 61, 60, 61,
            60, 61, 60, null, 63, 65, 68, null,
            61, null, 65, null, 68, 69, 68, 69,
            68, null, 80, null, 72, 72, 72, null,
            65, null, 68, null, 72, 73, 72, 73,
            72, 73, 72, null, 75, 77, 80, null,
            73, null, 77, null, 80, 81, 80, 81,
            null, null, 79, null, null, null, null, null,
        ],
        lead: { wave: 'sawtooth', level: 0.1, length: 0.1, brightness: 1200 },
    },
    // Level 67, the tighter squeeze: just sneaky, no happy. E minor at 108
    // bpm. Like Level 66's tune but tighter: each phrase tiptoes down, then
    // shuffles between two notes right next to each other, faster and
    // closer than before, as if edging past something hot with no room to
    // spare; the balloon is one long, slow climb in the middle. The end
    // stops on a hanging, unfinished F sharp. A soft triangle lead with
    // ticking, and a bass that only moves on the first beat.
    tightsqueeze: {
        tempo: 108,
        bars: [[40, 'min'], [40, 'min'], [36, 'maj'], [35, 'maj'], [40, 'min'], [43, 'maj'], [36, 'maj'], [35, 'maj']],
        bass: [0, null, null, null, 0, null, null, null],
        bassLength: 0.3,
        stabs: [],
        ticks: true,
        melody: [
            76, null, 74, null, 71, 72, 71, 72,
            71, 72, 71, 72, 71, null, 67, null,
            72, null, 71, null, 67, 68, 67, 68,
            67, 68, 67, null, 63, null, null, null,
            64, null, 67, null, 71, null, 76, null,
            79, null, 83, null, 79, 78, 79, 78,
            76, null, 74, null, 72, 71, 72, 71,
            null, null, 66, null, null, null, null, null,
        ],
        lead: { wave: 'triangle', level: 0.15, length: 0.11, brightness: 1300 },
    },
    // Level 68, longer wrong ways: just sneaky, no happy. C# minor at 94
    // bpm. Each phrase wanders down a long winding line of small steps,
    // stops, and turns back the way it came, like walking all the way into
    // a long wrong way and creeping back out; the balloon is one slow climb
    // near the end. The end stops on a hanging, unfinished D sharp. A dark
    // square lead with ticking, and a bass that walks on beats one and three.
    deepvolcano: {
        tempo: 94,
        bars: [[37, 'min'], [37, 'min'], [33, 'maj'], [32, 'maj'], [37, 'min'], [30, 'min'], [33, 'maj'], [32, 'maj']],
        bass: [0, null, null, null, 7, null, null, null],
        bassLength: 0.35,
        stabs: [],
        ticks: true,
        melody: [
            73, 71, 69, 68, 66, 64, null, null,
            64, 66, 68, 69, 71, null, null, null,
            76, 75, 73, 71, 69, 68, null, null,
            68, 69, 71, null, 68, null, null, null,
            61, null, 64, null, 68, null, 73, null,
            76, null, 78, null, 81, null, null, null,
            80, 78, 76, 75, 73, 71, 69, 68,
            null, null, 63, null, null, null, null, null,
        ],
        lead: { wave: 'square', level: 0.1, length: 0.12, brightness: 900 },
    },
    // Level 69, two balloons and two geysers: just sneaky, no happy. D minor
    // at 100 bpm. Two slow rising swells (the two balloons going up, each
    // stopping in the clouds on a held note) and two sudden jumps that shoot
    // up an octave and drop straight back (the two geysers). The end sinks
    // back down and stops on a hanging, unfinished E. A sawtooth lead,
    // ticking, and a bass that pulses on the off-beats.
    balloongeysers: {
        tempo: 100,
        bars: [[38, 'min'], [34, 'maj'], [38, 'min'], [33, 'maj'], [31, 'min'], [34, 'maj'], [33, 'maj'], [33, 'maj']],
        bass: [null, 0, null, 0, null, 7, null, 0],
        bassLength: 0.2,
        stabs: [],
        ticks: true,
        melody: [
            62, null, 64, null, 65, null, 67, null,
            69, null, null, null, null, null, 65, 62,
            62, 74, 62, null, 62, 74, 62, null,
            61, null, 64, null, 69, null, null, null,
            55, null, 58, null, 62, null, 65, null,
            67, null, null, null, null, null, 70, 67,
            69, 81, 69, null, 67, 65, 64, 62,
            null, 61, null, 64, null, null, null, null,
        ],
        lead: { wave: 'sawtooth', level: 0.08, length: 0.1, brightness: 1100 },
    },
    // Level 70, the Volcano World finale: the sneakiest Volcano World tune.
    // A-flat minor at 116 bpm. A bit of every Volcano World level at once:
    // the squeeze trill (A-flat, A, A-flat) past the hot coal, a geyser that
    // shoots up an octave and drops straight back, a slow balloon swell that
    // hangs in the ash cloud, and a quick "pfff" of steam; then a creeping
    // chromatic sneak down to a low thud. The second half does it again a
    // fourth higher and closer together, and ends hanging on a sneaky,
    // unresolved A. A biting sawtooth lead, ticking, and a busy off-beat bass.
    volcanofinale: {
        tempo: 116,
        bars: [[44, 'min'], [44, 'min'], [40, 'maj'], [39, 'maj'], [44, 'min'], [37, 'min'], [40, 'maj'], [39, 'maj']],
        bass: [0, null, 0, null, null, 0, null, 0],
        bassLength: 0.12,
        stabs: [],
        ticks: true,
        melody: [
            68, 69, 68, null, 56, 80, 56, null,
            63, null, 66, null, 71, null, null, null,
            80, 82, 83, 85, 71, 70, 69, 68,
            44, null, null, null, null, null, null, null,
            73, 74, 73, null, 61, 85, 61, null,
            68, 71, 76, null, null, null, 85, 87,
            76, 75, 74, 73, 49, null, null, null,
            null, null, 69, null, null, null, null, null,
        ],
        lead: { wave: 'sawtooth', level: 0.1, length: 0.08, brightness: 1500 },
    },
    // Level 71, welcome to Ice World: just sneaky, with wintery jingles in
    // the background. E-flat minor at 86 bpm, slower than any other tune.
    // Each phrase starts on one note, then slides up by half steps like
    // skating on ice (E-flat, E, F, G-flat), and tiptoes back down; the
    // second half slides up an octave higher and lands on a sly D before
    // home. A soft triangle lead and ticks; sleigh bells shake twice a bar
    // and a high twinkle rings at the end of each phrase (jingles).
    icesneak: {
        tempo: 86,
        bars: [[39, 'min'], [39, 'min'], [35, 'maj'], [34, 'maj'], [39, 'min'], [42, 'maj'], [35, 'maj'], [34, 'maj']],
        bass: [0, null, null, null, 0, null, null, null],
        bassLength: 0.25,
        stabs: [],
        ticks: true,
        melody: [
            63, null, null, 64, 65, 66, null, null,
            70, null, 66, null, 63, null, null, null,
            71, null, null, 70, 69, 70, null, null,
            74, null, 70, null, 65, null, null, null,
            75, null, null, 76, 77, 78, null, null,
            78, null, 73, null, 70, null, 66, null,
            71, 70, 71, null, 66, null, 63, null,
            62, null, null, null, 63, null, null, null,
        ],
        lead: { wave: 'triangle', level: 0.18, length: 0.18, brightness: 1200 },
        jingles: { bells: [2, 6], twinkles: { 7: 87, 23: 90, 39: 94, 55: 91, 63: 87 } },
    },
    // Level 72, the first snowman: just sneaky, with wintery jingles. F-sharp
    // minor at 96 bpm. Each phrase taps the same note twice (sneaking up),
    // then flings up high and tumbles back down, like a snowball thrown down
    // the hallway; the second half does it a fifth higher and slides down to
    // a sly F before home. A soft, dark square lead and ticks; sleigh bells on
    // the off-beats and a high twinkle near the end of each phrase (jingles).
    snowmansneak: {
        tempo: 96,
        bars: [[42, 'min'], [42, 'min'], [38, 'maj'], [37, 'maj'], [42, 'min'], [45, 'maj'], [40, 'maj'], [37, 'maj']],
        bass: [0, null, null, 0, null, null, 0, null],
        bassLength: 0.2,
        stabs: [],
        ticks: true,
        melody: [
            66, 66, null, 73, null, 69, 66, null,
            61, null, 62, null, 61, null, null, null,
            66, 66, null, 74, null, 73, 69, null,
            68, null, 64, null, 61, null, null, null,
            73, 73, null, 78, null, 76, 73, null,
            69, null, 73, null, 76, null, null, null,
            74, 73, 71, 69, 68, null, 64, null,
            65, null, null, null, 66, null, null, null,
        ],
        lead: { wave: 'square', level: 0.12, length: 0.14, brightness: 900 },
        jingles: { bells: [3, 7], twinkles: { 14: 90, 30: 92, 46: 97, 62: 90 } },
    },
    // Level 73, the first thin ice: just sneaky, with wintery jingles.
    // B-flat minor at 104 bpm. Each phrase tiptoes up three notes, then
    // shivers on two notes right next to each other, like ice cracking under
    // your feet; the second half climbs higher, creaks down a half step and
    // hurries home. A soft, muted sawtooth lead; sleigh bells on beats 2 and
    // 6 and a high twinkle at the end of each phrase (jingles).
    thinicecreep: {
        tempo: 104,
        bars: [[46, 'min'], [46, 'min'], [42, 'maj'], [41, 'maj'], [46, 'min'], [49, 'maj'], [39, 'min'], [41, 'maj']],
        bass: [0, null, 0, null, null, null, 0, null],
        bassLength: 0.18,
        stabs: [],
        ticks: false,
        melody: [
            70, null, 72, null, 73, null, null, null,
            73, 72, 73, 72, 70, null, null, null,
            66, null, 70, null, 73, null, 78, null,
            77, null, 76, null, 77, null, null, null,
            82, null, 81, null, 82, 80, 78, null,
            77, null, 73, null, 70, null, null, null,
            75, 77, 78, 77, 75, null, 73, null,
            72, null, null, 69, 70, null, null, null,
        ],
        lead: { wave: 'sawtooth', level: 0.1, length: 0.12, brightness: 800 },
        jingles: { bells: [1, 5], twinkles: { 6: 89, 22: 94, 38: 92, 54: 97 } },
    },
    // Level 74, the big icicle: just sneaky, with wintery jingles. G minor
    // at 110 bpm. Each phrase opens with one high note and then drips down
    // in single drops with a pause between, like water off an icicle, then
    // tiptoes back up; the second half drips faster and lands low. A soft
    // triangle lead; sleigh bells on beats 0 and 4 and a high twinkle in the
    // middle of each phrase (jingles).
    icicledrip: {
        tempo: 110,
        bars: [[43, 'min'], [43, 'min'], [39, 'maj'], [38, 'maj'], [43, 'min'], [36, 'min'], [39, 'maj'], [38, 'maj']],
        bass: [0, null, null, 0, null, null, 0, null],
        bassLength: 0.2,
        stabs: [],
        ticks: false,
        melody: [
            79, null, null, 74, null, null, 70, null,
            67, null, 69, null, 70, null, null, null,
            79, null, null, 75, null, null, 72, null,
            74, null, 75, null, 74, null, null, null,
            82, null, 79, null, 77, null, 74, null,
            75, 74, 72, null, 70, null, null, null,
            74, null, 72, null, 70, null, 69, null,
            67, null, null, 66, 67, null, null, null,
        ],
        lead: { wave: 'triangle', level: 0.14, length: 0.16, brightness: 1400 },
        jingles: { bells: [0, 4], twinkles: { 10: 91, 26: 94, 42: 89, 58: 96 } },
    },
    // Level 75, two sleds: just sneaky, with wintery jingles. D minor at
    // 120 bpm. Each phrase sneaks along on one low repeated note, then zips
    // up a quick run like a sled on a zip line and hangs there, then slides
    // back down; the second half does it twice, once per sled. A plucky
    // square lead; sleigh bells on beats 2 and 6 and a twinkle at the top of
    // each zip (jingles).
    twinsleds: {
        tempo: 120,
        bars: [[38, 'min'], [38, 'min'], [34, 'maj'], [33, 'maj'], [38, 'min'], [41, 'maj'], [34, 'maj'], [33, 'maj']],
        bass: [0, null, 0, null, null, null, 0, null],
        bassLength: 0.14,
        stabs: [],
        ticks: false,
        melody: [
            62, null, 62, null, 62, 64, 65, 69,
            74, null, null, null, 72, null, 69, null,
            62, null, 62, null, 62, 65, 67, 70,
            74, null, null, 72, 70, null, 69, null,
            62, 65, 69, 74, null, null, 72, null,
            65, 69, 72, 77, null, 74, null, null,
            70, null, 69, null, 67, null, 65, null,
            64, null, 61, null, 62, null, null, null,
        ],
        lead: { wave: 'square', level: 0.1, length: 0.1, brightness: 1800 },
        jingles: { bells: [2, 6], twinkles: { 8: 93, 24: 94, 35: 93, 43: 98 } },
    },
    // Level 76, the tighter squeeze: just sneaky, with wintery jingles. C
    // minor at 92 bpm. Each phrase opens wide and then squeezes in, the two
    // notes stepping closer and closer like walls closing round an icicle,
    // and ends with a tiny wobble (a half step up and back) as you slip past.
    // A buzzy, dark sawtooth lead; sleigh bells on beats 1 and 5 and a
    // twinkle as each squeeze ends (jingles).
    tightsqueezeice: {
        tempo: 92,
        bars: [[36, 'min'], [36, 'min'], [32, 'maj'], [31, 'maj'], [36, 'min'], [41, 'min'], [32, 'maj'], [31, 'maj']],
        bass: [0, null, null, 0, null, null, 0, null],
        bassLength: 0.18,
        stabs: [],
        ticks: false,
        melody: [
            60, null, 67, null, 62, null, 65, null,
            63, 64, 63, null, null, null, 60, null,
            68, null, 75, null, 70, null, 72, null,
            71, 72, 71, null, null, null, 67, null,
            72, null, 79, null, 74, null, 77, null,
            75, 77, 75, null, 72, null, 68, null,
            67, null, 68, null, 67, null, 65, null,
            63, null, 62, null, 60, null, null, null,
        ],
        lead: { wave: 'sawtooth', level: 0.08, length: 0.13, brightness: 1100 },
        jingles: { bells: [1, 5], twinkles: { 12: 91, 28: 96, 44: 98, 60: 91 } },
    },
    // Level 77, longer wrong ways: just sneaky, with wintery jingles. G#
    // minor at 102 bpm. Each phrase tiptoes a long way up the scale, step by
    // step, like walking deep into a wrong way, then stops, and comes back
    // down the way it came. A soft triangle lead; sleigh bells on beats 0
    // and 6 and a twinkle at the end of each long climb (jingles).
    longwrongice: {
        tempo: 102,
        bars: [[32, 'min'], [32, 'min'], [40, 'maj'], [42, 'maj'], [32, 'min'], [37, 'min'], [40, 'maj'], [39, 'maj']],
        bass: [0, null, 0, null, null, null, 0, null],
        bassLength: 0.16,
        stabs: [],
        ticks: false,
        melody: [
            68, null, 70, 71, 73, null, 75, null,
            76, null, 75, null, 73, null, null, null,
            71, null, 73, 75, 76, null, 78, null,
            80, null, 78, null, 75, null, null, null,
            68, 70, 71, 73, 75, 76, 78, null,
            80, null, null, null, 73, null, 76, null,
            76, null, 75, null, 71, null, 68, null,
            67, null, 68, null, null, null, null, null,
        ],
        lead: { wave: 'triangle', level: 0.14, length: 0.15, brightness: 1600 },
        jingles: { bells: [0, 6], twinkles: { 6: 92, 22: 97, 38: 99, 54: 92 } },
    },
    // Level 78, lots of thin ice: just sneaky, with wintery jingles. A minor
    // at 114 bpm. Short, light tiptoe notes on the same spot, two by two,
    // that suddenly skip away (don't stand still on thin ice!), and a little
    // cracking slide down at the end of each phrase. A crisp square lead;
    // sleigh bells on beats 2 and 7 and twinkles (jingles).
    thinicetiptoe: {
        tempo: 114,
        bars: [[33, 'min'], [33, 'min'], [41, 'maj'], [40, 'maj'], [33, 'min'], [38, 'min'], [40, 'maj'], [33, 'min']],
        bass: [0, null, null, 0, null, null, 0, null],
        bassLength: 0.12,
        stabs: [],
        ticks: false,
        melody: [
            76, 76, null, 76, 76, null, 81, null,
            79, null, 77, 76, 75, 74, null, null,
            77, 77, null, 77, 77, null, 84, null,
            83, null, 81, 80, 79, 78, null, null,
            76, 76, null, 76, 76, null, 81, 83,
            84, null, 83, null, 81, null, null, null,
            80, 80, null, 80, 80, null, 76, null,
            75, 74, 73, 72, 69, null, null, null,
        ],
        lead: { wave: 'square', level: 0.12, length: 0.07, brightness: 1800 },
        jingles: { bells: [2, 7], twinkles: { 14: 93, 30: 96, 46: 100, 62: 93 } },
    },
    // Level 79 (two snowmen): a call and its answer, like two snowmen
    // throwing back and forth: a low four-note toss, then the same toss an
    // octave up from the other end, and a sneaky little tiptoe between them.
    // E minor, a soft triangle lead; sleigh bells on beats 1 and 5 and
    // twinkles (jingles).
    twosnowmen: {
        tempo: 108,
        bars: [[40, 'min'], [40, 'min'], [36, 'maj'], [35, 'maj'], [40, 'min'], [45, 'min'], [35, 'maj'], [40, 'min']],
        bass: [0, null, 0, null, 0, null, null, null],
        bassLength: 0.14,
        stabs: [],
        ticks: false,
        melody: [
            64, null, 67, null, 71, null, 64, null,
            76, null, 79, null, 83, null, 76, null,
            72, null, 71, 69, null, 67, null, null,
            75, null, 78, null, 71, null, null, null,
            64, null, 67, null, 71, null, 74, null,
            76, null, 79, null, 81, null, 84, null,
            83, 81, null, 79, null, 78, null, 75,
            76, null, null, 71, 64, null, null, null,
        ],
        lead: { wave: 'triangle', level: 0.14, length: 0.09, brightness: 1600 },
        jingles: { bells: [1, 5], twinkles: { 12: 95, 28: 99, 44: 91, 60: 95 } },
    },
    // Level 80, the Ice World finale: the sneakiest Ice World tune. B minor
    // at 120 bpm. A bit of every Ice World level at once: the squeeze trill
    // (B, C, B) past the path icicle, a sled zipping up a quick run and
    // gliding down, two snowballs tossed back and forth an octave apart, and
    // a tiptoe over thin ice that cracks on a low thud. The second half does
    // it again a fourth higher and closer together, creeps down by half
    // steps, and ends hanging on a sneaky, unresolved C-sharp. A biting
    // sawtooth lead, ticking, a busy off-beat bass; sleigh bells on beats 0,
    // 3 and 6 and twinkles (jingles).
    icefinale: {
        tempo: 120,
        bars: [[35, 'min'], [35, 'min'], [43, 'maj'], [42, 'maj'], [35, 'min'], [40, 'min'], [43, 'maj'], [42, 'maj']],
        bass: [0, null, 0, null, null, 0, null, 0],
        bassLength: 0.12,
        stabs: [],
        ticks: true,
        melody: [
            71, 72, 71, null, 74, 78, 83, 86,
            83, null, 78, null, 74, null, null, null,
            59, null, 71, null, 59, null, 71, null,
            66, null, 67, null, 66, null, 47, null,
            76, 77, 76, null, 79, 83, 88, 91,
            88, 83, 79, 76, null, null, 64, 76,
            75, 74, 73, 72, 71, 70, 69, null,
            null, null, 73, null, null, null, null, null,
        ],
        lead: { wave: 'sawtooth', level: 0.1, length: 0.08, brightness: 1500 },
        jingles: { bells: [0, 3, 6], twinkles: { 7: 98, 23: 95, 39: 103, 55: 100 } },
    },
    // Level 81, welcome to Robot Factory World: sneaky, a little spooky but
    // more sneaky than spooky. E minor at 96 bpm, creeping up and down in
    // short tiptoe notes, with a spooky B-flat (the note right between E
    // and E an octave up) sneaking in and a dark ending on B. Factory sounds
    // in the background (factory): a metal clank on beats 2 and 6 and little
    // robot beeps here and there.
    factorysneak: {
        tempo: 96,
        bars: [[40, 'min'], [40, 'min'], [46, 'maj'], [45, 'min'], [40, 'min'], [43, 'maj'], [46, 'maj'], [47, 'maj']],
        bass: [0, null, null, 0, null, 0, null, null],
        bassLength: 0.18,
        stabs: [],
        ticks: true,
        melody: [
            64, null, 67, null, 66, null, 63, null,
            64, null, null, null, 59, null, null, null,
            70, null, 69, null, 70, null, 74, null,
            72, null, null, null, 69, null, null, null,
            64, null, 67, null, 71, null, 70, null,
            67, null, 66, null, 62, null, null, null,
            70, null, 65, null, 64, null, 58, null,
            59, null, null, 63, null, null, null, null,
        ],
        lead: { wave: 'square', level: 0.13, length: 0.12, brightness: 1300 },
        factory: { clanks: [2, 6], beeps: { 5: 88, 13: 93, 21: 91, 37: 88, 45: 95, 53: 93, 61: 84 } },
    },
    // Level 82, the first backward belt: sneaky, a little spooky, a bit
    // sneakier than Level 81. G minor at 104 bpm. The melody creeps forward
    // a few steps, then gets carried back down a quick run (like the belt
    // flinging you back), and tries again; a spooky D-flat (right between
    // G and the G above) slips in, and it ends hanging on a low F-sharp.
    // Clanks on beats 0 and 4, a rattling double clank on 6, and robot beeps.
    factorybelt: {
        tempo: 104,
        bars: [[43, 'min'], [43, 'min'], [49, 'maj'], [50, 'maj'], [43, 'min'], [46, 'maj'], [49, 'maj'], [42, 'maj']],
        bass: [0, null, 0, null, null, 0, 0, null],
        bassLength: 0.14,
        stabs: [],
        ticks: true,
        melody: [
            67, null, 69, null, 70, null, 72, null,
            74, 72, 70, 69, 67, null, null, null,
            73, null, 74, null, 73, null, 70, null,
            69, null, null, null, 62, null, null, null,
            67, null, 69, null, 70, null, 74, 77,
            79, 77, 74, 72, 70, 69, 67, null,
            73, null, 72, null, 70, null, 67, null,
            66, null, null, null, null, null, 54, null,
        ],
        lead: { wave: 'triangle', level: 0.17, length: 0.13, brightness: 1700 },
        factory: { clanks: [0, 4, 6], beeps: { 3: 91, 19: 86, 27: 93, 35: 89, 51: 96, 59: 86 } },
    },
    // Level 83, squeeze past the zapper: sneaky and buzzy, a bit sneakier
    // than Level 82. C minor at 112 bpm on a sawtooth. It opens with quick
    // repeated zaps on one note (bzz-bzz-bzz), tiptoes up the side of the
    // tune like squeezing past, zaps again a step higher, and slides down to
    // end on a low B (one step under C, unsettled). Clanks on beats 1 and 5,
    // robot beeps in between.
    factoryzap: {
        tempo: 112,
        bars: [[36, 'min'], [36, 'min'], [41, 'min'], [43, 'maj'], [36, 'min'], [44, 'maj'], [41, 'min'], [43, 'maj']],
        bass: [0, null, null, 0, null, 0, null, null],
        bassLength: 0.12,
        stabs: [],
        ticks: true,
        melody: [
            72, 72, 72, null, 75, null, 74, null,
            72, null, 71, null, 72, null, null, null,
            67, null, 68, null, 70, null, 72, null,
            74, 74, 74, null, 71, null, null, null,
            72, 72, 72, null, 77, null, 75, null,
            74, null, 72, null, 70, null, 68, null,
            67, null, 65, null, 63, null, 62, null,
            59, null, null, null, null, null, 47, null,
        ],
        lead: { wave: 'sawtooth', level: 0.12, length: 0.1, brightness: 1500 },
        factory: { clanks: [1, 5], beeps: { 7: 90, 15: 95, 23: 88, 31: 92, 47: 86, 55: 94 } },
    },
    // Level 84, the robot arms: sneaky, a little spooky, a bit sneakier
    // than Level 83. A minor at 100 bpm on a square wave. A stiff, jerky
    // robot-arm melody: up in two big mechanical steps, a pause, back down
    // the other side (like the arms switching sides), with a spooky
    // E-flat (right between A and the A above) and an ending that sinks to
    // a low G-sharp. Clanks on beats 3 and 7, robot beeps.
    factoryarms: {
        tempo: 100,
        bars: [[45, 'min'], [45, 'min'], [41, 'maj'], [44, 'maj'], [45, 'min'], [51, 'maj'], [41, 'maj'], [44, 'maj']],
        bass: [0, 0, null, null, 0, null, 0, null],
        bassLength: 0.15,
        stabs: [],
        ticks: true,
        melody: [
            69, null, null, 76, null, null, 81, null,
            null, null, 80, null, 76, null, 69, null,
            75, null, 75, null, 74, null, 72, null,
            71, null, null, null, 64, null, null, null,
            69, null, null, 72, null, null, 75, null,
            76, null, 75, null, 72, null, 69, null,
            65, null, 69, null, 72, null, 71, null,
            68, null, null, null, null, null, 56, null,
        ],
        lead: { wave: 'square', level: 0.12, length: 0.09, brightness: 1600 },
        factory: { clanks: [3, 7], beeps: { 1: 93, 11: 88, 25: 96, 33: 90, 43: 86, 57: 95 } },
    },
    // Level 85, the big zapper: sneaky, a little spooky, a bit sneakier
    // than Level 84. F-sharp minor at 106 bpm on a triangle. It opens low
    // with a slow humming buzz (the same low note four times, like a big
    // power line), creeps up in small steps as if peeking at the big
    // zapper, jumps back with a quick zap-zap high up, and sneaks away down
    // to end on a low E-sharp (one step under F-sharp, unsettled). Clanks on
    // beats 2 and 6, robot beeps in between.
    factorybigzap: {
        tempo: 106,
        bars: [[42, 'min'], [42, 'min'], [38, 'maj'], [37, 'maj'], [42, 'min'], [47, 'min'], [38, 'maj'], [37, 'maj']],
        bass: [0, null, 0, null, null, null, 0, null],
        bassLength: 0.18,
        stabs: [],
        ticks: true,
        melody: [
            66, null, 66, null, 66, null, 66, null,
            67, null, 69, null, 70, null, null, null,
            78, 78, null, null, 73, null, 69, null,
            66, null, null, null, 65, null, null, null,
            66, null, 66, null, 66, null, 66, null,
            69, null, 71, null, 73, null, null, null,
            81, 81, null, null, 78, null, 74, null,
            73, null, 69, null, 65, null, 53, null,
        ],
        lead: { wave: 'triangle', level: 0.17, length: 0.12, brightness: 1500 },
        factory: { clanks: [2, 6], beeps: { 5: 89, 13: 94, 29: 87, 37: 92, 45: 96, 61: 85 } },
    },
    // Level 86, the tighter squeeze: sneaky, a little spooky, a bit sneakier
    // than Level 85. B-flat minor at 116 bpm on a square wave. Short,
    // pinched notes squeezed close together (half steps up and down, like
    // edging sideways past the zapper), a quick zap-zap-zap up high, then a
    // rolling run down like the tire ride, ending on a low A (one step
    // under B-flat, unsettled). Clanks on beats 0 and 3, robot beeps.
    factorysqueeze: {
        tempo: 116,
        bars: [[46, 'min'], [46, 'min'], [42, 'maj'], [45, 'maj'], [46, 'min'], [39, 'min'], [42, 'maj'], [45, 'maj']],
        bass: [0, null, null, 0, 0, null, null, null],
        bassLength: 0.1,
        stabs: [],
        ticks: true,
        melody: [
            70, 71, 70, null, 69, 70, null, null,
            73, 74, 73, null, 72, 73, null, null,
            82, 82, 82, null, 77, null, null, null,
            76, null, 74, null, 73, null, 70, null,
            70, 71, 70, null, 69, 70, null, null,
            75, 76, 75, null, 74, 75, null, null,
            78, null, 77, null, 75, null, 73, null,
            70, null, 69, null, null, null, 57, null,
        ],
        lead: { wave: 'square', level: 0.12, length: 0.08, brightness: 1700 },
        factory: { clanks: [0, 3], beeps: { 9: 92, 17: 87, 31: 95, 41: 89, 49: 84, 63: 93 } },
    },
    // Level 87, longer wrong ways: sneaky, a bit sneakier than Level 86.
    // D minor at 98 bpm on a sawtooth. Long winding phrases that wander off
    // down a step at a time (like walking down a long wrong way), stop,
    // and climb back the way they came; a low buzz of repeated notes for
    // the big zapper, ending on a low C-sharp (one step under D,
    // unsettled). Clanks on beats 1 and 4, robot beeps.
    factorylong: {
        tempo: 98,
        bars: [[50, 'min'], [50, 'min'], [46, 'maj'], [45, 'maj'], [50, 'min'], [43, 'min'], [46, 'maj'], [45, 'maj']],
        bass: [0, null, 0, null, null, 0, null, null],
        bassLength: 0.12,
        stabs: [],
        ticks: true,
        melody: [
            74, null, 72, null, 70, null, 69, null,
            67, null, 65, null, null, null, null, null,
            65, null, 67, null, 69, null, 70, null,
            72, null, 74, null, null, null, null, null,
            62, 62, 62, null, 62, 62, null, null,
            77, null, 76, null, 74, null, 72, null,
            70, null, 69, null, 67, null, 65, null,
            62, null, null, null, 61, null, null, null,
        ],
        lead: { wave: 'sawtooth', level: 0.1, length: 0.14, brightness: 1300 },
        factory: { clanks: [1, 4], beeps: { 7: 90, 15: 86, 27: 93, 39: 88, 47: 95, 59: 84 } },
    },
    // Level 88, two robot-arm belts: sneaky, a bit sneakier than Level 87.
    // C-sharp minor at 110 bpm on a triangle. Two stiff robot-arm phrases
    // answer each other, one high and one low (right arm, left arm, right,
    // left), each a short jerky climb that snaps back; then both arms
    // tangle in a quick back-and-forth and it ends low on a B-sharp (one
    // step under C-sharp, unsettled). Clanks on beats 2 and 5, robot beeps.
    factorytwoarms: {
        tempo: 110,
        bars: [[49, 'min'], [49, 'min'], [45, 'maj'], [44, 'maj'], [49, 'min'], [42, 'min'], [45, 'maj'], [44, 'maj']],
        bass: [0, null, null, 0, null, 0, null, null],
        bassLength: 0.12,
        stabs: [],
        ticks: true,
        melody: [
            73, 76, 80, null, 73, null, null, null,
            61, 64, 68, null, 61, null, null, null,
            76, 80, 83, null, 76, null, null, null,
            64, 68, 71, null, 68, null, null, null,
            73, 61, 75, 63, 76, 64, 75, 63,
            73, null, 72, null, null, null, null, null,
            81, null, 80, null, 76, null, 73, null,
            68, null, null, null, 60, null, null, null,
        ],
        lead: { wave: 'triangle', level: 0.17, length: 0.08, brightness: 1500 },
        factory: { clanks: [2, 5], beeps: { 3: 94, 19: 88, 29: 92, 37: 85, 51: 96, 61: 89 } },
    },
    // Level 89, two backward belts: sneaky, a bit sneakier than Level 88.
    // F minor at 108 bpm on a sawtooth. A phrase walks up and then gets
    // flung back down in a fast run (the first belt), then the same thing
    // again lower and later (the second belt, half a cycle behind); a
    // two-note siren for the warnings, and it ends low on an E (one step
    // under F, unsettled). Clanks on beats 0 and 4, robot beeps.
    factorytwobelts: {
        tempo: 108,
        bars: [[41, 'min'], [41, 'min'], [37, 'maj'], [36, 'maj'], [41, 'min'], [46, 'min'], [37, 'maj'], [36, 'maj']],
        bass: [0, null, null, null, 0, null, 0, null],
        bassLength: 0.14,
        stabs: [],
        ticks: true,
        melody: [
            65, 68, 70, 72, 77, 75, 72, 68,
            65, null, null, null, null, null, null, null,
            null, null, 61, 65, 68, 70, 73, 72,
            68, 65, 61, null, null, null, null, null,
            72, 73, 72, 73, 72, null, null, null,
            68, 70, 68, 70, 68, null, null, null,
            77, null, 75, null, 72, null, 68, null,
            65, null, null, null, 64, null, null, null,
        ],
        lead: { wave: 'sawtooth', level: 0.11, length: 0.1, brightness: 1400 },
        factory: { clanks: [0, 4], beeps: { 5: 91, 21: 86, 33: 94, 45: 88, 53: 83, 59: 95 } },
    },
    // Level 90, the Robot Factory World finale: the sneakiest factory tune.
    // E-flat minor at 124 bpm on a sawtooth. It creeps up a half step at a
    // time, freezes, then two quick arm-like jabs (one, then a faster one),
    // a falling flung run for the backward belts, a tight two-note squeeze,
    // and it ends on a low D (a half step under E-flat, unsettled). Clanks
    // on beats 0, 3 and 6, lots of robot beeps.
    factoryfinale: {
        tempo: 124,
        bars: [[39, 'min'], [39, 'min'], [35, 'maj'], [34, 'maj'], [39, 'min'], [44, 'min'], [35, 'maj'], [34, 'maj']],
        bass: [0, null, 0, 0, null, 0, null, 0],
        bassLength: 0.12,
        stabs: [],
        ticks: true,
        melody: [
            63, 64, 65, 66, 67, null, null, null,
            67, null, 70, null, 67, 70, 67, 70,
            null, null, 75, 74, 70, 67, 66, 63,
            58, null, null, null, null, null, null, null,
            66, 67, 66, 67, null, null, 66, 67,
            70, 71, 70, null, 75, null, 71, null,
            70, null, 67, null, 66, null, 63, null,
            62, null, null, null, null, null, null, null,
        ],
        lead: { wave: 'sawtooth', level: 0.11, length: 0.09, brightness: 1300 },
        factory: { clanks: [0, 3, 6], beeps: { 3: 96, 11: 89, 19: 93, 27: 86, 35: 97, 43: 90, 51: 84, 59: 94 } },
    },
    // Level 91, Everything World: Cotton Candy. A happy, skipping cotton
    // candy tune in E-flat major at 126 bpm: "da-da DUM" skips up to a high
    // note in every bar, a bouncy oom-pah bass with chords on top, one soft
    // minor bar pair (C minor, F minor) and a big happy run home, on a
    // bell-like triangle lead. No ticking, so it stays happy.
    candyparade: {
        tempo: 126,
        bars: [[39, 'maj'], [44, 'maj'], [46, 'maj'], [39, 'maj'], [36, 'min'], [41, 'min'], [46, 'maj'], [39, 'maj']],
        bass: [0, null, 7, null, 0, null, 7, 'lead-in'],
        bassLength: 0.16,
        stabs: [2, 6],
        stabLevel: 0.06,
        ticks: false,
        melody: [
            70, 75, null, 74, 75, null, 79, null,
            80, null, 79, 77, 75, null, 72, null,
            74, 77, null, 75, 74, null, 70, null,
            67, null, 70, null, 75, null, null, null,
            72, 75, null, 74, 72, null, 79, null,
            77, null, 75, 72, 68, null, 72, null,
            70, 74, 77, 82, 80, null, 77, 74,
            75, null, null, null, 75, null, null, null,
        ],
        lead: { wave: 'triangle', level: 0.32, length: 0.14, brightness: 4500 },
    },
    // Level 92, Everything World: Space: a happy, floaty space tune (G
    // major) in Space World's style, whose hook blasts off in a quick climb,
    // floats at the top and drifts down like a platform, with one sneaky
    // minor bar pair in the middle, on a soft sine lead over a rocking bass.
    spacetour: {
        tempo: 118,
        bars: [[43, 'maj'], [36, 'maj'], [38, 'maj'], [43, 'maj'], [40, 'min'], [35, 'min'], [38, 'maj'], [43, 'maj']],
        bass: [0, null, 7, null, 12, null, 7, null],
        bassLength: 0.18,
        stabs: [2, 6],
        stabLevel: 0.03,
        ticks: false,
        melody: [
            67, 71, 74, 79, null, null, 78, 79,
            76, null, 72, null, 79, null, 76, null,
            74, 78, 81, 86, null, null, 84, 81,
            79, null, null, null, 74, null, null, null,
            76, 79, 83, null, 81, null, 79, null,
            78, null, 74, null, 71, null, 74, null,
            74, 78, 81, null, 83, 86, 88, null,
            91, null, null, null, 79, null, null, null,
        ],
        lead: { wave: 'sine', level: 0.32, length: 0.22, brightness: 6000 },
    },
    // Level 93, Everything World: Jungle: a happy, bouncy jungle tune (D
    // major, 116 bpm) in Jungle World's style, whose hook hops leaf to leaf
    // (down-up-up leaps) then tiptoes down by half steps past a bush, with
    // one sneaky minor bar pair, on a woody plucked lead over a skipping
    // bass with soft ticks like bugs in the leaves.
    jungletour: {
        tempo: 116,
        bars: [[38, 'maj'], [43, 'maj'], [45, 'maj'], [38, 'maj'], [47, 'min'], [40, 'min'], [43, 'maj'], [45, 'maj']],
        bass: [0, null, 12, 7, null, 7, 0, 'lead-in'],
        bassLength: 0.12,
        stabs: [3, 7],
        stabLevel: 0.03,
        ticks: true,
        melody: [
            74, null, 69, 74, 78, null, 81, null,
            79, null, 78, 77, 76, null, 71, null,
            73, null, 69, 73, 76, null, 81, null,
            78, null, 76, null, 74, null, null, null,
            71, 74, 78, null, 76, 74, 71, null,
            72, null, 71, 70, 69, null, 64, null,
            67, 71, 74, null, 79, null, 78, 76,
            81, null, 73, null, 74, null, null, null,
        ],
        lead: { wave: 'triangle', level: 0.3, length: 0.09, brightness: 5200 },
    },
    // Level 94, Everything World: Moon: happy but sneaky in Moon World's
    // style (F minor, 132 bpm). Its hook floats: a long held high C that
    // drifts down in slow steps like a hover disc gliding over a crater,
    // then a quick bounce back up (low F, high F), on a hollow square lead
    // over a bass that only plays on the off-beats, with soft ticks.
    moontour: {
        tempo: 132,
        bars: [[41, 'min'], [44, 'maj'], [46, 'min'], [41, 'min'], [49, 'maj'], [44, 'maj'], [48, 'maj'], [41, 'min']],
        bass: [null, 0, null, 7, null, 0, null, 'lead-in'],
        bassLength: 0.1,
        stabs: [2, 6],
        stabLevel: 0.03,
        ticks: true,
        melody: [
            84, null, null, null, 82, null, 80, null,
            79, null, 77, null, 65, 77, null, null,
            80, null, null, null, 79, null, 77, null,
            75, null, 72, null, 68, null, null, null,
            73, null, 77, null, 80, null, 77, null,
            75, null, 72, null, 68, null, 72, null,
            76, null, 79, null, 84, 82, 79, null,
            77, null, 65, null, 65, null, null, null,
        ],
        lead: { wave: 'square', level: 0.08, length: 0.12, brightness: 3200 },
    },
    // Level 95, Everything World: Underwater: sneaky in Underwater World's
    // style (G minor, 104 bpm), with a little more bounce than the reef's
    // own tunes, since it's a tour. A creeping half-step drift (G, F-sharp,
    // G) like swaying with a current, little high "bloop" notes popping up
    // like bubbles, one slow bubble-ride climb and a sour C-sharp (the
    // tritone) poke like brushing an urchin, on a soft round sine lead over
    // a lazy bass with ticks.
    reeftour: {
        tempo: 104,
        bars: [[43, 'min'], [43, 'min'], [39, 'maj'], [38, 'maj'], [43, 'min'], [48, 'min'], [39, 'maj'], [38, 'maj']],
        bass: [0, null, null, 7, null, 0, null, 'lead-in'],
        bassLength: 0.16,
        stabs: [],
        ticks: true,
        melody: [
            67, null, 66, 67, null, null, 79, null,
            70, null, 69, null, 67, null, null, 82,
            63, null, 62, 63, null, null, 75, null,
            62, null, null, 73, null, 74, null, null,
            67, null, 70, null, 74, null, 79, null,
            72, null, 75, null, 79, null, 84, null,
            75, 74, 72, 70, 69, null, 66, null,
            67, null, null, null, 79, null, null, null,
        ],
        lead: { wave: 'sine', level: 0.3, length: 0.14, brightness: 2600 },
    },
    // Level 96, Everything World: Candy: just sneaky in Candy World's style
    // (E minor, 96 bpm), with a little tour bounce. Two slow, sticky notes
    // that ooze down a half step (E, D-sharp) like feet stuck in caramel,
    // twice (two caramel spots), then a quick "boing" leap up an octave and
    // a tumble back down like bouncing over the chocolate river on a
    // marshmallow, a sneaky creep up to a sour B-flat like peeking round a
    // corner at a hidden candy cane, and an unresolved end on F-sharp. A
    // soft triangle lead with gooey long notes, ticks and a plodding bass.
    candytour: {
        tempo: 96,
        bars: [[40, 'min'], [40, 'min'], [36, 'maj'], [35, 'maj'], [40, 'min'], [45, 'min'], [36, 'maj'], [35, 'maj']],
        bass: [0, null, null, null, 0, null, 7, null],
        bassLength: 0.22,
        stabs: [],
        ticks: true,
        melody: [
            64, null, null, 63, null, null, null, null,
            64, null, null, 63, null, null, null, null,
            59, 71, null, 83, null, 78, 74, 71,
            63, null, 66, null, 71, null, null, null,
            64, null, 66, null, 67, null, 69, null,
            70, null, null, null, 69, null, 67, null,
            72, null, 76, 84, null, 79, 76, 72,
            71, null, null, null, 66, null, null, null,
        ],
        lead: { wave: 'triangle', level: 0.2, length: 0.22, brightness: 2000 },
    },
    // Level 97, Everything World: Volcano: just sneaky in Volcano World's
    // style (B-flat minor, 112 bpm), a little tour of its four dangers. Three
    // short same-note puffs and a hiss up (the steam vent), a sudden shoot
    // up two octaves and straight back down (the lava geyser), a slow
    // step-by-step climb (the balloon going up), then a tight shuffle
    // between two notes (edging past the hot coal). The end stops on a
    // hanging, unfinished C. A dark square lead with ticking, and a bass on
    // beats one and two.
    volcanotour: {
        tempo: 112,
        bars: [[34, 'min'], [34, 'min'], [29, 'maj'], [29, 'maj'], [34, 'min'], [30, 'maj'], [32, 'maj'], [29, 'maj']],
        bass: [0, null, 7, null, 0, null, null, null],
        bassLength: 0.28,
        stabs: [],
        ticks: true,
        melody: [
            70, null, 70, null, 70, 77, null, null,
            75, null, 73, null, 72, null, null, null,
            65, 77, null, 89, null, 77, 65, null,
            72, null, 73, null, 72, null, 70, null,
            70, null, 72, null, 73, null, 75, null,
            77, null, 78, null, 80, null, 82, null,
            82, 80, 82, 80, 82, null, 77, null,
            null, null, 72, null, null, null, null, null,
        ],
        lead: { wave: 'square', level: 0.11, length: 0.12, brightness: 1100 },
    },
    // Level 98, Everything World: Ice: just sneaky like Ice World's tunes,
    // with wintery jingles, a little tour of its dangers. B minor at 100 bpm:
    // a fast zip down the scale (the sled), a low note rolling over and over
    // and getting closer (the snowman), careful tiptoe steps that suddenly
    // drop (the thin ice), then two notes squeezing together (edging past
    // the icicle), ending on a hanging note. A soft square lead; sleigh
    // bells on beats 0 and 4 and a twinkle after each danger (jingles).
    icetour: {
        tempo: 100,
        bars: [[35, 'min'], [35, 'min'], [31, 'maj'], [33, 'maj'], [35, 'min'], [28, 'min'], [30, 'maj'], [30, 'maj']],
        bass: [0, null, null, null, 7, null, null, null],
        bassLength: 0.2,
        stabs: [],
        ticks: false,
        melody: [
            83, 81, 79, 78, 76, 74, 73, 71,
            null, null, 66, null, null, null, null, null,
            59, null, 59, 61, 59, null, 59, 62,
            59, 64, 59, 66, 59, null, null, null,
            74, null, null, 76, null, null, 78, null,
            null, null, 66, null, null, null, null, null,
            71, null, 79, null, 73, null, 78, null,
            74, null, 76, null, 75, null, null, null,
        ],
        lead: { wave: 'square', level: 0.09, length: 0.11, brightness: 1300 },
        jingles: { bells: [0, 4], twinkles: { 9: 95, 29: 90, 41: 93, 58: 98 } },
    },
    // Level 99, Everything World: Robot Factory: sneaky with just a little
    // spooky, "what's around the corner". C-sharp minor at 88 bpm on a soft
    // square lead. Tiptoe steps creep up, stop dead, then peek one note
    // higher (around the corner?); a spooky G (right between C-sharp and the
    // C-sharp above) creeps in now and then; a low walking bass on every
    // other beat, and it ends hanging on a low B-sharp under the home note.
    // Factory clanks on beats 1 and 5 and robot beeps in the background.
    factorytour: {
        tempo: 88,
        bars: [[37, 'min'], [37, 'min'], [33, 'maj'], [42, 'min'], [37, 'min'], [43, 'maj'], [44, 'maj'], [44, 'maj']],
        bass: [0, null, 0, null, 0, null, 7, null],
        bassLength: 0.2,
        stabs: [],
        ticks: true,
        melody: [
            61, null, 63, null, 64, null, null, null,
            null, null, 68, null, null, null, null, null,
            64, null, 66, null, 67, null, null, null,
            null, null, 73, null, 71, null, null, null,
            61, 64, 61, 67, null, null, null, null,
            null, null, 66, null, 64, null, 61, null,
            68, null, null, 67, null, null, 66, null,
            60, null, null, null, null, null, null, null,
        ],
        lead: { wave: 'square', level: 0.11, length: 0.13, brightness: 1200 },
        factory: { clanks: [1, 5], beeps: { 6: 90, 14: 95, 26: 87, 38: 93, 46: 85, 54: 96, 62: 88 } },
    },
    // Level 100, the Everything World finale: each of its 9 rooms has its own
    // tune in its world's style, every one sneaky with just a little spooky
    // ("what's around the corner"; more sneaky than spooky). Walking into a
    // room crossfades to its tune (Sound.crossfadeTo).
    // Room 1, Cotton Candy: E minor on Cotton Candy World's bell-like
    // triangle; tiptoes up, then a spooky B-flat peeks in before it creeps on.
    roomcottoncandy: {
        tempo: 104,
        bars: [[40, 'min'], [40, 'min'], [36, 'maj'], [35, 'maj'], [40, 'min'], [45, 'min'], [36, 'maj'], [35, 'maj']],
        bass: [0, null, 7, null, 0, null, null, null],
        bassLength: 0.18,
        stabs: [],
        ticks: true,
        melody: [
            64, null, 67, null, 71, null, null, null,
            70, null, null, null, 67, null, 64, null,
            72, null, 71, null, 67, null, null, null,
            66, null, null, null, 63, null, null, null,
            64, 67, null, 71, null, 76, null, null,
            74, null, 72, null, 69, null, null, null,
            72, null, null, 71, null, null, 70, null,
            71, null, null, null, null, null, null, null,
        ],
        lead: { wave: 'triangle', level: 0.24, length: 0.14, brightness: 3500 },
    },
    // Room 2, Space: A minor, floaty and slow on Space World's soft sine,
    // drifting down then hanging on a strange G-sharp.
    roomspace: {
        tempo: 96,
        bars: [[45, 'min'], [45, 'min'], [41, 'maj'], [40, 'maj'], [45, 'min'], [38, 'min'], [41, 'maj'], [40, 'maj']],
        bass: [0, null, null, null, 7, null, null, null],
        bassLength: 0.3,
        stabs: [],
        ticks: true,
        melody: [
            76, null, null, 72, null, null, 69, null,
            null, null, 75, null, null, null, null, null,
            77, null, 76, null, 72, null, null, null,
            68, null, null, null, 71, null, null, null,
            69, null, 72, null, 76, null, 81, null,
            80, null, null, null, 77, null, 74, null,
            72, null, null, null, 69, null, null, null,
            68, null, null, null, null, null, null, null,
        ],
        lead: { wave: 'sine', level: 0.28, length: 0.3, brightness: 2000 },
    },
    // Room 3, Jungle: D minor with a drum-like bass, sneaking through the
    // leaves, a spooky slide down at the end.
    roomjungle: {
        tempo: 108,
        bars: [[38, 'min'], [38, 'min'], [34, 'maj'], [36, 'maj'], [38, 'min'], [43, 'min'], [45, 'maj'], [45, 'maj']],
        bass: [0, null, 0, 7, 0, null, 0, null],
        bassLength: 0.16,
        stabs: [],
        ticks: true,
        melody: [
            62, null, 65, 62, null, null, 69, null,
            68, null, null, null, 65, null, null, null,
            70, null, 69, null, 65, null, 62, null,
            64, null, null, null, 61, null, null, null,
            62, 65, 69, null, 74, null, null, null,
            73, null, 70, null, 67, null, null, null,
            69, null, 68, null, 67, null, 66, null,
            61, null, null, null, null, null, null, null,
        ],
        lead: { wave: 'triangle', level: 0.26, length: 0.12, brightness: 2600 },
    },
    // Room 4, Moon: F-sharp minor on Moon World's square lead, slow steps
    // and long, empty pauses like the quiet of space.
    roommoon: {
        tempo: 92,
        bars: [[42, 'min'], [42, 'min'], [38, 'maj'], [37, 'maj'], [42, 'min'], [47, 'min'], [38, 'maj'], [37, 'maj']],
        bass: [0, null, null, null, 0, null, 7, null],
        bassLength: 0.22,
        stabs: [],
        ticks: true,
        melody: [
            66, null, null, null, 69, null, null, null,
            73, null, 72, null, null, null, null, null,
            74, null, 73, null, 69, null, 66, null,
            65, null, null, null, null, null, 61, null,
            66, null, 69, null, 66, null, 72, null,
            71, null, null, null, 69, null, null, null,
            74, null, null, 73, null, null, 72, null,
            73, null, null, null, null, null, null, null,
        ],
        lead: { wave: 'square', level: 0.1, length: 0.14, brightness: 1300 },
    },
    // Room 5, Underwater: G minor on a soft sine, rising like bubbles and
    // sinking back, with one spooky F-sharp.
    roomsea: {
        tempo: 90,
        bars: [[43, 'min'], [43, 'min'], [39, 'maj'], [38, 'maj'], [43, 'min'], [36, 'min'], [39, 'maj'], [38, 'maj']],
        bass: [0, null, null, 7, null, null, 0, null],
        bassLength: 0.3,
        stabs: [],
        ticks: true,
        melody: [
            67, null, 70, null, 74, null, null, null,
            73, null, null, null, 70, null, 67, null,
            null, null, 75, null, 74, null, 70, null,
            66, null, null, null, 62, null, null, null,
            67, null, null, 70, null, null, 74, null,
            79, null, 78, null, 74, null, null, null,
            75, null, 74, null, 73, null, null, null,
            74, null, null, null, null, null, null, null,
        ],
        lead: { wave: 'sine', level: 0.3, length: 0.28, brightness: 1800 },
    },
    // Room 6, Candy: C minor on Candy World's bright triangle, a sneaky
    // skip that climbs to a high note and creeps back down.
    roomsweets: {
        tempo: 100,
        bars: [[36, 'min'], [36, 'min'], [44, 'maj'], [43, 'maj'], [36, 'min'], [41, 'min'], [44, 'maj'], [43, 'maj']],
        bass: [0, null, 7, null, 0, null, null, null],
        bassLength: 0.18,
        stabs: [],
        ticks: true,
        melody: [
            72, null, 75, null, 72, null, 79, null,
            78, null, null, null, 75, null, null, null,
            80, null, 79, null, 75, null, 72, null,
            71, null, null, null, 67, null, null, null,
            72, null, null, 75, null, 79, null, 84,
            83, null, null, null, 80, null, 77, null,
            75, null, 74, null, 73, null, null, null,
            74, null, null, null, null, null, null, null,
        ],
        lead: { wave: 'triangle', level: 0.24, length: 0.12, brightness: 4000 },
    },
    // Room 7, Volcano: E-flat minor on Volcano World's dark square lead,
    // three little puffs, then a slow sneaky climb.
    roomvolcano: {
        tempo: 112,
        bars: [[39, 'min'], [39, 'min'], [35, 'maj'], [34, 'maj'], [39, 'min'], [44, 'min'], [35, 'maj'], [34, 'maj']],
        bass: [0, null, 7, null, 0, null, null, null],
        bassLength: 0.28,
        stabs: [],
        ticks: true,
        melody: [
            63, null, 63, null, 63, 66, null, null,
            70, null, 69, null, null, null, null, null,
            71, null, 70, null, 66, null, 63, null,
            62, null, null, null, 58, null, null, null,
            63, null, 66, null, 70, null, 75, null,
            74, null, null, null, 71, null, null, null,
            70, null, 69, null, 68, null, 67, null,
            70, null, null, null, null, null, null, null,
        ],
        lead: { wave: 'square', level: 0.11, length: 0.12, brightness: 1100 },
    },
    // Room 8, Ice: F minor on Ice World's soft square lead, high and
    // careful, with its wintery jingles (sleigh bells and twinkles).
    roomice: {
        tempo: 96,
        bars: [[41, 'min'], [41, 'min'], [37, 'maj'], [36, 'maj'], [41, 'min'], [46, 'min'], [37, 'maj'], [36, 'maj']],
        bass: [0, null, null, null, 7, null, null, null],
        bassLength: 0.2,
        stabs: [],
        ticks: true,
        melody: [
            77, null, null, 80, null, null, 84, null,
            83, null, null, null, 80, null, null, null,
            null, null, 77, null, 76, null, null, null,
            79, null, null, null, 72, null, null, null,
            77, null, 80, null, 77, null, 83, null,
            82, null, null, null, 77, null, null, null,
            80, null, null, 79, null, null, 78, null,
            79, null, null, null, null, null, null, null,
        ],
        lead: { wave: 'square', level: 0.09, length: 0.11, brightness: 1300 },
        jingles: { bells: [0, 4], twinkles: { 13: 96, 30: 94, 45: 99, 60: 91 } },
    },
    // Room 9, Robot Factory: B minor, low creeping steps that stop and peek
    // around the corner, with Robot Factory World's clanks and beeps.
    roomfactory: {
        tempo: 86,
        bars: [[35, 'min'], [35, 'min'], [31, 'maj'], [30, 'maj'], [35, 'min'], [40, 'min'], [31, 'maj'], [30, 'maj']],
        bass: [0, null, 0, null, 0, null, 7, null],
        bassLength: 0.2,
        stabs: [],
        ticks: true,
        melody: [
            59, null, 62, null, 66, null, null, null,
            null, null, 65, null, null, null, null, null,
            67, null, 66, null, 62, null, 59, null,
            58, null, null, null, null, null, 54, null,
            59, 62, 59, 65, null, null, null, null,
            null, null, 64, null, 62, null, 59, null,
            66, null, null, 65, null, null, 64, null,
            58, null, null, null, null, null, null, null,
        ],
        lead: { wave: 'square', level: 0.11, length: 0.13, brightness: 1200 },
        factory: { clanks: [1, 5], beeps: { 6: 91, 18: 96, 30: 88, 42: 94, 54: 86, 62: 97 } },
    },
    // Level 101, welcome to Desert Pyramid World: sneaky and mysterious,
    // more sneaky than mysterious. D "snake charmer" scale (D, E-flat, F-sharp,
    // G, A, B-flat, C) at 100 bpm, tiptoeing in short square notes, with a
    // mysterious step down to E-flat. In the background (desert): hand drums
    // (a low "dum" and a bright "tek") and a breathy snake-charmer flute
    // winding up and down, both quieter than the melody.
    desertsneak: {
        tempo: 100,
        bars: [[38, 'maj'], [38, 'maj'], [39, 'maj'], [38, 'maj'], [38, 'maj'], [36, 'min'], [39, 'maj'], [38, 'maj']],
        bass: [0, null, null, 0, null, 0, null, null],
        bassLength: 0.18,
        stabs: [],
        ticks: true,
        melody: [
            62, null, 63, null, 66, null, 63, null,
            62, null, null, null, 57, null, null, null,
            67, null, 66, null, 67, null, 69, null,
            70, null, null, null, 69, null, null, null,
            62, null, 63, null, 66, null, 67, null,
            69, null, 70, null, 69, null, 66, null,
            67, null, 63, null, 62, null, 63, null,
            62, null, null, null, null, null, null, null,
        ],
        lead: { wave: 'square', level: 0.12, length: 0.11, brightness: 1300 },
        desert: {
            dums: [0, 3],
            teks: [2, 5, 6],
            // [step, note, length in seconds]
            flute: [[8, 74, 0.5], [10, 75, 0.35], [11, 78, 0.9], [14, 75, 0.5], [24, 74, 1.4],
                [40, 81, 0.5], [42, 79, 0.35], [43, 78, 0.6], [45, 75, 0.35], [46, 74, 1.5]],
        },
    },
    // Level 102, the first flying carpet: sneaky and mysterious, more sneaky
    // than mysterious. A "snake charmer" scale (A, B-flat, C-sharp, D, E, F,
    // G) at 92 bpm: soft tiptoeing pairs of notes that creep up, then a slow
    // curl down through B-flat. Hand drums ("dum ... tek-tek") and a breathy
    // flute that floats like the carpet, both quieter than the melody.
    carpetcreep: {
        tempo: 92,
        bars: [[45, 'maj'], [45, 'maj'], [46, 'maj'], [45, 'maj'], [43, 'min'], [45, 'maj'], [46, 'maj'], [45, 'maj']],
        bass: [0, null, null, null, 0, null, 0, null],
        bassLength: 0.2,
        stabs: [],
        ticks: true,
        melody: [
            69, 70, null, null, 69, 70, null, null,
            73, null, 74, null, 73, null, null, null,
            70, null, 69, null, null, null, 64, null,
            65, null, 64, null, null, null, null, null,
            69, 70, null, null, 73, 74, null, null,
            76, null, 77, null, 76, null, 74, null,
            73, null, 70, null, 69, null, 70, null,
            69, null, null, null, null, null, null, null,
        ],
        lead: { wave: 'square', level: 0.11, length: 0.1, brightness: 1250 },
        desert: {
            dums: [0, 4],
            teks: [3, 6, 7],
            // [step, note, length in seconds]
            flute: [[12, 81, 0.6], [14, 82, 0.4], [16, 85, 1.0], [22, 82, 0.8], [28, 81, 1.4],
                [44, 86, 0.5], [46, 85, 0.4], [48, 82, 0.8], [52, 81, 0.5], [56, 76, 1.6]],
        },
    },
    // Level 103, the first spinning wall: sneaky and mysterious, more sneaky
    // than mysterious. E "snake charmer" scale (E, F, G-sharp, A, B, C, D) at
    // 96 bpm: a low three-note sneak that stops and listens, answered by a
    // turn round the top like the wall spinning. Hand drums ("dum-dum ...
    // tek") and a breathy flute, both quieter than the melody.
    beetlecreep: {
        tempo: 96,
        bars: [[40, 'maj'], [40, 'maj'], [41, 'maj'], [40, 'maj'], [40, 'maj'], [38, 'min'], [41, 'maj'], [40, 'maj']],
        bass: [0, 0, null, null, 0, null, null, null],
        bassLength: 0.16,
        stabs: [],
        ticks: true,
        melody: [
            64, null, 65, null, 64, null, null, null,
            null, null, 68, null, 69, null, null, null,
            71, 72, 71, null, 69, null, 68, null,
            65, null, 64, null, null, null, null, null,
            64, null, 65, null, 68, null, null, null,
            72, null, 74, null, 72, 71, 72, null,
            71, null, 68, null, 65, null, 68, null,
            64, null, null, null, null, null, null, null,
        ],
        lead: { wave: 'square', level: 0.11, length: 0.12, brightness: 1150 },
        desert: {
            dums: [0, 1],
            teks: [4, 7],
            // [step, note, length in seconds]
            flute: [[6, 76, 0.6], [8, 77, 0.4], [10, 80, 1.0], [20, 77, 0.6], [26, 76, 1.4],
                [38, 83, 0.5], [40, 84, 0.4], [42, 83, 0.6], [44, 80, 0.5], [54, 76, 1.6]],
        },
    },
    // Level 104, the first trapdoor: sneaky and mysterious, more sneaky than
    // mysterious. B "snake charmer" scale (B, C, D-sharp, E, F-sharp, G, A)
    // at 104 bpm: quick tiptoe triplets on one note that stop and wait, then
    // suddenly drop an octave (like falling through a trapdoor) and creep
    // back up. Hand drums ("dum ... tek tek-tek") and a breathy flute, both
    // quieter than the melody.
    trapdoorcreep: {
        tempo: 104,
        bars: [[47, 'maj'], [47, 'maj'], [48, 'maj'], [47, 'maj'], [45, 'min'], [47, 'maj'], [48, 'maj'], [47, 'maj']],
        bass: [0, null, 0, null, null, null, 0, null],
        bassLength: 0.15,
        stabs: [],
        ticks: true,
        melody: [
            71, 71, 71, null, null, null, 72, null,
            71, null, null, null, 59, null, null, null,
            63, null, 64, null, 66, null, 67, null,
            66, null, 64, null, 63, null, null, null,
            75, 75, 75, null, null, null, 76, null,
            75, null, null, null, 63, null, null, null,
            64, null, 66, null, 67, 69, 67, null,
            71, null, 72, null, 71, null, null, null,
        ],
        lead: { wave: 'square', level: 0.11, length: 0.1, brightness: 1200 },
        desert: {
            dums: [0, 6],
            teks: [2, 3, 5],
            // [step, note, length in seconds]
            flute: [[4, 83, 0.6], [6, 84, 0.4], [12, 78, 1.2], [26, 79, 0.8], [30, 78, 1.2],
                [36, 87, 0.5], [38, 88, 0.4], [44, 83, 1.0], [52, 84, 0.6], [58, 83, 1.4]],
        },
    },
    // Level 105, two trapdoors and a hidden button: sneaky and mysterious,
    // more sneaky than mysterious. G "snake charmer" scale (G, A-flat, B, C,
    // D, E-flat, F) at 88 bpm, the slowest desert tune: it starts high and
    // sneaks down step by step with long listening rests, then two soft
    // "click-click" notes (like the hidden button) and a creep back up through
    // A-flat. Hand drums ("dum ... dum-tek") and a breathy flute, both
    // quieter than the melody.
    buttoncreep: {
        tempo: 88,
        bars: [[43, 'maj'], [43, 'maj'], [44, 'maj'], [43, 'maj'], [41, 'min'], [43, 'maj'], [44, 'maj'], [43, 'maj']],
        bass: [0, null, null, null, null, 0, 0, null],
        bassLength: 0.17,
        stabs: [],
        ticks: true,
        melody: [
            79, null, null, 77, null, null, 75, null,
            74, null, null, null, null, null, null, null,
            67, 67, null, null, 68, null, 71, null,
            72, null, 71, null, 68, null, null, null,
            79, null, null, 77, null, null, 75, null,
            74, null, 72, null, 71, null, null, null,
            67, 67, null, null, 68, null, 71, null,
            67, null, null, null, null, null, null, null,
        ],
        lead: { wave: 'square', level: 0.11, length: 0.11, brightness: 1100 },
        desert: {
            dums: [0, 5],
            teks: [6],
            // [step, note, length in seconds]
            flute: [[8, 86, 0.5], [10, 87, 0.4], [12, 86, 1.0], [24, 83, 0.6], [28, 80, 1.4],
                [40, 89, 0.5], [42, 87, 0.4], [44, 86, 0.8], [50, 83, 0.5], [56, 79, 1.8]],
        },
    },
    // Level 106, the tighter squeeze: sneaky and mysterious, more sneaky
    // than mysterious. D "snake charmer" scale (D, E-flat, F-sharp, G, A,
    // B-flat, C) at 100 bpm: pairs of notes from far apart that squeeze in
    // toward each other (high, low, a bit less high, a bit less low...),
    // stop and listen, then a slow creep down. Hand drums ("dum-dum ...
    // tek") and a breathy flute, both quieter than the melody.
    squeezecreep: {
        tempo: 100,
        bars: [[38, 'maj'], [38, 'maj'], [39, 'maj'], [38, 'maj'], [43, 'min'], [38, 'maj'], [39, 'maj'], [38, 'maj']],
        bass: [0, null, null, 0, null, null, null, null],
        bassLength: 0.15,
        stabs: [],
        ticks: true,
        melody: [
            74, null, 63, null, 72, null, 66, null,
            70, null, 67, null, 69, null, null, null,
            null, null, 69, 70, 69, null, 66, null,
            63, null, 62, null, null, null, null, null,
            74, null, 63, null, 72, null, 66, null,
            70, null, 67, null, 69, null, null, null,
            78, null, 75, null, 74, null, 70, null,
            69, null, 66, null, 62, null, null, null,
        ],
        lead: { wave: 'square', level: 0.11, length: 0.1, brightness: 1200 },
        desert: {
            dums: [0, 3],
            teks: [6],
            // [step, note, length in seconds]
            flute: [[13, 81, 0.5], [16, 82, 0.4], [18, 81, 0.9], [28, 78, 1.0],
                [45, 86, 0.5], [47, 87, 0.4], [49, 86, 0.8], [60, 74, 1.4]],
        },
    },
    // Level 107, longer wrong ways: sneaky and mysterious, more sneaky than
    // mysterious. E "snake charmer" scale (E, F, G-sharp, A, B, C, D) at
    // 82 bpm: a long tiptoe walk up, one note at a time, that stops at the
    // top as if it hit a dead end, then tiptoes all the way back down and
    // tries another way. Hand drums ("dum ... tek-tek") and a breathy flute,
    // both quieter than the melody.
    longwaycreep: {
        tempo: 82,
        bars: [[40, 'maj'], [40, 'maj'], [41, 'maj'], [40, 'maj'], [45, 'min'], [40, 'maj'], [41, 'maj'], [40, 'maj']],
        bass: [0, null, null, null, 0, null, null, null],
        bassLength: 0.18,
        stabs: [],
        ticks: true,
        melody: [
            64, null, 65, null, 68, null, 69, null,
            71, null, 72, null, 74, null, 76, null,
            77, null, null, null, null, null, null, null,
            76, 74, 72, 71, 69, 68, 65, null,
            64, null, null, null, 68, null, 65, null,
            64, null, 65, null, 68, null, 71, null,
            72, null, 71, null, null, null, 68, null,
            65, null, 64, null, null, null, null, null,
        ],
        lead: { wave: 'triangle', level: 0.12, length: 0.12, brightness: 1100 },
        desert: {
            dums: [0],
            teks: [5, 7],
            // [step, note, length in seconds]
            flute: [[18, 88, 0.8], [21, 89, 0.5], [23, 88, 1.2], [36, 80, 1.0],
                [50, 84, 0.6], [53, 83, 0.6], [56, 80, 1.6]],
        },
    },
    // Level 108, two button doors: sneaky and mysterious, more sneaky than
    // mysterious. A "snake charmer" scale (A, B-flat, C-sharp, D, E, F, G)
    // at 94 bpm: a quiet "knock, knock" on one low note, a creeping answer
    // up the scale, then the same knock again one step higher (the second
    // door) with an answer that slips back down. Hand drums ("dum ... tek")
    // and a breathy flute, both quieter than the melody.
    twodoorcreep: {
        tempo: 94,
        bars: [[45, 'maj'], [45, 'maj'], [46, 'maj'], [45, 'maj'], [50, 'min'], [50, 'min'], [46, 'maj'], [45, 'maj']],
        bass: [0, null, null, 0, null, null, null, null],
        bassLength: 0.16,
        stabs: [],
        ticks: true,
        melody: [
            69, 69, null, null, 70, 73, 74, null,
            76, null, 74, null, 73, null, null, null,
            69, 69, null, null, 70, 73, 74, null,
            76, null, 77, null, 79, null, null, null,
            74, 74, null, null, 76, 77, 79, null,
            81, null, 79, null, 77, 76, 74, null,
            73, null, 70, null, 69, null, null, null,
            null, null, 69, null, 69, null, null, null,
        ],
        lead: { wave: 'square', level: 0.11, length: 0.1, brightness: 1150 },
        desert: {
            dums: [0, 3],
            teks: [6],
            // [step, note, length in seconds]
            flute: [[12, 85, 0.7], [28, 86, 0.9], [44, 88, 0.6], [47, 86, 0.6],
                [52, 85, 1.4]],
        },
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
        // Tunes still fading out after a crossfade: { tune, step, next, gain, until }
        this.fading = [];

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
            // The tune playing now goes through its own gain, so a new tune
            // can fade in while the old one fades out (Level 100's rooms)
            this.tuneGain = this.ctx.createGain();
            this.tuneGain.connect(this.musicBus);
            this.noteOut = this.tuneGain;
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
        this.endFades();
        const tune = TUNES[name] || TUNES.happy;
        if (tune === this.tune) return;
        this.tune = tune;
        this.tuneName = TUNES[name] ? name : 'happy';
        this.musicStep = 0;
        if (this.timer) this.onEvent('music');
    }

    // Level 100: the next room's tune takes over with a smooth crossfade
    // (`time` seconds): it starts from its beginning, fading in, while the
    // old tune keeps playing and fades out. Without music playing yet, it's
    // a plain switch.
    crossfadeTo(name, time = 1) {
        const tune = TUNES[name] || TUNES.happy;
        if (tune === this.tune) return;
        if (!this.ctx || !this.timer) return this.setTune(name);
        const now = this.ctx.currentTime;
        const old = { tune: this.tune, step: this.musicStep, next: this.nextNoteTime, gain: this.tuneGain, until: now + time };
        old.gain.gain.cancelScheduledValues(now);
        old.gain.gain.setValueAtTime(old.gain.gain.value, now);
        old.gain.gain.linearRampToValueAtTime(0, now + time);
        this.fading.push(old);
        this.tuneGain = this.ctx.createGain();
        this.tuneGain.gain.setValueAtTime(0, now);
        this.tuneGain.gain.linearRampToValueAtTime(1, now + time);
        this.tuneGain.connect(this.musicBus);
        this.noteOut = this.tuneGain;
        this.tune = tune;
        this.tuneName = TUNES[name] ? name : 'happy';
        this.musicStep = 0;
        this.onEvent('music');
    }

    // Stop any tune still fading out, and play the current one at full level
    endFades() {
        for (const f of this.fading) setTimeout(() => f.gain.disconnect(), 500);
        this.fading = [];
        if (this.tuneGain) {
            const now = this.ctx.currentTime;
            this.tuneGain.gain.cancelScheduledValues(now);
            this.tuneGain.gain.setValueAtTime(1, now);
        }
    }

    stopMusic() {
        this.musicWanted = false;
        clearInterval(this.timer);
        this.timer = null;
        if (this.ctx) this.endFades();
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
        // Tunes fading out (a crossfade) keep playing until they're silent
        for (const f of this.fading) {
            const fSteps = f.tune.bars.length * 8;
            const fLength = 60 / f.tune.tempo / 2;
            this.noteOut = f.gain;
            while (f.next < now) {
                f.step = (f.step + 1) % fSteps;
                f.next += fLength;
            }
            while (f.next < Math.min(now + MUSIC_LOOKAHEAD, f.until)) {
                this.playStep(f.tune, f.step % fSteps, f.next);
                f.step = (f.step + 1) % fSteps;
                f.next += fLength;
            }
        }
        this.noteOut = this.tuneGain;
        for (const f of this.fading) if (now > f.until + 0.5) f.gain.disconnect();
        this.fading = this.fading.filter((f) => now <= f.until + 0.5);
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
        // Ice World's wintery jingles: sleigh bells and high twinkles
        if (tune.jingles) {
            if (tune.jingles.bells.includes(beat)) this.sleighBells(t);
            const twinkle = tune.jingles.twinkles[step];
            if (twinkle) this.twinkle(hz(twinkle), t);
        }
        // Robot Factory World's background: metal clanks and robot beeps
        if (tune.factory) {
            if (tune.factory.clanks.includes(beat)) this.clank(t);
            const beep = tune.factory.beeps[step];
            if (beep) this.beep(hz(beep), t);
        }
        // Desert Pyramid World's background: hand drums and a snake-charmer flute
        if (tune.desert) {
            if (tune.desert.dums.includes(beat)) this.dum(t);
            if (tune.desert.teks.includes(beat)) this.tek(t);
            for (const [at, note, length] of tune.desert.flute) if (at === step) this.flute(hz(note), t, length);
        }
    }

    // A hand drum's low "dum": a soft thump that drops in pitch
    dum(t) {
        const o = this.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(140, t);
        o.frequency.exponentialRampToValueAtTime(72, t + 0.18);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(DRUM_LEVEL * 2.2, t + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
        o.connect(g).connect(this.noteOut);
        o.start(t);
        o.stop(t + 0.27);
    }

    // A hand drum's bright "tek": a quick slap on the drum's rim
    tek(t) {
        const src = this.noiseSource(t, 0.06);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 3200;
        filter.Q.value = 1.6;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(DRUM_LEVEL, t + 0.003);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        src.connect(filter).connect(g).connect(this.noteOut);
        this.pluck(520, t, DRUM_LEVEL * 0.4, 0.05, 'triangle', 3000);
    }

    // A snake-charmer flute note: a breathy, reedy tone that slides up into
    // its note and wobbles (vibrato), held for `length` seconds
    flute(freq, t, length) {
        const ctx = this.ctx;
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.setValueAtTime(freq * 0.94, t);
        o.frequency.exponentialRampToValueAtTime(freq, t + 0.07);
        const wobble = ctx.createOscillator();
        wobble.frequency.value = 5.5;
        const depth = ctx.createGain();
        depth.gain.value = freq * 0.012;
        wobble.connect(depth).connect(o.frequency);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 2600;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(FLUTE_LEVEL, t + 0.06);
        g.gain.setValueAtTime(FLUTE_LEVEL, t + length * 0.7);
        g.gain.exponentialRampToValueAtTime(0.0001, t + length);
        o.connect(filter).connect(g).connect(this.noteOut);
        // A little breath
        const breath = this.noiseSource(t, length);
        const bf = ctx.createBiquadFilter();
        bf.type = 'bandpass';
        bf.frequency.value = freq * 2;
        bf.Q.value = 3;
        const bg = ctx.createGain();
        bg.gain.setValueAtTime(0.0001, t);
        bg.gain.exponentialRampToValueAtTime(FLUTE_LEVEL * 0.35, t + 0.05);
        bg.gain.exponentialRampToValueAtTime(0.0001, t + length);
        breath.connect(bf).connect(bg).connect(this.noteOut);
        for (const n of [o, wobble]) {
            n.start(t);
            n.stop(t + length + 0.02);
        }
    }

    // A metal clank, like a hammer on a pipe far off in the factory: a
    // short knock of noise with two ringing, out-of-tune metal tones
    clank(t) {
        const src = this.noiseSource(t, 0.08);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 2200;
        filter.Q.value = 2.5;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(CLANK_LEVEL * 1.4, t + 0.003);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
        src.connect(filter).connect(gain).connect(this.noteOut);
        this.pluck(431, t, CLANK_LEVEL, 0.28, 'sine', 3000);
        this.pluck(1187, t, CLANK_LEVEL * 0.6, 0.18, 'sine', 4000);
    }

    // A little robot beep: two quick square-wave blips
    beep(freq, t) {
        this.pluck(freq, t, BEEP_LEVEL, 0.06, 'square', 4000);
        this.pluck(freq, t + 0.09, BEEP_LEVEL * 0.8, 0.05, 'square', 4000);
    }

    // A quick shake of sleigh bells: a few bright, ringing taps close together
    sleighBells(t) {
        for (let k = 0; k < 4; k++) {
            const at = t + k * 0.035;
            const src = this.noiseSource(at, 0.12);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 7500 + k * 400;
            filter.Q.value = 6;
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.0001, at);
            gain.gain.exponentialRampToValueAtTime(BELL_LEVEL * (k === 0 ? 1.6 : 1), at + 0.004);
            gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.1);
            src.connect(filter).connect(gain).connect(this.noteOut);
            // A little bell ring on top
            this.pluck(5200 + k * 330, at, BELL_LEVEL * 0.5, 0.09, 'sine', 9000);
        }
    }

    // A high, bell-like twinkle that rings on a moment
    twinkle(freq, t) {
        this.pluck(freq, t, TWINKLE_LEVEL, 0.6, 'sine', 9000);
        this.pluck(freq * 2, t + 0.09, TWINKLE_LEVEL * 0.5, 0.4, 'sine', 9000);
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
        osc.connect(filter).connect(gain).connect(this.noteOut);
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
        src.connect(filter).connect(gain).connect(this.noteOut);
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

    // A steam vent (Volcano World): a soft hiss that swells for `length`
    // seconds (its warning), and a louder whoosh when it puffs. Both obey the
    // Sound effects switch and play at VENT_VOLUME (Gray, 2026-10-15: 3/4 of
    // what they were). Each returns a handle for hush(), or null.
    hiss(length = 1) {
        if (!this.settings.sfx || !this.ctx) return null;
        this.onEvent('hiss');
        return this.steam(this.ctx.currentTime, length, 0.05 * VENT_VOLUME, 0.35 * VENT_VOLUME, 5200);
    }

    // The vent's puff. (A balloon setting off also whooshes, at full volume.)
    puff(length = 0.5) {
        return this.whoosh(length, VENT_VOLUME);
    }

    whoosh(length = 0.5, volume = 1) {
        if (!this.settings.sfx || !this.ctx) return null;
        this.onEvent('whoosh');
        return this.steam(this.ctx.currentTime, length, 0.6 * volume, 0.8 * volume, 2400);
    }

    // Quickly fade out a vent sound that's still playing (you got past it)
    hush(handle) {
        if (!handle || !this.ctx) return;
        const t = this.ctx.currentTime;
        if (t >= handle.end) return;
        const g = handle.gain.gain;
        g.cancelScheduledValues(t);
        g.setValueAtTime(Math.max(0.0001, g.value), t);
        g.exponentialRampToValueAtTime(0.0001, t + 0.08);
        handle.end = t;
    }

    // A backward belt's warning siren (Robot Factory World, Level 82 on):
    // like a far-off tornado siren, a wailing tone that rises and falls and
    // fades up and down twice in 2 seconds. As loud as the other sound
    // effects, never louder; quieter the further you are (volume 0-1).
    // Obeys the Sound effects switch.
    siren(volume = 1, length = 2) {
        if (!this.settings.sfx || !this.ctx || volume <= 0.01) return null;
        this.onEvent('siren');
        const t = this.ctx.currentTime;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1800;
        const oscs = [['sawtooth', 1], ['sine', 2]].map(([type, mult]) => {
            const osc = this.ctx.createOscillator();
            osc.type = type;
            osc.frequency.setValueAtTime(330 * mult, t);
            return osc;
        });
        const swells = 2;
        const each = length / swells;
        for (let k = 0; k < swells; k++) {
            const at = t + k * each;
            g.gain.exponentialRampToValueAtTime(0.0001, at + 0.01);
            g.gain.exponentialRampToValueAtTime(0.28 * volume, at + each * 0.5);
            g.gain.exponentialRampToValueAtTime(0.0001, at + each * 0.98);
            oscs.forEach((osc, n) => {
                const mult = n + 1;
                osc.frequency.setValueAtTime(330 * mult, at);
                osc.frequency.exponentialRampToValueAtTime(700 * mult, at + each * 0.5);
                osc.frequency.exponentialRampToValueAtTime(330 * mult, at + each * 0.98);
            });
        }
        const mix = this.ctx.createGain();
        mix.gain.value = 0.5;
        oscs[0].connect(filter).connect(g);
        oscs[1].connect(mix).connect(g);
        g.connect(this.sfxBus);
        for (const osc of oscs) {
            osc.start(t);
            osc.stop(t + length + 0.05);
        }
        return { gain: g, end: t + length };
    }

    // A lava geyser erupting (Volcano World): a deep, rushing roar, quieter
    // the further away it is (volume 0-1). Obeys the Sound effects switch.
    roar(volume = 1, length = 1.2) {
        if (!this.settings.sfx || !this.ctx || volume <= 0.01) return;
        this.onEvent('roar');
        const t = this.ctx.currentTime;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(900, t);
        f.frequency.exponentialRampToValueAtTime(300, t + length);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.9 * volume, t + 0.08);
        g.gain.exponentialRampToValueAtTime(0.0001, t + length);
        this.noiseSource(t, length + 0.05).connect(f).connect(g).connect(this.sfxBus);
    }

    // A trapdoor's warning (Desert Pyramid World, Level 104 on): a soft, low
    // rumble, like stone and sand grinding under the floor, that swells and
    // shudders for its 1 s warning. Quieter than the other sound effects and
    // quieter the further you are (volume 0-1). Obeys the Sound effects switch.
    rumble(volume = 1, length = 1) {
        if (!this.settings.sfx || !this.ctx || volume <= 0.01) return;
        this.onEvent('rumble');
        const t = this.ctx.currentTime;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 220;
        f.Q.value = 3;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.45 * volume, t + 0.25);
        // A shudder: the rumble wobbles up and down quickly
        for (let k = 1; k < 10; k++) g.gain.setTargetAtTime((k % 2 ? 0.25 : 0.45) * volume, t + 0.25 + (k * (length - 0.35)) / 10, 0.02);
        g.gain.setTargetAtTime(0.0001, t + length - 0.1, 0.05);
        this.noiseSource(t, length + 0.2).connect(f).connect(g).connect(this.sfxBus);
        // and a deep hum under it
        const o = this.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(48, t);
        o.frequency.linearRampToValueAtTime(56, t + length);
        const og = this.ctx.createGain();
        og.gain.setValueAtTime(0.0001, t);
        og.gain.exponentialRampToValueAtTime(0.25 * volume, t + 0.3);
        og.gain.setTargetAtTime(0.0001, t + length - 0.1, 0.05);
        o.connect(og).connect(this.sfxBus);
        o.start(t);
        o.stop(t + length + 0.3);
    }

    // A snowman's own volume knob (Ice World): every rolling sound of his
    // snowballs goes through it, so main.js can turn him up as you come
    // closer and down as you walk away while a snowball is still rolling.
    // Returns null until sound has started.
    snowmanVoice() {
        if (!this.ctx) return null;
        const gain = this.ctx.createGain();
        gain.gain.value = 0;
        gain.connect(this.sfxBus);
        return { gain };
    }

    // Set a snowman's loudness (0-1); a tiny glide keeps it from clicking
    setVoice(voice, volume) {
        if (!voice || !this.ctx) return;
        voice.gain.gain.setTargetAtTime(Math.max(0, volume), this.ctx.currentTime, 0.03);
    }

    // A snowball rolling down the hallway (Ice World, Gray 2026-10-16): balls
    // tumbling down a hallway or a slope. A low, bumpy rumble (no hiss) with
    // a soft thud on every tumble, for `length` seconds, through the
    // snowman's voice. Obeys the Sound effects switch. Returns a handle for
    // hush(), or null.
    roll(voice, length) {
        if (!this.settings.sfx || !this.ctx || !voice) return null;
        this.onEvent('roll');
        const t = this.ctx.currentTime;
        const end = t + length;
        const out = this.ctx.createGain();
        out.gain.setValueAtTime(0.0001, t);
        out.gain.exponentialRampToValueAtTime(ROLL_LEVEL, t + 0.06);
        out.gain.setValueAtTime(ROLL_LEVEL, Math.max(t + 0.06, end - 0.08));
        out.gain.exponentialRampToValueAtTime(0.0001, end);
        out.connect(voice.gain);
        // The rumble: noise kept low (nothing above about 400 Hz), wobbling
        const low = this.ctx.createBiquadFilter();
        low.type = 'lowpass';
        low.frequency.value = 380;
        low.Q.value = 3;
        const rumble = this.ctx.createGain();
        rumble.gain.value = 0.5;
        const wobble = this.ctx.createOscillator();
        wobble.frequency.value = 9;
        const depth = this.ctx.createGain();
        depth.gain.value = 0.3;
        wobble.connect(depth).connect(rumble.gain);
        wobble.start(t);
        wobble.stop(end + 0.05);
        this.noiseSource(t, length + 0.05).connect(low).connect(rumble).connect(out);
        // The tumbles: little low thuds at uneven steps, like a ball bouncing
        // along as it rolls
        for (let at = t + 0.02; at < end - 0.05; at += 0.07 + Math.random() * 0.06) {
            const thud = this.ctx.createOscillator();
            thud.type = 'triangle';
            const pitch = 70 + Math.random() * 50;
            thud.frequency.setValueAtTime(pitch * 1.6, at);
            thud.frequency.exponentialRampToValueAtTime(pitch, at + 0.05);
            const g = this.ctx.createGain();
            const peak = 0.35 + Math.random() * 0.3;
            g.gain.setValueAtTime(0.0001, at);
            g.gain.exponentialRampToValueAtTime(peak, at + 0.008);
            g.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
            thud.connect(g).connect(out);
            thud.start(at);
            thud.stop(at + 0.1);
        }
        return { gain: out, end };
    }

    // A snowball hitting you: a soft, muffled, crunchy "fwump" of packed
    // snow, then a little sprinkle of falling snow. Every part fades in over a
    // few hundredths of a second, so there's no sharp pop or burst.
    splat() {
        if (!this.settings.sfx || !this.ctx) return;
        this.onEvent('splat');
        const t = this.ctx.currentTime;
        const envelope = (at, attack, peak, length) => {
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0.0001, at);
            g.gain.exponentialRampToValueAtTime(peak, at + attack);
            g.gain.exponentialRampToValueAtTime(0.0001, at + length);
            return g;
        };
        // The "fwump": a low, soft body of muffled noise and a dropping thud
        const body = this.ctx.createBiquadFilter();
        body.type = 'lowpass';
        body.frequency.setValueAtTime(700, t);
        body.frequency.exponentialRampToValueAtTime(220, t + 0.25);
        body.Q.value = 0.5;
        this.noiseSource(t, 0.32).connect(body).connect(envelope(t, 0.03, 0.8, 0.3)).connect(this.sfxBus);
        const thud = this.ctx.createOscillator();
        thud.type = 'sine';
        thud.frequency.setValueAtTime(120, t);
        thud.frequency.exponentialRampToValueAtTime(55, t + 0.2);
        thud.connect(envelope(t, 0.025, 0.35, 0.22)).connect(this.sfxBus);
        thud.start(t);
        thud.stop(t + 0.24);
        // The crunch: a few quick, quiet grains of packed snow breaking apart
        for (let k = 0; k < 6; k++) {
            const at = t + 0.02 + k * 0.022 + Math.random() * 0.012;
            const crunch = this.ctx.createBiquadFilter();
            crunch.type = 'bandpass';
            crunch.frequency.value = 1100 + Math.random() * 900;
            crunch.Q.value = 1.2;
            this.noiseSource(at, 0.05).connect(crunch).connect(envelope(at, 0.006, 0.12 + Math.random() * 0.08, 0.045)).connect(this.sfxBus);
        }
        // The sprinkle: soft, airy falling snow that fades away
        const sprinkle = this.ctx.createBiquadFilter();
        sprinkle.type = 'bandpass';
        sprinkle.frequency.value = 3200;
        sprinkle.Q.value = 0.7;
        const at = t + 0.12;
        this.noiseSource(at, 0.65).connect(sprinkle).connect(envelope(at, 0.08, 0.08, 0.6)).connect(this.sfxBus);
    }

    // A robot arm pushing you off its belt: a hollow metal "clonk"
    // A firework bursting (Level 100's ending): a sharp crack, then a
    // crackle of tiny sparkles. A sound effect, so the Sound effects switch
    // turns it off.
    pop() {
        if (!this.settings.sfx || !this.ctx) return;
        this.onEvent('pop');
        const t = this.ctx.currentTime + 0.01;
        const crack = this.noiseSource(t, 0.25);
        const low = this.ctx.createBiquadFilter();
        low.type = 'lowpass';
        low.frequency.value = 1800;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.5, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        crack.connect(low).connect(g).connect(this.sfxBus);
        for (let k = 0; k < 7; k++) {
            const at = t + 0.12 + Math.random() * 0.5;
            const src = this.noiseSource(at, 0.04);
            const high = this.ctx.createBiquadFilter();
            high.type = 'highpass';
            high.frequency.value = 5000;
            const sg = this.ctx.createGain();
            sg.gain.setValueAtTime(0.0001, at);
            sg.gain.exponentialRampToValueAtTime(0.12, at + 0.003);
            sg.gain.exponentialRampToValueAtTime(0.0001, at + 0.035);
            src.connect(high).connect(sg).connect(this.sfxBus);
        }
    }

    // A button door's button (Desert Pyramid World) sinking: a stone click
    click() {
        if (!this.settings.sfx || !this.ctx) return;
        this.onEvent('click');
        const t = this.ctx.currentTime + 0.005;
        const src = this.noiseSource(t, 0.05);
        const high = this.ctx.createBiquadFilter();
        high.type = 'bandpass';
        high.frequency.value = 2600;
        high.Q.value = 1.2;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.45, t + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
        src.connect(high).connect(g).connect(this.sfxBus);
        const o = this.ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.setValueAtTime(260, t);
        o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
        const og = this.ctx.createGain();
        og.gain.setValueAtTime(0.0001, t);
        og.gain.exponentialRampToValueAtTime(0.3, t + 0.004);
        og.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
        o.connect(og).connect(this.sfxBus);
        o.start(t);
        o.stop(t + 0.12);
    }

    // A heavy stone door sliding down into the floor: a low grinding rumble
    // for `length` seconds, ending in a soft thud
    grind(length = 1) {
        if (!this.settings.sfx || !this.ctx) return;
        this.onEvent('grind');
        const t = this.ctx.currentTime + 0.02;
        const src = this.noiseSource(t, length + 0.1);
        const low = this.ctx.createBiquadFilter();
        low.type = 'lowpass';
        low.frequency.value = 420;
        low.Q.value = 2;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.55, t + 0.12);
        // Little scrapes and bumps as it goes
        for (let k = 1; k < 8; k++) g.gain.setTargetAtTime(k % 2 ? 0.35 : 0.6, t + (k * length) / 8, 0.03);
        g.gain.setTargetAtTime(0.0001, t + length - 0.05, 0.04);
        src.connect(low).connect(g).connect(this.sfxBus);
        const o = this.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(90, t + length - 0.05);
        o.frequency.exponentialRampToValueAtTime(45, t + length + 0.25);
        const og = this.ctx.createGain();
        og.gain.setValueAtTime(0.0001, t + length - 0.05);
        og.gain.exponentialRampToValueAtTime(0.5, t + length);
        og.gain.exponentialRampToValueAtTime(0.0001, t + length + 0.3);
        o.connect(og).connect(this.sfxBus);
        o.start(t + length - 0.06);
        o.stop(t + length + 0.32);
    }

    clonk() {
        if (!this.settings.sfx || !this.ctx) return;
        this.onEvent('clonk');
        const t = this.ctx.currentTime;
        for (const [freq, level] of [[180, 0.35], [415, 0.18]]) {
            const o = this.ctx.createOscillator();
            o.type = 'triangle';
            o.frequency.setValueAtTime(freq, t);
            o.frequency.exponentialRampToValueAtTime(freq * 0.7, t + 0.25);
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(level, t + 0.01);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
            o.connect(g).connect(this.sfxBus);
            o.start(t);
            o.stop(t + 0.32);
        }
    }

    steam(t, length, from, to, freq) {
        const f = this.ctx.createBiquadFilter();
        f.type = 'highpass';
        f.frequency.value = freq;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(from, t + 0.05);
        g.gain.exponentialRampToValueAtTime(to, t + length * 0.8);
        g.gain.exponentialRampToValueAtTime(0.0001, t + length);
        this.noiseSource(t, length + 0.05).connect(f).connect(g).connect(this.sfxBus);
        return { gain: g, end: t + length };
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
    // sixSeven: Level 67's door says "Six seven!" instead (Iteration 130), in
    // the same voice, as loud, and with the same no-voice fallback
    cheer({ long = false, sixSeven = false } = {}) {
        if (!this.settings.sfx) return;
        this.onEvent(sixSeven ? 'sixseven' : 'cheer');
        if (sixSeven) {
            const ownSix = () => this.playOwnVoice((t) => this.syntheticSixSeven(t));
            if (!this.speak([['Six seven!', 1.5]], 1.05, ownSix)) ownSix();
            return;
        }
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

    // The game's own "six seven!": hissy s's and a k, and voice-like vowels
    // ("ih", "eh", "uh") through vowel filters, like the cheer's shouts
    syntheticSixSeven(t) {
        const out = this.ctx.createGain();
        out.gain.value = CHEER_LEVEL * 1.5; // short sounds: a bit more so it's as loud as the cheer
        out.connect(this.sfxBus);
        const hiss = (at, length, freq, level) => {
            const f = this.ctx.createBiquadFilter();
            f.type = 'highpass';
            f.frequency.value = freq;
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0.0001, at);
            g.gain.exponentialRampToValueAtTime(level, at + length * 0.3);
            g.gain.exponentialRampToValueAtTime(0.0001, at + length);
            this.noiseSource(at, length + 0.02).connect(f).connect(g).connect(out);
        };
        // "s" - "ih" - "ks"
        hiss(t, 0.14, 4500, 0.22);
        this.vowel(t + 0.12, 0.16, 300, 1.25, [[390, 1990, 2550]], out);
        hiss(t + 0.29, 0.03, 1800, 0.3); // the k's little click
        hiss(t + 0.32, 0.12, 4500, 0.2);
        // "s" - "eh" - "v" - "uh" - "n"
        t += 0.56;
        hiss(t, 0.13, 4500, 0.22);
        this.vowel(t + 0.11, 0.2, 320, 1.3, [[580, 1800, 2500]], out);
        this.vowel(t + 0.3, 0.06, 300, 1, [[250, 1400, 2400]], out, 0.4); // the v
        this.vowel(t + 0.35, 0.22, 290, 0.85, [[520, 1300, 2400]], out);
        this.vowel(t + 0.55, 0.16, 270, 0.9, [[260, 1700, 2600]], out, 0.5); // the n
    }

    // A voice-like buzz at `base` pitch (ending at base * glide) through the
    // vowel filters [f1, f2, f3], for `dur` seconds
    vowel(t, dur, base, glide, [[f1, f2, f3]], out, level = 1) {
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(base, t);
        osc.frequency.exponentialRampToValueAtTime(base * glide, t + dur);
        const voice = ctx.createGain();
        voice.gain.setValueAtTime(0.0001, t);
        voice.gain.exponentialRampToValueAtTime(0.09 * level, t + Math.min(0.03, dur * 0.3));
        voice.gain.setValueAtTime(0.09 * level, t + dur * 0.7);
        voice.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        for (const [freq, amount] of [[f1, 1], [f2, 0.6], [f3, 0.25]]) {
            const f = ctx.createBiquadFilter();
            f.type = 'bandpass';
            f.Q.value = 7;
            f.frequency.value = freq;
            const g = ctx.createGain();
            g.gain.value = amount * 3;
            osc.connect(f).connect(g).connect(voice);
        }
        voice.connect(out);
        osc.start(t);
        osc.stop(t + dur + 0.02);
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
